// ============================================================
// Shared API client
// ============================================================
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('cmc_token');
}
function setToken(token) {
  localStorage.setItem('cmc_token', token);
}
function clearToken() {
  localStorage.removeItem('cmc_token');
  localStorage.removeItem('cmc_user');
}
function getStoredUser() {
  const raw = localStorage.getItem('cmc_user');
  return raw ? JSON.parse(raw) : null;
}
function setStoredUser(user) {
  localStorage.setItem('cmc_user', JSON.stringify(user));
}

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
