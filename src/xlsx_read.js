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
