import {placedOutline,patternNames,patternRegions} from './laminate-patterns.ts';
import type {Result,Placed,Line} from './engine';
import {finishName,finishFaceTitle} from './finishes.ts';
import {constructionViews} from './construction-views.ts';
import type {ViewRect} from './construction-views';
function ascii(s:string){return s.replace(/(\d)([½¼¾])/g,'$1 $2').replace(/²/g,'2').replace(/³/g,'3').replace(/⅛/g,'1/8').replace(/½/g,'1/2').replace(/¼/g,'1/4').replace(/¾/g,'3/4').replace(/′|’/g,"'").replace(/″/g,'"').replace(/—|–|·|−/g,'-').replace(/×/g,'x').replace(/[^\x20-\x7E]/g,'?');}
function escape(s:string){return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
const n=(v:number)=>String(Number(v.toFixed(3)));
const text=(x:number,y:number,size:number,s:string)=>`BT /F1 ${size} Tf ${n(x)} ${n(y)} Td (${escape(s)}) Tj ET\n`;
const rotatedText=(x:number,y:number,size:number,s:string)=>`BT /F1 ${size} Tf 0 1 -1 0 ${n(x)} ${n(y)} Tm (${escape(s)}) Tj ET\n`;
const line=(x:number,y:number,x2:number,y2:number)=>`${n(x)} ${n(y)} m ${n(x2)} ${n(y2)} l S\n`;
const rect=(x:number,y:number,w:number,h:number,fill=false)=>`${n(x)} ${n(y)} ${n(w)} ${n(h)} re ${fill?'B':'S'}\n`;
const wrap=(value:string,max:number)=>{const out:string[]=[];let row='';for(const word of ascii(value).split(/\s+/)){if(row&&row.length+word.length+1>max){out.push(row);row='';}row+=(row?' ':'')+word;}if(row)out.push(row);return out;};
type Page={content:string,w:number,h:number};
export type CutLabel={rotation:boolean,lines:string[],font:number,callout:boolean};
// Orient the annotation along the long side of strips rather than producing separate piece images.
export function cutLabel(q:Placed,scale:number):CutLabel{
 const size=n(q.pw)+' x '+n(q.ph)+' in';
 for(const rotation of [false,true]){
 const w=(rotation?q.ph:q.pw)*scale-5,h=(rotation?q.pw:q.ph)*scale-3;
 for(const lines of [[q.id,size],[q.id+' | '+size]]){
 const font=Math.min(9,w/(Math.max(...lines.map(l=>l.length))*.56),h/(lines.length*1.2));
 if(font>=6)return {rotation,lines,font,callout:false};
 }}
 return {rotation:false,lines:[q.id,size],font:7,callout:true};
}
export function materialRows(result:Result,onlyGroup?:string):Line[]{
 const groups=[...new Set(result.sheets.filter(s=>!onlyGroup||s.group===onlyGroup).map(s=>s.group))];
 const rows:Line[]=groups.map(g=>{const sheets=result.sheets.filter(s=>s.group===g);return {name:g,value:sheets.length,unit:'sheets',note:'96 x 48 in stock'};});
 if(onlyGroup)return rows;
 rows.push(...result.hardware.map(h=>({...h})));
 const glass=new Map<string,number>();for(const g of result.glass){const key=(g.thickness??6)+'mm glass · '+n(g.w)+' x '+n(g.h)+' in';glass.set(key,(glass.get(key)||0)+g.count);}
 rows.push(...[...glass].map(([name,value])=>({name,value,unit:'pcs',note:'Vendor cut size'})));
 return rows;
}
export function cuttingPDF(result:Result,onlyGroup?:string,masterUnitId?:string):Uint8Array{
 const pages:Page[]=[];
 const add=(content:string,w=842,h=595)=>pages.push({content,w,h});
 const header=(title:string,subtitle:string)=>'0.12 0.18 0.14 rg\n'+text(38,558,18,title)+text(38,538,10,subtitle)+'0.8 0.83 0.77 RG 0.5 w '+line(38,525,804,525);
 const sheets=masterUnitId?[]:result.sheets.filter(s=>!onlyGroup||s.group===onlyGroup);
 if(!masterUnitId){
 const rows=materialRows(result,onlyGroup);let p='',y=0;
 const start=()=>{p=header('MATERIAL SUMMARY / '+result.scope,onlyGroup?'Selected material | Quantities from the prepared cutting layouts':'Sheets, hardware and consumables | Base quantities; no unspecified pack rounding');p+=text(38,505,9,'MATERIAL / ITEM')+text(615,505,9,'QUANTITY');y=485;};start();
 for(const row of rows){const name=wrap(row.name,94),note=row.note?wrap(row.note,100):[],height=name.length*12+note.length*10+10;
 if(y-height<62){add(p);start();}
 for(const l of name){p+=text(38,y,10,l);y-=12;}
 const amount=row.value===null?'Input required':(Number.isInteger(row.value)?String(row.value):n(row.value))+' '+row.unit;
 p+=text(615,y+12,10,amount);
 for(const l of note){p+='0.4 0.45 0.36 rg\n'+text(48,y,8,l);y-=10;}p+='0.12 0.18 0.14 rg\n';y-=10;
 }
 if(!rows.length)p+=text(38,y,10,'No materials required in this calculation.');
 add(p+text(38,45,8,'Unspecified adhesive consumption and fittings remain Input required. Confirm these before ordering.'));
 }
 // One set of orthographic views per main component. All board materials are included in the full pack.
 if(!onlyGroup)for(const unit of result.drawings||[]){if(masterUnitId&&unit.id!==masterUnitId)continue;
 for(const item of unit.components){const c=item.config,parts=masterUnitId?item.pieces.filter(p=>p.material.startsWith('Plywood')):item.pieces;if(!parts.length)continue;
 const v=constructionViews(c,parts,!!masterUnitId),subtitle=unit.name+' / '+c.name+' | '+(masterUnitId?'Plywood only':'All board materials')+' | Dimensions in inches; do not scale';
 let p=header('PLAN / ELEVATION / SECTION',subtitle);
 const views:[string,ViewRect[],number,number,number,number,number,number][]=[
 ['ELEVATION - internal; doors dashed',v.elevation,65,282,285,205,v.width,v.height],
 ['PLAN - top view; hidden lines dashed',v.plan,408,358,155,129,v.width,v.depth],
 ['SECTION A-A',v.section,650,282,108,205,v.depth,v.height]
 ];
 for(const [title,shapes,x,y,maxW,maxH,W,H] of views){const sc=Math.min(maxW/Math.max(W,.01),maxH/Math.max(H,.01)),w=W*sc,h=H*sc;
 p+=text(x-15,509,9,title);
 for(const q of [...shapes.filter(s=>!s.hidden),...shapes.filter(s=>s.hidden)]){p+=(q.hidden?'[3 2] 0 d 0.6 0.55 0.43 RG 0.35 w\n':'[] 0 d 0.35 0.43 0.29 RG 0.45 w 0.91 0.93 0.87 rg\n');p+=rect(x+q.x*sc,y+q.y*sc,q.w*sc,q.h*sc,!q.hidden);}
 p+='[] 0 d 0.35 0.43 0.29 RG 0.4 w 0.12 0.18 0.14 rg\n';
 // Overall dimension lines are perpendicular to their measured edge.
 p+=line(x,y-14,x+w,y-14)+line(x,y-18,x,y-10)+line(x+w,y-18,x+w,y-10)+text(x+w/2-15,y-27,8,n(W)+' in');
 p+=line(x+w+14,y,x+w+14,y+h)+line(x+w+10,y,x+w+18,y)+line(x+w+10,y+h,x+w+18,y+h)+rotatedText(x+w+27,y+h/2-12,8,n(H)+' in');
 if(title.startsWith('ELEVATION')){
 p+='0.52 0.38 0.2 RG 1.2 w\n';for(const handle of v.handles)p+=line(x+handle.x*sc,y+handle.y*sc,x+handle.x2*sc,y+handle.y2*sc);
 p+='0.4 0.45 0.36 RG [5 2 1 2] 0 d 0.4 w\n'+line(x+v.sectionAt*sc,y-4,x+v.sectionAt*sc,y+h+4)+'[] 0 d\n0.12 0.18 0.14 rg\n'+text(x+v.sectionAt*sc+3,y+h+7,8,'A')+text(x+v.sectionAt*sc+3,y-8,8,'A');
 // Shelf names and elevations share the actual panel positions, without X/Y prefixes.
 for(const q of shapes.filter(s=>/Horizontal shelf|Vertical shelf|automatic top shelf|divider/.test(s.label))){const horizontal=q.w>q.h,label=/Horizontal shelf/.test(q.label)?q.label.replace('Horizontal shelf','Shelve'):/Vertical shelf/.test(q.label)?q.label.replace('Vertical shelf','Shelve'):/divider/.test(q.label)?'Divider':'Top support';
 if(horizontal)p+=text(x+q.x*sc+2,y+(q.y+q.h)*sc+3,6.5,label+' / '+n(q.w)+' in');
 else if(q.h*sc>50)p+=rotatedText(x+(q.x+q.w)*sc+7,y+q.y*sc+3,6.5,label);
 }
 }
 }
 p+='0.12 0.18 0.14 rg\n'+text(38,239,9,'DETAILS / sizes and fixing positions')+text(415,239,8,'Section A-A at '+n(v.sectionAt)+' in from component left');
 const details=(result.construction||[]).filter(d=>d.unitId===unit.id&&d.componentId===c.id);
 const lights=(result.lights||[]).filter(l=>l.unitId===unit.id&&l.componentId===c.id);
 const notes=details.map(d=>d.label.replace(/Horizontal shelf|Vertical shelf/,'Shelve')+' | '+d.size+' | '+d.position);
 if(c.defaultExternalFinishId){const f=result.finishSpecs?.find(f=>f.id===c.defaultExternalFinishId);notes.push('Default external laminate: '+(f?finishName(f):'Input required')+'. Individual face assignments override this finish.');}
 for(const [key,a] of Object.entries(c.faceFinishes||{})){
 const face=result.finishFaces?.find(f=>f.unitId===unit.id&&f.componentId===c.id&&f.key===key);if(!face)continue;
 const finish=result.finishSpecs?.find(f=>f.id===a.finishId),title=finishFaceTitle(face);
 if(a.pattern){const p=a.pattern,measurements:string[]=[];
 if(p.preset>=2&&p.preset<=10||p.preset>=14&&p.preset<=16){p.strips.forEach((s,i)=>measurements.push('strip '+(i+1)+' centre '+n(s.position)+', width '+n(s.width)));if(p.preset>=14)p.vertical.forEach((s,i)=>measurements.push('vertical '+(i+1)+' centre '+n(s.position)+', width '+n(s.width)));if(p.preset>=8&&p.preset<=10)measurements.push('angle '+n(p.angle)+' deg from horizontal; centres along perpendicular from minimum face projection');else measurements.push(p.preset>=5&&p.preset<=7?'centres from left':'horizontal centres above bottom; vertical centres from left');}
 if(p.preset>=11&&p.preset<=13)p.borders.forEach((b,i)=>measurements.push('border '+(i+1)+' inset '+n(b.inset)+', width '+n(b.width)));
 if(p.preset===17)measurements.push(p.columns+' columns / '+p.rows+' rows; column divisions from left '+(p.cutsX||[]).map(n).join(', ')+'; row divisions above bottom '+(p.cutsY||[]).map(n).join(', '));
 if(p.preset===18||p.preset===19)measurements.push('cell '+n(p.cellWidth)+' x '+n(p.cellHeight)+'; offset left '+n(p.offsetX)+', bottom '+n(p.offsetY));
 if(p.preset===20)measurements.push('centre left '+n(p.centerX)+', bottom '+n(p.centerY)+'; radii '+p.radii.map(n).join(', '));
 notes.push('Laminate '+title+' | Pattern '+p.preset+': '+patternNames[p.preset-1]+' | '+measurements.join('; ')+' in.');
 const byFinish=new Map<string,string[]>();for(const region of patternRegions(p,face.w,face.h)){const id=region.finishId||a.finishId||c.defaultExternalFinishId,finish=result.finishSpecs?.find(f=>f.id===id),name=finish?finishName(finish):c.externalFinish,list=byFinish.get(name)||[];list.push(region.label);byFinish.set(name,list);}for(const [finish,labels] of byFinish)notes.push('Laminate '+title+' | '+finish+' : '+labels.join(', ')+'.');
 }
 if(a.finishId&&!a.pattern)notes.push('Laminate '+title+' | Base '+(finish?finishName(finish):'Input required')+'.');
 for(const [i,z] of (a.zones||[]).entries()){const f=result.finishSpecs?.find(f=>f.id===z.finishId);notes.push('Laminate '+title+' | Area '+(i+1)+' '+(f?finishName(f):'Input required')+' | '+n(z.w)+' x '+n(z.h)+' in; left '+n(z.x)+' in; bottom '+n(z.y)+' in from face bottom-left.');}
 }

 // Profile-light positions are already part of the single construction register; include panel size as a compact note.
 for(const l of lights)notes.push(l.label+' host '+l.pieceId+': panel '+n(l.panelW)+' x '+n(l.panelH)+' in; '+l.faceLabel+'. Offsets locate the light bottom-left.');
 if(!notes.length)notes.push(c.kind+' | '+n(v.width)+' W x '+n(c.h)+' H x '+n(v.depth)+' D in. Board IDs and cut sizes are on the cutting sheets.');
 let y=221;
 for(const note of notes){const lines=wrap(note,154),height=lines.length*10+6;
 if(y-height<54){add(p);p=header('CONSTRUCTION DETAILS',subtitle);y=500;}
 for(const l of lines){p+=text(38,y,8,l);y-=10;}y-=6;
 }
 add(p);
 }
 }
 for(const sheet of sheets){
 // A3 gives thin strips enough room for a legible, rotated dimension label.
 const keyColumns=[0,1,2].map(col=>sheet.pieces.slice(col*Math.ceil(sheet.pieces.length/3),(col+1)*Math.ceil(sheet.pieces.length/3)));
 const keyHeight=Math.max(0,...keyColumns.map(items=>items.reduce((h,q)=>h+wrap(q.id+' | '+q.unit+' / '+q.component+' / '+q.label+(cutLabel(q,11.4).callout?'999. | '+n(q.pw)+' x '+n(q.ph)+' in':''),70).length*9+4,0)));
 const extra=Math.max(0,keyHeight-112),W=1191,H=842+extra,x=48,y=205+extra,scale=11.4;
 let p='0.12 0.18 0.14 rg\n'+text(38,802+extra,20,'CUTTING DIAGRAM / '+sheet.material)+text(38,779+extra,11,result.scope+' | Sheet '+sheet.index+' | '+sheet.pieces.length+' pieces | '+n(100*sheet.used/4608)+'% utilisation');
 p+='0.97 0.97 0.94 rg 0.35 0.43 0.29 RG 0.5 w '+rect(x,y,96*scale,48*scale,true);
 const callouts:Placed[]=[];
 for(const q of sheet.pieces){const xx=x+q.x*scale,yy=y+(48-q.y-q.ph)*scale,w=q.pw*scale,h=q.ph*scale,label=cutLabel(q,scale);
 p+='0.85 0.9 0.8 rg 0.36 0.46 0.31 RG 0.4 w '+rect(xx,yy,w,h,true)+'0.12 0.18 0.14 rg\n';
 if(q.cutShape){p+='0.6 0.3 0.12 RG 0.6 w\n';for(const e of placedOutline(q))p+=line(x+e.a.x*scale,y+(48-e.a.y)*scale,x+e.b.x*scale,y+(48-e.b.y)*scale);p+='0.36 0.46 0.31 RG 0.12 0.18 0.14 rg\n';}
 if(label.callout){callouts.push(q);const short=String(sheet.pieces.indexOf(q)+1);p+=text(xx+Math.max(0,(w-short.length*3.5)/2),yy+Math.max(1,h/2-2),Math.min(7,Math.max(3,h-1)),short);continue;}
 const across=label.rotation?h:w,along=label.rotation?w:h,total=label.lines.length*label.font*1.2;
 label.lines.forEach((l,i)=>{const tx=(across-l.length*label.font*.52)/2,ty=(along+total)/2-(i+1)*label.font*1.2;
 p+=label.rotation?rotatedText(xx+w-ty,yy+tx,label.font,l):text(xx+tx,yy+ty,label.font,l);});
 }
 p+=text(48,183+extra,10,'96 x 48 in stock | 1/16 in cutting gap | Laminate sizes include 1/8 in trim on every edge.')+text(48,166+extra,9,'Labels show horizontal x vertical cut sizes as placed. Brown outlines = finished pattern shapes inside trimmed blanks. Tiny-piece references below. Do not scale.');
 keyColumns.forEach((items,col)=>{let yy=145+extra;for(const q of items){const ref=callouts.indexOf(q),entry=(ref>=0?(sheet.pieces.indexOf(q)+1)+'. ':'')+q.id+' | '+q.unit+' / '+q.component+' / '+q.label+(ref>=0?' | '+n(q.pw)+' x '+n(q.ph)+' in':'');
 for(const l of wrap(entry,70)){p+=text(48+col*365,yy,7,l);yy-=9;}yy-=4;
 }});
 add(p,W,H);
 }
 if(!onlyGroup&&!masterUnitId&&result.profileStocks.length){
 let p=header('PROFILE CHANNEL / STOCK CUTS',result.scope+' | 120 in stock | 45 degree mitres, long-point dimensions'),y=500;
 for(const [i,s] of result.profileStocks.entries()){const lines=wrap('Stock '+(i+1)+': '+s.items.map(x=>n(x.length)+' in').join(' + ')+' | Remaining '+n(s.remaining)+' in',133);
 if(y-lines.length*13<60){add(p);p=header('PROFILE CHANNEL / STOCK CUTS',result.scope);y=500;}
 for(const l of lines){p+=text(38,y,10,l);y-=13;}y-=10;
 }add(p);
 }
 if(!pages.length)add(header('CONSTRUCTION PACK',result.scope)+text(38,500,12,'No cutting layouts in this calculation.'));
 // Stable page numbers and independent text objects prevent content inheriting drawing transforms.
 pages.forEach((p,i)=>p.content+='[] 0 d 0.4 0.45 0.36 rg\n'+text(38,25,8,new Date(result.createdAt).toISOString().slice(0,10)+' | '+(i+1)+' / '+pages.length));
 const objects:string[]=['','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],kids:number[]=[];
 for(const page of pages){const pageId=objects.length+1,streamId=pageId+1;kids.push(pageId);objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+page.w+' '+page.h+'] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>');objects.push('<< /Length '+page.content.length+' >>\nstream\n'+page.content+'\nendstream');}
 objects[0]='<< /Type /Catalog /Pages 2 0 R >>';objects[1]='<< /Type /Pages /Count '+kids.length+' /Kids ['+kids.map(i=>i+' 0 R').join(' ')+'] >>';
 let out='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(out.length);out+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=out.length;out+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return new TextEncoder().encode(out);
}
export function downloadPDF(result:Result,group?:string){const bytes=cuttingPDF(result,group),blob=new Blob([new Uint8Array(bytes).buffer],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(result.scope+' - '+(group||'construction pack')).replace(/[^a-zA-Z0-9 -]/g,'').slice(0,100)+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function downloadMasterPDF(result:Result,unitId:string){const unit=result.masters?.find(u=>u.id===unitId);if(!unit)return;const bytes=cuttingPDF(result,undefined,unitId),blob=new Blob([new Uint8Array(bytes).buffer],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(unit.name+' - plywood views').replace(/[^a-zA-Z0-9 -]/g,'').slice(0,100)+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
