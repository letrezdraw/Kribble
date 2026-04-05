import type { User, Room } from '@kribble/shared-types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async guestLogin(displayName?: string) {
    const result = await this.request<{ user: User; token: string }>('/auth/guest', {
      method: 'POST',
      body: { displayName },
    });
    this.setToken(result.token);
    return result;
  }

  async register(email: string, username: string) {
    const result = await this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: { email, username },
    });
    this.setToken(result.token);
    return result;
  }

  async getMe() {
    return this.request<{ user: User }>('/auth/me');
  }

  // Room endpoints
  async getRooms() {
    return this.request<{ rooms: Room[] }>('/rooms');
  }

  async createRoom(name: string, maxPlayers?: number, isPrivate?: boolean) {
    return this.request<{ room: Room }>('/rooms', {
      method: 'POST',
      body: { name, maxPlayers, isPrivate },
    });
  }

  async getRoom(code: string) {
    return this.request<{ room: Room }>(`/rooms/${code}`);
  }

  async joinRoom(code: string) {
    return this.request<{ room: Room }>(`/rooms/${code}/join`, {
      method: 'POST',
    });
  }

  async leaveRoom(code: string) {
    return this.request<{ message: string }>(`/rooms/${code}/leave`, {
      method: 'POST',
    });
  }

  async setReady(code: string, isReady: boolean) {
    return this.request<{ room: Room }>(`/rooms/${code}/ready`, {
      method: 'POST',
      body: { isReady },
    });
  }
}

export const api = new ApiService();
