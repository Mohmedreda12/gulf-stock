// common.js (type: module) — يعمل مع Supabase
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM refs =====
  const importForm   = document.getElementById('importForm');
  const exportForm   = document.getElementById('exportForm');

  const productType  = document.getElementById('productType');
  const sizeInput    = document.getElementById('size');
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

  // ===== Helpers: digits + size =====
  const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;
  function normalizeDigits(str = '') {
    return String(str).replace(ARABIC_DIGITS, d =>
      String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d) % 10)
    );
  }

  const ALLOWED_SIZES = new Set(['M','L','XL','2XL','3XL','4XL','5XL','6XL']);
  for (let i = 2; i <= 60; i++) ALLOWED_SIZES.add(String(i));

  function normalizeSize(raw) {
    if (!raw) return '';
    let s = normalizeDigits(raw).trim().toUpperCase().replace(/\s+/g, '');
    if (s === 'X' || s === 'XLARGE') s = 'XL';
    if (s === 'SMALL') s = 'M';
    return s;
  }
  function isValidSize(raw) { return ALLOWED_SIZES.has(normalizeSize(raw)); }

  // live mark
  if (sizeInput) {
    const mark = ok => { sizeInput.style.borderColor = ok ? '#28a745' : '#b22222'; };
    const upd = () => mark(isValidSize(sizeInput.value));
    sizeInput.addEventListener('input', upd);
    sizeInput.addEventListener('blur', () => {
      const n = normalizeSize(sizeInput.value);
      if (ALLOWED_SIZES.has(n)) sizeInput.value = n;
      upd();
    });
  }

  // ===== Supabase helpers (بديل Firestore) =====
  function makeKey(item) {
    return [
      item.type || '',
      item.code ? item.code.toUpperCase() : '',
      item.color ? item.color.toUpperCase() : '',
      item.size ? String(item.size).toUpperCase() : '',
      item.fabric ? item.fabric.toUpperCase() : '',
    ].join('|');
  }

  async function getAll() {
    const { data, error } = await supabase.from('inventory').select('*');
    if (error) { console.error('getAll:', error.message); return []; }
    return (data || []).map(d => ({ _key: d._key || makeKey(d), ...d }));
  }

  async function getByKey(key) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('_key', key)
      .maybeSingle();
    if (error) { console.error('getByKey:', error.message); return null; }
    return data || null;
  }

  async function upsert(item) {
    const key = makeKey(item);
    const payload = { ...item, _key: key };
    const { error } = await supabase
      .from('inventory')
      .upsert(payload, { onConflict: '_key' });
    if (error) throw new Error(error.message);
  }

  async function deleteByKey(key) {
    const { error } = await supabase.from('inventory').delete().eq('_key', key);
    if (error) throw new Error(error.message);
  }

  async function updateQtyByKey(key, qty) {
    const { error } = await supabase.from('inventory').update({ qty }).eq('_key', key);
    if (error) throw new Error(error.message);
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
      addedat: existing?.addedat || new Date().toISOString(),
    });
  }

  async function subtractFromInventory(item) {
    const key = makeKey(item);
    const existing = await getByKey(key);
    if (!existing) { alert('Item not found. (Check Fabric/Size/Color/Code)'); return false; }

    const have = Number(existing.qty);
    const need = Number(item.qty);
    if (need > have) { alert(`Insufficient quantity. Available: ${have}`); return false; }

    const left = have - need;
    if (left <= 0) await deleteByKey(key);
    else await updateQtyByKey(key, left);
    return true;
  }

  // ===== Add (Import) =====
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
        alert('Please enter valid Type, Size (M..6XL or 2..60) and Quantity > 0.');
        return;
      }

      try {
        await mergeAndAdd({ type, code, color, size, fabric, qty, notes });
        toast('Added to inventory ✅');
        importForm.reset();
        if (sizeInput) sizeInput.value = '';
      } catch (err) {
        console.error('ADD failed:', err);
        alert('ADD failed: ' + (err?.message || err));
      }
    });
  }

  // ===== Export (Subtract) =====
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

      if (qty <= 0 || !isValidSize(size)) {
        alert('Enter valid Quantity and Size (M..6XL or 2..60).');
        return;
      }

      try {
        const ok = await subtractFromInventory({ type, code, color, size, fabric, qty, notes });
        if (ok) {
          toast('Quantity deducted ✅');
          exportForm.reset();
          if (sizeInput) sizeInput.value = '';
        }
      } catch (err) {
        console.error('DEDUCT failed:', err);
        alert('DEDUCT failed: ' + (err?.message || err));
      }
    });
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

  // ===== Render inventory =====
  async function renderInventory() {
    if (!inventoryList) return;
    let all = await getAll();

    const sort = sortSelect?.value || '';
    if (sort === 'date') {
      all.sort((a, b) => new Date(b.addedat || 0) - new Date(a.addedat || 0));
    } else if (sort === 'type') {
      all.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    } else if (sort === 'size') {
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
      inventoryList.innerHTML = `<p>${(currentFilter || currentFabric) ? 'No items for this filter.' 
        : 'Inventory is empty.'}</p>`;
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
          <button class="muted"  data-action="dec" data-key="${it._key}">-1</button>
          <button class="muted"  data-action="inc" data-key="${it._key}">+1</button>
          <button class="danger" data-action="del" data-key="${it._key}">Delete</button>
        </div>
      `;
      inventoryList.appendChild(div);
    });

    inventoryList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const key    = btn.getAttribute('data-key');
        if (!key) return;

        const item = (await getAll()).find(x => (x._key) === key);
        if (!item) return;

        if (action === 'inc') {
          await updateQtyByKey(key, Number(item.qty) + 1);
        } else if (action === 'dec') {
          const left = Math.max(0, Number(item.qty) - 1);
          if (left === 0) await deleteByKey(key);
          else await updateQtyByKey(key, left);
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
      const header = ['type','code','color','size','fabric','qty','notes','addedat'];
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

  // ===== Clear All =====
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (!confirm('Clear ALL inventory from cloud?')) return;
      const all = await getAll();
      await Promise.all(all.map(x => deleteByKey(x._key)));
      renderInventory();
      alert('Inventory cleared.');
    });
  }

  // ===== Toast =====
  function toast(msg){
    const root = document.getElementById('notifyRoot');
    if(!root) return;
    root.innerHTML = `
      <div class="notify-badge"><span class="msg">${msg}</span></div>
    `;
    root.classList.add('show');
    setTimeout(() => root.classList.remove('show'), 1200);
  }
});
