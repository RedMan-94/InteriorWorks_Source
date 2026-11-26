import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newComponent,newProject,legHeights,boxHeight,copyUnit} from '../app/lib/model.ts';
import {calculate,componentFinishFaces} from '../app/lib/engine.ts';
import {legCoverPanels,legCoverSides} from '../app/lib/leg-covers.ts';
import {constructionViews} from '../app/lib/construction-views.ts';
import {masterAssemblies,masterScene} from '../app/lib/master.ts';
import {cuttingPDF} from '../app/lib/pdf.ts';
function fixture(){const p=newProject('Leg covers'),c=newComponent('Boxing',1);Object.assign(c,{l:96,d:21,h:96,legs:true,legHeight:2,legCovers:{enabled:true,sides:[...legCoverSides]}});p.units=[{id:'u',name:'Wardrobe',components:[c]}];return {p,c};}
const coverBoards=r=>r.pieces.filter(p=>p.kind==='board'&&p.label.includes('Leg cover'));
test('front/back follow the adjusted length; left/right follow depth; every selected cover is 8mm at leg height',()=>{
 const {p,c}=fixture(),r=calculate(p);assert.deepEqual(r.errors,[]);const covers=coverBoards(r);assert.equal(covers.length,4);assert.deepEqual(covers.map(p=>[p.label,p.w,p.h,p.material]),[['Leg cover · Front',94,2,'Plywood · 8mm'],['Leg cover · Back',94,2,'Plywood · 8mm'],['Leg cover · Left',21,2,'Plywood · 8mm'],['Leg cover · Right',21,2,'Plywood · 8mm']]);assert(covers.every(p=>p.id.startsWith('PLY8-')));assert.equal(boxHeight(c),94);
 for(const p of covers){assert.equal(p.pose.y,-2);assert(Math.abs(p.w*p.h*8/25.4-p.pose.w*p.pose.h*p.pose.d)<1e-7);}
});
test('every leg height and material updates cover cuts automatically, while body geometry and leg quantities stay independent',()=>{
 const {p,c}=fixture();c.l=42;c.h=90;for(const material of ['Plywood','MDF'])for(const height of legHeights){c.material=material;c.legHeight=height;const r=calculate(p);assert.deepEqual(r.errors,[]);assert(coverBoards(r).every(q=>q.h===height&&q.material===material+' · 8mm'));assert.equal(r.pieces.find(q=>q.kind==='board'&&q.label==='Left').h,90-height);assert.equal(r.hardware.find(h=>h.name.startsWith('Legs')).value,4);assert.equal(boxHeight(c)+height,c.h);}
});
test('long front/back runs split by box while side covers appear only at the outer ends',()=>{
 const {p,c}=fixture();c.l=120;c.h=90;c.split='maximum';c.legCovers.sides=['front','right'];const r=calculate(p);assert.deepEqual(r.errors,[]);assert.deepEqual(coverBoards(r).map(p=>[p.label,p.w,p.h]),[['Box 1 / Leg cover · Front',94,2],['Box 2 / Leg cover · Front',26,2],['Box 2 / Leg cover · Right',21,2]]);assert.equal(coverBoards(r)[1].pose.x,94);assert.equal(new Set(coverBoards(r).map(p=>p.panelKey)).size,3);
});
test('covers add board/laminate consumption and use the finish library, while leaving leg counts and existing fixing counts unchanged',()=>{
 const {p,c}=fixture();c.l=42;c.h=90;c.legCovers.enabled=false;const base=calculate(p);c.legCovers.enabled=true;p.externalFinishes=[{id:'oak',code:'OAK',name:'Oak',color:'#ac9275',grain:'height',sheetGrain:'length'}];c.defaultExternalFinishId='oak';const r=calculate(p);assert.deepEqual(r.errors,[]);const added=coverBoards(r).reduce((a,q)=>a+q.w*q.h/144,0);assert(Math.abs(r.areas.board-base.areas.board-added)<1e-7);assert(Math.abs(r.areas.internal-base.areas.internal-added)<1e-7);assert(Math.abs(r.areas.external-base.areas.external-added)<1e-7);assert.equal(r.edge,base.edge);assert.equal(r.hardware.find(h=>h.name.startsWith('Legs')).value,base.hardware.find(h=>h.name.startsWith('Legs')).value);assert.equal(r.hardware.find(h=>h.name==='Nails ½″').value,base.hardware.find(h=>h.name==='Nails ½″').value);assert.equal(r.hardware.find(h=>h.name==='Leg-cover fixing hardware').value,null);assert(r.pieces.some(q=>q.label.startsWith('Leg cover')&&q.material.includes('OAK')));
});
test('disabled legs, disabled covers and unticked sides do not create boards or orphaned finish errors',()=>{
 const {p,c}=fixture();p.externalFinishes=[{id:'x',code:'X',name:'Custom',color:'#aaaaaa',grain:'free',sheetGrain:'length'}];c.faceFinishes={'leg-cover:0:front:b':{finishId:'x'}};c.legCovers.enabled=false;let r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(coverBoards(r).length,0);assert(!r.hardware.some(h=>h.name==='Leg-cover fixing hardware'));c.legCovers.enabled=true;c.legCovers.sides=['left'];r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(coverBoards(r).length,1);c.legs=false;r=calculate(p);assert.equal(coverBoards(r).length,0);assert(!r.errors.some(e=>e.includes('removed face')));
});
test('the front cover sits on the floor in elevation/section, hides the legs and remains in plywood master and PDF cuts',()=>{
 const {p,c}=fixture(),r=calculate(p),m=r.masters[0].components[0],v=constructionViews(c,m.pieces);const front=v.elevation.find(q=>q.label==='Leg cover · Front');assert.equal(front.y,0);assert.equal(front.h,2);assert.equal(v.elevation.at(-1).label,'Leg cover · Front');assert(v.elevation.find(q=>q.label==='Leg cover · Back').hidden);assert(v.section.some(q=>q.label==='Leg cover · Front'&&q.y===0));assert(v.plan.filter(q=>q.label.includes('Leg cover')).every(q=>q.hidden));assert(masterAssemblies(m).flatMap(g=>g.pieces).filter(p=>p.label.includes('Leg cover')).length===4);assert.equal(masterScene(m).labels.length,m.pieces.length);const pdf=new TextDecoder().decode(cuttingPDF(r));assert(pdf.includes('Leg cover - Front'));for(const q of coverBoards(r))assert(pdf.includes(q.id));
});
test('leg-cover side and finish choices survive JSON and independent unit duplication',()=>{
 const {p,c}=fixture();c.legCovers.sides=['front','left'];c.faceFinishes={'leg-cover:0:front:b':{zones:[]}};const copy=copyUnit(p.units[0]);assert.deepEqual(copy.components[0].legCovers,c.legCovers);copy.components[0].legCovers.sides.push('right');assert.deepEqual(c.legCovers.sides,['front','left']);assert.deepEqual(calculate(JSON.parse(JSON.stringify(p))).pieces,calculate(p).pieces);const faces=componentFinishFaces(c);assert(faces.some(f=>f.key==='leg-cover:0:front:b'&&f.w===94&&f.h===2));
});
test('legacy projects keep covers off; enabled covers require valid sides',()=>{
 const {p,c}=fixture();delete c.legCovers;assert.equal(coverBoards(calculate(p)).length,0);c.legCovers={enabled:true,sides:[]};assert(calculate(p).errors.some(e=>e.includes('Select at least one')));c.legCovers.sides=['invalid'];assert(calculate(p).errors.some(e=>e.includes('Select at least one')));
});
