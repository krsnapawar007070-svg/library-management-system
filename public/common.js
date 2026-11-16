/* ================================================================
   COMMON.JS — Shared utilities, navigation, and helpers
   All authenticated pages load this file.
   ================================================================ */

// ── SVG Icons (inline, no external libraries) ──────────────────
const _ic = {
  book:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
  search:  `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
  grid:    `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`,
  logout:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>`,
  check:   `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
  x:       `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
  warn:    `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
  clock:   `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  cal:     `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  bell:    `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`,
  list:    `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
  back:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`,
  plus:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>`,
  dollar:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  copy:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
  shield:  `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
  return:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>`,
};

// ── Book cover colour palette ───────────────────────────────────
const _PALETTES = [
  ['#1e3a5f','#2563eb'], ['#164e63','#0891b2'], ['#14532d','#16a34a'],
  ['#3b0764','#7c3aed'], ['#4c1d95','#8b5cf6'], ['#7f1d1d','#e11d48'],
  ['#78350f','#d97706'], ['#0c4a6e','#0ea5e9'], ['#134e4a','#0d9488'],
  ['#1c1917','#78716c'], ['#1a2f52','#3b82f6'], ['#065f46','#10b981'],
];

/**
 * Returns a CSS `background` gradient string for a book's cover,
 * deterministically derived from its title.
 */
function bookCoverStyle(title) {
  let h = 0;
  for (const c of (title || 'B')) h = ((h << 5) - h) + c.charCodeAt(0);
  const [dark, light] = _PALETTES[Math.abs(h) % _PALETTES.length];
  return `background: linear-gradient(150deg, ${dark} 0%, ${light} 100%);`;
}

// ── HTML escaping helper ───────────────────────────────────────
function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Authentication helpers ─────────────────────────────────────
function getUser(requiredRole) {
  const raw = sessionStorage.getItem('lms_user');
  if (!raw) { window.location.href = 'index.html'; return null; }
  let user;
  try {
    user = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem('lms_user');
    window.location.href = 'index.html';
    return null;
  }
  if (!user || user.membership_status !== 'active') {
    sessionStorage.removeItem('lms_user');
    window.location.href = 'index.html';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = user.role === 'librarian' ? 'librarian.html' : 'catalog.html';
    return null;
  }
  return user;
}

function logout() {
  sessionStorage.removeItem('lms_user');
  fetch('/api/logout', { method: 'POST', keepalive: true })
    .catch(() => {})
    .finally(() => { window.location.href = 'index.html'; });
}

async function verifySession() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('lms_user');
      window.location.href = 'index.html';
      return null;
    }
    if (res.ok) {
      const freshUser = await res.json();
      sessionStorage.setItem('lms_user', JSON.stringify(freshUser));
      return freshUser;
    }
  } catch {}
  return null;
}

// ── Get initials for avatar ────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Navigation bar ─────────────────────────────────────────────
function renderTopbar(user, title) {
  if (!user) return;
  const page = window.location.pathname.split('/').pop() || 'index.html';

  let navLinks = '';
  if (user.role === 'student') {
    navLinks = `
      <a class="nav-link ${page === 'catalog.html' || page === 'book.html' ? 'active' : ''}" href="catalog.html">
        ${_ic.search} <span>Browse Catalog</span>
      </a>
      <a class="nav-link ${page === 'dashboard.html' ? 'active' : ''}" href="dashboard.html">
        ${_ic.grid} <span>My Dashboard</span>
      </a>`;
  } else {
    navLinks = `
      <a class="nav-link active" href="librarian.html">
        ${_ic.shield} <span>Admin Dashboard</span>
      </a>`;
  }

  document.getElementById('topbar').innerHTML = `
    <nav class="navbar">
      <div class="nav-brand">
        ${_ic.book}
        <div>
          <div>LMS</div>
          <div class="nav-brand-sub">Library System</div>
        </div>
      </div>

      <div class="nav-links">${navLinks}</div>

      <div class="nav-user">
        <div class="user-avatar" title="${escapeHtml(user.name)}">${escapeHtml(getInitials(user.name))}</div>
        <span class="user-name">${escapeHtml(user.name.split(' ')[0])}</span>
        <span class="role-badge ${user.role}">${user.role === 'librarian' ? 'Librarian' : 'Student'}</span>
        <button class="btn-logout" onclick="logout()">${_ic.logout} <span>Logout</span></button>
      </div>
    </nav>`;
}

// ── Status badge helper ────────────────────────────────────────
function statusBadge(status, dueDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (status === 'issued' && dueDate && dueDate < today) {
    return `<span class="badge overdue">⚠ Overdue</span>`;
  }
  const map = {
    pending:   'Pending',
    issued:    'Active',
    returned:  'Returned',
    rejected:  'Rejected',
    waiting:   'Waiting',
    fulfilled: 'Fulfilled',
    cancelled: 'Cancelled',
    active:    'Approved',
    unused:    'Unused',
    used:      'Used',
    revoked:   'Revoked',
  };
  return `<span class="badge ${escapeHtml(status)}">${escapeHtml(map[status] || status)}</span>`;
}

// ── Empty state helper ─────────────────────────────────────────
function emptyState(iconSvg, title, text) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${iconSvg}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-text">${text}</div>
    </div>`;
}
