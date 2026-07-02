// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

const DEFAULT_API_BASE_URL = 'https://ipm-backend-eoiw.onrender.com';
const DEFAULT_EVENT_ID = 'ipm-2026';

export type OrganizerRole = 'Owner' | 'Communications' | 'Schedule';
export type BroadcastPriority = 'Normal' | 'Important' | 'Emergency';
export type BroadcastStatus = 'sent';
export type BroadcastAudience = 'Everyone';

export type OrganizerUser = {
  id: string;
  username: string;
  display_name: string;
  role: OrganizerRole;
  event_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
};

export type OrganizerAuthResponse = {
  user: OrganizerUser;
};

export type OrganizerUsersResponse = {
  users: OrganizerUser[];
  total_count: number;
};

export type Broadcast = {
  id: string;
  event_id: string;
  title: string;
  message: string;
  priority: BroadcastPriority;
  sender_username: string;
  sender_role: OrganizerRole;
  created_at: string;
  sent_at: string;
  status: BroadcastStatus;
  audience: BroadcastAudience;
};

export type BroadcastsResponse = {
  broadcasts: Broadcast[];
  total_count: number;
};

export type LoginPayload = {
  username: string;
  password: string;
  event_id?: string;
};

export type BootstrapPayload = LoginPayload & {
  display_name?: string;
};

export type CreateOrganizerUserPayload = BootstrapPayload & {
  role: OrganizerRole;
};

export type CreateBroadcastPayload = {
  title: string;
  message: string;
  priority: BroadcastPriority;
};

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_API_BASE_URL;
}

function getEventId(eventId?: string) {
  return eventId?.trim() || process.env.EXPO_PUBLIC_EVENT_ID || DEFAULT_EVENT_ID;
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function loginOrganizer(payload: LoginPayload) {
  return adminRequest<OrganizerAuthResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      username: payload.username.trim(),
      event_id: getEventId(payload.event_id),
    }),
  });
}

export function bootstrapOrganizerOwner(payload: BootstrapPayload) {
  return adminRequest<OrganizerAuthResponse>('/api/admin/bootstrap', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      username: payload.username.trim(),
      display_name: payload.display_name?.trim(),
      event_id: getEventId(payload.event_id),
    }),
  });
}

export function getCurrentOrganizer() {
  return adminRequest<OrganizerAuthResponse>('/api/admin/auth/me');
}

export function logoutOrganizer() {
  return adminRequest<{ status: string }>('/api/admin/auth/logout', {
    method: 'POST',
  });
}

export function listOrganizerUsers() {
  return adminRequest<OrganizerUsersResponse>('/api/admin/users');
}

export function createOrganizerUser(payload: CreateOrganizerUserPayload) {
  return adminRequest<OrganizerUser>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      username: payload.username.trim(),
      display_name: payload.display_name?.trim(),
      event_id: payload.event_id ? getEventId(payload.event_id) : undefined,
    }),
  });
}

export function listBroadcasts() {
  return adminRequest<BroadcastsResponse>('/api/admin/broadcasts');
}

export function createBroadcast(payload: CreateBroadcastPayload) {
  return adminRequest<Broadcast>('/api/admin/broadcasts', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title.trim(),
      message: payload.message.trim(),
      priority: payload.priority,
    }),
  });
}
