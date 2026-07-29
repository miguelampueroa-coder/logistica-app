import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

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

    deliver: (id: string, token: string) =>
      fetchAPI<{ message: string }>(`/api/orders/${id}/deliver`, {
        method: 'POST',
        token,
      }),

    getMy: (token: string) =>
      fetchAPI<{ shipments: any[] }>('/api/orders', { token }),
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
