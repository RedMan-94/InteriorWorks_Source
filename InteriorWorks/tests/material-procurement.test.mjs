import assert from 'node:assert/strict';
import {test} from 'node:test';
import {purchaseLines,starterProducts,lineCost} from '../app/lib/material-procurement.ts';

test('material selection uses actual sheet groups, hardware quantities and glass area without duplicate lines',()=>{
 const result={sheets:[
  {group:'Plywood · 18mm',material:'Plywood · 18mm'},
  {group:'Plywood · 18mm',material:'Plywood · 18mm'},
  {group:'External Laminate · sheet grain length',material:'External Laminate'}
 ],hardware:[{name:'Full Overlay hinges',value:4,unit:'pcs'},{name:'ProBond',value:null,unit:'kg'}],glass:[{w:24,h:36,count:2}]};
 const lines=purchaseLines(result);
 assert.deepEqual(lines.map(line=>line.quantity),[2,1,12,4,null]);
 assert.equal(lines[1].label,'External Laminate · length grain');
 assert.equal(new Set(lines.map(line=>line.key)).size,5);
 const product={...starterProducts(lines[0])[0],price:1800};
 const prices={products:{[lines[0].key]:[product]},selected:{[lines[0].key]:product.id}};
 assert.equal(lineCost(lines[0],prices),3600);
 assert.equal(lineCost(lines[4],{products:{[lines[4].key]:[product]},selected:{[lines[4].key]:product.id}}),null);
 assert.equal(lineCost(lines[0],{...prices,selected:{}}),null);
 assert.equal(lineCost(lines[0],{products:{[lines[0].key]:[{...product,company:''}]},selected:prices.selected}),null);
 const shared={...product,price:2200};
 assert.equal(lineCost(lines[0],prices,{[lines[0].key]:[shared]}),4400);
});
