import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

export default function EarningsScreen() {
  const { token } = useAuth();
  const [earnings, setEarnings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    try {
      const data = await api.user.getEarnings(token!);
      setEarnings(data.earnings);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Total Earnings */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Ganancias Totales</Text>
        <Text style={styles.totalAmount}>
          ${earnings?.total?.toLocaleString() || '0'} CLP
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="today-outline" size={24} color="#2563eb" />
          <Text style={styles.statLabel}>Hoy</Text>
          <Text style={styles.statValue}>
            ${earnings?.today?.toLocaleString() || '0'}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="cube-outline" size={24} color="#22c55e" />
          <Text style={styles.statLabel}>Entregas</Text>
          <Text style={styles.statValue}>
            {earnings?.total_deliveries || 0}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="trending-up-outline" size={24} color="#8b5cf6" />
          <Text style={styles.statLabel}>Promedio</Text>
          <Text style={styles.statValue}>
            $
            {earnings?.total_deliveries
              ? Math.round(earnings.total / earnings.total_deliveries).toLocaleString()
              : '0'}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
        <Text style={styles.infoText}>
          Las ganancias se calculan automáticamente al completar cada envío. El pago se
          realiza según el método seleccionado por el cliente.
        </Text>
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
  totalCard: {
    backgroundColor: '#2563eb',
    padding: 24,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    margin: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});
