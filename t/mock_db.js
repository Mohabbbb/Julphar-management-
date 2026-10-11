/* In-browser stand-in for the platform database (window.claude.use('db')), used by t/fixes_test.py.
   Docs live in localStorage 'mockdb' (seeded by the test). Failure injection:
     window.__failCols = ['orders']   those collections' listeners report an error instead of data
     window.__writes                  every db set: {path, rows}                                         */
(function(){
  var KEY='mockdb',store={};try{store=JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){}
  var listeners=[];window.__writes=[];window.__failCols=window.__failCols||[];window.__downloads=[];
  function cl(o){return o==null?o:JSON.parse(JSON.stringify(o));}
  function snapDoc(path){var d=store[path];return {id:path.split('/').pop(),exists:!!d,data:function(){return d?cl(d):undefined;}};}
  function colSnap(col){var docs=Object.keys(store).filter(function(p){var s=p.split('/');return s[0]===col&&s.length===2;}).sort().map(snapDoc);return {docs:docs,size:docs.length,empty:!docs.length};}
  function notify(path){var col=path.split('/')[0];listeners.forEach(function(l){if(l.col===col&&window.__failCols.indexOf(col)<0)setTimeout(function(){l.cb(colSnap(col));},5);});}
  window.__mockStore=function(){return store;};
  function ref(path){return {id:path.split('/').pop(),path:path,
    get:function(){return new Promise(function(r){setTimeout(function(){r(snapDoc(path));},2);});},
    set:function(data){window.__writes.push({path:path,rows:(data&&data.rows)?data.rows.length:null});store[path]=cl(data);try{localStorage.setItem(KEY,JSON.stringify(store));}catch(e){}notify(path);return Promise.resolve();}};}
  var db={doc:ref,collection:function(col){return {path:col,doc:function(id){return ref(col+'/'+id);},
    onSnapshot:function(cb,errCb){
      if(window.__failCols.indexOf(col)>=0){setTimeout(function(){if(errCb)errCb({code:'unavailable',message:'unavailable'});},20);return function(){};}
      var l={col:col,cb:cb};listeners.push(l);setTimeout(function(){cb(colSnap(col));},20);return function(){};}};}};
  var dl={save:function(req){var d=req.data;return (d instanceof Blob?d.arrayBuffer():Promise.resolve(new TextEncoder().encode(d).buffer)).then(function(buf){window.__downloads.push({filename:req.filename,bytes:buf.byteLength});return {status:'saved'};});}};
  window.claude={use:function(n){return new Promise(function(r){setTimeout(function(){r(n==='db'?db:n==='downloads'?dl:null);},50);});}};
})();
