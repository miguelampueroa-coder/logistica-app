import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

const LOCATION_REPORT_INTERVAL_MS = 15000;
const LOCATION_REPORT_DISTANCE_M = 30;

export default function ActiveScreen() {
  const { token } = useAuth();
  const [activeShipment, setActiveShipment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    loadActiveShipment();
  }, []);

  // Reporta la posición del prestador mientras el envío va camino (accepted
  // o in_transit); el backend reenvía cada update por WebSocket a quien lo
  // esté siguiendo (tracking-websocket.ts).
  useEffect(() => {
    const shouldTrack =
      activeShipment && (activeShipment.status === 'accepted' || activeShipment.status === 'in_transit');

    if (!shouldTrack || !token) {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        setLocationError('Permiso de ubicación rechazado. El tracking no funcionará.');
        return;
      }

      setLocationError(null);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_REPORT_INTERVAL_MS,
          distanceInterval: LOCATION_REPORT_DISTANCE_M,
        },
        (position) => {
          api.tracking
            .reportLocation(
              activeShipment.id,
              {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                speed: position.coords.speed ?? undefined,
                heading: position.coords.heading ?? undefined,
                accuracy: position.coords.accuracy ?? undefined,
              },
              token
            )
            .catch((err) => {
              const msg = err instanceof Error ? err.message : 'Error al reportar ubicación';
              setLocationError(msg);
              console.error('Error reporting location:', err);
            });
        }
      );
    })();

    return () => {
      cancelled = true;
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [activeShipment?.id, activeShipment?.status, token]);

  const loadActiveShipment = async () => {
    try {
      const data = await api.orders.getMy(token!);
      const active = data.shipments.find(
        (s: any) => s.status === 'accepted' || s.status === 'in_transit'
      );
      setActiveShipment(active || null);
      setLocationError(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al cargar envío activo';
      console.error('Error loading active shipment:', error);
      Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickup = async () => {
    Alert.alert(
      'Recoger Paquete',
      '¿Confirmas que has recogido el paquete?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await api.orders.pickup(activeShipment.id, token!);
              Alert.alert('Éxito', 'Paquete recogido. Dirígete al destino.');
              loadActiveShipment();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Error al recoger paquete');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  // La entrega se cierra con una foto del paquete entregado a la persona. Es
  // la única prueba de que el envío llegó, así que la cámara abre primero y el
  // envío solo se cierra si hay foto.
  const handleDeliver = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Se necesita la cámara',
        'Para cerrar la entrega hay que tomar una foto del paquete entregado. ' +
        'Activa el permiso de cámara en los ajustes del teléfono.'
      );
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      exif: false,
    });

    if (photo.canceled || !photo.assets?.length) return;

    setIsUpdating(true);
    try {
      // La ubicación acompaña a la foto: una prueba de entrega sin lugar vale
      // poco ante un reclamo. Si el GPS falla, se envía igual la foto.
      let coords: { lat: number; lng: number } | undefined;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        coords = undefined;
      }

      await api.orders.deliver(activeShipment.id, token!, {
        photoUri: photo.assets[0].uri,
        capturedLat: coords?.lat,
        capturedLng: coords?.lng,
      });

      Alert.alert('Éxito', '¡Envío completado! Ganancia registrada.');
      setActiveShipment(null);
    } catch (error: any) {
      Alert.alert(
        'No se pudo cerrar la entrega',
        error.message || 'El envío sigue en ruta. Revisa tu conexión e intenta de nuevo.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!activeShipment) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="car-outline" size={80} color="#d1d5db" />
        <Text style={styles.emptyTitle}>Sin envío activo</Text>
        <Text style={styles.emptySubtitle}>
          Ve a la pestaña "Disponibles" para tomar un envío
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status Banner */}
      <View
        style={[
          styles.statusBanner,
          activeShipment.status === 'in_transit'
            ? styles.statusTransit
            : styles.statusAccepted,
        ]}
      >
        <Ionicons
          name={activeShipment.status === 'in_transit' ? 'car' : 'checkmark-circle'}
          size={24}
          color="#fff"
        />
        <Text style={styles.statusText}>
          {activeShipment.status === 'in_transit'
            ? 'En camino al destino'
            : 'Paquete recogido - Listo para entregar'}
        </Text>
      </View>

      {/* Shipment Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={20} color="#22c55e" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Recogida</Text>
            <Text style={styles.infoValue}>{activeShipment.origin_address}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="flag-outline" size={20} color="#ef4444" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Entrega</Text>
            <Text style={styles.infoValue}>{activeShipment.dest_address}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="cube-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Paquete</Text>
            <Text style={styles.infoValue}>
              {activeShipment.packages?.description}
            </Text>
          </View>
        </View>

        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>Tu ganancia</Text>
          <Text style={styles.price}>
            ${activeShipment.total_price?.toLocaleString()} CLP
          </Text>
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {activeShipment.status === 'accepted' ? (
          <TouchableOpacity
            style={[styles.actionButton, isUpdating && styles.buttonDisabled]}
            onPress={handlePickup}
            disabled={isUpdating}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>
              {isUpdating ? 'Procesando...' : 'Confirmar Recogida'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.deliverButton, isUpdating && styles.buttonDisabled]}
            onPress={handleDeliver}
            disabled={isUpdating}
          >
            <Ionicons name="trophy" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>
              {isUpdating ? 'Procesando...' : 'Confirmar Entrega'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  statusAccepted: {
    backgroundColor: '#2563eb',
  },
  statusTransit: {
    backgroundColor: '#8b5cf6',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  infoValue: {
    fontSize: 15,
    color: '#1f2937',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  priceBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#16a34a',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#15803d',
    marginTop: 4,
  },
  actionContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  deliverButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
