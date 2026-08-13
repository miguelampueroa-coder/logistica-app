'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Package, Truck, Shield, Clock, MapPin, CreditCard } from 'lucide-react';
import WhatsAppButton from '@/components/WhatsAppButton';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight">
              Envía cualquier paquete
              <span className="text-primary-600"> rápido y seguro</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Plataforma tipo Uber para logística. Publica tu envío y conecta con
              prestadores de transporte cerca de ti.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link
                  href="/dashboard/new-shipment"
                  className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  <Package className="mr-2 h-5 w-5" />
                  Crear Envío
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary-700 transition-colors"
                  >
                    Comenzar Ahora
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center bg-white text-gray-900 px-8 py-3 rounded-lg text-lg font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Iniciar Sesión
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">¿Cómo funciona?</h2>
            <p className="mt-4 text-lg text-gray-600">
              Simple, rápido y seguro para todos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Package className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                1. Publica tu envío
              </h3>
              <p className="text-gray-600">
                Describe tu paquete, indica origen y destino. Recibe una cotización
                instantánea.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Truck className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                2. Un prestador lo toma
              </h3>
              <p className="text-gray-600">
                Cualquier persona con vehículo compatible puede aceptar tu envío.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                3. Tracking en tiempo real
              </h3>
              <p className="text-gray-600">
                Sigue tu paquete en tiempo real hasta que llegue a su destino.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Rápido</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Entregas en menos de 2 horas en tu ciudad
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Seguro</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Tus paquetes están protegidos durante todo el trayecto
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Flexible</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Paga con efectivo, tarjeta o transferencia
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Cualquier vehículo</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Desde motos hasta camiones, elige lo que necesites
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            ¿Listo para enviar?
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Únete a miles de usuarios que ya confían en Enviazo
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={user ? '/dashboard/new-shipment' : '/register'}
              className="inline-flex items-center justify-center bg-white text-primary-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              Comenzar Ahora
            </Link>
            <WhatsAppButton
              variant="hero"
              message="Hola Enviazo, quiero enviar un paquete. ¿Cuál es el costo?"
              phone="56912345678"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
