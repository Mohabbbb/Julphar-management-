/* Current quote pricing, pure ES5. Saved orders keep their stored amounts.
   See docs/adr/0011-newest-active-deal.md for eligibility and tie-breaking. */
var Pricing=(function(){'use strict';
function text(v){return v==null?'':String(v).replace(/^\s+|\s+$/g,'');}
function name(v){return text(v).toLowerCase();}
function rate(v){return typeof v==='number'&&isFinite(v)&&v>=0&&v<=1;}
function date(v){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  var d=new Date(v+'T00:00:00Z');return isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
}
function matches(d,account,item){
  if(d.accountId!=null&&account.id!=null&&text(d.accountId)!==text(account.id))return false;
  var an=d.account!=null?d.account:d.acct;
  if(an!=null){if(name(an)!==name(account.name))return false;}
  else if(d.accountId==null||account.id==null||text(d.accountId)!==text(account.id))return false;
  if(d.itemId!=null&&item.id!=null)return text(d.itemId)===text(item.id);
  return !!item.name&&name(d.item)===name(item.name);
}
function stamp(v){var n=Date.parse(v);return isFinite(n)?n:0;}
function idCompare(a,b){
  a=text(a);b=text(b);var x=/^(.*?)(\d+)$/.exec(a),y=/^(.*?)(\d+)$/.exec(b);
  if(x&&y&&x[1]===y[1]&&Number(x[2])!==Number(y[2]))return Number(x[2])-Number(y[2]);
  return a>b?1:a<b?-1:0;
}
function compare(a,b){
  var af=text(a.from),bf=text(b.from);
  if(af!==bf)return af>bf?1:-1;
  var n=stamp(a.updatedAt||a.updated)-stamp(b.updatedAt||b.updated);if(n)return n;
  n=stamp(a.createdAt)-stamp(b.createdAt);if(n)return n;
  return idCompare(a.id,b.id);
}
function selectDeal(deals,account,item,day){
  var best=null,invalid=false;
  if(!account||!item||!date(day))return {deal:null,invalid:true};
  (deals||[]).forEach(function(raw){
    var d=raw&&raw._r?raw._r:raw;if(!d||d.status!=='Active'||!matches(d,account,item))return;
    var from=text(d.from),to=text(d.to);
    if((from&&!date(from))||(to&&!date(to))||(from&&to&&from>to)){invalid=true;return;}
    if((from&&from>day)||(to&&to<day))return;
    if(!best||compare(d,best)>0)best=d;
  });
  /* A malformed applicable date is not silently ignored in favour of a cheaper rule. */
  return {deal:best,invalid:invalid};
}
function resolve(account,item,deals,day){
  if(!item)return {pct:null,src:''};
  if(!account||!text(account.name))return {pct:null,src:'NO ACCOUNT'};
  if(item.active===false||typeof item.rsp!=='number'||!isFinite(item.rsp)||item.rsp<0)return {pct:null,src:'REVIEW REQUIRED'};
  var chosen=selectDeal(deals,account,item,day);
  if(chosen.invalid)return {pct:null,src:'REVIEW REQUIRED'};
  if(chosen.deal)return rate(chosen.deal.pct)?{pct:chosen.deal.pct,src:'Account deal'}:{pct:null,src:'REVIEW REQUIRED'};
  return rate(item.std)?{pct:item.std,src:'Standard rule'}:{pct:null,src:'REVIEW REQUIRED'};
}
function dayBefore(v){var d=new Date(v+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
/* A new deal starting on `eff` is being saved: end the older Active deal `old` (changed in place; the caller stamps `updated`).
   If `eff` is after `today` the older deal must keep pricing until then, so it stays Active and only gets an end date (the day before).
   Otherwise (starts today or earlier, or the old deal itself starts on/after `eff`) it is retired as before: Inactive, ends on `eff`. */
function supersede(old,eff,today){
  var from=text(old.from),to=text(old.to);
  if(date(eff)&&date(today)&&eff>today&&(!from||(date(from)&&from<eff))){
    var end=dayBefore(eff);if(!to||!date(to)||to>end)old.to=end;
  }else{old.status='Inactive';old.to=eff;}
  return old;
}
return {selectDeal:selectDeal,resolve:resolve,supersede:supersede};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Pricing;
