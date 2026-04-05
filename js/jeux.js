'use strict';

// ══ JEUX ════════════════════════════════════════════════
// Escape HTML pour les attributs value="..." dans les inputs
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _gameDragId = null;

function sortGames(mode) {
  if (mode === 'az')   S.games.sort((a,b) => a.name.localeCompare(b.name));
  else if (mode === 'za')   S.games.sort((a,b) => b.name.localeCompare(a.name));
  else if (mode === 'plat') S.games.sort((a,b) => a.plat.localeCompare(b.plat) || a.name.localeCompare(b.name));
  renderGames(); saveAll();
}

function renderGames(){
  const list=document.getElementById('glist');if(!list)return;list.innerHTML='';
  const det=document.getElementById('gdetail');
  if(!S.games.length){
    if(det)det.innerHTML='<div class="gempty"><span class="ei">🎮</span><span class="et">Aucun jeu — cliquez sur + Ajouter</span></div>';
    return;
  }
  S.games.forEach(g=>{
    const el=document.createElement('div');
    el.className='gitem'+(S.activeGame===g.id?' on':'');
    el.draggable=true;
    el.dataset.gid=g.id;
    el.innerHTML=`<span class="drag-handle" style="font-size:14px;color:var(--dim);cursor:grab;padding:0 6px 0 2px;flex-shrink:0" title="Réordonner">⠿</span><div class="gi-ico">${escHtml(g.ico)}</div><div style="flex:1;min-width:0"><div class="gi-name">${escHtml(g.name)}</div><div class="gi-plat">${escHtml(g.plat)}</div></div><span class="gi-del" title="Supprimer" onclick="event.stopPropagation();delGame(${g.id})">✕</span>`;
    el.onclick=e=>{if(e.target.classList.contains('drag-handle')||e.target.classList.contains('gi-del'))return;selectGame(g.id);};
    el.addEventListener('dragstart',e=>{_gameDragId=g.id;e.dataTransfer.effectAllowed='move';el.style.opacity='0.4';});
    el.addEventListener('dragend',()=>{el.style.opacity='';_gameDragId=null;});
    el.addEventListener('dragover',e=>{e.preventDefault();el.style.background='rgba(255,107,53,.08)';});
    el.addEventListener('dragleave',()=>{el.style.background='';});
    el.addEventListener('drop',e=>{
      e.preventDefault();el.style.background='';
      if(!_gameDragId||_gameDragId===g.id)return;
      const si=S.games.findIndex(x=>x.id===_gameDragId),ti=S.games.findIndex(x=>x.id===g.id);
      if(si>=0&&ti>=0){const[m]=S.games.splice(si,1);S.games.splice(ti,0,m);}
      renderGames();saveAll();
    });
    list.appendChild(el);
  });
  // Ensure activeGame is still valid (e.g. after a delete)
  if(S.activeGame && S.games.find(x=>x.id===S.activeGame)) selectGame(S.activeGame);
  else if(S.games.length) { S.activeGame=S.games[0].id; selectGame(S.activeGame); }
}

function delGame(gid) {
  if(!confirm('Supprimer ce jeu ?')) return;
  const idx = S.games.findIndex(x=>x.id===gid);
  if(idx<0) return;
  S.games.splice(idx,1);
  S.activeGame = S.games.length ? S.games[0].id : null;
  renderGames();
  if(!S.activeGame) {
    const det=document.getElementById('gdetail');
    if(det) det.innerHTML='<div class="gempty"><span class="ei">🎮</span><span class="et">Aucun jeu — cliquez sur + Ajouter</span></div>';
  }
  schedSave();
}

function selectGame(id){
  S.activeGame=id;
  document.querySelectorAll('.gitem').forEach(el=>el.classList.remove('on'));
  document.querySelectorAll('.gitem').forEach((el,i)=>{if(S.games[i]?.id===id)el.classList.add('on')});
  const g=S.games.find(x=>x.id===id);if(!g)return;
  g.codes = g.codes || []; // migration données existantes
  const ctrlType = g.ctrlType || null;
  const touchTitle = ctrlType ? '🎮 Touches / Manette' : '⌨️ Touches';
  const selectorHTML = `
    <div class="ctrl-type-sel">
      <button class="ctype-btn${!ctrlType?' on':''}" onclick="setCtrlType(${g.id},null)" title="Clavier / Souris">⌨️</button>
      <button class="ctype-btn${ctrlType==='ps'?' on':''}" onclick="setCtrlType(${g.id},'ps')" title="PlayStation">PS</button>
      <button class="ctype-btn${ctrlType==='xbox'?' on':''}" onclick="setCtrlType(${g.id},'xbox')" title="Xbox">Xbox</button>
      <button class="ctype-btn${ctrlType==='switch'?' on':''}" onclick="setCtrlType(${g.id},'switch')" title="Nintendo Switch">Switch</button>
    </div>`;
  document.getElementById('gdetail').innerHTML=`
    <div class="dsec">
      <div class="dsec-hdr">
        <span class="dsec-title">${touchTitle}</span>
        <div style="display:flex;align-items:center;gap:8px">
          ${selectorHTML}
          <button class="btn xs orange" onclick="addBind(${g.id})">+ Ligne</button>
        </div>
      </div>
      <div class="dsec-body" id="binds-${g.id}">${g.binds.map((b,i)=>bindRowHTML(g.id,i,b,ctrlType)).join('')}</div>
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

function setCtrlType(gid, type) {
  const g=S.games.find(x=>x.id===gid);
  if(!g) return;
  g.ctrlType = type;
  selectGame(gid);
  schedSave();
}

// ── Boutons manette ────────────────────────────────────
// Retourne un tableau plat de {v, c?} (bouton) ou 'sep' (séparateur)
// c = couleur officielle du bouton
function _ctrlBtnsFor(ctrlType) {
  switch(ctrlType) {
    case 'ps': return [
      {v:'✕',c:'#3B7FD4'},{v:'○',c:'#D93025'},{v:'□',c:'#CC55A0'},{v:'△',c:'#3BAC75'},'sep',
      {v:'L1'},{v:'L2'},{v:'R1'},{v:'R2'},'sep',
      {v:'L3'},{v:'R3'},{v:'Pavé G'},{v:'Pavé D'},'sep',
      {v:'🕹G↑'},{v:'🕹G↓'},{v:'🕹G←'},{v:'🕹G→'},'sep',
      {v:'🕹D↑'},{v:'🕹D↓'},{v:'🕹D←'},{v:'🕹D→'},'sep',
      {v:'↑'},{v:'↓'},{v:'←'},{v:'→'}
    ];
    case 'xbox': return [
      {v:'A',c:'#9BC848'},{v:'B',c:'#E73C3C'},{v:'X',c:'#6DB4E8'},{v:'Y',c:'#F1C232'},'sep',
      {v:'LB'},{v:'LT'},{v:'RB'},{v:'RT'},'sep',
      {v:'LS'},{v:'RS'},'sep',
      {v:'🕹G↑'},{v:'🕹G↓'},{v:'🕹G←'},{v:'🕹G→'},'sep',
      {v:'🕹D↑'},{v:'🕹D↓'},{v:'🕹D←'},{v:'🕹D→'},'sep',
      {v:'↑'},{v:'↓'},{v:'←'},{v:'→'}
    ];
    case 'switch': return [
      {v:'A',c:'#E4000F'},{v:'B',c:'#F5C400'},{v:'X',c:'#00AEEF'},{v:'Y',c:'#00A650'},'sep',
      {v:'L'},{v:'R'},{v:'ZL'},{v:'ZR'},'sep',
      {v:'🕹G↑'},{v:'🕹G↓'},{v:'🕹G←'},{v:'🕹G→'},'sep',
      {v:'🕹D↑'},{v:'🕹D↓'},{v:'🕹D←'},{v:'🕹D→'},'sep',
      {v:'↑'},{v:'↓'},{v:'←'},{v:'→'}
    ];
    default: return null;
  }
}

let _ctrlPopup = null;
function showCtrlMenu(e, gid, idx, ctrlType) {
  e.stopPropagation();
  if (_ctrlPopup) { _ctrlPopup.remove(); _ctrlPopup = null; }
  const chips = _ctrlBtnsFor(ctrlType);
  if (!chips) return;
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'ctrl-popup';
  pop.innerHTML = chips.map(chip =>
    chip === 'sep'
      ? '<div class="ctrl-sep"></div>'
      : `<span class="ctrl-chip" data-gid="${gid}" data-idx="${idx}" data-val="${esc(chip.v)}"
          style="${chip.c?`color:${chip.c};font-weight:700;border-color:${chip.c}33`:''}"
          onclick="fillKeyFromChip(this);closeCtrlMenu()">${chip.v}</span>`
  ).join('');
  pop.style.cssText = `position:fixed;top:${rect.bottom+4}px;left:${rect.left}px;z-index:5000`;
  document.body.appendChild(pop);
  _ctrlPopup = pop;
  setTimeout(() => document.addEventListener('click', closeCtrlMenu, {once:true}), 0);
}
function closeCtrlMenu() {
  if (_ctrlPopup) { _ctrlPopup.remove(); _ctrlPopup = null; }
}
function fillKeyFromChip(el){
  const gid=+el.dataset.gid, idx=+el.dataset.idx, val=el.dataset.val;
  updateBind(gid,idx,'k',val);
  const inp=document.getElementById('key-'+gid+'-'+idx);
  if(inp) inp.value=val;
  schedSave();
}
function bindRowHTML(gid,idx,b,ctrlType){
  const chips=_ctrlBtnsFor(ctrlType||null);
  const ctrlBtn=chips?`<button class="ctrl-menu-btn" title="Boutons manette" onclick="showCtrlMenu(event,${gid},${idx},'${ctrlType}')">🎮</button>`:'';
  return `<div class="brow" draggable="true" data-gid="${gid}" data-idx="${idx}" data-type="bind"
    ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
    <span class="drag-handle" title="Déplacer">⠿</span>
    <div class="bact-in-wrap" data-value="${esc(b.a)}">
    <input class="bact-in" value="${esc(b.a)}" placeholder="Action…"
      onfocus="this.select()"
      oninput="this.closest('.bact-in-wrap').dataset.value=this.value;updateBind(${gid},${idx},'a',this.value)"
      onblur="updateBind(${gid},${idx},'a',this.value);schedSave()">
    </div>
    <div style="display:flex;gap:4px;align-items:center">
      <input class="key-in" id="key-${gid}-${idx}" value="${esc(b.k)}" placeholder="Touche"
        onfocus="this.select()"
        oninput="updateBind(${gid},${idx},'k',this.value)"
        onblur="updateBind(${gid},${idx},'k',this.value);schedSave()">
      ${ctrlBtn}
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
      onblur="updateCode(${gid},${idx},'n',this.value);schedSave()"></td>
    <td><input class="crow-in crow-code" value="${esc(c.v)}" placeholder="Code…"
      onfocus="this.select()" oninput="updateCode(${gid},${idx},'v',this.value)"
      onblur="updateCode(${gid},${idx},'v',this.value);schedSave()"></td>
    <td><input class="crow-in crow-code" value="${esc(c.l)}" placeholder="Code…"
      onfocus="this.select()" oninput="updateCode(${gid},${idx},'l',this.value)"
      onblur="updateCode(${gid},${idx},'l',this.value);schedSave()"></td>
    <td><input class="crow-in crow-code" value="${esc(c.a)}" placeholder="Code…"
      onfocus="this.select()" oninput="updateCode(${gid},${idx},'a',this.value)"
      onblur="updateCode(${gid},${idx},'a',this.value);schedSave()"></td>
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
      onblur="updateSet(${gid},${idx},'n',this.value);schedSave()">
    <input class="srow-val" value="${esc(s.v)}" placeholder="Valeur"
      onfocus="this.select()"
      oninput="updateSet(${gid},${idx},'v',this.value)"
      onblur="updateSet(${gid},${idx},'v',this.value);schedSave()">
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
function delBind(gid,idx){const g=S.games.find(x=>x.id===gid);if(!g)return;g.binds.splice(idx,1);selectGame(gid);schedSave();}
function delSet(gid,idx){const g=S.games.find(x=>x.id===gid);if(!g)return;g.sets.splice(idx,1);selectGame(gid);schedSave();}
function delCode(gid,idx){const g=S.games.find(x=>x.id===gid);if(!g)return;if(!g.codes)g.codes=[];g.codes.splice(idx,1);selectGame(gid);schedSave();}
function addBind(gid){const g=S.games.find(x=>x.id===gid);if(!g)return;g.binds.push({a:'Action',k:'—'});selectGame(gid);schedSave();setTimeout(()=>{const r=document.querySelectorAll(`#binds-${gid} .bact-in`);if(r.length)r[r.length-1].focus();},50);}
function addSet(gid){const g=S.games.find(x=>x.id===gid);if(!g)return;g.sets.push({n:'Paramètre',v:'—'});selectGame(gid);schedSave();setTimeout(()=>{const r=document.querySelectorAll(`#sets-${gid} .srow-name`);if(r.length)r[r.length-1].focus();},50);}
function addCode(gid){const g=S.games.find(x=>x.id===gid);if(!g)return;if(!g.codes)g.codes=[];g.codes.push({n:'',v:'',l:'',a:''});selectGame(gid);schedSave();setTimeout(()=>{const r=document.querySelectorAll(`#codes-${gid} .crow-in`);if(r.length)r[r.length-4].focus();},50);}
function addGame(){
  const name=document.getElementById('g-name').value.trim();const plat=document.getElementById('g-plat').value.trim()||'PC';const ico=document.getElementById('g-ico').value.trim()||'🎮';
  if(!name){toast('Entrez un nom de jeu','warn');return;}
  const id=Date.now();const nl=name.toLowerCase();const pl=plat.toLowerCase();
  let binds,sets=[{n:'Sensibilité',v:'—'},{n:'DPI',v:'—'},{n:'Résolution',v:'—'},{n:'FPS Max',v:'—'},{n:'V-Sync',v:'—'}];
  // Détecter le type de manette automatiquement selon la plateforme
  let ctrlType = null;
  if(pl.includes('ps')||pl.includes('playstation')) ctrlType = 'ps';
  else if(pl.includes('xbox')) ctrlType = 'xbox';
  else if(pl.includes('switch')||pl.includes('nintendo')) ctrlType = 'switch';
  // Touches par défaut selon la plateforme
  if(ctrlType==='ps'){
    binds=[{a:'Avancer',k:'↑'},{a:'Reculer',k:'↓'},{a:'Gauche',k:'←'},{a:'Droite',k:'→'},{a:'Sauter',k:'✕'},{a:'Attaquer',k:'○'},{a:'Action',k:'□'},{a:'Spécial',k:'△'},{a:'Gâchette G',k:'L2'},{a:'Gâchette D',k:'R2'}];
  } else if(ctrlType==='xbox'){
    binds=[{a:'Avancer',k:'↑'},{a:'Reculer',k:'↓'},{a:'Gauche',k:'←'},{a:'Droite',k:'→'},{a:'Sauter',k:'A'},{a:'Attaquer',k:'B'},{a:'Action',k:'X'},{a:'Spécial',k:'Y'},{a:'Gâchette G',k:'LT'},{a:'Gâchette D',k:'RT'}];
  } else if(ctrlType==='switch'){
    binds=[{a:'Avancer',k:'↑'},{a:'Reculer',k:'↓'},{a:'Gauche',k:'←'},{a:'Droite',k:'→'},{a:'Sauter',k:'A'},{a:'Attaquer',k:'B'},{a:'Action',k:'X'},{a:'Spécial',k:'Y'},{a:'Gâchette G',k:'ZL'},{a:'Gâchette D',k:'ZR'}];
  } else {
    binds=[{a:'Avancer',k:'W'},{a:'Reculer',k:'S'},{a:'Gauche',k:'A'},{a:'Droite',k:'D'},{a:'Sauter',k:'ESPACE'}];
    if(nl.includes('counter')||nl.includes('cs2')){binds=[...binds,{a:'Accroupir',k:'CTRL'},{a:'Marcher',k:'SHIFT'},{a:'Tir',k:'CG'},{a:'Recharger',k:'R'},{a:'Grenade',k:'G'},{a:'Acheter',k:'B'}];sets=[{n:'Sensibilité',v:'—'},{n:'DPI',v:'—'},{n:'eDPI',v:'—'},{n:'Résolution',v:'—'},{n:'Ratio',v:'—'},{n:'FPS Max',v:'—'},{n:'V-Sync',v:'OFF'}];}
    else if(nl.includes('valorant')){binds=[...binds,{a:'Capacité 1',k:'E'},{a:'Capacité 2',k:'Q'},{a:'Capacité 3',k:'C'},{a:'Ultime',k:'X'}];}
  }
  S.games.push({id,name,plat,ico,ctrlType,binds,sets,codes:[]});
  closeModal('modal-game');['g-name','g-plat','g-ico'].forEach(i=>document.getElementById(i).value='');
  renderGames();selectGame(id);saveAll();toast('✅ Jeu ajouté !');
}
