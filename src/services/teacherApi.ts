import { ControlDefinition } from '../data/controls';

export interface AuthorizedTeacherRecord {
  email: string;
  addedAt: string;
  addedBy?: string;
}

export interface VerifiedTeacherUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface TeacherAuthSessionResponse {
  authenticated: boolean;
  user: VerifiedTeacherUser;
  authorization: AuthorizedTeacherRecord;
}

export class TeacherApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly attemptedEmail?: string;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    attemptedEmail?: string
  ) {
    super(message);
    this.name = 'TeacherApiError';
    this.status = status;
    this.code = code;
    this.attemptedEmail = attemptedEmail;
  }
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (envUrl && envUrl.trim().replace(/\/+$/, '')) || DEFAULT_API_BASE_URL;
}

async function requestJson<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new TeacherApiError(
      `No se pudo conectar con el servidor del profesorado (${getApiBaseUrl()}). Verifica que el backend esté en ejecución.`,
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new TeacherApiError(
      data.message || `Error HTTP ${response.status}`,
      response.status,
      data.error || 'HTTP_ERROR',
      data.attemptedEmail
    );
  }

  return data as T;
}

export const teacherApi = {
  async checkHealth(): Promise<{ status: string; allowDevAuth: boolean }> {
    const res = await fetch(`${getApiBaseUrl()}/health`);
    if (!res.ok) {
      throw new Error('Backend healthcheck failed');
    }
    return res.json();
  },

  async verifySession(token: string): Promise<TeacherAuthSessionResponse> {
    return requestJson<TeacherAuthSessionResponse>('/auth/me', token);
  },

  async getControls(token: string): Promise<ControlDefinition[]> {
    const res = await requestJson<{ controls: ControlDefinition[] }>(
      '/controls',
      token
    );
    return res.controls;
  },

  async listTeachers(token: string): Promise<AuthorizedTeacherRecord[]> {
    const res = await requestJson<{ teachers: AuthorizedTeacherRecord[] }>(
      '/teachers',
      token
    );
    return res.teachers;
  },

  async addTeacher(
    token: string,
    email: string
  ): Promise<AuthorizedTeacherRecord> {
    const res = await requestJson<{ teacher: AuthorizedTeacherRecord }>(
      '/teachers',
      token,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
    return res.teacher;
  },

  async removeTeacher(token: string, email: string): Promise<void> {
    await requestJson<{ deleted: boolean }>(
      `/teachers/${encodeURIComponent(email)}`,
      token,
      {
        method: 'DELETE',
      }
    );
  },
};
