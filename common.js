// --- ربط Firebase Firestore ---
import { db } from './firebase.js';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";


// common.js - handles inventory in localStorage and form behavior
(function () {
  // ------- DOM refs (exist only on relevant pages) -------
  const productType  = document.getElementById('productType');
  const sizeSelect   = document.getElementById('size');
  const codeInput    = document.getElementById('code');
  const colorInput   = document.getElementById('color');
  const qtyInput     = document.getElementById('qty');
  const notesInput   = document.getElementById('notes');
  const fabricInput  = document.getElementById('fabric');

  const addBtn       = document.getElementById('addBtn');       // import.html
  const removeBtn    = document.getElementById && document.getElementById('removeBtn'); // export.html

  const inventoryList = document.getElementById('inventoryList'); // inventory.html
  const exportCsvBtn  = document.getElementById && document.getElementById('exportCsv');
  const clearAllBtn   = document.getElementById && document.getElementById('clearAll');
  const sortSelect    = document.getElementById && document.getElementById('sortOptions');

  // ===== Filters (inventory.html) =====
  let currentFilter = '';   // النوع
  let currentFabric = '';   // القماش

  function bindFabricFilter() {
    const sel = document.getElementById('fabricFilter');
    if (!sel) return;
    sel.addEventListener('change', () => {
      currentFabric = (sel.value || '').toUpperCase();
      renderInventory();
    });
  }

  function bindTypeFilterButtons() {
    const wrap = document.querySelector('.type-filters');
    if (!wrap) return;
    wrap.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.getAttribute('data-filter') || '';
        // فعِّل الزر المختار فقط
        wrap.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderInventory();
      });
    });
  }

  // ------- Sizes -------
  const SIZE_SETS = {
    Shirt:    ['M','L','XL','2XL','3XL','4XL','5XL','6XL'],
    Jacket:   ['M','L','XL','2XL','3XL','4XL','5XL','6XL'],
    Coverall: (() => {
      const arr = ['M','L','XL','2XL','3XL','4XL','5XL','6XL'];
      for (let s = 36; s <= 60; s++) arr.push(String(s));
      return arr;
    })(),
    Pants: (() => {
      const arr = [];
      for (let s = 2; s <= 60; s += 2) arr.push(String(s));
      return arr;
    })(),
    Lapcod: (() => {
      const arr = [];
      for (let s = 2; s <= 60; s++) arr.push(String(s));
      return arr;
    })()
  };

  function populateSizesFor(type) {
    if (!sizeSelect) return;
    sizeSelect.innerHTML = '';
    const sizes = SIZE_SETS[type] || ['M','L','XL'];
    sizes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sizeSelect.appendChild(opt);
    });
  }

  if (productType) {
    productType.addEventListener('change', () => populateSizesFor(productType.value));
    populateSizesFor(productType.value); // تحميل افتراضي
  }

  // ------- Storage helpers -------

async function loadInventory() {
  const querySnapshot = await getDocs(collection(db, "inventory"));
  let items = [];
  querySnapshot.forEach((doc) => {
    items.push({ id: doc.id, ...doc.data() });
  });
  return items;
}

// حفظ البيانات (في localStorage مؤقتًا أو Firestore لاحقًا)
function saveInventory(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// إنشاء مفتاح فريد لكل عنصر
function makeKey(item) {
  return [
    item.type || '',
    item.code ? item.code.toUpperCase() : '',
    item.color ? item.color.toUpperCase() : '',
    item.size ? String(item.size).toUpperCase() : '',
    item.fabric ? item.fabric.toUpperCase() : ''
  ].join('|');
}


  // ------- Add / Merge -------
  function mergeAndAdd(item) {
    const inv = loadInventory();
    const key = makeKey(item);
    const idx = inv.findIndex(i => i._key === key);
    if (idx >= 0) {
      inv[idx].qty   = Number(inv[idx].qty) + Number(item.qty);
      inv[idx].notes = item.notes || inv[idx].notes;
    } else {
      item._key = key;
      inv.push(item);
    }
    saveInventory(inv);
    return inv;
  }

  // ===== Subtract / Export out of inventory =====
  function subtractFromInventory(item) {
    const inv  = loadInventory();
    const key  = makeKey(item);
    const idx  = inv.findIndex(i => i._key === key);
    if (idx === -1) { alert('Item not found in inventory.'); return false; }
    const have = Number(inv[idx].qty);
    const need = Number(item.qty);
    if (need > have) { alert(`Insufficient quantity. Available now: ${have}`); return false; }
    
    inv[idx].qty = have - need;
    if (inv[idx].qty === 0) inv.splice(idx, 1);
    saveInventory(inv);
    return true;
  }

  // ------- Render list (inventory.html) -------
  function renderInventory() {
    if (!inventoryList) return;

    const all = loadInventory();

    // فلترة بالنوع + القماش
    const filtered = all.filter(it => {
      const typeOK   = !currentFilter || it.type === currentFilter;
      const fabricOK = !currentFabric || (it.fabric || '') === currentFabric;
      return typeOK && fabricOK;
    });

    // حالة فاضية
    if (filtered.length === 0) {
      inventoryList.innerHTML = `<p>${(currentFilter || currentFabric) ?
         'No items for this filter.' : 'Inventory is empty.'}</p>`;
      return;
    }

    // عرض القائمة
    inventoryList.innerHTML = '';
    filtered.forEach(it => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div class="meta">
          <strong>${it.type} — ${it.code || ''} — ${it.color || ''} — ${it.size || ''}</strong>
          <small>Qty: ${it.qty}${it.notes ? ' • ' + it.notes : ''}${it.fabric ? ' • ' + it.fabric : ''}</small>
        </div>
        <div class="actions">
          <button class="muted" data-action="dec" data-key="${it._key}">-1</button>
          <button class="muted" data-action="inc" data-key="${it._key}">+1</button>
          <button class="danger" data-action="del" data-key="${it._key}">Delete</button>
        </div>
      `;
      inventoryList.appendChild(div);
    });

    // ربط أزرار +/−/Delete باستخدام ال-key بدل index (لأن القائمة مفلترة)
    inventoryList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const key = btn.getAttribute('data-key');
        const inv = loadInventory();
        const idx = inv.findIndex(i => i._key === key);
        if (idx === -1) return;

        if (action === 'inc') {
          inv[idx].qty = Number(inv[idx].qty) + 1;
        } else if (action === 'dec') {
          inv[idx].qty = Math.max(0, Number(inv[idx].qty) - 1);
          if (inv[idx].qty === 0) inv.splice(idx, 1);
        } else if (action === 'del') {
          inv.splice(idx, 1);
        }
        saveInventory(inv);
        renderInventory();
      });
    });
  }

  // ===== Sorting (optional) =====
  function sortInventory(criteria) {
    const inv = loadInventory();
    if (criteria === 'date') {
      inv.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    } else if (criteria === 'type') {
      inv.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    } else if (criteria === 'size') {
      inv.sort((a, b) => String(a.size || '').localeCompare(String(b.size || '')));
    }
    saveInventory(inv);
    renderInventory();
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const selected = sortSelect.value;
      if (selected) sortInventory(selected);
    });
  }

  // ------- Handlers -------
  // Import (Add)
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const type   = productType.value;
      const code   = codeInput.value ? codeInput.value.trim() : '';
      const color  = colorInput.value;
      const size   = sizeSelect.value;
      const qty    = Number(qtyInput.value) || 0;
      const notes  = notesInput.value.trim();
      const fabric = (fabricInput.value || '').toUpperCase();
      if (qty <= 0) { alert('Enter a valid quantity.'); return; }

      const item = { type, code, color, size, fabric, qty, notes, addedAt: new Date().toISOString() };
      mergeAndAdd(item);
      showSuccess('Added to inventory.');
      document.getElementById('importForm')?.reset();
      populateSizesFor(productType.value);
    });
  }

  // Toast / Notify
  function showSuccess(text) {
    const root = document.getElementById('notifyRoot');
    if (!root) return;
    root.innerHTML = `
      <div class="notify-badge">
        <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="11" stroke="#28a745" stroke-width="2"/>
          <path d="M7 12.5l3.2 3.2L17 9" stroke="#28a745" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="msg">${text}</span>
      </div>`;
    root.classList.add('show');
    setTimeout(() => root.classList.remove('show'), 1200);
  }

  // Export (Subtract)
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const type   = productType.value;
      const code   = codeInput.value ? codeInput.value.trim() : '';
      const color  = colorInput.value;
      const size   = sizeSelect.value;
      const qty    = Number(qtyInput.value) || 0;
      const notes  = notesInput.value.trim();
       const fabric = (fabricInput.value || '').toUpperCase();
      if (qty <= 0) { alert('Enter a valid quantity.'); return; }

      const ok = subtractFromInventory({ type, code, color, size, fabric, qty, notes });
      if (ok) {
        showSuccess('Quantity deducted.');
        document.getElementById('exportForm')?.reset();
        populateSizesFor(productType.value);
      }
    });
  }

  // ===== Inventory page bootstrapping =====
  if (window.location.pathname.endsWith('inventory.html')) {
    bindTypeFilterButtons();
    bindFabricFilter();
    renderInventory();
  }

  // ===== Export CSV =====
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const inv = loadInventory();
      if (inv.length === 0) { alert('No data to export.'); return; }
      const header = ['type','code','color','size','fabric','qty','notes','addedAt'];
      const rows = inv.map(i => header.map(h => (i[h] || '').toString().replace(/"/g, '""')));
      const csv = [header.join(',')].concat(rows.map(r => '"' + r.join('","') + '"')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'inventory_export.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // ===== Clear All with PIN modal =====
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      const modal = document.getElementById('pinModal');
      const pinInput = document.getElementById('pinInput');
      const pinCancel = document.getElementById('pinCancel');
      const pinConfirm = document.getElementById('pinConfirm');

      modal.style.display = 'flex';
      pinInput.value = '';
      pinInput.focus();

      pinCancel.onclick = () => { modal.style.display = 'none'; };
      pinConfirm.onclick = () => {
        const correctPIN = '1234';
        if (pinInput.value === correctPIN) {
          if (confirm('Are you sure you want to clear the entire inventory?')) {
            localStorage.removeItem(STORAGE_KEY);
            renderInventory();
            alert('Inventory cleared successfully.');
            modal.style.display = 'none';
          }
        } else {
          alert('Incorrect PIN. Action cancelled.');
        }
      };
    });
  }

// ===== Login Logic =====
function handleLogin(username, password) {
  // بيانات تسجيل الدخول المؤقتة
  const correctUsername = "Gulf";
  const correctPassword = "1234";

  if (username === correctUsername && password === correctPassword) {
    localStorage.setItem('loggedIn', 'true'); // تخزين حالة تسجيل الدخول
    window.location.href = 'index.html'; // تحويل لصفحة الرئيسية بعد تسجيل الدخول
  } else {
    alert("Invalid username or password!");
  }
}
// ===== Logout Logic =====
function handleLogout() {
  localStorage.removeItem('loggedIn'); // مسح حالة تسجيل الدخول
  window.location.href = 'login.html'; // تحويل لصفحة تسجيل الدخول
}


})();
