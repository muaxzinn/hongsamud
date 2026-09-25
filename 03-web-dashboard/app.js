/**
 * ==============================================================================
 * 💻 SMART LIBRARY SYSTEM — FRONTEND APPLICATION LOGIC (app.js)
 * ตรรกะการทำงานฝั่งหน้าเว็บ: เชื่อมต่อ Supabase, ดึงสถิติ, และรับ Realtime Events
 * ==============================================================================
 */

let supabase = null;

// ==============================================================================
// 1. การจัดการการตั้งค่าการเชื่อมต่อ (Configuration Management)
// ==============================================================================
function getConfig() {
  const url = localStorage.getItem('SP_URL') || (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.SUPABASE_URL) || '';
  const key = localStorage.getItem('SP_KEY') || (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.SUPABASE_ANON_KEY) || '';
  return { url, key };
}

// เริ่มต้นการเชื่อมต่อ Supabase Client
function initSupabase() {
  const { url, key } = getConfig();
  const statusEl = document.getElementById('connectionStatus');

  if (!url || !key || url.includes('YOUR_PROJECT_REF')) {
    if (statusEl) {
      statusEl.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>ยังไม่ได้ตั้งค่า API Key</span>`;
    }
    openConfigModal();
    return;
  }

  try {
    // สร้าง Instance ของ Supabase Client
    supabase = window.supabase.createClient(url, key);

    if (statusEl) {
      statusEl.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 live-dot"></span><span>Supabase เชื่อมต่อสด</span>`;
    }

    // โหลดข้อมูลภาพรวมครั้งแรก
    loadAllData();

    // เปิดรับ Event การสแกนแบบ Realtime WebSocket
    subscribeRealtime();

  } catch (err) {
    console.error('Supabase Initialization Error:', err);
    if (statusEl) {
      statusEl.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20';
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span><span>เชื่อมต่อล้มเหลว</span>`;
    }
  }
}

// ==============================================================================
// 2. การรับข้อมูลแบบเรียลไทม์ (Supabase Realtime Subscription)
// ==============================================================================
function subscribeRealtime() {
  if (!supabase) return;

  // รับฟังการเปลี่ยนแปลงในตาราง transactions และ books
  supabase
    .channel('library_live_feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
      console.log('⚡ Realtime Transaction Event Detected:', payload);
      // โหลดประวัติและตัวเลขสถิติใหม่ทันที
      fetchTransactions();
      fetchStats();
      playNotificationSound();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, (payload) => {
      console.log('⚡ Realtime Book Status Change:', payload);
      fetchBooks();
      fetchStats();
    })
    .subscribe();
}

// เสียงแจ้งเตือนสั้นๆ ผ่าน Web Audio API เมื่อมีการสแกนสำเร็จจากตู้ ESP32
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // โน้ต A5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    // กรณี Browser บล็อกเสียงอัตโนมัติ ให้ละเว้น
  }
}

// ==============================================================================
// 3. การดึงข้อมูลและการแสดงผล (Data Fetching & UI Rendering)
// ==============================================================================

async function loadAllData() {
  await fetchStats();
  await fetchTransactions();
}

// ดึงตัวเลขสถิติด้านบน
async function fetchStats() {
  if (!supabase) return;

  try {
    const { count: totalBooks } = await supabase.from('books').select('*', { count: 'exact', head: true }).is('deleted_at', null);
    const { count: availableBooks } = await supabase.from('books').select('*', { count: 'exact', head: true }).eq('status', 'available').is('deleted_at', null);
    const { count: borrowedBooks } = await supabase.from('books').select('*', { count: 'exact', head: true }).eq('status', 'borrowed').is('deleted_at', null);
    const { count: totalBorrowers } = await supabase.from('borrowers').select('*', { count: 'exact', head: true });

    document.getElementById('statTotalBooks').textContent = totalBooks || 0;
    document.getElementById('statAvailableBooks').textContent = availableBooks || 0;
    document.getElementById('statBorrowedBooks').textContent = borrowedBooks || 0;
    document.getElementById('statTotalBorrowers').textContent = totalBorrowers || 0;
  } catch (err) {
    console.error('Fetch Stats Error:', err);
  }
}

// ดึงประวัติการทำรายการล่าสุด (Live Feed)
async function fetchTransactions() {
  if (!supabase) return;

  const tbody = document.getElementById('transactionTableBody');
  try {
    const { data, error } = await supabase
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

    if (error || !data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-slate-500">ยังไม่มีประวัติการทำรายการในระบบ</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(tx => {
      const isReturned = tx.status === 'returned';
      const bookTitle = tx.books ? tx.books.title : 'หนังสือไม่ทราบชื่อ';
      const borrowerName = tx.borrowers ? tx.borrowers.full_name : 'ไม่ระบุผู้ยืม';
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
          <td class="px-6 py-4 font-medium text-white">${bookTitle}</td>
          <td class="px-6 py-4 text-slate-300">${borrowerName}</td>
          <td class="px-6 py-4 text-xs text-slate-300">
            ${isReturned ? `คืนแล้วเมื่อ ${returnTime}` : `ครบกำหนด: <span class="text-amber-300 font-medium">${tx.due_date}</span>`}
          </td>
          <td class="px-6 py-4">${fineBadge}</td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Fetch Transactions Error:', err);
  }
}

// ดึงรายการหนังสือทั้งหมด
async function fetchBooks() {
  if (!supabase) return;

  const tbody = document.getElementById('booksTableBody');
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .is('deleted_at', null)
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500">ไม่มีหนังสือในคลัง</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(b => {
      let statusBadge = '';
      if (b.status === 'available') {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ว่าง (Available)</span>`;
      } else if (b.status === 'borrowed') {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">ถูกยืม (Borrowed)</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">${b.status}</span>`;
      }

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="px-6 py-4 font-mono text-xs text-indigo-400 font-semibold">${b.qr_code}</td>
          <td class="px-6 py-4 font-mono text-xs text-emerald-300">${b.rfid_uid || '<span class="text-slate-500">ยังไม่ผูก Tag</span>'}</td>
          <td class="px-6 py-4 font-medium text-white">${b.title}</td>
          <td class="px-6 py-4 text-slate-400 text-xs">${b.author || '-'}</td>
          <td class="px-6 py-4">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Fetch Books Error:', err);
  }
}

// ดึงรายชื่อสมาชิกและบัตรประจำตัว
async function fetchMembers() {
  if (!supabase) return;

  const tbody = document.getElementById('membersTableBody');
  try {
    const { data, error } = await supabase
      .from('borrowers')
      .select(`
        id,
        full_name,
        phone,
        rfid_cards ( card_uid, is_active )
      `)
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500">ไม่มีรายชื่อสมาชิก</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(m => {
      const card = m.rfid_cards && m.rfid_cards.length > 0 ? m.rfid_cards[0] : null;
      const cardUid = card ? card.card_uid : '<span class="text-slate-500">ไม่มีบัตร</span>';
      const isActive = card ? card.is_active : false;

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="px-6 py-4 text-xs text-slate-400 font-mono">${m.id}</td>
          <td class="px-6 py-4 font-medium text-white">${m.full_name}</td>
          <td class="px-6 py-4 text-slate-300 text-xs font-mono">${m.phone || '-'}</td>
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
  } catch (err) {
    console.error('Fetch Members Error:', err);
  }
}

// ==============================================================================
// 4. การทำรายการยืม-คืนผ่านเคาน์เตอร์เจ้าหน้าที่ (Manual Actions)
// ==============================================================================

async function handleManualBorrow(e) {
  e.preventDefault();
  if (!supabase) return;

  const qr = document.getElementById('manualQrCode').value.trim();
  const name = document.getElementById('manualBorrowerName').value.trim();
  const cardUid = document.getElementById('manualCardUid').value.trim();

  try {
    const { data, error } = await supabase.rpc('admin_borrow_book', {
      p_qr_code: qr,
      p_borrower_name: name,
      p_rfid_card_uid: cardUid
    });

    if (error) {
      alert('เกิดข้อผิดพลาดจากระบบ: ' + error.message);
      return;
    }

    if (data.status === 'success') {
      alert(`✅ บันทึกการยืมสำเร็จ!\nหนังสือ: ${data.book_title}\nผู้ยืม: ${data.borrower_name}\nกำหนดส่งคืน: ${data.due_date}`);
      document.getElementById('manualBorrowForm').reset();
      fetchTransactions();
      fetchStats();
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
  if (!supabase) return;

  const qr_code = document.getElementById('newBookQr').value.trim();
  const rfid_uid = document.getElementById('newBookRfid').value.trim();
  const title = document.getElementById('newBookTitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim();

  try {
    const { error } = await supabase.from('books').insert({
      qr_code,
      rfid_uid,
      title,
      author,
      category_id: 1,
      status: 'available'
    });

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
      return;
    }

    alert('✅ เพิ่มหนังสือใหม่เข้าสู่ระบบเรียบร้อยแล้ว!');
    closeAddBookModal();
    document.getElementById('formAddBook').reset();
    fetchBooks();
    fetchStats();
  } catch (err) {
    alert('บันทึกหนังสือไม่สำเร็จ: ' + err.message);
  }
}

// ลงทะเบียนสมาชิกใหม่และผูกเลขบัตร RFID
async function submitAddMember(e) {
  e.preventDefault();
  if (!supabase) return;

  const full_name = document.getElementById('newMemberName').value.trim();
  const phone = document.getElementById('newMemberPhone').value.trim();
  const card_uid = document.getElementById('newMemberCardUid').value.trim();

  try {
    // 1. สร้างข้อมูลสมาชิก
    const { data: borrower, error: err1 } = await supabase
      .from('borrowers')
      .insert({ full_name, phone })
      .select()
      .single();

    if (err1) {
      alert('บันทึกสมาชิกไม่สำเร็จ: ' + err1.message);
      return;
    }

    // 2. บันทึกและผูกบัตร RFID
    const { error: err2 } = await supabase
      .from('rfid_cards')
      .upsert({
        card_uid,
        borrower_id: borrower.id,
        is_active: true
      }, { onConflict: 'card_uid' });

    if (err2) {
      alert('ผูกบัตร RFID ไม่สำเร็จ: ' + err2.message);
      return;
    }

    alert('✅ ลงทะเบียนสมาชิกและผูกบัตร RFID สำเร็จ!');
    closeAddMemberModal();
    document.getElementById('formAddMember').reset();
    fetchMembers();
    fetchStats();
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

// ==============================================================================
// 5. การสลับแท็บและการควบคุม Modal (UI State Helpers)
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

  if (tab === 'books') fetchBooks();
  if (tab === 'members') fetchMembers();
}

function openConfigModal() {
  const { url, key } = getConfig();
  document.getElementById('inputSupabaseUrl').value = url;
  document.getElementById('inputSupabaseKey').value = key;
  document.getElementById('modalConfig').classList.remove('hidden');
}

function closeConfigModal() {
  document.getElementById('modalConfig').classList.add('hidden');
}

function saveSupabaseConfig() {
  const url = document.getElementById('inputSupabaseUrl').value.trim();
  const key = document.getElementById('inputSupabaseKey').value.trim();
  localStorage.setItem('SP_URL', url);
  localStorage.setItem('SP_KEY', key);
  closeConfigModal();
  initSupabase();
}

function openAddBookModal() {
  document.getElementById('modalAddBook').classList.remove('hidden');
}

function closeAddBookModal() {
  document.getElementById('modalAddBook').classList.add('hidden');
}

function openAddMemberModal() {
  document.getElementById('modalAddMember').classList.remove('hidden');
}

function closeAddMemberModal() {
  document.getElementById('modalAddMember').classList.add('hidden');
}

// เริ่มต้นทำงานทันทีที่โหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initSupabase();
});
