
/* ==== V40 Store — the ONE data layer of the platform. Swap this object for a REST backend later.
   Backends: 'db'  = artifact db capability (claude.use('db')), docs at collection/doc paths
             'local' = embedded seed (<script id="seed">) + localStorage overlay (this browser only)
   API (all async except peek/all/status):
     loadAll()                       -> Promise<{path: body}>  (resolves once a backend is decided)
     subscribe(cb)                   -> unsubscribe; cb(docs, info) after every change
     get(path)                       -> Promise<body|null>  fresh read from the backend
     put(path, body, expectedUpdatedAt) -> Promise<body>  optimistic: rejects {code:'conflict'} when the stored
                                         doc's updatedAt differs from expectedUpdatedAt (null = must not exist)
     seedDatabase()                  -> Promise  writes the embedded seed into an EMPTY db (refuses otherwise)
     peek(path), all(), status()     -> sync cache reads for rendering
   status().mode: 'starting' | 'db' | 'empty' | 'local'  ·  status().note: human text */
var Store=(function(){
  "use strict";
  var COLS=['master','deals','orders','audit','plan','stock','targets'],LSKEY='jsp40-local-docs';
  var seed={};try{seed=JSON.parse(document.getElementById('seed').textContent)||{};}catch(e){seed={};}
  var docs={},subs=[],st={mode:'starting',note:'Connecting to the database…',error:null,failed:[]},db=null,lastStamp='';
  function clone(o){return o==null?o:JSON.parse(JSON.stringify(o));}
  function emit(info){subs.slice().forEach(function(cb){try{cb(docs,info||{});}catch(e){if(window.console)console.error(e);}});}
  function setStatus(mode,note){st.mode=mode;st.note=note;emit({status:true});}
  function stamp(){var s=new Date().toISOString();if(s<=lastStamp){s=new Date(Date.parse(lastStamp)+1).toISOString();}lastStamp=s;return s;}
  function err(code,msg){var e=new Error(msg||code);e.code=code;return e;}
  /* ---- local backend ---- */
  function lsRead(){try{var o=JSON.parse(localStorage.getItem(LSKEY)||'{}');return (o&&typeof o==='object')?o:{};}catch(e){return {};}}
  function lsWrite(path,body){var o=lsRead();o[path]=body;try{localStorage.setItem(LSKEY,JSON.stringify(o));return true;}catch(e){return false;}}
  function startLocal(note){
    docs=clone(seed);var ov=lsRead();Object.keys(ov).forEach(function(p){docs[p]=ov[p];});
    db=null;setStatus('local',note||'Offline copy — changes stay in this browser');
  }
  /* ---- db backend ---- */
  function dbCall(fn){ /* unavailable -> retry once after a short random delay */
    return fn()['catch'](function(e){
      if(e&&e.code==='unavailable')return new Promise(function(r){setTimeout(r,250+Math.random()*500);}).then(fn);
      throw e;});
  }
  function startDb(theDb){
    db=theDb;var first={},pending=COLS.length;
    return new Promise(function(resolve){
      COLS.forEach(function(c){
        try{
          db.collection(c).onSnapshot(function(snap){
            if(st.mode!=='empty')Object.keys(docs).forEach(function(p){if(p.split('/')[0]===c)delete docs[p];}); /* empty mode: keep showing the snapshot while it loads */
            snap.docs.forEach(function(d){if(d.exists)docs[c+'/'+d.id]=d.data();});
            st.failed=st.failed.filter(function(x){return x!==c;}); /* this collection is readable again */
            if(!first[c]){first[c]=1;pending--;if(pending===0){decide();resolve();}}
            else{if(st.mode==='empty'&&docs['master/settings'])setStatus('db','Saved in the platform database');else emit({remote:true,col:c});}
          },function(e){st.error=e;if(st.failed.indexOf(c)<0)st.failed.push(c);emit({error:e});if(!first[c]){first[c]=1;pending--;if(pending===0){decide();resolve();}}});
        }catch(e){st.error=e;if(st.failed.indexOf(c)<0)st.failed.push(c);first[c]=1;pending--;if(pending===0){decide();resolve();}}
      });
    });
  }
  function decide(){
    if(docs['master/settings'])setStatus('db','Saved in the platform database');
    else{ /* empty database: show the embedded snapshot read-only until it is loaded */
      if(Object.keys(seed).length){var live=docs;docs=clone(seed);Object.keys(live).forEach(function(p){docs[p]=live[p];});}
      setStatus('empty',Object.keys(seed).length?'The database is empty — load the Excel snapshot to start':'The database is empty — nothing to show');
    }
  }
  var ready=null;
  function loadAll(){
    if(ready)return ready;
    docs=clone(seed); /* first paint from the embedded snapshot, never blocked */
    var hasClaude=window.claude&&typeof window.claude.use==='function';
    if(!hasClaude){startLocal();ready=Promise.resolve(docs);return ready;}
    ready=Promise.resolve().then(function(){return window.claude.use('db');}).then(function(d){
      if(!d){startLocal('Offline copy — the database is not available here, changes stay in this browser');return docs;}
      return startDb(d).then(function(){return docs;});
    },function(){startLocal();return docs;});
    return ready;
  }
  function get(path){
    if(st.mode==='db'||st.mode==='empty'){
      return dbCall(function(){return db.doc(path).get();}).then(function(s){return s.exists?clone(s.data()):null;});
    }
    return Promise.resolve(clone(docs[path]||null));
  }
  function putImpl(path,body,expected,allowEmpty){
    if(st.mode==='starting')return Promise.reject(err('starting','Still connecting to the database — try again in a moment.'));
    if(st.mode==='empty'&&!allowEmpty)return Promise.reject(err('empty','Load the Excel snapshot into the database first (banner at the top).'));
    if(expected===undefined)expected=null;
    return get(path).then(function(cur){
      var curU=cur?(cur.updatedAt||''):null;
      if(curU!==expected)throw err('conflict','This record changed since it was read.');
      var b=clone(body);b.schema=b.schema||1;b.updatedAt=stamp();
      if(st.mode==='db'||(st.mode==='empty'&&db))return dbCall(function(){return db.doc(path).set(b);}).then(function(){docs[path]=b;if(st.mode==='empty'&&path==='master/settings')setStatus('db','Saved in the platform database');else emit({path:path});return clone(b);});
      if(!lsWrite(path,b))throw err('local_full','This browser has no room left to save. Download a backup (Data page).');
      docs[path]=b;emit({path:path});return clone(b);
    });
  }
  function put(path,body,expected){return putImpl(path,body,expected,false);}
  /* restore / new workspace: same guards as put(), but allowed while the database is still empty (master/settings must be written LAST) */
  function restoreDoc(path,body,expected){return putImpl(path,body,expected,true);}
  function seedDatabase(){
    if(st.mode!=='empty')return Promise.reject(err('not_empty','The database already has data — nothing was loaded.'));
    return dbCall(function(){return db.doc('master/settings').get();}).then(function(s){
      if(s.exists)throw err('not_empty','The database already has data — nothing was loaded.');
      var paths=Object.keys(seed).filter(function(p){return p!=='master/settings';}).sort(),i=0;
      function next(){
        if(i>=paths.length)return dbCall(function(){return db.doc('master/settings').set(clone(seed['master/settings']));}); /* settings last = "seed complete" marker */
        var p=paths[i++];return dbCall(function(){return db.doc(p).set(clone(seed[p]));}).then(next);
      }
      return next();
    }).then(function(){docs['master/settings']=clone(seed['master/settings']);setStatus('db','Saved in the platform database');});
  }
  return {hasSeed:function(){return Object.keys(seed).length>0;},restoreDoc:restoreDoc,loadAll:loadAll,get:get,put:put,seedDatabase:seedDatabase,
    subscribe:function(cb){subs.push(cb);return function(){subs=subs.filter(function(x){return x!==cb;});};},
    peek:function(p){return docs[p]||null;},all:function(){return docs;},status:function(){return st;},
    seedPaths:function(){return Object.keys(seed);}};
})();

