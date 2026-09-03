import test from 'node:test';
import assert from 'node:assert/strict';

function norm(s) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokensMatch(hay, needle) {
  const h = ` ${norm(hay)} `;
  const n = norm(needle);
  if (!n) return false;
  if (n.length <= 3) {
    return h.includes(` ${n} `) || h.includes(` ${n}-`) || h.includes(`-${n} `) || h.endsWith(` ${n} `);
  }
  return norm(hay).includes(n);
}

test('short queries use word boundaries so ACE does not match Wallaceburg', () => {
  assert.equal(tokensMatch('ACE / JCB, Harriston', 'ACE'), true);
  assert.equal(tokensMatch('Lambton Conveyor Ltd., Wallaceburg', 'ACE'), false);
});

test('booth numbers match', () => {
  assert.equal(tokensMatch('1A-09', '1A-09'), true);
  assert.equal(tokensMatch('1A-09', '1a-09'), true);
});

test('vendor names match beyond three letters', () => {
  assert.equal(tokensMatch('GGS Structures Inc., Vineland Station', 'GGS Structures'), true);
});
