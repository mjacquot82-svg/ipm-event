// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
import { getApiBaseUrl } from './adminAuthService';

export type GlassStyle = { id: string; name: string; description: string };
export type VolunteerGlassesInfo = {
  open: boolean;
  closes_at: string;
  price_per_set_cents: number;
  set_size: number;
  styles: GlassStyle[];
  payment: string;
};

export const PRICE_PER_SET_CENTS = 1600;

export function orderTotalCents(quantities: Record<string, number>, price = PRICE_PER_SET_CENTS) {
  return Object.values(quantities).reduce((sum, q) => sum + (Number.isFinite(q) && q > 0 ? Math.floor(q) : 0), 0) * price;
}

export function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function request(path: string, init: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}/api/volunteer-glasses${path}`, init);
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try { detail = (await response.json()).detail || detail; } catch { /* ignore */ }
    const error = new Error(detail) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function getVolunteerGlassesStatus(): Promise<{ open: boolean; closes_at: string }> {
  return (await request('/status', { method: 'GET' })).json();
}

export async function unlockVolunteerGlasses(password: string): Promise<VolunteerGlassesInfo> {
  return (await request('/unlock', { method: 'POST', headers: { 'X-Volunteer-Password': password } })).json();
}

export async function submitVolunteerGlassesOrder(password: string, order: { name: string; contact: string; quantities: Record<string, number>; notes?: string }) {
  return (await request('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Volunteer-Password': password },
    body: JSON.stringify(order),
  })).json();
}

export async function getVolunteerGlassesOrders(adminPassword: string) {
  return (await request('/admin/orders', { method: 'GET', headers: { 'X-Admin-Password': adminPassword } })).json();
}

export async function getVolunteerGlassesCsv(adminPassword: string): Promise<string> {
  return (await request('/admin/orders.csv', { method: 'GET', headers: { 'X-Admin-Password': adminPassword } })).text();
}
