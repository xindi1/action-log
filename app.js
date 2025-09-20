// app.js — Action Log (mobile-optimized)

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

  // State
  let rows = [];

  // ---------- Utils ----------
  const pad = (n) => String(n).padStart(2, '0');

  // Create a local datetime string suitable for input[type=datetime-local]
  const toLocalInput = (d) => {
    const tz = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tz * 60000);
    return local.toISOString().slice(0, 16);
  };

  const diffMinutes = (a, b) =>
    !a || !b ? null : Math.round((new Date(b) - new Date(a)) / 60000);

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>`"']/g, (c) =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
    );

  // Remove a leading emoji from the label for compact table/CSV
  const stripEmoji = (label) => String(label ?? '').replace(/^\p{Extended_Pictographic}+\s*/u, '').trim();

  // Compact date/time for table display (e.g., "Sep 16 19:15")
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

  const saveRows = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  const loadRows = () => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) rows = JSON.parse(s); } catch {}
  };

  // ---------- Rendering ----------
  function render() {
    tblBody.innerHTML = rows.map((r, i) => `
      <tr>
        <td title="${i+1}">${i + 1}</td>
        <td title="${escapeHtml(r.start)}">${escapeHtml(fmtShort(r.start))}</td>
        <td title="${escapeHtml(r.stop)}">${escapeHtml(fmtShort(r.stop))}</td>
        <td title="${r.minutes}">${r.minutes}</td>
        <td title="${escapeHtml(r.action)}">${escapeHtml(stripEmoji(r.action))}</td>
        <td>
          ${r.comment ? `<button class="view-btn" data-full="${escapeHtml(r.comment)}">View</button>` : ''}
        </td>
      </tr>
    `).join('');
  }

  // ---------- Form Actions ----------
  function clearForm() {
    // Keep start prefilled for convenience
    stopEl.value = '';
    actionEl.value = '';
    commentEl.value = '';
    startEl.focus();
  }

  function addRow() {
    const s = startEl.value.trim();
    const e = stopEl.value.trim();
    const act = actionEl.value.trim();
    const c = commentEl.value;

    if (!s || !e) { alert('Please set both start and stop times.'); return; }
    const mins = diffMinutes(s, e);
    if (mins == null || mins < 0) { alert('Stop must be after Start.'); return; }
    if (!act) { alert('Please choose an action.'); return; }

    rows.push({ start: s, stop: e, minutes: mins, action: act, comment: c });
    saveRows();
    render();
    clearForm();
  }

  function adjustLength(delta) {
    if (!startEl.value) { alert('Set a start time first.'); return; }
    const s = new Date(startEl.value);
    const stop = new Date(s.getTime() + delta * 60000);
    stopEl.value = toLocalInput(stop);
  }

  function toggleEntries() {
    const willShow = entriesCard.style.display === 'none';
    entriesCard.style.display = willShow ? '' : 'none';
    toggleBtn.textContent = willShow ? 'Hide Entries' : 'Show Entries';
    localStorage.setItem(SHOW_KEY, willShow ? '1' : '0');
  }

  // ---------- Export / Share ----------
  function toCSV() {
    const header = ['start','stop','length_minutes','action','comment'];
    const body = rows.map(r => [
      r.start, r.stop, r.minutes, stripEmoji(r.action ?? ''), r.comment ?? ''
    ]);
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
    const a = document.createElement('a');
    a.href = url; a.download = filename('actionlog'); document.body.appendChild(a);
    a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareEntries() {
    if (!rows.length) { alert('No entries to share.'); return; }
    const blob = new Blob([toCSV()], { type:'text/csv' });
    const name = filename('actionlog');

    if (navigator.canShare && navigator.canShare({ files:[new File([blob], name, { type:'text/csv' })] })) {
      try {
        await navigator.share({ title:'Action Log', files:[new File([blob], name, { type:'text/csv' })] });
        return;
      } catch(e){ /* fallback to download */ }
    }
    exportCSV();
  }

  function clearAll() {
    if (!rows.length) return;
    if (confirm('Delete ALL entries?')) {
      rows = [];
      saveRows();
      render();
    }
  }

  // ---------- Comment Dialog ----------
  let dialog;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'commentDialog';
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
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    const full = btn.getAttribute('data-full') || '';
    const dlg = ensureDialog();
    dlg.querySelector('#commentContent').textContent = full;
    try { dlg.showModal(); } catch { dlg.show(); }
  });

  // ---------- Events / Init ----------
  // Prefill start with "now" local time
  if (!startEl.value) startEl.value = toLocalInput(new Date());

  // Persist show/hide state
  const savedShow = localStorage.getItem(SHOW_KEY);
  entriesCard.style.display = savedShow === '1' ? '' : 'none';
  toggleBtn.textContent = savedShow === '1' ? 'Hide Entries' : 'Show Entries';

  // Load & render any existing rows
  loadRows();
  render();

  // Bind UI events
  btnSave.addEventListener('click', addRow);
  btnClear.addEventListener('click', clearForm);
  btnExport.addEventListener('click', exportCSV);
  btnShare.addEventListener('click', shareEntries);
  btnClearAll.addEventListener('click', clearAll);
  toggleBtn.addEventListener('click', toggleEntries);
  document.querySelectorAll('.chip').forEach(chip =>
    chip.addEventListener('click', () => adjustLength(+chip.dataset.min))
  );

  // Hotkeys: Ctrl/Cmd+Enter save, Ctrl/Cmd+E export
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addRow(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); exportCSV(); }
  });

  // Optional PWA service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }

  // Expose for console/testing (optional)
  window._actionlog = { rows, render };
})();
