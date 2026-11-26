import {withStarterLaminates} from './starter-laminates.ts';
export type Kind='Boxing'|'Framing'|'Paneling'|'Closed Boxing';
export type Shelf={id:string,orientation:'horizontal'|'vertical',x:number,y:number,w:number,h:number,material?:'wood'|'glass',baseSupport?:'bottom'|'new'|'existing'|null,baseShelfId?:string};
export const handleLengths=[3,4,6,8,10,12,18,24,30] as const;
export const handleColors=['White','Silver','Grey','Black','Gold','Rose Gold','Bronze'] as const;
export const handlePaint:Record<string,string>={White:'#ffffff',Silver:'#bfc4c7',Grey:'#777b7e',Black:'#292929',Gold:'#bb9745','Rose Gold':'#bd8275',Bronze:'#8b633d'};
export type HandleSpec={length:number,color:string,height:number|null};
export const drawerHeights:readonly number[]=[2,4,6,8,10,12];
export const minDrawerHeight=drawerHeights[0];
export type DrawerRow={id:string,x:number,y:number,span:number,count:number,height:number,channelLength:number|null,topSupport?:boolean,placement?:'inset'|'overlay',heightMode?:'fixed'|'fill',handle?:HandleSpec};
export type Layer={id:string,name:string,x:number,y:number,w:number,h:number,thickness:number,grid:boolean,border:boolean,spacing:number,decorative:boolean};
export type DoorSwing='side'|'bottom'|'top';
export type DoorSection={type:'normal'|'profile'|'rolling'|'none',count:number,handles:number,handle?:HandleSpec,enabled?:boolean,swing?:DoorSwing,hingeSide?:'left'|'right',placement?:'overlay'|'inset',assistSets?:number|null,opening?:string};
export type ProfileLight={id:string,panelKey:string,width:number,length:number,x:number,y:number,orientation:'horizontal'|'vertical',face:'a'|'b'};
export type ExternalFinish={id:string,code:string,name:string,color:string,grain:'free'|'length'|'height',sheetGrain:'length'|'width'};
export type FinishZone={id:string,finishId:string,x:number,y:number,w:number,h:number};
export type FaceFinish={finishId?:string,zones?:FinishZone[],pattern?:import('./laminate-patterns').LaminatePattern};
export type LegCoverSide='front'|'back'|'left'|'right';
export const boxingSectionCounts=[1,2,3,4] as const;
export const closedBoxingDimensions={min:3,max:8*12} as const;
export type Component={sectionCount?:number,sectionShares?:number[],frameMidSupport?:boolean,legCovers?:{enabled:boolean,sides:LegCoverSide[]},defaultExternalFinishId?:string,faceFinishes?:Record<string,FaceFinish>,unitPosition?:{x:number,y:number},id:string,kind:Kind,name:string,l:number,d:number,h:number,material:'Plywood'|'MDF',split:'equal'|'maximum',external:string[],internalFinish:string,externalFinish:string,grain:'free'|'length'|'height',sheetGrain:'length'|'width',glue:'SH'|'Marine',legs:boolean,legHeight?:number,doorMode:'none'|'swing'|'sliding',placement:'overlay'|'inset',doors:DoorSection[],slidingCount:number,slidingHandle?:HandleSpec,shelves:Shelf[],drawers:DrawerRow[],layers:Layer[],grid:boolean,border:boolean,spacing:number,frontSetback:number|null,profileLights?:ProfileLight[]};
export const legHeights=[.5,1,1.5,2,3,4] as const;
export function legHeight(c:Component){return c.kind==='Boxing'&&c.legs?(c.legHeight??2):0;}
export function boxHeight(c:Component){return c.h-legHeight(c);}
export type Unit={id:string,name:string,components:Component[],catalogueId?:string,layerOrder?:string[]};
export type CatalogueImage={id:string,name:string};
export type CatalogueUnit={unit:Unit,finishes:ExternalFinish[],images?:CatalogueImage[],category?:string};
export type RoomWall='A'|'B'|'C'|'D';
export type RoomOpening={id:string,name:string,type:'door'|'window',wall:RoomWall,x:number,bottom:number,w:number,h:number,hinge:'left'|'right',swing:'in'|'out'};
export type PlacementArea={id:string,name:string,wall:RoomWall,x:number,y:number,w:number,h:number,d:number,unitId?:string};
export type Room={id:string,name:string,l:number,w:number,h:number,openings:RoomOpening[],areas:PlacementArea[]};
export type MaterialProduct={id:string,company:string,name:string,price:number|null};
export type Procurement={products:Record<string,MaterialProduct[]>,selected:Record<string,string>};
export type Project={rooms?:Room[],laminateOptionsVersion?:number,externalFinishes?:ExternalFinish[],procurement?:Procurement,id:string,name:string,client:string,units:Unit[],updatedAt:string,settings:{sh:number,marine:number,probond:number|null,joint:number|null}};
export type Workspace={projects:Project[],unitCatalogue?:CatalogueUnit[],materialLibrary?:Record<string,MaterialProduct[]>};
export const kinds:Kind[]=['Boxing','Framing','Paneling','Closed Boxing'];
export const unitTypes=['T.V. Unit','Shoe Rack','Partition','Crockery Unit','Puja Unit','Decorative Wall','Washbasin Unit','Wardrobe','Dressing Table','Study Table'];
export const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
export function newComponent(kind:Kind,index:number):Component{return {id:uid(),kind,name:kind+' '+index,l:0,d:kind==='Framing'?4:0,h:0,material:'Plywood',split:'equal',external:[],internalFinish:'Internal — White',externalFinish:'External — Oak',grain:'free',sheetGrain:'length',glue:'SH',legs:false,legHeight:2,doorMode:'none',placement:'overlay',doors:[{type:'normal',count:2,handles:1}],slidingCount:2,shelves:[],drawers:[],layers:[],grid:true,border:true,spacing:24,frontSetback:null};}
export function newProject(name:string):Project{return withStarterLaminates({id:uid(),name,client:'',rooms:[],units:[],updatedAt:new Date().toISOString(),settings:{sh:50,marine:38,probond:null,joint:null}});}
export function demoWorkspace():Workspace{
 const p=newProject('A home, thoughtfully made'); p.id='sample-project'; p.client='Sample project · editable';
 const c=newComponent('Boxing',1); Object.assign(c,{id:'sample-boxing',l:42,d:21,h:90,doorMode:'swing',doors:[{type:'normal',count:2,handles:1}],external:['Left:outside','Right:outside','Top:outside']});
 c.shelves=[{id:'sample-shelf-1',orientation:'horizontal',x:0,y:28,w:40.5,h:18/25.4},{id:'sample-shelf-2',orientation:'horizontal',x:0,y:56,w:40.5,h:18/25.4}];
 p.units=[{id:'sample-unit',name:'Wardrobe',components:[c]}];
 const template={...structuredClone(p.units[0]),id:'sample-catalogue-wardrobe'};
 return {projects:[p],unitCatalogue:[{unit:template,finishes:[]}]};
}
export function fmt(v:number):string{if(!Number.isFinite(v))return '—';if(v<0)return '−'+fmt(-v);const f=Math.floor((v+1e-8)/12),i=Math.round((v-f*12)*1000)/1000;return f>0?f+'′ '+i+'″':i+'″';}
export function parseInches(s:string):number|null{const t=s.trim();if(!t)return 0;if(/^\d+(\.\d+)?$/.test(t))return Number(t);const m=t.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);return m&&Number(m[3])>0?Number(m[1]||0)+Number(m[2])/Number(m[3]):null;}

export function copyUnit(unit:Unit):Unit{
 const u=structuredClone(unit);u.id=uid();u.name+=' · Copy';
 const componentIds=new Map<string,string>();
 for(const c of u.components){const oldId=c.id;c.id=uid();componentIds.set(oldId,c.id);const refs=new Map<string,string>();for(const item of [...c.shelves,...c.drawers,...c.layers]){const old=item.id;item.id=uid();refs.set(old,item.id);}
 const remap=(key:string)=>{for(const [old,id] of refs)key=key.replaceAll(old,id);return key;};
 for(const s of c.shelves)if(s.baseShelfId)s.baseShelfId=remap(s.baseShelfId);
 for(const light of c.profileLights||[]){light.id=uid();light.panelKey=remap(light.panelKey);}
 if(c.faceFinishes)c.faceFinishes=Object.fromEntries(Object.entries(c.faceFinishes).map(([key,value])=>[remap(key),{...value,zones:value.zones?.map(z=>({...z,id:uid()}))}]));}
 if(u.layerOrder)u.layerOrder=u.layerOrder.map(id=>componentIds.get(id)).filter((id):id is string=>!!id);
 return u;
}
