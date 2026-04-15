'use strict';

// ══ OUTILS INTÉGRÉS ══════════════════════════════════════
const TOOLS = [
  // ── MAINTENANCE ──────────────────────────────────────
  {
    ico:'🗑️', name:'Vider la Corbeille', tag:'Maint.', tc:'y',
    desc:'Vide définitivement la corbeille Windows et libère de l\'espace disque.',
    admin:false, type:'PS',
    cmd:'Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output "Corbeille videe."',
  },
  {
    ico:'🧹', name:'Nettoyer Temp et Prefetch', tag:'Maint.', tc:'y',
    desc:'Supprime les fichiers temporaires Windows pour libérer de l\'espace.',
    admin:true, type:'CMD',
    cmd:'del /q /f /s %TEMP%\\* 2>nul\ndel /q /f /s C:\\Windows\\Temp\\* 2>nul\ndel /q /f /s C:\\Windows\\Prefetch\\* 2>nul',
  },
  {
    ico:'💽', name:'Nettoyage Disque', tag:'Maint.', tc:'y',
    desc:'Ouvre l\'outil Windows de nettoyage de disque pour libérer de l\'espace.',
    admin:false, type:'CMD',
    cmd:'start cleanmgr',
  },
  {
    ico:'⚙️', name:'Optimiser et Défragmenter', tag:'Maint.', tc:'y',
    desc:'Ouvre l\'outil Windows d\'optimisation et de défragmentation des lecteurs.',
    admin:false, type:'CMD',
    cmd:'start dfrgui',
  },
  // ── WINDOWS ──────────────────────────────────────────
  {
    ico:'🙋', name:'Assistance Rapide', tag:'Windows', tc:'b',
    desc:'Ouvre l\'application Assistance Rapide Microsoft Store (Windows 11).',
    admin:false, type:'CMD',
    cmd:'start ms-quick-assist:',
  },
  {
    ico:'🗂️', name:'Gestionnaire de Disques', tag:'Windows', tc:'b',
    desc:'Ouvre l\'outil Windows pour créer, formater et gérer les partitions.',
    admin:true, type:'CMD',
    cmd:'start diskmgmt.msc',
  },
  // ── SYSTÈME ──────────────────────────────────────────
  {
    ico:'🧬', name:'Debloat Windows', tag:'Système', tc:'p',
    desc:'Lance le script Debloat en Admin — supprime les bloatwares et optimise Windows.',
    admin:true, type:'PS',
    cmd:'iwr -useb https://git.io/debloat | iex',
  },
  {
    ico:'🛡️', fav:'malwarebytes.com', name:'AdwCleaner', tag:'Système', tc:'p',
    desc:'Ouvre la page de téléchargement AdwCleaner — supprime adwares, PUPs et toolbars (Malwarebytes).',
    admin:false, type:'CMD',
    cmd:'start https://www.malwarebytes.com/adwcleaner',
  },
  {
    ico:'🎮', fav:'systemrequirementslab.com', name:'Can You Run It ?', tag:'Système', tc:'p',
    desc:'Vérifie si votre PC peut faire tourner un jeu — détection automatique de votre configuration matérielle.',
    admin:false, type:'CMD',
    cmd:'start https://www.systemrequirementslab.com/cyri',
  },
  // ── MISES À JOUR ─────────────────────────────────────
  {
    ico:'🔄', name:'Mettre à jour les logiciels (winget)', tag:'Update', tc:'g',
    desc:'Ouvre un terminal et met à jour tous les logiciels installés via winget (progression visible).',
    admin:false, type:'PS',
    cmd:'Start-Process powershell -ArgumentList \'-NoExit -ExecutionPolicy Bypass -Command "Write-Host \'\'Mise a jour via winget...\'\' -ForegroundColor Cyan; winget upgrade --all --accept-package-agreements --accept-source-agreements"\'',
  },
  {
    ico:'🖥️', fav:'driverscloud.com', name:'Mettre à jour les drivers (DriversCloud)', tag:'Update', tc:'g',
    desc:'Ouvre DriversCloud dans le navigateur : détection automatique des drivers manquants ou obsolètes.',
    admin:false, type:'CMD',
    cmd:'start https://www.driverscloud.com/fr',
  },
  {
    ico:'🟢', fav:'nvidia.com', name:'Mettre à jour les pilotes NVIDIA', tag:'Update', tc:'g',
    desc:'Lance GeForce Experience pour mettre à jour les pilotes NVIDIA. Ouvre la page de téléchargement si GFE n\'est pas installé.',
    admin:false, type:'PS',
    cmd:'$paths=@("C:\\Program Files\\NVIDIA Corporation\\NVIDIA GeForce Experience\\NVIDIA GeForce Experience.exe","C:\\Program Files (x86)\\NVIDIA Corporation\\NVIDIA GeForce Experience\\NVIDIA GeForce Experience.exe");$exe=$paths|Where-Object{Test-Path $_}|Select-Object -First 1;if($exe){Start-Process $exe}else{Start-Process "https://www.nvidia.com/fr-fr/geforce/drivers/"}',
  },
  {
    ico:'🪟', name:'Windows Update', tag:'Update', tc:'g',
    desc:'Ouvre les paramètres Windows Update pour rechercher et installer les mises à jour.',
    admin:false, type:'CMD',
    cmd:'start ms-settings:windowsupdate',
  },
  {
    ico:'🚀', fav:'store.steampowered.com', name:'Driver Booster Free (Steam)', tag:'Update', tc:'g',
    desc:'Lance Driver Booster Free (IObit) — détecte et met à jour les pilotes obsolètes. Version Steam.',
    admin:false, type:'PS',
    cmd:'$paths=@("$env:ProgramFiles\\IObit\\Driver Booster\\DriverBooster.exe","${env:ProgramFiles(x86)}\\IObit\\Driver Booster\\DriverBooster.exe",(Get-ChildItem "$env:ProgramFiles(x86)\\Steam\\steamapps\\common" -Recurse -Filter "DriverBooster.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName));$exe=$paths|Where-Object{$_ -and (Test-Path $_)}|Select-Object -First 1;if($exe){Start-Process $exe}else{Start-Process "steam://search/Driver Booster"}',
  },
];

const TOOL_CATS = [
  { id:'updates', label:'🔄 Mises à jour',  tc:'g', tags:['Update']   },
  { id:'maint',   label:'🧹 Maintenance',   tc:'y', tags:['Maint.']   },
  { id:'windows', label:'🪟 Windows',       tc:'b', tags:['Windows']  },
  { id:'systeme', label:'🧬 Système',       tc:'p', tags:['Système']  },
];

const _catCollapsed = {}; // état collapse par catégorie (session)

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tempBadge(str) {
  if (!str || str === 'N/A') return '<span style="color:var(--dim)">N/A</span>';
  const n = parseInt(str);
  if (isNaN(n)) return '<span style="color:var(--dim)">' + escHtml(str) + '</span>';
  const col = n < 60 ? 'var(--green)' : n < 80 ? 'var(--orange)' : 'var(--red)';
  return `<span style="color:${col};font-weight:700">${escHtml(str)}</span>`;
}

// Script PowerShell — infos matérielles (lancé manuellement)
const PS_SYSINFO = `
try {
  $os  = Get-CimInstance Win32_OperatingSystem
  $cpu = (Get-CimInstance Win32_Processor)[0]
  $mb  = Get-CimInstance Win32_BaseBoard
  $gpu = Get-CimInstance Win32_VideoController
  $ram = Get-CimInstance Win32_PhysicalMemory
  $hdd = Get-CimInstance Win32_DiskDrive
  $bios = Get-CimInstance Win32_BIOS -EA SilentlyContinue
  $reg = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" -EA SilentlyContinue
  $winVer   = if ($reg.DisplayVersion) { $reg.DisplayVersion } else { '' }
  $ramTotal = [math]::Round($os.TotalVisibleMemorySize/1MB,1)
  $ramFree  = [math]::Round($os.FreePhysicalMemory/1MB,1)
  $ramUsed  = [math]::Round($ramTotal-$ramFree,1)
  $ramSl    = ($ram | ForEach-Object { "$([math]::Round($_.Capacity/1GB,0)) Go @ $($_.Speed) MHz" }) -join ', '
  $gpuStr   = ($gpu | Where-Object { $_.Name -notmatch 'Microsoft Basic' } | ForEach-Object { $_.Name.Trim() }) -join ' | '
  $nvGpu    = $gpu | Where-Object { $_.Name -match 'NVIDIA' } | Select-Object -First 1
  $nvDriver = if ($nvGpu -and $nvGpu.DriverVersion) { $nvGpu.DriverVersion.Trim() } else { '' }
  $diskStr  = ($hdd | ForEach-Object { "$($_.Model.Trim()) [$([math]::Round($_.Size/1GB,0)) Go]" }) -join ' | '
  $osStr    = ("$($os.Caption) $winVer (Build $($os.BuildNumber))").Trim()
  $bM = if ($bios -and $bios.Manufacturer) { $bios.Manufacturer.Trim() } else { '' }
  $bV = if ($bios -and $bios.SMBIOSBIOSVersion) { $bios.SMBIOSBIOSVersion.Trim() } else { '?' }
  $biosStr  = if ($bM) { "$bM - v$bV" } else { "v$bV" }
  $dArr = @(Get-PSDrive -PSProvider FileSystem -EA SilentlyContinue | Where-Object { $_.Used -ne $null -and ($_.Used+$_.Free) -gt 0 } | ForEach-Object { [PSCustomObject]@{ n=$_.Name; used=[math]::Round($_.Used/1GB,1); total=[math]::Round(($_.Used+$_.Free)/1GB,1) } })
  $dJson = if ($dArr.Count -gt 0) { $dArr | ConvertTo-Json -Compress } else { '[]' }
  if ($dJson -and $dJson[0] -ne '[') { $dJson = "[$dJson]" }
  [PSCustomObject]@{ os=$osStr; cpu=$cpu.Name.Trim(); mb="$($mb.Manufacturer.Trim()) $($mb.Product.Trim())"; gpu=if($gpuStr){$gpuStr}else{'Non detecte'}; ram="$ramUsed Go / $ramTotal Go"; ramSl=$ramSl; disks=if($diskStr){$diskStr}else{'Non detecte'}; bios=$biosStr; disksArr=$dJson; nvDriver=$nvDriver; tGpu='N/A'; tCpu='N/A' } | ConvertTo-Json -Compress
} catch { Write-Output '{"error":"Erreur WMI"}' }
`.trim();

// Script PowerShell — CPU temp uniquement (WMI, toutes les 30s)
const PS_CPU_TEMP = `
try {
  $tz = @(Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace 'root/wmi' -ErrorAction Stop)
  if ($tz.Count -gt 0) {
    $maxK = ($tz | Measure-Object -Property CurrentTemperature -Maximum).Maximum
    $tc   = [math]::Round(($maxK - 2732) / 10, 0)
    if ($tc -gt 0 -and $tc -lt 150) { Write-Output "$($tc)C" } else { Write-Output 'N/A' }
  } else { Write-Output 'N/A' }
} catch { Write-Output 'N/A' }
`.trim();

let _tempTimer = null;
let _lastGpuTemp = 'N/A';
let _lastCpuTemp = 'N/A';

function startTempRefresh() {
  stopTempRefresh();
  _refreshTemp();
  _tempTimer = setInterval(_refreshTemp, 30000);
}

function stopTempRefresh() {
  if (_tempTimer) { clearInterval(_tempTimer); _tempTimer = null; }
}

// ── Auto-refresh Sysinfo (toutes les 3 min) ──────────────────────────────
let _sysinfoTimer = null;

function startSysinfoRefresh() {
  stopSysinfoRefresh();
  // Charge immédiatement si le grid est vide (première visite)
  const grid = document.getElementById('sysinfo-grid');
  if (grid && !grid.querySelector('.si-block')) loadSysinfo();
  _sysinfoTimer = setInterval(() => {
    if (document.getElementById('sysinfo-grid')) loadSysinfo();
    else stopSysinfoRefresh();
  }, 180000);
}

function stopSysinfoRefresh() {
  if (_sysinfoTimer) { clearInterval(_sysinfoTimer); _sysinfoTimer = null; }
}

async function _refreshGpuTemp() {
  const el = document.getElementById('si-gpu-temp');
  if (!el) return;
  const r = await window.api.siTemps();
  if (!r.ok || !r.gpus.length) return;
  const t = r.gpus[0].temp;
  _lastGpuTemp = t != null ? t + 'C' : 'N/A';
  el.innerHTML = tempBadge(_lastGpuTemp);
}

async function _refreshCpuTemp() {
  const el = document.getElementById('si-cpu-temp');
  if (!el) return;
  const r = await window.api.execPsScript(PS_CPU_TEMP);
  if (!r.ok || !r.out) return;
  _lastCpuTemp = r.out.trim();
  el.innerHTML = tempBadge(_lastCpuTemp);
}

async function _refreshRam() {
  const el = document.getElementById('si-ram-live');
  if (!el) return;
  const r = await window.api.siMem();
  if (!r.ok) return;
  const used  = (r.used  / 1073741824).toFixed(1);
  const total = (r.total / 1073741824).toFixed(1);
  el.textContent = used + ' Go / ' + total + ' Go';
}

async function _refreshTemp() {
  if (!document.getElementById('si-gpu-temp') &&
      !document.getElementById('si-cpu-temp') &&
      !document.getElementById('si-ram-live')) {
    stopTempRefresh();
    return;
  }
  await Promise.all([_refreshGpuTemp(), _refreshCpuTemp(), _refreshRam()]);
}

async function loadSysinfo() {
  const grid = document.getElementById('sysinfo-grid');
  if (!grid) return;
  const btn = document.getElementById('si-refresh-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Collecte…'; }
  grid.innerHTML = '<div class="si-loading">⏳ Collecte des informations système…</div>';

  try {
    const result = await window.api.execPsScript(PS_SYSINFO);
    if (!result.ok) {
      grid.innerHTML = `<div class="si-loading si-err">❌ ${escHtml(result.out)}</div>`;
      return;
    }
    let d;
    try { d = JSON.parse(result.out); }
    catch { grid.innerHTML = '<div class="si-loading si-err">❌ Réponse invalide.</div>'; return; }
    if (d.error) { grid.innerHTML = `<div class="si-loading si-err">❌ ${escHtml(d.error)}</div>`; return; }

    _lastGpuTemp = d.tGpu || 'N/A';
    _lastCpuTemp = d.tCpu || 'N/A';

    let diskBarsHtml = '<span style="color:var(--dim);font-size:12px">Non détecté</span>';
    try {
      const dArr = JSON.parse(d.disksArr || '[]');
      if (Array.isArray(dArr) && dArr.length) {
        diskBarsHtml = dArr.map(dk => {
          const pct = dk.total > 0 ? Math.round(dk.used / dk.total * 100) : 0;
          const col = pct < 70 ? 'var(--green)' : pct < 90 ? 'var(--orange)' : 'var(--red)';
          return `<div class="disk-bar-item">
            <div class="disk-bar-lbl"><span>${escHtml(dk.n)}:\\</span><span>${escHtml(String(dk.used))} / ${escHtml(String(dk.total))} Go</span></div>
            <div class="disk-bar-track"><div class="disk-bar-fill" style="width:${pct}%;background:${col}"></div></div>
            <span class="disk-bar-pct" style="color:${col}">${pct}%</span>
          </div>`;
        }).join('');
      }
    } catch {}

    grid.innerHTML = `
      <div class="si-block si-block-full">
        <div class="si-lbl">🖥️ Système</div>
        <div class="si-val">${escHtml(d.os||'—')}</div>
      </div>
      <div class="si-block">
        <div class="si-lbl">⚡ Processeur</div>
        <div class="si-val">${escHtml(d.cpu||'—')}</div>
        <div class="si-sub si-temp">🌡️ <span id="si-cpu-temp">${tempBadge(_lastCpuTemp)}</span></div>
      </div>
      <div class="si-block">
        <div class="si-lbl">🔲 BIOS / UEFI</div>
        <div class="si-val">${escHtml(d.bios||'—')}</div>
      </div>
      <div class="si-block">
        <div class="si-lbl">🔌 Carte mère</div>
        <div class="si-val">${escHtml(d.mb||'—')}</div>
      </div>
      <div class="si-block">
        <div class="si-lbl">🎮 Carte graphique</div>
        <div class="si-val">${escHtml(d.gpu||'—')}</div>
        ${d.nvDriver ? `<div class="si-sub">🔧 Pilote : ${escHtml(d.nvDriver)}</div>` : ''}
        <div class="si-sub si-temp">🌡️ <span id="si-gpu-temp">${tempBadge(_lastGpuTemp)}</span></div>
      </div>
      <div class="si-block">
        <div class="si-lbl">💾 RAM</div>
        <div class="si-val" id="si-ram-live">${escHtml(d.ram||'—')}</div>
        <div class="si-sub">${escHtml(d.ramSl||'')}</div>
      </div>
      <div class="si-block si-block-full">
        <div class="si-lbl">💿 Stockage (disques physiques)</div>
        <div class="si-val">${escHtml(d.disks||'—')}</div>
      </div>
      <div class="si-block si-block-full">
        <div class="si-lbl">📊 Utilisation des disques</div>
        <div class="si-val" style="display:flex;flex-direction:column;gap:6px;margin-top:2px">${diskBarsHtml}</div>
      </div>
      `;

    startTempRefresh();
  } catch(e) {
    grid.innerHTML = `<div class="si-loading si-err">❌ ${escHtml(e.message)}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualiser'; }
  }
}

// ══ PROGRAMMES CONSEILLÉS ════════════════════════════
const PROG_CATS = [
  { id:'nav',     label:'🌐 Navigateurs',   tc:'g' },
  { id:'periph',  label:'🖱️ Périphériques', tc:'p' },
  { id:'gaming',  label:'🎮 Gaming',        tc:'o' },
  { id:'comms',   label:'💬 Communication', tc:'b' },
  { id:'capture', label:'🎥 Capture',       tc:'y' },
  { id:'utils',   label:'⚡ Utilitaires',   tc:'b' },
];

const PROGRAMMES = [
  // ── GAMING ───────────────────────────────────────────
  { cat:'gaming', ico:'🎮', name:'Steam',
    desc:'La plateforme de jeux PC — bibliothèque, multijoueur, workshop et Cloud.',
    url:'https://store.steampowered.com/about/', fav:'store.steampowered.com' },
  { cat:'gaming', ico:'🎯', name:'Epic Games Launcher',
    desc:'Launcher Epic — Fortnite, jeux gratuits mensuels, exclusivités PC.',
    url:'https://store.epicgames.com/en-US/download', fav:'store.epicgames.com' },
  { cat:'gaming', ico:'💙', name:'Battle.net',
    desc:'Launcher Blizzard — Overwatch 2, Diablo IV, WoW, Hearthstone.',
    url:'https://www.blizzard.com/en-us/apps/battle.net/desktop', fav:'blizzard.com' },
  { cat:'gaming', ico:'🟠', name:'EA App',
    desc:'Launcher EA — EA FC, Battlefield, The Sims, Apex Legends.',
    url:'https://www.ea.com/ea-app', fav:'ea.com' },
  { cat:'gaming', ico:'💚', name:'Nvidia App',
    desc:'Pilotes à jour, overlay in-game, ShadowPlay — remplace GeForce Experience.',
    url:'https://www.nvidia.com/en-us/software/nvidia-app/', fav:'nvidia.com' },
  // ── COMMUNICATION ────────────────────────────────────
  { cat:'comms', ico:'💬', name:'Discord',
    desc:'Voix, vidéo et chat pour gamers — serveurs, streams et DMs.',
    url:'https://discord.com/download', fav:'discord.com' },
  { cat:'comms', ico:'📱', name:'WhatsApp',
    desc:'Messagerie WhatsApp sur PC, synchronisée avec votre téléphone.',
    store:'ms-windows-store://pdp/?productid=9NKSQGP7F2NH', fav:'whatsapp.com' },
  // ── NAVIGATEURS ──────────────────────────────────────
  { cat:'nav', ico:'🦁', name:'Brave',
    desc:'Navigateur rapide et respectueux — bloqueur pub intégré, Tor, crypto.',
    url:'https://brave.com/download/', fav:'brave.com' },
  { cat:'nav', ico:'🦊', name:'Firefox',
    desc:'Navigateur libre et open-source — vie privée, extensions, sync.',
    url:'https://www.mozilla.org/firefox/download/thanks/', fav:'mozilla.org' },
  { cat:'nav', ico:'🎭', name:'Opera GX',
    desc:'Navigateur gaming — limiteur CPU/RAM, intégrations Discord & Twitch.',
    url:'https://www.opera.com/gx', fav:'opera.com' },
  { cat:'nav', ico:'🌐', name:'Chrome',
    desc:'Navigateur Google — rapide, synchronisé avec votre compte Google.',
    url:'https://www.google.com/chrome/', fav:'google.com' },
  // ── PÉRIPHÉRIQUES ────────────────────────────────────
  { cat:'periph', ico:'⌨️', name:'iCUE (Corsair)',
    desc:'RGB et configuration pour claviers, souris, headsets et RAM Corsair.',
    url:'https://www.corsair.com/us/en/s/downloads', fav:'corsair.com' },
  { cat:'periph', ico:'🐍', name:'Razer Synapse',
    desc:'Configuration RGB et macros pour tous les périphériques Razer.',
    url:'https://www.razer.com/synapse-3', fav:'razer.com' },
  { cat:'periph', ico:'🎧', name:'SteelSeries GG',
    desc:'Gestion des périphériques SteelSeries — RGB, équaliseur, paramètres.',
    url:'https://steelseries.com/gg', fav:'steelseries.com' },
  { cat:'periph', ico:'⌨️', name:'Wootility (Wooting)',
    desc:'Configuration et firmware pour claviers analogiques Wooting.',
    url:'https://wooting.io/wootility', fav:'wooting.io' },
  // ── CAPTURE ──────────────────────────────────────────
  { cat:'capture', ico:'🔴', name:'OBS Studio',
    desc:'Logiciel de streaming et d\'enregistrement open-source — le standard des créateurs de contenu.',
    url:'https://obsproject.com/download', fav:'obsproject.com' },
  { cat:'capture', ico:'🎬', name:'Medal.tv',
    desc:'Enregistrement automatique de tes meilleures highlights gaming.',
    url:'https://medal.tv/download', fav:'medal.tv' },
  // ── UTILITAIRES ──────────────────────────────────────
  { cat:'utils', ico:'🔊', name:'EarTrumpet',
    desc:'Mixeur audio par application — contrôle le volume de chaque programme séparément.',
    store:'ms-windows-store://pdp/?productid=9NBLGGH516XP', fav:'eartrumpet.app' },
  { cat:'utils', ico:'⚡', name:'PowerToys',
    desc:'Suite Microsoft : FancyZones, Color Picker, PowerRename, Mouse Highlighter et bien plus.',
    store:'ms-windows-store://pdp/?productid=XP89DCGQ3K6VLD', fav:'microsoft.com' },
  { cat:'utils', ico:'🪟', name:'Wintoys',
    desc:'Optimise, personnalise et nettoie Windows 11 en quelques clics. Interface claire et sans risque.',
    store:'ms-windows-store://pdp/?productid=9P8LTPGCBZXD', fav:'microsoft.com' },
];

function renderProgrammes() {
  const container = document.getElementById('prog-grid');
  if (!container) return;
  container.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'ts';

  PROG_CATS.forEach(cat => {
    const progs = PROGRAMMES.filter(p => p.cat === cat.id);
    if (!progs.length) return;
    const collapsed = _catCollapsed['prog_' + cat.id] ?? true;

    const catEl = document.createElement('div');
    catEl.className = 'tool-cat';
    catEl.innerHTML = `
      <div class="tool-cat-hdr" data-tc="${cat.tc||''}" onclick="toggleCat('prog_${cat.id}')">
        <span class="tool-cat-lbl">${escHtml(cat.label)}</span>
        <span class="tool-cat-badge">${progs.length}</span>
        <span class="tool-cat-arr" id="cat-icon-prog_${cat.id}">${collapsed ? '▸' : '▾'}</span>
      </div>
      <div class="tools-inner-grid" id="cat-body-prog_${cat.id}" style="${collapsed?'display:none':''}"></div>`;

    const grid = catEl.querySelector('#cat-body-prog_' + cat.id);
    progs.forEach(prog => {
      const isStore = !!prog.store;
      const link    = prog.store || prog.url;
      const card    = document.createElement('div');
      card.className = 'tcard';
      if (cat.tc) card.dataset.tc = cat.tc;

      card.innerHTML = `
        <div class="tcard-hdr">
          <div class="tcard-ico" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;font-size:22px">${escHtml(prog.ico)}</div>
          <div class="tcard-name">${escHtml(prog.name)}</div>
        </div>
        <div class="tcard-body">
          <div class="tdesc">${escHtml(prog.desc)}</div>
        </div>`;
      const btn = document.createElement('button');
      btn.className = 'btn sm prim';
      btn.style.cssText = 'width:100%;justify-content:center;margin-top:10px';
      btn.innerHTML = isStore ? '📦 Microsoft Store' : '🌐 Télécharger';
      btn.onclick = () => window.api.openUrl(link);
      card.querySelector('.tcard-body').appendChild(btn);
      grid.appendChild(card);
    });

    section.appendChild(catEl);
  });

  container.appendChild(section);
}

// ══ RACCOURCIS ════════════════════════════════════════
const SC_EMOJIS = ['🔗','🎮','⚙️','🔧','📂','🚀','💻','🎯','⚡','🔥','🛡️','📡','🖥️','🖱️','⌨️','📁','🎵','🎬','🌐','💡','🧰','🗂️'];
let _scEmoji  = '';
const _scIconCache = new Map();
let _scEditId = null;

function _scClearEmoji() {
  _scEmoji = '';
  document.querySelectorAll('#sc-emoji-grid .emoji-btn').forEach(b => b.classList.remove('sel'));
  const noBtn = document.getElementById('sc-no-emoji');
  if (noBtn) noBtn.classList.add('sel');
}

function _scSyncNoneBtn() {
  const noBtn = document.getElementById('sc-no-emoji');
  if (noBtn) noBtn.classList.toggle('sel', !_scEmoji);
}

function openAddShortcut() {
  _scEditId = null;
  _scEmoji  = '';
  document.getElementById('sc-modal-title').textContent = '🔗 Ajouter un raccourci';
  document.getElementById('sc-path').value = '';
  document.getElementById('sc-name').value = '';
  buildEmojiGrid('sc-emoji-grid', SC_EMOJIS, _scEmoji, e => { _scEmoji = e; _scSyncNoneBtn(); });
  _scSyncNoneBtn();
  openModal('modal-shortcut');
}

function scEdit(id) {
  const sc = S.shortcuts.find(s => s.id === id);
  if (!sc) return;
  _scEditId = id;
  _scEmoji  = sc.emoji || '';
  document.getElementById('sc-modal-title').textContent = '✏️ Modifier le raccourci';
  document.getElementById('sc-path').value = sc.path;
  document.getElementById('sc-name').value = sc.name;
  buildEmojiGrid('sc-emoji-grid', SC_EMOJIS, _scEmoji, e => { _scEmoji = e; _scSyncNoneBtn(); });
  _scSyncNoneBtn();
  openModal('modal-shortcut');
}

async function scBrowse() {
  const p = await window.api.chooseExe();
  if (!p) return;
  document.getElementById('sc-path').value = p;
  const nm = document.getElementById('sc-name');
  if (!nm.value) {
    nm.value = p.split('\\').pop().split('/').pop()
      .replace(/\.(exe|bat|cmd|lnk)$/i, '').substring(0, 32);
  }
}

async function scConfirm() {
  const path = document.getElementById('sc-path').value.trim();
  if (!path) { toast('Choisissez un programme', 'warn'); return; }
  const name = document.getElementById('sc-name').value.trim()
    || path.split('\\').pop().split('/').pop().replace(/\.(exe|bat|cmd|lnk)$/i, '');

  if (_scEditId !== null) {
    const sc = S.shortcuts.find(s => s.id === _scEditId);
    if (sc) { sc.name = name; sc.emoji = _scEmoji; sc.path = path; }
  } else {
    S.shortcuts.push({ id: Date.now(), name, emoji: _scEmoji, path });
  }

  await saveAll();
  closeModal('modal-shortcut');
  renderShortcuts();
  toast(_scEditId !== null ? '✅ Raccourci modifié !' : '✅ Raccourci ajouté !');
  _scEditId = null;
}

async function scDelete(id) {
  S.shortcuts = S.shortcuts.filter(s => s.id !== id);
  await saveAll();
  renderShortcuts();
  toast('Raccourci supprimé');
}

async function scLaunch(id) {
  const sc = S.shortcuts.find(s => s.id === id);
  if (!sc) return;
  const ok = await window.api.launchApp(sc.path);
  if (ok) toast('🚀 ' + sc.name);
  else    toast('Impossible de lancer : ' + sc.name, 'warn');
}

function renderShortcuts() {
  const wrap = document.getElementById('sc-wrap');
  if (!wrap) return;
  if (!S.shortcuts.length) {
    wrap.innerHTML = '<div class="sc-empty">Aucun raccourci — cliquez sur <strong>+ Ajouter</strong>.</div>';
    return;
  }
  wrap.innerHTML = S.shortcuts.map(sc => {
    const icoInner = sc.emoji
      ? `<span class="sc-ico-fallback">${escHtml(sc.emoji)}</span>`
      : (_scIconCache.has(sc.path)
          ? `<img src="${_scIconCache.get(sc.path)}" class="sc-file-ico" draggable="false">`
          : `<span class="sc-ico-fallback" style="opacity:.3">⏳</span>`);
    return `
    <div class="sc-card">
      <div class="sc-ico" id="sc-ico-${sc.id}">${icoInner}</div>
      <div class="sc-name" title="${escHtml(sc.path)}">${escHtml(sc.name)}</div>
      <button class="btn sm prim sc-btn" onclick="scLaunch(${sc.id})" title="Lancer">▶</button>
      <button class="btn sm sc-btn" onclick="scEdit(${sc.id})" title="Modifier">✏️</button>
      <button class="btn sm sc-btn sc-del" onclick="scDelete(${sc.id})" title="Supprimer">✕</button>
    </div>`;
  }).join('');

  // Chargement async des icônes fichier (uniquement si pas d'emoji)
  S.shortcuts.filter(sc => !sc.emoji).forEach(async sc => {
    if (_scIconCache.has(sc.path)) return; // déjà en cache, déjà rendu
    const dataUrl = await window.api.getFileIcon(sc.path);
    if (!dataUrl) return;
    _scIconCache.set(sc.path, dataUrl);
    const el = document.getElementById('sc-ico-' + sc.id);
    if (el) el.innerHTML = `<img src="${dataUrl}" class="sc-file-ico" draggable="false">`;
  });
}

// ══ SCRIPTS (fichiers .bat / .cmd / .ps1) ═════════════
const CT_EMOJIS = ['⚙️','🔧','🛠️','💻','🖥️','⚡','🚀','🔒','🌐','🎮','🧹','💽','🗑️','🔄','📡','🛡️','💾','🔍','📋','🗂️','🧬','🔌','🖱️','⌨️','📊','🧰','🔑','🗝️','💡','🔐'];
let _ctEditId   = null;
let _ctIcoSel   = '⚙️';
let _ctFilePath = '';

function _ctBuildEmojiGrid() {
  const grid = document.getElementById('ct-ico-grid');
  if (!grid) return;
  grid.innerHTML = CT_EMOJIS.map(e =>
    `<button type="button" class="ct-ico-btn${e === _ctIcoSel ? ' sel' : ''}" onclick="_ctPickIco('${e}')">${e}</button>`
  ).join('');
}

function _ctPickIco(e) {
  _ctIcoSel = e;
  const inp = document.getElementById('ct-ico');
  if (inp) inp.value = e;
  document.querySelectorAll('.ct-ico-btn').forEach(b => b.classList.toggle('sel', b.textContent === e));
}

function _ctSetPath(p) {
  _ctFilePath = p || '';
  const el = document.getElementById('ct-path-display');
  if (el) { el.textContent = p || '—'; el.title = p || ''; }
}

async function _ctPickFile() {
  const p = await window.api.chooseScript();
  if (p) _ctSetPath(p);
}

async function openAddCustomTool() {
  const filePath = await window.api.chooseScript();
  if (!filePath) return;
  _ctEditId = null;
  _ctIcoSel = '⚙️';
  const fileName = filePath.split(/[/\\]/).pop().replace(/\.(bat|cmd|ps1)$/i, '');
  document.getElementById('ct-modal-title').textContent = '⚙️ Nouveau script';
  document.getElementById('ct-name').value = fileName;
  document.getElementById('ct-ico').value  = '⚙️';
  _ctSetPath(filePath);
  _ctBuildEmojiGrid();
  openModal('modal-custom-tool');
}

function ctEdit(id) {
  const ct = (S.customTools || []).find(t => t.id === id);
  if (!ct) return;
  _ctEditId = id;
  _ctIcoSel = ct.ico || '⚙️';
  document.getElementById('ct-modal-title').textContent = '✏️ Modifier le script';
  document.getElementById('ct-name').value = ct.name;
  document.getElementById('ct-ico').value  = _ctIcoSel;
  _ctSetPath(ct.path || ct.cmd || '');
  _ctBuildEmojiGrid();
  openModal('modal-custom-tool');
}

async function ctDuplicate(id) {
  const ct = (S.customTools || []).find(t => t.id === id);
  if (!ct) return;
  const copy = { ...ct, id: Date.now(), name: ct.name + ' (copie)' };
  S.customTools.push(copy);
  await saveAll();
  renderCustomTools();
  toast('📋 Script dupliqué !');
}

async function ctConfirm() {
  const name = document.getElementById('ct-name').value.trim();
  if (!name)        { toast('Entrez un nom', 'warn'); document.getElementById('ct-name').focus(); return; }
  if (!_ctFilePath) { toast('Choisissez un fichier', 'warn'); return; }

  const obj = { name, ico: document.getElementById('ct-ico').value.trim() || '⚙️', path: _ctFilePath };

  if (_ctEditId !== null) {
    const idx = (S.customTools || []).findIndex(t => t.id === _ctEditId);
    if (idx >= 0) S.customTools[idx] = { ...S.customTools[idx], ...obj };
  } else {
    if (!S.customTools) S.customTools = [];
    S.customTools.push({ id: Date.now(), ...obj });
  }

  await saveAll();
  closeModal('modal-custom-tool');
  renderCustomTools();
  toast(_ctEditId !== null ? '✅ Script modifié !' : '✅ Script ajouté !');
  _ctEditId = null;
}

async function ctDelete(id) {
  if (!confirm('Supprimer ce script ?')) return;
  S.customTools = (S.customTools || []).filter(t => t.id !== id);
  await saveAll();
  renderCustomTools();
  toast('Script supprimé');
}

async function execCustomTool(id) {
  const ct = (S.customTools || []).find(t => t.id === id);
  if (!ct) return;
  const filePath = ct.path || ct.cmd;
  if (!filePath) { toast('Aucun fichier configuré', 'warn'); return; }

  // Vérification dépendances selon l'extension
  const ext = filePath.split('.').pop().toLowerCase();
  if (ext === 'py') {
    const check = await window.api.checkDep('python');
    if (!check.ok) { toast('⚠️ Python introuvable — vérifiez votre installation', 'warn'); return; }
  } else if (ext === 'ps1') {
    const check = await window.api.checkDep('ps1');
    if (!check.ok) { toast(`⚠️ PowerShell bloqué (politique : ${check.policy}) — lancez Set-ExecutionPolicy RemoteSigned`, 'warn'); return; }
  }

  const btn = document.getElementById('ct-exec-' + id);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    const ok = await window.api.launchApp(filePath);
    if (ok) toast('▶ ' + ct.name);
    else    toast('Impossible de lancer : ' + ct.name, 'warn');
  } catch(e) {
    toast('❌ ' + e.message, 'warn');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶'; }
  }
}

function renderCustomTools() {
  const wrap  = document.getElementById('cat-body-custom');
  const badge = document.getElementById('ct-count');
  if (badge) badge.textContent = (S.customTools || []).length;
  if (!wrap) return;

  if (!S.customTools || !S.customTools.length) {
    wrap.innerHTML = '<div class="sc-empty" style="width:100%">Aucun script — cliquez sur <strong>+ Script</strong>.</div>';
    return;
  }

  wrap.innerHTML = (S.customTools || []).map(ct => `
    <div class="sc-card">
      <div class="sc-ico"><span class="sc-ico-fallback">${escHtml(ct.ico || '⚙️')}</span></div>
      <div class="sc-name" title="${escHtml(ct.path || '')}">${escHtml(ct.name)}</div>
      <button class="btn sm prim sc-btn" id="ct-exec-${ct.id}" onclick="execCustomTool(${ct.id})" title="Lancer">▶</button>
      <button class="btn sm sc-btn" onclick="ctEdit(${ct.id})" title="Modifier">✏️</button>
      <button class="btn sm sc-btn sc-del" onclick="ctDelete(${ct.id})" title="Supprimer">✕</button>
    </div>`).join('');
}

// ══ OUTILS SYSTÈME ═══════════════════════════════════

function toggleCat(id) {
  // undefined ?? true : état initial = replié
  _catCollapsed[id] = !(_catCollapsed[id] ?? true);
  const body = document.getElementById('cat-body-' + id);
  const icon = document.getElementById('cat-icon-' + id);
  if (body) body.style.display = _catCollapsed[id] ? 'none' : 'grid';
  if (icon) icon.textContent   = _catCollapsed[id] ? '▸' : '▾';
}

function showResult(name, ok, output) {
  let modal = document.getElementById('tool-result-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'tool-result-modal';
    modal.className = 'overlay';
    modal.innerHTML = `
      <div class="modal" style="width:560px;max-width:92vw">
        <div class="modal-t" id="trm-title" style="--mc:var(--green)">Résultat</div>
        <pre id="trm-out" style="background:var(--bg);border:1px solid var(--bord);border-radius:8px;padding:12px 14px;font-family:var(--mono);font-size:11px;color:var(--dim2);overflow-x:auto;overflow-y:auto;max-height:300px;white-space:pre-wrap;line-height:1.6;margin:0"></pre>
        <div class="macts" style="margin-top:16px">
          <button class="btn sm prim" onclick="document.getElementById('tool-result-modal').classList.remove('on')">Fermer</button>
        </div>
      </div>`;
    modal.onclick = e => { if (e.target === modal) modal.classList.remove('on'); };
    document.body.appendChild(modal);
  }
  document.getElementById('trm-title').textContent = (ok ? '✅ ' : '❌ ') + name;
  document.getElementById('trm-title').style.setProperty('--mc', ok ? 'var(--green)' : 'var(--red)');
  document.getElementById('trm-out').textContent = output || (ok ? 'Commande executee.' : 'Erreur inconnue.');
  modal.classList.add('on');
}

async function execTool(ti) {
  const tool = TOOLS[ti];
  if (!tool) return;

  if (tool.name.includes('Debloat')) {
    const ok = confirm(
      '⚠️  AVERTISSEMENT — Debloat Windows\n\n' +
      'Ce script va :\n' +
      '  • Supprimer des applications préinstallées Windows\n' +
      '  • Modifier des paramètres système et de confidentialité\n' +
      '  • Cette opération est en partie irréversible\n\n' +
      'Recommandé : créer un point de restauration avant.\n\n' +
      'Voulez-vous vraiment continuer ?'
    );
    if (!ok) return;
  }

  const btn = document.getElementById('exec-btn-' + ti);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    const result = tool.admin
      ? await window.api.execAdmin(tool.cmd, tool.type)
      : await window.api.execCmd(tool.cmd, tool.type);
    showResult(tool.name, result.ok, result.out);
    if (result.ok) toast('✅ ' + tool.name);
    else           toast('❌ Erreur — voir résultat', 'warn');
  } catch(e) {
    showResult(tool.name, false, e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Exécuter'; }
  }
}

async function cpCmd(ti) {
  try {
    await navigator.clipboard.writeText(TOOLS[ti].cmd);
    const btn = document.getElementById('copy-btn-' + ti);
    if (btn) { btn.textContent = '✓'; setTimeout(() => btn.textContent = 'Copier', 2000); }
    toast('📋 Commande copiée !');
  } catch { toast('Erreur copie', 'warn'); }
}

// ── Render principal (Outils Système uniquement) ──────
function renderTools() {
  const container = document.getElementById('tools-grid');
  if (!container) return;
  container.innerHTML = '';

  const toolSec = document.createElement('div');
  toolSec.className = 'ts';

  TOOL_CATS.forEach(cat => {
    const tools = TOOLS.filter(t => cat.tags.includes(t.tag));
    if (!tools.length) return;
    const collapsed = _catCollapsed[cat.id] ?? true;

    const catEl = document.createElement('div');
    catEl.className = 'tool-cat';
    catEl.innerHTML = `
      <div class="tool-cat-hdr" data-tc="${cat.tc||''}" onclick="toggleCat('${cat.id}')">
        <span class="tool-cat-lbl">${escHtml(cat.label)}</span>
        <span class="tool-cat-badge">${tools.length}</span>
        <span class="tool-cat-arr" id="cat-icon-${cat.id}">${collapsed ? '▸' : '▾'}</span>
      </div>
      <div class="tools-inner-grid" id="cat-body-${cat.id}" style="${collapsed?'display:none':''}"></div>`;

    const grid = catEl.querySelector('#cat-body-' + cat.id);
    tools.forEach(t => {
      const ti   = TOOLS.indexOf(t);
      const card = document.createElement('div');
      card.className = 'tcard';
      if (t.tc) card.dataset.tc = t.tc;
      const toolIco = escHtml(t.ico);
      card.innerHTML = `
        <div class="tcard-hdr">
          <div class="tcard-ico ${t.tc||''}">${toolIco}</div>
          <div class="tcard-name">${escHtml(t.name)}</div>
          <span class="cmd-type ${t.type==='PS'?'ps':''}" style="flex-shrink:0">${escHtml(t.type)}</span>
          ${t.admin ? '<span title="Requiert Admin" style="font-size:11px;color:var(--orange);flex-shrink:0">🛡</span>' : ''}
        </div>
        <div class="tcard-body">
          <div class="tdesc">${escHtml(t.desc)}</div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button class="btn sm orange" style="flex:1;justify-content:center" id="exec-btn-${ti}" onclick="execTool(${ti})">▶ Exécuter${t.admin?' (Admin)':''}</button>
            <button class="btn sm" id="copy-btn-${ti}" onclick="cpCmd(${ti})" style="flex-shrink:0">Copier</button>
          </div>
        </div>`;
      grid.appendChild(card);
    });

    toolSec.appendChild(catEl);
  });

  container.appendChild(toolSec);
}

