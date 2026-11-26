import type {Placed} from './lib/engine';
import {cutLabel} from './lib/pdf';
export function SheetPieceLabel({piece,index}:{piece:Placed,index:number}){
 const l=cutLabel(piece,11.4),font=l.font/11.4;
 return l.callout?<text x={piece.x+piece.pw/2} y={piece.y+piece.ph/2} textAnchor="middle" dominantBaseline="middle" fontSize=".6" fill="#34412e">{index+1}</text>:<g transform={'translate('+(piece.x+piece.pw/2)+' '+(piece.y+piece.ph/2)+')'+(l.rotation?' rotate(-90)':'')}><text textAnchor="middle" fontSize={font} fill="#34412e">{l.lines.map((line,i)=><tspan key={i} x="0" y={(i-(l.lines.length-1)/2)*font*1.2+font*.3}>{line}</tspan>)}</text></g>;
}
