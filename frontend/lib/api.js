'use client';
// API client + small helpers shared by all pages.

export const API = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export function getToken() { if (typeof window === 'undefined') return null; return localStorage.getItem('vs_token'); }
export function setToken(t) { if (t) localStorage.setItem('vs_token', t); else localStorage.removeItem('vs_token'); }
export function getUser() { try { return JSON.parse(localStorage.getItem('vs_user') || 'null'); } catch { return null; } }
export function setUser(u) { if (u) localStorage.setItem('vs_user', JSON.stringify(u)); else localStorage.removeItem('vs_user'); }

export async function api(path, { method = 'GET', body, raw } = {}) {
  const headers = { Accept: 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error('Cannot reach server. Check your internet connection.');
  }
  if (raw) return res;
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login')) {
    setToken(null); setUser(null);
    const admin = location.pathname.startsWith('/admin');
    location.href = '/login/' + (admin ? '?admin=1' : '');
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Something went wrong (' + res.status + ')');
  return data;
}

/** Download a CSV/file from an authenticated endpoint */
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  if (!res.ok) { let m = 'Download failed'; try { m = (await res.json()).error; } catch {} throw new Error(m); }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}

export function fileUrl(id) { return id ? `${API}/files/${id}?token=${encodeURIComponent(getToken() || '')}` : ''; }

export function readFileB64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
  });
}
export async function uploadFile(file) {
  if (file.size > 4 * 1024 * 1024) throw new Error('File too large (max 4 MB)');
  const data = await readFileB64(file);
  const r = await api('/files', { method: 'POST', body: { name: file.name, mime: file.type, data } });
  return r.id;
}

// ---------- formatting ----------
export function inr(v, dec) {
  const n = Number(v || 0);
  const d = dec ?? (Math.round(n) === n ? 0 : 2);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function lakh(v) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L';
  if (Math.abs(n) >= 1000) return '₹' + (n / 1000).toFixed(1) + 'k';
  return inr(n);
}
export function kg(v) { const n = Number(v || 0); return (Math.round(n * 100) / 100) + ' kg'; }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parse(d) { if (!d) return null; const x = new Date(String(d).replace(' ', 'T')); return isNaN(x) ? null : x; }
export function dShort(d) { const x = parse(d); return x ? `${String(x.getDate()).padStart(2, '0')} ${MON[x.getMonth()]}` : '—'; }
export function dTime(d) { const x = parse(d); return x ? `${x.getDate()} ${MON[x.getMonth()]}, ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}` : '—'; }
export function dLong(d) { const x = parse(d); return x ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x.getDay()]} ${x.getDate()} ${MON[x.getMonth()]} ${x.getFullYear()}` : '—'; }
export function monthLabel(m) { if (!m) return ''; const [y, mm] = m.split('-'); return `${MON[+mm - 1]} ${y}`; }
export function today() { const d = new Date(); return d.toISOString().slice(0, 10); }
export function initials(n) { return (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''); }
export function qp(name) { if (typeof window === 'undefined') return null; return new URLSearchParams(location.search).get(name); }

export const STATUS = {
  all: 'All', pickup_pending: 'Pickup pending', picked_up: 'Picked up', in_transit: 'In transit', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', rto: 'RTO', ndr: 'NDR', weight_discrepancy: 'Weight discrepancy', rto_in_transit: 'RTO', rto_delivered: 'RTO delivered', cancelled: 'Cancelled',
};

export function months(n = 12) { const o = []; const d = new Date(); for (let i = 0; i < n; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); o.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); } return o; }
