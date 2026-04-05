'use strict';

// ══ MISE À JOUR ══════════════════════════════════════════
let _updateData = null;

function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i]||0) > (pb[i]||0)) return true;
    if ((pa[i]||0) < (pb[i]||0)) return false;
  }
  return false;
}

async function checkForUpdate() {
  try {
    const [data, current] = await Promise.all([window.api.checkUpdate(), window.api.getVersion()]);
    if (!data || !semverGt(data.version, current)) return;
    _updateData = data;
    const btn = document.getElementById('update-btn');
    if (btn) { btn.textContent = '↑ v' + data.version; btn.classList.remove('gone'); }
  } catch {}
}

let _updPopup = null;
function openUpdatePopup(btn) {
  if (_updPopup) { _updPopup.remove(); _updPopup = null; return; }
  if (!_updateData) return;
  const p = document.createElement('div');
  p.className = 'update-popup';
  p.innerHTML = `
    <div class="update-popup-ver">↑ Version ${_updateData.version}</div>
    <div class="update-popup-notes">${_updateData.notes || 'Nouvelle version disponible.'}</div>
    <button class="btn sm upd-dl-btn" onclick="window.api.openUrl('${_updateData.url}');this.closest('.update-popup').remove()">⬇️ Télécharger</button>`;
  btn.parentElement.style.position = 'relative';
  btn.parentElement.appendChild(p);
  _updPopup = p;
  setTimeout(() => document.addEventListener('click', function h(e) {
    if (!p.contains(e.target) && e.target !== btn) { p.remove(); _updPopup = null; document.removeEventListener('click', h); }
  }), 50);
}

// ══ PANNEAU NOTES REDIMENSIONNABLE ══════════════════════
(function _initNbResize() {
  const handle = document.getElementById('nb-resize-handle');
  const panel  = document.getElementById('nb-panel');
  if (!handle || !panel) return;

  // Restore saved width
  const saved = localStorage.getItem('nb-panel-width');
  if (saved) panel.style.width = saved + 'px';

  let _dragging = false, _startX = 0, _startW = 0;

  handle.addEventListener('mousedown', e => {
    _dragging = true;
    _startX   = e.clientX;
    _startW   = panel.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!_dragging) return;
    const w = Math.min(480, Math.max(140, _startW + (e.clientX - _startX)));
    panel.style.width = w + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!_dragging) return;
    _dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('nb-panel-width', panel.offsetWidth);
  });
})();

// ══ CLOCK ═══════════════════════════════════════════════
setInterval(() => {
  const n=new Date(),p=v=>String(v).padStart(2,'0');
  const el=document.getElementById('clock');
  if(el) el.textContent=`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
},1000);

// ══ TOAST ═══════════════════════════════════════════════
let _tt;
function toast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type);t.classList.add('on');clearTimeout(_tt);_tt=setTimeout(()=>t.classList.remove('on'),2800);}

// ══ NAV / MODALS ════════════════════════════════════════
function nav(id){
  // Stop température auto-refresh si on quitte tools
  if (typeof stopTempRefresh === 'function' && id !== 'tools') stopTempRefresh();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(b=>b.classList.remove('on'));
  document.getElementById('p-'+id).classList.add('on');
  const b=document.querySelector(`.nav[data-p="${id}"]`);
  if(b)b.classList.add('on');
}
function openModal(id){
  document.getElementById(id).classList.add('on');
  if(id==='modal-profile'){
    document.getElementById('p-name').value=profile.name;
    selEmoji=profile.emoji;
    buildEmojiGrid('edit-emoji-grid',P_EMOJIS,selEmoji);
  }
}
function closeModal(id){
  document.getElementById(id).classList.remove('on');
  // Clean up inline modal state — use typeof to avoid ReferenceError
  if (id === 'modal-inline') {
    const row = document.getElementById('inline-emoji-row');
    if (row) row.remove();
    if (typeof _emojiInputCb !== 'undefined') _emojiInputCb = null;
    if (typeof _inlineCb    !== 'undefined') _inlineCb    = null;
  }
}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('on')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.overlay.on').forEach(o=>o.classList.remove('on'));hideTbl();}});

// ══ PROFILE ═════════════════════════════════════════════
function saveProfile(){
  profile.name=document.getElementById('p-name').value.trim()||'Joueur';
  profile.emoji=selEmoji;
  // Electron: persist profile via IPC (no localStorage)
  window.api.configSave({ savPath, profile });
  document.getElementById('t-name').textContent=profile.name;
  document.getElementById('t-emoji').textContent=profile.emoji;
  closeModal('modal-profile');
  toast('✅ Profil mis à jour !');
}

// ══ CONTEXT MENU ════════════════════════════════════════
const ctxEl=document.getElementById('ctx');
function showCtx(e,items){
  e.preventDefault();e.stopPropagation();
  ctxEl.innerHTML='';
  items.forEach(item=>{
    if(item==='sep'){const s=document.createElement('div');s.className='ctx-sep';ctxEl.appendChild(s);}
    else if(item.label){const l=document.createElement('div');l.className='ctx-lbl';l.textContent=item.label;ctxEl.appendChild(l);}
    else{const el=document.createElement('div');el.className='ctx-item'+(item.danger?' danger':'');el.innerHTML=`<span class="ctx-ico">${item.ico||''}</span><span>${item.text}</span>`;el.onclick=()=>{hideCtx();item.action();};ctxEl.appendChild(el);}
  });
  ctxEl.classList.add('on');
  const x=Math.min(e.clientX,window.innerWidth-210);
  const y=Math.min(e.clientY,window.innerHeight-ctxEl.scrollHeight-10);
  ctxEl.style.left=x+'px';ctxEl.style.top=y+'px';
}
function hideCtx(){ctxEl.classList.remove('on');}
document.addEventListener('click',()=>hideCtx());

document.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const isEditable=e.target.isContentEditable||['INPUT','TEXTAREA'].includes(e.target.tagName)||e.target.closest('[contenteditable]');
  const items=[{label:'Presse-papiers'}];
  if(isEditable){
    items.push({ico:'📋',text:'Coller',action:async()=>{try{const t=await navigator.clipboard.readText();document.execCommand('insertText',false,t);}catch(err){}}});
    const sel=window.getSelection()?.toString();
    if(sel){items.push({ico:'📄',text:'Copier',action:()=>navigator.clipboard.writeText(sel)});items.push({ico:'✂️',text:'Couper',action:()=>{navigator.clipboard.writeText(sel);document.execCommand('delete');}});}
    items.push('sep');
    items.push({ico:'🔤',text:'Tout sélectionner',action:()=>document.execCommand('selectAll')});
  }else{
    const sel=window.getSelection()?.toString();
    if(sel)items.push({ico:'📄',text:'Copier la sélection',action:()=>navigator.clipboard.writeText(sel)});
    else items.push({ico:'—',text:'Rien à copier',action:()=>{}});
  }
  const gitem=e.target.closest('.gitem');
  if(gitem){items.push('sep');items.push({label:'Jeu'});items.push({ico:'🗑️',text:'Supprimer ce jeu',danger:true,action:()=>{const idx=Array.from(document.querySelectorAll('.gitem')).indexOf(gitem);if(idx>=0&&S.games[idx]){if(!confirm('Supprimer ce jeu ?'))return;S.games.splice(idx,1);S.activeGame=null;renderGames();saveAll();}}});}
  const nbHdr=e.target.closest('.nb-hdr');
  if(nbHdr){const nbId=+nbHdr.dataset.id;const nb=S.notebooks.find(x=>x.id===nbId);items.push('sep');items.push({label:'Carnet'});items.push({ico:'✏️',text:'Modifier (nom + emoji)',action:()=>nbEdit(nbId)});items.push({ico:'🗑️',text:'Supprimer',danger:true,action:()=>nbDel(nbId,{stopPropagation:()=>{}})});}
  // Clic droit sur une image dans l'éditeur de notes
  const imgInNote = e.target.tagName==='IMG' && e.target.closest('.note-body') ? e.target : null;
  if(imgInNote){items.push('sep');items.push({label:'Image'});items.push({ico:'↑',text:'Monter',action:()=>_moveImg(imgInNote,-1)});items.push({ico:'↓',text:'Descendre',action:()=>_moveImg(imgInNote,1)});items.push({ico:'🗑️',text:'Supprimer l\'image',danger:true,action:()=>_deleteImg(imgInNote)});}
  // Section/page context menu handled per-level in notes.js nbCtxMenu
  showCtx(e,items);
});

// ══ INIT ════════════════════════════════════════════════
initLaunchScreen();