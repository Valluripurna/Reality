/**
 * Phone sign-in.
 *
 * Two modes:
 *  - demo   (default): no SMS is sent; the code is DEMO_OTP. Clearly labelled
 *           in the UI. Lets debug and release builds work with no backend.
 *  - server: EXPO_PUBLIC_AUTH_MODE=server and EXPO_PUBLIC_API_URL set. Codes
 *           are issued and checked by server/index.js (/api/auth/*).
 */
export const DEMO_OTP = '123456';

export type AuthResult = { ok: boolean; reason?: string };

export function authMode(): 'demo' | 'server' {
  return process.env.EXPO_PUBLIC_AUTH_MODE === 'server' && apiUrl() ? 'server' : 'demo';
}

function apiUrl() {
  const base = process.env.EXPO_PUBLIC_API_URL;
  return base && base.startsWith('http') ? base.replace(/\/$/, '') : null;
}

export function cleanPhone(input: string) {
  return input.replace(/\D/g, '').slice(-10);
}

export function isValidIndianMobile(input: string) {
  return /^[6-9]\d{9}$/.test(cleanPhone(input));
}

async function post(path: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${apiUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function requestOtp(phone: string): Promise<AuthResult> {
  if (!isValidIndianMobile(phone)) return { ok: false, reason: 'Enter a valid 10-digit mobile number.' };
  if (authMode() === 'demo') return { ok: true };
  try {
    const res = await post('/api/auth/request-otp', { phone: cleanPhone(phone) });
    if (res.ok) return { ok: true };
    return { ok: false, reason: res.status === 503 ? 'SMS sign-in is not set up on the server yet.' : 'Could not send the code. Try again.' };
  } catch {
    return { ok: false, reason: 'No connection. Check your internet and try again.' };
  }
}

export async function verifyOtp(phone: string, otp: string): Promise<AuthResult> {
  if (!/^\d{6}$/.test(otp)) return { ok: false, reason: 'Enter the 6-digit code.' };
  if (authMode() === 'demo') {
    return otp === DEMO_OTP ? { ok: true } : { ok: false, reason: 'That code is incorrect.' };
  }
  try {
    const res = await post('/api/auth/verify-otp', { phone: cleanPhone(phone), otp });
    return res.ok ? { ok: true } : { ok: false, reason: 'That code is incorrect or has expired.' };
  } catch {
    return { ok: false, reason: 'No connection. Check your internet and try again.' };
  }
}
