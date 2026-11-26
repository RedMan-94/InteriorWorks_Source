'use client';
import {useState} from 'react';
import {Box,Frame,PanelTop,Columns3,ChevronDown,Layers,ArrowLeft,ArrowRight} from 'lucide-react';
import {fmt,newComponent,kinds,unitTypes} from './lib/model';
import type {Unit,Component,Kind,ExternalFinish} from './lib/model';
import {ComponentForm,LayoutEditor} from './editors';
import {positionUnitComponent,reorderUnitLayer,unitLayerOrder} from './lib/unit-layout';

const icons={Boxing:Box,Framing:Frame,Paneling:PanelTop,'Closed Boxing':Columns3};
const descriptions={Boxing:'Storage shell',Framing:'Door support',Paneling:'Wall & layers','Closed Boxing':'Enclosed element'};

export function UnitDesigner({unit,finishes=[],catalogue=false,onChange,onEditFinish}:{unit:Unit,finishes?:ExternalFinish[],catalogue?:boolean,onChange:(u:Unit)=>void,onEditFinish?:(id:string,key:string)=>void}){
 const [active,setActive]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const component=unit.components.find(c=>c.id===active)||unit.components[0];
 const layers=unitLayerOrder(unit),layerComponents=layers.map(id=>unit.components.find(c=>c.id===id)!);
 const updateUnit=(fn:(u:Unit)=>void)=>{const draft=structuredClone(unit);fn(draft);onChange(draft);};
 const updateComponent=(c:Component)=>updateUnit(u=>{u.components=u.components.map(x=>x.id===c.id?c:x);});
 const moveLayer=(id:string,targetId:string)=>{const next=reorderUnitLayer(unit,id,targetId);if(next!==unit){onChange(next);setActive(id);setSelected(null);}};
 const quantity=(kind:Kind,n:number)=>{
  const existing=unit.components.filter(c=>c.kind===kind);
  if(n<existing.length&&!window.confirm('Remove '+(existing.length-n)+' '+kind+' component(s) and their entries?'))return;
  const next=existing.slice(0,n);
  while(next.length<n)next.push(newComponent(kind,next.length+1));
  updateUnit(u=>{u.components=kinds.flatMap(k=>k===kind?next:u.components.filter(c=>c.kind===k));});
  if(n>existing.length)setActive(next.at(-1)!.id);
  setSelected(null);
 };
 return <div className="editor-grid"><div className="forms-column"><section className="white-card setup-card"><div className="section-label"><span className="step-circle">1</span><h2>Define Unit Name</h2></div><input className="unit-name-input" aria-label="Define Unit Name" placeholder="e.g. Living room T.V. unit" value={unit.name} onChange={e=>updateUnit(u=>u.name=e.target.value)}/>{!unit.name&&<div className="name-suggestions">{unitTypes.slice(0,5).map(n=><button key={n} onClick={()=>updateUnit(u=>u.name=n)}>{n}</button>)}</div>}
 <div className="section-label second"><span className="step-circle">2</span><h2>Select Main Components</h2><span className="muted">All optional</span></div><div className="component-picker">{kinds.map(k=>{const Icon=icons[k],count=unit.components.filter(c=>c.kind===k).length;return <div key={k} className={'component-choice '+(count?'chosen':'')}><label><input aria-label={'Select '+k} type="checkbox" disabled={!unit.name.trim()} checked={count>0} onChange={e=>quantity(k,e.target.checked?1:0)}/><Icon size={20}/><span><strong>{k}</strong><small>{descriptions[k]}</small></span></label><select aria-label={k+' quantity'} disabled={!count} value={count||1} onChange={e=>quantity(k,Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></div>;})}</div><p className="field-note">Up to four of each type. Every instance has its own dimensions and sub-components.</p></section>
 {unit.components.map(c=>{const Icon=icons[c.kind];return <details className={'component-section white-card '+(component?.id===c.id?'focused':'')} key={c.id} open><summary onClick={()=>{setActive(c.id);setSelected(null);}}><span className={'component-symbol '+c.kind.toLowerCase().replace(' ','-')}><Icon size={20}/></span><div><strong>{c.name}</strong><small>{c.l&&c.h?fmt(c.l)+(c.kind==='Boxing'||c.kind==='Closed Boxing'?' × '+fmt(c.d):'')+' × '+fmt(c.h):'Enter dimensions to begin'} · {c.material}</small></div><ChevronDown size={18}/></summary><ComponentForm c={c} structureOnly={catalogue} finishes={finishes} onChange={updateComponent} onFocus={()=>setActive(c.id)}/></details>;})}

 {!unit.components.length&&unit.name&&<div className="component-hint"><Layers size={25}/><p>Select your first main component above.<br/>Its settings will open here.</p></div>}</div>
 <aside className="layout-column"><div className="white-card live-layout"><div className="card-title"><div><p className="eyebrow">DESIGN AS YOU MEASURE</p><h2>{unit.components.length>1?'Live unit layout':'Live layout'}</h2></div><span className="live-badge"><span/> Interactive</span></div>{unit.components.length>1&&<><div className="canvas-tabs" aria-label="Component layers, front to back">{layerComponents.map((c,index)=><div key={c.id} className="layer-chip" draggable onDragStart={e=>e.dataTransfer.setData('text/plain',c.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();moveLayer(e.dataTransfer.getData('text/plain'),c.id);}}><button type="button" className={component?.id===c.id?'selected':''} onClick={()=>{setActive(c.id);setSelected(null);}}>{c.name}</button><button type="button" className="layer-arrow" aria-label={'Move '+c.name+' forward'} title="Move forward" disabled={index===0} onClick={()=>moveLayer(c.id,layers[index-1])}><ArrowLeft size={12}/></button><button type="button" className="layer-arrow" aria-label={'Move '+c.name+' backward'} title="Move backward" disabled={index===layers.length-1} onClick={()=>moveLayer(c.id,layers[index+1])}><ArrowRight size={12}/></button></div>)}</div><p className="layer-hint">Front ← drag components or use arrows → Back</p></>}{component?<LayoutEditor c={component} onEditFinish={onEditFinish&&((key)=>onEditFinish(component.id,key))} finishes={finishes} unit={unit} onChange={updateComponent} selection={selected} onSelect={setSelected} onActivate={id=>{setActive(id);setSelected(null);}} onPosition={(id,x,y)=>updateUnit(u=>{u.components=positionUnitComponent(u,id,x,y).components;})}/>:<div className="canvas-empty"><Layers size={40}/><h3>A clearer view of your design.</h3><p>Select a component to see its measured layout here.</p></div>}<div className="canvas-footer"><span><i className="legend-square"/>18mm board / support</span><span><i className="legend-square warm"/>Drawer / design layer</span></div></div></aside></div>;
}
