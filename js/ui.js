const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function flattenTurnRows(groupedRounds) {
  const flattened = [];
  for (const gr of groupedRounds) {
    flattened.push({ isRoundHeader: true, round: gr.round, initiative: gr.initiative, resources: gr.resources });
    for (const row of gr.rows) {
      flattened.push(row);
    }
  }
  return flattened;
}

function calculateCurrentHp(initialAllies, initialEnemies, shownRows) {
  const hpMap = Object.create(null);
  for (const a of (initialAllies || [])) {
    const entry = { ...a, curHp: a.hp ?? a.maxHp, maxHp: a.maxHp, curShield: a.shield ?? 0 };
    if (a.id) hpMap[a.id] = entry;
    if (a.name) hpMap[a.name] = entry;
  }
  for (const e of (initialEnemies || [])) {
    const entry = { ...e, curHp: e.hp ?? e.maxHp, maxHp: e.maxHp, curShield: e.shield ?? 0 };
    if (e.id) hpMap[e.id] = entry;
    if (e.name) hpMap[e.name] = entry;
  }

  for (const row of shownRows) {
    if (row.shields) {
      for (const s of row.shields) {
        const target = hpMap[s.targetId] || hpMap[s.targetName];
        if (target) {
          target.curShield = (target.curShield || 0) + (s.amount || 0);
        }
      }
    }
    if (row.damages || row.reflects || row.reactions) {
      for (const d of [...(row.damages || []), ...(row.reflects || []), ...(row.reactions || [])]) {
        const target = hpMap[d.targetId] || hpMap[d.targetName];
        if (target) {
          if (d.absorbed) {
            target.curShield = Math.max(0, (target.curShield || 0) - (d.absorbed || 0));
          }
          if (d.shieldAfter !== undefined) {
            target.curShield = d.shieldAfter;
          }
          if (d.hpAfter !== undefined) target.curHp = d.hpAfter;
          else target.curHp = Math.max(0, target.curHp - (d.hpLoss ?? Math.max(0, (d.amount || 0) - (d.absorbed || 0))));
        }
      }
    }
    if (row.heals) {
      for (const h of row.heals) {
        const target = hpMap[h.targetId] || hpMap[h.targetName];
        if (target) {
          if (h.hpAfter !== undefined) target.curHp = h.hpAfter;
          else target.curHp = Math.min(target.maxHp, target.curHp + (h.amount || 0));
        }
      }
    }
    if (row.deaths) {
      for (const d of row.deaths) {
        const target = hpMap[d.targetId] || hpMap[d.targetName];
        if (target) { target.curHp = 0; target.curShield = 0; }
      }
    }
    if (row.revives) {
      for (const rv of row.revives) {
        const target = hpMap[rv.targetId] || hpMap[rv.targetName];
        if (target) { target.curHp = rv.hpAfter !== undefined ? rv.hpAfter : (rv.amount || 1); }
      }
    }
    if (row.type === 'death' && (row.targetId || row.targetName)) {
      const target = hpMap[row.targetId] || hpMap[row.targetName];
      if (target) { target.curHp = 0; target.curShield = 0; }
    }
    for (const resource of row.resources || []) {
      const target = hpMap[resource.id] || hpMap[resource.name] || {};
      Object.assign(target, resource);
      if (resource.hp !== undefined) target.curHp = resource.hp;
      if (resource.shield !== undefined) target.curShield = resource.shield;
      if (resource.id) hpMap[resource.id] = target;
      if (resource.name) hpMap[resource.name] = target;
    }
  }
  return hpMap;
}


// Game pathway keys sometimes differ from the existing artwork folders.
const COMBAT_SPRITE_PATHS = new Map([
  ['fool', 'fool'],
  ['door', 'door'],
  ['visionary', 'visionary'],
  ['sun', 'sun'],
  ['tyrant', 'tyrant'],
  ['demoness', 'demoness'],
  ['hermit', 'hermit'],
  ['wheel_of_fortune', 'wheel_of_fortune'],
  ['black_emperor', 'black_emperor'],
  ['abyss', 'abyss'],
  ['chained', 'chained'],
  ['justiciar', 'justiciar'],
  ['moon', 'moon'],
  ['mother', 'mother'],
  ['paragon', 'paragon'],
  ['white_tower', 'white_tower'],
  ['error', 'error'],
  ['hanged_man', 'hangedman'],
  ['darkness', 'darkness'],
  ['death', 'death'],
  ['twilight_giant', 'giant'],
  ['red_priest', 'redpriest']
]);

function prioritizeVisiblePartyPortraits() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  for (const image of document.querySelectorAll('.gm-arena-unit .combat-sprite-img, .campaign-agent .combat-sprite-img')) {
    const box = image.getBoundingClientRect();
    const rank = image.closest?.('.gm-rank-row');
    const bounds = rank?.getBoundingClientRect();
    const visible = box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
    if (visible && (!bounds || (box.right > bounds.left && box.left < bounds.right && box.bottom > bounds.top && box.top < bounds.bottom))) {
      image.loading = 'eager';
      image.fetchPriority = !rank || image.closest('.ally') ? 'high' : 'auto';
      if (image.dataset?.src) {
        image.src = image.dataset.src;
        delete image.dataset.src;
      }
    } else if (rank) {
      image.loading = 'lazy';
      image.fetchPriority = 'auto';
    }
  }
}

function getCombatSprite(u, options = {}) {
  const agent = (typeof state !== 'undefined' && state.roster)
    ? (state.roster.find(r => r.id === u.id || r.name === u.name) || u)
    : u;
  const path = u.path || agent.path || '';
  let seq = null;
  if (u.sequence !== undefined && u.sequence !== null) {
    seq = Number(u.sequence);
  } else if (agent && agent.sequence !== undefined && agent.sequence !== null) {
    seq = Number(agent.sequence);
  } else {
    const match = String(u.name || '').match(/Seq(?:uence)?\s*(\d+)/i);
    if (match) seq = parseInt(match[1], 10);
  }
  if (seq === null || isNaN(seq)) seq = 9;
  const spriteSeq = Math.max(0, Math.min(9, seq === 10 ? 9 : seq));
  const spritePath = COMBAT_SPRITE_PATHS.get(path) || 'fool';
  const assetBase = typeof window !== 'undefined' && window.G9_CHARACTER_ASSET_BASE || 'data/assets/characters/';

  const inForm = !!(u.inForm || u._inForm);
  const stem = inForm ? `${spritePath}_mythical` : `${spritePath}_seq${spriteSeq}`;
  const original = `${assetBase}${spritePath}/${stem}.png`;
  const legacy = inForm ? original : `${assetBase}${spritePath}/seq${spriteSeq}.png`;
  const variant = options.variant === 'battle' ? 'full' : ['portrait','dossier'].includes(options.variant) ? options.variant : inForm ? 'portrait' : 'full';
  const size = variant === 'dossier' ? 384 : 192;
  const assets = typeof G9_DATA !== 'undefined' ? G9_DATA.runtimeAssets?.entries : null;
  const art = assets?.[`data/assets/characters/${spritePath}/${stem}.png`]?.[variant];
  const canonical = `data/assets/characters/${spritePath}/${stem}.png`;
  const valid = art && (variant === 'full'
    ? Number.isInteger(art.width) && art.width > 0 && Number.isInteger(art.height) && art.height > 0 && typeof art.src === 'string' && art.src.startsWith(canonical + '?v=') && /^[a-f0-9]{16}$/.test(art.src.slice(canonical.length + 3))
    : art.width === size && art.height === size && new RegExp(`^data/assets/runtime/characters/${spritePath}/${stem}\\.${size}\\.[a-f0-9]{16}\\.(png|webp)$`).test(art.src));
  const src = valid ? art.src : original;
  const loading = options.loading === 'eager' ? 'eager' : 'lazy';
  const priority = loading === 'eager' && options.priority === 'high' ? ' fetchpriority="high"' : '';
  const hide = "this.onerror=null;this.style.display='none';const fb=this.parentElement.querySelector('.combat-sprite-fallback');if(fb)fb.style.display='flex';";
  const quoted = value => "'" + String(value).replace(/[\\'<>&"\r\n\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + "'";
  const legacyError = `this.onerror=()=>{${hide}};this.src=${quoted(legacy)};`;
  const onerror = valid ? `this.onerror=()=>{${legacyError}};this.src=${quoted(original)};` : legacyError;
  return `<img class="combat-sprite-img" ${options.variant === 'battle' ? 'data-src' : 'src'}="${esc(src)}" width="${valid ? art.width : size}" height="${valid ? art.height : size}" loading="${loading}" decoding="async"${priority} onerror="${onerror}" alt="${inForm ? 'Mythical Form' : `Seq ${spriteSeq}`}"><div class="combat-sprite-fallback" style="display:none">${esc((u.name||'?').slice(0,2).toUpperCase())}</div>`;
}
function battlefieldImageFor(quest = {}, isSim = false) {
  const config = typeof G9D !== 'undefined' ? G9D.contracts.battlefields || {} : {};
  const image = value => typeof value === 'string' ? value.trim() : '';
  if (isSim) return image(config.simulatorImage) || image(config.defaultImage);
  for (const key of [quest.battlefield, quest.target, quest.name]) {
    const match = image(config.encounters?.[key]);
    if (match) return match;
  }
  for (const key of [quest.environment, quest.lastSeen, ...(quest.tags || [])]) {
    const match = image(config.environments?.[key]);
    if (match) return match;
  }
  return image(config.defaultImage);
}

function battleResourceMarkup(data) {
  const m = data.meter;
  if (!m) return '';
  const pct = Math.min(100, Math.round(m.value / Math.max(1, m.max) * 100));
  return `<div class="gm-float-gauge meter ${m.value >= m.max ? 'ready' : ''}">
    <div class="gm-float-track"><div class="gm-float-fill meter" style="width:${pct}%"></div></div>
    <span class="gm-float-num">${abbrNum(m.value)}/${abbrNum(m.max)}</span>
  </div>`;
}

function renderCombatEntity(u, team, index, hpMap) {
    const data = (u.id && hpMap[u.id]) || (u.name && hpMap[u.name]) || u;
    const curHp = Math.max(0, data.curHp ?? u.hp ?? u.maxHp ?? 100);
    const maxHp = Math.max(1, data.maxHp || u.maxHp || 100);
    const shield = Math.max(0, data.curShield || 0);
    const hpPct = Math.min(100, Math.round((curHp / maxHp) * 100));
    const shieldPct = Math.min(100, Math.round((shield / maxHp) * 100));
    const dead = curHp <= 0 || data.alive === false || data.inCombat === false;

    const curMp = Math.max(0, data.sp ?? u.sp ?? 0);
    const maxMp = Math.max(1, data.maxSP ?? u.maxSP ?? 1);
    const mpPct = Math.min(100, Math.round((curMp / maxMp) * 100));

    const sprite = (team === 'ally' || u.path || u.campaignEnemy || data.inForm) ? getCombatSprite({ ...u, ...data }, { variant: 'battle' }) : `<div class="combat-enemy-avatar"><span class="enemy-skull">💀</span></div>`;

    return `<div class="gm-arena-unit ${team} ${dead ? 'dead' : ''} ${data.inForm ? 'mythical' : ''}" data-unit-index="${index}" data-unit-id="${esc(u.id || u.name)}" data-form-art="${!!data.inForm}">
      <div class="gm-unit-sprite-anchor">
        <div class="gm-unit-shadow"></div>
        <div class="gm-unit-sprite">${sprite}</div>
      </div>
      <div class="gm-unit-info">
        <div class="gm-unit-name-label" title="${esc(u.name)}">
          <span class="unit-name">${esc(String(u.name || '').replace(/\s*Seq(?:uence)?\s*\d+/i, ''))}</span>
        </div>
        <!-- Floating HP Bar -->
        <div class="gm-float-gauge hp">
          <div class="gm-float-track">
            <div class="gm-float-fill hp" style="width:${hpPct}%"></div>
            <div class="gm-float-fill shield" style="width:${shieldPct}%;${shieldPct > 0 ? '' : 'display:none'}"></div>
          </div>
          <span class="gm-float-num gm-hp-num">${abbrNum(curHp)}/${abbrNum(maxHp)}</span>
          <span class="gm-float-num gm-shield-num" ${shield > 0 ? '' : 'hidden'}>${abbrNum(shield)} Shield</span>
        </div>
        <div class="gm-float-gauge mp">
          <div class="gm-float-track">
            <div class="gm-float-fill mp" style="width:${mpPct}%"></div>
          </div>
          <span class="gm-float-num">${abbrNum(curMp)}/${abbrNum(maxMp)}</span>
        </div>
        <div class="gm-unit-resources">${battleResourceMarkup(data)}</div>
      </div>
    </div>`;
}

function renderHpStrip(hpMap, allies, enemies, battlefieldImage = '') {
  return `<div class="gm-dungeon-arena" aria-label="Guild Master Dungeon Arena">
    <div class="gm-dungeon-backdrop" aria-hidden="true">
      ${battlefieldImage ? `<img class="gm-battlefield-image" src="${esc(battlefieldImage)}" alt="" onerror="this.hidden=true">` : ''}
    </div>

    <!-- Arena Stage Playfield -->
    <div class="gm-stage-playfield">
      <!-- Enemy formation (opposite / back row) -->
      <div class="gm-rank-row gm-rank-enemies">
        ${(enemies || []).map((e, i) => renderCombatEntity(e, 'enemy', i, hpMap)).join('')}
      </div>

      <!-- Mid-room distance spacer -->
      <div class="gm-arena-midline"></div>

      <!-- Ally Beyonders party (foreground / bottom row) -->
      <div class="gm-rank-row gm-rank-allies">
        ${(allies || []).map((a, i) => renderCombatEntity(a, 'ally', i, hpMap)).join('')}
      </div>
    </div>
  </div>`;
}

function renderTurnRowHtml(row, showDetails) {
  if (row.isRoundHeader) {
    return `<div class="battle-round-title">
      <span class="round-badge">── Round ${row.round} ──</span>
      ${showDetails && row.initiative ? `<span class="round-init">Init: ${esc(row.initiative)}</span>` : ''}
    </div>`;
  }

  if (row.isSkip) {
    return `<div class="b-row skip-row ${row.actorTeam}-turn">
      <span class="b-actor ${row.actorTeam}">${esc(row.actorName)}</span>
      <span class="muted">${esc(row.text || 'loses action to status')}</span>
    </div>`;
  }

  if (row.isMiss) {
    return `<div class="b-row ${row.actorTeam}-turn">
      <span class="b-actor ${row.actorTeam}">${esc(row.actorName)}</span>
      <span class="b-arrow">→</span>
      <span class="b-target ${row.targetTeam || 'enemy'}">${esc(row.targetName || 'Enemy')}</span>
      <span class="b-outcome miss">💨 ${esc(row.text || 'Missed')}</span>
    </div>`;
  }

  if (row.type === 'thread' || row.type === 'status') {
    const isTh = row.type === 'thread';
    let extra = '';
    if (showDetails) {
      if (row.curVal !== undefined && row.maxVal !== undefined && row.stat) {
        extra = ` (${row.stat} ${abbrNum(row.curVal)}/${abbrNum(row.maxVal)})`;
      } else if (row.subtype === 'freeze' || row.isFreeze || (row.text && row.text.includes('afflicted with freeze'))) {
        if (!row.text.includes('DEF') && !row.text.includes('SPEED')) {
          extra = ` (- 10% DEF/ 20% SPEED)`;
        }
      }
    }
    return `<div class="b-row ${isTh ? 'b-subline thread' : 'b-subline status'}">
      <span>${isTh ? '🧵' : '⏳'} ${esc(row.text)}${extra}</span>
    </div>`;
  }

  if (row.type === 'death') {
    return `<div class="b-row death-row">
      <span>${row.converted?'🧵':'💀'} <b>${esc(row.targetName || 'Unit')}</b> ${row.converted?'is converted into a Marionette.':'falls.'}</span>
    </div>`;
  }

  if (row.type === 'story' || row.type === 'system') {
    return `<div class="b-row" style="color:var(--muted);font-style:italic">
      <span>${esc(row.text)}</span>
    </div>`;
  }

  if (row.type === 'result') {
    return `<div class="b-row" style="font-weight:bold;color:${row.success ? 'var(--green)' : 'var(--red)'}">
      <span>${esc(row.text)}</span>
    </div>`;
  }

  // Merged action row (tree style)
  const actorClass = row.actorTeam || 'ally';
  const damagesHtml = [...(row.damages || []), ...(row.reflects || []), ...(row.reactions || [])].map(d => {
    const isReaction = (row.reactions || []).includes(d);
    const targetClass = d.targetTeam || ((d.actorTeam || actorClass) === 'ally' ? 'enemy' : 'ally');
    const hpLoss = d.hpLoss ?? Math.max(0, (d.amount || 0) - (d.absorbed || 0));
    const exact = Number(hpLoss).toLocaleString();
    const badges = [
      d.critical ? '<span class="b-badge crit" title="Critical Hit">💥 CRIT</span>' : '',
      d.trueDamage ? '<span class="b-badge true-dmg" title="True Damage">⚡ TRUE</span>' : '',
      d.instantKill ? '<span class="b-badge execute" title="Execute">☠️ EXECUTE</span>' : '',
      d.isReflect ? '<span class="b-badge reflect" style="background:#5e35b1;color:#fff">🔄 REFLECT</span>' : '',
      d.isDrain ? '<span class="b-badge drain" style="background:#4a1259;color:#f3d7ff">🩸 DRAIN</span>' : ''
    ].filter(Boolean).join(' ');

    const hpDetail = (showDetails && d.hpAfter !== undefined && d.maxHp) ? ` (HP ${abbrNum(d.hpAfter)}/${abbrNum(d.maxHp)})` : '';
    return `<div class="b-sub-outcome">
      <span class="b-tree-branch">↳</span>
      ${isReaction ? `<span class="b-badge">Reaction · ${esc(d.actorName || 'Unit')}</span>` : ''}
      <span class="b-arrow">→</span>
      <span class="b-target ${targetClass}">${esc(d.targetName || 'Target')}</span>
      <span class="b-outcome damage" title="HP loss: ${exact}">−${abbrNum(hpLoss)} HP <small>${esc(d.damageType || 'dmg')}</small>${hpDetail}</span>
      ${d.absorbed ? `<span class="b-outcome shield">−${abbrNum(d.absorbed)} Shield</span>` : ''}
      ${badges}
    </div>`;
  }).join('');

  const healsHtml = (row.heals || []).map(h => {
    return `<div class="b-sub-outcome">
      <span class="b-tree-branch">↳</span>
      ${h.actorId && h.actorId !== row.actorId ? `<span class="b-badge">Recovery · ${esc(h.actorName || 'Unit')}</span>` : ''}
      <span class="b-arrow">→</span>
      <span class="b-target ${h.targetTeam || actorClass}">${esc(h.targetName || 'Target')}</span>
      <span class="b-outcome heal" title="Recovered ${h.amount} HP">+${abbrNum(h.amount)} HP</span>
    </div>`;
  }).join('');

  const shieldsHtml = (row.shields || []).map(s => {
    return `<div class="b-sub-outcome">
      <span class="b-tree-branch">↳</span>
      ${s.actorId && s.actorId !== row.actorId ? `<span class="b-badge">Shield · ${esc(s.actorName || 'Unit')}</span>` : ''}
      <span class="b-arrow">→</span>
      <span class="b-target ${s.targetTeam || actorClass}">${esc(s.targetName || 'Target')}</span>
      <span class="b-outcome shield" title="Gained ${s.amount} shield">🛡️ +${abbrNum(s.amount)} Shield</span>
    </div>`;
  }).join('');

  const detailsHtml = showDetails && (row.costSP !== undefined || row.cooldown !== undefined)
    ? `<span class="b-details-info">[Cost: ${row.costSP || 0} SP | ${row.cooldown || 0} CD]</span>`
    : '';

  const subrows = (row.subrows || []).filter(s => s.type !== 'reaction' || !(row.reactions || []).length);
  const sublinesHtml = subrows.length
    ? `<div class="b-sublines">${subrows.map(s => {
        let extra = '';
        if (showDetails) {
          if (s.curVal !== undefined && s.maxVal !== undefined && s.stat) {
            extra = ` (${s.stat} ${abbrNum(s.curVal)}/${abbrNum(s.maxVal)})`;
          } else if (s.subtype === 'freeze' || s.isFreeze || (s.text && s.text.includes('afflicted with freeze'))) {
            if (!s.text.includes('DEF') && !s.text.includes('SPEED')) {
              extra = ` (- 10% DEF/ 20% SPEED)`;
            }
          }
        }
        return `<span class="b-subline ${s.type==='thread'?'thread':'status'}">${s.type==='thread'?'🧵':s.type==='mythical'?'✨':s.type==='reflect'?'↩️':'•'} ${esc(s.text)}${extra}</span>`;
      }).join('')}</div>`
    : '';

  const deathsHtml = (row.deaths && row.deaths.length)
    ? row.deaths.map(d => `<div class="b-sublines"><span class="b-subline" style="color:#ff8b8b;font-weight:600">${d.converted?'🧵':'💀'} ${esc(d.targetName)} ${d.converted?'is converted into a Marionette.':'falls.'}</span></div>`).join('')
    : '';

  const hasOutcomes = !!(damagesHtml || healsHtml || shieldsHtml);

  return `<div class="b-row ${actorClass}-turn">
    <div class="b-turn-header">
      <span class="b-actor ${actorClass}">${esc(row.actorName)}</span>
      <span class="b-ability">· ${esc(row.ability)}</span>
      ${detailsHtml}
    </div>
    ${hasOutcomes ? `<div class="b-outcomes-block">${damagesHtml}${healsHtml}${shieldsHtml}</div>` : ''}
    ${sublinesHtml}
    ${deathsHtml}
  </div>`;
}

function battleOutcomeLabel(outcome, success, isSim = false) {
  if (outcome === 'timeout') return isSim ? 'Draw · Round limit reached' : 'Round limit reached · Contract incomplete';
  if (outcome === 'mutual_defeat') return 'Neither side survived';
  return isSim ? (success ? 'Team A Victory' : 'Team B Victory') : (success ? 'Victory' : 'Defeat');
}

function renderBattleLogComponent({
  allies,
  enemies,
  flattenedRows,
  shownCount,
  isDone,
  showDetails,
  speed,
  summaryText,
  success = false,
  outcome,
  isSim,
  paused = false,
  battlefieldImage = ''
}) {
  const visible = flattenedRows.slice(0, shownCount);
  const hpMap = calculateCurrentHp(allies, enemies, visible);

  // Keep earlier turns in place so incoming events cannot collapse the text being read.
  const contentHtml = visible.map(r => renderTurnRowHtml(r, showDetails)).join('');

  return `<div class="battle-log-wrap" role="log" aria-live="polite" data-shown-count="${visible.length}" data-details="${!!showDetails}">
    <div class="battle-toolbar">
      <div class="speed-controls">
        <button type="button" data-pause ${isDone ? 'disabled' : ''} aria-pressed="${paused}" onclick="window.G9.toggleTickerPause()">${paused ? 'Resume' : 'Pause'}</button>
        <button type="button" data-step ${isDone ? 'disabled' : ''} onclick="window.G9.stepTicker()">Step</button>
        <button type="button" data-speed="0.5" class="${speed===.5?'active':''}" onclick="window.G9.setTickerSpeed(.5)">Read</button>
        <button type="button" data-speed="1" class="${speed===1?'active':''}" onclick="window.G9.setTickerSpeed(1)">1x</button>
        <button type="button" data-speed="2" class="${speed===2?'active':''}" onclick="window.G9.setTickerSpeed(2)">2x</button>
        <button type="button" data-speed="4" class="${speed===4?'active':''}" onclick="window.G9.setTickerSpeed(4)">4x</button>
        <button type="button" data-skip ${isDone ? 'hidden' : ''} onclick="window.G9.skipTicker(${isSim})">Skip</button>
      </div>
      <div>
        <button type="button" data-details class="${showDetails?'active':''}" onclick="${isSim ? 'window.G9.toggleSimDetails()' : 'window.G9.toggleDetails()'}">
          ${showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
    </div>
    ${renderHpStrip(hpMap, allies, enemies, battlefieldImage)}
    <div class="battle-ticker-viewport" id="${isSim ? 'sim-viewport' : 'battle-viewport'}">
      ${contentHtml}
      ${!isDone ? `<div class="typing" style="padding:6px 8px;font-style:italic;color:var(--muted)">${paused ? 'Paused · Step to read the next action.' : 'Battling…'}</div>` : ''}
    </div>
    <div class="b-result-box ${success ? 'victory' : 'failure'}" ${isDone && summaryText ? '' : 'hidden'}>
      <h4>Encounter Summary · ${battleOutcomeLabel(outcome, success, isSim)}</h4>
      <p>${esc(summaryText)}</p>
    </div>
  </div>`;
}

function updateBattleLogComponent(wrap, props) {
  const visible = props.flattenedRows.slice(0, props.shownCount);
  const hpMap = calculateCurrentHp(props.allies, props.enemies, visible);
  const viewport = wrap.querySelector('.battle-ticker-viewport');
  const follow = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 35;
  const top = viewport.scrollTop, left = viewport.scrollLeft;
  for (const [team, units] of [['ally', props.allies], ['enemy', props.enemies]]) {
    const rank = wrap.querySelector(team === 'ally' ? '.gm-rank-allies' : '.gm-rank-enemies');
    const present = new Set(Array.from(rank.querySelectorAll('.gm-arena-unit'), node => node.dataset.unitId));
    for (const data of new Set(Object.values(hpMap))) {
      if (data.team === team && data.id && !present.has(data.id)) {
        rank.insertAdjacentHTML('beforeend', renderCombatEntity(data, team, units.length, hpMap));
        present.add(data.id);
      }
    }
    for (const node of wrap.querySelectorAll(`.gm-arena-unit.${team}`)) {
      const u = units.find(unit => (unit.id || unit.name) === node.dataset.unitId) || hpMap[node.dataset.unitId] || units[Number(node.dataset.unitIndex)];
      if (!u) continue;
      const data = hpMap[u.id] || hpMap[u.name] || u;
      const hp = Math.max(0, data.curHp ?? u.hp ?? u.maxHp ?? 100);
      const maxHp = Math.max(1, data.maxHp || u.maxHp || 100);
      const shieldPct = Math.min(100, Math.round((data.curShield || 0) / maxHp * 100));
      node.classList.toggle('dead', hp <= 0 || data.alive === false || data.inCombat === false);
      node.querySelector('.gm-float-fill.hp').style.width = `${Math.min(100, Math.round(hp / maxHp * 100))}%`;
      node.querySelector('.gm-hp-num').textContent = `${abbrNum(hp)}/${abbrNum(maxHp)}`;
      const shield = node.querySelector('.gm-float-fill.shield');
      shield.style.width = `${shieldPct}%`; shield.style.display = shieldPct ? '' : 'none';
      const shieldNum = node.querySelector('.gm-shield-num');
      shieldNum.textContent = `${abbrNum(data.curShield || 0)} Shield`;
      shieldNum.hidden = !(data.curShield > 0);
      const mpGauge = node.querySelector('.gm-float-gauge.mp');
      if (mpGauge) {
        const mp = Math.max(0, data.sp ?? u.sp ?? 0), maxMp = Math.max(1, data.maxSP ?? u.maxSP ?? 1);
        mpGauge.querySelector('.gm-float-fill.mp').style.width = `${Math.min(100, Math.round(mp / maxMp * 100))}%`;
        mpGauge.querySelector('.gm-float-num').textContent = `${abbrNum(mp)}/${abbrNum(maxMp)}`;
      }
      const resources = node.querySelector('.gm-unit-resources'), markup = battleResourceMarkup(data);
      if (resources.innerHTML !== markup) resources.innerHTML = markup;
      node.classList.toggle('mythical', !!data.inForm);
      if (node.dataset.formArt !== String(!!data.inForm)) {
        const holder = document.createElement('div');
        holder.innerHTML = getCombatSprite({ ...u, ...data }, { variant: 'battle' });
        const next = holder.querySelector('img'), image = node.querySelector('.combat-sprite-img');
        if (image) {
          for (const attribute of ['src', 'data-src', 'width', 'height', 'alt', 'onerror']) {
            const value = next.getAttribute(attribute);
            if (value === null) image.removeAttribute(attribute);
            else image.setAttribute(attribute, value);
          }
          image.style.display = '';
          const fallback = node.querySelector('.combat-sprite-fallback'); if (fallback) fallback.style.display = 'none';
        } else node.querySelector('.gm-unit-sprite').innerHTML = holder.innerHTML;
        node.dataset.formArt = !!data.inForm;
      }
    }
  }
  const previousCount = Number(wrap.dataset.shownCount) || 0;
  const detailsChanged = wrap.dataset.details !== String(!!props.showDetails);
  const typing = viewport.querySelector('.typing');
  if (detailsChanged || visible.length < previousCount) {
    viewport.innerHTML = visible.map(row => renderTurnRowHtml(row, props.showDetails)).join('');
  } else {
    if (typing) typing.remove();
    viewport.insertAdjacentHTML('beforeend', visible.slice(previousCount).map(row => renderTurnRowHtml(row, props.showDetails)).join(''));
  }
  if (!props.isDone && typing) viewport.append(typing);
  if (typing) typing.textContent = props.paused ? 'Paused · Step to read the next action.' : 'Battling…';
  wrap.dataset.shownCount = visible.length;
  wrap.dataset.details = !!props.showDetails;
  for (const button of wrap.querySelectorAll('[data-speed]')) button.classList.toggle('active', Number(button.dataset.speed) === props.speed);
  wrap.querySelector('[data-skip]').hidden = props.isDone;
  const pause = wrap.querySelector('[data-pause]');
  pause.disabled = props.isDone; pause.textContent = props.paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', !!props.paused);
  wrap.querySelector('[data-step]').disabled = props.isDone;
  const details = wrap.querySelector('button[data-details]');
  details.classList.toggle('active', !!props.showDetails);
  details.textContent = props.showDetails ? 'Hide Details' : 'Show Details';
  const summary = wrap.querySelector('.b-result-box');
  summary.hidden = !props.isDone || !props.summaryText;
  summary.classList.toggle('victory', !!props.success); summary.classList.toggle('failure', !props.success);
  summary.querySelector('h4').textContent = `Encounter Summary · ${battleOutcomeLabel(props.outcome, props.success, props.isSim)}`;
  summary.querySelector('p').textContent = props.summaryText;
  const backdrop = wrap.querySelector('.gm-dungeon-backdrop');
  const image = backdrop.querySelector('img');
  if (!props.battlefieldImage) image?.remove();
  else if (!image || image.getAttribute('src') !== props.battlefieldImage) {
    backdrop.innerHTML = `<img class="gm-battlefield-image" src="${esc(props.battlefieldImage)}" alt="" onerror="this.hidden=true">`;
  }
  viewport.scrollTop = follow ? viewport.scrollHeight : top;
  viewport.scrollLeft = left;
}

// ===== Browser UI =====
if (typeof document !== 'undefined') (() => {
  'use strict';
  let state=loadGame()||newGame(), tab='hall', selected=null, previewPath=PATH_KEYS[0], planning=null, run=null, notice='', tickerTimer=null, tickerSpeed=1, showBattleDetails=false, simBattleDetails=false, simMode='1v1', simA=[{path:PATH_KEYS[0],sequence:9},{path:PATH_KEYS[0],sequence:9}], simB=[{path:PATH_KEYS[1]||PATH_KEYS[0],sequence:9},{path:PATH_KEYS[1]||PATH_KEYS[0],sequence:9}], simResult=null;
  const app=document.getElementById('app');
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pathName=p=>pathOf(p).name;
  const tierName=(p,s)=>tierFor(p,s).name;
  const activeRoster=()=>state.roster.filter(a=>a.status==='active');
  const combatReady=()=>activeRoster().filter(a=>a.awakened&&a.sequence<=9);
  let chapterAgentIds=[], chapterChoice=null, chapterSelectionMission=null, chapterSelectionInitialized=false;
  let dossierSkillType='active', dossierSkillSequence=null, dossierReturnFocus=null;
  let portraitViewer=null;
  campaignEnsure(state);
  tab=campaignStatus(state).complete?'hall':'campaign';
  function chapterCommit(fn){
    const draft=clone(state), outcome=fn(draft);
    if(!outcome.ok){toast(outcome.reason);return null;}
    if(!saveGame(draft)){toast('The chapter could not be saved. Free browser storage and try again.');return null;}
    state=draft;return outcome;
  }
  function chapterBlocked(){
    if(!state.campaign?.pending)return false;
    toast('Record the saved chapter outcome before changing the guild or starting another mission.');return true;
  }
  function commit(fn){const draft=clone(state);fn(draft);state=draft;saveGame(draft);render();}
  function toast(msg){notice=msg;render();setTimeout(()=>{if(notice===msg){notice='';render()}},2400)}
  function render(){
    if(portraitViewer)closePortrait();
    clearTimeout(tickerTimer); tickerTimer = null;
    const pagePosition = { x: window.scrollX, y: window.scrollY };
    const scrollPositions = Array.from(app.querySelectorAll('.quest-modal, .battle-ticker-viewport')).map(el => ({
      selector: el.id ? `#${el.id}` : '.quest-modal',
      top: el.scrollTop,
      left: el.scrollLeft,
      follow: el.classList.contains('battle-ticker-viewport') && el.scrollHeight - el.scrollTop - el.clientHeight <= 35
    }));
    const active=activeRoster();
    app.innerHTML=`<header class="top"><div><div class="eyebrow">LEDGER OF THE GUILD</div><h1>Guild of Mystery</h1><p>Day ${state.day} · Reputation ${state.reputation}</p></div><div class="brand-mark">XXII</div></header>
    <section class="resources"><div><span>FUNDS</span><b>£${state.funds.toLocaleString()}</b></div><div><span>REPUTATION</span><b>${state.reputation}</b></div><div><span>CONTRACTS</span><b>${state.quests.length}</b></div></section>
    <nav class="tabs" aria-label="Guild sections">${[['hall','Guild Hall'],['campaign','Campaign'],['preview','Pathways'],['simulator','Battle Simulator'],['recruit','Recruitment'],['quests','Contracts'],['wanted','Wanted'],['inventory','Inventory'],['chronicle','Chronicle']].map(([id,label])=>`<button class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''} onclick="window.G9.tab('${id}')">${label}</button>`).join('')}</nav>
    <main>${tab==='hall'?hall():tab==='campaign'?campaignPage():tab==='preview'?pathwayPreview():tab==='simulator'?battleSimulator():tab==='recruit'?recruit():tab==='quests'?quests():tab==='wanted'?wanted():tab==='inventory'?inventory():chronicleView()}</main>
    ${selected?dossier():''}${planning?assignmentModal():''}${run?runModal():''}${notice?`<div class="toast">${esc(notice)}</div>`:''}`;
    for (const position of scrollPositions) {
      const el = app.querySelector(position.selector);
      if (!el) continue;
      el.scrollTop = position.follow ? el.scrollHeight : position.top;
      el.scrollLeft = position.left;
    }
    window.scrollTo(pagePosition.x, pagePosition.y);
    if (typeof prioritizeVisiblePartyPortraits === 'function') prioritizeVisiblePartyPortraits();
    scheduleTicker();
  }
  function closePortrait(){
    if(!portraitViewer)return;
    const viewer=portraitViewer;portraitViewer=null;
    window.removeEventListener('resize',viewer.resize);
    viewer.dialog.remove();app.inert=viewer.inert;document.body.style.overflow=viewer.overflow;
    if(viewer.opener.isConnected)viewer.opener.focus({preventScroll:true});
  }
  function openPortrait(opener){
    if(portraitViewer||!opener?.querySelector)return;
    const source=opener.querySelector('img');if(!source)return;
    const url=new URL(source.currentSrc||source.src,document.baseURI),base=new URL('./',document.baseURI);
    const relative=url.pathname.startsWith(base.pathname)?url.pathname.slice(base.pathname.length):'';
    if(url.origin!==base.origin||!/^data\/assets\/characters\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*_seq[0-9]\.png$/.test(relative)||url.hash||url.search&&!/^\?v=[a-f0-9]{16}$/.test(url.search))return;
    const dialog=document.createElement('section');dialog.className='portrait-viewer';
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Full-resolution character portrait');
    dialog.innerHTML=`<div class="portrait-viewer-dialog"><div class="portrait-viewer-toolbar"><button type="button" aria-label="Close portrait" onclick="window.G9.closePortrait()">Close</button><button type="button" aria-label="Fit image">Fit</button><button type="button" aria-label="Actual size">100%</button><button type="button" aria-label="Zoom out">−</button><output class="portrait-viewer-percent"></output><button type="button" aria-label="Zoom in">+</button><input type="range" aria-label="Zoom" max="200" step="1"></div><p class="portrait-viewer-error" role="status" hidden>The original image could not be loaded.</p><div class="portrait-viewer-canvas" tabindex="0" aria-label="Drag to move; pinch to zoom"><img class="portrait-viewer-image" src="${esc(url.href)}" width="${source.width}" height="${source.height}" decoding="async" draggable="false" alt="${esc(source.alt)}"></div></div>`;
    document.body.append(dialog);
    const canvas=dialog.querySelector('.portrait-viewer-canvas'),image=dialog.querySelector('img'),range=dialog.querySelector('input'),output=dialog.querySelector('output');
    const viewer={dialog,opener,inert:app.inert,overflow:document.body.style.overflow,scale:1,min:0.01,width:Number(source.getAttribute('width'))||1,height:Number(source.getAttribute('height'))||1};
    portraitViewer=viewer;app.inert=true;document.body.style.overflow='hidden';
    const zoom=(scale,point)=>{
      if(!Number.isFinite(scale))return;
      const box=canvas.getBoundingClientRect(),x=point?point.x-box.left:canvas.clientWidth/2,y=point?point.y-box.top:canvas.clientHeight/2;
      const worldX=(canvas.scrollLeft+x-image.offsetLeft)/viewer.scale,worldY=(canvas.scrollTop+y-image.offsetTop)/viewer.scale;
      viewer.scale=Math.min(2,Math.max(viewer.min,scale));
      image.style.width=`${viewer.width*viewer.scale}px`;image.style.height=`${viewer.height*viewer.scale}px`;
      canvas.scrollLeft=worldX*viewer.scale+image.offsetLeft-x;canvas.scrollTop=worldY*viewer.scale+image.offsetTop-y;
      range.value=String(viewer.scale*100);output.textContent=`${Math.round(viewer.scale*100)}%`;
    };
    viewer.zoom=zoom;
    viewer.resize=()=>{
      const fitting=Math.abs(viewer.scale-viewer.min)<0.001;
      viewer.min=Math.min(1,(canvas.clientWidth||1)/viewer.width,(canvas.clientHeight||1)/viewer.height);
      range.min=String(viewer.min*100);zoom(fitting?viewer.min:viewer.scale);
    };
    viewer.resize();zoom(viewer.min);
    image.onload=()=>{viewer.width=image.naturalWidth;viewer.height=image.naturalHeight;viewer.resize();};
    image.onerror=()=>{dialog.querySelector('.portrait-viewer-error').hidden=false;};
    dialog.querySelector('[aria-label="Fit image"]').onclick=()=>zoom(viewer.min);
    dialog.querySelector('[aria-label="Actual size"]').onclick=()=>zoom(1);
    dialog.querySelector('[aria-label="Zoom out"]').onclick=()=>zoom(viewer.scale-0.1);
    dialog.querySelector('[aria-label="Zoom in"]').onclick=()=>zoom(viewer.scale+0.1);
    range.oninput=()=>zoom(Number(range.value)/100);
    const pointers=new Map();let pinch=null;
    const distance=()=>{const [a,b]=Array.from(pointers.values());return Math.hypot(a.x-b.x,a.y-b.y);};
    canvas.addEventListener('pointerdown',event=>{
      event.preventDefault();canvas.focus({preventScroll:true});pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture?.(event.pointerId);
      if(pointers.size===2)pinch={distance:distance(),scale:viewer.scale};
    });
    canvas.addEventListener('pointermove',event=>{
      const previous=pointers.get(event.pointerId);if(!previous)return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===2&&pinch?.distance){const [a,b]=Array.from(pointers.values());zoom(pinch.scale*distance()/pinch.distance,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});}
      else if(pointers.size===1){canvas.scrollLeft+=previous.x-event.clientX;canvas.scrollTop+=previous.y-event.clientY;}
    });
    const release=event=>{pointers.delete(event.pointerId);pinch=null;};
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
    canvas.addEventListener('wheel',event=>{if(event.ctrlKey){event.preventDefault();zoom(viewer.scale*(event.deltaY>0?0.9:1.1),{x:event.clientX,y:event.clientY});}},{passive:false});
    window.addEventListener('resize',viewer.resize);
    dialog.querySelector('button').focus({preventScroll:true});
  }
  function scheduleTicker() {
    const playing = run || (tab === 'simulator' ? simResult : null);
    if (playing && !playing.paused && playing.currentTurn < playing.turnRows.length && !tickerTimer) {
      const delay = tickerSpeed === .5 ? 1600 : tickerSpeed === 4 ? 100 : (tickerSpeed === 2 ? 250 : 500);
      const timer = setTimeout(() => {
        if (tickerTimer !== timer) return;
        tickerTimer = null;
        const current = run || (tab === 'simulator' ? simResult : null);
        if (current !== playing) return;
        playing.currentTurn++;
        refreshBattle();
      }, delay);
      tickerTimer = timer;
    }
  }
  function refreshBattle() {
    const playing = run || (tab === 'simulator' ? simResult : null);
    const isSim = !run;
    const viewport = app.querySelector(isSim ? '#sim-viewport' : '#battle-viewport');
    if (!playing || !viewport) { render(); return; }
    const summary = isSim ? playing.summaryText : summarizeBattleEvents(playing.result.events || [], playing.result.battleSnapshot).summaryText;
    const isDone = playing.currentTurn >= playing.turnRows.length;
    updateBattleLogComponent(viewport.closest('.battle-log-wrap'), {
      allies: isSim ? playing.teamA : playing.initialAllies,
      enemies: isSim ? playing.teamB : playing.initialEnemies,
      flattenedRows: playing.turnRows, shownCount: playing.currentTurn, isDone,
      showDetails: isSim ? simBattleDetails : showBattleDetails, speed: tickerSpeed, paused: !!playing.paused,
      summaryText: playing.isCampaign ? summary.replace(/Casualties/g, 'Agents recovered') : summary,
      success: isSim ? playing.success : playing.result.success,
      outcome: isSim ? playing.battleOutcome : playing.result.battleOutcome || playing.result.battleSnapshot?.outcome,
      isSim,
      battlefieldImage: battlefieldImageFor(isSim ? {} : playing.quest, isSim)
    });
    const completion = app.querySelector('.battle-completion');
    if (!isSim && completion) completion.hidden = !isDone;
    if (typeof prioritizeVisiblePartyPortraits === 'function') prioritizeVisiblePartyPortraits();
    scheduleTicker();
  }

  function campaignRewardMarkup(rewards){
    return `<div class="campaign-rewards">${rewards.funds?`<span>£${rewards.funds}</span>`:''}${rewards.reputation?`<span>+${rewards.reputation} reputation</span>`:''}${rewards.digestion?`<span>+${rewards.digestion}% digestion per participant</span>`:''}${rewards.materialPerPath?`<span>+${rewards.materialPerPath} material per participating pathway</span>`:''}</div>`;
  }
  function campaignRunFromPending(p){
    const turnRows=flattenTurnRows(groupEventsToRows(p.result.events||[]));
    return {quest:p.quest,result:p.result,initialAllies:p.initialAllies,initialEnemies:p.initialEnemies.map(e=>({...e,campaignEnemy:true})),turnRows,currentTurn:p.kind==='combat'?0:turnRows.length,isSolo:false,isCampaign:true,kind:p.kind,missionTitle:p.missionTitle};
  }
  function campaignNarrativeModal(){
    return `<div class="overlay"><article class="modal campaign-outcome success" role="dialog" aria-modal="true" aria-label="Chapter outcome"><div class="campaign-kicker">CHAPTER I · CASE NOTES</div><h2>${esc(run.missionTitle)}</h2>${run.result.lines.map(line=>`<p>${esc(line.text)}</p>`).join('')}${campaignRewardMarkup(CAMPAIGN.missions.find(m=>m.title===run.missionTitle).rewards)}<button class="primary full" onclick="window.G9.closeQuest()">Record outcome & continue</button></article></div>`;
  }
  function campaignHallCard(){
    const st=campaignStatus(state);
    return `<section class="campaign-hall-card"><div class="campaign-hall-copy"><div class="campaign-kicker">CHAPTER I · ${st.complete?'CASE CLOSED':'STORY CAMPAIGN'}</div><h2>${esc(CAMPAIGN.title)}</h2><p>${st.complete?'The district is safe. Your completed case remains in the guild ledger.':`${st.completedCount}/5 missions complete · ${esc(st.current.title)}`}</p></div><button onclick="window.G9.tab('campaign')">${st.complete?'View case file':'Continue chapter'}</button></section>`;
  }
  function campaignPage(){
    const st=campaignStatus(state),m=st.current;
    if(m&&chapterSelectionMission!==m.id){chapterSelectionMission=m.id;chapterChoice=null;chapterSelectionInitialized=false;}
    if(!chapterSelectionInitialized&&st.eligibleAgents.length){chapterAgentIds=st.eligibleAgents.slice(0,1).map(a=>a.id);chapterSelectionInitialized=true;}
    chapterAgentIds=chapterAgentIds.filter(id=>st.eligibleAgents.some(a=>a.id===id));
    const head=`<section class="campaign-page"><header class="campaign-hero"><p class="campaign-kicker">${esc(CAMPAIGN.subtitle)}</p><h2 class="campaign-title">${esc(CAMPAIGN.title)}</h2><p class="campaign-description">${esc(CAMPAIGN.intro)}</p></header><div class="campaign-progress"><div class="campaign-track" role="progressbar" aria-label="Chapter progress" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${st.completedCount}"><span style="width:${st.completedCount*20}%"></span></div><span class="campaign-progress-text">${st.completedCount} of 5 missions complete</span></div><div class="campaign-map" aria-label="Chapter missions">${st.missions.map(x=>`<div class="campaign-node ${x.completed?'is-complete':x.current?'is-current':'is-locked'}" ${x.current?'aria-current="step"':''}><span class="campaign-node-number">${x.completed?'✓':String(x.number).padStart(2,'0')}</span><span class="campaign-node-title">${esc(x.title)}</span></div>`).join('')}</div>`;
    if(st.complete)return `${head}<article class="campaign-epilogue"><div class="campaign-kicker">${esc(st.caseFile.badge)} · DAY ${st.caseFile.completedDay}</div><h2>A quiet morning, at last.</h2><p>${esc(CAMPAIGN.missions[4].successText)}</p><blockquote>“${esc(CAMPAIGN.npc.line)}”<br><small>— ${esc(CAMPAIGN.npc.name)}, ${esc(CAMPAIGN.npc.role)}</small></blockquote><p>Your agents keep their current Sequence. Finish potion digestion through contracts, then review their advancement requirements in the Guild Hall.</p><div class="campaign-actions"><button class="primary" onclick="window.G9.tab('quests')">Continue with contracts</button><button onclick="window.G9.tab('hall')">Review the guild</button></div></article></section>`;
    const ready=st.requirements.every(r=>r.done);
    const eligible=!ready||chapterAgentIds.length?campaignEligibility(state,m.id,chapterAgentIds,chapterChoice):{ok:false,reason:'Select at least one agent for the mission.'};
    const setupActions=ready?'':`<div class="campaign-actions">${!st.requirements[0].done?'<button onclick="window.G9.tab(\'recruit\')">Recruit your first agent</button>':`<button onclick="window.G9.dossier(${esc(JSON.stringify((st.eligibleAgents[0]||activeRoster()[0]).id))})">${!st.requirements[1].done?'Awaken an agent':'Equip an agent'}</button>`}<button onclick="window.G9.tab('hall')">Open Guild Hall</button></div>`;
    return `${head}${st.pending?'<div class="campaign-alert"><b>A chapter outcome is saved.</b><p>Resume the report to record its outcome and continue.</p><button class="primary" onclick="window.G9.resumeCampaign()">Resume saved outcome</button></div>':''}<article class="campaign-case"><div class="campaign-case-body"><div class="campaign-case-heading"><div class="campaign-kicker">MISSION ${m.number} · ${esc(m.kind)}</div><h2>${esc(m.title)}</h2><p>${esc(m.brief)}</p></div><div class="campaign-story"><p>${esc(m.story)}</p></div><div class="campaign-section-label">Your objective</div><p>${esc(m.objective)}</p>${m.kind==='setup'||!ready?`<div class="campaign-objectives">${st.requirements.map(r=>`<div class="campaign-objective ${r.done?'done':''}"><span>${r.done?'✓':'○'}</span><span>${esc(r.label)}</span></div>`).join('')}</div>${setupActions}`:''}${m.choices.length?`<div class="campaign-section-label">Choose your approach</div><div class="campaign-choices">${m.choices.map(c=>`<button class="campaign-choice ${chapterChoice===c.id?'selected':''}" aria-pressed="${chapterChoice===c.id}" onclick="window.G9.chapterChoice('${c.id}')"><b>${esc(c.label)}</b><p>${esc(c.description)}</p><span class="campaign-choice-benefit">${esc(c.benefit)}</span></button>`).join('')}</div>`:''}${state.campaign.clues.length?`<div class="campaign-section-label">Evidence collected</div>${state.campaign.clues.map(c=>`<p class="campaign-meta"><b>${esc(c.title)}</b> · ${esc(c.description)}</p>`).join('')}`:''}${state.campaign.preparation?`<p class="campaign-meta"><b>Preparation:</b> ${state.campaign.preparation==='ward'?'Silencing seal':'Field reserve'}</p>`:''}<div class="campaign-section-label">Commission on success</div>${campaignRewardMarkup(m.rewards)}</div><aside class="campaign-assignment"><div class="campaign-section-label">Assign agents · ${chapterAgentIds.length}/3</div><p>${m.kind==='combat'?'Bring one to three equipped Beyonders. Chapter support rests them for this encounter.':'Selected agents receive this mission’s potion digestion and pathway materials.'}</p><div class="campaign-party">${st.eligibleAgents.map(a=>`<button class="campaign-agent ${chapterAgentIds.includes(a.id)?'selected':''}" aria-pressed="${chapterAgentIds.includes(a.id)}" onclick="window.G9.chapterAgent(${esc(JSON.stringify(a.id))})"><span class="campaign-agent-img">${getCombatSprite(a)}</span><span class="campaign-agent-copy"><b>${esc(a.name)}</b><small>${esc(pathName(a.path))} · Seq ${a.sequence}</small><small>${esc(weaponFor(a).name)} · Digest ${Math.round(a.digest||0)}%</small></span><span class="campaign-agent-check">${chapterAgentIds.includes(a.id)?'✓':'○'}</span></button>`).join('')||'<p class="muted">Recruit and awaken an agent to begin.</p>'}</div>${st.eligibleAgents.length?'<button class="small" onclick="window.G9.tab(\'hall\')">Manage equipment in Guild Hall</button>':''}<div class="campaign-protection"><b>Protected chapter encounters</b><p>Defeated agents return safely. Failed attempts give no rewards and can be retried. Normal contracts retain their usual risks.</p></div>${!eligible.ok?`<p class="campaign-policy" role="status">${esc(eligible.reason)}</p>`:''}<button class="primary full" ${!eligible.ok?'disabled':''} onclick="window.G9.chapterStart()">${m.kind==='combat'?'Confront Cantor Vale':m.kind==='setup'?'Accept Mara’s commission':m.kind==='epilogue'?'Close the case':'Begin mission'}</button></aside></article></section>`;
  }
  function pathwayPreview(){
    const p=pathOf(previewPath)||pathOf(PATH_KEYS[0]);
    const intro=p.quirkText||G9D.pathways.introductions[previewPath]||`${p.name} is one of the twenty-two supernatural Pathways.`;
    const seqs=p.sequences.slice().sort((a,b)=>b.sequence-a.sequence);
    return `<section class="panel pathway-preview"><div class="section-head"><div><h2>Pathway Preview</h2><p>Explore every Pathway from Sequence 9 through Sequence 0.</p></div><span>${PATH_KEYS.length}/22 Pathways</span></div>
      <div class="preview-layout">
        <aside class="pathway-picker"><label><b>Pathway</b><select onchange="window.G9.previewPath(this.value)">${PATH_KEYS.map(k=>`<option value="${k}" ${k===previewPath?'selected':''}>${esc(pathOf(k).name)}</option>`).join('')}</select></label><p class="muted">Select any of the 22 Pathways to inspect its Sequence 9 → 0 abilities.</p></aside>
        <article class="pathway-detail">
          <div class="eyebrow">${esc(p.group||'PATHWAY')} · ${esc(p.archetype||'')}</div>
          <h2>${esc(p.name)}</h2><p class="path-intro">${esc(intro)}</p>
          <div class="path-meta"><span><b>Role</b>${esc(p.role||'')}</span><span><b>Mythical Form</b>${esc(p.mythicalForm||'')}</span><span><b>Material</b>${esc(p.material||'')}</span></div>
          <h3>Abilities · Sequence 9 → 0</h3>
          <div class="preview-abilities">${seqs.map(t=>`<div class="preview-ability"><div class="preview-seq">SEQ ${t.sequence}</div><div><h4>${esc(t.name)}</h4><p>${esc(abilityDescription(t.abilities?.[0]||t,previewPath,t.sequence))}</p><span class="multiplier">${esc(abilityDamageText(t.abilities?.[0]||t))}</span></div></div>`).join('')}</div>
        </article>
      </div>
    </section>`;
  }

  function battleSimulator(){
    const count=simMode==='1v1'?1:2;
    const side=(arr,label)=>`<div class="sim-side"><h3>${label}</h3>${arr.slice(0,count).map((x,i)=>`<div class="sim-unit"><label>${label} ${i+1} Pathway<select onchange="window.G9.simSet('${label==='Team A'?'A':'B'}',${i},'path',this.value)">${PATH_KEYS.map(k=>`<option value="${k}" ${x.path===k?'selected':''}>${esc(pathOf(k).name)}</option>`).join('')}</select></label><label>Sequence<select onchange="window.G9.simSet('${label==='Team A'?'A':'B'}',${i},'sequence',Number(this.value))">${Array.from({length:10},(_,j)=>9-j).map(n=>`<option value="${n}" ${x.sequence===n?'selected':''}>Sequence ${n}</option>`).join('')}</select></label></div>`).join('')}</div>`;
    return `<section class="panel battle-simulator"><div class="section-head"><div><h2>Battle Simulator</h2><p>Run a deterministic preview battle between any Pathway and Sequence combination.</p></div><div><button class="${simMode==='1v1'?'active':''}" onclick="window.G9.simMode('1v1')">1v1</button><button class="${simMode==='2v2'?'active':''}" onclick="window.G9.simMode('2v2')">2v2</button></div></div><div class="sim-grid">${side(simA,'Team A')}${side(simB,'Team B')}</div><div class="sim-actions"><button class="primary" onclick="window.G9.runSimulation()">Simulate Battle</button><button onclick="window.G9.clearSimulation()">Clear Log</button></div>${simResult?`<div class="sim-result"><div class="section-head"><h3>${battleOutcomeLabel(simResult.battleOutcome,simResult.success,true)}</h3><span>${simResult.rounds} rounds · ${simResult.balanceTrace.length} damage events</span></div><div class="sim-hp"><div><b>Team A</b> ${simResult.teamA.filter(x=>x.alive).length}/${simResult.teamA.length} standing</div><div><b>Team B</b> ${simResult.teamB.filter(x=>x.alive).length}/${simResult.teamB.length} standing</div></div><div class="balance-panel"><div class="section-head"><div><h3>Damage Breakdown</h3><p>Every hit: ability multiplier → raw damage → resistance → DEF → final damage, including effect contributions.</p></div></div><div class="balance-table-wrap"><table class="balance-table"><thead><tr><th>Rnd</th><th>Attacker</th><th>Ability</th><th>Stat</th><th>Mult.</th><th>Raw</th><th>Resist.</th><th>After Resist.</th><th>DEF</th><th>DEF Reduction</th><th>Effects</th><th>Final</th></tr></thead><tbody>${simResult.balanceTrace.map(t=>`<tr><td>${t.round}</td><td>${esc(t.attacker)}</td><td><b>${esc(t.ability)}</b><small>${esc(t.damageType)}${t.critical?' · CRIT':''}</small></td><td>${esc(t.stat)}</td><td>${(Number(t.abilityMultiplier||0)*100).toFixed(0)}%${t.effectiveMultiplier!==t.abilityMultiplier?`<small>eff ${(Number(t.effectiveMultiplier||0)*100).toFixed(0)}%</small>`:''}</td><td>${Math.round(t.raw||0)}</td><td>${Number(t.resistance||0).toFixed(1)}%</td><td>${Math.round(t.afterResistance||0)}</td><td>${Math.round(t.defense||0)}</td><td>${Math.round(t.defenseReduction||0)}</td><td>${t.effectContributions?.length?t.effectContributions.map(e=>`${esc(e.type)}${e.multiplier!=null?` ×${Number(e.multiplier).toFixed(2)}`:''}`).join('<br>'):'—'}</td><td><b>${Math.round(t.final||0)}</b></td></tr>`).join('')}</tbody></table></div></div><div class="sim-battle-log-wrap" style="margin-top:16px">
  <div class="section-head"><div><h3>Combat Log</h3><p>Unified turn-by-turn combat view.</p></div></div>
  ${renderBattleLogComponent({
    allies: simResult.teamA,
    enemies: simResult.teamB,
    flattenedRows: simResult.turnRows,
    shownCount: simResult.currentTurn,
    isDone: simResult.currentTurn >= simResult.turnRows.length,
    showDetails: simBattleDetails,
    speed: tickerSpeed,
    paused: !!simResult.paused,
    summaryText: simResult.summaryText,
    success: simResult.success,
    outcome: simResult.battleOutcome,
    isSim: true,
    battlefieldImage: battlefieldImageFor({}, true)
  })}
</div></div>`:'<p class="muted">Choose both sides and press Simulate Battle. No guild resources or roster characters are changed.</p>'}</section>`;
  }
  function hall(){return `${campaignHallCard()}<section class="grid two"><div class="panel"><div class="section-head"><div><h2>Guild Roster</h2><p>Every character begins as an ordinary person.</p></div><span>${combatReady().length} combat-ready</span></div>${state.roster.map(agentCard).join('')||'<div class="empty"><h3>The roster is empty.</h3><p>Visit the Recruitment Office to hire your first ordinary person.</p></div>'}</div><div class="panel"><div class="section-head"><h2>Guild Ledger</h2><button class="small" onclick="window.G9.reset()">Reset</button></div><div class="ledger"><p><b>Reputation</b></p><p>${state.reputation} — measures the guild's standing. Higher reputation unlocks more contracts, higher rewards and more dangerous supernatural work.</p><p><b>Digesting</b></p><p>Successful quests advance a character's understanding of their current potion. Individual contracts digest faster than team contracts.</p><p><b>Permanent loss</b></p><p>Death and failed advancement remove the character from the roster.</p></div></div></section>`}
  function statusBar(label,value){return `<div class="meter"><div><span>${label}</span><b>${Math.round(value||0)}/100</b></div><i><em style="width:${Math.min(100,Math.max(0,value||0))}%"></em></i></div>`}
  function agentCard(a){const dead=a.status!=='active';return `<article class="agent ${dead?'dead':''} ${a.awakened?'':'unawakened'}" onclick="window.G9.dossier('${a.id}')"><div class="portrait">${esc(a.name.slice(0,1))}</div><div class="agent-main"><div class="agent-title"><div><h3>${esc(a.name)}</h3><p>${esc(a.occupation||'Ordinary person')} · ${a.awakened?esc(pathName(a.path))+' · Sequence '+a.sequence+' — '+esc(tierName(a.path,a.sequence)):'Recommended: '+esc(pathName(a.recommendedPath))}</p></div><span class="status ${a.status}">${a.awakened?'active':'unawakened'}</span></div><div class="stats">${(()=>{const s=combatDisplayStats(a),b=a.stats;return statPair('HP',s.hp,b.hp)+statPair('SP',Math.round(a.sp??maxSPFor(a)),maxSPFor(a))+statPair('ATK',s.atk,b.atk)+statPair('DEF',s.def,b.def)+statPair('INT',s.int,b.int)})()}</div>${a.awakened?`<div class="variance-box"><b>Individual Variance</b><span>HP ×${(a.statVariance?.hp||1).toFixed(2)}</span><span>ATK ×${(a.statVariance?.atk||1).toFixed(2)}</span><span>DEF ×${(a.statVariance?.def||1).toFixed(2)}</span><span>INT ×${(a.statVariance?.int||1).toFixed(2)}</span><span>Speed ×${(a.statVariance?.speed||1).toFixed(2)}</span></div>`:''}${statusBar('Madness',a.madness)}${statusBar('Corruption',a.corruption)}${statusBar('Injuries',a.injuries)}${a.madness>=50?'<p class="warning">Madness above 50 causes action loss; at 100 the character becomes a corrupted monster and is permanently lost.</p>':''}${a.injuries>0?'<p class="muted">Injuries reduce effective HP and other stats by up to 30% until treated.</p>':''}${a.awakened?statusBar('Digesting',a.digest):`<p class="muted">Recommended Pathway: <b>${esc(pathName(a.recommendedPath))}</b>. Click to view awakening requirements.</p>`}<div class="agent-actions">${!dead&&a.awakened&&a.unitType!=='marionette'&&a.sequence>0?`<button onclick="event.stopPropagation();window.G9.advance('${a.id}')">Advance</button>`:''}${!dead&&(a.injuries||0)>0?`<button onclick="event.stopPropagation();window.G9.heal('${a.id}')">Heal</button>`:''}</div></div></article>`}
  function recruit(){return `<section class="panel"><div class="section-head"><div><h2>Recruitment Office</h2><p>Ordinary people with occupations, characteristics and recommended Pathways. The office refreshes periodically.</p></div><button onclick="window.G9.refreshRecruit()">Refresh Office</button></div><div class="recruit-grid">${state.recruitPool.map(a=>`<article class="recruit" onclick="window.G9.recruitInfo('${a.id}')"><div class="portrait large">${esc(a.name.slice(0,1))}</div><h3>${esc(a.name)}</h3><p>${esc(a.occupation)}</p><strong>Recommended: ${esc(pathName(a.recommendedPath))}</strong><div class="stats compact">${Object.entries(a.stats).map(([k,v])=>`<span>${k.toUpperCase()} ${v}</span>`).join('')}</div><p class="muted">Combat Trait: <b>${esc(a.trait||'Stout Vitality')}</b> — ${esc(TRAITS[a.trait||'Stout Vitality'].desc)}</p><button class="primary" onclick="event.stopPropagation();window.G9.hire('${a.id}')">Hire · £150</button></article>`).join('')}</div><p class="muted office-note">Next automatic refresh: ${state.recruitRefreshDay-state.day>0?`in ${state.recruitRefreshDay-state.day} day(s)`:'now'}.</p></section>`}
  function quests(){const rep=state.reputation;const tier=rep<5?'Local Services':rep<15?'Trusted Investigations':rep<30?'Mystery Contracts':'Occult Contracts';const target=questCountForReputation(rep);return `<section class="panel"><div class="section-head"><div><h2>Contract Board</h2><p>Reputation ${rep} · ${tier} · ${state.quests.length}/${target} contracts available.</p><p class="muted">Low reputation means fewer jobs and mostly mundane work. As the guild earns trust, more dangerous and better-paying contracts appear.</p></div></div>${state.quests.map(q=>`<article class="quest" onclick="window.G9.plan('${q.id}')"><div>${q.difficultySequence<10&&q.difficultySequence<=Math.max(5,maxContractSequence(rep)-2)?'<span class="warning-symbol" title="This contract is above the guild normal reputation range.">⚠</span>':''}<span class="tag">${q.difficultySequence===10?'NORMAL':`SEQ ${q.difficultySequence}`}</span><span class="tag">${q.tags?.[0]?.toUpperCase()||'CONTRACT'}</span>${q.requiredPath?`<span class="tag">${esc(pathName(q.requiredPath))}</span>`:''}<h3>${esc(q.name)}</h3><p>${esc(q.brief)}</p><small>Reward £${q.rewards.funds} · +${q.rewards.reputation} reputation</small></div><button onclick="event.stopPropagation();window.G9.plan('${q.id}')">Open Contract</button><button class="small danger-btn" onclick="event.stopPropagation();window.G9.decline('${q.id}')">Decline</button></article>`).join('')}</section>`}
  function wanted(){return `<section class="panel"><div class="section-head"><div><h2>Wanted Board</h2><p>Named supernatural targets. No trait-based decision making; combat is fully automated.</p></div></div>${state.wanted?.length?state.wanted.map(q=>`<article class="wanted-card" onclick="window.G9.planWanted('${q.id}')"><div class="wanted-eyebrow">WANTED — ${esc((q.name||'TARGET').replace(/^Wanted:\s*/i,''))}</div><h3>${esc(q.target||q.name)}</h3><div class="wanted-meta"><span><b>Known Path:</b> ${esc(q.knownPath||'Unknown')}</span><span><b>Threat:</b> ${esc(q.threat||'★★★☆☆')}</span><span><b>Last Seen:</b> ${esc(q.lastSeen||'Unknown')}</span></div><blockquote>${esc(q.story||q.brief)}</blockquote><h4>Objective</h4><p class="wanted-code">${esc(q.objectiveText||`Capture or kill ${q.target||q.name}`)}</p><h4>Reward</h4><p class="wanted-code">£${q.rewards?.funds||0}<br>+ ${q.rewards?.reputation||0} Reputation<br>+ ${Object.values(q.rewards?.materials||{})[0]||0} rare materials</p><div class="wanted-actions"><button onclick="event.stopPropagation();window.G9.planWanted('${q.id}')">Hunt Target</button><button class="small danger-btn" onclick="event.stopPropagation();window.G9.declineWanted('${q.id}')">Decline</button></div></article>`).join(''):'<div class="empty"><h3>No active warrants.</h3><p>New warrants appear as the guild gains reputation.</p></div>'}</section>`}
function inventory(){const entries=Object.entries(state.materials);return `<section class="panel"><div class="section-head"><div><h2>Guild Inventory</h2><p>Everything currently owned by the guild.</p></div></div><div class="inventory-summary"><div><span>FUNDS</span><b>£${state.funds.toLocaleString()}</b></div><div><span>REPUTATION</span><b>${state.reputation}</b></div><div><span>ROSTER</span><b>${activeRoster().length}</b></div></div><h3>Weapons</h3><div class="material-grid">${Object.values(WEAPONS).filter(w=>w.id!=='none').map(w=>`<article class="material"><b>${esc(w.name)}</b><span>${state.weapons?.[w.id]||0} available</span><small>+${w.atk} ATK · ${w.kind==='gun'?'Gun accuracy starts at 50% and gains +5% per Gun Mastery level':'Weapon Mastery improves damage'}${w.bleed?` · ${Math.round(w.bleed*100)}% Bleed`:''}</small><small>${esc(w.text)}</small></article>`).join('')}</div><h3>Materials</h3><div class="material-grid">${entries.map(([name,count])=>`<article class="material"><b>${esc(name)}</b><span>${count}</span><small>Used for ${esc(Object.values(PATHS).find(x=>x.material===name)?.name||'Pathway')} advancement.</small><button class="small" onclick="window.G9.buyMaterial('${Object.keys(PATHS).find(k=>PATHS[k].material===name)}')">Buy +1 · £180</button></article>`).join('')}</div></section>`}
  function chronicleView(){return `<section class="panel"><div class="section-head"><h2>Guild Chronicle</h2><span>${state.chronicle.length} entries</span></div>${state.chronicle.map(x=>`<div class="chronicle"><span>DAY ${x.day}</span><p>${esc(x.text)}</p></div>`).join('')}</section>`}
  function combatDisplayStats(a){
  const base=a.awakened?effectiveStats(a):{...(a.stats||{})};
  const displayAgent={...a,stats:base},pm=passiveCombatModifier(displayAgent),w=weaponStats(displayAgent);
  return {hp:Math.round(base.hp*(pm.hp||1)),atk:Math.round(base.atk*pm.atk+w.atk),def:Math.round(base.def*pm.def),int:Math.round(base.int*pm.int),spd:Math.round(speedFor(displayAgent))};
}
function statPair(label,final,base){return `<span>${label} <b>${final}</b> <small>(${base})</small></span>`;}

function equipmentPicker(a){const options=Object.values(WEAPONS).filter(w=>w.id==='none'||w.id===a.weaponId||(state.weapons[w.id]||0)>0).map(w=>`<option value="${w.id}" ${a.weaponId===w.id?'selected':''}>${esc(w.name)} (+${w.atk} ATK) · ${state.weapons[w.id]||0} available</option>`).join('');return `<label class="equipment-select"><span>Equip Weapon</span><select onchange="window.G9.setWeapon(${esc(JSON.stringify(a.id))},this.value)">${options}</select></label>`}
  function dossier(){
    const a=state.roster.find(x=>x.id===selected); if(!a)return '';
    const actionId=esc(JSON.stringify(a.id));
    const tier=tierFor(a.path,a.sequence),eff=a.awakened?combatDisplayStats(a):a.stats;
    const cr=a.awakened?combatRates({...a,stats:effectiveStats(a)}):null;
    const intro=a.introduction||`An ordinary ${a.occupation||'person'} whose life has begun to intersect with the hidden world.`;
    const abilities=a.awakened?pathOf(a.path).sequences.filter(t=>t.sequence>=a.sequence).flatMap(t=>(t.abilities||[]).map(spec=>({...spec,sequence:t.sequence,name:t.name,text:abilityDescription(spec,a.path,t.sequence)}))).sort((x,y)=>x.sequence-y.sequence):[];
    const skillType=typeof dossierSkillType==='undefined'?'active':dossierSkillType;
    const skills=abilities.filter(x=>x.type===skillType);
    const skillRank=typeof dossierSkillSequence==='undefined'?null:dossierSkillSequence;
    const skill=skills.find(x=>x.sequence===skillRank)||skills[0];
    const skillDamage=skill?.damage?abilityDamageText(skill):'';
    const next=a.awakened&&a.sequence>0?canTrain(state,a):null,weapon=weaponFor(a);
    const portrait=a.awakened&&typeof getCombatSprite==='function'?`<button type="button" class="dossier-portrait-zoom" aria-label="Enlarge character portrait" onclick="window.G9.openPortrait(this)">${getCombatSprite(a,{variant:'full',loading:'eager',priority:'auto'})}<span class="dossier-portrait-hint">Enlarge</span></button>`:`<span class="dossier-initial" aria-hidden="true">${esc(a.name.slice(0,1))}</span>`;
    const pathButtons=PATH_KEYS.map(p=>`<button class="path-choice ${a.recommendedPath===p?'recommended':''}" onclick="window.G9.choosePath(${actionId},'${p}')"><b>${esc(pathName(p))}</b><span>${esc(pathOf(p).role)}</span>${a.recommendedPath===p?'<small>Recommended</small>':''}</button>`).join('');
    const title=x=>(x.text||x.name).split(/\s[—–]\s/)[0];
    const tabMarkup=type=>{
      const first=abilities.find(x=>x.type===type),active=type===skillType;
      return `<button type="button" role="tab" id="dossier-tab-${type}" aria-controls="dossier-skill-panel" aria-selected="${active}" tabindex="${active?'0':'-1'}" class="${active?'active':''}" onclick="window.G9.dossierSkillTab('${type}')"><b>${type==='active'?'Active Skill':'Passive Skill'}</b><span>${esc(active&&skill?title(skill):first?title(first):'None unlocked')}</span></button>`;
    };
    return `<div class="overlay dossier-overlay" onclick="window.G9.closeDossier()"><article class="modal character-dossier" role="dialog" aria-modal="true" aria-labelledby="dossier-title" onclick="event.stopPropagation()">
      <button type="button" class="close" aria-label="Close character dossier" onclick="window.G9.closeDossier()">×</button>
      <div class="eyebrow">CHARACTER DOSSIER</div><h2 id="dossier-title" tabindex="-1">${esc(a.name)}</h2>
      <div class="dossier-identity"><div class="dossier-portrait">${portrait}</div><div class="dossier-progression"><p class="dossier-path">${a.awakened?esc(pathName(a.path)):'Ordinary person'}</p><p class="dossier-rank">${a.awakened?`Sequence ${a.sequence} — ${esc(tier.name)}`:'Unawakened'}</p><p class="muted">${esc(a.occupation||'Ordinary person')}</p>${a.awakened?statusBar('Digesting',a.digest):'<p class="muted">Choose a Pathway to begin.</p>'}</div></div>
      <section class="dossier-equipment" aria-label="Equipment"><div class="dossier-equipment-slot" title="${esc(weapon.name)}"><span aria-hidden="true">${weapon.kind==='gun'?'⌁':weapon.kind==='unarmed'?'◇':'†'}</span><small>Weapon</small></div><div class="dossier-equipment-copy"><b>${esc(weapon.name)}</b><small>Weapon ATK: +${weapon.atk} · ${weapon.kind==='gun'?'Gun':weapon.kind==='unarmed'?'Bare Hand':'Melee'} Mastery Lv.${weaponStats(a).mastery}</small>${equipmentPicker(a)}</div></section>
      <div class="dossier-skill-tabs" role="tablist" aria-label="Sequence abilities">${tabMarkup('active')}${tabMarkup('passive')}</div>
      <div class="big-stats dossier-stats">${[['HP',eff.hp],['SP',Math.round(a.sp??maxSPFor(a))],['ATK',eff.atk],['DEF',eff.def],['INT',eff.int],['Speed',cr?cr.speed.toFixed(1):eff.spd||'—']].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div>
      <section class="dossier-skill-panel" id="dossier-skill-panel" role="tabpanel" tabindex="0" aria-labelledby="dossier-tab-${skillType}">${skill?`<label class="dossier-rank-picker">Unlocked ${skillType} ability<select onchange="window.G9.dossierSkillSequence(Number(this.value))">${skills.map(x=>`<option value="${x.sequence}" ${x===skill?'selected':''}>Sequence ${x.sequence} — ${esc(x.name)} · ${esc(title(x))}</option>`).join('')}</select></label><h3>Sequence ${skill.sequence} — ${esc(skill.name)}</h3><p>${esc(skill.text)}</p><small>${skill.type==='active'?(abilityEffects(skill).some(e=>e.type==='signature'&&['door_record','tower_imitation'].includes(e.rule))?'Stored skill SP and cooldown':`SP ${skill.costSP||0} · Cooldown ${skill.cooldown||0} turns`):'Always active'}${skillDamage?` · ${esc(skillDamage)}`:''}</small>`:`<p class="muted">No ${skillType} abilities yet.${a.awakened?'':' Awaken to Sequence 9.'}</p>`}</section>
      ${!a.awakened?`<details class="dossier-details" open><summary>Awakening — Sequence 9</summary><p>This character is an ordinary human. Sequence 9 begins their supernatural pathway; it is not an ordinary-human tier. Choose the Pathway whose nature best fits their characteristics.</p><div class="path-grid">${pathButtons}</div></details>`:''}
      <details class="dossier-details"><summary>Condition & combat details</summary>${statusBar('Madness',a.madness)}${statusBar('Corruption',a.corruption)}${statusBar('Injuries',a.injuries)}${a.injuries>0?'<p class="muted">Injuries reduce effective HP and other stats by up to 30% until treated.</p>':''}${a.madness>=50?'<p class="warning">Madness above 50 causes action loss; at 100 the character becomes a corrupted monster and is permanently lost.</p>':''}${cr?`<div class="combat-rates"><span>Crit ${Math.round(cr.crit*100)}%</span><span>Crit Damage +${Math.round(cr.critDamage*100)}%</span><span>Dodge ${Math.round(cr.dodge*100)}%</span><span>Counter ${Math.round(cr.counter*100)}%</span><span>Speed ${cr.speed.toFixed(1)} · AV ${cr.av.toFixed(1)}</span><span>Archetype ${archetypeOf(a.path)}</span><span>Max SP ${maxSPFor(a)}</span><span>Element Resistance: ${Object.entries(cr.resistances||{}).map(([k,v])=>`${esc(k)} ${v>0?'+':''}${Math.round(v)}%`).join(' · ')||'None'}</span>${cr.passives?.length?`<span>Passives: ${cr.passives.map(esc).join(' · ')}</span>`:''}</div><div class="special-meter"><b>${esc(specialStatFor(a.path,a.sequence,a).name)} ${Math.round(specialStatFor(a.path,a.sequence,a).value)}/100</b><small>Gain: ${esc(specialStatFor(a.path,a.sequence,a).gain)} · Spend: ${esc(specialStatFor(a.path,a.sequence,a).spend)}</small></div>`:''}<p class="muted">Weapon Mastery: Gun ${weaponMasteryValue(a,'gun')} · Melee ${weaponMasteryValue(a,'weapon')} · Bare Hand ${weaponMasteryValue(a,'unarmed')}. Mastery is permanently attached to this character; changing weapons does not reset it.</p>${weapon.kind==='gun'?`<p class="muted">Gun Accuracy: ${Math.round((1-weaponStats(a).masteryMiss)*100)}%</p>`:''}${weapon.bleed?`<p class="muted">Bleed: ${Math.round(weapon.bleed*100)}% if target survives</p>`:''}<p class="muted">Current ATK: ${eff.atk} (base ${a.stats.atk})</p>${a.status==='active'&&a.injuries>0?`<button type="button" onclick="window.G9.heal(${actionId})">Treat injuries</button>`:''}</details>
      ${next?`<details class="dossier-details"><summary>Advancement</summary><p>Next: <b>Sequence ${a.sequence-1} — ${esc(next.next.name)}</b>. Digesting: ${Math.round(a.digest||0)}%.</p><div class="requirement-box"><b>Requirements</b><span>Digesting: ${next.ready?'Complete':'Not complete'}</span><span>${esc(next.mat)}: ${state.materials[next.mat]||0}/${next.materialCost}</span><span>Funds: £${state.funds.toLocaleString()}/£${next.fundsCost}</span></div><button type="button" class="primary full" onclick="window.G9.advance(${actionId})">Review Advancement</button></details>`:''}
      ${a.awakened&&a.sequence===0?'<p class="gold-note">Sequence 0 — Deity. No further advancement.</p>':''}
      ${a.unitType==='marionette'?`<p class="dossier-restriction"><b>Owner:</b> ${esc(state.roster.find(x=>x.id===a.ownerId)?.name||a.ownerId||'Unknown')}<br>${esc((a.permanentTraits||['Marionette','Cannot advance','Permanent death']).join(' · '))}</p>`:''}
      <details class="dossier-details"><summary>Biography & history</summary><h3>Introduction</h3><p>${esc(intro)}</p><h3>Combat Trait</h3><p><b>${esc(a.trait||'Stout Vitality')}</b> — ${esc((TRAITS[a.trait||'Stout Vitality']||TRAITS['Stout Vitality']).desc)}</p>${a.awakened?`<h3>Individual Variance</h3><p class="muted">Each stat has an individual variance roll of ±10% at awakening. It remains fixed for this character.</p><div class="variance-box">${['hp','atk','def','int','speed'].map(key=>`<span>${key==='speed'?'Speed':key.toUpperCase()} ×${(a.statVariance?.[key]||1).toFixed(2)}</span>`).join('')}</div>`:''}<h3>History</h3>${(a.history||[]).slice().reverse().map(h=>`<p class="history"><small>Day ${h.day}</small> ${esc(h.text)}</p>`).join('')}</details>
      <div class="dossier-footer"><button type="button" onclick="window.G9.closeDossier()">Close</button></div>
    </article></div>`;
  }
  function assignmentModal(){const q=planning;const ready=combatReady();const saved=state.teams[q.id]||[];return `<div class="overlay"><div class="modal"><button class="close" onclick="window.G9.cancelPlan()">×</button><div class="eyebrow">CONTRACT ASSIGNMENT</div><h2>${esc(q.name)}</h2><p>${esc(q.story||q.brief)}</p><p><b>Threat:</b> Sequence ${q.difficultySequence} · <b>Reward:</b> £${q.rewards.funds}</p><div class="dispatch-header"><h3>Assign Party (1–3 Beyonders) <span class="dispatch-count">${window.G9.selectedIds.length}/3 Selected</span></h3>${window.G9.selectedIds.length === 1 ? '<div class="solo-bonus-badge">⚡ <b>Solo Dispatch Active:</b> +50% Potion Digestion Bonus upon completion!</div>' : ''}</div><div class="assign-list">${ready.length?ready.map(a=>`<button type="button" class="assign-row ${window.G9.selectedIds.includes(a.id)?'selected':''}" onclick="window.G9.toggleAssign('${a.id}')"><span class="assign-check">${window.G9.selectedIds.includes(a.id)?'✓':'○'}</span><span><b>${esc(a.name)}</b> · ${esc(pathName(a.path))} Seq ${a.sequence}<small>Digest ${a.digest||0}% · HP ${a.stats.hp} · Weapon: ${esc(weaponFor(a).name)}</small></span><select onclick="event.stopPropagation()" onchange="window.G9.setWeapon('${a.id}',this.value)">${Object.values(WEAPONS).filter(w=>w.id==='none'||w.id===a.weaponId||(state.weapons[w.id]||0)>0).map(w=>`<option value="${w.id}" ${a.weaponId===w.id?'selected':''}>${esc(w.name)} (${state.weapons[w.id]||0})</option>`).join('')}</select></button>`).join(''):'<p class="muted">No awakened characters are available. Recruit and awaken someone first.</p>'}</div><div class="assign-actions"><button onclick="window.G9.saveTeam()">Save Selected Team</button><button onclick="window.G9.clearSelection()">Clear</button></div><button class="primary full" onclick="window.G9.launch()">Begin Contract</button></div></div>`}
  function runModal(){
    if(run.isCampaign&&run.kind!=='combat')return campaignNarrativeModal();
    const q=run.quest;
    const wanted=!run.isCampaign&&(q.target||q.name?.startsWith('Wanted'));
    const isDone = run.currentTurn >= run.turnRows.length;
    const summary = summarizeBattleEvents(run.result.events||[], run.result.battleSnapshot);
    const logHtml = renderBattleLogComponent({
      allies: run.initialAllies,
      enemies: run.initialEnemies,
      flattenedRows: run.turnRows,
      shownCount: run.currentTurn,
      isDone,
      showDetails: showBattleDetails,
      speed: tickerSpeed,
      paused: !!run.paused,
      summaryText: run.isCampaign?summary.summaryText.replace(/Casualties/g,'Agents recovered'):summary.summaryText,
      success: run.result.success,
      outcome: run.result.battleOutcome || run.result.battleSnapshot?.outcome,
      isSim: false,
      battlefieldImage: battlefieldImageFor(q)
    });

    return `<div class="overlay"><div class="modal quest-modal">
      <div class="eyebrow">${run.isCampaign?'CHAPTER I · CONFRONTATION':wanted?'WANTED HUNT':'CONTRACT RESOLUTION'}</div>
      <h2>${esc(q.target||q.name)}</h2>
      ${wanted?`<div class="wanted-meta"><span><b>Known Path:</b> ${esc(q.knownPath||'Unknown')}</span><span><b>Threat:</b> ${esc(q.threat||'★★★☆☆')}</span><span><b>Last Seen:</b> ${esc(q.lastSeen||'Unknown')}</span></div><blockquote>${esc(q.story||q.brief)}</blockquote><h4>Objective</h4><p class="wanted-code">${esc(q.objectiveText||'Capture or kill the target')}</p><h4>Reward</h4><p class="wanted-code">£${q.rewards?.funds||0}<br>+ ${q.rewards?.reputation||0} Reputation</p>`:''}
      ${run.isCampaign?'<p class="campaign-protection">Cantor Vale · Sequence 9 Sleepless. Your chapter preparations are active; your agents are protected.</p>':''}
      ${logHtml}
      <div class="battle-completion" ${isDone ? '' : 'hidden'}>
      ${run.isCampaign?`<p>${esc(run.result.lines.at(-1)?.text||'')}</p>${run.result.success?campaignRewardMarkup(CAMPAIGN.missions[3].rewards):''}`:''}
      <div class="result ${run.result.success?'success':'failure'}">${run.isCampaign?(run.result.success?'RESIDENTS RESCUED':'AGENTS RECOVERED · RETRY AVAILABLE'):run.result.success?(wanted?'TARGET ELIMINATED':'CONTRACT FULFILLED'):((run.result.battleOutcome||run.result.battleSnapshot?.outcome)==='timeout'?'ROUND LIMIT · CONTRACT INCOMPLETE':wanted?'HUNT FAILED':'CONTRACT FAILED')}</div><button class="primary full" onclick="window.G9.closeQuest()">${run.isCampaign?(run.result.success?'Record victory & continue':'Return and retry'):'Return to Guild'}</button>
      </div>
    </div></div>`;
  }
  window.G9={
    openPortrait,closePortrait,portraitZoom:percent=>portraitViewer?.zoom(Number(percent)/100),
    chapterAgent:id=>{
      const i=chapterAgentIds.indexOf(id);
      if(i>=0)chapterAgentIds.splice(i,1);
      else if(chapterAgentIds.length<3)chapterAgentIds.push(id);
      else return toast('Assign at most three agents to this case.');
      render();
    },
    chapterChoice:id=>{chapterChoice=id;render();},
    chapterStart:()=>{
      const st=campaignStatus(state);if(!st.current)return;
      if(!chapterAgentIds.length)return toast('Select at least one agent for the mission.');
      const outcome=chapterCommit(d=>campaignStart(d,st.current.id,chapterAgentIds,chapterChoice,Date.now()%2147483647));
      if(!outcome)return;
      planning=null;selected=null;run=campaignRunFromPending(outcome.pending);render();
    },
    resumeCampaign:()=>{if(state.campaign.pending){run=campaignRunFromPending(state.campaign.pending);tab='campaign';render();}},
    settleCampaign:()=>{
      const outcome=chapterCommit(d=>campaignSettle(d));if(!outcome)return;
      clearTimeout(tickerTimer);tickerTimer=null;run=null;planning=null;chapterSelectionMission=null;tab='campaign';render();
    },
    setTickerSpeed: spd => {
      tickerSpeed = [.5, 1, 2, 4].includes(Number(spd)) ? Number(spd) : 1;
      clearTimeout(tickerTimer);
      tickerTimer = null;
      refreshBattle();
    },
    toggleTickerPause: () => {
      const playing = run || (tab === 'simulator' ? simResult : null);
      if (!playing || playing.currentTurn >= playing.turnRows.length) return;
      playing.paused = !playing.paused;
      clearTimeout(tickerTimer); tickerTimer = null;
      refreshBattle();
    },
    stepTicker: () => {
      const playing = run || (tab === 'simulator' ? simResult : null);
      if (!playing || playing.currentTurn >= playing.turnRows.length) return;
      playing.paused = true;
      clearTimeout(tickerTimer); tickerTimer = null;
      while (playing.turnRows[playing.currentTurn]?.isRoundHeader) playing.currentTurn++;
      playing.currentTurn = Math.min(playing.turnRows.length, playing.currentTurn + 1);
      refreshBattle();
    },
    toggleDetails: () => {
      showBattleDetails = !showBattleDetails;
      refreshBattle();
    },
    toggleSimDetails: () => {
      simBattleDetails = !simBattleDetails;
      refreshBattle();
    },
    tab:t=>{tab=t;render()},previewPath:path=>{if(PATH_KEYS.includes(path)){previewPath=path;render()}},simMode:m=>{simMode=m;render()},simSet:(team,i,key,value)=>{const arr=team==='A'?simA:simB;if(arr[i])arr[i][key]=value;render()},clearSimulation:()=>{simResult=null;render()},runSimulation:()=>{const seed=Date.now()%2147483647;const count=simMode==='1v1'?1:2;const mk=(x,i)=>{const a=makeAgent(Math.random,{sequence:x.sequence,path:x.path,trait:'Stout Vitality'});a.id=`sim_${i}_${x.path}_${x.sequence}`;a.name=`${pathOf(x.path).name} Seq ${x.sequence}`;a.awakened=true;a.path=x.path;a.sequence=x.sequence;a.recommendedPath=x.path;a.injuries=0;a.weaponId='none';a.weaponMastery={};a.sp=maxSPFor(a);restatAgent(a);return a;};const members=simA.slice(0,count).map((x,i)=>mk(x,i));const opponents=simB.slice(0,count).map((x,i)=>({path:x.path,sequence:x.sequence}));const q={id:'sim',name:`${simMode} Battle`,brief:'Battle Simulator',story:'A controlled simulation. No guild resources are changed.',objective:'combat',difficultySequence:Math.min(...opponents.map(x=>x.sequence)),encounter:true,mundane:false,rewards:{funds:0,reputation:0,materials:{}},enemyCount:count,requiredPath:opponents[0].path};const res=resolveQuest(members,q,seed,{individual:count===1,simulationOpponents:opponents});const snap=res.battleSnapshot||{allies:[],enemies:[]};const simTurns = flattenTurnRows(groupEventsToRows(res.events||[]));
    const simSummary = summarizeBattleEvents(res.events||[], snap);
    simResult={currentTurn:0,success:res.success,battleOutcome:res.battleOutcome||snap.outcome,rounds:(res.events&&res.events.length)?Math.max(1,...res.events.map(e=>e.round||1)):(res.lines?res.lines.filter(x=>/^· Round /.test(x.text)).length:1),lines:res.lines,events:res.events||[],turnRows:simTurns,summaryText:simSummary.summaryText,teamA: members.map((m, i) => ({
  ...m,
  id: m.id,
  name: m.name,
  path: m.path,
  sequence: m.sequence,
  unitType: m.unitType,
  hp: snap.allies[i]?.maxHp ?? m.stats?.hp ?? 100,
  maxHp: snap.allies[i]?.maxHp ?? m.stats?.hp ?? 100,
  ...(snap.initialUnits || []).find(u => u.id === m.id),
  alive: snap.allies[i]?.alive ?? true
})),
teamB: opponents.map((o, i) => ({
  id: snap.enemies[i]?.id || `enemy_${i}`,
  name: snap.enemies[i]?.name || `${pathOf(o.path).name} Seq ${o.sequence}`,
  path: o.path,
  sequence: o.sequence,
  team: 'enemy',
  hp: snap.enemies[i]?.maxHp ?? 100,
  maxHp: snap.enemies[i]?.maxHp ?? 100,
  ...(snap.initialUnits || []).find(u => u.id === snap.enemies[i]?.id),
  alive: snap.enemies[i]?.alive ?? true
})),balanceTrace:snap.balanceTrace||[]};render()},fastTicker:()=>{if(!run)return;run.currentTurn=Math.min(run.turnRows.length,run.currentTurn+5);refreshBattle();},skipTicker:(isSim=false)=>{const playing=isSim?simResult:run;if(!playing)return;playing.currentTurn=playing.turnRows.length;clearTimeout(tickerTimer);tickerTimer=null;refreshBattle();},dossier:id=>{dossierReturnFocus={id:document.activeElement?.id,action:document.activeElement?.getAttribute('onclick')};selected=id;dossierSkillType='active';dossierSkillSequence=null;render();document.getElementById('dossier-title')?.focus()},
    closeDossier:()=>{selected=null;render();const previous=dossierReturnFocus;const opener=previous?.id?document.getElementById(previous.id):previous?.action?Array.from(app.querySelectorAll('[onclick]')).find(el=>el.getAttribute('onclick')===previous.action):null;(opener||app.querySelector('.tabs [aria-current="page"]'))?.focus();dossierReturnFocus=null},
    dossierSkillTab:type=>{if(!selected||!['active','passive'].includes(type))return;dossierSkillType=type;dossierSkillSequence=null;render();document.getElementById(`dossier-tab-${type}`)?.focus()},
    dossierSkillSequence:sequence=>{if(!selected||!Number.isInteger(sequence)||sequence<0||sequence>9)return;dossierSkillSequence=sequence;render();app.querySelector('.dossier-rank-picker select')?.focus()},recruitInfo:id=>{const a=state.recruitPool.find(x=>x.id===id);if(a){toast(`${a.name}: ${a.occupation}. Recommended ${pathName(a.recommendedPath)}.`)}},
    hire:id=>{if(chapterBlocked())return;const a=state.recruitPool.find(x=>x.id===id);if(!a)return;if(state.funds<150)return toast('Not enough funds.');commit(d=>{d.funds-=150;d.recruitPool=d.recruitPool.filter(x=>x.id!==id);a.history=[{day:d.day,text:`Hired from the Recruitment Office as an ordinary ${a.occupation.toLowerCase()}.`}];d.roster.push(clone(a));chronicle(d,`${a.name} joins the guild as an ordinary ${a.occupation.toLowerCase()}.`);if(!d.recruitPool.length){d.recruitPool=makeRecruitPool(4,Date.now(),d.reputation);d.recruitRefreshDay=d.day+7}})},
    refreshRecruit:()=>{if(chapterBlocked())return;if(state.day<state.recruitRefreshDay)return toast(`The office is not ready to refresh for ${state.recruitRefreshDay-state.day} more day(s).`);commit(d=>{d.recruitPool=makeRecruitPool(4,Date.now(),d.reputation);d.recruitRefreshDay=d.day+7;chronicle(d,'The Recruitment Office refreshes its candidates.')})},
    choosePath:(id,path)=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);if(!a||a.awakened||!PATH_KEYS.includes(path))return;const cost=1;if((state.materials[pathOf(path).material]||0)<cost)return toast(`You need 1 ${pathOf(path).material} to awaken.`);commit(d=>{const x=d.roster.find(y=>y.id===id);x.path=path;x.sequence=9;x.awakened=true;x.digest=0;x.stats=awakenStats(x,path);x.baseStats={...x.stats};x.maxSP=maxSPFor(x);x.sp=x.maxSP;x.cooldowns={};x.basePathSpeed=basePathSpeed(path);x.humanStats=x.humanStats||{...x.stats};const aw=tierFor(path,9), awA=aw.abilities?.[0]||{};x.abilities=[awA];x.abilityHistory=[{sequence:9,name:aw.name,ability:awA.text||aw.abilityText||aw.ability,type:awA.type||aw.type,effectId:awA.effectId||aw.effectId,damage:awA.damage||null,effects:awA.effects||[],effects:awA.effects||[]}];noteAgent(x,d.day,`Drank the ${pathName(path)} Sequence 9 potion and awakened as Sequence 9 ${tierFor(path,9).name}.`);chronicle(d,`${x.name} awakens as Sequence 9 ${pathName(path)}.`);d.materials[pathOf(path).material]-=cost;d.day+=1;if(d.quests.every(q=>!q.encounter))d.quests.push(makeQuest(()=>.5,9,10,Math.max(5,d.reputation),[path]));})},
    advance:id=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);const info=canTrain(state,a);if(!info)return;const readyText=info.ready?'READY':'NOT READY';const ok=confirm(`ADVANCE ${a.name}\n\nNext: Sequence ${a.sequence-1} ${info.next.name}\nDigesting: ${Math.round(a.digest||0)}% (${readyText})\nSuccess chance: ${Math.round(info.successChance*100)}%\n\nMaterials: ${info.mat} × ${info.materialCost}\nFunds: £${info.fundsCost}\n\nAdvance now?`);if(!ok)return;if(!info.ready)return toast('The potion is not fully digested yet. Complete more contracts.');if(!info.affordable)return toast(`You need ${info.materialCost} ${info.mat} and £${info.fundsCost}.`);const outcome=attemptTraining(a,Date.now()%2147483647);commit(d=>{const x=d.roster.find(y=>y.id===id);d.funds-=info.fundsCost;d.materials[info.mat]=(d.materials[info.mat]||0)-info.materialCost;if(outcome.ok){x.sequence-=1;x.digest=0;x.stats=advanceStats(x.stats,x.path,x.sequence);x.basePathSpeed=basePathSpeed(x.path,x.sequence);x.maxSP=maxSPFor(x);x.sp=Math.min(x.maxSP,x.sp||x.maxSP);x.cooldowns={};const nextA=info.next.abilities?.[0]||{};x.abilities=[...(x.abilities||[]),nextA];x.abilityHistory=[...(x.abilityHistory||[]),{sequence:x.sequence,name:info.next.name,ability:nextA.text||info.next.abilityText||info.next.ability,type:nextA.type||info.next.type,effectId:nextA.effectId||info.next.effectId,damage:nextA.damage||null,effects:nextA.effects||[],effects:nextA.effects||[]}];noteAgent(x,d.day,`Advanced to Sequence ${x.sequence} — ${info.next.name}. All prior abilities remain part of the character.`);chronicle(d,`${x.name} advances to Sequence ${x.sequence} (${info.next.name}).`)}else applyConsequences(d,[outcome.consequence]);d.day+=1;});toast(outcome.line)},
    heal:id=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);if(!a||a.injuries<=0)return;const c=healCost(a);if(state.funds<c.funds)return toast(`Healing requires £${c.funds}.`);const mat=Object.keys(state.materials).find(k=>state.materials[k]>=c.material);if(!mat)return toast(`Healing requires ${c.material} material.`);commit(d=>{const x=d.roster.find(y=>y.id===id);d.funds-=c.funds;d.materials[mat]-=c.material;x.injuries=0;x.madness=Math.max(0,(x.madness||0)-15);noteAgent(x,d.day,'Received guild medical and occult treatment. Injuries restored to 0/100 and Madness reduced by 15.');chronicle(d,`${x.name} is treated for injuries.`);d.day+=1})},
    decline:id=>{if(!state.quests.some(q=>q.id===id))return;commit(d=>{d.quests=d.quests.filter(q=>q.id!==id);const target=questCountForReputation(d.reputation);if(!d.wanted.length&&d.reputation>=15){const w=makeWantedQuest(d.reputation,()=>.99,d.roster.filter(a=>a.awakened).map(a=>a.path));d.wanted.push(w);}if(d.quests.length<target)d.quests.push(...makeQuestBoard(target-d.quests.length,Date.now(),d.reputation,d.roster.filter(a=>a.awakened).map(a=>a.path)));chronicle(d,'The guild declined a contract.');});},declineWanted:id=>{commit(d=>{d.wanted=(d.wanted||[]).filter(q=>q.id!==id);chronicle(d,'The guild declined a wanted warrant.');});},planWanted:id=>{planning=state.wanted.find(q=>q.id===id)||null;window.G9.selectedIds=[...(state.teams[id]||[])];render()},plan:id=>{planning=state.quests.find(q=>q.id===id)||null;window.G9.selectedIds=[...(state.teams[id]||[])];render()},
    setWeapon:(id,w)=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);if(!a)return;if(w===a.weaponId)return;if(w!=='none'&&!(state.weapons[w]||0))return toast('No copies of that weapon remain.');commit(d=>{const x=d.roster.find(y=>y.id===id);if(x.weaponId&&x.weaponId!=='none')d.weapons[x.weaponId]=(d.weapons[x.weaponId]||0)+1;if(w&&w!=='none')d.weapons[w]=Math.max(0,(d.weapons[w]||0)-1);x.weaponId=w;});},
    toggleAssign:id=>{const i=window.G9.selectedIds.indexOf(id);if(i>=0)window.G9.selectedIds.splice(i,1);else if(window.G9.selectedIds.length<3)window.G9.selectedIds.push(id);else toast('A party can contain at most 3 characters.');render()},
    individual:()=>{if(window.G9.selectedIds.length!==1)toast('Select exactly one character first.');else render()},
    team:()=>{if(window.G9.selectedIds.length<2)toast('Select at least two characters for a team.');else render()},
    clearSelection:()=>{window.G9.selectedIds=[];render()},
    saveTeam:()=>{if(!planning||window.G9.selectedIds.length<1)return toast('Select at least one character.') ;commit(d=>{d.teams[planning.id]=[...window.G9.selectedIds];chronicle(d,`A team was saved for ${planning.name}.`);planning=d.quests.find(q=>q.id===planning.id)});render()},
    cancelPlan:()=>{planning=null;render()},
    launch:()=>{if(chapterBlocked())return;if(!planning)return;const ids=window.G9.selectedIds||[];if(ids.length<1)return toast('Assign at least one character.');const members=state.roster.filter(a=>ids.includes(a.id)&&a.status==='active'&&a.awakened);if(!members.length)return toast('At least one awakened character is required.');const owners=new Set(members.filter(a=>a.unitType!=='marionette').map(a=>a.id));for(const m of members.filter(a=>a.unitType==='marionette')){if(!owners.has(m.ownerId))return toast('A Marionette can only deploy while its owner is in the party.');const owner=state.roster.find(a=>a.id===m.ownerId);const count=members.filter(a=>a.unitType==='marionette'&&a.ownerId===m.ownerId).length;if(count>threadSlots(owner.sequence))return toast(`The owner can deploy only ${threadSlots(owner.sequence)} Marionette(s) at this Sequence.`);}const q=planning;const individual=members.length===1;const result=resolveQuest(clone(members),q,Date.now()%2147483647,{individual});planning=null;const initialAllies = result.battleSnapshot?.initialUnits?.filter(u=>u.team==='ally') || clone(members).map(m=>{const hp=Math.round(effectiveStats(m).hp*(passiveCombatModifier(m).hp||1));return {id:m.id,name:m.name,team:'ally',path:m.path,sequence:m.sequence,unitType:m.unitType,maxHp:hp,hp,sp:m.sp??maxSPFor(m),maxSP:maxSPFor(m)};});
    const initialEnemies = result.battleSnapshot?.initialUnits?.filter(u=>u.team==='enemy') || (result.battleSnapshot?.enemies||[]).map(e=>({...e,team:'enemy',hp:e.maxHp,sp:0}));
    const turnRows = flattenTurnRows(groupEventsToRows(result.events||[]));
    run={quest:q,result,initialAllies,initialEnemies,turnRows,currentTurn:0,isSolo:individual};render()},
    closeQuest:()=>{if(!run||run.currentTurn<run.turnRows.length)return;if(run.isCampaign)return window.G9.settleCampaign();const q=run.quest,res=run.result;commit(d=>{applyConsequences(d,res.consequences);
if(run.isSolo && res.success){
  for(const ally of (run.initialAllies||[])){
    const ag = d.roster.find(x=>x.id===ally.id);
    if(ag && ag.status==='active'){
      const baseGain = 10;
      const soloBonus = Math.round(baseGain * 0.5);
      ag.digest = Math.min(100, (ag.digest||0) + soloBonus);
      chronicle(d, `${ag.name} gained +${soloBonus}% Potion Digestion from Solo Dispatch bonus.`);
    }
  }
}
addMarionettes(d,res);d.funds+=res.rewards.funds;d.reputation+=res.rewards.reputation;for(const[k,v]of Object.entries(res.rewards.materials||{}))d.materials[k]=(d.materials[k]||0)+v;d.quests=d.quests.filter(x=>x.id!==q.id);d.wanted=d.wanted||[];d.wanted=d.wanted.filter(x=>x.id!==q.id);d.day+=res.dayCost||1;chronicle(d,res.success?`${q.name}: contract fulfilled.`:`${q.name}: contract failed.`);if(d.recruitRefreshDay<=d.day){d.recruitPool=makeRecruitPool(4,Date.now(),d.reputation);d.recruitRefreshDay=d.day+7;}const target=questCountForReputation(d.reputation);if(!d.wanted.length&&d.reputation>=15){const w=makeWantedQuest(d.reputation,()=>.99,d.roster.filter(a=>a.awakened).map(a=>a.path));d.wanted.push(w);}if(d.quests.length<target){d.quests.push(...makeQuestBoard(target-d.quests.length,Date.now(),d.reputation,d.roster.filter(a=>a.awakened).map(a=>a.path)));}if(d.roster.some(a=>a.awakened)&&d.quests.every(q=>!q.encounter))d.quests[0]=makeQuest(()=>.5,9,10,Math.max(5,d.reputation),d.roster.filter(a=>a.awakened).map(a=>a.path));});run=null;tab='hall';render()},
    buyMaterial:(path)=>{if(chapterBlocked())return;const p=pathOf(path);if(!p)return;if(state.funds<180)return toast('Buying a Pathway material requires £180.');commit(d=>{d.funds-=180;d.materials[p.material]=(d.materials[p.material]||0)+1;chronicle(d,`Purchased 1 ${p.material}.`);});},reset:()=>{if(confirm('Erase the current guild and begin again?')){clearSave();state=newGame();state.recruitRefreshDay=8;window.G9.selectedIds=[];run=null;planning=null;selected=null;chapterSelectionMission=null;clearTimeout(tickerTimer);tickerTimer=null;tab='campaign';saveGame(state);render()}}
  };
  window.addEventListener('scroll',prioritizeVisiblePartyPortraits,{capture:true,passive:true});
  window.addEventListener('resize',prioritizeVisiblePartyPortraits);
  document.addEventListener('keydown',event=>{
    const dialog=portraitViewer?.dialog||(selected&&app.querySelector('.character-dossier'));if(!dialog)return;
    if(event.key==='Escape'){event.preventDefault();portraitViewer?closePortrait():window.G9.closeDossier();return;}
    if(!portraitViewer&&event.target?.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();window.G9.dossierSkillTab(event.key==='Home'?'active':event.key==='End'?'passive':dossierSkillType==='active'?'passive':'active');return;
    }
    if(event.key==='Tab'){
      const controls=Array.from(dialog.querySelectorAll('button,input,select,summary,[tabindex="0"]')).filter(el=>!el.disabled&&el.getAttribute('tabindex')!=='-1'&&el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(first&&event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){event.preventDefault();last.focus();}
      else if(first&&!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
    }
  });
  window.G9.selectedIds=[];
  if(!state.schema){state=newGame();state.recruitRefreshDay=8;saveGame(state)}
  if(!state.recruitRefreshDay)state.recruitRefreshDay=state.day+7;
  campaignEnsure(state);
  if(state.campaign.pending){run=campaignRunFromPending(state.campaign.pending);tab='campaign';}
  render();
})();
