import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demoWorkspace,newComponent,copyUnit} from '../app/lib/model.ts';
import {calculate,componentFinishFaces,TRIM} from '../app/lib/engine.ts';
import {faceFinishErrors,finishLibraryErrors,finishRegions} from '../app/lib/finishes.ts';
import {cuttingPDF} from '../app/lib/pdf.ts';
const finishes=[{id:'white',code:'WH101',name:'White',color:'#ffffff',grain:'free',sheetGrain:'length'},{id:'oak',code:'OK205',name:'Oak',color:'#bc9469',grain:'height',sheetGrain:'length'}];
function fixture(){const p=demoWorkspace().projects[0],c=p.units[0].components[0];p.externalFinishes=structuredClone(finishes);return {p,c};}
const boardCuts=r=>r.pieces.filter(p=>p.kind==='board');
const area=(r,code)=>r.pieces.filter(p=>p.kind==='laminate'&&p.material.includes(code)).reduce((a,p)=>a+p.fw*p.fh,0);
test('face discovery exposes individual door faces, drawer fronts and logical Back dimensions',()=>{
 const {c}=fixture();c.l=94;c.h=94;c.drawers=[{id:'d',x:0,y:2,span:45.895669291338585,count:2,height:6,channelLength:18}];
 const f=componentFinishFaces(c);assert(f.some(f=>f.key==='door:0:0:0:b'));assert(f.some(f=>f.key==='drawer:d:front:1:b'));const back=f.find(f=>f.key==='Back:outside');assert.equal(back.w,94);assert.equal(back.h,94);assert.equal(back.regions.length,2);
});
test('different doors select independent finishes and sheet groups without changing board cuts or fittings',()=>{
 const {p,c}=fixture(),before=calculate(p);c.faceFinishes={'door:0:0:0:b':{finishId:'white'},'door:0:0:1:b':{finishId:'oak'}};const r=calculate(p);assert.deepEqual(r.errors,[]);assert.deepEqual(boardCuts(r),boardCuts(before));assert.deepEqual(r.hardware.filter(h=>!h.name.startsWith('Tape')),before.hardware.filter(h=>!h.name.startsWith('Tape')));assert(Math.abs(r.areas.external-before.areas.external)<1e-8);assert(r.sheets.some(s=>s.material.includes('WH101')));assert(r.sheets.some(s=>s.material.includes('OK205')));assert.equal(area(r,'WH101'),area(r,'OK205'));
 assert(r.pieces.filter(p=>p.material.includes('OK205')).every(p=>!p.rotate&&p.forcedRotate));
});
test('a measured oak band replaces its part of a white face without double-counting area, glue or plywood',()=>{
 const {p,c}=fixture(),before=calculate(p),f=componentFinishFaces(c).find(f=>f.key==='door:0:0:0:b');c.faceFinishes={[f.key]:{finishId:'white',zones:[{id:'band',finishId:'oak',x:4,y:0,w:6,h:f.h}]}};
 const r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(area(r,'OK205'),6*f.h);assert(Math.abs(area(r,'WH101')-(f.w-6)*f.h)<1e-7);assert(Math.abs(r.areas.external-before.areas.external)<1e-8);assert.equal(r.areas.internal,before.areas.internal);assert.deepEqual(boardCuts(r),boardCuts(before));assert(r.tape>before.tape);
 for(const p of r.pieces.filter(p=>p.material.includes('WH101')||p.material.includes('OK205'))){assert.equal(p.w,p.fw+2*TRIM);assert.equal(p.h,p.fh+2*TRIM);}assert(Math.abs(r.hardware.find(h=>h.name==='Fevicol SH · laminate').value-before.hardware.find(h=>h.name==='Fevicol SH · laminate').value)<1e-8);
});
test('drawer fronts retain internal laminate by default and change only the explicitly assigned face',()=>{
 const {p,c}=fixture();c.drawers=[{id:'d',x:0,y:2,span:40.5,count:2,height:6,channelLength:18}];const base=calculate(p);c.faceFinishes={'drawer:d:front:1:b':{finishId:'oak'}};const r=calculate(p);assert.deepEqual(r.errors,[]);assert(area(r,'OK205')>0);assert.deepEqual(boardCuts(r),boardCuts(base));assert(Math.abs((r.areas.external-base.areas.external)*144-area(r,'OK205'))<1e-6);assert(Math.abs((base.areas.internal-r.areas.internal)*144-area(r,'OK205'))<1e-6);
 const other=r.pieces.filter(p=>p.label==='Drawer row 1 / 1 decorative front · face 2');assert(other.every(p=>p.material.startsWith('Internal')));
});
test('Back zones cross board seams while keeping logical positions and every cut inside stock limits',()=>{
 const {p,c}=fixture();Object.assign(c,{l:94,h:94});c.faceFinishes={'Back:outside':{finishId:'white',zones:[{id:'middle',finishId:'oak',x:40,y:0,w:20,h:94}]}};const r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(area(r,'OK205'),20*94);assert.equal(area(r,'WH101'),74*94);for(const s of r.sheets)for(const q of s.pieces)assert(q.x+q.pw<=96+1e-6&&q.y+q.ph<=48+1e-6);
});
test('layered Paneling keeps overall front area once and subtracts hidden finish areas',()=>{
 const {p}=fixture(),c=newComponent('Paneling',1);Object.assign(c,{l:76,h:60,border:false});c.layers=[{id:'decor',name:'Decorative',x:12,y:10,w:40,h:36,thickness:18,grid:false,border:false,spacing:24,decorative:true}];c.faceFinishes={'layer:base:front':{finishId:'white',zones:[{id:'band',finishId:'oak',x:20,y:0,w:10,h:60}]},'layer:decor:front':{finishId:'oak'}};p.units[0].components=[c];const r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(area(r,'OK205'),40*36+10*(60-36));assert.equal(area(r,'WH101'),76*60-40*36-10*(60-36));
 assert.equal(r.pieces.filter(p=>p.kind==='laminate'&&p.label.includes('visible front')).reduce((a,p)=>a+p.fw*p.fh,0),76*60);
});
test('overlap, out-of-bounds, missing finishes, duplicate codes and removed faces block calculation clearly',()=>{
 const {p,c}=fixture(),key='Left:outside';c.faceFinishes={[key]:{finishId:'white',zones:[{id:'a',finishId:'oak',x:0,y:0,w:10,h:10},{id:'b',finishId:'white',x:5,y:5,w:10,h:10}]}};assert(calculate(p).errors.some(e=>e.includes('overlap')));c.faceFinishes[key].zones[1].x=100;assert(calculate(p).errors.some(e=>e.includes('remain inside')));c.faceFinishes[key]={finishId:'deleted'};assert(calculate(p).errors.some(e=>e.includes('removed from the library')));c.faceFinishes={'shelf:removed:b':{finishId:'white'}};assert(calculate(p).errors.some(e=>e.includes('removed face')));assert(finishLibraryErrors([...finishes,{...finishes[0],id:'other'}]).some(e=>e.includes('repeated')));
});
test('stable shelf and drawer keys survive reorder and duplicate units remap assignments independently',()=>{
 const {p,c}=fixture();c.faceFinishes={'shelf:sample-shelf-2:b':{finishId:'white',zones:[{id:'band',finishId:'oak',x:0,y:0,w:10,h:10}]}};c.shelves.shift();assert.deepEqual(calculate(p).errors,[]);const copy=copyUnit(p.units[0]),key=Object.keys(copy.components[0].faceFinishes)[0];assert(!key.includes('sample-shelf-2'));assert.equal(copy.components[0].faceFinishes[key].finishId,'white');assert.notEqual(copy.components[0].faceFinishes[key].zones[0].id,'band');p.units.push(copy);assert.deepEqual(calculate(p).errors,[]);
});
test('same finish shares compatible sheets across units; JSON and PDF retain codes and area positions',()=>{
 const {p,c}=fixture();c.faceFinishes={'door:0:0:0:b':{finishId:'white',zones:[{id:'band',finishId:'oak',x:2,y:10,w:5,h:20}]}};p.units.push(copyUnit(p.units[0]));const r=calculate(p),restored=calculate(JSON.parse(JSON.stringify(p)));assert.deepEqual(r.errors,[]);assert.deepEqual(restored.pieces,r.pieces);assert.deepEqual(restored.sheets,r.sheets);assert(r.sheets.some(s=>s.material.includes('WH101')&&new Set(s.pieces.map(p=>p.unitId)).size===2));const pdf=new TextDecoder().decode(cuttingPDF(r));assert(pdf.includes('WH101 - White'));assert(pdf.includes('OK205 - Oak'));assert(pdf.includes('left 2 in; bottom 10 in'));
});
test('all valid non-overlapping area plans conserve a face area',()=>{
 for(let w=5;w<=30;w+=5)for(let h=5;h<=30;h+=5){const a={finishId:'white',zones:[{id:'left',finishId:'oak',x:0,y:0,w:w/3,h},{id:'right',finishId:'oak',x:w*2/3,y:0,w:w/3,h:h/2}]};assert.deepEqual(faceFinishErrors(a,w,h,finishes),[]);assert(Math.abs(finishRegions(a,w,h).reduce((s,r)=>s+r.w*r.h,0)-w*h)<1e-6);}
});
test('a library default covers external faces while internal faces and individual overrides remain independent',()=>{
 const {p,c}=fixture(),base=calculate(p);c.defaultExternalFinishId='white';c.faceFinishes={'door:0:0:1:b':{finishId:'oak'}};const r=calculate(p);assert.deepEqual(r.errors,[]);assert(Math.abs(r.areas.external-base.areas.external)<1e-8);assert.equal(r.areas.internal,base.areas.internal);assert.deepEqual(boardCuts(r),boardCuts(base));assert(r.pieces.filter(p=>p.material.startsWith('External')).every(p=>p.material.includes('WH101')||p.material.includes('OK205')));assert(area(r,'WH101')>area(r,'OK205'));assert(r.pieces.filter(p=>p.material.startsWith('Internal')).length>0);
 c.defaultExternalFinishId='removed';assert(calculate(p).errors.some(e=>e.includes('removed from the library')));
});
test('sliding leaves and Closed Boxing exterior faces use the same library without changing construction cuts',()=>{
 const {p,c}=fixture();c.doorMode='sliding';c.defaultExternalFinishId='white';c.faceFinishes={'sliding:0:1:b':{finishId:'oak'}};let r=calculate(p);assert.deepEqual(r.errors,[]);assert(r.pieces.some(p=>p.label.startsWith('Sliding door 2')&&p.material.includes('OK205')));
 const closed=newComponent('Closed Boxing',1);Object.assign(closed,{l:6,d:6,h:60,defaultExternalFinishId:'oak'});p.units[0].components=[closed];r=calculate(p);assert.deepEqual(r.errors,[]);assert(r.pieces.filter(p=>p.kind==='laminate').every(p=>p.material.includes('OK205')));assert.equal(r.areas.internal,0);
});
