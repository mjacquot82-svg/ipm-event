import assert from 'node:assert/strict';
const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
export async function assertNoClickCue(page) {
  assert.equal(await page.getByTestId('tutorial-click-cue').count(),0);
}
export async function assertClickCue(page, targetID) {
  const cue=page.getByTestId('tutorial-click-cue');await cue.waitFor();await page.waitForTimeout(300);
  assert.equal(await cue.innerText(),'Click here');
  const target=page.getByTestId(targetID), arrow=page.locator('[data-testid^="tutorial-click-arrow-"]');
  const [c,t,a,card]=await Promise.all([cue.boundingBox(),target.boundingBox(),arrow.boundingBox(),page.getByTestId('map-education-card').boundingBox()]);
  assert(c&&t&&a&&card);const viewport=page.viewportSize();
  assert(c.x>=0&&c.y>=0&&c.x+c.width<=viewport.width&&c.y+c.height<=viewport.height,'cue fits viewport');
  assert(!overlaps(c,t),'cue does not obscure target');assert(!overlaps(c,card),'cue does not obscure tutorial text');
  const side=(await arrow.getAttribute('data-testid')).replace('tutorial-click-arrow-','');
  if(side==='above'||side==='below') {
    const tipX=a.x+a.width/2,tipY=side==='above'?a.y+a.height:a.y;
    assert(tipX>=t.x&&tipX<=t.x+t.width,'arrow points within target width');
    assert(Math.abs(tipY-(side==='above'?t.y-6:t.y+t.height+6))<2,'arrow tip tracks target edge');
  } else {
    const tipY=a.y+a.height/2,tipX=side==='left'?a.x+a.width:a.x;
    assert(tipY>=t.y&&tipY<=t.y+t.height,'arrow points within target height');
    assert(Math.abs(tipX-(side==='left'?t.x-6:t.x+t.width+6))<2,'arrow tip tracks target edge');
  }
  assert.equal(await cue.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  assert.equal(await cue.evaluate(el=>getComputedStyle(el).animationName),'none','cue does not flash or pulse');
  assert(await cue.evaluate(el=>Boolean(el.closest('[aria-hidden="true"]'))),'supplemental cue hidden from screen readers');
  assert.equal(await target.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}),true,'required target receives the tap');
}
