import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

export default function ShipmentDetailScreen({ route, navigation }: any) {
  const { shipmentId } = route.params;
  const { token } = useAuth();
  const [shipment, setShipment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    loadShipment();
  }, []);

  const loadShipment = async () => {
    try {
      const data = await api.orders.getById(shipmentId, token!);
      setShipment(data.shipment);
    } catch (error) {
      console.error('Error loading shipment:', error);
      Alert.alert('Error', 'No se pudo cargar el envío');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    Alert.alert(
      'Aceptar Envío',
      '¿Estás seguro de que quieres aceptar este envío?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setIsAccepting(true);
            try {
              // TODO: Seleccionar vehículo
              await api.orders.accept(shipmentId, 'default-vehicle-id', token!);
              Alert.alert('Éxito', 'Envío aceptado correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Error al aceptar envío');
            } finally {
              setIsAccepting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Envío no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Price Header */}
      <View style={styles.priceHeader}>
        <Text style={styles.priceLabel}>Ganancia estimada</Text>
        <Text style={styles.price}>${shipment.total_price?.toLocaleString()} CLP</Text>
      </View>

      {/* Package Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Paquete</Text>
        <View style={styles.infoCard}>
          <Text style={styles.description}>
            {shipment.packages?.description || 'Sin descripción'}
          </Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Peso</Text>
              <Text style={styles.detailValue}>{shipment.packages?.weight_kg} kg</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Dimensiones</Text>
              <Text style={styles.detailValue}>
                {shipment.packages?.length_cm}x{shipment.packages?.width_cm}x{shipment.packages?.height_cm} cm
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Distancia</Text>
              <Text style={styles.detailValue}>{shipment.distance_km} km</Text>
            </View>
            {shipment.packages?.declared_value && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Valor declarado</Text>
                <Text style={styles.detailValue}>
                  ${shipment.packages.declared_value.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Origin */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Recogida</Text>
        <View style={styles.addressCard}>
          <Ionicons name="location" size={20} color="#22c55e" />
          <View style={styles.addressInfo}>
            <Text style={styles.address}>{shipment.origin_address}</Text>
            {shipment.origin_contact_name && (
              <Text style={styles.contact}>
                Contacto: {shipment.origin_contact_name}
                {shipment.origin_contact_phone && ` • ${shipment.origin_contact_phone}`}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Destination */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏁 Entrega</Text>
        <View style={styles.addressCard}>
          <Ionicons name="flag" size={20} color="#ef4444" />
          <View style={styles.addressInfo}>
            <Text style={styles.address}>{shipment.dest_address}</Text>
            {shipment.dest_contact_name && (
              <Text style={styles.contact}>
                Contacto: {shipment.dest_contact_name}
                {shipment.dest_contact_phone && ` • ${shipment.dest_contact_phone}`}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Notes */}
      {shipment.packages?.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Notas</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notes}>{shipment.packages.notes}</Text>
          </View>
        </View>
      )}

      {/* Accept Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.acceptButton, isAccepting && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={isAccepting}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.acceptButtonText}>
            {isAccepting ? 'Aceptando...' : 'Aceptar Envío'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
  },
  priceHeader: {
    backgroundColor: '#2563eb',
    padding: 24,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  description: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    minWidth: 100,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 2,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  addressInfo: {
    flex: 1,
  },
  address: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  contact: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  notesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  notes: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  acceptButton: {
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
  acceptButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
