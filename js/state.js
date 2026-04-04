'use strict';

// ══ CONSTANTS ═══════════════════════════════════════════
// Config stored in AppData via window.api — no localStorage needed
const P_EMOJIS = ['🎮','🔥','⚡','💀','🦊','🐺','🐉','🎯','🏆','👑','🤖','🦸','🎭','👾','👻','🌙','☀️','⭐','🌟','💫','🔮','⚔️','🛡️','🎲','🎪','💎','🚀','🌊'];

let selEmoji = '🎮'; // currently selected emoji in any picker
let selectedNBEmoji = '📁'; // emoji for new notebook modal
let _emojiInputCb = null;   // callback for emoji-aware inline input
let _inlineCb     = null;   // callback for plain inline input

// ══ DATA LISTS ══════════════════════════════════════════
const PLAT=[{name:'Steam',ico:'🟦'},{name:'Epic Games',ico:'⬛'},{name:'Battle.net',ico:'💙'},{name:'Riot Games',ico:'⚔️'},{name:'EA / Origin',ico:'🟠'},{name:'Ubisoft Connect',ico:'🔷'},{name:'Xbox / Game Pass',ico:'🟢'},{name:'PlayStation',ico:'🔵'},{name:'Nintendo Switch',ico:'🔴'},{name:'GOG',ico:'🟣'},{name:'Rockstar',ico:'⭐'},{name:'Standalone',ico:'🖥️'}];
const GAMES=[{name:'Counter-Strike 2',ico:'🔫',plat:'Steam'},{name:'Valorant',ico:'⚔️',plat:'Riot Games'},{name:'Fortnite',ico:'🏗️',plat:'Epic Games'},{name:'Apex Legends',ico:'🦊',plat:'EA / Origin'},{name:'Call of Duty: Warzone',ico:'💀',plat:'Battle.net'},{name:'Overwatch 2',ico:'🦸',plat:'Battle.net'},{name:'League of Legends',ico:'⚡',plat:'Riot Games'},{name:'Dota 2',ico:'🧙',plat:'Steam'},{name:'Rainbow Six Siege',ico:'🛡️',plat:'Ubisoft Connect'},{name:'Minecraft',ico:'⛏️',plat:'Standalone'},{name:'GTA V',ico:'🚗',plat:'Rockstar'},{name:'Elden Ring',ico:'🗡️',plat:'Steam'},{name:'Cyberpunk 2077',ico:'🤖',plat:'Steam'},{name:'PUBG',ico:'🪖',plat:'Steam'},{name:'Rust',ico:'🔧',plat:'Steam'},{name:'Escape from Tarkov',ico:'🎒',plat:'Standalone'},{name:'World of Warcraft',ico:'🐉',plat:'Battle.net'},{name:'Rocket League',ico:'🚀',plat:'Epic Games'},{name:'The Finals',ico:'🎬',plat:'Steam'},{name:'Path of Exile',ico:'💎',plat:'Steam'}];

function acF(inId,listId,data){const v=document.getElementById(inId).value.toLowerCase();const list=document.getElementById(listId);const f=data.filter(d=>d.name.toLowerCase().includes(v)).slice(0,8);if(!f.length){list.classList.remove('on');return;}list.innerHTML=f.map(d=>`<div class="ac-item" onmousedown="acSel('${inId}','${listId}','${d.name.replace(/'/g,"\\'")}','${d.ico||''}','${d.plat||''}')"><span class="ac-ico">${d.ico||''}</span><span>${d.name}</span>${d.plat?`<span class="ac-sub">${d.plat}</span>`:''}</div>`).join('');list.classList.add('on');}
function acSel(inId,listId,name,ico,plat){document.getElementById(inId).value=name;if(inId==='g-name'){if(ico)document.getElementById('g-ico').value=ico;if(plat)document.getElementById('g-plat').value=plat;}hideAc(listId);}
function hideAc(id){document.getElementById(id).classList.remove('on')}

// ══ EMOJI GRID ══════════════════════════════════════════
function buildEmojiGrid(containerId, list, currentEmoji, onChange) {
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  list.forEach(e => {
    const b = document.createElement('button');
    b.className = 'emoji-btn' + (e === currentEmoji ? ' sel' : '');
    b.textContent = e;
    b.onclick = () => {
      selEmoji = e;
      c.querySelectorAll('.emoji-btn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      // Reset 'Aucun' button when an emoji is picked
      const noBtn = document.getElementById('nb-no-emoji');
      if (noBtn) { noBtn.style.borderColor = 'transparent'; noBtn.style.color = 'var(--dim)'; }
      if (onChange) onChange(e);
    };
    c.appendChild(b);
  });
}

// ══ STATE ═══════════════════════════════════════════════
let savPath = null;   // absolute path string — no browser handle needed
let profile = { name: '', emoji: '🎮', folderHint: '' };

// S starts completely empty. Data comes exclusively from Lutility_SAV JSON files.
// DEFAULTS are written once on first launch when no games.json exists yet.
const S = {
  games: [],
  notebooks: [],
  notes: {},
  trash: [],      // [{id, type, name, date, data, parentPath}]  max 20
  shortcuts:   [],  // [{id, name, emoji, path}]
  customTools: [],  // [{id, ico, name, desc, cmd, type, admin}]
  activeGame: null,
  // 5-level note hierarchy
  activeNB:   null,
  activeCat:  null,
  activeSec:  null,
  activePage: null,
  activeSub:  null,
};

// ── Corbeille helpers ─────────────────────────────────
const TRASH_MAX = 20;

function trashPush(type, name, data, parentPath) {
  S.trash.unshift({ id: Date.now(), type, name, date: new Date().toLocaleDateString('fr'), data, parentPath });
  if (S.trash.length > TRASH_MAX) S.trash.length = TRASH_MAX;
}

// ── Migrate old notebooks (secs[]) to new format (cats[]) ──
// Uses STABLE IDs derived from original IDs so note keys never change on reload.
function migrateNotebooks(nbs) {
  return (nbs || []).map(nb => {
    if (nb.cats) return nb; // already new format
    // old: nb.secs[{id,name,subs:[{id,name}]}]
    // new: nb.cats[{id,name,secs:[{id,name,pages:[{id,name,subpages:[]}]}]}]
    const cats = (nb.secs || []).map(sec => ({
      id:   sec.id,               // keep same id = stable cat id
      name: sec.name,
      secs: [{
        id:   sec.id * 10 + 1,    // deterministic, derived from sec.id
        name: 'Général',
        pages: (sec.subs || []).map(sub => ({
          id:       sub.id,       // keep same id = stable page id
          name:     sub.name,
          subpages: [],
        })),
      }],
    }));
    return { id: nb.id, name: nb.name, emoji: nb.emoji||'', color: nb.color, cats };
  });
}
// ── Migrate old note keys to new 5-level key format ──────
// Old key: "nb{nbId}_s{secId}_sub{subId|root}"
// New key: "nb{nbId}_cat{catId}_s{newSecId}_p{pageId}_sproot"
// Stable mapping: catId=secId, newSecId=secId*10+1, pageId=subId
function migrateNoteKeys(notes, oldNbs) {
  const migrated = {};
  Object.keys(notes).forEach(oldKey => {
    if (oldKey.includes('_cat')) {
      // Already new format — keep as-is
      migrated[oldKey] = notes[oldKey];
      return;
    }
    // Parse old format: nb(\d+)_s(\d+)_sub(\d+|root)
    const parts = oldKey.split('_');
    if (parts.length !== 3) { migrated[oldKey] = notes[oldKey]; return; }
    const nbId  = parts[0].replace('nb', '');
    const secId = parts[1].replace('s',  '');
    const subPart = parts[2].replace('sub', '');
    if (!nbId || !secId) { migrated[oldKey] = notes[oldKey]; return; }
    const catId  = secId;
    const newSec = (+secId) * 10 + 1;
    if (subPart === 'root') {
      // Old root note (no sub): no matching page exists → skip
      return;
    }
    // subPart is a sub id → becomes pageId, sproot
    const newKey = 'nb' + nbId + '_cat' + catId + '_s' + newSec + '_p' + subPart + '_sproot';
    migrated[newKey] = notes[oldKey];
  });
  return migrated;
}
