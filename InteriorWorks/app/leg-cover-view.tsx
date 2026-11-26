'use client';
import type {Component,ExternalFinish} from './lib/model';
import {legHeight} from './lib/model';
import {legCoverPanels} from './lib/leg-covers';
import {FinishSurface} from './finish-editor';
// Front projection: the front cover hides the legs; side covers appear edge-on.
export function LegCoverDrawing({c,L,y,x=0,boxIndex=0,boxCount=1,finishes=[]}:{c:Component,L:number,y:number,x?:number,boxIndex?:number,boxCount?:number,finishes?:ExternalFinish[]}){
 const sides=legCoverPanels(c,L,boxIndex,0,boxCount).map(p=>p.side),h=legHeight(c),t=8/25.4;if(!sides.length)return null;
 return <g aria-label="Leg covers · 8mm" pointerEvents="none">
 {sides.includes('back')&&<g aria-label="Back leg cover"><rect x={x} y={y} width={L} height={h} fill="none" stroke="#7b8771" strokeWidth=".15" strokeDasharray=".7 .5"/></g>}
 {(['left','right'] as const).filter(side=>sides.includes(side)).map(side=><rect key={side} aria-label={side+' leg cover'} x={x+(side==='right'?L-t:0)} y={y} width={t} height={h} fill="#a6b79c" stroke="#6e7b62" strokeWidth=".12"/>)}
 {sides.includes('front')&&<g aria-label="Front leg cover"><rect x={x} y={y} width={L} height={h} fill="#d6c7ad" stroke="#829073" strokeWidth=".15"/><FinishSurface c={c} finishes={finishes} faceKey={'leg-cover:'+boxIndex+':front:b'} x={x} y={y} w={L} h={h}/></g>}
 </g>;
}
