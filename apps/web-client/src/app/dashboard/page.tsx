'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Package, Clock, CheckCircle, Truck, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { profile, token } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, in_transit: 0, completed: 0 });

  useEffect(() => {
    if (!token) return;
    api.orders.getMy(token)
      .then(data => {
        const shipments = data.shipments || [];
        const pending = shipments.filter(s => s.status === 'pending').length;
        const in_transit = shipments.filter(s => s.status === 'in_transit').length;
        const completed = shipments.filter(s => s.status === 'delivered').length;
        setStats({ total: shipments.length, pending, in_transit, completed });
      })
      .catch(() => {});
  }, [token]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {profile?.name || 'Usuario'}
        </h1>
        <p className="text-gray-600 mt-1">
          Gestiona tus envíos desde un solo lugar
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Envíos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Truck className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En Tránsito</p>
              <p className="text-2xl font-bold text-gray-900">{stats.in_transit}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/dashboard/new-shipment"
            className="flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Crear Nuevo Envío
          </Link>
          <Link
            href="/dashboard/shipments"
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            <Package className="h-5 w-5" />
            Ver Mis Envíos
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
        <div className="text-center py-8 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay actividad reciente</p>
          <p className="text-sm mt-1">Crea tu primer envío para comenzar</p>
        </div>
      </div>
    </div>
  );
}
