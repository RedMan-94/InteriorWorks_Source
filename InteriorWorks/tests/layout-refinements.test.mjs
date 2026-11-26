import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newProject,newComponent} from '../app/lib/model.ts';
import {calculate,clearBays,shelfOpening,T,doorLeaves} from '../app/lib/engine.ts';
import {masterScene} from '../app/lib/master.ts';
import {cuttingPDF} from '../app/lib/pdf.ts';
function fixture(){const p=newProject('Refinements'),c=newComponent('Boxing',1);Object.assign(c,{l:94,d:21,h:94,doorMode:'swing',doors:[{type:'normal',count:2,handles:1},{type:'profile',count:2,handles:0}]});p.units=[{id:'unit1',name:'Wardrobe',components:[c]}];return {p,c};}
test('shelves can fill the actual bay beyond the old 44.5 inch limit',()=>{
 const {p,c}=fixture(),b=clearBays(c.l,1)[0];c.shelves=[{id:'s',orientation:'horizontal',x:0,y:20,w:b.w,h:T}];
 assert(b.w>44.5);assert.deepEqual(calculate(p).errors,[]);c.shelves[0].w+=.01;assert(calculate(p).errors.some(x=>x.includes('exceeds the available space')));
 c.shelves=[{id:'v',orientation:'vertical',x:20,y:0,w:T,h:30}];assert.equal(shelfOpening(c,c.l,{x:0,y:10}).right,20);assert(shelfOpening(c,c.l,{x:0,y:40}).right>44.5);
});
test('door geometry used by the preview matches the generated door cut size',()=>{
 const {p,c}=fixture(),r=calculate(p),leaves=doorLeaves(c,c.l,c.h),normal=r.pieces.filter(p=>p.kind==='board'&&p.material==='Block Board · 20mm');
 assert.equal(leaves.length,4);assert.equal(normal.length,2);normal.forEach((p,i)=>{assert.equal(p.w,leaves[i].w);assert.equal(p.h,leaves[i].h);});assert.equal(leaves[2].type,'profile');
 c.doorMode='sliding';c.slidingCount=3;const sliding=doorLeaves(c,c.l,c.h);assert(Math.abs(sliding.at(-1).x+sliding.at(-1).w-(c.l-T))<1e-7);assert(Math.abs(sliding[0].x+sliding[0].w-sliding[1].x-4)<1e-7);
});
test('IDs have independent material sequences and remain consistent in sheets and masters',()=>{
 const {p,c}=fixture();c.drawers=[{id:'d',x:0,y:10,span:clearBays(94,1)[0].w,count:1,height:6,channelLength:18}];
 const r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(new Set(r.pieces.map(p=>p.id)).size,r.pieces.length);
 for(const prefix of ['PLY18','PLY12','PLY8','BB20','IL','EL']){const a=r.pieces.filter(p=>p.id.startsWith(prefix+'-'));assert(a.length);a.forEach((p,i)=>assert.equal(p.id,prefix+'-'+String(i+1).padStart(3,'0')));}
 for(const p of r.sheets.flatMap(s=>s.pieces))assert(r.pieces.some(q=>q.id===p.id&&q.label===p.label));
 const master=r.masters[0];for(const q of master.components.flatMap(c=>c.pieces)){assert(q.material.startsWith('Plywood'));assert(q.pose);assert(r.pieces.includes(q));const t=Number(q.material.match(/· (.+)mm/)[1])/25.4;assert(Math.abs(q.w*q.h*t-q.pose.w*q.pose.h*q.pose.d)<1e-6);}
 const scene=masterScene(master.components[0]);assert.equal(scene.labels.length,master.components[0].pieces.length);assert(scene.faces.every(f=>f.points.every(p=>Number.isFinite(p.x+p.y))));
 const pdf=new TextDecoder().decode(cuttingPDF(r,undefined,master.id));assert(pdf.includes('PLAN / ELEVATION / SECTION'));assert(pdf.includes('Plywood only'));assert(!pdf.includes('IL-001'));assert(!pdf.includes('BB20-001'));
});
test('same-named units do not mix their master pieces, and laminate exports omit masters',()=>{
 const {p,c}=fixture();const second=structuredClone(p.units[0]);second.id='unit2';second.components[0].id='other';p.units.push(second);
 const r=calculate(p);assert.equal(r.masters.length,2);for(const m of r.masters)assert(m.components.flatMap(c=>c.pieces).every(p=>p.unitId===m.id));
 const group=r.sheets.find(s=>s.material.startsWith('Internal laminate')).group;assert(!new TextDecoder().decode(cuttingPDF(r,group)).includes('PLYWOOD MASTER'));
});
test('all main component plywood pieces have physical placements',()=>{
 const p=newProject('Components');p.units=[{id:'u',name:'Unit',components:[]}];
 for(const kind of ['Boxing','Framing','Closed Boxing','Paneling']){const c=newComponent(kind,1);Object.assign(c,kind==='Closed Boxing'?{l:6,d:6,h:60}:kind==='Paneling'?{l:76,h:60,d:0}:{l:42,d:kind==='Framing'?4:21,h:90});p.units[0].components.push(c);}
 const r=calculate(p);assert.deepEqual(r.errors,[]);assert(r.masters[0].components.flatMap(c=>c.pieces).every(p=>p.pose&&Object.values(p.pose).every(Number.isFinite)));
});
