export const API_BASE_URL = 'https://api-laporanwe.mkverse.my.id/api';

// Helper to get authorization headers with stored token
export const getHeaders = () => {
  const token = localStorage.getItem('laporanwee_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Include X-Admin-Email if user is logged in
  try {
    const storedUser = localStorage.getItem('laporanwee_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed?.email) {
        headers['X-Admin-Email'] = parsed.email.trim();
      }
    }
  } catch (_) {}

  return headers;
};

// Error helper
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export const handleResponse = async (response: Response) => {
  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw {
      message: `Server mengembalikan response tidak valid (${response.status})`,
      status: response.status,
    } as ApiError;
  }

  if (!response.ok || data.success === false) {
    throw {
      message: data.message || data.error || `Terjadi kesalahan sistem (${response.status})`,
      status: response.status,
    } as ApiError;
  }

  return data;
};

export const api = {
  get: async (endpoint: string) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${formattedEndpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  post: async (endpoint: string, body: any) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${formattedEndpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  put: async (endpoint: string, body: any) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${formattedEndpoint}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  delete: async (endpoint: string) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${formattedEndpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};
