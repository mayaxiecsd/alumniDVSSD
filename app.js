// =====================================================
//  Alumni Portal — Manipur University
//  Frontend JS: routing, API, UI
// =====================================================

const API = '';  // same origin

// ─── STATE ────────────────────────────────────────────
let token    = localStorage.getItem('alumni_token') || null;
let me       = JSON.parse(localStorage.getItem('alumni_me') || 'null');
let dirPage  = 1;
let dirTimer = null;

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNav();
  loadHomeStats();

  const hash = location.hash.replace('#', '') || 'home';
  const validPages = ['home', 'register', 'login', 'profile', 'directory', 'admin'];
  const target = validPages.includes(hash) ? hash : 'home';

  if ((target === 'profile' || target === 'directory' || target === 'admin') && !token) {
    showPage('login');
  } else {
    showPage(target);
  }
});

// ─── NAVIGATION ────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) {
    el.classList.add('active');
    location.hash = page;
    window.scrollTo(0, 0);
  }
  closeMenu();

  if (page === 'profile' && token) loadProfile();
  if (page === 'directory' && token) loadDirectory(1);
  if (page === 'admin' && me?.is_admin) loadAdmin();
}

function updateNav() {
  const loggedIn = !!token;
  const isAdmin  = me?.is_admin;
  id('nav-reg').style.display    = loggedIn ? 'none' : '';
  id('nav-login').style.display  = loggedIn ? 'none' : '';
  id('nav-logout').style.display = loggedIn ? '' : 'none';
  id('nav-dir').style.display    = loggedIn ? '' : 'none';
}

function toggleMenu() {
  id('nav-links').classList.toggle('open');
}

function closeMenu() {
  id('nav-links').classList.remove('open');
}

// ─── HELPERS ───────────────────────────────────────────
function id(x) { return document.getElementById(x); }

function toast(msg, duration = 3000) {
  const t = id('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function showError(elId, msg) {
  const el = id(elId);
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function showSuccess(elId, msg) {
  const el = id(elId);
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function setLoading(btnId, loading) {
  const btn = id(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
}

async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── HOME STATS ────────────────────────────────────────
async function loadHomeStats() {
  // We'll just show total from a public count endpoint
  // For now derive from alumni list if logged in, else show placeholder
  const el = id('hs-alumni');
  if (el) el.textContent = '—';
}

// ─── AUTH ──────────────────────────────────────────────
async function submitRegister(e) {
  e.preventDefault();
  showError('reg-error', '');
  showSuccess('reg-success', '');

  const name  = id('r-name').value.trim();
  const email = id('r-email').value.trim();
  const pw    = id('r-pw').value;
  const pw2   = id('r-pw2').value;

  if (pw !== pw2) { showError('reg-error', 'Passwords do not match.'); return; }
  if (pw.length < 8) { showError('reg-error', 'Password must be at least 8 characters.'); return; }
  if (!/[A-Z]/.test(pw)) { showError('reg-error', 'Password must have an uppercase letter.'); return; }
  if (!/\d/.test(pw)) { showError('reg-error', 'Password must have a number.'); return; }

  setLoading('reg-btn', true);

  const { ok, data } = await apiFetch('/api/register', 'POST', {
    full_name:       name,
    email,
    password:        pw,
    roll_number:     id('r-roll').value.trim(),
    batch_year:      id('r-batch').value ? +id('r-batch').value : null,
    graduation_year: id('r-grad').value  ? +id('r-grad').value  : null,
    program:         id('r-program').value,
    specialization:  id('r-spec').value.trim(),
    phone:           id('r-phone').value.trim(),
    whatsapp:        id('r-whatsapp').value.trim(),
    current_job:     id('r-job').value.trim(),
    employer:        id('r-employer').value.trim(),
    industry:        id('r-industry').value,
    location_city:   id('r-city').value.trim(),
    location_state:  id('r-state').value.trim(),
    linkedin_url:    id('r-linkedin').value.trim(),
    bio:             id('r-bio').value.trim(),
    achievements:    id('r-achiev').value.trim(),
  });

  setLoading('reg-btn', false);

  if (!ok) { showError('reg-error', data.error || 'Registration failed.'); return; }

  token = data.token;
  me    = { alumni_id: data.alumni_id, full_name: name, is_admin: false };
  localStorage.setItem('alumni_token', token);
  localStorage.setItem('alumni_me', JSON.stringify(me));
  updateNav();
  showSuccess('reg-success', '✓ Registration successful! Redirecting to your profile…');
  setTimeout(() => showPage('profile'), 1400);
}

async function submitLogin(e) {
  e.preventDefault();
  showError('login-error', '');
  setLoading('login-btn', true);

  const { ok, data } = await apiFetch('/api/login', 'POST', {
    email:    id('l-email').value.trim(),
    password: id('l-pw').value
  });

  setLoading('login-btn', false);

  if (!ok) { showError('login-error', data.error || 'Login failed.'); return; }

  token = data.token;
  me    = { alumni_id: data.alumni_id, full_name: data.full_name, is_admin: data.is_admin };
  localStorage.setItem('alumni_token', token);
  localStorage.setItem('alumni_me', JSON.stringify(me));
  updateNav();

  if (data.is_admin) showPage('admin');
  else showPage('profile');
}

async function logout() {
  await apiFetch('/api/logout', 'POST').catch(() => {});
  token = null;
  me    = null;
  localStorage.removeItem('alumni_token');
  localStorage.removeItem('alumni_me');
  updateNav();
  showPage('home');
  toast('You have been signed out.');
}

// ─── PROFILE ───────────────────────────────────────────
async function loadProfile() {
  const { ok, data } = await apiFetch('/api/profile');
  if (!ok) { if (data.error === 'Authentication required') { logout(); } return; }

  // Update banner
  id('p-avatar').textContent = initials(data.full_name);
  id('p-name').textContent   = data.full_name || '—';
  id('p-program-batch').textContent = [data.program, data.batch_year ? 'Batch ' + data.batch_year : ''].filter(Boolean).join(' · ') || '—';
  id('p-job-employer').textContent  = [data.current_job, data.employer].filter(Boolean).join(' @ ') || 'Role not specified';

  // View fields
  id('pv-roll').textContent     = data.roll_number     || '—';
  id('pv-batch').textContent    = data.batch_year      || '—';
  id('pv-grad').textContent     = data.graduation_year || '—';
  id('pv-program').textContent  = data.program         || '—';
  id('pv-spec').textContent     = data.specialization  || '—';
  id('pv-job').textContent      = data.current_job     || '—';
  id('pv-employer').textContent = data.employer        || '—';
  id('pv-industry').textContent = data.industry        || '—';
  id('pv-location').textContent = [data.location_city, data.location_state].filter(Boolean).join(', ') || '—';
  id('pv-email').textContent    = data.email           || '—';
  id('pv-phone').textContent    = data.phone           || '—';
  id('pv-whatsapp').textContent = data.whatsapp        || '—';
  id('pv-bio').textContent      = data.bio             || '—';
  id('pv-achiev').textContent   = data.achievements    || '—';

  if (data.linkedin_url) {
    id('pv-linkedin').innerHTML = `<a href="${escHtml(data.linkedin_url)}" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none">LinkedIn →</a>`;
  } else {
    id('pv-linkedin').textContent = '—';
  }

  // Pre-fill edit form
  id('e-name').value     = data.full_name         || '';
  id('e-phone').value    = data.phone             || '';
  id('e-whatsapp').value = data.whatsapp          || '';
  id('e-roll').value     = data.roll_number       || '';
  id('e-batch').value    = data.batch_year        || '';
  id('e-grad').value     = data.graduation_year   || '';
  setSelectValue('e-program', data.program);
  id('e-spec').value     = data.specialization    || '';
  id('e-job').value      = data.current_job       || '';
  id('e-employer').value = data.employer          || '';
  setSelectValue('e-industry', data.industry);
  id('e-city').value     = data.location_city     || '';
  id('e-state').value    = data.location_state    || '';
  id('e-linkedin').value = data.linkedin_url      || '';
  id('e-bio').value      = data.bio               || '';
  id('e-achiev').value   = data.achievements      || '';

  showEditMode(false);
}

function setSelectValue(selId, val) {
  const sel = id(selId);
  if (!sel || !val) return;
  for (const opt of sel.options) {
    if (opt.value === val) { sel.value = val; return; }
  }
}

function showEditMode(edit) {
  id('profile-view').style.display = edit ? 'none' : 'block';
  id('profile-edit').style.display = edit ? 'block' : 'none';
  id('edit-toggle').style.display  = edit ? 'none' : '';
}

async function submitProfileUpdate(e) {
  e.preventDefault();
  showError('edit-error', '');
  showSuccess('edit-success', '');

  const { ok, data } = await apiFetch('/api/profile', 'PUT', {
    full_name:       id('e-name').value.trim(),
    phone:           id('e-phone').value.trim(),
    whatsapp:        id('e-whatsapp').value.trim(),
    roll_number:     id('e-roll').value.trim(),
    batch_year:      id('e-batch').value  ? +id('e-batch').value  : null,
    graduation_year: id('e-grad').value   ? +id('e-grad').value   : null,
    program:         id('e-program').value,
    specialization:  id('e-spec').value.trim(),
    current_job:     id('e-job').value.trim(),
    employer:        id('e-employer').value.trim(),
    industry:        id('e-industry').value,
    location_city:   id('e-city').value.trim(),
    location_state:  id('e-state').value.trim(),
    linkedin_url:    id('e-linkedin').value.trim(),
    bio:             id('e-bio').value.trim(),
    achievements:    id('e-achiev').value.trim(),
  });

  if (!ok) { showError('edit-error', data.error || 'Update failed.'); return; }

  showSuccess('edit-success', '✓ Profile updated!');
  toast('✓ Profile saved.');
  setTimeout(() => { loadProfile(); showEditMode(false); }, 1200);
}

async function changePassword() {
  showError('pw-error', '');
  showSuccess('pw-success', '');

  const oldPw = id('cp-old').value;
  const newPw = id('cp-new').value;
  const newPw2 = id('cp-new2').value;

  if (newPw !== newPw2) { showError('pw-error', 'New passwords do not match.'); return; }

  const { ok, data } = await apiFetch('/api/change-password', 'POST', {
    old_password: oldPw,
    new_password: newPw
  });

  if (!ok) { showError('pw-error', data.error || 'Password change failed.'); return; }
  showSuccess('pw-success', '✓ Password changed successfully.');
  id('cp-old').value = '';
  id('cp-new').value = '';
  id('cp-new2').value = '';
  toast('✓ Password updated.');
}

// ─── DIRECTORY ─────────────────────────────────────────
async function loadDirectory(page = 1) {
  dirPage = page;
  const q     = id('dir-q')?.value.trim() || '';
  const batch = id('dir-batch')?.value    || '';

  id('alumni-grid').innerHTML = '<div class="dir-loading">Loading alumni…</div>';

  const params = new URLSearchParams({ page, ...(q ? { q } : {}), ...(batch ? { batch } : {}) });
  const { ok, data } = await apiFetch(`/api/alumni?${params}`);

  if (!ok) {
    id('alumni-grid').innerHTML = '<div class="dir-loading">Failed to load alumni.</div>';
    return;
  }

  // populate batch filter
  const batchSel = id('dir-batch');
  if (batchSel && batchSel.options.length <= 1) {
    const years = [...new Set(data.alumni.map(a => a.batch_year).filter(Boolean))].sort((a,b) => b-a);
    // build from all available if we've seen them
    for (const y of years) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = 'Batch ' + y;
      if (String(y) === batch) opt.selected = true;
      batchSel.appendChild(opt);
    }
  }

  if (!data.alumni.length) {
    id('alumni-grid').innerHTML = '<div class="dir-loading">No alumni found.</div>';
    id('dir-pagination').innerHTML = '';
    return;
  }

  id('alumni-grid').innerHTML = data.alumni.map(a => `
    <div class="alumni-card">
      <div class="ac-top">
        <div class="ac-avatar">${initials(a.full_name)}</div>
        <div>
          <div class="ac-name">${escHtml(a.full_name)}</div>
          <div class="ac-batch">${[a.program, a.batch_year ? 'Batch ' + a.batch_year : ''].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      </div>
      <div class="ac-info">
        ${a.current_job || a.employer ? `
        <div class="ac-info-row">
          <span>Work</span>
          <span>${escHtml([a.current_job, a.employer].filter(Boolean).join(', '))}</span>
        </div>` : ''}
        ${a.industry ? `<div class="ac-info-row"><span>Industry</span><span>${escHtml(a.industry)}</span></div>` : ''}
        ${a.location_city || a.location_state ? `
        <div class="ac-info-row">
          <span>Location</span>
          <span>${escHtml([a.location_city, a.location_state].filter(Boolean).join(', '))}</span>
        </div>` : ''}
        ${a.bio ? `<div class="ac-info-row" style="margin-top:6px"><span></span><span style="font-style:italic;color:var(--muted2);font-size:0.8rem">${escHtml(a.bio.slice(0, 80))}${a.bio.length > 80 ? '…' : ''}</span></div>` : ''}
      </div>
      ${a.linkedin_url ? `<a class="ac-linkedin" href="${escHtml(a.linkedin_url)}" target="_blank" rel="noopener">LinkedIn →</a>` : ''}
    </div>
  `).join('');

  // Pagination
  const pag = id('dir-pagination');
  pag.innerHTML = '';
  for (let p = 1; p <= data.pages; p++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (p === page ? ' active' : '');
    btn.textContent = p;
    btn.onclick = () => loadDirectory(p);
    pag.appendChild(btn);
  }

  // Update home stats
  const el = id('hs-alumni');
  if (el) el.textContent = data.total;
}

function searchDir() {
  clearTimeout(dirTimer);
  dirTimer = setTimeout(() => loadDirectory(1), 350);
}

// ─── ADMIN ─────────────────────────────────────────────
async function loadAdmin() {
  const [statsRes, listRes] = await Promise.all([
    apiFetch('/api/admin/stats'),
    apiFetch('/api/admin/alumni'),
  ]);

  if (!statsRes.ok) return;
  const stats = statsRes.data;

  id('admin-stats-row').innerHTML = `
    <div class="admin-stat"><div class="admin-stat-val">${stats.total}</div><div class="admin-stat-label">Total Alumni</div></div>
    <div class="admin-stat"><div class="admin-stat-val">${stats.verified}</div><div class="admin-stat-label">Verified</div></div>
    <div class="admin-stat"><div class="admin-stat-val">${stats.total - stats.verified}</div><div class="admin-stat-label">Pending</div></div>
    <div class="admin-stat"><div class="admin-stat-val">${stats.by_batch.length}</div><div class="admin-stat-label">Batches</div></div>
  `;

  if (!listRes.ok) return;
  const list = listRes.data;

  id('admin-tbody').innerHTML = list.map(a => `
    <tr>
      <td>${escHtml(a.full_name)}</td>
      <td style="font-family:var(--mono);font-size:0.78rem">${escHtml(a.email)}</td>
      <td style="font-family:var(--mono);font-size:0.78rem">${a.roll_number || '—'}</td>
      <td>${a.batch_year || '—'}</td>
      <td>${escHtml(a.program || '—')}</td>
      <td><span class="badge ${a.is_verified ? 'badge-yes' : 'badge-no'}">${a.is_verified ? 'Verified' : 'Pending'}</span></td>
      <td>
        ${!a.is_verified ? `<button class="tbl-btn" onclick="adminVerify(${a.id})">Verify</button>` : ''}
        <button class="tbl-btn danger" onclick="adminDelete(${a.id}, '${escHtml(a.full_name)}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function adminVerify(id_) {
  const { ok } = await apiFetch(`/api/admin/alumni/${id_}/verify`, 'POST');
  if (ok) { toast('✓ Alumni verified.'); loadAdmin(); }
}

async function adminDelete(id_, name) {
  if (!confirm(`Delete alumni "${name}"? This cannot be undone.`)) return;
  const { ok } = await apiFetch(`/api/admin/alumni/${id_}`, 'DELETE');
  if (ok) { toast('✓ Alumni deleted.'); loadAdmin(); }
}

// ─── UTIL ──────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
