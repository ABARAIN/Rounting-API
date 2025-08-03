const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { PdfConverter } = require('pdf-poppler');
require('dotenv').config();

const app = express();
app.use(cors());

const uploadPath = './uploads';
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const upload = multer({ dest: uploadPath });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Step 1 - Try text extraction via pdfjs-dist
 */
async function extractTextWithPdfjs(buffer) {
  console.log("🔍 Trying pdfjs-dist to extract text...");
  try {
    const pdfjsLib = await import('pdfjs-dist/build/pdf.js');
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      text += strings.join(' ') + '\n';
    }
    return text.trim();
  } catch (e) {
    console.warn("⚠️ pdfjs-dist failed:", e.message);
    return '';
  }
}

/**
 * Step 2 - Try pdf-parse
 */
async function extractTextWithPdfParse(buffer) {
  console.log("🛠️ Trying pdf-parse...");
  try {
    const parsed = await pdfParse(buffer);
    return parsed.text?.trim() || '';
  } catch (e) {
    console.warn("⚠️ pdf-parse failed:", e.message);
    return '';
  }
}

/**
 * Step 3 - Convert PDF to image and use OCR
 */
async function extractTextWithOCR(filePath) {
  console.log("🖼️ Converting PDF to images for OCR...");
  const outputDir = `${filePath}_images`;
  fs.mkdirSync(outputDir, { recursive: true });

  const converter = new PdfConverter(filePath);
  await converter.convert(outputDir);

  const imageFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
  if (imageFiles.length === 0) throw new Error("No images created from PDF");

  const worker = await createWorker(['eng']);
  let finalText = '';

  for (const file of imageFiles) {
    const imgPath = path.join(outputDir, file);
    console.log(`🔍 OCR on image: ${file}`);
    const { data: { text } } = await worker.recognize(imgPath);
    finalText += text + '\n';
    fs.unlinkSync(imgPath);
  }

  await worker.terminate();
  fs.rmdirSync(outputDir);
  return finalText.trim();
}

app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    console.log("📥 File received:", req.file.originalname);
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);

    // Step 1: Try pdfjs-dist
    let text = await extractTextWithPdfjs(buffer);

    // Step 2: Try pdf-parse if empty
    if (!text || text.length < 50) {
      text = await extractTextWithPdfParse(buffer);
    }

    // Step 3: Use OCR if still empty
    if (!text || text.length < 50) {
      text = await extractTextWithOCR(filePath);
    }

    console.log("📄 Final extracted text length:", text.length);
    console.log("🧾 Preview (first 1000 chars):", text.slice(0, 1000));

    if (!text || text.length < 50) {
      return res.json({ origin: "Unknown Start", destination: "Unknown End", waypoints: [] });
    }

    const prompt = `
You are a routing assistant. Based on the following transport permit text, extract a route in JSON:

Respond ONLY in this format:
{
  "origin": "Start address or location",
  "destination": "End address or location",
  "waypoints": ["Stop 1", "Stop 2", ...]
}

Text:
"""${text}"""
    `;

    console.log("🧠 Sending prompt to OpenAI...");
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const resultText = completion.choices[0].message.content;
    console.log("🤖 OpenAI raw result:", resultText);

    let parsed;
    try {
      parsed = JSON.parse(resultText);
    } catch (e) {
      console.error("❌ JSON parsing failed:", e.message);
      throw new Error("OpenAI returned invalid JSON.");
    }

    console.log("✅ Final structured route:", parsed);
    res.json(parsed);
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: "Failed to process PDF", details: err.message });
  } finally {
    if (req.file?.path) fs.unlinkSync(req.file.path);
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
