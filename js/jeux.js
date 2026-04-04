'use strict';

// ══ JEUX ════════════════════════════════════════════════
// Escape HTML pour les attributs value="..." dans les inputs
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderGames(){
  const list=document.getElementById('glist');if(!list)return;list.innerHTML='';
  const det=document.getElementById('gdetail');
  if(!S.games.length){
    if(det)det.innerHTML='<div class="gempty"><span class="ei">🎮</span><span class="et">Aucun jeu — cliquez sur + Ajouter</span></div>';
    return;
  }
  S.games.forEach(g=>{
    const el=document.createElement('div');el.className='gitem'+(S.activeGame===g.id?' on':'');
    el.innerHTML=`<div class="gi-ico">${escHtml(g.ico)}</div><div><div class="gi-name">${escHtml(g.name)}</div><div class="gi-plat">${escHtml(g.plat)}</div></div>`;
    el.onclick=()=>selectGame(g.id);list.appendChild(el);
  });
  // Ensure activeGame is still valid (e.g. after a delete)
  if(S.activeGame && S.games.find(x=>x.id===S.activeGame)) selectGame(S.activeGame);
  else { S.activeGame=S.games[0].id; selectGame(S.activeGame); }
}
function selectGame(id){
  S.activeGame=id;
  document.querySelectorAll('.gitem').forEach(el=>el.classList.remove('on'));
  document.querySelectorAll('.gitem').forEach((el,i)=>{if(S.games[i]?.id===id)el.classList.add('on')});
  const g=S.games.find(x=>x.id===id);if(!g)return;
  g.codes = g.codes || []; // migration données existantes
  document.getElementById('gdetail').innerHTML=`
    <div class="dsec">
      <div class="dsec-hdr">
        <span class="dsec-title">⌨️ Touches</span>
        <div style="display:flex;align-items:center;gap:8px"><span style="font-family:var(--mono);font-size:10px;color:var(--dim2)">Cliquez pour éditer</span><button class="btn xs orange" onclick="addBind(${g.id})">+ Ligne</button></div>
      </div>
      <div class="dsec-body" id="binds-${g.id}">${g.binds.map((b,i)=>bindRowHTML(g.id,i,b)).join('')}</div>
    </div>
    <div class="dsec">
      <div class="dsec-hdr">
        <span class="dsec-title">🎨 Paramètres</span>
        <button class="btn xs orange" onclick="addSet(${g.id})">+ Ligne</button>
      </div>
      <div class="dsec-body" id="sets-${g.id}">${g.sets.map((s,i)=>setRowHTML(g.id,i,s)).join('')}</div>
    </div>
    <div class="dsec">
      <div class="dsec-hdr">
        <span class="dsec-title">🎯 Codes</span>
        <button class="btn xs orange" onclick="addCode(${g.id})">+ Ligne</button>
      </div>
      <div class="dsec-body" style="padding:0" id="codes-${g.id}">
        <table class="codes-table">
          <thead><tr>
            <th></th>
            <th>Nom / Preset</th>
            <th>Code Viseur</th>
            <th>Code Loadout</th>
            <th>Code Arme</th>
            <th></th>
          </tr></thead>
          <tbody>${g.codes.map((c,i)=>codeRowHTML(g.id,i,c)).join('')}</tbody>
        </table>
        ${g.codes.length===0?'<div class="codes-empty">Aucun code — cliquez sur <strong>+ Ligne</strong>.</div>':''}
      </div>
    </div>`;
}
function bindRowHTML(gid,idx,b){
  return `<div class="brow" draggable="true" data-gid="${gid}" data-idx="${idx}" data-type="bind"
    ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
    <span class="drag-handle" title="Déplacer">⠿</span>
    <input class="bact-in" value="${esc(b.a)}" placeholder="Action…"
      onfocus="this.select()"
      oninput="updateBind(${gid},${idx},'a',this.value)"
      onblur="updateBind(${gid},${idx},'a',this.value);saveAll()">
    <div style="display:flex;gap:4px">
      <input class="key-in" value="${esc(b.k)}" placeholder="Touche"
        onfocus="this.select()"
        oninput="updateBind(${gid},${idx},'k',this.value)"
        onblur="updateBind(${gid},${idx},'k',this.value);saveAll()">
    </div>
    <span class="row-del" onclick="delBind(${gid},${idx})">✕</span>
  </div>`;
}
function codeRowHTML(gid,idx,c){
  return `<tr class="crow" draggable="true" data-gid="${gid}" data-idx="${idx}" data-type="code"
    ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
    <td style="width:18px;padding:4px 6px"><span class="drag-handle" title="Déplacer" style="font-size:12px;color:var(--dim);cursor:grab;user-select:none">⠿</span></td>
    <td><input class="crow-in" value="${esc(c.n)}" placeholder="Preset…"
      onfocus="this.select()" oninput="updateCode(${gid},${idx},'n',this.value)"
      onblur="updateCode(${gid},${idx},'n',this.value);saveAll()"></td>
    <td><input class="crow-in crow-code" value="${esc(c.v)}" placeholder="Code…"
      onfocus="this.select()" oninput="updateCode(${gid},${idx},'v',this.value)"
      onblur="updateCode(${gid},${idx},'v',this.value);saveAll()"></td>
    <td><input class="crow-in crow-code" value="${esc(c.l)}" placeholder="Code…"
      onfocus="this.select()" oninput="updateCode(${gid},${idx},'l',this.value)"
      onblur="updateCode(${gid},${idx},'l',this.value);saveAll()"></td>
    <td><input class="crow-in crow-code" value="${esc(c.a)}" placeholder="Code…"
      onfocus="this.select()" oninput="updateCode(${gid},${idx},'a',this.value)"
      onblur="updateCode(${gid},${idx},'a',this.value);saveAll()"></td>
    <td style="width:24px;padding:4px 4px"><span class="row-del" onclick="delCode(${gid},${idx})">✕</span></td>
  </tr>`;
}
function setRowHTML(gid,idx,s){
  return `<div class="srow" draggable="true" data-gid="${gid}" data-idx="${idx}" data-type="set"
    ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
    <span class="drag-handle" title="Déplacer">⠿</span>
    <input class="srow-name" value="${esc(s.n)}" placeholder="Paramètre…"
      onfocus="this.select()"
      oninput="updateSet(${gid},${idx},'n',this.value)"
      onblur="updateSet(${gid},${idx},'n',this.value);saveAll()">
    <input class="srow-val" value="${esc(s.v)}" placeholder="Valeur"
      onfocus="this.select()"
      oninput="updateSet(${gid},${idx},'v',this.value)"
      onblur="updateSet(${gid},${idx},'v',this.value);saveAll()">
    <span class="row-del" onclick="delSet(${gid},${idx})">✕</span>
  </div>`;
}
// ── DRAG & DROP REORDER ────────────────────────────────
let _dragSrc = null; // {gid, idx, type}

function onDragStart(e) {
  const row = e.currentTarget;
  _dragSrc = { gid: +row.dataset.gid, idx: +row.dataset.idx, type: row.dataset.type };
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', ''); // required for Firefox
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = e.currentTarget;
  if (_dragSrc && row.dataset.type === _dragSrc.type) {
    row.classList.add('drag-over');
  }
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  // Clean up any leftover drag-over highlights
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  _dragSrc = null;
}

function onDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!_dragSrc) return;
  const targetGid = +target.dataset.gid;
  const targetIdx = +target.dataset.idx;
  const type = _dragSrc.type;
  if (_dragSrc.gid !== targetGid) return; // only reorder within same game
  if (_dragSrc.idx === targetIdx) return;  // dropped on itself

  const g = S.games.find(x => x.id === targetGid);
  if (!g) return;

  const arr = type === 'bind' ? g.binds : type === 'code' ? (g.codes||[]) : g.sets;
  // Remove dragged item and insert at target position
  const [moved] = arr.splice(_dragSrc.idx, 1);
  arr.splice(targetIdx, 0, moved);

  selectGame(targetGid); // re-render with new order
  saveAll();
}

function updateBind(gid,idx,f,v){const g=S.games.find(x=>x.id===gid);if(g&&g.binds[idx]!==undefined){g.binds[idx][f]=v;schedSave();}}
function updateSet(gid,idx,f,v){const g=S.games.find(x=>x.id===gid);if(g&&g.sets[idx]!==undefined){g.sets[idx][f]=v;schedSave();}}
function updateCode(gid,idx,f,v){const g=S.games.find(x=>x.id===gid);if(g&&g.codes&&g.codes[idx]!==undefined){g.codes[idx][f]=v;schedSave();}}
function delBind(gid,idx){const g=S.games.find(x=>x.id===gid);if(!g)return;g.binds.splice(idx,1);selectGame(gid);saveAll();}
function delSet(gid,idx){const g=S.games.find(x=>x.id===gid);if(!g)return;g.sets.splice(idx,1);selectGame(gid);saveAll();}
function delCode(gid,idx){const g=S.games.find(x=>x.id===gid);if(!g)return;if(!g.codes)g.codes=[];g.codes.splice(idx,1);selectGame(gid);saveAll();}
function addBind(gid){const g=S.games.find(x=>x.id===gid);if(!g)return;g.binds.push({a:'Action',k:'—'});selectGame(gid);schedSave();setTimeout(()=>{const r=document.querySelectorAll(`#binds-${gid} .bact-in`);if(r.length)r[r.length-1].focus();},50);}
function addSet(gid){const g=S.games.find(x=>x.id===gid);if(!g)return;g.sets.push({n:'Paramètre',v:'—'});selectGame(gid);schedSave();setTimeout(()=>{const r=document.querySelectorAll(`#sets-${gid} .srow-name`);if(r.length)r[r.length-1].focus();},50);}
function addCode(gid){const g=S.games.find(x=>x.id===gid);if(!g)return;if(!g.codes)g.codes=[];g.codes.push({n:'',v:'',l:'',a:''});selectGame(gid);schedSave();setTimeout(()=>{const r=document.querySelectorAll(`#codes-${gid} .crow-in`);if(r.length)r[r.length-4].focus();},50);}
function addGame(){
  const name=document.getElementById('g-name').value.trim();const plat=document.getElementById('g-plat').value.trim()||'PC';const ico=document.getElementById('g-ico').value.trim()||'🎮';
  if(!name){toast('Entrez un nom de jeu','warn');return;}
  const id=Date.now();const nl=name.toLowerCase();
  let binds=[{a:'Avancer',k:'W'},{a:'Reculer',k:'S'},{a:'Gauche',k:'A'},{a:'Droite',k:'D'},{a:'Sauter',k:'ESPACE'}];
  let sets=[{n:'Sensibilité',v:'—'},{n:'DPI',v:'—'},{n:'Résolution',v:'—'},{n:'FPS Max',v:'—'},{n:'V-Sync',v:'—'}];
  if(nl.includes('counter')||nl.includes('cs2')){binds=[...binds,{a:'Accroupir',k:'CTRL'},{a:'Marcher',k:'SHIFT'},{a:'Tir',k:'CG'},{a:'Recharger',k:'R'},{a:'Grenade',k:'G'},{a:'Acheter',k:'B'}];sets=[{n:'Sensibilité',v:'—'},{n:'DPI',v:'—'},{n:'eDPI',v:'—'},{n:'Résolution',v:'—'},{n:'Ratio',v:'—'},{n:'FPS Max',v:'—'},{n:'V-Sync',v:'OFF'}];}
  else if(nl.includes('valorant')){binds=[...binds,{a:'Capacité 1',k:'E'},{a:'Capacité 2',k:'Q'},{a:'Capacité 3',k:'C'},{a:'Ultime',k:'X'}];}
  S.games.push({id,name,plat,ico,binds,sets,codes:[]});
  closeModal('modal-game');['g-name','g-plat','g-ico'].forEach(i=>document.getElementById(i).value='');
  renderGames();selectGame(id);saveAll();toast('✅ Jeu ajouté !');
}