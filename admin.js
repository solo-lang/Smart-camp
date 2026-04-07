/**
 * Smart Camp OS — admin.js
 * لوحة التحكم | Firebase Realtime — بدون Backend
 */

// ══════════════════════════════════════════════════════════════
//  State
// ══════════════════════════════════════════════════════════════
let adminPassword        = localStorage.getItem('adminPass') || 'camp2025';
let isLoggedIn           = false;
let currentSection       = 'dashboard';
let editingActivityId    = null;
let editingAnnouncementId = null;

let adminSettings     = null;
let adminActivities   = {};
let adminAnnouncements = {};

// ══════════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  checkLoginSession();
  wireEvents();
});

function wireEvents() {
  // Login on Enter
  const passInput = document.getElementById('login-password');
  if (passInput) passInput.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });

  // Mobile sidebar
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  if (toggle && sidebar) toggle.onclick = () => sidebar.classList.toggle('open');

  // Init danger zone
  initDeleteFlow();
}

// ══════════════════════════════════════════════════════════════
//  Login
// ══════════════════════════════════════════════════════════════
function checkLoginSession() {
  if (sessionStorage.getItem('adminLoggedIn') === 'yes') {
    isLoggedIn = true;
    showAdminPanel();
  }
}

function attemptLogin() {
  const input = document.getElementById('login-password');
  const val   = input.value.trim();

  if (val === adminPassword) {
    sessionStorage.setItem('adminLoggedIn', 'yes');
    isLoggedIn = true;
    showAdminPanel();
  } else {
    input.style.borderColor = 'var(--danger)';
    showToast('كلمة المرور غير صحيحة ❌', 'error');
    setTimeout(() => input.style.borderColor = '', 1400);
  }
}

async function showAdminPanel() {
  document.getElementById('login-overlay').style.display  = 'none';
  document.getElementById('admin-layout').style.display   = 'flex';

  const ok = await window.CampUtils.initFirebase();
  if (!ok) {
    showToast('فشل الاتصال بـ Firebase — تحقق من الإعدادات', 'error');
    return;
  }

  await loadAdminData();
  navigateTo('dashboard');

  // Realtime sync for admin too
  window.CampUtils.listenTo('/activities',    val => { adminActivities    = val || {}; if (currentSection === 'activities')    renderActivitiesAdmin(); });
  window.CampUtils.listenTo('/announcements', val => { adminAnnouncements = val || {}; if (currentSection === 'announcements') renderAnnouncementsAdmin(); });
  window.CampUtils.listenTo('/settings',      val => { adminSettings      = val || {}; if (currentSection === 'settings')      renderSettingsForm(); });
}

function logout() {
  sessionStorage.removeItem('adminLoggedIn');
  location.reload();
}

// ══════════════════════════════════════════════════════════════
//  Load Data
// ══════════════════════════════════════════════════════════════
async function loadAdminData() {
  adminSettings      = (await window.CampUtils.loadData('/settings'))      || {};
  adminActivities    = (await window.CampUtils.loadData('/activities'))    || {};
  adminAnnouncements = (await window.CampUtils.loadData('/announcements')) || {};
}

// ══════════════════════════════════════════════════════════════
//  Navigation
// ══════════════════════════════════════════════════════════════
function navigateTo(section) {
  currentSection = section;

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.section === section));

  document.querySelectorAll('.admin-section').forEach(el =>
    el.style.display = 'none');

  const target = document.getElementById('section-' + section);
  if (target) target.style.display = 'block';

  switch (section) {
    case 'dashboard':     renderDashboard();          break;
    case 'activities':    renderActivitiesAdmin();     break;
    case 'announcements': renderAnnouncementsAdmin();  break;
    case 'settings':      renderSettingsForm();        break;
  }

  document.getElementById('admin-sidebar').classList.remove('open');
}

// ══════════════════════════════════════════════════════════════
//  Dashboard
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  const actCount = Object.keys(adminActivities).length;
  const annCount = Object.keys(adminAnnouncements).length;
  const now      = new Date();

  setText('stat-activities',    actCount);
  setText('stat-announcements', annCount);
  setText('stat-time', now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }));
  setText('stat-date', now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
}

// ══════════════════════════════════════════════════════════════
//  Activities
// ══════════════════════════════════════════════════════════════
function renderActivitiesAdmin() {
  const tbody = document.getElementById('activities-tbody');
  if (!tbody) return;

  const list = Object.entries(adminActivities)
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px">لا توجد أنشطة</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(act => `
    <tr>
      <td>${act.day || '-'}</td>
      <td dir="ltr">${window.CampUtils.formatTime12(act.time)}</td>
      <td style="font-weight:600">${act.name}</td>
      <td>${act.place}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="editActivity('${act.id}')">✏️ تعديل</button>
          <button class="btn btn-danger btn-sm"    onclick="deleteActivity('${act.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function openActivityModal(id = null) {
  editingActivityId = id;
  const modal = document.getElementById('activity-modal');
  const title = document.getElementById('activity-modal-title');

  if (id && adminActivities[id]) {
    const act = adminActivities[id];
    title.textContent = 'تعديل النشاط';
    setValue('act-day',   act.day   || 'الأحد');
    setValue('act-time',  act.time  || '');
    setValue('act-name',  act.name  || '');
    setValue('act-place', act.place || '');
  } else {
    title.textContent = 'إضافة نشاط جديد';
    setValue('act-day',   'الأحد');
    setValue('act-time',  '');
    setValue('act-name',  '');
    setValue('act-place', '');
  }

  modal.classList.add('show');
}

function editActivity(id) { openActivityModal(id); }

function closeActivityModal() {
  document.getElementById('activity-modal').classList.remove('show');
  editingActivityId = null;
}

async function saveActivity() {
  const day   = getValue('act-day');
  const time  = getValue('act-time');
  const name  = getValue('act-name');
  const place = getValue('act-place');

  if (!time || !name || !place) {
    showToast('يرجى ملء جميع الحقول', 'error');
    return;
  }

  const actData = { day, time, name, place };
  let ok;

  if (editingActivityId) {
    ok = await window.CampUtils.saveData('/activities/' + editingActivityId, actData);
    if (ok) adminActivities[editingActivityId] = actData;
  } else {
    const newId = await window.CampUtils.pushData('/activities', actData);
    if (newId) { adminActivities[newId] = actData; ok = true; }
  }

  if (ok) {
    showToast(editingActivityId ? 'تم تعديل النشاط ✅' : 'تم إضافة النشاط ✅', 'success');
    closeActivityModal();
    renderActivitiesAdmin();
  } else {
    showToast('فشل الحفظ — تحقق من اتصال Firebase', 'error');
  }
}

async function deleteActivity(id) {
  if (!confirm('هل تريد حذف هذا النشاط؟')) return;
  const ok = await window.CampUtils.deleteData('/activities/' + id);
  if (ok) {
    delete adminActivities[id];
    showToast('تم حذف النشاط', 'info');
    renderActivitiesAdmin();
  } else {
    showToast('فشل الحذف', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  Announcements
// ══════════════════════════════════════════════════════════════
function renderAnnouncementsAdmin() {
  const container = document.getElementById('announcements-list-admin');
  if (!container) return;

  const list = Object.entries(adminAnnouncements).map(([id, a]) => ({ id, ...a }));

  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px">لا توجد إعلانات</div>';
    return;
  }

  container.innerHTML = list.map(ann => `
    <div class="glass-card" style="margin-bottom:10px;padding:14px 18px;display:flex;align-items:center;gap:12px">
      <div style="flex:1;font-size:0.88rem">${ann.text}</div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" onclick="editAnnouncement('${ann.id}')">✏️</button>
        <button class="btn btn-danger btn-sm"    onclick="deleteAnnouncement('${ann.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

function openAnnouncementModal(id = null) {
  editingAnnouncementId = id;
  const modal = document.getElementById('ann-modal');
  setValue('ann-text', id && adminAnnouncements[id] ? adminAnnouncements[id].text : '');
  modal.classList.add('show');
}

function editAnnouncement(id) { openAnnouncementModal(id); }

function closeAnnModal() {
  document.getElementById('ann-modal').classList.remove('show');
  editingAnnouncementId = null;
}

async function saveAnnouncement() {
  const text = getValue('ann-text');
  if (!text) { showToast('يرجى كتابة نص الإعلان', 'error'); return; }

  const annData = { text, active: true };
  let ok;

  if (editingAnnouncementId) {
    ok = await window.CampUtils.saveData('/announcements/' + editingAnnouncementId, annData);
    if (ok) adminAnnouncements[editingAnnouncementId] = annData;
  } else {
    const newId = await window.CampUtils.pushData('/announcements', annData);
    if (newId) { adminAnnouncements[newId] = annData; ok = true; }
  }

  if (ok) {
    showToast('تم حفظ الإعلان ✅', 'success');
    closeAnnModal();
    renderAnnouncementsAdmin();
  } else {
    showToast('فشل الحفظ — تحقق من اتصال Firebase', 'error');
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('حذف هذا الإعلان؟')) return;
  const ok = await window.CampUtils.deleteData('/announcements/' + id);
  if (ok) {
    delete adminAnnouncements[id];
    showToast('تم حذف الإعلان', 'info');
    renderAnnouncementsAdmin();
  }
}

// ══════════════════════════════════════════════════════════════
//  Settings
// ══════════════════════════════════════════════════════════════
function renderSettingsForm() {
  if (!adminSettings) return;
  const s = adminSettings;
  setValue('set-campname',  s.campName     || '');
  setValue('set-whatsapp',  s.whatsapp     || '');
  setValue('set-color',     s.primaryColor || '#00d4aa');
  setValue('set-map',       s.mapEmbed     || '');
  setValue('set-finaldate', s.finalDate ? s.finalDate.substring(0, 16) : '');
  setValue('set-gallery',   (s.gallery || []).join('\n'));
}

async function saveSettings() {
  const gallery = getValue('set-gallery')
    .split('\n').map(s => s.trim()).filter(Boolean);

  const settings = {
    campName:     getValue('set-campname'),
    whatsapp:     getValue('set-whatsapp'),
    primaryColor: getValue('set-color'),
    mapEmbed:     getValue('set-map'),
    finalDate:    getValue('set-finaldate'),
    gallery,
    ended:        adminSettings.ended    || false,
    logoUrl:      adminSettings.logoUrl  || ''
  };

  const ok = await window.CampUtils.saveData('/settings', settings);
  if (ok) {
    adminSettings = settings;
    showToast('تم حفظ الإعدادات ✅', 'success');
  } else {
    showToast('فشل الحفظ — تحقق من اتصال Firebase', 'error');
  }
}

// Change Password
function changePassword() {
  const old = getValue('old-pass');
  const n1  = getValue('new-pass');
  const n2  = getValue('confirm-pass');

  if (old !== adminPassword)     { showToast('كلمة المرور القديمة غير صحيحة', 'error'); return; }
  if (!n1 || n1.length < 4)     { showToast('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error'); return; }
  if (n1 !== n2)                 { showToast('كلمتا المرور لا تتطابقان', 'error'); return; }

  adminPassword = n1;
  localStorage.setItem('adminPass', n1);
  setValue('old-pass',     '');
  setValue('new-pass',     '');
  setValue('confirm-pass', '');
  showToast('تم تغيير كلمة المرور ✅', 'success');
}

// ══════════════════════════════════════════════════════════════
//  Danger Zone — Delete All Data
// ══════════════════════════════════════════════════════════════
let deleteStep = 1;

function initDeleteFlow() {
  deleteStep = 1;
  show('delete-step1');
  hide('delete-step2');
  hide('delete-done');
  setValue('delete-confirm-input', '');
}

function proceedDelete() {
  deleteStep = 2;
  hide('delete-step1');
  show('delete-step2');
}

async function finalDelete() {
  if (getValue('delete-confirm-input') !== 'DELETE') {
    showToast('اكتب DELETE بالأحرف الكبيرة', 'error');
    return;
  }

  showToast('جارٍ حذف جميع البيانات من Firebase...', 'info');

  await window.CampUtils.saveData('/activities',    null);
  await window.CampUtils.saveData('/announcements', null);
  await window.CampUtils.saveData('/settings', {
    ended: true,
    campName: 'انتهى المعسكر'
  });

  showToast('تم حذف جميع البيانات ✅', 'success');
  setTimeout(() => {
    hide('delete-step2');
    show('delete-done');
  }, 1500);
}

// ══════════════════════════════════════════════════════════════
//  Toast
// ══════════════════════════════════════════════════════════════
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || '💬'}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ══════════════════════════════════════════════════════════════
//  DOM Helpers
// ══════════════════════════════════════════════════════════════
function getValue(id)       { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function setValue(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }
function setText(id, val)   { const el = document.getElementById(id); if (el) el.textContent = val; }
function show(id)           { const el = document.getElementById(id); if (el) el.style.display = 'block'; }
function hide(id)           { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ══════════════════════════════════════════════════════════════
//  Expose to HTML onclick
// ══════════════════════════════════════════════════════════════
window.AdminApp = {
  navigateTo, attemptLogin, logout,
  openActivityModal, closeActivityModal, saveActivity, editActivity, deleteActivity,
  openAnnouncementModal, editAnnouncement, closeAnnModal, saveAnnouncement, deleteAnnouncement,
  saveSettings, changePassword,
  proceedDelete, finalDelete, initDeleteFlow,
  showToast
};
