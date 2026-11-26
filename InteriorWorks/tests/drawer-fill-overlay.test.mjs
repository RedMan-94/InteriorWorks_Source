import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newProject,newComponent,copyUnit,fmt} from '../app/lib/model.ts';
import {calculate,T,clearBays,automaticSupports,drawerFronts,drawerGeometry,fillDrawerHeight,drawerHeightOpening,setDrawerTopSupport,handleGeometry,constructionDetails} from '../app/lib/engine.ts';
import {drawingParts} from '../app/lib/layout-dimensions.ts';
import {cuttingPDF} from '../app/lib/pdf.ts';
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);
function fixture(h=9){const p=newProject('Drawer fill'),c=newComponent('Boxing',1);Object.assign(c,{l:78,d:21,h,frontSetback:1});const bay=clearBays(78,1)[0];c.drawers=[{id:'row',x:bay.x,y:0,span:bay.w,count:1,height:6,channelLength:18,topSupport:false}];p.units=[{id:'u',name:'Unit',components:[c]}];return {p,c,row:c.drawers[0]};}
function fill(c,index=0){const row=fillDrawerHeight(c,c.l,c.drawers[index]);assert(row);c.drawers[index]=row;return row;}
test('screenshot opening fills to a fractional height, reuses the Boxing top and keeps clearance',()=>{
 const {p,c}=fixture();const r=fill(c);assert.equal(r.height,7.5);assert.equal(r.heightMode,'fill');assert.equal(r.y,0);const f=drawerFronts(c,78,r)[0];assert.equal(f.h,7.25);assert.equal(f.y,.125);assert.equal(automaticSupports(c,78).length,0);assert.deepEqual(calculate(p).errors,[]);r.topSupport=true;assert.equal(fillDrawerHeight(c,78,r).height,7.5);assert.equal(automaticSupports(c,78).length,0);
});
test('fill replaces only its own automatic top, stops at a manual shelf and respects enabled supports below drawers',()=>{
 const {p,c,row}=fixture(30);row.y=2;row.topSupport=true;c.shelves=[{id:'limit',orientation:'horizontal',x:0,y:14,w:row.span,h:T}];let filled=fill(c);assert.equal(filled.height,12);assert.equal(automaticSupports(c,78).length,0);assert.deepEqual(calculate(p).errors,[]);
 c.shelves=[];c.drawers=[{...row,height:6},{id:'above',x:0,y:14,span:row.span,count:1,height:6,channelLength:18,topSupport:false}];filled=fill(c);close(filled.height,12-T);close(automaticSupports(c,78)[0].y+T,14);assert.deepEqual(calculate(p).errors,[]);c.drawers[0].topSupport=false;filled=fill(c);close(filled.height,12);assert.deepEqual(calculate(p).errors,[]);
});
test('other sections do not restrict fill, partial vertical obstacles do, and unusable space cannot be filled',()=>{
 const {c,row}=fixture(30);const second=clearBays(78,1)[1];c.drawers.push({id:'other',x:second.x,y:9,span:second.w,count:1,height:6,channelLength:18,topSupport:false});assert.equal(drawerHeightOpening(c,78,row).height,28.5);
 c.shelves=[{id:'vertical',orientation:'vertical',x:15,y:10,w:T,h:10,baseSupport:'new'}];assert.equal(drawerHeightOpening(c,78,row).top,10-T);const fitted=fillDrawerHeight(c,78,row);assert(fitted);assert(drawerGeometry(fitted).insetHeight>=4);
 c.shelves=[{id:'low',orientation:'horizontal',x:0,y:2.25,w:row.span,h:T}];assert.equal(drawerGeometry(fillDrawerHeight(c,78,row)).insetHeight,2);c.shelves[0].y=2.125;assert.equal(fillDrawerHeight(c,78,row),null);c.shelves[0].y=0;assert.equal(fillDrawerHeight(c,78,row),null);
});
test('overlay grows only decorative fronts; body, channels, supports and non-front cuts remain unchanged',()=>{
 const {p,c}=fixture();const row=fill(c),inside=calculate(p);row.placement='overlay';const outside=calculate(p);assert.deepEqual(outside.errors,[]);const f=drawerFronts(c,78,row)[0];assert.equal(f.h,8.75);assert.equal(f.y,-.625);close(f.x,-.625);close(f.w,38.8125);
 const body=r=>r.pieces.filter(p=>p.kind==='board'&&!p.label.includes('decorative front')).map(p=>[p.label,p.w,p.h,p.pose]);assert.deepEqual(body(inside),body(outside));assert.deepEqual(inside.hardware.filter(h=>/channel|Screws|Nails|Handle/.test(h.name)),outside.hardware.filter(h=>/channel|Screws|Nails|Handle/.test(h.name)));
 const cut=outside.pieces.find(p=>p.kind==='board'&&p.panelKey==='drawer:row:front:0');close(cut.w,f.w);close(cut.h,f.h);close(cut.pose.x,.125);close(cut.pose.y,.125);close(cut.pose.w,f.w);close(cut.pose.h,f.h);assert.equal(fmt(f.y),'−0.625″');
});
test('overlay fronts share mid-supports and side-by-side dividers with exactly an eighth-inch gap',()=>{
 const {p,c}=fixture();fill(c);c.drawers[0].placement='overlay';c.drawers[0].count=2;const b=clearBays(78,1)[1];c.drawers.push({...c.drawers[0],id:'right',x:b.x,span:b.w,count:1});const faces=c.drawers.flatMap(r=>drawerFronts(c,78,r));close(faces[1].x-faces[0].x-faces[0].w,.125);close(faces[2].x-faces[1].x-faces[1].w,.125);close(faces[2].x+faces[2].w,78-1.5+.625);assert.deepEqual(calculate(p).errors,[]);
});
test('stacked overlay fronts respect shared shelves and unsupported stacked boundaries',()=>{
 const {p,c,row}=fixture(30);row.placement='overlay';row.topSupport=true;c.drawers.push({...row,id:'above',y:6+T,topSupport:false});let a=drawerFronts(c,78,row)[0],b=drawerFronts(c,78,c.drawers[1])[0];close(b.y-a.y-a.h,.125);assert.deepEqual(calculate(p).errors,[]);row.topSupport=false;c.drawers[1].y=6;a=drawerFronts(c,78,row)[0];b=drawerFronts(c,78,c.drawers[1])[0];close(b.y-a.y-a.h,.125);assert.deepEqual(calculate(p).errors,[]);
});
test('turning off a filled lower row top support refills the opening up to the upper drawer',()=>{
 const {p,c,row}=fixture(22),upperBottom=10+T;
 row.placement='overlay';row.topSupport=true;
 c.drawers.push({...row,id:'upper',y:upperBottom,height:20.5-upperBottom,heightMode:'fill',topSupport:false});
 c.drawers[0]=fillDrawerHeight(c,78,row);
 close(c.drawers[0].height,10);assert.deepEqual(calculate(p).errors,[]);
 const changed=setDrawerTopSupport(c,78,row.id,false);
 close(changed.drawers[0].height,upperBottom);assert.equal(changed.drawers[0].heightMode,'fill');assert.equal(changed.drawers[0].topSupport,false);
 assert.equal(changed.drawers[1].y,upperBottom);assert.equal(automaticSupports(changed,78).length,0);
 p.units[0].components[0]=changed;assert.deepEqual(calculate(p).errors,[]);
 const fronts=changed.drawers.map(d=>drawerFronts(changed,78,d)[0]);close(fronts[1].y-fronts[0].y-fronts[0].h,.125);
 assert.equal(c.drawers[0].topSupport,true);close(c.drawers[0].height,10);
 const restored=setDrawerTopSupport(changed,78,row.id,true);close(restored.drawers[0].height,10);
});
test('drawing, handles, material cuts, master and PDF agree after fill and overlay, and saved rows retain settings',()=>{
 const {p,c}=fixture();const row=fill(c);row.placement='overlay';row.handle={length:8,color:'Black',height:2};const f=drawerFronts(c,78,row)[0],part=drawingParts(c,78,9,false).find(p=>p.kind==='drawer'),handle=handleGeometry(c,78,9)[0],result=calculate(p);assert.deepEqual(result.errors,[]);for(const key of ['x','y','w','h'])close(part[key],f[key]);close(handle.x,.75+f.x+f.w/2);close(handle.y,.75+f.y+2);
 assert(constructionDetails(c).some(d=>d.size.includes('8.75″')&&d.position.includes('overlay front only')));const pdf=new TextDecoder().decode(cuttingPDF(result));assert(pdf.includes('8.75'));assert(pdf.includes('overlay front only'));assert(pdf.includes('height filled to opening'));
 const restored=JSON.parse(JSON.stringify(p)),restoredResult=calculate(restored);assert.deepEqual(restoredResult.errors,[]);assert.deepEqual(restoredResult.pieces,result.pieces);const copy=copyUnit(p.units[0]);assert.equal(copy.components[0].drawers[0].placement,'overlay');assert.equal(copy.components[0].drawers[0].heightMode,'fill');
});
test('legacy rows keep their original front and body dimensions until fill or overlay is selected',()=>{
 const {p,c,row}=fixture();const g=drawerGeometry(row),f=drawerFronts(c,78,row)[0];close(f.w,g.front);assert.equal(f.h,6);assert.equal(f.y,0);assert.equal(g.wallHeight,5);assert.deepEqual(calculate(p).errors,[]);row.height=7.5;assert(calculate(p).errors.some(e=>e.includes('valid count and front height')));row.heightMode='fill';assert.deepEqual(calculate(p).errors,[]);
});
