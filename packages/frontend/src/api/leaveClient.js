// Thin fetch wrapper for the real Leave/Holiday backend (packages/backend/src/routes/leave.ts,
// holiday.ts) — mirrors auth/authClient.js's shape (same API_URL env var, same error handling).
// Unlike the rest of the app's mock `state.db`/`svc.*`, Leave/Holiday data is genuinely
// per-organization and lives in Postgres, so it always goes through here rather than local state.
import { getSession } from '../auth/authClient';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const token = getSession()?.token;
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Could not reach the server. Is the backend running?');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

// ---------- Leave types ----------
export const listLeaveTypes = () => request('/leave-types').then((b) => b.leaveTypes);
export const createLeaveType = (data) => request('/leave-types', { method: 'POST', body: JSON.stringify(data) }).then((b) => b.leaveType);
export const updateLeaveType = (id, data) => request(`/leave-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((b) => b.leaveType);

// ---------- Balance ----------
export const getLeaveBalance = (employeeId) => request(`/leave/balance${qs({ employeeId })}`).then((b) => b.balances);

// ---------- Requests ----------
export const listLeaveRequests = (filters) => request(`/leave/requests${qs(filters)}`).then((b) => b.requests);
export const applyForLeave = (data) => request('/leave/requests', { method: 'POST', body: JSON.stringify(data) }).then((b) => b.request);
export const cancelLeaveRequest = (id) => request(`/leave/requests/${id}/cancel`, { method: 'POST' });
export const approveLeaveRequest = (id) => request(`/leave/requests/${id}/approve`, { method: 'POST' });
export const rejectLeaveRequest = (id) => request(`/leave/requests/${id}/reject`, { method: 'POST' });

// ---------- Holidays ----------
export const listHolidays = () => request('/holidays').then((b) => b.holidays);
export const createHoliday = (data) => request('/holidays', { method: 'POST', body: JSON.stringify(data) }).then((b) => b.holiday);
export const updateHoliday = (id, data) => request(`/holidays/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((b) => b.holiday);
export const deleteHoliday = (id) => request(`/holidays/${id}`, { method: 'DELETE' });
