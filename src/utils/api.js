const BASE = '/api';

function getToken() {
  return localStorage.getItem('secnd_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handle401() {
  localStorage.removeItem('secnd_token');
  localStorage.removeItem('secnd_user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
    ...options,
  });
  if (res.status === 401) {
    handle401();
    throw new Error('Session expired — please log in again');
  }
  if (res.status === 403) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail || '';
    if (detail.toLowerCase().includes('expired') || detail.toLowerCase().includes('limit')) {
      throw new Error(detail);
    }
    throw new Error(detail || 'Access denied');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res;
}

// ── Auth ─────────────────────────────────────────────────────────

export async function login(email, password) {
  const res = await request(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function getMe() {
  const res = await request(`${BASE}/auth/me`);
  return res.json();
}

// ── Admin ────────────────────────────────────────────────────────

export async function adminGetStats() {
  const res = await request(`${BASE}/admin/stats`);
  return res.json();
}

export async function adminListUsers() {
  const res = await request(`${BASE}/admin/users`);
  return res.json();
}

export async function adminCreateUser(data) {
  const res = await request(`${BASE}/admin/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminUpdateUser(id, data) {
  const res = await request(`${BASE}/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminDeleteUser(id) {
  const res = await request(`${BASE}/admin/users/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

// ── Usage Dashboard ─────────────────────────────────────────────

export async function adminGetUsageSummary(days = 7) {
  const res = await request(`${BASE}/admin/usage/summary?days=${days}`);
  return res.json();
}

export async function adminGetUsageByModule(days = 7) {
  const res = await request(`${BASE}/admin/usage/by-module?days=${days}`);
  return res.json();
}

export async function adminGetUsageByCase(caseId) {
  const res = await request(`${BASE}/admin/usage/by-case/${caseId}`);
  return res.json();
}

export async function adminGetUsageTimeline(days = 7, groupBy = 'hour') {
  const res = await request(`${BASE}/admin/usage/timeline?days=${days}&group_by=${groupBy}`);
  return res.json();
}

export async function adminGetUsageErrors(days = 7, limit = 50) {
  const res = await request(`${BASE}/admin/usage/errors?days=${days}&limit=${limit}`);
  return res.json();
}

// ── Cases ────────────────────────────────────────────────────────

export async function submitCase(data) {
  const res = await request(`${BASE}/cases`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function parseCase(rawText) {
  const res = await request(`${BASE}/cases/parse`, {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText }),
  });
  return res.json();
}

export async function getCase(id) {
  const res = await request(`${BASE}/cases/${id}`);
  return res.json();
}

export async function getReport(id) {
  const res = await request(`${BASE}/cases/${id}/report`);
  return res.json();
}

export async function submitFollowup(id, question) {
  const res = await request(`${BASE}/cases/${id}/followup`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
  return res.json();
}

export async function listCases(page = 1, perPage = 20) {
  const res = await request(
    `${BASE}/cases?page=${page}&per_page=${perPage}`,
  );
  return res.json();
}

export async function submitCaseWithFiles(formData) {
  const res = await fetch(`${BASE}/cases/submit-with-files`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (res.status === 401) { handle401(); throw new Error('Session expired'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export function downloadUrl(id, format) {
  return `${BASE}/cases/${id}/report/${format}`;
}

export async function submitAudio(formData) {
  const res = await fetch(`${BASE}/cases/audio`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (res.status === 401) { handle401(); throw new Error('Session expired'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function submitResearch(data) {
  const res = await request(`${BASE}/research`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function confirmResearch(data) {
  const res = await request(`${BASE}/research/confirm`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ── Pulse ────────────────────────────────────────────────────────

export async function getPulsePreferences() {
  const res = await request(`${BASE}/pulse/preferences`);
  return res.json();
}

export async function upsertPulsePreferences(data) {
  const res = await request(`${BASE}/pulse/preferences`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getLatestPulseDigest() {
  const res = await request(`${BASE}/pulse/digests/latest`);
  return res.json();
}

export async function listPulseDigests(page = 1, perPage = 10) {
  const res = await request(`${BASE}/pulse/digests?page=${page}&per_page=${perPage}`);
  return res.json();
}

export async function getPulseDigest(id) {
  const res = await request(`${BASE}/pulse/digests/${id}`);
  return res.json();
}

export async function triggerPulseDigest() {
  const res = await request(`${BASE}/pulse/digests/generate`, { method: 'POST' });
  return res.json();
}

export async function getPulseJournals() {
  const res = await request(`${BASE}/pulse/journals`);
  return res.json();
}

export async function getPulseSpecialties() {
  const res = await request(`${BASE}/pulse/specialties`);
  return res.json();
}

// ── Breaking (Pulse v2) ─────────────────────────────────────────

export async function getBreakingHeadlines() {
  const res = await request(`${BASE}/breaking/`);
  return res.json();
}

export async function updateBreakingPreferences(specialties) {
  const res = await request(`${BASE}/breaking/preferences`, {
    method: 'POST',
    body: JSON.stringify({ specialties }),
  });
  return res.json();
}

export async function triggerDeepResearch(headlineId) {
  const res = await request(`${BASE}/breaking/${headlineId}/deep-research`, {
    method: 'POST',
  });
  return res.json();
}

export async function registerPushToken(token, platform) {
  const res = await request(`${BASE}/breaking/push-token`, {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
  return res.json();
}
