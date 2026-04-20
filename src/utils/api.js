const BASE = '/api';

// Silent-refresh window: if the JWT expires within this many seconds,
// proactively call /auth/refresh before the outgoing request.
const REFRESH_THRESHOLD_SECONDS = 15 * 60;

function getToken() {
  return localStorage.getItem('secnd_token');
}

function setToken(token, user) {
  if (token) localStorage.setItem('secnd_token', token);
  if (user) localStorage.setItem('secnd_user', JSON.stringify(user));
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function decodeJwtExp(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return typeof data.exp === 'number' ? data.exp : null;
  } catch {
    return null;
  }
}

let refreshInFlight = null;

export async function refreshSession() {
  return refreshToken();
}

async function refreshToken() {
  const token = getToken();
  if (!token) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      setToken(data.access_token, data.user);
      window.dispatchEvent(new CustomEvent('secnd:token-refreshed', {
        detail: { token: data.access_token, user: data.user },
      }));
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function ensureFreshToken() {
  const token = getToken();
  if (!token) return;
  const exp = decodeJwtExp(token);
  if (!exp) return;
  const secondsLeft = exp - Math.floor(Date.now() / 1000);
  if (secondsLeft > 0 && secondsLeft < REFRESH_THRESHOLD_SECONDS) {
    await refreshToken();
  }
}

function handle401() {
  localStorage.removeItem('secnd_token');
  localStorage.removeItem('secnd_user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request(url, options = {}) {
  await ensureFreshToken();
  const doFetch = () => fetch(url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
    ...options,
  });
  let res = await doFetch();
  if (res.status === 401 && getToken()) {
    const newToken = await refreshToken();
    if (newToken) {
      res = await doFetch();
    }
  }
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

async function uploadWithAuth(url, formData) {
  await ensureFreshToken();
  const doFetch = () => fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  let res = await doFetch();
  if (res.status === 401 && getToken()) {
    const newToken = await refreshToken();
    if (newToken) res = await doFetch();
  }
  if (res.status === 401) { handle401(); throw new Error('Session expired'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function submitCaseWithFiles(formData) {
  return uploadWithAuth(`${BASE}/cases/submit-with-files`, formData);
}

export function downloadUrl(id, format) {
  return `${BASE}/cases/${id}/report/${format}`;
}

export async function submitAudio(formData) {
  return uploadWithAuth(`${BASE}/cases/audio`, formData);
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

// v7.0: Doctor topic personalisation
export async function saveBreakingTopics(specialtyTopics) {
  const res = await request(`${BASE}/breaking/topics`, {
    method: 'POST',
    body: JSON.stringify({ specialty_topics: specialtyTopics }),
  });
  return res.json();
}

export async function getBreakingTopics() {
  const res = await request(`${BASE}/breaking/topics`);
  return res.json();
}

// ── SDSS v2.0 (async via backend) ──────────────────────────────

export async function sdssSubmit(caseText, mode = 'standard', indiaContext = false) {
  const res = await request(`${BASE}/sdss/submit`, {
    method: 'POST',
    body: JSON.stringify({ case_text: caseText, mode, india_context: indiaContext }),
  });
  return res.json(); // { task_id }
}

export async function sdssSubmitWithFiles(formData) {
  return uploadWithAuth(`${BASE}/sdss/submit-with-files`, formData);
}

export async function sdssGetTask(taskId) {
  const res = await request(`${BASE}/sdss/task/${taskId}`);
  return res.json(); // { task_id, status, result, error, elapsed_seconds }
}

export async function sdssHealth() {
  const res = await request(`${BASE}/sdss/health`);
  return res.json();
}

export async function sdssListTasks(page = 1, perPage = 20) {
  const res = await request(`${BASE}/sdss/tasks?page=${page}&per_page=${perPage}`);
  return res.json(); // { tasks, total, page, per_page }
}

export async function sdssGetAudit(taskId) {
  const res = await request(`${BASE}/sdss/task/${taskId}/audit`);
  return res.json(); // { task_id, has_audit, audit_report }
}


// ── Chat (Open WebUI proxy) ──────────────────────────────────────

/**
 * Send chat completion request with SSE streaming.
 * Returns raw Response — caller reads the stream via response.body.getReader().
 */
export async function chatCompletions(messages, taskId = null) {
  const body = { messages, stream: true };
  if (taskId) body.task_id = taskId;

  await ensureFreshToken();
  const doFetch = () => fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  let res = await doFetch();
  if (res.status === 401 && getToken()) {
    const newToken = await refreshToken();
    if (newToken) res = await doFetch();
  }
  if (res.status === 401) { handle401(); throw new Error('Session expired'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res;
}

/**
 * Trigger an SDSS analysis from within the chat, with optional files.
 * Returns { task_id, status }.
 */
export async function chatAnalyze(caseText, mode = 'standard', files = []) {
  const formData = new FormData();
  formData.append('case_text', caseText);
  formData.append('mode', mode);
  for (const f of files) formData.append('files', f);

  return uploadWithAuth(`${BASE}/chat/analyze`, formData);
}

/**
 * Transcribe audio via MedASR.
 * Returns { text, duration_ms }.
 */
export async function chatTranscribe(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  return uploadWithAuth(`${BASE}/chat/transcribe`, formData);
}
