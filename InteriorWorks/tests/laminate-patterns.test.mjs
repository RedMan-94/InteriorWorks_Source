import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patternDefaults,patternNames,patternErrors,patternRegions,polygonArea,boundarySegments,placedOutline} from '../app/lib/laminate-patterns.ts';
import {calculate,componentFinishFaces} from '../app/lib/engine.ts';
import {demoWorkspace,newComponent,copyUnit} from '../app/lib/model.ts';
import {finishInUse,faceFinishErrors} from '../app/lib/finishes.ts';
import {cuttingPDF} from '../app/lib/pdf.ts';
const finishes=[{id:'ivory',code:'IV01',name:'Ivory',color:'#ffffff',grain:'free',sheetGrain:'length'},{id:'oak',code:'OK02',name:'Oak',color:'#b8976e',grain:'free',sheetGrain:'length'}];
const area=regions=>regions.reduce((s,r)=>s+r.polygons.reduce((s,p)=>s+polygonArea(p),0),0);
function fixture(preset=2){const p=demoWorkspace().projects[0],c=p.units[0].components[0];p.externalFinishes=structuredClone(finishes);const face=componentFinishFaces(c).find(f=>f.key==='Left:outside'),pattern=patternDefaults(preset,face.w,face.h);patternRegions(pattern,face.w,face.h).forEach((r,i)=>pattern.finishes[r.id]=finishes[i%2].id);c.faceFinishes={[face.key]:{finishId:'ivory',pattern}};return {p,c,face,pattern};}
function pointIn(poly,x,y){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
test('the exact 20 presets tile landscape and portrait faces without overlaps or missing area',()=>{
 assert.equal(patternNames.length,20);for(const [w,h] of [[21,90],[76,60],[6,3]])for(let id=1;id<=20;id++){const p=patternDefaults(id,w,h),r=patternRegions(p,w,h);assert.deepEqual(patternErrors(p,w,h),[]);assert(r.length);assert(Math.abs(area(r)-w*h)<1e-6,`${id}: area ${area(r)}`);
 // Off-grid sample points avoid seams while testing gaps and overlaps independently of total area.
 for(let x=.173;x<w;x+=w/9.37)for(let y=.217;y<h;y+=h/8.91){const hits=r.flatMap(r=>r.polygons).filter(poly=>pointIn(poly,x,y)).length;assert.equal(hits,1,`${id}: ${hits} hits at ${x},${y}`);}
 }});
test('all patterns integrate with quantities, sheet groups, stock bounds and finished cut outlines',()=>{
 for(let id=1;id<=20;id++){const {p,c}=fixture(id),before=calculate({...p,units:[{...p.units[0],components:[{...c,faceFinishes:undefined}]}]}),r=calculate(p);assert.deepEqual(r.errors,[],`preset ${id}`);assert(Math.abs(r.areas.external-before.areas.external)<1e-6);assert.equal(r.areas.internal,before.areas.internal);assert.deepEqual(r.pieces.filter(p=>p.kind==='board'),before.pieces.filter(p=>p.kind==='board'));
 assert(r.pieces.some(p=>p.cutShape));for(const sheet of r.sheets)for(const q of sheet.pieces){assert(q.x+q.pw<=96+1e-6);assert(q.y+q.ph<=48+1e-6);for(const edge of placedOutline(q))for(const pt of [edge.a,edge.b]){assert(pt.x>=q.x-1e-6&&pt.x<=q.x+q.pw+1e-6);assert(pt.y>=q.y-1e-6&&pt.y<=q.y+q.ph+1e-6);}}
 const glue=r.hardware.find(h=>h.name==='Fevicol SH · laminate').value;assert(Math.abs(glue-before.hardware.find(h=>h.name==='Fevicol SH · laminate').value)<1e-6);
 }});
test('individual strip, border, grid and arc edits preserve region assignments and change geometry',()=>{
 for(const id of [3,6,9,12,15,17,18,19,20]){const {pattern,face}=fixture(id),old=JSON.stringify(patternRegions(pattern,face.w,face.h)),ids={...pattern.finishes};if(id<=9)pattern.strips[0].width*=.7;else if(id===12)pattern.borders[0].inset+=.1;else if(id===15)pattern.vertical[0].position+=.2;else if(id===17)pattern.cutsX[0]+=.2;else if(id<20)pattern.offsetX+=.5;else pattern.centerX+=1;
 assert.deepEqual(patternErrors(pattern,face.w,face.h,finishes),[]);assert.notEqual(JSON.stringify(patternRegions(pattern,face.w,face.h)),old);assert.deepEqual(pattern.finishes,ids);assert(Math.abs(area(patternRegions(pattern,face.w,face.h))-face.w*face.h)<1e-6);}
});
test('pattern validation blocks overlaps, reversed arcs, invalid grids, tiny cells, missing finishes and resized out-of-bounds strips',()=>{
 const {c,face,pattern}=fixture(3);pattern.strips[1].position=pattern.strips[0].position;assert(faceFinishErrors(c.faceFinishes[face.key],face.w,face.h,finishes).some(e=>e.includes('overlap')));pattern.strips[1].position=100;assert(patternErrors(pattern,face.w,face.h,finishes).some(e=>e.includes('inside')));
 let p=patternDefaults(20,40,60);p.radii=[20,10];assert(patternErrors(p,40,60).length);p=patternDefaults(17,40,60);p.rows=0;assert(patternErrors(p,40,60).length);p=patternDefaults(18,40,60);p.cellWidth=.001;assert(patternErrors(p,40,60).length);p=patternDefaults(1,40,60);p.finishes.plain='deleted';assert(patternErrors(p,40,60,finishes).some(e=>e.includes('removed')));
});
test('arc region perimeters cancel internal radial cell edges',()=>{const p=patternDefaults(20,48,60);p.radii=[20];const r=patternRegions(p,48,60)[0],perimeter=boundarySegments(r.polygons).reduce((s,e)=>s+Math.hypot(e.a.x-e.b.x,e.a.y-e.b.y),0);assert(Math.abs(perimeter-(40+Math.PI*10))<.03);});
test('oversized patterned backs and occluded paneling faces retain their net area and split into stock-sized blanks',()=>{
 const p=demoWorkspace().projects[0];p.externalFinishes=finishes;const c=newComponent('Paneling',1);Object.assign(c,{l:76,h:60,border:false,layers:[{id:'layer',name:'Decor',x:12,y:10,w:40,h:30,thickness:18,decorative:true,grid:false,border:false,spacing:24}]});p.units[0].components=[c];const before=calculate(p);c.faceFinishes={'layer:base:front':{finishId:'ivory',pattern:patternDefaults(20,76,60)}};const r=calculate(p);assert.deepEqual(r.errors,[]);assert(Math.abs(r.areas.external-before.areas.external)<1e-6);for(const s of r.sheets)for(const q of s.pieces)assert(q.pw<=96+1e-7&&q.ph<=48+1e-7);
 const b=demoWorkspace().projects[0];b.externalFinishes=finishes;const box=b.units[0].components[0];Object.assign(box,{l:94,h:94});box.external.push('Back:outside');const base=calculate(b);box.faceFinishes={'Back:outside':{finishId:'ivory',pattern:patternDefaults(9,94,94)}};const back=calculate(b);assert.deepEqual(back.errors,[]);assert(Math.abs(back.areas.external-base.areas.external)<1e-6);
});
test('saved projects, copies, laminate reference protection and PDF retain the selected pattern',()=>{
 const {p,c}=fixture(9);assert(finishInUse([c],'oak'));const copy=copyUnit(p.units[0]);copy.components[0].faceFinishes['Left:outside'].pattern.strips[0].width=1;assert.notEqual(copy.components[0].faceFinishes['Left:outside'].pattern.strips[0].width,c.faceFinishes['Left:outside'].pattern.strips[0].width);
 const r=calculate(p),restored=calculate(JSON.parse(JSON.stringify(p)));assert.deepEqual(r.pieces,restored.pieces);const pdf=new TextDecoder().decode(cuttingPDF(r));assert(pdf.includes('Two slant strips'));assert(pdf.includes('IV01'));assert(pdf.includes('finished pattern shapes'));
});
test('drawer fronts enter the external-only design workflow when explicitly selected',()=>{const p=demoWorkspace().projects[0],c=p.units[0].components[0];c.drawers=[{id:'d',x:0,y:2,span:40.5,count:1,height:6,channelLength:18}];const key='drawer:d:front:0:b';assert.equal(componentFinishFaces(c).find(f=>f.key===key).external,false);c.external.push(key);assert.equal(componentFinishFaces(c).find(f=>f.key===key).external,true);p.externalFinishes=finishes;const face=componentFinishFaces(c).find(f=>f.key===key);c.faceFinishes={[key]:{pattern:patternDefaults(5,face.w,face.h),finishId:'oak'}};assert.deepEqual(calculate(p).errors,[]);});
test('grain-restricted pattern blanks retain sheet orientation and tiny diamond cells reject cleanly',()=>{const {p,c,pattern}=fixture(10);p.externalFinishes[1].grain='height';p.externalFinishes[1].sheetGrain='length';const r=calculate(p);assert.deepEqual(r.errors,[]);assert(r.pieces.filter(p=>p.material.includes('OK02')).every(p=>!p.rotate&&p.forcedRotate));const lattice=patternDefaults(18,100,100);lattice.cellWidth=100;lattice.cellHeight=2;assert(patternErrors(lattice,100,100).length);});
