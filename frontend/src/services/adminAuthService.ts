// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

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

export type AnnouncementPriority = 'Information' | 'Important' | 'Emergency';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export type Announcement = {
  id: string;
  event_id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: AnnouncementStatus;
};

export type AnnouncementsResponse = {
  announcements: Announcement[];
  total_count: number;
};

export type AnnouncementPayload = {
  title: string;
  message: string;
  priority: AnnouncementPriority;
  expires_at?: string | null;
  status: AnnouncementStatus;
};

export type NotificationDelivery = {
  id: string;
  event_id: string;
  announcement_id: string;
  audience: 'test' | 'everyone';
  provider: 'webpushr';
  provider_campaign_id: string | null;
  status: 'requested' | 'sent' | 'failed';
  requested_by: string;
  requested_at: string;
  sent_at: string | null;
  error_message: string | null;
  target_url: string;
  notification_title: string;
  notification_message: string;
};

export type AdminScheduleEvent = {
  id: string;
  row_number: number;
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_time: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  days_active: string;
  location_name: string | null;
};

export type AdminScheduleResponse = {
  events: AdminScheduleEvent[];
  last_updated: string;
  total_count: number;
};

export type AdminVendor = {
  id: string;
  name: string;
  type: string;
  location: string;
  hours_of_operation: string;
  days_of_operation: string;
  priority: number;
};

export type AdminVendorsResponse = {
  vendors: AdminVendor[];
  last_updated: string;
  total_count: number;
};

export type VendorPayload = {
  name: string;
  type?: string;
  location?: string;
  hours_of_operation?: string;
  days_of_operation?: string;
  priority?: number;
};

export type ScheduleEventPayload = {
  title: string;
  description?: string;
  start_date: string;
  start_time: string;
  end_time: string;
  category?: string;
  latitude?: number | null;
  longitude?: number | null;
  days_active?: string;
  location_name?: string | null;
};

export type ScheduleImportProblem = {
  row_number: number;
  errors: string[];
  values: Record<string, string>;
};

export type ScheduleImportRow = {
  row_number: number;
  data: ScheduleEventPayload;
};

export type ScheduleImportRequest = {
  rows: ScheduleImportRow[];
  problems: ScheduleImportProblem[];
};

export type ScheduleImportResponse = {
  imported_count: number;
  problem_count: number;
  problems: ScheduleImportProblem[];
  events: AdminScheduleEvent[];
  last_updated: string;
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
  return process.env.EXPO_PUBLIC_BACKEND_URL || '';
}

function getEventId(eventId?: string) {
  return eventId?.trim() || process.env.EXPO_PUBLIC_EVENT_ID || '';
}

export class AdminRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminRequestError';
    this.status = status;
  }
}

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
      if (typeof body?.detail === 'string') {
        message = body.detail;
      } else if (Array.isArray(body?.detail)) {
        const validationMessages = body.detail
          .map((item: unknown) => {
            if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string') {
              return item.msg;
            }
            return null;
          })
          .filter((item: string | null): item is string => Boolean(item));
        if (validationMessages.length) message = validationMessages.join('. ');
      }
    } catch {
      message = response.statusText || message;
    }
    throw new AdminRequestError(message, response.status);
  }

  if (response.status === 204) return undefined as T;

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

export function listAnnouncements() {
  return adminRequest<AnnouncementsResponse>('/api/admin/announcements');
}

export function createAnnouncement(payload: AnnouncementPayload) {
  return adminRequest<Announcement>('/api/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAnnouncement(id: string, payload: AnnouncementPayload) {
  return adminRequest<Announcement>(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function setAnnouncementStatus(id: string, status: AnnouncementStatus) {
  return adminRequest<Announcement>(`/api/admin/announcements/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deleteAnnouncement(id: string) {
  return adminRequest<void>(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function sendAnnouncementTestNotification(id: string) {
  return adminRequest<NotificationDelivery>(
    `/api/admin/announcements/${encodeURIComponent(id)}/notify/test`,
    { method: 'POST' }
  );
}

export function notifyEveryoneForAnnouncement(id: string) {
  return adminRequest<NotificationDelivery>(
    `/api/admin/announcements/${encodeURIComponent(id)}/notify/everyone`,
    { method: 'POST' }
  );
}

export function listScheduleEvents() {
  return adminRequest<AdminScheduleResponse>('/api/admin/schedule');
}

export function importSchedule(payload: ScheduleImportRequest) {
  return adminRequest<ScheduleImportResponse>('/api/admin/schedule/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createScheduleEvent(payload: ScheduleEventPayload) {
  return adminRequest<AdminScheduleResponse>('/api/admin/schedule/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateScheduleEvent(eventId: string, payload: ScheduleEventPayload) {
  return adminRequest<AdminScheduleResponse>(`/api/admin/schedule/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteScheduleEvent(eventId: string) {
  return adminRequest<AdminScheduleResponse>(`/api/admin/schedule/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
}

export function refreshScheduleEvents() {
  return adminRequest<AdminScheduleResponse>('/api/admin/schedule/refresh', {
    method: 'POST',
  });
}

export function listAdminVendors() {
  return adminRequest<AdminVendorsResponse>('/api/admin/vendors');
}

export function createAdminVendor(payload: VendorPayload) {
  return adminRequest<AdminVendorsResponse>('/api/admin/vendors', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name.trim(),
      type: payload.type?.trim() || '',
      location: payload.location?.trim() || '',
      hours_of_operation: payload.hours_of_operation?.trim() || '',
      days_of_operation: payload.days_of_operation?.trim() || '',
      priority: payload.priority ?? 99,
    }),
  });
}

export function updateAdminVendor(vendorId: string, payload: VendorPayload) {
  return adminRequest<AdminVendorsResponse>(`/api/admin/vendors/${encodeURIComponent(vendorId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name.trim(),
      type: payload.type?.trim() || '',
      location: payload.location?.trim() || '',
      hours_of_operation: payload.hours_of_operation?.trim() || '',
      days_of_operation: payload.days_of_operation?.trim() || '',
      priority: payload.priority ?? 99,
    }),
  });
}

export function deleteAdminVendor(vendorId: string) {
  return adminRequest<AdminVendorsResponse>(`/api/admin/vendors/${encodeURIComponent(vendorId)}`, {
    method: 'DELETE',
  });
}
