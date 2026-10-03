/**
 * ==============================================================================
 * 💻 SMART LIBRARY SYSTEM — FRONTEND APPLICATION LOGIC (app.js)
 * ตรรกะการทำงานฝั่งหน้าเว็บ: รองรับทั้ง Supabase Realtime Cloud และโหมดตัวอย่าง (Demo Mode)
 * ==============================================================================
 */

// ⚠️ ตัวแปรนี้ต้องไม่ชื่อ `supabase` เพราะจะชนกับ window.supabase (Supabase SDK CDN)
let _supabaseClient = null;
let isDemoMode = false;
let authStateSubscription = null;
let realtimeChannel = null;
let activeAdminId = null;
let pendingAuthMessage = '';

// ==============================================================================
// 1. ระบบจัดการพื้นที่จัดเก็บข้อมูลที่ปลอดภัย (Safe Storage for Safari & file://)
// ==============================================================================
const safeStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('LocalStorage access restricted:', e);
      return null;
    }
  },
  set: (key, val) => {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      console.warn('LocalStorage save restricted:', e);
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

// ==============================================================================
// 2. ฐานข้อมูลตัวอย่าง (Mock Seed Data สำหรับ Demo Mode)
// ==============================================================================
let mockData = {
  books: [
    { id: 1, qr_code: 'BK00001', rfid_uid: '55667788', title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', status: 'available' },
    { id: 2, qr_code: 'BK00002', rfid_uid: 'AABBCCDD', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', status: 'borrowed' },
    { id: 3, qr_code: 'BK00003', rfid_uid: 'C0FFEE99', title: 'The Pragmatic Programmer: Your Journey To Mastery', author: 'David Thomas, Andrew Hunt', status: 'available' },
    { id: 4, qr_code: 'BK00004', rfid_uid: 'BOOK-RFID-0004', title: 'เจ้าชายน้อย (The Little Prince)', author: 'Antoine de Saint-Exupéry', status: 'available' },
    { id: 5, qr_code: 'BK00005', rfid_uid: 'BOOK-RFID-0005', title: 'Cosmos: มหัศจรรย์แห่งจักรวาล', author: 'Carl Sagan', status: 'available' }
  ],
  members: [
    { id: 1, full_name: 'สมชาย ใจดี (Wokwi Green)', phone: '081-234-5678', card_uid: '11223344', is_active: true },
    { id: 2, full_name: 'สมหญิง รักเรียน (Wokwi Blue)', phone: '089-876-5432', card_uid: '01020304', is_active: true },
    { id: 3, full_name: 'กิตติศักดิ์ พัฒนาการ', phone: '086-111-2233', card_uid: 'E4F5A6B7', is_active: true }
  ],
  transactions: [
    {
      id: 1,
      borrowed_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      due_date: new Date(Date.now() + 86400000 * 11).toISOString().split('T')[0],
      returned_at: null,
      fine_amount: 0.00,
      status: 'borrowed',
      book_title: 'Designing Data-Intensive Applications',
      borrower_name: 'สมชาย ใจดี (Wokwi Green)'
    },
    {
      id: 2,
      borrowed_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      returned_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      fine_amount: 0.00,
      status: 'returned',
      book_title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      borrower_name: 'สมหญิง รักเรียน (Wokwi Blue)'
    }
  ]
};

// เรนเดอร์ Lucide Icons อย่างปลอดภัย
function renderIcons() {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (e) {
    console.warn('Lucide icon error:', e);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// ระบบ Toast Notification แจ้งเตือนสวยงาม
function showToast(msg, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
                  type === 'error' ? 'bg-rose-600 text-white border-rose-500' :
                  'bg-slate-800 text-slate-100 border-slate-700';

  toast.className = `p-4 rounded-xl shadow-2xl border text-xs sm:text-sm font-medium flex items-center gap-3 transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto ${bgClass}`;
  toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==============================================================================
// 3. การจัดการการตั้งค่าการเชื่อมต่อ (Configuration Management)
// ==============================================================================
function cleanSupabaseUrl(url) {
  if (!url) return '';
  let cleaned = url.trim();
  // ตัด /rest/v1 หรือ /rest/v1/ หรือ / ออก เพื่อให้เป็น Base URL เสมอ
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

function getConfig() {
  let url = safeStorage.get('SP_URL') || (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.SUPABASE_URL) || '';
  let key = safeStorage.get('SP_KEY') || (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.SUPABASE_ANON_KEY) || '';
  url = cleanSupabaseUrl(url);
  key = (key || '').trim();

  // แก้ไขค่าใน Storage อัตโนมัติหากเคยบันทึกแบบมี /rest/v1 ติดมา
  if (safeStorage.get('SP_URL') && safeStorage.get('SP_URL') !== url) {
    safeStorage.set('SP_URL', url);
  }

  return { url, key };
}

function showLoginMessage(message = '') {
  const messageEl = document.getElementById('adminLoginMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.classList.toggle('hidden', !message);
}

function showLoginScreen(message = '') {
  activeAdminId = null;
  if (realtimeChannel && _supabaseClient) {
    _supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  document.getElementById('modalAddBook')?.classList.add('hidden');
  document.getElementById('modalAddMember')?.classList.add('hidden');
  document.getElementById('dashboardApp')?.classList.add('hidden');
  document.getElementById('adminLoginScreen')?.classList.remove('hidden');
  document.getElementById('adminSignOutButton')?.classList.add('hidden');
  document.getElementById('adminSignedInEmail')?.classList.add('hidden');
  showLoginMessage(message);
}

function showDashboard(user = null) {
  document.getElementById('adminLoginScreen')?.classList.add('hidden');
  document.getElementById('dashboardApp')?.classList.remove('hidden');
  const signOutButton = document.getElementById('adminSignOutButton');
  const signedInEmail = document.getElementById('adminSignedInEmail');

  if (isDemoMode) {
    activeAdminId = null;
    signOutButton?.classList.add('hidden');
    signedInEmail?.classList.add('hidden');
  } else {
    activeAdminId = user.id;
    signOutButton?.classList.remove('hidden');
    signedInEmail.textContent = user.email || '';
    signedInEmail.classList.remove('hidden');
  }

  renderIcons();
  loadAllData();
  if (!isDemoMode) subscribeRealtime();
}

function handleAuthSession(session) {
  if (!session) {
    const message = pendingAuthMessage;
    pendingAuthMessage = '';
    showLoginScreen(message);
    return;
  }

  if (session.user.app_metadata?.role !== 'admin') {
    pendingAuthMessage = 'บัญชีนี้ยังไม่ได้รับสิทธิ์แอดมิน โปรดติดต่อเจ้าของระบบ';
    showLoginScreen(pendingAuthMessage);
    setTimeout(() => {
      if (!_supabaseClient) return;
      _supabaseClient.auth.signOut().then(({ error }) => {
        if (error) {
          console.error('Unauthorized sign-out error:', error);
          showLoginMessage('บัญชีนี้ไม่มีสิทธิ์แอดมิน และออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
        }
      });
    }, 0);
    return;
  }

  if (activeAdminId === session.user.id) return;
  pendingAuthMessage = '';
  showLoginMessage();
  showDashboard(session.user);
}

function clearSupabaseSubscriptions() {
  authStateSubscription?.unsubscribe();
  authStateSubscription = null;
  if (realtimeChannel && _supabaseClient) {
    _supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// เริ่มต้นการเชื่อมต่อ Supabase Client
async function initSupabase() {
  const { url, key } = getConfig();
  const statusEl = document.getElementById('connectionStatus');

  // ตรวจสอบว่ามี URL และ Key จริงหรือไม่
  const hasValidConfig = url && key && !url.includes('YOUR_PROJECT_REF') && !key.includes('YOUR_ANON_KEY') && key !== '******' && url.startsWith('http');

  if (!hasValidConfig) {
    clearSupabaseSubscriptions();
    isDemoMode = true;
    _supabaseClient = null;
    if (statusEl) {
      statusEl.className = 'cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition';
      statusEl.title = 'คลิกเพื่อตั้งค่า Supabase จริง';
      statusEl.onclick = openConfigModal;
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>โหมดตัวอย่าง (Demo Mode) — คลิกตั้งค่า</span>`;
    }
    showDashboard();
    return;
  }

  try {
    clearSupabaseSubscriptions();
    // ใช้ local var supabaseLib เข้าถึง SDK ไม่ชนกับ _supabaseClient
    const supabaseLib = window.supabase;
    if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
      throw new Error('Supabase SDK CDN ยังโหลดไม่เสร็จสิ้น — กรุณารีเฟรชหน้า');
    }

    _supabaseClient = supabaseLib.createClient(url, key);
    isDemoMode = false;

    if (statusEl) {
      statusEl.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700';
      statusEl.onclick = null;
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-indigo-400"></span><span>รอเข้าสู่ระบบแอดมิน</span>`;
    }

    showLoginScreen();
    const { data: authListener } = _supabaseClient.auth.onAuthStateChange((_event, session) => {
      handleAuthSession(session);
    });
    authStateSubscription = authListener.subscription;

    const { data, error } = await _supabaseClient.auth.getSession();
    if (error) throw error;
    handleAuthSession(data.session);

  } catch (err) {
    console.error('Supabase Initialization Error:', err);
    pendingAuthMessage = 'เชื่อมต่อ Supabase ไม่สำเร็จ: ' + err.message;
    showLoginScreen(pendingAuthMessage);
    if (statusEl) {
      statusEl.className = 'cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition';
      statusEl.onclick = openConfigModal;
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span><span>เชื่อมต่อไม่สำเร็จ (คลิกเพื่อแก้ไข)</span>`;
    }
    showToast('⚠️ ' + err.message, 'error');
  }
}

async function signInAdmin(event) {
  event.preventDefault();
  if (!_supabaseClient || isDemoMode) {
    showLoginMessage('กรุณาตั้งค่า Supabase URL และ anon key ก่อนเข้าสู่ระบบ');
    openConfigModal();
    return;
  }

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const button = document.getElementById('adminLoginButton');
  button.disabled = true;
  showLoginMessage();

  try {
    const { error } = await _supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    document.getElementById('adminLoginForm').reset();
  } catch (err) {
    console.error('Admin sign-in error:', err);
    showLoginMessage('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
  } finally {
    button.disabled = false;
  }
}

async function signOutAdmin() {
  if (!_supabaseClient || isDemoMode) return;
  const { error } = await _supabaseClient.auth.signOut();
  if (error) {
    console.error('Admin sign-out error:', error);
    showToast('ออกจากระบบไม่สำเร็จ: ' + error.message, 'error');
    return;
  }
  clearSupabaseSubscriptions();
  showLoginScreen();
}

// ==============================================================================
// 4. การรับข้อมูลแบบเรียลไทม์ (Supabase Realtime Subscription)
// ==============================================================================
function subscribeRealtime() {
  if (!_supabaseClient || isDemoMode || realtimeChannel) return;

  try {
    realtimeChannel = _supabaseClient
      .channel('library_live_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        console.log('⚡ Realtime Transaction Event Detected:', payload);
        fetchTransactions();
        fetchStats();
        playNotificationSound();
        showToast('⚡ มีรายการสแกนใหม่จากตู้ ESP32!', 'success');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, (payload) => {
        console.log('⚡ Realtime Book Status Change:', payload);
        fetchBooks();
        fetchStats();
      })
      .subscribe((status) => {
        console.log('Realtime Subscription Status:', status);
      });
  } catch (e) {
    console.warn('Realtime subscription failed:', e);
  }
}

// เสียงแจ้งเตือนสั้นๆ เมื่อมีการสแกนสำเร็จจากตู้ ESP32
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

// ==============================================================================
// 5. การดึงข้อมูลและการแสดงผล (Data Fetching & UI Rendering)
// ==============================================================================
async function loadAllData() {
  await fetchStats();
  await fetchTransactions();
  await fetchBooks();
  await fetchMembers();
}

// ดึงตัวเลขสถิติด้านบน
async function fetchStats() {
  if (isDemoMode || !_supabaseClient) {
    const totalBooks = mockData.books.length;
    const availableBooks = mockData.books.filter(b => b.status === 'available').length;
    const borrowedBooks = mockData.books.filter(b => b.status === 'borrowed').length;
    const totalBorrowers = mockData.members.length;

    document.getElementById('statTotalBooks').textContent = totalBooks;
    document.getElementById('statAvailableBooks').textContent = availableBooks;
    document.getElementById('statBorrowedBooks').textContent = borrowedBooks;
    document.getElementById('statTotalBorrowers').textContent = totalBorrowers;
    return;
  }

  try {
    const [booksResult, availableResult, borrowedResult, borrowersResult] = await Promise.all([
      _supabaseClient.from('books').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      _supabaseClient.from('books').select('*', { count: 'exact', head: true }).eq('status', 'available').is('deleted_at', null),
      _supabaseClient.from('books').select('*', { count: 'exact', head: true }).eq('status', 'borrowed').is('deleted_at', null),
      _supabaseClient.from('borrowers').select('*', { count: 'exact', head: true })
    ]);
    const firstError = [booksResult, availableResult, borrowedResult, borrowersResult].find(result => result.error)?.error;
    if (firstError) throw firstError;

    document.getElementById('statTotalBooks').textContent = booksResult.count ?? 0;
    document.getElementById('statAvailableBooks').textContent = availableResult.count ?? 0;
    document.getElementById('statBorrowedBooks').textContent = borrowedResult.count ?? 0;
    document.getElementById('statTotalBorrowers').textContent = borrowersResult.count ?? 0;
  } catch (err) {
    console.error('Fetch Stats Error:', err);
    ['statTotalBooks', 'statAvailableBooks', 'statBorrowedBooks', 'statTotalBorrowers'].forEach((id) => {
      document.getElementById(id).textContent = '—';
    });
    showToast('โหลดสถิติไม่สำเร็จ: ' + err.message, 'error');
  }
}

// ดึงประวัติการทำรายการล่าสุด (Live Feed)
async function fetchTransactions() {
  const tbody = document.getElementById('transactionTableBody');
  if (!tbody) return;

  if (isDemoMode || !_supabaseClient) {
    renderTransactionRows(mockData.transactions);
    return;
  }

  try {
    const { data, error } = await _supabaseClient
      .from('transactions')
      .select(`
        id,
        borrowed_at,
        due_date,
        returned_at,
        fine_amount,
        status,
        books ( title, rfid_uid, qr_code ),
        borrowers ( full_name )
      `)
      .order('borrowed_at', { ascending: false })
      .limit(25);

    if (error) throw error;
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-slate-500">ยังไม่มีประวัติการทำรายการในระบบ</td></tr>`;
      return;
    }

    const formatted = data.map(tx => ({
      id: tx.id,
      borrowed_at: tx.borrowed_at,
      due_date: tx.due_date,
      returned_at: tx.returned_at,
      fine_amount: tx.fine_amount,
      status: tx.status,
      book_title: tx.books ? tx.books.title : 'หนังสือไม่ทราบชื่อ',
      borrower_name: tx.borrowers ? tx.borrowers.full_name : 'ไม่ระบุผู้ยืม'
    }));

    renderTransactionRows(formatted);
  } catch (err) {
    console.error('Fetch Transactions Error:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-rose-300">โหลดประวัติไม่สำเร็จ: ${escapeHtml(err.message)}</td></tr>`;
    showToast('โหลดประวัติไม่สำเร็จ: ' + err.message, 'error');
  }
}

function renderTransactionRows(list) {
  const tbody = document.getElementById('transactionTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-slate-500">ยังไม่มีประวัติการทำรายการในระบบ</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(tx => {
    const isReturned = tx.status === 'returned';
    const bookTitle = tx.book_title || 'หนังสือไม่ทราบชื่อ';
    const borrowerName = tx.borrower_name || 'ไม่ระบุผู้ยืม';
    const borrowTime = new Date(tx.borrowed_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    const returnTime = tx.returned_at ? new Date(tx.returned_at).toLocaleTimeString('th-TH', { timeStyle: 'short' }) : null;

    const actionBadge = isReturned
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i data-lucide="arrow-down-left" class="w-3 h-3"></i>คืนหนังสือ</span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><i data-lucide="arrow-up-right" class="w-3 h-3"></i>ยืมหนังสือ</span>`;

    const fineBadge = parseFloat(tx.fine_amount) > 0
      ? `<span class="text-rose-400 font-semibold font-mono">${parseFloat(tx.fine_amount).toFixed(2)}</span>`
      : `<span class="text-slate-500 font-mono">0.00</span>`;

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="px-6 py-4 text-xs text-slate-400 font-mono">${borrowTime}</td>
        <td class="px-6 py-4">${actionBadge}</td>
        <td class="px-6 py-4 font-medium text-white">${escapeHtml(bookTitle)}</td>
        <td class="px-6 py-4 text-slate-300">${escapeHtml(borrowerName)}</td>
        <td class="px-6 py-4 text-xs text-slate-300">
          ${isReturned ? `คืนแล้วเมื่อ ${escapeHtml(returnTime)}` : `ครบกำหนด: <span class="text-amber-300 font-medium">${escapeHtml(tx.due_date)}</span>`}
        </td>
        <td class="px-6 py-4">${fineBadge}</td>
      </tr>
    `;
  }).join('');

  renderIcons();
}

// ดึงรายการหนังสือทั้งหมด
async function fetchBooks() {
  const tbody = document.getElementById('booksTableBody');
  if (!tbody) return;

  if (isDemoMode || !_supabaseClient) {
    renderBookRows(mockData.books);
    return;
  }

  try {
    const { data, error } = await _supabaseClient
      .from('books')
      .select('*')
      .is('deleted_at', null)
      .order('id', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      renderBookRows([]);
      return;
    }

    renderBookRows(data);
  } catch (err) {
    console.error('Fetch Books Error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-rose-300">โหลดรายการหนังสือไม่สำเร็จ: ${escapeHtml(err.message)}</td></tr>`;
    showToast('โหลดรายการหนังสือไม่สำเร็จ: ' + err.message, 'error');
  }
}

function renderBookRows(books) {
  const tbody = document.getElementById('booksTableBody');
  if (!tbody) return;

  if (!books || books.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500">ไม่มีหนังสือในคลัง</td></tr>`;
    return;
  }

  tbody.innerHTML = books.map(b => {
    let statusBadge = '';
    if (b.status === 'available') {
      statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ว่าง (Available)</span>`;
    } else if (b.status === 'borrowed') {
      statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">ถูกยืม (Borrowed)</span>`;
    } else {
      statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">${escapeHtml(b.status)}</span>`;
    }

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="px-6 py-4 font-mono text-xs text-indigo-400 font-semibold">${escapeHtml(b.qr_code)}</td>
        <td class="px-6 py-4 font-mono text-xs text-emerald-300">${b.rfid_uid ? escapeHtml(b.rfid_uid) : '<span class="text-slate-500">ยังไม่ผูก Tag</span>'}</td>
        <td class="px-6 py-4 font-medium text-white">${escapeHtml(b.title)}</td>
        <td class="px-6 py-4 text-slate-400 text-xs">${escapeHtml(b.author || '-')}</td>
        <td class="px-6 py-4">${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

// ดึงรายชื่อสมาชิกและบัตรประจำตัว
async function fetchMembers() {
  const tbody = document.getElementById('membersTableBody');
  if (!tbody) return;

  if (isDemoMode || !_supabaseClient) {
    renderMemberRows(mockData.members);
    return;
  }

  try {
    const { data, error } = await _supabaseClient
      .from('borrowers')
      .select(`
        id,
        full_name,
        phone,
        rfid_cards ( card_uid, is_active )
      `)
      .order('id', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      renderMemberRows([]);
      return;
    }

    const formatted = data.map(m => {
      const card = m.rfid_cards && m.rfid_cards.length > 0 ? m.rfid_cards[0] : null;
      return {
        id: m.id,
        full_name: m.full_name,
        phone: m.phone,
        card_uid: card ? card.card_uid : null,
        is_active: card ? card.is_active : false
      };
    });

    renderMemberRows(formatted);
  } catch (err) {
    console.error('Fetch Members Error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-rose-300">โหลดรายชื่อสมาชิกไม่สำเร็จ: ${escapeHtml(err.message)}</td></tr>`;
    showToast('โหลดรายชื่อสมาชิกไม่สำเร็จ: ' + err.message, 'error');
  }
}

function renderMemberRows(members) {
  const tbody = document.getElementById('membersTableBody');
  if (!tbody) return;

  if (!members || members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500">ไม่มีรายชื่อสมาชิก</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const cardUid = m.card_uid ? escapeHtml(m.card_uid) : '<span class="text-slate-500">ไม่มีบัตร</span>';
    const isActive = m.is_active;

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="px-6 py-4 text-xs text-slate-400 font-mono">${escapeHtml(m.id)}</td>
        <td class="px-6 py-4 font-medium text-white">${escapeHtml(m.full_name)}</td>
        <td class="px-6 py-4 text-slate-300 text-xs font-mono">${escapeHtml(m.phone || '-')}</td>
        <td class="px-6 py-4 font-mono text-xs text-indigo-400 font-semibold">${cardUid}</td>
        <td class="px-6 py-4">
          ${isActive 
            ? `<span class="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">พร้อมใช้งาน</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700">ปิดใช้งาน</span>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 6. การทำรายการยืม-คืนผ่านเคาน์เตอร์เจ้าหน้าที่ (Manual Actions)
// ==============================================================================
async function handleManualBorrow(e) {
  e.preventDefault();

  const qr = document.getElementById('manualQrCode').value.trim();
  const name = document.getElementById('manualBorrowerName').value.trim();
  const cardUid = document.getElementById('manualCardUid').value.trim();

  if (isDemoMode || !_supabaseClient) {
    // ทำงานในโหมดตัวอย่าง (Demo Mode) ทันที
    const book = mockData.books.find(b => b.qr_code.toUpperCase() === qr.toUpperCase() || b.rfid_uid.toUpperCase() === cardUid.toUpperCase());
    const bookTitle = book ? book.title : 'หนังสือ QR: ' + qr;
    
    if (book) book.status = 'borrowed';

    const newTx = {
      id: Date.now(),
      borrowed_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      returned_at: null,
      fine_amount: 0.00,
      status: 'borrowed',
      book_title: bookTitle,
      borrower_name: name
    };
    mockData.transactions.unshift(newTx);

    showToast(`✅ [Demo] บันทึกการยืมสำเร็จ: ${bookTitle}`, 'success');
    playNotificationSound();
    document.getElementById('manualBorrowForm').reset();
    fetchStats();
    fetchTransactions();
    fetchBooks();
    switchTab('live');
    return;
  }

  try {
    const { data, error } = await _supabaseClient.rpc('admin_borrow_book', {
      p_qr_code: qr,
      p_borrower_name: name,
      p_rfid_card_uid: cardUid
    });

    if (error) {
      showToast('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');
      return;
    }

    if (data && data.status === 'success') {
      showToast(`✅ บันทึกการยืมสำเร็จ: ${data.book_title}`, 'success');
      playNotificationSound();
      document.getElementById('manualBorrowForm').reset();
      fetchTransactions();
      fetchStats();
      fetchBooks();
      switchTab('live');
    } else {
      alert('❌ ไม่สามารถยืมได้: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
  }
}

// เพิ่มหนังสือใหม่เข้าคลัง
async function submitAddBook(e) {
  e.preventDefault();

  const qr_code = document.getElementById('newBookQr').value.trim();
  const rfid_uid = document.getElementById('newBookRfid').value.trim();
  const title = document.getElementById('newBookTitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim();

  if (isDemoMode || !_supabaseClient) {
    mockData.books.push({
      id: mockData.books.length + 1,
      qr_code,
      rfid_uid,
      title,
      author,
      status: 'available'
    });
    showToast(`✅ [Demo] เพิ่มหนังสือ "${title}" เรียบร้อยแล้ว!`, 'success');
    closeAddBookModal();
    document.getElementById('formAddBook').reset();
    fetchBooks();
    fetchStats();
    return;
  }

  try {
    const { error } = await _supabaseClient.from('books').insert({
      qr_code,
      rfid_uid,
      title,
      author,
      category_id: 1,
      status: 'available'
    });

    if (error) {
      showToast('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');
      return;
    }

    showToast(`✅ เพิ่มหนังสือ "${title}" เข้าสู่ระบบเรียบร้อยแล้ว!`, 'success');
    closeAddBookModal();
    document.getElementById('formAddBook').reset();
    fetchBooks();
    fetchStats();
  } catch (err) {
    showToast('❌ บันทึกหนังสือไม่สำเร็จ: ' + err.message, 'error');
  }
}

// ลงทะเบียนสมาชิกใหม่และผูกเลขบัตร RFID
async function submitAddMember(e) {
  e.preventDefault();

  const full_name = document.getElementById('newMemberName').value.trim();
  const phone = document.getElementById('newMemberPhone').value.trim();
  const card_uid = document.getElementById('newMemberCardUid').value.trim();

  if (isDemoMode || !_supabaseClient) {
    const newId = mockData.members.length + 1;
    mockData.members.push({
      id: newId,
      full_name,
      phone,
      card_uid,
      is_active: true
    });
    showToast(`✅ [Demo] ลงทะเบียนสมาชิก "${full_name}" เรียบร้อยแล้ว!`, 'success');
    closeAddMemberModal();
    document.getElementById('formAddMember').reset();
    fetchMembers();
    fetchStats();
    return;
  }

  try {
    const { data: borrower, error: err1 } = await _supabaseClient
      .from('borrowers')
      .insert({ full_name, phone })
      .select()
      .single();

    if (err1) {
      showToast('❌ บันทึกสมาชิกไม่สำเร็จ: ' + err1.message, 'error');
      return;
    }

    const { error: err2 } = await _supabaseClient
      .from('rfid_cards')
      .upsert({
        card_uid,
        borrower_id: borrower.id,
        is_active: true
      }, { onConflict: 'card_uid' });

    if (err2) {
      showToast('❌ ผูกบัตร RFID ไม่สำเร็จ: ' + err2.message, 'error');
      return;
    }

    showToast(`✅ ลงทะเบียนสมาชิก "${full_name}" เรียบร้อยแล้ว!`, 'success');
    closeAddMemberModal();
    document.getElementById('formAddMember').reset();
    fetchMembers();
    fetchStats();
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

// ==============================================================================
// 7. การสลับแท็บและการควบคุม Modal (UI State Helpers)
// ==============================================================================
function switchTab(tab) {
  const tabs = ['live', 'books', 'members', 'manual'];
  tabs.forEach(t => {
    const panel = document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1));
    const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (panel) panel.classList.add('hidden');
    if (btn) {
      btn.className = 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition flex items-center gap-2 whitespace-nowrap';
    }
  });

  const activePanel = document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  const activeBtn = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (activePanel) activePanel.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.className = 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition whitespace-nowrap';
  }

  if (tab === 'live') fetchTransactions();
  if (tab === 'books') fetchBooks();
  if (tab === 'members') fetchMembers();
}

function openConfigModal() {
  const { url, key } = getConfig();
  const inputUrl = document.getElementById('inputSupabaseUrl');
  const inputKey = document.getElementById('inputSupabaseKey');
  if (inputUrl) inputUrl.value = url.includes('YOUR_PROJECT_REF') ? '' : url;
  if (inputKey) inputKey.value = key.includes('YOUR_ANON_KEY') ? '' : key;
  const modal = document.getElementById('modalConfig');
  if (modal) modal.classList.remove('hidden');
}

function closeConfigModal() {
  const modal = document.getElementById('modalConfig');
  if (modal) modal.classList.add('hidden');
}

function saveSupabaseConfig() {
  let url = document.getElementById('inputSupabaseUrl').value.trim();
  let key = document.getElementById('inputSupabaseKey').value.trim();
  url = cleanSupabaseUrl(url);
  key = (key || '').trim();
  
  if (!url || !key) {
    showToast('⚠️ กรุณากรอกทั้ง Supabase URL และ anon Key', 'error');
    return;
  }

  safeStorage.set('SP_URL', url);
  safeStorage.set('SP_KEY', key);
  closeConfigModal();
  void initSupabase();
}

function switchToDemoMode() {
  clearSupabaseSubscriptions();
  safeStorage.remove('SP_URL');
  safeStorage.remove('SP_KEY');
  closeConfigModal();
  isDemoMode = true;
  _supabaseClient = null;

  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.className = 'cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition';
    statusEl.title = 'คลิกเพื่อตั้งค่า Supabase จริง';
    statusEl.onclick = openConfigModal;
    statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>โหมดตัวอย่าง (Demo Mode) — คลิกตั้งค่า</span>`;
  }

  showDashboard();
  showToast('ℹ️ สลับเป็นโหมดตัวอย่าง (Demo Mode) เรียบร้อยแล้ว', 'info');
}

function openAddBookModal() {
  const modal = document.getElementById('modalAddBook');
  if (modal) modal.classList.remove('hidden');
}

function closeAddBookModal() {
  const modal = document.getElementById('modalAddBook');
  if (modal) modal.classList.add('hidden');
}

function openAddMemberModal() {
  const modal = document.getElementById('modalAddMember');
  if (modal) modal.classList.remove('hidden');
}

function closeAddMemberModal() {
  const modal = document.getElementById('modalAddMember');
  if (modal) modal.classList.add('hidden');
}

// เริ่มต้นทำงานหลังจาก DOM พร้อมเท่านั้น
document.addEventListener('DOMContentLoaded', () => {
  renderIcons();

  // ผูก Modal event listeners ภายใน DOMContentLoaded เพื่อให้ Element มีอยู่จริง
  ['modalConfig', 'modalAddBook', 'modalAddMember'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) el.classList.add('hidden');
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfigModal();
      closeAddBookModal();
      closeAddMemberModal();
    }
  });

  void initSupabase();
});
