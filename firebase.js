/**
 * Smart Camp OS — Firebase Config (Abdullah's Project)
 * ══════════════════════════════════════════════════════════════
 * تم تحديث البيانات بواسطة مساعدك الذكي لتعمل مع مشروعك مباشرة
 * ══════════════════════════════════════════════════════════════
 */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD4KCow8oaGOPIxE_96JmxWzsP8kXf_4Uc",
  authDomain:        "smart-camp-e08d1.firebaseapp.com",
  databaseURL:       "https://smart-camp-e08d1-default-rtdb.firebaseio.com",
  projectId:         "smart-camp-e08d1",
  storageBucket:     "smart-camp-e08d1.firebasestorage.app",
  messagingSenderId: "321900434681",
  appId:             "1:321900434681:web:4ef0bdcbf373f8a81a3e28"
};

// ══════════════════════════════════════════════════════════════
//  Firebase Init
// ══════════════════════════════════════════════════════════════
let _db   = null;
let _ref  = null;
let _set  = null;
let _push = null;
let _remove = null;
let _update = null;
let _onValue = null;
let _off = null;
let _firebaseReady = false;

async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getDatabase, ref, set, push, remove, update, onValue, off } =
          await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');

    const app = initializeApp(FIREBASE_CONFIG);
    _db      = getDatabase(app);
    _ref     = ref;
    _set     = set;
    _push    = push;
    _remove  = remove;
    _update  = update;
    _onValue = onValue;
    _off     = off;
    _firebaseReady = true;

    console.log('✅ Firebase connected: Smart Camp is Live!');
    return true;
  } catch (err) {
    console.error('❌ Firebase init failed:', err);
    return false;
  }
}

// ── Read once ──
async function loadData(path) {
  if (!_firebaseReady) return null;
  return new Promise((resolve) => {
    const r = _ref(_db, path);
    const unsub = _onValue(r, (snap) => {
      _off(r, 'value', unsub);
      resolve(snap.val());
    }, () => resolve(null));
  });
}

// ── Realtime listener (returns unsubscribe fn) ──
function listenTo(path, callback) {
  if (!_firebaseReady) return () => {};
  const r = _ref(_db, path);
  _onValue(r, (snap) => callback(snap.val()));
  return () => _off(r);
}

// ── Write ──
async function saveData(path, value) {
  if (!_firebaseReady) return false;
  try   { await _set(_ref(_db, path), value); return true; }
  catch { return false; }
}

// ── Push (auto-key) ──
async function pushData(path, value) {
  if (!_firebaseReady) return null;
  try   { const r = await _push(_ref(_db, path), value); return r.key; }
  catch { return null; }
}

// ── Delete ──
async function deleteData(path) {
  if (!_firebaseReady) return false;
  try   { await _remove(_ref(_db, path)); return true; }
  catch { return false; }
}

// ── Update (partial) ──
async function updateData(path, value) {
  if (!_firebaseReady) return false;
  try   { await _update(_ref(_db, path), value); return true; }
  catch { return false; }
}

// ══════════════════════════════════════════════════════════════
//  Time & Activity Utilities
// ══════════════════════════════════════════════════════════════
function parseTime(timeStr) {
  if (!timeStr) return new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
}

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'م' : 'ص';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getCurrentActivity(activities) {
  if (!activities) return { current: null, next: null, all: [] };
  const now  = new Date();
  const list = Object.entries(activities)
    .map(([id, a]) => ({ id, ...a }))
    .filter(a => a.time)
    .sort((a, b) => a.time.localeCompare(b.time));

  let current = null, next = null;

  for (let i = 0; i < list.length; i++) {
    const start = parseTime(list[i].time);
    const end   = list[i + 1]
      ? parseTime(list[i + 1].time)
      : new Date(start.getTime() + 90 * 60000);

    if (now >= start && now < end) {
      current = list[i];
      next    = list[i + 1] || null;
      break;
    }
  }

  if (!current && list.length) {
    const first = parseTime(list[0].time);
    if (now < first) next = list[0];
  }

  return { current, next, all: list };
}

function getDayProgress(activities) {
  if (!activities) return 0;
  const list = Object.values(activities)
    .filter(a => a.time)
    .sort((a, b) => a.time.localeCompare(b.time));
  if (!list.length) return 0;

  const now   = new Date();
  const first = parseTime(list[0].time);
  const last  = parseTime(list[list.length - 1].time);

  if (now < first) return 0;
  if (now > last)  return 100;
  return Math.round(((now - first) / (last - first)) * 100);
}

function timeRemaining(nextActivity) {
  if (!nextActivity) return null;
  const diff = parseTime(nextActivity.time) - new Date();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}س ${m}د` : `${m} دقيقة`;
}

function countdownTo(dateStr) {
  if (!dateStr) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const diff = new Date(dateStr) - new Date();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000)
  };
}

// ══════════════════════════════════════════════════════════════
//  Global Export
// ══════════════════════════════════════════════════════════════
window.CampUtils = {
  initFirebase,
  loadData, listenTo, saveData, pushData, deleteData, updateData,
  getCurrentActivity, getDayProgress, timeRemaining, countdownTo,
  parseTime, formatTime12
};
/* Security System - Password: Abdullah@2026
   ضيف الكود ده في أول ملف Script بيتحمل في موقعك
*/
(function() {
    const initLock = () => {
        // إنشاء العنصر برمجياً عشان يغطي أي تصميم موجود
        const lockScreen = document.createElement('div');
        lockScreen.id = 'global-security-layer';
        lockScreen.style = "position:fixed; top:0; left:0; width:100%; height:100vh; background:#0a0a0a; color:#d4af37; display:flex; align-items:center; justify-content:center; z-index:2147483647; font-family:sans-serif; direction:rtl;";
        
        lockScreen.innerHTML = `
            <div style="text-align:center; padding:40px; border:2px solid #d4af37; border-radius:20px; background:#111; box-shadow: 0 0 30px rgba(0,0,0,0.8);">
                <div style="font-size: 50px; margin-bottom: 20px;">🔒</div>
                <h2 style="margin-bottom:10px; color:#fff;">نظام التوثيق المركزي</h2>
                <p style="color:#888; margin-bottom:25px;">برجاء إدخال الكود السري للمتابعة</p>
                <input type="password" id="access-code" placeholder="Password" style="padding:15px; width:260px; border-radius:10px; border:1px solid #333; background:#000; color:#fff; text-align:center; outline:none; font-size:20px; letter-spacing:3px;">
                <br>
                <button id="confirm-btn" style="margin-top:25px; padding:15px; width:100%; background:#d4af37; color:#000; border:none; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px;">تأكيد الهوية</button>
                <p id="fail-msg" style="color:#ff4444; margin-top:20px; display:none; font-weight:bold;">الرمز غير صحيح!</p>
            </div>
        `;

        document.body.prepend(lockScreen); // بيضيفه في أول الـ Body عشان يضمن الظهور

        const validate = () => {
            const val = document.getElementById('access-code').value;
            if (val === 'Abdullah@2026') {
                lockScreen.remove();
            } else {
                document.getElementById('fail-msg').style.display = 'block';
                document.getElementById('access-code').value = '';
            }
        };

        document.getElementById('confirm-btn').onclick = validate;
        document.getElementById('access-code').onkeypress = (e) => { if(e.key === 'Enter') validate(); };
    };

    // التأكد من أن الـ Body جاهز قبل إضافة الشاشة
    if (document.body) {
        initLock();
    } else {
        window.addEventListener('DOMContentLoaded', initLock);
    }
})();

