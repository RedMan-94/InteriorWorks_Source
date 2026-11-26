import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demoWorkspace,newComponent} from '../app/lib/model.ts';
import {calculate,T} from '../app/lib/engine.ts';
import {cuttingPDF,cutLabel,materialRows} from '../app/lib/pdf.ts';
import {constructionViews} from '../app/lib/construction-views.ts';
const decode=r=>new TextDecoder().decode(cuttingPDF(r));
test('full download has one materials list, orthographic views and one diagram per sheet, without repeated piece pages',()=>{
 const r=calculate(demoWorkspace().projects[0]),pdf=decode(r);
 assert.deepEqual(r.errors,[]);assert(pdf.includes('MATERIAL SUMMARY'));assert(pdf.includes('PLAN / ELEVATION / SECTION'));assert(pdf.includes('SECTION A-A'));
 for(const removed of ['MASTER PIECE KEY','DIMENSIONED PIECES','PIECE SCHEDULE','REMAINING OFFCUTS','JOINED PANEL / ASSEMBLY','PROFILE LIGHT / PANEL PLACEMENT'])assert(!pdf.includes(removed));
 assert.equal((pdf.match(/CUTTING DIAGRAM \/ /g)||[]).length,r.sheets.length);
 for(const q of r.sheets.flatMap(s=>s.pieces)){assert(pdf.includes(q.id));assert(pdf.includes(Number(q.pw.toFixed(3))+' x '+Number(q.ph.toFixed(3))+' in'));}
 assert((pdf.match(/\/Type \/Page\b/g)||[]).length<=r.sheets.length+3);
});
test('procurement rows retain every sheet group, hardware unit and unset quantity, with grouped vendor glass',()=>{
 const p=demoWorkspace().projects[0];p.units[0].components[0].doors[0].type='profile';const r=calculate(p),rows=materialRows(r);
 for(const g of new Set(r.sheets.map(s=>s.group)))assert.equal(rows.find(x=>x.name===g).value,r.sheets.filter(s=>s.group===g).length);
 for(const h of r.hardware)assert.deepEqual(rows.find(x=>x.name===h.name),h);
 assert(rows.some(x=>x.name.includes('hinges')&&x.unit==='pcs'));
 assert.equal(rows.filter(x=>x.name.startsWith('6mm glass')).reduce((n,x)=>n+x.value,0),r.glass.reduce((n,x)=>n+x.count,0));
 assert(decode(r).includes('Input required'));
});
test('thin pieces rotate their annotations; tiny pieces retain exact dimensions through references',()=>{
 const r=calculate(demoWorkspace().projects[0]),q=r.sheets[0].pieces[0];
 const strip={...q,pw:1,ph:90};assert(cutLabel(strip,11.4).rotation);assert(!cutLabel(strip,11.4).callout);
 const tiny={...q,pw:.4,ph:.4};assert(cutLabel(tiny,11.4).callout);assert(cutLabel(tiny,11.4).lines.includes('0.4 x 0.4 in'));
});
test('orthographic section intersects actual board poses; shelf elevations include legs',()=>{
 const p=demoWorkspace().projects[0],c=p.units[0].components[0];c.legs=true;c.h=92;c.legHeight=2;
 const r=calculate(p),item=r.drawings[0].components[0],v=constructionViews(item.config,item.pieces);
 assert.equal(v.height,92);assert.equal(v.width,42);assert(v.depth>21);const shelf=v.elevation.find(x=>x.label==='Horizontal shelf 1');assert.equal(shelf.y,30.75);assert.equal(shelf.h,T);
 assert(v.section.some(x=>x.label==='Horizontal shelf 1'));assert(!v.section.some(x=>x.label==='Left'));
 assert(v.handles.length===2);assert(v.elevation.some(x=>x.id==='leg'&&x.h===2));
});
test('MDF components and repeated component instances receive separate real drawing sets without changing materials',()=>{
 const p=demoWorkspace().projects[0],c=p.units[0].components[0];c.material='MDF';const panel=newComponent('Paneling',1);Object.assign(panel,{l:78,h:60,material:'MDF'});p.units[0].components.push(panel);
 const r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(r.drawings[0].components.length,2);assert.equal((decode(r).match(/\(PLAN \/ ELEVATION \/ SECTION\)/g)||[]).length,2);assert(r.drawings[0].components.every(c=>c.pieces.some(p=>p.material.startsWith('MDF'))));
 const restored=calculate(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.pieces,r.pieces);assert.deepEqual(restored.hardware,r.hardware);
});
test('material download stays scoped and plywood views download excludes stock and material pages',()=>{
 const r=calculate(demoWorkspace().projects[0]),g=r.sheets.find(s=>s.material.startsWith('Internal')).group;
 const pdf=new TextDecoder().decode(cuttingPDF(r,g));assert(!pdf.includes('PLAN / ELEVATION / SECTION'));assert.equal((pdf.match(/CUTTING DIAGRAM \/ /g)||[]).length,r.sheets.filter(s=>s.group===g).length);
 const views=new TextDecoder().decode(cuttingPDF(r,undefined,r.drawings[0].id));assert(views.includes('Plywood only'));assert(!views.includes('CUTTING DIAGRAM'));assert(!views.includes('MATERIAL SUMMARY'));
});
test('profile cuts paginate and page references stay finite for long projects',()=>{
 const r=calculate(demoWorkspace().projects[0]);r.profileStocks=Array.from({length:40},()=>({items:[{label:'A',length:50},{label:'B',length:50}],remaining:19.9375}));
 const pdf=decode(r);assert(pdf.includes('Stock 40'));assert(!pdf.includes('NaN'));assert(!pdf.includes('Infinity'));assert(pdf.endsWith('%%EOF'));
});
