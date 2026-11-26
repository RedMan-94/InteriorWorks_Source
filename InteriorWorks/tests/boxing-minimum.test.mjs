import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newComponent,newProject} from '../app/lib/model.ts';
import {calculate,splitLengths} from '../app/lib/engine.ts';
import {adaptUnitToArea} from '../app/lib/adaptive-placement.ts';

function fixture(){
 const p=newProject('Small Boxing'),c=newComponent('Boxing',1);
 Object.assign(c,{l:3,d:3,h:3});
 p.units=[{id:'u',name:'Small unit',components:[c]}];
 return {p,c};
}

test('Boxing accepts exactly 3 inches on each axis, but rejects any smaller length, depth or box height',()=>{
 const {p,c}=fixture();
 assert.deepEqual(calculate(p).errors,[]);
 for(const key of ['l','d','h']){
  c[key]=2.999;
  assert(calculate(p).errors.some(e=>e.includes('length ≥3″, depth 3–22″ and calculated box height 3–94″')),key);
  c[key]=3;
 }
 c.d=22;c.h=94;assert.deepEqual(calculate(p).errors,[]);
 c.d=22.001;assert(calculate(p).errors.some(e=>e.includes('depth 3–22″')));
});

test('legged Boxing measures its 3-inch minimum on the box, excluding the legs',()=>{
 const {p,c}=fixture();Object.assign(c,{legs:true,legHeight:2,h:5});
 assert.deepEqual(calculate(p).errors,[]);
 c.h=4.999;assert(calculate(p).errors.some(e=>e.includes('calculated box height')));
});

test('split Boxing allows a 3-inch last box and rejects a smaller remainder in maximum split mode',()=>{
 const {p,c}=fixture();c.split='maximum';c.l=191;
 assert.deepEqual(splitLengths(c.l,c.split),[94,94,3]);
 assert.deepEqual(calculate(p).errors,[]);
 c.l=190.999;
 assert(calculate(p).errors.some(e=>e.includes('split leaves a box below 3″')));
 c.split='equal';assert.deepEqual(calculate(p).errors,[]);
});

test('catalogue resizing can use a 3-inch width, height and depth without changing the source',()=>{
 const {p,c}=fixture();Object.assign(c,{l:42,h:12,d:12});
 const before=JSON.stringify(p.units[0]);
 const result=adaptUnitToArea(p.units[0],{w:3,h:3,d:3});
 assert(result.unit,result.error);
 const resized=result.unit.components[0];
 assert.deepEqual([resized.l,resized.h,resized.d],[3,3,3]);
 assert.deepEqual(calculate({...p,units:[result.unit]}).errors,[]);
 assert.equal(JSON.stringify(p.units[0]),before);
});
