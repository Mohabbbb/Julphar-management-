/* Julphar Sales Platform V43 - import engine (pure, ES5, no DOM, no storage).
   Reads rows (from XlsxRead / CSV), finds the header row, parses values defensively and builds a PLAN:
   one PlanRow per data row telling the UI what would happen (ready / update / same / new / choose / problem / duplicate).
   It never writes anything and never mutates ctx or the rows it is given. It needs the V42 engine only for the
   current stock figures (Eng global in the browser, require() in Node, or opts.eng). */
var Imp=(function(){"use strict";

var TYPES=['stock','orders','items','deals'];
var TOL=0.00005;                                   /* price / percent equality tolerance */

function F(key,label,required,syn){return {key:key,label:label,required:!!required,syn:syn};}
var ITEM_SYN=['item','item name','product','sku','description','name','code','item code','item id'];
var QTY_SYN=['qty','quantity','count','stock','on hand','units','boxes','balance'];
var ACC_SYN=['account','customer','client','pharmacy','account name'];
var NOTE_SYN=['notes','note','remarks','comment'];
var DISC_SYN=['disc','discount','disc %','discount %','deal','deal %','%'];
var FIELDS={
  stock:[F('item','Item',true,ITEM_SYN),F('qty','Quantity',true,QTY_SYN),F('account','Account',false,ACC_SYN),F('notes','Notes',false,NOTE_SYN)],
  orders:[F('date','Date',true,['date','order date','invoice date']),F('account','Account',true,ACC_SYN),F('item','Item',true,ITEM_SYN),
    F('qty','Quantity',true,QTY_SYN),F('status','Status',false,['status','order status']),F('disc','Discount %',false,DISC_SYN),F('notes','Notes',false,NOTE_SYN)],
  items:[F('id','ID',false,['id','item id','code','item code']),F('name','Name',false,['name','item name','product','description']),
    F('short','Short name',false,['short','short name']),F('rsp','RSP',false,['rsp','retail price','ref price']),
    F('price','2026 price',false,['price','price 2026','net price','std net']),F('std','Standard discount %',false,['std','std %','standard discount','standard %']),
    F('category','Category',false,['category','brand']),F('form','Form',false,['form']),F('strength','Strength',false,['strength']),
    F('pack','Pack',false,['pack']),F('active','Active',false,['active','status'])],
  deals:[F('account','Account',true,ACC_SYN),F('item','Item',true,ITEM_SYN),F('disc','Discount %',true,DISC_SYN),
    F('from','From date',false,['from','valid from','effective','effective date']),F('notes','Notes',false,NOTE_SYN)]
};

/* ---------- small helpers ---------- */
function has(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function dict(){return Object.create(null);}      /* a lookup table that has no inherited keys: a cell reading "constructor" or "__proto__" is just text */
function isArr(x){return Object.prototype.toString.call(x)==='[object Array]';}
function txt(v){return v==null?'':String(v).replace(/\s+/g,' ').replace(/^ | $/g,'');}
function low(v){return txt(v).toLowerCase();}
function isDashes(s){return /^[-‐-―−]+$/.test(s);}
function blankText(v){var t=txt(v);return t===''||isDashes(t);}        /* "", "-", "--", en/em dash = no value */
/* money rounding is the engine's single rule, Eng.money (also used by New order and the saved lines) */
function shown(x,opts){var E=getEng(opts);return E&&E.money?E.money(x):Math.round(x*100)/100;}
function near(a,b){return typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<TOL;}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

/* ---------- value parsing ---------- */
function arabicDigits(s){
  return s.replace(/[٠-٩]/g,function(c){return String(c.charCodeAt(0)-0x660);})
          .replace(/[۰-۹]/g,function(c){return String(c.charCodeAt(0)-0x6f0);})
          .replace(/٫/g,'.').replace(/٬/g,',');
}
function groupOK(s,sep){return new RegExp('^\\d{1,3}('+esc(sep)+'\\d{3})+$').test(s);}
/* num(v [, decimalDot]) -> number | null (blank, "-") | undefined (not a number).
   Text numbers: "1,200" -> 1200, "1.200" -> 1200 (exactly 3 digits after a single dot, no other separator), "1.25" -> 1.25.
   decimalDot=true (prices): a single dot is always a decimal point ("2.525" -> 2.525). */
function num(v,decimalDot){
  if(v==null)return null;
  if(typeof v==='number')return isFinite(v)?v:undefined;
  if(typeof v!=='string')return undefined;
  var s=arabicDigits(v).replace(/^[\s  ]+|[\s  ]+$/g,'').replace(/−/g,'-');
  if(s===''||isDashes(s))return null;
  if(/^[+-]?\d{1,3}([   ]\d{3})+([.,]\d+)?$/.test(s))s=s.replace(/[   ]/g,'');
  var m=/^([+-]?)([\d.,]+)$/.exec(s);if(!m)return undefined;
  var sign=m[1]==='-'?-1:1,b=m[2],hasD=b.indexOf('.')>=0,hasC=b.indexOf(',')>=0,out,parts,a,c;
  if(hasD&&hasC){
    var dec=b.lastIndexOf('.')>b.lastIndexOf(',')?'.':',',grp=dec==='.'?',':'.';
    parts=b.split(dec);if(parts.length!==2||!/^\d+$/.test(parts[1])||!groupOK(parts[0],grp))return undefined;
    out=Number(parts[0].split(grp).join('')+'.'+parts[1]);
  }else if(hasD||hasC){
    var sep=hasD?'.':',';parts=b.split(sep);
    if(parts.length>2){if(!groupOK(b,sep))return undefined;out=Number(parts.join(''));}
    else{
      a=parts[0];c=parts[1];
      if(!/^\d*$/.test(a)||!/^\d+$/.test(c))return undefined;
      var thousands=c.length===3&&/^[1-9]\d{0,2}$/.test(a)&&!(decimalDot&&sep==='.');
      out=thousands?Number(a+c):Number((a===''?'0':a)+'.'+c);
    }
  }else out=Number(b);
  if(!isFinite(out))return undefined;
  out=out*sign;return out===0?0:out;
}
/* pct(v) -> fraction 0..1 | null (blank) | undefined (invalid). 65, "65%", 0.65, "0.65" -> 0.65; a number <= 1 is a fraction. */
function pct(v){
  if(v==null)return null;
  var n,sign=false;
  if(typeof v==='number'){if(!isFinite(v))return undefined;n=v;}
  else if(typeof v==='string'){
    var s=txt(v);if(s===''||isDashes(s))return null;
    if(/%$/.test(s)){sign=true;s=s.slice(0,-1);}
    n=num(s,true);if(n==null)return undefined;
  }else return undefined;
  if(n<0||n>100)return undefined;
  if(sign)return n/100;
  return n<=1?n:n/100;
}
/* true when v is an UNSIGNED exactly-1 ("1", 1, " 1.0 "): 1% or 100%? Imp.pct reads it as 100%, so planners ask the owner instead. "1%" is not ambiguous. */
function pctAmbiguous(v){
  if(v==null)return false;
  if(typeof v==='number')return v===1;
  if(typeof v!=='string')return false;
  var s=txt(v);if(s===''||isDashes(s)||/%$/.test(s))return false;
  return num(s,true)===1;
}
var AMBIG='Is 1 meant as 1% or 100%? Write 1% or 100%';
function pad2(n){return n<10?'0'+n:String(n);}
function dim(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}
function ymd(y,m,d){
  if(!(y>=1900&&y<=2100)||!(m>=1&&m<=12)||!(d>=1&&d<=dim(y,m)))return undefined;
  return y+'-'+pad2(m)+'-'+pad2(d);
}
function serial(n){
  n=Math.floor(n);if(!(n>=20000&&n<=80000))return undefined;
  var d=new Date((n-25569)*86400000);return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate());
}
/* date(v) -> 'YYYY-MM-DD' | null (blank) | undefined (not a date). Slash/dash/dot dates are day/month/year. */
function date(v){
  if(v==null)return null;
  if(Object.prototype.toString.call(v)==='[object Date]'){
    return isNaN(v.getTime())?undefined:v.getUTCFullYear()+'-'+pad2(v.getUTCMonth()+1)+'-'+pad2(v.getUTCDate());
  }
  if(typeof v==='number')return isFinite(v)?serial(v):undefined;
  if(typeof v!=='string')return undefined;
  var s=txt(v),m;
  if(s===''||isDashes(s))return null;
  if(/^\d+(\.\d+)?$/.test(s))return serial(Number(s));
  m=/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T ].*)?$/.exec(s);
  if(m)return ymd(+m[1],+m[2],+m[3]);
  m=/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})$/.exec(s);
  if(m)return ymd(m[3].length===2?2000+(+m[3]):+m[3],+m[2],+m[1]);
  return undefined;
}
function bool(v){          /* true | false | null (blank) | undefined (not understood) */
  if(v==null)return null;
  if(v===true||v===false)return v;
  if(typeof v==='number')return v===1?true:(v===0?false:undefined);
  var s=low(v);if(s===''||isDashes(s))return null;
  if(s==='yes'||s==='true'||s==='1'||s==='active'||s==='y')return true;
  if(s==='no'||s==='false'||s==='0'||s==='inactive'||s==='n')return false;
  return undefined;
}

/* ---------- header detection ---------- */
function normHead(v){return low(v).replace(/[*:.]+$/,'').replace(/^ | $/g,'');}
function requiredMissing(type,map){
  var f=FIELDS[type],out=[],i;
  for(i=0;i<f.length;i++)if(f[i].required&&!has(map,f[i].key))out.push(f[i].key);
  if(type==='items'&&!has(map,'id')&&!has(map,'name'))out.push('id','name');
  return out;
}
function matchRow(row,type){
  var f=FIELDS[type],map={},used={},hits=0,i,j,k,cell,exact=[],c;
  var cells=[];for(i=0;i<row.length;i++)cells.push(normHead(row[i]));
  /* pass 1: exact synonym */
  for(i=0;i<cells.length;i++){
    cell=cells[i];if(!cell)continue;
    for(j=0;j<f.length;j++){
      if(has(map,f[j].key))continue;
      if(f[j].syn.indexOf(cell)>=0){map[f[j].key]=i;used[i]=1;hits++;break;}
    }
  }
  /* pass 2: whole-word containment for synonyms of 4+ letters (longest synonym first) */
  for(i=0;i<cells.length;i++){
    cell=cells[i];if(!cell||used[i])continue;
    var cands=[];
    for(j=0;j<f.length;j++){
      if(has(map,f[j].key))continue;
      for(k=0;k<f[j].syn.length;k++){
        c=f[j].syn[k];
        if(c.length>=4&&new RegExp('(^|[^a-z0-9])'+esc(c)+'([^a-z0-9]|$)').test(cell))cands.push({key:f[j].key,len:c.length,ord:j});
      }
    }
    if(!cands.length)continue;
    cands.sort(function(a,b){return (b.len-a.len)||(a.ord-b.ord);});
    map[cands[0].key]=i;used[i]=1;hits++;
  }
  return {map:map,hits:hits};
}
function detectHeader(rows,type){
  var best=null,i,r,n=Math.min(15,rows?rows.length:0);
  if(!has(FIELDS,type))return {row:-1,map:{},missing:[]};
  for(i=0;i<n;i++){
    r=rows[i];if(!isArr(r))continue;
    var m=matchRow(r,type);
    if(m.hits>=2&&(!best||m.hits>best.hits))best={row:i,map:m.map,hits:m.hits};
  }
  if(!best)return {row:-1,map:{},missing:requiredMissing(type,{})};
  return {row:best.row,map:best.map,missing:requiredMissing(type,best.map)};
}

/* ---------- lookups (built once per plan; ctx is only read) ---------- */
function getEng(opts){
  if(opts&&opts.eng)return opts.eng;
  if(typeof Eng!=='undefined')return Eng;
  if(typeof require==='function'){try{return require('./engine.js');}catch(e){}}
  return null;
}
function buildIndex(ctx,opts){
  var S={ctx:ctx,opts:opts,today:opts.today||ctx.today,itemById:dict(),itemName:dict(),itemShort:dict(),acctById:dict(),acctName:dict(),acctAlias:dict(),used:dict(),ownMap:null,acctMap:dict()};
  var i,j,it,a,k,list,al;
  for(i=0;i<ctx.items.length;i++){
    it=ctx.items[i];if(!it||it.id==null)continue;
    S.itemById[String(it.id).toUpperCase()]=it;
    k=low(it.name);if(k)(S.itemName[k]=S.itemName[k]||[]).push(it);
    k=low(it.short);if(k)(S.itemShort[k]=S.itemShort[k]||[]).push(it);
  }
  function addA(map,key,acct){key=low(key);if(!key)return;list=map[key]=map[key]||[];if(list.indexOf(acct)<0)list.push(acct);}
  for(i=0;i<ctx.accounts.length;i++){
    a=ctx.accounts[i];if(!a)continue;
    if(a.id!=null)S.acctById[String(a.id).toUpperCase()]=a;
    addA(S.acctName,a.name,a);
    if(typeof a.aliases==='string'){al=a.aliases.split(/[,;|]/);for(j=0;j<al.length;j++)addA(S.acctAlias,al[j],a);}
  }
  for(i=0;i<ctx.orders.length;i++)if(ctx.orders[i].itemId!=null)S.used[ctx.orders[i].itemId]=1;
  S.deals=isArr(opts.deals)?opts.deals:[];
  S.dealBy=dict();
  for(i=0;i<S.deals.length;i++){
    var d=S.deals[i];if(!d)continue;
    if(d.itemId!=null)S.used[d.itemId]=1;
    if(d.status!=='Active'||d.itemId==null)continue;
    var an=d.account!=null?d.account:d.acct;if(an==null&&d.accountId!=null&&S.acctById[String(d.accountId).toUpperCase()])an=S.acctById[String(d.accountId).toUpperCase()].name;
    if(an==null)continue;
    k=low(an)+'\u0001'+d.itemId;
    var cur=S.dealBy[k];if(!cur||String(d.from||'')>=String(cur.from||''))S.dealBy[k]=d;
  }
  S.dupOrder=dict();
  for(i=0;i<ctx.orders.length;i++){
    var o=ctx.orders[i];if(o.status==='Cancelled'||o.itemId==null||o.qty==null||!o.date)continue;
    k=low(o.account)+'\u0001'+o.date+'\u0001'+o.itemId+'\u0001'+o.qty;if(!has(S.dupOrder,k))S.dupOrder[k]=o.id;
  }
  return S;
}
function resolveItem(text,S){
  var t=txt(text),k=t.toLowerCase(),it,arr,r;
  if(!t)return {problem:'No item'};
  if(/^ITM\d+$/i.test(t)){it=S.itemById[t.toUpperCase()];if(it)return {item:it};}
  arr=S.itemName[k];
  if(arr&&arr.length===1)return {item:arr[0]};
  if(arr&&arr.length>1)return {cand:arr.slice()};
  arr=S.itemShort[k];
  if(arr&&arr.length===1)return {item:arr[0]};
  if(arr&&arr.length>1)return {cand:arr.slice()};           /* several items share this short name: owner chooses, never guessed */
  if(typeof S.opts.matchItem==='function'){
    r=S.opts.matchItem(t);
    if(r&&r.item)return {item:r.item,matched:t};
    if(r&&r.cand&&r.cand.length===1)return {item:r.cand[0],matched:t};
    if(r&&r.cand&&r.cand.length>1)return {cand:r.cand.slice()};
  }
  return {problem:'Unknown item'};
}
function resolveAcct(text,S){
  var t=txt(text),k=t.toLowerCase(),a,arr;
  if(!t)return {problem:'No account'};
  if(/^ACC\d+$/i.test(t)){a=S.acctById[t.toUpperCase()];if(a)return finishAcct(a);}
  arr=S.acctName[k];if(!arr)arr=S.acctAlias[k];
  if(!arr)return {problem:'Unknown account'};
  if(arr.length>1)return {problem:'More than one account matches "'+t+'"'};
  return finishAcct(arr[0]);
}
function finishAcct(a){return (a.active===false||a.closed)?{acct:a,problem:'Account is closed'}:{acct:a};}

/* ---------- plan rows ---------- */
function newRow(n,raw){return {n:n,raw:raw,status:'ready',msg:'',include:false,item:null,cand:[],account:null,data:{},changes:[]};}
function fail(row,msg){row.status='problem';row.msg=msg;row.include=false;return false;}
function pick(row,list,msg){row.status='choose';row.cand=list;row.msg=msg||'Several items match - pick one';row.include=false;return false;}
/* resolve the item cell; false = row already marked (problem / choose) */
function doItem(row,text,S,allowInactive){
  var r=resolveItem(text,S),act,i;
  if(r.problem)return fail(row,r.problem);
  if(r.cand){
    act=[];for(i=0;i<r.cand.length;i++)if(allowInactive||r.cand[i].active!==false)act.push(r.cand[i]);
    if(!act.length)return fail(row,'Item is inactive');
    return pick(row,act);
  }
  if(!allowInactive&&r.item.active===false)return fail(row,'Item is inactive');
  row.item=r.item;if(r.matched)row.msg='matched "'+r.matched+'"';
  return true;
}
function doAcct(row,text,S){
  var r=resolveAcct(blankText(text)?'':text,S);
  if(r.acct)row.account=r.acct;
  if(r.problem)return fail(row,r.problem);
  return true;
}
function rowList(ns){
  if(ns.length>5)return 'rows '+ns.slice(0,5).join(', ')+' and '+(ns.length-5)+' more';
  if(ns.length===2)return 'rows '+ns[0]+' and '+ns[1];
  return 'rows '+ns.slice(0,-1).join(', ')+' and '+ns[ns.length-1];
}
function flagTwice(rows,keyOf,statuses){
  var groups=dict(),order=[],i,k,r;
  for(i=0;i<rows.length;i++){
    r=rows[i];if(statuses.indexOf(r.status)<0)continue;
    k=keyOf(r);if(k==null)continue;
    if(!has(groups,k)){groups[k]=[];order.push(k);}
    groups[k].push(r);
  }
  for(i=0;i<order.length;i++){
    var g=groups[order[i]];if(g.length<2)continue;
    var ns=[],j;for(j=0;j<g.length;j++)ns.push(g[j].n);
    var msg=(g.length===2?'Appears twice in the file':'Appears '+g.length+' times in the file')+' ('+rowList(ns)+')';
    for(j=0;j<g.length;j++){g[j].status='problem';g[j].msg=msg;g[j].include=false;g[j].changes=[];}
  }
}
function qtyOf(v,min,max){        /* {qty} | {err} ; blank / "-" is "no quantity", never 0 */
  var n=num(v);
  if(n===null)return {err:'No quantity'};
  if(n===undefined)return {err:'Quantity is not a number'};
  if(Math.floor(n)!==n)return {err:'Quantity must be a whole number'};
  if(n<min)return {err:min>0?'Quantity must be at least '+min:'Quantity cannot be negative'};
  if(n>max)return {err:'Quantity is too large (over '+max+')'};
  return {qty:n};
}
function note(v){return blankText(v)?null:txt(v);}

/* stock */
function ownRow(S,id){
  if(!S.ownMap){
    var eng=getEng(S.opts);if(!eng)throw new Error('Imp.plan needs the V42 engine (Eng) for stock');
    S.ownMap=dict();var rs=eng.ownStock(S.ctx).rows,i;for(i=0;i<rs.length;i++)S.ownMap[rs[i].itemId]=rs[i];
  }
  return S.ownMap[id]||null;
}
function acctRowOf(S,acct,id){
  var k=acct.name;
  if(!has(S.acctMap,k)){
    var eng=getEng(S.opts);if(!eng)throw new Error('Imp.plan needs the V42 engine (Eng) for stock');
    var m=dict(),rs=eng.acctStock(S.ctx,acct.name).rows,i;for(i=0;i<rs.length;i++)m[rs[i].itemId]=rs[i];S.acctMap[k]=m;
  }
  return S.acctMap[k][id]||null;
}
function planStock(row,c,S){
  if(!doItem(row,c('item'),S,false))return;
  var acctText=has(S.map,'account')&&!blankText(c('account'))?txt(c('account')):'',useAcct=acctText?acctText:(S.opts.account?txt(S.opts.account):'');
  if(useAcct&&!doAcct(row,useAcct,S))return;
  var q=qtyOf(c('qty'),0,Infinity);
  if(q.err)return fail(row,q.err);
  var scope=row.account?'acct':'own',cur=null,tracked=false,tr;
  if(scope==='own'){tr=ownRow(S,row.item.id);if(tr&&tr.tracked){tracked=true;cur=tr.onHand;}}
  else{tr=acctRowOf(S,row.account,row.item.id);if(tr&&tr.tracked){tracked=true;cur=Math.round(tr.estOnHand);}}
  row.data={type:tracked?'COUNT':'OPEN',scope:scope,qty:q.qty,current:tracked?cur:null,notes:note(c('notes'))};
  if(!tracked){row.status='new';row.include=true;}
  else if(q.qty===cur){row.status='same';row.include=false;}
  else{row.status='update';row.include=true;row.changes=[{field:'qty',old:cur,new:q.qty}];}
}

/* orders */
var STATUSES={executed:'Executed',pending:'Pending',quoted:'Quoted'};
function planOrder(row,c,S){
  var dt=date(c('date'));
  if(dt===null)return fail(row,'No date');
  if(dt===undefined)return fail(row,'Date not understood (use day/month/year)');
  row.data.date=dt;
  if(!doAcct(row,c('account'),S))return;
  if(!doItem(row,c('item'),S,false))return;
  var q=qtyOf(c('qty'),1,1000000);
  if(q.err)return fail(row,q.err);
  var stTxt=has(S.map,'status')?txt(c('status')):'',st;
  if(!stTxt||isDashes(stTxt))st=S.defStatus;
  else st=has(STATUSES,stTxt.toLowerCase())?STATUSES[stTxt.toLowerCase()]:undefined;
  if(!st)return fail(row,'Status must be Executed, Pending or Quoted');
  if(st==='Executed'&&dt>S.today)return fail(row,'Executed order is dated in the future');
  var rsp=row.item.rsp;
  if(typeof rsp!=='number'||!(rsp>0))return fail(row,'Item has no RSP');
  if(has(S.map,'disc')&&pctAmbiguous(c('disc')))return fail(row,AMBIG);
  var p=has(S.map,'disc')?pct(c('disc')):null,src;
  if(p===undefined)return fail(row,'Discount must be between 0 and 100%');
  if(p!==null)src='Imported discount';
  else{
    var r=typeof S.opts.price==='function'?S.opts.price(row.account.name,row.item.name,dt):null;
    if(!r||typeof r.pct!=='number'||!isFinite(r.pct)||r.pct<0||r.pct>1)return fail(row,'No price rule (REVIEW)');
    p=r.pct;src=r.src;
  }
  row.data={date:dt,status:st,qty:q.qty,pct:p,src:src,rsp:rsp,net:shown(q.qty*(rsp*(1-p)),S.opts),netExact:q.qty*(rsp*(1-p)),notes:note(c('notes'))};
  row.status='ready';row.include=true;
  var k=low(row.account.name)+'\u0001'+dt+'\u0001'+row.item.id+'\u0001'+q.qty;
  var mt=/^matched /.test(row.msg||'')?' · '+row.msg:'';                   /* keep the "matched" note next to the duplicate message */
  if(has(S.dupOrder,k)){row.status='duplicate';row.include=false;row.msg='Same as order '+S.dupOrder[k]+' already saved'+mt;}
  else if(has(S.seen,k)){row.status='duplicate';row.include=false;row.msg='Same as row '+S.seen[k]+' in this file'+mt;}
  if(!has(S.seen,k))S.seen[k]=row.n;
}

/* items */
function planItem(row,c,S){
  var idT=has(S.map,'id')&&!blankText(c('id'))?txt(c('id')):'',nameT=has(S.map,'name')?txt(c('name')):'';
  if(isDashes(nameT))nameT='';
  var it=null,arr;
  if(idT){it=S.itemById[idT.toUpperCase()];if(!it)return fail(row,'Unknown item ID');}
  else if(nameT){arr=S.itemName[nameT.toLowerCase()];
    if(arr&&arr.length>1)return fail(row,'More than one item has this name');
    if(arr)it=arr[0];}
  else return fail(row,'No ID or name');
  /* parse the provided (non-blank) fields; blank / "-" = keep current */
  var v={},err=null;
  function numField(key,label){
    if(!has(S.map,key))return;var n=num(c(key),true);
    if(n===null)return;
    if(n===undefined){err=err||label+' is not a number';return;}
    if(!(n>0)){err=err||label+' must be above 0';return;}
    v[key]=n;
  }
  numField('rsp','RSP');numField('price','Price');
  if(has(S.map,'std')&&pctAmbiguous(c('std')))err=err||AMBIG;
  if(has(S.map,'std')){var sd=pct(c('std'));if(sd===undefined)err=err||'Standard discount must be between 0 and 100%';else if(sd!==null)v.std=sd;}
  var tf=['short','category','form','strength','pack'],i;
  for(i=0;i<tf.length;i++)if(has(S.map,tf[i])&&!blankText(c(tf[i])))v[tf[i]]=txt(c(tf[i]));
  if(has(S.map,'active')){var ac=bool(c('active'));if(ac===undefined)err=err||'Active must be yes or no';else if(ac!==null)v.active=ac;}
  if(err)return fail(row,err);
  if(!it){                                                       /* new item */
    if(!nameT)return fail(row,'A new item needs a name');
    if(v.rsp==null)return fail(row,'A new item needs an RSP above 0');
    v.name=nameT;if(v.active===undefined)v.active=true;
    row.data=v;row.status='new';row.include=true;return;
  }
  row.item=it;row.data=v;
  var cur={rsp:it.rsp,price:it.price2026,std:it.std,short:it.short,category:it.category,form:it.form,strength:it.strength,pack:it.pack,active:it.active!==false};
  var order=['short','rsp','price','std','category','form','strength','pack','active'],ch=[],k;
  for(i=0;i<order.length;i++){
    k=order[i];if(!has(v,k))continue;
    var a=cur[k],b=v[k],same;
    if(k==='rsp'||k==='price'||k==='std')same=near(a,b);else if(k==='active')same=a===b;else same=txt(a)===b;
    if(!same)ch.push({field:k,old:a==null?null:a,new:b});
  }
  var msg='';
  if(nameT&&low(it.name)!==nameT.toLowerCase()){
    var other=S.itemName[nameT.toLowerCase()];
    if(other&&other[0]!==it)return fail(row,'Another item already has this name');
    if(S.used[it.id]){msg='Name is fixed because orders or deals use this item';row.data=v;}
    else{ch.unshift({field:'name',old:it.name,new:nameT});v.name=nameT;}
  }
  row.changes=ch;
  if(!ch.length&&msg)return fail(row,msg);
  row.msg=msg;
  if(ch.length){row.status='update';row.include=true;}else{row.status='same';row.include=false;}
}

/* deals */
function planDeal(row,c,S){
  if(!doAcct(row,c('account'),S))return;
  if(!doItem(row,c('item'),S,false))return;
  if(pctAmbiguous(c('disc')))return fail(row,AMBIG);
  var p=pct(c('disc'));
  if(p===null)return fail(row,'No discount');
  if(p===undefined)return fail(row,'Discount must be between 0 and 100%');
  var rsp=row.item.rsp;
  if(typeof rsp!=='number'||!(rsp>0))return fail(row,'Item has no RSP');
  var from=has(S.map,'from')?date(c('from')):null;
  if(from===undefined)return fail(row,'From date not understood (use day/month/year)');
  if(from===null)from=S.today;
  var cur=S.dealBy[low(row.account.name)+'\u0001'+row.item.id]||null;
  row.data={pct:p,from:from,rsp:rsp,net:shown(rsp*(1-p),S.opts),notes:note(c('notes')),current:cur?cur.id:null};
  if(!cur){row.status='new';row.include=true;}
  else if(near(cur.pct,p)){row.status='same';row.include=false;}
  else{row.status='update';row.include=true;row.changes=[{field:'pct',old:cur.pct,new:p}];}
}

function blankRow(raw){
  var i;for(i=0;i<raw.length;i++){var v=raw[i];if(v!=null&&!(typeof v==='string'&&/^[\s ]*$/.test(v)))return false;}
  return true;
}
function plan(type,rows,hdr,ctx,opts){
  opts=opts||{};
  var out={rows:[],counts:{ready:0,update:0,same:0,new:0,choose:0,problem:0,duplicate:0,skip:0}},i,k;
  if(!has(FIELDS,type)){out.error='Unknown import type';return out;}
  if(!hdr||hdr.row==null||hdr.row<0){out.error='I could not find the column headings in this sheet.';return out;}
  var miss=requiredMissing(type,hdr.map||{});
  if(miss.length){
    var f=FIELDS[type],names=[];
    for(i=0;i<miss.length;i++)for(k=0;k<f.length;k++)if(f[k].key===miss[i])names.push(f[k].label);
    out.error='Missing column: '+names.join(', ')+'.';return out;
  }
  var defStatus='Executed';
  if(type==='orders'&&opts.defaultStatus!=null&&opts.defaultStatus!==''){
    defStatus=has(STATUSES,low(opts.defaultStatus))?STATUSES[low(opts.defaultStatus)]:undefined;
    if(!defStatus){out.error='Bad default status';return out;}
  }
  if((type==='deals'||type==='items')&&!isArr(opts.deals)){out.error='Existing deals were not supplied';return out;}
  var S=buildIndex(ctx,opts);S.map=hdr.map;S.seen=dict();S.defStatus=defStatus;
  var handler={stock:planStock,orders:planOrder,items:planItem,deals:planDeal}[type];
  for(i=hdr.row+1;i<rows.length;i++){
    var raw=isArr(rows[i])?rows[i].slice():[];
    if(blankRow(raw)){out.counts.skip++;continue;}
    var row=newRow(i+1,raw);
    (function(r){handler(row,function(key){var ix=S.map[key];return ix==null?undefined:r[ix];},S);})(raw);
    out.rows.push(row);
  }
  if(type==='stock')flagTwice(out.rows,function(r){return (r.account?'A'+r.account.id:'O')+'\u0001'+r.item.id;},['new','update','same']);
  else if(type==='items')flagTwice(out.rows,function(r){return r.item?'I'+r.item.id:(r.status==='new'&&r.data.name?'N'+low(r.data.name):null);},['new','update','same']);
  if(type==='items')flagTwice(out.rows,function(r){return (r.status==='new'||(r.status==='update'&&r.item&&r.data&&r.data.name&&r.data.name!==r.item.name))?'NN'+low(r.data.name):null;},['new','update']);
  if(type==='deals')flagTwice(out.rows,function(r){return low(r.account.name)+'\u0001'+r.item.id;},['new','update','same']);
  for(i=0;i<out.rows.length;i++)out.counts[out.rows[i].status]++;
  return out;
}

return {TYPES:TYPES,FIELDS:FIELDS,num:num,pct:pct,date:date,pctAmbiguous:pctAmbiguous,detectHeader:detectHeader,plan:plan};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Imp;
