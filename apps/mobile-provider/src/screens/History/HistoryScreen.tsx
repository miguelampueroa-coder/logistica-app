import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  delivered: { label: 'Entregado', color: '#22c55e', icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelado', color: '#ef4444', icon: 'close-circle' },
};

export default function HistoryScreen() {
  const { token } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api.orders.getMy(token!);
      const completed = data.shipments.filter(
        (s: any) => s.status === 'delivered' || s.status === 'cancelled'
      );
      setShipments(completed);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderShipment = ({ item }: { item: any }) => {
    const status = statusConfig[item.status] || statusConfig.delivered;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
            <Ionicons
              name={status.icon as any}
              size={14}
              color={status.color}
            />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
          <Text style={styles.date}>
            {item.delivered_at
              ? new Date(item.delivered_at).toLocaleDateString('es-CL')
              : new Date(item.created_at).toLocaleDateString('es-CL')}
          </Text>
        </View>

        <Text style={styles.description} numberOfLines={1}>
          {item.packages?.description || 'Sin descripción'}
        </Text>

        <View style={styles.route}>
          <Text style={styles.routeText} numberOfLines={1}>
            {item.origin_address} → {item.dest_address}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.distance}>{item.distance_km} km</Text>
          <Text style={[styles.price, item.status === 'cancelled' && styles.priceCancelled]}>
            {item.status === 'cancelled' ? 'Cancelado' : `$${item.total_price?.toLocaleString()}`}
          </Text>
        </View>
      </View>
    );
  };

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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Sin historial</Text>
            <Text style={styles.emptySubtitle}>
              Tus envíos completados aparecerán aquí
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
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  route: {
    marginBottom: 12,
  },
  routeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  distance: {
    fontSize: 14,
    color: '#6b7280',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  priceCancelled: {
    color: '#9ca3af',
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
  },
});
