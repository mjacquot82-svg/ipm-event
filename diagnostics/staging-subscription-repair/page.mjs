import { repairExistingSubscription } from './subscription-repair.mjs';
const button = document.getElementById('repair');
const output = document.getElementById('result');
if (location.origin === 'https://staging.theipm.ca') {
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Reconciling…';
    const result = await repairExistingSubscription();
    output.textContent = Object.entries(result).map(([key, value]) => `${key} = ${value}`).join('\n');
    button.textContent = 'Finished — do not retry';
  }, { once: true });
}
