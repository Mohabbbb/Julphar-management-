/* ==================== V42: Engine ==================== */
/* Julphar Sales Platform V42 - calculation engine (pure, ES5, no host access).
   Implements ARCH_V42.md section 2 (rules) and section 4 (API). See t/ENGINE_NOTES.md for resolved ambiguities. */
var Eng=(function(){"use strict";

var EPS=2.220446049250313e-16;
var DAY_MS=86400000;
var MOVE_TYPES={OPEN:1,COUNT:1,RECEIPT:1,ADJUST:1};
var DEF_CONFIG={startedAt:null,leadDays:7,lowCoverDays:14,horizonDays:30,reserveQuoted:true};

/* ---------- small helpers ---------- */
function isNum(x){return typeof x==='number'&&isFinite(x);}
function num(x){if(x==null||x==='')return null;var n=typeof x==='number'?x:Number(x);return isFinite(n)?n:null;}
function round2(x){return Math.round((x+EPS)*100)/100;}
function toH(x){return Math.round((x+EPS)*100);}           /* money -> integer halalas */
function copy(o){var r={},k;for(k in o){if(Object.prototype.hasOwnProperty.call(o,k))r[k]=o[k];}return r;}
function rowsOf(b){return(b&&Object.prototype.toString.call(b.rows)==='[object Array]')?b.rows:[];}
function str(x){return x==null?'':String(x);}
function has(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function fmtN(n){if(n==null||!isFinite(n))return '';var s=String(Math.round(n));return s.replace(/\B(?=(\d{3})+(?!\d))/g,',');}

/* dates: pure UTC day maths on 'YYYY-MM-DD' */
function dayNum(s){
  var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(str(s));if(!m)return null;
  var y=+m[1],mo=+m[2],d=+m[3];if(mo<1||mo>12||d<1||d>31)return null;
  return Math.round(Date.UTC(y,mo-1,d)/DAY_MS);
}
function daysBetween(a,b){var x=dayNum(a),y=dayNum(b);return(x==null||y==null)?null:y-x;}
function addDays(d,n){var x=dayNum(d);if(x==null||!isFinite(n))return null;return new Date((x+Math.round(n))*DAY_MS).toISOString().slice(0,10);}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&dayNum(s)!=null&&addDays(s,0)===s;}
function validMonth(s){return typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s);}
function addMonths(ym,n){var y=+ym.slice(0,4),m=+ym.slice(5,7)-1+n;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+'-'+(m<9?'0':'')+(m+1);}
function daysInMonth(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).getUTCDate();}
function tsNum(s){if(s==null||s==='')return null;var t=Date.parse(s);return isFinite(t)?t:null;}
function median(arr){
  if(!arr||!arr.length)return null;
  var a=[],i;for(i=0;i<arr.length;i++)if(isNum(arr[i]))a.push(arr[i]);
  if(!a.length)return null;
  a.sort(function(x,y){return x-y;});
  var n=a.length,h=n>>1;
  return n%2?a[h]:(a[h-1]+a[h])/2;
}
function clamp(x,lo,hi){return x<lo?lo:(x>hi?hi:x);}
function todayOf(ctx){return ctx&&ctx.today&&validDate(ctx.today)?ctx.today:new Date().toISOString().slice(0,10);}
/* effective day of a movement: its own date field, else the day part of ts */
function mvDay(m){return validDate(m.date)?m.date:str(m.ts).slice(0,10);}

/* ---------- ctx ---------- */
function ctx(docs,today){
  docs=docs||{};
  var c={today:validDate(today)?today:new Date().toISOString().slice(0,10)};
  var paths=Object.keys(docs).sort(),i,j,p,seg,rows,r;
  var cfg=copy(DEF_CONFIG),sc=docs['stock/config'];
  if(sc&&typeof sc==='object'){for(var k in sc){if(has(sc,k)&&sc[k]!==undefined&&k!=='schema'&&k!=='updatedAt'){cfg[k]=sc[k];}}
    cfg.schema=sc.schema;cfg.updatedAt=sc.updatedAt;}
  cfg.leadDays=num(cfg.leadDays)==null?7:num(cfg.leadDays);
  cfg.lowCoverDays=num(cfg.lowCoverDays)==null?14:num(cfg.lowCoverDays);
  cfg.horizonDays=num(cfg.horizonDays)==null?30:num(cfg.horizonDays);
  cfg.reserveQuoted=cfg.reserveQuoted!==false;
  c.config=cfg;

  c.accounts=[];c.items=[];c.orders=[];c.moves=[];c.targets={};c.itemById={};c.acctById={};c.acctByName={};
  rows=rowsOf(docs['master/accounts']);
  for(i=0;i<rows.length;i++){r=copy(rows[i]);r.closed=r.active===false;c.accounts.push(r);if(r.id!=null)c.acctById[r.id]=r;if(r.name!=null)c.acctByName[r.name]=r;}
  rows=rowsOf(docs['master/items']);
  for(i=0;i<rows.length;i++){r=rows[i];c.items.push(r);if(r.id!=null)c.itemById[r.id]=r;}

  var od={};
  for(i=0;i<paths.length;i++){
    p=paths[i];seg=p.split('/');
    if(seg[0]==='orders'&&seg.length===2){
      rows=rowsOf(docs[p]);
      for(j=0;j<rows.length;j++){
        r=rows[j];if(!r||typeof r!=='object')continue;
        var q=num(r.qty),net=num(r.net),nu=num(r.netUnit);
        if(nu==null&&q!=null&&q>0&&net!=null)nu=net/q;
        var acc=c.acctByName[r.account];
        var o={id:r.id,date:validDate(r.date)?r.date:null,account:r.account,accountId:acc?acc.id:null,itemId:r.itemId==null?null:r.itemId,
          item:r.item,qty:q,net:net,netUnit:nu,status:r.status,createdAt:r.createdAt||null,execAt:r.execAt||null,
          orderRef:r.orderRef||null,source:r.source,opener:false,_p:p};
        o._ts=tsNum(o.execAt||o.createdAt);      /* moveTs: null for history lines */
        if(o.date&&/YTD/i.test(str(r.source)))od[o.date]=1;
        c.orders.push(o);
      }
    }else if(seg[0]==='stock'&&seg.length===2&&seg[1]!=='config'){
      rows=rowsOf(docs[p]);
      for(j=0;j<rows.length;j++){
        r=rows[j];if(!r||typeof r!=='object')continue;
        var m=copy(r);m._p=p;m.type=str(m.type).toUpperCase();m.qty=num(m.qty);m._ts=tsNum(m.ts);
        if(!has(MOVE_TYPES,m.type)||m.qty==null||m._ts==null||m.itemId==null)continue;
        if(m.scope!=='own'&&m.scope!=='acct')continue;
        c.moves.push(m);
      }
    }else if(seg[0]==='targets'&&seg.length===2){
      if(docs[p]&&typeof docs[p]==='object')c.targets[seg[1]]=docs[p];
    }
  }
  c.openerDates=Object.keys(od).sort();
  for(i=0;i<c.orders.length;i++)c.orders[i].opener=!!(c.orders[i].date&&od[c.orders[i].date]);
  c.orders.sort(function(a,b){var d=str(a.date).localeCompare(str(b.date));return d||str(a.id).localeCompare(str(b.id));});
  c.moves.sort(function(a,b){return(a._ts-b._ts)||str(a.id).localeCompare(str(b.id));});
  c.brand=brand(docs);

  /* indexes (built once per ctx; ctx data is treated as immutable afterwards) */
  var X={exec:[],execByItem:{},pairExec:{},acctExec:{},ownBase:{},ownMoves:{},acctBase:{},openAcct:{}};
  for(i=0;i<c.orders.length;i++){
    var ln=c.orders[i];
    if(ln.status!=='Executed'||ln.qty==null||ln.itemId==null)continue;
    X.exec.push(ln);
    (X.execByItem[ln.itemId]=X.execByItem[ln.itemId]||[]).push(ln);
    (X.pairExec[ln.account+'\u0001'+ln.itemId]=X.pairExec[ln.account+'\u0001'+ln.itemId]||[]).push(ln);
    (X.acctExec[ln.account]=X.acctExec[ln.account]||[]).push(ln);
  }
  for(i=0;i<c.moves.length;i++){
    var mv=c.moves[i];
    if(mv.scope==='own'){
      (X.ownMoves[mv.itemId]=X.ownMoves[mv.itemId]||[]).push(mv);
      if(mv.type==='OPEN'||mv.type==='COUNT')X.ownBase[mv.itemId]=mv;     /* sorted by ts then id: last wins */
    }else if(mv.type==='OPEN'||mv.type==='COUNT'){
      var nm=mv.account!=null&&mv.account!==''?mv.account:(c.acctById[mv.accountId]?c.acctById[mv.accountId].name:null);
      if(nm==null&&mv.accountId!=null)nm='#'+mv.accountId;
      if(nm==null)continue;
      var key=nm+'\u0001'+mv.itemId;(X.acctBase[key]=X.acctBase[key]||[]).push(mv);
    }
  }
  c._x=X;c._pc=null;
  return c;
}

/* ---------- brand ---------- */
function brand(docs){
  var b=docs&&docs['master/brand'];b=(b&&typeof b==='object')?b:{};
  function s(v,d){var t=typeof v==='string'?v.replace(/^\s+|\s+$/g,''):'';return t||d;}
  var company=s(b.company,'Julphar'),appName=s(b.appName,'Sales Platform');
  var color=(typeof b.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(b.color))?b.color:'#1f4e79';
  var logo=(typeof b.logo==='string'&&/^data:image\//.test(b.logo))?b.logo:null;
  return {company:company,appName:appName,tagline:typeof b.tagline==='string'?b.tagline:'',color:color,logo:logo,title:company+' '+appName};
}

/* ---------- own stock (2.1) ---------- */
function ownStock(ctx){
  var X=ctx._x,cfg=ctx.config,today=todayOf(ctx),i,j;
  var pred=predictions(ctx);
  var horizonEnd=addDays(today,cfg.horizonDays),expected={};
  for(i=0;i<pred.rows.length;i++){var pr=pred.rows[i];if(pr.status!=='lapsed'&&pr.confidence!=='low'&&!pr.inPipeline&&pr.nextDate<=horizonEnd)expected[pr.itemId]=(expected[pr.itemId]||0)+pr.qty;}
  /* reserved: Pending (+Quoted) platform lines (createdAt present), any date */
  var reserved={};
  for(i=0;i<ctx.orders.length;i++){
    var o=ctx.orders[i];
    if(!o.createdAt||o.qty==null||o.itemId==null)continue;
    if(o.status==='Pending'||(o.status==='Quoted'&&cfg.reserveQuoted))reserved[o.itemId]=(reserved[o.itemId]||0)+o.qty;
  }
  /* daily use: last 90 days by date, executed, not opener */
  var from=addDays(today,-90),use={};
  for(i=0;i<X.exec.length;i++){var e=X.exec[i];if(e.opener||!e.date||e.date<=from||e.date>today)continue;use[e.itemId]=(use[e.itemId]||0)+e.qty;}
  /* universe: active items + any item with an own movement */
  var ids=[],seen={};
  for(i=0;i<ctx.items.length;i++){var it=ctx.items[i];if(it.active!==false&&!has(seen,it.id)){seen[it.id]=1;ids.push(it.id);}}
  for(var k in X.ownMoves){if(has(X.ownMoves,k)&&!has(seen,k)){seen[k]=1;ids.push(k);}}
  var rows=[],sum={tracked:0,untracked:0,out:0,short:0,low:0,negative:0,ok:0};
  for(i=0;i<ids.length;i++){
    var id=ids[i],im=ctx.itemById[id],B=X.ownBase[id];
    var nm=im?(im.name||id):id;
    if(!im&&X.ownMoves[id]){var f=X.ownMoves[id][0];nm=f.item||id;}
    var row={itemId:id,item:nm,status:'untracked',tracked:false,baseQty:null,baseTs:null,receipts:null,adjust:null,shipped:null,onHand:null,
      reserved:null,available:null,dailyUse:null,coverDays:null,expected:null,projected:null,lastCountTs:null};
    if(B){
      var rec=0,adj=0,shp=0,mv=X.ownMoves[id];
      for(j=0;j<mv.length;j++){var m=mv[j];if(m._ts>B._ts){if(m.type==='RECEIPT')rec+=m.qty;else if(m.type==='ADJUST')adj+=m.qty;}}
      var ex=X.execByItem[id]||[];
      for(j=0;j<ex.length;j++){if(ex[j]._ts!=null&&ex[j]._ts>B._ts)shp+=ex[j].qty;}
      var onHand=B.qty+rec+adj-shp,res=reserved[id]||0,avail=onHand-res;
      var du=use[id]>0?use[id]/90:null;
      var cover=(du!=null&&du>0)?Math.max(0,Math.floor(avail/du)):null;
      var exp=expected[id]||0,proj=avail-exp;
      var status;
      if(onHand<0)status='negative';else if(avail<=0)status='out';else if(proj<0)status='short';
      else if(cover!=null&&cover<cfg.lowCoverDays)status='low';else status='ok';
      row.status=status;row.tracked=true;row.baseQty=B.qty;row.baseTs=B.ts;row.receipts=rec;row.adjust=adj;row.shipped=shp;
      row.onHand=onHand;row.reserved=res;row.available=avail;row.dailyUse=du;row.coverDays=cover;row.expected=exp;row.projected=proj;row.lastCountTs=B.ts;
      sum.tracked++;sum[status]++;
    }else sum.untracked++;
    rows.push(row);
  }
  return {rows:rows,summary:sum};
}

/* ---------- account stock (2.2) ---------- */
function acctPair(ctx,name,itemId){
  var X=ctx._x,key=name+'\u0001'+itemId,bl=X.acctBase[key];
  if(!bl||!bl.length)return null;
  var today=todayOf(ctx),B=bl[bl.length-1],ex=X.pairExec[key]||[],j,delivered=0;
  for(j=0;j<ex.length;j++){if(ex[j]._ts!=null&&ex[j]._ts>B._ts)delivered+=ex[j].qty;}
  var du=null,src=null;
  if(bl.length>=2){
    var prev=bl[bl.length-2],between=0;
    for(j=0;j<ex.length;j++){if(ex[j]._ts!=null&&ex[j]._ts>prev._ts&&ex[j]._ts<=B._ts)between+=ex[j].qty;}
    var span=Math.max(1,daysBetween(mvDay(prev),mvDay(B)));
    var cons=(prev.qty+between-B.qty)/span;
    if(cons>0){du=cons;src='counts';}
  }
  if(du==null){
    var from=addDays(today,-180),first=null,tot=0;
    for(j=0;j<ex.length;j++){
      var l=ex[j];if(l.opener||!l.date||l.date<=from||l.date>today)continue;
      tot+=l.qty;if(first==null||l.date<first)first=l.date;
    }
    if(first!=null){var sp=Math.max(30,daysBetween(first,today));du=tot/sp;src='orders';}
  }
  var dsince=Math.max(0,daysBetween(mvDay(B),today)||0);
  var est,noUse=false;
  if(du!=null)est=Math.max(0,round2(B.qty+delivered-du*dsince));else{est=B.qty+delivered;noUse=true;}
  var cover=null,run=null;
  if(du!=null&&du>0){cover=Math.floor(est/du);run=addDays(today,cover);}
  return {baseQty:B.qty,baseTs:B.ts,delivered:delivered,dailyUse:du,usageSource:src,estOnHand:est,runOutDate:run,coverDays:cover,noUsage:noUse};
}
function acctStock(ctx,accountName){
  var X=ctx._x,ids=[],seen={},i,key,sep=accountName+'\u0001';
  var ex=X.acctExec[accountName]||[];
  for(i=0;i<ex.length;i++){if(!has(seen,ex[i].itemId)){seen[ex[i].itemId]=ex[i].item;}}
  for(key in X.acctBase){if(has(X.acctBase,key)&&key.indexOf(sep)===0){var id=key.slice(sep.length);if(!has(seen,id))seen[id]=X.acctBase[key][0].item;}}
  var rows=[];
  for(var id2 in seen){
    if(!has(seen,id2))continue;
    var im=ctx.itemById[id2],nm=im?(im.name||id2):(seen[id2]||id2);
    var ap=acctPair(ctx,accountName,id2);
    var row={itemId:id2,item:nm,tracked:!!ap,baseQty:null,baseTs:null,delivered:null,dailyUse:null,usageSource:null,estOnHand:null,runOutDate:null,coverDays:null};
    if(ap){row.baseQty=ap.baseQty;row.baseTs=ap.baseTs;row.delivered=ap.delivered;row.dailyUse=ap.dailyUse;row.usageSource=ap.usageSource;
      row.estOnHand=ap.estOnHand;row.runOutDate=ap.runOutDate;row.coverDays=ap.coverDays;if(ap.noUsage)row.note='no usage data';}
    rows.push(row);
  }
  rows.sort(function(a,b){return str(a.item).localeCompare(str(b.item));});
  return {rows:rows};
}

/* ---------- predictions (2.3) ---------- */
function predictions(ctx){
  var today=todayOf(ctx),cfg=ctx.config,ck=today+'|'+cfg.leadDays;
  if(ctx._pc&&ctx._pc.k===ck&&ctx._pc.v)return ctx._pc.v;
  var X=ctx._x,i,j,pairs={},acctDates={},acctSeen={};
  for(i=0;i<X.exec.length;i++){
    var l=X.exec[i];
    if(l.opener||!l.date)continue;
    var a=ctx.acctByName[l.account];if(a&&a.closed)continue;
    var pk=l.account+'\u0001'+l.itemId;
    (pairs[pk]=pairs[pk]||{account:l.account,itemId:l.itemId,lines:[]}).lines.push(l);
    if(!acctSeen[l.account+'\u0001'+l.date]){acctSeen[l.account+'\u0001'+l.date]=1;(acctDates[l.account]=acctDates[l.account]||[]).push(l.date);}
  }
  var accRhythm={};
  for(var an in acctDates){
    if(!has(acctDates,an))continue;
    var ds=acctDates[an].sort();
    if(ds.length>=2)accRhythm[an]=clamp(Math.round(daysBetween(ds[0],ds[ds.length-1])/(ds.length-1)),7,180);
  }
  /* open platform pipeline lines (Pending/Quoted with createdAt) per account NAME + item */
  var openLn={};
  for(i=0;i<ctx.orders.length;i++){
    var pl=ctx.orders[i];
    if((pl.status!=='Pending'&&pl.status!=='Quoted')||!pl.createdAt||!pl.date||pl.qty==null||pl.itemId==null)continue;
    (openLn[pl.account+'\u0001'+pl.itemId]=openLn[pl.account+'\u0001'+pl.itemId]||[]).push(pl);
  }
  var rows=[],dormant=0;
  for(var key in pairs){
    if(!has(pairs,key))continue;
    var pr=pairs[key],lines=pr.lines;      /* already sorted by date,id */
    var perDate={},dates=[];
    for(j=0;j<lines.length;j++){var d=lines[j].date;if(!has(perDate,d)){perDate[d]=0;dates.push(d);}perDate[d]+=lines[j].qty;}
    dates.sort();
    var n=dates.length,lastDate=dates[n-1];
    if(daysBetween(lastDate,today)>365){dormant++;continue;}
    var interval,conf,kind;
    if(n>=2){interval=clamp(Math.round(daysBetween(dates[0],lastDate)/(n-1)),7,180);conf=n>=4?'high':'medium';kind='item';}
    else{
      if(!has(accRhythm,pr.account))continue;       /* account itself has < 2 dates: never invent */
      interval=accRhythm[pr.account];conf='low';kind='acct';
    }
    var qs=[];for(j=0;j<dates.length;j++)qs.push(perDate[dates[j]]);
    var qty=Math.max(1,Math.round(median(qs)));
    var last=lines[lines.length-1];
    var nu=last.netUnit,value=(nu!=null)?round2(qty*nu):null;
    var nextDate=addDays(lastDate,interval),runNote='';
    var ap=acctPair(ctx,pr.account,pr.itemId);
    if(ap&&ap.runOutDate){
      var ro=addDays(ap.runOutDate,-cfg.leadDays);
      if(ro<nextDate){nextDate=ro;}
      runNote=' · stock runs out '+ap.runOutDate;
    }
    var daysTo=daysBetween(today,nextDate);
    var status=daysTo<-Math.max(45,interval)?'lapsed':(daysTo<0?'overdue':(daysTo<=7?'due':(daysTo<=21?'soon':'later')));
    var inPipe=false,pipeQty=0,ol=openLn[key]||[];
    for(j=0;j<ol.length;j++){if(ol[j].date>=lastDate){inPipe=true;pipeQty+=ol[j].qty;}}
    var im=ctx.itemById[pr.itemId],acc=ctx.acctByName[pr.account];
    var basis=(kind==='item'?'every '+interval+' days ('+n+' orders)':'account orders every '+interval+' days (1 order of this item)')+' · usually '+fmtN(qty)+runNote;
    rows.push({account:pr.account,accountId:acc?acc.id:null,itemId:pr.itemId,item:im?(im.name||last.item):last.item,lastDate:lastDate,n:n,interval:interval,
      qty:qty,netUnit:nu,value:value,nextDate:nextDate,daysTo:daysTo,status:status,confidence:conf,basis:basis,inPipeline:inPipe,pipelineQty:pipeQty});
  }
  rows.sort(function(x,y){return x.nextDate<y.nextDate?-1:x.nextDate>y.nextDate?1:(str(x.account).localeCompare(str(y.account))||str(x.item).localeCompare(str(y.item)));});
  var counts={lapsed:0,overdue:0,due:0,soon:0,later:0};
  for(j=0;j<rows.length;j++)counts[rows[j].status]++;
  var res={rows:rows,dormant:dormant,counts:counts};
  ctx._pc={k:ck,v:res};
  return res;
}

/* ---------- pipeline ---------- */
function pipeline(ctx){
  var today=todayOf(ctx),groups=[],by={},i,qty=0,net=0;
  for(i=0;i<ctx.orders.length;i++){
    var o=ctx.orders[i];
    if(o.status!=='Pending'&&o.status!=='Quoted')continue;
    var d=o.date||(o.createdAt?str(o.createdAt).slice(0,10):null);
    var key=o.orderRef||(str(o.account)+'|'+str(d));
    var g=by[key];
    if(!g){g={key:key,account:o.account,date:d,ref:o.orderRef,status:o.status,lines:[],qty:0,net:0,ageDays:null};by[key]=g;groups.push(g);}
    if(o.status==='Pending')g.status='Pending';
    if(d&&(!g.date||d<g.date))g.date=d;
    g.lines.push(o.id);
    if(o.qty!=null){g.qty+=o.qty;qty+=o.qty;}
    if(o.net!=null){g.net+=o.net;net+=o.net;}
  }
  for(i=0;i<groups.length;i++){groups[i].net=round2(groups[i].net);groups[i].ageDays=groups[i].date?Math.max(0,daysBetween(groups[i].date,today)):null;}
  groups.sort(function(a,b){return(b.ageDays||0)-(a.ageDays||0)||str(a.key).localeCompare(str(b.key));});
  return {groups:groups,qty:qty,net:round2(net)};
}

/* ---------- scope (2.6) ---------- */
function scope(ctx,opts){
  var period=String((opts&&opts.period)||'all').toLowerCase(),today=todayOf(ctx);
  if(period==='thisyear'||period==='this year'||period==='year')period=today.slice(0,4);
  var yr=/^\d{4}$/.test(period)?period:null;
  var X=ctx._x,out=[],exAcc={},exNet=0,net=0,i;
  for(i=0;i<X.exec.length;i++){
    var o=X.exec[i];
    if(yr&&!(o.date&&o.date.slice(0,4)===yr))continue;
    var a=ctx.acctByName[o.account];
    if(a&&a.closed){exAcc[o.account]=1;if(o.net!=null)exNet+=o.net;continue;}
    out.push(o);if(o.net!=null)net+=o.net;
  }
  return {orders:out,net:round2(net),period:yr||'all',excluded:{accounts:Object.keys(exAcc).sort(),net:round2(exNet)}};
}

/* ---------- target breakdown (2.4) ---------- */
function targetBreakdown(ctx,opts){
  opts=opts||{};
  var X=ctx._x,today=todayOf(ctx),warnings=[],i,j,k;
  var month=opts.month;
  if(!validMonth(month))return {ok:false,error:'Pick a month (YYYY-MM)'};
  var T=num(opts.total);
  if(T==null||T<=0)return {ok:false,error:'Enter a total greater than 0'};
  var totH=toH(T);if(totH<=0)return {ok:false,error:'Enter a total greater than 0'};
  var w=num(opts.histWeight);if(w==null)w=0.7;w=clamp(w,0,1);
  var h=num(opts.histMonths);h=h==null?6:clamp(Math.round(h),1,60);
  var ag=opts.acctGrowth||{},ig=opts.itemGrowth||{},af=opts.acctFixed||{};
  function growth(map,key,label){
    var g=num(map[key]);if(g==null)return 0;
    if(g<-100){warnings.push(label+' growth '+g+'% raised to -100%');return -100;}
    if(g>500){warnings.push(label+' growth '+g+'% lowered to 500%');return 500;}
    return g;
  }
  /* universe */
  var accs=[],items=[],openAcct={},actItem={};
  for(i=0;i<ctx.accounts.length;i++){if(!ctx.accounts[i].closed){accs.push(ctx.accounts[i]);openAcct[ctx.accounts[i].name]=ctx.accounts[i];}}
  for(i=0;i<ctx.items.length;i++){if(ctx.items[i].active!==false){items.push(ctx.items[i]);actItem[ctx.items[i].id]=ctx.items[i];}}
  /* fixed accounts validation */
  var fixed={},fixedSum=0,fk;
  for(fk in af){
    if(!has(af,fk))continue;
    var fv=num(af[fk]);if(fv==null)continue;
    var fa=ctx.acctById[fk];
    if(!fa||fa.closed)return {ok:false,error:'Fixed amount given for '+(fa?fa.name:fk)+', which is not an open account'};
    if(fv<0)return {ok:false,error:'Fixed amount for '+fa.name+' cannot be negative'};
    fixed[fk]=toH(fv);fixedSum+=fixed[fk];
  }
  if(fixedSum>totH)return {ok:false,error:'Fixed amounts ('+fmtN(fixedSum/100)+') are more than the total ('+fmtN(totH/100)+')'};
  /* hist */
  var start=addMonths(month,-h)+'-01',end=month+'-01',hist={},histSum=0;
  for(i=0;i<X.exec.length;i++){
    var o=X.exec[i];
    if(!o.date||o.date<start||o.date>=end||o.net==null)continue;
    var oa=openAcct[o.account];if(!oa||!has(actItem,o.itemId))continue;
    var ck=oa.id+'\u0001'+o.itemId;hist[ck]=(hist[ck]||0)+o.net;histSum+=o.net;
  }
  /* potential: predicted value with nextDate in month + pipeline net dated in month */
  var pot={},potSum=0,pred=predictions(ctx);
  for(i=0;i<pred.rows.length;i++){
    var pr=pred.rows[i];
    if(pr.value==null||pr.status==='lapsed'||pr.inPipeline||pr.nextDate.slice(0,7)!==month||!pr.accountId||!openAcct[pr.account]||!has(actItem,pr.itemId))continue;
    var pk=pr.accountId+'\u0001'+pr.itemId;pot[pk]=(pot[pk]||0)+pr.value;potSum+=pr.value;
  }
  for(i=0;i<ctx.orders.length;i++){
    var po=ctx.orders[i];
    if((po.status!=='Pending'&&po.status!=='Quoted')||!po.date||po.date.slice(0,7)!==month||po.net==null)continue;
    var pa=openAcct[po.account];if(!pa||!has(actItem,po.itemId))continue;
    var pk2=pa.id+'\u0001'+po.itemId;pot[pk2]=(pot[pk2]||0)+po.net;potSum+=po.net;
  }
  if(!(histSum>0)&&!(potSum>0))return {ok:false,error:'No history or potential to break down'};
  var useH=histSum>0,useP=potSum>0,wEff=w;
  if(!useH){wEff=0;warnings.push('No sales history in the last '+h+' months - using potential only');}
  else if(!useP){wEff=1;warnings.push('No expected orders or pipeline in '+month+' - using history only');}
  /* cells */
  var cells={},cellList=[],totBase=0;
  var keys={},ck2;
  for(ck2 in hist)if(has(hist,ck2))keys[ck2]=1;
  for(ck2 in pot)if(has(pot,ck2))keys[ck2]=1;
  for(ck2 in keys){
    if(!has(keys,ck2))continue;
    var parts=ck2.split('\u0001'),aId=parts[0],iId=parts[1];
    var H=useH?(hist[ck2]||0)/histSum:0,P=useP?(pot[ck2]||0)/potSum:0;
    var base=wEff*H+(1-wEff)*P;
    if(!(base>0))continue;
    var wt=base*(1+growth(ag,aId,ctx.acctById[aId].name)/100)*(1+growth(ig,iId,(ctx.itemById[iId].short||ctx.itemById[iId].name||iId))/100);
    var cell={a:aId,i:iId,base:base,w:wt,hist:hist[ck2]||0,pot:pot[ck2]||0,t:0};
    cells[ck2]=cell;cellList.push(cell);totBase+=base;
  }
  /* growth warnings are pushed once per cell; de-duplicate */
  var seenW={},dw=[];for(i=0;i<warnings.length;i++){if(!has(seenW,warnings[i])){seenW[warnings[i]]=1;dw.push(warnings[i]);}}warnings=dw;
  cellList.sort(function(x,y){return x.a<y.a?-1:x.a>y.a?1:(x.i<y.i?-1:x.i>y.i?1:0);});
  /* group by account */
  var byA={};
  for(i=0;i<cellList.length;i++){(byA[cellList[i].a]=byA[cellList[i].a]||{cells:[],w:0}).cells.push(cellList[i]);byA[cellList[i].a].w+=cellList[i].w;}
  /* allocate in halalas */
  function allocate(list,poolH,sumW){
    var cs=[],s=0,big=0,x;
    for(x=0;x<list.length;x++){var v=Math.round(poolH*list[x].w/sumW);cs.push(v);s+=v;}
    /* rounding remainder goes on the largest cell (ties: first) so the pool sums exactly */
    for(x=1;x<cs.length;x++){if(cs[x]>cs[big])big=x;}
    cs[big]+=poolH-s;
    for(x=0;x<list.length;x++)list[x].t=cs[x];
  }
  var poolH=totH-fixedSum;
  for(fk in fixed){
    if(!has(fixed,fk)||fixed[fk]<=0)continue;
    var ga=byA[fk];
    if(!ga||!(ga.w>0))return {ok:false,error:ctx.acctById[fk].name+' has no history or potential to split a fixed amount over'};
    allocate(ga.cells,fixed[fk],ga.w);
  }
  if(poolH>0){
    var plist=[],pw=0;
    for(var ak in byA){if(has(byA,ak)&&!has(fixed,ak)){for(j=0;j<byA[ak].cells.length;j++)plist.push(byA[ak].cells[j]);pw+=byA[ak].w;}}
    if(!(pw>0))return {ok:false,error:'No history or potential left to split the remaining '+fmtN(poolH/100)+' over the other accounts'};
    allocate(plist,poolH,pw);
  }
  /* outputs */
  var rows=[],accOut={},itemOut={};
  for(i=0;i<cellList.length;i++){
    var c=cellList[i];
    var a2=ctx.acctById[c.a],i2=ctx.itemById[c.i];
    var ao=accOut[c.a]||(accOut[c.a]={a:c.a,account:a2.name,baseShare:0,share:0,t:0,fixed:has(fixed,c.a)&&fixed[c.a]>0,_h:0});
    var io=itemOut[c.i]||(itemOut[c.i]={i:c.i,item:i2.name||c.i,baseShare:0,share:0,t:0,_h:0});
    ao.baseShare+=c.base/totBase;io.baseShare+=c.base/totBase;
    ao._h+=c.t;io._h+=c.t;
    if(c.t>0)rows.push({a:c.a,i:c.i,account:a2.name,item:i2.name||c.i,base:round2(T*c.base/totBase),baseShare:c.base/totBase,
      hist:round2(c.hist),pot:round2(c.pot),t:c.t/100});
  }
  var byAccount=[],byItem=[];
  for(k in accOut){if(has(accOut,k)){var A=accOut[k];A.t=A._h/100;A.share=A._h/totH;delete A._h;byAccount.push(A);}}
  for(k in itemOut){if(has(itemOut,k)){var I=itemOut[k];I.t=I._h/100;I.share=I._h/totH;delete I._h;byItem.push(I);}}
  byAccount.sort(function(x,y){return y.t-x.t||str(x.account).localeCompare(str(y.account));});
  byItem.sort(function(x,y){return y.t-x.t||str(x.item).localeCompare(str(y.item));});
  rows.sort(function(x,y){return str(x.account).localeCompare(str(y.account))||y.t-x.t||str(x.item).localeCompare(str(y.item));});
  return {ok:true,rows:rows,byAccount:byAccount,byItem:byItem,total:totH/100,warnings:warnings,month:month,histWeight:wEff};
}

/* ---------- target progress (2.5) ---------- */
function targetProgress(ctx,doc){
  doc=doc||{};
  var X=ctx._x,today=todayOf(ctx),month=doc.month,i;
  var rows=Object.prototype.toString.call(doc.rows)==='[object Array]'?doc.rows:[];
  var dim=validMonth(month)?daysInMonth(month):null;
  var cm=today.slice(0,7),mode,elapsed;
  if(!validMonth(month)){mode='final';elapsed=0;dim=0;}
  else if(month===cm){mode='current';elapsed=+today.slice(8,10);}
  else if(month<cm){mode='final';elapsed=dim;}
  else{mode='future';elapsed=0;}
  var tA={},tI={},tTot=0,closedT=0;
  for(i=0;i<rows.length;i++){
    var r=rows[i],t=num(r.t);if(t==null||t<=0)continue;
    var ac=ctx.acctById[r.a];
    if(ac&&ac.closed){closedT+=t;continue;}
    tA[r.a]=(tA[r.a]||0)+t;tI[r.i]=(tI[r.i]||0)+t;tTot+=t;
  }
  var total=num(doc.total);if(total==null)total=round2(tTot+closedT);
  var aA={},aI={},actual=0;
  if(validMonth(month)){
    for(i=0;i<X.exec.length;i++){
      var o=X.exec[i];
      if(!o.date||o.date.slice(0,7)!==month||o.net==null)continue;
      var oa=ctx.acctByName[o.account];if(oa&&oa.closed)continue;
      var aid=oa?oa.id:('#'+o.account);
      aA[aid]=(aA[aid]||0)+o.net;aI[o.itemId]=(aI[o.itemId]||0)+o.net;actual+=o.net;
    }
  }
  function mk(t,act){
    var o={t:round2(t),actual:round2(act),pct:t>0?act/t:null,runRate:null,gap:round2(t-act),status:null};
    if(mode==='current'){o.runRate=elapsed>0?act/elapsed*dim:null;}
    if(t<=0)o.status='no target';
    else if(mode==='current')o.status=o.runRate>=t?'ahead':(o.runRate<0.9*t?'behind':'on track');
    else o.status=mode==='future'?'upcoming':'final';
    return o;
  }
  var byAccount=[],byItem=[],k,seen={};
  for(k in tA)if(has(tA,k))seen[k]=1;
  for(k in aA)if(has(aA,k))seen[k]=1;
  for(k in seen){
    if(!has(seen,k))continue;
    var ao=mk(tA[k]||0,aA[k]||0),acc=ctx.acctById[k];
    ao.a=k.charAt(0)==='#'?null:k;ao.account=acc?acc.name:(k.charAt(0)==='#'?k.slice(1):k);byAccount.push(ao);
  }
  seen={};
  for(k in tI)if(has(tI,k))seen[k]=1;
  for(k in aI)if(has(aI,k))seen[k]=1;
  for(k in seen){
    if(!has(seen,k))continue;
    var io=mk(tI[k]||0,aI[k]||0),im=ctx.itemById[k];
    io.i=k;io.item=im?(im.name||k):k;byItem.push(io);
  }
  byAccount.sort(function(x,y){return y.t-x.t||y.actual-x.actual||str(x.account).localeCompare(str(y.account));});
  byItem.sort(function(x,y){return y.t-x.t||y.actual-x.actual||str(x.item).localeCompare(str(y.item));});
  var tot=mk(total,actual);
  return {month:month,total:round2(total),actual:tot.actual,pct:tot.pct,runRate:tot.runRate,gap:tot.gap,status:tot.status,daysElapsed:elapsed,daysInMonth:dim,
    mode:mode,closedTarget:round2(closedT),byAccount:byAccount,byItem:byItem};
}

/* ---------- alerts (2.7) ---------- */
function alerts(ctx,opts){
  opts=opts||{};
  var today=todayOf(ctx),out=[],i,j;
  var own=ownStock(ctx),pred=predictions(ctx),pipe=pipeline(ctx);
  /* stock */
  for(i=0;i<own.rows.length;i++){
    var r=own.rows[i];
    if(r.status==='negative')out.push({sev:'bad',kind:'stock',title:r.item+': negative stock',detail:'On hand is '+fmtN(r.onHand)+' - the count is out of date. Do a stock count.',action:{type:'count',arg:r.itemId}});
    else if(r.status==='out')out.push({sev:'bad',kind:'stock',title:r.item+': out of stock',detail:'Available '+fmtN(r.available)+' (on hand '+fmtN(r.onHand)+', reserved '+fmtN(r.reserved)+').',action:{type:'receive',arg:r.itemId}});
    else if(r.status==='short')out.push({sev:'warn',kind:'stock',title:r.item+': will run short',detail:'Available '+fmtN(r.available)+' but about '+fmtN(r.expected)+' expected in the next '+ctx.config.horizonDays+' days.',action:{type:'receive',arg:r.itemId}});
    else if(r.status==='low')out.push({sev:'warn',kind:'stock',title:r.item+': low cover',detail:'About '+r.coverDays+' days of cover left (available '+fmtN(r.available)+').',action:{type:'receive',arg:r.itemId}});
  }
  /* reorders grouped by account */
  var ra={},rorder=[];
  for(i=0;i<pred.rows.length;i++){
    var p=pred.rows[i];if((p.status!=='overdue'&&p.status!=='due')||p.inPipeline)continue;
    if(!ra[p.account]){ra[p.account]={over:0,items:[]};rorder.push(p.account);}
    if(p.status==='overdue')ra[p.account].over++;
    ra[p.account].items.push(p.item+' x '+fmtN(p.qty));
  }
  for(i=0;i<rorder.length;i++){
    var g=ra[rorder[i]],n=g.items.length;
    out.push({sev:g.over?'warn':'info',kind:'reorder',title:rorder[i]+': '+n+' reorder'+(n===1?'':'s')+(g.over?' due (overdue)':' due'),
      detail:g.items.slice(0,4).join(', ')+(n>4?' and '+(n-4)+' more':''),action:{type:'draft-order',arg:rorder[i]}});
  }
  /* pipeline older than 14 days */
  for(i=0;i<pipe.groups.length;i++){
    var pg=pipe.groups[i];
    if(pg.ageDays!=null&&pg.ageDays>14)out.push({sev:'warn',kind:'pipeline',title:pg.account+': '+pg.status+' order open for '+pg.ageDays+' days',
      detail:pg.lines.length+' line'+(pg.lines.length===1?'':'s')+' · '+fmtN(pg.net)+' SAR · '+(pg.ref||pg.date),action:{type:'open-orders',arg:pg.ref||pg.account}});
  }
  /* deals */
  var deals=opts.deals||[],dg={},dorder=[],end=addDays(today,14);
  for(i=0;i<deals.length;i++){
    var d=deals[i];if(!d||d.status!=='Active'||!validDate(d.to))continue;
    var an=d.acct!=null?d.acct:d.account;
    var late=d.to<today;
    if(!(late||d.to<=end))continue;
    if(!dg[an]){dg[an]={late:0,n:0,first:d.to,items:[]};dorder.push(an);}
    if(late)dg[an].late++;
    dg[an].n++;if(d.to<dg[an].first)dg[an].first=d.to;
    dg[an].items.push(d.item||d.itemId);
  }
  for(i=0;i<dorder.length;i++){
    var dd=dg[dorder[i]];
    out.push({sev:dd.late?'bad':'warn',kind:'deal',title:dorder[i]+': '+dd.n+' deal'+(dd.n===1?'':'s')+(dd.late?' past end date, still Active':' ending within 14 days'),
      detail:'Earliest end '+dd.first+' · '+dd.items.slice(0,3).join(', ')+(dd.n>3?' and '+(dd.n-3)+' more':''),action:{type:'open-pricing',arg:dorder[i]}});
  }
  /* current-month target */
  var cm=today.slice(0,7),td=ctx.targets[cm];
  if(td){
    var tp=targetProgress(ctx,td);
    if(tp.status==='behind')out.push({sev:tp.daysElapsed<7?'info':'warn',kind:'target',title:'Behind target for '+cm,
      detail:'Run-rate '+fmtN(tp.runRate)+' vs target '+fmtN(tp.total)+' SAR ('+Math.round(tp.runRate/tp.total*100)+'%). Actual so far '+fmtN(tp.actual)+'.',action:{type:'open-targets',arg:cm}});
  }
  /* backup */
  var lb=opts.lastBackup,ld=lb&&tsNum(lb)!=null?str(lb).slice(0,10):null,bd=ld?daysBetween(ld,today):null;
  if(bd==null)out.push({sev:'warn',kind:'backup',title:'No backup downloaded yet',detail:'No backup has been downloaded in this browser. Download one now.',action:{type:'backup',arg:null}});
  else if(bd>7)out.push({sev:'warn',kind:'backup',title:'Backup is '+bd+' days old',detail:'Last backup downloaded '+ld+'. Download a fresh one.',action:{type:'backup',arg:null}});
  /* counts older than 30 days */
  var old=[];
  for(i=0;i<own.rows.length;i++){
    var o=own.rows[i];
    if(o.tracked&&o.lastCountTs){var cd=daysBetween(str(o.lastCountTs).slice(0,10),today);if(cd!=null&&cd>30)old.push(o.item);}
  }
  if(old.length)out.push({sev:'info',kind:'count',title:old.length+' item'+(old.length===1?'':'s')+' not counted for over 30 days',
    detail:old.slice(0,4).join(', ')+(old.length>4?' and '+(old.length-4)+' more':''),action:{type:'count',arg:null}});
  var rank={bad:0,warn:1,info:2},idx=[];
  for(j=0;j<out.length;j++)idx.push(j);
  idx.sort(function(a,b){return(rank[out[a].sev]-rank[out[b].sev])||(a-b);});
  var res=[];for(j=0;j<idx.length;j++)res.push(out[idx[j]]);
  return res;
}

/* ---------- stock paths / ids / validation ---------- */
function stockPath(peek,ym){
  var base='stock/'+ym,n=1,path=base,body;
  while(n<100){
    body=peek(path);
    if(body==null||JSON.stringify(body).length<=180000)return path;
    n++;path=base+'-'+n;
  }
  return path;
}
function nextMoveId(ctx,extraRows){
  var mx=0,i,all=(ctx&&ctx.moves||[]).concat(extraRows||[]);
  for(i=0;i<all.length;i++){var m=/^SM(\d+)$/.exec(str(all[i]&&all[i].id));if(m&&+m[1]>mx)mx=+m[1];}
  var s=String(mx+1);while(s.length<5)s='0'+s;
  return 'SM'+s;
}
function isInt(x){return isNum(x)&&Math.floor(x)===x;}
function validateMove(m){
  if(!m||typeof m!=='object')return 'Movement is missing';
  if(!has(MOVE_TYPES,m.type))return 'Type must be OPEN, COUNT, RECEIPT or ADJUST';
  if(m.scope!=='own'&&m.scope!=='acct')return 'Scope must be own or acct';
  if(m.itemId==null||str(m.itemId)==='')return 'Pick an item';
  if(typeof m.qty!=='number'||!isInt(m.qty))return 'Quantity must be a whole number';
  if(m.type==='ADJUST'){
    if(m.qty===0)return 'Adjustment cannot be 0';
    if(str(m.notes).replace(/\s+/g,'')==='')return 'Give a reason for the adjustment';
  }else if(m.qty<0)return 'Quantity cannot be negative';
  if(m.scope==='acct'){
    if(m.type!=='OPEN'&&m.type!=='COUNT')return 'Account stock only accepts a count';
    if(str(m.account)===''&&str(m.accountId)==='')return 'Pick an account';
  }else{
    if(m.account!=null&&m.account!=='')return 'Own stock movements must not name an account';
  }
  if(!validDate(m.date))return 'Date must be YYYY-MM-DD';
  if(tsNum(m.ts)==null)return 'Timestamp is missing or invalid';
  if(m.id!=null&&!/^SM\d{5,}$/.test(str(m.id)))return 'Movement id looks wrong';
  return null;
}

/* ---------- backup (2.8) ---------- */
function validateBackup(obj){
  if(!obj||typeof obj!=='object'||Object.prototype.toString.call(obj)==='[object Array]')return {ok:false,error:'This file is not a backup (expected a JSON object)'};
  var d=obj.docs;
  if(!d||typeof d!=='object'||Object.prototype.toString.call(d)==='[object Array]')return {ok:false,error:'This file has no "docs" section - it is not a Download backup file'};
  var keys=Object.keys(d),i;
  if(!keys.length)return {ok:false,error:'The backup is empty'};
  for(i=0;i<keys.length;i++){
    if(!/^(master|deals|orders|audit|plan|stock|targets)\/[A-Za-z0-9_.-]+$/.test(keys[i]))return {ok:false,error:'Unexpected document name: '+keys[i]};
    var b=d[keys[i]];
    if(!b||typeof b!=='object'||Object.prototype.toString.call(b)==='[object Array]')return {ok:false,error:'Document '+keys[i]+' is not an object'};
  }
  if(!has(d,'master/settings'))return {ok:false,error:'The backup has no master/settings document'};
  return {ok:true,docs:d};
}
function stable(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v===undefined?null:v);
  if(Object.prototype.toString.call(v)==='[object Array]'){var a=[],i;for(i=0;i<v.length;i++)a.push(stable(v[i]));return '['+a.join(',')+']';}
  var ks=Object.keys(v).sort(),p=[],j;
  for(j=0;j<ks.length;j++){if(v[ks[j]]!==undefined)p.push(JSON.stringify(ks[j])+':'+stable(v[ks[j]]));}
  return '{'+p.join(',')+'}';
}
function orderTotals(docs){
  var lines=0,net=0,k,rows,i;
  for(k in docs){
    if(!has(docs,k)||!/^orders\/[^\/]+$/.test(k))continue;
    rows=rowsOf(docs[k]);
    for(i=0;i<rows.length;i++){lines++;if(rows[i]&&rows[i].status==='Executed'&&isNum(num(rows[i].net)))net+=num(rows[i].net);}
  }
  return {lines:lines,net:round2(net)};
}
function backupDiff(cur,bak){
  cur=cur||{};bak=bak||{};
  var add=[],change=[],same=[],onlyCurrent=[],k,i;
  for(k in bak){if(!has(bak,k))continue;if(!has(cur,k))add.push(k);else if(stable(cur[k])===stable(bak[k]))same.push(k);else change.push(k);}
  for(k in cur){if(has(cur,k)&&!has(bak,k))onlyCurrent.push(k);}
  add.sort();change.sort();same.sort();onlyCurrent.sort();
  /* "overflow" pages (orders/2026-09-2, stock/2026-09-3 ...) that exist now but not in the backup belong to a month the backup describes:
     their rows are emptied (the page is kept, never deleted) so the restored month matches the backup. Their lines count as removed. */
  var empty=[],emptyRows=0,merged={},er;
  for(i=0;i<onlyCurrent.length;i++){k=onlyCurrent[i];
    if(/^(orders|stock)\/\d{4}-\d{2}-\d+$/.test(k)){er=rowsOf(cur[k]);if(er.length){empty.push(k);emptyRows+=er.length;}}}
  for(k in cur)if(has(cur,k))merged[k]=cur[k];
  for(k in bak)if(has(bak,k))merged[k]=bak[k];
  for(i=0;i<empty.length;i++)merged[empty[i]]={rows:[]};
  return {add:add,change:change,same:same,onlyCurrent:onlyCurrent,empty:empty,emptyRows:emptyRows,before:orderTotals(cur),after:orderTotals(merged)};
}

/* ---------- stock stuff exported for UI convenience is limited to the contract ---------- */
return {
  ctx:ctx,ownStock:ownStock,acctStock:acctStock,predictions:predictions,pipeline:pipeline,
  targetBreakdown:targetBreakdown,targetProgress:targetProgress,alerts:alerts,
  stockPath:stockPath,nextMoveId:nextMoveId,validateMove:validateMove,
  validateBackup:validateBackup,backupDiff:backupDiff,scope:scope,brand:brand,
  daysBetween:daysBetween,addDays:addDays,median:median,
  round2:round2,addMonths:addMonths,daysInMonth:daysInMonth
};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Eng;
