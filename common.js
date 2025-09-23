// common.js - handles inventory in localStorage and form behavior
(function () {
  // ------- DOM refs (exist only on relevant pages) -------
  const productType = document.getElementById('productType');
  const sizeSelect   = document.getElementById('size');
  const codeInput    = document.getElementById('code');
  const colorInput   = document.getElementById('color');
  const qtyInput     = document.getElementById('qty');
  const notesInput   = document.getElementById('notes');

  const addBtn       = document.getElementById('addBtn');       // import.html
  const removeBtn    = document.getElementById && document.getElementById('removeBtn'); // export.html

  const inventoryList = document.getElementById('inventoryList'); // inventory.html
  const exportCsvBtn  = document.getElementById && document.getElementById('exportCsv');
  const clearAllBtn   = document.getElementById && document.getElementById('clearAll');

  // ------- Sizes -------
 const SIZE_SETS = {
  Shirt:    ['M', 'L', 'XL', '2XL', '3XL', '4XL'],
  Jacket:   ['M', 'L', 'XL', '2XL', '3XL'],
  Coverall: ['M', 'L', 'XL', '2XL', '3XL'],

  Pants: (() => {
    const arr = [];
    for (let s = 24; s <= 60; s += 2) arr.push(String(s));
    return arr;
  })(), // <-- هنا الفاصلة كانت ناقصة

  Lapcod: (() => {
    const arr = [];
    for (let s = 2; s <= 60; s += 1) arr.push(String(s)); // من 2 إلى 60
    return arr;
  })()
};

  function populateSizesFor(type) {
    if (!sizeSelect) return;
    sizeSelect.innerHTML = '';
    const sizes = SIZE_SETS[type] || ['M', 'L', 'XL'];
    sizes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sizeSelect.appendChild(opt);
    });
  }

  if (productType) {
    productType.addEventListener('change', () => populateSizesFor(productType.value));
    populateSizesFor(productType.value);
  }

  // ------- Storage helpers -------
  const STORAGE_KEY = 'gudp_inventory_v1';

  function loadInventory() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function saveInventory(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }
  function makeKey(item) {
    return [item.type, item.code.toUpperCase(), (item.color || '').toUpperCase(), item.size].join('|');
  }

  // ------- Add / Merge -------
  function mergeAndAdd(item) {
    const inv = loadInventory();
    const key = makeKey(item);
    const idx = inv.findIndex(i => i._key === key);
    if (idx >= 0) {
      inv[idx].qty = Number(inv[idx].qty) + Number(item.qty);
      inv[idx].notes = item.notes || inv[idx].notes;
    } else {
      item._key = key;
      inv.push(item);
    }
    saveInventory(inv);
    return inv;
  }

  // ===== NEW: Subtract / Export out of inventory =====
  function subtractFromInventory(item) {
    const inv  = loadInventory();
    const key  = makeKey(item);
    const idx  = inv.findIndex(i => i._key === key);
    if (idx === -1) {
      alert('Item not found in inventory.');
      return false;
    }
    const have = Number(inv[idx].qty);
    const need = Number(item.qty);
    if (need > have) {
      alert(`Insufficient quantity. Available now: ${have}`);
      return false;
    }
    inv[idx].qty = have - need;
    if (inv[idx].qty === 0) {
      // remove item if it hits zero
      inv.splice(idx, 1);
    }
    saveInventory(inv);
    return true;
  }
  // ===== End NEW =====

  // ------- Render list (inventory.html) -------
  function renderInventory() {
    if (!inventoryList) return;
    const inv = loadInventory();
    if (inv.length === 0) {
      inventoryList.innerHTML = '<p>Inventory is empty.</p>';
      return;
    }
    inventoryList.innerHTML = '';
    inv.forEach((it, i) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div class="meta">
          <strong>${it.type} — ${it.code} — ${it.color || ''} — ${it.size}</strong>
          <small>Qty: ${it.qty}${it.notes ? ' • ' + it.notes : ''}</small>
        </div>
        <div class="actions">
          <button class="muted" data-action="dec" data-i="${i}">-1</button>
          <button class="muted" data-action="inc" data-i="${i}">+1</button>
          <button class="danger" data-action="del" data-i="${i}">Delete</button>
        </div>`;
      inventoryList.appendChild(div);
    });

    inventoryList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const i = Number(btn.getAttribute('data-i'));
        const inv = loadInventory();
        if (action === 'inc') {
          inv[i].qty = Number(inv[i].qty) + 1;
        } else if (action === 'dec') {
          inv[i].qty = Math.max(0, Number(inv[i].qty) - 1);
        } else if (action === 'del') {
          inv.splice(i, 1);
        }
        saveInventory(inv);
        renderInventory();
      });
    });
  }

  // ------- Handlers -------
  // Import (Add)
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const type  = productType.value;
      const code  = codeInput.value.trim();
      const color = colorInput.value.trim();
      const size  = sizeSelect.value;
      const qty   = Number(qtyInput.value) || 0;
      const notes = notesInput.value.trim();

      if (!code) { alert('Enter internal code.'); return; }
      if (qty <= 0) { alert('Enter a valid quantity.'); return; }

      const item = { type, code, color, size, qty, notes, addedAt: new Date().toISOString() };
      mergeAndAdd(item);
      alert('Added to inventory.');
      document.getElementById('importForm')?.reset();
      populateSizesFor(productType.value);
    });
  }

  // Export (Subtract)
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const type  = productType.value;
      const code  = codeInput.value.trim();
      const color = colorInput.value.trim();
      const size  = sizeSelect.value;
      const qty   = Number(qtyInput.value) || 0;
      const notes = notesInput.value.trim();

      if (!code) { alert('Enter internal code.'); return; }
      if (qty <= 0) { alert('Enter a valid quantity.'); return; }

      const ok = subtractFromInventory({ type, code, color, size, qty, notes });
      if (ok) {
        alert('Quantity deducted.');
        document.getElementById('exportForm')?.reset();
        populateSizesFor(productType.value);
      }
    });
  }

  // Auto-render on inventory page
  if (window.location.pathname.endsWith('inventory.html')) {
    renderInventory();
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const inv = loadInventory();
      if (inv.length === 0) { alert('No data to export.'); return; }
      const header = ['type','code','color','size','qty','notes','addedAt'];
      const rows = inv.map(i => header.map(h => (i[h] || '').toString().replace(/"/g, '""')));
      const csv = [header.join(',')].concat(rows.map(r => '"' + r.join('","') + '"')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // Clear all
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Clear inventory permanently?')) {
        localStorage.removeItem(STORAGE_KEY);
        renderInventory();
      }
    });
  }
})();
