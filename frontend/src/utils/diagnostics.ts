import type React from 'react';
const STORAGE_KEY = 'ipm_diagnostics_v1';
const MAX_EVENTS = 25;
export type DiagnosticEvent = { timestamp:string; pathname:string; queryKeys:string[]; historyMarker:boolean|null; modalOpen:boolean|null; selectedEvent:'present'|'absent'|'unknown'; action?:string; source?:string; routerPathBefore?:string; routerPathAfter?:string; historyLength?:number; exception?:{name:string;message:string;componentStack?:string} };
let events: DiagnosticEvent[] = [];
const sanitizeStack=(s?:string)=>s?.replace(/https?:\/\/[^\s)]+/g,'[url]').slice(0,1200);
function load(){if(typeof window==='undefined')return;try{const p=JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)||'[]');if(Array.isArray(p))events=p.slice(-MAX_EVENTS);}catch{events=[];}}
function save(){if(typeof window!=='undefined')try{window.sessionStorage.setItem(STORAGE_KEY,JSON.stringify(events.slice(-MAX_EVENTS)));}catch{}}
function state(){if(typeof window==='undefined')return {pathname:'native',queryKeys:[],historyMarker:null,historyLength:undefined};const u=new URL(window.location.href);return {pathname:u.pathname,queryKeys:Array.from(u.searchParams.keys()).filter(k=>['eventId','returnTo','source','category'].includes(k)).sort(),historyMarker:window.history.state?.__ipmEventModal===true,historyLength:window.history.length};}
export function recordDiagnostic(input:Partial<DiagnosticEvent>={}){if(!events.length)load();events.push({timestamp:new Date().toISOString(),...state(),selectedEvent:'unknown',...input});events=events.slice(-MAX_EVENTS);save();}
export function recordDiagnosticException(error:Error,info?:React.ErrorInfo){recordDiagnostic({action:'exception',exception:{name:error.name||'Error',message:String(error.message||'').slice(0,500),componentStack:sanitizeStack(info?.componentStack)}});}
export function getDiagnostics(){if(!events.length)load();return {appBuild:process.env.EXPO_PUBLIC_IPM_BUILD_NUMBER||'development',appLabel:process.env.EXPO_PUBLIC_IPM_APP_LABEL==='staging'?'IPM Staging':'IPM App',...state(),online:typeof navigator==='undefined'?null:navigator.onLine,serviceWorker:typeof navigator!=='undefined'&&'serviceWorker'in navigator?'available':'unavailable',modalOpen:null,selectedEvent:'unknown',events:events.slice(-MAX_EVENTS)};}
export function clearDiagnostics(){events=[];if(typeof window!=='undefined')try{window.sessionStorage.removeItem(STORAGE_KEY);}catch{}}
