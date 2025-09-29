// app.js — Action Log
window.APP_VERSION = "1.0.7";

(() => {
  const STORAGE_KEY = 'mal-v1';
  const SHOW_KEY = 'mal-show-entries';

  // Elements
  const $ = (s) => document.querySelector(s);
  const startEl   = $('#start');
  const stopEl    = $('#stop');
  const actionEl  = $('#action');
  const commentEl = $('#comment');

  const entriesCard = $('#entriesCard');
  const tblBody     = $('#tblBody');

  const btnSave     = $('#btnSave');
  const btnClear    = $('#btnClear');
  const btnExport   = $('#btnExport');
  const btnShare    = $('#btnShare');
  const btnClearAll = $('#btnClearAll');
  const toggleBtn   = $('#toggleEntries');

  let rows = [];

  // Utils
  const pad = (n) => String(n).padStart(2, '0');
  const toLocalInput = (d) => {
    const tz = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tz * 60000);
    return local.toISOString().slice(0, 16);
  };
  const diffMinutes = (a, b) =>
    !a || !b ? null : Math.round((new Date(b) - new Date(a)) / 60000);
  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>`"']/g, (c) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c])
    );
  const stripEmoji = (label) => String(label ?? '').replace(/^\p{Extended_Pictographic}+\s*/u, '').trim();
  const fmtShort = (dtStr) => {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleString(undefined, {
      month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false
    }).replace(',', '');
  };
  const filename = (prefix) => {
    const d = new Date();
    return `${prefix}_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.csv`;
  };

  const saveLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  const loadLocal = () => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) rows = JSON.parse(s); } catch {}
  };

  // Render
  function render() {
    tblBody.innerHTML = rows.map((r, i) => `
      <tr>
        <td title="${i+1}">${i + 1}</td>
        <td title="${escapeHtml(r.start)}">${escapeHtml(fmtShort(r.start))}</td>
        <td title="${escapeHtml(r.stop)}">${escapeHtml(fmtShort(r.stop))}</td>
        <td title="${r.minutes}">${r.minutes}</td>
        <td title="${escapeHtml(r.action)}">${escapeHtml(stripEmoji(r.action))}</td>
        <td>${r.comment ? `<button class="view-btn" data-full="${escapeHtml(r.comment)}">View</button>` : ''}</td>
      </tr>
    `).join('');
  }

  // Add row (forgiving: auto-fill times, swap if needed)
  function addRow() {
    let s = startEl.value.trim();
    let e = stopEl.value.trim();
    const act = actionEl.value.trim();
    const toLocal = (d) => toLocalInput(d);

    // Default both to NOW if neither set
    if (!s && !e) {
      const now = new Date();
      s = toLocal(now);
      e = s;
      startEl.value = s; stopEl.value = e;
    }
    // Mirror if one missing
    if (s && !e) { e = s; stopEl.value = e; }
    if (!s && e) { s = e; startEl.value = s; }

    if (!act) { alert('Please choose an Action.'); return; }

    let sD = new Date(s), eD = new Date(e);
    if (eD < sD) { [sD, eD] = [eD, sD]; startEl.value = toLocal(sD); stopEl.value = toLocal(eD); }
    const minutes = Math.round((eD - sD) / 60000);

    rows.push({ start: startEl.value, stop: stopEl.value, minutes, action: act, comment: commentEl.value });
    saveLocal();
    render();
    clearForm();
  }

  function clearForm() {
    stopEl.value = '';
    actionEl.value = '';
    commentEl.value = '';
    if (!startEl.value) startEl.value = toLocalInput(new Date());
    startEl.focus();
  }

  function adjustLength(delta) {
    if (!startEl.value) startEl.value = toLocalInput(new Date());
    const base = new Date(startEl.value);
    const stop = new Date(base.getTime() + delta * 60000);
    stopEl.value = toLocalInput(stop);
  }

  function toggleEntries() {
    const willShow = entriesCard.style.display === 'none';
    entriesCard.style.display = willShow ? '' : 'none';
    toggleBtn.textContent = willShow ? 'Hide Entries' : 'Show Entries';
    localStorage.setItem(SHOW_KEY, willShow ? '1' : '0');
  }

  // CSV / Share
  function toCSV() {
    const header = ['start','stop','length_minutes','action','comment'];
    const body = rows.map(r => [r.start, r.stop, r.minutes, stripEmoji(r.action ?? ''), r.comment ?? '']);
    const csvField = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    return [header, ...body].map(row => row.map(csvField).join(',')).join('\n');
  }
  function exportCSV() {
    if (!rows.length) { alert('No entries to export.'); return; }
    const blob = new Blob([toCSV()], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename('actionlog'); document.body.appendChild(a);
    a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function shareEntries() {
    if (!rows.length) { alert('No entries to share.'); return; }
    const blob = new Blob([toCSV()], { type:'text/csv' });
    const name = filename('actionlog');
    if (navigator.canShare && navigator.canShare({ files:[new File([blob], name, { type:'text/csv' })] })) {
      try { await navigator.share({ title:'Action Log', files:[new File([blob], name, { type:'text/csv' })] }); return; } catch {}
    }
    exportCSV();
  }
  function clearAll() {
    if (!rows.length) return;
    if (confirm('Delete ALL entries?')) { rows = []; saveLocal(); render(); }
  }

  // Comment dialog (lightweight)
  let dialog;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <div id="commentContent" style="white-space:pre-wrap;max-width:80vw;max-height:60vh;overflow:auto;margin:0 0 10px;"></div>
      <button id="closeDialog" class="btn-clear" style="width:100%;min-height:40px;border-radius:10px;">Close</button>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      const box = dialog.querySelector('#commentContent').getBoundingClientRect();
      const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      if (!inside) dialog.close();
    });
    return dialog;
  }
  tblBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-btn'); if (!btn) return;
    const full = btn.getAttribute('data-full') || '';
    const dlg = ensureDialog();
    dlg.querySelector('#commentContent').textContent = full;
    try { dlg.showModal(); } catch { dlg.show(); }
  });

  // Reset app cache (SW + caches)
  document.getElementById('resetCache')?.addEventListener('click', async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      alert('Cache cleared. The app will reload.');
      window.location.reload(true);
    } catch (e) {
      console.warn('Reset cache failed', e);
      window.location.reload(true);
    }
  });

  // Init
  if (!startEl.value) startEl.value = toLocalInput(new Date());
  const savedShow = localStorage.getItem(SHOW_KEY);
  entriesCard.style.display = savedShow === '1' ? '' : 'none';
  toggleBtn.textContent = savedShow === '1' ? 'Hide Entries' : 'Show Entries';

  loadLocal();
  render();

  // Bind
  btnSave.addEventListener('click', addRow);
  btnClear.addEventListener('click', clearForm);
  btnExport.addEventListener('click', exportCSV);
  btnShare.addEventListener('click', shareEntries);
  btnClearAll.addEventListener('click', clearAll);
  toggleBtn.addEventListener('click', toggleEntries);
  document.querySelectorAll('.chip').forEach(chip =>
    chip.addEventListener('click', () => adjustLength(+chip.dataset.min))
  );

  // Hotkeys
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addRow(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); exportCSV(); }
  });

  // Auto reload when a new SW takes control (helps updates)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  }
})();
