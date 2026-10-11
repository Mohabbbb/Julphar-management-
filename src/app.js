
(function(){
"use strict";
var D={meta:{},accounts:[],items:[],deals:[],orders:[],audit:[],activeItems:[]},M=D.meta;
var SAR=function(n){return (n==null||isNaN(n))?"—":Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});};
var INT=function(n){return (n==null||isNaN(n))?"—":Number(n).toLocaleString();};
var PCT=function(n){return (n==null||isNaN(n))?"—":(n*100).toFixed(1)+"%";};
var K=function(n){var a=Math.abs(n);if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(1)+"K";return Math.round(n).toString();};
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtSync(s){if(!s)return '';var p=String(s).split(' ');var d=p[0].split('-');var t=p.length>1?p[1]:'';var dd=d[2]?parseInt(d[2],10):'';var mm=d[1]?MON[parseInt(d[1],10)-1]:'';return (dd?dd+' ':'')+(mm?mm+' ':'')+(d[0]||'')+(t?' · '+t:'');}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

var root=document.documentElement;
try{var st=localStorage.getItem('jsp-theme');if(st)root.setAttribute('data-theme',st);}catch(e){}
function curTheme(){var a=root.getAttribute('data-theme');if(a)return a;return (window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light';}
function toggleTheme(){var t=curTheme()==='dark'?'light':'dark';root.setAttribute('data-theme',t);try{localStorage.setItem('jsp-theme',t);}catch(e){}drawCharts();}
document.getElementById('themeBtn').addEventListener('click',toggleTheme);
var tb2=document.getElementById('themeBtn2');if(tb2)tb2.addEventListener('click',toggleTheme);
function cssv(v){return getComputedStyle(root).getPropertyValue(v).trim();}

// derived (V40: rebuilt from the live Store on every change — see derive())
var exec=[],byAcct={},byItem={},totalNet=0,totalDisc=0,totalQty=0,acctItems={},itemAccts={},monthMap={},months=[],dealMap={},dealsByAcct={},itemMap={},acctMap={},acctById={},itemById={},acctsWithSales=0,itemsWithSales=0,avgDisc=0;
function agg(list,kf){var m={};list.forEach(function(o){var k=kf(o);if(!k)return;if(!m[k])m[k]={net:0,qty:0,disc:0};m[k].net+=o.net||0;m[k].qty+=o.q||0;m[k].disc+=o.disc||0;});return m;}
function rowsOf(b){return (b&&Array.isArray(b.rows))?b.rows:[];}
function derive(docs){
  V42.ctx=null;V42.cache={};V42.brand=null;
  var acc=rowsOf(docs['master/accounts']),its=rowsOf(docs['master/items']);
  itemById={};its.forEach(function(i){itemById[i.id]=i;});
  acctById={};acc.forEach(function(a){acctById[a.id]=a;});
  D.accounts=acc.map(function(a){return {id:a.id,name:a.name,type:a.type,active:a.active!==false,_r:a};});
  D.items=its.map(function(i){return {id:i.id,name:i.name,rsp:i.rsp,p2026:i.price2026,std:i.std,active:i.active!==false,_r:i};});
  D.activeItems=D.items.filter(function(i){return i.active;});
  D.deals=[];D.orders=[];D.audit=[];
  Object.keys(docs).sort().forEach(function(p){
    var seg=p.split('/');
    if(seg[0]==='deals')rowsOf(docs[p]).forEach(function(d){var im=itemById[d.itemId];D.deals.push({id:d.id,acct:d.account,item:im?im.name:d.item,itemId:d.itemId,pct:d.pct,net:d.net,rsp:d.rsp,status:d.status||'',src:d.source||'',from:d.from,to:d.to,_r:d,_p:p});});
    else if(seg[0]==='orders')rowsOf(docs[p]).forEach(function(o){var im=itemById[o.itemId];D.orders.push({id:o.id,d:o.date,a:o.account,it:im?im.name:o.item,itemId:o.itemId,q:o.qty,net:o.net,disc:o.discAmt,du:o.pct,s:o.status,_r:o,_p:p});});
    else if(seg[0]==='audit')rowsOf(docs[p]).forEach(function(r){D.audit.push(r);});
  });
  D.orders.sort(function(a,b){return String(a.d).localeCompare(String(b.d))||String(a.id).localeCompare(String(b.id));});
  /* V42 scope: dashboard figures use executed lines of OPEN accounts inside the chosen period; M.execNetAll keeps the all-lines total for the Data check */
  M.execNetAll=0;D.orders.forEach(function(o){if(o.s==='Executed')M.execNetAll+=o.net||0;});
  V42.closedNames={};if(!V42.all)D.accounts.forEach(function(a){if(!a.active)V42.closedNames[a.name]=1;});
  var execP=D.orders.filter(function(o){return o.s==='Executed'&&v42InPeriod(o.d);});
  exec=execP.filter(function(o){return !V42.closedNames[o.a];});
  byAcct=agg(exec,function(o){return o.a;});byItem=agg(exec,function(o){return o.it;});
  totalNet=0;totalDisc=0;totalQty=0;exec.forEach(function(o){totalNet+=o.net||0;totalDisc+=o.disc||0;totalQty+=o.q||0;});
  acctItems={};itemAccts={};
  execP.forEach(function(o){(acctItems[o.a]=acctItems[o.a]||{})[o.it]=(acctItems[o.a][o.it]||{net:0,qty:0,disc:0});var x=acctItems[o.a][o.it];x.net+=o.net||0;x.qty+=o.q||0;x.disc+=o.disc||0;});
  exec.forEach(function(o){(itemAccts[o.it]=itemAccts[o.it]||{})[o.a]=(itemAccts[o.it][o.a]||{net:0,qty:0});var y=itemAccts[o.it][o.a];y.net+=o.net||0;y.qty+=o.q||0;});
  monthMap={};exec.forEach(function(o){if(!o.d)return;var m=o.d.slice(0,7);monthMap[m]=(monthMap[m]||0)+(o.net||0);});
  months=Object.keys(monthMap).sort();
  dealMap={};dealsByAcct={};
  D.deals.forEach(function(d){if(d.status==='Active'){var key=d.acct+'␟'+d.item;dealMap[key]=Object.prototype.hasOwnProperty.call(dealMap,key)?NaN:d.pct;}(dealsByAcct[d.acct]=dealsByAcct[d.acct]||[]).push(d);});
  itemMap={};D.items.forEach(function(i){itemMap[i.name]=i;});
  acctMap={};D.accounts.forEach(function(a){acctMap[a.name]=a;});
  acctsWithSales=Object.keys(byAcct).length;itemsWithSales=Object.keys(byItem).length;avgDisc=totalDisc/((totalNet+totalDisc)||1);
  M.accounts=D.accounts.length;M.items=D.items.length;M.deals=D.deals.length;M.activeDeals=D.deals.filter(function(d){return d.status==='Active';}).length;M.orders=D.orders.length;M.execNet=totalNet;
  var od={};D.orders.forEach(function(o){if(o.d&&/YTD/i.test(String(o._r.source||'')))od[o.d]=1;});M.openerDates=Object.keys(od).sort();
  AP.cache={};
}

// KPIs + meta (live: the month is today's month)
function renderKpis(){
  var today=localDate(),cm=today.slice(0,7),cy=+cm.slice(0,4),cmo=+cm.slice(5,7),pm=cmo===1?(cy-1)+'-12':cy+'-'+('0'+(cmo-1)).slice(-2);
  var mLab=function(k){return MON[+k.slice(5,7)-1]+' '+k.slice(0,4);},cmNet=monthMap[cm]||0,pmNet=monthMap[pm]||0,cmLines=exec.filter(function(o){return o.d&&o.d.slice(0,7)===cm;}).length;
  var chg=pmNet?((cmNet-pmNet)/pmNet*100):null;
  document.getElementById('kpis').innerHTML=[
    {l:v42NetLabel(),v:K(totalNet),s:exec.length+' order lines · executed',h:1,id:'kpiNet',t:SAR(totalNet)},
    {l:'This month · '+mLab(cm),v:K(cmNet),s:INT(cmLines)+' lines · vs '+mLab(pm)+' '+K(pmNet)+(chg!=null?' ('+(chg>=0?'+':'')+chg.toFixed(0)+'%)':''),id:'kpiMonth'},
    {l:'YTD Quantity',v:INT(totalQty),s:'units',id:'kpiQty'},
    {l:'Active Accounts',v:acctsWithSales,s:'of '+v42OpenAcctN()+' with sales'},
    {l:'Active Items',v:itemsWithSales,s:'SKUs with movement'},
    {l:'Avg Discount',v:PCT(avgDisc),s:'weighted'}
  ].map(function(c){return '<div class="kpi'+(c.h?' hero':'')+'"'+(c.id?' id="'+c.id+'"':'')+(c.t?' title="'+c.t+' SAR" data-exact="'+(Math.round(totalNet*100)/100)+'"':'')+'><div class="k-label">'+c.l+'</div><div class="k-val'+(c.h?'':' sm')+'">'+c.v+'</div><div class="k-sub">'+c.s+'</div></div>';}).join('');
  var yy=document.getElementById('ytdYear');if(yy)yy.textContent=(exec.map(function(o){return o.d||'';}).sort().pop()||localDate()).slice(0,4);
  var meta=M.accounts+' accounts · '+M.items+' items · '+M.activeDeals+' active deals · '+M.orders+' order lines';
  document.getElementById('footMeta').textContent='YTD '+SAR(totalNet)+' SAR';
  document.getElementById('sideMeta').textContent=meta;
  var ranked=Object.keys(byAcct).map(function(a){return{a:a,net:byAcct[a].net};}).sort(function(x,y){return y.net-x.net;});
  function sh(n){return totalNet?(ranked.slice(0,n).reduce(function(s,r){return s+r.net;},0)/totalNet*100).toFixed(1):'0.0';}
  document.getElementById('concentration').innerHTML='Top account <strong>'+(ranked[0]?esc(ranked[0].a):'')+'</strong> = <strong>'+sh(1)+'%</strong> · Top 3 = <strong>'+sh(3)+'%</strong> · Top 5 = <strong>'+sh(5)+'%</strong> of '+SAR(totalNet)+' SAR executed net.';
}

// charts
var charts={};
function drawCharts(){
  if(typeof Chart==='undefined')return;
  var soft=cssv('--ink-soft'),line=cssv('--line'),brand=cssv('--brand'),accent=cssv('--accent'),surface=cssv('--surface');
  Chart.defaults.color=soft;Chart.defaults.font.family="'IBM Plex Sans',sans-serif";
  Object.keys(charts).forEach(function(k){if(charts[k])charts[k].destroy();});
  var ranked=Object.keys(byAcct).map(function(a){return{a:a,net:byAcct[a].net};}).sort(function(x,y){return y.net-x.net;});
  charts.acct=new Chart(document.getElementById('chAcct'),{type:'bar',data:{labels:ranked.map(function(r){return r.a;}),datasets:[{data:ranked.map(function(r){return r.net;}),backgroundColor:brand,borderRadius:5}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return SAR(c.parsed.x)+' SAR';}}}},scales:{x:{grid:{color:line},ticks:{callback:function(v){return K(v);}}},y:{grid:{display:false}}}}});
  var t6=ranked.slice(0,6),other=ranked.slice(6).reduce(function(s,r){return s+r.net;},0),dl=t6.map(function(r){return r.a;}),dv=t6.map(function(r){return r.net;});if(other>0){dl.push('Others');dv.push(other);}
  charts.donut=new Chart(document.getElementById('chDonut'),{type:'doughnut',data:{labels:dl,datasets:[{data:dv,backgroundColor:[brand,accent,'#6f9fd0','#8bc4ab','#c9820a','#7c8aa0','#b0bccd'],borderColor:surface,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'right',labels:{boxWidth:10,font:{size:11}}},tooltip:{callbacks:{label:function(c){return c.label+': '+SAR(c.parsed)+' ('+(c.parsed/totalNet*100).toFixed(1)+'%)';}}}}}});
  charts.month=new Chart(document.getElementById('chMonth'),{type:'line',data:{labels:months,datasets:[{data:months.map(function(m){return monthMap[m];}),borderColor:accent,backgroundColor:'rgba(23,166,123,.15)',fill:true,tension:.3,pointRadius:3,pointBackgroundColor:accent}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return SAR(c.parsed.y)+' SAR';}}}},scales:{x:{grid:{display:false}},y:{grid:{color:line},ticks:{callback:function(v){return K(v);}}}}}});
  var ri=Object.keys(byItem).map(function(it){return{it:it,net:byItem[it].net};}).sort(function(x,y){return y.net-x.net;}).slice(0,12);
  charts.items=new Chart(document.getElementById('chItems'),{type:'bar',data:{labels:ri.map(function(r){return r.it.length>26?r.it.slice(0,24)+'…':r.it;}),datasets:[{data:ri.map(function(r){return r.net;}),backgroundColor:accent,borderRadius:5}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:function(c){return ri[c[0].dataIndex].it;},label:function(c){return SAR(c.parsed.x)+' SAR';}}}},scales:{x:{grid:{color:line},ticks:{callback:function(v){return K(v);}}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
}

// nav
function bindNav(id){var el=document.getElementById(id);if(!el)return;el.addEventListener('click',function(e){var b=e.target.closest('button[data-view]');if(b)show(b.dataset.view);});}
bindNav('sideNav');bindNav('topNav');
function show(v){
  ['sideNav','topNav'].forEach(function(id){var el=document.getElementById(id);if(!el)return;Array.prototype.forEach.call(el.querySelectorAll('button'),function(b){b.setAttribute('aria-current',b.dataset.view===v?'true':'false');});});
  Array.prototype.forEach.call(document.querySelectorAll('.view'),function(s){s.classList.toggle('active',s.id==='view-'+v);});
  try{localStorage.setItem('jsp-view',v);}catch(e){}
  if(isLoading())return;
  derive(Store.all());refreshSelects();v42Common();
  if(v==='dashboard'){renderKpis();renderRecon();requestAnimationFrame(drawCharts);}
  else if(RENDER[v])RENDER[v]();
}

// accounts
function acctRankedList(){
  var r=Object.keys(byAcct).map(function(a){return{name:a,net:byAcct[a].net,qty:byAcct[a].qty};}).sort(function(x,y){return y.net-x.net;});
  D.accounts.slice().sort(function(a,b){return a.name.localeCompare(b.name);}).forEach(function(a){if(!byAcct[a.name]&&(a.active||V42.showClosed||V42.all)){var cn=a.active?null:v42ClosedNet(a.name);r.push({name:a.name,net:cn?cn.net:0,qty:cn?cn.qty:0});}});
  return r;
}
function renderAcctList(q){q=(q||'').toLowerCase();
  var nOpenA=v42OpenAcctN(),nClosedA=D.accounts.length-nOpenA;document.getElementById('acctCount').textContent=acctsWithSales+' with sales / '+(nClosedA?nOpenA+' open · '+nClosedA+' closed':D.accounts.length+' total');
  document.getElementById('acctList').innerHTML=acctRankedList().filter(function(a){return a.name.toLowerCase().indexOf(q)>=0;}).map(function(a){var ar=acctMap[a.name],off=ar&&!ar.active;return '<div class="list-item" role="option" tabindex="0" aria-selected="'+(AP.name===a.name)+'" aria-current="'+(AP.name===a.name)+'" data-acct="'+esc(a.name)+'"><div><div class="li-name">'+esc(a.name)+(off?' <span class="badge b-off">'+(ar.closedAt?'Closed':'Inactive')+'</span>':'')+(ar?'':' <span class="badge b-bad">Not in accounts list</span>')+'</div><div class="li-sub">'+INT(a.qty)+' units</div></div><div class="li-net">'+K(a.net)+'</div></div>';}).join('')||'<div class="list-item">No matches</div>';}
function selectAcct(name){
  Array.prototype.forEach.call(document.querySelectorAll('#acctList .list-item'),function(li){var on=li.dataset.acct===name;li.setAttribute('aria-current',on?'true':'false');li.setAttribute('aria-selected',on?'true':'false');});
  acctPage(name);
}
/* ---- V33 account pages (deals, orders, history) — renders only when an account is opened ---- */
var AP={name:null,tab:'deals',filter:'all',q:'',limit:40,cache:{},open:{}};
function apDaysBetween(a,b){var x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');return (isFinite(x)&&isFinite(y))?Math.round((y-x)/864e5):null;}
function apData(name){
  if(AP.cache[name])return AP.cache[name];
  var os=D.orders.filter(function(o){return o.a===name;}),net=0,qty=0,lines=0,last='',dset={},days={};
  os.forEach(function(o){
    var k=o.d||'—';var g=days[k]=days[k]||{d:k,rows:[],net:0,qty:0,st:{}};g.rows.push(o);g.qty+=+o.q||0;g.st[o.s||'—']=(g.st[o.s||'—']||0)+1;
    if(o.s==='Executed'){if(v42InPeriod(o.d)){net+=o.net||0;qty+=+o.q||0;lines++;}g.net+=o.net||0;if(o.d){if(v42InPeriod(o.d))dset[o.d]=1;if(o.d>last)last=o.d;}}
  });
  var its=acctItems[name]||{};
  var deals=(dealsByAcct[name]||[]).filter(function(d){return d.status==='Active';}).map(function(d){
    var im=itemMap[d.item]||{},std=(typeof im.std==='number'&&isFinite(im.std))?im.std:null,o=its[d.item];
    return {item:d.item,rsp:(typeof d.rsp==='number'?d.rsp:im.rsp),pct:d.pct,net:d.net,std:std,ytd:o?o.net:0,qty:o?o.qty:0,
      below:std!=null&&typeof d.pct==='number'&&isFinite(d.pct)&&d.pct<std-1e-6};
  }).sort(function(a,b){return (b.ytd-a.ytd)||a.item.localeCompare(b.item);});
  var r={net:net,qty:qty,lines:lines,orderDays:Object.keys(dset).length,last:last,ago:last?apDaysBetween(last,localDate()):null,
    hist:Object.keys(days).sort().reverse().map(function(k){return days[k];}),deals:deals,
    ordered:deals.filter(function(d){return d.ytd>0;}).length,below:deals.filter(function(d){return d.below;}).length};
  r.never=deals.length-r.ordered;
  return AP.cache[name]=r;
}
function apDealRows(x){
  var q=AP.q.toLowerCase(),f=AP.filter;
  return x.deals.filter(function(d){
    if(q&&d.item.toLowerCase().indexOf(q)<0)return false;
    if(f==='ordered')return d.ytd>0;if(f==='never')return !(d.ytd>0);if(f==='below')return d.below;return true;});
}
function apDealsTable(x){
  var rows=apDealRows(x),show=rows.slice(0,AP.limit);
  if(!x.deals.length)return '<p class="muted">No active deals for this account. Orders price at each item’s standard discount, or REVIEW when an item has none.</p>';
  if(!rows.length)return '<p class="muted">No deals match this filter.</p>';
  var h='<div class="scroll"><table><thead><tr><th>Item</th><th class="num">RSP</th><th class="num">Standard</th><th class="num">Deal</th><th class="num">Net / unit</th><th class="num">Ordered YTD</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>'+
    show.map(function(d){return '<tr><td>'+esc(d.item)+(d.below?' <span class="badge b-review">'+((d.std-d.pct)*100).toFixed(1)+' pts below standard</span>':'')+'</td>'+
      '<td class="num">'+SAR(d.rsp)+'</td><td class="num muted">'+PCT(d.std)+'</td><td class="num"><strong>'+PCT(d.pct)+'</strong></td><td class="num">'+SAR(d.net)+'</td>'+
      '<td class="num">'+(d.ytd>0?SAR(d.ytd):'<span class="muted">—</span>')+'</td>'+
      '<td><button type="button" class="btn ghost sm" data-apedit="'+esc(d.item)+'" aria-label="Edit deal for '+esc(d.item)+'">Edit</button></td></tr>';}).join('')+'</tbody></table></div>';
  h+='<div class="note">Showing '+show.length+' of '+rows.length+(rows.length>show.length?' · <button type="button" class="btn ghost sm" data-apmore="1">Show 40 more</button>':'')+' · price rule: customer deal first, otherwise the item’s standard discount</div>';
  return h;
}
function apWhen(t){if(!t)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(String(t)))return String(t);var d=new Date(t);if(isNaN(d))return String(t||'');return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function apHistoryFor(name){return D.audit.filter(function(r){return r&&r.account===name;}).sort(function(a,b){return String(b.ts||'').localeCompare(String(a.ts||''));});}
function stBadge(s){return '<span class="badge '+(s==='Executed'?'b-good':s==='Cancelled'?'b-bad':'b-off')+'">'+esc(s||'—')+'</span>';}
function acctPage(name){
  if(!name){document.getElementById('acctDetail').innerHTML='';return;}
  if(AP.name!==name){AP.name=name;AP.filter='all';AP.q='';AP.limit=40;AP.open={};}
  var x=apData(name),ar=acctMap[name]||{},typ=ar.type||'',hn=apHistoryFor(name).length;
  var stale=x.ago!=null&&x.ago>60&&ar.active!==false,shDen=(ar.active===false?M.execNetAll:totalNet),share=shDen?x.net/shDen:0;
  var h='<div class="card"><div class="ap-head"><div style="flex:1;min-width:180px"><div class="eyebrow">'+esc(typ)+(ar.id?' · '+esc(ar.id):'')+(ar.active===false?' · <span class="badge b-off">'+(ar.closedAt?'Closed':'Inactive')+'</span>':'')+'</div><h3 style="font-size:19px;margin-top:3px">'+esc(name)+'</h3></div>'+
    (ar.id?'<button type="button" class="btn ghost sm" data-apact="edit">Edit account</button>'+(ar.active===false?'<button type="button" class="btn ghost sm" data-apact="reopen">Reopen</button>':'<button type="button" class="btn ghost sm" data-apact="close">Close account</button>'):'')+'<button type="button" class="btn ghost sm" data-apact="deal">Change a deal</button><button type="button" class="btn sm" data-apact="new">+ New order</button></div>'+v42ClosedBanner(ar)+
    '<div class="kpis" style="margin:12px 0 0">'+
    '<div class="kpi"><div class="k-label">Net sales YTD</div><div class="k-val sm">'+SAR(x.net)+'</div><div class="k-sub">SAR · '+(share*100).toFixed(1)+'% of all accounts</div></div>'+
    '<div class="kpi"><div class="k-label">Orders</div><div class="k-val sm">'+INT(x.lines)+' lines</div><div class="k-sub">'+INT(x.orderDays)+' order day(s) · '+INT(x.qty)+' units</div></div>'+
    '<div class="kpi"><div class="k-label">Active deals</div><div class="k-val sm">'+INT(x.deals.length)+'</div><div class="k-sub">'+INT(x.ordered)+' ordered · '+INT(x.never)+' never ordered</div></div>'+
    '<div class="kpi'+(stale?' ap-warn':'')+'"><div class="k-label">Last order</div><div class="k-val sm">'+(x.last?esc(x.last):'None yet')+'</div><div class="k-sub">'+(x.ago!=null?INT(x.ago)+' day(s) ago':'no executed orders')+'</div></div></div>'+
    '<div class="ap-tabs" role="tablist" aria-label="Account sections">'+
    [['deals','Deals',x.deals.length],['orders','Orders',x.hist.length+' days'],['history','History',hn]].map(function(t){return '<button type="button" role="tab" data-aptab="'+t[0]+'" aria-selected="'+(AP.tab===t[0])+'">'+t[1]+' <span class="muted mono" style="font-size:11px">'+t[2]+'</span></button>';}).join('')+'</div>';
  if(AP.tab==='deals'){
    var att=[];
    if(stale)att.push('<strong>No order for '+INT(x.ago)+' days.</strong> Last order day '+esc(x.last)+'.');
    if(x.below)att.push('<strong>'+INT(x.below)+' deal(s) give less than the standard discount.</strong> The deal still wins; review before the next order.');
    if(x.never)att.push('<strong>'+INT(x.never)+' deal(s) never ordered.</strong> Candidates to push or retire.');
    if(att.length)h+='<ul class="ap-att">'+att.map(function(a){return '<li>'+a+'</li>';}).join('')+'</ul>';
    h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><div class="searchbar" style="flex:1;min-width:180px;margin:0"><label class="sr-only" for="apSearch">Search this account’s deals</label><input id="apSearch" placeholder="Search deals…" autocomplete="off" value="'+esc(AP.q)+'"></div>'+
      '<div class="ap-seg" role="group" aria-label="Filter deals">'+[['all','All',x.deals.length],['ordered','Ordered',x.ordered],['never','Never ordered',x.never],['below','Below standard',x.below]].map(function(f){return '<button type="button" data-apf="'+f[0]+'" aria-pressed="'+(AP.filter===f[0])+'">'+f[1]+' '+f[2]+'</button>';}).join('')+'</div></div>'+
      '<div id="apDeals">'+apDealsTable(x)+'</div>';
  }else if(AP.tab==='orders'){
    if(!x.hist.length)h+='<p class="muted">No orders recorded for this account yet. Use “+ New order”.</p>';
    else h+='<div class="scroll"><table><thead><tr><th>Date</th><th class="num">Lines</th><th class="num">Units</th><th class="num">Net (executed)</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>'+
      x.hist.map(function(g,i){var open=!!AP.open[g.d];
        return '<tr><td><strong>'+esc(g.d)+'</strong></td><td class="num">'+INT(g.rows.length)+'</td><td class="num">'+INT(g.qty)+'</td><td class="num">'+SAR(g.net)+'</td><td>'+Object.keys(g.st).map(function(s){return '<span class="badge '+(s==='Executed'?'b-good':s==='Cancelled'?'b-bad':'b-off')+'">'+esc(s)+(g.st[s]>1?' ×'+g.st[s]:'')+'</span>';}).join(' ')+'</td>'+
        '<td style="white-space:nowrap"><button type="button" class="btn sm" data-aprep="'+i+'">Repeat</button> <button type="button" class="btn ghost sm" data-apopen="'+esc(g.d)+'" aria-expanded="'+open+'">'+(open?'Hide':'Lines')+'</button></td></tr>'+
        (open?'<tr><td colspan="6"><table><tbody>'+g.rows.map(function(o){return '<tr><td class="mono" style="font-size:11px">'+esc(o.id)+'</td><td>'+esc(o.it)+'</td><td class="num">'+INT(o.q)+'</td><td class="num">'+PCT(o.du)+'</td><td class="num">'+SAR(o.net)+'</td><td>'+stBadge(o.s)+'</td><td><button type="button" class="btn ghost sm" data-ordedit="'+esc(o.id)+'" aria-label="Edit order line '+esc(o.id)+'">Edit</button></td></tr>';}).join('')+'</tbody></table></td></tr>':'');}).join('')+'</tbody></table></div>'+
      '<div class="note">“Repeat” opens New order with this account and the same items and quantities, priced at today’s deals. Saved lines keep their own prices.</div>';
  }else{
    var hs=apHistoryFor(name);
    h+=hs.length?'<div class="scroll"><table><thead><tr><th>When</th><th>Change</th><th>Item</th><th>Field</th><th>Old → New</th><th>Reason</th></tr></thead><tbody>'+hs.slice(0,200).map(function(e){return '<tr><td class="mono" style="font-size:11px;white-space:nowrap">'+esc(apWhen(e.ts))+'</td><td>'+esc(e.type)+'</td><td style="font-size:12px">'+esc(e.item)+'</td><td>'+esc(e.field)+'</td><td style="font-size:12px">'+esc(e.old==null?'':e.old)+' → '+esc(e.new==null?'':e.new)+'</td><td class="muted" style="font-size:12px">'+esc(e.reason||'')+(e.notes?' · '+esc(e.notes):'')+'</td></tr>';}).join('')+'</tbody></table></div>'+(hs.length>200?'<div class="note">Showing the latest 200 of '+INT(hs.length)+'. The full history is in the Excel export (Audit sheet).</div>':'')
      :'<p class="muted">No recorded changes for this account yet.</p>';
  }
  h+='</div>';
  document.getElementById('acctDetail').innerHTML=h;
}
function apGoOrder(name){obAccount.value=name;show('order');}
function apRepeat(name,g){
  var m={},ord=[];g.rows.forEach(function(o){if(o.s==='Cancelled')return;if(!Object.prototype.hasOwnProperty.call(m,o.it)){m[o.it]=0;ord.push(o.it);}m[o.it]+=+o.q||0;});
  obAccount.value=name;document.getElementById('obStatus').value='Executed';document.getElementById('obDate').value=localDate();lines.innerHTML='';ord.forEach(function(it){addLine(it,m[it]);});recalc();show('order');
  var n=document.getElementById('copyNote');if(n)n.innerHTML='<span class="badge b-good">OK</span> Repeated '+ord.length+' line(s) from '+esc(g.d)+' for '+esc(name)+'. Prices are recalculated at today\u2019s deals and standard discounts, so the total can differ from that day. Check quantities, then press Save order.';
  window.scrollTo(0,0);
}
function apEditDeal(name,item){
  show('pricing');var pa=document.getElementById('prAccount'),pi2=document.getElementById('dcItem');
  pa.value=name;pa.dispatchEvent(new Event('change'));if(pi2&&item){pi2.value=item;pi2.dispatchEvent(new Event('change'));}
  var r=document.getElementById('dcRate');if(r){r.scrollIntoView({block:'center'});r.focus();}
}
(function(){
  var det=document.getElementById('acctDetail');
  det.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b||!AP.name)return;var x=apData(AP.name);if(b.dataset.ordedit){orderEditForm(b.dataset.ordedit);return;}
    if(b.dataset.aptab){AP.tab=b.dataset.aptab;acctPage(AP.name);var t=det.querySelector('[data-aptab="'+AP.tab+'"]');if(t)t.focus();}
    else if(b.dataset.apf){AP.filter=b.dataset.apf;AP.limit=40;acctPage(AP.name);}
    else if(b.dataset.apmore){AP.limit+=40;document.getElementById('apDeals').innerHTML=apDealsTable(x);}
    else if(b.dataset.apedit)apEditDeal(AP.name,b.dataset.apedit);
    else if(b.dataset.aprep!=null&&x.hist[+b.dataset.aprep])apRepeat(AP.name,x.hist[+b.dataset.aprep]);
    else if(b.dataset.apopen!=null){AP.open[b.dataset.apopen]=!AP.open[b.dataset.apopen];acctPage(AP.name);}
    else if(b.dataset.apact==='new')apGoOrder(AP.name);
    else if(b.dataset.apact==='deal')apEditDeal(AP.name,'');
    else if(b.dataset.apact==='edit')acctForm(acctMap[AP.name]);else if(b.dataset.apact==='close')v42CloseAccount(AP.name);else if(b.dataset.apact==='reopen')v42ReopenAccount(AP.name);
    else if(b.dataset.ordedit)orderEditForm(b.dataset.ordedit);
  });
  det.addEventListener('input',function(e){if(e.target.id!=='apSearch'||!AP.name)return;AP.q=e.target.value;AP.limit=40;document.getElementById('apDeals').innerHTML=apDealsTable(apData(AP.name));});
})();

document.getElementById('acctSearch').addEventListener('input',function(e){renderAcctList(e.target.value);});
function apScrollDetail(){try{if(window.matchMedia&&window.matchMedia('(max-width:860px)').matches){var d=document.getElementById('acctDetail');if(d&&d.scrollIntoView)d.scrollIntoView({block:'start',behavior:'smooth'});}}catch(e){}}
document.getElementById('acctList').addEventListener('click',function(e){var li=e.target.closest('[data-acct]');if(li){selectAcct(li.dataset.acct);apScrollDetail();}});
document.getElementById('acctList').addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;var li=e.target.closest('[data-acct]');if(li){e.preventDefault();selectAcct(li.dataset.acct);apScrollDetail();}});

function itemRankedList(){
  var r=Object.keys(byItem).map(function(it){return{name:it,net:byItem[it].net,qty:byItem[it].qty};}).sort(function(x,y){return y.net-x.net;});
  D.items.slice().sort(function(a,b){return a.name.localeCompare(b.name);}).forEach(function(i){if(!byItem[i.name])r.push({name:i.name,net:0,qty:0});});
  return r;
}
var IP={name:null};
function renderItemList(q){q=(q||'').toLowerCase();
  document.getElementById('itemCount').textContent=itemsWithSales+' with movement / '+D.items.length+' total';
  document.getElementById('itemList').innerHTML=itemRankedList().filter(function(a){return a.name.toLowerCase().indexOf(q)>=0||((itemMap[a.name]||{}).id||'').toLowerCase()===q;}).map(function(a){var im=itemMap[a.name],off=im&&!im.active;return '<div class="list-item" role="option" tabindex="0" aria-selected="'+(IP.name===a.name)+'" aria-current="'+(IP.name===a.name)+'" data-item="'+esc(a.name)+'"><div><div class="li-name" style="font-size:12px">'+esc(a.name)+(off?' <span class="badge b-off">Inactive</span>':'')+'</div><div class="li-sub">'+INT(a.qty)+' units</div></div><div class="li-net">'+K(a.net)+'</div></div>';}).join('')||'<div class="list-item">No matches</div>';}
function selectItem(name){
  IP.name=name;
  Array.prototype.forEach.call(document.querySelectorAll('#itemList .list-item'),function(li){var on=li.dataset.item===name;li.setAttribute('aria-current',on?'true':'false');li.setAttribute('aria-selected',on?'true':'false');});
  if(!name){document.getElementById('itemDetail').innerHTML='';return;}
  var meta=itemMap[name]||{},raw=meta._r||{},accts=itemAccts[name]||{},rows=Object.keys(accts).map(function(a){return{a:a,net:accts[a].net,qty:accts[a].qty};}).sort(function(x,y){return y.net-x.net;});
  var net=rows.reduce(function(s,r){return s+r.net;},0),qty=rows.reduce(function(s,r){return s+r.qty;},0);
  var h='<div class="card"><div class="ap-head"><div style="flex:1;min-width:180px"><div class="eyebrow">'+esc(meta.id||'')+(raw.category?' · '+esc(raw.category):'')+(meta.active===false?' · <span class="badge b-off">Inactive</span>':'')+'</div><h3 style="font-size:16px;margin-top:3px">'+esc(name)+'</h3></div>'+
    (meta.id?'<button type="button" class="btn ghost sm" data-itact="edit">Edit item</button><button type="button" class="btn ghost sm" data-itact="toggle">'+(meta.active===false?'Reactivate':'Deactivate')+'</button>':'')+'</div><div class="kpis" style="margin:12px 0 0">'+
    '<div class="kpi"><div class="k-label">RSP</div><div class="k-val sm">'+(meta.rsp!=null?SAR(meta.rsp):'—')+'</div><div class="k-sub">SAR reference'+(raw.wsp!=null?' · WSP '+SAR(raw.wsp):'')+'</div></div>'+
    '<div class="kpi"><div class="k-label">Standard disc</div><div class="k-val sm">'+(meta.std!=null?PCT(meta.std):'—')+'</div><div class="k-sub">2026 price '+(raw.price2026!=null?SAR(raw.price2026):'—')+'</div></div>'+
    '<div class="kpi"><div class="k-label">Net sales</div><div class="k-val sm">'+K(net)+'</div><div class="k-sub">SAR executed</div></div>'+
    '<div class="kpi"><div class="k-label">Quantity</div><div class="k-val sm">'+INT(qty)+'</div><div class="k-sub">'+rows.length+' accounts</div></div></div></div>';
  h+= rows.length? '<div class="card" style="margin-top:14px"><h3>Accounts buying</h3><div class="scroll"><table><thead><tr><th>Account</th><th class="num">Qty</th><th class="num">Net</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.a)+'</td><td class="num">'+INT(r.qty)+'</td><td class="num">'+SAR(r.net)+'</td></tr>';}).join('')+'</tbody></table></div></div>' : '<div class="card" style="margin-top:14px"><p class="muted">No executed sales yet.</p></div>';
  document.getElementById('itemDetail').innerHTML=h;
}
document.getElementById('itemSearch').addEventListener('input',function(e){renderItemList(e.target.value);});
document.getElementById('itemList').addEventListener('click',function(e){var li=e.target.closest('[data-item]');if(li)selectItem(li.dataset.item);});
document.getElementById('itemList').addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;var li=e.target.closest('[data-item]');if(li){e.preventDefault();selectItem(li.dataset.item);}});

// pricing
var prAccount=document.getElementById('prAccount');
function renderPricing(){
  document.getElementById('pricingCount').textContent=M.activeDeals+' active deals across '+Object.keys(dealsByAcct).length+' accounts';
  var acct=prAccount.value,q=(document.getElementById('prSearch').value||'').trim().toLowerCase(),si=document.getElementById('prShowInactive'),all=!!(si&&si.checked);
  var mine=dealsByAcct[acct]||[],nAct=mine.filter(function(d){return d.status==='Active';}).length,nIn=mine.length-nAct;
  var ic=document.getElementById('prInCount');if(ic)ic.textContent=' ('+nIn+' for this account)';
  var pool=mine.filter(function(d){return all||d.status==='Active';}),
      list=pool.filter(function(d){return !q||String(d.item||'').toLowerCase().indexOf(q)>=0;}).sort(function(a,b){return ((b.status==='Active')-(a.status==='Active'))||String(a.item).localeCompare(String(b.item));});
  var body=document.getElementById('pricingBody'),shown=nAct&&!all?nAct:pool.length;
  var head='<h3>'+esc(acct||'Pick an account')+' — '+nAct+' active deal'+(nAct===1?'':'s')+(nIn?' <span class="muted" style="font-weight:400">· '+nIn+' inactive'+(all?' shown':' hidden')+'</span>':'')+'</h3>'+
    '<div class="pr-status" role="status" aria-live="polite">'+(q?'Filter “'+esc(q)+'”: <strong>'+list.length+'</strong> of '+pool.length+' '+(all?'deals':'active deals'):'Showing <strong>'+list.length+'</strong> '+(all?'deals (active and inactive)':'active deals'))+'</div>';
  if(!list.length){
    var why=!mine.length?'No item deals are recorded for this account.':q?'No '+(all?'':'active ')+'deal matches “'+esc(q)+'”.'+(!all&&nIn?' Try “Show inactive deals” ('+nIn+').':''):(all?'No deals.':'No active deals for this account.'+(nIn?' It has '+nIn+' inactive deal(s) — tick “Show inactive deals”.':''));
    body.innerHTML='<div class="card">'+head+'<p class="muted">'+why+' Orders then use each item’s standard discount, or are flagged REVIEW when an item has none.</p></div>';return;}
  body.innerHTML='<div class="card">'+head+'<div class="scroll"><table><thead><tr><th>Item</th><th class="num">Discount</th><th class="num">RSP</th><th class="num">Net price</th><th>Status</th><th>Valid</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>'+
    list.map(function(d){var act=d.status==='Active',st=act?'<span class="badge b-good">Active</span>':'<span class="badge b-off">'+esc(d.status||'—')+'</span>';
      return '<tr'+(act?'':' class="is-cancel"')+'><td>'+esc(shortItem(d.item))+'</td><td class="num">'+PCT(d.pct)+'</td><td class="num">'+(d.rsp!=null?SAR(d.rsp):'—')+'</td><td class="num">'+(d.net!=null?SAR(d.net):'—')+'</td><td>'+st+'</td><td class="muted" style="font-size:12px;white-space:nowrap">'+esc((d.from||'')+(d.to?' → '+d.to:act?' → now':''))+'</td><td>'+(act?'<button type="button" class="btn ghost sm" data-dcpick="'+esc(d.item)+'" aria-label="Change deal for '+esc(d.item)+'">Change</button>':'')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
}
prAccount.addEventListener('change',renderPricing);
document.getElementById('prSearch').addEventListener('input',renderPricing);
document.getElementById('prShowInactive').addEventListener('change',renderPricing);
/* Price check (V34): read-only lookup through the same resolve() the Order Builder uses. */
var pcAccount=document.getElementById('pcAccount');
function pcShow(){
  var out=document.getElementById('pcOut'),a=pcAccount.value,raw=(document.getElementById('pcItem').value||'').trim();
  if(!raw){out.textContent='Pick a customer and type an item to see the price they pay.';return;}
  var it=itemMap[raw]?raw:matchItem(raw);
  if(!it){out.innerHTML='<span class="badge b-review">CHECK</span> No single item matches “'+esc(raw)+'”. Pick one from the list.';return;}
  var im=itemMap[it]||{},r=resolve(a,it),rsp=(typeof im.rsp==='number'&&isFinite(im.rsp))?im.rsp:null;
  var stdOk=typeof im.std==='number'&&isFinite(im.std)&&im.std>=0&&im.std<=1;
  var rule=r.src==='Account deal'?'<span class="badge b-deal">Account deal</span>':r.src==='Standard rule'?'<span class="badge b-std">Standard</span>':'<span class="badge b-review">REVIEW</span>';
  out.innerHTML=(it!==raw?'<strong>'+esc(it)+'</strong><br>':'')+'RSP <strong>'+(rsp!=null?SAR(rsp):'—')+'</strong> SAR · Rule '+rule+
    ' · Discount <strong>'+(r.pct!=null?PCT2(r.pct):'—')+'</strong> · Net per unit <strong>'+(r.pct!=null&&rsp!=null?SAR(rsp*(1-r.pct))+' SAR':'—')+'</strong>'+
    (r.src==='Account deal'&&stdOk?' <span class="muted">(standard would be '+PCT2(im.std)+')</span>':'')+
    (r.pct==null?'<br><span class="muted">No usable rate: this item needs a reference price / standard discount, or an account deal.</span>':'');
}
pcAccount.addEventListener('change',pcShow);
document.getElementById('pcItem').addEventListener('input',pcShow);
document.getElementById('pcItem').addEventListener('change',pcShow);
prAccount.addEventListener('change',function(){pcAccount.value=prAccount.value;pcShow();});

// ---- order builder engine
function resolve(account,item){
  if(!item)return{pct:null,src:''};
  /* No account = no basis to price on. Never fall through to the standard rate,
     which would silently produce a "priced" order that ignores account deals. */
  if(!account)return{pct:null,src:'NO ACCOUNT'};
  var im=itemMap[item],key=account+'\u241F'+item;
  if(!im||im.active===false||typeof im.rsp!=='number'||!isFinite(im.rsp)||im.rsp<0)return{pct:null,src:'REVIEW REQUIRED'};
  if(Object.prototype.hasOwnProperty.call(dealMap,key)){
    var dk=dealMap[key];
    return typeof dk==='number'&&isFinite(dk)&&dk>=0&&dk<=1?{pct:dk,src:'Account deal'}:{pct:null,src:'REVIEW REQUIRED'};
  }
  if(typeof im.std==='number'&&isFinite(im.std)&&im.std>=0&&im.std<=1)return{pct:im.std,src:'Standard rule'};
  return{pct:null,src:'REVIEW REQUIRED'};
}
var obAccount=document.getElementById('obAccount');
var lines=document.getElementById('lines');
function matchItem(text){
  if(!text)return null;var t=text.trim();if(itemMap[t])return t;
  var lc=t.toLowerCase();
  var exact=D.activeItems.filter(function(i){return i.name.toLowerCase()===lc;});
  if(exact.length===1)return exact[0].name;
  if(exact.length>1)return null;
  var cont=D.activeItems.filter(function(i){return i.name.toLowerCase().indexOf(lc)>=0;});
  if(cont.length===1)return cont[0].name;
  if(cont.length>1){
    /* Ambiguous: prefer a single prefix match, otherwise REFUSE to guess.
       Picking the shortest name here silently mispriced orders ("ADOL" -> an arbitrary SKU). */
    var pre=cont.filter(function(i){return i.name.toLowerCase().indexOf(lc)===0;});
    return pre.length===1?pre[0].name:null;
  }
  var rev=D.activeItems.filter(function(i){return lc.indexOf(i.name.toLowerCase())>=0;});
  return rev.length===1?rev[0].name:null;
}
function addLine(item,qty){
  var row=document.createElement('div');row.className='line';
  row.innerHTML='<input class="li-item" list="itemDL" placeholder="Type item…" autocomplete="off" aria-label="Item name">'+
    '<input class="li-qty" type="number" min="0" step="1" inputmode="numeric" aria-label="Quantity">'+
    '<span class="ro ro-ref"><span class="ro-label">Ref</span><span class="ro-val">—</span></span>'+
    '<span class="ro ro-pct"><span class="ro-label">Disc %</span><input class="li-disc" type="number" min="0" max="100" step="0.01" inputmode="decimal" placeholder="auto" aria-label="Discount percent — leave blank to use the account deal"><span class="ro-src"></span></span>'+
    '<span class="ro ro-net"><span class="ro-label">Net</span><span class="ro-val">—</span></span>'+
    '<button class="rm" title="Remove" aria-label="Remove line">✕</button><div class="stk-hint" aria-live="polite"></div>';
  lines.appendChild(row);
  if(item)row.querySelector('.li-item').value=item;
  if(qty!=null)row.querySelector('.li-qty').value=qty;
  row.querySelector('.li-item').addEventListener('change',recalc);
  row.querySelector('.li-item').addEventListener('input',recalc);
  row.querySelector('.li-qty').addEventListener('input',recalc);
  row.querySelector('.li-disc').addEventListener('input',recalc);
  row.querySelector('.rm').addEventListener('click',function(){row.remove();recalc();});
  return row;
}
document.getElementById('addLine').addEventListener('click',function(){addLine();recalc();});
obAccount.addEventListener('change',recalc);
document.getElementById('obStatus').addEventListener('change',recalc);
var lastOrder={lines:[],tQty:0,tGross:0,tDisc:0,tNet:0};
function recalc(){
  var account=obAccount.value,tQty=0,tGross=0,tDisc=0,tNet=0,review=0,filled=0,rows=[];
  Array.prototype.forEach.call(lines.querySelectorAll('.line'),function(row){
    var item=row.querySelector('.li-item').value.trim(),qty=parseFloat(row.querySelector('.li-qty').value);
    var refEl=row.querySelector('.ro-ref .ro-val'),netEl=row.querySelector('.ro-net .ro-val');
    var discEl=row.querySelector('.li-disc'),srcEl=row.querySelector('.ro-src');
    row.classList.remove('is-review');discEl.classList.remove('is-ovr');srcEl.classList.remove('s-ovr');
    if(!item){refEl.textContent='—';discEl.placeholder='auto';srcEl.textContent='';netEl.textContent='—';
      if(row.querySelector('.li-qty').value!==''){review++;row.classList.add('is-review');}return;}
    filled++;var im=itemMap[item]||{},ref=(im.rsp!=null)?im.rsp:null,r=resolve(account,item);
    refEl.textContent=ref!=null?SAR(ref):'—';
    // The engine's rate is always shown as the placeholder, so overriding is an
    // informed choice rather than a blind one.
    discEl.placeholder=(r.pct!=null)?(r.pct*100).toFixed(2):'auto';
    var ovrRaw=discEl.value.trim(),pct=r.pct,src=r.src,bad=false;
    if(ovrRaw!==''){
      var ovr=parseFloat(ovrRaw);
      // Percent numbers, same rule as the workbook: 40 means 40%.
      if(!isFinite(ovr)||ovr<0||ovr>100){bad=true;}
      else{pct=ovr/100;src='Manual override';discEl.classList.add('is-ovr');srcEl.classList.add('s-ovr');}
    }
    if(bad){
      srcEl.textContent='0–100 only';netEl.textContent='—';review++;row.classList.add('is-review');
      rows.push({item:item,qty:isFinite(qty)?qty:0,ref:ref,pct:null,src:'REVIEW REQUIRED',nu:null,nv:null});return;}
    if(pct==null||!account||typeof ref!=='number'||!isFinite(ref)||ref<0){
      srcEl.innerHTML='<span class="badge b-review">'+(r.src==='NO ACCOUNT'?'SELECT ACCOUNT':'REVIEW')+'</span>';
      netEl.textContent='—';review++;row.classList.add('is-review');return;}
    srcEl.textContent=(src==='Manual override')?'manual':(src==='Account deal'?'deal':'std');
    if(ref==null){netEl.textContent='—';review++;row.classList.add('is-review');return;}
    if(!fcValidQty(qty)||qty<=0){netEl.textContent='—';review++;row.classList.add('is-review');return;}
    var nu=ref*(1-pct),nv=qty*nu,da=qty*ref*pct;netEl.textContent=SAR(nv);
    tQty+=qty;tGross+=qty*ref;tDisc+=da;tNet+=nv;rows.push({item:item,qty:qty,ref:ref,pct:pct,src:src,nu:nu,nv:nv});
  });
  document.getElementById('tQty').textContent=INT(tQty);document.getElementById('tGross').textContent=SAR(tGross);
  document.getElementById('tDisc').textContent=SAR(tDisc);document.getElementById('tNet').textContent=SAR(tNet);
  var status=document.getElementById('obStatus').value,v=document.getElementById('obValid');
  if(!account)v.innerHTML='<span class="badge b-review">Select an account</span>';
  else if(review>0)v.innerHTML='<span class="badge b-review">REVIEW REQUIRED — '+review+' line(s)</span>';
  else if(filled===0)v.innerHTML='<span class="badge b-std">Add a line</span>';
  else v.innerHTML='<span class="badge b-good">OK — ready</span>'+(status==='Executed'?' <span class="badge b-deal">counts as sales</span>':' <span class="badge b-std">'+status+' — not yet sales</span>');
  document.getElementById('obAcctTag').textContent=account||'';
  document.getElementById('lineHint').textContent=filled?'':'Add lines, or use “Paste list”.';
  lastOrder={account:account,status:status,lines:rows,tQty:tQty,tGross:tGross,tDisc:tDisc,tNet:tNet,review:review};v42Hints();
}

// panes
document.querySelector('.tabs').addEventListener('click',function(e){var b=e.target.closest('button[data-pane]');if(!b)return;
  Array.prototype.forEach.call(this.querySelectorAll('button'),function(x){var on=x===b;x.setAttribute('aria-current',on?'true':'false');x.setAttribute('aria-selected',on?'true':'false');});
  ['manual','paste','photo'].forEach(function(p){document.getElementById('pane-'+p).classList.toggle('active',p===b.dataset.pane);});
});
// photo preview
document.getElementById('photoInput').addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0];var pv=document.getElementById('photoPreview');pv.innerHTML='';
  if(!f)return;var url=URL.createObjectURL(f);pv.innerHTML='<img alt="order photo" src="'+url+'"><div class="note" style="margin-top:6px">Loaded <strong>'+esc(f.name)+'</strong>. Send this photo to Claude in chat to auto-extract the items &amp; quantities.</div>';
});
// order text
function orderText(){
  var o=lastOrder;if(o.review||!o.account)return 'Resolve all review lines and select an account before exporting.';if(!o.lines||!o.lines.length)return 'No lines to export.';
  var L=[];L.push(v42Brand().company.toUpperCase()+' — ORDER SUMMARY');L.push('Account: '+(o.account||'(none)'));L.push('Status: '+o.status);L.push('Date: '+localDate());L.push('');
  L.push('Item                                        Qty     Disc%     NetUnit      NetValue');
  o.lines.forEach(function(r){L.push((r.item+'                                        ').slice(0,44)+String(r.qty).padStart(6)+'   '+(PCT(r.pct)).padStart(6)+'   '+SAR(r.nu).padStart(9)+'   '+SAR(r.nv).padStart(11));});
  L.push('');L.push('Total Qty:      '+INT(o.tQty));L.push('Total Gross:    '+SAR(o.tGross)+' SAR');L.push('Total Discount: '+SAR(o.tDisc)+' SAR');L.push('NET ORDER:      '+SAR(o.tNet)+' SAR');
  return L.join('\n');
}
document.getElementById('btnClear').addEventListener('click',function(){document.getElementById('obStatus').value='Executed';document.getElementById('obDate').value=localDate();document.getElementById('obNotes').value='';lines.innerHTML='';addLine();recalc();document.getElementById('copyNote').textContent='';document.getElementById('reqNote').textContent='';document.getElementById('pasteResult').textContent='';});

// ---- forecaster (expected order builder & quotation tool — reuses resolve())
var PCT2=function(n){return (n==null||isNaN(n))?"—":(n*100).toFixed(2)+"%";};
var fcAccount=document.getElementById('fcAccount');
var fcAccount=document.getElementById('fcAccount');
var fcLines=document.getElementById('fcLines');
var lastForecast={account:'',lines:[],tQty:0,tGross:0,tDisc:0,tNet:0,review:0};
function fcRowByItem(item){var rows=fcLines.querySelectorAll('.fc-line');for(var i=0;i<rows.length;i++){if(rows[i].dataset.item===item)return rows[i];}return null;}
function fcAddLine(item,qty){
  qty=qty==null?1:qty;
  if(!fcValidQty(qty)||qty<=0){document.getElementById('fcSuggestNote').textContent='Quantity must be greater than 0 and at most '+FC_MAX_QTY.toLocaleString()+'.';return;}
  var existing=fcRowByItem(item);
  if(existing){var q=existing.querySelector('.fc-qty'),sum=Number(q.value)+qty;if(!fcValidQty(sum)||sum<=0){document.getElementById('fcSuggestNote').textContent='Combined quantity is invalid or exceeds '+FC_MAX_QTY.toLocaleString()+'.';return;}q.value=sum;fcRecalc();return;}
  var row=document.createElement('div');row.className='fc-line';row.dataset.item=item;
  row.innerHTML='<div class="fc-name" title="'+esc(item)+'">'+esc(item)+'</div>'+
    '<input class="fc-qty" type="number" min="1" step="1" inputmode="numeric" value="'+qty+'" aria-label="Quantity for '+esc(item)+'">'+
    '<span class="fc-ro fc-ro-rsp"><span class="fc-ro-label">RSP</span><span class="fc-ro-val">—</span></span>'+
    '<span class="fc-ro fc-ro-disc"><span class="fc-ro-label">Disc %</span><input class="fc-disc" type="number" min="0" max="100" step="0.01" inputmode="decimal" placeholder="auto" aria-label="Discount percent for '+esc(item)+' — blank uses the account deal"></span>'+
    '<span class="fc-ro fc-ro-src"><span class="fc-ro-label">Source</span><span class="fc-ro-val">—</span></span>'+
    '<span class="fc-ro fc-ro-nu"><span class="fc-ro-label">Net unit</span><span class="fc-ro-val">—</span></span>'+
    '<span class="fc-ro fc-ro-nv"><span class="fc-ro-label">Net value</span><span class="fc-ro-val">—</span></span>'+
    '<button class="fc-rm" type="button" title="Remove" aria-label="Remove '+esc(item)+'">✕</button>';
  fcLines.appendChild(row);
  row.querySelector('.fc-qty').addEventListener('input',fcRecalc);
  row.querySelector('.fc-disc').addEventListener('input',fcRecalc);
  row.querySelector('.fc-rm').addEventListener('click',function(){row.remove();fcRecalc();});
  fcRecalc();
}
function fcRecalc(){
  var account=fcAccount.value,tQty=0,tGross=0,tDisc=0,tNet=0,review=0,rows=[];
  Array.prototype.forEach.call(fcLines.querySelectorAll('.fc-line'),function(row){
    var item=row.dataset.item,qty=parseFloat(row.querySelector('.fc-qty').value);
    var rspEl=row.querySelector('.fc-ro-rsp .fc-ro-val'),discEl=row.querySelector('.fc-disc'),
      srcEl=row.querySelector('.fc-ro-src .fc-ro-val'),nuEl=row.querySelector('.fc-ro-nu .fc-ro-val'),nvEl=row.querySelector('.fc-ro-nv .fc-ro-val');
    row.classList.remove('is-review');discEl.classList.remove('is-ovr');
    var im=itemMap[item]||{},ref=(im.rsp!=null)?im.rsp:null,r=resolve(account,item);
    rspEl.textContent=ref!=null?SAR(ref):'—';
    // The engine's rate is the placeholder, so an override is always an informed choice.
    discEl.placeholder=(r.pct!=null)?(r.pct*100).toFixed(2):'auto';
    var fcOvrRaw=discEl.value.trim(),pct=r.pct,src=r.src;
    if(fcOvrRaw!==''){
      var fcOvr=parseFloat(fcOvrRaw);
      // Percent numbers, same rule as the workbook: 40 means 40%.
      if(!isFinite(fcOvr)||fcOvr<0||fcOvr>100){
        srcEl.innerHTML='<span class="badge b-review">0–100 only</span>';nuEl.textContent='—';nvEl.textContent='—';
        review++;row.classList.add('is-review');
        rows.push({item:item,qty:fcValidQty(qty)?qty:0,ref:ref,pct:null,src:'REVIEW REQUIRED',nu:null,nv:null,included:false});
        return;
      }
      pct=fcOvr/100;src='Manual override';discEl.classList.add('is-ovr');
    }
    if(pct==null||!account||typeof ref!=='number'||!isFinite(ref)||ref<0){
      srcEl.innerHTML='<span class="badge b-review">REVIEW REQUIRED</span>';nuEl.textContent='—';nvEl.textContent='—';
      review++;row.classList.add('is-review');
      rows.push({item:item,qty:qty||0,ref:ref,pct:null,src:'REVIEW REQUIRED',nu:null,nv:null,included:false});
      return;
    }
    srcEl.innerHTML='<span class="badge '+(src==='Manual override'?'b-deal':(src==='Account deal'?'b-deal':'b-std'))+'">'+esc(src)+'</span>';
    if(!fcValidQty(qty)||qty<=0){srcEl.innerHTML='<span class="badge b-review">INVALID QUANTITY</span>';nuEl.textContent='—';nvEl.textContent='—';review++;row.classList.add('is-review');rows.push({item:item,qty:isFinite(qty)?qty:0,ref:ref,pct:null,src:'REVIEW REQUIRED',nu:null,nv:null,included:false});return;}
    if(ref==null){srcEl.innerHTML='<span class="badge b-review">REVIEW REQUIRED</span>';nuEl.textContent='—';nvEl.textContent='—';review++;row.classList.add('is-review');rows.push({item:item,qty:qty,ref:null,pct:null,src:'REVIEW REQUIRED',nu:null,nv:null,included:false});return;}
    var nu=ref*(1-pct),nv=qty*nu,da=qty*ref*pct;
    nuEl.textContent=SAR(nu);nvEl.textContent=SAR(nv);
    tQty+=qty;tGross+=qty*ref;tDisc+=da;tNet+=nv;
    rows.push({item:item,qty:qty,ref:ref,pct:pct,src:src,nu:nu,nv:nv,included:true});
  });
  document.getElementById('fcTQty').textContent=INT(tQty);
  document.getElementById('fcTGross').textContent=SAR(tGross);
  document.getElementById('fcTDisc').textContent=SAR(tDisc);
  document.getElementById('fcTNet').textContent=SAR(tNet);
  document.getElementById('fcAvgDisc').textContent=(tGross>0)?PCT(tDisc/tGross):'—';
  var v=document.getElementById('fcValid'),count=fcLines.querySelectorAll('.fc-line').length;
  if(!account)v.innerHTML='<span class="badge b-review">Select an account</span>';
  else if(review>0)v.innerHTML='<span class="badge b-review">REVIEW REQUIRED — '+review+' line(s) excluded from totals</span>';
  else if(count===0)v.innerHTML='<span class="badge b-std">Add an item to begin</span>';
  else v.innerHTML='<span class="badge b-good">Priced — '+count+' line(s)</span>';
  document.getElementById('fcAcctTag').textContent=account||'';
  document.getElementById('fcLineCount').textContent=count?count+' item(s)':'';
  document.getElementById('fcLineHint').textContent=count?'':'No items yet — add one above, or use “Suggest from history”.';
  lastForecast={account:account,lines:rows,tQty:tQty,tGross:tGross,tDisc:tDisc,tNet:tNet,review:review};
}
fcAccount.addEventListener('change',fcRecalc);
document.getElementById('fcAddBtn').addEventListener('click',function(){
  var raw=document.getElementById('fcItemInput').value.trim();if(!raw)return;
  var matched=itemMap[raw]?raw:matchItem(raw);
  var qty=Number(document.getElementById('fcQtyInput').value);
  if(!matched){document.getElementById('fcSuggestNote').textContent='No matching item found for “'+esc(raw)+'” — pick one from the list.';return;}
  fcAddLine(matched,qty);
  document.getElementById('fcItemInput').value='';document.getElementById('fcQtyInput').value='1';
  document.getElementById('fcItemInput').focus();
});
document.getElementById('fcItemInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();document.getElementById('fcAddBtn').click();}});
document.getElementById('fcClearBtn').addEventListener('click',function(){fcLines.innerHTML='';fcRecalc();document.getElementById('fcSuggestNote').textContent='';});
var FC_MAX_QTY=1000000;
function fcValidQty(q){return typeof q==='number'&&isFinite(q)&&q>=0&&q<=FC_MAX_QTY;}
function fcPeriodMonths(){
  var ds=D.orders.filter(function(o){return o.s==='Executed'&&o.d;}).map(function(o){return o.d;}).sort();
  if(!ds.length)return 1;
  var a=ds[0].split('-'),b=ds[ds.length-1].split('-');
  var m=(parseInt(b[0],10)-parseInt(a[0],10))*12+(parseInt(b[1],10)-parseInt(a[1],10))+1;
  return m>0?m:1;
}
function fcRoundQty(v){var q=v>=20?Math.round(v/5)*5:Math.round(v);return q<1?1:q;}
function fcSuggestFor(acct,basis){
  var lines=D.orders.filter(function(o){return o.a===acct&&o.s==='Executed';});
  if(!lines.length)return {items:{},note:acct+': no order history at all',ok:false};
  var opd=(D.meta&&D.meta.openerDates)||[];   /* undated YTD-upload lump dates (derived from order sources) */
  var opener=lines.filter(function(o){return opd.indexOf(o.d)>=0;});
  var dated=lines.filter(function(o){return opd.indexOf(o.d)<0;});
  var months=fcPeriodMonths(),byItem={},label,mode=basis||'auto';
  if(mode==='auto')mode=dated.length?'per_order':'monthly';
  if(mode==='per_order'&&!dated.length)mode='monthly';
  var src=(mode==='per_order')?dated:lines;
  src.forEach(function(o){var b=byItem[o.it]=byItem[o.it]||{q:0,n:0};b.q+=(o.q||0);b.n++;});
  var keys=Object.keys(byItem);
  if(mode==='per_order'){
    keys.forEach(function(k){byItem[k].v=byItem[k].q/byItem[k].n;});
    label='average of '+dated.length+' dated order line(s)'+(opener.length?' ('+opener.length+' YTD opener line(s) excluded)':'');
  }else if(mode==='monthly'){
    keys.forEach(function(k){byItem[k].v=byItem[k].q/months;});
    label='YTD volume ÷ '+months+' months'+(dated.length?'':' (no dated orders — from the YTD opener total)');
  }else{
    keys.forEach(function(k){byItem[k].v=byItem[k].q;});
    label='total YTD volume';
  }
  var items={};
  keys.sort(function(x,y){return byItem[y].q-byItem[x].q;}).forEach(function(k){items[k]=fcRoundQty(byItem[k].v);});
  return {items:items,note:acct+': '+label+' across '+keys.length+' item(s)',ok:true,mode:mode};
}
document.getElementById('fcSuggestBtn').addEventListener('click',function(){
  var account=fcAccount.value,note=document.getElementById('fcSuggestNote');
  if(!account){note.textContent='Select an account first.';return;}
  var basis=(document.getElementById('fcBasis')||{}).value||'auto';
  var r=fcSuggestFor(account,basis);
  if(!r.ok){
    fcLines.innerHTML='';                  /* never leave the previous account's lines on screen */
    fcRecalc();
    note.textContent=r.note+' \u2014 add items manually below.';return;
  }
  fcLines.innerHTML='';
  Object.keys(r.items).forEach(function(it){fcAddLine(it,r.items[it]);});
  fcRecalc();
  note.textContent='Suggested \u2014 '+r.note+'. These are estimates; review and adjust before using.';
});
function fcCsvField(v){v=(v==null)?'':String(v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;if(/[",\n\r]/.test(v))v='"'+v.replace(/"/g,'""')+'"';return v;}
function fcCsv(){
  var rows=lastForecast.lines||[],out=[];
  out.push(['Item','Item ID','Qty','RSP','Discount %','Discount Source','Net Unit','Net Value'].map(fcCsvField).join(','));
  rows.forEach(function(r){
    var im=itemMap[r.item]||{};
    out.push([r.item,im.id||'',r.qty,r.ref!=null?r.ref.toFixed(2):'',r.pct!=null?(r.pct*100).toFixed(2)+'%':'REVIEW REQUIRED',r.src,r.nu!=null?r.nu.toFixed(2):'',r.nv!=null?r.nv.toFixed(2):''].map(fcCsvField).join(','));
  });
  out.push(['TOTAL','',lastForecast.tQty,'','','','',lastForecast.tNet.toFixed(2)].map(fcCsvField).join(','));
  return out.join('\r\n');
}
function localDate(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function saveCsv(filename,csv,noteId){
  var payload='\ufeff'+csv;
  var note=noteId?document.getElementById(noteId):null;
  function setNote(t){ if(note) note.textContent=t; }
  function fallback(){
    try{
      var blob=new Blob([payload],{type:'text/csv;charset=utf-8;'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;a.download=filename;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url);},1000);
      setNote('Exported '+filename+' \u2014 opens directly in Excel.');
    }catch(e){ setNote('Could not export in this view. Open the local copy to download.'); }
  }
  if(window.claude&&typeof window.claude.use==='function'){
    setNote('Preparing '+filename+'\u2026');
    Promise.resolve(window.claude.use('downloads')).then(function(dl){
      if(!dl){ fallback(); return; }
      return dl.save({filename:filename,data:payload}).then(function(){
        setNote('Exported '+filename+' \u2014 opens directly in Excel.');
      },function(err){
        var c=err&&err.code;
        if(c==='declined') setNote('Export cancelled.');
        else if(c==='rate_limited') setNote('A save prompt is already open \u2014 try again in a moment.');
        else fallback();
      });
    })['catch'](function(){ fallback(); });
  } else { fallback(); }
}
document.getElementById('fcExportCsv').addEventListener('click',function(){
  if(!lastForecast.lines||!lastForecast.lines.length){document.getElementById('fcSuggestNote').textContent='Add at least one item before exporting.';return;}
  var acctSlug=(lastForecast.account||'Account').replace(/[^a-z0-9]+/gi,'_');
  var today=localDate();
  saveCsv(v42Brand().file+'_Forecast_'+acctSlug+'_'+today+'.csv',fcCsv(),'fcSuggestNote');
});

fcRecalc();

// ---- forecast mode tabs (single vs multi-account)
document.getElementById('fcModeTabs').addEventListener('click',function(e){
  var b=e.target.closest('button[data-pane]');if(!b)return;
  Array.prototype.forEach.call(this.querySelectorAll('button'),function(x){var on=x===b;x.setAttribute('aria-current',on?'true':'false');x.setAttribute('aria-selected',on?'true':'false');});
  ['single','multi'].forEach(function(p){document.getElementById('fc-pane-'+p).classList.toggle('active',p===b.dataset.pane);});
  if(b.dataset.pane==='multi')fmBuildSkeleton();
});

// ---- forecaster multi-account matrix (reuses resolve(), itemMap, matchItem, esc, SAR/INT/PCT/PCT2, D)
var fmAccounts=[],fmItems=[],fmQty={},fmCellRefs={},fmRowTotalEls={},fmColTotalEls={},fmGrandEl=null,fmNoBasisAccounts={};
var lastForecastMulti={rows:[],rowsMap:{},accounts:[],items:[],grand:{qty:0,gross:0,disc:0,net:0},reviewCount:0};
var fmAcctList=document.getElementById('fmAcctList');
var fmAcctKey='';
function fmBuildAccounts(){
  var list=D.accounts.filter(function(a){return a.active;}).slice().sort(function(a,b){return a.name.localeCompare(b.name);}),key=list.map(function(a){return a.name;}).join('␟');
  if(key===fmAcctKey)return;fmAcctKey=key;
  var keep={};fmAccounts.forEach(function(a){keep[a]=1;});
  fmAcctList.innerHTML=list.map(function(a){return '<label class="fm-acct-chk'+(keep[a.name]?' checked':'')+'"><input type="checkbox" class="fm-acct-cb" value="'+esc(a.name)+'"'+(keep[a.name]?' checked':'')+'> '+esc(a.name)+'</label>';}).join('');
  fmSyncAccountsFromDom();
}
function fmSyncAccountsFromDom(){
  var boxes=fmAcctList.querySelectorAll('.fm-acct-cb');
  fmAccounts=Array.prototype.filter.call(boxes,function(cb){return cb.checked;}).map(function(cb){return cb.value;});
  document.getElementById('fmAcctCount').textContent=fmAccounts.length?fmAccounts.length+' selected':'';
}
fmAcctList.addEventListener('change',function(e){
  var cb=e.target.closest('.fm-acct-cb');if(!cb)return;
  cb.closest('label').classList.toggle('checked',cb.checked);
  fmSyncAccountsFromDom();
  fmBuildSkeleton();
});
function fmPurgeQty(){
  var live={};
  fmItems.forEach(function(it){fmAccounts.forEach(function(a){live[a+'\u241F'+it]=1;});});
  Object.keys(fmQty).forEach(function(k){if(!live[k])delete fmQty[k];});
}
function fmSyncQtyFromDom(){
  Object.keys(fmCellRefs).forEach(function(key){var ref=fmCellRefs[key];if(ref&&ref.input)fmQty[key]=Number(ref.input.value);});
}
function fmBuildSkeleton(skipSync){
  if(!skipSync)fmSyncQtyFromDom();
  fmPurgeQty();
  var wrap=document.getElementById('fmMatrixWrap');
  fmCellRefs={};fmRowTotalEls={};fmColTotalEls={};fmGrandEl=null;
  if(!fmAccounts.length||!fmItems.length){
    wrap.innerHTML='<div class="note" id="fmMatrixHint">'+(!fmAccounts.length?'Select at least one account above.':'Add at least one item above.')+'</div>';
    document.getElementById('fmMatrixTag').textContent='';
    fmRecalcDisplay();
    return;
  }
  document.getElementById('fmMatrixTag').textContent=fmItems.length+' item(s) × '+fmAccounts.length+' account(s)';
  var html='<table class="fm-table"><thead><tr><th class="fm-pin">Item</th>';
  fmAccounts.forEach(function(a){html+='<th>'+esc(a)+(fmNoBasisAccounts[a]?' <span class="badge b-review">no history</span>':'')+'</th>';});
  html+='<th>Item total</th></tr></thead><tbody>';
  fmItems.forEach(function(it){
    html+='<tr><td class="fm-pin"><span class="fm-item-name" title="'+esc(it)+'">'+esc(it)+'</span>'+
      '<div class="fm-fillctl"><input type="number" min="0" step="1" class="fm-fillqty" placeholder="qty" aria-label="Fill qty for '+esc(it)+' across all accounts"><button type="button" class="btn ghost sm fm-fillrow" data-item="'+esc(it)+'">Fill row</button><button type="button" class="fm-rm-item" data-item="'+esc(it)+'" title="Remove item" aria-label="Remove '+esc(it)+' from matrix">✕</button></div></td>';
    fmAccounts.forEach(function(a){
      var key=a+'\u241F'+it,q=fmQty[key]==null?0:fmQty[key];
      html+='<td class="fm-cell"><input type="number" min="0" step="1" class="fm-qty" value="'+(q?q:'')+'" aria-label="Qty of '+esc(it)+' for '+esc(a)+'"><div class="fm-cellval"><span class="fm-pct">—</span><span class="fm-net">—</span></div></td>';
    });
    html+='<td class="fm-rowtotal">—</td></tr>';
  });
  html+='</tbody><tfoot><tr><td class="fm-pin">Account total</td>';
  fmAccounts.forEach(function(){html+='<td class="fm-coltotal">—</td>';});
  html+='<td class="fm-grand">—</td></tr></tfoot></table>';
  wrap.innerHTML=html;
  var table=wrap.querySelector('table'),trs=table.querySelectorAll('tbody tr');
  Array.prototype.forEach.call(trs,function(tr,ri){
    var it=fmItems[ri],tds=tr.querySelectorAll('td');
    for(var ci=0;ci<fmAccounts.length;ci++){
      var a=fmAccounts[ci],td=tds[ci+1],key=a+'\u241F'+it;
      var ref={td:td,input:td.querySelector('.fm-qty'),pctEl:td.querySelector('.fm-pct'),netEl:td.querySelector('.fm-net')};
      fmCellRefs[key]=ref;
      ref.input.addEventListener('input',(function(k,r){return function(){fmQty[k]=Number(r.input.value);fmRecalcDisplay();};})(key,ref));
    }
    fmRowTotalEls[it]=tds[tds.length-1];
    tr.querySelector('.fm-fillrow').addEventListener('click',function(){
      var btn=this,item=btn.dataset.item,row=btn.closest('tr'),qInput=row.querySelector('.fm-fillqty'),q=parseFloat(qInput.value);
      if(!fcValidQty(q))return;
      fmAccounts.forEach(function(a){var k=a+'\u241F'+item;fmQty[k]=q;var r=fmCellRefs[k];if(r)r.input.value=q;});
      fmRecalcDisplay();
    });
    tr.querySelector('.fm-rm-item').addEventListener('click',function(){
      var item=this.dataset.item;fmItems=fmItems.filter(function(x){return x!==item;});
      fmAccounts.forEach(function(a){delete fmQty[a+'\u241F'+item];});
      fmBuildSkeleton();
    });
  });
  var footTds=table.querySelectorAll('tfoot tr td');
  fmAccounts.forEach(function(a,i){fmColTotalEls[a]=footTds[i+1];});
  fmGrandEl=footTds[footTds.length-1];
  fmRecalcDisplay();
}
function fmRecalcDisplay(){
  var tQty=0,tGross=0,tDisc=0,tNet=0,review=0,rows=[],rowsMap={};
  var rowSums={},colSums={};
  fmItems.forEach(function(it){rowSums[it]={net:0};});
  fmAccounts.forEach(function(a){colSums[a]={net:0};});
  fmItems.forEach(function(it){
    var im=itemMap[it]||{},ref=(im.rsp!=null)?im.rsp:null;
    fmAccounts.forEach(function(a){
      var key=a+'\u241F'+it,c=fmCellRefs[key];if(!c)return;
      var qty=fmQty[key]==null?0:fmQty[key],r=resolve(a,it),row;
      c.td.classList.remove('is-review');
      if(r.pct==null||!fcValidQty(qty)){
        c.pctEl.textContent='REVIEW';c.netEl.textContent='REQUIRED';c.td.classList.add('is-review');
        review++;
        row={acct:a,item:it,qty:qty,ref:ref,pct:null,src:'REVIEW REQUIRED',nu:null,nv:null,included:false};
      }else{
        var nu=ref*(1-r.pct),nv=qty*nu,da=qty*ref*r.pct;
        c.pctEl.textContent=PCT2(r.pct);c.netEl.textContent=SAR(nv);
        rowSums[it].net+=nv;colSums[a].net+=nv;
        tQty+=qty;tGross+=qty*ref;tDisc+=da;tNet+=nv;
        row={acct:a,item:it,qty:qty,ref:ref,pct:r.pct,src:r.src,nu:nu,nv:nv,included:true};
      }
      rows.push(row);rowsMap[key]=row;
    });
  });
  fmItems.forEach(function(it){var el=fmRowTotalEls[it];if(el)el.textContent=SAR(rowSums[it].net);});
  fmAccounts.forEach(function(a){var el=fmColTotalEls[a];if(el)el.textContent=SAR(colSums[a].net);});
  if(fmGrandEl)fmGrandEl.textContent=SAR(tNet);
  document.getElementById('fmTQty').textContent=INT(tQty);
  document.getElementById('fmTGross').textContent=SAR(tGross);
  document.getElementById('fmTDisc').textContent=SAR(tDisc);
  document.getElementById('fmTNet').textContent=SAR(tNet);
  document.getElementById('fmAvgDisc').textContent=(tGross>0)?PCT(tDisc/tGross):'—';
  var v=document.getElementById('fmValid');
  if(!fmAccounts.length)v.innerHTML='<span class="badge b-review">Select at least one account</span>';
  else if(!fmItems.length)v.innerHTML='<span class="badge b-std">Add at least one item</span>';
  else if(review>0)v.innerHTML='<span class="badge b-review">REVIEW REQUIRED — '+review+' cell(s) excluded from totals</span>';
  else v.innerHTML='<span class="badge b-good">Priced — '+fmItems.length+' item(s) × '+fmAccounts.length+' account(s)</span>';
  document.getElementById('fmAcctTag').textContent=fmAccounts.length?fmAccounts.length+' account(s)':'';
  lastForecastMulti={rows:rows,rowsMap:rowsMap,accounts:fmAccounts.slice(),items:fmItems.slice(),grand:{qty:tQty,gross:tGross,disc:tDisc,net:tNet},reviewCount:review};
}
var fmItemInput=document.getElementById('fmItemInput'),fmQtyInput=document.getElementById('fmQtyInput');
document.getElementById('fmAddBtn').addEventListener('click',function(){
  var raw=fmItemInput.value.trim();if(!raw)return;
  var matched=itemMap[raw]?raw:matchItem(raw);
  if(!matched){document.getElementById('fmSuggestNote').textContent='No matching item found for “'+esc(raw)+'” — pick one from the list.';return;}
  var initQty=parseFloat(fmQtyInput.value)||0;
  if(!fcValidQty(initQty)&&initQty!==0){document.getElementById('fmSuggestNote').textContent='Quantity must be between 0 and '+FC_MAX_QTY.toLocaleString()+'.';return;}
  fmSyncQtyFromDom();                      /* keep what the user already typed */
  if(fmItems.indexOf(matched)===-1)fmItems.push(matched);
  if(initQty>0&&fmAccounts.length){fmAccounts.forEach(function(a){fmQty[a+'\u241F'+matched]=initQty;});}
  fmItemInput.value='';fmQtyInput.value='0';
  fmBuildSkeleton(true);                   /* do NOT re-sync: it would clobber what we just set */
  fmItemInput.focus();
});
fmItemInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();document.getElementById('fmAddBtn').click();}});
document.getElementById('fmClearBtn').addEventListener('click',function(){
  fmItems=[];fmQty={};fmCellRefs={};fmBuildSkeleton();document.getElementById('fmSuggestNote').textContent='';
});
document.getElementById('fmSuggestBtn').addEventListener('click',function(){
  var note=document.getElementById('fmSuggestNote');
  if(!fmAccounts.length){note.textContent='Select at least one account first.';return;}
  var basis=(document.getElementById('fmBasis')||{}).value||'auto';
  fmSyncQtyFromDom();                      /* keep manual edits before applying suggestions */
  var msgs=[],union=[];
  fmAccounts.forEach(function(a){
    var r=fcSuggestFor(a,basis);
    fmNoBasisAccounts[a]=!r.ok;
    msgs.push(r.note);
    if(!r.ok)return;
    Object.keys(r.items).forEach(function(it){
      fmQty[a+'\u241F'+it]=r.items[it];
      if(union.indexOf(it)===-1)union.push(it);
    });
  });
  union.forEach(function(it){if(fmItems.indexOf(it)===-1)fmItems.push(it);});
  fmBuildSkeleton(true);                   /* suggestions are already in fmQty */
  note.textContent='Suggested per account \u2014 '+msgs.join(' \u00b7 ')+'. These are estimates; review and adjust before using.';
});
function fmCsv(){
  var out=[],data=lastForecastMulti;
  out.push(['Account','Item','Item ID','Qty','RSP','Discount %','Discount Source','Net Unit','Net Value'].map(fcCsvField).join(','));
  data.accounts.forEach(function(a){
    var sub={qty:0,net:0};
    data.items.forEach(function(it){
      var row=data.rowsMap[a+'\u241F'+it];if(!row)return;
      var im=itemMap[it]||{};
      out.push([a,it,im.id||'',row.qty,row.ref!=null?row.ref.toFixed(2):'',row.pct!=null?(row.pct*100).toFixed(2)+'%':'REVIEW REQUIRED',row.src,row.nu!=null?row.nu.toFixed(2):'',row.nv!=null?row.nv.toFixed(2):''].map(fcCsvField).join(','));
      if(row.included){sub.qty+=row.qty;sub.net+=row.nv;}
    });
    out.push(['SUBTOTAL',a,'',sub.qty,'','','','',sub.net.toFixed(2)].map(fcCsvField).join(','));
  });
  out.push(['GRAND TOTAL','','',data.grand.qty,'','','','',data.grand.net.toFixed(2)].map(fcCsvField).join(','));
  return out.join('\r\n');
}
document.getElementById('fmExportCsv').addEventListener('click',function(){
  if(!lastForecastMulti.rows||!lastForecastMulti.rows.length){document.getElementById('fmSuggestNote').textContent='Select accounts and add items before exporting.';return;}
  var today=localDate();
  saveCsv(v42Brand().file+'_Forecast_Multi_'+today+'.csv',fmCsv(),'fmSuggestNote');
});

fmBuildSkeleton();
/* ==================== V40: live data, direct saving, Orders / Data views, Excel export ==================== */
var STATUSES=['Executed','Pending','Quoted','Cancelled'];
function nowISO(){return new Date().toISOString();}
function $(id){return document.getElementById(id);}
function setMsg(id,kind,html){var el=$(id);if(!el)return;el.innerHTML=(kind?'<span class="badge '+kind+'">'+(kind==='b-good'?'Saved':kind==='b-bad'?'Not saved':'Check')+'</span> ':'')+html;}
function errText(e){
  var c=e&&e.code;
  if(c==='quota_exceeded')return 'The database is full (document limit reached). Download a backup on the Data page and ask for help before adding more.';
  if(c==='resource_exhausted')return 'Too many changes in a short time. Wait a few seconds and try again.';
  if(c==='unavailable')return 'The database did not answer (tried twice). Check your connection and try again.';
  if(c==='revoked'||c==='not_granted'||c==='capability_disabled'||c==='capability_removed')return 'Access to the database was withdrawn. Reload the page.';
  if(c==='invalid_argument'||c==='transform_error')return 'The database refused this change (you may have view-only access, or the record is too large).';
  if(c==='conflict')return 'This record was changed elsewhere while you were saving. The page has reloaded it — please check and try again.';
  return (e&&e.message)?e.message:'Something went wrong. Nothing was saved.';
}
var toastT=null;
function toast(msg,kind){var t=$('toast');if(!t)return;t.className='toast show '+(kind||'');t.innerHTML=msg;clearTimeout(toastT);toastT=setTimeout(function(){t.className='toast';},5000);}
function numIn(v){v=String(v==null?'':v).trim().replace(/,/g,'');if(v==='')return null;var n=Number(v);return isFinite(n)?n:NaN;}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;var p=s.split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2]));return d.getUTCMonth()===p[1]-1&&d.getUTCDate()===p[2];}
function idNum(id){var m=/(\d+)$/.exec(String(id||''));return m?parseInt(m[1],10):0;}
function pad(n,w){n=String(n);while(n.length<w)n='0'+n;return n;}
function uniqName(list,name,selfId){var lc=name.trim().toLowerCase();return !list.some(function(x){return x.id!==selfId&&String(x.name||'').trim().toLowerCase()===lc;});}

/* ---------- dialog ---------- */
var Dlg={host:null,last:null,busy:false};
function closeDialog(){var h=$('dlgHost');if(!h)return;h.hidden=true;h.innerHTML='';Dlg.busy=false;if(Dlg.last&&Dlg.last.focus)try{Dlg.last.focus();}catch(e){}}
function openDialog(o){
  var h=$('dlgHost');Dlg.last=document.activeElement;
  h.innerHTML='<div class="md-back" data-mdclose="1"></div><div class="md" role="dialog" aria-modal="true" aria-labelledby="mdTitle"><h3 id="mdTitle">'+esc(o.title)+'</h3><div class="md-body">'+o.html+'</div>'+
    '<div class="md-msg" id="mdMsg" role="alert"></div><div class="md-btns"><button type="button" class="btn ghost" data-mdclose="1">'+esc(o.cancel||'Cancel')+'</button><button type="button" class="btn'+(o.danger?' danger':'')+'" id="mdOk">'+esc(o.ok||'Save')+'</button></div></div>';
  h.hidden=false;
  var md=h.querySelector('.md');
  h.onclick=function(e){if(e.target.closest('[data-mdclose]')&&!Dlg.busy){closeDialog();if(o.onCancel)o.onCancel();}};
  md.onkeydown=function(e){if(e.key==='Escape'&&!Dlg.busy){closeDialog();if(o.onCancel)o.onCancel();}
    if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type!=='checkbox'){e.preventDefault();$('mdOk').click();}};
  if(o.onInput)md.addEventListener('input',function(){o.onInput(md);});
  if(o.onInput)md.addEventListener('change',function(){o.onInput(md);});
  $('mdOk').onclick=function(){
    if(Dlg.busy)return;var r=o.onOk?o.onOk(md):null;
    if(typeof r==='string'){$('mdMsg').textContent=r;return;}
    if(r&&typeof r.then==='function'){Dlg.busy=true;$('mdOk').disabled=true;$('mdMsg').textContent='Saving…';
      r.then(function(){closeDialog();},function(e){Dlg.busy=false;$('mdOk').disabled=false;$('mdMsg').textContent=errText(e);});return;}
    closeDialog();
  };
  if(o.onInput)o.onInput(md);
  var f=md.querySelector('input:not([type=hidden]):not([disabled]),select,textarea')||$('mdOk');try{f.focus();}catch(e){}
}
function confirmBox(title,html,ok,danger){return new Promise(function(res){openDialog({title:title,html:html,ok:ok||'Continue',danger:danger,onOk:function(){res(true);},onCancel:function(){res(false);}});});}
function fld(id,label,val,opt){opt=opt||{};var v=val==null?'':val;
  if(opt.options)return '<div class="field"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+opt.options.map(function(x){var vv=typeof x==='string'?x:x.v,l=typeof x==='string'?x:x.l;return '<option value="'+esc(vv)+'"'+(String(vv)===String(v)?' selected':'')+'>'+esc(l)+'</option>';}).join('')+'</select>'+(opt.help?'<div class="note">'+opt.help+'</div>':'')+'</div>';
  if(opt.check)return '<label class="chk"><input type="checkbox" id="'+id+'"'+(v?' checked':'')+'> '+label+'</label>';
  return '<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(opt.type||'text')+'" value="'+esc(v)+'" autocomplete="off"'+(opt.mode?' inputmode="'+opt.mode+'"':'')+(opt.ro?' readonly':'')+(opt.ph?' placeholder="'+esc(opt.ph)+'"':'')+(opt.max?' maxlength="'+opt.max+'"':'')+'>'+(opt.help?'<div class="note" id="'+id+'Help">'+opt.help+'</div>':'')+'</div>';}
function fv(md,id){var el=md.querySelector('#'+id);if(!el)return null;return el.type==='checkbox'?el.checked:String(el.value).trim();}

/* ---------- write helpers: read-modify-write with optimistic check, retry once, audit ---------- */
function mutate(path,fn){
  var tries=0;
  function attempt(){
    return Store.get(path).then(function(cur){
      var exp=cur?(cur.updatedAt||''):null,body=cur||{schema:1,rows:[]};if(!Array.isArray(body.rows))body.rows=[];
      fn(body);return Store.put(path,body,exp);
    })['catch'](function(e){if(e&&e.code==='conflict'&&tries++<1)return attempt();throw e;});
  }
  return attempt();
}
function auditPath(){var m=localDate().slice(0,7),p='audit/'+m,i=1;
  while(Store.peek(p)&&JSON.stringify(Store.peek(p)).length>200000){i++;p='audit/'+m+'-'+i;}return p;}
function auditRow(type,account,item,field,oldv,newv,reason,notes){return {ts:nowISO(),type:type,account:account||'',item:item||'',field:field||'',old:oldv==null?'':oldv,'new':newv==null?'':newv,reason:reason||'',by:'owner',notes:notes||''};}
function commit(steps,auditRows){
  var i=0;
  function next(){if(i>=steps.length)return Promise.resolve();var s=steps[i++];return mutate(s.path,s.fn).then(next);}
  return next().then(function(){
    if(!auditRows||!auditRows.length)return;
    return mutate(auditPath(),function(b){b.rows=b.rows.concat(auditRows);})['catch'](function(e){toast('Saved, but the history row could not be written: '+esc(errText(e)),'warn');});
  });
}
function findOrder(id){for(var i=0;i<D.orders.length;i++)if(D.orders[i].id===id)return D.orders[i];return null;}
function nextTxNum(extra){var m=0;D.orders.forEach(function(o){m=Math.max(m,idNum(o.id));});(extra||[]).forEach(function(r){m=Math.max(m,idNum(r.id));});return m+1;}
function priceRow(r){r.discAmt=r.qty*r.rsp*r.pct;r.netUnit=r.rsp*(1-r.pct);r.net=r.qty*r.netUnit;return r;}

/* ---------- Order Builder: Save order ---------- */
$('btnReq').addEventListener('click',function(){
  recalc();var o=lastOrder,N='reqNote';
  if(!o.account)return setMsg(N,'b-review','Select an account first.');
  var acc=acctMap[o.account];if(!acc||!acc.active)return setMsg(N,'b-review','This account is inactive. Reactivate it on its account page first.');
  if(o.review)return setMsg(N,'b-review','Fix the '+o.review+' line(s) marked REVIEW first (missing price, unknown or inactive item, or quantity). Nothing was saved.');
  if(!o.lines||!o.lines.length)return setMsg(N,'b-review','Add at least one priced line.');
  if(o.lines.some(function(l){return l.src==='Manual override';}))return setMsg(N,'b-review','Manual discounts are for quotes and print only. Clear the Disc % box, or save a real deal in Pricing first.');
  if(o.lines.some(function(l){return !(Number.isInteger(l.qty)&&l.qty>=1&&l.qty<=1000000);}))return setMsg(N,'b-review','Quantities must be whole numbers from 1 to 1,000,000.');
  var seen={},dupIn=o.lines.filter(function(l){if(seen[l.item])return true;seen[l.item]=1;return false;});
  if(dupIn.length)return setMsg(N,'b-review','The same item appears twice ('+esc(dupIn[0].item)+'). Merge the lines.');
  var dt=$('obDate').value||localDate(),st=o.status;
  if(!validDate(dt))return setMsg(N,'b-review','Enter a valid order date.');
  if(st==='Executed'&&dt>localDate())return setMsg(N,'b-review','An executed order cannot be dated in the future. Use Pending or Quoted for future orders.');
  if(STATUSES.indexOf(st)<0)return setMsg(N,'b-review','Pick a status.');
  var dups=[];o.lines.forEach(function(l){var im=itemMap[l.item];D.orders.forEach(function(x){if(x.s!=='Cancelled'&&x.a===o.account&&x.d===dt&&x.itemId===im.id&&+x.q===l.qty)dups.push(x);});});
  var go=dups.length?confirmBox('Possible duplicate',
    '<p>'+dups.length+' line(s) with the same account, date, item and quantity are already saved:</p><ul class="ap-att">'+dups.slice(0,8).map(function(x){return '<li><span class="mono">'+esc(x.id)+'</span> · '+esc(x.it)+' × '+INT(x.q)+' · '+esc(x.s)+'</li>';}).join('')+'</ul><p>Save this order anyway?</p>','Save anyway'):Promise.resolve(true);
  go.then(function(ok){
    if(!ok)return setMsg(N,'b-review','Not saved — the order is still here for you to change.');
    var notes=($('obNotes').value||'').trim().slice(0,160),ref='ORD-'+nowISO().replace(/[-:T.Z]/g,'').slice(0,14),ts=nowISO(),ids=[],rowsOut=[];
    setMsg(N,'','Saving…');$('btnReq').disabled=true;
    commit([{path:v43OrdPath(dt.slice(0,7),o.lines.length*900+500),fn:function(b){
      var n=nextTxNum(b.rows);ids=[];rowsOut=[];
      o.lines.forEach(function(l){var im=itemMap[l.item],r=priceRow({id:'TX'+pad(n++,4),date:dt,account:o.account,origDesc:l.item,itemId:im.id,item:im.name,qty:l.qty,rsp:l.ref,pct:l.pct,
        src:l.src,source:'Platform order '+ref,status:st,notes:notes||null,orderRef:ref,createdAt:ts,updatedAt:ts});if(st==='Executed')r.execAt=ts;ids.push(r.id);rowsOut.push(r);b.rows.push(r);});
    }}],null).then(function(){
      return commit([],rowsOut.map(function(r){return auditRow('ADD_ORDER',r.account,r.item,'line','',r.id+' · '+r.date+' · qty '+r.qty+' · '+(r.pct*100).toFixed(2)+'% · net '+SAR(r.net)+' · '+r.status,notes,'order '+ref);}));
    }).then(function(){
      $('btnReq').disabled=false;
      setMsg(N,'b-good','Order saved: '+ids.length+' line(s) '+esc(ids[0])+(ids.length>1?'–'+esc(ids[ids.length-1]):'')+', net '+SAR(o.tNet)+' SAR, '+esc(st)+', '+esc(dt)+'. <button type="button" class="btn ghost sm" data-goorders="'+esc(o.account)+'">See in Orders</button>');
      toast('Order saved · '+ids.length+' line(s) · '+SAR(o.tNet)+' SAR','good');
      showSaved({ref:ref,ids:ids,account:o.account,date:dt,status:st,notes:notes,tQty:o.tQty,tGross:o.tGross,tDisc:o.tDisc,tNet:o.tNet,lines:rowsOut.map(function(r){return {item:r.item,qty:r.qty,ref:r.rsp,pct:r.pct,src:r.src,nu:r.netUnit,nv:r.net};})});
      lines.innerHTML='';addLine();$('obNotes').value='';recalc();
    },function(e){$('btnReq').disabled=false;setMsg(N,'b-bad',esc(errText(e)));});
  });
});
$('reqNote').addEventListener('click',function(e){var b=e.target.closest('[data-goorders]');if(b){OV.acct=b.dataset.goorders;OV.month='';OV.status='';OV.q='';show('orders');}});


/* ==================== V41: order documents, saved-order card, grouped Orders list ==================== */
function shortItem(n){return String(n||'').replace(/SA-PVT$/i,'').trim();}
function dayDiff(d){var a=Date.parse(d+'T00:00:00Z'),b=Date.parse(localDate()+'T00:00:00Z');return isFinite(a)?Math.round((b-a)/864e5):null;}
var DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MONL=['January','February','March','April','May','June','July','August','September','October','November','December'];
function exactDay(d){var p=String(d||'').split('-');if(p.length<3)return String(d||'—');var dt=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])),n=dayDiff(d);
  if(n===0)return 'Today';if(n===1)return 'Yesterday';
  return DOW[dt.getUTCDay()]+' '+(+p[2])+' '+MON[+p[1]-1]+(+p[0]!==+localDate().slice(0,4)?' '+p[0]:'');}
function monthShort(d){var p=String(d||'').split('-');return p.length<2?'—':MON[+p[1]-1]+' '+p[0];}
function monthLong(m){var p=String(m||'').split('-');return p.length<2?m:MONL[+p[1]-1]+' '+p[0];}
function srcLabel(s){return s==='Manual override'?'Manual':s==='Account deal'?'Deal':'Standard';}

/* one document shape for every print / copy: lines = [{item,qty,ref,pct,src,nu,nv}] */
function orderDoc(o){
  var lines=o.lines||[];
  return {title:o.title||'Order Summary',docNo:o.ref,date:o.date||localDate(),
    meta:[['Account',o.account||'-'],['Order date',o.date||localDate()],['Status',o.status||'-'],['Lines',String(lines.length)]],
    sections:[{cols:[{h:'#',w:22},{h:'Item',wrap:true},{h:'Qty',w:46,a:'r'},{h:'Ref price',w:52,a:'r'},{h:'Disc %',w:44,a:'r'},{h:'Basis',w:48},{h:'Net unit',w:52,a:'r'},{h:'Net value',w:64,a:'r'}],
      rows:lines.map(function(r,i){return [i+1,shortItem(r.item),pn(r.qty,0),pn(r.ref),r.pct!=null?(r.pct*100).toFixed(1)+'%':'REVIEW',srcLabel(r.src),pn(r.nu),pn(r.nv)];})}],
    totals:[['Total quantity',pn(o.tQty,0)],['Total gross',pn(o.tGross)+' SAR'],['Total discount',pn(o.tDisc)+' SAR'],['Net order value',pn(o.tNet)+' SAR',true]],
    note:o.notes||''};
}
function orderTextOf(o){
  var L=[v42Brand().company.toUpperCase()+' - ORDER SUMMARY','Account: '+o.account,'Status: '+o.status,'Date: '+(o.date||localDate()),(o.ref?'Reference: '+o.ref:''),'',
    'Item                                        Qty     Disc%     NetUnit      NetValue'];
  o.lines.forEach(function(r){L.push((shortItem(r.item)+'                                        ').slice(0,44)+String(r.qty).padStart(6)+'   '+PCT(r.pct).padStart(6)+'   '+SAR(r.nu).padStart(9)+'   '+SAR(r.nv).padStart(11));});
  L.push('','Total Qty:      '+INT(o.tQty),'Total Gross:    '+SAR(o.tGross)+' SAR','Total Discount: '+SAR(o.tDisc)+' SAR','NET ORDER:      '+SAR(o.tNet)+' SAR');
  return L.join('\n');
}
function copyText(t,noteEl){
  var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();
  var ok=false;try{ok=document.execCommand('copy');}catch(e){}document.body.removeChild(ta);
  var good='Copied — paste it into WhatsApp, email or a document.';
  if(ok)noteEl.textContent=good;
  else if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){noteEl.textContent=good;},function(){noteEl.textContent='Copying is blocked here. Use Print / PDF instead.';});
  else noteEl.textContent='Copying is blocked here. Use Print / PDF instead.';
}
/* group of saved lines -> document object */
function docFromLines(g){
  var ls=g.lines.filter(function(o){return o.s!=='Cancelled';}),tQty=0,tG=0,tD=0,tN=0;
  var rows=ls.map(function(o){var r=o._r,q=+o.q||0,rsp=+r.rsp||0,nu=r.netUnit!=null?+r.netUnit:(q?(+o.net||0)/q:0);tQty+=q;tG+=q*rsp;tN+=+o.net||0;tD+=+r.discAmt||q*rsp-(+o.net||0);
    return {item:o.it,qty:q,ref:rsp,pct:r.pct,src:r.src,nu:nu,nv:+o.net||0};});
  var sts={};g.lines.forEach(function(o){sts[o.s]=1;});
  return {ref:g.isNew?g.key:('Excel-'+g.d+'-'+g.a.replace(/[^A-Za-z0-9]+/g,'').slice(0,12)),account:g.a,date:g.d,status:Object.keys(sts).join(' / '),lines:rows,tQty:tQty,tGross:tG,tDisc:tD,tNet:tN,notes:(g.lines[0]._r.notes||'')};
}

/* ---- saved-order card (shown right after "Save order") ---- */
var lastSaved=null;
function showSaved(o){
  lastSaved=o;var el=$('savedPanel');if(!el)return;
  el.innerHTML='<div class="sv-head"><span class="sv-ok" aria-hidden="true">✓</span><div style="flex:1;min-width:0"><h3 style="margin:0">Order saved</h3><div class="muted" style="font-size:13px">'+esc(o.account)+' · '+esc(exactDay(o.date))+' · '+esc(o.status)+' · <span class="mono">'+esc(o.ids[0])+(o.ids.length>1?'–'+esc(o.ids[o.ids.length-1]):'')+'</span></div></div><button type="button" class="btn ghost sm" data-sp="close">Dismiss</button></div>'+
    '<div class="scroll"><table class="sv-tbl"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Disc</th><th class="num">Net unit</th><th class="num">Net value</th></tr></thead><tbody>'+
    o.lines.map(function(l){return '<tr><td>'+esc(shortItem(l.item))+'</td><td class="num">'+INT(l.qty)+'</td><td class="num">'+PCT2(l.pct)+'</td><td class="num">'+SAR(l.nu)+'</td><td class="num">'+SAR(l.nv)+'</td></tr>';}).join('')+
    '</tbody><tfoot><tr><td><strong>Total</strong></td><td class="num"><strong>'+INT(o.tQty)+'</strong></td><td></td><td></td><td class="num"><strong>'+SAR(o.tNet)+' SAR</strong></td></tr></tfoot></table></div>'+
    (o.notes?'<div class="note">Note: '+esc(o.notes)+'</div>':'')+
    v42SavedStock(o)+'<div class="rowbtns" style="margin-top:10px"><button type="button" class="btn" data-sp="pdf">Print / save PDF</button><button type="button" class="btn ghost" data-sp="copy">Copy summary</button><button type="button" class="btn ghost" data-sp="orders">See in Orders</button><button type="button" class="btn ghost" data-sp="close">New order</button></div><div class="note" id="spNote" role="status" aria-live="polite"></div>';
  el.hidden=false;try{el.scrollIntoView({block:'start',behavior:'smooth'});}catch(e){}
}
$('savedPanel').addEventListener('click',function(e){
  var b=e.target.closest('[data-sp]');if(!b||!lastSaved)return;var a=b.dataset.sp,o=lastSaved,n=$('spNote');
  if(a==='close'){$('savedPanel').hidden=true;return;}
  if(a==='copy')return copyText(orderTextOf(o),n);
  if(a==='orders'){OV.acct=o.account;OV.month='';OV.status='';OV.q='';OV.open[o.ref]=1;show('orders');return;}
  if(a==='pdf'){n.textContent='Preparing the PDF…';savePdf(orderDoc(o),v42Brand().file+'_Order_'+(o.account||'').replace(/\s+/g,'')+'_'+o.date+'_'+o.ids[0]+'.pdf','spNote');}
});

/* ---- builder: Copy + Print use the same documents ---- */
function builderOrder(){
  recalc();var o=lastOrder;
  return {ref:'JP-'+nowISO().replace(/[-:T.Z]/g,'').slice(0,12),account:o.account,status:o.status,date:$('obDate').value||localDate(),lines:o.lines,tQty:o.tQty,tGross:o.tGross,tDisc:o.tDisc,tNet:o.tNet,notes:($('obNotes').value||'').trim()};
}
function builderReady(msgId){
  var o=lastOrder,n=$(msgId);
  if(!o.account){n.textContent='Select an account first.';return false;}
  if(o.review){n.textContent='Fix the '+o.review+' line(s) marked REVIEW first.';return false;}
  if(!o.lines||!o.lines.length){n.textContent='Add priced lines first.';return false;}
  return true;
}
$('btnCopy').addEventListener('click',function(){recalc();if(!builderReady('copyNote'))return;copyText(orderTextOf(builderOrder()),$('copyNote'));});
$('btnPrint').addEventListener('click',function(){recalc();if(!builderReady('copyNote'))return;var o=builderOrder();
  var d=orderDoc(o);d.title='Order Summary (not yet saved)';savePdf(d,v42Brand().file+'_Order_'+(o.account||'').replace(/\s+/g,'')+'_'+o.date+'.pdf','copyNote');});

/* ---- Orders view: one row per order, lines inside ---- */
var OV={q:'',acct:'',month:'',status:'',limit:40,open:{}};
function filteredOrders(){
  var q=OV.q.toLowerCase();
  return D.orders.filter(function(o){
    if(V42.hideClosedOrders&&V42.closedNames[o.a])return false;if(OV.acct&&o.a!==OV.acct)return false;if(OV.month&&String(o.d).slice(0,7)!==OV.month)return false;if(OV.status&&o.s!==OV.status)return false;
    if(q){var r=o._r;if((o.id+' '+o.it+' '+o.a+' '+(r.notes||'')+' '+(r.orderRef||'')+' '+(r.origDesc||'')).toLowerCase().indexOf(q)<0)return false;}
    return true;}).slice().reverse();
}
function groupOrders(rows){
  var map={},arr=[];
  rows.forEach(function(o){var k=o._r.orderRef||('L|'+o.a+'|'+o.d),g=map[k];
    if(!g){g=map[k]={key:k,a:o.a,d:o.d,isNew:!!o._r.orderRef,created:o._r.createdAt||'',lines:[],qty:0,net:0,stat:{}};arr.push(g);}
    g.lines.push(o);if(String(o.d)>String(g.d))g.d=o.d;g.stat[o.s]=(g.stat[o.s]||0)+1;
    if(o.s!=='Cancelled'){g.qty+=+o.q||0;g.net+=+o.net||0;}});
  return arr;
}
function ogStatus(g){var k=Object.keys(g.stat);if(k.length===1)return stBadge(k[0]);return '<span class="badge b-off">Mixed</span>';}
function ogItems(g){
  var ls=g.lines.filter(function(o){return o.s!=='Cancelled';});if(!ls.length)ls=g.lines;
  var first=ls.slice(0,2).map(function(o){return esc(shortItem(o.it))+' <span class="muted">×'+INT(o.q)+'</span>';}).join(', ');
  return first+(ls.length>2?' <span class="og-more">+'+(ls.length-2)+' more</span>':'');
}
function ogDetail(g){
  var head=g.isNew?'Order <span class="mono">'+esc(g.key)+'</span> · saved '+esc(apWhen(g.created)||'')+' · exact date '+esc(g.d):'Imported from the Excel history · exact day '+esc(g.d)+' (shown in Edit)';
  return '<div class="og-meta">'+head+'</div><div class="scroll"><table class="og-lines"><thead><tr><th>Line</th><th>Item</th><th class="num">Qty</th><th class="num">Disc</th><th class="num">Net</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>'+
    g.lines.map(function(o){var c=o.s==='Cancelled';return '<tr'+(c?' class="is-cancel"':'')+'><td class="mono" style="font-size:11px">'+esc(o.id)+'</td><td>'+esc(shortItem(o.it))+(o._r.notes?'<div class="muted" style="font-size:11px">'+esc(o._r.notes)+'</div>':'')+'</td><td class="num">'+INT(o.q)+'</td><td class="num">'+PCT(o.du)+'</td><td class="num">'+SAR(o.net)+'</td><td>'+stBadge(o.s)+'</td>'+
      '<td class="ord-act"><button type="button" class="btn ghost sm" data-oedit="'+esc(o.id)+'" aria-label="Edit '+esc(o.id)+'">Edit</button>'+(c?'':'<button type="button" class="btn ghost sm" data-ocancel="'+esc(o.id)+'" aria-label="Cancel '+esc(o.id)+'">Cancel</button><button type="button" class="btn ghost sm" data-oreprice="'+esc(o.id)+'" aria-label="Re-price '+esc(o.id)+' at today’s rules">Re-price</button>')+'</td></tr>';}).join('')+'</tbody></table></div>'+
    '<div class="rowbtns" style="margin-top:8px"><button type="button" class="btn ghost sm" data-ogpdf="'+esc(g.key)+'">Print / save PDF</button></div>';
}
var OG={};
function renderOrders(){
  var el=$('ordBody');if(!el)return;
  $('ovSearch').value=OV.q;$('ovAcct').value=OV.acct;$('ovMonth').value=OV.month;$('ovStatus').value=OV.status;
  var rows=filteredOrders(),groups=groupOrders(rows),ex=rows.filter(function(o){return o.s==='Executed';}),net=0,qty=0;ex.forEach(function(o){net+=o.net||0;qty+=+o.q||0;});
  $('ordCount').textContent=INT(groups.length)+' orders';
  $('ovSum').innerHTML='<strong>'+INT(groups.length)+'</strong> order(s) · '+INT(rows.length)+' line(s) · executed <strong>'+INT(qty)+'</strong> units · <strong>'+SAR(net)+'</strong> SAR net';
  var shown=groups.slice(0,OV.limit),html='',lastM='';OG={};
  var mNet={},mCnt={};groups.forEach(function(g){var m=String(g.d).slice(0,7);mCnt[m]=(mCnt[m]||0)+1;g.lines.forEach(function(o){if(o.s==='Executed')mNet[m]=(mNet[m]||0)+(+o.net||0);});});
  shown.forEach(function(g){
    var m=String(g.d).slice(0,7);OG[g.key]=g;
    if(m!==lastM){lastM=m;html+='<div class="og-month"><strong>'+esc(monthLong(m))+'</strong><span class="muted"> · '+mCnt[m]+' order'+(mCnt[m]>1?'s':'')+' · '+SAR(mNet[m]||0)+' SAR executed</span></div>';}
    var open=!!OV.open[g.key],allC=Object.keys(g.stat).length===1&&g.stat.Cancelled;
    html+='<div class="og'+(allC?' is-cancel':'')+(open?' open':'')+'" data-k="'+esc(g.key)+'"><button type="button" class="og-row" aria-expanded="'+open+'">'+
      '<span class="og-date'+(g.isNew?' og-new':'')+'">'+esc(g.isNew?exactDay(g.d):monthShort(g.d))+'</span>'+
      '<span class="og-acct">'+esc(g.a)+'</span><span class="og-items">'+ogItems(g)+'</span>'+
      '<span class="og-qty">'+INT(g.qty)+'<small> units</small></span><span class="og-net">'+SAR(g.net)+'</span><span class="og-st">'+ogStatus(g)+'</span><span class="og-chev" aria-hidden="true">▾</span></button>'+
      '<div class="og-detail"'+(open?'':' hidden')+'>'+(open?ogDetail(g):'')+'</div></div>';
  });
  el.innerHTML=groups.length?'<div class="og-list">'+html+'</div>'+(groups.length>shown.length?'<div class="note">Showing '+shown.length+' of '+INT(groups.length)+' orders · <button type="button" class="btn ghost sm" id="ovMore">Show 40 more</button></div>':''):'<p class="muted">No orders match these filters.</p>';
}
(function(){
  $('ovSearch').addEventListener('input',function(e){OV.q=e.target.value;OV.limit=40;renderOrders();});
  ['ovAcct','ovMonth','ovStatus'].forEach(function(id){$(id).addEventListener('change',function(e){OV[{ovAcct:'acct',ovMonth:'month',ovStatus:'status'}[id]]=e.target.value;OV.limit=40;renderOrders();});});
  $('ovClear').addEventListener('click',function(){OV={q:'',acct:'',month:'',status:'',limit:40,open:{}};renderOrders();});
  $('ovNew').addEventListener('click',function(){if(OV.acct&&acctMap[OV.acct]&&acctMap[OV.acct].active)obAccount.value=OV.acct;recalc();show('order');});
  $('ordBody').addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    if(b.id==='ovMore'){OV.limit+=40;renderOrders();}
    else if(b.dataset.oedit)orderEditForm(b.dataset.oedit);
    else if(b.dataset.ocancel)cancelOrder(b.dataset.ocancel);
    else if(b.dataset.oreprice)repriceOrder(b.dataset.oreprice);
    else if(b.dataset.ogpdf){var g=OG[b.dataset.ogpdf];if(g){var d=docFromLines(g);savePdf(orderDoc(d),v42Brand().file+'_Order_'+g.a.replace(/\s+/g,'')+'_'+g.d+'.pdf','ovNote');}}
    else if(b.classList.contains('og-row')){var og=b.closest('.og'),k=og.dataset.k,det=og.querySelector('.og-detail'),open=!OV.open[k];
      if(open){OV.open[k]=1;det.innerHTML=ogDetail(OG[k]);det.hidden=false;}else{delete OV.open[k];det.hidden=true;}
      og.classList.toggle('open',open);b.setAttribute('aria-expanded',open);}
  });
})();

/* forecast prints -> PDF */
function fcDocLines(o){return o.lines.map(function(r,i){return [i+1,shortItem(r.item),pn(r.qty,0),r.ref!=null?pn(r.ref):'-',r.pct!=null?(r.pct*100).toFixed(2)+'%':'REVIEW',srcLabel(r.src),r.nu!=null?pn(r.nu):'-',r.nv!=null?pn(r.nv):'-'];});}
document.getElementById('fcPrint').addEventListener('click',function(){
  var o=lastForecast,N=document.getElementById('fcSuggestNote');if(!o.lines||!o.lines.length){N.textContent='Add at least one item before printing.';return;}
  var ref='JF-'+nowISO().replace(/[-:T.Z]/g,'').slice(0,12);
  savePdf({title:'Forecast / Quotation',docNo:ref,date:localDate(),meta:[['Account',o.account||'-'],['Type','Forecast - planning estimate'],['Lines',String(o.lines.length)+(o.review?' ('+o.review+' need review)':'')]],
    sections:[{cols:[{h:'#',w:22},{h:'Item',wrap:true},{h:'Qty',w:46,a:'r'},{h:'RSP',w:46,a:'r'},{h:'Disc %',w:48,a:'r'},{h:'Basis',w:48},{h:'Net unit',w:52,a:'r'},{h:'Net value',w:62,a:'r'}],rows:fcDocLines(o)}],
    totals:[['Total quantity',pn(o.tQty,0)],['Total gross',pn(o.tGross)+' SAR'],['Total discount',pn(o.tDisc)+' SAR'],['Total net (forecast)',pn(o.tNet)+' SAR',true]],
    footer:v42Brand().title+' - forecast is a planning estimate, not an executed order - prices in SAR, VAT not included unless stated'},
    v42Brand().file+'_Forecast_'+(o.account||'').replace(/\s+/g,'')+'_'+localDate()+'.pdf','fcSuggestNote');
});
document.getElementById('fmPrint').addEventListener('click',function(){
  var data=lastForecastMulti,N=document.getElementById('fmSuggestNote');if(!data.rows||!data.rows.length){N.textContent='Select accounts and add items before printing.';return;}
  var ref='JFM-'+nowISO().replace(/[-:T.Z]/g,'').slice(0,12),secs=[];
  data.accounts.forEach(function(a){var rows=[],sub=0,sq=0;
    data.items.forEach(function(it){var row=data.rowsMap[a+'␟'+it];if(!row)return;rows.push([shortItem(it),pn(row.qty,0),row.ref!=null?pn(row.ref):'-',row.pct!=null?(row.pct*100).toFixed(2)+'%':'REVIEW',row.nu!=null?pn(row.nu):'-',row.nv!=null?pn(row.nv):'-']);if(row.included){sub+=row.nv;sq+=row.qty;}});
    rows.push({cells:['Account net',pn(sq,0),'','','',pn(sub)+' SAR'],bold:true,shade:'0.90 0.94 0.98'});
    secs.push({heading:a,cols:[{h:'Item',wrap:true},{h:'Qty',w:50,a:'r'},{h:'RSP',w:52,a:'r'},{h:'Disc %',w:54,a:'r'},{h:'Net unit',w:58,a:'r'},{h:'Net value',w:78,a:'r'}],rows:rows});});
  savePdf({title:'Multi-Account Forecast',docNo:ref,date:localDate(),meta:[['Accounts',String(data.accounts.length)],['Items',String(data.items.length)],['Excluded (review)',String(data.reviewCount||0)]],sections:secs,
    totals:[['Grand total net',pn(data.grand.net)+' SAR',true]],footer:v42Brand().title+' - forecast is a planning estimate, not an executed order - prices in SAR, VAT not included unless stated'},
    v42Brand().file+'_MultiForecast_'+localDate()+'.pdf','fmSuggestNote');
});


/* ==================== V41: smart "Paste list" ====================
   Reads free text like "500 adol cap 2*12 with 500 boxes", finds the item (brand + form + strength + pack),
   shows a review table, and adds only the lines you confirm. Anything unsure is shown, never guessed. */
var PL_STOP={with:1,and:1,of:1,the:1,for:1,to:1,pcs:1,boxes:1,box:1,bx:1,qty:1,quantity:1,units:1,unit:1,pack:1,packs:1,carton:1,cartons:1,ctn:1,order:1,please:1,pls:1,need:1,want:1,an:1,in:1,no:1,number:1,x:1,tab:0};
var PL_FORM={capl:['capl'],caplet:['capl'],caplets:['capl'],caps:['caps'],capsule:['caps'],capsules:['caps'],cap:['capl','caps'],tab:['tab'],tabs:['tab'],tablet:['tab'],tablets:['tab'],syr:['syr'],syrup:['syr'],susp:['susp'],suspension:['susp'],supp:['supp'],suppository:['supp'],suppositories:['supp'],
  inj:['inj'],injection:['inj'],injectable:['inj'],amp:['inj'],ampoule:['inj'],ampoules:['inj'],vial:['inj'],vials:['inj'],drp:['drp'],drop:['drp'],drops:['drp'],oint:['oint'],ointment:['oint'],cre:['cre'],cream:['cre'],gel:['gel'],sol:['sol'],solution:['sol'],pdr:['pdr'],powder:['pdr'],patch:['patch'],inhaler:['inh'],ovule:['ovule'],ovules:['ovule']};
function plNum(s){return parseFloat(String(s).replace(/,/g,''));}
function plNorm(s){return String(s||'').toLowerCase().replace(/[×*]/g,'x').replace(/[\[\]\\\/(){}<>,;:=+|–—]/g,' ').replace(/\s+/g,' ').trim();}
/* pull pack / sizes out of normalised text -> {text,pack,sizes} */
function plExtract(s){
  var pack=null,sizes=[],m;
  m=s.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)(?:\s*(ml|gm|g|mg|bl|blister|amp|vial)s?\b)?/);
  if(m){pack=m[1]+'x'+m[2]+(m[3]?(m[3]==='g'?'gm':m[3]==='blister'?'bl':m[3]):'');s=s.replace(m[0],' ');}
  var re=/(\d+(?:\.\d+)?)\s*(mg|mcg|ml|gm|gram|g|iu|%)(?![a-z])/g;
  s=s.replace(re,function(all,n,u){sizes.push(plNum(n)+(u==='g'||u==='gram'?'gm':u));return ' ';});
  return {text:s.replace(/\s+/g,' ').trim(),pack:pack,sizes:sizes};
}
function plParse(raw){
  var s=String(raw||'').toLowerCase().replace(/^\s*(?:\d{1,2}\s*[.)]|[-•*])\s+/,'');
  s=plNorm(s);var ex=plExtract(s),qty=null,m;s=ex.text;
  m=s.match(/(\d[\d,]*)\s*(?:boxes|box|bx|cartons?|ctns?|pcs|pieces?|units?|packs?|pks?|bottles?|btls?|tubes?)(?![a-z])/);if(m){qty=plNum(m[1]);s=s.replace(m[0],' ');}
  if(qty==null){m=s.match(/(?:^|\s)(?:qty|quantity|q)\s*[:=]?\s*(\d[\d,]*)(?![a-z])/);if(m){qty=plNum(m[1]);s=s.replace(m[0],' ');}}
  if(qty==null){m=s.match(/(?:^|\s)x\s*(\d[\d,]*)(?![a-z\d])/)||s.match(/(?:^|\s)(\d[\d,]*)\s*x(?:\s|$)/);if(m){qty=plNum(m[1]);s=s.replace(m[0],' ');}}
  var toks=s.split(' ').filter(Boolean),words=[],bare=[],pos=[];
  toks.forEach(function(t,i){if(/^\d[\d,]*(?:\.\d+)?$/.test(t)){bare.push(plNum(t));pos.push(i);}else if(t.length>=2&&!PL_STOP[t])words.push(t);});
  var hints=bare.slice();
  if(qty==null&&bare.length){
    var last=toks.length-1,iLast=pos[pos.length-1],iFirst=pos[0];
    if(bare.length===1){if(iFirst===0||iFirst===last){qty=bare[0];hints=[];}}
    else if(iLast===last){qty=bare[bare.length-1];hints=bare.slice(0,-1);}
    else if(iFirst===0){qty=bare[0];hints=bare.slice(1);}
  }
  return {raw:raw,qty:qty,pack:ex.pack,sizes:ex.sizes,hints:hints,words:words};
}
var PL_IX=null,PL_IXKEY='';
function plIndex(){
  var key=D.activeItems.length+'|'+(D.activeItems[0]?D.activeItems[0].id:'')+'|'+(D.activeItems[D.activeItems.length-1]?D.activeItems[D.activeItems.length-1].id:'');
  if(PL_IX&&PL_IXKEY===key)return PL_IX;
  PL_IXKEY=key;PL_IX=D.activeItems.map(function(it){
    var s=plNorm(String(it.name).replace(/SA-PVT$/i,'')),ex=plExtract(s),toks=ex.text.split(/[\s\-]+/).filter(Boolean),words=[],forms=[];
    toks.forEach(function(t,i){if(i===0||/^[a-z][a-z0-9]*$/.test(t)){words.push(t);if(PL_FORM[t])PL_FORM[t].forEach(function(c){if(forms.indexOf(c)<0)forms.push(c);});}});
    return {name:it.name,words:words,forms:forms,pack:ex.pack,sizes:ex.sizes,nums:ex.sizes.map(function(z){return parseFloat(z);})};
  });
  return PL_IX;
}
function plEd(a,b){var m=a.length,n=b.length,p=[],i,j,c;if(Math.abs(m-n)>1)return 9;for(j=0;j<=n;j++)p[j]=j;for(i=1;i<=m;i++){var q=[i];for(j=1;j<=n;j++){c=a[i-1]===b[j-1]?0:1;q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+c);}p=q;}return p[n];}
function plWordEq(w,t){return w===t||(w.length>=3&&t.indexOf(w)===0)||(w.length>=4&&t.length>=4&&plEd(w,t)<=1);}
function plScore(q,it){
  var first=it.words[0],hit=q.words.some(function(w){return plWordEq(w,first);});if(!hit)return null;
  var sc=10,brandUsed=false,rest=it.words.slice(1),matched=0;
  q.words.forEach(function(w){
    if(!brandUsed&&plWordEq(w,first)){brandUsed=true;return;}
    var ok=rest.some(function(t){return plWordEq(w,t);});
    if(!ok){var fc=PL_FORM[w];ok=!!(fc&&fc.some(function(c){return it.forms.indexOf(c)>=0;}));}
    if(ok){sc+=3;matched++;}else sc-=2;
  });
  if(q.sizes.length){if(q.sizes.some(function(z){return it.sizes.indexOf(z)>=0;}))sc+=4;else if(it.sizes.length)sc-=8;}
  if(q.pack){if(it.pack&&it.pack.indexOf(q.pack)===0)sc+=4;else sc-=6;}
  q.hints.forEach(function(h){if(it.nums.indexOf(h)>=0)sc+=3;else if(it.nums.length)sc-=2;});
  rest.forEach(function(t){ /* an item word the query never mentions = a different product (EXTRA, SCAR, SINUS…) */
    var ft=PL_FORM[t]?PL_FORM[t][0]:null;
    var seen=q.words.some(function(w){return plWordEq(w,t)||(ft&&PL_FORM[w]&&PL_FORM[w].indexOf(ft)>=0);});
    if(!seen)sc-=2.5;});
  return sc;
}
function plMatchWords(q){
  var ix=plIndex(),res=[];
  ix.forEach(function(it){var s=plScore(q,it);if(s!=null)res.push({name:it.name,score:s});});
  res.sort(function(a,b){return b.score-a.score||a.name.localeCompare(b.name);});
  return res.slice(0,8);
}
function plAcctOf(line){
  var t=String(line||'').trim();if(/\d/.test(t)||t.length<3)return null;
  t=t.replace(/^(?:account|customer|client|acc|for|to)\s*[:\-]?\s*/i,'').replace(/[:\-–\s]+$/,'');
  var n=t.toLowerCase().replace(/[^a-z0-9]/g,'');if(n.length<4)return null;
  var hit=D.accounts.filter(function(a){if(!a.active)return false;var x=a.name.toLowerCase().replace(/[^a-z0-9]/g,'');return x===n||(n.length>=5&&x.indexOf(n)===0);});
  return hit.length===1?hit[0].name:null;
}
/* one raw line -> row model */
function plResolveLine(raw){
  var row={raw:raw,item:'',qty:null,cand:[],note:''};
  // 1) an exact official name, optionally followed by a quantity ("ADOL 500MG CAPL[2X12BL]SA-PVT, 200")
  var m=raw.match(/^(.*?)[\s,;:\-]*(?:x|×|qty|quantity)?\s*[,;:\-]?\s*(\d+(?:\.\d+)?)\s*$/i),nm=m&&m[1]?m[1].trim():raw.trim(),exact=itemMap[nm]&&itemMap[nm].active!==false?nm:null;
  if(!exact){var mm=raw.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);if(mm&&itemMap[mm[2].trim()]&&itemMap[mm[2].trim()].active!==false){exact=mm[2].trim();row.qty=plNum(mm[1]);}}
  if(exact){row.item=exact;if(row.qty==null&&m)row.qty=plNum(m[2]);row.cand=[{name:exact,score:99}];row.state='ok';return row;}
  var q=plParse(raw);row.qty=q.qty;row.cand=plMatchWords(q);
  if(!row.cand.length){row.state='none';return row;}
  var a=row.cand[0],b=row.cand[1];
  if(!b||(a.score>=14&&a.score-b.score>=2)){row.item=a.name;row.state='ok';}else row.state='check';
  return row;
}
var PL={rows:[],acct:''};
function plRows(){
  var txt=$('pasteBox').value,out=[],acct='';
  txt.split(/\r?\n|;/).forEach(function(ln){ln=ln.trim();if(!ln)return;var a=plAcctOf(ln);if(a&&!acct){acct=a;return;}out.push(plResolveLine(ln));});
  PL.rows=out;PL.acct=acct;
}
function plState(r){
  var imOk=r.item&&itemMap[r.item]&&itemMap[r.item].active!==false,qOk=typeof r.qty==='number'&&isFinite(r.qty)&&r.qty>=1&&r.qty<=1000000&&Math.floor(r.qty)===r.qty;
  return !imOk?'item':!qOk?'qty':'ready';
}
function plPrice(r){
  var a=obAccount.value||PL.acct;if(!a)return '<span class="muted">pick an account to see the price</span>';
  var p=resolve(a,r.item);if(p.pct==null)return '<span class="badge b-review">REVIEW</span>';
  var im=itemMap[r.item],nu=im.rsp*(1-p.pct);return '<span class="muted">'+(p.src==='Account deal'?'deal ':'standard ')+PCT2(p.pct)+' · net '+SAR(nu)+(r.qty?' × '+INT(r.qty)+' = <strong>'+SAR(nu*r.qty)+'</strong>':'')+'</span>';
}
function plRender(){
  var el=$('plReview'),rows=PL.rows;if(!el)return;
  if(!rows.length){el.innerHTML='';return;}
  var ready=rows.filter(function(r){return plState(r)==='ready';}).length;
  el.innerHTML=(PL.acct?'<div class="note">Account found in the list: <strong>'+esc(PL.acct)+'</strong>'+(obAccount.value&&obAccount.value!==PL.acct?' (the account selected above is <strong>'+esc(obAccount.value)+'</strong> — it will be kept)':' — it will be selected for you')+'.</div>':'')+
    '<div class="pl-rows">'+rows.map(function(r,i){
      var st=plState(r),sugg=r.cand.filter(function(c){return c.name!==r.item;}).slice(0,4);
      return '<div class="pl-row '+st+'" data-i="'+i+'"><div class="pl-raw" title="'+esc(r.raw)+'">“'+esc(r.raw)+'”</div>'+
        '<input class="pl-item" list="itemDL" value="'+esc(r.item)+'" placeholder="Choose the item…" aria-label="Item for: '+esc(r.raw)+'" autocomplete="off">'+
        '<div class="pl-line2"><input class="pl-qty" type="number" min="1" step="1" inputmode="numeric" value="'+(r.qty==null?'':r.qty)+'" placeholder="Qty" aria-label="Quantity">'+
        '<span class="pl-info">'+(st==='ready'?'<span class="badge b-good">Ready</span> '+plPrice(r):st==='item'?'<span class="badge b-review">Choose item</span>':'<span class="badge b-review">Add quantity</span>')+'</span>'+
        '<button type="button" class="pl-x" aria-label="Remove this line">✕</button></div>'+
        (st==='item'&&sugg.length||r.state==='check'&&sugg.length?'<div class="pl-sugg">Did you mean: '+sugg.map(function(c){return '<button type="button" class="chip" data-pick="'+esc(c.name)+'">'+esc(shortItem(c.name))+'</button>';}).join(' ')+'</div>':'')+
        '</div>';}).join('')+'</div>'+
    '<div class="rowbtns" style="margin-top:10px"><button type="button" class="btn" id="plAdd"'+(ready?'':' disabled')+'>Add '+ready+' ready line'+(ready===1?'':'s')+' to the order</button><button type="button" class="btn ghost sm" id="plClear">Clear list</button></div>'+
    (rows.length>ready?'<div class="note">'+(rows.length-ready)+' line(s) need attention (amber) and will be left out until fixed.</div>':'');
}
$('buildFromPaste').addEventListener('click',function(){
  plRows();plRender();
  var n=PL.rows.length;$('pasteResult').innerHTML=n?'Read <strong>'+n+'</strong> line(s). Check them below, then add.':'Nothing to read — paste or type your list first.';
});
$('plReview').addEventListener('input',function(e){
  var row=e.target.closest('.pl-row');if(!row)return;var r=PL.rows[+row.dataset.i];
  if(e.target.classList.contains('pl-item')){var v=e.target.value.trim();r.item=itemMap[v]?v:'';}
  else if(e.target.classList.contains('pl-qty')){r.qty=e.target.value===''?null:Number(e.target.value);}
  // refresh only the status/price text so typing is not interrupted
  var st=plState(r);row.className='pl-row '+st;row.querySelector('.pl-info').innerHTML=st==='ready'?'<span class="badge b-good">Ready</span> '+plPrice(r):st==='item'?'<span class="badge b-review">Choose item</span>':'<span class="badge b-review">Add quantity</span>';
  var ready=PL.rows.filter(function(x){return plState(x)==='ready';}).length,b=$('plAdd');if(b){b.disabled=!ready;b.textContent='Add '+ready+' ready line'+(ready===1?'':'s')+' to the order';}
});
$('plReview').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.dataset.pick){var row=b.closest('.pl-row'),r=PL.rows[+row.dataset.i];r.item=b.dataset.pick;plRender();return;}
  if(b.classList.contains('pl-x')){var i=+b.closest('.pl-row').dataset.i;PL.rows.splice(i,1);plRender();return;}
  if(b.id==='plClear'){PL.rows=[];PL.acct='';$('pasteBox').value='';plRender();$('pasteResult').textContent='';return;}
  if(b.id==='plAdd'){
    var ready=PL.rows.filter(function(r){return plState(r)==='ready';});if(!ready.length)return;
    if(PL.acct&&!obAccount.value&&acctMap[PL.acct]&&acctMap[PL.acct].active)obAccount.value=PL.acct;
    // drop the empty starter line, then add / merge
    Array.prototype.forEach.call(lines.querySelectorAll('.line'),function(l){if(!l.querySelector('.li-item').value.trim()&&!l.querySelector('.li-qty').value)l.remove();});
    var merged=0;
    ready.forEach(function(r){
      var ex=null;Array.prototype.forEach.call(lines.querySelectorAll('.line'),function(l){if(l.querySelector('.li-item').value.trim()===r.item)ex=l;});
      if(ex){var qi=ex.querySelector('.li-qty');qi.value=(+qi.value||0)+r.qty;merged++;}else addLine(r.item,r.qty);
    });
    PL.rows=PL.rows.filter(function(r){return plState(r)!=='ready';});recalc();plRender();
    $('pasteResult').innerHTML='<span class="badge b-good">Added</span> '+ready.length+' line(s)'+(merged?' ('+merged+' merged into an existing line)':'')+' to the order below.'+(PL.rows.length?' '+PL.rows.length+' still need attention.':'');
    if(!PL.rows.length){try{lines.scrollIntoView({block:'center',behavior:'smooth'});}catch(e2){}}
  }
});


function orderEditForm(id){
  var o=findOrder(id);if(!o)return toast('That order line no longer exists.','warn');var r=o._r;
  openDialog({title:'Edit order line '+id,ok:'Save changes',
    html:'<p class="note" style="margin-top:0"><strong>'+esc(o.a)+'</strong> · '+esc(o.it)+'<br>Price kept from the order: RSP '+SAR(r.rsp)+' · discount '+PCT2(r.pct)+' ('+esc(r.src||'')+')</p>'+
      '<div class="grid g-2b">'+fld('eDate','Order date',r.date,{type:'date'})+fld('eQty','Quantity',r.qty,{type:'number',mode:'numeric'})+'</div>'+
      fld('eStatus','Status',r.status,{options:STATUSES})+fld('eNotes','Notes / reference',r.notes,{max:160})+'<div class="note" id="ePrev" aria-live="polite"></div>',
    onInput:function(md){var q=numIn(fv(md,'eQty'));md.querySelector('#ePrev').innerHTML=(isFinite(q)&&q>0)?'Net after change: <strong>'+SAR(q*r.rsp*(1-r.pct))+' SAR</strong> (was '+SAR(r.net)+')':'';},
    onOk:function(md){
      var dt=fv(md,'eDate'),q=numIn(fv(md,'eQty')),st=fv(md,'eStatus'),nt=fv(md,'eNotes').slice(0,160);
      if(!validDate(dt))return 'Enter a valid date.';
      if(!(Number.isInteger(q)&&q>=1&&q<=1000000))return 'Quantity must be a whole number from 1 to 1,000,000.';
      if(st==='Executed'&&dt>localDate())return 'An executed order cannot be dated in the future.';
      var ch=[];if(dt!==r.date)ch.push(['date',r.date,dt]);if(q!==r.qty)ch.push(['qty',r.qty,q]);if(st!==r.status)ch.push(['status',r.status,st]);if((nt||null)!==(r.notes||null))ch.push(['notes',r.notes||'',nt]);
      if(!ch.length)return 'Nothing changed.';
      var oldP=o._p,newP=(dt.slice(0,7)===String(r.date||'').slice(0,7))?oldP:v43OrdPath(dt.slice(0,7),1500),ts=nowISO();   /* same month: the line stays on its own page */
      function apply(row){row.date=dt;row.qty=q;row.status=st;row.notes=nt||null;row.updatedAt=ts;if(st==='Executed'&&r.status!=='Executed')row.execAt=ts;if(q!==r.qty)priceRow(row);return row;}
      var aud=ch.map(function(c){return auditRow('EDIT_ORDER',o.a,o.it,c[0],c[1],c[2],'',id+(c[0]==='qty'?' · net '+SAR(r.net)+' → '+SAR(q*r.rsp*(1-r.pct)):'')+(oldP!==newP&&c[0]==='date'?' · moved '+oldP+' → '+newP:''));});
      var steps;
      if(oldP===newP)steps=[{path:oldP,fn:function(b){var row=b.rows.filter(function(x){return x.id===id;})[0];if(!row)throw new Error('Line '+id+' was not found (it may have been changed elsewhere). Nothing was saved.');apply(row);}}];
      else{var moved=null;
        steps=[{path:oldP,fn:function(b){var row=b.rows.filter(function(x){return x.id===id;})[0];if(!row)throw new Error('Line '+id+' was not found. Nothing was saved.');moved=apply(JSON.parse(JSON.stringify(row)));}},
          {path:newP,fn:function(b){if(b.rows.some(function(x){return x.id===id;}))throw new Error('Line '+id+' already exists in '+newP+'.');b.rows.push(moved);}},
          {path:oldP,fn:function(b){b.rows=b.rows.filter(function(x){return x.id!==id;});}}];
        steps[0]={path:oldP,fn:steps[0].fn,readOnly:true};
      }
      return commitEdit(steps,aud).then(function(){toast('Line '+esc(id)+' updated','good');});
    }});
}
/* a read-only first step only captures the row (no write); then add-to-new, then remove-from-old (never loses the row) */
function commitEdit(steps,aud){
  var s0=steps[0];
  if(!s0.readOnly)return commit(steps,aud);
  return Store.get(s0.path).then(function(cur){s0.fn(cur||{rows:[]});return commit(steps.slice(1),aud);});
}
function cancelOrder(id){
  var o=findOrder(id);if(!o)return;
  openDialog({title:'Cancel order line '+id+'?',ok:'Cancel this line',cancel:'Keep it',danger:true,
    html:'<p>'+esc(o.a)+' · '+esc(o.it)+' × '+INT(o.q)+' · '+SAR(o.net)+' SAR · '+esc(o.d)+'</p><p class="note">The line stays in the records with status <strong>Cancelled</strong> and no longer counts as sales. You can set it back with Edit.</p>'+fld('cReason','Reason (optional)','',{max:160}),
    onOk:function(md){var rs=fv(md,'cReason'),old=o.s;
      return commit([{path:o._p,fn:function(b){var row=b.rows.filter(function(x){return x.id===id;})[0];if(!row)throw new Error('Line not found. Nothing was saved.');row.status='Cancelled';row.updatedAt=nowISO();}}],
        [auditRow('CANCEL_ORDER',o.a,o.it,'status',old,'Cancelled',rs,id)]).then(function(){toast('Line '+esc(id)+' cancelled','good');});}});
}
function repriceOrder(id){
  var o=findOrder(id);if(!o)return;var r=o._r,im=itemById[r.itemId],rr=resolve(o.a,im?im.name:'');
  if(!im||rr.pct==null)return openDialog({title:'Cannot re-price '+id,ok:'OK',html:'<p>Today’s rules give no price for this line (no account deal, no standard discount, or the item is inactive / has no RSP). The line keeps its saved price.</p>',onOk:function(){}});
  var nr={qty:r.qty,rsp:im.rsp,pct:rr.pct};priceRow(nr);
  openDialog({title:'Re-price '+id+' at today’s rules?',ok:'Re-price',
    html:'<p>'+esc(o.a)+' · '+esc(o.it)+' × '+INT(r.qty)+'</p><div class="scroll"><table><thead><tr><th></th><th class="num">RSP</th><th class="num">Discount</th><th class="num">Net / unit</th><th class="num">Net</th><th>Rule</th></tr></thead><tbody>'+
      '<tr><td>Saved</td><td class="num">'+SAR(r.rsp)+'</td><td class="num">'+PCT2(r.pct)+'</td><td class="num">'+SAR(r.netUnit)+'</td><td class="num">'+SAR(r.net)+'</td><td>'+esc(r.src||'')+'</td></tr>'+
      '<tr><td><strong>Today</strong></td><td class="num">'+SAR(nr.rsp)+'</td><td class="num">'+PCT2(nr.pct)+'</td><td class="num">'+SAR(nr.netUnit)+'</td><td class="num"><strong>'+SAR(nr.net)+'</strong></td><td>'+esc(rr.src)+'</td></tr></tbody></table></div>'+
      '<p class="note">Change: '+(nr.net-r.net>=0?'+':'')+SAR(nr.net-r.net)+' SAR. Only this line changes.</p>',
    onOk:function(){
      return commit([{path:o._p,fn:function(b){var row=b.rows.filter(function(x){return x.id===id;})[0];if(!row)throw new Error('Line not found. Nothing was saved.');row.rsp=nr.rsp;row.pct=nr.pct;row.src=rr.src;priceRow(row);row.updatedAt=nowISO();}}],
        [auditRow('REPRICE_ORDER',o.a,o.it,'price',PCT2(r.pct)+' · net '+SAR(r.net),PCT2(nr.pct)+' · net '+SAR(nr.net),'Re-priced at today’s rules ('+rr.src+')',id)]).then(function(){toast('Line '+esc(id)+' re-priced','good');});}});
}

/* ---------- Pricing: save / retire a deal directly ---------- */
var pi=$('dcItem');
function dcShow(){var a=prAccount.value,it=pi.value,cur=$('dcCurrent'),pv=$('dcPreview'),de=$('dcDeactivate').checked,rt=$('dcRate');
  rt.disabled=de;pv.innerHTML='';$('dcBuild').textContent=de?'Retire deal':'Save deal';
  if(!a||!it){cur.textContent='Select an account (above) and an item.';return;}
  var r=resolve(a,it),im=itemMap[it]||{},key=a+'␟'+it,has=Object.prototype.hasOwnProperty.call(dealMap,key),rsp=(typeof im.rsp==='number'&&isFinite(im.rsp))?im.rsp:null;
  var stdOk=typeof im.std==='number'&&isFinite(im.std)&&im.std>=0&&im.std<=1;
  var net=function(p){return (rsp==null||p==null)?null:rsp*(1-p);};
  cur.innerHTML='RSP '+(rsp!=null?SAR(rsp):'<span class="badge b-review">missing</span>')+
    ' · Standard '+(stdOk?'<strong>'+PCT(im.std)+'</strong> (net '+SAR(net(im.std))+')':'<span class="badge b-review">no standard rate</span>')+
    ' · Customer deal '+(has?'<strong>'+PCT2(dealMap[key])+'</strong>':'<span class="muted">none (uses standard)</span>')+
    ' · Today: <strong>'+(r.pct==null?'<span class="badge b-review">REVIEW — no rate</span>':PCT2(r.pct)+' → net '+SAR(net(r.pct))+' SAR')+'</strong> ('+esc(r.src||'—')+')';
  var np=null,lab;
  if(de){if(!has){pv.innerHTML='<span class="badge b-review">CHECK</span> No Active deal to retire for this account and item.';return;}np=stdOk?im.std:null;lab='After retiring (standard rule)';}
  else{var raw=rt.value.trim(),v=parseFloat(raw);if(raw===''||!isFinite(v)||v<0||v>100)return;np=Math.round(v*10000)/10000/100;lab='New rate';}
  if(np==null||rsp==null){pv.innerHTML='<span class="badge b-review">CHECK</span> '+lab+': REVIEW — no valid rate/RSP.';return;}
  var d1=(r.pct==null?null:net(np)-net(r.pct));
  pv.innerHTML='Net per unit: <strong>'+(r.pct==null?'—':SAR(net(r.pct)))+' → '+SAR(net(np))+' SAR</strong> ('+lab+' '+PCT2(np)+(d1==null?'':', '+(d1>=0?'+':'')+SAR(d1)+' per unit')+'). Saved orders keep their prices; new orders use the new rule.';}
pi.addEventListener('change',dcShow);prAccount.addEventListener('change',dcShow);$('dcRate').addEventListener('input',dcShow);$('dcDeactivate').addEventListener('change',dcShow);
function dealPrefix(acc,rows){
  var own=rows.map(function(r){return (/^([A-Z]+)\d+$/.exec(String(r.id||''))||[])[1];}).filter(Boolean);if(own.length)return own[0];
  var used={};D.deals.forEach(function(d){var m=/^([A-Z]+)\d+$/.exec(String(d.id||''));if(m&&d.acct!==acc.name)used[m[1]]=1;});
  var L=String(acc.name).toUpperCase().replace(/[^A-Z]/g,'');if(L.length<3)L=(L+'XXX');
  for(var i=0;i<L.length;i++)for(var j=i+1;j<L.length;j++)for(var k=j+1;k<L.length;k++){if(i>0)continue;var p=L[i]+L[j]+L[k];if(!used[p])return p;}
  for(var n=0;n<26*26;n++){var q=L[0]+String.fromCharCode(65+Math.floor(n/26))+String.fromCharCode(65+n%26);if(!used[q])return q;}
  return 'DLX';
}
$('dcBuild').addEventListener('click',function(){
  var a=prAccount.value,it=pi.value,raw=$('dcRate').value.trim(),rs=$('dcReason').value.trim().slice(0,200),de=$('dcDeactivate').checked,N='dcNote';
  var acc=acctMap[a];if(!acc||!it)return setMsg(N,'b-review','Select an account and an exact item.');
  var im=itemMap[it];if(!im||typeof im.rsp!=='number'||!isFinite(im.rsp)||im.rsp<=0)return setMsg(N,'b-review','This item has no reference price (RSP), so a deal cannot be priced. Add the RSP on the Items page.');
  var eff=($('dcEff').value||'').trim()||localDate();if(!validDate(eff))return setMsg(N,'b-review','Effective date must be a valid date (or leave it empty for today).');
  var key=a+'␟'+it,has=Object.prototype.hasOwnProperty.call(dealMap,key),old=has?dealMap[key]:null,np=null,today=localDate();
  if(de&&!has)return setMsg(N,'b-review','Nothing to retire — this account has no Active deal for this item.');
  if(!de){var v=parseFloat(raw);if(raw===''||!isFinite(v)||v<0||v>100)return setMsg(N,'b-review','Discount must be a number from 0 to 100 (40 means 40%).');np=Math.round(v*10000)/10000/100;
    if(has&&Math.abs(old-np)<1e-9)return setMsg(N,'b-review','The deal is already '+PCT2(np)+'. Nothing to change.');}
  var newId='';setMsg(N,'','Saving…');$('dcBuild').disabled=true;
  commit([{path:'deals/'+acc.id,fn:function(b){
    var act=b.rows.filter(function(r){return r.itemId===im.id&&r.status==='Active';});
    if(de&&!act.length)throw new Error('This deal was already retired. Nothing was saved.');
    act.forEach(function(r){r.status='Inactive';r.to=de?today:eff;r.updated=today;});
    if(!de){var px=dealPrefix(acc,b.rows),mx=0;b.rows.forEach(function(r){var m=/^([A-Z]+)(\d+)$/.exec(String(r.id||''));if(m&&m[1]===px)mx=Math.max(mx,+m[2]);});
      newId=px+pad(mx+1,3);
      b.rows.push({id:newId,account:acc.name,origItem:im.name,item:im.name,itemId:im.id,pct:np,rsp:im.rsp,net:im.rsp*(1-np),extraPct:null,bonusPct:null,from:eff,to:null,status:'Active',source:'Platform',updated:today,notes:rs||null,type:'Account deal'});}
  }}],[de?auditRow('RETIRE_DEAL',a,it,'status','Active '+PCT2(old),'Inactive (standard rule)',rs,''):auditRow(has?'UPDATE_DEAL':'ADD_DEAL',a,it,'pct',has?PCT2(old):'',PCT2(np),rs,'deal '+newId+' from '+eff)]).then(function(){
    $('dcBuild').disabled=false;$('dcRate').value='';$('dcReason').value='';$('dcDeactivate').checked=false;
    setMsg(N,'b-good',de?'Deal retired for <strong>'+esc(it)+'</strong>. New orders use the standard rule.':'Deal <span class="mono">'+esc(newId)+'</span> saved: <strong>'+PCT2(np)+'</strong> for '+esc(it)+(has?' (replaces '+PCT2(old)+')':'')+'.');
    toast(de?'Deal retired':'Deal saved · '+PCT2(np),'good');dcShow();
  },function(e){$('dcBuild').disabled=false;setMsg(N,'b-bad',esc(errText(e)));});
});
$('pricingBody').addEventListener('click',function(e){var b=e.target.closest('[data-dcpick]');if(!b)return;pi.value=b.dataset.dcpick;dcShow();var r=$('dcRate');r.scrollIntoView({block:'center'});r.focus();});

/* ---------- Items: add / edit / deactivate ---------- */
function itemRefs(id){return D.orders.some(function(o){return o.itemId===id;})||D.deals.some(function(d){return d.itemId===id;});}
function itemForm(it){
  var raw=it?it._r:{},isNew=!it,locked=!isNew&&itemRefs(raw.id);
  openDialog({title:isNew?'Add item':'Edit item '+raw.id,ok:isNew?'Add item':'Save changes',
    html:fld('fName','Official item name',raw.name,{ro:locked,max:120,help:locked?'The name is fixed because orders or deals use this item.':'Must be unique.'})+
      '<div class="grid g-2b">'+fld('fShort','Short name',raw.short,{max:60})+fld('fCat','Category / brand',raw.category,{max:60})+fld('fStrength','Strength',raw.strength,{max:40})+fld('fForm','Form',raw.form,{max:40})+fld('fPack','Pack',raw.pack,{max:40})+
      fld('fRsp','RSP (SAR)',raw.rsp,{mode:'decimal'})+fld('fP26','2026 price (SAR) — sets the standard discount',raw.price2026,{mode:'decimal'})+fld('fMoh','MOH margin % (optional)',raw.moh!=null?Math.round(raw.moh*1e6)/1e4:'',{mode:'decimal',ph:'e.g. 16.66'})+'</div>'+
      fld('fNotes','Notes',raw.notes,{max:200})+(isNew?'':fld('fActive','Active (can be ordered)',raw.active!==false,{check:true}))+'<div class="note" id="fPrev" aria-live="polite"></div>',
    onInput:function(md){var r=numIn(fv(md,'fRsp')),p=numIn(fv(md,'fP26')),m=numIn(fv(md,'fMoh'));
      md.querySelector('#fPrev').innerHTML=(r>0?'Standard discount <strong>'+(p!=null&&isFinite(p)?PCT2(1-p/r):'none (orders need a deal)')+'</strong>'+(m!=null&&isFinite(m)?' · WSP <strong>'+SAR(r*(1-m/100))+'</strong>':''):'Enter the RSP to see the standard discount.');},
    onOk:function(md){
      var name=fv(md,'fName'),r=numIn(fv(md,'fRsp')),p=numIn(fv(md,'fP26')),m=numIn(fv(md,'fMoh'));
      if(!name)return 'Enter the item name.';
      if(!uniqName(D.items.map(function(x){return x._r;}),name,raw.id))return 'Another item already has this name.';
      if(!(r>0))return 'RSP must be a number above 0.';
      if(p!=null&&!(p>=0&&p<=r))return '2026 price must be between 0 and the RSP.';
      if(m!=null&&!(m>=0&&m<100))return 'MOH margin must be a percent from 0 to 99.99.';
      var vals={name:name,short:fv(md,'fShort')||null,category:fv(md,'fCat')||null,strength:fv(md,'fStrength')||null,form:fv(md,'fForm')||null,pack:fv(md,'fPack')||null,rsp:r,price2026:p,
        std:p!=null?1-p/r:null,stdNet:p,moh:m!=null?m/100:null,wsp:m!=null?r*(1-m/100):null,notes:fv(md,'fNotes')||null};
      if(!isNew)vals.active=fv(md,'fActive');
      var newId='',aud=[];
      if(isNew){return commit([{path:'master/items',fn:function(b){var mx=0;b.rows.forEach(function(x){mx=Math.max(mx,idNum(x.id));});newId='ITM'+pad(mx+1,3);
          if(!uniqName(b.rows,name,null))throw new Error('Another item already has this name.');vals.id=newId;vals.active=true;vals.source='Platform';b.rows.push(orderKeys(vals));}}],null)
        .then(function(){return commit([],[auditRow('ADD_ITEM','',name,'item','',newId+' · RSP '+SAR(r)+(vals.std!=null?' · std '+PCT2(vals.std):''),'','')]);}).then(function(){toast('Item '+esc(newId)+' added','good');IP.name=name;});}
      Object.keys(vals).forEach(function(k){var a=raw[k],b2=vals[k];if(typeof a==='number'&&typeof b2==='number'?Math.abs(a-b2)>1e-9:(a==null?null:a)!==(b2==null?null:b2))aud.push(auditRow('EDIT_ITEM','',raw.name,k,a,b2,'',raw.id));});
      if(!aud.length)return 'Nothing changed.';
      return commit([{path:'master/items',fn:function(b){var row=b.rows.filter(function(x){return x.id===raw.id;})[0];if(!row)throw new Error('Item not found.');Object.keys(vals).forEach(function(k){row[k]=vals[k];});}}],aud)
        .then(function(){toast('Item '+esc(raw.id)+' saved','good');IP.name=name;});
    }});
}
function orderKeys(v){var o={id:v.id},ks=['name','short','category','strength','form','pack','rsp','moh','wsp','price2026','std','stdNet','active','source','notes'];ks.forEach(function(k){o[k]=v[k]===undefined?null:v[k];});return o;}
function toggleItem(it){var raw=it._r,to=!(raw.active!==false);
  return confirmBox((to?'Reactivate ':'Deactivate ')+raw.id+'?',to?'<p>The item can be ordered again.</p>':'<p><strong>'+esc(raw.name)+'</strong> will no longer be offered for new orders. Saved orders and history are kept.</p>',to?'Reactivate':'Deactivate',!to).then(function(ok){if(!ok)return;
    return commit([{path:'master/items',fn:function(b){var row=b.rows.filter(function(x){return x.id===raw.id;})[0];if(!row)throw new Error('Item not found.');row.active=to;}}],[auditRow(to?'REACTIVATE_ITEM':'DEACTIVATE_ITEM','',raw.name,'active',!to,to,'',raw.id)])
      .then(function(){toast('Item '+esc(raw.id)+(to?' reactivated':' deactivated'),'good');},function(e){toast(esc(errText(e)),'bad');});});}
$('itemDetail').addEventListener('click',function(e){var b=e.target.closest('[data-itact]');if(!b||!IP.name)return;var it=itemMap[IP.name];if(!it)return;if(b.dataset.itact==='edit')itemForm(it);else toggleItem(it);});
$('itemAdd').addEventListener('click',function(){itemForm(null);});

/* ---------- Accounts: add / edit / deactivate ---------- */
var ACC_TYPES=['Pharmacy','Chain','Clinic','Hospital','Distributor','Other'];
function acctRefs(name){return D.orders.some(function(o){return o.a===name;})||D.deals.some(function(d){return d.acct===name;});}
function acctForm(a){
  var raw=a?a._r:{},isNew=!a,locked=!isNew&&acctRefs(raw.name),types=ACC_TYPES.slice();if(raw.type&&types.indexOf(raw.type)<0)types.push(raw.type);
  openDialog({title:isNew?'Add account':'Edit account '+raw.id,ok:isNew?'Add account':'Save changes',
    html:fld('aName','Account name',raw.name,{ro:locked,max:80,help:locked?'The name is fixed because orders or deals use this account.':'Must be unique.'})+
      '<div class="grid g-2b">'+fld('aType','Type',raw.type||'Pharmacy',{options:types})+fld('aTerr','Territory',raw.territory,{max:60})+fld('aContact','Contact',raw.contact,{max:80})+fld('aTarget','Annual target (SAR, optional)',raw.target,{mode:'decimal'})+'</div>'+
      fld('aAliases','Other names (separate with ;)',raw.aliases,{max:200})+fld('aNotes','Notes',raw.notes,{max:200})+(isNew?'':fld('aActive','Active (can be ordered)',raw.active!==false,{check:true})),
    onOk:function(md){
      var name=fv(md,'aName'),t=numIn(fv(md,'aTarget'));
      if(!name)return 'Enter the account name.';
      if(!uniqName(D.accounts.map(function(x){return x._r;}),name,raw.id))return 'Another account already has this name.';
      if(t!=null&&!(t>=0))return 'Target must be a number (or empty).';
      var vals={name:name,type:fv(md,'aType'),territory:fv(md,'aTerr')||null,contact:fv(md,'aContact')||null,target:t,aliases:fv(md,'aAliases')||null,notes:fv(md,'aNotes')||null};
      if(!isNew)vals.active=fv(md,'aActive');
      if(isNew){var newId='';return commit([{path:'master/accounts',fn:function(b){var mx=0;b.rows.forEach(function(x){mx=Math.max(mx,idNum(x.id));});newId='ACC'+pad(mx+1,2);
          if(!uniqName(b.rows,name,null))throw new Error('Another account already has this name.');b.rows.push({id:newId,name:name,type:vals.type,active:true,territory:vals.territory,contact:vals.contact,target:vals.target,aliases:vals.aliases,notes:vals.notes});}}],null)
        .then(function(){return commit([],[auditRow('ADD_ACCOUNT',name,'','account','',newId+' · '+vals.type,'','')]);}).then(function(){toast('Account '+esc(newId)+' added','good');AP.name=name;AP.tab='deals';show('accounts');});}
      var aud=[];Object.keys(vals).forEach(function(k){var x=raw[k]==null?null:raw[k],y=vals[k]==null?null:vals[k];if(x!==y)aud.push(auditRow('EDIT_ACCOUNT',raw.name,'',k,x,y,'',raw.id));});
      if(!aud.length)return 'Nothing changed.';
      return commit([{path:'master/accounts',fn:function(b){var row=b.rows.filter(function(x){return x.id===raw.id;})[0];if(!row)throw new Error('Account not found.');Object.keys(vals).forEach(function(k){row[k]=vals[k];});if(vals.active===true&&row.closedAt){delete row.closedAt;delete row.closedReason;}}}],aud)
        .then(function(){toast('Account '+esc(raw.id)+' saved','good');AP.name=name;});
    }});
}
$('acctAdd').addEventListener('click',function(){acctForm(null);});

/* ---------- Data check (replaces the old workbook reconciliation) ---------- */
function dataCheck(){
  var docs=Store.all(),net=0,lines=0,qty=0,arith=0,wrong=0,unkA=[],unkI=[],seen={},dupIds=[],accN={},itemIds={};
  rowsOf(docs['master/accounts']).forEach(function(a){if(seen['A'+a.id])dupIds.push(a.id);seen['A'+a.id]=1;accN[a.name]=1;});
  rowsOf(docs['master/items']).forEach(function(i){if(seen['I'+i.id])dupIds.push(i.id);seen['I'+i.id]=1;itemIds[i.id]=1;});
  var actPair={},multiAct=0;
  Object.keys(docs).sort().forEach(function(p){var c=p.split('/')[0];
    if(c==='orders')rowsOf(docs[p]).forEach(function(o){
      if(seen['T'+o.id])dupIds.push(o.id);seen['T'+o.id]=1;lines++;
      if(String(o.date||'').slice(0,7)!==p.slice(7,14))wrong++;
      if(!accN[o.account])unkA.push(o.id);if(!itemIds[o.itemId])unkI.push(o.id);
      if(Math.abs((+o.net||0)-(+o.qty||0)*(+o.rsp||0)*(1-(+o.pct||0)))>0.01)arith++;
      if(o.status==='Executed'){net+=+o.net||0;qty+=+o.qty||0;}});
    if(c==='deals')rowsOf(docs[p]).forEach(function(d){if(seen['D'+d.id])dupIds.push(d.id);seen['D'+d.id]=1;
      if(!accN[d.account])unkA.push(d.id);if(!itemIds[d.itemId])unkI.push(d.id);
      if(d.status==='Active'){var k=d.account+'|'+d.itemId;if(actPair[k])multiAct++;actPair[k]=1;}});
  });
  var netOk=Math.abs(net-M.execNetAll)<=0.005&&lines===D.orders.length; /* V42: compare with ALL executed lines, not the scoped dashboard total */
  var checks=[['Executed net = sum of saved lines',netOk,SAR(net)+' SAR'],['Line maths (qty × price × (1 − disc))',arith===0,arith+' mismatch(es)'],
    ['Unknown account references',unkA.length===0,unkA.length+(unkA.length?' · '+unkA.slice(0,5).join(', '):'')],['Unknown item references',unkI.length===0,unkI.length+(unkI.length?' · '+unkI.slice(0,5).join(', '):'')],
    ['Duplicate IDs',dupIds.length===0,dupIds.length+(dupIds.length?' · '+dupIds.slice(0,5).join(', '):'')],['Lines filed under the wrong month',wrong===0,String(wrong)],['Two Active deals for one item',multiAct===0,String(multiAct)]];
  return {ok:checks.every(function(c){return c[1];}),checks:checks,net:net,lines:lines,qty:qty};
}
function lastChange(){var m='';var docs=Store.all();Object.keys(docs).forEach(function(p){var u=docs[p]&&docs[p].updatedAt;if(u&&u>m)m=u;});return m;}
function renderRecon(){
  var el=$('recon');if(!el)return;var c=dataCheck();
  el.innerHTML='<details id="reconDetails"'+(c.ok?'':' open')+'><summary style="cursor:pointer;list-style-position:inside"><strong>Data check</strong> '+(c.ok?'<span class="badge b-good">ALL CHECKS PASSED</span>':'<span class="badge b-bad">PROBLEM FOUND — see details</span>')+' <span class="muted" style="font-size:12px">'+INT(c.lines)+' lines · '+INT(c.qty)+' units · '+SAR(c.net)+' SAR executed · details</span></summary>'+
    '<div class="recon-grid">'+c.checks.map(function(k){return '<div><div class="m-label">'+esc(k[0])+'</div><div class="m-val">'+(k[1]?'<span class="badge b-good">OK</span> ':'<span class="badge b-bad">CHECK</span> ')+esc(k[2])+'</div></div>';}).join('')+'</div></details>';
}

/* ---------- mode banner + sync chip ---------- */
function renderBanner(){
  var st=Store.status(),b=$('modeBanner'),sc=$('syncChip'),lc=lastChange();
  var lcTxt=lc?apWhen(lc):'—';
  if(sc){sc.className='synced'+(st.mode==='db'?'':' warn');sc.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.3 2" stroke-linecap="round"/></svg> '+(st.mode==='db'?'Live database':st.mode==='local'?'Offline copy':st.mode==='empty'?'Database empty':'Connecting…')+' · last change '+esc(lcTxt);}
  var fs=$('footSrc');if(fs)fs.textContent=st.note+' · last change '+lcTxt;
  var h='';
  if(st.error)h+='<div class="banner bad" role="alert"><strong>Database problem:</strong> '+esc(errText(st.error))+'</div>';
  if(st.mode==='starting'&&Store.hasSeed())h+='<div class="banner info" role="status">Connecting to the database… you are seeing the Excel snapshot meanwhile. Saving is available once connected.</div>';
  else if(st.mode==='local')h+='<div class="banner warn" role="status"><strong>'+esc(st.note)+'.</strong> Use “Download backup” on the Data page to keep a copy.</div>';
  else if(st.mode==='empty'&&!Store.hasSeed())h+='<div class="banner bad" role="alert"><strong>The database is empty.</strong> Nothing is shown. Open the offline copy or ask Claude to restore the backup — do not enter new data here yet. <button type="button" class="btn sm" id="nwBtn">Start a new workspace instead…</button></div>';
  else if(st.mode==='empty')h+='<div class="banner warn" role="status"><strong>The database is empty.</strong> You are seeing the Excel snapshot (read-only). <button type="button" class="btn sm" id="seedBtn">Load the Excel snapshot into the database</button><span id="seedNote" class="note" style="margin:0 0 0 8px"></span></div>';
  b.innerHTML=h;b.hidden=!h;v42BannerHook();
  var sb=$('seedBtn');if(sb)sb.onclick=function(){sb.disabled=true;$('seedNote').textContent='Loading '+Store.seedPaths().length+' records… do not close the page.';
    Store.seedDatabase().then(function(){toast('Excel snapshot loaded into the database','good');},function(e){sb.disabled=false;$('seedNote').textContent=errText(e);});};
}

/* ---------- selects (refreshed on every data change, keeping the current choice) ---------- */
function fillSelect(el,opts,first){if(!el)return;var cur=el.value;el.innerHTML=(first!=null?'<option value="">'+esc(first)+'</option>':'')+opts.map(function(o){var v=typeof o==='string'?o:o.v,l=typeof o==='string'?o:o.l;return '<option value="'+esc(v)+'">'+esc(l)+'</option>';}).join('');
  if(cur&&opts.some(function(o){return (typeof o==='string'?o:o.v)===cur;}))el.value=cur;}
function refreshSelects(){
  var act=D.accounts.filter(function(a){return a.active;}).map(function(a){return a.name;}).sort(function(a,b){return a.localeCompare(b);});
  var prv=prAccount.value;fillSelect(prAccount,act);if(!prv&&act.length&&!prAccount.value)prAccount.value=act[0];
  fillSelect(pcAccount,act);if(!pcAccount.value)pcAccount.value=prAccount.value;
  fillSelect(obAccount,act,'— select account —');fillSelect(fcAccount,act,'— select account —');
  var ai=D.activeItems.map(function(i){return i.name;}).sort(function(a,b){return a.localeCompare(b);});
  fillSelect(pi,ai,'— select item —');
  $('itemDL').innerHTML=ai.map(function(n){return '<option value="'+esc(n)+'">';}).join('');
  var allA={};D.accounts.forEach(function(a){allA[a.name]=1;});D.orders.forEach(function(o){allA[o.a]=1;});
  fillSelect($('ovAcct'),Object.keys(allA).sort(function(a,b){return a.localeCompare(b);}),'All accounts');
  var ms={};D.orders.forEach(function(o){if(o.d)ms[o.d.slice(0,7)]=1;});
  fillSelect($('ovMonth'),Object.keys(ms).sort().reverse().map(function(m){return {v:m,l:MON[+m.slice(5,7)-1]+' '+m.slice(0,4)};}),'All months');
  fillSelect($('ovStatus'),STATUSES,'All statuses');
  fmBuildAccounts();
}

/* ---------- Data view ---------- */
function renderDataView(){
  var el=$('dataBody');if(!el)return;var docs=Store.all(),st=Store.status(),c=dataCheck();
  var cnt=[['Accounts',D.accounts.length,D.accounts.filter(function(a){return a.active;}).length+' active'],['Items',D.items.length,D.activeItems.length+' active'],['Deals',D.deals.length,M.activeDeals+' active'],
    ['Order lines',D.orders.length,D.orders.filter(function(o){return o.s==='Executed';}).length+' executed · all accounts and periods'],['History rows',D.audit.length,'every change is logged'],['Stored documents',Object.keys(docs).length,st.mode==='db'?'in the platform database':st.mode==='local'?'embedded snapshot + this browser':'snapshot']];
  el.innerHTML='<div class="kpis">'+cnt.map(function(k){return '<div class="kpi"><div class="k-label">'+k[0]+'</div><div class="k-val sm">'+INT(k[1])+'</div><div class="k-sub">'+esc(k[2])+'</div></div>';}).join('')+'</div>'+
    '<div class="card" style="margin-bottom:14px"><h3>Where your data lives</h3><p style="margin:0">'+esc(st.note)+'. Last change: <strong>'+esc(apWhen(lastChange())||'—')+'</strong>.</p><p class="note">This platform is the master copy. Excel files are exports made from here — changes made in an exported file are not read back.</p></div>'+
    '<div class="card" style="margin-bottom:14px"><h3>Export</h3><div class="rowbtns"><button type="button" class="btn" id="xlsxBtn">Export to Excel</button><button type="button" class="btn ghost" id="jsonBtn">Download backup (JSON)</button></div><div class="note" id="expNote" role="status" aria-live="polite">Excel: Summary (live formulas), Orders, Deals, Items, Accounts, Mapping, Audit, Forecast. Backup: every record, for safe keeping.</div></div>'+
    '<div class="card"><h3>Data check '+(c.ok?'<span class="badge b-good">ALL CHECKS PASSED</span>':'<span class="badge b-bad">PROBLEM FOUND</span>')+'</h3><div class="recon-grid">'+c.checks.map(function(k){return '<div><div class="m-label">'+esc(k[0])+'</div><div class="m-val">'+(k[1]?'<span class="badge b-good">OK</span> ':'<span class="badge b-bad">CHECK</span> ')+esc(k[2])+'</div></div>';}).join('')+'</div></div>';
  $('xlsxBtn').onclick=function(){try{var blob=buildXlsx();saveBlob(v42Brand().file+'_Data_'+localDate()+'.xlsx',blob,'expNote');}catch(e){setMsg('expNote','b-bad','Could not build the Excel file: '+esc(e.message||e));}};
  $('jsonBtn').onclick=function(){var payload=v42Payload();
    saveBlob(v42Brand().file+'_Backup_'+localDate()+'.json',new Blob([JSON.stringify(payload,null,1)],{type:'application/json'}),'expNote',v42MarkBackup);};
}
function saveBlob(filename,blob,noteId,onOk){
  var note=$(noteId);function say(k,t){if(note)setMsg(noteId,k,t);}
  function fallback(){try{var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},2000);say('b-good','Downloaded <strong>'+esc(filename)+'</strong>.');if(onOk)onOk();}catch(e){say('b-bad','This view cannot download files.');}}
  say('','Preparing '+esc(filename)+'…');
  if(window.claude&&typeof window.claude.use==='function'){
    Promise.resolve(window.claude.use('downloads')).then(function(dl){if(!dl)return fallback();
      return dl.save({filename:filename,data:blob}).then(function(){say('b-good','Saved <strong>'+esc(filename)+'</strong>.');if(onOk)onOk();},function(e){var c=e&&e.code;
        if(c==='declined')say('b-review','Save cancelled.');else if(c==='rate_limited')say('b-review','A save prompt is already open — try again in a moment.');else fallback();});
    })['catch'](fallback);
  }else fallback();
}


/* ==================== V41: PDF documents ====================
   Printing: the page is sandboxed, so the browser print command is blocked. Every "Print" button now builds a real
   PDF and saves it (open it, then print from the PDF viewer). No libraries: a small writer using the built-in Helvetica fonts. */
var PDFW={H:[278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761, 556, 761, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 761, 611, 761, 761, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 761, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500],B:[278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 761, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 761, 611, 761, 761, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 761, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556]};
function pdfStr(s){return String(s==null?'':s).replace(/[–—−]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[·•]/g,'-').replace(/…/g,'...').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?');}
function pdfW(s,size,bold){var t=bold?PDFW.B:PDFW.H,w=0;for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);w+=(c>=32&&c<=255)?t[c-32]:556;}return w*size/1000;}
function pdfEsc(s){return s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function pdfWrap(s,w,size,bold){
  var out=[],cur='';String(s).split(/(?<=[\s\\\/\[\]-])/).forEach(function(tok){
    if(pdfW(cur+tok,size,bold)<=w||!cur){cur+=tok;}else{out.push(cur.replace(/\s+$/,''));cur=tok;}
    while(pdfW(cur,size,bold)>w&&cur.length>1){var k=cur.length-1;while(k>1&&pdfW(cur.slice(0,k),size,bold)>w)k--;out.push(cur.slice(0,k));cur=cur.slice(k);}
  });
  if(cur)out.push(cur.replace(/\s+$/,''));return out.length?out:[''];
}
function pn(n,d){if(n==null||!isFinite(n))return '-';d=d==null?2:d;return Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});}
/* doc = {title, docNo, date, by, meta:[[label,value]], sections:[{heading, cols:[{h,w|flex,a:'l'|'r',wrap}], rows:[[cells]|{cells,bold,shade}]}], totals:[[label,value,grand]], note, footer} */
function buildPdf(doc){
  var PW=595.28,PH=841.89,MX=40,CW=PW-2*MX,BOT=54,pages=[],cur=null,y=0,BLUE='0.122 0.306 0.475',INK='0.07 0.13 0.19',GRAY='0.45 0.50 0.58';
  function np(){cur=[];pages.push(cur);y=PH-44;}
  function f(n){return (Math.round(n*100)/100).toString();}
  function T(x,yy,s,size,bold,col,al,w){s=pdfStr(s);var xx=x;if(al==='r')xx=x+w-pdfW(s,size,bold);else if(al==='c')xx=x+(w-pdfW(s,size,bold))/2;
    cur.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+(col||INK)+' rg '+f(xx)+' '+f(yy)+' Td ('+pdfEsc(s)+') Tj ET');}
  function R(x,yy,w,h,col){cur.push(col+' rg '+f(x)+' '+f(yy)+' '+f(w)+' '+f(h)+' re f');}
  function L(x1,y1,x2,y2,col,lw){cur.push(col+' RG '+(lw||0.5)+' w '+f(x1)+' '+f(y1)+' m '+f(x2)+' '+f(y2)+' l S');}
  np();
  // header
  T(MX,y-18,doc.brand||v42Brand().company,22,true,BLUE);T(MX,y-32,(doc.title||'').toUpperCase(),8.5,true,GRAY);
  var dl=[['Doc No',doc.docNo||'-'],['Date',doc.date||'-'],['Prepared by',doc.by||'Mohab - Key Account Manager']];
  dl.forEach(function(r,i){T(PW-MX-210,y-12-i*13,r[0]+':',8.5,false,GRAY,'l');T(PW-MX-150,y-12-i*13,r[1],9.5,true,INK,'l');});
  y-=46;L(MX,y,PW-MX,y,BLUE,2);y-=16;
  // meta
  var meta=doc.meta||[],mw=CW/Math.max(1,Math.min(4,meta.length));
  meta.slice(0,4).forEach(function(m,i){T(MX+i*mw,y,String(m[0]).toUpperCase(),7,true,GRAY);var lines=pdfWrap(pdfStr(m[1]),mw-8,10.5,true);lines.slice(0,2).forEach(function(l,k){T(MX+i*mw,y-12-k*12,l,10.5,true,INK);});});
  y-=(meta.some(function(m){return pdfW(pdfStr(m[1]),10.5,true)>mw-8;})?42:32);
  (doc.sections||[]).forEach(function(sec){
    var cols=sec.cols,flexW=CW-cols.reduce(function(s,c){return s+(c.w||0);},0),xs=[],x=MX;
    cols.forEach(function(c){c._w=c.w||flexW;xs.push(x);x+=c._w;});
    function head(){
      if(sec.heading){T(MX,y-10,sec.heading,11,true,BLUE);y-=18;}
      R(MX,y-16,CW,16,BLUE);cols.forEach(function(c,i){T(xs[i]+4,y-11.5,String(c.h).toUpperCase(),7.5,true,'1 1 1',c.a==='r'?'r':'l',c._w-8);});y-=16;
    }
    if(y-60<BOT)np();head();
    sec.rows.forEach(function(r,ri){
      var cells=r.cells||r,bold=!!r.bold,lines=cells.map(function(v,i){var s=pdfStr(v==null?'':v);return cols[i].wrap?pdfWrap(s,cols[i]._w-8,8.5,bold):[s];}),n=Math.max.apply(null,lines.map(function(l){return l.length;})),h=n*10.5+6;
      if(y-h<BOT){np();head();}
      if(r.shade||(!r.cells&&ri%2===1))R(MX,y-h,CW,h,r.shade||'0.955 0.968 0.985');
      cells.forEach(function(v,i){lines[i].forEach(function(l,k){T(xs[i]+4,y-9-k*10.5,l,8.5,bold,INK,cols[i].a==='r'?'r':'l',cols[i]._w-8);});});
      L(MX,y-h,PW-MX,y-h,'0.80 0.84 0.89',0.4);y-=h;
    });
    y-=10;
  });
  if(doc.totals&&doc.totals.length){
    if(y-doc.totals.length*20<BOT)np();
    var tw=230,tx=PW-MX-tw;
    doc.totals.forEach(function(t){
      if(t[2]){L(tx,y-2,PW-MX,y-2,INK,1.2);y-=4;T(tx,y-14,t[0],12,true,BLUE);T(tx,y-14,t[1],12,true,BLUE,'r',tw);y-=22;}
      else{T(tx,y-10,t[0],9.5,false,INK);T(tx,y-10,t[1],9.5,true,INK,'r',tw);L(tx,y-15,PW-MX,y-15,'0.80 0.84 0.89',0.4);y-=18;}
    });
  }
  if(doc.note){y-=6;if(y-30<BOT)np();T(MX,y-8,'NOTES',7,true,GRAY);pdfWrap(pdfStr(doc.note),CW,9,false).forEach(function(l,i){T(MX,y-20-i*11,l,9,false,INK);});}
  var N=pages.length;
  pages.forEach(function(p,i){cur=p;L(MX,40,PW-MX,40,'0.80 0.84 0.89',0.5);T(MX,28,doc.footer||v42Brand().title+' - all prices in SAR, VAT not included unless stated',7.5,false,GRAY);T(MX,28,'Page '+(i+1)+' of '+N,7.5,false,GRAY,'r',CW);});
  var objs=[];
  function add(x){objs.push(x);}
  add('<< /Type /Catalog /Pages 2 0 R >>');
  var kids=[];pages.forEach(function(p,i){kids.push((7+2*i)+' 0 R');});
  add('<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+N+' >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add('<< /Title ('+pdfEsc(pdfStr((doc.title||'')+' '+(doc.docNo||'')))+') /Producer ('+pdfEsc(pdfStr(v42Brand().title))+') >>');
  pages.forEach(function(p,i){var st=p.join('\n');add('<< /Length '+st.length+' >>\nstream\n'+st+'\nendstream');
    add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+(6+2*i)+' 0 R >>');});
  var out='%PDF-1.4\n',offs=[];
  objs.forEach(function(o,i){offs.push(out.length);out+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
  var xr=out.length;out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
  offs.forEach(function(o){out+=('0000000000'+o).slice(-10)+' 00000 n \n';});
  out+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R /Info 5 0 R >>\nstartxref\n'+xr+'\n%%EOF';
  var u=new Uint8Array(out.length);for(var k=0;k<out.length;k++)u[k]=out.charCodeAt(k)&255;
  return new Blob([u],{type:'application/pdf'});
}
function savePdf(doc,filename,noteId){saveBlob(String(filename).replace(/[^A-Za-z0-9._-]+/g,'_'),buildPdf(doc),noteId);}

/* ---------- minimal XLSX writer: SpreadsheetML + stored ZIP (CRC32) ---------- */
var CRCT=null;
function crc32(u){if(!CRCT){CRCT=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CRCT[n]=c>>>0;}}
  var crc=0xFFFFFFFF;for(var i=0;i<u.length;i++)crc=CRCT[(crc^u[i])&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;}
function zipStore(files){
  var enc=new TextEncoder(),parts=[],cen=[],off=0,cenSize=0;
  function u16(n){return [n&255,(n>>>8)&255];}function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
  files.forEach(function(f){var nm=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,c=crc32(data),sz=data.length;
    var lh=new Uint8Array([0x50,0x4b,3,4].concat(u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(c),u32(sz),u32(sz),u16(nm.length),u16(0)));
    parts.push(lh,nm,data);
    var ch=new Uint8Array([0x50,0x4b,1,2].concat(u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(c),u32(sz),u32(sz),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off)));
    cen.push(ch,nm);cenSize+=ch.length+nm.length;off+=lh.length+nm.length+sz;});
  var end=new Uint8Array([0x50,0x4b,5,6].concat(u16(0),u16(0),u16(files.length),u16(files.length),u32(cenSize),u32(off),u16(0)));
  return new Blob(parts.concat(cen,[end]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function xesc(s){return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function colName(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
function xlDate(s){if(!validDate(String(s||'').slice(0,10)))return null;var p=String(s).slice(0,10).split('-').map(Number);return (Date.UTC(p[0],p[1]-1,p[2])-Date.UTC(1899,11,30))/864e5;}
var XS={head:1,date:2,money:3,pct:4,int:5,title:6};
function xCell(ref,v,t){
  if(v&&typeof v==='object'&&v.f!=null)return '<c r="'+ref+'"'+(t?' s="'+XS[t]+'"':'')+'><f>'+xesc(v.f)+'</f>'+(v.v!=null&&isFinite(v.v)?'<v>'+v.v+'</v>':'')+'</c>';
  if(v==null||v==='')return '';
  if(t==='date'){var d=xlDate(v);if(d!=null)return '<c r="'+ref+'" s="2"><v>'+d+'</v></c>';}
  if(typeof v==='number'&&isFinite(v))return '<c r="'+ref+'"'+(t&&XS[t]?' s="'+XS[t]+'"':'')+'><v>'+v+'</v></c>';
  if(typeof v==='boolean')return '<c r="'+ref+'" t="b"><v>'+(v?1:0)+'</v></c>';
  return '<c r="'+ref+'" t="inlineStr"'+(t==='head'||t==='title'?' s="'+XS[t]+'"':'')+'><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';
}
function xSheet(cols,rows,widths){ /* cols:[{h,t,w}] rows:[[v...]] */
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'+
    '<cols>'+cols.map(function(c,i){return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(c.w||14)+'" customWidth="1"/>';}).join('')+'</cols><sheetData>';
  x+='<row r="1">'+cols.map(function(c,i){return xCell(colName(i)+'1',c.h,'head');}).join('')+'</row>';
  rows.forEach(function(r,ri){var rn=ri+2;x+='<row r="'+rn+'">'+r.map(function(v,i){var t=(r.types&&r.types[i])||cols[i]&&cols[i].t;return xCell(colName(i)+rn,v,t);}).join('')+'</row>';});
  return x+'</sheetData></worksheet>';
}
function buildXlsx0(){
  var docs=Store.all(),S=[],ts=nowISO();
  var oCols=[{h:'txn_id',w:9},{h:'date',t:'date',w:11},{h:'month',w:9},{h:'account',w:24},{h:'item_id',w:9},{h:'item',w:38},{h:'orig_desc',w:26},{h:'qty',t:'int',w:8},{h:'rsp',t:'money',w:9},{h:'disc_pct',t:'pct',w:9},{h:'disc_amount',t:'money',w:12},{h:'net_unit',t:'money',w:10},{h:'net',t:'money',w:12},{h:'status',w:10},{h:'price_rule',w:18},{h:'source',w:24},{h:'notes',w:24},{h:'order_ref',w:20},{h:'created_at',w:20},{h:'updated_at',w:20}];
  var oRows=D.orders.map(function(o){var r=o._r;return [r.id,r.date,String(r.date||'').slice(0,7),r.account,r.itemId,r.item,r.origDesc,r.qty,r.rsp,r.pct,r.discAmt,r.netUnit,r.net,r.status,r.src,r.source,r.notes,r.orderRef,r.createdAt,r.updatedAt];});
  var dCols=[{h:'deal_id',w:9},{h:'account',w:22},{h:'item_id',w:9},{h:'item',w:38},{h:'orig_item',w:24},{h:'disc_pct',t:'pct',w:9},{h:'rsp',t:'money',w:9},{h:'net',t:'money',w:10},{h:'from',t:'date',w:11},{h:'to',t:'date',w:11},{h:'status',w:9},{h:'type',w:14},{h:'source',w:24},{h:'updated',t:'date',w:11},{h:'notes',w:30},{h:'extra_pct',t:'pct',w:9},{h:'bonus_pct',t:'pct',w:9}];
  var dRows=D.deals.map(function(d){var r=d._r;return [r.id,r.account,r.itemId,r.item,r.origItem,r.pct,r.rsp,r.net,r.from,r.to,r.status,r.type,r.source,r.updated,r.notes,r.extraPct,r.bonusPct];});
  var iK=['id','name','short','category','strength','form','pack','rsp','moh','wsp','price2026','std','stdNet','active','source','notes'],iT={rsp:'money',wsp:'money',price2026:'money',stdNet:'money',moh:'pct',std:'pct'};
  var aK=['id','name','type','active','territory','contact','target','aliases','notes'],mK=['desc','account','itemId','item','status','reason','date','notes'],uK=['ts','type','account','item','field','old','new','reason','by','notes'];
  function keyed(ks,list,types,wide){return {cols:ks.map(function(k){return {h:k,t:types&&types[k],w:wide&&wide[k]||14};}),rows:list.map(function(r){return ks.map(function(k){var v=r[k];return (v!=null&&typeof v==='object')?JSON.stringify(v):v;});})};}
  var audit=[];Object.keys(docs).sort().forEach(function(p){if(p.split('/')[0]==='audit')audit=audit.concat(rowsOf(docs[p]));});
  var fc=docs['plan/forecast']||{start:{year:2026,month:9},rows:[]},fs=fc.start||{year:2026,month:9},fH=[0,1,2,3].map(function(i){var m=fs.month-1+i;return MON[m%12]+' '+(fs.year+Math.floor(m/12));});
  /* Summary with SUMIFS formulas (cached values included; Excel recalculates on open) */
  var c=dataCheck(),sRows=[],ex=exec;
  function f(fm,v,t){return {f:fm,v:v,t:t};}
  sRows.push(['Exported',ts]);sRows.push(['','']);
  var kp=[['Executed net (SAR)',f('SUMIFS(Orders!M:M,Orders!N:N,"Executed")',Math.round(totalNet*1e6)/1e6),'money'],['Executed quantity',f('SUMIFS(Orders!H:H,Orders!N:N,"Executed")',totalQty),'int'],['Executed lines',f('COUNTIFS(Orders!N:N,"Executed")',ex.length),'int'],
    ['All order lines',f('COUNTA(Orders!A:A)-1',D.orders.length),'int'],['Active deals',f('COUNTIFS(Deals!K:K,"Active")',M.activeDeals),'int'],['Items',f('COUNTA(Items!A:A)-1',D.items.length),'int'],['Accounts',f('COUNTA(Accounts!A:A)-1',D.accounts.length),'int']];
  kp.forEach(function(k){var r=[k[0],k[1]];r.types=['',k[2]];sRows.push(r);});
  sRows.push(['','']);var h1=['Month','Executed net (SAR)','Executed qty','Executed lines'];h1.types=['head','head','head','head'];sRows.push(h1);
  var mq={},ml={};ex.forEach(function(o){var m=String(o.d).slice(0,7);mq[m]=(mq[m]||0)+(+o.q||0);ml[m]=(ml[m]||0)+1;});
  months.forEach(function(m){var rn=sRows.length+2,r=[m,f('SUMIFS(Orders!$M:$M,Orders!$N:$N,"Executed",Orders!$C:$C,$A'+rn+')',Math.round(monthMap[m]*1e6)/1e6),f('SUMIFS(Orders!$H:$H,Orders!$N:$N,"Executed",Orders!$C:$C,$A'+rn+')',mq[m]),f('COUNTIFS(Orders!$N:$N,"Executed",Orders!$C:$C,$A'+rn+')',ml[m])];r.types=['','money','int','int'];sRows.push(r);});
  sRows.push(['','']);var h2=['Account','Executed net (SAR)','Executed qty','Executed lines'];h2.types=['head','head','head','head'];sRows.push(h2);
  var al={};ex.forEach(function(o){al[o.a]=(al[o.a]||0)+1;});
  acctRankedList().forEach(function(a){var rn=sRows.length+2,r=[a.name,f('SUMIFS(Orders!$M:$M,Orders!$N:$N,"Executed",Orders!$D:$D,$A'+rn+')',Math.round(a.net*1e6)/1e6),f('SUMIFS(Orders!$H:$H,Orders!$N:$N,"Executed",Orders!$D:$D,$A'+rn+')',a.qty),f('COUNTIFS(Orders!$N:$N,"Executed",Orders!$D:$D,$A'+rn+')',al[a.name]||0)];r.types=['','money','int','int'];sRows.push(r);});
  sRows.push(['','']);sRows.push(['Data check',c.ok?'All checks passed':'Problem found — see the platform Data page']);
  S.push({n:'Summary',x:xSheet([{h:v42Brand().title+' — data export',w:34},{h:'Value',w:20},{h:'',w:14},{h:'',w:14}],sRows)});
  S.push({n:'Orders',x:xSheet(oCols,oRows)});S.push({n:'Deals',x:xSheet(dCols,dRows)});
  var it=keyed(iK,rowsOf(docs['master/items']),iT,{name:38,notes:30});S.push({n:'Items',x:xSheet(it.cols,it.rows)});
  var ac=keyed(aK,rowsOf(docs['master/accounts']),{target:'money'},{name:24,aliases:30,notes:30});S.push({n:'Accounts',x:xSheet(ac.cols,ac.rows)});
  var mp=keyed(mK,rowsOf(docs['master/mapping']),{date:'date'},{desc:28,item:38,reason:28});S.push({n:'Mapping',x:xSheet(mp.cols,mp.rows)});
  var au=keyed(uK,audit,null,{ts:20,type:18,reason:40,notes:30,old:20,'new':20});S.push({n:'Audit',x:xSheet(au.cols,au.rows)});
  S.push({n:'Forecast',x:xSheet([{h:'account',w:24}].concat(fH.map(function(h){return {h:h,t:'money',w:12};}),[{h:'basis',w:20},{h:'notes',w:40}]),rowsOf(fc).map(function(r){var m=r.m||[];return [r.account,m[0],m[1],m[2],m[3],r.basis,r.notes];}))});
  v42Sheets(S);
  return xlsxPackage(S);
}
function xlsxPackage(S){
  var files=[{name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
      S.map(function(s,i){return '<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';}).join('')+'</Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+
      S.map(function(s,i){return '<sheet name="'+s.n+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>';}).join('')+'</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      S.map(function(s,i){return '<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>';}).join('')+
      '<Relationship Id="rId'+(S.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'+
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
      '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'+
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'}];
  S.forEach(function(s,i){files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:s.x});});
  return zipStore(files);
}
window.__jsp={pl:{parse:plParse,resolve:plResolveLine,acct:plAcctOf},pdf:buildPdf,buildXlsx:buildXlsx,dataCheck:dataCheck,resolve:resolve,model:function(){return {orders:D.orders.length,totalNet:totalNet,totalQty:totalQty,deals:D.deals.length,audit:D.audit.length,items:D.items.length,accounts:D.accounts.length,hasItem147:!!itemById.ITM147,hasAcc19:!!acctById.ACC19};}}; /* read-only test/inspection hook */

/* ---------- live re-render: only the open view is drawn; the others redraw when you open them ---------- */
var rT=null;
var RENDER={
  dashboard:function(){renderKpis();renderRecon();drawCharts();},
  accounts:function(){renderAcctList($('acctSearch').value);if(AP.name&&!acctMap[AP.name]&&!byAcct[AP.name])AP.name=null;
    if(!AP.name){var ar=acctRankedList();if(ar.length)AP.name=ar[0].name;}if(AP.name)selectAcct(AP.name);},
  items:function(){renderItemList($('itemSearch').value);if(!IP.name||!itemMap[IP.name]){var ir=itemRankedList();IP.name=ir.length?ir[0].name:null;}selectItem(IP.name);},
  pricing:function(){renderPricing();pcShow();dcShow();},
  order:function(){recalc();if(PL.rows.length)plRender();},
  forecast:function(){fcRecalc();fmBuildSkeleton();},
  orders:function(){renderOrders();},
  data:function(){renderDataView();}
};
/* V42 engine (Eng) now lives in src/engine.js, loaded before this script. */

/* ==================== V42 views — Today, Stock, Targets, closed accounts, brand, restore ====================
   ES5, runs inside the app closure. Uses the Engine (Eng, v42_engine.js) for every calculation.
   Every write goes through commit()/mutate()/Store.put (expected updatedAt) and adds an audit row. Nothing is ever deleted. */
var V42={ctx:null,cache:{},showLapsed:false,period:'all',all:false,showClosed:false,hideClosedOrders:false,closedNames:{},brand:null,nodes:{},todayAlerts:[],
  st:{tab:'own',q:'',f:'all',limit:100,acct:'',mq:'',mt:'',mlimit:200,dirty:false,grid:{},gq:'',paste:null},
  tg:{month:'',res:null,tab:'acct',open:{},ag:{},ig:{},fx:{},notes:'',wired:false},
  rs:{name:'',docs:null,diff:null,err:'',typed:'',busy:false,msg:'',done:''},
  br:{dirty:false,logo:undefined,rendered:''},ny:{sel:{},dirty:false}};
try{var v42p=localStorage.getItem('jsp-period');if(v42p&&/^\d{4}$/.test(v42p))V42.period=v42p;}catch(e){}

/* ---------- small helpers ---------- */
function v42Ok(){return typeof Eng!=='undefined'&&Eng&&typeof Eng.ctx==='function';}
/* V44 (ADR-0010): stock entry is ON only when master/settings.stockEntry === true. The page never writes this flag. */
function v44On(){var s=Store.peek('master/settings');return !!(s&&s.stockEntry===true);}
function v42InPeriod(d){return V42.all||V42.period==='all'||String(d||'').slice(0,4)===V42.period;}
function v42Ctx(){if(!V42.ctx){V42.ctx=Eng.ctx(Store.all(),localDate());V42.cache={};}return V42.ctx;}
function v42Memo(k,fn){var c=v42Ctx();if(!Object.prototype.hasOwnProperty.call(V42.cache,k))V42.cache[k]=fn(c);return V42.cache[k];}
function v42Own(){return v42Memo('own',function(c){return Eng.ownStock(c);});}
function v42OwnMap(){return v42Memo('ownMap',function(){var m={};v42Own().rows.forEach(function(r){m[r.itemId]=r;});return m;});}
function v42Preds(){return v42Memo('pred',function(c){return Eng.predictions(c);});}
function v42Pipe(){return v42Memo('pipe',function(c){return Eng.pipeline(c);});}
function v42Alerts(){return v42Memo('alerts',function(c){return Eng.alerts(c,{lastBackup:v42LastBackup(),deals:D.deals});});}
/* The engine marks a pair 'lapsed' when it is overdue by more than max(45 days, its own interval): those are win-back leads, not reminders.
   Today's expected orders, Draft order and the alert list use overdue + due + soon only; lapsed rows have their own list. */
function v42LivePreds(){return v42Preds().rows.filter(function(p){return p.status!=='lapsed';});}
function v42LapsedRows(){return v42Preds().rows.filter(function(p){return p.status==='lapsed';});}
function v42LapsedN(){var c=v42Preds().counts;return c&&c.lapsed!=null?c.lapsed:v42LapsedRows().length;}
function v42TodayList(){
  var eng=v42Alerts(),ra={},order=[],out=[],placed=false;
  v42LivePreds().forEach(function(p){if((p.status!=='overdue'&&p.status!=='due')||p.inPipeline)return;if(!ra[p.account]){ra[p.account]={over:0,items:[]};order.push(p.account);}if(p.status==='overdue')ra[p.account].over++;ra[p.account].items.push(p.item+' x '+INT(p.qty));});
  var mine=order.map(function(a){var g=ra[a],n=g.items.length;return {sev:g.over?'warn':'info',kind:'reorder',title:a+': '+n+' reorder'+(n===1?'':'s')+(g.over?' due (overdue)':' due'),detail:g.items.slice(0,4).join(', ')+(n>4?' and '+(n-4)+' more':''),action:{type:'draft-order',arg:a}};});
  var on=v44On();
  eng.forEach(function(a){if(a.kind==='reorder'){if(!placed){placed=true;out=out.concat(mine);}return;}if(!on&&(a.kind==='stock'||a.kind==='count'))return;out.push(a);});
  if(!placed)out=out.concat(mine);
  var rank={bad:0,warn:1,info:2};return out.map(function(a,i){return [a,i];}).sort(function(x,y){return ((rank[x[0].sev]||2)-(rank[y[0].sev]||2))||(x[1]-y[1]);}).map(function(x){return x[0];});
}
function v42LastBackup(){try{return localStorage.getItem('jsp-lastBackup')||null;}catch(e){return null;}}
function v42MarkBackup(){try{localStorage.setItem('jsp-lastBackup',nowISO());}catch(e){}V42.cache={};}
function v42Clone(o){return o==null?o:JSON.parse(JSON.stringify(o));}
function v42Num(n,d){return (n==null||isNaN(n))?'—':Number(n).toLocaleString(undefined,{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}
function v42D(d){var p=String(d||'').split('-');return p.length<3?String(d||'—'):(+p[2])+' '+MON[+p[1]-1]+' '+p[0];}
function v42Chip(cls,txt){return '<span class="badge '+cls+'">'+esc(txt)+'</span>';}
function v42Err(title,e){if(window.console)console.error(e);return '<div class="card"><h3>'+esc(title)+'</h3><p class="muted">This part could not be drawn ('+esc(e&&e.message?e.message:e)+'). Your data is not affected. Reload the page; if it stays, tell Claude.</p></div>';}
function v42Block(){var m=Store.status().mode;if(m==='db'||m==='local')return '';
  return m==='starting'?'Still connecting to the database. Wait a moment and try again. Nothing was saved.':m==='empty'?'The database is empty, so saving is switched off. Load the Excel snapshot first (see the banner at the top). Nothing was saved.':'Saving is not available right now. Nothing was saved.';}
/* restore and the new-workspace wizard may write while the database is still empty (Store.restoreDoc); everything else needs db/local */
function v42BlockRestore(){var m=Store.status().mode;if(m==='db'||m==='local'||m==='empty')return '';return 'Still connecting to the database. Wait a moment and try again. Nothing was saved.';}
function v42Today(){return localDate();}
/* actual net of one month over OPEN accounts, whatever period the dashboard is set to */
function v42MonthNetAll(ym){var n=0;D.orders.forEach(function(o){if(o.s!=='Executed'||String(o.d||'').slice(0,7)!==ym)return;var a=acctMap[o.a];if(a&&!a.active)return;n+=o.net||0;});return n;}
function v42Int(s){s=String(s==null?'':s).trim().replace(/,/g,'');if(!/^-?\d+$/.test(s))return NaN;return parseInt(s,10);}
/* read-modify-write of a single (non-row) document with the optimistic check, one retry on conflict */
function v42PutDoc(path,fn){var tries=0;
  function attempt(){return Store.get(path).then(function(cur){var exp=cur?(cur.updatedAt||''):null,body=cur?v42Clone(cur):{schema:1};fn(body,cur);return Store.put(path,body,exp);})
    ['catch'](function(e){if(e&&e.code==='conflict'&&tries++<1)return attempt();throw e;});}
  return attempt();}
function v42Audit(rows){return commit([],rows);}
/* a warning that stays on screen until dismissed (partial saves must not be hidden by a success toast) */
function v42Warn(html){
  var w=$('v42Warn');
  if(!w){w=document.createElement('div');w.id='v42Warn';w.className='banner warn';w.setAttribute('role','alert');var mb=$('modeBanner');if(mb&&mb.parentNode)mb.parentNode.insertBefore(w,mb.nextSibling);else document.body.insertBefore(w,document.body.firstChild);
    w.addEventListener('click',function(e){if(e.target.closest('[data-v42wx]')&&w.parentNode){w.parentNode.removeChild(w);}});}
  w.hidden=false;w.innerHTML='<strong>Please read:</strong> '+html+' <button type="button" class="btn ghost sm" data-v42wx="1">Dismiss</button>';
}
function v42MovesDone(res,okText){if(res&&res.warn){v42Warn(esc(res.warn));toast(esc(res.warn),'warn');}else toast(okText,'good');}
function v42Wire(el,type,fn){if(el&&!el['_w'+type]){el['_w'+type]=1;el.addEventListener(type,fn);}}

/* ---------- brand ---------- */
var V42_BRD={company:'Julphar',appName:'Sales Platform',tagline:'',color:'#1f4e79',logo:null};
function v42Brand(){
  if(!V42.brand){var b=null;try{if(v42Ok()&&Eng.brand)b=Eng.brand(Store.all());}catch(e){b=null;}
    b=b||{};var o={};Object.keys(V42_BRD).forEach(function(k){o[k]=(b[k]!=null&&b[k]!=='')?b[k]:V42_BRD[k];});
    o.tagline=b.tagline||'';if(!b.logo)o.logo=null;
    o.title=o.company+' '+o.appName;o.file=String(o.company).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'Platform';V42.brand=o;}
  return V42.brand;
}
function v42Mix(hex,to,a){var n=parseInt(hex.slice(1),16),r=n>>16,g=(n>>8)&255,b=n&255,t=to==='w'?255:0;
  function m(x){return Math.round(x+(t-x)*a);}return '#'+[m(r),m(g),m(b)].map(function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
function v42ApplyBrand(){
  var b=v42Brand();if(document.title!==b.title)document.title=b.title;
  var side=(b.appName==='Sales Platform')?b.company+' Platform':b.title;
  ['brandSide','brandTop'].forEach(function(id){var e=$(id);if(e&&e.textContent!==side){e.textContent=side;e.title=b.title;}});
  var h1=$('brandH1');if(h1&&h1.textContent!==b.title)h1.textContent=b.title;
  ['dotSide','dotTop'].forEach(function(id){var e=$(id);if(!e)return;if(e._svg==null)e._svg=e.innerHTML;
    var want=(b.logo&&/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(b.logo))?b.logo:'';
    if((e._logo||'')===want)return;e._logo=want;
    if(want){e.innerHTML='<img alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">';e.firstChild.src=want;}else e.innerHTML=e._svg;});
  var st=$('brandStyle');if(!st){st=document.createElement('style');st.id='brandStyle';document.head.appendChild(st);}
  var css='',c=String(b.color||'');
  if(/^#[0-9a-fA-F]{6}$/.test(c)&&c.toLowerCase()!==V42_BRD.color)css=':root{--brand:'+c+';--brand-2:'+v42Mix(c,'w',.2)+';--brand-deep:'+v42Mix(c,'b',.55)+';--brand-tint:'+v42Mix(c,'w',.9)+';}';
  if(st.textContent!==css)st.textContent=css;
  var tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.setAttribute('content',css?v42Mix(c,'b',.55):'#122f4d');
}

/* ---------- derive helpers (called from the patched derive / renderKpis / acctRankedList) ---------- */
function v42OpenAcctN(){return D.accounts.filter(function(a){return a.active;}).length;}
function v42NetLabel(){return V42.period==='all'?'YTD Net Sales (SAR)':'Net Sales '+V42.period+' (SAR)';}
function v42ClosedNet(name){var net=0,qty=0;D.orders.forEach(function(o){if(o.a===name&&o.s==='Executed'&&v42InPeriod(o.d)){net+=o.net||0;qty+=+o.q||0;}});return {net:net,qty:qty};}
function v42Years(){var y={};D.orders.forEach(function(o){if(o.d)y[String(o.d).slice(0,4)]=1;});return Object.keys(y).sort().reverse();}
function v42FillPeriod(){
  var sel=$('periodSel');if(!sel)return;var ys=v42Years(),want=V42.period;
  if(want!=='all'&&ys.indexOf(want)<0){V42.period='all';want='all';derive(Store.all());}
  var html='<option value="all">All periods</option>'+ys.map(function(y){return '<option value="'+y+'">Year '+y+'</option>';}).join('');
  if(sel._h!==html){sel.innerHTML=html;sel._h=html;}sel.value=want;
}
function v42ScopeNote(){
  var el=$('scopeNote');if(!el)return;var t='',ex=null;
  try{ex=Eng.scope(v42Ctx(),{period:V42.period}).excluded;}catch(e){ex=null;}
  if(!ex){var names=Object.keys(V42.closedNames),net=0;names.forEach(function(n){net+=v42ClosedNet(n).net;});ex={accounts:names,net:net};}
  if(V42.period!=='all')t+='Showing year '+esc(V42.period)+' only. ';
  if(ex.accounts&&ex.accounts.length)t+='Excludes '+ex.accounts.length+' closed account'+(ex.accounts.length===1?'':'s')+': '+SAR(ex.net)+' SAR. ';
  if(t)t+='The Data check below still covers every order line.';
  el.textContent=t;
}
function v42WireDashboard(){
  var sel=$('periodSel');v42Wire(sel,'change',function(){
    V42.period=sel.value;try{localStorage.setItem('jsp-period',V42.period);}catch(e){}
    derive(Store.all());refreshSelects();v42Common();RENDER.dashboard();toast(V42.period==='all'?'Showing all periods':'Showing year '+esc(V42.period),'good');});
}

/* ---------- called on every render ---------- */
function v42Common(){
  if(!v42Ok())return;
  try{v42ApplyBrand();v42FillPeriod();v42WireDashboard();v42ClosedToggle();renderKpis();if(curView()==='dashboard')v42ScopeNote();}catch(e){if(window.console)console.error(e);}
}

/* ==================== Order builder: stock hints + saved card ==================== */
function v42Hints(){
  if(!v42Ok()||!lines)return;
  if(!v44On()){Array.prototype.forEach.call(lines.querySelectorAll('.stk-hint'),function(h){h.textContent='';h.className='stk-hint';});return;}
  var m=null;try{m=v42OwnMap();}catch(e){m=null;}
  Array.prototype.forEach.call(lines.querySelectorAll('.line'),function(row){
    var hint=row.querySelector('.stk-hint');if(!hint)return;
    var item=row.querySelector('.li-item').value.trim(),qty=parseFloat(row.querySelector('.li-qty').value),im=itemMap[item],r=(m&&im)?m[im.id]:null;
    if(!r||!r.tracked){hint.textContent='';hint.className='stk-hint';return;}
    var av=r.available,t,warn=false;
    if(r.onHand<0){t='Stock: the count looks wrong (on hand is negative). Do a count in Stock.';warn=true;}
    else if(isFinite(qty)&&qty>0){if(qty>av){t='Stock: short by '+INT(qty-Math.max(av,0))+' (available '+INT(av)+')';warn=true;}else t='Stock: available '+INT(av)+' · '+INT(av-qty)+' left after this order';}
    else t='Stock: available '+INT(av);
    hint.textContent=t;hint.className='stk-hint'+(warn?' warn':'');
  });
}
function v42SavedStock(o){
  try{if(!v42Ok()||!v44On())return '';var c=Eng.ctx(Store.all(),localDate()),os=Eng.ownStock(c),by={};os.rows.forEach(function(r){by[r.itemId]=r;});
    var rows=[];o.lines.forEach(function(l){var im=itemMap[l.item],r=im?by[im.id]:null;if(r&&r.tracked)rows.push([l.item,r]);});
    if(!rows.length)return '';
    return '<div class="stk-after" id="spStock"><strong>Stock after this order</strong><div class="scroll"><table class="sv-tbl"><thead><tr><th>Item</th><th class="num">On hand</th><th class="num">Available</th></tr></thead><tbody>'+
      rows.map(function(x){return '<tr><td>'+esc(shortItem(x[0]))+'</td><td class="num">'+INT(x[1].onHand)+'</td><td class="num">'+INT(x[1].available)+'</td></tr>';}).join('')+'</tbody></table></div><div class="note">Executed orders reduce what is on hand; Pending and Quoted orders are reserved.</div></div>';
  }catch(e){return '';}
}

/* ==================== TODAY ==================== */
function v42Tile(id,label,val,sub,cls){return '<div class="kpi'+(cls?' '+cls:'')+'" id="'+id+'"><div class="k-label">'+esc(label)+'</div><div class="k-val sm">'+val+'</div><div class="k-sub">'+sub+'</div></div>';}
var V42_SEV={bad:['b-bad','Urgent'],warn:['b-review','Check'],info:['b-std','Note']};
var V42_ACT={receive:'Receive stock',count:'Count','draft-order':'Draft order','open-orders':'Open orders','open-pricing':'Open pricing','open-targets':'Open targets',backup:'Download backup'};
var V42_KIND_ACT={stock:'receive',reorder:'draft-order',pipeline:'open-orders',deal:'open-pricing',target:'open-targets',backup:'backup',count:'count'};
function v42ActType(a){var t=a.action&&a.action.type;return V42_ACT[t]?t:(V42_KIND_ACT[a.kind]||'');}
function renderToday(){
  var el=$('todayBody');if(!el)return;
  if(!v42Ok()){el.innerHTML='<div class="card"><p class="muted">The planning engine did not load. Reload the page.</p></div>';return;}
  try{
    var b=v42Brand(),now=new Date(),hr=now.getHours(),name=(document.querySelector('.u-name')||{}).textContent||'';
    var eb=$('tdEyebrow'),hi=$('tdHello'),dd=$('tdDate');
    if(eb)eb.textContent=b.title;if(hi)hi.textContent=(hr<12?'Good morning':hr<18?'Good afternoon':'Good evening')+(name?', '+name:'');
    if(dd)dd.textContent=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]+' '+now.getDate()+' '+MONL[now.getMonth()]+' '+now.getFullYear()+(b.tagline?' · '+b.tagline:'');
    var c=v42Ctx(),own=v42Own(),preds=v42Preds(),pipe=v42Pipe(),al=v42TodayList(),cm=v42Today().slice(0,7),tdoc=Store.peek('targets/'+cm),prog=null;
    if(tdoc){try{prog=Eng.targetProgress(c,tdoc);}catch(e){prog=null;}}
    var live=v42LivePreds(),due=live.filter(function(p){return (p.status==='overdue'||p.status==='due')&&!p.inPipeline;}),dAcc={},dVal=0;due.forEach(function(p){dAcc[p.account]=1;dVal+=p.value||0;});
    var sm=own.summary||{},attn=(sm.out||0)+(sm.short||0)+(sm.low||0)+(sm.negative||0);
    var stSta={ahead:'ahead of pace',behind:'behind pace','on track':'on track'};
    var tiles=[
      prog?v42Tile('tdMonth','This month · '+MON[+cm.slice(5,7)-1]+' '+cm.slice(0,4),K(prog.actual)+' SAR','of '+K(prog.total)+' SAR target · '+PCT(prog.pct)+(stSta[prog.status]?' · '+stSta[prog.status]:''))
           :v42Tile('tdMonth','This month · '+MON[+cm.slice(5,7)-1]+' '+cm.slice(0,4),K(v42MonthNetAll(cm))+' SAR','No target set · <a href="#" data-tdgo="targets">set one</a>'),
      v42Tile('tdPipe','Open orders (pipeline)',K(pipe.net||0)+' SAR',INT(pipe.groups.length)+' order'+(pipe.groups.length===1?'':'s')+' · '+INT(pipe.qty)+' unit'+(pipe.qty===1?'':'s')+' · pending or quoted'),
      v42Tile('tdDue','Reorders due',INT(Object.keys(dAcc).length)+' account'+(Object.keys(dAcc).length===1?'':'s'),INT(due.length)+' item'+(due.length===1?'':'s')+' · about '+K(dVal)+' SAR'),
      !v44On()?'':sm.tracked?v42Tile('tdStk','Stock alerts',INT(attn)+' item'+(attn===1?'':'s'),INT(sm.out||0)+' out · '+INT(sm.short||0)+' short · '+INT(sm.low||0)+' low'+(sm.negative?' · '+sm.negative+' to recount':''),attn?'k-warn':'')
               :v42Tile('tdStk','Stock alerts','Not set up','<a href="#" data-tdgo="setup">Start tracking stock</a>')
    ];
    var h='<div class="kpis">'+tiles.join('')+'</div>';
    V42.todayAlerts=al;
    h+='<div class="card" style="margin-bottom:14px"><h3>Needs your attention <span class="tag">'+al.length+' item'+(al.length===1?'':'s')+'</span></h3>';
    if(!al.length)h+='<p class="muted" style="margin:0">Nothing needs attention right now.</p>';
    else h+='<ul class="al-list">'+al.map(function(a,i){var sv=V42_SEV[a.sev]||V42_SEV.info,t=v42ActType(a),lab=(a.action&&a.action.label)||V42_ACT[t]||'';
      return '<li class="al al-'+esc(a.sev||'info')+'"><div class="al-main"><div class="al-t">'+v42Chip(sv[0],sv[1])+' <strong>'+esc(a.title)+'</strong></div><div class="al-d">'+esc(a.detail||'')+'</div></div>'+(lab?'<button type="button" class="btn ghost sm" data-tdact="'+i+'">'+esc(lab)+'</button>':'')+'</li>';}).join('')+'</ul>';
    h+='<div class="note" id="tdNote" role="status" aria-live="polite"></div></div>';
    /* expected orders, next 14 days, grouped by account */
    var soon=live.filter(function(p){return p.daysTo<=14;}),g={},order=[];
    soon.forEach(function(p){if(!g[p.account]){g[p.account]={a:p.account,rows:[],min:null,val:0,open:0};order.push(p.account);}var x=g[p.account];x.rows.push(p);if(!p.inPipeline){x.open++;x.min=x.min==null?p.daysTo:Math.min(x.min,p.daysTo);x.val+=p.value||0;}});
    order.forEach(function(a){if(g[a].min==null)g[a].min=Math.min.apply(null,g[a].rows.map(function(p){return p.daysTo;}));});
    order.sort(function(x,y){return (g[x].open?0:1)-(g[y].open?0:1)||g[x].min-g[y].min||x.localeCompare(y);});
    h+='<div class="card"><h3>Expected orders · next 14 days <span class="tag">from each account’s own ordering rhythm</span></h3>';
    if(!order.length)h+='<p class="muted" style="margin:0">No account is expected to reorder in the next 14 days'+(preds.dormant?' ('+preds.dormant+' older item(s) are treated as dormant)':'')+'.</p>';
    else h+=order.map(function(a){var x=g[a],cls=!x.open?'b-good':x.min<0?'b-bad':x.min<=7?'b-review':'b-std',lab=!x.open?'All in pipeline':x.min<0?'Overdue':x.min<=7?'Due soon':'Coming up';
      return '<div class="ex-acct"><div class="ex-head"><div><strong>'+esc(a)+'</strong> '+v42Chip(cls,lab)+'<div class="muted" style="font-size:12px">'+x.rows.length+' item'+(x.rows.length===1?'':'s')+(x.open?' · about '+SAR(x.val)+' SAR':' · already in Pending or Quoted orders')+'</div></div>'+
        (x.open?'<button type="button" class="btn sm" data-tddraft="'+esc(a)+'" aria-label="Draft an order for '+esc(a)+'">Draft order</button>':'')+'</div>'+
        '<div class="scroll"><table><thead><tr><th>Item</th><th class="num">Usual qty</th><th>Expected</th><th>Based on</th></tr></thead><tbody>'+
        x.rows.map(function(p){return '<tr><td>'+esc(shortItem(p.item))+'</td><td class="num">'+INT(p.qty)+'</td><td>'+(p.inPipeline?'<span class="badge b-good">In pipeline</span> <span class="muted">('+INT(p.pipelineQty)+')</span>':p.daysTo<0?'<span class="badge b-bad">'+(-p.daysTo)+' day'+(p.daysTo===-1?'':'s')+' late</span>':p.daysTo===0?'today':'in '+p.daysTo+' day'+(p.daysTo===1?'':'s'))+(p.inPipeline?'':' <span class="muted">('+esc(v42D(p.nextDate))+')</span>')+'</td><td class="muted" style="font-size:12px">'+esc(p.basis||'')+'</td></tr>';}).join('')+'</tbody></table></div></div>';}).join('')+'<div class="note">“Draft order” fills the New order page with these items as Pending. It never saves by itself — you review and press Save.</div>';
    h+='</div>';
    var lap=v42LapsedN();
    if(lap){
      h+='<div class="card" style="margin-top:14px"><h3>Lapsed (win back): '+lap+' <span class="tag">overdue by more than 45 days and by more than their usual interval</span></h3>'+
        '<p class="muted" style="margin:0 0 8px;font-size:13px">These are not counted as due and never go into a draft order. Use them as a follow-up list: has the account stopped buying this item?</p>'+
        '<button type="button" class="btn ghost sm" data-tdlapsed="1" aria-expanded="'+(!!V42.showLapsed)+'">'+(V42.showLapsed?'Hide the list':'Show the '+lap+' lapsed item'+(lap===1?'':'s'))+'</button>';
      if(V42.showLapsed){
        var lr=v42LapsedRows().slice().sort(function(a,b){return String(a.account).localeCompare(String(b.account))||(a.lastDate<b.lastDate?1:a.lastDate>b.lastDate?-1:0)||String(a.item).localeCompare(String(b.item));});
        h+='<div class="scroll" style="max-height:420px;margin-top:10px"><table><thead><tr><th>Account</th><th>Item</th><th>Last order</th><th class="num">Usual qty</th><th class="num">Days since due</th></tr></thead><tbody>'+
          lr.map(function(p){return '<tr><td>'+esc(p.account)+'</td><td>'+esc(shortItem(p.item))+'</td><td>'+esc(v42D(p.lastDate))+'</td><td class="num">'+INT(p.qty)+'</td><td class="num">'+(-p.daysTo)+'</td></tr>';}).join('')+'</tbody></table></div>';
      }
      h+='</div>';
    }
    el.innerHTML=h;
  }catch(e){el.innerHTML=v42Err('Today',e);}
}
function v42Draft(account){
  if(!v42Ok())return;var all14=v42LivePreds().filter(function(p){return p.account===account&&p.daysTo<=14;}),rows=all14.filter(function(p){return !p.inPipeline;});
  if(!rows.length){toast(all14.length?'Everything expected for '+esc(account)+' is already in a Pending or Quoted order.':'Nothing is expected for '+esc(account)+' in the next 14 days.','warn');return;}
  show('order');obAccount.value=account;
  if(obAccount.value!==account){toast(esc(account)+' is closed or missing, so no draft was made.','warn');return;}
  $('obStatus').value='Pending';$('obDate').value=localDate();$('obNotes').value='';lines.innerHTML='';
  var skipped=[],n=0;
  rows.forEach(function(p){var im=itemById[p.itemId];if(!im||im.active===false){skipped.push(p.item);return;}addLine(im.name,Math.max(1,Math.round(p.qty)));n++;});
  if(!n)addLine();recalc();var sp=$('savedPanel');if(sp)sp.hidden=true;
  setMsg('reqNote','b-review','Draft from expected orders: '+n+' line(s) for <strong>'+esc(account)+'</strong>, status Pending. Review the quantities, then press Save order. <strong>Nothing is saved yet.</strong>'+(skipped.length?' Left out (inactive item): '+esc(skipped.join(', '))+'.':''));
  toast('Draft ready — review and save','good');window.scrollTo(0,0);
}
function v42TodayAction(a){
  var t=v42ActType(a),arg=a.action?a.action.arg:null;
  if(t==='draft-order'&&arg)return v42Draft(arg);
  if(t==='receive'||t==='count'){
    if(arg&&itemById[arg]){V42.st.tab='own';return v42MoveDlg(t==='count'?'count':'receive',arg);}
    V42.st.tab='own';return show('stock');}
  if(t==='open-orders'){OV.q='';OV.month='';OV.status='';OV.acct=(arg&&acctMap[arg])?arg:'';if(arg&&!OV.acct)OV.q=String(arg);show('orders');return;}
  if(t==='open-pricing'){if(arg&&acctMap[arg]){show('pricing');var pa=$('prAccount');pa.value=arg;pa.dispatchEvent(new Event('change'));}else show('pricing');return;}
  if(t==='open-targets'){if(arg&&/^\d{4}-\d{2}$/.test(arg))V42.tg.month=arg;show('targets');return;}
  if(t==='backup'){return v42Backup('tdNote');}
}
function v42Backup(noteId){
  var payload=v42Payload();
  saveBlob(v42Brand().file+'_Backup_'+localDate()+'.json',new Blob([JSON.stringify(payload,null,1)],{type:'application/json'}),noteId,function(){v42MarkBackup();if(curView()==='today')renderToday();});
}
function v42Payload(){return {app:v42Brand().title,schema:1,exportedAt:nowISO(),mode:Store.status().mode,docs:Store.all()};}
function v42WireToday(){
  var el=$('todayBody');v42Wire(el,'click',function(e){
    var a=e.target.closest('[data-tdact]');if(a){var al=V42.todayAlerts[+a.dataset.tdact];if(al)v42TodayAction(al);return;}
    a=e.target.closest('[data-tddraft]');if(a){v42Draft(a.dataset.tddraft);return;}
    a=e.target.closest('[data-tdlapsed]');if(a){V42.showLapsed=!V42.showLapsed;renderToday();return;}
    a=e.target.closest('[data-tdgo]');if(a){e.preventDefault();if(a.dataset.tdgo==='setup')V42.st.tab='setup';show(a.dataset.tdgo==='setup'?'stock':a.dataset.tdgo);}
  });
}

/* ==================== STOCK ==================== */
var V42_STAT={ok:['b-good','OK'],low:['b-review','Low'],short:['b-review','Will run short'],out:['b-bad','Out of stock'],negative:['b-bad','Recount needed'],untracked:['b-off','Not tracked']};
var V42_SORT={negative:0,out:1,short:2,low:3,ok:4,untracked:5};
function v42StChip(s){var m=V42_STAT[s]||['b-off',s];return v42Chip(m[0],m[1]);}
function v42ItemShort(n){return shortItem(n);}

/* ---- write: movements (one stock doc write + one audit write) ---- */
function v42WriteMoves(newRows,forcePath){
  var blk=v42Block();if(blk)return Promise.reject(new Error(blk));
  if(!newRows.length)return Promise.reject(new Error('Nothing to save.'));
  var ts=nowISO(),today=localDate(),ym=today.slice(0,7),made=[],i;
  for(i=0;i<newRows.length;i++){var e=Eng.validateMove({type:newRows[i].type,scope:newRows[i].scope,itemId:newRows[i].itemId,item:newRows[i].item,qty:newRows[i].qty,notes:newRows[i].notes,account:newRows[i].account,accountId:newRows[i].accountId,date:newRows[i].date||today,ts:ts,id:'SM00000',by:'owner'});if(e)return Promise.reject(new Error(e));}
  var path=forcePath||Eng.stockPath(Store.peek,ym);
  return mutate(path,function(b){
    made=[];var c=Eng.ctx(Store.all(),today),extra=b.rows.slice();
    newRows.forEach(function(r){var id=Eng.nextMoveId(c,extra),row={id:id,ts:ts,date:r.date||today,type:r.type,scope:r.scope,account:r.account||null,accountId:r.accountId||null,itemId:r.itemId,item:r.item,qty:r.qty,notes:r.notes||null,by:'owner'};extra.push(row);made.push(row);b.rows.push(row);});
  }).then(function(){
    V42.ctx=null;
    var aud=made.map(function(m){return auditRow('STOCK_'+m.type,m.account||'',m.item,'qty','',m.qty,m.notes||'',m.id+' · '+(m.scope==='own'?'warehouse':'account stock'));});
    /* history rows go in groups of 100, so a big import never loses all of them at once if the history page is nearly full */
    var chunks=[],k,wrote=0,failure=null,seq=Promise.resolve();
    for(k=0;k<aud.length;k+=100)chunks.push(aud.slice(k,k+100));
    chunks.forEach(function(ch){seq=seq.then(function(){if(failure)return;return mutate(auditPath(),function(b){b.rows=b.rows.concat(ch);}).then(function(){wrote+=ch.length;},function(e){failure=e;});});});
    return seq.then(function(){return {rows:made,warn:failure?'Stock saved, but '+(aud.length-wrote)+' history row'+(aud.length-wrote===1?'':'s')+' could not be written — '+errText(failure)+' The quantities are recorded; there is nothing to enter again.':''};});
  });
}
function v42SaveConfig(vals,startedNow){
  var blk=v42Block();if(blk)return Promise.reject(new Error(blk));
  var old=v42Ctx().config||{},changes=[];
  return v42PutDoc('stock/config',function(b){
    ['leadDays','lowCoverDays','horizonDays','reserveQuoted'].forEach(function(k){if(vals[k]!==undefined&&b[k]!==vals[k]){changes.push(k+' '+(b[k]==null?old[k]:b[k])+' → '+vals[k]);b[k]=vals[k];}});
    if(startedNow&&!b.startedAt){b.startedAt=nowISO();changes.push('stock tracking started');}
    if(b.startedAt===undefined)b.startedAt=null;
    ['leadDays','lowCoverDays','horizonDays','reserveQuoted'].forEach(function(k){if(b[k]===undefined)b[k]=old[k];});
  }).then(function(){if(changes.length)return v42Audit([auditRow('STOCK_CONFIG','','','config','',changes.join('; '),'','stock/config')]);}).then(function(){V42.ctx=null;});
}

/* ---- dialogs: receive / count / adjust (one item, warehouse) ---- */
function v42MoveDlg(kind,itemId){
  var blk=v42Block();if(blk){toast(esc(blk),'warn');return;}
  var im=itemById[itemId];if(!im){toast('That item was not found.','warn');return;}
  var r=v42OwnMap()[itemId]||{},tracked=!!r.tracked,name=im.name;
  if((kind==='receive'||kind==='adjust')&&!tracked){toast('This item is not tracked yet. First type its opening number in My stock.','warn');return;}
  var head='<p class="note" style="margin-top:0"><strong>'+esc(name)+'</strong><br>'+(tracked?'On hand now <strong>'+INT(r.onHand)+'</strong> · reserved '+INT(r.reserved)+' · available '+INT(r.available):'Not tracked yet.')+'</p>';
  if(kind==='receive'){
    openDialog({title:'Receive stock',ok:'Save receipt',html:head+fld('mQty','Quantity received (whole number)','',{type:'number',mode:'numeric'})+fld('mDate','Date received',v42Today(),{type:'date'})+fld('mNote','Note (optional, e.g. delivery note number)','',{max:160})+'<div class="note" id="mPrev" aria-live="polite"></div>',
      onInput:function(md){var q=v42Int(fv(md,'mQty'));md.querySelector('#mPrev').textContent=(q>0)?'On hand will be '+INT((r.onHand||0)+q)+'.':'';},
      onOk:function(md){var q=v42Int(fv(md,'mQty')),dt=fv(md,'mDate'),nt=fv(md,'mNote').slice(0,160);
        if(!(q>=1&&q<=10000000))return 'Enter the quantity as a whole number, 1 or more.';
        if(!validDate(dt))return 'Enter a valid date.';if(dt>v42Today())return 'The received date cannot be in the future.';
        return v42WriteMoves([{type:'RECEIPT',scope:'own',itemId:itemId,item:name,qty:q,date:dt,notes:nt||null}]).then(function(res){v42MovesDone(res,'Received '+INT(q)+' · '+esc(v42ItemShort(name)));});}});
  }else if(kind==='count'){
    openDialog({title:tracked?'Count stock':'Start tracking this item',ok:tracked?'Save count':'Save opening quantity',
      html:head+fld('mQty',tracked?'Counted now (what is on the shelf)':'Opening quantity (what is on the shelf now)','',{type:'number',mode:'numeric'})+fld('mNote','Note (optional)','',{max:160})+
        (tracked?'':'<p class="note">Stock for this item starts from this count. Orders saved before now are not deducted.</p>')+'<div class="note" id="mPrev" aria-live="polite"></div>',
      onInput:function(md){var q=v42Int(fv(md,'mQty'));md.querySelector('#mPrev').textContent=(q>=0&&tracked)?'System said '+INT(r.onHand)+'; difference '+(q-r.onHand>=0?'+':'')+INT(q-r.onHand)+'.':'';},
      onOk:function(md){var q=v42Int(fv(md,'mQty')),nt=fv(md,'mNote').slice(0,160);
        if(!(q>=0&&q<=10000000))return 'Enter the count as a whole number, 0 or more.';
        return v42WriteMoves([{type:tracked?'COUNT':'OPEN',scope:'own',itemId:itemId,item:name,qty:q,notes:nt||(tracked?'System said '+r.onHand:null)}]).then(function(res){v42MovesDone(res,(tracked?'Count saved':'Opening quantity saved')+' · '+INT(q)+' · '+esc(v42ItemShort(name)));});}});
  }else{
    openDialog({title:'Adjust stock',ok:'Save adjustment',
      html:head+fld('mQty','Change (use a minus sign to remove, e.g. -20)','',{type:'number',mode:'numeric'})+fld('mWhy','Reason',['Damaged or expired','Customer return','Correction','Other'][0],{options:['Damaged or expired','Customer return','Correction','Other']})+fld('mNote','Details (required if Other)','',{max:160})+'<div class="note" id="mPrev" aria-live="polite"></div>',
      onInput:function(md){var q=v42Int(fv(md,'mQty'));md.querySelector('#mPrev').textContent=(isFinite(q)&&q!==0)?'On hand will be '+INT((r.onHand||0)+q)+'.':'';},
      onOk:function(md){var q=v42Int(fv(md,'mQty')),why=fv(md,'mWhy'),nt=fv(md,'mNote').slice(0,160);
        if(!(isFinite(q)&&q!==0&&Math.abs(q)<=10000000))return 'Enter a whole number that is not zero (minus removes stock).';
        if(why==='Other'&&!nt)return 'Please write the reason in Details.';
        return v42WriteMoves([{type:'ADJUST',scope:'own',itemId:itemId,item:name,qty:q,notes:why+(nt?' — '+nt:'')}]).then(function(res){v42MovesDone(res,'Adjustment saved · '+(q>0?'+':'')+INT(q));});}});
  }
}
/* ---- dialog: record a count for one account (grid, blank = skip, one doc write) ---- */
function v42AcctCountDlg(account){
  var blk=v42Block();if(blk){toast(esc(blk),'warn');return;}
  var a=acctMap[account];if(!a||!a.active){toast('That account is closed.','warn');return;}
  var rows=Eng.acctStock(v42Ctx(),account).rows;
  if(!rows.length){toast('This account has no order history to count against yet.','warn');return;}
  openDialog({title:'Count at '+account,ok:'Save counts',
    html:'<p class="note" style="margin-top:0">Type what the customer has on the shelf now. Leave a row empty to skip it. Stock at the customer starts from the count; later deliveries are added to it.</p><div class="scroll" style="max-height:50vh"><table><thead><tr><th>Item</th><th class="num">Estimated now</th><th class="num">Counted</th></tr></thead><tbody>'+
      rows.map(function(r,i){return '<tr><td>'+esc(v42ItemShort(r.item))+'</td><td class="num">'+(r.tracked?INT(Math.round(r.estOnHand)):'<span class="muted">not counted</span>')+'</td><td class="num"><input class="ac-in" data-i="'+i+'" type="number" min="0" step="1" inputmode="numeric" style="width:90px" aria-label="Counted quantity of '+esc(r.item)+'"></td></tr>';}).join('')+'</tbody></table></div>',
    onOk:function(md){
      var out=[],bad='';Array.prototype.forEach.call(md.querySelectorAll('.ac-in'),function(inp){var v=String(inp.value).trim();if(v==='')return;var q=v42Int(v),r=rows[+inp.dataset.i];
        if(!(q>=0&&q<=10000000)){bad=bad||('Check the count for '+r.item+': whole number, 0 or more.');return;}
        out.push({type:r.tracked?'COUNT':'OPEN',scope:'acct',account:account,accountId:a.id,itemId:r.itemId,item:r.item,qty:q});});
      if(bad)return bad;if(!out.length)return 'Type at least one count (or Cancel).';
      return v42WriteMoves(out).then(function(res){v42MovesDone(res,out.length+' count'+(out.length===1?'':'s')+' saved for '+esc(account));});}});
}

/* ---- render ---- */
function v42StockTabs(){var t=[['own','My stock'],['acct','Account stock'],['moves','Movements'],['setup','Set up']];
  return '<div class="tabs" role="tablist" aria-label="Stock sections">'+t.map(function(x){return '<button type="button" role="tab" data-sttab="'+x[0]+'" aria-selected="'+(V42.st.tab===x[0])+'" aria-current="'+(V42.st.tab===x[0])+'">'+x[1]+'</button>';}).join('')+'</div>';}
function renderStock(){
  var el=$('stockBody');if(!el)return;
  if(!v42Ok()){el.innerHTML='<div class="card"><p class="muted">The planning engine did not load. Reload the page.</p></div>';return;}
  var S=V42.st;if(S.tab==='setup'&&S.dirty&&el.querySelector('#suList'))return; /* keep what is being typed */
  try{
    var h=v42StockTabs();
    if(S.tab==='own')h+=v42StockOwn();else if(S.tab==='acct')h+=v42StockAcct();else if(S.tab==='moves')h+=v42StockMoves();else h+=v42StockSetup();
    el.innerHTML=h;
    if(S.tab==='own')v42OwnList();else if(S.tab==='acct')v42AcctList();else if(S.tab==='moves')v42MovesList();else v42SetupList();
  }catch(e){el.innerHTML=v42StockTabs()+v42Err('Stock',e);}
}
function v42StockOwn(){
  var sm=v42Own().summary||{},S=V42.st;
  var chips=[['all','All',null],['attention','Needs attention',(sm.out||0)+(sm.short||0)+(sm.low||0)+(sm.negative||0)],['out','Out',sm.out],['short','Short',sm.short],['low','Low',sm.low],['ok','OK',sm.ok],['untracked','Not tracked',sm.untracked]];
  return '<div class="card" style="margin-bottom:14px"><div class="st-chips" role="group" aria-label="Filter by status">'+chips.map(function(c){return '<button type="button" class="st-chip" data-stf="'+c[0]+'" aria-pressed="'+(S.f===c[0])+'">'+c[1]+(c[2]!=null?' <span class="n">'+INT(c[2])+'</span>':'')+'</button>';}).join('')+'</div>'+
    '<div class="field" style="margin:10px 0 0"><label for="stQ">Search items</label><input id="stQ" placeholder="Item name…" autocomplete="off" value="'+esc(S.q)+'"></div>'+
    (sm.tracked?'':'<div class="note"><strong>No item is tracked yet.</strong> Open <button type="button" class="btn ghost sm" data-sttab="setup">Set up</button> to enter your opening quantities. Until then nothing is deducted and nothing shows as zero.</div>')+'</div>'+
    '<div class="card"><div id="stList"></div></div>';
}
function v42OwnList(){
  var el=$('stList');if(!el)return;var S=V42.st,q=S.q.trim().toLowerCase(),cfg=v42Ctx().config||{},rows=v42Own().rows.filter(function(r){
    if(q&&String(r.item).toLowerCase().indexOf(q)<0)return false;
    if(S.f==='all')return true;if(S.f==='attention')return r.status==='out'||r.status==='short'||r.status==='low'||r.status==='negative';return r.status===S.f;});
  rows.sort(function(a,b){return (V42_SORT[a.status]-V42_SORT[b.status])||String(a.item).localeCompare(String(b.item));});
  var shown=rows.slice(0,S.limit);
  var hasFc={};v42Preds().rows.forEach(function(p){if(p.status!=='lapsed'&&p.confidence!=='low')hasFc[p.itemId]=1;}); /* a number only where the engine had a medium/high forecast; otherwise a dash, never a made-up 0 */
  if(!rows.length){el.innerHTML='<p class="muted" style="margin:0">'+(S.f==='all'&&!q?'No items.':'No items match this filter.')+'</p>';return;}
  el.innerHTML='<div class="pr-status" role="status" aria-live="polite">Showing <strong>'+shown.length+'</strong> of '+rows.length+' item'+(rows.length===1?'':'s')+'</div><div class="scroll"><table class="st-table"><thead><tr><th>Item</th><th class="num">On hand</th><th class="num">Reserved</th><th class="num">Available</th><th class="num">Daily use</th><th class="num">Cover (days)</th><th class="num">Expected '+(cfg.horizonDays||30)+'d</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>'+
    shown.map(function(r){var nm=esc(v42ItemShort(r.item)),lab=esc(r.item);
      var nums=r.tracked?'<td class="num">'+INT(r.onHand)+'</td><td class="num">'+INT(r.reserved)+'</td><td class="num"><strong>'+INT(r.available)+'</strong></td><td class="num">'+(r.dailyUse==null?'<span class="muted" title="No recent sales to estimate">—</span>':v42Num(r.dailyUse,1))+'</td><td class="num">'+(r.coverDays==null?'<span class="muted">—</span>':INT(r.coverDays))+'</td><td class="num">'+(r.expected!=null&&hasFc[r.itemId]?INT(r.expected):'<span class="muted" title="no reliable forecast">—</span>')+'</td>'
        :'<td colspan="6" class="muted">Not tracked — no opening count yet</td>';
      var act=r.tracked?'<button type="button" class="btn ghost sm" data-stact="receive" data-item="'+esc(r.itemId)+'" aria-label="Receive stock for '+lab+'">Receive</button><button type="button" class="btn ghost sm" data-stact="count" data-item="'+esc(r.itemId)+'" aria-label="Count '+lab+'">Count</button><button type="button" class="btn ghost sm" data-stact="adjust" data-item="'+esc(r.itemId)+'" aria-label="Adjust '+lab+'">Adjust</button>'
        :'<button type="button" class="btn ghost sm" data-stact="count" data-item="'+esc(r.itemId)+'" aria-label="Set opening count for '+lab+'">Set opening count</button>';
      return '<tr><td title="'+lab+'">'+nm+'</td>'+nums+'<td>'+v42StChip(r.status)+'</td><td class="ord-act">'+act+'</td></tr>';}).join('')+'</tbody></table></div>'+
    (rows.length>shown.length?'<div class="note">Showing '+shown.length+' of '+rows.length+' · <button type="button" class="btn ghost sm" data-stmore="1">Show 100 more</button></div>':'')+
    '<div class="note">On hand = counted quantity + receipts and adjustments − orders executed since the count. Reserved = Pending and Quoted orders saved here. Cover = available ÷ average daily use over the last 90 days.</div>';
}
function v42StockAcct(){
  var S=V42.st,open=D.accounts.filter(function(a){return a.active;}).map(function(a){return a.name;}).sort(function(a,b){return a.localeCompare(b);});
  if(!S.acct||open.indexOf(S.acct)<0)S.acct=open[0]||'';
  return '<div class="card" style="margin-bottom:14px"><div class="grid g-2b"><div class="field" style="margin:0"><label for="stAcct">Account</label><select id="stAcct">'+open.map(function(n){return '<option value="'+esc(n)+'"'+(n===S.acct?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></div>'+
    '<div style="align-self:end"><button type="button" class="btn" data-stacct="count">Record a count</button></div></div><div class="note">What each customer probably has on their shelf: their last count, plus what we delivered since, minus their usual use. It is an estimate until you count.</div></div><div class="card"><div id="saList"></div></div>';
}
function v42AcctList(){
  var el=$('saList');if(!el)return;var name=V42.st.acct;if(!name){el.innerHTML='<p class="muted" style="margin:0">No open accounts.</p>';return;}
  var rows=Eng.acctStock(v42Ctx(),name).rows,next={};v42Preds().rows.forEach(function(p){if(p.account===name)next[p.itemId]=p;});
  if(!rows.length){el.innerHTML='<p class="muted" style="margin:0">'+esc(name)+' has no executed orders and no counts yet.</p>';return;}
  rows.sort(function(a,b){return (b.tracked-a.tracked)||String(a.item).localeCompare(String(b.item));});
  el.innerHTML='<div class="scroll"><table class="st-table"><thead><tr><th>Item</th><th>Last count</th><th class="num">Delivered since</th><th class="num">Est. on hand</th><th>Run-out date</th><th>Next order</th></tr></thead><tbody>'+
    rows.map(function(r){var p=next[r.itemId],no=p?(p.daysTo<0?'<span class="badge b-bad">'+(-p.daysTo)+'d late</span>':v42D(p.nextDate)):'<span class="muted">—</span>';
      if(!r.tracked)return '<tr><td>'+esc(v42ItemShort(r.item))+'</td><td colspan="4" class="muted">Not counted yet'+(r.dailyUse&&!r.estimated?' · uses about '+v42Num(r.dailyUse,1)+' a day':'')+'</td><td>'+no+'</td></tr>';
      return '<tr><td>'+esc(v42ItemShort(r.item))+'</td><td>'+esc(v42D(String(r.baseTs||'').slice(0,10)))+'</td><td class="num">'+INT(r.delivered)+'</td><td class="num"><strong>'+INT(Math.round(r.estOnHand))+'</strong>'+(r.dailyUse==null?' <span class="muted" title="No usage data">*</span>':'')+'</td><td>'+(r.runOutDate?esc(v42D(r.runOutDate)):'<span class="muted">—</span>')+'</td><td>'+no+'</td></tr>';}).join('')+'</tbody></table></div>'+
    '<div class="note">* no usage data yet, so the estimate is the count plus deliveries only.</div>';
}
function v42StockMoves(){
  var S=V42.st;return '<div class="card"><div class="ov-filters" style="grid-template-columns:2fr 1fr"><div class="field" style="margin:0"><label for="stMq">Search</label><input id="stMq" placeholder="Item, account or note…" autocomplete="off" value="'+esc(S.mq)+'"></div>'+
    '<div class="field" style="margin:0"><label for="stMt">Type</label><select id="stMt">'+[['','All types'],['OPEN','Opening'],['COUNT','Count'],['RECEIPT','Receipt'],['ADJUST','Adjustment']].map(function(o){return '<option value="'+o[0]+'"'+(S.mt===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div></div><div id="mvList" style="margin-top:12px"></div></div>';
}
function v42MovesList(){
  var el=$('mvList');if(!el)return;var S=V42.st,q=S.mq.trim().toLowerCase(),all=(v42Ctx().moves||[]).slice().reverse();
  var rows=all.filter(function(m){if(S.mt&&m.type!==S.mt)return false;if(q&&(String(m.item||'')+' '+String(m.account||'')+' '+String(m.notes||'')+' '+m.id).toLowerCase().indexOf(q)<0)return false;return true;});
  if(!rows.length){el.innerHTML='<p class="muted" style="margin:0">'+(all.length?'No movements match.':'No stock movements recorded yet. Counts, receipts and adjustments appear here.')+'</p>';return;}
  var shown=rows.slice(0,S.mlimit),TL={OPEN:'Opening',COUNT:'Count',RECEIPT:'Receipt',ADJUST:'Adjustment'};
  el.innerHTML='<div class="pr-status" role="status" aria-live="polite">Showing <strong>'+shown.length+'</strong> of '+rows.length+' (newest first)</div><div class="scroll"><table class="st-table"><thead><tr><th>When</th><th>Type</th><th>Where</th><th>Item</th><th class="num">Quantity</th><th>Note</th><th>ID</th></tr></thead><tbody>'+
    shown.map(function(m){var q2=(m.type==='OPEN'||m.type==='COUNT')?'counted '+INT(m.qty):(m.qty>0?'+':'')+INT(m.qty);
      return '<tr><td style="white-space:nowrap">'+esc(apWhen(m.ts))+'</td><td>'+esc(TL[m.type]||m.type)+'</td><td>'+(m.scope==='acct'?esc(m.account||'account'):'Warehouse')+'</td><td>'+esc(v42ItemShort(m.item))+'</td><td class="num">'+q2+'</td><td class="muted" style="font-size:12px">'+esc(m.notes||'')+'</td><td class="mono" style="font-size:11px">'+esc(m.id)+'</td></tr>';}).join('')+'</tbody></table></div>'+
    (rows.length>shown.length?'<div class="note">Showing '+shown.length+' of '+rows.length+' · <button type="button" class="btn ghost sm" data-stmmore="1">Show 200 more</button></div>':'');
}
function v42StockSetup(){
  var c=v42Ctx(),cfg=c.config||{},sm=v42Own().summary||{},S=V42.st,started=null;
  if(sm.tracked){started=cfg.startedAt||null;if(!started)(c.moves||[]).forEach(function(m){if(m.scope==='own'&&m.type==='OPEN'&&m.ts&&(!started||m.ts<started))started=m.ts;});}
  return '<div class="card" style="margin-bottom:14px"><h3>'+(sm.tracked?'Opening quantities':'Start tracking stock')+'</h3>'+
    (sm.tracked?'<p style="margin:0">Tracking '+INT(sm.tracked)+' item'+(sm.tracked===1?'':'s')+(started?' since '+esc(apWhen(started)):'')+'. '+INT(sm.untracked||0)+' not tracked. Add more items below; to change an item that is already tracked, type a new number in My stock.</p>'
      :'<p style="margin:0"><strong>Stock starts when you save opening quantities.</strong> Orders saved before then are not deducted; orders you save as Executed after that are. Type what is on the shelf for each item you want to track; leave the rest empty and they stay “Not tracked” (never shown as zero).</p>')+
    '<div class="field" style="margin-top:12px"><label for="suPaste">Paste a list (optional) — one item per line, e.g. “Adol caps 2x12 — 3000”</label><textarea id="suPaste" placeholder="Adol caps 2x12 — 3000&#10;Risek 20mg caps 50 — 120"></textarea></div>'+
    '<div class="rowbtns"><button type="button" class="btn ghost sm" data-su="read">Read the list</button></div><div class="note" id="suMsg" role="status" aria-live="polite"></div><div id="suReview"></div></div>'+
    '<div class="card" style="margin-bottom:14px"><h3>Opening quantities <span class="tag" id="suCount"></span></h3><div class="field"><label for="suQ">Filter items</label><input id="suQ" placeholder="Item name…" autocomplete="off" value="'+esc(S.gq)+'"></div><div id="suList"></div>'+
    '<div class="rowbtns"><button type="button" class="btn" data-su="save">Save opening quantities</button></div><div class="note" id="suSaveMsg" role="status" aria-live="polite">'+(S.savedMsg?'<span class="badge '+(S.savedKind||'b-good')+'">'+(S.savedKind==='b-review'?'Saved, with a warning':'Saved')+'</span> '+esc(S.savedMsg):'')+'</div></div>'+
    '<div class="card"><h3>Settings</h3><div class="grid g-2b">'+fld('cfLead','Lead time (days) — how long a delivery takes',cfg.leadDays,{type:'number',mode:'numeric'})+fld('cfLow','Warn when cover is below (days)',cfg.lowCoverDays,{type:'number',mode:'numeric'})+fld('cfHor','Look ahead (days) for expected orders',cfg.horizonDays,{type:'number',mode:'numeric'})+
    '<div class="field"><label class="chk" style="margin-top:22px"><input type="checkbox" id="cfRes"'+(cfg.reserveQuoted!==false?' checked':'')+'> Quoted orders also reserve stock</label></div></div><div class="rowbtns"><button type="button" class="btn ghost" data-su="cfg">Save settings</button></div><div class="note" id="cfMsg" role="status" aria-live="polite"></div></div>';
}
function v42SetupList(){
  var el=$('suList');if(!el)return;var S=V42.st,q=S.gq.trim().toLowerCase(),m=v42OwnMap(),items=D.activeItems.slice().sort(function(a,b){return a.name.localeCompare(b.name);}),n=0;
  var rows=items.filter(function(i){return !q||i.name.toLowerCase().indexOf(q)>=0;});
  Object.keys(S.grid).forEach(function(k){if(S.grid[k]!=='')n++;});
  var cnt=$('suCount');if(cnt)cnt.textContent=n+' entered';
  el.innerHTML='<div class="scroll" style="max-height:420px"><table class="st-table"><thead><tr><th>Item</th><th class="num">Opening quantity</th></tr></thead><tbody>'+rows.map(function(i){var r=m[i.id];
    if(r&&r.tracked)return '<tr><td>'+esc(v42ItemShort(i.name))+'</td><td class="num muted">Tracked · on hand '+INT(r.onHand)+'</td></tr>';
    return '<tr><td>'+esc(v42ItemShort(i.name))+'</td><td class="num"><input class="su-in" data-i="'+esc(i.id)+'" type="number" min="0" step="1" inputmode="numeric" style="width:110px" placeholder="not tracked" value="'+esc(S.grid[i.id]==null?'':S.grid[i.id])+'" aria-label="Opening quantity of '+esc(i.name)+'"></td></tr>';}).join('')+'</tbody></table></div>';
}
function v42SetupRead(){
  var box=$('suPaste'),msg=$('suMsg');if(!box)return;var out=[];
  box.value.split(/\r?\n/).forEach(function(ln){ln=ln.trim();if(!ln)return;out.push(plResolveLine(ln));});
  V42.st.paste=out;
  if(!out.length){msg.textContent='Nothing to read — paste or type your list first.';$('suReview').innerHTML='';return;}
  v42SetupReview();
}
function v42SetupReview(){
  var rows=V42.st.paste||[],m=v42OwnMap(),msg=$('suMsg'),el=$('suReview');if(!el)return;
  function st(r){var im=r.item&&itemMap[r.item]&&itemMap[r.item].active!==false?itemMap[r.item]:null;if(!im)return 'item';if(!(typeof r.qty==='number'&&isFinite(r.qty)&&r.qty>=0&&Math.floor(r.qty)===r.qty))return 'qty';if(m[im.id]&&m[im.id].tracked)return 'tracked';return 'ready';}
  var ready=rows.filter(function(r){return st(r)==='ready';}).length;
  msg.innerHTML='Read <strong>'+rows.length+'</strong> line(s): '+ready+' ready.'+(rows.length>ready?' Fix the amber ones or leave them out.':'');
  el.innerHTML='<div class="pl-rows">'+rows.map(function(r,i){var s=st(r),sugg=(r.cand||[]).filter(function(c){return c.name!==r.item;}).slice(0,4);
    return '<div class="pl-row '+(s==='ready'?'ready':'')+'" data-i="'+i+'"><div class="pl-raw" title="'+esc(r.raw)+'">“'+esc(r.raw)+'”</div><input class="pl-item su-pitem" list="itemDL" value="'+esc(r.item)+'" placeholder="Choose the item…" aria-label="Item for: '+esc(r.raw)+'" autocomplete="off">'+
      '<div class="pl-line2"><input class="pl-qty su-pqty" type="number" min="0" step="1" inputmode="numeric" value="'+(r.qty==null?'':r.qty)+'" placeholder="Qty" aria-label="Quantity"><span class="pl-info">'+(s==='ready'?v42Chip('b-good','Ready'):s==='tracked'?v42Chip('b-off','Already tracked — change it in My stock'):s==='item'?v42Chip('b-review','Choose item'):v42Chip('b-review','Add quantity'))+'</span></div>'+
      (s==='item'&&sugg.length?'<div class="pl-sugg">Did you mean: '+sugg.map(function(c){return '<button type="button" class="chip" data-supick="'+esc(c.name)+'">'+esc(shortItem(c.name))+'</button>';}).join(' ')+'</div>':'')+'</div>';}).join('')+'</div>'+
    '<div class="rowbtns"><button type="button" class="btn" data-su="fill"'+(ready?'':' disabled')+'>Put '+ready+' ready line'+(ready===1?'':'s')+' into the grid</button></div><div class="note">This only fills the grid below. Nothing is saved until you press “Save opening quantities”.</div>';
}
function v42SetupSave(){
  var S=V42.st,msg='suSaveMsg',blk=v42Block();if(blk)return setMsg(msg,'b-bad',esc(blk));
  var rows=[],bad='',m=v42OwnMap();
  Object.keys(S.grid).forEach(function(id){var v=S.grid[id];if(v==='')return;var q=v42Int(v),im=itemById[id];
    if(!im){return;}if(!(q>=0&&q<=10000000)){bad=bad||('Check the quantity for '+im.name+' (whole number, 0 or more).');return;}
    if(m[id]&&m[id].tracked)return;rows.push({type:'OPEN',scope:'own',itemId:id,item:im.name,qty:q});});
  if(bad)return setMsg(msg,'b-review',esc(bad));
  if(!rows.length)return setMsg(msg,'b-review','Type at least one opening quantity first.');
  confirmBox('Start tracking '+rows.length+' item'+(rows.length===1?'':'s')+'?','<p>Stock for these items starts from the quantities you typed. Orders saved before now are <strong>not</strong> deducted; orders you save as Executed from now on are.</p><p class="note">Every opening quantity is recorded in the history. Items you left empty stay “Not tracked”.</p>','Save opening quantities').then(function(ok){
    if(!ok)return setMsg(msg,'b-review','Not saved.');
    setMsg(msg,'','Saving…');
    var warn='';
    v42WriteMoves(rows).then(function(res){warn=res.warn||'';
      return v42SaveConfig({},true).then(function(){return res;},function(e){warn=(warn?warn+' ':'')+'Opening quantities saved, but the start date could not be written to the settings — '+errText(e)+' The quantities are recorded and the items are tracked.';return res;});
    }).then(function(){S.grid={};S.dirty=false;S.paste=null;
      S.savedMsg=rows.length+' opening quantit'+(rows.length===1?'y':'ies')+' saved. Stock is now tracked for these items.'+(warn?' '+warn:'');S.savedKind=warn?'b-review':'b-good';
      if(warn){v42Warn(esc(warn));toast(esc(warn),'warn');}else toast('Opening stock saved · '+rows.length+' item(s)','good');renderStock();},
      function(e){setMsg(msg,'b-bad',esc(errText(e)));});
  });
}
function v42WireStock(){
  var el=$('stockBody');if(!el)return;var S=V42.st;
  v42Wire(el,'click',function(e){
    var b=e.target.closest('button');if(!b)return;
    if(b.dataset.sttab){if(S.tab==='setup'&&S.dirty&&b.dataset.sttab!=='setup'){confirmBox('Leave this page?','<p>You have typed opening quantities that are not saved yet. If you leave, they are cleared.</p>','Leave without saving',true).then(function(ok){if(ok){S.dirty=false;S.grid={};S.paste=null;S.tab=b.dataset.sttab;renderStock();}});return;}S.tab=b.dataset.sttab;S.savedMsg='';renderStock();return;}
    if(b.dataset.stf){S.f=b.dataset.stf;S.limit=100;renderStock();return;}
    if(b.dataset.stmore){S.limit+=100;v42OwnList();return;}
    if(b.dataset.stmmore){S.mlimit+=200;v42MovesList();return;}
    if(b.dataset.stact){v42MoveDlg(b.dataset.stact,b.dataset.item);return;}
    if(b.dataset.stacct==='count'){v42AcctCountDlg(S.acct);return;}
    if(b.dataset.supick){var row=b.closest('.pl-row'),r=S.paste[+row.dataset.i];r.item=b.dataset.supick;v42SetupReview();return;}
    if(b.dataset.su==='read'){v42SetupRead();return;}
    if(b.dataset.su==='fill'){var m=v42OwnMap(),n=0;(S.paste||[]).forEach(function(r){var im=r.item&&itemMap[r.item];if(!im||im.active===false||!(typeof r.qty==='number'&&r.qty>=0&&Math.floor(r.qty)===r.qty)||(m[im.id]&&m[im.id].tracked))return;S.grid[im.id]=String(r.qty);n++;});
      S.paste=(S.paste||[]).filter(function(r){var im=r.item&&itemMap[r.item];return !(im&&S.grid[im.id]!=null&&String(S.grid[im.id])===String(r.qty));});S.dirty=true;v42SetupList();v42SetupReview();$('suMsg').innerHTML=n+' line(s) put into the grid below. Check them, then press Save.';return;}
    if(b.dataset.su==='save'){v42SetupSave();return;}
    if(b.dataset.su==='cfg'){
      var lead=v42Int(fv(el,'cfLead')),low=v42Int(fv(el,'cfLow')),hor=v42Int(fv(el,'cfHor')),res=fv(el,'cfRes');
      if(!(lead>=0&&lead<=90))return setMsg('cfMsg','b-review','Lead time must be a whole number from 0 to 90.');
      if(!(low>=1&&low<=365))return setMsg('cfMsg','b-review','Cover warning must be a whole number from 1 to 365.');
      if(!(hor>=7&&hor<=180))return setMsg('cfMsg','b-review','Look ahead must be a whole number from 7 to 180.');
      var blk=v42Block();if(blk)return setMsg('cfMsg','b-bad',esc(blk));
      setMsg('cfMsg','','Saving…');v42SaveConfig({leadDays:lead,lowCoverDays:low,horizonDays:hor,reserveQuoted:!!res},false).then(function(){setMsg('cfMsg','b-good','Settings saved.');},function(er){setMsg('cfMsg','b-bad',esc(errText(er)));});
    }
  });
  v42Wire(el,'input',function(e){var t=e.target;
    if(t.id==='stQ'){S.q=t.value;S.limit=100;v42OwnList();}
    else if(t.id==='stMq'){S.mq=t.value;S.mlimit=200;v42MovesList();}
    else if(t.id==='suQ'){S.gq=t.value;v42SetupList();}
    else if(t.classList.contains('su-in')){S.savedMsg='';var sm0=$('suSaveMsg');if(sm0)sm0.textContent='';S.grid[t.dataset.i]=t.value;var any=false;Object.keys(S.grid).forEach(function(k){if(S.grid[k]!=='')any=true;});S.dirty=any;var c=$('suCount'),n=0;Object.keys(S.grid).forEach(function(k){if(S.grid[k]!=='')n++;});if(c)c.textContent=n+' entered';}
    else if(t.classList.contains('su-pitem')||t.classList.contains('su-pqty')){var row=t.closest('.pl-row'),r=(S.paste||[])[+row.dataset.i];if(!r)return;
      if(t.classList.contains('su-pitem')){var v=t.value.trim();r.item=itemMap[v]?v:'';}else r.qty=t.value===''?null:Number(t.value);}
  });
  v42Wire(el,'change',function(e){var t=e.target;
    if(t.id==='stMt'){S.mt=t.value;v42MovesList();}
    else if(t.id==='stAcct'){S.acct=t.value;v42AcctList();}
    else if(t.classList.contains('su-pitem')||t.classList.contains('su-pqty'))v42SetupReview();
  });
}

/* ==================== TARGETS ==================== */
function v42TgDefaultMonth(){var t=localDate(),d=+t.slice(8,10),y=+t.slice(0,4),m=+t.slice(5,7);if(d>=25){m++;if(m>12){m=1;y++;}}return y+'-'+pad(m,2);}
function v42TgMonths(){
  var t=localDate(),y=+t.slice(0,4),m=+t.slice(5,7),set={},i;
  for(i=-3;i<=12;i++){var mm=m+i,yy=y;while(mm<1){mm+=12;yy--;}while(mm>12){mm-=12;yy++;}set[yy+'-'+pad(mm,2)]=1;}
  Object.keys(v42Ctx().targets||{}).forEach(function(k){set[k]=1;});
  return Object.keys(set).sort();
}
function v42TgFillMonths(){
  var sel=$('tgMonth');if(!sel)return;var T=V42.tg;if(!T.month)T.month=v42TgDefaultMonth();
  var saved=v42Ctx().targets||{},html=v42TgMonths().map(function(k){return '<option value="'+k+'">'+esc(monthLong(k))+(saved[k]?' · saved':'')+'</option>';}).join('');
  if(sel._h!==html){sel.innerHTML=html;sel._h=html;}sel.value=T.month;
}
function v42TgLoadSaved(){ /* put the saved target's settings into the controls */
  var T=V42.tg,doc=Store.peek('targets/'+T.month);T.res=null;T.ag={};T.ig={};T.fx={};T.open={};T.notes='';
  if(doc){$('tgTotal').value=doc.total!=null?String(doc.total):'';$('tgW').value=String(Math.round((doc.histWeight!=null?doc.histWeight:.7)*100));$('tgHM').value=String(doc.histMonths||6);
    T.ag=v42Clone(doc.acctGrowth||{});T.ig=v42Clone(doc.itemGrowth||{});T.fx=v42Clone(doc.acctFixed||{});T.notes=doc.notes||'';}
  v42TgWtxt();
}
function v42TgWtxt(){var w=+$('tgW').value;$('tgWTxt').textContent=w+'% history · '+(100-w)+'% potential';}
function v42TgOpts(){
  var T=V42.tg,tot=numIn($('tgTotal').value);
  if(tot==null||!isFinite(tot)||!(tot>0))return {error:'Enter the total target in SAR (a number above 0).'};
  return {month:T.month,total:Math.round(tot*100)/100,histWeight:(+$('tgW').value)/100,histMonths:+$('tgHM').value,acctGrowth:T.ag,itemGrowth:T.ig,acctFixed:T.fx};
}
function v42TgRun(){
  var T=V42.tg,o=v42TgOpts(),msg='tgMsg';
  if(o.error){T.res=null;v42TgPreview();return setMsg(msg,'b-review',esc(o.error));}
  var r;try{r=Eng.targetBreakdown(v42Ctx(),o);}catch(e){r={ok:false,error:e.message||String(e)};}
  if(!r.ok){T.res=null;v42TgPreview();return setMsg(msg,'b-review',esc(r.error||'Could not break this down.'));}
  T.res=r;T.o=o;setMsg(msg,'','Broken down into '+r.rows.filter(function(x){return x.t>0;}).length+' account × item lines. Adjust growth or fix an account below, then save.');v42TgPreview();
}
function v42TgSumCheck(r){var s=0;r.rows.forEach(function(x){s+=x.t;});return Math.round(s*100)/100;}
function v42TgPreview(){
  var el=$('tgPreview');if(!el)return;var T=V42.tg,r=T.res;
  if(!r){el.innerHTML='';return;}
  var tab=T.tab,h='<div class="card" style="margin-bottom:14px"><h3>Preview · '+esc(monthLong(T.month))+' <span class="tag">'+SAR(r.total)+' SAR</span></h3>'+
    '<div class="tabs" role="tablist" aria-label="Breakdown view"><button type="button" role="tab" data-tgtab="acct" aria-selected="'+(tab==='acct')+'" aria-current="'+(tab==='acct')+'">By account</button><button type="button" role="tab" data-tgtab="item" aria-selected="'+(tab==='item')+'" aria-current="'+(tab==='item')+'">By item</button></div>';
  if(r.warnings&&r.warnings.length)h+='<div class="banner warn" role="status">'+r.warnings.map(esc).join('<br>')+'</div>';
  if(tab==='acct'){
    h+='<div class="scroll"><table class="tg-table"><thead><tr><th>Account</th><th class="num">Base share</th><th class="num">Growth %</th><th class="num">Fixed SAR</th><th class="num">Final share</th><th class="num">Target SAR</th></tr></thead><tbody>'+
      r.byAccount.map(function(a){var op=!!T.open[a.a],items=op?r.rows.filter(function(x){return x.a===a.a&&x.t>0;}).sort(function(x,y){return y.t-x.t;}):[];
        return '<tr><td><button type="button" class="tg-exp" data-tgopen="'+esc(a.a)+'" aria-expanded="'+op+'" aria-label="'+(op?'Hide':'Show')+' items for '+esc(a.account)+'">'+(op?'▾':'▸')+'</button> '+esc(a.account)+(a.fixed?' '+v42Chip('b-deal','fixed'):'')+'</td><td class="num">'+PCT(a.baseShare)+'</td>'+
          '<td class="num"><input class="tg-in" data-tg="ag" data-k="'+esc(a.a)+'" type="number" step="1" min="-100" max="500" inputmode="decimal" value="'+(T.ag[a.a]!=null?esc(T.ag[a.a]):'')+'" placeholder="0" aria-label="Growth percent for '+esc(a.account)+'"></td>'+
          '<td class="num"><input class="tg-in" data-tg="fx" data-k="'+esc(a.a)+'" type="number" step="100" min="0" inputmode="decimal" value="'+(T.fx[a.a]!=null?esc(T.fx[a.a]):'')+'" placeholder="auto" aria-label="Fixed SAR for '+esc(a.account)+'"></td>'+
          '<td class="num">'+PCT(a.share)+'</td><td class="num"><strong>'+SAR(a.t)+'</strong></td></tr>'+
          (op?'<tr class="tg-sub"><td colspan="6"><table><thead><tr><th>Item</th><th class="num">Target SAR</th><th class="num">Share of account</th></tr></thead><tbody>'+items.map(function(x){return '<tr><td>'+esc(shortItem(x.item))+'</td><td class="num">'+SAR(x.t)+'</td><td class="num">'+PCT(a.t?x.t/a.t:0)+'</td></tr>';}).join('')+'</tbody></table></td></tr>':'');}).join('')+'</tbody></table></div>';
  }else{
    h+='<div class="scroll"><table class="tg-table"><thead><tr><th>Item</th><th class="num">Base share</th><th class="num">Growth %</th><th class="num">Final share</th><th class="num">Target SAR</th></tr></thead><tbody>'+
      r.byItem.filter(function(i){return i.t>0||T.ig[i.i]!=null;}).sort(function(x,y){return y.t-x.t;}).map(function(i){return '<tr><td>'+esc(shortItem(i.item))+'</td><td class="num">'+PCT(i.baseShare)+'</td><td class="num"><input class="tg-in" data-tg="ig" data-k="'+esc(i.i)+'" type="number" step="1" min="-100" max="500" inputmode="decimal" value="'+(T.ig[i.i]!=null?esc(T.ig[i.i]):'')+'" placeholder="0" aria-label="Growth percent for '+esc(i.item)+'"></td><td class="num">'+PCT(i.share)+'</td><td class="num"><strong>'+SAR(i.t)+'</strong></td></tr>';}).join('')+'</tbody></table></div>';
  }
  var sum=v42TgSumCheck(r),exists=!!Store.peek('targets/'+T.month);
  h+='<div class="note" role="status">Cells add up to <strong>'+SAR(sum)+'</strong> SAR'+(Math.abs(sum-r.total)<0.005?' — exactly the target.':' (target '+SAR(r.total)+').')+' Growth: +10 gives that account or item 10% more weight; a fixed amount is split over the account’s items.</div>'+
    '<div class="field" style="margin-top:10px"><label for="tgNotes">Note (optional)</label><input id="tgNotes" maxlength="160" autocomplete="off" value="'+esc(T.notes)+'"></div>'+
    '<div class="rowbtns"><button type="button" class="btn" data-tgsave="1">'+(exists?'Replace saved target':'Save target')+'</button></div><div class="note" id="tgSaveMsg" role="status" aria-live="polite">'+(exists?'A target for this month is already saved. Saving replaces it; the change is written to the history.':'')+'</div></div>';
  el.innerHTML=h;
}
function v42TgSave(){
  var T=V42.tg,msg='tgSaveMsg',blk=v42Block();if(blk)return setMsg(msg,'b-bad',esc(blk));
  if(!T.res||!T.o)return setMsg(msg,'b-review','Press Break down first.');
  var r=T.res,o=T.o,rows=r.rows.filter(function(x){return x.t>0;}).map(function(x){return {a:x.a,i:x.i,t:Math.round(x.t*100)/100};}),sum=0;rows.forEach(function(x){sum+=x.t;});
  if(Math.abs(sum-o.total)>0.005)return setMsg(msg,'b-bad','The cells do not add up to the target ('+SAR(sum)+' vs '+SAR(o.total)+'). Nothing was saved. Break down again.');
  var path='targets/'+T.month,oldTotal=null,notes=($('tgNotes')?$('tgNotes').value:'').trim().slice(0,160);
  setMsg(msg,'','Saving…');
  v42PutDoc(path,function(b,cur){oldTotal=cur?cur.total:null;b.month=T.month;b.total=o.total;b.histWeight=o.histWeight;b.histMonths=o.histMonths;b.acctGrowth=v42Clone(o.acctGrowth);b.itemGrowth=v42Clone(o.itemGrowth);b.acctFixed=v42Clone(o.acctFixed);b.rows=rows;b.notes=notes||null;if(!b.createdAt)b.createdAt=nowISO();
    if(JSON.stringify(b).length>240000)throw new Error('This breakdown is too large to save in one record. Use a larger look-back or fewer fixed items, or ask Claude.');})
  .then(function(){return v42Audit([auditRow('TARGET_SET','','','total',oldTotal==null?'':oldTotal,o.total,'Target for '+T.month,path+' · '+rows.length+' lines'+(oldTotal!=null?' · replaced earlier target':''))]);})
  .then(function(){setMsg(msg,'b-good','Target for <strong>'+esc(monthLong(T.month))+'</strong> saved: '+SAR(o.total)+' SAR over '+rows.length+' lines.');toast('Target saved · '+esc(monthLong(T.month)),'good');V42.ctx=null;v42TgRest();},
    function(e){setMsg(msg,'b-bad',esc(errText(e)));});
}
function v42Bar(pct,runPct,label){
  var p=Math.max(0,Math.min(100,(pct||0)*100)),m=runPct==null?null:Math.max(0,Math.min(100,runPct*100));
  return '<div class="pg" role="img" aria-label="'+esc(label)+'"><div class="pg-fill" style="width:'+p.toFixed(1)+'%"></div>'+(m!=null?'<div class="pg-mark" style="left:'+m.toFixed(1)+'%" title="On pace for"></div>':'')+'</div>';
}
function v42TgProgressHtml(doc){
  var c=v42Ctx(),pr;try{pr=Eng.targetProgress(c,doc);}catch(e){return v42Err('Progress',e);}
  var cur=(doc.month===v42Today().slice(0,7)),stT={ahead:['b-good','Ahead of pace'],behind:['b-bad','Behind pace'],'on track':['b-review','On track']};
  var rp=(cur&&pr.total)?pr.runRate/pr.total:null,sc=stT[pr.status]||['b-std',pr.status||''];
  var h='<div class="card" style="margin-bottom:14px"><h3>Progress · '+esc(monthLong(doc.month))+' '+(cur?v42Chip(sc[0],sc[1]):'')+'</h3>'+
    '<div class="pg-big">'+v42Bar(pr.pct,rp,'Actual '+SAR(pr.actual)+' of '+SAR(pr.total)+' SAR')+'</div>'+
    '<div class="pg-txt"><strong>'+SAR(pr.actual)+'</strong> of '+SAR(pr.total)+' SAR · <strong>'+PCT(pr.pct)+'</strong>'+(cur&&pr.runRate!=null?' · on pace for '+SAR(pr.runRate)+' ('+pr.daysElapsed+' of '+pr.daysInMonth+' days gone)':'')+(cur?'':' · final')+'</div>'+
    '<div class="scroll" style="margin-top:12px"><table><thead><tr><th>Account</th><th style="width:34%">Progress</th><th class="num">Actual</th><th class="num">Target</th><th class="num">%</th><th>Status</th></tr></thead><tbody>'+
    (pr.byAccount||[]).slice().sort(function(a,b){return b.t-a.t;}).map(function(a){var s2=stT[a.status]||null;
      return '<tr><td>'+esc(a.account)+'</td><td>'+v42Bar(a.pct,(cur&&a.t)?(a.actual/Math.max(pr.daysElapsed,1)*pr.daysInMonth)/a.t:null,'Actual '+SAR(a.actual)+' of '+SAR(a.t))+'</td><td class="num">'+SAR(a.actual)+'</td><td class="num">'+SAR(a.t)+'</td><td class="num">'+PCT(a.pct)+'</td><td>'+(cur&&s2?v42Chip(s2[0],s2[1]):'')+'</td></tr>';}).join('')+'</tbody></table></div>'+
    '<div class="note">The bar shows what has been sold; the thin line marks where the month will land at the current pace. Only executed orders from open accounts count.</div></div>';
  return h;
}
function v42TgRest(){
  var T=V42.tg,doc=Store.peek('targets/'+T.month),pe=$('tgProgress'),sv=$('tgSaved');if(!pe||!sv)return;
  try{pe.innerHTML=doc?v42TgProgressHtml(doc):'';}catch(e){pe.innerHTML=v42Err('Progress',e);}
  var c=v42Ctx(),keys=Object.keys(c.targets||{}).sort().reverse();
  $('tgCount').textContent=keys.length?keys.length+' saved':'none saved yet';
  sv.innerHTML='<div class="card"><h3>Saved targets</h3>'+(keys.length?'<div class="scroll"><table><thead><tr><th>Month</th><th class="num">Target SAR</th><th class="num">Reached</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>'+keys.map(function(k){var d=c.targets[k],pr=null;try{pr=Eng.targetProgress(c,d);}catch(e){pr=null;}
    return '<tr><td>'+esc(monthLong(k))+'</td><td class="num">'+SAR(d.total)+'</td><td class="num">'+(pr?PCT(pr.pct):'—')+'</td><td><button type="button" class="btn ghost sm" data-tgopenm="'+k+'">Open</button></td></tr>';}).join('')+'</tbody></table></div>':'<p class="muted" style="margin:0">No target saved yet. Pick a month, type the total, and press Break down.</p>')+'</div>';
}
function renderTargets(){
  if(!v42Ok())return;try{v42TgFillMonths();v42TgWire();v42TgRest();if(V42.tg.res)v42TgPreview();}catch(e){var el=$('tgPreview');if(el)el.innerHTML=v42Err('Targets',e);}
}
function v42TgWire(){
  var T=V42.tg;if(T.wired)return;T.wired=true;
  $('tgMonth').addEventListener('change',function(){T.month=this.value;T.tab='acct';v42TgLoadSaved();$('tgMsg').textContent='';v42TgPreview();v42TgRest();});
  $('tgW').addEventListener('input',v42TgWtxt);
  ['tgW','tgHM'].forEach(function(id){$(id).addEventListener('change',function(){if(T.res)v42TgRun();});});
  $('tgTotal').addEventListener('change',function(){if(T.res)v42TgRun();});
  $('tgBreak').addEventListener('click',v42TgRun);
  $('tgReset').addEventListener('click',function(){T.ag={};T.ig={};T.fx={};T.open={};if(T.res)v42TgRun();else $('tgMsg').textContent='Adjustments cleared.';});
  $('tgPreview').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    if(b.dataset.tgtab){T.tab=b.dataset.tgtab;v42TgPreview();}
    else if(b.dataset.tgopen){T.open[b.dataset.tgopen]=!T.open[b.dataset.tgopen];v42TgPreview();}
    else if(b.dataset.tgsave)v42TgSave();});
  $('tgPreview').addEventListener('input',function(e){if(e.target.id==='tgNotes')T.notes=e.target.value;});
  $('tgPreview').addEventListener('change',function(e){var t=e.target;if(!t.classList.contains('tg-in'))return;
    var map=T[t.dataset.tg],k=t.dataset.k,v=String(t.value).trim();
    if(v==='')delete map[k];else{var n=Number(v);if(!isFinite(n)){return;}
      if(t.dataset.tg==='fx'){if(n<0){$('tgMsg').textContent='A fixed amount cannot be negative.';return;}}else if(n<-100||n>500){$('tgMsg').textContent='Growth must be between -100 and 500.';return;}
      map[k]=n;}
    v42TgRun();var again=$('tgPreview').querySelector('.tg-in[data-tg="'+t.dataset.tg+'"][data-k="'+k+'"]');if(again)try{again.focus();}catch(x){}});
  $('tgSaved').addEventListener('click',function(e){var b=e.target.closest('[data-tgopenm]');if(!b)return;T.month=b.dataset.tgopenm;$('tgMonth').value=T.month;v42TgLoadSaved();$('tgMsg').textContent='';v42TgPreview();v42TgRest();window.scrollTo(0,0);});
}

/* ==================== ACCOUNTS: close / reopen ==================== */
function v42CloseAccount(name){
  var blk=v42Block();if(blk){toast(esc(blk),'warn');return;}
  var a=acctMap[name];if(!a||!a._r){return;}var raw=a._r,x=v42ClosedNetAll(name),pend=D.orders.filter(function(o){return o.a===name&&(o.s==='Pending'||o.s==='Quoted');}).length;
  openDialog({title:'Close account “'+name+'”?',ok:'Close account',danger:true,
    html:'<p>This account will be <strong>hidden</strong> from the account list, the order builder and the dashboard figures. Its '+INT(x.lines)+' executed line(s) ('+SAR(x.net)+' SAR) will no longer count in the dashboard totals; the Data check and the Excel export still include them.</p>'+
      '<ul class="ap-att"><li>Nothing is deleted — orders, deals and history stay and remain visible in Orders.</li><li>You can reopen the account at any time (Show closed on the Accounts page).</li><li>It stops appearing in expected orders and targets.</li>'+(pend?'<li><strong>'+pend+' Pending/Quoted line(s)</strong> stay as they are. Cancel or execute them first if needed.</li>':'')+'</ul>'+
      fld('xWhy','Reason',['No longer buying','Closed down','Merged into another account','Other'][0],{options:['No longer buying','Closed down','Merged into another account','Other']})+fld('xNote','Details (optional)','',{max:160}),
    onOk:function(md){var why=fv(md,'xWhy'),nt=fv(md,'xNote').slice(0,160),reason=why+(nt?' — '+nt:''),today=localDate();
      return commit([{path:'master/accounts',fn:function(b){var row=b.rows.filter(function(r){return r.id===raw.id;})[0];if(!row)throw new Error('Account not found. Nothing was saved.');if(row.active===false)throw new Error('This account is already closed.');row.active=false;row.closedAt=today;row.closedReason=reason;}}],
        [auditRow('CLOSE_ACCOUNT',name,'','active',true,false,reason,raw.id+' · closed '+today)]).then(function(){toast(esc(name)+' closed','good');});}});
}
function v42ClosedNetAll(name){var net=0,lines=0;D.orders.forEach(function(o){if(o.a===name&&o.s==='Executed'){net+=o.net||0;lines++;}});return {net:net,lines:lines};}
function v42ReopenAccount(name){
  var blk=v42Block();if(blk){toast(esc(blk),'warn');return;}
  var a=acctMap[name];if(!a||!a._r)return;var raw=a._r;
  confirmBox('Reopen “'+name+'”?','<p>The account comes back into the account list, the order builder, expected orders and the dashboard figures. Its history was never removed.</p>','Reopen account').then(function(ok){if(!ok)return;
    commit([{path:'master/accounts',fn:function(b){var row=b.rows.filter(function(r){return r.id===raw.id;})[0];if(!row)throw new Error('Account not found. Nothing was saved.');row.active=true;delete row.closedAt;delete row.closedReason;}}],
      [auditRow('REOPEN_ACCOUNT',name,'','active',false,true,raw.closedReason||'',raw.id+(raw.closedAt?' · was closed '+raw.closedAt:''))]).then(function(){toast(esc(name)+' reopened','good');},function(e){toast(esc(errText(e)),'bad');});});
}
function v42ClosedBanner(ar){
  if(!ar||ar.active!==false)return '';
  return '<div class="banner warn" role="status" style="margin-top:12px"><strong>This account is closed'+(ar.closedAt?' (since '+esc(ar.closedAt)+')':'')+'.</strong> '+(ar.closedReason?esc(ar.closedReason)+'. ':'')+'It is left out of the dashboard figures, expected orders and the order builder. Its history is kept. <button type="button" class="btn sm" data-apact="reopen">Reopen account</button></div>';
}
function v42ClosedToggle(){
  var n=D.accounts.filter(function(a){return !a.active;}).length,w=$('acctClosedWrap');if(!w)return;
  w.hidden=!n;$('acctClosedN').textContent=n;var cb=$('acctShowClosed');cb.checked=!!V42.showClosed;
  v42Wire(cb,'change',function(){V42.showClosed=cb.checked;renderAcctList($('acctSearch').value);});
  var oc=$('ovClosedWrap');if(oc){oc.hidden=!n;var ob=$('ovClosed');ob.checked=!V42.hideClosedOrders;v42Wire(ob,'change',function(){V42.hideClosedOrders=!ob.checked;renderOrders();});}
}

/* ==================== DATA page extras: brand, restore, new year ==================== */
function v42Node(id){if(!V42.nodes[id]){var d=document.createElement('div');d.className='card';d.style.marginTop='14px';d.id='v42-'+id;V42.nodes[id]=d;}return V42.nodes[id];}
function v42DataExtras(){
  var host=$('dataBody');if(!host||!v42Ok())return;
  try{
    var ny=v42Node('year'),br=v42Node('brand'),rs=v42Node('restore');
    if(!V42.ny.dirty||!ny._r){v42YearRender();}
    if(!br._r||(!V42.br.dirty&&br._stamp!==((Store.peek('master/brand')||{}).updatedAt||''))){v42BrandRender();}
    if(!rs._r)v42RestoreRender();
    host.appendChild(ny);host.appendChild(br);host.appendChild(rs);
  }catch(e){host.insertAdjacentHTML('beforeend',v42Err('More tools',e));}
}
/* ---- brand ---- */
function v42BrandRender(){
  var Q=function(id){return V42.nodes['brand']?V42.nodes['brand'].querySelector('#'+id):null;},n=v42Node('brand'),b=v42Brand(),logo=V42.br.logo!==undefined?V42.br.logo:b.logo;
  n._r=1;n._stamp=(Store.peek('master/brand')||{}).updatedAt||'';
  n.innerHTML='<h3>Brand &amp; workspace</h3><p class="note" style="margin-top:0">The company and app name appear in the page title, the side bar, PDFs and file names. Defaults: “Julphar” and “Sales Platform”.</p>'+
    '<div class="grid g-2b">'+fld('brCo','Company name (up to 40 characters)',b.company,{max:40})+fld('brApp','App name (up to 40 characters)',b.appName,{max:40})+fld('brTag','Tagline (optional)',b.tagline,{max:100})+
    '<div class="field"><label for="brColor">Brand colour</label><input id="brColor" type="color" value="'+esc(/^#[0-9a-fA-F]{6}$/.test(b.color)?b.color:'#1f4e79')+'" style="width:80px;padding:3px"></div></div>'+
    '<div class="field"><label for="brLogo">Logo (PNG, JPG, WebP or SVG, up to 60 KB)</label><input id="brLogo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></div>'+
    '<div class="br-prev" id="brPrev" aria-label="Preview"></div>'+
    '<div class="rowbtns"><button type="button" class="btn" id="brSave">Save brand</button><button type="button" class="btn ghost sm" id="brNoLogo">Remove logo</button><button type="button" class="btn ghost sm" id="brReset">Back to Julphar defaults</button></div><div class="note" id="brMsg" role="status" aria-live="polite"></div>';
  function prev(){var co=Q('brCo').value||'…',app=Q('brApp').value||'',lg=V42.br.logo!==undefined?V42.br.logo:b.logo,col=Q('brColor').value;
    var el=Q('brPrev');el.innerHTML='<span class="dot" style="background:'+esc(col)+'"></span><span><strong>'+esc(co)+' '+esc(app)+'</strong><br><span class="muted" style="font-size:12px">'+esc(Q('brTag').value)+'</span></span>';
    if(lg&&/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(lg)){var d=el.firstChild;d.innerHTML='<img alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">';d.firstChild.src=lg;}}
  n.oninput=function(){V42.br.dirty=true;prev();};
  Q('brLogo').onchange=function(){var f=this.files&&this.files[0];if(!f)return;
    if(!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)){setMsg('brMsg','b-review','Choose a PNG, JPG, WebP or SVG image.');this.value='';return;}
    if(f.size>60*1024){setMsg('brMsg','b-review','That logo is '+Math.round(f.size/1024)+' KB. Please use one up to 60 KB.');this.value='';return;}
    var rd=new FileReader(),inp=this;rd.onload=function(){var url=String(rd.result),im=new Image();im.onload=function(){if(!(im.naturalWidth>0&&im.naturalHeight>0)){setMsg('brMsg','b-review','That file is not a readable image.');inp.value='';return;}V42.br.logo=url;V42.br.dirty=true;setMsg('brMsg','','Logo ready — press Save brand.');prev();};im.onerror=function(){setMsg('brMsg','b-review','That file could not be read as an image. Choose a PNG, JPG, WebP or SVG picture.');inp.value='';};im.src=url;};rd.onerror=function(){setMsg('brMsg','b-bad','Could not read that file.');};rd.readAsDataURL(f);};
  Q('brNoLogo').onclick=function(){V42.br.logo=null;V42.br.dirty=true;prev();setMsg('brMsg','','Logo removed — press Save brand.');};
  Q('brReset').onclick=function(){Q('brCo').value=V42_BRD.company;Q('brApp').value=V42_BRD.appName;Q('brTag').value='';Q('brColor').value=V42_BRD.color;V42.br.logo=null;V42.br.dirty=true;prev();setMsg('brMsg','','Defaults filled in — press Save brand.');};
  Q('brSave').onclick=function(){
    var co=Q('brCo').value.trim(),app=Q('brApp').value.trim(),tag=Q('brTag').value.trim(),col=Q('brColor').value,lg=V42.br.logo!==undefined?V42.br.logo:b.logo,blk=v42Block();
    if(blk)return setMsg('brMsg','b-bad',esc(blk));
    if(!co)return setMsg('brMsg','b-review','Enter the company name.');if(co.length>40||app.length>40)return setMsg('brMsg','b-review','Company and app names can have up to 40 characters each.');if(!app)return setMsg('brMsg','b-review','Enter the app name.');
    if(lg&&lg.length>82000)return setMsg('brMsg','b-review','The logo is too large (60 KB limit).');
    var old=v42Brand(),ch=[];if(old.company!==co)ch.push('company '+old.company+' → '+co);if(old.appName!==app)ch.push('app name '+old.appName+' → '+app);if((old.tagline||'')!==tag)ch.push('tagline');if(old.color!==col)ch.push('colour '+old.color+' → '+col);if((old.logo||null)!==(lg||null))ch.push('logo');
    if(!ch.length)return setMsg('brMsg','b-review','Nothing changed.');
    setMsg('brMsg','','Saving…');
    v42PutDoc('master/brand',function(d){d.company=co;d.appName=app;d.tagline=tag;d.color=col;d.logo=lg||null;})
      .then(function(){return v42Audit([auditRow('BRAND_SET','','','brand','',ch.join('; '),'','master/brand')]);})
      .then(function(){V42.br.dirty=false;V42.br.logo=undefined;V42.brand=null;v42ApplyBrand();v42BrandRender();setMsg('brMsg','b-good','Saved. The page title now reads <strong>'+esc(v42Brand().title)+'</strong>.');toast('Brand saved','good');},
        function(e){setMsg('brMsg','b-bad',esc(errText(e)));});
  };
  prev();
}
/* ---- new year helper: period + close accounts with no orders in 12 months ---- */
function v42YearRender(){
  var Q=function(id){return V42.nodes['year']?V42.nodes['year'].querySelector('#'+id):null;},n=v42Node('year'),today=v42Today(),cut=Eng.addDays(today,-365),last={},net={};
  D.orders.forEach(function(o){if(o.s==='Executed'&&o.d){if(!last[o.a]||o.d>last[o.a])last[o.a]=o.d;}if(o.s==='Executed')net[o.a]=(net[o.a]||0)+(o.net||0);});
  var cand=D.accounts.filter(function(a){return a.active&&!(last[a.name]&&last[a.name]>=cut);}).sort(function(a,b){return a.name.localeCompare(b.name);});
  n._r=1;var ys=v42Years();
  n.innerHTML='<h3>New year helper</h3><p class="note" style="margin-top:0">Choose the period the dashboard shows, and tidy up accounts that stopped ordering. Closing hides an account from lists and dashboard figures; it never deletes anything, and you can reopen it.</p>'+
    '<div class="field" style="max-width:260px"><label for="nyPeriod">Dashboard period</label><select id="nyPeriod"><option value="all">All periods</option>'+ys.map(function(y){return '<option value="'+y+'"'+(V42.period===y?' selected':'')+'>Year '+y+'</option>';}).join('')+'</select></div>'+
    (cand.length?'<p style="margin-bottom:6px"><strong>'+cand.length+' open account'+(cand.length===1?'':'s')+' with no order in the last 12 months</strong> (since '+esc(v42D(cut))+'):</p><div class="scroll" style="max-height:260px"><table><thead><tr><th></th><th>Account</th><th>Last order</th><th class="num">Net to date</th></tr></thead><tbody>'+
      cand.map(function(a){return '<tr><td><input type="checkbox" class="ny-cb" value="'+esc(a.id)+'" aria-label="Close '+esc(a.name)+'"'+(V42.ny.sel[a.id]?' checked':'')+' style="width:18px;height:18px"></td><td>'+esc(a.name)+'</td><td>'+(last[a.name]?esc(v42D(last[a.name])):'<span class="muted">none</span>')+'</td><td class="num">'+SAR(net[a.name]||0)+'</td></tr>';}).join('')+'</tbody></table></div><div class="rowbtns"><button type="button" class="btn danger" id="nyClose">Close selected accounts</button></div>'
      :'<p class="muted" style="margin:8px 0 0">Every open account has an order in the last 12 months.</p>')+'<div class="note" id="nyMsg" role="status" aria-live="polite"></div>';
  Q('nyPeriod').onchange=function(){V42.period=this.value;try{localStorage.setItem('jsp-period',V42.period);}catch(e){}derive(Store.all());refreshSelects();v42Common();setMsg('nyMsg','b-good','Dashboard now shows '+(V42.period==='all'?'all periods':'year '+esc(V42.period))+'.');};
  n.onchange=function(e){if(e.target.classList.contains('ny-cb')){V42.ny.sel[e.target.value]=e.target.checked;V42.ny.dirty=Object.keys(V42.ny.sel).some(function(k){return V42.ny.sel[k];});}};
  var cb=Q('nyClose');if(cb)cb.onclick=function(){
    var blk=v42Block();if(blk)return setMsg('nyMsg','b-bad',esc(blk));
    var ids=Object.keys(V42.ny.sel).filter(function(k){return V42.ny.sel[k];}),pick=cand.filter(function(a){return ids.indexOf(a.id)>=0;});
    if(!pick.length)return setMsg('nyMsg','b-review','Tick the accounts you want to close.');
    confirmBox('Close '+pick.length+' account'+(pick.length===1?'':'s')+'?','<p>These accounts will be hidden from lists and the dashboard figures. Orders, deals and history stay.</p><ul class="ap-att">'+pick.map(function(a){return '<li>'+esc(a.name)+'</li>';}).join('')+'</ul>','Close accounts',true).then(function(ok){
      if(!ok)return setMsg('nyMsg','b-review','Not changed.');
      var reason='No orders in the last 12 months (new-year clean-up)',td=localDate();
      commit([{path:'master/accounts',fn:function(b){pick.forEach(function(a){var row=b.rows.filter(function(r){return r.id===a.id;})[0];if(row&&row.active!==false){row.active=false;row.closedAt=td;row.closedReason=reason;}});}}],
        pick.map(function(a){return auditRow('CLOSE_ACCOUNT',a.name,'','active',true,false,reason,a.id+' · closed '+td);})).then(function(){V42.ny.sel={};V42.ny.dirty=false;setMsg('nyMsg','b-good',pick.length+' account(s) closed.');toast(pick.length+' account(s) closed','good');},function(e){setMsg('nyMsg','b-bad',esc(errText(e)));});});};
}
/* ---- restore from backup ---- */
function v42Download(filename,blob){
  return new Promise(function(res){
    function fb(){try{var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},2000);res(true);}catch(e){res(false);}}
    if(window.claude&&typeof window.claude.use==='function'){Promise.resolve(window.claude.use('downloads')).then(function(dl){if(!dl)return fb();
      return dl.save({filename:filename,data:blob}).then(function(){res(true);},function(e){var c=e&&e.code;if(c==='declined'||c==='rate_limited')res(false);else fb();});})['catch'](fb);}else fb();});
}
function v42SafetyBackup(){
  var ts=nowISO().replace(/[-:T.Z]/g,'').slice(0,14),blob=new Blob([JSON.stringify(v42Payload(),null,1)],{type:'application/json'});
  return v42Download(v42Brand().file+'_SafetyBackup_'+ts+'.json',blob).then(function(ok){
    if(ok)return true;
    return confirmBox('Safety copy not saved','<p>The restore needs a copy of your <strong>current</strong> data first, in case you change your mind. It was not saved.</p><p>Try saving it again?</p>','Try again').then(function(again){return again?v42SafetyBackup():false;});});
}
function v42RestoreRender(){
  var Q=function(id){return V42.nodes['restore']?V42.nodes['restore'].querySelector('#'+id):null;},n=v42Node('restore'),R=V42.rs;n._r=1;
  var h='<h3>Restore from backup</h3><p class="note" style="margin-top:0">Pick a file made by “Download backup”. You will see exactly what would change before anything is written. Nothing is deleted. Records that exist now but not in the file are left as they are, except extra order and stock pages for months the file also has (made by big imports): those are emptied, and kept, so the months match the file.</p>'+
    '<div class="field"><label for="rsFile">Backup file (.json)</label><input type="file" id="rsFile" accept=".json,application/json"></div>';
  if(R.err)h+='<div class="banner bad" role="alert">'+esc(R.err)+'</div>';
  if(R.diff){var d=R.diff,more=d.after.lines<d.before.lines||d.after.net<d.before.net-0.005;
    h+='<p><strong>'+esc(R.name)+'</strong></p><div class="kpis" style="margin-bottom:10px"><div class="kpi"><div class="k-label">New records</div><div class="k-val sm">'+INT(d.add.length)+'</div><div class="k-sub">documents added</div></div><div class="kpi"><div class="k-label">Changed</div><div class="k-val sm">'+INT(d.change.length)+'</div><div class="k-sub">documents replaced by the file’s version</div></div><div class="kpi"><div class="k-label">Same</div><div class="k-val sm">'+INT(d.same.length)+'</div><div class="k-sub">no change</div></div><div class="kpi"><div class="k-label">Only here</div><div class="k-val sm">'+INT(d.onlyCurrent.length)+'</div><div class="k-sub">kept untouched</div></div></div>'+
      '<div class="scroll"><table><thead><tr><th></th><th class="num">Order lines</th><th class="num">Executed net (SAR)</th></tr></thead><tbody><tr><td>Now</td><td class="num">'+INT(d.before.lines)+'</td><td class="num">'+SAR(d.before.net)+'</td></tr><tr><td><strong>After restore</strong></td><td class="num">'+INT(d.after.lines)+'</td><td class="num"><strong>'+SAR(d.after.net)+'</strong></td></tr></tbody></table></div>'+
      ((d.empty||[]).length?'<div class="banner warn" role="status" style="margin-top:10px"><strong>Also emptied:</strong> '+INT(d.empty.length)+' extra page'+(d.empty.length===1?'':'s')+' ('+INT(d.emptyRows)+' line'+(d.emptyRows===1?'':'s')+') that are not in this file: '+d.empty.slice(0,6).map(esc).join(', ')+(d.empty.length>6?' …':'')+'. The pages stay but lose their lines, as the file has none there.</div>':'')+
      (more?'<div class="banner warn" role="status" style="margin-top:10px"><strong>Heads up:</strong> this file has fewer order lines or less executed net than your current data. Documents it changes will be replaced by the older version.</div>':'')+
      ((d.add.length||d.change.length||(d.empty||[]).length)?'<details style="margin-top:10px"><summary>Documents that will be written ('+(d.add.length+d.change.length)+')</summary><ul class="ap-att">'+d.add.slice(0,60).map(function(p){return '<li>'+esc(p)+' — new</li>';}).join('')+d.change.slice(0,60).map(function(p){return '<li>'+esc(p)+' — replaced</li>';}).join('')+'</ul></details>':'<p class="muted">Nothing to restore — the file matches your data.</p>')+
      ((d.add.length||d.change.length||(d.empty||[]).length)?'<div class="field" style="margin-top:12px;max-width:320px"><label for="rsType">Type RESTORE to confirm</label><input id="rsType" autocomplete="off" value="'+esc(R.typed)+'"></div><div class="rowbtns"><button type="button" class="btn danger" id="rsGo"'+(R.typed==='RESTORE'&&!R.busy?'':' disabled')+'>Restore now</button></div><div class="note">First, a safety copy of your current data is downloaded. Then documents are written one by one, and the change is logged in the history.</div>':'');}
  h+='<div class="note" id="rsMsg" role="status" aria-live="polite">'+(R.msg||'')+'</div>';
  n.innerHTML=h;
  Q('rsFile').onchange=function(){var f=this.files&&this.files[0];if(!f)return;R.name=f.name;R.err='';R.diff=null;R.docs=null;R.typed='';R.msg='';
    var rd=new FileReader();rd.onload=function(){var obj;try{obj=JSON.parse(String(rd.result));}catch(e){R.err='That file is not a valid backup (it could not be read as JSON).';v42RestoreRender();return;}
      var v=Eng.validateBackup(obj);if(!v.ok){R.err=v.error||'That file is not a valid backup.';v42RestoreRender();return;}
      R.docs=v.docs;R.diff=Eng.backupDiff(Store.all(),v.docs);v42RestoreRender();};
      rd.onerror=function(){R.err='Could not read that file.';v42RestoreRender();};rd.readAsText(f);};
  var ty=Q('rsType');if(ty)ty.oninput=function(){R.typed=this.value;var g=Q('rsGo');if(g)g.disabled=!(R.typed==='RESTORE'&&!R.busy);};
  var go=Q('rsGo');if(go)go.onclick=v42DoRestore;
}
function v42DoRestore(){
  var R=V42.rs;if(R.busy||R.typed!=='RESTORE'||!R.docs||!R.diff)return;
  var blk=v42BlockRestore();if(blk){R.msg='<span class="badge b-bad">Not restored</span> '+esc(blk);v42RestoreRender();return;}
  var wasEmpty=Store.status().mode==='empty';
  R.busy=true;var go=v42Node('restore').querySelector('#rsGo');if(go)go.disabled=true;
  function say(t,k){R.msg=(k?'<span class="badge '+k+'">'+(k==='b-good'?'Done':k==='b-bad'?'Stopped':'Working')+'</span> ':'')+t;var m=v42Node('restore').querySelector('#rsMsg');if(m)m.innerHTML=R.msg;}
  var d=R.diff,paths=d.add.concat(d.change).filter(function(p){return p!=='master/settings';});if(d.add.concat(d.change).indexOf('master/settings')>=0)paths.push('master/settings');
  say(wasEmpty?'The database is empty, so there is nothing to back up first. Restoring…':'Step 1: saving a safety copy of your current data…','b-review');
  (wasEmpty?Promise.resolve(true):v42SafetyBackup()).then(function(ok){
    if(!ok){R.busy=false;say('Restore cancelled — no safety copy was saved, so nothing was changed.','b-bad');v42RestoreRender();return;}
    var i=0,done=0;
    function putOne(p,retry){return Store.get(p).then(function(cur){return Store.restoreDoc(p,v42Clone(R.docs[p]),cur?(cur.updatedAt||''):null);})['catch'](function(e){if(e&&e.code==='conflict'&&!retry)return putOne(p,true);throw e;});}
    function next(){if(i>=paths.length)return Promise.resolve();var p=paths[i++];say('Restoring '+i+' of '+paths.length+' — '+esc(p),'b-review');return putOne(p).then(function(){done++;return next();});}
    var ej=0,eps=(d.empty||[]).slice();
    function emptyNext(){if(ej>=eps.length)return Promise.resolve();var p=eps[ej++];say('Emptying extra page '+ej+' of '+eps.length+' — '+esc(p),'b-review');
      function one(retry){return Store.get(p).then(function(cur){if(!cur)return;var b=v42Clone(cur);b.rows=[];return Store.restoreDoc(p,b,cur.updatedAt||'');})['catch'](function(e){if(e&&e.code==='conflict'&&!retry)return one(true);throw e;});}
      return one().then(emptyNext);}
    return next().then(emptyNext).then(function(){
      return v42Audit([auditRow('RESTORE','','','docs','',done+' document(s) written ('+d.add.length+' new, '+d.change.length+' replaced'+(eps.length?', '+eps.length+' extra page(s) emptied':'')+') · order lines '+d.before.lines+' → '+d.after.lines+' · executed net '+SAR(d.before.net)+' → '+SAR(d.after.net),'Restore from '+R.name,'')]);
    }).then(function(){R.busy=false;R.docs=null;R.diff=null;R.typed='';R.msg='<span class="badge b-good">Done</span> Restored '+done+' document(s) from '+esc(R.name)+'. '+(wasEmpty?'The database was empty, so no safety copy was needed.':'A safety copy of the previous data was downloaded first.');V42.ctx=null;toast('Backup restored · '+done+' document(s)','good');v42RestoreRender();},
      function(e){R.busy=false;R.msg='<span class="badge b-bad">Stopped</span> '+esc(errText(e))+' Documents restored so far: '+done+' of '+paths.length+'. Nothing was deleted; you can run the restore again with the same file.';v42RestoreRender();});
  });
}

/* ==================== new workspace (empty database, no seed) ==================== */
function v42NewWorkspaceDlg(){
  openDialog({title:'Start a new, empty workspace',ok:'Create workspace',danger:true,
    html:'<p><strong>Only continue if you really want a blank workspace</strong> (for example a copy for another company). If this is your live platform and your data seems to have disappeared, do <strong>not</strong> continue — restore a backup instead.</p>'+fld('nwCo','Company name (up to 40 characters)','',{max:40})+fld('nwApp','App name (up to 40 characters)','Sales Platform',{max:40})+fld('nwType','Type START to confirm','',{max:10}),
    onOk:function(md){var co=fv(md,'nwCo'),app=fv(md,'nwApp');if(!co)return 'Enter the company name.';if(!app)return 'Enter the app name.';if(co.length>40||app.length>40)return 'Company and app names can have up to 40 characters each.';if(fv(md,'nwType')!=='START')return 'Type START to confirm.';
      var ts=nowISO(),title=co+' '+app,docs=[['master/brand',{company:co,appName:app,tagline:'',color:'#1f4e79',logo:null}],['master/accounts',{rows:[]}],['master/items',{rows:[]}],['stock/config',{startedAt:null,leadDays:7,lowCoverDays:14,horizonDays:30,reserveQuoted:true}],
        ['audit/'+localDate().slice(0,7),{rows:[auditRow('NEW_WORKSPACE','','','workspace','',title,'New empty workspace created','')]}],['master/settings',{app:title,schema:1,statusList:STATUSES.slice(),createdAt:ts}]];
      var i=0,made=0;
      /* idempotent: a document that already exists is kept, only missing ones are created; settings last, so a retry after a failure finishes the job */
      function next(){if(i>=docs.length)return Promise.resolve();var d=docs[i++];
        return Store.get(d[0]).then(function(cur){if(cur&&d[0]==='master/settings')throw new Error(changed);if(cur)return next();return Store.restoreDoc(d[0],d[1],null).then(function(){made++;return next();});});}
      var changed='This database changed in the meantime: a workspace already exists, so nothing more was created and nothing was overwritten.';
      return Store.get('master/settings').then(function(cur){if(cur)throw new Error(changed);return next();}).then(function(){toast('New workspace created','good');},function(e){if(e&&e.message===changed)throw e;throw new Error(errText(e)+' Parts that were already created are kept. Press “Create workspace” again to finish.');});}});
}
function v42BannerHook(){var b=$('nwBtn');if(b)b.onclick=v42NewWorkspaceDlg;}

/* ==================== Excel: extra sheets ==================== */
function v42Sheets(S){
  if(!v42Ok())return;
  try{
    var c=Eng.ctx(Store.all(),localDate()),own=Eng.ownStock(c),hf={};Eng.predictions(c).rows.forEach(function(p){if(p.status!=='lapsed'&&p.confidence!=='low')hf[p.itemId]=1;});
    S.push({n:'Stock',x:xSheet([{h:'item_id',w:9},{h:'item',w:38},{h:'status',w:11},{h:'on_hand',t:'int',w:9},{h:'reserved',t:'int',w:9},{h:'available',t:'int',w:9},{h:'daily_use',w:9},{h:'cover_days',t:'int',w:10},{h:'expected',t:'int',w:9},{h:'projected',t:'int',w:9},{h:'baseline_qty',t:'int',w:11},{h:'baseline_at',w:22},{h:'receipts',t:'int',w:9},{h:'adjustments',t:'int',w:11},{h:'shipped',t:'int',w:9},{h:'last_count',w:22}],
      own.rows.map(function(r){return [r.itemId,r.item,r.status,r.onHand,r.reserved,r.available,r.dailyUse,r.coverDays,(hf[r.itemId]?r.expected:null),r.projected,r.baseQty,r.baseTs,r.receipts,r.adjust,r.shipped,r.lastCountTs];}))});
    S.push({n:'Stock moves',x:xSheet([{h:'id',w:9},{h:'ts',w:22},{h:'date',t:'date',w:11},{h:'type',w:9},{h:'scope',w:7},{h:'account',w:22},{h:'account_id',w:9},{h:'item_id',w:9},{h:'item',w:38},{h:'qty',t:'int',w:8},{h:'notes',w:30},{h:'by',w:8}],
      (c.moves||[]).map(function(m){return [m.id,m.ts,m.date,m.type,m.scope,m.account,m.accountId,m.itemId,m.item,m.qty,m.notes,m.by];}))});
    var tk=Object.keys(c.targets||{}).sort();
    if(tk.length){var rows=[];tk.forEach(function(k){var d=c.targets[k];(d.rows||[]).forEach(function(r){var a=c.acctById[r.a]||{},i=c.itemById[r.i]||{};rows.push([k,a.name||r.a,r.a,r.i,i.name||r.i,r.t,d.total]);});});
      S.push({n:'Targets',x:xSheet([{h:'month',w:9},{h:'account',w:24},{h:'account_id',w:10},{h:'item_id',w:9},{h:'item',w:38},{h:'target_sar',t:'money',w:12},{h:'month_total_sar',t:'money',w:14}],rows)});}
  }catch(e){if(window.console)console.error(e);}
}
/* the Excel export always covers ALL lines: scope is switched off while it is built */
function buildXlsx(){var save=V42.all;V42.all=true;derive(Store.all());try{return buildXlsx0();}finally{V42.all=save;derive(Store.all());}}

/* ==================== boot ==================== */
RENDER.today=renderToday;RENDER.stock=renderStock;RENDER.targets=renderTargets;
RENDER.dashboard=function(){renderKpis();renderRecon();drawCharts();v42ScopeNote();};
RENDER.data=function(){renderDataView();v42DataExtras();};
v42WireToday();v42WireStock();
Store.subscribe(function(){V42.ctx=null;});
window.__v42={V42:V42,Eng:(typeof Eng!=='undefined'?Eng:null),ctx:function(){return v42Ctx();},own:function(){return v42Own();},preds:function(){return v42Preds();},alerts:function(){return v42Alerts();},brand:v42Brand,draft:v42Draft,scope:function(){return {net:totalNet,lines:exec.length,all:M.execNetAll};}};

/* ==================== V43: xlsx reader, import engine, simple screens ==================== */
var XlsxRead=(function(){"use strict";
  var MAX_ROWS=1048576,MAX_COLS=16384,MAX_BYTES=100*1024*1024,TOO_BIG='This file is too large or damaged. Save only the sheet you need as a new .xlsx or CSV and try again.';
  function err(code,msg){var e=new Error(msg);e.code=code;return e;}
  function u8(b){return b instanceof Uint8Array?b:new Uint8Array(b);}
  function rd16(a,o){return a[o]|(a[o+1]<<8);}function rd32(a,o){return (a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24))>>>0;}
  function unzip(buf){ /* central directory */
    var a=u8(buf),n=a.length,eocd=-1,i;
    if(n<22||a[0]!==0x50||a[1]!==0x4b)throw err('not_xlsx','This is not an Excel (.xlsx) file.');
    for(i=n-22;i>=Math.max(0,n-65557);i--){if(rd32(a,i)===0x06054b50){eocd=i;break;}}
    if(eocd<0)throw err('bad_zip','The Excel file looks damaged.');
    var cnt=rd16(a,eocd+10),off=rd32(a,eocd+16),files={},total=0;
    for(i=0;i<cnt;i++){
      if(rd32(a,off)!==0x02014b50)throw err('bad_zip','The Excel file looks damaged.');
      var method=rd16(a,off+10),csize=rd32(a,off+20),usize=rd32(a,off+24),nl=rd16(a,off+28),xl=rd16(a,off+30),cl=rd16(a,off+32),lho=rd32(a,off+42);
      var name=new TextDecoder().decode(a.subarray(off+46,off+46+nl));
      var lnl=rd16(a,lho+26),lxl=rd16(a,lho+28),start=lho+30+lnl+lxl;
      total+=usize;if(total>MAX_BYTES)throw err('too_big',TOO_BIG);
      files[name]={method:method,data:a.subarray(start,start+csize)};
      off+=46+nl+xl+cl;
    }
    return files;
  }
  function inflate(f,acct){
    if(f.method===0){acct.n+=f.data.length;if(acct.n>MAX_BYTES)return Promise.reject(err('too_big',TOO_BIG));return Promise.resolve(f.data);}
    if(f.method!==8)return Promise.reject(err('bad_zip','Unsupported compression in the Excel file.'));
    if(typeof DecompressionStream==='undefined')return Promise.reject(err('no_inflate','This browser cannot open .xlsx files. Save the sheet as CSV and import that.'));
    try{
      var ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter(),rdr=ds.readable.getReader(),parts=[],size=0;
      w.write(f.data).catch(function(){});w.close().catch(function(){});
      var pump=function(){return rdr.read().then(function(r){
        if(r.done){var out=new Uint8Array(size),o=0,i;for(i=0;i<parts.length;i++){out.set(parts[i],o);o+=parts[i].length;}return out;}
        size+=r.value.length;acct.n+=r.value.length;
        if(acct.n>MAX_BYTES){try{rdr.cancel();}catch(e){}throw err('too_big',TOO_BIG);}   /* a zip bomb is stopped while it is being unpacked */
        parts.push(r.value);return pump();});};
      return pump().then(function(b){return b;},function(e){if(e&&e.code==='too_big')throw e;throw err('bad_zip','The Excel file looks damaged.');});
    }catch(e){return Promise.reject(err('bad_zip','The Excel file looks damaged.'));}
  }
  function text(f,acct){return inflate(f,acct).then(function(b){return new TextDecoder().decode(b);});}
  function unesc(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,function(m,d){return String.fromCharCode(+d);}).replace(/&#x([0-9a-f]+);/gi,function(m,h){return String.fromCharCode(parseInt(h,16));}).replace(/&amp;/g,'&');}
  function xdec(s){return s.replace(/_x([0-9a-fA-F]{4})_/g,function(m,h){return String.fromCharCode(parseInt(h,16));});}
  function attr(tag,name){var m=new RegExp('\\s'+name+'="([^"]*)"').exec(tag);return m?unesc(m[1]):null;}
  function tTexts(xml){var out=[],re=/<t(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/t>)/g,m;while((m=re.exec(xml)))out.push(m[1]==null?'':xdec(unesc(m[1])));return out.join('');}
  function shared(xml){var out=[],re=/<si>([\s\S]*?)<\/si>|<si\/>/g,m;while((m=re.exec(xml)))out.push(m[1]==null?'':tTexts(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g,'')));return out;}
  function colIdx(ref){var m=/^([A-Z]+)/.exec(ref||''),n=0,i;if(!m)return -1;if(m[1].length>3)throw err('too_big',TOO_BIG);for(i=0;i<m[1].length;i++)n=n*26+(m[1].charCodeAt(i)-64);if(n>MAX_COLS)throw err('too_big',TOO_BIG);return n-1;}
  function dateStyles(stylesXml){ /* style index -> isDate */
    var fmts={},pfmt={},m,re=/<numFmt\s[^>]*>/g;while((m=re.exec(stylesXml||''))){var id=+attr(m[0],'numFmtId'),code=(attr(m[0],'formatCode')||'').toLowerCase().replace(/"[^"]*"|\[[^\]]*\]/g,'');fmts[id]=/[dy]/.test(code);pfmt[id]=code.indexOf('%')>=0;}
    var pl=[],cx=/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml||''),list=[];list.pct=pl;if(!cx)return list;
    var re2=/<xf\s[^>]*?(?:\/>|>)/g;while((m=re2.exec(cx[1]))){var nid=+(attr(m[0],'numFmtId')||0);var dt=(nid>=14&&nid<=17)||nid===22||!!fmts[nid];list.push(dt);pl.push(!dt&&(nid===9||nid===10||!!pfmt[nid]));}
    return list;
  }
  function serialToDate(n,date1904){var ms=Math.round((n-25569+(date1904?1462:0))*86400000),d=new Date(ms);return d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2);}
  /* a cell shown as a percentage in Excel (0.65 shown as 65%) is handed over as the text Excel shows, so 100% is never mistaken for a bare 1 */
  function pctText(n){return String(Math.round(n*100*1e6)/1e6)+'%';}
  function sheetRows(xml,ss,isDate,d1904){
    var rows=[],rm,rre=/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    while((rm=rre.exec(xml))){
      var rattr=rm[1]||'',rn=+(attr('<x '+rattr,'r')||rows.length+1),row=[];
      if(!(rn>=1)||rn!==Math.floor(rn)||rn>MAX_ROWS)throw err('too_big',TOO_BIG);
      while(rows.length<rn-1)rows.push([]);
      var body=rm[2]||'',cm,cre=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      while((cm=cre.exec(body))){
        var ca='<x '+cm[1],ref=attr(ca,'r'),t=attr(ca,'t'),s=+(attr(ca,'s')||0),inner=cm[2]||'',ci=ref?colIdx(ref):row.length,v=null;
        var vm=/<v>([\s\S]*?)<\/v>/.exec(inner);
        if(t==='s')v=vm?(ss[+vm[1]]==null?'':ss[+vm[1]]):null;
        else if(t==='inlineStr')v=tTexts(inner);
        else if(t==='str'||t==='e')v=vm?xdec(unesc(vm[1])):null;
        else if(t==='d')v=vm?unesc(vm[1]).replace(/^\s+/,'').slice(0,10):null;
        else if(t==='b')v=vm?vm[1]==='1':null;
        else if(vm){var num=parseFloat(vm[1]);v=isFinite(num)?(isDate[s]&&num>=1?serialToDate(num,d1904):(isDate.pct&&isDate.pct[s]?pctText(num):num)):unesc(vm[1]);}
        if(ci<0||ci>=MAX_COLS)throw err('too_big',TOO_BIG);
        while(row.length<ci)row.push(null);row[ci]=v;
      }
      while(row.length&&(row[row.length-1]===null||row[row.length-1]===''))row.pop();
      rows.push(row);
    }
    while(rows.length&&rows[rows.length-1].length===0)rows.pop();
    return rows;
  }
  function read(buf,filename){
    var a=u8(buf);
    if(/\.csv$|\.txt$/i.test(filename||'')){var t=new TextDecoder().decode(a);var rows=parseCsv(t);if(!rows.length)return Promise.reject(err('empty','The file is empty.'));
      var res={sheets:[{name:filename||'CSV',rows:rows}]};
      if(t.indexOf('\uFFFD')>=0)res.warning='Some characters in this file could not be read. It is probably not saved as UTF-8: in Excel use Save As \u2192 \u201cCSV UTF-8\u201d and import that file.';
      return Promise.resolve(res);}
    var files;try{files=unzip(a);}catch(e){return Promise.reject(e);}
    if(!files['xl/workbook.xml'])return Promise.reject(err('not_xlsx','This is not an Excel (.xlsx) file. Old .xls files: open in Excel and save as .xlsx or CSV.'));
    var acct={n:0},get=function(p){return files[p]?text(files[p],acct):Promise.resolve('');};
    return Promise.all([get('xl/workbook.xml'),get('xl/_rels/workbook.xml.rels'),get('xl/sharedStrings.xml'),get('xl/styles.xml')]).then(function(r){
      var wb=r[0],rels=r[1],ss=shared(r[2]),isDate=dateStyles(r[3]),d1904=/<workbookPr\b[^>]*\sdate1904="(?:1|true)"/.test(wb),relMap={},m,re=/<Relationship\s[^>]*>/g;
      while((m=re.exec(rels))){relMap[attr(m[0],'Id')]=attr(m[0],'Target');}
      var sheets=[],sre=/<sheet\s[^>]*>/g;
      while((m=sre.exec(wb))){var nm=attr(m[0],'name'),rid=attr(m[0],'r:id'),tg=relMap[rid]||'';tg=tg.replace(/^\/?xl\//,'').replace(/^\//,'');sheets.push({name:nm,path:'xl/'+tg});}
      return Promise.all(sheets.map(function(s){return get(s.path).then(function(x){return {name:s.name,rows:sheetRows(x,ss,isDate,d1904)};});}));
    }).then(function(sh){if(!sh.length)throw err('empty','The workbook has no sheets.');return {sheets:sh};});
  }
  /* the separator is the one that splits the first lines the most consistently (a title line above the table does not decide it) */
  function fieldCount(line,d){var n=1,q=false,i,c;for(i=0;i<line.length;i++){c=line[i];if(c==='"')q=!q;else if(!q&&c===d)n++;}return n;}
  function detectDelim(text){
    var lines=text.split(/\r?\n/),use=[],i,c,best=',',bs=-1,ds=[',',';','\t','|'],k,cnt,mode,hit,seen;
    for(i=0;i<lines.length&&use.length<10;i++){if(lines[i].replace(/[\s,;|]/g,'')!=='')use.push(lines[i]);}
    for(k=0;k<ds.length;k++){cnt={};mode=0;hit=0;
      for(i=0;i<use.length;i++){c=fieldCount(use[i],ds[k])-1;if(c>0)cnt[c]=(cnt[c]||0)+1;}
      for(seen in cnt){if(cnt[seen]>hit||(cnt[seen]===hit&&+seen>mode)){hit=cnt[seen];mode=+seen;}}
      if(hit*1000+mode>bs){bs=hit*1000+mode;best=ds[k];}}
    return best;}
  function parseCsv(text){
    text=String(text||'').replace(/^\uFEFF/,'');
    var d=detectDelim(text);
    var rows=[],row=[],cell='',q=false,i,c;
    for(i=0;i<text.length;i++){c=text[i];
      if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}
      else if(c==='"')q=true;else if(c===d){row.push(cell);cell='';}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;if(row.length||cell!=='')row.push(cell);rows.push(row);row=[];cell='';}
      else cell+=c;}
    if(cell!==''||row.length){row.push(cell);rows.push(row);}
    while(rows.length&&rows[rows.length-1].join('')==='')rows.pop();
    return rows;
  }
  return {read:read,parseCsv:parseCsv,serialToDate:serialToDate};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=XlsxRead;

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
function round2(x){return Math.round(x*100)/100;}
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
  if(typeof require==='function'){try{return require('./v42_engine.js');}catch(e){}}
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
    var r=typeof S.opts.price==='function'?S.opts.price(row.account.name,row.item.name):null;
    if(!r||typeof r.pct!=='number'||!isFinite(r.pct)||r.pct<0||r.pct>1)return fail(row,'No price rule (REVIEW)');
    p=r.pct;src=r.src;
  }
  row.data={date:dt,status:st,qty:q.qty,pct:p,src:src,rsp:rsp,net:round2(q.qty*rsp*(1-p)),netExact:q.qty*(rsp*(1-p)),notes:note(c('notes'))};
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
  row.data={pct:p,from:from,rsp:rsp,net:round2(rsp*(1-p)),notes:note(c('notes')),current:cur?cur.id:null};
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

/* ==================== V43 UI — one simple Stock screen ====================
   ES5, runs inside the app closure after the V42 views. Replaces the "My stock" tab with one table: type what you have, press Save.
   Customers' stock, History and Settings are the V42 tabs, unchanged. Every write goes through v42WriteMoves (one stock doc write + audit).
   Nothing typed is ever saved as 0: a blank box means "no change", never zero. */
var V43={q:'',f:'all',more:false,edits:{},busy:false,msg:null,wired:false};
var V43_STAT={ok:['b-good','OK'],low:['b-review','Low'],short:['b-review','Will run short'],out:['b-bad','Out'],negative:['b-bad','Recount needed'],untracked:['b-off','Not tracked yet']};
var V43_TABS=[['own','My stock','skOwn'],['acct',"Customers' stock",'skAcct'],['moves','History','skHistory'],['setup','Set up & settings','skSetup']];
var V43_QTY_MSG='Use a whole number, 0 or more (no minus sign, no decimals).';

function v43Blank(v){return String(v==null?'':v).trim()==='';}
function v43DirtyIds(){return Object.keys(V43.edits).filter(function(k){return !v43Blank(V43.edits[k]);});}
function v43Dirty(){return v43DirtyIds().length>0;}
function v43Qty(s){var q=v42Int(s);return (isFinite(q)&&q>=0&&q<=10000000)?q:NaN;}
/* a refusal or a failed save: message above the table, a warning toast (replaces any green one), and the message scrolled into view */
function v43Fail(kind,html){v43Msg(kind,html);toast(html,'warn');
  var m=$('skMsg');if(m&&m.getBoundingClientRect){var r=m.getBoundingClientRect(),h=window.innerHeight||document.documentElement.clientHeight;
    if(r.top<0||r.bottom>h){try{m.scrollIntoView({block:'center'});}catch(e){m.scrollIntoView();}}}}
function v43Msg(kind,html){V43.msg=html?{kind:kind,html:html}:null;var el=$('skMsg');if(el){if(html)setMsg('skMsg',kind,html);else el.innerHTML='';}}

function v43Tabs(){
  return '<div class="tabs" role="tablist" aria-label="Stock sections">'+V43_TABS.map(function(x){var on=V42.st.tab===x[0];
    return '<button type="button" id="'+x[2]+'" role="tab" data-sttab="'+x[0]+'" aria-selected="'+on+'" aria-current="'+on+'">'+x[1]+'</button>';}).join('')+'</div>';
}

function v43Focus(){var a=document.activeElement,el=$('stockBody');if(!a||!el||!el.contains(a))return null;
  var c=a.classList;if(c&&a.getAttribute('data-item')){if(c.contains('sk-qty'))return {cls:'sk-qty',item:a.getAttribute('data-item')};if(c.contains('sk-save'))return {cls:'sk-save',item:a.getAttribute('data-item')};if(c.contains('sk-adj'))return {cls:'sk-adj',item:a.getAttribute('data-item')};}
  if(a.id)return {id:a.id};return null;}
/* a number box that was rebuilt gets its caret at the end (number inputs have no selection API, so switch to text for a moment) */
function v43CaretEnd(t){try{var ty=t.type,n=t.value.length;t.type='text';t.setSelectionRange(n,n);t.type=ty;}catch(e){}}
function v43Restore(k){if(!k)return;var el=$('stockBody'),t=null;if(!el)return;
  if(k.cls){var all=el.querySelectorAll('.'+k.cls);for(var i=0;i<all.length;i++){if(all[i].getAttribute('data-item')===k.item){t=all[i];break;}}}
  else t=$(k.id);
  if(t&&t.focus&&t!==document.activeElement)try{t.focus();if(k.cls==='sk-qty')v43CaretEnd(t);}catch(e){}}

/* ---- the screen ---- */
function v43RenderStock(){
  var el=$('stockBody');if(!el)return;
  if(!v42Ok()){el.innerHTML='<div class="card"><p class="muted">The planning engine did not load. Reload the page.</p></div>';return;}
  v44StockTag();if(!v44On()){v44RenderStock();return;}
  var S=V42.st;if(S.tab==='setup'&&S.dirty&&el.querySelector('#suList'))return; /* keep what is being typed in the V42 grid */
  var keep=v43Focus();
  if(S.tab==='own'&&el.getAttribute('data-sk')==='own'&&$('skList')&&$('skFilter')){ /* same screen: refresh the parts, keep #skMsg, the counters and the bar as the same nodes */
    try{v43Refresh();}catch(e2){el.setAttribute('data-sk','');el.innerHTML=v43Tabs()+v42Err('Stock',e2);}
    v43Restore(keep);return;}
  try{
    var h=v43Tabs();
    if(S.tab==='own')h+=v43Own();else if(S.tab==='acct')h+=v42StockAcct();else if(S.tab==='moves')h+=v42StockMoves();else h+=v42StockSetup();
    el.innerHTML=h;el.setAttribute('data-sk',S.tab==='own'?'own':'');
    if(S.tab==='own'){v43List();if(V43.msg)setMsg('skMsg',V43.msg.kind,V43.msg.html);}else if(S.tab==='acct')v42AcctList();else if(S.tab==='moves')v42MovesList();else v42SetupList();
  }catch(e){el.setAttribute('data-sk','');el.innerHTML=v43Tabs()+v42Err('Stock',e);}
  v43Restore(keep);
}
function v43Chips(){
  var sm=v42Own().summary||{},rows=v42Own().rows,attn=(sm.out||0)+(sm.short||0)+(sm.low||0)+(sm.negative||0);
  return [['all','All',rows.length],['attention','Needs attention',attn],['tracked','Tracked',sm.tracked||0],['untracked','Not tracked',sm.untracked||0]];
}
function v43HelpText(){var sm=v42Own().summary||{};
  return 'Type what is on your shelf in the <strong>Update</strong> column and press <strong>Save</strong>. Leave a box empty to change nothing. '+
    (sm.untracked?'Items with no number yet stay “Not tracked yet” (never shown as 0). Stock counts from the number you save; orders saved before then are not deducted.':'');}
function v43Refresh(){
  var btns=$('skFilter').querySelectorAll('button[data-skf]'),ch=v43Chips(),i,j;
  for(i=0;i<btns.length;i++){for(j=0;j<ch.length;j++){if(ch[j][0]===btns[i].getAttribute('data-skf')){btns[i].setAttribute('aria-pressed',String(V43.f===ch[j][0]));var n=btns[i].querySelector('.n');if(n)n.textContent=INT(ch[j][2]);}}}
  var hp=$('skHelp');if(hp)hp.innerHTML=v43HelpText();
  v43List();
}
function v43Own(){
  var chips=v43Chips();
  var up=typeof v43OpenImport==='function',tp=typeof v43Template==='function';
  return '<div class="card sk-top"><div class="sk-actions">'+
      '<button type="button" class="btn" id="skReceive">Receive a delivery</button>'+
      (up?'<button type="button" class="btn ghost" id="skUpload">Upload from Excel</button>':'')+
      (tp?'<button type="button" class="btn ghost" id="skTemplate">Download Excel sheet</button>':'')+
      '<button type="button" class="btn ghost" id="skMore" aria-pressed="'+V43.more+'">'+(V43.more?'Hide details':'More details')+'</button></div>'+
    '<div class="sk-find"><div class="st-chips" id="skFilter" role="group" aria-label="Show items">'+chips.map(function(c){return '<button type="button" class="st-chip" data-skf="'+c[0]+'" aria-pressed="'+(V43.f===c[0])+'">'+c[1]+' <span class="n">'+INT(c[2])+'</span></button>';}).join('')+'</div>'+
      '<div class="field"><label for="skSearch">Search items</label><input id="skSearch" type="search" placeholder="Item name…" autocomplete="off" value="'+esc(V43.q)+'"></div></div>'+
    '<p class="note sk-help" id="skHelp">'+v43HelpText()+'</p></div>'+
    '<div class="card sk-card"><div id="skMsg" class="sk-msg" role="status" aria-live="polite"></div><div id="skList"><div class="pr-status" id="skCount" role="status" aria-live="polite"></div><div id="skScroll"></div></div>'+
    '<div class="sk-bar" id="skBar"><span id="skBarTxt" class="sk-bartxt" role="status" aria-live="polite"></span><button type="button" class="btn" id="skSaveAll">Save all changed</button></div></div>';
}
function v43Filtered(){
  var q=V43.q.trim().toLowerCase(),rows=v42Own().rows.filter(function(r){
    if(q&&String(r.item).toLowerCase().indexOf(q)<0)return false;
    if(V43.f==='tracked')return r.tracked;if(V43.f==='untracked')return !r.tracked;
    if(V43.f==='attention')return r.status==='out'||r.status==='short'||r.status==='low'||r.status==='negative';return true;});
  rows.sort(function(a,b){return String(a.item).localeCompare(String(b.item));});
  return rows;
}
function v43List(){
  var el=$('skList');if(!el)return;
  var rows=v43Filtered(),cfg=v42Ctx().config||{},more=V43.more,hasFc={};
  v42Preds().rows.forEach(function(p){if(p.status!=='lapsed'&&p.confidence!=='low')hasFc[p.itemId]=1;}); /* an expected number only where the forecast is reliable */
  var cnt=$('skCount'),sc=$('skScroll');if(!cnt||!sc)return;
  if(!rows.length){cnt.textContent='';sc.innerHTML='<p class="muted" style="margin:0">'+(V43.f==='all'&&!V43.q.trim()?'No items yet.':'No items match. Clear the search or pick “All”.')+'</p>';v43Bar();return;}
  var key=(more?'1':'0')+'|'+(cfg.horizonDays||30),tb=sc.querySelector('#skTable tbody');
  cnt.textContent='Showing '+rows.length+' item'+(rows.length===1?'':'s');
  if(tb&&sc.getAttribute('data-key')===key&&v43Patch(tb,rows,more,hasFc)){v43Bar();return;} /* same rows: update the cells in place, never replace a box someone is typing in */
  var head='<th>Item</th><th class="num">You have</th><th class="num">On order (reserved)</th><th class="num">Left</th>'+(more?'<th class="num">Daily use</th><th class="num">Cover days</th><th class="num">Expected '+(cfg.horizonDays||30)+' d</th>':'')+'<th>Status</th><th>Update</th>';
  sc.setAttribute('data-key',key);
  sc.innerHTML='<div class="sk-scroll"><table class="sk-table" id="skTable"><thead><tr>'+head+'</tr></thead><tbody>'+rows.map(function(r){return v43RowHtml(r,more,hasFc);}).join('')+'</tbody></table></div>';
  v43Bar();
}
function v43RowHtml(r,more,hasFc){
  var id=esc(r.itemId),lab=esc(r.item),nm=esc(v42ItemShort(r.item)),val=V43.edits[r.itemId],dirty=val!=null&&!v43Blank(val),t=r.tracked,m=V43_STAT[r.status]||V43_STAT.untracked;
  var cells='<td class="sk-item" title="'+lab+'"><span class="sk-name">'+nm+'</span>'+(t?' <button type="button" class="sk-adj" data-item="'+id+'" aria-label="Adjust stock of '+lab+'">Adjust</button>':'')+'</td>'+
    '<td class="num" data-label="You have">'+(t?INT(r.onHand):'')+'</td><td class="num" data-label="On order (reserved)">'+(t?INT(r.reserved):'')+'</td><td class="num" data-label="Left">'+(t?'<strong>'+INT(r.available)+'</strong>':'')+'</td>';
  if(more)cells+='<td class="num" data-label="Daily use">'+(t?(r.dailyUse==null?'<span class="muted">—</span>':v42Num(r.dailyUse,1)):'')+'</td><td class="num" data-label="Cover days">'+(t?(r.coverDays==null?'<span class="muted">—</span>':INT(r.coverDays)):'')+'</td><td class="num" data-label="Expected">'+(t?(r.expected!=null&&hasFc[r.itemId]?INT(r.expected):'<span class="muted" title="no reliable forecast">—</span>'):'')+'</td>';
  cells+='<td class="sk-st" data-label="Status">'+v42Chip(m[0],m[1])+'</td>'+
    '<td class="sk-upd"><input class="sk-qty" type="number" min="0" step="1" inputmode="numeric" data-item="'+id+'" placeholder="'+(t?'new count':'count')+'" value="'+esc(val==null?'':val)+'" aria-label="'+(t?'New count for ':'Opening count for ')+lab+'">'+
    '<button type="button" class="btn sm sk-save" data-item="'+id+'" aria-label="Save '+lab+'">Save</button><span class="sk-flag" role="note"'+(dirty?'':' hidden')+'>not saved yet</span></td>';
  return '<tr data-item="'+id+'"'+(dirty?' class="sk-dirty"':'')+'>'+cells+'</tr>';
}
function v43Patch(tb,rows,more,hasFc){
  var trs=tb.children,i,c,tmp=document.createElement('tbody'),html='';
  if(trs.length!==rows.length)return false;
  for(i=0;i<rows.length;i++){if(trs[i].getAttribute('data-item')!==rows[i].itemId)return false;html+=v43RowHtml(rows[i],more,hasFc);}
  tmp.innerHTML=html;
  if(tmp.children.length!==trs.length)return false;
  for(i=0;i<trs.length;i++){if(trs[i].children.length!==tmp.children[i].children.length)return false;}
  for(i=0;i<trs.length;i++){
    var tr=trs[i],nt=tmp.children[i];
    for(c=0;c<tr.children.length;c++){var cell=tr.children[c],nc=nt.children[c];
      if(cell.classList.contains('sk-upd'))v43PatchUpd(cell,nc,tr.getAttribute('data-item'));
      else if(cell.innerHTML!==nc.innerHTML)cell.innerHTML=nc.innerHTML;}
    tr.classList.toggle('sk-dirty',nt.classList.contains('sk-dirty'));
  }
  return true;
}
function v43PatchUpd(cell,nc,id){
  var inp=cell.querySelector('.sk-qty'),ni=nc.querySelector('.sk-qty'),fl=cell.querySelector('.sk-flag'),nf=nc.querySelector('.sk-flag'),want=V43.edits[id]==null?'':String(V43.edits[id]);
  if(inp&&ni){if(inp.getAttribute('placeholder')!==ni.getAttribute('placeholder'))inp.setAttribute('placeholder',ni.getAttribute('placeholder'));
    if(inp.getAttribute('aria-label')!==ni.getAttribute('aria-label'))inp.setAttribute('aria-label',ni.getAttribute('aria-label'));
    if(inp.value!==want)inp.value=want;} /* what the box shows always equals what was typed (V43.edits), except right after that number was saved */
  if(fl&&nf)fl.hidden=nf.hidden;
}
function v43Bar(){
  var n=v43DirtyIds().length,bar=$('skBar'),tx=$('skBarTxt'),b=$('skSaveAll');if(!bar)return;
  bar.classList.toggle('sk-bar-on',n>0);
  if(tx)tx.textContent=n?(n+' number'+(n===1?'':'s')+' typed, not saved yet'):'Nothing changed yet';
  if(b)b.textContent=n?'Save all changed ('+n+')':'Save all changed';
}

/* ---- saving (one v42WriteMoves call, all or nothing) ---- */
function v43SaveIds(ids){
  if(V43.busy)return;
  var map=v42OwnMap(),rows=[],bad='',typed=[],i;
  for(i=0;i<ids.length;i++){var id=ids[i],raw=V43.edits[id];if(v43Blank(raw))continue;typed.push(id);
    var q=v43Qty(raw),r=map[id],im=itemById[id],name=r?r.item:(im?im.name:id);
    if(!isFinite(q)){bad=bad||('Check the number for '+name+'. '+V43_QTY_MSG);continue;}
    rows.push({type:(r&&r.tracked)?'COUNT':'OPEN',scope:'own',itemId:id,item:name,qty:q,notes:(r&&r.tracked)?'System said '+r.onHand:null});}
  if(!typed.length){v43Fail('b-review','Nothing to save: type a number first. Nothing was changed.');return;}
  if(bad){v43Fail('b-bad',esc(bad)+' Nothing was saved.');v43MarkBad(ids);return;}
  var blk=v42Block();if(blk){v43Fail('b-bad',esc(blk));return;}
  var snap={};rows.forEach(function(r){snap[r.itemId]=V43.edits[r.itemId];});
  V43.busy=true;v43Msg('','Saving…');
  v42WriteMoves(rows).then(function(res){
    V43.busy=false;rows.forEach(function(r){if(V43.edits[r.itemId]===snap[r.itemId])delete V43.edits[r.itemId];}); /* a number retyped while saving stays */
    var n=rows.length,txt=n===1?(rows[0].type==='COUNT'?'Count saved':'Opening number saved')+' · '+INT(rows[0].qty)+' · '+esc(v42ItemShort(rows[0].item)):n+' numbers saved';
    v43Msg(res&&res.warn?'b-review':'b-good',res&&res.warn?esc(res.warn):txt+'.');
    v42MovesDone(res,txt);v43RenderStock();
  },function(e){V43.busy=false;v43Fail('b-bad',esc(errText(e))+' Nothing was saved. Your numbers are still here.');});
}
function v43MarkBad(ids){ids.forEach(function(id){var els=document.querySelectorAll('.sk-qty'),i;for(i=0;i<els.length;i++){if(els[i].getAttribute('data-item')===id){var bad=!v43Blank(V43.edits[id])&&!isFinite(v43Qty(V43.edits[id]));if(bad)els[i].setAttribute('aria-invalid','true');else els[i].removeAttribute('aria-invalid');}}});}

/* ---- receive a delivery (item + quantity -> RECEIPT) ---- */
function v43ReceiveDlg(){
  var blk=v42Block();if(blk){toast(esc(blk),'warn');return;}
  var tr=v42Own().rows.filter(function(r){return r.tracked;}).sort(function(a,b){return String(a.item).localeCompare(String(b.item));});
  if(!tr.length){toast('Nothing to receive into yet. First type what you have in the Update column and press Save.','warn');return;}
  var map=v42OwnMap();
  openDialog({title:'Receive a delivery',ok:'Save delivery',
    html:fld('mItem','Item',tr[0].itemId,{options:tr.map(function(r){return {v:r.itemId,l:v42ItemShort(r.item)};})})+fld('mQty','Quantity received (whole number)','',{type:'number',mode:'numeric'})+fld('mDate','Date received',v42Today(),{type:'date'})+fld('mNote','Note (optional, e.g. delivery note number)','',{max:160})+'<div class="note" id="mPrev" aria-live="polite"></div>',
    onInput:function(md){var r=map[fv(md,'mItem')]||{},q=v42Int(fv(md,'mQty'));md.querySelector('#mPrev').textContent=(q>0&&r.tracked)?'You have '+INT(r.onHand)+'. After this delivery: '+INT(r.onHand+q)+'.':(r.tracked?'You have '+INT(r.onHand)+' now.':'');},
    onOk:function(md){var id=fv(md,'mItem'),r=map[id],q=v42Int(fv(md,'mQty')),dt=fv(md,'mDate'),nt=fv(md,'mNote').slice(0,160);
      if(!r||!r.tracked)return 'Choose an item.';
      if(!(q>=1&&q<=10000000))return 'Enter the quantity as a whole number, 1 or more.';
      if(!validDate(dt))return 'Enter a valid date.';if(dt>v42Today())return 'The received date cannot be in the future.';
      return v42WriteMoves([{type:'RECEIPT',scope:'own',itemId:id,item:r.item,qty:q,date:dt,notes:nt||null}]).then(function(res){v42MovesDone(res,'Received '+INT(q)+' · '+esc(v42ItemShort(r.item)));});}});
}

/* ---- wiring (once) ---- */
function v43Wire(){
  var el=$('stockBody');if(!el||V43.wired)return;V43.wired=true;
  /* leaving My stock with typed numbers asks first (runs before the V42 tab handler) */
  el.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-sttab]');
    if(b&&V42.st.tab==='own'&&b.getAttribute('data-sttab')!=='own'&&v43Dirty()){e.stopPropagation();
      confirmBox('Leave this page?','<p>You typed numbers that are not saved yet. If you leave, they are cleared.</p>','Leave without saving',true).then(function(ok){if(ok){V43.edits={};V43.msg=null;V42.st.tab=b.getAttribute('data-sttab');V42.st.savedMsg='';v43RenderStock();}});}
  },true);
  el.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(!b||V42.st.tab!=='own')return;var id=b.getAttribute('data-item');
    if(b.id==='skSaveAll'){v43SaveIds(v43DirtyIds().length?v43DirtyIds():Object.keys(V43.edits));return;}
    if(b.classList.contains('sk-save')){v43SaveIds([id]);return;}
    if(b.classList.contains('sk-adj')){v42MoveDlg('adjust',id);return;}
    if(b.id==='skMore'){V43.more=!V43.more;b.setAttribute('aria-pressed',String(V43.more));b.textContent=V43.more?'Hide details':'More details';v43List();return;}
    if(b.id==='skReceive'){v43ReceiveDlg();return;}
    if(b.id==='skUpload'&&typeof v43OpenImport==='function'){v43OpenImport('stock');return;}
    if(b.id==='skTemplate'&&typeof v43Template==='function'){v43Template('stock');return;}
    if(b.getAttribute('data-skf')){V43.f=b.getAttribute('data-skf');v43RenderStock();return;}
  });
  el.addEventListener('input',function(e){var t=e.target;if(V42.st.tab!=='own')return;
    if(t.id==='skSearch'){V43.q=t.value;v43List();return;}
    if(t.classList&&t.classList.contains('sk-qty')){var id=t.getAttribute('data-item');V43.edits[id]=t.value;t.removeAttribute('aria-invalid');
      var row=t.closest('tr'),d=!v43Blank(t.value);if(row){row.classList.toggle('sk-dirty',d);var fl=row.querySelector('.sk-flag');if(fl)fl.hidden=!d;}v43Bar();}
  });
  el.addEventListener('keydown',function(e){var t=e.target;if(e.key==='Enter'&&t.classList&&t.classList.contains('sk-qty')){e.preventDefault();v43SaveIds([t.getAttribute('data-item')]);}});
}
/* ---------- five sections: Today / Sell / Stock / Customers & prices / Reports & data ----------
   Every page button stays where build.py put it; this only marks which section is current (sidebar: .open, phone: the section row
   and which group of pages is shown). It runs inside show(), so every way of changing page (buttons, links, a restored page) is covered. */
var V43N={secs:[['today',['today']],['sell',['order','orders','forecast']],['stock',['stock','import']],['customers',['accounts','pricing','items']],['reports',['dashboard','targets','data','guide']]],last:{}};
function v43SecOf(v){var i,j;for(i=0;i<V43N.secs.length;i++)for(j=0;j<V43N.secs[i][1].length;j++)if(V43N.secs[i][1][j]===v)return V43N.secs[i][0];return null;}
function v43NavSync(v){
  var s=v43SecOf(v),els,i;if(!s)return;
  V43N.last[s]=v;
  els=document.querySelectorAll('#sideNav .nav-sec');for(i=0;i<els.length;i++)els[i].classList.toggle('open',els[i].id==='nav-'+s);
  els=document.querySelectorAll('#topNav button[data-section]');for(i=0;i<els.length;i++)els[i].setAttribute('aria-current',els[i].getAttribute('data-section')===s?'true':'false');
  els=document.querySelectorAll('#topNav .toppg');for(i=0;i<els.length;i++)els[i].hidden=els[i].getAttribute('data-sec')!==s;}
(function(){var tn=$('topNav');if(!tn)return;
  tn.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-section]'),s,i;if(!b)return;
    s=b.getAttribute('data-section');for(i=0;i<V43N.secs.length;i++)if(V43N.secs[i][0]===s){show(V43N.last[s]||V43N.secs[i][1][0]);return;}});})();
var v43Show00=show;
show=function(v){
  var a=document.querySelector('.view.active'),was=a?a.id:'';
  v43Show00(v);v43NavSync(v);
  if(was&&was!=='view-'+v){try{window.scrollTo(0,0);}catch(e){}}};   /* a different page always starts at its top, with the page row in view */

/* leaving the Stock screen (any way) with typed numbers asks first */
var v43Show0=show;
show=function(v){
  var sv=$('view-stock');
  if(v43Dirty()&&v!=='stock'&&sv&&sv.classList.contains('active')){
    confirmBox('Leave this page?','<p>You typed stock numbers that are not saved yet. If you leave, they are cleared.</p>','Leave without saving',true).then(function(ok){if(ok){V43.edits={};V43.msg=null;v43Show0(v);}});return;}
  v43Show0(v);
};
window.addEventListener('beforeunload',function(e){if(v43Dirty()||V43I.running){e.preventDefault();e.returnValue='';return '';}});

/* ==================== V44 — stock from orders only (ADR-0010) ====================
   With stock entry OFF (the default) the Stock section shows one plain line about own stock and the Customers' stock table,
   worked out from each customer's last order and usual gap (Eng.acctStock + Eng.predictions). Nothing here writes. */
var V44={acct:'',wired:false,tag:null};
var V44_PST={lapsed:['b-bad','Lapsed'],overdue:['b-bad','Overdue'],due:['b-review','Due'],soon:['b-std','Soon'],later:['b-off','Later']};
function v44StockTag(){var t=document.querySelector('#view-stock .h-row .tag');if(!t)return;if(V44.tag==null)V44.tag=t.textContent;
  t.textContent=v44On()?V44.tag:'worked out from each customer’s orders';}
function v44RenderStock(){
  var el=$('stockBody');if(!el)return;
  try{
    var open=D.accounts.filter(function(a){return a.active;}).map(function(a){return a.name;}).sort(function(a,b){return a.localeCompare(b);});
    if(!V44.acct||open.indexOf(V44.acct)<0)V44.acct=open[0]||'';
    el.setAttribute('data-sk','');
    el.innerHTML='<div class="card" style="margin-bottom:14px" id="v44Own"><p style="margin:0">Your own stock isn’t tracked — stock entry is switched off.</p></div>'+
      '<div class="card" id="v44Cust"><h3>Customers’ stock</h3><div class="field" style="max-width:420px"><label for="v44Acct">Account</label><select id="v44Acct">'+
      open.map(function(n){return '<option value="'+esc(n)+'"'+(n===V44.acct?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></div>'+
      '<p class="note">What the customer probably still has, worked out from their last order and their usual gap between orders. Nothing is typed in.</p><div id="v44List"></div></div>';
    v44List();
  }catch(e){el.innerHTML=v42Err('Stock',e);}
  if(!V44.wired){V44.wired=true;el.addEventListener('change',function(e){var t=e.target;if(t&&t.id==='v44Acct'){V44.acct=t.value;v44List();}});}
}
function v44List(){
  var el=$('v44List');if(!el)return;var name=V44.acct;
  if(!name){el.innerHTML='<p class="muted" style="margin:0">No open accounts.</p>';return;}
  var rows=Eng.acctStock(v42Ctx(),name).rows.slice(),next={};
  v42Preds().rows.forEach(function(p){if(p.account===name)next[p.itemId]=p;});
  if(!rows.length){el.innerHTML='<p class="muted" style="margin:0">'+esc(name)+' has no executed orders yet.</p>';return;}
  rows.sort(function(a,b){var x=a.estimated?0:1,y=b.estimated?0:1;return (x-y)||(x===0&&a.runOutDate!==b.runOutDate?(a.runOutDate<b.runOutDate?-1:1):0)||String(a.item).localeCompare(String(b.item));});
  function dash(){return '<span class="muted">—</span>';}
  var n=0;
  el.innerHTML='<div class="scroll"><table class="st-table" id="v44Table"><thead><tr><th>Item</th><th>Last order</th><th class="num">Last qty</th><th class="num">Usual gap (days)</th><th class="num">Est. left now</th><th>Runs out</th><th>Expected order</th></tr></thead><tbody>'+
    rows.map(function(r){var p=next[r.itemId],est=r.estimated===true,ps=p?(V44_PST[p.status]||['b-off',p.status]):null;if(est)n++;
      var exp=p?esc(v42D(p.nextDate))+' '+v42Chip(ps[0],ps[1])+(p.inPipeline?' '+v42Chip('b-good','In pipeline'):''):dash();
      return '<tr data-item="'+esc(r.itemId)+'" data-est="'+(est?'1':'0')+'"><td>'+esc(v42ItemShort(r.item))+(est?'':'<div class="muted" style="font-size:12px">Not enough orders yet</div>')+'</td>'+
        '<td>'+(r.lastDate?esc(v42D(r.lastDate)):dash())+'</td>'+
        '<td class="num">'+(est?INT(r.lastQty):dash())+'</td>'+
        '<td class="num">'+(est?INT(r.interval):dash())+'</td>'+
        '<td class="num">'+(est?'<strong>'+INT(r.estOnHand)+'</strong>':dash())+'</td>'+
        '<td>'+(est?esc(v42D(r.runOutDate)):dash())+'</td>'+
        '<td>'+exp+'</td></tr>';}).join('')+'</tbody></table></div>'+
    '<div class="note">'+INT(n)+' of '+INT(rows.length)+' item'+(rows.length===1?'':'s')+' have an estimate. Est. left now = last order quantity, used up evenly over the usual gap. “—” means not known yet (never 0).</div>';
}
/* the Import page offers "Stock counts" and the stock template only while stock entry is ON (taken out of the page, not just hidden) */
var V44I=null;
function v44SyncImport(){
  var on=v44On(),tb=document.querySelector('#impTypes button[data-imptype="stock"]'),tl=$('impTplStock');
  if(!V44I){if(!tb||!tl)return;V44I={tb:tb,tbNext:tb.nextSibling,tbPar:tb.parentNode,tl:tl,tlNext:tl.nextSibling,tlPar:tl.parentNode};}
  if(on){if(!V44I.tb.parentNode)V44I.tbPar.insertBefore(V44I.tb,V44I.tbNext);if(!V44I.tl.parentNode)V44I.tlPar.insertBefore(V44I.tl,V44I.tlNext);}
  else{if(V44I.tb.parentNode)V44I.tb.parentNode.removeChild(V44I.tb);if(V44I.tl.parentNode)V44I.tl.parentNode.removeChild(V44I.tl);
    if(V43I.type==='stock'&&!V43I.running)v43ISetType(null);}
}

renderStock=v43RenderStock;RENDER.stock=v43RenderStock;v43Wire();

/* ==================== V43 UI — Excel import wizard (stock, orders, items, deals) ====================
   One card per step. The file is read in the browser (XlsxRead), Imp.plan says what would happen to every row, and only the ticked
   rows are written - through the same commit / mutate / v42WriteMoves helpers the rest of the platform uses (expected versions + history rows). */
var V43I={type:null,scope:'own',defStatus:'Executed',name:'',sheets:null,sheet:0,hrow:0,found:true,map:{},plan:null,leftOut:[],picks:{},ticks:{},filter:'all',limit:300,confirming:false,running:false,fileSeq:0,last:null,wired:false};
var V43I_NAMES={stock:'Stock',orders:'Orders',items:'Items',deals:'Deals'};
var V43I_STAT={ready:['b-good','Ready'],update:['b-review','Will update'],'new':['b-good','New'],same:['b-off','Same'],choose:['b-review','Needs choosing'],problem:['b-bad','Problem'],duplicate:['b-review','Duplicate']};
var V43I_CHIPS=[['all','All'],['ready','Ready'],['update','Will update'],['new','New'],['same','Same'],['choose','Needs choosing'],['problem','Problems'],['duplicate','Duplicates']];
var V43I_FLAB={name:'Name',short:'Short name',rsp:'RSP',price2026:'2026 price',std:'Standard discount',category:'Category',form:'Form',strength:'Strength',pack:'Pack',active:'Active'};
var V43I_MAXFILE=25*1024*1024;

function v43IHas(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function v43IMsg(id,kind,html){var el=$(id);if(!el)return;el.className='imp-msg'+(kind?' imp-'+kind:'');el.innerHTML=html||'';}
function v43IP(n){var s=(Math.round(Number(n)*10000)/10000).toFixed(4).replace(/0+$/,''),d=s.length-s.indexOf('.')-1;while(d<2){s+='0';d++;}return s;}   /* 6 -> 6.00, 2.525 -> 2.525 */
function v43IPct(p){return String(Math.round(Number(p)*10000)/100)+'%';}                                       /* 0.5 -> 50% */
function v43ICell(v){return v==null?'':String(v).replace(/\s+/g,' ').replace(/^ | $/g,'');}
function v43IBlank(r){var i;for(i=0;i<r.length;i++){if(v43ICell(r[i])!=='')return false;}return true;}
function v43ILabel(it){return it.name;}
function v43IShow(id,on){var el=$(id);if(el)el.hidden=!on;}

/* ---------- context handed to the import engine ---------- */
function v43ICtx(){derive(Store.all());return Eng.ctx(Store.all(),localDate());}
/* adapt V41's plResolveLine (item NAME or null) to the engine's {item}|{cand:[item...]}|null; items come from the same ctx the plan uses */
function v43IMatch(text,ctx){
  var r=plResolveLine(String(text)),i,out=[],im,it;
  if(!r)return null;
  if(r.state==='ok'&&r.item){im=itemMap[r.item];it=(im&&im.active!==false)?ctx.itemById[im.id]:null;return it?{item:it}:null;}
  if(r.state==='check'){for(i=0;i<r.cand.length;i++){im=itemMap[r.cand[i].name];it=(im&&im.active!==false)?ctx.itemById[im.id]:null;if(it&&out.indexOf(it)<0)out.push(it);}return out.length?{cand:out}:null;}
  return null;}
function v43IOpts(type,scope,def,ctx){
  var o={today:localDate(),eng:Eng};ctx=ctx||v43ICtx();
  if(type==='stock'||type==='orders'||type==='deals')o.matchItem=function(t){return v43IMatch(t,ctx);};
  if(type==='stock'&&scope&&scope!=='own'&&scope!=='*')o.account=scope;
  if(type==='orders'){o.price=function(a,i){return resolve(a,i);};if(def)o.defaultStatus=def;}
  if(type==='items'||type==='deals')o.deals=D.deals.map(function(d){return d._r;});   /* every deals/<ACC> row; only Active ones count as current */
  return o;}

/* ---------- items: the stored fields an import row would set (price2026, stdNet and std always agree, as in the item editor) ---------- */
function v43IItemVals(cur,d){
  var o={},R=d.rsp!=null?d.rsp:cur.rsp,P,tf=['name','short','category','form','strength','pack'],i,okR=R!=null&&R>0;
  for(i=0;i<tf.length;i++)if(d[tf[i]]!=null)o[tf[i]]=d[tf[i]];
  if(d.active!=null)o.active=d.active;
  if(d.rsp!=null)o.rsp=d.rsp;
  if((d.price!=null||d.std!=null)&&!okR){}                                                             /* nothing to compute from: the row is stopped in v43IItemCheck */
  else if(d.price!=null){o.price2026=d.price;o.stdNet=d.price;o.std=1-d.price/R;}                         /* the price sets the standard discount */
  else if(d.std!=null){P=Math.round(R*(1-d.std)*1e6)/1e6;o.std=d.std;o.price2026=P;o.stdNet=P;}      /* only a discount given: the price follows it */
  else if(d.rsp!=null&&okR&&cur.price2026!=null){o.std=1-cur.price2026/R;o.stdNet=cur.price2026;}         /* only the RSP changed: the price stays, the discount follows */
  if(d.rsp!=null&&cur.moh!=null)o.wsp=R*(1-cur.moh);
  return o;}
function v43IGet(cur,k){return k==='active'?cur.active!==false:cur[k];}
function v43ISame(a,b){if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<=1e-9;return (a==null||a==='')?(b==null||b===''):a===b;}
function v43IChanged(cur,fin){var out=[],k;for(k in fin){if(v43IHas(fin,k)&&!v43ISame(v43IGet(cur,k),fin[k]))out.push(k);}return out;}

/* ---------- the plan ---------- */
function v43IBuildPlan(){
  var type=V43I.type,sh=V43I.sheets[V43I.sheet],rows=sh.rows.slice(),map=V43I.map,hrow=V43I.hrow,i,r,k,n,left=[],ctx=v43ICtx(),plan;
  if(type==='stock'&&map.qty!=null){            /* a template has many empty "New quantity" cells: those rows are simply left out, they are not errors */
    for(i=hrow+1;i<rows.length;i++){r=rows[i];if(!r||!r.length)continue;
      if(Imp.num(r[map.qty])===null){if(!v43IBlank(r))left.push(i+1);rows[i]=[];}}}
  for(k in V43I.picks){if(v43IHas(V43I.picks,k)){n=+k;r=(rows[n-1]||[]).slice();r[map.item]=V43I.picks[k];rows[n-1]=r;}}
  plan=Imp.plan(type,rows,{row:hrow,map:map},ctx,v43IOpts(type,V43I.scope,V43I.defStatus,ctx));
  plan.leftOut=left;
  if(plan.error)return plan;
  for(i=0;i<plan.rows.length;i++){r=plan.rows[i];
    if(type==='stock'&&V43I.scope==='*'&&(r.status==='new'||r.status==='update'||r.status==='same')&&r.data.scope==='own'){r.status='problem';r.msg='No customer is named in this row';r.include=false;}
    if(type==='items'&&(r.status==='new'||r.status==='update'))v43IItemCheck(r);}
  v43ICount(plan);
  return plan;}
function v43ICount(plan){var c={ready:0,update:0,'new':0,same:0,choose:0,problem:0,duplicate:0},i;for(i=0;i<plan.rows.length;i++)c[plan.rows[i].status]++;plan.counts=c;}
function v43IItemCheck(r){
  var cur=r.item?r.item:{},fin=v43IItemVals(cur,r.data),R=r.data.rsp!=null?r.data.rsp:cur.rsp;
  r.fin=fin;
  if((r.data.price!=null||r.data.std!=null)&&!(R!=null&&R>0)){r.status='problem';r.msg='Set the RSP first (this item has none, so a price or discount cannot be worked out)';r.include=false;return;}
  if(r.data.rsp!=null&&!(r.data.rsp>0)){r.status='problem';r.msg='The RSP must be more than 0';r.include=false;return;}
  if(fin.price2026!=null&&R!=null&&fin.price2026>R+1e-9){r.status='problem';r.msg='The 2026 price is above the RSP';r.include=false;return;}
  if(fin.std!=null&&(fin.std<-1e-9||fin.std>1+1e-9)){r.status='problem';r.msg='The standard discount must be between 0 and 100%';r.include=false;return;}
  if(r.status==='update'&&!v43IChanged(cur,fin).length){r.status='same';r.include=false;}}

/* ---------- ticking ---------- */
function v43ICanTick(r){return r.status==='ready'||r.status==='update'||r.status==='new'||r.status==='duplicate'||(r.status==='same'&&V43I.type==='stock'&&r.data&&r.data.scope==='acct');}
function v43ITicked(r){
  if(!v43ICanTick(r))return false;
  var t=V43I.ticks[r.n];if(t&&t.st===r.status)return !!t.v;   /* an explicit choice only counts while the row still means the same thing */
  return !!r.include;}
function v43ITickedRows(){var out=[],p=V43I.plan,i;if(!p)return out;for(i=0;i<p.rows.length;i++)if(v43ITicked(p.rows[i]))out.push(p.rows[i]);return out;}

/* ---------- wording ---------- */
function v43INameOf(r){
  if(r.item)return r.item.name;
  if(r.data&&r.data.name)return r.data.name;
  var map=V43I.map,raw=r.raw||[];
  return map.item!=null?v43ICell(raw[map.item]):(map.name!=null?v43ICell(raw[map.name]):(map.id!=null?v43ICell(raw[map.id]):''));}
function v43IRawAcct(r){var m=V43I.map;return (m.account!=null&&r.raw)?v43ICell(r.raw[m.account]):'';}
function v43IWho(r){
  var t=V43I.type,d=r.data||{},nmRaw=v43INameOf(r),nm=esc(nmRaw),h='';
  if(t==='orders'){h=(d.date?'<span class="imp-sub">'+esc(v42D(d.date))+' · ':'<span class="imp-sub">')+esc(r.account?r.account.name:v43IRawAcct(r))+'</span>';}
  else if(t==='deals'){h='<span class="imp-sub">'+esc(r.account?r.account.name:v43IRawAcct(r))+'</span>';}
  else if(t==='stock'&&(r.account||V43I.scope!=='own'&&V43I.scope!=='*')){h='<span class="imp-sub">'+esc(r.account?r.account.name:V43I.scope)+'</span>';}
  var shown=r.item?v42ItemShort(r.item.name):nmRaw,mm=/(^|· )(matched "[^"]*")/.exec(r.msg||'');
  if(mm)mm=[mm[2]];
  return '<span class="imp-item" title="'+nm+'">'+esc(shown)+'</span>'+(h?'<br>'+h:'')+(mm&&r.status!=='problem'?'<br><span class="imp-sub imp-matched">'+esc(mm[0])+'</span>':'');}
function v43IItemWords(r){
  var d=r.data||{},cur=r.item||{},fin=r.fin||v43IItemVals(cur,d),parts=[],keys=['name','short','rsp','price2026','std','category','form','strength','pack','active'],i,k,f,o,nw;
  if(r.status==='new'){
    parts.push('New item');if(fin.rsp!=null)parts.push('RSP '+v43IP(fin.rsp));if(fin.price2026!=null)parts.push('2026 price '+v43IP(fin.price2026));if(fin.std!=null)parts.push('standard discount '+v43IPct(fin.std));
    return esc(parts.join(' · '));}
  for(i=0;i<keys.length;i++){k=keys[i];if(!v43IHas(fin,k)||v43ISame(v43IGet(cur,k),fin[k]))continue;
    f=function(v){return v==null||v===''?'(blank)':k==='rsp'||k==='price2026'?v43IP(v):k==='std'?v43IPct(v):k==='active'?(v?'Yes':'No'):String(v);};
    o=f(v43IGet(cur,k));nw=f(fin[k]);parts.push(V43I_FLAB[k]+' '+o+' → '+nw);}
  return esc(parts.join('; '))+(r.msg?'<br><span class="imp-sub">'+esc(r.msg)+'</span>':'');}
function v43IWhat(r){
  var t=V43I.type,d=r.data||{},st=r.status,h,old;
  if(st==='problem')return '<span class="imp-bad-txt">'+esc(r.msg||'Cannot be imported')+'</span>';
  if(st==='choose'){
    return '<span class="imp-sub">'+esc(r.msg||'Several items match')+'</span><br><label class="sr-only" for="impPick'+r.n+'">Choose the item for row '+r.n+'</label><select class="imp-pick" id="impPick'+r.n+'" data-n="'+r.n+'"><option value="">Choose the right item…</option>'+
      r.cand.map(function(it){return '<option value="'+esc(it.id)+'">'+esc(v43ILabel(it))+'</option>';}).join('')+'</select>';}
  if(t==='stock'){
    var acct=d.scope==='acct',who=r.account?esc(r.account.name):'';
    if(st==='new')return acct?'Start tracking '+who+' at '+INT(d.qty):'Start tracking at '+INT(d.qty);
    if(st==='update')return acct?'Set the count at '+who+' to '+INT(d.qty)+' (estimated '+INT(d.current)+')':'Set stock to '+INT(d.qty)+' (now '+INT(d.current)+')';
    if(st==='same')return acct?'Same as the estimate ('+INT(d.qty)+'). Tick it to record this count anyway.':'Already '+INT(d.qty)+' — no change';
  }
  if(t==='orders'){
    h='New order line '+INT(d.qty)+' × '+esc(v42ItemShort(r.item.name))+' '+v43IPct(d.pct)+' = '+SAR(d.net)+' SAR <span class="imp-sub">· '+esc(d.status)+' · '+esc(d.src||'')+'</span>';
    if(st==='duplicate')h+='<br><span class="imp-warn-txt">'+esc(String(r.msg||'').replace(/ · matched "[^"]*"$/,''))+'</span>';
    return h;}
  if(t==='deals'){
    old=r.changes&&r.changes[0]?r.changes[0].old:null;
    if(st==='update')return 'Discount '+v43IPct(old)+' → '+v43IPct(d.pct)+' from '+esc(v42D(d.from))+' <span class="imp-sub">· the old deal is retired</span>';
    if(st==='new')return 'New deal '+v43IPct(d.pct)+' from '+esc(v42D(d.from))+' <span class="imp-sub">· net '+SAR(d.net)+' SAR</span>';
    return 'Already '+v43IPct(d.pct)+' — no change';}
  if(t==='items'){if(st==='same')return 'Already up to date — no change';return v43IItemWords(r);}
  return esc(r.msg||'');}
function v43IRowHtml(r){
  var st=V43I_STAT[r.status]||V43I_STAT.problem,can=v43ICanTick(r),c0='<span class="imp-rown">Row '+r.n+'</span>';
  if(can)c0='<label class="imp-tickl"><input type="checkbox" class="imp-tick" data-n="'+r.n+'"'+(v43ITicked(r)?' checked':'')+' aria-label="Import row '+r.n+'"> '+c0+'</label>';
  return '<tr data-n="'+r.n+'" data-status="'+r.status+'"><td class="imp-c0">'+c0+'</td><td class="imp-c1">'+v43IWho(r)+'</td><td class="imp-c2">'+v43IWhat(r)+'</td><td class="imp-c3">'+v42Chip(st[0],st[1])+'</td></tr>';}

/* ---------- step 1: type ---------- */
function v43IFillScope(){
  var sel=$('impScope');if(!sel)return;
  var cur=V43I.scope,html='<option value="own">My stock (my shelf)</option><option value="*">Customers’ stock — the file names the customer in each row</option>'+
    '<optgroup label="Or one customer\u2019s stock">'+D.accounts.filter(function(a){return a.active;}).sort(function(a,b){return a.name.localeCompare(b.name);}).map(function(a){return '<option value="'+esc(a.name)+'">'+esc(a.name)+'</option>';}).join('')+'</optgroup>';
  if(sel.getAttribute('data-n')!==String(D.accounts.length)||!sel.options.length){sel.innerHTML=html;sel.setAttribute('data-n',String(D.accounts.length));}
  sel.value=cur;if(sel.value!==cur){V43I.scope='own';sel.value='own';}}
function v43IInvalidate(){V43I.plan=null;V43I.picks={};V43I.ticks={};V43I.filter='all';V43I.limit=300;V43I.leftOut=[];v43IShow('impS4',false);v43IShow('impResult',false);v43IMsg('impMsg','','');$('impResult').innerHTML='';}
function v43ISetType(t){
  if(t==='stock'&&!v44On())t=null;
  V43I.type=t;
  var bs=$('impTypes').querySelectorAll('button[data-imptype]'),i;
  for(i=0;i<bs.length;i++)bs[i].setAttribute('aria-pressed',String(bs[i].getAttribute('data-imptype')===t));
  v43IShow('impScopeWrap',t==='stock');v43IShow('impDefWrap',t==='orders');
  v43IShow('impS2',!!t);v43IInvalidate();
  if(t&&V43I.sheets){V43I.sheet=v43IBestSheet();v43IPrepSheet();}else{v43IShow('impS3',false);}
}
function v43IReset(){
  V43I.sheets=null;V43I.sheet=0;V43I.name='';V43I.map={};V43I.fileSeq++;V43I.last=null;
  var f=$('impFile');if(f){try{f.value='';}catch(e){}}
  v43IMsg('impFileMsg','','');v43IMsg('impMapMsg','','');v43IMsg('impTplNote','','');$('impMap').innerHTML='';
  v43IShow('impS3',false);v43IInvalidate();}
function v43OpenImport(type){
  if(V43I.running){show('import');return;}
  v44SyncImport();
  V43I.scope='own';V43I.defStatus='Executed';v43IReset();
  $('impDefStatus').value='Executed';v43IFillScope();
  v43ISetType(type&&V43I_NAMES[type]?type:null);
  show('import');
  try{window.scrollTo(0,0);}catch(e){}
}

/* ---------- step 2: the file ---------- */
function v43IBestSheet(){
  var best=0,hits=-1,i,h,n;
  for(i=0;i<V43I.sheets.length;i++){h=Imp.detectHeader(V43I.sheets[i].rows,V43I.type);n=h.row>=0?Object.keys(h.map).length:0;if(n>hits){hits=n;best=i;}}
  return best;}
function v43IOnFile(){
  var inp=$('impFile'),f=inp&&inp.files&&inp.files[0],seq,fr;
  if(!f)return;
  seq=++V43I.fileSeq;V43I.sheets=null;V43I.name=f.name;v43IShow('impS3',false);v43IInvalidate();
  if(f.size>V43I_MAXFILE){v43IMsg('impFileMsg','bad','This file is too big ('+Math.round(f.size/1048576)+' MB). Split it into smaller files.');return;}
  v43IMsg('impFileMsg','','Reading '+esc(f.name)+'…');
  fr=new FileReader();
  fr.onerror=function(){if(seq===V43I.fileSeq)v43IMsg('impFileMsg','bad','I could not read this file. Try again.');};
  fr.onload=function(){
    XlsxRead.read(fr.result,f.name).then(function(w){
      if(seq!==V43I.fileSeq)return;
      V43I.sheets=w.sheets;V43I.sheet=v43IBestSheet();
      v43IMsg('impFileMsg',w.warning?'warn':'good','<strong>'+esc(f.name)+'</strong> · '+w.sheets.length+(w.sheets.length===1?' sheet':' sheets')+(w.warning?'<br>'+esc(w.warning):''));
      v43IPrepSheet();
    },function(e){
      if(seq!==V43I.fileSeq)return;
      V43I.sheets=null;$('impMap').innerHTML='';v43IShow('impS3',false);
      v43IMsg('impFileMsg','bad',esc((e&&e.message)?e.message:'I could not read this file.'));});};
  fr.readAsArrayBuffer(f);
  try{inp.value='';}catch(e3){}}                       /* so choosing the same (corrected) file again fires change */

/* ---------- step 3: columns ---------- */
function v43IFields(){
  var t=V43I.type,f=Imp.FIELDS[t].slice();
  if(t==='stock'&&V43I.scope!=='*')f=f.filter(function(x){return x.key!=='account';});   /* the scope question decides whose stock it is */
  return f;}
function v43IPrepSheet(){
  var sh=V43I.sheets[V43I.sheet],h=Imp.detectHeader(sh.rows,V43I.type),i;
  V43I.found=h.row>=0;
  if(h.row>=0){V43I.hrow=h.row;V43I.map=h.map;}
  else{V43I.hrow=0;for(i=0;i<Math.min(15,sh.rows.length);i++){if(sh.rows[i]&&!v43IBlank(sh.rows[i])){V43I.hrow=i;break;}}V43I.map={};}
  v43IDropAccount();
  v43IRenderSheetPick();v43IRenderMap();v43IShow('impS3',true);}
function v43IDropAccount(){if(V43I.type==='stock'&&V43I.scope!=='*')delete V43I.map.account;}
function v43IRenderSheetPick(){
  var s=$('impSheet'),h=$('impHdrRow'),sh=V43I.sheets[V43I.sheet],i,o='',n=Math.min(15,Math.max(1,sh.rows.length));
  s.innerHTML=V43I.sheets.map(function(x,ix){return '<option value="'+ix+'">'+esc(x.name)+'</option>';}).join('');s.value=String(V43I.sheet);
  v43IShow('impSheetWrap',V43I.sheets.length>1);
  for(i=0;i<n;i++){var r=sh.rows[i]||[],cells=r.filter(function(c){return v43ICell(c)!=='';}).slice(0,3).map(v43ICell).join(', ');o+='<option value="'+i+'">Row '+(i+1)+(cells?' — '+esc(cells.slice(0,40)):' — empty')+'</option>';}
  h.innerHTML=o;h.value=String(V43I.hrow);}
function v43IRenderMap(){
  var sh=V43I.sheets[V43I.sheet],hdr=sh.rows[V43I.hrow]||[],fields=v43IFields(),opts='<option value="">— not in my file —</option>',c,h='';
  for(c=0;c<hdr.length;c++){var t=v43ICell(hdr[c]);if(t!=='')opts+='<option value="'+c+'">'+esc(t)+'</option>';}
  fields.forEach(function(f){
    var req=f.required||(V43I.type==='stock'&&V43I.scope==='*'&&f.key==='account');
    h+='<div class="imp-maprow"><label for="impf_'+f.key+'">'+esc(f.label)+(req?' <span class="imp-req">required</span>':'')+'</label><select id="impf_'+f.key+'" data-impf="'+f.key+'">'+opts+'</select></div>';});
  $('impMap').innerHTML=h;
  fields.forEach(function(f){var s=$('impf_'+f.key);if(V43I.map[f.key]!=null)s.value=String(V43I.map[f.key]);});
  v43IMapCheck();}
function v43IMapCheck(){
  var fields=v43IFields(),miss=[],used={},dup=false,i,f,m=V43I.map,t=V43I.type,bad=[];
  for(i=0;i<fields.length;i++){f=fields[i];
    if(m[f.key]!=null){if(used[m[f.key]])dup=true;used[m[f.key]]=1;}
    else if(f.required||(t==='stock'&&V43I.scope==='*'&&f.key==='account'))miss.push(f.label);}
  if(t==='items'&&m.id==null&&m.name==null)bad.push('Choose the ID column or the Name column (one of them is needed).');
  if(!V43I.found&&!Object.keys(m).length)bad.unshift('I could not find the column headings in this sheet. Check that the right sheet is chosen, or tell me which row has the headings.');
  if(miss.length)bad.push('Still needed: '+esc(miss.join(', '))+'. Choose the column that has it.');
  if(dup)bad.push('The same column is chosen for two different things. Pick a different column.');
  var msg=$('impMapMsg');
  if(bad.length){msg.className='imp-msg imp-bad';msg.innerHTML=bad.map(function(x){return '<div>'+(x.indexOf('<')<0?esc(x):x)+'</div>';}).join('');}
  else{msg.className='imp-msg';msg.innerHTML='';}
  $('impNext').disabled=bad.length>0;
  v43IShow('impS4',false);v43IShow('impResult',false);V43I.plan=null;V43I.picks={};V43I.ticks={};}   /* a choice made for the old columns must not follow into the new ones */

/* ---------- step 4: preview ---------- */
function v43IShowPreview(){
  var plan;
  try{plan=v43IBuildPlan();}catch(e){v43IMsg('impMapMsg','bad',esc((e&&e.message)||'Something went wrong while checking the rows.'));return;}
  if(plan.error){v43IMsg('impMapMsg','bad',esc(plan.error));return;}
  V43I.plan=plan;V43I.filter='all';V43I.limit=300;
  v43IShow('impResult',false);v43IShow('impS4',true);
  v43IRenderPreview();
  try{$('impS4').scrollIntoView({block:'start'});}catch(e2){}}
function v43IRenderPreview(){
  var p=V43I.plan,i,rows=[],h='',c=p.counts,t=V43I.type,shown;
  for(i=0;i<V43I_CHIPS.length;i++){var k=V43I_CHIPS[i][0],n=k==='all'?p.rows.length:c[k];
    h+='<button type="button" class="st-chip" data-impchip="'+k+'" aria-pressed="'+(V43I.filter===k)+'">'+V43I_CHIPS[i][1]+' <span class="n">'+INT(n)+'</span></button>';}
  $('impChips').innerHTML=h;
  var lo=p.leftOut||[],sn=$('impSkipNote');
  sn.textContent=lo.length?(lo.length+(lo.length===1?' row has':' rows have')+' no quantity and '+(lo.length===1?'was':'were')+' left out (row'+(lo.length===1?' ':'s ')+lo.slice(0,8).join(', ')+(lo.length>8?', …':'')+').'):'';
  for(i=0;i<p.rows.length;i++)if(V43I.filter==='all'||p.rows[i].status===V43I.filter)rows.push(p.rows[i]);
  shown=rows.slice(0,V43I.limit);
  $('impTable').querySelector('tbody').innerHTML=shown.length?shown.map(v43IRowHtml).join(''):'<tr><td colspan="4" class="muted">No rows here.</td></tr>';
  var more=$('impMore');more.hidden=rows.length<=shown.length;more.textContent='Show '+Math.min(300,rows.length-shown.length)+' more rows ('+INT(rows.length-shown.length)+' not shown)';
  v43IUpdateTotals();}
function v43IUpdateTotals(){
  var tk=v43ITickedRows(),t=V43I.type,q=0,net=0,i,go=$('impGo'),tx;
  for(i=0;i<tk.length;i++){if(t==='orders'){q+=tk[i].data.qty;net+=tk[i].data.netExact;}}
  tx=t==='orders'?'Ticked: '+INT(tk.length)+(tk.length===1?' line':' lines')+' · '+INT(q)+' units · net '+SAR(net)+' SAR':'Ticked: '+INT(tk.length)+(tk.length===1?' row':' rows');
  $('impTotals').textContent=tx;
  go.textContent=tk.length?'Import '+INT(tk.length)+(tk.length===1?' row':' rows'):'Nothing to import';
  go.disabled=!tk.length||V43I.running||V43I.confirming;}

/* ---------- step 5: confirm, write, result ---------- */
function v43IKinds(rows){
  var t=V43I.type,o={n:rows.length,dups:0,same:0,months:{},st:{},net:0,upd:0,nw:0,open:0,count:0},i,r;
  for(i=0;i<rows.length;i++){r=rows[i];
    if(r.status==='duplicate')o.dups++;if(r.status==='same')o.same++;
    if(t==='orders'){o.months[r.data.date.slice(0,7)]=1;o.st[r.data.status]=(o.st[r.data.status]||0)+1;o.net+=r.data.netExact;}
    if(t==='stock'){if(r.data.type==='OPEN')o.open++;else o.count++;}
    if(t==='items'||t==='deals'){if(r.status==='new')o.nw++;else o.upd++;}}
  return o;}
function v43IConfirmHtml(rows){
  var t=V43I.type,o=v43IKinds(rows),li=[];
  if(t==='orders'){var ms=Object.keys(o.months).length;li.push('<strong>'+INT(o.n)+'</strong> order line'+(o.n===1?'':'s')+' in '+ms+' month'+(ms===1?'':'s'));
    li.push(Object.keys(o.st).map(function(k){return INT(o.st[k])+' '+esc(k);}).join(', ')+' · net '+SAR(o.net)+' SAR');}
  else if(t==='stock'){li.push('<strong>'+INT(o.n)+'</strong> stock number'+(o.n===1?'':'s')+' ('+INT(o.open)+' start tracking, '+INT(o.count)+' new count'+(o.count===1?'':'s')+')');}
  else if(t==='items'){li.push('<strong>'+INT(o.upd)+'</strong> item'+(o.upd===1?'':'s')+' updated, <strong>'+INT(o.nw)+'</strong> new item'+(o.nw===1?'':'s')+' added');}
  else{li.push('<strong>'+INT(o.upd)+'</strong> deal'+(o.upd===1?'':'s')+' changed (the old deal is retired), <strong>'+INT(o.nw)+'</strong> new deal'+(o.nw===1?'':'s'));}
  if(o.dups)li.push('<strong>'+INT(o.dups)+'</strong> of them look like '+(t==='orders'?'orders you already saved':'rows you already have')+' — you ticked them on purpose');
  if(o.same&&t==='stock')li.push(INT(o.same)+' customer count'+(o.same===1?'':'s')+' equal to the estimate (recorded as a count)');
  return '<p>You are about to save:</p><ul class="imp-conf">'+li.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul><p class="note">Nothing is deleted. Every change is also written to the history.</p>';}
function v43IGo(){
  var blk,plan,i,r,was={},fresh,changed=[],rows;
  if(V43I.running||V43I.confirming||!V43I.plan)return;
  blk=v42Block();if(blk){v43IMsg('impMsg','bad',esc(blk));return;}
  rows=v43ITickedRows();if(!rows.length)return;
  for(i=0;i<rows.length;i++)was[rows[i].n]=rows[i].status;
  try{plan=v43IBuildPlan();}catch(e){v43IMsg('impMsg','bad',esc((e&&e.message)||'Could not check the rows again. Nothing was saved.'));return;}
  if(plan.error){v43IMsg('impMsg','bad',esc(plan.error)+' Nothing was saved.');return;}
  fresh={};for(i=0;i<plan.rows.length;i++)fresh[plan.rows[i].n]=plan.rows[i];
  for(i=0;i<rows.length;i++){r=fresh[rows[i].n];if(!r||r.status!==was[rows[i].n])changed.push(rows[i].n);}
  if(changed.length){                                   /* the data moved since the preview: show the new picture, write nothing */
    V43I.plan=plan;v43IRenderPreview();
    v43IMsg('impMsg','warn','Your data changed while you were looking (row'+(changed.length===1?' ':'s ')+esc(changed.slice(0,8).join(', '))+'). I refreshed the list. Nothing was saved. Check it and press Import again.');return;}
  V43I.plan=plan;
  rows=[];for(i=0;i<plan.rows.length;i++){if(was[plan.rows[i].n]!==undefined)rows.push(plan.rows[i]);}   /* the fresh plan rows, same selection */
  V43I.confirming=true;$('impGo').disabled=true;                                    /* a second click (double-click) does nothing */
  setTimeout(function(){
    confirmBox('Import '+INT(rows.length)+(rows.length===1?' row?':' rows?'),v43IConfirmHtml(rows),'Import '+INT(rows.length)+(rows.length===1?' row':' rows')).then(function(ok){
      V43I.confirming=false;
      if(!ok){v43IUpdateTotals();return;}
      v43IRun(rows);});},350);}
function v43ILock(on){
  var sel='#impTypes button,#impFile,#impScope,#impDefStatus,#impSheet,#impHdrRow,#impMap select,#impNext,#impTpl button,#impChips button,#impMore,#impGo,#impTable input,#impTable select',els=document.querySelectorAll(sel),i;
  if(on)V43I.nextWas=$('impNext').disabled;
  for(i=0;i<els.length;i++)els[i].disabled=on?true:(els[i].id==='impNext'?!!V43I.nextWas:els[i].id==='impGo');   /* Import stays off until the list is redrawn */
  if(!on){try{$('impScope').value=V43I.scope;$('impDefStatus').value=V43I.defStatus;}catch(e){}}}
var V43I_SAFE=100;
function v43ISafety(){
  var ts=nowISO().replace(/[-:T.Z]/g,'').slice(0,14),blob=new Blob([JSON.stringify(v42Payload(),null,1)],{type:'application/json'});
  return v42Download(v42Brand().file+'_SafetyBackup_'+ts+'.json',blob).then(function(ok){
    if(ok)return true;
    return confirmBox('No safety copy was saved','<p>This import adds many rows. A copy of your current data could not be saved first, so the import could not be undone with Restore.</p><p><strong>Continue without a safety copy?</strong></p>','Continue without a copy',true).then(function(c){return !!c;});});}
function v43IRun(rows){
  var run={type:V43I.type,file:V43I.name,plan:V43I.plan,map:V43I.map,sheets:V43I.sheets,sheet:V43I.sheet},p;
  var blk=v42Block();if(blk){v43IMsg('impMsg','bad',esc(blk));v43IUpdateTotals();return;}
  V43I.running=true;v43ILock(true);V43I_RES=null;
  v43IMsg('impMsg','',rows.length>=V43I_SAFE?'First, saving a safety copy of your current data… (a big import)':'Saving… please wait. Do not close this page.');
  /* an import of 100 rows or more first downloads a copy of the current data (the same file Restore makes), so it can be undone */
  (rows.length>=V43I_SAFE?v43ISafety():Promise.resolve(true)).then(function(go){
    if(!go)return {saved:0,ok:[],failed:[],warn:'',cancelled:true};
    v43IMsg('impMsg','','Saving… please wait. Do not close this page.');
    return Promise.resolve().then(function(){
    if(run.type==='stock')return v43IWriteStock(rows,run.file);
    if(run.type==='orders')return v43IWriteOrders(rows,run.file);
    if(run.type==='items')return v43IWriteItems(rows,run.file);
    return v43IWriteDeals(rows,run.file);
  });
  }).then(function(res){return res;},function(e){return v43IBroken(rows,e);}).then(function(res){
    V43I.running=false;V43I_RES=null;V42.ctx=null;
    try{v43ILock(false);}catch(e0){}
    if(res.cancelled){v43IMsg('impMsg','warn','Nothing was saved: you chose not to continue without a safety copy. Press Import again when you are ready.');v43IUpdateTotals();return;}
    try{v43IFinish(res,rows,run);}catch(e1){v43IMsg('impMsg','bad','Something went wrong while showing the result — '+esc(errText(e1))+'. Check Orders/Stock before pressing Import again.');V43I.plan=null;}});}
/* a writer stopped by an exception: keep what it had already saved, say so, and mark every other row as not saved */
function v43IBroken(rows,e){
  var part=V43I_RES||{saved:0,ok:[],failed:[],warn:''},seen={},res={saved:part.saved,ok:part.ok.slice(),failed:part.failed.slice(),warn:part.warn||''},i,msg=errText(e);
  for(i=0;i<res.ok.length;i++)seen[res.ok[i]]=1;for(i=0;i<res.failed.length;i++)seen[res.failed[i].n]=1;
  for(i=0;i<rows.length;i++){if(!seen[rows[i].n])res.failed.push({n:rows[i].n,msg:'Something went wrong: '+msg});}
  res.warn=(res.warn?res.warn+' ':'')+'Something went wrong — nothing more was saved; rows already saved: '+res.saved+'.';
  return res;}
function v43IFinish(res,rows,run){
  var t=run.type,done={},i,failed={},same=V43I.sheets===run.sheets&&V43I.sheet===run.sheet&&V43I.type===t;
  for(i=0;i<res.ok.length;i++)done[res.ok[i]]=1;for(i=0;i<res.failed.length;i++)failed[res.failed[i].n]=res.failed[i].msg;
  V43I.last={type:t,file:run.file,res:res,done:done,failed:failed,plan:run.plan,map:run.map,at:nowISO()};
  v43IMsg('impMsg','','');
  v43IShowResult();
  if(res.failed.length&&same){                         /* keep the list so the rest can be tried again: what was saved now shows as duplicate / same; the owner's own ticks stay as they were */
    for(i=0;i<res.ok.length;i++)delete V43I.ticks[res.ok[i]];
    try{V43I.plan=v43IBuildPlan();if(!V43I.plan.error){v43IShow('impS4',true);v43IRenderPreview();}else v43IShow('impS4',false);}catch(e){v43IShow('impS4',false);}
  }else{v43IShow('impS4',false);V43I.plan=null;}
  derive(Store.all());
  try{$('impResult').scrollIntoView({block:'start'});}catch(e2){}}
function v43ISavedText(res,rows){
  var l=V43I.last,t=l.type,n=res.saved,o=v43IKinds(rows.filter(function(r){return l.done[r.n];}));
  if(t==='stock')return INT(n)+' stock number'+(n===1?'':'s')+' saved ('+INT(o.open)+' start tracking, '+INT(o.count)+' count'+(o.count===1?'':'s')+')';
  if(t==='orders')return INT(n)+' order line'+(n===1?'':'s')+' saved';
  if(t==='items')return INT(o.upd)+' item'+(o.upd===1?'':'s')+' updated, '+INT(o.nw)+' new item'+(o.nw===1?'':'s')+' added';
  return INT(o.upd)+' deal'+(o.upd===1?'':'s')+' changed, '+INT(o.nw)+' new deal'+(o.nw===1?'':'s')+' added';}
function v43IShowResult(){
  var l=V43I.last,res=l.res,t=l.type,rows=l.plan.rows.filter(function(r){return l.done[r.n]||l.failed[r.n]!==undefined;}),h,go={stock:['stock','See in Stock'],orders:['orders','See in Orders'],items:['items','See in Items'],deals:['pricing','See in Pricing']}[t];
  var bad=res.failed.length>0;
  h='<h3><span class="imp-num">'+(bad?'!':'✓')+'</span> '+(bad?'Only part of the file was saved':'Import finished')+'</h3>'+
    '<div class="imp-saved" role="status"><span class="badge '+(res.saved?'b-good':'b-bad')+'">'+(res.saved?'Saved':'Not saved')+'</span> '+esc(res.saved?v43ISavedText(res,rows):'Nothing was saved')+'</div>';
  if(bad)h+='<div class="imp-failed" role="alert"><p><strong>'+INT(res.failed.length)+' row'+(res.failed.length===1?'':'s')+' NOT saved:</strong></p><ul>'+res.failed.slice(0,30).map(function(f){return '<li>Row '+f.n+': '+esc(f.msg)+'</li>';}).join('')+(res.failed.length>30?'<li>… and '+INT(res.failed.length-30)+' more (see the report)</li>':'')+'</ul><p class="note">The list below is checked again: rows that were saved now show as already saved, so pressing Import again only adds the rest.</p></div>';
  if(res.warn)h+='<div class="imp-warn" role="alert"><strong>Please read:</strong> '+esc(res.warn)+'</div>';
  var notImp=l.plan.rows.length-Object.keys(l.done).length-res.failed.length;
  if(notImp>0)h+='<p class="note">'+INT(notImp)+' other row'+(notImp===1?' was':'s were')+' not imported (problems, duplicates, unchanged or not ticked).</p>';
  h+='<div class="rowbtns"><button type="button" class="btn ghost" id="impReport">Download import report (CSV)</button> <button type="button" class="btn" data-impgo="'+go[0]+'">'+go[1]+'</button> <button type="button" class="btn ghost" id="impAgain">Import another file</button></div><div class="note" id="impReportNote" role="status" aria-live="polite"></div>';
  $('impResult').innerHTML=h;v43IShow('impResult',true);}
function v43IReport(){
  var l=V43I.last;if(!l)return;
  var P=l.plan,m=l.map,lo={},i,out=['Excel row,Result,Status,Account,Item as written,What was planned,Message'];
  (P.leftOut||[]).forEach(function(n){lo[n]=1;});
  var all=P.rows.map(function(r){return {n:r.n,r:r};});(P.leftOut||[]).forEach(function(n){all.push({n:n,r:null});});
  all.sort(function(a,b){return a.n-b.n;});
  all.forEach(function(x){var r=x.r,res,msg='',what='',st='',acct='',itm='';
    if(!r){res='Left out';msg='No quantity in this row';}
    else{st=r.status;acct=r.account?r.account.name:v43IRawAcct(r);itm=(m.item!=null?v43ICell(r.raw[m.item]):(m.name!=null?v43ICell(r.raw[m.name]):v43ICell(r.raw[m.id])));
      msg=r.msg||'';what=v43IPlain(r);
      if(l.done[r.n])res='Saved';else if(l.failed[r.n]!==undefined){res='NOT saved';msg=l.failed[r.n];}else res='Not imported';}
    out.push([x.n,res,st,acct,itm,what,msg].map(fcCsvField).join(','));});
  saveCsv(v42Brand().file+'_Import_report_'+V43I_NAMES[l.type]+'_'+localDate()+'.csv',out.join('\r\n'),'impReportNote');}
function v43IPlain(r){var d=document.createElement('div');if(r.status==='problem'||r.status==='choose')return '';d.innerHTML=v43IWhat(r);return (d.textContent||'').replace(/\s+/g,' ').trim();}

/* ---------- writers: every one goes through commit / mutate / v42WriteMoves ---------- */
var V43I_RES=null;                                  /* the result the running writer is filling in, so an exception can still say what was saved */
function v43INewRes(){V43I_RES={saved:0,ok:[],failed:[],warn:''};return V43I_RES;}
function v43IBlockMsg(){return v42Block();}
/* history rows go in small batches so one audit doc never grows by more than a few hundred rows at once */
function v43IAudit(rows){
  var chunks=[],i,seq=Promise.resolve(''),warn='';
  for(i=0;i<rows.length;i+=100)chunks.push(rows.slice(i,i+100));
  chunks.forEach(function(ch){seq=seq.then(function(){return mutate(auditPath(),function(b){b.rows=b.rows.concat(ch);}).then(function(){return '';},function(e){warn='Saved, but some history rows could not be written — '+errText(e)+' The data itself is saved; there is nothing to enter again.';return '';});});});
  return seq.then(function(){return warn;});}

/* stock: the month's doc is stock/<ym>; rows are packed by their real size so no doc passes 180,000 characters (the next one is -2, -3 ...) */
function v43StockRowSize(m){return JSON.stringify({id:'SM99999',ts:nowISO(),date:localDate(),type:m.type,scope:m.scope,account:m.account||null,accountId:m.accountId||null,itemId:m.itemId,item:m.item,qty:m.qty,notes:m.notes||null,by:'owner'}).length+2;}
function v43StockRoom(ym,first){
  var i,p,cur,size;
  for(i=1;i<100;i++){p=i===1?'stock/'+ym:'stock/'+ym+'-'+i;cur=Store.peek(p);size=cur?JSON.stringify(cur).length:60;
    if(180000-size-400>=first)return {path:p,room:180000-size-400};}
  return {path:'stock/'+ym+'-100',room:0};}
function v43IFileName(f){return String(f||'').replace(/ytd/ig,'Y-T-D');}   /* the engine reads the word YTD as "opening snapshot" in some fields, so it never goes into text it might read */
function v43IWriteStock(rows,file){
  file=v43IFileName(file);var res=v43INewRes(),blk=v43IBlockMsg(),left,stopped=false,seq=Promise.resolve(),ym=localDate().slice(0,7);
  if(blk)return Promise.reject(new Error(blk));
  left=rows.map(function(r){var d=r.data,parts=['Excel import '+file],m;
    if(d.notes)parts.push(d.notes);if(d.type==='COUNT'&&d.scope==='own'&&d.current!=null)parts.push('system said '+d.current);
    m={type:d.type,scope:d.scope,itemId:r.item.id,item:r.item.name,qty:d.qty,notes:parts.join(' · ').slice(0,300)};
    if(d.scope==='acct'){m.account=r.account.name;m.accountId=r.account.id;}
    return {n:r.n,m:m,sz:v43StockRowSize(m)};});
  function step(){
    if(!left.length)return Promise.resolve();
    if(stopped){left.forEach(function(x){res.failed.push({n:x.n,msg:'Not tried: an earlier part could not be saved'});});left=[];return Promise.resolve();}
    var rm=v43StockRoom(ym,left[0].sz),ch=[],used=0;
    while(left.length&&ch.length<300&&used+left[0].sz<=rm.room){used+=left[0].sz;ch.push(left.shift());}
    if(!ch.length)ch.push(left.shift());
    return v42WriteMoves(ch.map(function(x){return x.m;}),rm.path).then(function(w){res.saved+=ch.length;ch.forEach(function(x){res.ok.push(x.n);});if(w&&w.warn)res.warn+=(res.warn?' ':'')+w.warn;},
      function(e){stopped=true;ch.forEach(function(x){res.failed.push({n:x.n,msg:errText(e)});});}).then(step);}
  return step().then(function(){return res;});}

/* orders: the month's doc is orders/<ym>; when it would pass 180,000 characters the next one is orders/<ym>-2, -3 ... */
var V43I_DOCMAX=180000;
/* the first orders/<ym>[-N] page that still has room for "need" more characters (the order builder and the order editor use this too) */
function v43OrdPath(ym,need){
  var i,p,cur;need=need||1500;
  for(i=1;i<500;i++){p=i===1?'orders/'+ym:'orders/'+ym+'-'+i;cur=Store.peek(p);if(!cur||JSON.stringify(cur).length+need<=V43I_DOCMAX)return p;}
  return 'orders/'+ym+'-500';}
/* an import stops filling a page at 120,000 characters so later edits and new orders always have room */
var V43I_IMPMAX=120000;
function v43OrdPieces(ym,list){
  var left=list.slice(),out=[],i,p,cur,size,take,s;
  for(i=1;left.length&&i<500;i++){
    p=i===1?'orders/'+ym:'orders/'+ym+'-'+i;cur=Store.peek(p);size=cur?JSON.stringify(cur).length:40;take=[];
    while(left.length){s=JSON.stringify(left[0]).length+12;if(size+s>V43I_IMPMAX)break;size+=s;take.push(left.shift());}
    if(take.length){out.push({path:p,rows:take,from:list.length-left.length-take.length});}}
  return out;}
function v43IMaxTx(b,extra){
  var mx=0,docs=Store.all();
  Object.keys(docs).forEach(function(p){if(p.split('/')[0]==='orders')rowsOf(docs[p]).forEach(function(o){mx=Math.max(mx,idNum(o.id));});});
  b.rows.forEach(function(o){mx=Math.max(mx,idNum(o.id));});
  return Math.max(mx,extra||0);}
function v43IWriteOrders(rows,file){
  file=v43IFileName(file);var res=v43INewRes(),blk=v43IBlockMsg(),ts=nowISO(),stamp=ts.replace(/[-:T.Z]/g,'').slice(0,14),idx={},na=0,byM={},ms,pieces=[],assignedMax=0,stopped=false,seq=Promise.resolve();
  if(blk)return Promise.reject(new Error(blk));
  var src=V43I.sheets[V43I.sheet].rows,imap=V43I.map.item;
  rows.forEach(function(r){var d=r.data,a=r.account.name,o;
    if(!idx[a])idx[a]=++na;
    o=priceRow({id:'',date:d.date,account:a,origDesc:v43ICell((src[r.n-1]||[])[imap])||r.item.name,itemId:r.item.id,item:r.item.name,qty:d.qty,rsp:d.rsp,pct:d.pct,src:d.src,source:'Excel import',status:d.status,notes:d.notes||null,orderRef:'IMP-'+stamp+'-'+idx[a],createdAt:ts,updatedAt:ts});
    if(d.status==='Executed')o.execAt=(d.date+'T12:00:00.000Z')<ts?d.date+'T12:00:00.000Z':ts;   /* the order date at noon, never later than now: stock counted later is never reduced by older sales */
    (byM[d.date.slice(0,7)]=byM[d.date.slice(0,7)]||[]).push({n:r.n,o:o});});
  ms=Object.keys(byM).sort();
  ms.forEach(function(ym){v43OrdPieces(ym,byM[ym].map(function(x){return x.o;})).forEach(function(pc){
    pieces.push({ym:ym,path:pc.path,list:byM[ym].slice(pc.from,pc.from+pc.rows.length)});});});
  ms.forEach(function(ym){var ps=pieces.filter(function(x){return x.ym===ym;});ps.forEach(function(x,i){x.part=i+1;x.parts=ps.length;});});
  pieces.forEach(function(pc,pi){seq=seq.then(function(){
    if(stopped){pc.list.forEach(function(x){res.failed.push({n:x.n,msg:'Not tried: an earlier part could not be saved'});});return;}
    v43IMsg('impMsg','','Saving month '+(ms.indexOf(pc.ym)+1)+' of '+ms.length+(pc.parts>1?' (part '+pc.part+' of '+pc.parts+')':'')+'… do not close this page.');
    var made=[];
    return commit([{path:pc.path,fn:function(b){
      var n=v43IMaxTx(b,assignedMax)+1;made=[];
      pc.list.forEach(function(x){x.o.id='TX'+pad(n++,4);made.push(x.o);b.rows.push(x.o);});}}],null).then(function(){
        assignedMax=idNum(made[made.length-1].id);
        return v43IAudit(made.map(function(o){return auditRow('ADD_ORDER',o.account,o.item,'line','',o.id+' · '+o.date+' · qty '+o.qty+' · '+(o.pct*100).toFixed(2)+'% · net '+SAR(o.net)+' · '+o.status,'Excel import','import '+file);}));
      }).then(function(w){res.saved+=pc.list.length;pc.list.forEach(function(x){res.ok.push(x.n);});if(w)res.warn+=(res.warn?' ':'')+w;},
      function(e){stopped=true;pc.list.forEach(function(x){res.failed.push({n:x.n,msg:errText(e)});});});});});
  return seq.then(function(){return res;});}

function v43IWriteItems(rows,file){
  file=v43IFileName(file);var res=v43INewRes(),blk=v43IBlockMsg(),audit=[],bad=[],okn=[];
  if(blk)return Promise.reject(new Error(blk));
  return commit([{path:'master/items',fn:function(b){
    audit=[];bad=[];okn=[];
    rows.forEach(function(r){var d=r.data,fin,id,mx,vals,row,ks;
      if(r.status==='new'){
        fin=v43IItemVals({},d);
        if(!uniqName(b.rows,fin.name,null)){bad.push({n:r.n,msg:'Another item already has this name'});return;}
        mx=0;b.rows.forEach(function(x){mx=Math.max(mx,idNum(x.id));});id='ITM'+pad(mx+1,3);
        vals=fin;vals.id=id;vals.active=fin.active!==false;vals.source='Excel import';b.rows.push(orderKeys(vals));
        audit.push(auditRow('ADD_ITEM','',vals.name,'item','',id+' · RSP '+SAR(vals.rsp)+(vals.std!=null?' · std '+PCT2(vals.std):''),'Excel import '+file,id));okn.push(r.n);return;}
      row=b.rows.filter(function(x){return x.id===r.item.id;})[0];
      if(!row){bad.push({n:r.n,msg:'Item not found'});return;}
      fin=v43IItemVals(row,d);
      if(fin.name!=null&&!uniqName(b.rows,fin.name,row.id)){bad.push({n:r.n,msg:'Another item already has this name'});return;}
      ks=v43IChanged(row,fin);
      ks.forEach(function(k){audit.push(auditRow('UPDATE_ITEM','',row.name,k,row[k],fin[k],'Excel import '+file,row.id));row[k]=fin[k];});
      okn.push(r.n);});}}],null).then(function(){return v43IAudit(audit);}).then(function(w){
    res.saved=okn.length;res.ok=okn;res.failed=bad;res.warn=w||'';return res;});}

function v43IWriteDeals(rows,file){
  file=v43IFileName(file);var res=v43INewRes(),blk=v43IBlockMsg(),groups={},order=[],today=localDate(),seq=Promise.resolve();
  if(blk)return Promise.reject(new Error(blk));
  rows.forEach(function(r){var a=r.account;if(!groups[a.id]){groups[a.id]={acc:a,rows:[]};order.push(a.id);}groups[a.id].rows.push(r);});
  order.forEach(function(aid){seq=seq.then(function(){
    var g=groups[aid],acc=g.acc,audit=[];
    return commit([{path:'deals/'+acc.id,fn:function(b){
      audit=[];
      g.rows.forEach(function(r){var im=r.item,d=r.data,act=b.rows.filter(function(x){return x.itemId===im.id&&x.status==='Active';}),px,mx=0,newId,old=act.length?act[act.length-1].pct:null;
        act.forEach(function(x){x.status='Inactive';x.to=d.from;x.updated=today;});   /* the old deal is kept, not deleted */
        px=dealPrefix(acc,b.rows);b.rows.forEach(function(x){var m=/^([A-Z]+)(\d+)$/.exec(String(x.id||''));if(m&&m[1]===px)mx=Math.max(mx,+m[2]);});
        newId=px+pad(mx+1,3);
        b.rows.push({id:newId,account:acc.name,origItem:im.name,item:im.name,itemId:im.id,pct:d.pct,rsp:im.rsp,net:im.rsp*(1-d.pct),extraPct:null,bonusPct:null,from:d.from,to:null,status:'Active',source:'Excel import '+file,updated:today,notes:d.notes||null,type:'Account deal'});
        audit.push(auditRow(act.length?'UPDATE_DEAL':'ADD_DEAL',acc.name,im.name,'pct',old==null?'':PCT2(old),PCT2(d.pct),'Excel import '+file,'deal '+newId+' from '+d.from));});}}],null).then(function(){return v43IAudit(audit);}).then(function(w){
      res.saved+=g.rows.length;g.rows.forEach(function(r){res.ok.push(r.n);});if(w)res.warn+=(res.warn?' ':'')+w;},
    function(e){g.rows.forEach(function(r){res.failed.push({n:r.n,msg:errText(e)});});});});});
  return seq.then(function(){return res;});}

/* ---------- templates (xlsx through the platform's own zipStore / xSheet writer, saved through the downloads path) ---------- */
function v43Template(type,noteId){
  if(!V43I_NAMES[type]||(type==='stock'&&!v44On()))return;
  derive(Store.all());
  var B=v42Brand(),name=B.file+'_'+V43I_NAMES[type]+'_template.xlsx',today=localDate(),sheet,rows=[],own;
  if(type==='stock'){
    own=v42OwnMap();
    D.activeItems.forEach(function(i){var r=own[i.id];rows.push([i.id,i.name,(r&&r.tracked)?r.onHand:'','']);});
    sheet={n:'Stock',x:xSheet([{h:'ID',w:9},{h:'Item',w:46},{h:'You have',t:'int',w:12},{h:'New quantity',t:'int',w:15}],rows)};}
  else if(type==='orders'){
    rows.push([today,'EXAMPLE — delete this row',D.activeItems.length?D.activeItems[0].name:'Item name',10,'','Executed','']);
    sheet={n:'Orders',x:xSheet([{h:'Date',t:'date',w:12},{h:'Account',w:30},{h:'Item',w:46},{h:'Quantity',t:'int',w:10},{h:'Discount %',t:'pct',w:11},{h:'Status',w:11},{h:'Notes',w:30}],rows)};}
  else if(type==='items'){
    D.items.forEach(function(i){var r=i._r;rows.push([r.id,r.name,r.short,r.rsp,r.price2026,r.std,r.category,r.form,r.strength,r.pack,r.active===false?'No':'Yes']);});
    sheet={n:'Items',x:xSheet([{h:'ID',w:9},{h:'Name',w:46},{h:'Short name',w:24},{h:'RSP',t:'money',w:9},{h:'2026 price',t:'money',w:11},{h:'Standard discount %',t:'pct',w:13},{h:'Category',w:14},{h:'Form',w:12},{h:'Strength',w:10},{h:'Pack',w:12},{h:'Active',w:8}],rows)};}
  else{
    D.deals.forEach(function(d){if(d.status!=='Active')return;rows.push([d.acct,d.item,d._r.pct,d._r.from,d._r.notes]);});
    sheet={n:'Deals',x:xSheet([{h:'Account',w:26},{h:'Item',w:46},{h:'Discount %',t:'pct',w:11},{h:'From date',t:'date',w:12},{h:'Notes',w:30}],rows)};}
  var nid=noteId||(($('view-stock')&&$('view-stock').classList.contains('active')&&$('skMsg'))?'skMsg':'impTplNote');
  saveBlob(name,xlsxPackage([sheet]),nid);}

/* ---------- wiring (once) ---------- */
function v43IWire(){
  var v=$('view-import');if(!v||V43I.wired)return;V43I.wired=true;
  v.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button');if(!b)return;
    if(V43I.running&&b.id!=='impAgain')return;                  /* locked while saving */
    if(b.getAttribute('data-imptype')){var t=b.getAttribute('data-imptype');if(t!==V43I.type){V43I.scope='own';$('impScope').value='own';v43ISetType(t);}return;}
    if(b.getAttribute('data-imptpl')){v43Template(b.getAttribute('data-imptpl'));return;}
    if(b.id==='impNext'){v43IShowPreview();return;}
    if(b.getAttribute('data-impchip')){V43I.filter=b.getAttribute('data-impchip');V43I.limit=300;v43IRenderPreview();return;}
    if(b.id==='impMore'){V43I.limit+=300;v43IRenderPreview();return;}
    if(b.id==='impGo'){v43IGo();return;}
    if(b.id==='impReport'){v43IReport();return;}
    if(b.id==='impAgain'){v43OpenImport(V43I.type);return;}
    if(b.getAttribute('data-impgo')){show(b.getAttribute('data-impgo'));return;}
  });
  v.addEventListener('change',function(e){
    var t=e.target,k,n,r,i;
    if(V43I.running){return;}                                    /* locked while saving */
    if(t.id==='impFile'){v43IOnFile();return;}
    if(t.id==='impScope'){V43I.scope=t.value;v43IInvalidate();if(V43I.sheets){v43IDropAccount();v43IPrepSheet();}return;}
    if(t.id==='impDefStatus'){V43I.defStatus=t.value;v43IInvalidate();if(V43I.sheets)v43IMapCheck();return;}
    if(t.id==='impSheet'){V43I.sheet=+t.value;v43IInvalidate();v43IPrepSheet();return;}
    if(t.id==='impHdrRow'){V43I.hrow=+t.value;V43I.found=true;var m=Imp.detectHeader([V43I.sheets[V43I.sheet].rows[V43I.hrow]||[]],V43I.type);V43I.map=m.row===0?m.map:{};V43I.found=m.row===0;v43IDropAccount();v43IInvalidate();v43IRenderMap();return;}
    k=t.getAttribute&&t.getAttribute('data-impf');
    if(k){if(t.value==='')delete V43I.map[k];else V43I.map[k]=+t.value;v43IMapCheck();return;}
    if(t.classList&&t.classList.contains('imp-tick')){n=+t.getAttribute('data-n');r=null;for(i=0;i<V43I.plan.rows.length;i++)if(V43I.plan.rows[i].n===n){r=V43I.plan.rows[i];break;}
      if(r){V43I.ticks[n]={v:t.checked,st:r.status};v43IUpdateTotals();}return;}
    if(t.classList&&t.classList.contains('imp-pick')){n=t.getAttribute('data-n');if(t.value===''){delete V43I.picks[n];}else{V43I.picks[n]=t.value;}
      delete V43I.ticks[n];
      try{var pl=v43IBuildPlan();if(!pl.error){V43I.plan=pl;v43IRenderPreview();}}catch(e2){v43IMsg('impMsg','bad',esc((e2&&e2.message)||'Could not check the rows.'));}return;}
  });
}
RENDER['import']=function(){v44SyncImport();v43IFillScope();};
v43IWire();
/* the Import buttons on the Orders, Items and Pricing pages open the wizard with that type already chosen */
[['ovImport','orders'],['itemImport','items'],['prImport','deals']].forEach(function(x){var b=$(x[0]);if(b)b.addEventListener('click',function(){v43OpenImport(x[1]);});});

/* ==================== V43 UI — "How it works" guide ====================
   Plain-English page for the owner. The company name comes from v42Brand(); the Excel cheat sheet is generated from Imp.FIELDS
   (required flags, labels, accepted header names), so it cannot drift from what the import really does. */
var V43G={mode:'',wired:false};
var V43G_SECS=[
  ['Today',[['today','Today','What needs you now: alerts, orders you can expect, how the month is going.']]],
  ['Sell',[['order','New order','Type or paste an order. Each line is priced with the customer’s deal.'],['orders','Orders','Every order line by customer. Edit one, or cancel it (it stays in the history).'],['forecast','Reorder plan','Which customers are about to order again, and roughly what.']]],
  ['Stock',[['stock','Stock','What you have and what is left. Type a count, press Save.'],['import','Import Excel','Bring in stock, orders, items or deals from a spreadsheet. You see what will happen first.']]],
  ['Customers & prices',[['accounts','Accounts','Your customers. Close one that stopped ordering (its history stays).'],['pricing','Pricing','The deal each customer has for each item.'],['items','Items','Your product list with the RSP and the standard discount.']]],
  ['Reports & data',[['dashboard','Dashboard','Sales so far: by customer, item and month.'],['targets','Targets','Set a monthly target and see how it splits between customers.'],['data','Data','Excel export, backup and restore, company name and colour, data checks.'],['guide','How it works','This page.']]]];
var V44G_SECS=V43G_SECS.map(function(s){return s[0]!=='Stock'?s:['Stock',[['stock','Stock','What each customer probably has left, worked out from their orders. Nothing to type.'],['import','Import Excel','Bring in orders, items or deals from a spreadsheet. You see what will happen first.']]];});
var V43G_TYPES=[['stock','Stock counts','A count of what is on a shelf: yours, or a customer’s.'],['orders','Orders','Order lines to add to the Orders page.'],['items','Items & prices','New items, or changes to the RSP, price, discount and details of the ones you have.'],['deals','Deals','A discount for one customer on one item.']];
var V43G_NOTE={
  stock:'The Account column is only needed when the file lists customers’ stock (choose “Customers’ stock” in step 1). A row with no quantity is left out.',
  orders:'One row is one order line. Status is Executed, Pending or Quoted; if the cell is blank the choice you make in step 1 is used. A blank discount means the customer’s usual price.',
  items:'Give the ID or the Name so I know which item the row is about. A name I do not know is added as a new item. A blank cell keeps what the item has now.',
  deals:'The discount starts on the From date (blank means today). The old deal for that item is retired, not deleted.'};
/* what a blank cell does, per kind of file (the outcome word is checked against Imp.plan by the tests: skip / problem / keep / ok) */
var V43G_BLANK=[
  ['stock.qty','','skip','Stock, quantity','the row is left out (it is not an error and nothing is set to 0)'],
  ['orders.date','','problem','Orders, date','the row is stopped as a problem (“No date”)'],
  ['orders.account','','problem','Orders, account','the row is stopped as a problem'],
  ['orders.item','','problem','Orders, item','the row is stopped as a problem'],
  ['orders.qty','','problem','Orders, quantity','the row is stopped as a problem (“No quantity”)'],
  ['orders.disc','','ok','Orders, discount','the customer’s usual price is used (their deal, else the item’s standard discount)'],
  ['orders.status','','ok','Orders, status','the choice you make in step 1 is used'],
  ['deals.disc','','problem','Deals, discount','the row is stopped as a problem (“No discount”)'],
  ['deals.from','','ok','Deals, From date','today is used'],
  ['items.price','','keep','Items, any detail (price, RSP, name …)','what the item has now is kept'],
  ['items.id','','problem','Items, ID and Name both blank','the row is stopped: I cannot tell which item it is']];
function v43GWrap(s,max){
  var words=String(s||'').replace(/\s+/g,' ').replace(/^ | $/g,'').split(' '),lines=[],cur='',w;
  while(words.length){w=words.shift();
    while(w.length>max){if(cur){lines.push(cur);cur='';}lines.push(w.slice(0,max));w=w.slice(max);}
    if(!cur)cur=w;else if((cur+' '+w).length<=max)cur+=' '+w;else{lines.push(cur);cur=w;}}
  if(cur)lines.push(cur);
  if(lines.length>3){lines=lines.slice(0,3);lines[2]=lines[2].slice(0,max-1)+'\u2026';}
  return lines.length?lines:[''];}
function v43GFig(co,tall){
  var cl=v43GWrap(co,tall?26:15),B=[['You enter',v44On()?['New order','Stock updates','Excel import']:['New order','Excel import']],['Platform database',cl.concat(['Every change saved','with its history'])],['You see',['Today','Stock','Targets','Dashboard']],['You take out',['Excel export','PDF','Backup']]],
    i,j,x,y,h,w=190,s,ar='',vw=tall?300:880,vh,bx,gs=[],mx=0,alt;
  alt=B.map(function(b){return b[0]+': '+b[1].join(', ');}).join('. Then ');
  for(i=0;i<4;i++)mx=Math.max(mx,B[i][1].length);
  if(tall){y=0;for(i=0;i<4;i++){h=44+B[i][1].length*22+8;gs.push({x:0,y:y,w:300,h:h});if(i<3)ar+='<path d="M150 '+(y+h+3)+'v18" marker-end="url(#gdArr)"/>';y+=h+28;}vh=y-28;}
  else{h=44+mx*24+10;for(i=0;i<4;i++){gs.push({x:i*230,y:0,w:w,h:h});if(i<3)ar+='<path d="M'+(i*230+w+6)+' '+Math.round(h/2)+'h28" marker-end="url(#gdArr)"/>';}vh=h;}
  s='<svg viewBox="0 0 '+vw+' '+vh+'"'+(tall?' class="gd-tall"':'')+' role="img" aria-labelledby="gdT gdD" xmlns="http://www.w3.org/2000/svg"><title id="gdT">The big picture</title><desc id="gdD">'+esc(alt)+'</desc>'+
    '<defs><marker id="gdArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="gd-arh"/></marker></defs>';
  for(i=0;i<4;i++){bx=gs[i];
    s+='<g class="gd-grp"><rect x="'+bx.x+'" y="'+bx.y+'" width="'+bx.w+'" height="'+bx.h+'" rx="12"/><rect class="gd-bar" x="'+bx.x+'" y="'+bx.y+'" width="'+bx.w+'" height="6" rx="3"/>'+
      '<text class="gd-t" x="'+(bx.x+14)+'" y="'+(bx.y+32)+'">'+esc(B[i][0])+'</text>';
    for(j=0;j<B[i][1].length;j++)s+='<text x="'+(bx.x+14)+'" y="'+(bx.y+60+j*(tall?22:24))+'">'+esc(B[i][1][j])+'</text>';
    s+='</g>';}
  return s+'<g class="gd-arr">'+ar+'</g></svg>';}
/* a long line is squeezed (never cut off) so it stays inside its box */
function v43GFit(root){
  var svg=root&&root.querySelector('svg'),gs,i,j,r,ts,b,room;if(!svg||!svg.getClientRects().length)return;   /* a hidden page has no size to measure: it is fitted when it is shown */
  gs=svg.querySelectorAll('g.gd-grp');
  for(i=0;i<gs.length;i++){r=gs[i].querySelector('rect').getBBox();ts=gs[i].querySelectorAll('text');room=r.width-28;
    for(j=0;j<ts.length;j++){ts[j].removeAttribute('textLength');ts[j].removeAttribute('lengthAdjust');
      if(!(room>0))continue;b=ts[j].getBBox();
      if(b.width>room){ts[j].setAttribute('textLength',String(Math.floor(room)));ts[j].setAttribute('lengthAdjust','spacingAndGlyphs');}}}}
function v43GImp(t){
  var f=Imp.FIELDS[t],req=[],opt=[],syn='',i,x,info=V43G_TYPES.filter(function(y){return y[0]===t;})[0];
  for(i=0;i<f.length;i++){x=f[i];(x.required?req:opt).push('<li data-label="'+esc(x.label)+'">'+esc(x.label)+'</li>');
    syn+='<tr><th scope="row">'+esc(x.label)+'</th><td>'+esc((x.syn||[]).join(', '))+'</td></tr>';}
  return '<div class="gd-imp" data-type="'+t+'"><h4>'+esc(info[1])+'</h4><p class="gd-sub">'+esc(info[2])+'</p>'+
    (req.length?'<p class="gd-lab">Needed in the file</p><ul class="gd-req">'+req.join('')+'</ul>':'<p class="gd-lab">Needed in the file</p><p class="gd-none">No column is strictly needed, but each row must say which item it is about (ID or Name).</p>')+
    '<p class="gd-lab">Also understood</p><ul class="gd-opt">'+opt.join('')+'</ul>'+
    '<details class="gd-syn"><summary>Column names I recognise</summary><table><tbody>'+syn+'</tbody></table></details>'+
    '<p class="note">'+esc(V43G_NOTE[t])+'</p>'+
    '<button type="button" class="btn ghost sm" data-gdtpl="'+t+'">Download template</button><div class="note gd-tplnote" id="guideTplNote_'+t+'" role="status" aria-live="polite"></div></div>';}
function v43GBody(){
  var B=v42Brand(),co=B.company,tall=V43G.mode==='tall',h='',i,j,s,n=0,on=v44On(),secs=on?V43G_SECS:V44G_SECS,types=V43G_TYPES.filter(function(y){return on||y[0]!=='stock';});
  function H(t){n++;return '<h3 class="gd-h"><span class="gd-n" aria-hidden="true">'+n+'</span> '+t+'</h3>';}
  function go(v,l){return '<button type="button" class="gd-go" data-gdgo="'+v+'">'+esc(l)+'</button>';}
  h+='<p class="gd-lead">This page explains how <strong>'+esc(B.title)+'</strong> works, in about five minutes. Nothing here changes your data.</p>';
  h+='<div class="card gd-card">'+H('The big picture')+'<figure class="gd-fig">'+v43GFig(co,tall)+'</figure><p class="note">You put information in, the platform keeps it safe with its history, and you see it as screens, Excel files, PDFs and backups.</p></div>';
  h+='<div class="card gd-card">'+H('Your daily routine')+'<ol class="gd-steps">'+
    '<li><strong>Open '+go('today','Today')+'</strong> to see what needs you now.</li>'+
    (on?'<li><strong>Act on the alerts.</strong> Every alert has a button: draft an order, receive stock, count, open the page.</li>':'<li><strong>Act on the alerts.</strong> Every alert has a button: draft an order, open the page, download a backup.</li>')+
    '<li><strong>Enter your orders</strong> in '+go('order','New order')+', or bring many at once with '+go('import','Import Excel')+'.</li>'+
    (on?'<li><strong>Update '+go('stock','Stock')+' when you count.</strong> Type what you counted and press Save.</li>':'<li><strong>Check '+go('stock','Stock')+'</strong> to see what each customer probably has left, worked out from their orders.</li>')+
    '<li><strong>Download a backup once a week</strong> from '+go('data','Data')+'. Today reminds you after 7 days.</li></ol></div>';
  h+='<div class="card gd-card">'+H('What each section does')+'<div class="gd-secs">';
  for(i=0;i<secs.length;i++){s=secs[i];h+='<div class="gd-sec"><h4>'+esc(s[0])+'</h4><ul>';
    for(j=0;j<s[1].length;j++)h+='<li>'+go(s[1][j][0],s[1][j][1])+'<span>'+esc(s[1][j][2])+'</span></li>';
    h+='</ul></div>';}
  h+='</div></div>';
  h+='<div class="card gd-card">'+H('How the numbers are made')+
    (on?'<div class="gd-num"><h4>Stock</h4><p><strong>You have</strong> = your last count + stock you received (and corrections you typed) − the orders you saved as Executed after that count.</p>'+
    '<p><strong>Left</strong> = You have − <strong>On order (reserved)</strong>: the orders still waiting (Pending, and Quoted unless you switch that off in Set up &amp; settings).</p>'+
    '<p class="note">An item you never counted shows “Not tracked”, never 0. Orders saved before you started counting are not taken off.</p></div>'
    :'<div class="gd-num"><h4>Stock</h4><p>Stock is <strong>worked out from orders</strong>, never typed in. For each customer and item I take the <strong>last order</strong> and the <strong>usual gap</strong> between orders: the customer is taken to use that quantity evenly over the gap, so <strong>Est. left now</strong> goes down day by day and it <strong>runs out</strong> on last order + usual gap.</p>'+
    '<p>Stock entry is <strong>switched off</strong>: there is nowhere to type your own stock or a customer\u2019s count, and your own stock isn\u2019t tracked.</p>'+
    '<p class="note">An item without enough orders to know the usual gap shows “—” and “Not enough orders yet”, never 0.</p></div>')+
    '<div class="gd-num"><h4>Expected orders</h4><p>For every customer and item that has ordered before, I work out the <strong>usual gap</strong> between orders (kept between 1 week and 6 months) and the <strong>usual quantity</strong> (the middle one). The next order is the last order date plus that gap'+(on?' — sooner if the customer’s own stock count says it runs out':'')+'.</p>'+
    '<p>After only one order of an item I use the customer’s overall rhythm and mark it low confidence; with no rhythm I make no guess. A customer + item whose last order is more than a year old gets no expected order.</p>'+
    '<p>If an order is overdue by more than 45 days <em>and</em> by more than its own usual gap, it is <strong>lapsed</strong>: it is not counted as expected and moves to the <strong>Lapsed (win back)</strong> list on Today (press “Show the … lapsed items”).</p></div>'+
    '<div class="gd-num"><h4>Targets</h4><p>You type the total for the month. It is split between customers and items partly by <strong>history</strong> (what they bought in the last 6 months) and partly by what they are <strong>expected</strong> to buy that month. The slider sets the mix (70% history to start).</p>'+
    '<p>Add <strong>growth</strong> % to a customer or an item, or give a customer a <strong>fixed</strong> amount; the rest is split between the others. The parts always add up exactly to your total.</p></div>'+
    '<div class="gd-num"><h4>Prices</h4><p>The customer’s <strong>deal</strong> for that item comes first. If there is none, the item’s <strong>standard</strong> discount is used. If neither exists the line says <strong>review required</strong> and cannot be saved until you fix it.</p>'+
    '<p class="note">A saved order keeps the price it had that day. Changing a deal or a price later only affects new orders.</p></div></div>';
  h+='<div class="card gd-card">'+H('Safety')+'<ul class="gd-list">'+
    '<li><strong>Nothing is deleted</strong> when you work normally. Cancelling an order changes its status; the line stays.</li>'+
    '<li>Most changes add a line to the change history (shown on an account’s page, '+(on?'in Stock → History ':'')+'and in the Excel export), with the date and time. Changes are always made by you, the owner.</li>'+
    '<li>Excel imports always show a <strong>preview</strong> first. Only the rows you tick are saved, and rows I am unsure about are never saved until you choose.</li>'+
    '<li>Download a backup every week. <strong>Restore</strong> (in Data) is the one action that can overwrite. Restore puts back the backup\u2019s version of every record that changed since, and order lines added since the backup, in a month the backup also contains, are replaced. Extra pages made by a big import for such a month are emptied (kept, with no lines), so a big import can be undone. A month the backup does not have at all is left as it is. It shows what would change first, downloads a safety copy of your current data, and asks you to type RESTORE.</li>'+
    '<li>Before an import of 100 rows or more, a safety copy of your current data is downloaded for you automatically (the same file Restore makes). If it cannot be saved, you are asked whether to continue without it.</li></ul>'+
    '<h4>A new year, or another company</h4><ul class="gd-list">'+
    '<li><strong>New year:</strong> in <strong>Data</strong>, the <strong>New year helper</strong> chooses the period the dashboard shows and lists customers that stopped ordering so you can close them.</li>'+
    '<li><strong>Close account</strong> (on the Accounts page) hides a customer from lists and totals. Its orders and deals stay, and you can reopen it.</li>'+
    '<li><strong>Brand &amp; workspace</strong> (in Data) sets the company name, app name and colour shown everywhere, including file names.</li>'+
    '<li><strong>Changing company or items:</strong> imports cannot create customers, so go in this order: add your customers first (<strong>Accounts</strong> → <strong>Add account</strong>), then import <strong>Items &amp; prices</strong>, then <strong>Deals</strong>, then '+(on?'stock and orders':'orders')+'. Switch an old item off with <strong>Deactivate</strong> (in Items) instead of deleting it. A completely empty copy offers <strong>Start a new, empty workspace</strong> — only use it for a blank copy.</li></ul></div>';
  h+='<div class="card gd-card">'+H('Excel import cheat sheet')+
    '<p>Open <strong>Import Excel</strong>, choose what you are importing and pick your file (.xlsx or .csv). I find the columns by their headings; you can change them. These are the columns for each kind:</p><div class="gd-imps">';
  for(i=0;i<types.length;i++)h+=v43GImp(types[i][0]);
  h+='</div>'+
    '<h4>Rules for every file</h4><ul class="gd-list">'+
    '<li><strong>Dates:</strong> day/month/year (25/09/2026), or 2026-09-25, or a real Excel date.</li>'+
    '<li><strong>Percent:</strong> write 65 or 65% (a bare 0.5 is read as 50%). For one percent or everything, always write <strong>1% or 100%</strong>: a bare 1 is refused, because it could mean either.</li>'+
    '<li><strong>Duplicates:</strong> an order line that is already saved (or appears twice in the file) is flagged as a duplicate and not added unless you tick it.</li>'+
    '<li>Nothing is saved until you press <strong>Import</strong>. Rows are checked again at that moment.</li></ul>'+
    '<h4>If a cell is blank</h4><p class="note" style="margin-top:0">This depends on the kind of file:</p><ul class="gd-list gd-blank">'+V43G_BLANK.filter(function(x){return on||x[0].indexOf('stock.')!==0;}).map(function(x){return '<li data-blank="'+x[0]+'" data-out="'+x[2]+'"><strong>'+esc(x[3])+':</strong> '+esc(x[4])+'</li>';}).join('')+'</ul></div>';
  return h;}
function v43GRender(){
  var b=$('guideBody');if(!b)return;
  V43G.mode=b.clientWidth&&b.clientWidth<640?'tall':'wide';
  b.innerHTML=v43GBody();v43GFit(b.querySelector('.gd-fig'));
  if(window.requestAnimationFrame)requestAnimationFrame(function(){v43GFit(b.querySelector('.gd-fig'));});}
function v43GResize(){
  var b=$('guideBody'),v=$('view-guide'),m,f;if(!b||!v||!v.classList.contains('active')||document.hidden)return;
  m=b.clientWidth&&b.clientWidth<640?'tall':'wide';f=b.querySelector('.gd-fig');
  if(m!==V43G.mode){V43G.mode=m;if(f)f.innerHTML=v43GFig(v42Brand().company,m==='tall');}
  if(f)v43GFit(f);}
RENDER.guide=v43GRender;
(function(){var b=$('view-guide');if(!b||V43G.wired)return;V43G.wired=true;
  b.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('button');if(!t)return;
    if(t.getAttribute('data-gdgo')){show(t.getAttribute('data-gdgo'));return;}
    if(t.getAttribute('data-gdtpl')){v43Template(t.getAttribute('data-gdtpl'),'guideTplNote_'+t.getAttribute('data-gdtpl'));return;}});
  window.addEventListener('resize',v43GResize);document.addEventListener('visibilitychange',v43GResize);})();

window.__v43={V43:V43,V43I:V43I,Imp:Imp,XlsxRead:XlsxRead,data:function(){return D;},today:localDate,planCtx:function(){return v43ICtx();},planOpts:function(t,s,d){derive(Store.all());return v43IOpts(t,s||'own',d);},ordPath:v43OrdPath}; /* test hooks (read-only use) */

function curView(){var a=document.querySelector('.view.active');return a?a.id.replace('view-',''):'dashboard';}
function isLoading(){var st=Store.status();return st.mode==='starting'&&!Store.hasSeed();}
function renderAll(){
  if(isLoading()){document.body.classList.add('is-loading');renderBanner();return;}
  document.body.classList.remove('is-loading');
  derive(Store.all());refreshSelects();renderBanner();v42Common();
  var v=curView();if(RENDER[v])RENDER[v]();
}
function scheduleRender(){clearTimeout(rT);rT=setTimeout(renderAll,120);}
Store.subscribe(function(){scheduleRender();});
var ld=Store.loadAll();
if(isLoading())document.body.classList.add('is-loading');
if(!isLoading()){derive(Store.all());refreshSelects();renderBanner();}
$('obDate').value=localDate();
addLine();
try{var lv=localStorage.getItem('jsp-view');if(lv&&$('view-'+lv))show(lv);else show('today');}catch(e){show('today');}
ld.then(function(){renderAll();});
window.addEventListener('resize',function(){clearTimeout(window._rz);window._rz=setTimeout(function(){if($('view-dashboard').classList.contains('active'))drawCharts();},200);});
})();
