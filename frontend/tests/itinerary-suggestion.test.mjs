import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSuggestionGate, nextSuggestion, SUGGESTION_COOLDOWN_MS } from '../src/services/itinerarySuggestionPolicy.ts';
function storage() { let raw=null; return {getItem:async()=>raw,setItem:async(k,v)=>{raw=v;}}; }
test('first addition is quiet; second offers once per session', async()=>{
 const gate=createSuggestionGate(storage(),()=>true);
 assert.equal(await gate(),false); assert.equal(await gate(),true); assert.equal(await gate(),false);
});
test('dismissal persists seven-day cooldown and two-show lifetime limit',async()=>{
 const s=storage();let now=1000;let gate=createSuggestionGate(s,()=>true,()=>now);
 await gate();assert.equal(await gate(),true);
 gate=createSuggestionGate(s,()=>true,()=>now);assert.equal(await gate(),false);
 now+=SUGGESTION_COOLDOWN_MS;assert.equal(await gate(),true);
 now+=SUGGESTION_COOLDOWN_MS;gate=createSuggestionGate(s,()=>true,()=>now);assert.equal(await gate(),false);
});
test('ineligible notification states suppress suggestions',async()=>{
 const s=storage(); let eligible=false;const gate=createSuggestionGate(s,()=>eligible);
 for(let i=0;i<6;i++)assert.equal(await gate(),false);
 eligible=true;assert.equal(await gate(),true);
});
test('concurrent additions show at most once',async()=>{
 const gate=createSuggestionGate(storage(),()=>true);
 assert.equal((await Promise.all(Array.from({length:8},()=>gate()))).filter(Boolean).length,1);
});
test('storage failure, invalid history and backwards clock fail quietly',async()=>{
 for(const raw of ['bad','{}','null','{"additions":2,"shows":-1,"lastShownAt":0}']) assert.equal(nextSuggestion(raw,10,true),null);
 const gate=createSuggestionGate({getItem:async()=>{throw Error('unavailable')},setItem:async()=>{}},()=>true);
 assert.equal(await gate(),false);
 assert.equal(nextSuggestion(JSON.stringify({additions:2,shows:1,lastShownAt:100}),50,true).show,false);
});
test('favorite save is independent; enrollment UI only mounts after explicit action',()=>{
 const schedule=readFileSync(new URL('../app/(tabs)/schedule.tsx',import.meta.url),'utf8');
 const component=readFileSync(new URL('../src/components/ItineraryNotificationSuggestion.tsx',import.meta.url),'utf8');
 const handler=schedule.match(/const handleToggleFavorite[\s\S]*?^  \};/m)[0];
 assert.ok(handler.indexOf('toggleFavorite(eventId)')<handler.indexOf('setSuccessfulAddition'));
 assert.doesNotMatch(handler,/permission|subscribe|await.*Suggestion/);
 assert.match(component,/Notification.permission === 'default'/);
 assert.match(component,/options \? <NotificationOptIn initiallyExpanded/);
 assert.doesNotMatch(component,/subscribeToNotifications|requestPermission|initializeWonderPush|ensureNotificationRegistration/);
 assert.match(schedule,/Removed from your itinerary/);
});
