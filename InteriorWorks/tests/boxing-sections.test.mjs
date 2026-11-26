import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newProject,newComponent,copyUnit,boxHeight} from '../app/lib/model.ts';
import {T,calculate,clearBays,componentBays,supportCount,structuralSupports,moveStructuralSupport,resizeSectionWidth,doorOpenings,doorLeaves,drawerOpenings,newDrawerPosition,shelfOpenings,updateDoorSection,componentLightPanels,fix} from '../app/lib/engine.ts';
import {constructionViews} from '../app/lib/construction-views.ts';

const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);
function fixture(length=72){
 const p=newProject('Three sections'),c=newComponent('Boxing',1);
 Object.assign(c,{l:length,h:9,d:12,frontSetback:1});
 p.units=[{id:'test-unit',name:'TV cabinet',components:[c]}];
 return {p,c};
}

test('3 sections share the same supports in the Boxing, shelf, drawer, door and cut drawings',()=>{
 const {p,c}=fixture();const previous=calculate(p);
 Object.assign(c,{sectionCount:3,legs:true,legHeight:2,h:11,doorMode:'swing'});
 const bays=componentBays(c,72),supports=structuralSupports(c,72),H=boxHeight(c);
 assert.equal(bays.length,3);assert.equal(supports.length,2);
 bays.forEach(b=>close(b.w,(72-1.5-2*T)/3));
 for(const gaps of [shelfOpenings(c,72,0),drawerOpenings(c,72,{y:0,height:4})]){
  assert.equal(gaps.length,3);gaps.forEach((g,i)=>{close(g.left,bays[i].x);close(g.right,g.left+bays[i].w);});
 }
 const target=newDrawerPosition(c,72,2,6);assert(target);close(target.x,bays[2].x);
 c.drawers=[{id:'drawer-third',...target,count:1,placement:'inset',channelLength:10}];
 assert.equal(doorOpenings(c,72).filter(o=>o.whole).length,3);
 Object.assign(c,updateDoorSection(c,0,{opening:'section:1',count:1,placement:'inset'}));
 const result=calculate(p);assert.deepEqual(result.errors,[]);
 const boards=result.pieces.filter(b=>b.kind==='board'&&b.label.startsWith('Mid-support'));
 assert.equal(boards.length,2);
 for(const [i,b] of boards.entries()){
  assert.equal(b.material,'Plywood · 18mm');close(b.w,12);close(b.h,9);close(b.pose.x,.75+supports[i].x);
 }
 const base=p=>p.hardware.find(h=>h.name==='Nails ½″').value;
 assert.equal(base(result)-base(previous),2*fix(12)+fix(9));
 assert.equal(result.hardware.find(h=>h.name==='Legs · 2″').value,8);
 const panels=componentLightPanels(c);
 assert(panels.some(b=>b.panelKey==='Mid-support 2'));
 const leaf=doorLeaves(c,72,H)[0];
 close(leaf.x,.75+bays[1].x+.125);close(leaf.w,bays[1].w-.25);
 const door=result.pieces.find(b=>b.material==='Block Board · 20mm');
 close(door.pose.x,leaf.x);close(door.w,leaf.w);
 const views=constructionViews(c,result.pieces);
 assert.equal(views.plan.filter(b=>b.label.startsWith('Mid-support')&&!b.hidden).length,2);
 assert.equal(views.elevation.filter(b=>b.label==='Leg').length,4);
 assert.deepEqual(componentBays(copyUnit(p.units[0]).components[0],72),bays);
});

test('automatic retains the original support rules and manual counts keep the width minimum',()=>{
 const {p,c}=fixture(46);
 assert.equal(componentBays(c,46).length,1);
 c.l=47;assert.equal(componentBays(c,47).length,2);
 c.sectionCount=1;assert(calculate(p).errors.some(e=>e.includes('at least two sections')));
 c.sectionCount=5;assert(calculate(p).errors.some(e=>e.includes('one to four')));
 c.sectionCount=4;
 assert.equal(componentBays(c,47).length,4);
 assert.deepEqual(calculate(p).errors,[]);
 c.kind='Framing';assert.equal(componentBays(c,47).length,2);
});

test('a saved equal layout stays identical while a copy can widen the middle and retain equal sides',()=>{
 const {p,c}=fixture(60);Object.assign(c,{sectionCount:3,h:22,d:18});
 const saved=JSON.stringify(p),original=calculate(p);
 const copy=copyUnit(p.units[0]);
 copy.components[0]=resizeSectionWidth(copy.components[0],60,1,24);
 const custom=copy.components[0],bays=componentBays(custom,60),w=(60-1.5-2*T-24)/2;
 close(bays[0].w,w);close(bays[1].w,24);close(bays[2].w,w);
 assert.deepEqual(componentBays(JSON.parse(JSON.stringify(custom)),60),bays);
 assert.equal(JSON.stringify(p),saved);
 assert.deepEqual(calculate(JSON.parse(saved)).pieces,original.pieces);
 const changed=calculate({...p,units:[copy]});
 assert.deepEqual(changed.errors,[]);
 const mids=changed.pieces.filter(b=>b.kind==='board'&&b.label.startsWith('Mid-support'));
 close(mids[0].pose.x,.75+w);close(mids[1].pose.x,.75+w+T+24);
 close(componentBays({...custom,sectionShares:undefined},60)[1].w,(60-1.5-2*T)/3);
});

test('dragging a divider adjusts only neighboring widths and keeps supports in order',()=>{
 const {c}=fixture(60);c.sectionCount=3;
 const old=componentBays(c,60),x=structuralSupports(c,60)[0].x;
 const moved=moveStructuralSupport(c,60,0,x-3),bays=componentBays(moved,60);
 close(bays[0].w,old[0].w-3);close(bays[1].w,old[1].w+3);close(bays[2].w,old[2].w);
 close(structuralSupports(moved,60)[1].x,structuralSupports(c,60)[1].x);
 const clamped=componentBays(moveStructuralSupport(moved,60,0,-100),60);
 close(clamped[0].w,1/16);
 close(clamped.at(-1).x+clamped.at(-1).w,58.5);
});

test('custom bays govern drawer openings and even two-section inset doors follow the moved support',()=>{
 const {p,c}=fixture(60);Object.assign(c,{sectionCount:2,h:22,d:18,doorMode:'swing'});
 Object.assign(c,resizeSectionWidth(c,60,0,20));
 Object.assign(c,updateDoorSection(c,0,{opening:'section:0',placement:'inset',count:1}));
 const r=calculate(p),leaves=doorLeaves(c,60,22),bays=componentBays(c,60);
 assert.deepEqual(r.errors,[]);close(leaves[0].w,19.75);
 const gap=drawerOpenings(c,60,{y:0,height:6})[1];
 close(gap.left,bays[1].x);close(gap.right,58.5);
 const door=r.pieces.find(x=>x.material==='Block Board · 20mm');
 close(door.pose.x,leaves[0].x);close(door.w,leaves[0].w);
});

test('Framing mid-support moves with clear-width control and updates doors and cut geometry',()=>{
 const p=newProject('Frame support'),c=newComponent('Framing',1);
 Object.assign(c,{l:72,h:30,doorMode:'swing',doors:[{type:'normal',count:2,handles:1},{type:'profile',count:1,handles:0}]});
 p.units=[{id:'u',name:'Upper frame',components:[c]}];
 const original=calculate(p),oldSupport=original.pieces.find(x=>x.label==='Mid-support');
 assert(oldSupport);
 close(oldSupport.pose.x,(72-T)/2);
 const left=componentBays(c,72)[0].w;
 const moved=moveStructuralSupport(c,72,0,structuralSupports(c,72)[0].x+6);
 assert.equal(componentBays(moved,72).length,2);
 close(componentBays(moved,72)[0].w,left+6);
 close(componentBays(moved,72)[1].w,componentBays(c,72)[1].w-6);
 assert.deepEqual(componentBays(c,72),clearBays(72,1),'original saved frame stays equal');
 p.units[0].components[0]=moved;
 const result=calculate(p),supportPiece=result.pieces.find(x=>x.label==='Mid-support');
 assert.deepEqual(result.errors,[]);
 close(supportPiece.pose.x,oldSupport.pose.x+6);
 close(supportPiece.pose.x,.75+structuralSupports(moved,72)[0].x);
 const doors=doorLeaves(moved,72,30);
 assert(doors[0].w>doorLeaves(c,72,30)[0].w);
 assert(doors.at(-1).w<doorLeaves(c,72,30).at(-1).w);
 assert.equal(doorOpenings(moved,72)[1].x,componentBays(moved,72)[1].x);
 const measured=resizeSectionWidth(moved,72,0,left+4);
 close(componentBays(measured,72)[0].w,left+4);
 const reset={...measured,sectionShares:undefined};
 close(componentBays(reset,72)[0].w,left);
});

test('Framing can omit its mid-support without changing saved default frames',()=>{
 const p=newProject('Open frame'),c=newComponent('Framing',1);
 Object.assign(c,{l:72,h:30,doorMode:'swing',doors:[{type:'normal',count:2,handles:1}]});
 p.units=[{id:'frame-unit',name:'Wide frame',components:[c]}];
 const original=calculate(p);
 assert.deepEqual(original.errors,[]);
 assert.equal(supportCount(c,72),1);
 assert.equal(original.pieces.filter(x=>x.label==='Mid-support'&&x.kind==='board').length,1);
 const without={...c,frameMidSupport:false};p.units[0].components[0]=without;
 assert.equal(componentBays(without,72).length,1);
 assert.equal(structuralSupports(without,72).length,0);
 assert.equal(doorOpenings(without,72).filter(o=>o.whole).length,1);
 assert.equal(doorLeaves(without,72,30).length,2);
 const result=calculate(p);
 assert.deepEqual(result.errors,[]);
 assert.equal(result.pieces.filter(x=>x.label==='Mid-support'&&x.kind==='board').length,0);
 assert.equal(result.pieces.filter(x=>x.material==='Block Board · 20mm').length,2);
 assert.equal(c.frameMidSupport,undefined);
 assert.equal(supportCount(c,72),1);
});
