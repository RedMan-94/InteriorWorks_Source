import type {MasterUnit,Piece} from './engine';
type MasterComponent=MasterUnit['components'][number];
export type MasterAssembly=MasterComponent&{assemblyType:'casework'|'drawer'|'component'};
// Drawer walls, bottom and decorative front form their own assembly. The permanent
// dividers and automatic top shelves remain with the Boxing that supports them.
export function masterAssemblies(component:MasterComponent):MasterAssembly[]{
 const drawers=new Map<string,{row:number,index:number,pieces:Piece[]}>(),casework:Piece[]=[];
 for(const p of component.pieces){
 const match=p.label.match(/^(?:Box (\d+) \/ )?Drawer row (\d+) \/ (\d+) (?:left|right|front|back|bottom|decorative front)$/);
 if(!match){casework.push(p);continue;}
 const key=(match[1]||'')+':'+match[2]+':'+match[3],old=drawers.get(key);
 if(old)old.pieces.push(p);else drawers.set(key,{row:Number(match[2]),index:Number(match[3]),pieces:[p]});
 }
 if(!drawers.size)return [{...component,assemblyType:'component'}];
 const out:MasterAssembly[]=casework.length?[{...component,name:component.name+' · Boxing & shelves',pieces:casework,assemblyType:'casework'}]:[];
 for(const [key,d] of drawers){
 const posed=d.pieces.filter(p=>p.pose).map(p=>p.pose!);
 const span=(axis:'x'|'y'|'z',size:'w'|'h'|'d')=>posed.length?Math.max(1,Math.max(...posed.map(p=>p[axis]+p[size]))-Math.min(...posed.map(p=>p[axis]))):1;
 out.push({...component,id:component.id+':drawer:'+key,name:component.name+' · Drawer '+d.row+'.'+d.index,pieces:d.pieces,l:span('x','w'),h:span('y','h'),d:span('z','d'),assemblyType:'drawer'});
 }
 return out;
}
type Point={x:number,y:number};
export type MasterScene={faces:{points:Point[],fill:string}[],labels:{id:string,x:number,y:number,anchor:Point,side:'left'|'right'}[]};
const iso=(x:number,y:number,z:number):Point=>({x:x+.65*z,y:-y-.35*z});
export function masterScene(component:MasterUnit['components'][number],exploded=true):MasterScene{
 const gap=Math.max(component.l,component.h,component.d)*.07+1;
 const posed=component.pieces.filter(p=>p.pose).map(p=>{
 const q={...p.pose!},label=p.label.toLowerCase().replace(/ · part \d+$/,'');
 if(exploded){
 if(/\bleft$/.test(label))q.x-=gap;
 else if(/\bright$/.test(label))q.x+=gap;
 else if(/\btop$/.test(label))q.y+=gap;
 else if(/\bbottom$/.test(label))q.y-=gap;
 else if(label.includes('decorative front')||label.startsWith('sliding door'))q.z+=gap*2;
 else if(/^drawer row \d+ \/ \d+ front$/.test(label))q.z+=gap;
 else if(component.kind==='Closed Boxing'&&label==='front')q.z+=gap*1.5;
 else if(/back$/.test(label))q.z-=gap*1.5;
 else if(label.includes('grid'))q.z-=gap;
 else if(label.includes('rear border'))q.z+=component.kind==='Paneling'?Math.max(component.l,component.h)*.85:-gap;
 else if(component.kind==='Paneling')q.z+=Math.max(component.l,component.h)*1.8;
 else if(label.startsWith('horizontal shelf'))q.z+=gap*.6;
 else if(label.startsWith('vertical shelf')||label.includes('mid-support'))q.y+=gap*.45;
 }
 const {x,y,z,w,h,d}=q;
 const points=[iso(x,y,z),iso(x+w,y,z),iso(x+w,y+h,z),iso(x,y+h,z),iso(x,y,z+d),iso(x+w,y,z+d),iso(x+w,y+h,z+d),iso(x,y+h,z+d)];
 return {p,q,points,center:iso(x+w/2,y+h/2,z+d/2)};
 });
 if(!posed.length)return {faces:[],labels:[]};
 const all=posed.flatMap(a=>a.points),minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
 const scale=Math.min(610/Math.max(1,maxX-minX),440/Math.max(1,maxY-minY));
 const dx=(1000-(maxX-minX)*scale)/2,dy=(600-(maxY-minY)*scale)/2;
 const project=(p:Point)=>({x:dx+(p.x-minX)*scale,y:dy+(p.y-minY)*scale});
 const ordered=[...posed].sort((a,b)=>(a.q.z+a.q.d/2)*.7+(a.q.x+a.q.w/2)*.2+(a.q.y+a.q.h/2)*.1-((b.q.z+b.q.d/2)*.7+(b.q.x+b.q.w/2)*.2+(b.q.y+b.q.h/2)*.1));
 const faces=ordered.flatMap(a=>{const palette=/· 12mm$/.test(a.p.material)?['#c7b18b','#e4d3b9','#eee2ce']:/· 8mm$/.test(a.p.material)?['#a0bcb5','#c9dfd9','#dfebe6']:['#a2b58e','#d2dfc2','#e4ebda'];return [[1,5,6,2],[3,2,6,7],[4,5,6,7]].map((ids,i)=>({points:ids.map(j=>project(a.points[j])),fill:palette[i]}));});
 const labels:MasterScene['labels']=[];
 for(const side of ['left','right'] as const){const group=posed.map(a=>({id:a.p.id,anchor:project(a.center)})).filter(a=>side==='left'?a.anchor.x<500:a.anchor.x>=500).sort((a,b)=>a.anchor.y-b.anchor.y);
 const step=Math.min(23,500/Math.max(1,group.length));const start=(600-step*(group.length-1))/2;
 group.forEach((a,i)=>labels.push({...a,x:side==='left'?18:854,y:start+i*step,side}));}
 return {faces,labels};
}
