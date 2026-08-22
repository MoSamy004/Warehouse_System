let warehouses = [];
let entries = [];
let activeId = null;
let editingWarehouseId = null;
let confirmDeleteEntry = null;
let confirmDeleteWarehouse = false;
let globalSettings = { totalAmount: 0 };

const $ = (id) => document.getElementById(id);
const todayStr = () => new Date().toISOString().slice(0, 10);

async function api(path, options) {
  const res = await fetch('/api/' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  $('syncStatus').innerHTML = res.ok
    ? '<span class="dot" style="background:var(--green);"></span> متصل'
    : '<span class="dot" style="background:var(--red);"></span> في مشكلة اتصال';
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

async function loadAll() {
  try {
    const [w, e, s] = await Promise.all([api('warehouses'), api('entries'), api('settings')]);
    warehouses = w;
    entries = e;
    globalSettings = s;
    if (!activeId && warehouses.length) activeId = warehouses[0].id;
    if (activeId && !warehouses.find(x => x.id === activeId)) activeId = warehouses[0] ? warehouses[0].id : null;
    renderPicker();
    renderActivePanel();
    renderGlobalSummary();
  } catch (err) {
    console.error(err);
  }
}

function renderGlobalSummary() {
  const totalWithdrawn = entries.reduce((s, e) => s + e.weight, 0);
  const remaining = globalSettings.totalAmount - totalWithdrawn;
  $('globalTotalDisplay').textContent = globalSettings.totalAmount.toLocaleString();
  $('globalWithdrawnDisplay').textContent = totalWithdrawn.toLocaleString();
  $('globalRemainingDisplay').textContent = remaining.toLocaleString();
  $('globalRemainingDisplay').style.color = remaining < 0 ? '#F87171' : '#E8EAED';
}

$('editGlobalBtn').addEventListener('click', () => {
  $('globalTotalInput').value = globalSettings.totalAmount;
  $('globalModalBg').classList.remove('hidden');
});
$('closeGlobalModal').addEventListener('click', () => $('globalModalBg').classList.add('hidden'));
$('globalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const totalAmount = parseFloat($('globalTotalInput').value) || 0;
  await api('settings', { method: 'PUT', body: JSON.stringify({ totalAmount }) });
  $('globalModalBg').classList.add('hidden');
  loadAll();
});

loadAll();
setInterval(loadAll, 8000); // مزامنة كل 8 ثواني بين كل الأجهزة

// ---------- WAREHOUSE PICKER ----------
$('pickerBtn').addEventListener('click', () => $('pickerList').classList.toggle('hidden'));

function renderPicker() {
  const active = warehouses.find(w => w.id === activeId);
  $('pickerLabel').textContent = active ? active.name : 'اختار مخزن';
  const list = $('pickerList');
  list.innerHTML = '';
  warehouses.forEach(w => {
    const div = document.createElement('div');
    div.className = 'picker-item';
    div.innerHTML = `<span>${escapeHtml(w.name)}</span><span style="color:var(--muted);cursor:pointer;">✎</span>`;
    div.querySelector('span').addEventListener('click', () => { activeId = w.id; renderPicker(); renderActivePanel(); list.classList.add('hidden'); });
    div.querySelector('span:last-child').addEventListener('click', (e) => { e.stopPropagation(); openWarehouseModal(w); list.classList.add('hidden'); });
    list.appendChild(div);
  });
  const addDiv = document.createElement('div');
  addDiv.className = 'picker-item';
  addDiv.style.color = 'var(--accent)';
  addDiv.textContent = '+ إضافة مخزن جديد';
  addDiv.addEventListener('click', () => { openWarehouseModal(null); list.classList.add('hidden'); });
  list.appendChild(addDiv);
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ---------- WAREHOUSE MODAL ----------
function openWarehouseModal(w) {
  editingWarehouseId = w ? w.id : null;
  confirmDeleteWarehouse = false;
  $('warehouseModalTitle').textContent = w ? 'تعديل المخزن' : 'مخزن جديد';
  $('wName').value = w ? w.name : '';
  $('wCapacity').value = w ? w.capacity : '';
  $('wTaskName').value = w ? w.taskName || '' : '';
  $('wYellow').value = w ? w.thresholdYellow : 70;
  $('wRed').value = w ? w.thresholdRed : 90;
  $('deleteWarehouseBtn').classList.toggle('hidden', !w);
  $('deleteWarehouseBtn').textContent = 'حذف المخزن';
  $('warehouseModalBg').classList.remove('hidden');
}
$('closeWarehouseModal').addEventListener('click', () => $('warehouseModalBg').classList.add('hidden'));
$('editWarehouseBtn').addEventListener('click', () => {
  const active = warehouses.find(w => w.id === activeId);
  if (active) openWarehouseModal(active);
});

$('warehouseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: $('wName').value.trim(),
    capacity: parseFloat($('wCapacity').value),
    taskName: $('wTaskName').value.trim(),
    thresholdYellow: parseFloat($('wYellow').value) || 70,
    thresholdRed: parseFloat($('wRed').value) || 90
  };
  if (!data.name || isNaN(data.capacity)) return;
  if (editingWarehouseId) {
    await api('warehouses?id=' + editingWarehouseId, { method: 'PUT', body: JSON.stringify(data) });
  } else {
    const created = await api('warehouses', { method: 'POST', body: JSON.stringify(data) });
    activeId = created.id;
  }
  $('warehouseModalBg').classList.add('hidden');
  loadAll();
});

$('deleteWarehouseBtn').addEventListener('click', async () => {
  if (!confirmDeleteWarehouse) {
    confirmDeleteWarehouse = true;
    $('deleteWarehouseBtn').textContent = 'تأكيد الحذف نهائيا';
    return;
  }
  await api('warehouses?id=' + editingWarehouseId, { method: 'DELETE' });
  if (activeId === editingWarehouseId) activeId = null;
  $('warehouseModalBg').classList.add('hidden');
  loadAll();
});

// ---------- ENTRY FORM ----------
$('entryDate').value = todayStr();
$('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('entryError').textContent = '';
  const active = warehouses.find(w => w.id === activeId);
  if (!active) return;
  const truck = $('entryTruck').value.trim();
  const weight = parseFloat($('entryWeight').value);
  if (!truck || isNaN(weight) || weight <= 0) {
    $('entryError').textContent = 'اكتب رقم العربية والوزن (أكبر من صفر)';
    return;
  }
  await api('entries', {
    method: 'POST',
    body: JSON.stringify({
      warehouseId: activeId,
      date: $('entryDate').value,
      truck,
      vessel: $('entryVessel').value.trim(),
      weight,
      taskName: active.taskName || ''
    })
  });
  $('entryTruck').value = '';
  $('entryVessel').value = '';
  $('entryWeight').value = '';
  $('entryDate').value = todayStr();
  loadAll();
});

// ---------- RENDER PANEL ----------
function renderActivePanel() {
  const active = warehouses.find(w => w.id === activeId);
  $('noWarehouse').classList.toggle('hidden', !!active || warehouses.length > 0);
  $('warehousePanel').classList.toggle('hidden', !active);
  if (!active) return;

  const activeEntries = entries.filter(e => e.warehouseId === active.id).sort((a, b) => a.date < b.date ? 1 : -1);
  const totalUsed = entries.filter(e => e.warehouseId === active.id).reduce((s, e) => s + e.weight, 0);
  const remaining = active.capacity - totalUsed;
  const pct = active.capacity > 0 ? Math.min(100, (totalUsed / active.capacity) * 100) : 0;

  let color = '#34D399';
  if (pct >= active.thresholdRed) color = '#F87171';
  else if (pct >= active.thresholdYellow) color = '#FBBF24';

  $('taskNameDisplay').textContent = active.taskName || '—';
  $('capacityDisplay').textContent = active.capacity.toLocaleString();
  $('remainingDisplay').textContent = remaining.toLocaleString();
  $('remainingDisplay').style.color = remaining < 0 ? '#F87171' : '#E8EAED';
  $('pctDisplay').textContent = pct.toFixed(0) + '%';
  $('pctDisplay').style.color = color;
  $('warnDisplay').classList.toggle('hidden', pct < active.thresholdRed);

  const fillHeight = 108 * (pct / 100);
  $('gaugeFill').setAttribute('y', 6 + (108 - fillHeight));
  $('gaugeFill').setAttribute('height', fillHeight);
  $('gaugeFill').setAttribute('fill', color);

  const body = $('entriesBody');
  body.innerHTML = '';
  if (activeEntries.length === 0) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">لسه مفيش سجلات</td></tr>';
  } else {
    activeEntries.forEach((e, i) => {
      const tr = document.createElement('tr');
      const delCell = confirmDeleteEntry === e.id
        ? `<span style="color:var(--red);font-size:12px;cursor:pointer;" data-confirm="${e.id}">تأكيد الحذف</span>`
        : `<span style="color:var(--muted);cursor:pointer;" data-del="${e.id}">🗑</span>`;
      tr.innerHTML = `<td>${activeEntries.length - i}</td><td class="mono">${e.date}</td><td>${escapeHtml(e.truck)}</td><td>${escapeHtml(e.vessel || '')}</td><td class="mono">${e.weight.toLocaleString()}</td><td>${delCell}</td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', () => { confirmDeleteEntry = el.getAttribute('data-del'); renderActivePanel(); }));
    body.querySelectorAll('[data-confirm]').forEach(el => el.addEventListener('click', async () => {
      await api('entries?id=' + el.getAttribute('data-confirm'), { method: 'DELETE' });
      confirmDeleteEntry = null;
      loadAll();
    }));
  }
}

// ---------- EXPORT ----------
function buildSheetRows(warehouseId) {
  return entries.filter(e => e.warehouseId === warehouseId).map((e, i) => ({
    'Id': i + 1, 'Vessel': e.vessel, 'Task name': e.taskName, 'Date': e.date, 'Truck number': e.truck, 'Weight': e.weight
  }));
}

$('exportOneBtn').addEventListener('click', () => {
  const active = warehouses.find(w => w.id === activeId);
  if (!active) return;
  const rows = buildSheetRows(active.id);
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (active.name || 'مخزن').slice(0, 31));
  XLSX.writeFile(wb, `${active.name || 'مخزن'}.xlsx`);
});

$('exportAllBtn').addEventListener('click', () => {
  const wb = XLSX.utils.book_new();
  warehouses.forEach(w => {
    const rows = buildSheetRows(w.id);
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, (w.name || 'مخزن').slice(0, 31));
  });
  XLSX.writeFile(wb, 'كل_المخازن.xlsx');
});
