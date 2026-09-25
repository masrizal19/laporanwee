let rawUrl = import.meta.env.VITE_API_URL || 'https://api-laporanwe.mkverse.my.id/api';
if (rawUrl && !rawUrl.endsWith('/api') && !rawUrl.endsWith('/api/')) {
  rawUrl = `${rawUrl.replace(/\/$/, '')}/api`;
}
export const API_BASE_URL = rawUrl.replace(/\/$/, '');

// Helper to get authorization headers with stored token
export const getHeaders = () => {
  const token = localStorage.getItem('laporanwee_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Error helper
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export const handleResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  let data: any = null;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    // Try to parse if it looks like JSON
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || 'Sistem mengalami kegagalan teknis.' };
    }
  }

  if (!response.ok) {
    throw {
      message: data?.message || data?.error || 'Terjadi kesalahan sistem.',
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
