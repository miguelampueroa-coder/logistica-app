import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';

interface FetchOptions extends RequestInit {
  token?: string;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeToRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function notifyRefresh(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function refreshToken(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const { token: newToken } = await response.json();
    await AsyncStorage.setItem('auth_token', newToken);
    return newToken;
  } catch {
    return null;
  }
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  // Con FormData no se fija Content-Type: fetch tiene que poner el suyo con el
  // boundary del multipart. Si se lo forzamos a application/json, el servidor
  // no puede separar las partes y el archivo se pierde.
  const isMultipart = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  // Handle 401 — attempt token refresh
  if (response.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshToken(token);
      isRefreshing = false;

      if (newToken) {
        notifyRefresh(newToken);
        // Retry with new token
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...fetchOptions,
          headers,
        });
      } else {
        // Refresh failed — clear auth and sign out
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_user');
        throw new Error('Session expired. Please log in again.');
      }
    } else {
      // Wait for refresh to complete
      return new Promise((resolve, reject) => {
        subscribeToRefresh((newToken) => {
          headers['Authorization'] = `Bearer ${newToken}`;
          fetch(`${API_BASE_URL}${endpoint}`, { ...fetchOptions, headers })
            .then((res) => (res.ok ? res.json().then(resolve) : reject(res.statusText)))
            .catch(reject);
        });
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    register: (data: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role?: 'provider';
    }) =>
      fetchAPI<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    login: (data: { email: string; password: string }) =>
      fetchAPI<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  orders: {
    getAvailable: (token: string) =>
      fetchAPI<{ shipments: any[] }>('/api/orders/available', { token }),

    getById: (id: string, token: string) =>
      fetchAPI<{ shipment: any }>(`/api/orders/${id}`, { token }),

    accept: (id: string, vehicleId: string, token: string) =>
      fetchAPI<{ message: string }>(`/api/orders/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ vehicle_id: vehicleId }),
        token,
      }),

    pickup: (id: string, token: string) =>
      fetchAPI<{ message: string }>(`/api/orders/${id}/pickup`, {
        method: 'POST',
        token,
      }),

    /**
     * Cierra el envío. La foto del paquete entregado es obligatoria: el
     * backend rechaza la entrega sin ella.
     */
    deliver: (
      id: string,
      token: string,
      evidence: {
        photoUri: string;
        capturedLat?: number;
        capturedLng?: number;
        receiverName?: string;
      }
    ) => {
      const form = new FormData();

      form.append('photo', {
        uri: evidence.photoUri,
        name: 'entrega.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);

      if (evidence.capturedLat !== undefined) {
        form.append('captured_lat', String(evidence.capturedLat));
      }
      if (evidence.capturedLng !== undefined) {
        form.append('captured_lng', String(evidence.capturedLng));
      }
      if (evidence.receiverName) {
        form.append('receiver_name', evidence.receiverName);
      }

      // Sin Content-Type a mano: fetch le pone el boundary del multipart.
      return fetchAPI<{ message: string }>(`/api/orders/${id}/deliver`, {
        method: 'POST',
        token,
        body: form,
      });
    },

    getMy: (token: string) =>
      fetchAPI<{ shipments: any[] }>('/api/orders', { token }),
  },

  tracking: {
    reportLocation: (
      shipmentId: string,
      data: { lat: number; lng: number; speed?: number; heading?: number; accuracy?: number },
      token: string
    ) =>
      fetchAPI<{ message: string; eta: number }>(`/api/tracking/${shipmentId}/location`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
  },

  push: {
    register: (data: { token: string; platform: 'ios' | 'android' }, token: string) =>
      fetchAPI<{ message: string }>('/api/push/register', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
  },

  user: {
    getProfile: (token: string) =>
      fetchAPI<{ profile: any }>('/api/user/profile', { token }),

    updateProfile: (data: any, token: string) =>
      fetchAPI<{ message: string }>('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
        token,
      }),

    addVehicle: (data: any, token: string) =>
      fetchAPI<{ vehicle: any }>('/api/user/vehicles', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),

    getVehicles: (token: string) =>
      fetchAPI<{ vehicles: any[] }>('/api/user/vehicles', { token }),

    getEarnings: (token: string) =>
      fetchAPI<{ earnings: any }>('/api/user/earnings', { token }),
  },
};
