import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newComponent,newProject,copyUnit} from '../app/lib/model.ts';
import {calculate,doorLeaves,doorOpenings,updateDoorSection,componentBays,T} from '../app/lib/engine.ts';

function fixture(l=20,h=20){
 const p=newProject('Shutters'),c=newComponent('Boxing',1);
 Object.assign(c,{l,h,d:20,doorMode:'swing',doors:[{type:'rolling',count:1,handles:0}]});
 p.units=[{id:'unit',name:'Kitchen',components:[c]}];
 return {p,c};
}

test('rolling shutter uses one purchased kit for the clear opening and no door board, hinge or handle',()=>{
 const {p,c}=fixture(19.5,19.5),r=calculate(p),leaf=doorLeaves(c,c.l,c.h)[0];
 assert.deepEqual(r.errors,[]);
 assert.equal(leaf.type,'rolling');assert.equal(leaf.hinge,'rolling');assert.equal(leaf.w,18);assert.equal(leaf.h,18);
 assert.equal(r.hardware.find(x=>x.name.startsWith('Rolling shutter kits')).value,1);
 assert(!r.pieces.some(x=>x.label.includes('door 1')||x.label.includes('shutter')));
 assert(!r.hardware.some(x=>x.name.includes('hinges')||x.name.startsWith('Handles')));
 assert(copyUnit(p.units[0]).components[0].doors[0].type==='rolling');
});

test('rolling shutter validates all four clear-opening boundaries',()=>{
 const {p,c}=fixture(19.49,19.5);
 assert(calculate(p).errors.some(x=>x.includes('18–48″ wide and 18–72″ high')));
 c.l=19.5;c.h=19.49;assert(calculate(p).errors.some(x=>x.includes('18–48″ wide')));
 c.h=73.5;assert.deepEqual(calculate(p).errors,[]);
 c.h=73.51;assert(calculate(p).errors.some(x=>x.includes('18–48″ wide')));
 c.h=20;c.l=50.5;c.sectionCount=2;
 const available=c.l-1.5-T;c.sectionShares=[48/available,1-48/available];
 assert.deepEqual(calculate(p).errors,[]);
 c.sectionShares=[48.01/available,1-48.01/available];
 assert(calculate(p).errors.some(x=>x.includes('18–48″ wide')));
});

test('a shutter can occupy one opening while a swing door occupies another',()=>{
 const {p,c}=fixture(42,38);c.sectionCount=2;
 c.doors=[{type:'rolling',count:1,handles:0},{type:'normal',count:1,handles:1}];
 assert.deepEqual(calculate(p).errors,[]);
 assert.equal(doorLeaves(c,c.l,c.h).filter(x=>x.type==='rolling').length,1);
 assert.equal(calculate(p).pieces.filter(x=>x.material==='Block Board · 20mm').length,1);
 const first=structuredClone(c.doors[0]);
 Object.assign(c,updateDoorSection(c,1,{swing:'top'}));
 assert.deepEqual(c.doors[0],first);
});
