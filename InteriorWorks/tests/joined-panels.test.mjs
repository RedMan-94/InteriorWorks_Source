import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newProject,newComponent,demoWorkspace} from '../app/lib/model.ts';
import {calculate,panelPlan} from '../app/lib/engine.ts';
import {cuttingPDF} from '../app/lib/pdf.ts';

function example(){
 const p=newProject('Joined panel example'),panel=newComponent('Paneling',1),box=newComponent('Boxing',1);
 Object.assign(panel,{l:76,h:60,spacing:30});
 Object.assign(box,{l:96,d:21,h:94,doorMode:'swing',doors:[{type:'profile',count:2,handles:0},{type:'profile',count:2,handles:0}]});
 p.units=[{id:'u1',name:'un01',components:[panel]},{id:'u2',name:'un02',components:[box]}];
 return {p,panel,box};
}
function checkLayout(r){
 assert.deepEqual(r.errors,[]);
 assert.equal(r.sheets.flatMap(s=>s.pieces).length,r.pieces.length);
 for(const s of r.sheets)for(let i=0;i<s.pieces.length;i++){
 const a=s.pieces[i];assert(a.x>=0&&a.y>=0&&a.x+a.pw<=96.000001&&a.y+a.ph<=48.000001);
 if(!a.rotate)assert.equal(a.rotated,a.forcedRotate);
 for(const b of s.pieces.slice(i+1))assert(a.x+a.pw<=b.x+1e-7||b.x+b.pw<=a.x+1e-7||a.y+a.ph<=b.y+1e-7||b.y+b.ph<=a.y+1e-7);
 }
 for(const a of r.assemblies||[])assert(Math.abs(a.parts.reduce((sum,p)=>sum+p.w*p.h,0)-a.w*a.h)<1e-7);
}
test('the screenshot dimensions form two pieces on existing supports',()=>{
 const {p}=example(),r=calculate(p);checkLayout(r);
 const facing=r.assemblies.find(a=>a.label==='Facing'),back=r.assemblies.find(a=>a.label==='Back');
 assert.deepEqual(facing.parts.map(p=>[p.w,p.h]),[[76,30],[76,30]]);
 assert.deepEqual(back.parts.map(p=>[p.w,p.h]),[[47,94],[47,94]]);
 assert(!r.hardware.some(x=>x.name==='Panel-joint backing / fixing'));
 assert(Math.abs(r.areas.external-(76*60+2*76+2*60+(2*76+2*60)*26/25.4)/144)<1e-7);
 assert.equal(r.pieces.filter(p=>p.kind==='laminate'&&p.label.startsWith('Back')).length,4);
 const pdf=new TextDecoder().decode(cuttingPDF(r));assert(pdf.startsWith('%PDF-1.4'));assert(pdf.includes('PLAN / ELEVATION / SECTION'));assert(!pdf.includes('JOINED PANEL / ASSEMBLY'));
});
test('grain and trimming fit every placed piece without changing finished areas',()=>{
 for(const grain of ['free','length','height'])for(const sheetGrain of ['length','width']){
 const {p,panel,box}=example();Object.assign(panel,{grain,sheetGrain});Object.assign(box,{grain,sheetGrain,external:['Back:outside']});checkLayout(calculate(p));
 }
 assert.equal(panelPlan(47.75,95.75).parts.length,1);
 // A full 48 x 96 face needs three sections once every laminate edge has trim.
 assert.equal(panelPlan(48,96).parts.length,3);
});
test('overlapping decorative layers retain one overall front laminate area',()=>{
 const {p,panel}=example();panel.border=false;panel.layers=[{id:'decor',name:'Decor',x:12,y:10,w:40,h:36,thickness:18,grid:false,border:false,spacing:24,decorative:true}];
 const r=calculate(p);checkLayout(r);
 const front=r.pieces.filter(p=>p.kind==='laminate'&&p.label.includes('visible front')).reduce((sum,p)=>sum+p.fw*p.fh,0);
 assert(Math.abs(front-76*60)<1e-7);
});
test('unsupported new joints are disclosed, never silently treated as supported',()=>{
 const {p,panel}=example();panel.grid=false;const r=calculate(p);checkLayout(r);
 assert(r.hardware.some(x=>x.name==='Panel-joint backing / fixing'&&x.value===null));
});
test('small panels remain continuous and the original sample still calculates',()=>{
 const r=calculate(demoWorkspace().projects[0]);checkLayout(r);assert.equal(r.assemblies.length,0);
});
