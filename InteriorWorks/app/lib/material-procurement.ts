import type {Result} from './engine';
import type {MaterialProduct,Procurement} from './model';

export type PurchaseLine={key:string,label:string,quantity:number|null,unit:string,note?:string};

export function purchaseLines(result:Result):PurchaseLine[]{
 const groups=[...new Set(result.sheets.map(s=>s.group))];
 const sheets=groups.map(group=>({key:'sheet:'+group,label:result.sheets.find(s=>s.group===group)!.material+(group.includes('sheet grain')?' · '+group.split(' · sheet grain ')[1]+' grain':''),quantity:result.sheets.filter(s=>s.group===group).length,unit:'sheet'}));
 const hardware=result.hardware.map(item=>({key:'item:'+item.name+'|'+item.unit,label:item.name,quantity:item.value,unit:item.unit,note:item.note}));
 const glass=[6,8].flatMap(thickness=>{const items=result.glass.filter(g=>(g.thickness??6)===thickness);return items.length?[{key:'glass:'+thickness+'mm',label:'Glass · '+thickness+'mm · cut to size',quantity:items.reduce((total,g)=>total+g.w*g.h*g.count/144,0),unit:'sq ft',note:'Cut-to-size area; confirm minimum billing and waste with supplier.'}]:[];});
 return [...sheets,...glass,...hardware];
}

export function starterProducts(line:PurchaseLine):MaterialProduct[]{
 const name=line.label;
 let companies:string[];
 if(name.startsWith('Plywood'))companies=['Greenply','CenturyPly'];
 else if(name.startsWith('MDF'))companies=['Greenpanel','Action TESA'];
 else if(name.startsWith('Block Board'))companies=['Greenply','CenturyPly'];
 else if(name.startsWith('Fevicol'))companies=['Pidilite'];
 else if(/laminate/i.test(name))companies=['Greenlam','Merino'];
 else if(/hinges|channel|lift|stay|sliding|shutter/i.test(name))companies=['Hettich','Häfele'];
 else companies=['Supplier 1','Supplier 2'];
 return companies.map((company,index)=>({id:'starter-'+index,company,name:company==='Pidilite'?name.replace(/^Fevicol /,'Fevicol '):name,price:null}));
}

export function lineCost(line:PurchaseLine,procurement:Procurement|undefined,library?:Record<string,MaterialProduct[]>):number|null{
 const products=library?.[line.key]||procurement?.products?.[line.key]||starterProducts(line);
 const selected=products.find(product=>product.id===procurement?.selected[line.key]);
 return line.quantity===null||!selected||!selected.company.trim()||!selected.name.trim()||selected.price===null||!Number.isFinite(selected.price)||selected.price<0?null:line.quantity*selected.price;
}
