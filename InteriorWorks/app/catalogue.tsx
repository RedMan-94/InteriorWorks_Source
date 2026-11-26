'use client';
import {useEffect,useMemo,useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {ArrowLeft,ArrowUpRight,Box,Copy,LibraryBig,Plus,Save,ImagePlus,Trash2} from 'lucide-react';
import type {CatalogueUnit,Project,Unit} from './lib/model';
import {copyUnit,fmt,uid,unitTypes} from './lib/model';
import {unitEnvelope} from './lib/rooms';
import {catalogueEntry} from './lib/catalogue';
import {UnitContextDrawing} from './unit-context';
import {unitDrawingOrder,unitPlacements} from './lib/unit-layout';
import {UnitDesigner} from './unit-designer';
import {calculate} from './lib/engine';
import {IsometricUnit} from './isometric-unit';

const imageUrl=(id:string)=>'/api/catalogue-image?id='+encodeURIComponent(id);
const categoryName=(entry:CatalogueUnit)=>entry.category?.trim()||'Uncategorized';

export function UnitCatalogue({entries,projects,draft,onDraft,onCommit,onBack,backLabel,saving}:{entries:CatalogueUnit[],projects:Project[],draft:CatalogueUnit|null,onDraft:Dispatch<SetStateAction<CatalogueUnit|null>>,onCommit:(entry:CatalogueUnit)=>void,onBack:()=>void,backLabel:string,saving:boolean}){
 const [query,setQuery]=useState(''),[categoryFilter,setCategoryFilter]=useState(''),[existing,setExisting]=useState(''),[errors,setErrors]=useState<string[]>([]),[uploading,setUploading]=useState(false),[imageError,setImageError]=useState('');
 const [allView,setAllView]=useState<{view:'front'|'isometric',revision:number}>({view:'front',revision:0});
 const sources=useMemo(()=>projects.flatMap(p=>p.units.map(u=>({p,u}))),[projects]);
 const categories=useMemo(()=>[...new Set(entries.map(categoryName))].sort((a,b)=>a==='Uncategorized'?-1:b==='Uncategorized'?1:a.localeCompare(b)),[entries]);
 const suggestions=useMemo(()=>[...new Set([...unitTypes,...categories.filter(c=>c!=='Uncategorized')])].sort((a,b)=>a.localeCompare(b)),[categories]);
 const edit=(entry:CatalogueUnit)=>{onDraft(structuredClone(entry));setErrors([]);};
 const create=()=>edit({unit:{id:uid(),name:'',components:[]},finishes:[]});
 const clone=(entry:CatalogueUnit)=>edit({...entry,unit:copyUnit(entry.unit)});
 const uploadImages=async(files:FileList|null)=>{
  if(!draft||!files?.length)return;
  if((draft.images?.length||0)+files.length>6){setImageError('Keep up to 6 display images per unit.');return;}
  setUploading(true);setImageError('');const added:NonNullable<CatalogueUnit['images']>=[];
  for(const file of Array.from(files)){
   if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){setImageError('Choose PNG, JPEG or WebP images under 5 MB each.');break;}
   try{const form=new FormData();form.append('image',file);const response=await fetch('/api/catalogue-image',{method:'POST',body:form});const data=await response.json() as {id?:string,name?:string,error?:string};if(!response.ok||!data.id)throw Error(data.error||'Upload failed.');added.push({id:data.id,name:data.name||file.name});}catch(e){setImageError((e as Error).message);break;}
  }
  if(added.length)onDraft(current=>current?{...current,images:[...(current.images||[]),...added]}:current);setUploading(false);
 };
 const save=()=>{
  if(!draft)return;
  const category=draft.category?.trim().replace(/\s+/g,' ')||'';
  if(category.length>40){setErrors(['Keep the category name under 40 characters.']);return;}
  const matchingCategory=categories.find(c=>c.toLocaleLowerCase()===category.toLocaleLowerCase());
  const entry={...catalogueEntry(draft.unit,draft.finishes),images:draft.images||[],category:matchingCategory||category};
  const validation=calculate({id:'catalogue',name:'Unit Catalogue',client:'',updatedAt:'',settings:{sh:50,marine:38,probond:null,joint:null},units:[entry.unit],externalFinishes:entry.finishes},undefined,{panelsOnly:true,ignoreFaceAssignments:true});
  if(validation.errors.length){setErrors([...new Set(validation.errors)]);return;}
  setErrors([]);onCommit(entry);
 };
 const activeCategory=!categoryFilter||categories.includes(categoryFilter)?categoryFilter:'';
 const shown=entries.filter(e=>(!activeCategory||categoryName(e)===activeCategory)&&e.unit.name.toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="catalogue-page"><div className="page-heading"><div><p className="eyebrow">PHASE 3 · STANDALONE DESIGN STUDIO</p><h1>{draft?'Design a unit':'Unit Catalogue'}</h1><p className="muted">{draft?'Set the construction and dimensions, then save the design for reuse.':'Save your standard units here and place independent copies in any project.'}</p></div><div className="button-row">{draft?<button className="button" onClick={()=>{if(JSON.stringify(draft)===JSON.stringify(entries.find(e=>e.unit.id===draft.unit.id))||window.confirm('Discard the unsaved catalogue edits?')){onDraft(null);setErrors([]);}}}><ArrowLeft size={15}/> Back to catalogue</button>:<><button className="button" onClick={onBack}><ArrowLeft size={15}/> {backLabel}</button><button className="button primary" onClick={create}><Plus size={16}/> New unit design</button></>}</div></div>
 {draft?<><div className="catalogue-save-banner"><div><strong>{draft.unit.name||'Untitled design'}</strong><span>Catalogue updates apply to future placements. Existing project copies stay as they are.</span></div><button className="button primary" disabled={saving||uploading} onClick={save}><Save size={15}/> Save to catalogue</button></div>
 {errors.length>0&&<div className="error-box" role="alert"><h3>Finish these details before saving</h3>{errors.map(e=><p key={e}>{e}</p>)}</div>}
 <section className="white-card catalogue-category-editor"><label className="field"><span>Category</span><input list="catalogue-category-suggestions" maxLength={41} placeholder="e.g. TV Unit, Wardrobe or Puja Unit" value={draft.category||''} onChange={e=>onDraft({...draft,category:e.target.value})}/></label><datalist id="catalogue-category-suggestions">{suggestions.map(c=><option key={c} value={c}/>)}</datalist><p className="field-note">Choose a suggested category or type your own. Leave blank for Uncategorized.</p></section>
 <section className="white-card catalogue-display"><div><h2>Unit display images</h2><p className="muted">Add up to 6 images for this catalogue design. The first image appears on its card. PNG, JPEG or WebP · up to 5 MB each.</p><label className="button small catalogue-upload"><ImagePlus size={15}/>{uploading?'Uploading…':'Upload display images'}<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading} onChange={e=>{void uploadImages(e.target.files);e.target.value='';}}/></label>{imageError&&<p className="notice warning" role="alert">{imageError}</p>}<div className="catalogue-images">{(draft.images||[]).map((img,i)=><div key={img.id}><img src={imageUrl(img.id)} alt={img.name||'Unit display image '+(i+1)}/><button className="icon-button" aria-label={'Remove display image '+(i+1)} onClick={()=>onDraft({...draft,images:draft.images?.filter(v=>v.id!==img.id)})}><Trash2 size={15}/></button><small>{i===0?'Cover image':img.name}</small></div>)}</div></div><div className="catalogue-iso-preview"><h2>Isometric assembly</h2><IsometricUnit unit={draft.unit} finishes={draft.finishes}/><p className="field-note">Assembly preview follows the unit dimensions and component positions.</p></div></section>
 <UnitDesigner key={draft.unit.id} unit={draft.unit} catalogue finishes={draft.finishes} onChange={unit=>{onDraft({...draft,unit});if(errors.length)setErrors([]);}}/>
 <div className="catalogue-end-save"><button className="button primary" disabled={saving||uploading} onClick={save}><Save size={15}/> Save to catalogue</button></div></>:<>
 <div className="catalogue-toolbar"><label className="field"><span>Search saved units</span><input placeholder="e.g. Wardrobe" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="catalogue-all-views" role="group" aria-label="View all catalogue units"><span>View all</span><button aria-pressed={allView.revision>0&&allView.view==='front'} onClick={()=>setAllView(v=>({view:'front',revision:v.revision+1}))}>Front</button><button aria-pressed={allView.revision>0&&allView.view==='isometric'} onClick={()=>setAllView(v=>({view:'isometric',revision:v.revision+1}))}>Isometric</button></div><span>{entries.length} saved design{entries.length===1?'':'s'}</span></div>
 <section className="catalogue-categories" aria-label="Catalogue categories"><h2>Categories</h2><div className="catalogue-category-list"><button aria-pressed={!activeCategory} onClick={()=>setCategoryFilter('')}>All <span>{entries.length}</span></button>{categories.map(c=><button key={c} aria-pressed={activeCategory===c} onClick={()=>setCategoryFilter(c)}>{c} <span>{entries.filter(e=>categoryName(e)===c).length}</span></button>)}</div>{!categories.length&&<p className="field-note">Assign a category when you create or edit a unit. You can use your own names.</p>}</section>
 {shown.length?<div className="catalogue-grid">{shown.map(entry=><CatalogueCard key={entry.unit.id} entry={entry} allView={allView} onEdit={()=>edit(entry)} onCopy={()=>clone(entry)}/>)}</div>:<div className="white-card empty-state"><LibraryBig size={34}/><h2>{entries.length?'No designs match these filters.':'Start your catalogue.'}</h2><p>{entries.length?'Try another category or search term.':'Create a unit design, or copy a unit you’ve already built in a project.'}</p>{!entries.length&&<button className="button primary" onClick={create}><Plus size={16}/> New unit design</button>}</div>}
 {!!sources.length&&<section className="white-card catalogue-import"><h2>Reuse an existing project unit</h2><p className="muted">Copy a unit into the catalogue without changing the original project.</p><div className="button-row"><label className="field"><span>Existing project unit</span><select value={existing} onChange={e=>setExisting(e.target.value)}><option value="">Choose a project unit</option>{sources.map(({p,u})=><option key={p.id+'|'+u.id} value={p.id+'|'+u.id}>{p.name} / {u.name||'Unnamed unit'}</option>)}</select></label><button className="button" disabled={!existing} onClick={()=>{const s=sources.find(({p,u})=>p.id+'|'+u.id===existing);if(s)edit(catalogueEntry(s.u,s.p.externalFinishes||[],true));}}>Copy into catalogue <ArrowUpRight size={15}/></button></div></section>}
 </>}
 </div>;
}

function CatalogueCard({entry,allView,onEdit,onCopy}:{entry:CatalogueUnit,allView:{view:'front'|'isometric',revision:number},onEdit:()=>void,onCopy:()=>void}){
 const {unit,finishes}=entry,items=unitDrawingOrder(unitPlacements(unit),unit.layerOrder).filter(i=>i.valid),e=unitEnvelope(unit),pad=Math.max(e.w,e.h)*.12+1;
 const [view,setView]=useState<'images'|'front'|'isometric'>(allView.revision?allView.view:entry.images?.length?'images':'front'),[imageIndex,setImageIndex]=useState(0);
 useEffect(()=>{if(allView.revision)setView(allView.view);},[allView]);
 return <article className="white-card catalogue-card"><div className="catalogue-art">{view==='images'&&entry.images?.length?<img className="catalogue-cover" src={imageUrl(entry.images[Math.min(imageIndex,entry.images.length-1)].id)} alt={entry.images[Math.min(imageIndex,entry.images.length-1)].name||unit.name+' display image'}/>:view==='isometric'?<IsometricUnit compact unit={unit} finishes={finishes}/>:items.length?<svg role="img" aria-label={unit.name+' front view'} viewBox={[-pad,-pad,e.w+pad*2,e.h+pad*2].join(' ')}>{items.map(i=><g key={i.id} transform={`translate(${i.x} ${e.h-i.y-i.h})`}><UnitContextDrawing c={i.component} doors finishes={finishes}/></g>)}</svg>:<Box size={32}/>}</div><div className="catalogue-card-body"><div className="catalogue-view-switch" role="group" aria-label={'View '+unit.name}>{!!entry.images?.length&&<button aria-pressed={view==='images'} onClick={()=>setView('images')}>Images</button>}<button aria-pressed={view==='front'} onClick={()=>setView('front')}>Front</button><button aria-pressed={view==='isometric'} onClick={()=>setView('isometric')}>Isometric</button></div>{view==='images'&&!!entry.images?.length&&entry.images.length>1&&<div className="catalogue-image-choice">{entry.images.map((img,i)=><button key={img.id} aria-label={'Show '+unit.name+' image '+(i+1)} aria-pressed={imageIndex===i} onClick={()=>setImageIndex(i)}><img src={imageUrl(img.id)} alt=""/></button>)}</div>}<span className="catalogue-card-category">{categoryName(entry)}</span><h2>{unit.name}</h2><p>{e.measured?fmt(e.w)+' W × '+fmt(e.h)+' H × '+fmt(e.d)+' D':'Dimensions incomplete'}</p><p className="muted">{[...new Set(unit.components.map(c=>c.kind))].join(' · ')||'No components'}</p><div className="button-row"><button className="button small" onClick={onEdit}>Edit {unit.name} <ArrowUpRight size={14}/></button><button className="icon-button outlined" aria-label={'Duplicate '+unit.name} title="Duplicate design" onClick={onCopy}><Copy size={14}/></button></div></div></article>;
}
