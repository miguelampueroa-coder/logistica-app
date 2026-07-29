import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

export default function AvailableScreen({ navigation }: any) {
  const { token } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      const data = await api.orders.getAvailable(token!);
      setShipments(data.shipments);
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadShipments();
  };

  const renderShipment = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {item.distance_km ? `${item.distance_km} km` : 'N/A'}
          </Text>
        </View>
        {item.urgency && (
          <View style={[styles.badge, styles.urgentBadge]}>
            <Text style={[styles.badgeText, styles.urgentText]}>URGENTE</Text>
          </View>
        )}
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {item.packages?.description || 'Sin descripción'}
      </Text>

      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={16} color="#6b7280" />
        <Text style={styles.infoText} numberOfLines={1}>
          {item.origin_address}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="flag-outline" size={16} color="#6b7280" />
        <Text style={styles.infoText} numberOfLines={1}>
          {item.dest_address}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.packageInfo}>
          <Text style={styles.packageLabel}>Paquete</Text>
          <Text style={styles.packageValue}>
            {item.packages?.weight_kg} kg •{' '}
            {item.packages?.length_cm}x{item.packages?.width_cm}x{item.packages?.height_cm} cm
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Ganancia</Text>
          <Text style={styles.price}>${item.total_price?.toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={shipments}
        renderItem={renderShipment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No hay envíos disponibles</Text>
            <Text style={styles.emptySubtitle}>
              Los envíos aparecerán aquí cuando los clientes los publiquen
            </Text>
          </View>
        }
      />
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  urgentBadge: {
    backgroundColor: '#fef3c7',
  },
  urgentText: {
    color: '#d97706',
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  packageInfo: {
    flex: 1,
  },
  packageLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  packageValue: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
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
});
