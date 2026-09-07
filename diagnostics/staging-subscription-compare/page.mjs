import { compareCurrentSubscription, ORIGIN, RESULT } from './subscription-compare.mjs';
const button = document.getElementById('compare');
const output = document.getElementById('result');
if (location.origin === ORIGIN) {
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Comparing…';
    const result = await compareCurrentSubscription();
    output.textContent = Object.entries(result).map(([key, value]) => `${key} = ${value}`).join('\n');
    button.textContent = 'Comparison complete';
  }, { once: true });
} else {
  output.textContent = `${RESULT} = unverifiable`;
}
