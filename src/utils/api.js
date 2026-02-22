const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res;
}

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
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export function downloadUrl(id, format) {
  return `${BASE}/cases/${id}/report/${format}`;
}

export async function submitResearch(data) {
  const res = await request(`${BASE}/research`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}
