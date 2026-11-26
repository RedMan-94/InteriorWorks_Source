import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newComponent,newProject} from '../app/lib/model.ts';
import {adaptUnitToArea} from '../app/lib/adaptive-placement.ts';
import {componentBays,calculate,doorOpenings,componentLightPanels,T} from '../app/lib/engine.ts';
import {unitEnvelope} from '../app/lib/rooms.ts';
import {catalogueEntry,placeCatalogueUnit} from '../app/lib/catalogue.ts';
import {newRoom,newPlacementArea} from '../app/lib/rooms.ts';

function design(l=46,h=84,d=12){const c=newComponent('Boxing',1);Object.assign(c,{l,h,d,frontSetback:1});return {id:'template',name:'Wardrobe',components:[c]};}
function errors(unit){const p=newProject('Test');p.units=[unit];return calculate(p).errors;}

test('46-inch box grows to 72 inches with a mid-support and four shelf levels in two bays',()=>{
 const original=design(),c=original.components[0];
 c.shelves=[12,24,36,48,60,72].map((y,i)=>({id:'s'+i,orientation:'horizontal',x:0,y,w:44.5,h:T}));
 const result=adaptUnitToArea(original,{w:72,h:60,d:18});assert(result.unit,result.error);
 const box=result.unit.components[0],bays=componentBays(box,72);
 assert.equal(bays.length,2);assert.equal(box.shelves.length,8);
 assert.equal(new Set(box.shelves.map(s=>Math.round(s.y*100)/100)).size,4);
 assert(box.shelves.every(s=>bays.some(b=>Math.abs(s.x-b.x)<1e-5&&Math.abs(s.w-b.w)<1e-5)));
 assert.equal(box.d,18);assert.equal(box.h,60);assert.deepEqual(errors(result.unit),[]);
 assert.equal(original.components[0].shelves.length,6);assert.equal(original.components[0].l,46);
});

test('a single halfway shelf stays halfway when height changes',()=>{
 const original=design(42,84);original.components[0].shelves=[{id:'middle',orientation:'horizontal',x:0,y:41.25,w:40.5,h:T}];
 const result=adaptUnitToArea(original,{w:42,h:60,d:12});assert(result.unit,result.error);
 assert.equal(result.unit.components[0].shelves.length,1);
 assert(Math.abs(result.unit.components[0].shelves[0].y-29.25)<1e-7);
});

test('a 94-inch boxing design expands to two calculated 72-inch boxes, never a split box containing shelves',()=>{
 const original=design(94,90);original.components[0].shelves=[{id:'s',orientation:'horizontal',x:0,y:30,w:(94-1.5-T)/2,h:T}];
 const result=adaptUnitToArea(original,{w:144,h:90,d:12});assert(result.unit,result.error);
 assert.equal(result.unit.components.length,2);assert.deepEqual(result.unit.components.map(c=>c.l),[72,72]);
 assert.equal(unitEnvelope(result.unit).w,144);assert.deepEqual(errors(result.unit),[]);
});

test('a 6-foot-wide, 7-foot-4-high design with legs fills 10 feet by 8 feet with two boxes',()=>{
 const original=design(72,88,12),c=original.components[0];c.legs=true;c.legHeight=2;
 const bay=componentBays(c,72)[0];c.shelves=[{id:'tv-shelf',orientation:'horizontal',x:bay.x,y:24,w:bay.w,h:T}];
 const result=adaptUnitToArea(original,{w:120,h:96,d:18});assert(result.unit,result.error);
 assert.deepEqual(result.unit.components.map(c=>[c.l,c.h,c.d]),[[60,96,18],[60,96,18]]);
 assert.deepEqual(unitEnvelope(result.unit),{w:120,h:96,d:18,measured:true});
 assert.deepEqual(errors(result.unit),[]);
 assert.deepEqual([c.l,c.h,c.d],[72,88,12]);
});

test('wide drawer runs become separate fronts across new clear openings',()=>{
 const original=design(46,40);original.components[0].drawers=[{id:'row',x:0,y:0,span:44.5,count:1,height:6,topSupport:false,channelLength:null}];
 const result=adaptUnitToArea(original,{w:72,h:40,d:12});assert(result.unit,result.error);
 const box=result.unit.components[0];assert.equal(box.drawers.length,2);
 assert(box.drawers.every(r=>r.span<=36&&r.count===1));assert.deepEqual(errors(result.unit),[]);
});

test('fixed box height and depth limits leave available space unused',()=>{
 const original=design(72,88,12);const result=adaptUnitToArea(original,{w:72,h:96,d:30});assert(result.unit,result.error);
 assert.equal(result.unit.components[0].h,94);assert.equal(result.unit.components[0].d,22);
 assert(result.notes.some(n=>n.includes('space remains')));
});

test('placement repeats swing door choices across the added compartment and preserves the catalogue',()=>{
 const template=design(46,40);template.components[0].doorMode='swing';template.components[0].doors=[{type:'normal',count:1,handles:1,enabled:true,opening:'section:0'}];
 const project=newProject('Room');const room={...newRoom(),l:144,w:120,h:96};const area={...newPlacementArea(room,'A'),w:72,h:40,d:12};room.areas=[area];project.rooms=[room];
 const result=placeCatalogueUnit(project,room.id,area.id,catalogueEntry(template,[]));
 assert(result.unit,result.error);const box=result.unit.components[0];
 assert.equal(box.doors.length,2);assert(box.doors.every(d=>d.enabled&&d.opening.startsWith('section:')));
 assert.deepEqual(errors(result.unit),[]);assert.equal(template.components[0].doors.length,1);
 assert.equal(project.units.length,0);assert.equal(result.project.rooms[0].areas[0].unitId,result.unit.id);
});

test('a shelf-spanning door keeps an opening of the same kind after resizing',()=>{
 const original=design(42,84);const c=original.components[0];
 c.shelves=[20,40,60].map((y,i)=>({id:'s'+i,orientation:'horizontal',x:0,y,w:40.5,h:T}));
 const opening=doorOpenings(c,42).find(o=>o.spansShelves&&o.shelvesCovered===2);assert(opening);
 c.doorMode='swing';c.doors=[{type:'normal',count:2,handles:1,enabled:true,opening:opening.id}];
 const result=adaptUnitToArea(original,{w:72,h:72,d:12});assert(result.unit,result.error);
 const resized=result.unit.components[0];assert.equal(resized.doors.length,2);
 for(const group of resized.doors){const match=doorOpenings(resized,72).find(o=>o.id===group.opening);assert(match?.spansShelves);}
 assert.deepEqual(errors(result.unit),[]);
});

test('a small illuminated box stays at the 3-inch minimum instead of losing its panel',()=>{
 const original=design(72,88),small=newComponent('Boxing',2);
 Object.assign(small,{l:24,h:9.2,d:12,frontSetback:1,unitPosition:{x:0,y:78.8}});
 const panel=componentLightPanels(small).find(p=>p.label==='Top');assert(panel);
 small.profileLights=[{id:'light',panelKey:panel.panelKey,width:10,length:6,x:0,y:0,orientation:'horizontal',face:'a'}];
 original.components.push(small);original.components[0].unitPosition={x:0,y:0};
 const result=adaptUnitToArea(original,{w:72,h:20,d:12});assert(result.unit,result.error);
 const box=result.unit.components[1];assert.equal(box.h,3);assert(box.unitPosition.y+box.h<=20);
 assert.equal(box.profileLights.length,1);assert.deepEqual(errors(result.unit),[]);
 assert.equal(small.h,9.2);
});

test('stacked drawers reflow to fit instead of being removed by proportional rounding',()=>{
 const original=design(42,40),box=original.components[0];
 box.drawers=[{id:'lower',x:0,y:0,span:40.5,count:2,height:6,topSupport:true,channelLength:null},
  {id:'upper',x:0,y:6+T,span:40.5,count:2,height:6,topSupport:false,channelLength:null}];
 const result=adaptUnitToArea(original,{w:42,h:35,d:12});assert(result.unit,result.error);
 assert.equal(result.unit.components[0].drawers.length,2);
 assert(result.unit.components[0].drawers[1].y>=result.unit.components[0].drawers[0].y+6+T-1e-7);
 assert.deepEqual(errors(result.unit),[]);
});

test('a light fixed to an eliminated drawer front leaves with that front on the project copy',()=>{
 const original=design(42,40),box=original.components[0];
 box.drawers=[0,10,20].map((y,i)=>({id:'row'+i,x:0,y,span:40.5,count:1,height:8,topSupport:false,channelLength:null}));
 box.profileLights=[{id:'on-top-row',panelKey:'drawer:row2:front:0',width:10,length:4,x:0,y:0,orientation:'horizontal',face:'a'}];
 assert.deepEqual(errors(original),[]);
 const result=adaptUnitToArea(original,{w:42,h:20,d:12});assert(result.unit,result.error);
 assert(result.unit.components[0].drawers.length<3);
 assert.equal(result.unit.components[0].profileLights.length,0);
 assert(result.notes.some(note=>note.includes('profile light')));
 assert.deepEqual(errors(result.unit),[]);
 assert.equal(original.components[0].profileLights.length,1);
});

test('profile-light lengths and offsets follow their resized 18mm host panels',()=>{
 const original=design(72,88,12),box=original.components[0];
 box.profileLights=[
  {id:'top-light',panelKey:'Top',width:12,length:60,x:6,y:3,orientation:'horizontal',face:'a'},
  {id:'side-light',panelKey:'Left',width:10,length:72,x:2,y:8,orientation:'vertical',face:'b'},
 ];
 assert.deepEqual(errors(original),[]);
 const result=adaptUnitToArea(original,{w:60,h:82,d:22});assert(result.unit,result.error);
 const resized=result.unit.components[0],hosts=new Map(componentLightPanels(resized).map(p=>[p.panelKey,p]));
 assert.equal(resized.profileLights.length,2);
 assert.equal(resized.profileLights[0].length,50); // 60 inches on a 72-inch top becomes 50 on a 60-inch top.
 assert.equal(resized.profileLights[0].x,5);
 assert.equal(resized.profileLights[0].y,5.5); // The top panel's depth grew from 12 to 22 inches.
 const side=resized.profileLights[1],host=hosts.get(side.panelKey);
 assert(side.y+side.length<=host.h+1e-7);
 assert(side.x+side.width/25.4<=host.w+1e-7);
 assert(result.notes.some(n=>n.includes('adjusted 2 profile lights')));
 assert.deepEqual(errors(result.unit),[]);
 assert.equal(box.profileLights[0].length,60);
 assert.equal(box.profileLights[1].length,72);
});
