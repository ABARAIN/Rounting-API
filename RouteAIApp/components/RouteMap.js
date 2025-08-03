import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import axios from 'axios';
import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDwf94FdCPhJCDPgUVOOSJ8UnOSpO3r1B4'; // Replace with your API key

const RouteMap = () => {
  const [routeCoords, setRouteCoords] = useState([]);
  const [region, setRegion] = useState(null);
  const [originCoord, setOriginCoord] = useState(null);
  const [destCoord, setDestCoord] = useState(null);
  const [loading, setLoading] = useState(true);

  const origin = '123 Main St, Jackson, MS';
  const destination = '789 Oak St, Jackson, MS';
  const waypoints = ['456 Elm St, Jackson, MS', '678 Pine St, Jackson, MS'];

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const waypointsStr = waypoints.map(wp => encodeURIComponent(wp)).join('|');
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
          origin
        )}&destination=${encodeURIComponent(destination)}&waypoints=${waypointsStr}&key=${GOOGLE_MAPS_API_KEY}`;

        console.log('📡 Requesting route:', url);

        const response = await axios.get(url);
        const route = response.data.routes[0];

        if (route) {
          const points = polyline.decode(route.overview_polyline.points);
          const coords = points.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

          const startLoc = route.legs[0].start_location;
          const endLoc = route.legs[route.legs.length - 1].end_location;

          setRouteCoords(coords);
          setOriginCoord({ latitude: startLoc.lat, longitude: startLoc.lng });
          setDestCoord({ latitude: endLoc.lat, longitude: endLoc.lng });

          setRegion({
            latitude: startLoc.lat,
            longitude: startLoc.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        } else {
          console.warn('⚠️ No route returned.');
        }
      } catch (error) {
        console.error('❌ Error fetching directions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, []);

  if (loading || !region || !originCoord || !destCoord) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <MapView style={styles.map} initialRegion={region}>
      <Marker coordinate={originCoord} title="Start" />
      <Marker coordinate={destCoord} title="End" />
      <Polyline coordinates={routeCoords} strokeWidth={5} strokeColor="#007AFF" />
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RouteMap;
