import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demoWorkspace,newComponent} from '../app/lib/model.ts';
import {calculate} from '../app/lib/engine.ts';
import {masterAssemblies,masterScene} from '../app/lib/master.ts';
function fixture(){const p=demoWorkspace().projects[0],c=p.units[0].components[0];c.drawers=[{id:'drawers',x:0,y:5,span:40.5,count:2,height:6,channelLength:18}];const r=calculate(p);assert.deepEqual(r.errors,[]);return {p,r,c,component:r.masters[0].components[0]};}
test('Boxing and fixed shelves/supports are separate from each complete drawer assembly',()=>{
 const {component}=fixture(),groups=masterAssemblies(component);assert.equal(groups.length,3);assert.equal(groups[0].assemblyType,'casework');assert(groups[0].name.includes('Boxing & shelves'));
 assert(groups[0].pieces.some(p=>p.label==='Horizontal shelf 1'));assert(groups[0].pieces.some(p=>p.label.includes('automatic top shelf')));assert(groups[0].pieces.some(p=>p.label.includes('divider 1')));
 for(const [i,g] of groups.slice(1).entries()){assert.equal(g.assemblyType,'drawer');assert(g.name.endsWith('Drawer 1.'+(i+1)));assert.equal(g.pieces.length,6);assert(g.pieces.every(p=>p.label.startsWith('Drawer row 1 / '+(i+1)+' ')));}
 assert(!groups[0].pieces.some(p=>/^Drawer row \d+ \/ \d+ /.test(p.label)));
});
test('grouping retains each exact piece once with unchanged geometry and cut IDs',()=>{
 const {component}=fixture(),before=JSON.stringify(component),groups=masterAssemblies(component),flat=groups.flatMap(g=>g.pieces);assert.equal(JSON.stringify(component),before);assert.equal(new Set(flat.map(p=>p.id)).size,component.pieces.length);assert.equal(flat.length,component.pieces.length);for(const p of flat)assert(component.pieces.includes(p));
 for(const g of groups)for(const exploded of [false,true]){const scene=masterScene(g,exploded);assert.equal(scene.labels.length,g.pieces.length);assert(scene.faces.every(f=>f.points.every(p=>Number.isFinite(p.x+p.y))));}
 assert(groups[1].l<component.l);assert(groups[1].h<component.h);
});
test('stacked rows retain independent drawer labels; disabling a top does not move fixed dividers into a drawer',()=>{
 const {p,c}=fixture();c.drawers[0].topSupport=false;c.drawers.push({...c.drawers[0],id:'upper',y:11,count:1,topSupport:true});const r=calculate(p);assert.deepEqual(r.errors,[]);const groups=masterAssemblies(r.masters[0].components[0]);assert.equal(groups.length,4);assert(groups.some(g=>g.name.endsWith('Drawer 2.1')));assert(groups[0].pieces.some(p=>p.label.includes('divider')));assert(!groups.slice(1).some(g=>g.pieces.some(p=>p.label.includes('divider')||p.label.includes('top shelf'))));
});
test('components without drawers preserve their existing diagram and separate instances never mix pieces',()=>{
 const {p}=fixture();const c=newComponent('Paneling',1);Object.assign(c,{l:42,h:60});p.units[0].components.push(c);const r=calculate(p),panel=r.masters[0].components[1],groups=masterAssemblies(panel);assert.equal(groups.length,1);assert.equal(groups[0].name,panel.name);assert.deepEqual(groups[0].pieces,panel.pieces);assert(r.masters[0].components.flatMap(masterAssemblies).every(g=>g.pieces.every(p=>p.componentId===g.id.split(':drawer:')[0])));
});
