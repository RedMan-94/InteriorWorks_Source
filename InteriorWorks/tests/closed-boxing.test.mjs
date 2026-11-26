import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calculate} from '../app/lib/engine.ts';
import {constructionViews} from '../app/lib/construction-views.ts';
import {newComponent,newProject} from '../app/lib/model.ts';
import {unitPlacements,unitComponentOrigin} from '../app/lib/unit-layout.ts';

function fixture(l,d,h){
 const c=newComponent('Closed Boxing',1),p=newProject('Closed Boxing example');
 Object.assign(c,{l,d,h});
 p.units=[{id:'sample',name:'Sample unit',components:[c]}];return {p,c};
}
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);
function checkStock(result){
 assert.deepEqual(result.errors,[]);
 const cuts=result.sheets.flatMap(s=>s.pieces);
 assert.equal(cuts.length,result.pieces.length);
 for(const p of cuts)assert(p.x+p.pw<=96+1e-7&&p.y+p.ph<=48+1e-7);
}

test('the 5-foot Puja box and existing slender boxes keep six continuous 18mm faces',()=>{
 for(const dims of [[60,9,3],[6,6,94]]){
 const {p,c}=fixture(...dims),before=structuredClone(p),r=calculate(p);
 checkStock(r);assert.deepEqual(p,before);
 assert.equal(r.pieces.filter(p=>p.kind==='board'&&p.material==='Plywood · 18mm').length,6);
 assert.equal(r.finishFaces.length,6);assert.equal(r.assemblies.length,0);assert.equal(r.areas.internal,0);
 const item=unitPlacements(p.units[0])[0];assert.equal(item.w,c.l);
 assert.deepEqual(unitComponentOrigin(item,c.h,true),unitComponentOrigin(item,c.h,false));
 }
});

test('any axis can reach exactly 8 feet, while larger dimensions and values below 3 inches are rejected',()=>{
 for(let axis=0;axis<3;axis++){
 const dims=[3,3,3];dims[axis]=96;
 const {p,c}=fixture(...dims),r=calculate(p);
 checkStock(r);assert.deepEqual([r.masters[0].components[0].l,r.masters[0].components[0].d,r.masters[0].components[0].h],dims);
 assert.equal(r.pieces.filter(p=>p.kind==='board').length,6);assert(r.pieces.filter(p=>p.kind==='laminate').length>6,'full-length laminate leaves room for trim');
 const dim=['l','d','h'][axis];
 for(const invalid of [96.125,2.875]){
 c[dim]=invalid;
 assert.match(calculate(p).errors[0],/Closed Boxing requires length, width and height each between 3″ and 8′/);
 }
 }
});

test('large closed faces join at stock capacity with continuous finish areas and assembly positions',()=>{
 const {p,c}=fixture(96,96,96);
 c.faceFinishes={'Front:a':{finishId:p.externalFinishes[0].id,zones:[{id:'accent',finishId:p.externalFinishes[1].id,x:40,y:44,w:12,h:8}]}};
 const r=calculate(p),boards=r.pieces.filter(p=>p.kind==='board');
 checkStock(r);assert.equal(boards.length,12);assert.equal(new Set(boards.map(p=>p.panelKey)).size,12);
 close(r.areas.board,384);close(r.areas.external,384);assert.equal(r.areas.internal,0);
 assert.equal(r.assemblies.length,6);
 for(const face of r.assemblies){
 assert.equal(face.parts.length,2);
 close(face.parts.reduce((area,p)=>area+p.w*p.h,0),96*96);
 }
 for(const {pose:q} of boards)assert(q.x>=0&&q.y>=0&&q.z>=0&&q.x+q.w<=96&&q.y+q.h<=96&&q.z+q.d<=96);
 const front=r.finishFaces.find(f=>f.key==='Front:a');
 assert.equal(front.w,96);assert.equal(front.h,96);assert.equal(front.regions.length,2);
 const accents=r.pieces.filter(p=>p.label.startsWith('Front')&&p.label.includes('finish area'));
 close(accents.reduce((area,p)=>area+p.fw*p.fh,0),12*8);
 assert(r.hardware.some(h=>h.name==='Panel-joint backing / fixing'&&h.value===null));
 assert(r.construction.some(d=>d.label==='Front joined face'&&d.position.includes('joint backing')));
});

test('the section drawing shows the panels when the cut lands at a joined face seam',()=>{
 const {p,c}=fixture(80,20,60),r=calculate(p);
 const view=constructionViews(c,r.pieces);
 assert.equal(view.sectionAt,40);
 assert(view.elevation.some(f=>f.label==='Front · part 1'));
 assert(view.section.some(f=>f.label==='Front · part 2'));
});
