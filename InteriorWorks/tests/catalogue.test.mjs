import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoWorkspace,newProject,newComponent} from '../app/lib/model.ts';
import {catalogueEntry,placeCatalogueUnit,placementCount,workflowUnits} from '../app/lib/catalogue.ts';
import {newRoom,newPlacementArea,removeRoom} from '../app/lib/rooms.ts';
import {calculate} from '../app/lib/engine.ts';
import {patternDefaults} from '../app/lib/laminate-patterns.ts';

const design=()=>demoWorkspace().unitCatalogue[0];
function setup(){
 const p=newProject('Test home');
 p.rooms=['Living Room','Bedroom'].map(name=>({...newRoom(),name,l:168,w:144,h:108}));
 for(const r of p.rooms)r.areas=[newPlacementArea(r,'A')];
 return p;
}
const place=(p,entry,index=0)=>placeCatalogueUnit(p,p.rooms[index].id,p.rooms[index].areas[0].id,entry);

test('reusing one saved unit in two rooms creates independent calculated copies',()=>{
 const p=setup(),entry=design(),a=place(p,entry),b=place(a.project,entry,1);
 assert.equal(a.unit.name,'Wardrobe');assert.equal(b.unit.name,'Wardrobe 2');
 assert.equal(b.unit.catalogueId,entry.unit.id);
 assert.notEqual(a.unit.components[0].id,b.unit.components[0].id);
 assert.notEqual(a.unit.components[0].shelves[0].id,b.unit.components[0].shelves[0].id);
 const placedShelfHeight=a.unit.components[0].shelves[0].y;
 assert.equal(a.unit.components[0].l,48);
 b.unit.components[0].shelves[0].y=20;
 assert.equal(a.unit.components[0].shelves[0].y,placedShelfHeight);
 assert.equal(entry.unit.components[0].shelves[0].y,28);
 assert.deepEqual(workflowUnits(b.project).map(u=>u.id),[a.unit.id,b.unit.id]);
 assert.equal(placementCount(b.project),2);
 const result=calculate({...b.project,units:workflowUnits(b.project)});
 assert.deepEqual(result.errors,[]);assert.equal(result.units,2);
 assert.equal(p.units.length,0);
});

test('catalogue snapshots survive save and project changes without sharing mutable data',()=>{
 const ws=demoWorkspace(),p=ws.projects[0],u=p.units[0],c=u.components[0];
 c.defaultExternalFinishId=p.externalFinishes[0].id;
 const entry=catalogueEntry(u,p.externalFinishes,true);
 assert.notEqual(entry.unit.id,u.id);assert.equal(entry.unit.name,u.name);
 assert.equal(entry.finishes.length,1);
 const stored=JSON.parse(JSON.stringify({...ws,unitCatalogue:[entry]}));
 p.externalFinishes[0].name='New name';c.l=18;
 assert.equal(entry.unit.components[0].l,42);
 assert.equal(entry.finishes[0].name,'Laminate 1');
 assert.deepEqual(stored.unitCatalogue[0],entry);
});

test('placing an imported design remaps finish IDs by code and preserves custom finish specs',()=>{
 const entry=design(),p=setup(),c=entry.unit.components[0];
 const custom={id:p.externalFinishes[0].id,code:'CUSTOM',name:'Walnut',color:'#725245',grain:'free',sheetGrain:'length'};
 const existing={...p.externalFinishes[1],id:'saved-project-finish'};
 p.externalFinishes[1]=existing;
 const original={...existing,id:'old-project-finish'};
 c.defaultExternalFinishId=custom.id;
 c.faceFinishes={'Left:outside':{finishId:original.id,pattern:{...patternDefaults(1,21,90),finishes:{base:custom.id}}},'Right:outside':{zones:[{id:'finish-zone',finishId:original.id,x:0,y:0,w:5,h:5}]}};
 entry.finishes=[custom,original];
 const result=place(p,entry),copy=result.unit.components[0],imported=result.project.externalFinishes.find(f=>f.code==='CUSTOM');
 assert.notEqual(imported.id,custom.id);assert.equal(copy.defaultExternalFinishId,imported.id);
 assert.equal(copy.faceFinishes['Left:outside'].finishId,existing.id);
 assert.equal(copy.faceFinishes['Left:outside'].pattern.finishes.base,imported.id);
 assert.equal(copy.faceFinishes['Right:outside'].zones[0].finishId,existing.id);
 assert.equal(p.externalFinishes.length,10);assert.equal(c.defaultExternalFinishId,custom.id);
 entry.finishes[1].grain='length';
 assert.match(place(p,entry).error,/different grain/);
});

test('replacing or removing a placement excludes the old copy while preserving it',()=>{
 const a=place(setup(),design()),b=place(a.project,design());
 assert.equal(b.project.units.length,2);assert.deepEqual(workflowUnits(b.project).map(u=>u.id),[b.unit.id]);
 const p=removeRoom(removeRoom(b.project,b.project.rooms[0].id),b.project.rooms[1].id);
 assert.equal(p.units.length,2);assert.deepEqual(workflowUnits(p),[]);
 const old=demoWorkspace().projects[0];assert.equal(workflowUnits(old).length,1);
});

test('catalogue placement validates dimensions and its destination before adding units',()=>{
 const p=setup(),entry=design();
 entry.unit.components.push(newComponent('Paneling',1));
 assert.match(place(p,entry).error,/Finish the unit dimensions/);
 assert.match(placeCatalogueUnit(p,'missing','missing',design()).error,/Select a placement area/);
 assert.equal(p.units.length,0);
});
