import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newProject,newComponent,copyUnit} from '../app/lib/model.ts';
import {calculate,doorSection,updateDoorSection,doorLeaves,doorOpenings,clearBays,fillDrawerHeight,handleGeometry,constructionDetails,T} from '../app/lib/engine.ts';
import {drawingParts,axisMeasurements} from '../app/lib/layout-dimensions.ts';
import {cuttingPDF} from '../app/lib/pdf.ts';
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);
function fixture(){const p=newProject('Independent doors'),c=newComponent('Boxing',1);Object.assign(c,{l:78,h:9,d:21,doorMode:'swing'});const b=clearBays(c.l,1)[0];c.drawers=[{id:'r',x:0,y:0,span:b.w,count:2,height:6,topSupport:false,placement:'overlay',channelLength:18}];c.drawers[0]=fillDrawerHeight(c,78,c.drawers[0]);p.units=[{id:'u',name:'TV unit',components:[c]}];return {p,c};}
function update(c,i,p){Object.assign(c,updateDoorSection(c,i,p));}
test('unconfigured sections do not inherit section 1, and updates never rewrite another section',()=>{
 const {c}=fixture();assert(doorSection(c,0).enabled);assert(!doorSection(c,1).enabled);assert.equal(doorLeaves(c,78,9).length,2);const first=structuredClone(c.doors[0]);update(c,1,{enabled:true,type:'profile',count:1,swing:'top',placement:'inset'});assert.deepEqual(c.doors[0],first);update(c,0,{enabled:false});assert.equal(c.doors[1].type,'profile');assert.equal(c.doors[1].count,1);assert.equal(doorLeaves(c,78,9).length,1);assert.equal(doorLeaves(c,78,9)[0].section,1);update(c,1,{enabled:false});update(c,1,{enabled:true});assert.equal(c.doors[1].type,'profile');assert.equal(c.doors[1].swing,'top');
});
test('the screenshot produces only two doors in section 2 and keeps two exposed drawers in section 1',()=>{
 const {p,c}=fixture();update(c,0,{enabled:false});update(c,1,{enabled:true,type:'normal',count:2});const r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(r.pieces.filter(p=>p.material==='Block Board · 20mm').length,2);assert(r.pieces.filter(p=>p.material==='Block Board · 20mm').every(p=>p.label.startsWith('Section 2')));const parts=drawingParts(c,78,9,true);assert.equal(parts.filter(p=>p.kind==='drawer').length,2);assert.equal(parts.filter(p=>p.kind==='door').length,2);assert.equal(parts.filter(p=>p.kind==='handle').length,4);const hs=handleGeometry(c,78,9);assert(hs.filter(h=>h.owner==='drawer').every(h=>h.visibleInDoorView));assert(!parts.some(p=>p.label.startsWith('Door 1.')));
 update(c,0,{enabled:true});assert.equal(drawingParts(c,78,9,true).filter(p=>p.kind==='drawer').length,0);assert(handleGeometry(c,78,9).filter(h=>h.owner==='drawer').every(h=>!h.visibleInDoorView));
});
test('normal/profile material, overlay/inset placement and leaf count remain independent per section',()=>{
 const {p,c}=fixture();c.drawers=[];update(c,0,{enabled:true,type:'normal',count:2,placement:'overlay',swing:'side'});update(c,1,{enabled:true,type:'profile',count:2,placement:'inset',swing:'bottom',assistSets:1});let r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(r.glass.length,2);const leaves=doorLeaves(c,78,9);assert.equal(leaves[0].h,8.75);close(leaves[2].h,9-2*T-.25);assert.equal(leaves[2].hinge,'bottom');assert.equal(r.hardware.find(h=>h.name==='Bottom-swing support / stay sets').value,2);const first=structuredClone(c.doors[0]);update(c,1,{type:'normal',placement:'overlay',swing:'top'});assert.deepEqual(c.doors[0],first);r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(r.glass.length,0);
});
test('all directions preserve cut dimensions while flap handles are horizontal and stay in the door view',()=>{
 const {p,c}=fixture();c.drawers=[];update(c,0,{enabled:false});update(c,1,{enabled:true,type:'normal',count:2,swing:'side'});const base=doorLeaves(c,78,9).map(d=>[d.w,d.h]);for(const swing of ['side','top','bottom']){update(c,1,{swing});const leaves=doorLeaves(c,78,9),handles=handleGeometry(c,78,9);assert.deepEqual(leaves.map(d=>[d.w,d.h]),base);assert(handles.every(h=>h.owner==='door'&&h.visibleInDoorView&&h.valid));assert(handles.every(h=>h.vertical===(swing==='side')));if(swing==='top')close(handles[0].y,leaves[0].y+.8);if(swing==='bottom')close(handles[0].y,leaves[0].y+leaves[0].h-.8);assert.equal(drawingParts(c,78,9,false).filter(p=>p.kind==='handle').length,0);const shown=drawingParts(c,78,9,true).filter(p=>p.kind==='handle');assert.equal(shown.length,2);assert.equal(axisMeasurements(shown[0]).at(-1).axis,swing==='side'?'Y':'X');assert.deepEqual(calculate(p).errors,[]);}
});
test('single side doors can hinge left/right and top/bottom doors use horizontal full-overlay hinges',()=>{
 const {p,c}=fixture();c.drawers=[];c.l=42;update(c,0,{enabled:true,count:2});let r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(r.hardware.find(h=>h.name==='Full Overlay hinges').value,4);
 c.l=20;update(c,0,{count:1,hingeSide:'left'});let leaf=doorLeaves(c,20,9)[0];assert.equal(leaf.hinge,'left');assert(handleGeometry(c,20,9)[0].x>10);update(c,0,{hingeSide:'right'});leaf=doorLeaves(c,20,9)[0];assert.equal(leaf.hinge,'right');assert(handleGeometry(c,20,9)[0].x<2);
 c.l=78;update(c,0,{count:2,swing:'top'});update(c,1,{enabled:true,count:2,swing:'bottom',assistSets:1});r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(r.hardware.find(h=>h.name==='Full Overlay hinges').value,8);assert(!r.hardware.some(h=>h.name==='Half Overlay hinges'));assert.equal(r.hardware.find(h=>h.name==='Top-swing lift / stay sets').value,null);assert.equal(r.hardware.find(h=>h.name==='Bottom-swing support / stay sets').value,2);
});
test('explicit handle heights and lengths validate against horizontal flap geometry',()=>{
 const {p,c}=fixture();c.drawers=[];update(c,0,{enabled:false});update(c,1,{enabled:true,type:'normal',count:2,swing:'top',handle:{length:8,color:'Gold',height:3}});const h=handleGeometry(c,78,9)[0];close(h.y,3.125);assert(h.valid);update(c,1,{handle:{length:24,color:'Gold',height:3}});assert(calculate(p).errors.some(e=>e.includes('entire handle')));update(c,1,{handle:{length:8,color:'Gold',height:12}});assert(calculate(p).errors.some(e=>e.includes('entire handle')));
});
test('legacy explicit sections and JSON/copies retain settings; schedules/PDF describe the chosen direction',()=>{
 const {p,c}=fixture();c.drawers=[];update(c,0,{enabled:false});update(c,1,{enabled:true,count:2,swing:'bottom',assistSets:2});const r=calculate(p);assert.deepEqual(r.errors,[]);assert(constructionDetails(c).some(d=>d.position.includes('Bottom swing')));const pdf=new TextDecoder().decode(cuttingPDF(r));assert(pdf.includes('Bottom swing'));const restored=JSON.parse(JSON.stringify(p));assert.deepEqual(calculate(restored).pieces,r.pieces);const copied=copyUnit(p.units[0]).components[0];assert(!doorSection(copied,0).enabled);assert.equal(doorSection(copied,1).swing,'bottom');assert.equal(doorSection(copied,1).assistSets,2);
});
test('one wide swing leaf is allowed up to four feet; sliding remains across the box',()=>{
 const {p,c}=fixture();c.drawers=[];update(c,0,{enabled:false});update(c,1,{enabled:true,count:1,swing:'top'});
 assert(doorLeaves(c,78,9)[0].w>23.5);assert.deepEqual(calculate(p).errors,[]);
 c.doorMode='sliding';const leaves=doorLeaves(c,78,9);assert.equal(leaves.length,2);assert(leaves.every(d=>d.hinge==='sliding'));assert.deepEqual(calculate(p).errors,[]);
 c.doorMode='swing';update(c,1,{count:2,swing:'wrong'});assert(calculate(p).errors.some(e=>e.includes('valid Swing Door direction')));
});

test('swing leaves enforce the new three-inch to four-foot width and three-inch to eight-foot height',()=>{
 const {p,c}=fixture();c.drawers=[];c.l=94;c.h=10;c.sectionCount=2;c.sectionShares=[.8,.2];update(c,0,{count:1,type:'profile'});
 assert(doorLeaves(c,94,10)[0].w>48);assert(calculate(p).errors.some(e=>e.includes('3–48″ wide')));
 c.l=20;c.h=9;const available=c.l-1.5-T,clear=3-(.75-.125)-(T/2-.0625);
 c.sectionShares=[clear/available,1-clear/available];close(doorLeaves(c,20,9)[0].w,3);assert.deepEqual(calculate(p).errors,[]);
 c.sectionShares=[(clear-.01)/available,1-(clear-.01)/available];close(doorLeaves(c,20,9)[0].w,2.99);assert(calculate(p).errors.some(e=>e.includes('3–48″ wide')));
 c.sectionShares=[clear/available,1-clear/available];c.shelves=[{id:'low',orientation:'horizontal',x:0,y:clear,w:clear,h:T}];
 const chooseLower=()=>update(c,0,{opening:doorOpenings(c,20).find(o=>o.bay===0&&!o.whole&&o.y===0).id});
 chooseLower();close(doorLeaves(c,20,9)[0].h,3);assert.deepEqual(calculate(p).errors,[]);
 c.shelves[0].y=clear-.01;chooseLower();close(doorLeaves(c,20,9)[0].h,2.99);assert(calculate(p).errors.some(e=>e.includes('3–96″ high')));
 const f=newComponent('Framing',1);Object.assign(f,{l:20,h:96.25,doorMode:'swing',doors:[{type:'profile',count:1,handles:0}]});p.units=[{id:'f',name:'Tall frame',components:[f]}];
 close(doorLeaves(f,20,96.25)[0].h,96);assert(!calculate(p).errors.some(e=>e.includes('Swing Door leaf must')));
 f.h=96.26;assert(calculate(p).errors.some(e=>e.includes('3–96″ high')));
});

test('sliding leaves allow widths below four feet and reject a leaf wider than four feet',()=>{
 const {p,c}=fixture();c.drawers=[];c.doorMode='sliding';c.l=93;
 assert(doorLeaves(c,93,9)[0].w>46);assert.deepEqual(calculate(p).errors,[]);
 c.l=94;assert(doorLeaves(c,94,9)[0].w>48);assert(calculate(p).errors.some(e=>e.includes('3–48″ wide')));
});

test('swing doors can use the clear opening beside a drawer instead of the full structural section',()=>{
 const {p,c}=fixture();c.l=72;c.drawers=[];
 const bays=clearBays(72,1),w=(bays[1].w-T)/2;
 c.shelves=[{id:'v1',orientation:'vertical',x:bays[1].x+w,y:0,w:T,h:7.5,baseSupport:'bottom'}];
 c.drawers=[{id:'right-drawer',x:bays[1].x+w+T,y:0,span:w,count:1,height:7.5,topSupport:false,placement:'overlay',heightMode:'fill',channelLength:18}];
 const o=doorOpenings(c,72).filter(o=>!o.whole);
 assert.equal(o.length,1);close(o[0].w,w);close(o[0].x,bays[1].x);
 update(c,0,{opening:o[0].id,count:1,type:'profile',swing:'top',assistSets:2});
 const leaves=doorLeaves(c,72,9),parts=drawingParts(c,72,9,true),r=calculate(p);
 assert.deepEqual(r.errors,[]);
 assert.equal(leaves.length,1);close(leaves[0].h,8.75);
 assert(leaves[0].x>35&&leaves[0].w<18);
 assert.equal(parts.filter(p=>p.kind==='drawer').length,1);
 assert.equal(r.glass.length,1);close(r.glass[0].w,leaves[0].w-.2);
 assert.deepEqual(r.profiles.map(p=>p.length),[leaves[0].w,leaves[0].w,leaves[0].h,leaves[0].h]);
 assert.deepEqual(doorLeaves(copyUnit(p.units[0]).components[0],72,9),leaves);
});

test('stacked door openings use their actual heights, mount edges and offset in cut drawings',()=>{
 const {p,c}=fixture();c.l=22;c.h=46;c.drawers=[];
 c.shelves=[{id:'lower',orientation:'horizontal',x:0,y:21,w:20.5,h:T}];
 const clear=doorOpenings(c,22).filter(o=>!o.whole&&!o.spansShelves);
 assert.equal(clear.length,2);
 update(c,0,{opening:clear[0].id,count:1,swing:'top',assistSets:1});
 update(c,1,{enabled:true,opening:clear[1].id,count:1,swing:'bottom',placement:'inset',assistSets:1});
 const leaves=doorLeaves(c,22,46),r=calculate(p);
 assert.deepEqual(r.errors,[]);
 assert.equal(r.hardware.find(x=>x.name==='Half Overlay hinges').value,2);
 assert.equal(r.hardware.find(x=>x.name==='Embedded hinges').value,2);
 const pieces=r.pieces.filter(p=>p.material==='Block Board · 20mm');
 assert.equal(pieces.length,2);
 pieces.forEach((p,i)=>{close(p.pose.y,leaves[i].y);close(p.w,leaves[i].w);close(p.h,leaves[i].h);});
 assert(leaves[0].y+leaves[0].h<leaves[1].y);
 assert.equal(drawingParts(c,22,46,true).filter(p=>p.kind==='door').length,2);
 update(c,1,{opening:'section:0'});assert(calculate(p).errors.some(e=>e.includes('overlaps another swing door group')));
 c.shelves[0].y=22;assert(calculate(p).errors.some(e=>e.includes('selected opening has changed')));
});

test('side compartments can each have a door below a top drawer, covering internal shelves',()=>{
 const {p,c}=fixture();c.l=72;c.h=38;c.sectionCount=3;c.drawers=[];
 const bays=clearBays(72,2),H=c.h-1.5;
 for(const [i,bay] of bays.entries()){
  if(i===1)continue;
  c.drawers.push({id:'top-'+i,x:bay.x,y:H-6,span:bay.w,count:1,height:6,topSupport:false,placement:'overlay',channelLength:18});
  c.shelves.push({id:'shelf-'+i,orientation:'horizontal',x:bay.x,y:12,w:bay.w,h:T});
 }
 const openings=doorOpenings(c,72).filter(o=>!o.whole);
 const lower=bays.map((bay,i)=>openings.find(o=>o.bay===i&&Math.abs(o.x-bay.x)<1e-7&&Math.abs(o.y)<1e-7&&Math.abs(o.h-(H-6))<1e-7));
 assert(lower[0]&&lower[2], 'both side compartments offer the full lower opening');
 assert.equal(lower[1],undefined);
 update(c,0,{opening:lower[0].id,count:2,swing:'side'});
 update(c,1,{enabled:true,opening:lower[2].id,count:2,swing:'side'});
 const result=calculate(p),leaves=doorLeaves(c,72,c.h),parts=drawingParts(c,72,c.h,true);
 assert.deepEqual(result.errors,[]);
 assert.equal(leaves.length,4);
 assert(leaves.every(l=>l.h>25&&l.h<32));
 assert.equal(parts.filter(part=>part.kind==='door').length,4);
 assert.equal(parts.filter(part=>part.kind==='drawer').length,2);
 assert.equal(result.pieces.filter(part=>part.material==='Block Board · 20mm').length,4);
});

test('one door group can cover the top three shelves while leaving lower openings exposed',()=>{
 const p=newProject('Shelf doors'),c=newComponent('Boxing',1);
 Object.assign(c,{l:72,h:84,d:20,sectionCount:2,doorMode:'swing'});
 const bay=clearBays(72,1)[1];
 c.shelves=[12,24,36,48,60].map((y,i)=>({id:'right-'+i,orientation:'horizontal',x:bay.x,y,w:bay.w,h:T}));
 const original=doorOpenings(c,72).find(o=>o.bay===1&&!o.whole&&!o.spansShelves&&o.y>24&&o.y<25);
 const topThree=doorOpenings(c,72).find(o=>o.bay===1&&o.shelvesCovered===3&&o.y>24&&o.y<25);
 assert(original&&topThree);
 assert.equal(topThree.y,original.y);
 assert(topThree.h>original.h+30);
 assert.equal(topThree.edges.top,'outer');
 c.doors=[{type:'normal',count:2,handles:1,opening:topThree.id}];
 p.units=[{id:'u',name:'Cabinet',components:[c]}];
 const r=calculate(p),leaves=doorLeaves(c,72,84);
 assert.deepEqual(r.errors,[]);
 assert.equal(leaves.length,2);
 assert(leaves.every(d=>d.y>24&&d.y+d.h>83));
 assert.equal(r.pieces.filter(x=>x.material==='Block Board · 20mm').length,2);
 assert(doorOpenings(c,72).some(o=>o.id===original.id),'original single-opening choices remain available');
 const conflicting=updateDoorSection(c,1,{enabled:true,type:'normal',count:1,opening:original.id});
 p.units[0].components[0]=conflicting;
 assert(calculate(p).errors.some(e=>e.includes('overlaps another swing door group')));
});
