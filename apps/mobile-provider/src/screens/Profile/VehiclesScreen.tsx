import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

const VEHICLE_TYPES = [
  { value: 'moto', label: 'Moto', icon: '🏍️', capacity: 'Hasta 10kg' },
  { value: 'auto', label: 'Auto', icon: '🚗', capacity: 'Hasta 50kg' },
  { value: 'furgoneta', label: 'Furgoneta', icon: '🚐', capacity: 'Hasta 200kg' },
  { value: 'camioneta', label: 'Camioneta', icon: '🛻', capacity: 'Hasta 500kg' },
  { value: 'microbus', label: 'Microbús', icon: '🚌', capacity: 'Hasta 1000kg' },
  { value: 'camion', label: 'Camión', icon: '🚛', capacity: 'Hasta 5000kg' },
];

export default function VehiclesScreen() {
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await api.user.getVehicles(token!);
      setVehicles(data.vehicles);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVehicle = (vehicleType: string) => {
    const typeInfo = VEHICLE_TYPES.find((v) => v.value === vehicleType);
    Alert.alert(
      'Agregar Vehículo',
      `¿Deseas agregar un ${typeInfo?.label} a tu cuenta?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Agregar',
          onPress: async () => {
            if (isAdding) return;
            setIsAdding(true);
            try {
              await api.user.addVehicle(
                {
                  type: vehicleType,
                  capacity_kg: parseInt(typeInfo?.capacity.match(/\d+/)?.[0] || '10'),
                },
                token!
              );
              Alert.alert('Éxito', 'Vehículo agregado correctamente');
              loadVehicles();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Error al agregar vehículo');
            } finally {
              setIsAdding(false);
            }
          },
        },
      ]
    );
  };

  const renderVehicle = ({ item }: { item: any }) => {
    const typeInfo = VEHICLE_TYPES.find((v) => v.value === item.type);
    return (
      <View style={styles.vehicleCard}>
        <Text style={styles.vehicleIcon}>{typeInfo?.icon || '🚗'}</Text>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleType}>{typeInfo?.label || item.type}</Text>
          <Text style={styles.vehicleDetails}>
            {item.brand || 'Sin marca'} {item.model || ''} {item.year || ''}
          </Text>
          {item.plate && (
            <Text style={styles.vehiclePlate}>Patente: {item.plate}</Text>
          )}
        </View>
        <View style={[styles.statusDot, item.is_active && styles.statusActive]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <>
          <FlatList
            data={vehicles}
            renderItem={renderVehicle}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.sectionTitle}>Mis Vehículos</Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="car-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No tienes vehículos registrados</Text>
              </View>
            }
          />

          {/* Add Vehicle Section */}
          <View style={styles.addSection}>
            <Text style={styles.addTitle}>Agregar Vehículo</Text>
            <View style={styles.vehicleTypes}>
              {VEHICLE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={styles.typeButton}
                  onPress={() => handleAddVehicle(type.value)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={styles.typeLabel}>{type.label}</Text>
                  <Text style={styles.typeCapacity}>{type.capacity}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
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
  list: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  vehicleIcon: {
    fontSize: 32,
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  vehiclePlate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#d1d5db',
  },
  statusActive: {
    backgroundColor: '#22c55e',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  addSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  addTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  vehicleTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    width: '31%',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeIcon: {
    fontSize: 24,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  typeCapacity: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
});
