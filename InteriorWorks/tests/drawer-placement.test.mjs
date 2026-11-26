import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newComponent,newProject} from '../app/lib/model.ts';
import {automaticSupports,calculate,clearBays,newDrawerPosition,T} from '../app/lib/engine.ts';
function fixture(h=9){const p=newProject('Drawer placement'),c=newComponent('Boxing',1);Object.assign(c,{l:76.5,d:21,h,frontSetback:1});p.units=[{id:'u',name:'Low unit',components:[c]}];return {p,c};}
function add(c,position){assert(position,'A clear opening should accept the drawer');c.drawers.push({id:'row-'+c.drawers.length,...position,count:1,channelLength:18,topSupport:true});}
test('a minimum-height box accepts a 6-inch row below the old fixed 2-inch starting position in either section',()=>{
 const {p,c}=fixture();for(const section of [0,1]){const position=newDrawerPosition(c,c.l,section);assert.equal(position.y,0);assert.equal(position.height,6);assert.equal(position.x,clearBays(c.l,1)[section].x);add(c,position);}assert.deepEqual(calculate(p).errors,[]);assert.equal(automaticSupports(c,c.l).length,2);
});
test('the screenshot height reuses the Boxing top instead of reserving a second support thickness',()=>{
 const {p,c}=fixture(7.5);const position=newDrawerPosition(c,c.l,0);assert.equal(position.y,0);add(c,position);assert.equal(automaticSupports(c,c.l).length,0);
 // A 7.5-inch box is now valid, and the drawer reuses its top panel.
 assert.deepEqual(calculate(p).errors,[]);
});
test('users can choose a smaller front before adding it to a restricted opening',()=>{
 const {p,c}=fixture();c.shelves=[{id:'ceiling',orientation:'horizontal',x:0,y:4,w:clearBays(c.l,1)[0].w,h:T},{id:'upper',orientation:'horizontal',x:0,y:5,w:clearBays(c.l,1)[0].w,h:T}];
 assert.equal(newDrawerPosition(c,c.l,0,6),null);const small=newDrawerPosition(c,c.l,0,4);assert.equal(small.height,4);assert.equal(small.y,0);add(c,small);assert.equal(automaticSupports(c,c.l).length,0);assert.deepEqual(calculate(p).errors,[]);
});
test('search continues to another clear opening when the first one contains drawers',()=>{
 const {p,c}=fixture(24),bay=clearBays(c.l,1)[0];c.shelves=[{id:'vertical',orientation:'vertical',x:18,y:0,w:T,h:22.5,baseSupport:'bottom'}];c.drawers=[{id:'full',x:0,y:0,span:18,count:1,height:12,channelLength:18},{id:'full-upper',x:0,y:12+T,span:18,count:1,height:8,channelLength:18}];
 const position=newDrawerPosition(c,c.l,0);assert(position);assert.equal(position.x,18+T);assert(position.x+position.span<=bay.w+1e-7);add(c,position);assert.deepEqual(calculate(p).errors,[]);
});
test('placement still rejects insufficient height, width and occupied sections',()=>{
 const {c}=fixture();assert.equal(newDrawerPosition(c,c.l,0,8),null);assert.equal(newDrawerPosition(c,c.l,0,5),null);c.drawers=[{id:'full',x:0,y:0,span:clearBays(c.l,1)[0].w,count:1,height:6,channelLength:18}];assert.equal(newDrawerPosition(c,c.l,0,4),null);assert(newDrawerPosition(c,c.l,1,4));c.l=7.5;assert.equal(newDrawerPosition(c,c.l,0,4),null);
});

test('a 2-inch drawer fits under a shelf and yields a 2-inch inset front and 1-inch drawer walls in the cut list',()=>{
 const {p,c}=fixture(),bay=clearBays(c.l,1)[0];
 c.shelves=[{id:'ceiling',orientation:'horizontal',x:bay.x,y:2,w:bay.w,h:T},{id:'upper',orientation:'horizontal',x:bay.x,y:5.2,w:bay.w,h:T}];
 assert.equal(newDrawerPosition(c,c.l,0,4),null);
 assert.equal(newDrawerPosition(c,c.l,0,1),null);
 const pos=newDrawerPosition(c,c.l,0,2);assert(pos);assert.equal(pos.y,0);
 add(c,pos);assert.equal(automaticSupports(c,c.l).length,0);
 const r=calculate(p);assert.deepEqual(r.errors,[]);
 const cuts=r.pieces.filter(p=>p.kind==='board'&&p.panelKey?.startsWith('drawer:row-0:'));
 assert.equal(cuts.find(p=>p.panelKey==='drawer:row-0:front:0').h,2);
 assert.equal(cuts.filter(p=>p.material==='Plywood · 12mm'&&p.h===1).length,4);
});
