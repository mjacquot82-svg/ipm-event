import { readPixelSnapshot, STAGING_ORIGIN } from './pixel-diagnostic.mjs';
const button = document.getElementById('inspect');
const output = document.getElementById('result');
if (location.origin !== STAGING_ORIGIN) {
  output.textContent = 'STAGING_ONLY';
} else {
  button.disabled = false;
  output.textContent = 'Ready. Tap once to read this browser’s existing state.';
  button.addEventListener('click', async () => {
    button.disabled = true;
    output.textContent = 'Reading existing state…';
    try { output.textContent = JSON.stringify(await readPixelSnapshot(), null, 2); }
    catch { output.textContent = 'diagnostic_read_error_class=OTHER_ERROR'; }
  }, { once: true });
}
