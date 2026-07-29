'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Package, Clock, Truck, CheckCircle, XCircle, Eye } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  accepted: { label: 'Aceptado', color: 'bg-blue-100 text-blue-800', icon: Truck },
  in_transit: { label: 'En Tránsito', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function ShipmentsPage() {
  const { token } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      const data = await api.orders.getMy(token!);
      setShipments(data.shipments);
    } catch (err: any) {
      setError(err.message || 'Error al cargar envíos');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Envíos</h1>
          <p className="text-gray-600 mt-1">
            {shipments.length} envío{shipments.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        <Link
          href="/dashboard/new-shipment"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          + Nuevo Envío
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {shipments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay envíos
          </h3>
          <p className="text-gray-600 mb-6">
            Crea tu primer envío para comenzar
          </p>
          <Link
            href="/dashboard/new-shipment"
            className="inline-flex items-center bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Crear Envío
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {shipments.map((shipment) => {
            const status = statusConfig[shipment.status] || statusConfig.pending;
            const StatusIcon = status.icon;

            return (
              <div
                key={shipment.id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                      {shipment.urgency && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Urgente
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1">
                      {shipment.packages?.description || 'Sin descripción'}
                    </h3>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">Origen:</span> {shipment.origin_address}
                      </p>
                      <p>
                        <span className="font-medium">Destino:</span> {shipment.dest_address}
                      </p>
                      <p>
                        <span className="font-medium">Distancia:</span> {shipment.distance_km} km
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">
                        ${shipment.total_price?.toLocaleString()} CLP
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(shipment.created_at).toLocaleDateString('es-CL')}
                      </p>
                    </div>

                    <Link
                      href={`/dashboard/shipments/${shipment.id}`}
                      className="flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      <Eye className="h-4 w-4" />
                      Ver detalle
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
