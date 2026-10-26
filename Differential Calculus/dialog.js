// In-page confirm dialog that replaces the browser's system pop-up and follows the page theme.
// askConfirm({ title, message, confirmLabel, cancelLabel }) resolves to true (confirm) or false (cancel).
// The confirm button uses window.dialogAccent, which each page sets to its own accent colour.
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .cdlg-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgb(0 0 0 / .55); animation: cdlg-fade .15s ease-out; }
    .cdlg { width: 100%; max-width: 26rem; background: var(--card); color: var(--foreground); border: 1px solid var(--border);
      border-radius: 1rem; padding: 1.25rem 1.25rem 1rem; box-shadow: 0 20px 50px rgb(0 0 0 / .3); animation: cdlg-pop .15s ease-out; }
    .cdlg h2 { font-size: 1rem; font-weight: 700; margin: 0 0 .4rem; }
    .cdlg p { font-size: .875rem; line-height: 1.55; color: var(--muted-foreground); margin: 0; }
    .cdlg-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1.1rem; }
    .cdlg-actions button { font-size: .8125rem; font-weight: 600; padding: .55rem 1rem; border-radius: .75rem; transition: filter .15s, background .15s; }
    .cdlg-cancel { border: 1px solid var(--border); background: transparent; color: var(--foreground); }
    .cdlg-cancel:hover { background: color-mix(in srgb, var(--border) 40%, transparent); }
    .cdlg-ok { border: 1px solid transparent; color: #fff; }
    .cdlg-ok:hover { filter: brightness(1.1); }
    .cdlg-actions button:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }
    @keyframes cdlg-fade { from { opacity: 0; } }
    @keyframes cdlg-pop { from { opacity: 0; transform: translateY(6px) scale(.98); } }
  `;
  document.head.appendChild(style);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  window.askConfirm = function ({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel' }) {
    return new Promise(resolve => {
      const opener = document.activeElement;
      const backdrop = document.createElement('div');
      backdrop.className = 'cdlg-backdrop';
      backdrop.innerHTML = `
        <div class="cdlg" role="dialog" aria-modal="true" aria-labelledby="cdlg-title" aria-describedby="cdlg-msg">
          <h2 id="cdlg-title">${esc(title)}</h2>
          <p id="cdlg-msg">${esc(message)}</p>
          <div class="cdlg-actions">
            <button type="button" class="cdlg-cancel">${esc(cancelLabel)}</button>
            <button type="button" class="cdlg-ok" style="background:${window.dialogAccent || '#2563eb'}">${esc(confirmLabel)}</button>
          </div>
        </div>`;
      const ok = backdrop.querySelector('.cdlg-ok');
      const cancel = backdrop.querySelector('.cdlg-cancel');

      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        backdrop.remove();
        if (opener && opener.focus) opener.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === ok ? cancel : ok).focus(); }
      }

      ok.addEventListener('click', () => close(true));
      cancel.addEventListener('click', () => close(false));
      backdrop.addEventListener('click', e => { if (e.target === backdrop) close(false); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(backdrop);
      ok.focus();
    });
  };
})();
