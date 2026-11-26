import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newComponent} from '../app/lib/model.ts';
import {componentBays,T} from '../app/lib/engine.ts';
import {spaceSectionShelves} from '../app/lib/shelf-spacing.ts';

function unit(){const c=newComponent('Boxing',1);Object.assign(c,{l:72,h:60,d:18,sectionCount:2});const b=componentBays(c,72);c.shelves=[...Array.from({length:4},(_,i)=>({id:'left-'+i,orientation:'horizontal',x:b[0].x,y:5+i*7,w:b[0].w,h:T})),{id:'right',orientation:'horizontal',x:b[1].x,y:17,w:b[1].w,h:T}];return c;}

test('shelves fill one section with equal clear gaps from bottom to top',()=>{
 const c=unit(),result=spaceSectionShelves(c,72,0);assert(!result.error);
 const ys=result.shelves.slice(0,4).map(s=>s.y);
 assert(ys.every((y,i)=>Math.abs(y-(result.gap+(result.gap+T)*i))<1e-6));
 assert.equal(result.shelves[4].y,17);assert.equal(c.shelves[0].y,5);
});

test('a chosen base shelf stays fixed while all others spread above it',()=>{
 const c=unit(),base=c.shelves[2],result=spaceSectionShelves(c,72,0,base.id);assert(!result.error);
 assert.equal(result.shelves[2].y,base.y);
 for(const s of result.shelves.slice(0,4).filter(s=>s.id!==base.id))assert(s.y>base.y+T);
 assert.equal(result.shelves[4].y,17);
});
