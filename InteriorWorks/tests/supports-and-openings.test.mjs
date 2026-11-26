import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newProject,newComponent} from '../app/lib/model.ts';
import {calculate,automaticSupports,drawerDividers,clearBays,shelfOpenings,verticalOpening,verticalBase,syncVerticalBases,drawerOpenings,newDrawerPosition,T} from '../app/lib/engine.ts';
function fixture(){const p=newProject('Support checks'),c=newComponent('Boxing',1);Object.assign(c,{l:90,d:21,h:93,frontSetback:1});p.units=[{id:'u',name:'Wardrobe',components:[c]}];return {p,c};}
test('every drawer row has a top shelf and side-by-side dividers meet its underside',()=>{
 const {p,c}=fixture(),b=clearBays(90,1)[0];c.drawers=[{id:'row',x:0,y:26,span:b.w,count:3,height:10,channelLength:18}];
 const r=calculate(p);assert.deepEqual(r.errors,[]);assert.equal(automaticSupports(c,90).length,1);assert.equal(drawerDividers(c).length,2);assert.equal(automaticSupports(c,90)[0].y,36);assert(drawerDividers(c).every(d=>d.y+d.h===36));
 assert.equal(r.pieces.filter(p=>p.kind==='board'&&p.label.includes('automatic top shelf')).length,1);assert.equal(r.pieces.filter(p=>p.kind==='board'&&p.label.includes(' divider ')).length,2);
 assert(r.masters[0].components[0].pieces.filter(p=>p.label.includes('automatic top shelf')||p.label.includes(' divider ')).every(p=>p.pose));
 c.drawers[0].count=1;assert.equal(automaticSupports(c,90).length,1);assert.equal(drawerDividers(c).length,0);
});
test('an existing top shelf is reused; a drawer on the Boxing bottom still has a shelf above',()=>{
 const {p,c}=fixture(),b=clearBays(90,1)[0];c.drawers=[{id:'row',x:0,y:26,span:b.w,count:2,height:10,channelLength:18}];c.shelves=[{id:'base',orientation:'horizontal',x:0,y:36,w:b.w,h:T}];
 assert.equal(automaticSupports(c,90).length,0);assert.deepEqual(calculate(p).errors,[]);
 c.shelves=[];c.drawers[0].y=0;assert.equal(automaticSupports(c,90).length,1);assert.equal(automaticSupports(c,90)[0].y,10);assert.deepEqual(calculate(p).errors,[]);
});
test('both main sections and the smaller openings beside a vertical shelf are available',()=>{
 const {p,c}=fixture();c.shelves=[{id:'v',orientation:'vertical',x:21.5,y:36.75,w:T,h:54.25}];
 const gaps=shelfOpenings(c,90,48);assert.equal(gaps.length,3);assert.equal(gaps[0].right,21.5);assert(gaps[1].left>21.5);assert(gaps[2].left>44);
 c.shelves.push({id:'right',orientation:'horizontal',x:gaps[2].left,y:48,w:gaps[2].right-gaps[2].left,h:T});
 // The old vertical shelf is floating until its base is selected.
 c.shelves[0].baseSupport='new';assert.deepEqual(calculate(p).errors,[]);
});
test('vertical shelves ask for a base, fill to the next horizontal panel and track a selected base',()=>{
 const {p,c}=fixture(),b=clearBays(90,1)[1];const x=b.x+b.w/2;
 c.shelves=[{id:'v',orientation:'vertical',x,y:0,w:T,h:24,baseSupport:null},{id:'upper',orientation:'horizontal',x:b.x,y:60,w:b.w,h:T}];
 assert(calculate(p).errors.some(e=>e.includes('Choose the base horizontal support')));
 const v=c.shelves[0];v.baseSupport='bottom';assert.equal(verticalOpening(c,90,v).top,60);v.h=60;assert.deepEqual(calculate(p).errors,[]);
 v.baseSupport='new';v.y=12+T;v.h=60-v.y;assert.equal(automaticSupports(c,90).length,1);assert.deepEqual(calculate(p).errors,[]);
 c.shelves.push({id:'base',orientation:'horizontal',x:b.x,y:12,w:b.w,h:T});assert.equal(automaticSupports(c,90).length,0);
 v.baseSupport='existing';v.baseShelfId='base';c.shelves[2].y=15;const updated=syncVerticalBases(c);assert.equal(updated.shelves[0].y,15+T);assert.equal(verticalBase(updated,90,updated.shelves[0]),'shelf:base');
});
test('the screenshot arrangement reuses the shelf above the drawers and creates no lower support',()=>{
 const {p,c}=fixture(),w=clearBays(90,1)[0].w;
 c.shelves=[{id:'s1',orientation:'horizontal',x:0,y:12,w,h:T},{id:'s2',orientation:'horizontal',x:0,y:36,w,h:T},{id:'v',orientation:'vertical',x:21.5,y:36.75,w:T,h:54.25},...[48,60,72].map((y,i)=>({id:'short'+i,orientation:'horizontal',x:0,y,w:21.5,h:T}))];
 c.drawers=[{id:'row',x:0,y:26,span:w,count:2,height:10,channelLength:18}];assert.deepEqual(calculate(p).errors,[]);assert.equal(automaticSupports(c,90).length,0);
});

test('drawer placement can target either section or a smaller divided opening',()=>{
 const {p,c}=fixture();const right=newDrawerPosition(c,90,1);assert(right);assert(right.x>44);c.drawers=[{id:'right',...right,count:2,channelLength:18}];assert.deepEqual(calculate(p).errors,[]);
 const next=newDrawerPosition(c,90,1);assert(next.y>=right.y+right.height+T-1e-7);
 c.shelves=[{id:'v',orientation:'vertical',x:21.5,y:0,w:T,h:91.5}];const gaps=drawerOpenings(c,90,{y:40,height:6});assert.equal(gaps.length,3);
 c.drawers[0]={...c.drawers[0],x:gaps[1].left,span:gaps[1].right-gaps[1].left,y:40,count:1};assert.deepEqual(calculate(p).errors,[]);
});

test('top shelves are included in cuts and master poses; no automatic lower plank is produced',()=>{
 const {p,c}=fixture(),b=clearBays(90,1)[0];c.drawers=[{id:'one',x:0,y:2,span:b.w,count:1,height:6,channelLength:18},{id:'two',x:0,y:26,span:b.w,count:2,height:6,channelLength:18}];const r=calculate(p);assert.deepEqual(r.errors,[]);
 const tops=r.pieces.filter(p=>p.kind==='board'&&p.label.includes('automatic top shelf'));assert.equal(tops.length,2);assert.deepEqual(tops.map(p=>p.pose.y),[8.75,32.75]);
 assert(!r.pieces.some(p=>p.label.includes('automatic base')));assert(r.masters[0].components[0].pieces.some(p=>p.id===tops[0].id));
 const divider=r.pieces.find(p=>p.kind==='board'&&p.label==='Drawer row 2 divider 1');assert.equal(divider.pose.y+divider.pose.h,tops[1].pose.y);
 c.drawers=[{id:'ceiling',x:0,y:91.5-6,span:b.w,count:2,height:6,channelLength:18}];assert.equal(automaticSupports(c,90).length,0);assert.deepEqual(calculate(p).errors,[]);
});
