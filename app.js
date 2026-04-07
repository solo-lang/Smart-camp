/**
 * Smart Camp OS — app.js
 * الصفحة الرئيسية | Firebase Realtime — بدون Backend
 */

let campSettings     = null;
let campActivities   = null;
let campAnnouncements = null;
let countdownTimer   = null;
const _unsubscribers = [];

// ══════════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════════
async function initApp() {
  const ok = await window.CampUtils.initFirebase();
  if (!ok) { showFirebaseError(); return; }

  // Load settings first (needed by everything)
  campSettings      = await window.CampUtils.loadData('/settings');
  campActivities    = await window.CampUtils.loadData('/activities');
  campAnnouncements = await window.CampUtils.loadData('/announcements');

  // Initial render
  renderSettings();
  renderActivities();
  renderLiveStatus();
  renderAnnouncements();
  renderGallery();
  renderMap();
  startCountdown();
  updateClock();
  hideLoading();

  // ── Realtime listeners ──
  _unsubscribers.push(
    window.CampUtils.listenTo('/settings', val => {
      campSettings = val;
      renderSettings();
      renderGallery();
      renderMap();
      startCountdown();
    }),
    window.CampUtils.listenTo('/activities', val => {
      campActivities = val;
      renderActivities();
      renderLiveStatus();
    }),
    window.CampUtils.listenTo('/announcements', val => {
      campAnnouncements = val;
      renderAnnouncements();
    })
  );

  // Update live status every 30 seconds
  setInterval(() => {
    renderLiveStatus();
    renderActivities();
  }, 30000);
}

// ══════════════════════════════════════════════════════════════
//  Render: Settings
// ══════════════════════════════════════════════════════════════
function renderSettings() {
  if (!campSettings) return;
  const s = campSettings;

  document.title = (s.campName || 'Smart Camp OS') + ' 🏕️';

  const titleEl = document.getElementById('camp-title');
  if (titleEl) titleEl.textContent = s.campName || 'معسكر الأبطال';

  const waBtn = document.getElementById('wa-float');
  if (waBtn && s.whatsapp) {
    waBtn.href = `https://wa.me/${s.whatsapp.replace(/\D/g, '')}`;
  }

  if (s.primaryColor) {
    document.documentElement.style.setProperty('--primary', s.primaryColor);
  }

  if (s.ended) showEndedScreen();
}

// ══════════════════════════════════════════════════════════════
//  Render: Live Status
// ══════════════════════════════════════════════════════════════
function renderLiveStatus() {
  const { current, next } = window.CampUtils.getCurrentActivity(campActivities);
  const progress  = window.CampUtils.getDayProgress(campActivities);
  const remaining = window.CampUtils.timeRemaining(next);

  // Current activity card
  const currentEl = document.getElementById('current-activity');
  if (currentEl) {
    if (current) {
      currentEl.innerHTML = `
        <div class="status-label">🔴 النشاط الحالي</div>
        <div class="status-value">${current.name}</div>
        <div class="status-sub">📍 ${current.place} &nbsp;|&nbsp; ⏰ ${window.CampUtils.formatTime12(current.time)}</div>
        <div class="status-badge"><span class="live-dot"></span> مباشر الآن</div>`;
    } else {
      currentEl.innerHTML = `
        <div class="status-label">النشاط الحالي</div>
        <div class="status-value">لا يوجد نشاط الآن</div>
        <div class="status-sub">استمتع بوقت الراحة 😊</div>`;
    }
  }

  // Next activity card
  const nextEl = document.getElementById('next-activity');
  if (nextEl) {
    if (next) {
      nextEl.innerHTML = `
        <div class="status-label">⏭️ النشاط القادم</div>
        <div class="status-value">${next.name}</div>
        <div class="status-sub">📍 ${next.place} &nbsp;|&nbsp; ⏰ ${window.CampUtils.formatTime12(next.time)}</div>
        ${remaining ? `<div class="status-badge" style="background:rgba(124,58,237,0.15);color:#a78bfa;">⏳ بعد ${remaining}</div>` : ''}`;
    } else {
      nextEl.innerHTML = `
        <div class="status-label">النشاط القادم</div>
        <div class="status-value">انتهت أنشطة اليوم</div>
        <div class="status-sub">أحسنتم! 🌙</div>`;
    }
  }

  const fill = document.getElementById('day-progress');
  const pct  = document.getElementById('progress-pct');
  if (fill) fill.style.width = progress + '%';
  if (pct)  pct.textContent  = progress + '%';
}

// ══════════════════════════════════════════════════════════════
//  Render: Activities
// ══════════════════════════════════════════════════════════════
function renderActivities() {
  const container = document.getElementById('activities-list');
  if (!container) return;

  if (!campActivities) {
    container.innerHTML = emptyState('📅', 'لا توجد أنشطة بعد');
    return;
  }

  const { current, next, all } = window.CampUtils.getCurrentActivity(campActivities);
  const now = new Date();

  if (!all.length) {
    container.innerHTML = emptyState('📅', 'لا توجد أنشطة لهذا اليوم');
    return;
  }

  container.innerHTML = all.map(act => {
    const actTime   = window.CampUtils.parseTime(act.time);
    const isCurrent = current && current.id === act.id;
    const isNext    = next && next.id === act.id;
    const isPast    = actTime < now && !isCurrent;

    let statusClass = '', statusTag = '';
    if (isCurrent) {
      statusClass = 'active';
      statusTag   = '<span class="activity-status-tag tag-active">▶ جارٍ</span>';
    } else if (isNext) {
      statusTag   = '<span class="activity-status-tag tag-next">⏭ قادم</span>';
    } else if (isPast) {
      statusClass = 'past';
      statusTag   = '<span class="activity-status-tag tag-done">✓ انتهى</span>';
    }

    return `
      <div class="activity-item ${statusClass}">
        <div class="activity-time">${window.CampUtils.formatTime12(act.time)}</div>
        <div class="activity-dot"></div>
        <div class="activity-info">
          <div class="activity-name">${act.name}</div>
          <div class="activity-place">📍 ${act.place}</div>
        </div>
        ${statusTag}
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  Render: Announcements Ticker
// ══════════════════════════════════════════════════════════════
function renderAnnouncements() {
  const ticker = document.getElementById('ticker-content');
  if (!ticker) return;

  if (!campAnnouncements) {
    ticker.textContent = 'أهلاً وسهلاً بكم في المعسكر 🏕️';
    return;
  }

  const active = Object.values(campAnnouncements).filter(a => a.active !== false);
  ticker.textContent = active.length
    ? active.map(a => a.text).join('     ⬥     ')
    : 'أهلاً وسهلاً بكم في المعسكر 🏕️';
}

// ══════════════════════════════════════════════════════════════
//  Render: Gallery
// ══════════════════════════════════════════════════════════════
function renderGallery() {
  const container = document.getElementById('gallery-grid');
  if (!container) return;

  const gallery = campSettings?.gallery;
  if (!gallery || !gallery.length) {
    container.innerHTML = emptyState('🖼️', 'لم تُضَف صور بعد');
    return;
  }

  container.innerHTML = gallery.map(url => `
    <div class="gallery-item" onclick="openImage('${url}')">
      <img src="${url}" alt="صورة المعسكر" loading="lazy" onerror="this.parentElement.style.display='none'">
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
//  Render: Map
// ══════════════════════════════════════════════════════════════
function renderMap() {
  const frame = document.getElementById('map-frame');
  if (!frame) return;
  const url = campSettings?.mapEmbed;
  if (url) frame.src = url;
}

// ══════════════════════════════════════════════════════════════
//  Countdown
// ══════════════════════════════════════════════════════════════
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function tick() {
  const dateStr = campSettings?.finalDate;
  const { days, hours, minutes, seconds } = window.CampUtils.countdownTo(dateStr);
  const map = { 'cd-days': days, 'cd-hours': hours, 'cd-minutes': minutes, 'cd-seconds': seconds };
  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val).padStart(2, '0');
  }
}

// ══════════════════════════════════════════════════════════════
//  Clock
// ══════════════════════════════════════════════════════════════
function updateClock() {
  const el = document.getElementById('live-time');
  if (el) el.textContent = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  setTimeout(updateClock, 15000);
}

// ══════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════
function hideLoading() {
  const loader = document.getElementById('loading-screen');
  if (loader) loader.classList.add('hidden');
}

function showEndedScreen() {
  const el = document.getElementById('ended-screen');
  if (el) el.style.display = 'flex';
}

function showFirebaseError() {
  hideLoading();
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div class="error-state" style="padding:80px 20px;text-align:center">
      <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
      <div style="font-size:1.2rem;font-weight:700;color:var(--danger);margin-bottom:8px">
        تعذّر الاتصال بـ Firebase
      </div>
      <div style="color:var(--text-muted);font-size:0.85rem;max-width:380px;margin:0 auto 24px;line-height:1.8">
        تأكد من أنك وضعت بيانات <code style="background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px">FIREBASE_CONFIG</code>
        الصحيحة في ملف <code style="background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px">js/firebase.js</code>
      </div>
      <button onclick="location.reload()"
        style="background:var(--primary);color:#000;border:none;padding:10px 28px;border-radius:99px;font-family:inherit;font-size:0.9rem;font-weight:700;cursor:pointer">
        🔄 إعادة المحاولة
      </button>
    </div>`;
}

function emptyState(icon, text) {
  return `<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
    <div style="font-size:2rem;margin-bottom:10px">${icon}</div>
    <div style="font-size:0.9rem">${text}</div>
  </div>`;
}

function openImage(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer;';
  overlay.innerHTML = `<img src="${url}" style="max-width:92vw;max-height:92vh;border-radius:12px;object-fit:contain;">`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

// ══════════════════════════════════════════════════════════════
//  Start
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initApp);
