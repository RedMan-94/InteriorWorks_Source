import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newComponent,newProject,copyUnit,boxHeight,legHeight} from '../app/lib/model.ts';
import {calculate} from '../app/lib/engine.ts';
import {componentSize,unitPlacements,unitLayoutBounds,positionUnitComponent,unitDrawingOrder,unitLayerOrder,reorderUnitLayer,unitComponentOrigin} from '../app/lib/unit-layout.ts';
function fixture(){const a=newComponent('Boxing',1),b=newComponent('Paneling',1);Object.assign(a,{id:'box',l:42,d:21,h:90});Object.assign(b,{id:'panel',l:76,h:60});const unit={id:'unit',name:'TV unit',components:[a,b]};return {unit,a,b};}
test('all main components share one non-overlapping initial layout and unit bounds',()=>{
 const {unit}=fixture(),items=unitPlacements(unit);assert.equal(items.length,2);assert(items.every(i=>i.valid));assert.deepEqual(items.map(i=>[i.id,i.x,i.y]),[['box',0,0],['panel',66,0]]);assert.deepEqual(unitLayoutBounds(items),{w:142,h:90});assert.equal(unit.components[0].unitPosition,undefined);
});
test('moving one component freezes other default positions and supports a layered TV arrangement',()=>{
 const {unit}=fixture(),before=structuredClone(unit);let moved=positionUnitComponent(unit,'panel',0,12);assert.deepEqual(unit,before);assert.deepEqual(moved.components[0].unitPosition,{x:0,y:0});assert.deepEqual(moved.components[1].unitPosition,{x:0,y:12});assert.deepEqual(unitLayoutBounds(unitPlacements(moved)),{w:76,h:90});moved=positionUnitComponent(moved,'box',20,0);assert.deepEqual(moved.components[1].unitPosition,{x:0,y:12});assert.equal(unitPlacements(moved)[0].x,20);
});
test('all instances remain independent and leftmost chip draws in front',()=>{
 const {unit}=fixture();const second=structuredClone(unit.components[0]);second.id='box2';second.name='Boxing 2';unit.components.push(second);const p=unitPlacements(unit);assert.equal(p.length,3);assert(p[2].x>p[1].x+p[1].w);assert.deepEqual(unitDrawingOrder(p).map(i=>i.id),['box2','panel','box']);const moved=positionUnitComponent(unit,'box2',0,25);assert.equal(moved.components[0].unitPosition.y,0);assert.equal(moved.components[2].unitPosition.y,25);
});
test('saved layer order controls overlapping boxing and closed boxing without changing geometry or cut quantities',()=>{
 const {unit}=fixture(),closed=newComponent('Closed Boxing',1);Object.assign(closed,{id:'closed',l:42,d:9,h:90,unitPosition:{x:0,y:0}});unit.components=[unit.components[0],closed];unit.components[0].unitPosition={x:0,y:0};
 const project=newProject('Layers');project.units=[unit];const before=calculate(project);assert.deepEqual(unitLayerOrder(unit),['box','closed']);assert.deepEqual(unitDrawingOrder(unitPlacements(unit),unit.layerOrder).map(i=>i.id),['closed','box']);
 const reordered=reorderUnitLayer(unit,'closed','box');assert.deepEqual(unitLayerOrder(reordered),['closed','box']);assert.deepEqual(unitDrawingOrder(unitPlacements(reordered),reordered.layerOrder).map(i=>i.id),['box','closed']);assert.deepEqual(reordered.components,unit.components);assert.deepEqual(unitLayerOrder(unit),['box','closed']);
 project.units=[reordered];const after=calculate(project);for(const k of ['pieces','sheets','hardware','areas','edge','tape','masters','construction'])assert.deepEqual(after[k],before[k],k+' changed with visual layers');
 const copy=copyUnit(reordered);assert.deepEqual(unitLayerOrder(copy),[copy.components[1].id,copy.components[0].id]);assert.notEqual(copy.layerOrder[0],reordered.layerOrder[0]);
});
test('calculation length rules, split boxes and overall leg heights give correct component extents',()=>{
 const c=newComponent('Boxing',1);Object.assign(c,{l:96,h:96,legs:true,legHeight:2});assert.deepEqual(componentSize(c),{w:94,h:96});c.l=120;assert.equal(componentSize(c).w,120);c.split='maximum';assert.equal(componentSize(c).w,120);c.kind='Paneling';assert.equal(componentSize(c).w,120);c.kind='Closed Boxing';c.l=6;assert.equal(componentSize(c).w,6);
});
test('active detail coordinates align with global placement, including inside origin and legs',()=>{
 const {unit,a}=fixture();a.h=96;a.legs=true;a.legHeight=2;a.unitPosition={x:30,y:12};const item=unitPlacements(unit)[0],top=108,outer=unitComponentOrigin(item,top,false),inside=unitComponentOrigin(item,top,true);assert.deepEqual(outer,{x:30,y:0});assert.deepEqual(inside,{x:30.75,y:.75});assert.equal(outer.y+boxHeight(a)+legHeight(a),top-item.y);assert.equal(inside.y+(boxHeight(a)-1.5)+.75+legHeight(a),top-item.y);const panel=unitPlacements(unit)[1];assert.deepEqual(unitComponentOrigin(panel,108,true),unitComponentOrigin(panel,108,false));
});
test('unmeasured components do not hide measured siblings or produce invalid canvas bounds',()=>{
 const {unit,a,b}=fixture();a.l=0;let items=unitPlacements(unit);assert(!items[0].valid);assert(items[1].valid);assert.equal(items[1].x,0);b.h=0;assert.deepEqual(unitLayoutBounds(unitPlacements(unit)),{w:1,h:1});a.l=NaN;assert.deepEqual(componentSize(a),{w:0,h:0});assert.equal(positionUnitComponent(unit,'missing',3,4),unit);assert.equal(positionUnitComponent(unit,'box',Infinity,4),unit);const moved=positionUnitComponent(unit,'box',-2,-4);assert.deepEqual(moved.components[0].unitPosition,{x:0,y:0});
});
test('placement saves and duplicates with the unit while material quantities and cut geometry stay unchanged',()=>{
 const {unit}=fixture(),p=newProject('Shared preview');p.units=[unit];const before=calculate(p);assert.deepEqual(before.errors,[]);p.units=[positionUnitComponent(unit,'panel',0,18)];const after=calculate(p);assert.deepEqual(after.errors,[]);for(const k of ['pieces','sheets','hardware','areas','edge','tape','masters','construction'])assert.deepEqual(after[k],before[k],k+' changed from preview-only placement');const restored=JSON.parse(JSON.stringify(p));assert.deepEqual(restored.units[0].components[1].unitPosition,{x:0,y:18});const copy=copyUnit(restored.units[0]);assert.notEqual(copy.components[1].id,'panel');assert.deepEqual(copy.components[1].unitPosition,{x:0,y:18});copy.components[1].unitPosition.x=20;assert.equal(restored.units[0].components[1].unitPosition.x,0);
});
