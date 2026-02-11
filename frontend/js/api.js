// API base URL – set via window.API_BASE. Default /api/v1 for nginx proxy; use http://localhost:5010/api/v1 when frontend and backend differ.
window.API_BASE = window.API_BASE || '/api/v1';

function apiUrl(path) {
  return window.API_BASE + (path.startsWith('/') ? path : '/' + path);
}

async function apiGet(path) {
  const r = await fetch(apiUrl(path));
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}
