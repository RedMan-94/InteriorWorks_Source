import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newProject,newComponent} from '../app/lib/model.ts';
import {calculate,componentBays,shelfDepth,shelfThickness,T,constructionDetails} from '../app/lib/engine.ts';
import {drawingParts} from '../app/lib/layout-dimensions.ts';
import {purchaseLines} from '../app/lib/material-procurement.ts';
import {materialRows} from '../app/lib/pdf.ts';

function fixture(){
 const project=newProject('Glass shelving'),box=newComponent('Boxing',1);
 Object.assign(box,{l:42,h:60,d:18,frontSetback:1});
 const width=componentBays(box,42)[0].w;
 box.shelves=[{id:'existing',orientation:'horizontal',x:0,y:10,w:width,h:T},{id:'new-glass',orientation:'horizontal',x:0,y:24,w:width,h:8/25.4,material:'glass'}];
 project.units=[{id:'one',name:'Unit',components:[box]}];
 return {project,box,width};
}

test('8mm glass shelves replace only their own board and four shelf bottoms with glass and four glass supports',()=>{
 const {project,box,width}=fixture(),result=calculate(project);
 assert.deepEqual(result.errors,[]);
 assert.equal(result.glass.length,1);
 assert.deepEqual(result.glass[0],{label:'Unit / Boxing 1 / Glass shelf 2',w:width,h:shelfDepth(box),count:1,thickness:8});
 assert.equal(result.hardware.find(x=>x.name==='Glass supports')?.value,4);
 assert.equal(result.hardware.find(x=>x.name==='Shelf bottoms')?.value,4);
 assert(result.pieces.some(x=>x.label==='Horizontal shelf 1'));
 assert(!result.pieces.some(x=>x.label.includes('Horizontal shelf 2')||x.label.includes('Glass shelf 2')));
 assert.equal(drawingParts(box,42,60,false).find(x=>x.id==='new-glass')?.h,8/25.4);
 assert(constructionDetails(box).some(x=>x.label==='Glass shelf 2'&&x.size.endsWith('8mm glass')));
 const purchases=purchaseLines(result),glass=purchases.find(x=>x.key==='glass:8mm');
 assert.equal(glass?.quantity,width*shelfDepth(box)/144);
 assert(materialRows(result).some(x=>x.name.startsWith('8mm glass')&&x.value===1));
});

test('old saved shelves remain 18mm board; mixed glass thicknesses price separately',()=>{
 const {project,box}=fixture();delete box.shelves[1].material;
 const legacy=calculate(JSON.parse(JSON.stringify(project)));
 assert.deepEqual(legacy.errors,[]);
 assert.equal(legacy.glass.length,0);
 assert.equal(legacy.hardware.find(x=>x.name==='Shelf bottoms')?.value,8);
 assert(!legacy.hardware.some(x=>x.name==='Glass supports'));
 assert.equal(shelfThickness(box.shelves[1]),T);
 box.shelves[1].material='glass';
 const r=calculate(project);
 r.glass.push({label:'Profile door',w:20,h:30,count:1,thickness:6});
 const lines=purchaseLines(r);
 assert.equal(lines.find(x=>x.key==='glass:8mm')?.quantity,box.shelves[1].w*shelfDepth(box)/144);
 assert.equal(lines.find(x=>x.key==='glass:6mm')?.quantity,20*30/144);
});
