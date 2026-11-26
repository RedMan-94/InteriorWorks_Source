import type {Component,LegCoverSide} from './model';
import {legHeight} from './model.ts';
import type {BoardPose} from './engine';
export const legCoverSides:LegCoverSide[]=['front','back','left','right'];
export const coverSideLabel=(side:LegCoverSide)=>side[0].toUpperCase()+side.slice(1);
export function activeLegCoverSides(c:Component):LegCoverSide[]{return legHeight(c)>0&&c.legCovers?.enabled?legCoverSides.filter(side=>c.legCovers!.sides?.includes(side)):[];}
// Disabled covers retain their finish choices for reuse without becoming removed-face errors.
export function inactiveLegCoverFace(c:Component,key:string){return key.startsWith('leg-cover:')&&!activeLegCoverSides(c).includes(key.split(':')[2] as LegCoverSide);}
export type LegCoverPanel={side:LegCoverSide,label:string,w:number,h:number,panelKey:string,pose:BoardPose};
export function legCoverPanels(c:Component,L:number,boxIndex=0,x0=0,boxCount=1):LegCoverPanel[]{
 const h=legHeight(c),t=8/25.4;
 return activeLegCoverSides(c).filter(side=>(side!=='left'||boxIndex===0)&&(side!=='right'||boxIndex===boxCount-1)).map(side=>{const across=side==='front'||side==='back',w=across?L:c.d;
 return {side,label:'Leg cover · '+coverSideLabel(side),w,h,panelKey:'leg-cover:'+(across?boxIndex:0)+':'+side,pose:across?{x:x0,y:-h,z:side==='front'?c.d-t:0,w:L,h,d:t}:{x:x0+(side==='right'?L-t:0),y:-h,z:0,w:t,h,d:c.d}};
 });
}
