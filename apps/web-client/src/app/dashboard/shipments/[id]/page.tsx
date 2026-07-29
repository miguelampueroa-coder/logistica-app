'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import {
  ArrowLeft, Package, Clock, Truck, CheckCircle, XCircle,
  MapPin, Phone, User, Navigation, AlertTriangle,
} from 'lucide-react';

const STATUS_FLOW = ['pending', 'accepted', 'in_transit', 'delivered'] as const;

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  accepted: { label: 'Aceptado', color: 'bg-blue-100 text-blue-800', icon: Truck },
  in_transit: { label: 'En tránsito', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const stepLabels: Record<string, string> = {
  pending: 'Buscando repartidor',
  accepted: 'Repartidor asignado',
  in_transit: 'En camino',
  delivered: 'Entregado',
};

function mapUrl(lat: number, lng: number) {
  const d = 0.03;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [shipment, setShipment] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { shipment: data } = await api.orders.getById(id, token);
      setShipment(data);

      if (data.status !== 'pending' && data.status !== 'cancelled') {
        try {
          const { tracking: t } = await api.tracking.get(id, token);
          setTracking(t);
        } catch {
          setTracking(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar el envío');
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresco mientras el paquete va en camino.
  useEffect(() => {
    if (shipment?.status !== 'in_transit') return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [shipment?.status, load]);

  const handleCancel = async () => {
    if (!token || !confirm('¿Seguro que quieres cancelar este envío?')) return;
    setCancelling(true);
    try {
      await api.orders.cancel(id, 'Cancelado por el cliente', token);
      await load();
    } catch (err: any) {
      setError(err.message || 'No se pudo cancelar');
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error && !shipment) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{error}</h2>
        <Link href="/dashboard/shipments" className="text-primary-600 hover:text-primary-700 font-medium">
          Volver a mis envíos
        </Link>
      </div>
    );
  }

  const status = statusConfig[shipment.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const canCancel = shipment.status === 'pending' || shipment.status === 'accepted';
  const isCancelled = shipment.status === 'cancelled';
  const currentStep = STATUS_FLOW.indexOf(shipment.status);

  const position = tracking?.currentLocation
    ? { lat: tracking.currentLocation.lat, lng: tracking.currentLocation.lng, live: true }
    : { lat: Number(shipment.origin_lat), lng: Number(shipment.origin_lng), live: false };

  return (
    <div>
      <Link
        href="/dashboard/shipments"
        className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Mis envíos
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
            {shipment.urgency && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Urgente
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {shipment.packages?.description || 'Envío'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            N.º {shipment.id.slice(0, 8)} · {new Date(shipment.created_at).toLocaleDateString('es-CL')}
          </p>
        </div>

        <div className="text-right">
          <p className="text-3xl font-bold text-primary-600 tabular-nums">
            ${shipment.total_price?.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-gray-500">CLP · {shipment.distance_km} km</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {!isCancelled && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            {STATUS_FLOW.map((step, i) => {
              const done = i <= currentStep;
              return (
                <div key={step} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && (
                    <div
                      className={`absolute top-4 right-1/2 w-full h-0.5 ${i <= currentStep ? 'bg-primary-600' : 'bg-gray-200'}`}
                    />
                  )}
                  <div
                    className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center ${
                      done ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {done ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                  </div>
                  <span className={`text-xs mt-2 text-center ${done ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {stepLabels[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Ubicación</h2>
              {position.live ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  En vivo
                </span>
              ) : (
                <span className="text-xs text-gray-500">Origen del envío</span>
              )}
            </div>
            <iframe
              key={`${position.lat},${position.lng}`}
              title="Mapa del envío"
              src={mapUrl(position.lat, position.lng)}
              width="100%"
              height="320"
              className="w-full h-80 border-0 block"
            />
            {tracking?.currentLocation?.updatedAt && (
              <p className="px-6 py-3 text-xs text-gray-500 border-t border-gray-100">
                Última señal: {new Date(tracking.currentLocation.updatedAt).toLocaleTimeString('es-CL')}
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recorrido</h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <MapPin className="h-5 w-5 text-primary-600" />
                  <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                </div>
                <div className="pb-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Retiro</p>
                  <p className="text-gray-900">{shipment.origin_address}</p>
                  {shipment.origin_contact_name && (
                    <p className="text-sm text-gray-500 mt-1">
                      {shipment.origin_contact_name}
                      {shipment.origin_contact_phone ? ` · ${shipment.origin_contact_phone}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Navigation className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Entrega</p>
                  <p className="text-gray-900">{shipment.dest_address}</p>
                  {shipment.dest_contact_name && (
                    <p className="text-sm text-gray-500 mt-1">
                      {shipment.dest_contact_name}
                      {shipment.dest_contact_phone ? ` · ${shipment.dest_contact_phone}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {tracking?.provider && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Repartidor</h2>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{tracking.provider.name}</p>
                  <p className="text-sm text-gray-500">
                    {tracking.provider.vehicleType}
                    {tracking.provider.vehiclePlate ? ` · ${tracking.provider.vehiclePlate}` : ''}
                  </p>
                </div>
              </div>
              {tracking.provider.phone && (
                <a
                  href={`tel:${tracking.provider.phone}`}
                  className="flex items-center justify-center gap-2 w-full border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Phone className="h-4 w-4" />
                  {tracking.provider.phone}
                </a>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Paquete</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Peso</dt>
                <dd className="text-gray-900 tabular-nums">{shipment.packages?.weight_kg} kg</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Medidas</dt>
                <dd className="text-gray-900 tabular-nums">
                  {shipment.packages?.length_cm}×{shipment.packages?.width_cm}×{shipment.packages?.height_cm} cm
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Pago</dt>
                <dd className="text-gray-900 capitalize">{shipment.payment_method || '—'}</dd>
              </div>
            </dl>
            {shipment.packages?.notes && (
              <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
                {shipment.packages.notes}
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Detalle del precio</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Base ({shipment.distance_km} km)</dt>
                <dd className="text-gray-900 tabular-nums">
                  ${shipment.base_price?.toLocaleString('es-CL')}
                </dd>
              </div>
              {shipment.urgency_fee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Urgencia</dt>
                  <dd className="text-gray-900 tabular-nums">
                    ${shipment.urgency_fee?.toLocaleString('es-CL')}
                  </dd>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100 font-semibold">
                <dt className="text-gray-900">Total</dt>
                <dd className="text-primary-600 tabular-nums">
                  ${shipment.total_price?.toLocaleString('es-CL')}
                </dd>
              </div>
            </dl>
          </div>

          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full border border-red-200 text-red-600 rounded-lg py-2.5 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              {cancelling ? 'Cancelando…' : 'Cancelar envío'}
            </button>
          )}

          {isCancelled && shipment.cancellation_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 mb-1">Envío cancelado</p>
              <p className="text-sm text-red-600">{shipment.cancellation_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
