/* drawer-app/05-render-io.js — board copy helpers */
function exportStem(raw, fallback) {
  const stem = String(raw || '').replace(/[^\w\-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-._]+|[-._]+$/g, '');
  return stem.slice(0, 48) || fallback || 'diagram';
}
var copyTipTimer = 0;
function showCopyTip(msg) {
  var el = $('#copyTip');
  if (!el) return;
  el.textContent = msg || 'Copied successfully';
  el.hidden = false;
  if (copyTipTimer) clearTimeout(copyTipTimer);
  copyTipTimer = setTimeout(function() { el.hidden = true; }, 2000);
}
function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = String(text ?? '');
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } finally { ta.remove(); }
  return ok;
}
async function copyText(text, label) {
  const value = String(text ?? '');
  const fallback = () => copyTextFallback(value);
  let copied = false;
  try {
    copied = await Promise.race([
      navigator.clipboard.writeText(value).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), 200)),
    ]);
  } catch {
    copied = false;
  }
  if (!copied) copied = fallback();
  if (copied) {
    setStatus(`${label} copied`);
    showCopyTip('Copied successfully');
    return true;
  }
  setStatus(`Copy ${label} failed`, true);
  return false;
}
