# V43 — Easy Stock, Excel Import, Simple Navigation & Built-in Guide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Julphar Platform easier for a non-developer owner: one simple stock screen, Excel/CSV import for stock counts, orders, items & prices and deals (always previewed, never guessed), 5-section navigation, and an in-app "How it works" guide.

**Architecture:** Two new pure ES5 modules — `XlsxRead` (reads .xlsx/.csv into rows in the browser, no libraries: ZIP + `DecompressionStream('deflate-raw')` + `DOMParser`) and `Imp` (header detection, value parsing, row resolution into a preview plan per import type) — unit-tested in node. A UI module renders the Import wizard, the simplified Stock screen, grouped navigation and the Guide, and writes only through the existing guarded helpers (`commit`, `mutate`, `v42WriteMoves`) with audit rows. Everything is added by `src/build.py` patches on top of V42.

**Tech Stack:** Single-file HTML app (vanilla ES5 JS), artifact `db` (claude.use('db')), Python build script with count-asserted patches, node 22 unit tests, Playwright (Chromium) browser tests with the mock db, openpyxl only for creating NEW test fixture files.

**Spec:** `/home/claude/v43/ARCH_V42.md` (platform architecture & rules) + owner's V43 answers: imports = stock counts, orders, items & prices, deals; stock = "one simple screen"; simplicity = "fewer menu items" + "built-in guide".

## Global Constraints

- Data safety first: never delete; never overwrite a non-empty value with a blank; every write goes through `Store.put` with the expected version (via `commit`/`mutate`/`v42PutDoc`/`v42WriteMoves`) and adds an audit row; `Store.status().mode` must be `db` or `local` to write (use `v42Block()`).
- Never guess an ambiguous item or account: unresolved rows are status `choose` (owner picks) or `problem` (skipped); they are never written.
- Never treat a missing value as zero. Blank qty = row skipped. Blank price cell = keep the current value.
- IDs are max+1 (TX####, ITM###, SM#####, deal prefix + ###); gaps kept.
- No retro stock: imported Executed orders get `execAt = <order date>T12:00:00.000Z` (not "now"), so orders dated before an item's stock baseline never deduct.
- ES5 only in all browser JS (var/function; no arrow functions, let/const, template literals, spread, `includes`, `Object.entries`).
- No external scripts or libraries; the live page must stay self-contained. Live build embeds seed `{}`.
- Keep every existing `#sideNav button[data-view=...]` and `#topNav button[data-view=...]` element (tests and code depend on them).
- Plain-English copy for a non-developer, short labels, status messages in `aria-live` regions, phone width 390 px without horizontal page scroll.
- Doc size: keep each written doc's JSON ≤ 180,000 chars (orders/<ym> gets `-2`… overflow like audit/stock).
- Existing regression must keep passing: `node t/engine_test.js` (459), `t/tb_smoke.py` (113), `t/t42_audit.py` (431); `t1.py` 14/15 and `t3_v42.py` 46/47 are the known stale baselines.

## Review Focus

1. Excel cells that look like numbers but are text ("1,200", " 500 ", "65%", "0.65", "65") — expect correct numbers; percent accepted as 65, 65%, or 0.65 (≤ 1 means fraction). Test in Task 2.
2. Blank or "-" cells in price/qty columns — expect "keep current" for prices and "skip row" for qty, never 0. Test in Task 2.
3. The same item twice in one stock sheet, or a re-imported orders file — expect stock rows flagged `problem: appears twice`, and orders matching an existing line (account+date+item+qty) flagged `duplicate` and unticked by default. Test in Task 2.
4. Dates as Excel serial numbers, `2026-10-01`, `1/10/2026`, `01-10-2026` — expect day/month/year (Gulf convention) and the interpreted date shown in the preview; invalid → `problem`. Test in Task 2.
5. A 1,000-line orders file spanning months, or a write failing half-way — expect writes chunked per month doc with overflow, a result card listing what was saved and what was not, and no silent partial success. Test in Task 5.

---

## File Structure

- Create `src/v43_xlsx_read.js` — `XlsxRead`: `.read(arrayBuffer, filename) -> Promise<{sheets:[{name, rows:[[cell...]]}]}>`, `.parseCsv(text) -> rows`, `.serialToDate(n) -> 'YYYY-MM-DD'`. Pure, no DOM except `DOMParser`/`DecompressionStream`/`TextDecoder` (all available in node 22 too; for node tests use `@xmldom`? NO — node has no DOMParser: implement XML parsing with a tiny regex-based reader for the 3 XML parts used, so the same code runs in node and browser).
- Create `src/v43_import.js` — `Imp` (pure): field synonym tables, `detectHeader`, `num`, `pct`, `date`, `plan(type, rows, map, ctx, opts)`.
- Create `src/v43_ui.js` — Import wizard view, simplified Stock screen, grouped navigation, Guide view, templates download, writers.
- Create `src/v43.css`, `src/v43_html.py` (markup for `view-import`, `view-guide`, nav groups).
- Modify `src/build.py` — add a V43 section (include the 3 JS files after the V42 views, CSS, HTML, nav regroup).
- Tests: `t/xlsx_read_test.js`, `t/import_test.js` (node), `t/fx/*.xlsx|csv` (fixtures generated by `t/fx/make_fixtures.py`), `t/t43_ui.py` (browser).

---

### Task 1: Excel/CSV reader (`XlsxRead`)

**Files:**
- Create: `src/v43_xlsx_read.js`
- Create: `t/fx/make_fixtures.py`, `t/xlsx_read_test.js`

**Interfaces:**
- Produces: `XlsxRead.read(buf: ArrayBuffer|Uint8Array, filename: string) -> Promise<{sheets: Array<{name: string, rows: Array<Array<string|number|boolean|null>>}>}>` (rows are dense arrays, trailing empty cells trimmed, fully empty rows kept as `[]` so row numbers match Excel); `XlsxRead.parseCsv(text: string) -> Array<Array<string>>` (handles quotes, `""`, CRLF, `;` or `,` delimiter auto-detect from the first line, UTF-8 BOM); `XlsxRead.serialToDate(n: number) -> 'YYYY-MM-DD'` (1900 system, n ≥ 61 offset). Errors reject with `Error` whose `.code` is one of `'not_xlsx'|'no_inflate'|'empty'|'bad_zip'`.

- [ ] **Step 1: Create fixtures** — `t/fx/make_fixtures.py`:

```python
import openpyxl, datetime, os
D=os.path.dirname(os.path.abspath(__file__))
wb=openpyxl.Workbook(); ws=wb.active; ws.title='Stock'
ws.append(['Item','Qty','Notes'])
ws.append(['ADOL 500MG CAPL[2X12BL]SA-PVT',1200,'shelf A'])
ws.append(['ITM008','1,500',None])          # number stored as text with comma
ws.append([None,None,None])                  # empty row kept
ws.append(['adol drops 15ml',' 300 ','x'])
ws2=wb.create_sheet('Orders'); ws2.append(['Date','Account','Item','Qty','Status','Disc %'])
ws2.append([datetime.date(2026,10,2),'Adwaa Nimar','ADOL 500MG CAPL[2X12BL]SA-PVT',100,'Executed','50%'])
ws2.append(['1/10/2026','dallah clinics','ITM008',20,'Pending',None])
ws2.append([46297,'Amalona','ITM004',5,'',0.4])   # Excel serial 46297 = 2026-10-03
wb.save(os.path.join(D,'basic.xlsx'))
open(os.path.join(D,'basic.csv'),'w',encoding='utf-8-sig').write('Item;Qty\n"ADOL 500MG CAPL[2X12BL]SA-PVT";"1.200"\nITM008;40\n')
print('ok')
```

Run: `cd /home/claude/v43/t/fx && python3 make_fixtures.py` → `ok`.

- [ ] **Step 2: Write failing tests** — `t/xlsx_read_test.js`:

```js
var fs=require('fs'),path=require('path');var X=require('../src/v43_xlsx_read.js');
var pass=0,fail=0;function ok(n,c,i){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n,i===undefined?'':JSON.stringify(i));}}
(async function(){
  var r=await X.read(fs.readFileSync(path.join(__dirname,'fx/basic.xlsx')),'basic.xlsx');
  ok('two sheets in workbook order',r.sheets.length===2&&r.sheets[0].name==='Stock'&&r.sheets[1].name==='Orders',r.sheets.map(function(s){return s.name;}));
  var s=r.sheets[0].rows;
  ok('header row',JSON.stringify(s[0])==='["Item","Qty","Notes"]',s[0]);
  ok('number cell',s[1][1]===1200,s[1]);
  ok('text number kept as text',s[2][1]==='1,500',s[2]);
  ok('empty row kept',Array.isArray(s[3])&&s[3].length===0,s[3]);
  ok('row count',s.length===5,s.length);
  var o=r.sheets[1].rows;
  ok('date cell to ISO',o[1][0]==='2026-10-02',o[1][0]);
  ok('serial stays number',o[3][0]===46297,o[3][0]);
  ok('serialToDate',X.serialToDate(46297)==='2026-10-03',X.serialToDate(46297));
  var c=X.parseCsv(fs.readFileSync(path.join(__dirname,'fx/basic.csv'),'utf8'));
  ok('csv semicolon + BOM + quotes',c[0][0]==='Item'&&c[1][0]==='ADOL 500MG CAPL[2X12BL]SA-PVT'&&c[1][1]==='1.200'&&c[2][1]==='40',c);
  ok('csv quoted comma',JSON.stringify(X.parseCsv('a,b\n"x, y",2'))==='[["a","b"],["x, y","2"]]');
  try{await X.read(new Uint8Array([1,2,3]),'bad.xlsx');ok('bad file rejects',false);}catch(e){ok('bad file rejects with code',e.code==='not_xlsx'||e.code==='bad_zip',e.code);}
  var t0=Date.now();for(var i=0;i<20;i++)await X.read(fs.readFileSync(path.join(__dirname,'fx/basic.xlsx')),'b.xlsx');ok('fast',Date.now()-t0<2000,Date.now()-t0);
  console.log((fail?'FAILED':'ALL PASSED')+': '+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})();
```

- [ ] **Step 3: Run to see it fail** — `node t/xlsx_read_test.js` → fails (module missing).

- [ ] **Step 4: Implement `src/v43_xlsx_read.js`** (ES5; uses `DecompressionStream('deflate-raw')` and `TextDecoder`; XML via small regex readers, no DOMParser so node can run it):

```js
var XlsxRead=(function(){"use strict";
  function err(code,msg){var e=new Error(msg);e.code=code;return e;}
  function u8(b){return b instanceof Uint8Array?b:new Uint8Array(b);}
  function rd16(a,o){return a[o]|(a[o+1]<<8);}function rd32(a,o){return (a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24))>>>0;}
  function unzip(buf){ /* central directory */
    var a=u8(buf),n=a.length,eocd=-1,i;
    if(n<22||a[0]!==0x50||a[1]!==0x4b)throw err('not_xlsx','This is not an Excel (.xlsx) file.');
    for(i=n-22;i>=Math.max(0,n-65557);i--){if(rd32(a,i)===0x06054b50){eocd=i;break;}}
    if(eocd<0)throw err('bad_zip','The Excel file looks damaged.');
    var cnt=rd16(a,eocd+10),off=rd32(a,eocd+16),files={};
    for(i=0;i<cnt;i++){
      if(rd32(a,off)!==0x02014b50)throw err('bad_zip','The Excel file looks damaged.');
      var method=rd16(a,off+10),csize=rd32(a,off+20),nl=rd16(a,off+28),xl=rd16(a,off+30),cl=rd16(a,off+32),lho=rd32(a,off+42);
      var name=new TextDecoder().decode(a.subarray(off+46,off+46+nl));
      var lnl=rd16(a,lho+26),lxl=rd16(a,lho+28),start=lho+30+lnl+lxl;
      files[name]={method:method,data:a.subarray(start,start+csize)};
      off+=46+nl+xl+cl;
    }
    return files;
  }
  function inflate(f){
    if(f.method===0)return Promise.resolve(f.data);
    if(f.method!==8)return Promise.reject(err('bad_zip','Unsupported compression in the Excel file.'));
    if(typeof DecompressionStream==='undefined')return Promise.reject(err('no_inflate','This browser cannot open .xlsx files. Save the sheet as CSV and import that.'));
    var ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(f.data);w.close();
    return new Response(ds.readable).arrayBuffer().then(function(b){return new Uint8Array(b);});
  }
  function text(f){return inflate(f).then(function(b){return new TextDecoder().decode(b);});}
  function unesc(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,function(m,d){return String.fromCharCode(+d);}).replace(/&#x([0-9a-f]+);/gi,function(m,h){return String.fromCharCode(parseInt(h,16));}).replace(/&amp;/g,'&');}
  function attr(tag,name){var m=new RegExp('\\s'+name+'="([^"]*)"').exec(tag);return m?unesc(m[1]):null;}
  function tTexts(xml){var out=[],re=/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g,m;while((m=re.exec(xml)))out.push(m[1]==null?'':unesc(m[1]));return out.join('');}
  function shared(xml){var out=[],re=/<si>([\s\S]*?)<\/si>|<si\/>/g,m;while((m=re.exec(xml)))out.push(m[1]==null?'':tTexts(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g,'')));return out;}
  function colIdx(ref){var m=/^([A-Z]+)/.exec(ref||''),n=0,i;if(!m)return -1;for(i=0;i<m[1].length;i++)n=n*26+(m[1].charCodeAt(i)-64);return n-1;}
  function dateStyles(stylesXml){ /* style index -> isDate */
    var fmts={},m,re=/<numFmt\s[^>]*>/g;while((m=re.exec(stylesXml||''))){var id=+attr(m[0],'numFmtId'),code=(attr(m[0],'formatCode')||'').toLowerCase().replace(/"[^"]*"|\[[^\]]*\]/g,'');fmts[id]=/[dy]/.test(code)||(/m/.test(code)&&/[hs]/.test(code)===false&&/[dy]/.test(code));}
    var cx=/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml||''),list=[];if(!cx)return list;
    var re2=/<xf\s[^>]*?(?:\/>|>)/g;while((m=re2.exec(cx[1]))){var nid=+(attr(m[0],'numFmtId')||0);list.push((nid>=14&&nid<=22)||(nid>=45&&nid<=47)||!!fmts[nid]);}
    return list;
  }
  function serialToDate(n){var ms=Math.round((n-25569)*86400000),d=new Date(ms);return d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2);}
  function sheetRows(xml,ss,isDate){
    var rows=[],rm,rre=/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g;
    while((rm=rre.exec(xml))){
      var rattr=rm[1]||rm[3]||'',rn=+(attr('<x '+rattr,'r')||rows.length+1),row=[];
      while(rows.length<rn-1)rows.push([]);
      var body=rm[2]||'',cm,cre=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      while((cm=cre.exec(body))){
        var ca='<x '+cm[1],ref=attr(ca,'r'),t=attr(ca,'t'),s=+(attr(ca,'s')||0),inner=cm[2]||'',ci=ref?colIdx(ref):row.length,v=null;
        var vm=/<v>([\s\S]*?)<\/v>/.exec(inner);
        if(t==='s')v=vm?(ss[+vm[1]]==null?'':ss[+vm[1]]):null;
        else if(t==='inlineStr')v=tTexts(inner);
        else if(t==='str'||t==='e')v=vm?unesc(vm[1]):null;
        else if(t==='b')v=vm?vm[1]==='1':null;
        else if(vm){var num=parseFloat(vm[1]);v=isFinite(num)?(isDate[s]&&num>=1?serialToDate(num):num):unesc(vm[1]);}
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
    if(/\.csv$|\.txt$/i.test(filename||'')){var t=new TextDecoder().decode(a);var rows=parseCsv(t);if(!rows.length)return Promise.reject(err('empty','The file is empty.'));return Promise.resolve({sheets:[{name:filename||'CSV',rows:rows}]});}
    var files;try{files=unzip(a);}catch(e){return Promise.reject(e);}
    if(!files['xl/workbook.xml'])return Promise.reject(err('not_xlsx','This is not an Excel (.xlsx) file. Old .xls files: open in Excel and save as .xlsx or CSV.'));
    var get=function(p){return files[p]?text(files[p]):Promise.resolve('');};
    return Promise.all([get('xl/workbook.xml'),get('xl/_rels/workbook.xml.rels'),get('xl/sharedStrings.xml'),get('xl/styles.xml')]).then(function(r){
      var wb=r[0],rels=r[1],ss=shared(r[2]),isDate=dateStyles(r[3]),relMap={},m,re=/<Relationship\s[^>]*>/g;
      while((m=re.exec(rels))){relMap[attr(m[0],'Id')]=attr(m[0],'Target');}
      var sheets=[],sre=/<sheet\s[^>]*>/g;
      while((m=sre.exec(wb))){var nm=attr(m[0],'name'),rid=attr(m[0],'r:id'),tg=relMap[rid]||'';tg=tg.replace(/^\/?xl\//,'').replace(/^\//,'');sheets.push({name:nm,path:'xl/'+tg});}
      return Promise.all(sheets.map(function(s){return get(s.path).then(function(x){return {name:s.name,rows:sheetRows(x,ss,isDate)};});}));
    }).then(function(sh){if(!sh.length)throw err('empty','The workbook has no sheets.');return {sheets:sh};});
  }
  function parseCsv(text){
    text=String(text||'').replace(/^﻿/,'');
    var first=text.split(/\r?\n/)[0]||'',d=(first.split(';').length>first.split(',').length)?';':(first.indexOf('\t')>=0&&first.split('\t').length>first.split(',').length?'\t':',');
    var rows=[],row=[],cell='',q=false,i,c;
    for(i=0;i<text.length;i++){c=text[i];
      if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}
      else if(c==='"')q=true;else if(c===d){row.push(cell);cell='';}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
      else cell+=c;}
    if(cell!==''||row.length){row.push(cell);rows.push(row);}
    while(rows.length&&rows[rows.length-1].join('')==='')rows.pop();
    return rows;
  }
  return {read:read,parseCsv:parseCsv,serialToDate:serialToDate};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=XlsxRead;
```

- [ ] **Step 5: Run tests** — `node t/xlsx_read_test.js` → `ALL PASSED`. Fix the reader (not the tests) until green; also verify a real workbook: the project file `Julphar_Sales_Account_Management_System_7.xlsx` if present in uploads, else `t/export.xlsx` from V41 (`/home/claude/v41/t/export.xlsx`): it must read all sheets without error (add an `ok` that the Orders sheet has > 400 rows).
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(v43): xlsx/csv reader with tests"`

---

### Task 2: Import engine (`Imp`) — header detection, value parsing, row plans

**Files:**
- Create: `src/v43_import.js`
- Create: `t/import_test.js`

**Interfaces:**
- Consumes: `Eng.ctx(docs,today)` (V42 engine; `ctx.items`, `ctx.accounts`, `ctx.orders`, `ctx.moves`, `ctx.itemById`, `ctx.acctByName`) and `Eng.ownStock(ctx)`.
- Produces:
  - `Imp.TYPES = ['stock','orders','items','deals']`
  - `Imp.FIELDS[type] -> [{key, label, required:bool, syn:[lowercase synonyms]}]`
  - `Imp.detectHeader(rows, type) -> {row: index|-1, map: {key: colIndex}, missing: [keys]}` (scans the first 15 rows; picks the row with most synonym hits ≥ 2)
  - `Imp.num(v) -> number|null` ("1,200"→1200; "1.200" → 1200 only when it has exactly 3 digits after a single dot AND no other dot/comma, else 1.2; " 300 "→300; ""/"-"/null→null; "abc"→NaN-free null with `Imp.num.bad=true` is NOT used: return `undefined` for unparsable text so callers can say "not a number")
  - `Imp.pct(v) -> fraction|null|undefined` (65→0.65, "65%"→0.65, 0.65→0.65, "0.65"→0.65, 100→1, >100 or <0 → undefined)
  - `Imp.date(v) -> 'YYYY-MM-DD'|null|undefined` (ISO; Excel serial number 20000–80000; d/m/yyyy, d-m-yyyy, d.m.yyyy with 2- or 4-digit year → day/month/year; blank → null; else undefined)
  - `Imp.plan(type, rows, hdr, ctx, opts) -> {rows:[PlanRow], counts:{ready,update,same,new,choose,problem,duplicate,skip}}`
    - `opts = {today:'YYYY-MM-DD', matchItem: function(text) -> {item: itemObj}|{cand:[itemObj]}|null, account: NAME|null (stock: account scope), defaultStatus:'Executed'}`
    - `PlanRow = {n: excelRowNumber, raw: [cells], status: 'ready'|'update'|'same'|'new'|'choose'|'problem'|'duplicate', msg: string, include: bool, item: itemObj|null, cand: [itemObj], account: acctObj|null, data: {...type-specific}, changes: [{field, old, new}]}`
  - Item resolution order (shared by all types): (1) item ID exact (`/^ITM\d+$/i`), (2) official name exact, case-insensitive, trimmed, (3) `short` name exact case-insensitive when unique, (4) `opts.matchItem(text)` (the UI passes the V41 smart matcher) → one item = ready but `msg:'matched "text"'`; several = `choose` with `cand`; none = `problem 'Unknown item'`. Inactive items → `problem 'Item is inactive'` (items import may reactivate via `active` column).
  - Account resolution: account ID exact (`/^ACC\d+$/i`), name exact case-insensitive, alias (`aliases` string split by `,;|`) exact case-insensitive; otherwise `problem 'Unknown account'`. Closed/inactive account → `problem 'Account is closed'`.
  - Type rules:
    - **stock**: fields item*, qty*, account (optional; overrides opts.account), notes. qty must be an integer ≥ 0 (`problem` otherwise; blank → status `problem 'No quantity'`, include false). Same item (and account) twice in the file → both rows `problem 'Appears twice in the file (rows a and b)'`. `data = {type: tracked?'COUNT':'OPEN', scope: account?'acct':'own', qty, current: onHand|null}`; status `update` when tracked and qty ≠ onHand, `same` when equal (include false), `new` when untracked (starts tracking).
    - **orders**: fields date*, account*, item*, qty*, status, disc (optional %), notes. status blank → opts.defaultStatus; must be one of Executed/Pending/Quoted (case-insensitive); Executed with date in the future → `problem`. qty integer 1..1,000,000. Pricing: disc given → that pct with `src:'Imported discount'`; blank → `opts.price(accountName, itemName)` (UI passes the V41 `resolve`) → `{pct, src}`; pct null → `problem 'No price rule (REVIEW)'`. Duplicate guard: an existing non-Cancelled line with same account+date+itemId+qty → `duplicate`, include false (owner may tick). Same duplicate inside the file → second one `duplicate`. `data = {date, status, qty, pct, src, rsp: item.rsp, net: round2(qty*rsp*(1-pct)), notes}`.
    - **items**: fields id, name, short, rsp, price (2026 price / stdNet), std (standard discount %), category, form, strength, pack, active. Row with id or exact name of an existing item → compare provided NON-BLANK fields only; `changes` lists differences; none → `same`; some → `update`. Name not found and no id → `new` (requires name and rsp > 0, else `problem`). `rsp`/`price` must be > 0 numbers; `std` via `Imp.pct`; `active` accepts yes/no/true/false/1/0/active/inactive. A name change on an item used by orders or deals → `problem 'Name is fixed because orders or deals use this item'` for that field only (row still updates other fields; the name change is dropped with a msg).
    - **deals**: fields account*, item*, disc*, from (date), notes. disc via `Imp.pct`; current active deal equal → `same`; different → `update` (`changes:[{field:'pct',old,new}]`); none → `new`. Item without RSP → `problem`. `from` blank → today.

- [ ] **Step 1: Write failing tests** — `t/import_test.js` (fixtures built inline from `t/livestore.json` with `Eng.ctx`):

```js
var Eng=require('../src/v42_engine.js'),Imp=require('../src/v43_import.js'),docs=require('./livestore.json');
var pass=0,fail=0;function ok(n,c,i){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n,JSON.stringify(i));}}
var today='2026-10-01',ctx=Eng.ctx(JSON.parse(JSON.stringify(docs)),today);
function mi(t){return null;} function price(a,i){return {pct:0.3,src:'Standard rule'};}
// numbers
ok('num comma',Imp.num('1,200')===1200);ok('num thousands dot',Imp.num('1.200')===1200);ok('num decimal dot',Imp.num('1.25')===1.25);
ok('num spaces',Imp.num(' 300 ')===300);ok('num blank',Imp.num('')===null&&Imp.num('-')===null&&Imp.num(null)===null);ok('num text',Imp.num('abc')===undefined);
ok('pct 65',Imp.pct(65)===0.65);ok('pct str',Imp.pct('65%')===0.65);ok('pct frac',Imp.pct(0.65)===0.65&&Imp.pct('0.65')===0.65);ok('pct bad',Imp.pct(150)===undefined&&Imp.pct(-1)===undefined);ok('pct blank',Imp.pct('')===null);
ok('date iso',Imp.date('2026-10-01')==='2026-10-01');ok('date serial',Imp.date(46297)==='2026-10-03');ok('date dmy',Imp.date('1/10/2026')==='2026-10-01'&&Imp.date('01-10-2026')==='2026-10-01'&&Imp.date('3.10.26')==='2026-10-03');
ok('date bad',Imp.date('31/02/2026')===undefined&&Imp.date('hello')===undefined);ok('date blank',Imp.date('')===null);
// header
var h=Imp.detectHeader([['Julphar stock'],[],['Item name','Quantity','Remarks'],['ITM004',5]],'stock');
ok('header found on row 3',h.row===2&&h.map.item===0&&h.map.qty===1&&h.map.notes===2,h);
ok('missing required reported',Imp.detectHeader([['Item']],'stock').missing.indexOf('qty')>=0);
// stock plan
var rows=[['Item','Qty'],['ITM004','1,200'],['adol 500mg capl[2x12bl]sa-pvt',''],['ITM008',5],['ITM008',6],['NOPE',3],['ITM004',-1]];
var p=Imp.plan('stock',rows,Imp.detectHeader(rows,'stock'),ctx,{today:today,matchItem:mi});
ok('stock new untracked',p.rows[0].status==='new'&&p.rows[0].data.type==='OPEN'&&p.rows[0].data.qty===1200&&p.rows[0].include,p.rows[0]);
ok('stock blank qty skipped',p.rows[1].status==='problem'&&!p.rows[1].include,p.rows[1]);
ok('stock twice flagged',p.rows[2].status==='problem'&&p.rows[3].status==='problem'&&/twice/.test(p.rows[2].msg),[p.rows[2],p.rows[3]]);
ok('stock unknown item',p.rows[4].status==='problem'&&/Unknown item/.test(p.rows[4].msg));
ok('stock negative refused',p.rows[5].status==='problem');
ok('excel row numbers',p.rows[0].n===2&&p.rows[5].n===7,p.rows.map(function(r){return r.n;}));
// orders plan
var orows=[['Date','Account','Item','Qty','Status','Disc'],['2026-10-01','adwaa nimar','ITM004',500,'executed',''],['2026-10-01','Adwaa Nimar','ITM004',500,'',''],['2026-10-05','Amalona','ITM004',10,'Executed',''],['2026-10-01','Ghost','ITM004',1,'',''],['2026-10-01','Amalona','ITM004',7,'Pending','40%']];
var op=Imp.plan('orders',orows,Imp.detectHeader(orows,'orders'),ctx,{today:today,matchItem:mi,price:price,defaultStatus:'Executed'});
ok('orders duplicate of TX0501',op.rows[0].status==='duplicate'&&!op.rows[0].include,op.rows[0]);
ok('orders in-file duplicate',op.rows[1].status==='duplicate',op.rows[1]);
ok('orders future executed refused',op.rows[2].status==='problem',op.rows[2]);
ok('orders unknown account',op.rows[3].status==='problem'&&/Unknown account/.test(op.rows[3].msg));
ok('orders priced by disc',op.rows[4].status==='ready'&&op.rows[4].data.pct===0.4&&op.rows[4].data.src==='Imported discount'&&op.rows[4].data.net===Math.round(7*ctx.itemById.ITM004.rsp*0.6*100)/100,op.rows[4]);
// items plan
var irows=[['ID','Name','RSP','Std %'],['ITM004','',5.05,''],['ITM004','',6,''],['','NEW TEST ITEM 10MG',12,'30'],['','NO PRICE ITEM','','']];
var ip=Imp.plan('items',irows,Imp.detectHeader(irows,'items'),ctx,{today:today,matchItem:mi});
ok('items same when unchanged',ip.rows[0].status==='same',ip.rows[0]);
ok('items update rsp only',ip.rows[1].status==='update'&&ip.rows[1].changes.length===1&&ip.rows[1].changes[0].field==='rsp'&&ip.rows[1].changes[0].new===6,ip.rows[1]);
ok('items new',ip.rows[2].status==='new'&&ip.rows[2].data.std===0.3,ip.rows[2]);
ok('items new needs rsp',ip.rows[3].status==='problem',ip.rows[3]);
// deals plan
var drows=[['Account','Item','Discount'],['Adwaa Nimar','NEGAZOLE 500MG FC TAB[2X10BL]SA-PVT','65%'],['Adwaa Nimar','NEGAZOLE 500MG FC TAB[2X10BL]SA-PVT','60'],['Adwaa Nimar','ITM004','45']];
var dp=Imp.plan('deals',drows,Imp.detectHeader(drows,'deals'),ctx,{today:today,matchItem:mi});
ok('deal same',dp.rows[0].status==='same');ok('deal update',dp.rows[1].status==='update'&&dp.rows[1].changes[0].old===0.65&&dp.rows[1].changes[0].new===0.6,dp.rows[1]);ok('deal new',dp.rows[2].status==='new');
ok('no NaN anywhere',JSON.stringify([p,op,ip,dp]).indexOf('NaN')<0);
console.log((fail?'FAILED':'ALL PASSED')+': '+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
```

(Note: the in-file duplicate test row 2 is a duplicate of row 1 AND of TX0501; status `duplicate` either way. Deal tests rely on live ADW001 = NEGAZOLE 65% for Adwaa Nimar.)

- [ ] **Step 2: Run to see it fail** — `node t/import_test.js` → module missing.
- [ ] **Step 3: Implement `src/v43_import.js`** to the interface above (ES5, `var Imp=(function(){...})(); if(typeof module!=='undefined'&&module.exports)module.exports=Imp;`; requires `Eng` only through the passed `ctx`; synonyms at minimum:
  - item: item, item name, product, sku, description, name (stock/orders/deals only), code, item code, item id
  - qty: qty, quantity, count, stock, on hand, units, boxes, balance
  - account: account, customer, client, pharmacy, account name
  - date: date, order date, invoice date
  - status: status, order status
  - disc: disc, discount, disc %, discount %, deal, deal %, %
  - notes: notes, note, remarks, comment
  - from: from, valid from, effective, effective date
  - items type: id (id, item id, code, item code), name (name, item name, product, description), short, rsp (rsp, retail price, ref price), price (price, price 2026, net price, std net), std (std, std %, standard discount, standard %), category (category, brand), form, strength, pack, active (active, status)
  Header match = trimmed lowercase cell equal to a synonym, or containing it as a whole word for synonyms of length ≥ 4.)
- [ ] **Step 4: Run** `node t/import_test.js` → ALL PASSED; also `node t/engine_test.js` still 459.
- [ ] **Step 5: Commit** — `git commit -am "feat(v43): import engine (header detect, parsing, plans) with tests"`

---

### Task 3: Simple Stock screen

**Files:**
- Modify: `src/v42_views.js` only if strictly needed (prefer overriding `renderStock` in `src/v43_ui.js` and reassigning `RENDER.stock`)
- Create/Modify: `src/v43_ui.js`, `src/v43.css`
- Test: `t/t43_ui.py` (stock part)

**Interfaces:**
- Consumes: `Eng.ownStock(ctx)` rows `{itemId,item,status,tracked,onHand,reserved,available,dailyUse,coverDays,expected,projected}`, `v42Ctx()`, `v42WriteMoves(rows) -> Promise<{rows,warn}>` (rows: `{type:'OPEN'|'COUNT'|'RECEIPT'|'ADJUST', scope:'own'|'acct', itemId, item, qty, account?, accountId?, notes?, date?}`), `v42MovesDone(res, okText)`.
- Produces: `renderStock()` (new, assigned to `RENDER.stock`), element ids: `#skSearch`, `#skFilter` (chips: All / Needs attention / Tracked / Not tracked), table `#skTable` with one row per active item: **Item | You have | On order (reserved) | Left | Status | Update** where Update = number input `.sk-qty[data-item=ITMxxx]` + Save button `.sk-save` (tracked → COUNT, untracked → OPEN, blank → nothing), a "More details" toggle `#skMore` that adds columns Daily use / Cover days / Expected 30 d; top action bar: `#skUpload` (opens Import with type stock), `#skTemplate` (downloads the stock sheet template), `#skReceive` (dialog: item + qty → RECEIPT), `#skAcct` (link to account stock tab — keep V42 account-stock, movements as secondary tabs "Customers' stock" and "History").
- Behaviour: "Save all changed" button `#skSaveAll` saves every edited input in one `v42WriteMoves` call; unsaved edits highlighted; leaving the screen with unsaved edits asks to confirm. Status text in plain words: "Out", "Will run short", "Low", "OK", "Not tracked yet". Numbers for untracked rows are empty (never 0).

- [ ] **Step 1: Write the failing browser test** in `t/t43_ui.py` (pattern from `t/tb_smoke.py`: mock db preloaded with `t/livestore.json`; helper `check(name, cond, info)`):

```python
nav('stock'); pg.wait_for_selector('#skTable')
check('simple stock: one row per active item', pg.eval_on_selector_all('#skTable tbody tr','e=>e.length')==pg.evaluate("D.activeItems.length"))
check('untracked shows no zero', 'Not tracked' in pg.inner_text('#skTable tbody tr:first-child'))
pg.fill('.sk-qty[data-item="ITM004"]','2000'); pg.fill('.sk-qty[data-item="ITM008"]','500'); pg.click('#skSaveAll'); pg.wait_for_timeout(800)
st=pg.evaluate("window.__mock.store()"); mv=[r for k,v in st.items() if k.startswith('stock/2') for r in v['rows']]
check('save all wrote 2 OPEN moves', sorted((m['itemId'],m['type'],m['qty']) for m in mv)==[('ITM004','OPEN',2000),('ITM008','OPEN',500)], mv)
pg.fill('.sk-qty[data-item="ITM004"]','1900'); pg.click('.sk-save[data-item="ITM004"]'); pg.wait_for_timeout(600)
check('second update is a COUNT', any(m['type']=='COUNT' and m['qty']==1900 for v in pg.evaluate("window.__mock.store()").values() if isinstance(v,dict) and 'rows' in v for m in v['rows'] if isinstance(m,dict) and m.get('id','').startswith('SM')))
check('You have = 1900', '1,900' in pg.inner_text('#skTable tr[data-item="ITM004"]'))
pg.click('#skMore'); check('more details shows cover days', 'Cover' in pg.inner_text('#skTable thead'))
```

- [ ] **Step 2: Run** — fails (no `#skTable`).
- [ ] **Step 3: Implement** `renderStock` and wiring in `src/v43_ui.js`; keep the V42 dialogs for Receive/Adjust by calling the existing functions (find them in `src/v42_views.js`; reuse, do not duplicate write logic).
- [ ] **Step 4: Build & run** — `cd src && python3 build.py live ../out/live.html && python3 build.py offline ../out/offline.html && cd ../t && python3 t43_ui.py` → stock checks PASS; `python3 tb_smoke.py` — update only the stock-screen selectors that V43 deliberately replaced (list them in the commit message).
- [ ] **Step 5: Commit** — `git commit -am "feat(v43): one simple stock screen"`

---

### Task 4: Import wizard UI + templates

**Files:**
- Modify: `src/v43_ui.js`, `src/v43.css`, `src/v43_html.py`, `src/build.py`
- Test: `t/t43_ui.py` (import part), fixtures from Task 1 + new `t/fx/make_fixtures.py` outputs `orders_import.xlsx`, `items_import.xlsx`, `deals_import.xlsx`, `stock_import.xlsx`

**Interfaces:**
- Consumes: `XlsxRead.read`, `Imp.detectHeader`, `Imp.plan`, `Imp.FIELDS`, `plResolveLine(text) -> {item, cand:[names]}` (adapt to `opts.matchItem` returning item objects via `itemMap`), `resolve(accountName, itemName) -> {pct, src}` for `opts.price`.
- Produces: view `view-import` (`RENDER.import = renderImport`), `v43OpenImport(type)` (shows Import with type preselected; used by Stock/Items/Pricing/Orders buttons), `v43Template(type)` (downloads `<Company>_<Type>_template.xlsx` built with the existing `zipStore`/`xSheet` writer: Stock template = all active items with ID, Item, current "You have" (blank when untracked), empty "New quantity" column; Orders = headers + 1 example row; Items = all items with current values; Deals = active deals).
- Wizard steps (one card each, progressively revealed):
  1. **What are you importing?** 4 big buttons (Stock counts / Orders / Items & prices / Deals) + "Download a ready template" link per type. Stock: extra select "Whose stock?" (My stock / an account).
  2. **Choose the file** (`<input type=file accept=".xlsx,.csv">`) → sheet select when > 1 sheet (default: the sheet whose detected header has most hits).
  3. **Check the columns**: one row per field: label, required mark, a select of the sheet's header cells (auto-filled from `detectHeader`); missing required → red message, Next disabled.
  4. **Preview**: summary chips (Ready n · Will update n · New n · Same n · Needs choosing n · Problems n · Duplicates n), table with Excel row number, what will happen in words ("Set stock to 1,200 (now 1,000)", "New order line 100 × ADOL… 50% = 252.50", "RSP 5.05 → 6.00"), a checkbox per row (problem rows have no checkbox), a select for `choose` rows (candidates), filter by chip. Orders preview shows totals (lines, qty, net) of ticked rows.
  5. **Confirm**: button "Import n rows" (disabled at 0) → confirmBox repeating the counts → writes → result card: saved counts per kind, any failures with Excel row numbers, "Download import report (CSV)" with every row's outcome, and links (e.g. "See in Orders").
- Writers (all in `src/v43_ui.js`, each returns `Promise<{saved:n, failed:[{n,msg}], warn:''}>`, refuse with `v42Block()` message when not writable):
  - stock → one `v42WriteMoves(rows)` call per 300 rows.
  - orders → group by month; per month one `commit([{path: ordersPathFor(ym), fn}], auditRows)` where `ordersPathFor` returns `orders/<ym>` or the first overflow `orders/<ym>-N` whose JSON is < 180,000 chars; IDs via `nextTxNum(extraRows)`; rows `{id, date, account, origDesc: raw item text, itemId, item, qty, rsp, pct, src, source:'Excel import <file>', status, notes, orderRef:'IMP-<yyyymmddhhmmss>-<account index>', createdAt: ts, updatedAt: ts, execAt: status==='Executed' ? date+'T12:00:00.000Z' : undefined}` priced with the existing `priceRow`; audit `ADD_ORDER` per line with notes 'import <file>'. Check that `dataCheck()`'s "order month matches doc" rule accepts `orders/<ym>-N` paths (adjust the check to `p.slice(7,14)` if needed and say so).
  - items → one `commit` on `master/items`: updates set only changed fields, new items get `ITM` + max+1 (3 digits) with `active:true, source:'Excel import'`; audit `UPDATE_ITEM` per changed field / `ADD_ITEM` per new item.
  - deals → per account one `commit` on `deals/<ACCxx>` using exactly the V41 `dcBuild` logic (retire current Active row: `status:'Inactive', to: from, updated: today`; push new row with `dealPrefix` + max+1); audit `ADD_DEAL`/`UPDATE_DEAL`.
- Buttons added: Stock bar `#skUpload`; Items page "Import from Excel"; Pricing page "Import deals from Excel"; Orders page "Import orders from Excel".

- [ ] **Step 1: Fixtures** — extend `t/fx/make_fixtures.py` to write the four `*_import.xlsx` files (headers deliberately in Arabic-free English variants: "Product", "Quantity", "Customer", "Order Date", "Discount %"; include one ambiguous item text "adol", one unknown account, one duplicate of TX0501, numbers as text "1,200").
- [ ] **Step 2: Failing browser tests** in `t/t43_ui.py` — for each type: open Import via its page button, `pg.set_input_files('#impFile', fixture)`, assert detected columns, assert chip counts equal the node `Imp.plan` counts for the same file (compute via `pg.evaluate` calling `Imp.plan` on `XlsxRead.read` of the same bytes), tick/untick, resolve the `choose` row by selecting a candidate, Import, then assert from `window.__mock.store()`: exact new rows, audit rows added = rows written (+ per-field for items), no other doc changed (deep-compare all other docs before/after ignoring `updatedAt` of the written docs), KPI `#kpiNet` data-exact increased by exactly the imported executed net (orders), stock on hand equals the sheet value, deals active pct equals the sheet value and the old deal is Inactive. Re-import the same orders file → all rows `duplicate`, Import button disabled.
- [ ] **Step 3: Implement** the wizard and writers.
- [ ] **Step 4: Build, run** `t43_ui.py`, `tb_smoke.py`, `t42_audit.py`, `node t/engine_test.js`, `node t/import_test.js`, `node t/xlsx_read_test.js` → all green (list any deliberate selector updates).
- [ ] **Step 5: Commit** — `git commit -am "feat(v43): Excel import wizard (stock, orders, items, deals) + templates"`

---

### Task 5: Big-file and failure handling for imports

**Files:** Modify `src/v43_ui.js`; Test `t/t43_ui.py`

**Interfaces:** Consumes the Task 4 writers; produces the result card contract `{saved, failed:[{n,msg}], warn}` rendered in `#impResult`.

- [ ] **Step 1: Failing tests** — generate in the test a 1,000-line orders CSV across 2026-08..2026-10 (valid accounts/items from livestore, unique qty to avoid duplicates); import; assert 1,000 lines saved, every `orders/*` doc JSON < 180,000 chars, IDs contiguous max+1, audit rows 1,000, total time < 20 s on the mock. Then set `window.__mock.failNext='unavailable'; window.__mock.failCount=50` midway (after the first month committed) and assert: result card lists the failed Excel rows, the saved count equals rows actually in the store, a re-run of the same file marks the saved ones `duplicate` and imports only the rest.
- [ ] **Step 2: Implement** — sequential month commits with progress text "Saving month 2 of 3…"; on a failure stop further writes, report saved vs not saved, keep the wizard on the preview so a re-run is possible.
- [ ] **Step 3: Run tests** → green. **Step 4: Commit** — `git commit -am "feat(v43): import chunking, progress and partial-failure report"`

---

### Task 6: 5-section navigation

**Files:** Modify `src/build.py` (nav markup patches), `src/v43_html.py`, `src/v43.css`, `src/v43_ui.js`; Test `t/t43_ui.py`

**Interfaces:** Produces sections (ids `nav-today`, `nav-sell`, `nav-stock`, `nav-customers`, `nav-reports`):
- **Today** → today
- **Sell** → order (New order), orders, forecast (Reorder plan)
- **Stock** → stock, import (label "Import Excel")
- **Customers & prices** → accounts, pricing, items
- **Reports & data** → dashboard, targets, data, guide (label "How it works")
Sidebar: section headings (not buttons) with the existing `button[data-view]` items nested beneath, same order as above; the current view's section is visually expanded. Phone (`#topNav`): first row = 5 section buttons (`button[data-section]`), second row = the pages of the active section (`button[data-view]`, existing elements moved, not recreated). All existing `data-view` buttons stay in the DOM (the `show()` aria-current logic keeps working).

- [ ] **Step 1: Failing test** — assert 5 headings in `#sideNav`, every one of the 13 views reachable by clicking its `#sideNav button[data-view]`, at 390 px the `#topNav [data-section]` row has 5 buttons and clicking "Sell" shows New order / Orders / Reorder plan, no horizontal scroll on any view.
- [ ] **Step 2: Implement.** **Step 3: Run** `t43_ui.py` + `tb_smoke.py` + `t1.py` + `t3_v42.py` (nav selectors must still work). **Step 4: Commit** — `git commit -am "feat(v43): five-section navigation"`

---

### Task 7: "How it works" guide

**Files:** Modify `src/v43_html.py` (markup `view-guide`), `src/v43.css`; Test `t/t43_ui.py`

**Interfaces:** `RENDER.guide` renders brand-aware text into `#guideBody`.

Content (plain English, short):
1. **The big picture** — an inline SVG diagram (theme-aware: colours from CSS variables, text uses `currentColor`; readable at 390 px — stack vertically below 600 px): *You enter* (New order · Stock updates · Excel import) → *Platform database* (every change saved with history) → *You see* (Today · Stock · Targets · Dashboard) → *You take out* (Excel export · PDF · Backup).
2. **Your daily routine** — 5 steps: open Today → act on alerts → enter orders (or import) → update stock when you count → download a backup weekly.
3. **What each section does** — one card per nav section with its pages.
4. **How the numbers are made** — Stock ("You have = your last count + deliveries − orders executed after the count; Left = You have − orders still pending"), Expected orders (rhythm + usual quantity, lapsed rule), Targets (history vs potential, growth, fixed), Prices (deal → standard → review; saved lines keep their price).
5. **Safety** — nothing is deleted, cancel keeps history, imports always preview, restore from backup.
6. **Excel import cheatsheet** — the 4 types with the required columns and a "Download template" button each (calls `v43Template`).

- [ ] **Step 1: Failing test** — guide view has the SVG with 4 groups, 6 section headings, 4 template buttons that each produce a download in `window.__mock.downloads`, no overflow at 390 px, dark theme screenshot readable (contrast check: SVG text fill resolves to the body text colour).
- [ ] **Step 2: Implement.** **Step 3: Run tests.** **Step 4: Commit** — `git commit -am "feat(v43): built-in How it works guide"`

---

### Task 8: Whole-release verification, review, publish

**Files:** `AUDIT_V43.md`, `docs/V43_release.md`

- [ ] **Step 1:** Full suites: `node t/xlsx_read_test.js`, `node t/import_test.js`, `node t/engine_test.js`, `python3 t/t43_ui.py`, `python3 t/tb_smoke.py`, `python3 t/t42_audit.py`, `python3 t/t1.py`, `python3 t/t3_v42.py` — record counts.
- [ ] **Step 2:** Independent reviewer (fresh subagent, superpowers:requesting-code-review) on the whole diff `git diff a5c81aa..HEAD` against this plan + Global Constraints + Review Focus; fix Critical/High findings, re-run suites.
- [ ] **Step 3:** Size/seed checks: live seed `{}`; no fixture data in builds; page size reported.
- [ ] **Step 4:** Pull the live db (ArtifactData list all collections into `/home/claude/v43/live_pre/`), confirm unchanged vs `t/livestore.json` (or refresh fixtures and re-run if the owner entered data), then publish `/home/claude/v41/Julphar_Platform_live.html` (copy of `out/live.html`) to `https://claude.ai/artifact/92qontudfDjXKF1HooCGMM`.
- [ ] **Step 5:** Mac: offline copy V43 to `Reference/` (keep V42 as `_V42`), update `START_HERE.md`, `LIVE_LINK.txt` label; project doc `claude/Julphar_V43_Release.md`.
