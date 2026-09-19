import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const module = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(new URL('../src/services/tutorialCueLayout.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(module.exports);
const { placeTutorialCue } = module.exports;
const overlap = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
const size = {width:112,height:34};
for (const side of ['above','below','left','right']) test(`pointer selects ${side} when that is the available space`, () => {
 const safe={x:12,y:32,width:296,height:500};
 const target={above:{x:12,y:400,width:296,height:120},below:{x:12,y:32,width:296,height:120},left:{x:220,y:32,width:88,height:500},right:{x:12,y:32,width:88,height:500}}[side];
 const cue=placeTutorialCue(target,safe,{x:1000,y:1000,width:1,height:1},size);
 assert.equal(cue.side,side); assert(!overlap(cue,target));
 if(side==='above'||side==='below') assert(cue.arrowX>=target.x&&cue.arrowX<=target.x+target.width);
 else assert(cue.arrowY>=target.y&&cue.arrowY<=target.y+target.height);
});
test('phone, tablet, desktop, safe areas, long text and moving targets avoid clipping and copy',()=>{
 for(const width of [320,390,430,768,1440]) for(const y of [140,200,350]) for(const height of [34,54]){
  const safe={x:24,y:47,width:width-48,height:700};const target={x:24,y,width:width-48,height:120};
  const card={x:24,y:y+132,width:Math.min(340,width-48),height:210};
  const cue=placeTutorialCue(target,safe,card,{width:112,height});assert(cue);
  assert(cue.x>=safe.x&&cue.y>=safe.y&&cue.x+cue.width<=safe.x+safe.width&&cue.y+cue.height<=safe.y+safe.height);
  assert(!overlap(cue,card));assert(!overlap(cue,target));assert.equal(cue.y+cue.height+16,target.y);
 }
});
test('requests a reserved strip instead of overlapping a card when there is no clear placement',()=>{
 assert.equal(placeTutorialCue({x:12,y:12,width:296,height:100},{x:12,y:12,width:296,height:400},{x:12,y:124,width:296,height:210},size),null);
});
