'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { MapPin, Package, AlertCircle, CheckCircle, CreditCard } from 'lucide-react';

// El backend mapea payment_method -> proveedor (card->stripe,
// transfer/qr->webpay) pero solo registra un proveedor si sus credenciales
// existen. Sin eso, crear un pago con ese método falla en silencio y el envío
// queda sin pago vinculado. Por eso el método se restringe a lo que devuelve
// /api/payments/providers.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Tarjeta',
  transfer: 'Transferencia',
  qr: 'Código QR',
};
// Sin efectivo: Enviazo solo acepta pagos virtuales.
const PROVIDER_TO_METHOD: Record<string, string> = {
  stripe: 'card',
  webpay: 'transfer',
};

export default function NewShipmentPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    // Package details
    package_description: '',
    package_weight_kg: '',
    package_length_cm: '',
    package_width_cm: '',
    package_height_cm: '',
    package_declared_value: '',
    package_notes: '',

    // Origin
    origin_address: '',
    origin_lat: '-41.4728',
    origin_lng: '-72.9406',
    origin_contact_name: '',
    origin_contact_phone: '',

    // Destination
    dest_address: '',
    dest_lat: '-41.4728',
    dest_lng: '-72.9406',
    dest_contact_name: '',
    dest_contact_phone: '',

    // Options
    urgency: false,
    payment_method: 'card',
  });

  useEffect(() => {
    api.payments.getProviders().then(({ providers }) => {
      const methods = providers.map((p) => PROVIDER_TO_METHOD[p]).filter(Boolean);
      setPaymentMethods(methods);
      if (methods.length > 0) {
        setFormData((prev) => ({ ...prev, payment_method: methods[0] }));
      }
      // Si no se pudo consultar los métodos, no se asume ninguno: antes caía a
      // efectivo, así que un fallo de red hacía que todos los envíos se crearan
      // en efectivo, que es justo lo que no se acepta.
    }).catch(() => setPaymentMethods([]));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const shipmentData = {
        ...formData,
        package_weight_kg: parseFloat(formData.package_weight_kg),
        package_length_cm: parseFloat(formData.package_length_cm),
        package_width_cm: parseFloat(formData.package_width_cm),
        package_height_cm: parseFloat(formData.package_height_cm),
        package_declared_value: formData.package_declared_value
          ? parseInt(formData.package_declared_value)
          : undefined,
        origin_lat: parseFloat(formData.origin_lat),
        origin_lng: parseFloat(formData.origin_lng),
        dest_lat: parseFloat(formData.dest_lat),
        dest_lng: parseFloat(formData.dest_lng),
      };

      await api.orders.create(shipmentData, token!);
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/shipments');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al crear el envío');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Envío Creado!</h2>
        <p className="text-gray-600">
          Tu envío ha sido publicado correctamente. Redirigiendo...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Crear Nuevo Envío</h1>
        <p className="text-gray-600 mt-1">
          Completa los detalles de tu paquete y seleccione origen y destino
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Package Details */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalles del Paquete
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción del contenido *
              </label>
              <input
                type="text"
                name="package_description"
                value={formData.package_description}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: Documentos, ropa, electrónicos..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peso (kg) *
              </label>
              <input
                type="number"
                name="package_weight_kg"
                value={formData.package_weight_kg}
                onChange={handleChange}
                required
                min="0.1"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="5.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor declarado (CLP)
              </label>
              <input
                type="number"
                name="package_declared_value"
                value={formData.package_declared_value}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="50000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Largo (cm) *
              </label>
              <input
                type="number"
                name="package_length_cm"
                value={formData.package_length_cm}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ancho (cm) *
              </label>
              <input
                type="number"
                name="package_width_cm"
                value={formData.package_width_cm}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alto (cm) *
              </label>
              <input
                type="number"
                name="package_height_cm"
                value={formData.package_height_cm}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="15"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas adicionales
              </label>
              <textarea
                name="package_notes"
                value={formData.package_notes}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Instrucciones especiales, manejo delicado, etc."
              />
            </div>
          </div>
        </div>

        {/* Origin */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            Dirección de Origen
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección completa *
              </label>
              <input
                type="text"
                name="origin_address"
                value={formData.origin_address}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Av. Principal 123, Puerto Montt"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de contacto
              </label>
              <input
                type="text"
                name="origin_contact_name"
                value={formData.origin_contact_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono de contacto
              </label>
              <input
                type="tel"
                name="origin_contact_phone"
                value={formData.origin_contact_phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="+56 9 1234 5678"
              />
            </div>
          </div>
        </div>

        {/* Destination */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-red-600" />
            Dirección de Destino
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección completa *
              </label>
              <input
                type="text"
                name="dest_address"
                value={formData.dest_address}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Calle Secundaria 456, Osorno"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de contacto
              </label>
              <input
                type="text"
                name="dest_contact_name"
                value={formData.dest_contact_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="María García"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono de contacto
              </label>
              <input
                type="tel"
                name="dest_contact_phone"
                value={formData.dest_contact_phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="+56 9 8765 4321"
              />
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Método de Pago
          </h2>

          {paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-500">Cargando métodos disponibles...</p>
          ) : (
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method] || method}
                </option>
              ))}
            </select>
          )}
          {paymentMethods.length === 0 && (
            <p className="text-xs text-red-600 mt-2">
              No hay métodos de pago disponibles en este momento. Intenta de nuevo en unos minutos.
            </p>
          )}
        </div>

        {/* Options */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Opciones</h2>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="urgency"
              id="urgency"
              checked={formData.urgency}
              onChange={handleChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="urgency" className="text-sm text-gray-700">
              Marcado como <span className="font-semibold text-orange-600">urgente</span> (+$300 CLP)
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creando...' : 'Crear Envío'}
          </button>
        </div>
      </form>
    </div>
  );
}
