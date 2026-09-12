/* Browser IIFE: register layout-elk built from vendored TypeScript source. */
import layouts from '../../packages/mermaid-vendor/mermaid-layout-elk/src/layouts.ts';

function register() {
  const m = globalThis.mermaid;
  if (!m || typeof m.registerLayoutLoaders !== 'function') {
    console.warn('[layout-elk] mermaid.registerLayoutLoaders missing');
    return false;
  }
  try {
    m.registerLayoutLoaders(layouts);
  } catch (e) {
    console.warn('[layout-elk] registerLayoutLoaders failed', e);
    return false;
  }
  globalThis.mermaidLayoutElk = layouts;
  globalThis.__drawerLayoutElkReady = true;
  return true;
}

if (!register()) {
  setTimeout(register, 0);
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  }
}
export { layouts, register };
