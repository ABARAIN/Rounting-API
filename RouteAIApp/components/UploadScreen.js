import React, { useState } from 'react';
import {
  View,
  Button,
  Text,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import RouteMap from './RouteMap';

export default function UploadScreen() {
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState(null);

  const uploadPDF = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (doc.canceled || !doc.assets || doc.assets.length === 0) return;

      const fileAsset = doc.assets[0];
      const formData = new FormData();
      formData.append('pdf', {
        uri: fileAsset.uri,
        type: 'application/pdf',
        name: fileAsset.name || 'upload.pdf',
      });

      setLoading(true);

      const response = await axios.post('http://192.168.100.15:5000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setRouteData(response.data);
    } catch (err) {
      Alert.alert("Upload Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title="Upload Route PDF" onPress={uploadPDF} />

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {routeData && (
        <View style={{ marginTop: 20 }}>
          <Text style={styles.label}>Origin: {routeData.origin}</Text>
          <Text style={styles.label}>Destination: {routeData.destination}</Text>
          <Text style={styles.label}>Waypoints:</Text>
          {routeData.waypoints?.map((wp, i) => <Text key={i}>• {wp}</Text>)}
        </View>
      )}

      {routeData && (
        <RouteMap
          origin={routeData.origin}
          destination={routeData.destination}
          waypoints={routeData.waypoints}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    marginTop: 10,
    fontWeight: 'bold',
  },
});
