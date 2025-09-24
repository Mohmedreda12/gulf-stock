// common.js (type: module) — forms-based submit handlers + fixes
import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM refs (presence depends on page) =====
  const importForm   = document.getElementById('importForm');
  const exportForm   = document.getElementById('exportForm');

  const productType  = document.getElementById('productType');
  const sizeInput    = document.getElementById('size');       // input (with datalist)
  const codeInput    = document.getElementById('code');
  const colorInput   = document.getElementById('color');
  const qtyInput     = document.getElementById('qty');
  const notesInput   = document.getElementById('notes');
  const fabricInput  = document.getElementById('fabric');

  // inventory.html
  const inventoryList = document.getElementById('inventoryList');
  const exportCsvBtn  = document.getElementById('exportCsv');
  const clearAllBtn   = document.getElementById('clearAll');
  const sortSelect    = document.getElementById('sortOptions');
  const fabricFilter  = document.getElementById('fabricFilter');
  const typeWrap      = document.querySelector('.type-filters');

  // ===== Helpers: digits, size normalization & validation =====
  // تحويل الأرقام العربية/الهندية إلى لاتينية
  const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;
  function normalizeDigits(str = '') {
    return String(str).replace(ARABIC_DIGITS, d =>
      String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d) % 10)
    );
  }

  const ALLOWED_SIZES = new Set(['M','L','XL','2XL','3XL','4XL','5XL','6XL']);
  for (let i = 2; i <= 60; i++) ALLOWED_SIZES.add(String(i)); // يسمح 2..60

  function normalizeSize(raw) {
    if (!raw) return '';
    let s = normalizeDigits(raw).trim().toUpperCase().replace(/\s+/g, '');
    // شائعة
    if (s === 'X' || s === 'XLARGE') s = 'XL';
    if (s === 'SMALL') s = 'M'; // عدلها لو هتستخدم S
    return s;
  }

  function isValidSize(raw) {
    const s = normalizeSize(raw);
    return ALLOWED_SIZES.has(s);
  }

  // live validation UI (اختياري)
  if (sizeInput) {
    const mark = ok => {
      sizeInput.style.borderColor = ok ? '#28a745' : '#b22222';
      sizeInput.style.outline = 'none';
    };
    const updateMark = () => mark(isValidSize(sizeInput.value));
    sizeInput.addEventListener('input', updateMark);
    sizeInput.addEventListener('blur', () => {
      const n = normalizeSize(sizeInput.value);
      if (ALLOWED_SIZES.has(n)) sizeInput.value = n;
      updateMark();
    });
  }

  // ===== Firestore helpers =====
  const col = collection(db, 'inventory');

  function makeKey(item) {
    return [
      item.type || '',
      item.code ? item.code.toUpperCase() : '',
      item.color ? item.color.toUpperCase() : '',
      item.size ? String(item.size).toUpperCase() : '',
      item.fabric ? item.fabric.toUpperCase() : ''
    ].join('|');
  }

  async function getAll() {
    const snap = await getDocs(col);
    return snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, _key: data._key || d.id, ...data };
    });
  }

  async function getByKey(key) {
    const ref = doc(db, 'inventory', key);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  async function upsert(item) {
    const key = makeKey(item);
    await setDoc(doc(db, 'inventory', key), { ...item, _key: key }, { merge: true });
  }

  async function deleteByKey(key) {
    await deleteDoc(doc(db, 'inventory', key));
  }

  // ===== Add (Import) — via form submit =====
  if (importForm) {
    importForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const type   = productType?.value;
      const code   = normalizeDigits((codeInput?.value || '').trim()).toUpperCase();
      const color  = (colorInput?.value || '').toUpperCase();
      const size   = normalizeSize(sizeInput?.value || '');
      const qty    = Number(normalizeDigits(qtyInput?.value || 0));
      const notes  = (notesInput?.value || '').trim();
      const fabric = (fabricInput?.value || '').toUpperCase();

      if (!type || qty <= 0 || !isValidSize(size)) {
        alert('Please enter a valid Type, Size (M..6XL or 2..60), and Quantity > 0.');
        return;
      }

      await mergeAndAdd({ type, code, color, size, fabric, qty, notes });
      toast('Added to inventory ✅');
      importForm.reset();
      if (sizeInput) sizeInput.value = ''; // لو كانت اتطبّعت
    });
  }

  async function mergeAndAdd(item) {
    const key = makeKey(item);
    const existing = await getByKey(key);
    const qty = (existing ? Number(existing.qty) : 0) + Number(item.qty || 0);

    await upsert({
      ...existing,
      ...item,
      _key: key,
      qty,
      addedAt: existing?.addedAt || new Date().toISOString()
    });
  }

  // ===== Export (Subtract) — via form submit =====
  if (exportForm) {
    exportForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const type   = productType?.value;
      const code   = normalizeDigits((codeInput?.value || '').trim()).toUpperCase();
      const color  = (colorInput?.value || '').toUpperCase();
      const size   = normalizeSize(sizeInput?.value || '');
      const qty    = Number(normalizeDigits(qtyInput?.value || 0));
      const notes  = (notesInput?.value || '').trim();
      const fabric = (fabricInput?.value || '').toUpperCase();

      if (!type || qty <= 0 || !isValidSize(size)) {
        alert('Enter valid Type, Quantity and Size (M..6XL or 2..60).');
        return;
      }

      const ok = await subtractFromInventory({ type, code, color, size, fabric, qty, notes });
      if (ok) {
        toast('Quantity deducted ✅');
        exportForm.reset();
        if (sizeInput) sizeInput.value = '';
      }
    });
  }

  async function subtractFromInventory(item) {
    const key = makeKey(item);
    const existing = await getByKey(key);
    if (!existing) { alert('Item not found in inventory. Make sure Fabric matches too.'); return false; }

    const have = Number(existing.qty);
    const need = Number(item.qty);
    if (need > have) { alert(`Insufficient quantity. Available: ${have}`); return false; }

    const left = have - need;
    if (left <= 0) await deleteByKey(key);
    else await updateDoc(doc(db, 'inventory', key), { qty: left });

    return true;
  }

  // ===== Filters (inventory.html) =====
  let currentFilter = '';
  let currentFabric = '';

  if (typeWrap) {
    typeWrap.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.getAttribute('data-filter') || '';
        typeWrap.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderInventory();
      });
    });
  }
  if (fabricFilter) {
    fabricFilter.addEventListener('change', () => {
      currentFabric = (fabricFilter.value || '').toUpperCase();
      renderInventory();
    });
  }

  // ===== Render inventory (inventory.html) =====
  async function renderInventory() {
    if (!inventoryList) return;

    let all = await getAll();
    const sort = sortSelect?.value || '';
    if (sort === 'date') {
      all.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
    } else if (sort === 'type') {
      all.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    } else if (sort === 'size') {
      // يجعل الأحجام الرقمية تتفرز صح قبل الحروف
      const rank = s => {
        const n = Number(s);
        return Number.isFinite(n) ? n : 1000 + String(s).charCodeAt(0);
      };
      all.sort((a, b) => rank(a.size) - rank(b.size));
    }

    const filtered = all.filter(it => {
      const typeOK   = !currentFilter || it.type === currentFilter;
      const fabricOK = !currentFabric || (it.fabric || '').toUpperCase() === currentFabric;
      return typeOK && fabricOK;
    });

    if (filtered.length === 0) {
      inventoryList.innerHTML = `<p>${(currentFilter || currentFabric) ? 
        'No items for this filter.' : 'Inventory is empty.'}</p>`;
      return;
    }

    inventoryList.innerHTML = '';
    filtered.forEach(it => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div class="meta">
          <strong>${it.type} — ${it.code || ''} — ${it.color || ''} — ${it.size || ''}</strong>
          <small>Qty: ${Number(it.qty)}${it.notes ? ' • ' + it.notes : ''}${it.fabric ? ' • ' + it.fabric : ''}</small>
        </div>
        <div class="actions">
          <button class="muted"  data-action="dec" data-key="${it._key || it.id}">-1</button>
          <button class="muted"  data-action="inc" data-key="${it._key || it.id}">+1</button>
          <button class="danger" data-action="del" data-key="${it._key || it.id}">Delete</button>
        </div>
      `;
      inventoryList.appendChild(div);
    });

    inventoryList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const key    = btn.getAttribute('data-key');
        if (!key) return;

        const item = (await getAll()).find(x => (x._key || x.id) === key);
        if (!item) return;

        if (action === 'inc') {
          await updateDoc(doc(db, 'inventory', key), { qty: Number(item.qty) + 1 });
        } else if (action === 'dec') {
          const left = Math.max(0, Number(item.qty) - 1);
          if (left === 0) await deleteByKey(key);
          else await updateDoc(doc(db, 'inventory', key), { qty: left });
        } else if (action === 'del') {
          await deleteByKey(key);
        }
        renderInventory();
      });
    });
  }

  if (inventoryList) {
    if (sortSelect) sortSelect.addEventListener('change', renderInventory);
    renderInventory();
  }

  // ===== Export CSV =====
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', async () => {
      const inv = await getAll();
      if (inv.length === 0) { alert('No data to export.'); return; }
      const header = ['type','code','color','size','fabric','qty','notes','addedAt'];
      const rows = inv.map(i => header.map(h => (i[h] ?? '').toString().replace(/"/g, '""')));
      const csv = [header.join(',')].concat(rows.map(r => '"' + r.join('","') + '"')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'inventory_export.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // ===== Clear All from cloud =====
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (!confirm('Clear ALL inventory from cloud?')) return;
      const all = await getAll();
      await Promise.all(all.map(x => deleteByKey(x._key || x.id)));
      renderInventory();
      alert('Inventory cleared.');
    });
  }

  // ===== Toast (fixed) =====
  function toast(msg){
    const root = document.getElementById('notifyRoot');
    if(!root) return;
    root.innerHTML = `
      <div class="notify-badge"><span class="msg">${msg}</span></div>
    `;
    root.classList.add('show');
    setTimeout(()=>root.classList.remove('show'), 1200);
  }
});
