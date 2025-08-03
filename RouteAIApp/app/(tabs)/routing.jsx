import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import axios from 'axios';
import polyline from '@mapbox/polyline';

const GOOGLE_API_KEY = 'AIzaSyDwf94FdCPhJCDPgUVOOSJ8UnOSpO3r1B4'; // Replace with your real key

export default function Routing() {
  const [routeCoords, setRouteCoords] = useState([]);
  const [steps, setSteps] = useState([]);
  const [summary, setSummary] = useState({ distance: '', duration: '' });
  const [region, setRegion] = useState(null);

  const origin = '123 Main St, Jackson, MS';
  const destination = '789 Oak St, Jackson, MS';
  const waypoints = ['456 Elm St, Jackson, MS', '678 Pine St, Jackson, MS'];

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const waypointsParam = waypoints.join('|');
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/directions/json`,
          {
            params: {
              origin,
              destination,
              waypoints: waypointsParam,
              key: GOOGLE_API_KEY,
            },
          }
        );

        const route = response.data.routes[0];
        const points = route.overview_polyline.points;
        const decodedPoints = polyline.decode(points);
        const coords = decodedPoints.map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRouteCoords(coords);

        // Extract steps
        const routeSteps = route.legs.flatMap(leg =>
          leg.steps.map(step => step.html_instructions.replace(/<[^>]+>/g, ''))
        );
        setSteps(routeSteps);

        // Distance + Duration summary
        const leg = route.legs[0];
        setSummary({
          distance: leg.distance.text,
          duration: leg.duration.text,
        });

        setRegion({
          latitude: coords[0].latitude,
          longitude: coords[0].longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch (err) {
        console.error('❌ Failed to fetch route:', err);
      }
    };

    fetchRoute();
  }, []);

  return (
    <View style={styles.container}>
      {region && (
        <MapView style={styles.map} region={region}>
          <Polyline coordinates={routeCoords} strokeWidth={5} strokeColor="#4285F4" />
          <Marker coordinate={routeCoords[0]} title="Start" />
          <Marker coordinate={routeCoords[routeCoords.length - 1]} title="End" />
        </MapView>
      )}

      <View style={styles.bottomSheet}>
        <Text style={styles.summary}>
          {summary.duration} • {summary.distance}
        </Text>
        <ScrollView style={styles.stepList}>
          {steps.map((step, idx) => (
            <Text key={idx} style={styles.stepItem}>
              {idx + 1}. {step}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    maxHeight: '40%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 5,
    padding: 12,
  },
  summary: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  stepList: {
    paddingBottom: 20,
  },
  stepItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
});
