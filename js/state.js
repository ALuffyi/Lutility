'use strict';

// ══ CONSTANTS ═══════════════════════════════════════════
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
let savPath = null;
let profile = { name: '', emoji: '🎮', folderHint: '' };

// S démarre vide — données chargées depuis Lutility_SAV au démarrage
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

const TRASH_MAX = 20;

function trashPush(type, name, data, parentPath) {
  S.trash.unshift({ id: Date.now(), type, name, date: new Date().toLocaleDateString('fr'), data, parentPath });
  if (S.trash.length > TRASH_MAX) S.trash.length = TRASH_MAX;
}

// Migration ancien format (secs[]) → nouveau (cats[])
// IDs stables dérivés des originaux → clés de notes inchangées
function migrateNotebooks(nbs) {
  return (nbs || []).map(nb => {
    if (nb.cats) return nb;
    const cats = (nb.secs || []).map(sec => ({
      id:   sec.id,            // stable cat id
      name: sec.name,
      secs: [{
        id:   sec.id * 10 + 1, // déterministe, dérivé de sec.id
        name: 'Général',
        pages: (sec.subs || []).map(sub => ({
          id:       sub.id,    // stable page id
          name:     sub.name,
          subpages: [],
        })),
      }],
    }));
    return { id: nb.id, name: nb.name, emoji: nb.emoji||'', color: nb.color, cats };
  });
}
// Migration clés notes : "nb{nbId}_s{secId}_sub{subId|root}" → "nb{nbId}_cat{catId}_s{newSecId}_p{pageId}_sproot"
function migrateNoteKeys(notes, oldNbs) {
  const migrated = {};
  Object.keys(notes).forEach(oldKey => {
    if (oldKey.includes('_cat')) {
      migrated[oldKey] = notes[oldKey]; // déjà nouveau format
      return;
    }
    // Ancien format : nb(\d+)_s(\d+)_sub(\d+|root)
    const parts = oldKey.split('_');
    if (parts.length !== 3) { migrated[oldKey] = notes[oldKey]; return; }
    const nbId  = parts[0].replace('nb', '');
    const secId = parts[1].replace('s',  '');
    const subPart = parts[2].replace('sub', '');
    if (!nbId || !secId) { migrated[oldKey] = notes[oldKey]; return; }
    const catId  = secId;
    const newSec = (+secId) * 10 + 1;
    if (subPart === 'root') return; // ancienne note root sans page → ignore
    const newKey = 'nb' + nbId + '_cat' + catId + '_s' + newSec + '_p' + subPart + '_sproot';
    migrated[newKey] = notes[oldKey];
  });
  return migrated;
}
