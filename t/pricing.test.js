'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Pricing = require('../src/pricing.js');
const day = '2026-10-11';
const account = {id:'ACC1',name:'Customer A'};
const item = {id:'ITM1',name:'Item',rsp:10,std:0.2,active:true};
const deal = (id,from,pct,extra) => Object.assign({id,account:'Customer A',itemId:'ITM1',status:'Active',from,to:null,pct},extra);
const price = (deals,it=item,acc=account) => Pricing.resolve(acc,it,deals,day);
test('newest eligible Active deal wins in either input order',()=>{
 const ds=[deal('D1','2026-01-01',0.3),deal('D2','2026-10-01',0.4)];
 assert.deepEqual(price(ds),{pct:0.4,src:'Account deal'});assert.deepEqual(price(ds.reverse()),{pct:0.4,src:'Account deal'});
});
test('future, expired and inactive deals do not price today; date bounds inclusive',()=>{
 assert.equal(price([deal('D1','2026-10-12',0.9),deal('D2','2026-01-01',0.8,{to:'2026-10-10'}),deal('D3','2026-01-01',0.7,{status:'Inactive'})]).pct,0.2);
 assert.equal(price([deal('D4',day,0.4,{to:day})]).pct,0.4);
});
test('blank bounds are open and dated deals take precedence',()=>{
 assert.equal(price([deal('D1',null,0.3)]).pct,0.3);
 assert.equal(price([deal('D1',null,0.3),deal('D2','2025-01-01',0.4)]).pct,0.4);
});
test('ties use update time, creation time, then numeric deal ID deterministically',()=>{
 const ds=[deal('D9',day,0.3),deal('D10',day,0.4)];assert.equal(price(ds).pct,0.4);assert.equal(price(ds.reverse()).pct,0.4);
 ds.push(deal('D1',day,0.5,{createdAt:'2026-10-11T01:00:00Z'}));assert.equal(price(ds).pct,0.5);
 ds.push(deal('D2',day,0.6,{updated:'2026-10-11'}));assert.equal(price(ds).pct,0.6);
 ds.push(deal('D3',day,0.7,{updatedAt:'2026-10-11T12:00:00Z'}));assert.equal(price(ds).pct,0.7);
});
test('invalid winning discount never falls back to older deal or standard',()=>{
 for(const pct of [null,undefined,NaN,Infinity,-0.1,1.1,'0.4'])assert.deepEqual(price([deal('D1','2026-01-01',0.3),deal('D2',day,pct)]),{pct:null,src:'REVIEW REQUIRED'});
 assert.equal(price([deal('D1',day,0)]).pct,0);assert.equal(price([deal('D1',day,1)]).pct,1);
});
test('malformed active date needs review, not silent standard pricing',()=>{
 assert.equal(price([deal('D1','2026-02-30',0.4)]).src,'REVIEW REQUIRED');
 assert.equal(price([deal('D1','2026-11-01',0.4,{to:'2026-01-01'})]).src,'REVIEW REQUIRED');
});
test('no deal uses standard, missing rate/reference price needs review, no account is unpriced',()=>{
 assert.deepEqual(price([]),{pct:0.2,src:'Standard rule'});
 assert.equal(price([],Object.assign({},item,{std:null})).src,'REVIEW REQUIRED');
 assert.equal(price([],Object.assign({},item,{rsp:NaN})).src,'REVIEW REQUIRED');
 assert.equal(price([],Object.assign({},item,{active:false})).src,'REVIEW REQUIRED');
 assert.deepEqual(price([],item,null),{pct:null,src:'NO ACCOUNT'});
});
test('account and item IDs prevent cross-account or cross-item pricing',()=>{
 assert.equal(price([deal('D1',day,0.8,{account:'Other'})]).pct,0.2);
 assert.equal(price([deal('D1',day,0.8,{accountId:'ACC2'})]).pct,0.2);
 assert.equal(price([deal('D1',day,0.8,{itemId:'ITM2',item:'Item'})]).pct,0.2);
});
test('selection and pricing are read-only and historical frozen prices remain unchanged',()=>{
 const state={deals:[deal('D1',day,0.4)],orders:[{id:'TX1',pct:0.7,rsp:9,net:27}]};const before=JSON.stringify(state);
 const selected=Pricing.selectDeal(state.deals,account,item,day);assert.equal(selected.deal.id,'D1');price(state.deals);
 assert.equal(JSON.stringify(state),before);
});
test('order import and current quote use the same newest deal without modifying frozen orders',()=>{
 const fs=require('fs'),path=require('path'),Eng=require('../src/engine.js'),Imp=require('../src/import_plan.js');
 const docs={},root=path.join(__dirname,'fixture');
 for(const c of fs.readdirSync(root))for(const f of fs.readdirSync(path.join(root,c)))docs[c+'/'+f.replace(/\.json$/,'')]=JSON.parse(fs.readFileSync(path.join(root,c,f)));
 const before=JSON.stringify(docs),ctx=Eng.ctx(docs,day),it=ctx.items.find(x=>x.active!==false&&x.rsp>0),acc=ctx.accounts.find(x=>!x.closed);
 const ds=[{id:'NEW2',account:acc.name,itemId:it.id,status:'Active',from:'2026-10-01',pct:0.5},{id:'OLD1',account:acc.name,itemId:it.id,status:'Active',from:'2026-01-01',pct:0.2}];
 const quote=Pricing.resolve(acc,it,ds,day),rows=[['Date','Account','Item','Qty'],[day,acc.name,it.id,10]],hdr=Imp.detectHeader(rows,'orders');
 const result=Imp.plan('orders',rows,hdr,ctx,{today:day,eng:Eng,price:(a,i)=>Pricing.resolve(ctx.accounts.find(x=>x.name===a),ctx.items.find(x=>x.name===i),ds,day)}).rows[0];
 assert.equal(result.status,'ready');assert.equal(result.data.pct,quote.pct);assert.equal(result.data.src,quote.src);
 assert.equal(result.data.netExact,10*it.rsp*(1-quote.pct));assert.equal(JSON.stringify(docs),before);
});
test('a deal saved with a FUTURE start keeps the old deal pricing until the day before',()=>{
 const old=deal('D1','2026-01-01',0.3),next=deal('D2','2026-12-01',0.5);
 Pricing.supersede(old,'2026-12-01',day);
 assert.equal(old.status,'Active');assert.equal(old.to,'2026-11-30');
 const ds=[old,next],at=d=>Pricing.resolve(account,item,ds,d);
 assert.deepEqual(at(day),{pct:0.3,src:'Account deal'});assert.deepEqual(at('2026-11-30'),{pct:0.3,src:'Account deal'});
 assert.deepEqual(at('2026-12-01'),{pct:0.5,src:'Account deal'});assert.deepEqual(at('2027-03-01'),{pct:0.5,src:'Account deal'});
});
test('a deal starting today or earlier retires the old deal at once (unchanged behaviour)',()=>{
 for(const eff of [day,'2026-09-15']){
  const old=deal('D1','2026-01-01',0.3);Pricing.supersede(old,eff,day);
  assert.equal(old.status,'Inactive');assert.equal(old.to,eff);
 }
});
test('superseding a future deal never lengthens an earlier end date and never makes an invalid range',()=>{
 const early=deal('D1','2026-01-01',0.3,{to:'2026-11-15'});Pricing.supersede(early,'2026-12-01',day);
 assert.equal(early.status,'Active');assert.equal(early.to,'2026-11-15');
 const later=deal('D3','2026-12-15',0.3);Pricing.supersede(later,'2026-12-01',day);   /* starts after the new deal: retired, not left with to < from */
 assert.equal(later.status,'Inactive');
 const open=deal('D4',null,0.3);Pricing.supersede(open,'2026-12-01',day);
 assert.equal(open.status,'Active');assert.equal(open.to,'2026-11-30');
 assert.equal(Pricing.selectDeal([open],account,item,day).invalid,false);
});
