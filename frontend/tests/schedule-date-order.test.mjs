import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import { compareScheduleDates, formatScheduleDate, getScheduleWeekday } from '../src/utils/scheduleDate.ts';

// Execute the actual screen's memo/callback bodies rather than duplicate its algorithms.
const source=fs.readFileSync(new URL('../app/(tabs)/schedule.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('schedule.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function implementation(name,bindings={}) {
 let expression;
 function visit(node) {
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name&&node.initializer&&ts.isCallExpression(node.initializer)) expression=node.initializer.arguments[0].getText(ast);
  if(ts.isFunctionDeclaration(node)&&node.name?.text===name) expression=node.getText(ast);
  ts.forEachChild(node,visit);
 }
 visit(ast);assert.ok(expression,name);
 const code=ts.transpileModule('const implementation = '+expression,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 return new Function(...Object.keys(bindings),code+';return implementation;')(...Object.values(bindings));
}
const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ordered=names.flatMap((day,i)=>[14,9].map(hour=>Object.freeze({id:day+hour,title:day+' '+hour,start_date:`2026-09-${20+i}`,start_time:hour===14?'2:00 PM':'9:00 AM',days_active:day,category:'Fixture',description:'',location_name:''})));
const events=Object.freeze([1,6,3,0,5,2,4].flatMap(i=>ordered.slice(i*2,i*2+2)));
const labels=implementation('getEventDayLabels',{getDateDayName:implementation('getDateDayName',{getScheduleWeekday}),normalizeDayName:implementation('normalizeDayName')});
const days=implementation('dayOptions',{events,getEventDayLabels:labels,compareScheduleDates})();
function filtered(selectedDay=null,extra={}) {return implementation('filteredEvents',{events,selectedDay,showFavoritesOnly:false,favorites:[],selectedCategory:null,searchQuery:'',getEventDayLabels:labels,...extra})();}
function sections(rows) {
 const grouped=implementation('filteredGroupedEvents',{filteredEvents:rows,formatDisplayDate:implementation('formatDisplayDate',{formatScheduleDate}),parseTime:implementation('parseTime')})();
 return implementation('scheduleSections',{filteredGroupedEvents:grouped,compareScheduleDates})();
}
for(let i=0;i<6;i++)test(names[i]+' precedes '+names[i+1],()=>assert.ok(days.indexOf(names[i])<days.indexOf(names[i+1])));
test('actual dates and section order ascend despite shuffled API input',()=>{
 assert.deepEqual(days,names);assert.deepEqual(sections(events).map(s=>s.data[0].start_date),names.map((_,i)=>`2026-09-${20+i}`));
});
test('date ordering spans weeks and years without rotating weekday names',()=>{
 const dates=['2027-01-03','2026-09-28','2026-09-24','2026-12-31','2026-09-27'];
 assert.deepEqual([...dates].sort(compareScheduleDates),['2026-09-24','2026-09-27','2026-09-28','2026-12-31','2027-01-03']);
 const rows=dates.map(start_date=>({start_date,days_active:''}));
 assert.deepEqual(implementation('dayOptions',{events:rows,getEventDayLabels:labels,compareScheduleDates})(),['Thursday','Sunday','Monday']);
 assert.ok(compareScheduleDates('2026-09-20','unknown')<0);assert.equal(compareScheduleDates('bad','unknown'),0);
});
test('events retain dates, identity and existing within-day chronological sort',()=>{
 for(const section of sections(events)) {
  assert.deepEqual(section.data.map(e=>e.start_time),['9:00 AM','2:00 PM']);
  for(const event of section.data){assert.ok(events.includes(event));assert.equal(section.title,formatScheduleDate(event.start_date,{weekday:'long',month:'long',day:'numeric'}));}
 }
 assert.equal(events[0],ordered[2]);
});
for(const name of ['Sunday','Monday'])test('selecting '+name+' retains only its events',()=>{
 const rows=filtered(name);assert.equal(rows.length,2);assert.ok(rows.every(e=>getScheduleWeekday(e.start_date)===name));
});
test('initial All days and toggle-off selection semantics remain intact',()=>{
 assert.match(source,/\[selectedDay, setSelectedDay\] = useState<string \| null>\(null\)/);
 assert.match(source,/setSelectedDay\(isActive \? null : day\)/);
 assert.deepEqual(filtered(),events);
});
test('favourites, category and search still compose with weekday selection',()=>{
 const favorites=Object.freeze(['Sunday9','Monday14']);
 assert.deepEqual(filtered('Sunday',{showFavoritesOnly:true,favorites}).map(e=>e.id),['Sunday9']);
 assert.deepEqual(filtered('Monday',{searchQuery:'14',selectedCategory:'Fixture'}).map(e=>e.id),['Monday14']);
 assert.deepEqual(favorites,['Sunday9','Monday14']);
});
