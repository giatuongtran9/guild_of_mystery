const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function flattenTurnRows(groupedRounds) {
  const flattened = [];
  for (const gr of groupedRounds) {
    let allyHpLoss = 0;
    let enemyHpLoss = 0;
    for (const r of (gr.rows || [])) {
      const damages = [...(r.damages || []), ...(r.reflects || []), ...(r.reactions || [])];
      for (const d of damages) {
        const loss = d.hpLoss ?? Math.max(0, (d.amount || 0) - (d.absorbed || 0));
        const targetTeam = d.targetTeam || ((d.actorTeam || r.actorTeam) === 'ally' ? 'enemy' : 'ally');
        if (targetTeam === 'ally') allyHpLoss += loss;
        else enemyHpLoss += loss;
      }
    }
    flattened.push({ isRoundHeader: true, round: gr.round, initiative: gr.initiative, resources: gr.resources, roundStats: { allyHpLoss, enemyHpLoss } });
    for (const row of gr.rows) flattened.push(row);
  }
  return flattened;
}

// Resolution is already complete. These cursors expose its recorded events;
// neither animation callbacks nor wall-clock timing can change the outcome.
function battlePresentationRows(rows, shownCount, eventCount) {
  const visible = rows.slice(0, shownCount);
  const row = rows[shownCount];
  if (row && Number.isInteger(eventCount) && eventCount >= 0) {
    const partial = { ...row, presentationPartial: true,
      timeline: (row.timeline || []).slice(0, eventCount),
      damages: [], heals: [], shields: [], reflects: [], reactions: [],
      deaths: [], revives: [], subrows: [] };
    delete partial.resources;
    visible.push(partial);
  }
  return visible;
}

function isReadableAbility(row) {
  const id = String(row?.sourceAbilityId || row?.abilityId || '').split(':').pop();
  return !!id && id !== 'basic_attack' && !row?.attackKind && !row?.isSkip
    && row?.abilityType !== 'passive' && row?.abilityKind !== 'passive';
}

function presentationAbilityId(row) {
  return String(row?.sourceAbilityId || row?.abilityId || '').split(':').pop();
}

function isPaperRebound(row) { return presentationAbilityId(row) === 'paper_figurine_rebound'; }

function isPositiveSupportEvent(event, row) {
  const value = event?.event || event || {};
  // A Paper ward belongs to the incoming hit, and its reflected projectile to
  // the defender. Both are recorded outcomes, even inside another actor's row.
  if (value.paperReboundOwnerId != null) return true;
  if ((value.isReflect || value.type === 'reflect')
    && String(value.sourceAbilityId || '').split(':').pop() === 'paper_figurine_rebound') return true;
  if (!isReadableAbility(row) || value.isDot || value.isReaction || value.isReflect
    || value.recoveryKind === 'lifesteal'
    || (value.actorId != null && row?.actorId != null && value.actorId !== row.actorId)) return false;
  if (['heal', 'shield', 'revive'].includes(value.type)) return Number(value.amount ?? 1) > 0;
  if (value.type !== 'status' || value.beneficial === false) return false;
  if (value.beneficial === true || value.subtype === 'buff' || value.subtype === 'cleanse'
    || value.presentationEffect === 'beast_command') return true;
  // Older saved replays lack beneficial metadata. Recognize their structured
  // self-status names without depending on translated log text or skill IDs.
  return value.targetId != null && value.targetId === row?.actorId
    && ['guarded', 'evade', 'inspired', 'untargetable'].includes(value.status);
}

function isPositiveSupportPhase(row, phaseType, event) {
  return phaseType !== 'cast' && isPositiveSupportEvent(event, row);
}

function isCastOnlyAbilityRow(row) {
  return row?.type === 'turn' && isReadableAbility(row) && !row.timeline?.length;
}

function readableCastDuration(row) {
  if (!isReadableAbility(row)) return 300;
  const data = (typeof G9_DATA !== 'undefined' && G9_DATA.fx ? G9_DATA : null)
    || (typeof G9D !== 'undefined' ? G9D : {});
  const motion = data.fx?.sequence3Motion;
  if (!row?.isCounter && data.fx?.sequence3Abilities?.[presentationAbilityId(row)] && motion)
    return motion.anticipationMs + motion.activationMs + motion.sustainMs + motion.dissipateMs;
  return 800;
}

// One stable animation clock owns each phase. Effective 2x rates give active
// casts 800/1.6=500ms and support results 600/1.5=400ms. Forwarded rates remain
// unchanged; Read and compact playback keep their proportional rates.
function battleAnimationRate(row, speed = 1, phaseType, event) {
  const rate = [.5, 1, 1.5, 1.6, 2, 4].includes(Number(speed)) ? Number(speed) : 1;
  if (isPositiveSupportPhase(row, phaseType, event) && rate === 2) return 1.5;
  if (phaseType === 'cast' && isReadableAbility(row) && rate === 2) return 1.6;
  return rate;
}

function battlePresentationRate(playing, speed = 1) {
  const row = playing.turnRows[playing.currentTurn];
  const rate = [.5, 1, 2, 4].includes(Number(speed)) ? Number(speed) : 1;
  const casting = playing.eventCount === 0 && (row?.timeline?.length || isCastOnlyAbilityRow(row))
    && !row?.timeline?.[0]?.event?.isDot;
  const event = Number.isInteger(playing.eventCount) && playing.eventCount > 0
    ? row?.timeline?.[playing.eventCount - 1]?.event : null;
  const phaseType = casting ? 'cast' : event?.type === 'status' ? 'note' : event?.type;
  return battleAnimationRate(row, rate, phaseType, event);
}

// Hold each visible stage, including the final impact, before exposing the
// completed action. Ordinary actions take one second; ability casts, reactions
// and awakenings get their own reading time. Effects share this same clock.
function battlePresentationDelay(playing, speed = 1) {
  const row = playing.turnRows[playing.currentTurn];
  if (!row) return 0;
  const rate = battlePresentationRate(playing, speed);
  const timeline = row.timeline || [];
  const count = playing.eventCount;
  if (!timeline.length) {
    if (isCastOnlyAbilityRow(row)) return Number.isInteger(count) ? readableCastDuration(row) / rate : 0;
    return (row.isRoundHeader ? 300 : row.type === 'turn' ? 1000 : 400) / rate;
  }
  if (!Number.isInteger(count)) return 0;
  const periodic = !!timeline[0]?.event.isDot;
  const castDuration = periodic ? 0 : readableCastDuration(row);
  if (count === 0) return castDuration / rate;
  const weights = { damage: 225, reaction: 325, reflect: 275, heal: 200,
    shield: 200, mythical: 450, death: 350, revive: 300, note: 90 };
  const holds = timeline.map(step => isPositiveSupportEvent(step.event, row) ? 600 : Math.max(weights[step.type] || 90,
    step.event.presentationEffect && !step.event.presentationEffect.endsWith('_end') ? 250 : step.event.type === 'thread' ? 175 : 0));
  const total = castDuration + holds.reduce((sum, value) => sum + value, 0);
  const padding = count === timeline.length && !isPositiveSupportEvent(timeline[count - 1]?.event, row)
    ? Math.max(0, (periodic ? 300 : 1000) - total) : 0;
  const phaseHold = (holds[count - 1] || 0) + padding;
  return phaseHold / rate;
}


function battlePresentationDuration(playing) {
  return battlePresentationDelay(playing);
}

function advanceBattlePresentation(playing) {
  const row = playing.turnRows[playing.currentTurn];
  if (!row) return null;
  const timeline = row.timeline || [];
  if (!timeline.length) {
    if (isCastOnlyAbilityRow(row) && !Number.isInteger(playing.eventCount)) {
      playing.eventCount = 0;
      return { type: 'cast', event: row, row, next: null };
    }
    playing.currentTurn++;
    playing.eventCount = null;
    return { type: isCastOnlyAbilityRow(row) ? 'settle' : 'row', event: row, row };
  }
  if (!Number.isInteger(playing.eventCount)) {
    playing.eventCount = 0;
    // Periodic damage has no fresh attack or casting action to animate.
    if (!timeline[0]?.event.isDot) return { type: 'cast', event: row, row, next: timeline[0] };
  }
  if (playing.eventCount >= timeline.length) {
    playing.currentTurn++;
    playing.eventCount = null;
    return { type: 'settle', event: row, row };
  }
  const step = timeline[playing.eventCount++];
  return { ...step, row, next: timeline[playing.eventCount] || null };
}

// Presentation only: every endpoint and trigger comes from the resolved replay.
function createPathwayEffects(wrap) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const animations = new Set();
  const sourceColors = { fool: '#c5badf', door: '#91d1df', hanged_man: '#b0c897',
    paragon: '#e7bc79', moon: '#c8b9e8', chained: '#b998d0', sun: '#ead291',
    tyrant: '#a9cfe5', red_priest: '#df9b7a', demoness: '#cab0df', death: '#a6bebc' };
  let hpMap = Object.create(null), links = null, transient = null, speed = 1, paused = false;
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const canvas = () => wrap.querySelector('.gm-battlefield-canvas');
  const unit = id => id == null ? null : [...wrap.querySelectorAll('.gm-arena-unit')]
    .find(node => node.dataset.unitId === String(id));
  const state = id => id == null ? null : hpMap[id];
  const anchor = node => node?.querySelector('.gm-unit-sprite-anchor');
  const alive = id => {
    const entry = state(id);
    return !!entry && !!unit(id) && entry.alive !== false && entry.inCombat !== false && (entry.curHp ?? entry.hp ?? 1) > 0;
  };
  function visible(id) {
    const box = anchor(unit(id))?.getBoundingClientRect();
    const arena = wrap.querySelector('.gm-dungeon-arena')?.getBoundingClientRect();
    return !!box && !!arena && box.width > 0 && box.height > 0
      && box.right > Math.max(0, arena.left) && box.left < Math.min(window.innerWidth, arena.right)
      && box.bottom > Math.max(0, arena.top) && box.top < Math.min(window.innerHeight, arena.bottom);
  }
  function point(id) {
    const box = anchor(unit(id))?.getBoundingClientRect(), field = canvas()?.getBoundingClientRect();
    if (!box || !field || !box.width || !box.height || !field.width || !field.height) return null;
    return { x: box.left - field.left + box.width / 2, y: box.top - field.top + box.height / 2,
      radius: Math.max(8, Math.min(box.width, box.height) * .38) };
  }
  function svgElement(tag, attrs = {}) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }
  function layer(persistent) {
    let node = persistent ? links : transient;
    const field = canvas();
    if (!field) return null;
    if (!node?.isConnected) {
      node = svgElement('svg', { class: persistent ? 'gm-pathway-links' : 'gm-pathway-fx-layer',
        'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
      field.append(node);
      if (persistent) links = node; else transient = node;
    }
    const box = field.getBoundingClientRect();
    node.setAttribute('viewBox', `0 0 ${Math.max(1, box.width)} ${Math.max(1, box.height)}`);
    node.setAttribute('data-reduced-motion', String(reduced()));
    return node;
  }
  function identify(node, effect, ownerId, targetId) {
    node.setAttribute('data-effect', effect);
    if (ownerId != null) node.setAttribute('data-owner-id', String(ownerId));
    if (targetId != null) node.setAttribute('data-target-id', String(targetId));
    return node;
  }
  function curve(a, b, direction = 1) {
    const bend = direction * Math.min(16, Math.hypot(b.x - a.x, b.y - a.y) * .08);
    return `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + bend} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
  }
  function cancelAnimations() {
    for (const animation of [...animations]) animation.cancel();
    animations.clear();
  }
  function clearTransient() {
    cancelAnimations(); transient?.remove(); transient = null;
  }
  function animate(node, frames, duration) {
    if (!node?.animate || reduced() || speed >= 4) return;
    const animation = node.animate(frames, { duration, easing: 'ease-out', fill: 'none' });
    animation.playbackRate = speed;
    animations.add(animation);
    if (paused) animation.pause();
    animation.onfinish = () => { animations.delete(animation); animation.cancel(); node.remove(); };
    animation.oncancel = () => animations.delete(animation);
  }
  function append(node, effect, ownerId, targetId, duration) {
    const targetLayer = layer(false);
    if (!targetLayer || targetLayer.childElementCount >= 6) return null;
    identify(node, effect, ownerId, targetId); targetLayer.append(node);
    animate(node, [{ opacity: .85 }, { opacity: .5, offset: .7 }, { opacity: 0 }], duration);
    return node;
  }
  function ring(id, effect, className, color, ownerId, duration) {
    if (!visible(id)) return;
    const p = point(id);
    if (!p) return;
    append(svgElement('circle', { class: className, cx: p.x, cy: p.y, r: p.radius,
      style: `--gm-pathway-color:${color}` }), effect, ownerId ?? id, id, duration);
  }
  function connection(ownerId, targetId, effect, color, duration, className = 'gm-pathway-pulse') {
    if (!visible(ownerId) || !visible(targetId)) return;
    const a = point(ownerId), b = point(targetId);
    if (!a || !b) return;
    append(svgElement('path', { class: className, d: curve(a, b, effect.startsWith('curse') ? -1 : 1),
      style: `--gm-pathway-color:${color}` }), effect, ownerId, targetId, duration);
  }
  function sync(nextMap) {
    hpMap = nextMap || Object.create(null);
    if (!canvas()) return;
    const pending = [];
    // Iterate stable DOM IDs once: hpMap also contains name aliases.
    for (const node of wrap.querySelectorAll('.gm-arena-unit[data-unit-id]')) {
      const id = node.dataset.unitId, entry = state(id);
      if (!entry || !alive(id)) continue;
      for (const [kind, detail] of [['thread', entry.threadProgress], ['curse', entry.curseLink]]) {
        const ownerId = detail?.ownerId;
        if (ownerId == null || !alive(ownerId) || ownerId === id || (kind === 'curse' && detail.turns <= 0)) continue;
        const a = point(ownerId), b = point(id);
        if (!a || !b) continue;
        pending.push({ id, ownerId, kind, detail, a, b });
      }
    }
    if (!pending.length) { links?.remove(); links = null; return; }
    const targetLayer = layer(true);
    if (!targetLayer) return;
    targetLayer.replaceChildren();
    for (const { id, ownerId, kind, detail, a, b } of pending.slice(0, 32)) {
      const color = sourceColors[kind === 'thread' ? 'fool' : 'chained'];
      const path = identify(svgElement('path', { class: `gm-pathway-${kind}`, d: curve(a, b, kind === 'curse' ? -1 : 1),
        style: `--gm-pathway-color:${color}` }), kind, ownerId, id);
      targetLayer.append(path);
      if (kind === 'thread' && Number.isFinite(detail.max) && detail.max > 0) {
        const value = Math.max(0, Math.min(detail.max, Number(detail.value) || 0));
        const label = identify(svgElement('text', { class: 'gm-pathway-progress',
          x: (a.x + b.x) / 2 + 8, y: (a.y + b.y) / 2 - 5,
          'text-anchor': 'middle', style: `--gm-pathway-color:${color}` }), 'thread-progress', ownerId, id);
        label.textContent = `${Math.round(value)}/${Math.round(detail.max)}`;
        targetLayer.append(label);
      }
    }
  }
  function show(cue, playbackSpeed = 1, timingMs = 280) {
    clearTransient(); speed = Math.max(.1, Number(playbackSpeed) || 1);
    if (!cue) return;
    const event = cue.event || {}, row = cue.row || event;
    const actorId = event.actorId ?? row.actorId;
    const ownerId = event.ownerId ?? actorId;
    const targetId = event.targetId ?? row.targetId;
    const actor = state(actorId), effect = event.presentationEffect;
    const type = cue.type === 'row' ? event.type : cue.type;
    const cast = type === 'cast' || (cue.type === 'row' && !!row.abilityId);
    const duration = Math.max(240, Math.min(700, Number(timingMs) || 450));
    const power = event.ownedPower || row.ownedPower;
    // Explicit outcome markers take priority over inferred casting decoration.
    // In compact playback this also limits each action to one signature cue.
    if (effect === 'beast_command') {
      connection(ownerId, targetId, effect, sourceColors.moon, duration, 'gm-pathway-command');
      if (speed < 4) ring(targetId, effect, 'gm-pathway-command', sourceColors.moon, ownerId, duration);
      return;
    }
    if (effect === 'device_mark') {
      const companionId = event.companionId;
      if (state(companionId)?.companion?.kind === 'device') {
        connection(companionId, targetId, effect, sourceColors.paragon, duration);
        if (speed < 4) ring(companionId, effect, 'gm-pathway-muzzle', sourceColors.paragon, ownerId, duration);
      }
      return;
    }
    if (effect === 'curse_link' || effect === 'curse_echo') {
      connection(ownerId, targetId, effect, sourceColors.chained, duration);
      return;
    }
    if (type === 'thread' || event.type === 'thread') {
      const threadOwner = event.ownerId ?? state(targetId)?.threadProgress?.ownerId ?? actorId;
      connection(threadOwner, targetId, 'thread', sourceColors.fool, duration);
      return;
    }
    if (power === 'soul' && (cast || event.ownedPower === 'soul')) {
      if (!visible(actorId)) return;
      const p = point(actorId);
      if (!p) return;
      const radius = Math.min(14, p.radius * .65), color = sourceColors[event.sourcePath || row.sourcePath] || '#b7bdcf';
      const soul = svgElement('path', { class: 'gm-pathway-soul',
        d: `M ${p.x} ${p.y - radius} C ${p.x - radius} ${p.y - radius}, ${p.x - radius} ${p.y + radius * .5}, ${p.x - radius * .6} ${p.y + radius} L ${p.x - radius * .2} ${p.y + radius * .65} L ${p.x + radius * .2} ${p.y + radius} L ${p.x + radius * .55} ${p.y + radius * .65} C ${p.x + radius} ${p.y}, ${p.x + radius} ${p.y - radius}, ${p.x} ${p.y - radius} Z`,
        style: `--gm-pathway-color:${color}` });
      append(soul, 'soul', actorId, actorId, duration);
      return;
    }
    if (cast && (power === 'record' || (actor?.path === 'door' && row.abilityId !== 'basic_attack' && !row.attackKind && (row.abilityId || row.sourceAbilityId)))) {
      ring(actorId, 'portal', 'gm-pathway-portal', sourceColors.door, actorId, duration);
      if (speed < 4 && targetId != null && targetId !== actorId) ring(targetId, 'portal', 'gm-pathway-portal', sourceColors.door, actorId, duration);
      return;
    }
    if (['cast', 'damage'].includes(type) && actor?.companion?.kind === 'device') {
      // A historical machine is intentionally a different companion kind.
      const deviceOwner = actor.companion.ownerId;
      const p = point(actorId);
      if (!p || !visible(actorId)) return;
      const radius = Math.min(6, p.radius * .4);
      append(svgElement('path', { class: 'gm-pathway-muzzle',
        d: `M ${p.x - radius} ${p.y} L ${p.x + radius} ${p.y} M ${p.x} ${p.y - radius} L ${p.x} ${p.y + radius}`,
        style: `--gm-pathway-color:${sourceColors.paragon}` }), 'muzzle', deviceOwner, actorId, duration);
      if (speed < 4 && targetId != null) connection(actorId, targetId, 'device-shot', sourceColors.paragon, duration);
    }
  }
  return { sync, show,
    clear: () => { clearTransient(); links?.remove(); links = null; hpMap = Object.create(null); paused = false; },
    pause: () => { paused = true; for (const animation of animations) animation.pause(); },
    resume: () => { paused = false; for (const animation of animations) animation.play(); },
    setSpeed: value => { speed = Math.max(.1, Number(value) || 1); for (const animation of animations) animation.playbackRate = speed; }
  };
}

// Decorative effects follow the recorded replay cursor. Their animation clock
// never resolves combat or changes HP; the next replay phase owns the impact.
function createCombatFx(wrap) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const data = (typeof G9_DATA !== 'undefined' && G9_DATA.fx ? G9_DATA : null)
    || (typeof G9D !== 'undefined' ? G9D : typeof G9_DATA !== 'undefined' ? G9_DATA : {});
  const defaults = {
    damageColors: { default: '#c8b5ed', physical: '#f2c39b', fire: '#f39463', lightning: '#acdafa',
      dark: '#c6a0e8', corrosion: '#b1d982', frost: '#abd9ee', true: '#eee3cd' },
    families: {
      slash: { path: 'straight', size: 24, speedPxPerMs: 2.4, minMs: 80, maxMs: 260, afterimages: 0 },
      bolt: { path: 'straight', size: 14, speedPxPerMs: 2, minMs: 100, maxMs: 340, afterimages: 1 },
      beam: { path: 'straight', size: 10, speedPxPerMs: 3, minMs: 90, maxMs: 260, afterimages: 0 },
      orb: { path: 'arc', size: 16, speedPxPerMs: 1.25, minMs: 160, maxMs: 480, afterimages: 3 },
      shard: { path: 'arc', size: 16, speedPxPerMs: 1.6, minMs: 130, maxMs: 420, afterimages: 2 },
      wisp: { path: 'arc', size: 18, speedPxPerMs: 1.1, minMs: 180, maxMs: 500, afterimages: 3 },
      thread: { path: 'arc', size: 10, speedPxPerMs: 1.7, minMs: 130, maxMs: 420, afterimages: 2 },
      wave: { path: 'straight', size: 32, speedPxPerMs: 1.8, minMs: 140, maxMs: 460, afterimages: 1 }
    },
    pathwayDefaults: {}, pathwayDamageOverrides: {}, basicAttack: { melee: 'slash', unarmed: 'slash', gun: 'bolt', caster: 'orb', pathways: {} },
    impact: { frames: 4, durationMs: 160, critColor: '#ffa64d' }, support: { durationMs: 500 }, abilityChipMs: 500
  };
  const config = data.fx || defaults, animations = new Map(), preparedAssets = new Set();
  const casterPaths = new Set(['fool', 'door', 'visionary', 'sun', 'white_tower', 'hermit', 'paragon', 'wheel_of_fortune', 'moon']);
  let hpMap = Object.create(null), surface = null, chip = null, chipRow = null, speed = 1, paused = false, areaRows = new WeakSet();
  let phaseRow = null, phaseType = null, phaseEvent = null;
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const compact = () => reduced() || speed >= 4;
  const canvas = () => wrap.querySelector('.gm-battlefield-canvas');
  const unit = id => id == null ? null : [...wrap.querySelectorAll('.gm-arena-unit')].find(node => node.dataset.unitId === String(id));
  const state = id => id == null ? null : hpMap[id];
  const damageTypes = new Set(['damage', 'reaction', 'reflect']);
  function element(tag, attrs = {}) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }
  function layer() {
    const field = canvas();
    if (!field) return null;
    if (!surface?.isConnected) {
      surface = element('svg', { class: 'gm-combat-fx-layer', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
      field.append(surface);
    }
    const box = field.getBoundingClientRect();
    surface.setAttribute('viewBox', `0 0 ${Math.max(1, box.width)} ${Math.max(1, box.height)}`);
    surface.setAttribute('data-reduced-motion', String(reduced()));
    return surface;
  }
  function point(id) {
    const sprite = unit(id)?.querySelector('.gm-unit-sprite-anchor'), box = sprite?.getBoundingClientRect();
    const field = canvas()?.getBoundingClientRect(), arena = wrap.querySelector('.gm-dungeon-arena')?.getBoundingClientRect();
    if (!box || !field || !arena || !box.width || !box.height || !field.width || !field.height
      || box.bottom <= Math.max(0, arena.top) || box.top >= Math.min(window.innerHeight, arena.bottom)
      || box.right <= Math.max(0, arena.left) || box.left >= Math.min(window.innerWidth, arena.right)) return null;
    return { x: box.left - field.left + box.width / 2, y: box.top - field.top + box.height / 2,
      radius: Math.min(box.width, box.height) * .38, spriteWidth: box.width, spriteHeight: box.height };
  }
  function group(kind, ownerId, targetId, color) {
    const node = element('g', { class: kind, style: `--gm-fx-color:${color}` });
    if (ownerId != null) node.setAttribute('data-owner-id', ownerId);
    if (targetId != null) node.setAttribute('data-target-id', targetId);
    return node;
  }
  const S9_EFFECTS = {
    brutal_strike: 'data/assets/effects/brutal-strike.png',
    exploit_loophole: 'data/assets/effects/exploit-loophole.png',
    combat_theft: 'data/assets/effects/combat-theft.png',
    healing_touch: 'data/assets/effects/healing-touch.png'
  };
  function presentationAbility(row) {
    return String(row?.sourceAbilityId || row?.abilityId || '').split(':').pop();
  }
  function image(node, src, width, height, className = 'gm-combat-effect-image') {
    const art = element('image', { class: className, x: -width / 2, y: -height / 2, width, height,
      href: src, preserveAspectRatio: 'xMidYMid meet' });
    art.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', src);
    node.append(art);
    return art;
  }
  function animatedImage(kind, row, event, src, x, y, width, height, frames, duration) {
    const node = group(kind, event?.actorId ?? row.actorId, event?.targetId ?? null, '#e7c38d');
    node.setAttribute('data-effect-src', src);
    node.setAttribute('transform', `translate(${x} ${y})`);
    image(node, src, width, height);
    layer()?.append(node);
    if (!compact()) animate(node, frames, duration);
    return node;
  }
  function sequence8Config(row) {
    return config.sequence8Abilities?.[presentationAbility(row)];
  }
  const sequence3Damaging = new Set(['concealment_realm', 'dream_prison', 'despair_thread', 'energy_cannon', 'exorcism_charter']);
  const sequence3Reflect = new Set(['deceive_impact', 'flesh_mutation', 'thunder_god_stance']);
  function sequence3Config(row) {
    if (row?.attackKind || row?.isCounter || row?.isSkip || row?.abilityId === 'basic_attack') return;
    return config.sequence3Abilities?.[presentationAbility(row)];
  }
  function sequence3OwnEvent(row, event) {
    return sequence5OwnEvent(row, event) && (!event.sourceAbilityId || presentationAbility(event) === presentationAbility(row));
  }
  function sequence3Hit(row, event) {
    return sequence3Config(row) && sequence3OwnEvent(row, event)
      && sequence3Damaging.has(presentationAbility(row)) && damageTypes.has(event.type);
  }
  function prepareSequence3Asset(spec) {
    if (!spec || typeof window.Image !== 'function') return;
    for (const src of [spec.asset, spec.secondaryAsset].filter(Boolean)) {
      if (preparedAssets.has(src)) continue;
      preparedAssets.add(src);
      const preload = new window.Image(); preload.src = src;
    }
  }
  function sequence3Image(row, stage, targetId, p, geometry = {}) {
    const spec = sequence3Config(row), root = layer(), motion = config.sequence3Motion;
    if (!spec || !root || !p || !motion) return null;
    const mode = geometry.mode || spec.mode, moving = mode === 'travel';
    const reference = moving ? motion.travelWidth : motion.stationaryWidth;
    const anchor = point(targetId) || p, field = canvas().getBoundingClientRect();
    const arena = wrap.querySelector('.gm-dungeon-arena').getBoundingClientRect();
    const angle = geometry.angle || 0, radians = angle * Math.PI / 180;
    const peak = 1.12 * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)));
    const left = Math.max(0, field.left, arena.left) - field.left + 4;
    const right = Math.min(window.innerWidth, field.right, arena.right) - field.left - 4;
    const top = Math.max(0, field.top, arena.top) - field.top + 4;
    const bottom = Math.min(window.innerHeight, field.bottom, arena.bottom) - field.top - 4;
    const clearance = q => Math.min(q.x - left, right - q.x, q.y - top, bottom - q.y);
    // Match the approved 120/108 versus 104/92 reference progression at the
    // existing battle scale, then keep the complete activation inside view.
    const nominal = wrap.classList.contains('gallery-card') ? reference
      : effectHeight(anchor) * 1.14 * reference / (moving ? 92 : 104);
    const size = Math.min(nominal, 2 * Math.min(clearance(p), geometry.from ? clearance(geometry.from) : Infinity) / peak);
    if (!(size > 0)) return null;
    const src = geometry.asset || spec.asset, node = group('gm-combat-sequence3', row.actorId, targetId, spec.color);
    for (const [key, value] of Object.entries({ 'ability-id': presentationAbility(row), stage, mode,
      'effect-src': src, 'effect-width': size, 'effect-height': size, 'angle-deg': angle,
      'flight-path': geometry.flow ? 'straight' : 'stationary' })) node.setAttribute(`data-${key}`, value);
    if (geometry.flow) node.setAttribute('data-flow-direction', geometry.flow);
    node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    image(node, src, size, size, 'gm-combat-effect-image gm-combat-sequence3-image');
    root.append(node);
    return node;
  }
  function sequence3CastMotion(node, from, to, moving, hold) {
    if (!node || compact()) return;
    const motion = config.sequence3Motion;
    const total = motion.anticipationMs + motion.activationMs + motion.sustainMs + motion.dissipateMs;
    const a = motion.anticipationMs / total, b = (motion.anticipationMs + motion.activationMs) / total;
    const c = (motion.anticipationMs + motion.activationMs + motion.sustainMs) / total;
    const ward = node.dataset.mode === 'caster', angle = Number(node.dataset.angleDeg) || 0;
    const pose = (progress, scale) => `translate(${from.x + (to.x - from.x) * progress}px,${from.y + (to.y - from.y) * progress}px) rotate(${angle}deg) scale(${scale})`;
    animate(node, [
      { transform: pose(0, moving ? .4 : .56), opacity: ward || moving ? .12 : .06, offset: 0 },
      { transform: pose(0, moving ? .65 : ward ? .9 : .78), opacity: ward || moving ? .38 : .22, offset: a },
      { transform: pose(moving ? .5 : 1, 1.12), opacity: 1, offset: (a + b) / 2 },
      { transform: pose(1, 1), opacity: 1, offset: b },
      { transform: pose(1, ward ? 1 : moving ? .88 : .94), opacity: ward ? .76 : .55, offset: c },
      { transform: pose(1, .82), opacity: 0, offset: 1 }
    ], hold);
  }
  function sequence3Cast(row, phaseHold) {
    const spec = sequence3Config(row), actor = point(row.actorId);
    if (!spec || !actor) return;
    const id = presentationAbility(row), steps = (row.timeline || []).filter(step => sequence3OwnEvent(row, step.event));
    const active = targetId => state(targetId)?.alive !== false && state(targetId)?.inCombat !== false;
    const targets = spec.mode === 'caster'
      ? [row.actorId, ...(id === 'war_command' ? steps.filter(step => step.event.beneficial === true).map(step => step.event.targetId) : [])]
      : steps.filter(step => step.event.targetId != null && step.event.targetId !== row.actorId
        && !['heal', 'shield', 'revive'].includes(step.event.type) && step.event.beneficial !== true).map(step => step.event.targetId);
    if (!targets.length) {
      const targetId = row.targetId ?? row.presentationTargetId;
      if (targetId != null && targetId !== row.actorId) targets.push(targetId);
    }
    const hold = Math.max(1, Number(phaseHold) || readableCastDuration(row));
    for (const targetId of new Set(targets.filter(id => id != null && active(id)))) {
      const target = point(targetId); if (!target) continue;
      const moving = spec.mode === 'travel' && targetId !== row.actorId;
      const angle = moving ? Math.atan2(target.y - actor.y, target.x - actor.x) * 180 / Math.PI : 0;
      const node = sequence3Image(row, 'cast', targetId, target, { angle, flow: moving ? 'caster-to-target' : null, from: moving ? actor : null });
      sequence3CastMotion(node, moving ? actor : target, target, moving, hold);
    }
    if (id === 'concealment_realm') {
      const benefit = steps.find(step => step.event.status === 'untargetable' && step.event.beneficial === true);
      const targetId = benefit?.event.targetId ?? row.actorId, target = point(targetId);
      if (target) sequence3CastMotion(sequence3Image(row, 'cast-secondary', targetId, target,
        { asset: spec.secondaryAsset, mode: 'caster' }), target, target, false, hold);
    }
  }
  function sequence3Outcome(row, event, phaseHold) {
    if (!event) return;
    const source = String(event.sourceAbilityId || '').split(':').pop(), hold = Math.max(1, Number(phaseHold) || 500);
    if ((event.isReflect || event.type === 'reflect') && sequence3Reflect.has(source)) {
      const owner = { actorId: event.actorId, abilityId: source }, p = point(event.actorId);
      if (p) sequence5Pulse(sequence3Image(owner, 'guard', event.actorId, p, { mode: 'caster' }), p, 0, hold);
      return;
    }
    const spec = sequence3Config(row), id = presentationAbility(row);
    if (!spec || !sequence3OwnEvent(row, event) || event.targetId == null || event.recoveryKind === 'lifesteal') return;
    const targetId = event.targetId, p = point(targetId); if (!p) return;
    const positiveSupport = ['heal', 'shield'].includes(event.type) ? Number(event.amount) > 0
      : event.type === 'status' && event.beneficial === true;
    const control = { dream_prison: 'stunned', despair_thread: 'silenced', exorcism_charter: 'silenced', strict_prohibition: 'silenced' }[id];
    let asset, stage = 'outcome', angle = 0;
    if (sequence3Hit(row, event)) {
      asset = spec.asset; stage = 'impact';
      const actor = point(row.actorId);
      if (actor && spec.mode === 'travel') angle = Math.atan2(p.y - actor.y, p.x - actor.x) * 180 / Math.PI;
    } else if (id === 'concealment_realm' && positiveSupport && event.status === 'untargetable') asset = spec.secondaryAsset;
    else if (spec.mode === 'caster' && positiveSupport) asset = spec.asset;
    else if (control && event.type === 'status' && event.beneficial !== true && event.status === control) { asset = spec.asset; stage = 'impact'; }
    else if (id === 'underworld_domain' && event.type === 'status' && event.beneficial === false && event.subtype === 'debuff') asset = spec.asset;
    else if (['chaos_field', 'chaos_probability'].includes(id) && event.type === 'status'
      && event.beneficial === false && event.subtype === 'skill_misfire' && Number(event.chance) > 0) asset = spec.asset;
    if (!asset) return;
    sequence5Pulse(sequence3Image(row, stage, targetId, p, { asset, angle, mode: stage === 'outcome' ? 'support' : spec.mode }), p, angle, hold);
  }
  const sequence4Damaging = new Set(['bizarro_transformation', 'door_of_concealment', 'unshadowed_execution',
    'interdiction_roar', 'shadow_sword_execution', 'horror_domain', 'undying_rebirth_aura', 'unaging_mirror_clone',
    'fairy_tale_spell', 'scarlet_blood_domain', 'desire_ignition_burst', 'spiteful_shackles', 'magnify_disorder', 'imperator_s_decree']);
  const sequence4Directional = new Set(['bizarro_transformation', 'unaging_mirror_clone', 'interdiction_roar',
    'shadow_sword_execution', 'fairy_tale_spell', 'imperator_s_decree', 'unshadowed_execution']);
  function sequence4Config(row) {
    if (row?.attackKind || row?.isCounter || row?.isSkip || row?.abilityId === 'basic_attack') return;
    return config.sequence4Abilities?.[presentationAbility(row)];
  }
  function sequence4Hit(row, event) {
    return sequence4Config(row) && sequence5OwnEvent(row, event)
      && sequence4Damaging.has(presentationAbility(row)) && damageTypes.has(event.type);
  }
  function prepareSequence4Asset(spec) {
    if (!spec || typeof window.Image !== 'function') return;
    for (const src of [spec.asset, spec.secondaryAsset].filter(Boolean)) {
      if (preparedAssets.has(src)) continue;
      preparedAssets.add(src);
      const preload = new window.Image(); preload.src = src;
    }
  }
  function sequence4Image(row, stage, targetId, p, geometry = {}) {
    const spec = sequence4Config(row), root = layer();
    if (!spec || !root || !p) return null;
    const size = Math.min((canvas()?.getBoundingClientRect().width || 320) - 8, effectHeight(point(targetId) || p) * 1.14);
    const angle = geometry.angle || 0, src = geometry.asset || spec.asset;
    const node = group('gm-combat-sequence4', row.actorId, targetId, spec.color);
    for (const [key, value] of Object.entries({ 'ability-id': presentationAbility(row), stage, mode: geometry.mode || spec.mode,
      'effect-src': src, 'effect-width': size, 'effect-height': size, 'angle-deg': angle,
      'flight-path': geometry.flow ? 'straight' : 'stationary' })) node.setAttribute(`data-${key}`, value);
    if (geometry.flow) node.setAttribute('data-flow-direction', geometry.flow);
    node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    image(node, src, size, size, 'gm-combat-effect-image gm-combat-sequence4-image');
    root.append(node);
    return node;
  }
  function sequence4Flight(node, from, to, angle, hold) {
    if (!node || compact()) return;
    const pose = (progress, scale) => `translate(${from.x + (to.x - from.x) * progress}px,${from.y + (to.y - from.y) * progress}px) rotate(${angle}deg) scale(${scale})`;
    animate(node, [{ transform: pose(0, .56), opacity: 0 }, { transform: pose(.1, .88), opacity: 1, offset: .16 },
      { transform: pose(.58, 1), opacity: .98, offset: .62 }, { transform: pose(1, 1.04), opacity: .95, offset: .88 },
      { transform: pose(1, .9), opacity: 0 }], hold);
  }
  function sequence4Cast(row, phaseHold) {
    const spec = sequence4Config(row), actor = point(row.actorId);
    if (!spec || !actor) return;
    const id = presentationAbility(row), hold = Math.max(1, Number(phaseHold) || readableCastDuration(row));
    const targets = spec.mode === 'caster' ? [row.actorId] : [...new Set((row.timeline || [])
      .filter(step => sequence5OwnEvent(row, step.event) && step.event.targetId != null
        && step.event.targetId !== row.actorId && !['heal', 'shield', 'revive'].includes(step.event.type)
        && step.event.beneficial !== true).map(step => step.event.targetId))];
    if (!targets.length) {
      const targetId = row.targetId ?? row.presentationTargetId;
      if (targetId != null && targetId !== row.actorId) targets.push(targetId);
    }
    for (const targetId of targets) {
      const target = point(targetId); if (!target) continue;
      const moving = spec.mode === 'travel' && targetId !== row.actorId;
      const angle = sequence4Directional.has(id) && targetId !== row.actorId
        ? Math.atan2(target.y - actor.y, target.x - actor.x) * 180 / Math.PI : 0;
      const node = sequence4Image(row, 'cast', targetId, target, { angle, flow: moving ? 'caster-to-target' : null });
      if (moving) sequence4Flight(node, actor, target, angle, hold);
      else sequence5Pulse(node, target, angle, hold);
    }
    // These are simultaneous cast attempts. Recovery and SP return wait for their recorded results.
    if (['bizarro_transformation', 'undying_rebirth_aura', 'nature_s_growth_surge'].includes(id)) {
      const benefit = (row.timeline || []).find(step => sequence5OwnEvent(row, step.event)
        && step.event.targetId != null && (['heal', 'shield'].includes(step.event.type) || step.event.beneficial === true));
      const targetId = benefit?.event.targetId ?? row.actorId, target = point(targetId);
      if (target) sequence5Pulse(sequence4Image(row, 'cast-secondary', targetId, target,
        { asset: spec.secondaryAsset, mode: 'caster' }), target, 0, hold);
    }
  }
  function sequence4Outcome(row, event, phaseHold) {
    if (!event) return;
    const source = String(event.sourceAbilityId || '').split(':').pop();
    const hold = Math.max(1, Number(phaseHold) || 500);
    if (event.isReflect && source === 'prophetic_intervention') {
      const guard = { actorId: event.actorId, abilityId: source }, p = point(event.actorId);
      if (p) sequence5Pulse(sequence4Image(guard, 'guard', event.actorId, p, { mode: 'support' }), p, 0, hold);
      return;
    }
    if (event.type === 'status' && Number(event.amount) > 0
      && (event.subtype === 'sp_siphon' && source === 'scarlet_blood_domain'
        || event.subtype === 'parasite_tick' && source === 'parasitic_contagion')) {
      const owner = { actorId: event.actorId, abilityId: source }, actor = point(event.actorId), target = point(event.targetId);
      if (!actor || !target) return;
      if (source === 'parasitic_contagion') {
        sequence5Pulse(sequence4Image(owner, 'outcome', event.targetId, target), target, 0, hold);
      } else if (Number(event.spGain) > 0) {
        const angle = Math.atan2(actor.y - target.y, actor.x - target.x) * 180 / Math.PI;
        const node = sequence4Image(owner, 'outcome', event.actorId, actor, {
          asset: sequence4Config(owner)?.secondaryAsset, mode: 'travel', angle, flow: 'target-to-caster' });
        sequence4Flight(node, target, actor, angle, hold);
      }
      return;
    }
    const spec = sequence4Config(row), id = presentationAbility(row);
    if (!spec || !sequence5OwnEvent(row, event) || event.targetId == null) return;
    const targetId = event.targetId, p = point(targetId); if (!p) return;
    const positiveHeal = event.type === 'heal' && Number(event.amount) > 0;
    const positiveShield = event.type === 'shield' && Number(event.amount) > 0;
    const positiveStatus = event.type === 'status' && (event.beneficial === true || event.subtype === 'cleanse');
    const control = { door_of_concealment: 'silenced', unaging_mirror_clone: 'frozen', fairy_tale_spell: 'polymorphed',
      spiteful_shackles: 'bound', nature_s_growth_surge: 'bound', horror_domain: 'stunned' }[id];
    let asset, stage = 'outcome', angle = 0;
    if (sequence4Hit(row, event)) {
      asset = spec.asset; stage = 'impact';
      const actor = point(row.actorId);
      if (actor && sequence4Directional.has(id)) angle = Math.atan2(p.y - actor.y, p.x - actor.x) * 180 / Math.PI;
    } else if (id === 'bizarro_transformation' && positiveStatus && event.status === 'evade') asset = spec.secondaryAsset;
    else if (id === 'undying_rebirth_aura' && positiveShield) asset = spec.secondaryAsset;
    else if (id === 'nature_s_growth_surge' && positiveHeal) asset = spec.secondaryAsset;
    else if (id === 'shadow_sword_execution' && positiveHeal && event.recoveryKind === 'ability') asset = spec.secondaryAsset;
    else if (spec.mode === 'caster' && (positiveStatus || positiveShield)) asset = spec.asset;
    else if (control && event.type === 'status' && event.beneficial !== true && event.status === control) {
      asset = spec.asset; stage = 'impact';
    }
    if (!asset) return;
    sequence5Pulse(sequence4Image(row, stage, targetId, p, { asset, angle, mode: stage === 'outcome' ? 'support' : spec.mode }), p, angle, hold);
  }
  const sequence5Damaging = new Set(['order_distortion', 'soul_pacification', 'zombie_transformation', 'blink_strike',
    'soul_drain', 'law_enforcement', 'holy_sun_bolt', 'ocean_calling', 'dream_tether']);
  function sequence5Config(row) {
    if (row?.attackKind || row?.isCounter || row?.isSkip || row?.abilityId === 'basic_attack') return;
    return config.sequence5Abilities?.[presentationAbility(row)];
  }
  function sequence5OwnEvent(row, event) {
    return event && !event.isDot && !event.isReflect && event.type !== 'reflect'
      && (!(event.isReaction || event.type === 'reaction') || event.isSignature)
      && (event.actorId == null || event.actorId === row.actorId);
  }
  function sequence5Hit(row, event) {
    return sequence5Config(row) && sequence5OwnEvent(row, event)
      && sequence5Damaging.has(presentationAbility(row)) && damageTypes.has(event.type);
  }
  function prepareSequence5Asset(spec) {
    if (!spec || typeof window.Image !== 'function') return;
    for (const src of [spec.asset, spec.secondaryAsset].filter(Boolean)) {
      if (preparedAssets.has(src)) continue;
      preparedAssets.add(src);
      const preload = new window.Image(); preload.src = src;
    }
  }
  function sequence5Image(row, stage, targetId, p, geometry = {}) {
    const spec = sequence5Config(row), root = layer();
    if (!spec || !root || !p) return null;
    const size = Math.min((canvas()?.getBoundingClientRect().width || 320) - 8, effectHeight(point(targetId) || p) * 1.14);
    const width = geometry.width || size, height = geometry.height || size, angle = geometry.angle || 0;
    const src = geometry.asset || spec.asset, node = group('gm-combat-sequence5', row.actorId, targetId, spec.color);
    for (const [key, value] of Object.entries({ 'ability-id': presentationAbility(row), stage, mode: geometry.mode || spec.mode,
      'effect-src': src, 'effect-width': width, 'effect-height': height, 'angle-deg': angle,
      'flight-path': geometry.flightPath || 'stationary' })) node.setAttribute(`data-${key}`, value);
    if (geometry.flow) node.setAttribute('data-flow-direction', geometry.flow);
    node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    const art = image(node, src, width, height, 'gm-combat-effect-image gm-combat-sequence5-image');
    if (geometry.stretch) art.setAttribute('preserveAspectRatio', 'none');
    root.append(node);
    return node;
  }
  function sequence5Pulse(node, p, angle, duration, fixedSpan = false) {
    if (!node || compact()) return;
    const pose = scale => `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(${fixedSpan ? '1,' : ''}${scale})`;
    animate(node, [{ transform: pose(.76), opacity: 0 }, { transform: pose(1), opacity: 1, offset: .18 },
      { transform: pose(1.03), opacity: .95, offset: .84 }, { transform: pose(.96), opacity: 0 }], duration);
  }
  function sequence5Cast(row, phaseHold) {
    const spec = sequence5Config(row), actor = point(row.actorId);
    if (!spec || !actor) return;
    const endpointRow = { ...row, targetId: row.targetId ?? row.presentationTargetId };
    const id = presentationAbility(row), targetId = sequence6Endpoint(endpointRow, spec.mode), target = point(targetId);
    if (!target) return;
    if (!['caster', 'support'].includes(spec.mode) && targetId === row.actorId && row.targetId == null
      && !(row.timeline || []).some(step => sequence5OwnEvent(row, step.event)
        && damageTypes.has(step.type) && step.event.targetId === targetId)) return;
    const hold = Math.max(1, Number(phaseHold) || readableCastDuration(row));
    const span = ['thread_binding', 'dream_tether'].includes(id) && targetId !== row.actorId;
    const reverse = id === 'soul_drain' && targetId !== row.actorId;
    const moving = spec.mode === 'travel' && targetId !== row.actorId;
    const from = reverse ? target : actor, toward = reverse ? actor : target;
    // Extraction fades before reaching the caster; this is SP theft, not an HP-heal pulse.
    const end = reverse ? { x: from.x + (toward.x - from.x) * .82, y: from.y + (toward.y - from.y) * .82 } : toward;
    const directional = moving || span || sequence5Damaging.has(id);
    const angle = directional ? Math.atan2(end.y - from.y, end.x - from.x) * 180 / Math.PI : 0;
    const center = span ? { x: (actor.x + target.x) / 2, y: (actor.y + target.y) / 2 } : moving ? end : target;
    const geometry = { angle, flow: moving || span ? reverse ? 'target-to-caster' : 'caster-to-target' : null,
      flightPath: span ? 'stationary-attacker-to-target-span' : moving ? 'straight' : 'stationary' };
    if (span) Object.assign(geometry, { width: Math.hypot(target.x - actor.x, target.y - actor.y),
      height: Math.max(12, effectHeight(target) * (id === 'thread_binding' ? .24 : .16)), stretch: true });
    const node = sequence5Image(row, 'cast', targetId, center, geometry);
    if (node && !compact() && moving) {
      const pose = (progress, scale) => `translate(${from.x + (end.x - from.x) * progress}px,${from.y + (end.y - from.y) * progress}px) rotate(${angle}deg) scale(${scale})`;
      animate(node, [{ transform: pose(0, .56), opacity: 0 }, { transform: pose(.1, .88), opacity: 1, offset: .16 },
        { transform: pose(.58, 1), opacity: .98, offset: .62 }, { transform: pose(1, 1.04), opacity: .95, offset: .88 },
        { transform: pose(1, .9), opacity: 0 }], hold);
    } else sequence5Pulse(node, center, angle, hold, span);
    if (spec.secondaryAsset) {
      const benefit = (row.timeline || []).find(step => sequence5OwnEvent(row, step.event)
        && step.event.type === 'status' && step.event.beneficial === true && step.event.targetId != null
        && (id === 'blink_strike' ? step.event.status === 'evade' : step.event.subtype === 'buff'
          && (!step.event.stat || step.event.stat === (id === 'zombie_transformation' ? 'def' : 'int'))));
      const secondaryId = id === 'corrupted_flesh' ? sequence6Endpoint(endpointRow, 'travel') : benefit?.event.targetId ?? row.actorId;
      if (id === 'corrupted_flesh' && secondaryId === row.actorId) return;
      const p = point(secondaryId);
      if (p) sequence5Pulse(sequence5Image(row, 'cast-secondary', secondaryId, p,
        { asset: spec.secondaryAsset, mode: id === 'corrupted_flesh' ? 'strike' : 'caster' }), p, 0, hold);
    }
  }
  function sequence5Outcome(row, event, phaseHold) {
    const spec = sequence5Config(row), id = presentationAbility(row);
    if (!spec || !sequence5OwnEvent(row, event) || event.targetId == null || event.recoveryKind === 'lifesteal') return;
    const targetId = event.targetId, p = point(targetId);
    if (!p) return;
    let asset, stage = 'outcome', angle = 0;
    const positiveHeal = event.type === 'heal' && Number(event.amount) > 0;
    const positiveStatus = event.type === 'status' && (event.beneficial === true || event.subtype === 'cleanse');
    const buff = positiveStatus && event.subtype === 'buff';
    const controlStatus = { desire_control: 'silenced', logic_distortion: 'distorted_logic', constellation_constrain: 'bound' }[id];
    if (sequence5Hit(row, event)) {
      asset = spec.asset; stage = 'impact';
      const actor = point(row.actorId);
      if (actor && ['travel', 'strike'].includes(spec.mode)) angle = id === 'soul_drain'
        ? Math.atan2(actor.y - p.y, actor.x - p.x) * 180 / Math.PI : Math.atan2(p.y - actor.y, p.x - actor.x) * 180 / Math.PI;
    } else if (id === 'corrupted_flesh' && positiveHeal && targetId === row.actorId) asset = spec.asset;
    else if (id === 'life_bloom' && positiveHeal) asset = spec.asset;
    else if (id === 'zombie_transformation' && buff && (!event.stat || event.stat === 'def')) asset = spec.secondaryAsset;
    else if (id === 'blink_strike' && positiveStatus && event.status === 'evade') asset = spec.secondaryAsset;
    else if (id === 'dream_tether' && buff && (!event.stat || event.stat === 'int')) asset = spec.secondaryAsset;
    else if (id === 'mirror_substitution' && positiveStatus && (event.subtype === 'cleanse' || event.status === 'evade')) asset = spec.asset;
    else if (id === 'prophetic_evade' && positiveStatus && event.status === 'evade') asset = spec.asset;
    else if (['vampire_transformation', 'matter_fortification', 'guardian_stance'].includes(id)
      && (positiveStatus || id === 'guardian_stance' && event.type === 'shield' && Number(event.amount) > 0)) asset = spec.asset;
    else if (controlStatus && event.type === 'status' && event.beneficial !== true
      && event.status === controlStatus) { asset = spec.asset; stage = 'impact'; }
    // Casts show an attempt. Only the recorded result can add a support or control outcome.
    if (!asset) return;
    const node = sequence5Image(row, stage, targetId, p, { asset, angle, mode: stage === 'outcome' ? 'support' : spec.mode });
    sequence5Pulse(node, p, angle, Math.max(1, Number(phaseHold) || (stage === 'outcome' ? 500 : 225)));
  }
  function sequence6Config(row) {
    return config.sequence6Abilities?.[presentationAbility(row)];
  }
  function prepareSequence6Asset(spec) {
    if (!spec || typeof window.Image !== 'function') return;
    if (preparedAssets.has(spec.asset) && (!spec.ghostAsset || preparedAssets.has(spec.ghostAsset))) return;
    for (const src of [spec.asset, spec.ghostAsset].filter(Boolean)) {
      if (preparedAssets.has(src)) continue;
      preparedAssets.add(src);
      const preload = new window.Image(); preload.src = src;
    }
  }
  function sequence6Endpoint(row, mode) {
    if (mode === 'caster') return row.actorId;
    const steps = row.timeline || [];
    const own = event => event.actorId == null || event.actorId === row.actorId;
    const targetEvent = steps.find(step => own(step.event) && step.event.targetId != null
      && damageTypes.has(step.type) && !step.event.isDot && !step.event.isReaction && !step.event.isReflect)
      || steps.find(step => own(step.event) && step.event.targetId != null
        && step.event.targetId !== row.actorId && !['heal', 'shield', 'revive'].includes(step.type));
    const supportEvent = steps.find(step => own(step.event) && step.event.targetId != null
      && ['heal', 'shield', 'revive'].includes(step.type) && Number(step.event.amount ?? 1) > 0);
    return mode === 'support' ? (supportEvent?.event.targetId ?? row.actorId)
      : (targetEvent?.event.targetId ?? row.targetId ?? row.actorId);
  }
  function sequence6Image(row, stage, targetId, mode, p, geometry = {}) {
    const spec = sequence6Config(row), root = layer();
    if (!spec || !root || !p) return null;
    const size = Math.min((canvas()?.getBoundingClientRect().width || 320) - 8, effectHeight(point(targetId) || p) * 1.14);
    const width = Number(geometry.width) > 0 ? Number(geometry.width) : size;
    const height = Number(geometry.height) > 0 ? Number(geometry.height) : size;
    const src = geometry.asset || spec.asset;
    const node = group('gm-combat-sequence6', row.actorId, targetId, spec.color);
    for (const [key, value] of Object.entries({ 'ability-id': presentationAbility(row), stage, mode,
      'effect-src': src, 'effect-width': width, 'effect-height': height })) node.setAttribute(`data-${key}`, value);
    node.setAttribute('transform', `translate(${p.x} ${p.y})`);
    image(node, src, width, height, 'gm-combat-effect-image gm-combat-sequence6-image');
    if (geometry.stretch) node.querySelector('image')?.setAttribute('preserveAspectRatio', 'none');
    root.append(node);
    return node;
  }
  function sequence6Cast(row, phaseHold) {
    const spec = sequence6Config(row), actor = point(row.actorId);
    if (!spec || !actor) return;
    let mode = spec.mode, targetId = sequence6Endpoint(row, mode);
    const abilityId = presentationAbility(row);
    if (abilityId === 'depravity_mark' && row.targetId != null && point(row.targetId)) { mode = 'strike'; targetId = row.targetId; }
    const deathTargetId = abilityId === 'spirit_body_door'
      ? (row.targetId != null && point(row.targetId) ? row.targetId : sequence6Endpoint(row, 'travel')) : targetId;
    if (abilityId === 'spirit_body_door' && deathTargetId != null) targetId = deathTargetId;
    if (mode === 'support' && targetId === row.actorId && row.targetId != null && point(row.targetId)) targetId = row.targetId;
    const target = point(targetId);
    if (!target) { mode = 'caster'; targetId = row.actorId; }
    const destination = point(targetId) || actor;
    const spanLightning = abilityId === 'lightning_bolt' && mode === 'travel' && targetId !== row.actorId;
    const spanThread = abilityId === 'affliction_thread' && targetId !== row.actorId;
    const moving = mode === 'travel' && targetId !== row.actorId && !spanLightning && !spanThread;
    const rustSiphon = abilityId === 'rust_siphon' && targetId !== row.actorId;
    const deathDoor = abilityId === 'spirit_body_door' && deathTargetId !== row.actorId;
    const midpoint = spanLightning || rustSiphon || spanThread ? { x: (actor.x + destination.x) / 2, y: (actor.y + destination.y) / 2 } : null;
    const angle = rustSiphon ? 180 : (moving || spanLightning || spanThread) ? Math.atan2(destination.y - actor.y, destination.x - actor.x) * 180 / Math.PI : 0;
    const spanWidth = spanLightning || spanThread ? Math.hypot(destination.x - actor.x, destination.y - actor.y) : 0;
    const spanHeight = spanLightning ? Math.max(24, effectHeight(point(targetId) || destination) * 1.12)
      : spanThread ? Math.max(12, effectHeight(point(targetId) || destination) * .28) : 0;
    const node = sequence6Image(row, 'cast', deathDoor ? row.actorId : targetId, deathDoor ? 'caster' : mode,
      spanLightning || rustSiphon || spanThread ? midpoint : (deathDoor || mode === 'caster' ? actor : moving ? destination : destination),
      spanLightning || spanThread ? { width: spanWidth, height: spanHeight, stretch: true } : undefined);
    if (!node) return;
    node.setAttribute('data-angle-deg', String(angle));
    node.setAttribute('data-flight-path', spanLightning ? 'attacker-to-target-span' : spanThread ? 'stationary-attacker-to-target-span' : rustSiphon ? 'stationary-midpoint' : moving ? 'straight' : 'stationary');
    if (moving || spanLightning || spanThread) node.setAttribute('data-flow-direction', 'caster-to-target');
    if (rustSiphon) node.setAttribute('transform', `translate(${midpoint.x} ${midpoint.y}) rotate(180)`);
    if (deathDoor && spec.ghostAsset) {
      node.setAttribute('data-flight-path', 'stationary-caster-door');
      const ghost = sequence6Image(row, 'ghost-travel', targetId, 'travel', actor, { asset: spec.ghostAsset });
      if (ghost) {
        const soulAngle = Math.atan2(destination.y - actor.y, destination.x - actor.x) * 180 / Math.PI;
        const soulPose = (x, y, scale) => `translate(${x}px,${y}px) rotate(${soulAngle}deg) scale(${scale})`;
        ghost.setAttribute('data-flight-path', 'caster-to-target');
        ghost.setAttribute('data-flow-direction', 'caster-to-target');
        ghost.setAttribute('data-angle-deg', String(soulAngle));
        ghost.setAttribute('data-orientation', 'toward-target');
        if (!compact()) animate(ghost, [
          { transform: soulPose(actor.x, actor.y, .55), opacity: 0 },
          { transform: soulPose(actor.x + (destination.x-actor.x)*.18, actor.y + (destination.y-actor.y)*.18, .85), opacity: 1, offset: .18 },
          { transform: soulPose(actor.x + (destination.x-actor.x)*.64, actor.y + (destination.y-actor.y)*.64, 1), opacity: 1, offset: .68 },
          { transform: soulPose(destination.x, destination.y, 1.05), opacity: 1, offset: .88 },
          { transform: soulPose(destination.x, destination.y, .9), opacity: 0 }
        ], Math.max(1, Number(phaseHold) || readableCastDuration(row)), 140);
      }
      // The door stays visibly open around the traveler for the whole cast phase.
      if (!compact()) animate(node, [
        { transform: `translate(${actor.x}px,${actor.y}px)`, opacity: .25 },
        { transform: `translate(${actor.x}px,${actor.y}px) scale(1.04)`, opacity: 1, offset: .16 },
        { transform: `translate(${actor.x}px,${actor.y}px) scale(1)`, opacity: 1, offset: .94 },
        { transform: `translate(${actor.x}px,${actor.y}px) scale(.98)`, opacity: .9 }
      ], Math.max(1, Number(phaseHold) || readableCastDuration(row)) + 140);
    }
    if (deathDoor) return;
    const hold = Math.max(1, Number(phaseHold) || readableCastDuration(row));
    if (compact()) return;
    const pose = (progress, scale = 1) => {
      const x = spanLightning || rustSiphon || spanThread ? midpoint.x : deathDoor || mode === 'caster' ? actor.x : moving ? actor.x + (destination.x - actor.x) * progress : destination.x;
      const y = spanLightning || rustSiphon || spanThread ? midpoint.y : deathDoor || mode === 'caster' ? actor.y : moving ? actor.y + (destination.y - actor.y) * progress : destination.y;
      return `translate(${x}px,${y}px) rotate(${angle}deg) scale(${scale}${spanLightning ? ',1' : ''})`;
    };
    if (spanLightning) {
      animate(node, [
        { transform: pose(0, 1), opacity: 0 },
        { transform: pose(0, 1), opacity: 1, offset: .08 },
        { transform: pose(0, 1), opacity: 1, offset: .76 },
        { transform: pose(0, 1), opacity: 0 }
      ], hold);
      return;
    }
    animate(node, moving ? [
      { transform: pose(0, .56), opacity: 0 },
      { transform: pose(.1, .88), opacity: 1, offset: .16 },
      { transform: pose(.58, 1), opacity: .98, offset: .62 },
      { transform: pose(1, 1.04), opacity: .95, offset: .88 },
      { transform: pose(1, .9), opacity: 0 }
    ] : [
      { transform: pose(0, .72), opacity: 0 },
      { transform: pose(0, 1), opacity: 1, offset: .18 },
      { transform: pose(0, 1.03), opacity: .95, offset: .84 },
      { transform: pose(0, .96), opacity: 0 }
    ], hold);
  }
  function sequence6Outcome(row, event, phaseHold) {
    const spec = sequence6Config(row);
    if (!spec || !event || event.isDot || event.isReflect || ['lightning_bolt', 'spirit_body_door'].includes(presentationAbility(row))
      || (event.actorId != null && event.actorId !== row.actorId)) return;
    const support = ['heal', 'shield', 'revive'].includes(event.type) && Number(event.amount ?? 1) > 0
      || event.type === 'status' && (event.beneficial === true || event.subtype === 'cleanse');
    const hit = damageTypes.has(event.type) && !event.isReaction;
    const hostileStatus = event.type === 'status' && event.targetId != null && event.targetId !== row.actorId;
    if (!support && !hit && !hostileStatus) return;
    const id = event.targetId ?? row.actorId;
    // Offensive art is the cast/hit effect, not a second image for a side support result.
    // The regular heal/shield/status cue and number remain drawn by support().
    if (support && id === row.actorId && !['support', 'caster'].includes(spec.mode)) return;
    const p = point(id);
    if (!p) return;
    const node = sequence6Image(row, support ? 'outcome' : hostileStatus ? 'impact' : 'impact', id, support ? 'support' : spec.mode, p);
    if (!node) return;
    const actor = point(event.actorId ?? row.actorId);
    const angle = presentationAbility(row) === 'rust_siphon' ? 180 : spec.mode === 'travel' && actor
      ? Math.atan2(p.y - actor.y, p.x - actor.x) * 180 / Math.PI : 0;
    let impactX = p.x, impactY = p.y;
    if (presentationAbility(row) === 'rust_siphon' && actor) {
      const midpoint = { x: (actor.x+p.x)/2, y: (actor.y+p.y)/2 };
      impactX = midpoint.x; impactY = midpoint.y;
      node.setAttribute('data-flight-path','stationary-midpoint');
    }
    node.setAttribute('data-angle-deg', String(angle));
    node.setAttribute('transform', `translate(${impactX} ${impactY}) rotate(${angle})`);
    if (!compact()) animate(node, [
      { transform: `translate(${impactX}px,${impactY}px) rotate(${angle}deg) scale(.76)`, opacity: .18 },
      { transform: `translate(${impactX}px,${impactY}px) rotate(${angle}deg) scale(1.06)`, opacity: 1, offset: .24 },
      { transform: `translate(${impactX}px,${impactY}px) rotate(${angle}deg) scale(1)`, opacity: .92, offset: .68 },
      { transform: `translate(${impactX}px,${impactY}px) rotate(${angle}deg) scale(.9)`, opacity: 0 }
    ], Math.max(1, Number(phaseHold) || (support ? 500 : 225)));
  }
  function prepareSequence6Assets(map) {
    const paths = new Set(Object.values(map || {}).filter(entry => entry && Number(entry.sequence) <= 6).map(entry => entry.path));
    for (const spec of Object.values(config.sequence6Abilities || {})) if (paths.has(spec.pathway)) prepareSequence6Asset(spec);
  }
  function sequence7Config(row) {
    return config.sequence7Abilities?.[presentationAbility(row)];
  }
  function prepareSequence8Asset(spec) {
    if (!spec || typeof window.Image !== 'function') return;
    for (const src of [spec.asset, spec.fallbackAsset].filter(Boolean)) {
      if (preparedAssets.has(src)) continue;
      preparedAssets.add(src);
      const preload = new window.Image(); preload.src = src;
    }
  }
  function prepareSequence7Asset(spec) {
    if (!spec || typeof window.Image !== 'function') return;
    for (const src of [spec.asset, spec.reflectAsset].filter(Boolean)) {
      if (preparedAssets.has(src)) continue;
      preparedAssets.add(src);
      const preload = new window.Image(); preload.src = src;
    }
  }
  function sequence7Direction(row, targetId, reflecting = false) {
    const spec = sequence7Config(row), actor = point(row.actorId), target = point(targetId);
    if (!spec || !actor || !target) return null;
    const reverse = !reflecting && spec.travelDirection === 'target_to_caster';
    const from = reverse ? target : actor, to = reverse ? actor : target;
    const flowAngle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    const nativeAngle = reflecting ? 0 : Number(spec.nativeAngleDeg) || 0;
    return { from, to, flowAngle, nativeAngle, angle: flowAngle - nativeAngle,
      fromId: reverse ? targetId : row.actorId, toId: reverse ? row.actorId : targetId };
  }
  function sequence7Image(row, stage, targetId, mode, p, assetOverride, direction) {
    const spec = sequence7Config(row), root = layer();
    if (!spec || !root || !p) return null;
    const src = assetOverride || spec.asset;
    const size = Math.min((canvas()?.getBoundingClientRect().width || 320) - 8, effectHeight(point(targetId) || p) * 1.25);
    const travel = direction || (mode === 'travel' ? sequence7Direction(row, targetId, stage === 'reflect') : null);
    const angle = travel?.angle || 0;
    const node = group('gm-combat-sequence7', row.actorId, targetId, spec.color);
    for (const [key, value] of Object.entries({ 'ability-id': presentationAbility(row), stage, mode, 'effect-src': src, 'angle-deg': angle })) node.setAttribute(`data-${key}`, value);
    if (travel) for (const [key, value] of Object.entries({ 'flow-angle-deg': travel.flowAngle,
      'native-angle-deg': travel.nativeAngle, 'flow-from-id': travel.fromId, 'flow-to-id': travel.toId })) node.setAttribute(`data-${key}`, value);
    node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    image(node, src, size, size, 'gm-combat-effect-image gm-combat-sequence7-image');
    root.append(node);
    return node;
  }
  function prepareSequence7Assets(map) {
    const paths = new Set(Object.values(map || {}).filter(entry => entry && Number(entry.sequence) <= 7).map(entry => entry.path));
    for (const spec of Object.values(config.sequence7Abilities || {})) if (paths.has(spec.pathway)) prepareSequence7Asset(spec);
  }
  function sequence7Endpoint(row, mode) {
    if (mode === 'caster') return row.actorId;
    const steps = row.timeline || [];
    const own = event => event.actorId == null || event.actorId === row.actorId;
    // Copied powers can first narrate their reproduction on the enemy. That
    // narration is not a support recipient; prefer the actual recovery/ward.
    const recovery = steps.find(step => own(step.event) && step.event.targetId != null
      && ['heal', 'shield'].includes(step.type));
    const selfStatus = steps.find(step => own(step.event) && step.event.targetId === row.actorId
      && step.event.type === 'status' && (step.event.status || step.event.subtype === 'cleanse'));
    const outcome = recovery || selfStatus;
    const hit = steps.find(step => own(step.event) && step.event.targetId != null
      && damageTypes.has(step.type) && !step.event.isDot && !step.event.isReaction && !step.event.isReflect);
    const target = mode === 'support' ? (outcome?.event || null)
      : hit?.event || outcome?.event || steps.find(step => own(step.event) && step.event.targetId != null)?.event;
    return target?.targetId ?? (mode === 'caster' || mode === 'support' ? row.actorId : row.targetId ?? row.actorId);
  }
  function sequence7Cast(row, phaseHold) {
    const spec = sequence7Config(row), actor = point(row.actorId);
    // The guard artwork depicts an incoming hit being deflected, so reserve
    // it for the recorded ward trigger rather than the stance preparation.
    if (!spec || !actor || isPaperRebound(row)) return;
    if (presentationAbility(row) === 'necromancy_summon' && !(row.timeline || []).some(step =>
      (step.event.actorId == null || step.event.actorId === row.actorId)
      && (step.event.presentationEffect === 'necromancy_summon'
        || (step.event.type === 'heal' && Number(step.event.amount) > 0 && step.event.targetId !== row.actorId)))) return;
    const targetId = sequence7Endpoint(row, spec.mode);
    const target = point(targetId) || actor;
    const mode = spec.mode, direction = mode === 'travel' ? sequence7Direction(row, targetId) : null;
    const destination = direction?.to || target;
    const node = sequence7Image(row, 'cast', direction?.toId ?? targetId, mode, destination, undefined, direction);
    if (node && direction && direction.toId !== targetId) node.setAttribute('data-damage-target-id', targetId);
    if (!node || compact()) return;
    const angle = Number(node.dataset.angleDeg) || 0;
    const duration = Math.max(1, Number(phaseHold) || readableCastDuration(row));
    if (mode === 'travel' && targetId !== row.actorId) {
      const from = direction?.from || actor, to = direction?.to || target;
      const dx = to.x - from.x, dy = to.y - from.y;
      animate(node, [
        { transform: `translate(${from.x}px,${from.y}px) rotate(${angle}deg) scale(.58)`, opacity: 0 },
        { transform: `translate(${from.x + dx * .12}px,${from.y + dy * .12}px) rotate(${angle}deg) scale(.92)`, opacity: 1, offset: .18 },
        { transform: `translate(${from.x + dx * .58}px,${from.y + dy * .58}px) rotate(${angle}deg) scale(1)`, opacity: .98, offset: .6 },
        { transform: `translate(${to.x}px,${to.y}px) rotate(${angle}deg) scale(1.04)`, opacity: .95, offset: .86 },
        { transform: `translate(${to.x}px,${to.y}px) rotate(${angle}deg) scale(.94)`, opacity: 0 }
      ], duration);
    } else {
      animate(node, [
        { transform: `translate(${target.x}px,${target.y}px) rotate(${angle}deg) scale(.68)`, opacity: 0 },
        { transform: `translate(${target.x}px,${target.y - 2}px) rotate(${angle}deg) scale(1)`, opacity: 1, offset: .15 },
        { transform: `translate(${target.x}px,${target.y - 4}px) rotate(${angle}deg) scale(1.02)`, opacity: 1, offset: .85 },
        { transform: `translate(${target.x}px,${target.y - 6}px) rotate(${angle}deg) scale(.98)`, opacity: 0 }
      ], duration);
    }
  }
  function sequence7Support(row, event, phaseHold, stage = 'support') {
    const spec = sequence7Config(row), id = event.targetId;
    const summoning = event.presentationEffect === 'necromancy_summon';
    const p = point(id) || (summoning ? point(row.actorId) : null);
    const recovery = ['heal', 'shield', 'revive'].includes(event.type) && Number(event.amount) > 0;
    const positiveStatus = event.type === 'status' && (event.beneficial === true || event.subtype === 'cleanse');
    if (!spec || spec.mode === 'travel' || isPaperRebound(row) || !p
      || (event.actorId != null && event.actorId !== row.actorId) || (!recovery && !positiveStatus)) return;
    const node = sequence7Image(row, stage, id, 'support', p);
    if (!node) return;
    if (summoning) node.setAttribute('data-companion-id', event.companionId);
    if (compact()) return;
    const duration = Math.max(1, Number(phaseHold) || 600);
    animate(node, [
      { transform: `translate(${p.x}px,${p.y}px) scale(.82)`, opacity: 0 },
      { transform: `translate(${p.x}px,${p.y}px) scale(1)`, opacity: 1, offset: .15 },
      { transform: `translate(${p.x}px,${p.y - 2}px) scale(1.02)`, opacity: 1, offset: .85 },
      { transform: `translate(${p.x}px,${p.y - 4}px) scale(.98)`, opacity: 0 }
    ], duration);
  }
  function sequence7Guard(row, event, phaseHold) {
    const ownerId = event.paperReboundOwnerId;
    if (ownerId == null || ownerId !== event.targetId || event.isDot || event.isReflect) return;
    const p = point(ownerId), attacker = point(event.actorId);
    if (!p) return;
    const guardRow = { ...row, actorId: ownerId, sourceAbilityId: 'paper_figurine_rebound', sourcePath: 'fool' };
    const node = sequence7Image(guardRow, 'guard', ownerId, 'support', p);
    if (!node) return;
    const angle = attacker ? Math.atan2(attacker.y - p.y, attacker.x - p.x) * 180 / Math.PI : 0;
    node.setAttribute('data-angle-deg', angle);
    node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    if (!compact()) animate(node, [
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(.82)`, opacity: 0 },
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(1)`, opacity: 1, offset: .15 },
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(1.02)`, opacity: 1, offset: .85 },
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(.98)`, opacity: 0 }
    ], Math.max(1, Number(phaseHold) || 600));
  }
  function sequence7Impact(row, event, phaseHold) {
    const reflecting = event?.isReflect || event?.type === 'reflect';
    const abilityId = reflecting ? String(event?.sourceAbilityId || '').split(':').pop() : presentationAbility(row);
    const spec = config.sequence7Abilities?.[abilityId];
    if (!spec || event?.isDot || (!reflecting && event?.actorId != null && event.actorId !== row.actorId)) return;
    const target = point(event.targetId), actor = point(event.actorId ?? row.actorId);
    if (!target) return;
    const ownerId = reflecting ? event.actorId : row.actorId;
    const impactRow = reflecting ? { ...row, actorId: ownerId, sourceAbilityId: abilityId } : row;
    const direction = sequence7Direction(impactRow, event.targetId, reflecting);
    // A siphon arrives at its caster. Keep its artwork there rather than
    // jumping back to the victim; the recorded damage cue still hits the victim.
    const reverse = !reflecting && spec.travelDirection === 'target_to_caster';
    const impactPoint = reverse && direction ? direction.to : target;
    const visualTargetId = reverse && direction ? direction.toId : event.targetId;
    const node = sequence7Image(impactRow, reflecting ? 'reflect' : 'impact', visualTargetId, 'travel', impactPoint, reflecting ? spec.reflectAsset : undefined, direction);
    if (!node) return;
    const angle = direction?.angle || 0;
    node.setAttribute('data-angle-deg', String(angle));
    node.setAttribute('data-owner-id', ownerId ?? row.actorId);
    if (reverse) node.setAttribute('data-damage-target-id', event.targetId);
    node.setAttribute('transform', `translate(${impactPoint.x} ${impactPoint.y}) rotate(${angle})`);
    if (!compact()) {
      const duration = Math.max(1, Number(phaseHold) || (isPositiveSupportEvent(event, row) ? 500 : 225));
      if (reflecting && actor) animate(node, [
        { transform: `translate(${actor.x}px,${actor.y}px) rotate(${angle}deg) scale(.56)`, opacity: 0 },
        { transform: `translate(${actor.x + (target.x - actor.x) * .18}px,${actor.y + (target.y - actor.y) * .18}px) rotate(${angle}deg) scale(.9)`, opacity: 1, offset: .2 },
        { transform: `translate(${actor.x + (target.x - actor.x) * .68}px,${actor.y + (target.y - actor.y) * .68}px) rotate(${angle}deg) scale(1)`, opacity: 1, offset: .72 },
        { transform: `translate(${target.x}px,${target.y}px) rotate(${angle}deg) scale(1.08)`, opacity: .95, offset: .9 },
        { transform: `translate(${target.x}px,${target.y}px) rotate(${angle}deg) scale(.82)`, opacity: 0 }
      ], duration);
      else animate(node, [
        { transform: `translate(${impactPoint.x}px,${impactPoint.y}px) rotate(${angle}deg) scale(.72)`, opacity: .2 },
        { transform: `translate(${impactPoint.x}px,${impactPoint.y}px) rotate(${angle}deg) scale(1.06)`, opacity: 1, offset: .24 },
        { transform: `translate(${impactPoint.x}px,${impactPoint.y}px) rotate(${angle}deg) scale(1)`, opacity: .9, offset: .64 },
        { transform: `translate(${impactPoint.x}px,${impactPoint.y}px) rotate(${angle}deg) scale(.88)`, opacity: 0 }
      ], duration);
    }
  }
  function prepareSequence8Assets(map) {
    const paths = new Set(Object.values(map || {}).filter(entry => entry && Number(entry.sequence) <= 8).map(entry => entry.path));
    for (const spec of Object.values(config.sequence8Abilities || {})) {
      // Warm only participating pathways, rather than downloading twenty PNGs
      // at startup. The replay never waits on a network or image callback.
      if (paths.has(spec.pathway)) prepareSequence8Asset(spec);
    }
  }
  function sequence8Endpoint(row) {
    const steps = row.timeline || [];
    const own = event => event.actorId == null || event.actorId === row.actorId;
    // Signature bookkeeping can precede the command or hit. Find its actual
    // recipient rather than assigning an effect to the first note in the row.
    const command = steps.find(step => step.event.presentationEffect === 'beast_command'
      && (step.event.ownerId === row.actorId || own(step.event)) && step.event.targetId != null);
    const hit = steps.find(step => own(step.event) && step.event.targetId != null
      && damageTypes.has(step.type) && !step.event.isDot && !step.event.isReaction && !step.event.isReflect);
    const target = steps.find(step => own(step.event) && step.event.targetId != null);
    return { command: command?.event, hit: hit?.event, target: hit?.event || target?.event };
  }
  function sequence8Image(row, stage, targetId, mode, p, size, assetOverride) {
    const spec = sequence8Config(row), root = layer();
    if (!spec || !root) return null;
    const abilityId = presentationAbility(row);
    const src = assetOverride || (abilityId === 'beast_command' && mode === 'strike' && spec.fallbackAsset) || spec.asset;
    const aspect = abilityId === 'crafted_blade' ? 1321 / 339
      : abilityId === 'beast_command' && src === spec.fallbackAsset ? 2
        : abilityId === 'beast_command' ? 876 / 995 : 1;
    const maxWidth = Math.max(1, (canvas()?.getBoundingClientRect().width || 320) - 8);
    // Keep the long blade and fallback claw readable without overpowering units.
    const artScale = abilityId === 'crafted_blade' ? 0.45
      : abilityId === 'beast_command' && src === spec.fallbackAsset ? 0.55 : 1;
    const width = Math.min(size * artScale * aspect, maxWidth), height = width / aspect;
    const node = group('gm-combat-sequence8', row.actorId, targetId, spec.color);
    for (const [key, value] of Object.entries({ 'ability-id': abilityId, stage, mode,
      'effect-src': src, 'effect-width': width, 'effect-height': height })) node.setAttribute(`data-${key}`, value);
    node.setAttribute('transform', `translate(${p.x} ${p.y})`);
    const art = image(node, src, width, height, 'gm-combat-effect-image gm-combat-sequence8-image');
    if (presentationAbility(row) === 'raging_blow') {
      art.setAttribute('transform', 'rotate(180)');
      art.setAttribute('data-flip-deg', '180');
    }
    root.append(node);
    return node;
  }
  function sequence8Cast(row, phaseHold) {
    const spec = sequence8Config(row), actor = point(row.actorId);
    if (!spec || !actor) return;
    const endpoints = sequence8Endpoint(row);
    let mode = spec.mode, targetId = endpoints.target?.targetId ?? row.targetId;
    if (mode === 'support') {
      if (endpoints.command) targetId = endpoints.command.targetId;
      else if (endpoints.hit) { mode = 'strike'; targetId = endpoints.hit.targetId; }
      else mode = 'caster';
    }
    if (mode === 'caster') targetId = row.actorId;
    const target = point(targetId);
    // Missing/offscreen endpoints receive only a local casting cue. Never
    // choose another enemy or invent a companion to fill an unavailable slot.
    if (!target) { mode = 'caster'; targetId = row.actorId; }
    const destination = target || actor;
    const fieldWidth = canvas()?.getBoundingClientRect().width || 320;
    const size = Math.min(fieldWidth - 8, effectHeight(mode === 'support' ? actor : destination) * 1.08);
    const hold = Math.max(1, Number(phaseHold) || readableCastDuration(row));
    const id = presentationAbility(row);
    // Beast Command in support mode manifests directly over companion without launching a missile
    const moving = (mode === 'travel' || mode === 'support') && (id !== 'beast_command' || mode !== 'support');
    const centerDx = destination.x - actor.x, centerDy = destination.y - actor.y;
    const centerDistance = Math.hypot(centerDx, centerDy) || 1;
    const bladeStop = moving && id === 'crafted_blade' && target
      ? { x: destination.x - centerDx / centerDistance * destination.radius,
          y: destination.y - centerDy / centerDistance * destination.radius }
      : destination;
    const finalPoint = mode === 'caster' ? actor : id === 'crafted_blade' && moving ? bladeStop : destination;
    const node = sequence8Image(row, 'cast', targetId, mode, finalPoint, size);
    if (!node) return;
    const dx = moving && id === 'crafted_blade' ? bladeStop.x - actor.x : centerDx;
    const dy = moving && id === 'crafted_blade' ? bladeStop.y - actor.y : centerDy;
    const angle = moving ? Math.atan2(centerDy, centerDx) * 180 / Math.PI : 0;
    if (id === 'crafted_blade' && moving) {
      node.setAttribute('data-contact-x', String(bladeStop.x));
      node.setAttribute('data-contact-y', String(bladeStop.y));
      node.setAttribute('data-stop-before-target', String(destination.radius));
    }
    node.setAttribute('data-angle-deg', String(angle));
    const directPath = ['paper_card_dagger', 'deceptive_feint', 'crafted_blade', 'fines_penalties', 'heavy_cleave', 'shadow_strike'].includes(id);
    node.setAttribute('data-flight-path', moving ? (directPath ? 'straight' : 'curved') : 'stationary');
    node.setAttribute('transform', `translate(${finalPoint.x} ${finalPoint.y}) rotate(${angle})`);
    if (compact()) return;
    const straight = ['paper_card_dagger', 'deceptive_feint', 'crafted_blade', 'fines_penalties', 'heavy_cleave', 'shadow_strike'].includes(id);
    const bend = moving && !straight ? Math.min(28, Math.hypot(dx, dy) * .08) : 0;
    const pose = (progress, scale = 1, turn = 0) => {
      const p = moving ? { x: actor.x + dx * progress + Math.sin(progress * Math.PI) * bend,
        y: actor.y + dy * progress } : finalPoint;
      return `translate(${p.x}px,${p.y}px) rotate(${angle + turn}deg) scale(${scale})`;
    };
    if (id === 'beast_command' && mode === 'support') {
      // Lunar Blessing over companion: manifests directly over beast companion, rising and pulsing with lunar authority
      animate(node, [
        { transform: `translate(${finalPoint.x}px,${finalPoint.y + 12}px) scale(0.55)`, opacity: 0 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y - 12}px) scale(1.18)`, opacity: 1, offset: 0.28 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y - 18}px) scale(0.96)`, opacity: 0.95, offset: 0.55 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y - 24}px) scale(1.12)`, opacity: 0.88, offset: 0.78 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y - 30}px) scale(0.95)`, opacity: 0 }
      ], hold);
      return;
    }
    if (id === 'nature_growth') {
      // Botanical Eruption: starts rooted at base of target, shoots upward with rapid vertical stretch, living sway
      animate(node, [
        { transform: `translate(${finalPoint.x}px,${finalPoint.y + 20}px) scale(0.7, 0.2) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y - 8}px) scale(1.08, 1.25) rotate(0deg)`, opacity: 1, offset: 0.22 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y}px) scale(1.02, 1.1) rotate(4deg)`, opacity: 0.98, offset: 0.55 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y}px) scale(0.98, 1.05) rotate(-3deg)`, opacity: 0.95, offset: 0.78 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y}px) scale(1, 1) rotate(0deg)`, opacity: 0.9, offset: 0.92 },
        { transform: `translate(${finalPoint.x}px,${finalPoint.y}px) scale(1, 1) rotate(0deg)`, opacity: 0 }
      ], hold);
      return;
    }
    if (id === 'shadow_strike') {
      // Shadow Strike surges straight from attacker to target, keeping a stable heading.
      animate(node, [
        { transform: pose(0, 0.68), opacity: 0 },
        { transform: pose(0.08, 0.94), opacity: 1, offset: 0.15 },
        { transform: pose(0.55, 1.04), opacity: 0.98, offset: 0.6 },
        { transform: pose(1, 1.12), opacity: 0.95, offset: 0.8 },
        { transform: pose(1, 1.04), opacity: 0 }
      ], hold);
      return;
    }
    if (id === 'crafted_blade') {
      // Heavy Forged Cleave advances straight to the target's edge, then
      // holds its contact pose until the recorded hit replaces the cast art.
      animate(node, [
        { transform: pose(0, 0.65), opacity: 0 },
        { transform: pose(0.06, 0.92), opacity: 1, offset: 0.14 },
        { transform: pose(0.5, 0.98), opacity: 1, offset: 0.58 },
        { transform: pose(1, 0.96), opacity: 1, offset: 0.82 },
        { transform: pose(1, 0.96), opacity: 1 }
      ], hold, 0, { fill: 'forwards', remove: false, hold: true });
      return;
    }
    if (id === 'beast_command' && mode === 'travel') {
      // Savage Fallback Lunge: charges across field into savage claw attack
      animate(node, [
        { transform: pose(0, 0.7, -15), opacity: 0 },
        { transform: pose(0.08, 0.92, -8), opacity: 0.95, offset: 0.15 },
        { transform: pose(0.65, 1.12, 6), opacity: 1, offset: 0.6 },
        { transform: pose(1, 1.22, 10), opacity: 1, offset: 0.85 },
        { transform: pose(1, 1.05, 0), opacity: 0 }
      ], hold);
      return;
    }
    // The anticipation, readable flight/stamp and fade share the scheduler's
    // cast clock. Damage, recovery and control cues remain separate events.
    animate(node, [
      { transform: pose(0, .62, id === 'paper_card_dagger' ? -35 : 0), opacity: 0 },
      { transform: pose(.03, .88), opacity: .96, offset: .18 },
      { transform: pose(.52, 1), opacity: .98, offset: .58 },
      { transform: pose(1, 1.04), opacity: .98, offset: .78 },
      { transform: pose(1, 1.08), opacity: .85, offset: .9 },
      { transform: pose(1, .94), opacity: 0 }
    ], hold);
  }
  function sequence8Impact(row, event, phaseHold) {
    const spec = sequence8Config(row), p = point(event.targetId);
    if (!spec || !p || event.isDot || (event.actorId != null && event.actorId !== row.actorId)
      || event.isReflect || (event.isReaction && !event.isSignature)) return;
    const size = Math.min((canvas()?.getBoundingClientRect().width || 320) - 8, effectHeight(p));
    const fallbackImpact = presentationAbility(row) === 'beast_command'
      && !row.timeline?.some(step => step.event?.presentationEffect === 'beast_command' && step.event?.targetId !== event.targetId);
    const node = sequence8Image(row, 'impact', event.targetId, spec.mode, p, size,
      fallbackImpact ? spec.fallbackAsset : undefined);
    if (!node) return;
    const actor = point(event.actorId ?? row.actorId);
    const id = presentationAbility(row);
    const isFallbackClaw = id === 'beast_command'
      && !row.timeline?.some(step => step.event?.presentationEffect === 'beast_command' && step.event?.targetId !== event.targetId);
    const moving = ['travel', 'support'].includes(spec.mode) && !isFallbackClaw;
    const angle = moving && actor ? Math.atan2(p.y - actor.y, p.x - actor.x) * 180 / Math.PI : 0;
    node.setAttribute('data-angle-deg', String(angle));
    node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    node.setAttribute('data-critical', String(!!event.critical));
    node.setAttribute('data-signature-release', String(!!event.isSignature));
    const impactDuration = Math.max(1, Number(phaseHold) || (isPositiveSupportEvent(event, row) ? 500 : 225));
    if (compact()) return;
    if (id === 'nature_growth') {
      // Thorn Constriction: vines violently clamp inward (scale(0.86) with twisting bite)
      animate(node, [
        { transform: `translate(${p.x}px,${p.y}px) rotate(0deg) scale(1.08)`, opacity: 0.9 },
        { transform: `translate(${p.x}px,${p.y}px) rotate(14deg) scale(0.86)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${p.x}px,${p.y}px) rotate(18deg) scale(0.72)`, opacity: 0 }
      ], impactDuration);
      return;
    }
    // The arrival keeps the flight's orientation. Criticals change numbers only.
    animate(node, [
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(.84)`, opacity: .25 },
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(1.05)`, opacity: 1, offset: .22 },
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(1)`, opacity: .9, offset: .55 },
      { transform: `translate(${p.x}px,${p.y}px) rotate(${angle}deg) scale(1.1)`, opacity: 0 }
    ], impactDuration);
  }
  function weaponBasic(row, event, kind) {
    return row?.abilityId === 'basic_attack' && row.attackKind === kind && event
      && (event.actorId == null || event.actorId === row.actorId)
      && (!event.isReaction || event.isCounter || row.isCounter) && !event.isReflect && !event.isDot;
  }
  function firingPoint(actor, target) {
    // Character art has no authored barrel anchor yet. Use its forward hand,
    // mirrored horizontally when aiming left; a vertical shot keeps the visible
    // right hand. Aim from that hand rather than moving the muzzle to the head.
    const x = actor.x + (target.x < actor.x ? -.18 : .18) * actor.spriteWidth;
    const y = actor.y + .05 * actor.spriteHeight;
    const dx = target.x - x, dy = target.y - y, distance = Math.hypot(dx, dy);
    const direction = distance ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 };
    return { x, y, angle: Math.atan2(direction.y, direction.x) * 180 / Math.PI, direction };
  }
  function muzzleFlash(row, next, launch) {
    const event = next?.event, targetId = event?.targetId;
    if (!weaponBasic(row, event, 'gun') || !launch || !layer()) return;
    const { x, y, angle, delay, flashDuration } = launch;
    const node = group('gm-combat-gun-muzzle', row.actorId, targetId, '#f6bd72');
    // The original art is preserved in a pixel-exact 979x547 crop. Its bright
    // ignition point is at (105, 274) within that crop; anchor only that point
    // to the estimated hand/barrel firing position.
    // Double the visible burst from the original transparent canvas while preserving its barrel anchor.
    const width = 288, scale = width / 979, height = 547 * scale;
    const src = 'data/assets/effects/gun-muzzle.png?v=d1c869a57e8ee076';
    node.setAttribute('data-angle-deg', angle.toFixed(2));
    node.setAttribute('data-effect-width', width); node.setAttribute('data-effect-height', height);
    node.setAttribute('data-effect-src', src);
    node.setAttribute('data-start-x', x); node.setAttribute('data-start-y', y);
    node.setAttribute('data-launch-delay-ms', delay); node.setAttribute('data-effect-duration-ms', flashDuration);
    node.setAttribute('opacity', '0');
    const flash = image(node, src, width, height, 'gm-combat-gun-muzzle-image');
    // Rotate around the firing origin, not the image-box center, so the
    // rotated ignition point stays exactly at the attacker's firing point.
    flash.setAttribute('x', -105 * scale); flash.setAttribute('y', -274 * scale);
    flash.setAttribute('transform', 'rotate(180)');
    layer().append(node);
    if (!compact() && node.animate) animate(node, [
      { transform: `translate(${x}px,${y}px) rotate(${angle}deg)`, opacity: 1 },
      { transform: `translate(${x}px,${y}px) rotate(${angle}deg)`, opacity: .85, offset: .4 },
      { transform: `translate(${x}px,${y}px) rotate(${angle}deg)`, opacity: 0 }
    ], flashDuration, delay);
    else { node.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`); node.setAttribute('opacity', '.8'); }
  }
  let gunShotClipId = 0;
  function gunShotTrail(row, next, launch, phaseHold, flashDuration) {
    const event = next?.event, targetId = event?.targetId;
    if (!weaponBasic(row, event, 'gun') || !launch || targetId == null) return;
    const target = point(targetId), root = layer();
    if (!target || !root) return;
    const dx = target.x - launch.x, dy = target.y - launch.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) return;
    const direction = { x: dx / distance, y: dy / distance };
    const end = Math.max(0, distance - target.radius);
    if (end < 4) return;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const releaseDelay = Math.max(0, Number(launch.delay) || 0);
    const duration = Math.max(70, Math.min(220, (Number(phaseHold) || 600) - releaseDelay - flashDuration - 24));
    let defs = root.querySelector('defs[data-gm-gun-shot-defs]');
    if (!defs) {
      defs = element('defs', { 'data-gm-gun-shot-defs': 'true' });
      root.insertBefore(defs, root.firstChild);
    }
    const clipId = `gm-gun-shot-clip-${++gunShotClipId}`;
    const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    const reveal = element('rect', { x: 0, y: -4, width: 0, height: 8 });
    clip.append(reveal); defs.append(clip);
    const trail = group('gm-combat-projectile gm-combat-gun-shot-line', row.actorId, targetId, '#d6b77f');
    trail.setAttribute('transform', `translate(${launch.x} ${launch.y}) rotate(${angle})`);
    trail.setAttribute('clip-path', `url(#${clipId})`);
    trail.setAttribute('data-start-x', launch.x); trail.setAttribute('data-start-y', launch.y);
    trail.setAttribute('data-end-x', launch.x + direction.x * end);
    trail.setAttribute('data-end-y', launch.y + direction.y * end);
    trail.setAttribute('data-travel-ms', duration); trail.setAttribute('data-launch-delay-ms', releaseDelay + flashDuration);
    trail.append(element('line', { x1: 0, y1: 0, x2: end, y2: 0, fill: 'none', stroke: 'currentColor',
      'stroke-width': 1.5, 'stroke-dasharray': '4 11', 'stroke-linecap': 'butt', opacity: .92 }));
    root.append(trail);
    if (compact() || !reveal.animate) { reveal.setAttribute('width', end); return; }
    const animation = reveal.animate([{ width: '0px' }, { width: `${end}px` }], {
      duration, delay: releaseDelay + flashDuration, easing: 'linear', fill: 'forwards'
    });
    if (!animation) { reveal.setAttribute('width', end); return; }
    animation.playbackRate = speed;
    animations.set(animation, trail);
    if (paused) animation.pause();
    animation.onfinish = () => animations.delete(animation);
    animation.oncancel = () => animations.delete(animation);
  }
  let punchShotClipId = 0;
  function punchCue(row, next, phaseHold) {
    const event = next?.event, actor = point(row.actorId), target = point(event?.targetId);
    if (!weaponBasic(row, event, 'unarmed') || !actor || !target || !layer()) return;
    const dx = target.x - actor.x, dy = target.y - actor.y, distance = Math.hypot(dx, dy);
    if (distance < 4) return;
    const direction = { x: dx / distance, y: dy / distance };
    const startInset = Math.min(actor.radius * .58, distance * .15);
    const endInset = Math.min(target.radius, distance * .25);
    const length = Math.max(0, distance - startInset - endInset);
    if (length < 4) return;
    const from = { x: actor.x + direction.x * startInset, y: actor.y + direction.y * startInset };
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const thickness = Math.max(1.5, Math.min(2.5, actor.spriteHeight * .022));
    const segment = Math.max(3, thickness * 2.1), gap = Math.max(5, thickness * 3.7);
    const root = layer();
    let defs = root.querySelector('defs[data-gm-punch-shot-defs]');
    if (!defs) {
      defs = element('defs', { 'data-gm-punch-shot-defs': 'true' });
      root.insertBefore(defs, root.firstChild);
    }
    const clipId = `gm-punch-shot-clip-${++punchShotClipId}`;
    const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    const reveal = element('rect', { x: 0, y: -thickness * 2, width: 0, height: thickness * 4 });
    clip.append(reveal); defs.append(clip);
    const trail = group('gm-combat-projectile gm-combat-punch-trail', row.actorId, event.targetId, '#e8d09a');
    trail.setAttribute('transform', `translate(${from.x} ${from.y}) rotate(${angle})`);
    trail.setAttribute('clip-path', `url(#${clipId})`);
    trail.setAttribute('data-start-x', from.x); trail.setAttribute('data-start-y', from.y);
    trail.setAttribute('data-end-x', from.x + direction.x * length);
    trail.setAttribute('data-end-y', from.y + direction.y * length);
    trail.setAttribute('data-effect-width', thickness); trail.setAttribute('data-length', length);
    trail.setAttribute('data-reference-height', effectHeight(actor));
    const hold = Math.max(1, Number(phaseHold) || 600), delay = hold * .4;
    const duration = Math.max(90, Math.min(190, hold * .32));
    trail.setAttribute('data-travel-ms', duration); trail.setAttribute('data-launch-delay-ms', delay);
    trail.append(element('line', { x1: 0, y1: 0, x2: length, y2: 0, fill: 'none', stroke: 'currentColor',
      'stroke-width': thickness, 'stroke-dasharray': `${segment} ${gap}`, 'stroke-linecap': 'butt', opacity: .96 }));
    root.append(trail);
    if (compact() || !reveal.animate) { reveal.setAttribute('width', length); return; }
    const animation = reveal.animate([{ width: '0px' }, { width: `${length}px` }], {
      duration, delay, easing: 'linear', fill: 'forwards'
    });
    if (!animation) { reveal.setAttribute('width', length); return; }
    animation.playbackRate = speed;
    animations.set(animation, trail);
    if (paused) animation.pause();
    animation.onfinish = () => animations.delete(animation);
    animation.oncancel = () => animations.delete(animation);
  }
  function abilityCue(row, next, phaseHold) {
    const id = presentationAbility(row), event = next?.event;
    const actor = point(row.actorId), targetId = event?.targetId ?? row.targetId, target = point(targetId);
    if (!actor || !layer()) return;
    if (sequence3Config(row)) { sequence3Cast(row, phaseHold); return; }
    if (sequence4Config(row)) { sequence4Cast(row, phaseHold); return; }
    if (sequence5Config(row)) { sequence5Cast(row, phaseHold); return; }
    if (sequence6Config(row)) { sequence6Cast(row, phaseHold); return; }
    if (sequence8Config(row)) { sequence8Cast(row, phaseHold); return; }
    if (sequence7Config(row)) { sequence7Cast(row, phaseHold); return; }
    const hold = Math.max(100, Math.min(Number(phaseHold) || 600, 560));
    const abilityHold = isReadableAbility(row)
      ? Math.max(1, Number(phaseHold) || readableCastDuration(row)) : hold;
    const src = S9_EFFECTS[id];
    if (id === 'exploit_loophole' && target) {
      const size = effectHeight(target);
      const root = layer();
      let defs = root.querySelector('defs[data-gm-loophole-defs]');
      if (!defs) {
        defs = element('defs', { 'data-gm-loophole-defs': 'true' });
        root.insertBefore(defs, root.firstChild);
      }
      const clipIdTop = `gm-loophole-clip-top-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const clipIdBot = `gm-loophole-clip-bot-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      
      // The art is 1376x768 (ratio ~1.79:1). Center it at (0, 0)
      const w = size * 1.5, h = w * (768 / 1376);
      const hw = w / 2, hh = h / 2;

      // Top-left half polygon and bottom-right half polygon split along diagonal from (-hw, hh) to (hw, -hh)
      const clipTop = element('clipPath', { id: clipIdTop, clipPathUnits: 'userSpaceOnUse' });
      clipTop.append(element('polygon', { points: `${-hw - 5},${-hh - 5} ${hw + 5},${-hh - 5} ${-hw - 5},${hh + 5}` }));
      defs.append(clipTop);

      const clipBot = element('clipPath', { id: clipIdBot, clipPathUnits: 'userSpaceOnUse' });
      clipBot.append(element('polygon', { points: `${hw + 5},${-hh - 5} ${hw + 5},${hh + 5} ${-hw - 5},${hh + 5}` }));
      defs.append(clipBot);

      const container = group('gm-combat-loophole-seal', row.actorId, targetId, '#e5c59b');
      container.setAttribute('data-ability-id', id);
      container.setAttribute('data-effect-height', size);
      container.setAttribute('transform', `translate(${target.x} ${target.y})`);

      // Intact emblem layer
      const intact = element('g', { class: 'gm-loophole-intact', opacity: 0 });
      image(intact, src, w, h);
      container.append(intact);

      // Flash overlay
      const flash = element('ellipse', { cx: 0, cy: 0, rx: w * .48, ry: h * .48, fill: '#ffffff', opacity: 0 });
      container.append(flash);

      // Top-left half
      const topHalf = element('g', { class: 'gm-loophole-half-top', 'clip-path': `url(#${clipIdTop})`, opacity: 0 });
      image(topHalf, src, w, h);
      container.append(topHalf);

      // Bottom-right half
      const botHalf = element('g', { class: 'gm-loophole-half-bot', 'clip-path': `url(#${clipIdBot})`, opacity: 0 });
      image(botHalf, src, w, h);
      container.append(botHalf);

      root.append(container);

      if (!compact()) {
        animate(intact, [
          { transform: 'scale(0.8)', opacity: 0 },
          { transform: 'scale(1)', opacity: 0.98, offset: 0.2 },
          { transform: 'scale(1)', opacity: 0.98, offset: 0.54 },
          { transform: 'scale(1.02)', opacity: 0, offset: 0.58 },
          { transform: 'scale(1.02)', opacity: 0 }
        ], abilityHold, 0, { remove: false });

        animate(flash, [
          { opacity: 0 },
          { opacity: 0, offset: 0.54 },
          { opacity: 0.4, offset: 0.58 },
          { opacity: 0, offset: 0.64 },
          { opacity: 0 }
        ], abilityHold, 0, { remove: false });

        animate(topHalf, [
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0 },
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0, offset: 0.54 },
          { transform: 'translate(-4px, -4px) rotate(-1deg)', opacity: 0.98, offset: 0.58 },
          { transform: 'translate(-28px, -24px) rotate(-8deg)', opacity: 0.8, offset: 0.88 },
          { transform: 'translate(-42px, -36px) rotate(-14deg) scale(0.9)', opacity: 0 }
        ], abilityHold, 0, { remove: false });

        animate(botHalf, [
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0 },
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0, offset: 0.54 },
          { transform: 'translate(4px, 4px) rotate(1deg)', opacity: 0.98, offset: 0.58 },
          { transform: 'translate(28px, 24px) rotate(8deg)', opacity: 0.8, offset: 0.88 },
          { transform: 'translate(42px, 36px) rotate(14deg) scale(0.9)', opacity: 0 }
        ], abilityHold, 0, {
          onfinish: () => {
            clipTop.remove();
            clipBot.remove();
            container.remove();
          }
        });
      } else {
        intact.setAttribute('opacity', '1');
        container.setAttribute('transform', `translate(${target.x} ${target.y})`);
      }
      return;
    }
    if (id === 'combat_theft' && target) {
      // Anchor left dark vortex at thief (actor), right runic target at victim (target)
      const dx = target.x - actor.x, dy = target.y - actor.y, distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      // Proportional scale preserving aspect ratio 1376:768
      const width = Math.max(distance, 120);
      const height = width * (768 / 1376);
      const midX = (actor.x + target.x) / 2, midY = (actor.y + target.y) / 2;
      const node = group('gm-combat-theft-siphon', row.actorId, targetId, '#e7c38d');
      node.setAttribute('data-ability-id', id);
      node.setAttribute('data-travel-direction', 'attacker-to-target');
      node.setAttribute('data-effect-height', height);
      
      // In the art: left is dark vortex, right is runic target.
      // So translating to midX, midY with rotation = angle naturally connects actor -> target!
      const img = image(node, src, width, height);
      layer().append(node);
      if (!compact()) {
        animate(node, [
          { transform: `translate(${midX}px,${midY}px) rotate(${angle}deg) scale(0.65)`, opacity: 0 },
          { transform: `translate(${midX}px,${midY}px) rotate(${angle}deg) scale(1)`, opacity: 0.98, offset: 0.375 },
          { transform: `translate(${midX}px,${midY}px) rotate(${angle}deg) scale(1.03)`, opacity: 0.98, offset: 0.75 },
          { transform: `translate(${midX}px,${midY}px) rotate(${angle}deg) scale(0.95)`, opacity: 0.85, offset: 0.9 },
          { transform: `translate(${midX}px,${midY}px) rotate(${angle}deg) scale(0.85)`, opacity: 0 }
        ], abilityHold);
      } else {
        node.setAttribute('transform', `translate(${midX} ${midY}) rotate(${angle})`);
      }
      return;
    }
    if (id === 'healing_touch' && target) {
      // Bottle at caster (actor), lotus at target (target). If self-cast, actor == target.
      const isSelf = targetId === row.actorId || Math.hypot(target.x - actor.x, target.y - actor.y) < 10;
      const root = layer();
      let defs = root.querySelector('defs[data-gm-healing-defs]');
      if (!defs) {
        defs = element('defs', { 'data-gm-healing-defs': 'true' });
        root.insertBefore(defs, root.firstChild);
      }
      const clipId = `gm-healing-mask-${Date.now()}-${Math.floor(Math.random()*1000)}`;

      if (isSelf) {
        const size = effectHeight(actor);
        const w = size * 1.6, h = w * (768 / 1376);
        const node = group('gm-combat-healing-touch-flight', row.actorId, targetId, '#ead8b5');
        node.setAttribute('data-ability-id', id);
        node.setAttribute('data-effect-height', size);
        node.setAttribute('transform', `translate(${actor.x} ${actor.y})`);
        image(node, src, w, h);
        root.append(node);
        if (!compact()) {
          animate(node, [
            { transform: `translate(${actor.x}px,${actor.y}px) scale(0.75)`, opacity: 0 },
            { transform: `translate(${actor.x}px,${actor.y}px) scale(1)`, opacity: 0.98, offset: 0.375 },
            { transform: `translate(${actor.x}px,${actor.y - 6}px) scale(1.05)`, opacity: 0.98, offset: 0.75 },
            { transform: `translate(${actor.x}px,${actor.y - 10}px) scale(1)`, opacity: 0 }
          ], abilityHold);
        }
        return;
      }

      // Ally cast: bottle at actor (left), lotus at target (right)
      const dx = target.x - actor.x, dy = target.y - actor.y, distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const width = Math.max(distance, 140);
      const height = width * (768 / 1376);
      const midX = (actor.x + target.x) / 2, midY = (actor.y + target.y) / 2;

      // Mask reveal along the stream: clipPath rect sliding from left (-width/2) to right (width/2)
      const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
      const revealRect = element('rect', { x: -width / 2 - 10, y: -height / 2 - 10, width: 0, height: height + 20 });
      clip.append(revealRect);
      defs.append(clip);

      const node = group('gm-combat-healing-touch-flight', row.actorId, targetId, '#ead8b5');
      node.setAttribute('data-ability-id', id);
      node.setAttribute('data-travel-ms', hold);
      node.setAttribute('data-effect-height', height);
      node.setAttribute('clip-path', `url(#${clipId})`);
      node.setAttribute('transform', `translate(${midX} ${midY}) rotate(${angle})`);

      image(node, src, width, height);
      root.append(node);

      if (!compact()) {
        animate(revealRect, [
          { width: `${width * 0.28}px`, offset: 0 },
          { width: `${width * 0.65}px`, offset: 0.375 },
          { width: `${width + 30}px`, offset: 0.75 },
          { width: `${width + 30}px`, offset: 1 }
        ], abilityHold, 0, { remove: false });

        animate(node, [
          { opacity: 0 },
          { opacity: 0.98, offset: 0.375 },
          { opacity: 0.98, offset: 0.75 },
          { opacity: 0 }
        ], abilityHold, 0, {
          onfinish: () => {
            clip.remove();
            node.remove();
          }
        });
      } else {
        revealRect.setAttribute('width', String(width + 30));
        node.setAttribute('opacity', '0.9');
      }
      return;
    }
  }
  function animate(node, frames, duration, delay = 0, options = {}) {
    if (!node.animate || compact()) return null;
    const animation = node.animate(frames, { duration, delay, easing: options.easing || 'linear', fill: options.fill || 'none' });
    animation.playbackRate = speed;
    animations.set(animation, node);
    if (paused) animation.pause();
    animation.onfinish = () => {
      animations.delete(animation);
      if (options.hold) return; // Leave the completed, filled pose visible until the hit cue clears it.
      animation.cancel();
      if (options.remove !== false) node.remove();
      options.removeNode?.remove(); options.onfinish?.();
    };
    animation.oncancel = () => animations.delete(animation);
    return animation;
  }
  function clearPhase(keepChip = true) {
    for (const [animation, node] of [...animations]) {
      if (keepChip && (node === chip || chip?.contains(node))) continue;
      animation.cancel(); animations.delete(animation);
    }
    for (const node of [...(surface?.children || [])]) if (!keepChip || node !== chip) node.remove();
    if (!keepChip) { chip = null; chipRow = null; }
  }
  function colorFor(event) { return config.damageColors?.[event.damageType] || defaults.damageColors[event.damageType] || config.damageColors?.default || defaults.damageColors.default; }
  const effectHeight = actor => Math.max(1, Number(actor?.spriteHeight) || 32) * 2;
  function projectileShapeSize(family, actor) {
    const extent = { slash: 20, bolt: 24, beam: 40, orb: 16, shard: 19, wisp: 19, thread: 24, wave: 20 }[family] || 24;
    return effectHeight(actor) * 20 / extent;
  }
  function sourcePath(row, event) {
    return event.sourcePath || (event.actorId == null || event.actorId === row.actorId ? row.sourcePath : null) || state(event.actorId ?? row.actorId)?.path;
  }
  function magicBasic(row, event) {
    if (!(row.abilityId === 'basic_attack' || row.attackKind) || ['gun', 'unarmed'].includes(row.attackKind)
      || (event.actorId != null && event.actorId !== row.actorId)) return false;
    const path = sourcePath(row, event);
    const archetype = typeof archetypeOf === 'function' ? archetypeOf(path)
      : data.balance?.path_archetype?.[path] || (casterPaths.has(path) ? 'Caster' : 'Physical');
    return row.attackKind === 'magic' || archetype === 'Caster';
  }
  function familyFor(row, event) {
    const path = sourcePath(row, event), basic = row.abilityId === 'basic_attack' || !!row.attackKind;
    const rules = config.basicAttack || defaults.basicAttack;
    let family;
    if (basic && (event.actorId == null || event.actorId === row.actorId)) {
      if (row.attackKind === 'gun') family = rules.gun;
      else if (magicBasic(row, event)) family = rules.pathways?.[path] || rules.caster;
      else family = row.attackKind === 'unarmed' ? rules.unarmed : rules.melee;
    } else family = config.pathwayDamageOverrides?.[path]?.[event.damageType] || config.pathwayDefaults?.[path];
    return defaults.families[family] ? family : event.damageType === 'physical' ? 'slash' : 'orb';
  }
  function shape(family, size, width) {
    const node = element('g', { transform: `scale(${size / 20})` });
    const path = (d, attrs = {}) => node.append(element('path', { d, fill: 'currentColor', ...attrs }));
    if (family === 'slash') path('M -10 9 L -7 1 L -1 -7 L 10 -10 L 3 -5 L -3 2 Z');
    else if (family === 'bolt') path('M -11 -2 L 4 -2 L 4 -5 L 12 0 L 4 5 L 4 2 L -11 2 Z');
    else if (family === 'beam') { node.append(element('rect', { x: -16, y: -1.5, width: 32, height: 3, fill: 'currentColor' })); path('M 12 -4 L 20 0 L 12 4 Z'); }
    else if (family === 'orb') path('M -5 -8 L 5 -8 L 5 -5 L 8 -5 L 8 5 L 5 5 L 5 8 L -5 8 L -5 5 L -8 5 L -8 -5 L -5 -5 Z');
    else if (family === 'shard') path('M -9 1 L 5 -9 L 9 -4 L 5 7 L -1 10 Z');
    else if (family === 'wisp') path('M -10 5 L -6 1 L -8 -4 L -1 -8 L 6 -5 L 9 0 L 5 6 L 0 4 L -4 8 Z');
    else if (family === 'thread') path('M -12 4 L -6 -4 L 0 4 L 6 -4 L 12 0', { fill: 'none', stroke: 'currentColor', 'stroke-width': 2 });
    else { const half = Math.max(10, (width || size) / size * 10); path(`M ${-half} 3 L ${-half * .75} -3 L ${-half * .5} 3 L ${-half * .25} -3 L 0 3 L ${half * .25} -3 L ${half * .5} 3 L ${half * .75} -3 L ${half} 3`, { fill: 'none', stroke: 'currentColor', 'stroke-width': 3 }); }
    return node;
  }
  function targetRank(targetId) {
    const target = unit(targetId), targetTeam = target?.classList.contains('ally') ? 'ally' : 'enemy';
    const points = [...wrap.querySelectorAll(`.gm-arena-unit.${targetTeam}`)]
      .filter(node => state(node.dataset.unitId)?.alive !== false && state(node.dataset.unitId)?.inCombat !== false)
      .map(node => point(node.dataset.unitId)).filter(Boolean);
    if (!points.length) return null;
    const minX = Math.min(...points.map(p => p.x - p.radius)), maxX = Math.max(...points.map(p => p.x + p.radius));
    return { x: (minX + maxX) / 2, y: points.reduce((sum, p) => sum + p.y, 0) / points.length, width: Math.max(36, maxX - minX) };
  }
  function isArea(row, event) {
    return (event.actorId == null || event.actorId === row.actorId) && (!!event.area || ['all_enemies', 'up_to_3_enemies'].includes(row.presentationTargetMode));
  }
  function swordBasicSlash(row, event) {
    return row?.abilityId === 'basic_attack' && row.attackKind === 'weapon'
      && event?.actorId === row.actorId && (!event.isReaction || event.isCounter || row.isCounter) && !event.isReflect && !event.isDot;
  }
  function travel(row, step, phaseHold) {
    const event = step?.event;
    const basicMiss = event?.type === 'miss' && ['gun', 'weapon', 'unarmed'].some(kind => weaponBasic(row, event, kind));
    const swordBasic = swordBasicSlash(row, event);
    const abilityId = presentationAbility(row), brutalStrike = abilityId === 'brutal_strike' && event?.actorId === row.actorId;
    const customS9 = ['exploit_loophole', 'combat_theft'].includes(abilityId) && event?.actorId === row.actorId;
    const unarmedBasic = weaponBasic(row, event, 'unarmed');
    // Punches land as a distinct burst; weapon basics and Brutal Strike use the provided crescent art.
    const reflectAbility = event?.isReflect ? String(event.sourceAbilityId || '').split(':').pop() : '';
    const customS7 = !!(reflectAbility && config.sequence7Abilities?.[reflectAbility])
      || (sequence7Config(row) && (event?.actorId == null || event.actorId === row.actorId));
    const customS8 = sequence8Config(row) && (event?.actorId == null || event.actorId === row.actorId)
      && !event?.isReflect && (!event?.isReaction || event?.isSignature);
    const customS6 = sequence6Config(row) && (event?.actorId == null || event.actorId === row.actorId)
      && !event?.isReflect && (!event?.isReaction || event?.isSignature);
    const customS5 = sequence5Hit(row, event), customS4 = sequence4Hit(row, event), customS3 = sequence3Hit(row, event);
    if (!event || (!damageTypes.has(step.type) && !basicMiss) || event.isDot || customS9 || customS8 || customS7 || customS6 || customS5 || customS4 || customS3) return;
    if (unarmedBasic) { punchCue(row, step, phaseHold); return; }
    const ownerId = event.actorId ?? row.actorId, targetId = event.targetId;
    const a = point(ownerId), originalTarget = point(targetId);
    if (!a || !originalTarget || ownerId === targetId) return;
    const gunBasic = weaponBasic(row, event, 'gun');
    const firing = gunBasic ? firingPoint(a, originalTarget) : null;
    if (gunBasic) {
      const shotDelay = (Number(phaseHold) || 600) * .4;
      const flashDuration = Math.min(140, Math.max(90, (Number(phaseHold) || 600) * .24));
      muzzleFlash(row, step, { ...firing, delay: shotDelay, flashDuration });
      gunShotTrail(row, step, { ...firing, delay: shotDelay }, phaseHold, flashDuration);
      return;
    }
    if (compact()) return;
    const area = isArea(row, event);
    if (area && areaRows.has(row)) return;
    const b = area ? targetRank(targetId) || originalTarget : originalTarget;
    const usesSlashArt = swordBasic || brutalStrike;
    const family = usesSlashArt ? 'slash' : area ? 'wave' : familyFor(row, event), settings = config.families?.[family] || defaults.families[family];
    const damageType = event.damageType || (basicMiss ? 'physical' : 'default');
    const physical = damageType === 'physical' && !magicBasic(row, event), pathKind = physical || usesSlashArt ? 'straight' : settings.path;
    const origin = gunBasic ? firing : a;
    const distance = Math.hypot(b.x - origin.x, b.y - origin.y), hold = Math.max(1, Number(phaseHold) || 600);
    const naturalTravel = Math.max(settings.minMs, Math.min(settings.maxMs, distance / (settings.speedPxPerMs || 1)));
    const duration = usesSlashArt || gunBasic ? hold : Math.min(hold, naturalTravel);
    const delay = usesSlashArt || gunBasic ? 0 : Math.max(0, hold - duration);
    const angle = gunBasic ? firing.angle : Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const direction = distance ? { x: (b.x - a.x) / distance, y: (b.y - a.y) / distance } : { x: 1, y: 0 };
    // Keep the sword mark between the sprites instead of letting it sit over
    // their centers. The bounded insets also keep close formations moving forward.
    const startInset = usesSlashArt ? Math.min(a.radius, distance * .24) : 0;
    const endInset = usesSlashArt ? Math.min(originalTarget.radius, distance * .24) : 0;
    const travelStart = gunBasic ? firing : { x: a.x + direction.x * startInset, y: a.y + direction.y * startInset };
    const travelEnd = { x: b.x - direction.x * endInset, y: b.y - direction.y * endInset };
    const bend = pathKind === 'arc' ? Math.min(42, distance * .18) : 0;
    const coords = t => {
      const from = usesSlashArt || gunBasic ? travelStart : a, to = usesSlashArt ? travelEnd : b;
      return { x: from.x + (to.x - from.x) * t + Math.sin(Math.PI * t) * bend,
        y: from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * bend * .45 };
    };
    const make = (ghost = 0) => {
      const node = group(`${ghost ? 'gm-combat-afterimage' : usesSlashArt ? 'gm-combat-sword-slash-travel'
        : gunBasic ? 'gm-combat-projectile gm-combat-gun-tracer' : 'gm-combat-projectile'}${brutalStrike ? ' gm-combat-brutal-strike-travel' : ''}`,
        ownerId, targetId, brutalStrike ? '#a92f42' : colorFor({ ...event, damageType }));
      for (const [name, value] of Object.entries({ family, 'damage-type': damageType, 'path-kind': pathKind,
        'travel-ms': duration, 'travel-delay-ms': delay, ...(usesSlashArt ? { 'angle-deg': angle.toFixed(2), ...(brutalStrike ? { 'ability-id': 'brutal_strike' } : {}) } : {}) })) node.setAttribute(`data-${name}`, value);
      node.setAttribute('opacity', '0');
      if (usesSlashArt) {
        const size = effectHeight(originalTarget);
        node.setAttribute('data-effect-height', size);
        if (brutalStrike) {
          // Brutal Strike: 1152x576 crimson slash art (ratio 2:1), same size as sword slash
          const slashWidth = size * 1.5, slashHeight = slashWidth * 0.5;
          const slash = element('image', { class: 'gm-combat-brutal-strike-projectile', x: -slashWidth / 2, y: -slashHeight / 2,
            width: slashWidth, height: slashHeight, href: 'data/assets/effects/brutal-strike.png', transform: 'rotate(180)',
            preserveAspectRatio: 'xMidYMid meet', opacity: 1 });
          slash.setAttribute('data-flip-deg', '180');
          slash.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'data/assets/effects/brutal-strike.png');
          node.append(slash);
        } else {
          const slash = element('image', { class: 'gm-combat-sword-slash-projectile', x: -size / 2, y: -size / 2,
            width: size, height: size, href: 'data/assets/effects/sword-slash.png', transform: 'rotate(180)',
            preserveAspectRatio: 'xMidYMid meet', opacity: 1 });
          slash.setAttribute('data-flip-deg', '180');
          slash.setAttribute('data-sprite-scale', '2');
          slash.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'data/assets/effects/sword-slash.png');
          node.append(slash);
        }
      } else if (gunBasic) {
        const extent = effectHeight(a), thickness = extent * .09375;
        node.setAttribute('data-shape', 'bullet'); node.setAttribute('data-size', extent);
        node.setAttribute('data-effect-width', extent); node.setAttribute('data-effect-height', thickness);
        node.setAttribute('data-reference-height', extent);
        node.setAttribute('data-start-x', firing.x); node.setAttribute('data-start-y', firing.y);
        node.setAttribute('data-angle-deg', firing.angle.toFixed(2));
        node.append(element('rect', { x: -extent * .75, y: -thickness * .125, width: extent * .25, height: thickness * .25,
          rx: thickness * .125, fill: 'currentColor', opacity: .15 }));
        node.append(element('rect', { x: -extent * .5, y: -thickness * .25, width: extent * .25, height: thickness * .5,
          rx: thickness * .25, fill: 'currentColor', opacity: .4 }));
        node.append(element('rect', { x: -extent * .25, y: -thickness / 2, width: extent * .5, height: thickness,
          rx: thickness / 2, fill: 'currentColor' }));
        node.append(element('rect', { x: extent * .08, y: -thickness * .25, width: extent * .1, height: thickness * .5,
          rx: thickness * .25, fill: '#fff4d5' }));
      } else {
        const projectileFamily = settings.shape || family;
        const projectileSize = projectileShapeSize(projectileFamily, a);
        node.setAttribute('data-size', projectileSize);
        node.setAttribute('data-effect-height', effectHeight(a));
        node.append(shape(projectileFamily, projectileSize, area ? b.width : undefined));
      }
      layer()?.append(node);
      const frames = Array.from({ length: 9 }, (_, index) => {
        const t = index / 8, p = coords(Math.max(0, t - ghost * .065));
        return { offset: t, transform: `translate(${p.x}px,${p.y}px) rotate(${family === 'wave' ? 0 : angle}deg)`, opacity: t === 1 ? 0 : ghost ? .25 / ghost : .95 };
      });
      animate(node, frames, duration, delay);
    };
    make();
    if (gunBasic) muzzleFlash(row, step, { ...firing, delay, flashDuration: Math.min(140, duration) });
    if (pathKind === 'arc') for (let index = 1; index <= Math.min(3, settings.afterimages || 0); index++) make(index);
    if (area) areaRows.add(row);
  }
  function hitIndex(row, event) {
    const hits = (row.timeline || []).filter(step => damageTypes.has(step.type) && !step.event.isDot
      && step.event.targetId === event.targetId && step.event.actorId === event.actorId);
    return { index: Math.max(1, hits.findIndex(step => step.event === event) + 1), count: hits.length };
  }
  function impact(row, event, phaseHold = 600) {
    if (event.isDot) return;
    const p = point(event.targetId);
    if (!p || !layer()) return;
    const critical = !!event.critical, settings = config.impact || defaults.impact, hit = hitIndex(row, event);
    const punchHit = weaponBasic(row, event, 'unarmed');
    const hitAbilityId = presentationAbility(row);
    const brutalHit = hitAbilityId === 'brutal_strike' && event.actorId === row.actorId;
    const shadowHit = hitAbilityId === 'shadow_strike' && event.actorId === row.actorId;
    const craftedHit = hitAbilityId === 'crafted_blade' && event.actorId === row.actorId;
    const natureHit = hitAbilityId === 'nature_growth' && event.actorId === row.actorId;
    const beastFallbackHit = hitAbilityId === 'beast_command' && sequence8Config(row)
      && (!row.timeline?.some(s => s.event?.presentationEffect === 'beast_command' && s.event?.targetId !== event.targetId))
      && event.actorId === row.actorId;
    const hasCustomHit = brutalHit || shadowHit || craftedHit || natureHit || beastFallbackHit;
    const duration = isReadableAbility(row) ? Math.max(1, Number(phaseHold) || 225)
      : punchHit || hasCustomHit ? Math.max(settings.durationMs || 160, 320) : settings.durationMs || 160;
    const actorPoint = point(event.actorId ?? row.actorId);
    const impactAngle = actorPoint ? Math.atan2(p.y - actorPoint.y, p.x - actorPoint.x) * 180 / Math.PI : 0;
    const impactScale = 1;
    const burstColor = punchHit ? '#ffd36f'
      : brutalHit ? '#e63946'
      : shadowHit ? '#7b2cbf'
      : craftedHit ? '#e7bc79'
      : natureHit ? '#2dc653'
      : beastFallbackHit ? '#ff4d6d'
      : colorFor(event);
    const burst = group('gm-combat-impact', event.actorId ?? row.actorId, event.targetId, burstColor);
    burst.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${hasCustomHit ? 0 : impactAngle}) scale(${impactScale})`);
    burst.setAttribute('data-angle-deg', String(impactAngle));
    burst.setAttribute('data-critical', String(critical)); burst.setAttribute('data-frame', '0');
    burst.setAttribute('data-impact-scale', impactScale);
    if (punchHit) burst.setAttribute('data-punch-burst', 'true');
    const landed = Number(event.hpLoss ?? Math.max(0, (event.amount || 0) - (event.absorbed || 0))) > 0 || Number(event.absorbed) > 0;
    const field = canvas();
    if (landed && field && !compact()) animate(field, [
      { transform: 'translate(0, 0)' },
      { transform: 'translate(-3px, 2px)', offset: .15 },
      { transform: 'translate(3px, -2px)', offset: .35 },
      { transform: 'translate(-2px, -1px)', offset: .6 },
      { transform: 'translate(1px, 1px)', offset: .8 },
      { transform: 'translate(0, 0)' }
    ], isReadableAbility(row) ? duration : Math.min(160, Math.max(1, Number(phaseHold) || 160)), 0, { remove: false, easing: 'ease-out' });
    const authoredSequence6Hit = sequence6Config(row) && event.actorId === row.actorId
      && !event.isReflect && !['lightning_bolt', 'spirit_body_door'].includes(hitAbilityId) && (!event.isReaction || event.isSignature);
    if (sequence3Hit(row, event) || sequence4Hit(row, event) || sequence5Hit(row, event)) return; // Keep shared shake; the authored hit owns its visible impact.
    if (authoredSequence6Hit) return; // retain shared screen shake, but let Sequence 6 own its visible impact.
    let punchArt = null;
    if (brutalHit) {
      burst.setAttribute('data-brutal-strike', 'true');
      // High-opacity crimson slash flash across defender
      const slashWidth = effectHeight(p) * 1.6, slashHeight = slashWidth * 0.5;
      const slashImpact = element('image', { class: 'gm-combat-brutal-strike-impact-slash',
        x: -slashWidth / 2, y: -slashHeight / 2, width: slashWidth, height: slashHeight,
        href: 'data/assets/effects/brutal-strike.png', transform: `rotate(${impactAngle + 180})`,
        preserveAspectRatio: 'xMidYMid meet' });
      slashImpact.setAttribute('data-flip-deg', '180');
      slashImpact.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'data/assets/effects/brutal-strike.png');
      burst.append(slashImpact);
      if (!compact()) {
        animate(slashImpact, [
          { transform: `rotate(${impactAngle}deg) rotate(180deg) scale(1.15)`, opacity: 1 },
          { transform: `rotate(${impactAngle}deg) rotate(180deg) scale(1) rotate(0deg)`, opacity: 0.95, offset: 0.3 },
          { transform: `rotate(${impactAngle}deg) rotate(180deg) scale(0.96)`, opacity: 0 }
        ], Math.min(220, duration));
      }
      // Trailing embers
      const embers = element('g', { class: 'gm-combat-brutal-embers' });
      const emberCoords = [[-28, -14, 4], [-12, -22, 3], [16, -10, 4], [30, 8, 3], [-8, 16, 3.5], [22, 20, 2.5]];
      for (const [ex, ey, r] of emberCoords) {
        embers.append(element('rect', { x: ex, y: ey, width: r, height: r, fill: '#ff4d4d', opacity: 0.9 }));
      }
      burst.append(embers);
      if (!compact()) {
        animate(embers, [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: 'translate(4px, -12px) scale(0.8)', opacity: 0.7, offset: 0.5 },
          { transform: 'translate(8px, -24px) scale(0.4)', opacity: 0 }
        ], Math.min(300, duration * 1.4));
      }
    } else if (shadowHit) {
      burst.setAttribute('data-shadow-strike', 'true');
      // Abyssal Diagonal Slash: high-opacity dark crescent slash tearing across defender
      const slashWidth = effectHeight(p) * 1.6, slashHeight = slashWidth * 0.5;
      const slash = element('g', { class: 'gm-combat-shadow-strike-impact-slash', transform: `rotate(${impactAngle + 180})` });
      slash.append(element('path', {
        d: `M ${-slashWidth * 0.45} ${slashHeight * 0.35} Q 0 ${-slashHeight * 0.55} ${slashWidth * 0.45} ${-slashHeight * 0.25} Q ${slashWidth * 0.15} ${slashHeight * 0.1} ${-slashWidth * 0.45} ${slashHeight * 0.35} Z`,
        fill: '#10002b', stroke: '#7b2cbf', 'stroke-width': '3', opacity: '0.98'
      }));
      slash.append(element('path', {
        d: `M ${-slashWidth * 0.35} ${slashHeight * 0.25} Q 0 ${-slashHeight * 0.45} ${slashWidth * 0.4} ${-slashHeight * 0.2} Q ${slashWidth * 0.1} ${slashHeight * 0.05} ${-slashWidth * 0.35} ${slashHeight * 0.25} Z`,
        fill: '#9d4edd', opacity: '0.95'
      }));
      slash.append(element('path', {
        d: `M ${-slashWidth * 0.2} ${slashHeight * 0.12} Q 0 ${-slashHeight * 0.32} ${slashWidth * 0.32} ${-slashHeight * 0.15}`,
        stroke: '#e0aaff', 'stroke-width': '2.5', fill: 'none', opacity: '0.95'
      }));
      burst.append(slash);
      if (!compact()) {
        animate(slash, [
          { transform: `rotate(${impactAngle}deg) rotate(180deg) scale(1.18)`, opacity: 1 },
          { transform: `rotate(${impactAngle}deg) rotate(180deg) scale(1) rotate(0deg)`, opacity: 0.95, offset: 0.3 },
          { transform: `rotate(${impactAngle}deg) rotate(180deg) scale(0.95)`, opacity: 0 }
        ], Math.min(220, duration));
      }
      // Trailing shadow embers
      const shadowEmbers = element('g', { class: 'gm-combat-shadow-embers' });
      const shadowCoords = [[-32, -18, 5, '#5a189a'], [-16, -26, 3.5, '#7b2cbf'], [18, -14, 4.5, '#9d4edd'], [32, 10, 3.5, '#3c096c'], [-10, 20, 4, '#7b2cbf'], [24, 24, 3, '#c77dff']];
      for (const [ex, ey, r, col] of shadowCoords) {
        shadowEmbers.append(element('circle', { cx: ex, cy: ey, r: r / 2, fill: col, opacity: 0.92 }));
      }
      burst.append(shadowEmbers);
      if (!compact()) {
        animate(shadowEmbers, [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: 'translate(4px, -14px) scale(0.75)', opacity: 0.7, offset: 0.5 },
          { transform: 'translate(8px, -28px) scale(0.35)', opacity: 0 }
        ], Math.min(300, duration * 1.4));
      }
    } else if (craftedHit) {
      // Crafted Blade's authored Brutal Strike-style PNG is rendered by sequence8Impact.
      // Do not layer the legacy procedural brass slash or sparks over that artwork.
      burst.setAttribute('data-crafted-blade', 'true');
    } else if (natureHit) {
      burst.setAttribute('data-nature-growth', 'true');
      // Emerald particles bursting outward when hit lands
      const emeraldParticles = element('g', { class: 'gm-combat-nature-particles' });
      const emeraldCoords = [
        [-22, -18, 4.5, '#2dc653'], [0, -26, 4, '#52b788'], [22, -16, 5, '#74c69d'],
        [-26, 4, 4, '#d8f3dc'], [26, 8, 4.5, '#2dc653'], [-16, 22, 3.5, '#52b788'],
        [14, 20, 4, '#74c69d'], [0, 26, 3, '#d8f3dc']
      ];
      for (const [px, py, r, col] of emeraldCoords) {
        emeraldParticles.append(element('circle', { cx: px, cy: py, r: r / 2, fill: col, opacity: 0.95 }));
      }
      burst.append(emeraldParticles);
      if (!compact()) {
        animate(emeraldParticles, [
          { transform: 'translate(0, 0) scale(0.4)', opacity: 1 },
          { transform: 'scale(1.2)', opacity: 0.85, offset: 0.45 },
          { transform: 'scale(1.5)', opacity: 0 }
        ], Math.min(260, duration * 1.2));
      }
    } else if (beastFallbackHit) {
      burst.setAttribute('data-beast-command-fallback', 'true');
      // The authored transparent claw PNG supplies the laceration; keep only the supporting impact motes here.
      const clawSparks = element('g', { class: 'gm-combat-beast-claw-sparks' });
      const clawCoords = [[-22, -14, 4, '#ff4d6d'], [-6, -22, 3, '#c8b9e8'], [16, -12, 4, '#ff758f'], [28, 8, 3.5, '#ffffff'], [-10, 16, 3, '#ff4d6d'], [20, 22, 2.5, '#c8b9e8']];
      for (const [cx, cy, r, col] of clawCoords) {
        clawSparks.append(element('circle', { cx, cy, r: r / 2, fill: col, opacity: 0.95 }));
      }
      burst.append(clawSparks);
      if (!compact()) {
        animate(clawSparks, [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: 'translate(6px, -14px) scale(0.75)', opacity: 0.7, offset: 0.5 },
          { transform: 'translate(12px, -26px) scale(0.35)', opacity: 0 }
        ], Math.min(280, duration * 1.3));
      }
    } else if (punchHit) {
      // Use the original authored punch artwork, not a procedurally redrawn burst.
      const height = Math.max(120, Math.min(210, (Number(p.spriteHeight) || 96) * 1.5));
      const width = height * 880 / 929;
      const src = 'data/assets/effects/unarmed-punch-impact.png?v=0ec09b43c3593bab';
      burst.setAttribute('data-effect-src', src);
      burst.setAttribute('data-effect-width', width); burst.setAttribute('data-effect-height', height);
      punchArt = image(burst, src, width, height, 'gm-combat-impact-image gm-combat-impact-image-punch');
    } else {
      const pixels = [ [[-2,-2,4,4]], [[-2,-10,4,6],[-2,4,4,6],[-10,-2,6,4],[4,-2,6,4]],
        [[-2,-14,4,5],[-2,9,4,5],[-14,-2,5,4],[9,-2,5,4],[-9,-9,3,3],[6,6,3,3]],
        [[-2,-17,3,3],[-2,14,3,3],[-17,-2,3,3],[14,-2,3,3],[-12,-12,2,2],[10,10,2,2]] ];
      const frameCount = settings.frames || 4;
      for (let index = 0; index < frameCount; index++) {
        const frame = element('g', { class: 'gm-combat-impact-frame', 'data-frame': index, opacity: compact() ? index === frameCount - 1 ? 1 : 0 : index === 0 ? 1 : 0 });
        const pixelIndex = Math.round(index * (pixels.length - 1) / (frameCount - 1));
        for (const [x,y,width,height] of pixels[pixelIndex]) frame.append(element('rect', { x,y,width,height, fill: 'currentColor' }));
        burst.append(frame);
        const start = index / frameCount, end = (index + 1) / frameCount;
        const frames = [{ opacity: index === 0 ? 1 : 0, offset: 0 }];
        if (start > 0) frames.push({ opacity: 1, offset: start });
        frames.push({ opacity: 0, offset: end });
        if (end < 1) frames.push({ opacity: 0, offset: 1 });
        animate(frame, frames.map(key => ({ ...key, easing: 'steps(1,end)' })), duration);
      }
    }
    layer().append(burst);
    if (punchArt && !compact()) animate(punchArt, [
      { opacity: .18, transform: 'scale(.78)' },
      { opacity: 1, transform: 'scale(1.08)', offset: .24 },
      { opacity: .9, transform: 'scale(1)', offset: .46 },
      { opacity: 0, transform: 'scale(.9)' }
    ], duration, 0, { removeNode: burst });
    if (hit.count > 1 && !compact()) for (let index = 0; index < 3; index++) {
      const spark = element('rect', { x: -1, y: -1, width: 3, height: 3, fill: 'currentColor' }); burst.append(spark);
      animate(spark, [{ transform: 'translate(0,0)', opacity: .9 }, { transform: `translate(${(index - 1) * 13}px,${-10 - index * 3}px)`, opacity: 0 }], 110, index * 35);
    }
  }
  function support(type, event, row, phaseHoldMs) {
    const id = event.targetId ?? event.actorId ?? row.targetId ?? row.actorId, p = point(id);
    const duration = Math.max(1, Number(phaseHoldMs) || config.support?.durationMs || 500);
    sequence5Outcome(row, event, duration);
    sequence6Outcome(row, event, duration);
    sequence7Support(row, event, duration);
    if (!p || !layer()) return;
    const color = type === 'heal' || type === 'revive' ? '#91dda9' : type === 'shield' ? '#b6dced' : '#dfc898';
    const node = group(`gm-combat-${type === 'revive' ? 'heal' : type}`, event.actorId ?? row.actorId, id, color);
    node.setAttribute('transform', `translate(${p.x} ${p.y})`);
    node.setAttribute('data-effect-height', effectHeight(p));
    layer().append(node);
    if (type === 'heal' || type === 'revive') {
      if (presentationAbility(row) === 'healing_touch') {
        const size = effectHeight(p);
        const w = size * 1.6, h = w * (768 / 1376);
        const emblem = group('gm-combat-healing-touch-impact', event.actorId ?? row.actorId, id, '#ead8b5');
        emblem.setAttribute('data-ability-id', 'healing_touch'); emblem.setAttribute('data-effect-height', size); emblem.setAttribute('transform', `translate(${p.x} ${p.y})`);
        image(emblem, 'data/assets/effects/healing-touch.png', w, h);
        layer().append(emblem);
        if (!compact()) animate(emblem, [
          { transform: `translate(${p.x}px,${p.y}px) scale(.62)`, opacity: 0 },
          { transform: `translate(${p.x}px,${p.y}px) scale(1)`, opacity: .96, offset: .15 },
          { transform: `translate(${p.x}px,${p.y}px) scale(1.04)`, opacity: .96, offset: .85 },
          { transform: `translate(${p.x}px,${p.y}px) scale(1.08)`, opacity: 0 }
        ], duration);
        else emblem.setAttribute('opacity', '.9');
      }
      for (let index = 0; index < 4; index++) {
        const moteX = (index - 1.5) * 7, moteY = index % 2 * 7;
        const mote = element('path', { d: 'M -1 -4 H 1 V -1 H 4 V 1 H 1 V 4 H -1 V 1 H -4 V -1 H -1 Z', fill: 'currentColor', transform: `translate(${moteX} ${moteY}) scale(2)` });
        node.append(mote);
        const delay = Math.min(index * 45, duration * .2);
        animate(mote, [
          { opacity: 0, transform: `translate(${moteX}px,16px) scale(2)` },
          { opacity: .9, transform: `translate(${moteX}px,8px) scale(2)`, offset: .15 },
          { opacity: .9, transform: `translate(${moteX}px,-26px) scale(2)`, offset: .85 },
          { opacity: 0, transform: `translate(${moteX}px,-38px) scale(2)` }
        ], Math.max(1, duration - delay), delay);
      }
    } else if (type === 'shield') {
      node.setAttribute('data-effect-height', effectHeight(p));
      const ring = element('circle', { class: 'gm-combat-fx-outline', cx: 0, cy: 0, r: p.spriteHeight, fill: 'none', stroke: 'currentColor', 'stroke-width': 4 }); node.append(ring);
      animate(ring, [{ opacity: .4, transform: 'scale(.7)' }, { opacity: .9, transform: 'scale(1)', offset: .15 },
        { opacity: .9, transform: 'scale(1.04)', offset: .85 }, { opacity: 0, transform: 'scale(1.08)' }], duration);
    } else {
      node.setAttribute('data-effect-height', effectHeight(p));
      const icon = element('text', { x: 0, y: -p.radius - 16, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': 30, 'font-weight': 700 });
      icon.textContent = event.type === 'thread' ? '⌁' : event.status ? '!' : '◇'; node.append(icon);
      animate(icon, [{ opacity: .4, transform: 'translate(0,6px)' }, { opacity: 1, transform: 'translate(0,0)', offset: .15 },
        { opacity: 1, transform: 'translate(0,-6px)', offset: .85 }, { opacity: 0, transform: 'translate(0,-10px)' }], duration);
    }
  }
  function abilityChip(row, event, phaseHoldMs) {
    if (row === chipRow || row.abilityId === 'basic_attack' || row.attackKind) return;
    const label = row.ability || row.abilityName || event.ability || event.abilityName;
    const p = point(event.actorId ?? row.actorId), field = canvas()?.getBoundingClientRect();
    if (!label || !p || !field || !layer()) return;
    if (chip) { for (const [animation, node] of [...animations]) if (node === chip || chip.contains(node)) { animation.cancel(); animations.delete(animation); } chip.remove(); }
    const width = Math.max(40, Math.min(field.width - 8, 180, String(label).length * 5.8 + 16));
    chip = group('gm-combat-ability-chip', event.actorId ?? row.actorId, null, '#e3d4b0'); chipRow = row;
    chip.setAttribute('transform', `translate(${Math.max(width / 2 + 4, Math.min(field.width - width / 2 - 4, p.x))} ${Math.max(13, p.y - p.radius - 15)})`);
    chip.append(element('rect', { class: 'gm-combat-ability-chip-bg', x: -width / 2, y: -11, width, height: 20, rx: 2 }));
    const text = element('text', { class: 'gm-combat-ability-chip-label', x: 0, y: 3, 'text-anchor': 'middle' });
    text.textContent = String(label).length > 28 ? `${String(label).slice(0, 27)}…` : String(label); chip.append(text); layer().append(chip);
    animate(chip, [{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }],
      isReadableAbility(row) ? Math.max(1, Number(phaseHoldMs) || readableCastDuration(row)) : config.abilityChipMs || 500);
  }
  function show(cue, playbackSpeed = 1, phaseHoldMs = 600) {
    const event = cue?.event || {}, row = cue?.row || event;
    const type = cue?.type === 'row' ? event.type : cue?.type;
    phaseRow = row; phaseType = type; phaseEvent = event;
    speed = battleAnimationRate(row, playbackSpeed, type, event);
    if (chipRow && row !== chipRow) clearPhase(false); else clearPhase(true);
    if (!cue || cue.type === 'settle') return;
    if (type === 'cast') {
      areaRows.delete(row); abilityChip(row, event, phaseHoldMs);
      abilityCue(row, cue.next, phaseHoldMs);
    }
    else { sequence3Outcome(row, event, phaseHoldMs); sequence4Outcome(row, event, phaseHoldMs); }
    if (damageTypes.has(type) || type === 'reflect') {
      sequence5Outcome(row, event, phaseHoldMs);
      sequence6Outcome(row, event, phaseHoldMs);
      sequence7Guard(row, event, phaseHoldMs);
      sequence7Impact(row, event, phaseHoldMs);
      sequence8Impact(row, event, phaseHoldMs);
      impact(row, event, phaseHoldMs);
    }
    else if (['heal', 'shield', 'revive'].includes(type)) support(type, event, row, phaseHoldMs);
    else if (!['sp_siphon', 'parasite_tick'].includes(event.subtype) && (event.status || event.beneficial || ((sequence3Config(row) || sequence4Config(row) || sequence5Config(row) || sequence6Config(row) || sequence8Config(row) || sequence7Config(row)) && event.type === 'status' && event.targetId != null
      && !event.presentationEffect) || event.type === 'thread' || ['cc_loss', 'madness_loss', 'banished'].includes(event.subtype))) support('status', event, row, phaseHoldMs);
    travel(row, cue.next, phaseHoldMs);
  }
  return { sync: map => { hpMap = map || Object.create(null); prepareSequence6Assets(hpMap); prepareSequence8Assets(hpMap); prepareSequence7Assets(hpMap); }, show,
    prepare: rows => { for (const row of rows || []) { prepareSequence3Asset(sequence3Config(row)); prepareSequence4Asset(sequence4Config(row)); prepareSequence5Asset(sequence5Config(row)); prepareSequence6Asset(sequence6Config(row)); prepareSequence8Asset(sequence8Config(row)); prepareSequence7Asset(sequence7Config(row)); } },
    clear: () => { clearPhase(false); surface?.remove(); surface = null; hpMap = Object.create(null); paused = false; areaRows = new WeakSet(); phaseRow = null; phaseType = null; },
    reflow: () => { clearPhase(false); surface?.remove(); surface = null; },
    pause: () => { paused = true; for (const animation of animations.keys()) animation.pause(); },
    resume: () => { paused = false; for (const animation of animations.keys()) animation.play(); },
    setSpeed: value => { speed = battleAnimationRate(phaseRow, value, phaseType, phaseEvent); if (compact()) clearPhase(false); else for (const animation of animations.keys()) animation.playbackRate = speed; }
  };
}


function createBattleEffects(wrap) {
  const animations = new Set(), touched = new Set();
  const counterPresentations = new WeakMap();
  const pathwayEffects = createPathwayEffects(wrap);
  const combatFx = createCombatFx(wrap);
  const arena = wrap.querySelector('.gm-dungeon-arena');
  let currentMap = Object.create(null), geometry = '';
  const reflow = () => {
    pathwayEffects.sync(currentMap);
    const next = [...wrap.querySelectorAll('.gm-battlefield-canvas, .gm-unit-sprite-anchor')].map(node => {
      const box = node.getBoundingClientRect();
      return [box.left, box.top, box.width, box.height].join(',');
    }).join(';');
    if (geometry && geometry !== next) combatFx.reflow();
    geometry = next;
  };
  arena?.addEventListener('gm-battlefield-layout', reflow);
  let layer = null, rate = 1, ending = false, pendingStrike = null;
  let currentRow = null, currentPhaseType = null, currentPhaseEvent = null;
  let focusedRow = null, focusedUnits = new Set(), focusTimer = null;
  const fxConfig = (typeof G9_DATA !== 'undefined' && G9_DATA.fx) || (typeof G9D !== 'undefined' && G9D.fx);
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const unit = (id, name) => [...wrap.querySelectorAll('.gm-arena-unit')]
    .find(node => id ? node.dataset.unitId === String(id) : name && node.querySelector('.gm-unit-name-label')?.getAttribute('title') === name);
  const anchor = node => node?.querySelector('.gm-unit-sprite-anchor');
  const isVisible = node => {
    if (!node) return false;
    const box = node.getBoundingClientRect(), arena = wrap.querySelector('.gm-dungeon-arena')?.getBoundingClientRect();
    return !!arena && box.width > 0 && box.height > 0 && box.bottom > Math.max(0, arena.top)
      && box.top < Math.min(window.innerHeight, arena.bottom) && box.right > arena.left && box.left < arena.right;
  };
  function mark(node, kind) {
    const a = anchor(node);
    if (!a || !isVisible(a)) return;
    a.classList.add(`gm-cue-${kind}`); touched.add(a);
  }
  function animate(node, frames, duration = 180, options = {}) {
    if (!node?.animate || reduced() || rate >= 4 || !isVisible(node)) return;
    const animation = node.animate(frames, { duration, easing: options.easing || 'ease-out', fill: options.hold ? 'forwards' : 'none' });
    animation.playbackRate = rate;
    animations.add(animation);
    animation.onfinish = () => {
      if (options.hold) { animations.delete(animation); return; } // Keep its filled pose until the recorded hit.
      animations.delete(animation); animation.cancel();
      if (node.matches('.gm-battle-fx-number')) node.remove();
      if (ending && !animations.size) clearTransient();
    };
    animation.oncancel = () => animations.delete(animation);
    return animation;
  }
  function clearTransient(keepStrike = false) {
    for (const animation of [...animations]) {
      if (keepStrike && animation === pendingStrike?.animation) continue;
      animation.cancel(); animations.delete(animation);
    }
    if (!keepStrike) { pendingStrike?.animation.cancel(); pendingStrike = null; }
    for (const a of touched) for (const name of [...a.classList]) if (name.startsWith('gm-cue-')) a.classList.remove(name);
    touched.clear(); layer?.remove(); layer = null;
  }
  function clearTurnFocus() {
    clearTimeout(focusTimer); focusTimer = null;
    for (const node of focusedUnits) {
      node.classList.remove('gm-turn-active', 'gm-turn-dim', 'gm-turn-focus-exempt', 'gm-turn-target');
      node.querySelector('.gm-unit-sprite-anchor')?.classList.remove('gm-turn-active', 'gm-turn-target');
    }
    focusedUnits.clear(); focusedRow = null;
  }
  function focusTurn(row, event) {
    if (!row?.actorId && !row?.actorName) return;
    const actor = unit(row.actorId, row.actorName);
    if (!actor) return;
    if (focusedRow !== row) {
      clearTurnFocus(); focusedRow = row;
    }
    const target = unit(event?.targetId ?? row.targetId, event?.targetName ?? row.targetName);
    // Everyone remains at full brightness. The current target gets a distinct
    // red rim and ground ring while the acting unit keeps its warm turn cue.
    for (const node of wrap.querySelectorAll('.gm-arena-unit')) {
      focusedUnits.add(node);
      const isActor = node === actor;
      const isTarget = node === target && node !== actor;
      node.classList.remove('gm-turn-dim', 'gm-turn-focus-exempt');
      node.classList.toggle('gm-turn-active', isActor);
      node.classList.toggle('gm-turn-target', isTarget);
      const spriteAnchor = node.querySelector('.gm-unit-sprite-anchor');
      spriteAnchor?.classList.toggle('gm-turn-active', isActor);
      spriteAnchor?.classList.toggle('gm-turn-target', isTarget);
    }
    clearTimeout(focusTimer); focusTimer = null;
  }
  function endTurnFocus(row) {
    if (!row || focusedRow !== row) return;
    clearTurnFocus();
  }
  function finish() {
    clearTransient(); pathwayEffects.clear(); combatFx.clear(); currentMap = Object.create(null);
    currentRow = null; currentPhaseType = null;
    clearTurnFocus();
  }
  function clear() {
    clearTransient(); pathwayEffects.clear(); combatFx.clear(); currentMap = Object.create(null);
    currentRow = null; currentPhaseType = null;
    clearTurnFocus(); arena?.removeEventListener('gm-battlefield-layout', reflow);
  }
  function overlay() {
    if (!layer) {
      layer = document.createElement('div'); layer.className = 'gm-battle-fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      wrap.querySelector('.gm-battlefield-canvas')?.append(layer);
    }
    return layer;
  }
  function point(node) {
    const box = anchor(node).getBoundingClientRect();
    const canvas = wrap.querySelector('.gm-battlefield-canvas').getBoundingClientRect();
    return { x: box.left - canvas.left + box.width / 2, y: box.top - canvas.top + box.height / 2 };
  }
  function number(node, text, color, critical = false, duration = 550) {
    if (!isVisible(anchor(node)) || !text) return;
    const p = point(node), element = document.createElement('span');
    element.className = `gm-battle-fx-number${critical ? ' gm-battle-fx-number-critical' : ''}`;
    element.dataset.critical = String(critical);
    element.textContent = text;
    element.style.cssText = `left:${p.x}px;top:${p.y}px;--gm-fx-color:${critical ? fxConfig?.impact?.critColor || '#ffa64d' : color};--gm-fx-number-scale:${critical ? fxConfig?.impact?.critNumberScale || 1.25 : 1}`;
    overlay().append(element);
    const fieldWidth = wrap.querySelector('.gm-battlefield-canvas')?.getBoundingClientRect().width || 0;
    const halfWidth = element.offsetWidth / 2;
    if (halfWidth && fieldWidth) element.style.left = `${Math.max(halfWidth + 4, Math.min(fieldWidth - halfWidth - 4, p.x))}px`;
    animate(element, [{ opacity: 1, transform: 'translate(-50%,-50%)' }, { opacity: 1, offset: .55 }, { opacity: 0, transform: 'translate(-50%,calc(-50% - 6px))' }], duration);
  }
  function motion(node, kind, timingMs = 240) {
    if (!node) return;
    const sprite = node.querySelector('.gm-unit-sprite'), size = anchor(node)?.getBoundingClientRect().width || 0;
    // The scaled pose leaves more room than the nudge consumes, even for a
    // 28px companion; art stays inside its fixed square throughout the motion.
    const nudge = Math.min(2, size * .02), direction = node.classList.contains('ally') ? -1 : 1;
    if (['death', 'arrive', 'revive', 'mythical'].includes(kind)) {
      animate(sprite, [{ opacity: kind === 'death' ? 1 : .25 }, { opacity: kind === 'death' ? .4 : 1 }], ['heal', 'shield', 'revive'].includes(kind) ? timingMs : 240);
    } else if (kind === 'nature-growth-hit') {
      const direction = node.classList.contains('ally') ? 1 : -1;
      animate(sprite, [
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${direction * Math.min(7, size * .1)}px,0) scale(.94)`, offset: .22 },
        { transform: `translate(${-direction * Math.min(3, size * .04)}px,0) scale(1.025)`, offset: .48 },
        { transform: 'translate(0,0) scale(1)' }
      ], 260);
    } else {
      const frames = [{ transform: 'translate(0,0) scale(1)', offset: 0 }];
      frames.push({ transform: kind === 'cast' ? `translate(0,${direction*nudge}px) scale(.94)` : `translate(${nudge}px,0) scale(.94)`, offset: .5 },
        { transform: 'translate(0,0) scale(1)', offset: 1 });
      animate(sprite, frames, 180);
    }
  }
  function attackMotion(actor, target, row, hold) {
    if (!actor || reduced() || rate >= 4) return;
    const a = anchor(actor)?.getBoundingClientRect(), b = anchor(target)?.getBoundingClientRect();
    if (!a?.width) return;
    const dx = b ? b.left + b.width / 2 - a.left - a.width / 2 : 0;
    const dy = b ? b.top + b.height / 2 - a.top - a.height / 2 : actor.classList.contains('ally') ? -1 : 1;
    const distance = Math.hypot(dx, dy) || 1, direction = { x: dx / distance, y: dy / distance };
    const gun = row.attackKind === 'gun', magic = row.attackKind === 'magic';
    const reach = Math.min(a.width, a.height) * (gun ? .025 : magic ? .018 : .055);
    // Each pose's translation fits the margin created by its scale, even for
    // edge-reaching artwork and the smallest companion anchors.
    const pose = (amount, scale) => `translate(${direction.x * amount}px,${direction.y * amount}px) scale(${scale})`;
    const forward = pose(reach, gun ? .94 : magic ? .96 : .88);
    const frames = [
      { transform: 'translate(0,0) scale(1)', offset: 0, easing: 'ease-out' },
      { transform: pose(-reach * .3, .96), offset: .18, easing: 'ease-in' },
      { transform: forward, offset: .4, easing: 'linear' },
      { transform: forward, offset: 1 }
    ];
    const sprite = actor.querySelector('.gm-unit-sprite');
    const animation = animate(sprite, frames, Math.max(1, Number(hold) || 300), { hold: true, easing: 'linear' });
    if (animation) pendingStrike = { animation, sprite, forward, row, targetId: target?.dataset.unitId };
  }
  function show(cue, speed = 1, timingMs = 600) {
    const originalRow = cue?.row || cue?.event;
    const presentationRow = originalRow && counterPresentations.get(originalRow);
    if (presentationRow) cue = { ...cue, row: presentationRow };
    const event = cue?.event || {}, row = cue?.row || event;
    const strike = pendingStrike, sameStrike = strike?.row === row;
    const resolvesStrike = sameStrike && (['damage', 'reaction', 'reflect'].includes(cue?.type)
      && event.actorId === row.actorId || event.type === 'miss' || row.isMiss);
    clearTransient(sameStrike && !resolvesStrike && cue?.type !== 'settle');
    currentRow = row; currentPhaseType = cue?.type === 'row' ? event.type : cue?.type; currentPhaseEvent = event;
    rate = battleAnimationRate(currentRow, speed, currentPhaseType, currentPhaseEvent);
    pathwayEffects.show(cue, rate, timingMs);
    combatFx.show(cue, rate, timingMs);
    if (!cue) return;
    ending = !!cue.isDone;
    focusTurn(row, event);
    const actor = unit(event.actorId || row.actorId, event.actorName || row.actorName);
    const target = unit(event.targetId || row.targetId, event.targetName || row.targetName);
    const type = cue.type === 'row' ? (event.subtype === 'mythical_form' ? 'mythical' : event.type) : cue.type;
    if (resolvesStrike) animate(strike.sprite, [{ transform: strike.forward }, { transform: 'translate(0,0) scale(1)' }], 140);
    if (type === 'cast') {
      if (row.abilityId === 'basic_attack' || row.attackKind) {
        const direct = [cue.next, ...(row.timeline || [])].find(step => step?.event?.targetId
          && step.event.targetId !== row.actorId && (step.event.actorId == null || step.event.actorId === row.actorId)
          && (['damage', 'reaction', 'reflect'].includes(step.type) || step.event.type === 'miss'));
        const nextTarget = row.targetId || direct?.event.targetId;
        attackMotion(actor, unit(nextTarget), row, timingMs);
      } else { motion(actor, 'cast'); }
    }
    else if (['damage', 'reaction', 'reflect'].includes(type)) {
      const hp = event.hpLoss ?? Math.max(0, (event.amount || 0) - (event.absorbed || 0));
      const natureGrowthHit = String(row?.sourceAbilityId || row?.abilityId || '').split(':').pop() === 'nature_growth'
        && (Number(event.hpLoss ?? Math.max(0, (event.amount || 0) - (event.absorbed || 0))) > 0 || Number(event.absorbed) > 0);
      motion(target, natureGrowthHit ? 'nature-growth-hit' : 'hit');
      const label = hp ? `−${abbrNum(hp)}${event.absorbed ? ' · shield' : ''}` : event.absorbed > 0 ? `−${abbrNum(event.absorbed)} Shield` : 'Shield';
      number(target, label, hp ? '#f4b5ad' : '#c6e5fa', !!event.critical && (hp > 0 || event.absorbed > 0));
    } else if (type === 'mythical') { mark(actor, 'mythical'); motion(actor, 'mythical'); }
    else if (type === 'heal' || type === 'shield' || type === 'revive') {
      const recipient = target || actor;
      mark(recipient, type); motion(recipient, type, timingMs);
      number(recipient, type === 'shield' ? `+${abbrNum(event.amount)} Shield` : `+${abbrNum(event.amount)}`,
        type === 'shield' ? '#c6e5fa' : '#b4edc4', false, Math.max(1, Number(timingMs) || 500));
    } else if (type === 'death') { mark(target || actor, 'death'); motion(target || actor, 'death'); }
    else if (event.type === 'miss' || (cue.type === 'row' && row.isMiss)) {
      mark(target, 'miss'); motion(target, 'miss'); number(target, 'Miss', '#d5deea');
    } else if (type === 'thread' || event.type === 'thread' || event.status || row.isSkip
      || ['cc_loss', 'madness_loss', 'banished'].includes(event.subtype)) mark(target || actor, 'control');
    for (const node of cue.arrivals || []) { mark(node, 'arrive'); motion(node, 'arrive'); }
    if (cue.type === 'settle' || cue.type === 'row') endTurnFocus(row);
    if (ending && !animations.size) clearTransient();
  }
  return { show, clear, finish,
    sync: map => { currentMap = map || Object.create(null); pathwayEffects.sync(currentMap); combatFx.sync(currentMap); },
    prepare: rows => {
      // Older saved Counters predate weapon metadata. Borrow only an actual
      // recorded basic from this actor, including one later in the replay.
      // Stable copies preserve held poses without mutating saved outcomes.
      const basics = new Map();
      for (const row of rows || []) {
        if (row?.abilityId !== 'basic_attack' || row.isCounter
          || row.ability === 'Counter' && row.damages?.some(hit => hit.isCounter)
          || row.actorId == null || !row.attackKind) continue;
        const metadata = basics.get(row.actorId) || {};
        for (const key of ['attackKind', 'weaponId', 'sourcePath']) if (row[key] != null) metadata[key] = row[key];
        basics.set(row.actorId, metadata);
      }
      for (const row of rows || []) {
        const counter = row?.isCounter || row?.ability === 'Counter' && row.damages?.some(hit => hit.isCounter);
        const metadata = counter && basics.get(row.actorId);
        if (!metadata || counterPresentations.has(row) || row.abilityId === 'basic_attack' && row.attackKind) continue;
        const presentation = { ...row, abilityId: 'basic_attack' };
        for (const key of ['attackKind', 'weaponId', 'sourcePath'])
          if (presentation[key] == null && metadata[key] != null) presentation[key] = metadata[key];
        counterPresentations.set(row, presentation);
      }
      combatFx.prepare((rows || []).map(row => counterPresentations.get(row) || row));
    },
    reflow: () => { clearTransient(); pathwayEffects.show(null); pathwayEffects.sync(currentMap); combatFx.reflow(); },
    pause: () => { for (const a of animations) a.pause(); pathwayEffects.pause(); combatFx.pause(); },
    resume: () => { for (const a of animations) a.play(); pathwayEffects.resume(); combatFx.resume(); },
    setSpeed: speed => { rate = battleAnimationRate(currentRow, speed, currentPhaseType, currentPhaseEvent); if (rate >= 4) clearTransient(); else for (const a of animations) a.playbackRate = rate; pathwayEffects.setSpeed(rate); combatFx.setSpeed(rate); }
  };
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

  function applyLinkState(event) {
    const target = event.targetId ? hpMap[event.targetId] : hpMap[event.targetName];
    if (!target) return;
    if (Object.hasOwn(event, 'threadState')) target.threadProgress = event.threadState ? { ...event.threadState } : null;
    if (Object.hasOwn(event, 'curseLink')) target.curseLink = event.curseLink ? { ...event.curseLink } : null;
  }
  for (const row of shownRows) {
    applyLinkState(row);
    const caster = row.actorId ? hpMap[row.actorId] : hpMap[row.actorName];
    if (row.subtype === 'mythical_form' && caster) caster.inForm = true;
    // A cast may close before another cast without a resource snapshot between
    // them. Keep its payment in completed history as well as the partial row.
    if (caster && Number.isFinite(caster.sp)) caster.sp = Math.max(0, caster.sp - (row.costSP || 0));
    if (caster && row.costHP > 0) caster.curHp = Math.max(1, caster.curHp - row.costHP);
    // Follow the same causal steps as the log: a shield gained after a hit must
    // survive that hit, and a later hit must consume an earlier recovery.
    const steps = row.timeline || [
      ...(row.shields || []).map(event => ({ type: 'shield', event })),
      ...[...(row.damages || []), ...(row.reflects || []), ...(row.reactions || [])].map(event => ({ type: 'damage', event })),
      ...(row.heals || []).map(event => ({ type: 'heal', event })),
      ...(row.deaths || []).map(event => ({ type: 'death', event })),
      ...(row.revives || []).map(event => ({ type: 'revive', event }))
    ];
    for (const { type, event } of steps) {
      applyLinkState(event);
      if (type === 'mythical') {
        const changed = event.actorId ? hpMap[event.actorId] : hpMap[event.actorName];
        if (changed) changed.inForm = true;
        continue;
      }
      const target = event.targetId ? hpMap[event.targetId] : hpMap[event.targetName];
      if (!target) continue;
      if (['damage', 'reflect', 'reaction'].includes(type)) {
        target.curShield = event.shieldAfter ?? Math.max(0, (target.curShield || 0) - (event.absorbed || 0));
        target.curHp = event.hpAfter ?? Math.max(0, target.curHp - (event.hpLoss ?? Math.max(0, (event.amount || 0) - (event.absorbed || 0))));
      } else if (type === 'shield') {
        target.curShield = event.shieldAfter ?? (target.curShield || 0) + (event.amount || 0);
      } else if (type === 'heal') {
        target.curHp = event.hpAfter ?? Math.min(target.maxHp, target.curHp + (event.amount || 0));
      } else if (type === 'death') {
        target.curHp = 0; target.curShield = 0; target.alive = false; target.threadProgress = null; target.curseLink = null;
      } else if (type === 'revive') {
        target.curHp = event.hpAfter ?? (event.amount || 1); target.alive = true;
      } else if (event.subtype === 'shield_removed') {
        target.curShield = event.shieldAfter ?? 0;
      }
    }
    if (row.type === 'death' && (row.targetId || row.targetName)) {
      const target = row.targetId ? hpMap[row.targetId] : hpMap[row.targetName];
      if (target) { target.curHp = 0; target.curShield = 0; target.alive = false; target.threadProgress = null; target.curseLink = null; }
    }
    if (row.type === 'revive' && (row.targetId || row.targetName)) {
      const target = row.targetId ? hpMap[row.targetId] : hpMap[row.targetName];
      if (target) { target.curHp = row.hpAfter ?? (row.amount || 1); target.alive = true; }
    }
    for (const resource of row.resources || []) {
      const target = (resource.id ? hpMap[resource.id] : hpMap[resource.name]) || {};
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
    if (image.closest('.ability-gallery')) continue;
    const box = image.getBoundingClientRect();
    const rank = image.closest?.('.gm-rank-row');
    const bounds = rank?.getBoundingClientRect();
    const visible = box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
    if (visible && (!bounds || (box.right > bounds.left && box.left < bounds.right && box.bottom > bounds.top && box.top < bounds.bottom))) {
      image.loading = 'eager';
      image.fetchPriority = !rank || image.closest('.ally') ? 'high' : 'auto';
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
    ? Number.isInteger(art.width) && art.width > 0 && Number.isInteger(art.height) && art.height > 0 && typeof art.src === 'string' && [canonical, canonical.replace('/characters/', '/revisions/'), canonical.replace('/characters/', '/revisions/').replace(/\.png$/, '.' + art.src.slice(-16) + '.png')].some(source => art.src.startsWith(source + '?v=') && /^[a-f0-9]{16}$/.test(art.src.slice(source.length + 3)))
    : art.width === size && art.height === size && new RegExp(`^data/assets/runtime/characters/${spritePath}/${stem}\\.${size}\\.[a-f0-9]{16}\\.(png|webp)$`).test(art.src));
  const src = valid ? art.src : original;
  // Start battle artwork immediately; viewport priority also serves campaign portraits.
  const loading = options.variant === 'battle' || options.loading === 'eager' ? 'eager' : 'lazy';
  const priority = loading === 'eager' && (options.priority === 'high' || options.variant === 'battle') ? ' fetchpriority="high"' : '';
  const hide = "this.onerror=null;this.style.display='none';const fb=this.parentElement.querySelector('.combat-sprite-fallback');if(fb)fb.style.display='flex';";
  const quoted = value => "'" + String(value).replace(/[\\'<>&"\r\n\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + "'";
  const legacyError = `this.onerror=()=>{${hide}};this.src=${quoted(legacy)};`;
  const onerror = valid ? `this.onerror=()=>{${legacyError}};this.src=${quoted(original)};` : legacyError;
  return `<img class="combat-sprite-img" src="${esc(src)}" width="${valid ? art.width : size}" height="${valid ? art.height : size}" loading="${loading}" decoding="async"${priority} onerror="${onerror}" alt="${inForm ? 'Mythical Form' : `Seq ${spriteSeq}`}"><div class="combat-sprite-fallback" style="display:none">${esc((u.name||'?').slice(0,2).toUpperCase())}</div>`;
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

function isBattleCompanion(unit) {
  return !!unit.summoned || ['marionette', 'beast', 'device', 'turret', 'spirit'].includes(unit.unitType);
}

function layoutBattlefields(root = document) {
  const arenas = root.matches?.('.gm-dungeon-arena') ? [root] : root.querySelectorAll('.gm-dungeon-arena');
  for (const arena of arenas) {
    const stage = arena.querySelector('.gm-stage-playfield');
    const canvas = arena.querySelector('.gm-battlefield-canvas');
    const crowded = [...arena.querySelectorAll('.gm-companion-formation')].some(group => group.children.length > 6);
    arena.classList.toggle('crowded', crowded);
    const image = arena.querySelector('.gm-battlefield-image');
    if (!stage || !canvas) continue;
    if (!arena.clientWidth) continue;
    const filename = image?.getAttribute('src').split(/[?#]/)[0].split('/').pop();
    const scenes = typeof G9D !== 'undefined' ? G9D.contracts.battlefields?.scenes : null;
    const [left, top, right, bottom] = image && !image.hidden
      ? scenes?.[filename]?.ground || [0.04, 0.23, 0.96, 0.97]
      : [0, 0, 1, 1];
    const aspect = image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 9 / 16;
    const maxHeight = Math.min(window.innerHeight * 0.75, 900);
    const scrollPosition = { left: arena.scrollLeft, top: arena.scrollTop };
    Object.assign(stage.style, {
      left: `${left * 100}%`, top: `${top * 100}%`,
      width: `${(right - left) * 100}%`, height: `${(bottom - top) * 100}%`
    });
    // Stretch the complete scenery across the current box. Artwork dimensions
    // belong to the cards, so changing the backdrop never stretches a unit.
    // Recheck clientWidth after overflow changes: classic scrollbars take space.
    for (let pass = 0; pass < 4; pass++) {
      const viewportWidth = arena.clientWidth;
      const frameHeight = Math.min(viewportWidth / aspect, maxHeight);
      arena.style.height = `${frameHeight}px`;
      Object.assign(canvas.style, { width: `${viewportWidth}px`, height: `${frameHeight}px` });
      const style = getComputedStyle(stage);
      const horizontalPadding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const widestCard = Math.max(0, ...[...stage.querySelectorAll('.gm-arena-unit')].map(card => card.getBoundingClientRect().width));
      const canvasWidth = Math.max(viewportWidth, Math.ceil((widestCard + horizontalPadding) / (right - left)));
      if (canvasWidth > viewportWidth) canvas.style.width = `${canvasWidth}px`;
      const children = [...stage.children];
      const contentHeight = children.reduce((sum, side) => sum + side.getBoundingClientRect().height, 0)
        + Math.max(0, children.length - 1) * (parseFloat(style.rowGap) || 0)
        + (parseFloat(style.paddingTop) || 0);
      const bottomGap = parseFloat(getComputedStyle(arena).getPropertyValue('--gm-guild-bottom-gap')) || 32;
      // Respect both the reviewed clear floor and the requested distance from
      // the image edge; count names, gauges and companion rows in this reserve.
      const height = Math.max(frameHeight, Math.ceil(Math.max(
        (contentHeight + 8 + 1) / (bottom - top),
        (contentHeight + bottomGap + 1) / (1 - top)
      )));
      canvas.style.height = `${height}px`;
      stage.style.paddingBottom = `${Math.max(8, bottomGap - height * (1 - bottom))}px`;
      if (Math.abs(arena.clientWidth - viewportWidth) < 0.5) break;
    }
    // Preserve the reader's pan position across playback updates and summons.
    arena.scrollLeft = scrollPosition.left;
    arena.scrollTop = scrollPosition.top;
    const scrolls = arena.scrollWidth > arena.clientWidth + 1 || arena.scrollHeight > arena.clientHeight + 1;
    arena.classList.toggle('scrollable', scrolls);
    const hint = arena.nextElementSibling;
    if (hint?.classList.contains('gm-battlefield-scroll-hint')) hint.hidden = !scrolls;
    arena.dispatchEvent(new Event('gm-battlefield-layout'));
  }
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

    const companion = isBattleCompanion({ ...u, ...data });
    return `<div class="gm-arena-unit ${team} ${companion ? 'companion' : ''} ${dead ? 'dead' : ''} ${data.inForm ? 'mythical' : ''}" data-unit-role="${companion ? 'companion' : 'character'}" data-unit-index="${index}" data-unit-id="${esc(u.id || u.name)}" data-form-art="${!!data.inForm}">
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
  const formation = (units, team) => {
    const groups = { character: [], companion: [] };
    for (const [index, unit] of (units || []).entries()) {
      const data = (unit.id && hpMap[unit.id]) || (unit.name && hpMap[unit.name]) || unit;
      groups[isBattleCompanion({ ...unit, ...data }) ? 'companion' : 'character'].push(renderCombatEntity(unit, team, index, hpMap));
    }
    return `<div class="gm-character-formation">${groups.character.join('')}</div><div class="gm-companion-formation">${groups.companion.join('')}</div>`;
  };
  return `<div class="gm-dungeon-arena" role="region" tabindex="0" aria-label="Battlefield; scroll to explore when the formation needs more space">
    <div class="gm-battlefield-canvas">
    <div class="gm-dungeon-backdrop" aria-hidden="true">
      ${battlefieldImage ? `<img class="gm-battlefield-image" src="${esc(battlefieldImage)}" alt="" onload="layoutBattlefields(this.closest('.gm-dungeon-arena'))" onerror="this.hidden=true;layoutBattlefields(this.closest('.gm-dungeon-arena'))">` : ''}
    </div>

    <!-- Enemies above Guild; compact companions have their own wrapping rows. -->
    <div class="gm-stage-playfield">
      <section class="gm-arena-side gm-arena-side-allies" aria-label="Guild members">
        <div class="gm-rank-row gm-rank-allies" role="group" aria-label="Guild formation">
          ${formation(allies, 'ally')}
        </div>
      </section>

      <section class="gm-arena-side gm-arena-side-enemies" aria-label="Enemies">
        <div class="gm-rank-row gm-rank-enemies" role="group" aria-label="Enemy formation">
          ${formation(enemies, 'enemy')}
        </div>
      </section>
    </div>
    </div>
  </div><p class="gm-battlefield-scroll-hint" hidden>Scroll to explore the full battlefield.</p>`;
}

function renderTurnRowHtml(row, showDetails) {
  if (row.isRoundHeader) {
    const stats = row.roundStats;
    const statsHtml = stats && (stats.allyHpLoss > 0 || stats.enemyHpLoss > 0)
      ? `<span class="round-summary-pill"><span class="ally-dmg" title="Ally HP lost">Allies −${abbrNum(stats.allyHpLoss)}</span><span class="enemy-dmg" title="Enemy HP lost">Enemies −${abbrNum(stats.enemyHpLoss)}</span></span>` : '';
    return `<div class="battle-round-title"><span class="round-badge">── Round ${row.round} ──</span>${statsHtml}${showDetails && row.initiative ? `<span class="round-init">Init: ${esc(row.initiative)}</span>` : ''}</div>`;
  }
  if (row.isSkip) return `<div class="b-row skip-row ${row.actorTeam}-turn"><span class="b-actor ${row.actorTeam}">${esc(row.actorName)}</span><span class="muted">${esc(row.text || 'loses action to status')}</span></div>`;
  if (row.isMiss && (!row.presentationPartial || row.timeline?.length)) return `<div class="b-row ${row.actorTeam}-turn"><span class="b-actor ${row.actorTeam}">${esc(row.actorName)}</span><span class="b-arrow">→</span><span class="b-target ${row.targetTeam || 'enemy'}">${esc(row.targetName || 'Enemy')}</span><span class="b-outcome miss">💨 ${esc(row.text || 'Missed')}</span></div>`;

  if (row.type === 'thread' || row.type === 'status') {
    const isTh = row.type === 'thread';
    let extra = '';
    if (showDetails) {
      if (row.curVal !== undefined && row.maxVal !== undefined && row.stat) extra = ` (${row.stat} ${abbrNum(row.curVal)}/${abbrNum(row.maxVal)})`;
      else if (row.subtype === 'freeze' || row.isFreeze || (row.text && row.text.includes('afflicted with freeze'))) {
        if (!row.text.includes('DEF') && !row.text.includes('SPEED')) extra = ` (- 10% DEF/ 20% SPEED)`;
      }
    }
    return `<div class="b-row ${isTh ? 'b-subline thread' : 'b-subline status'}"><span>${isTh ? '🧵' : '⏳'} ${esc(row.text)}${extra}</span></div>`;
  }
  if (row.type === 'death') return `<div class="b-row death-row"><span>${row.converted?'🧵':'💀'} <b>${esc(row.targetName || 'Unit')}</b> ${row.converted?'is converted into a Marionette.':'falls.'}</span></div>`;
  if (row.type === 'revive') return `<div class="b-row"><span class="b-outcome heal">${esc(row.text || `${row.targetName || 'Unit'} revives.`)}</span></div>`;
  if (row.type === 'story' || row.type === 'system') {
    const mythical = row.subtype === 'mythical_form' || /mythical (creature )?form/i.test(row.text || '');
    if (mythical) return `<div class="b-row b-row-mythical"><div class="b-mythical-banner"><span class="b-mythical-icon" aria-hidden="true">👁️</span><div class="b-mythical-body"><span class="b-mythical-tag">MYTHICAL FORM AWAKENING</span><span class="b-mythical-desc">${esc(row.text)}</span></div></div></div>`;
    return `<div class="b-row" style="color:var(--muted);font-style:italic"><span>${esc(row.text)}</span></div>`;
  }
  if (row.type === 'result') return `<div class="b-row" style="font-weight:bold;color:${row.success ? 'var(--green)' : 'var(--red)'}"><span>${esc(row.text)}</span></div>`;

  const actorClass = row.actorTeam || 'ally';
  const renderDamage = d => {
    const hpLoss = d.hpLoss ?? Math.max(0, (d.amount || 0) - (d.absorbed || 0));
    const badges = [d.critical ? '<span class="b-badge crit" title="Critical Hit">💥 CRIT</span>' : '', d.trueDamage ? '<span class="b-badge true-dmg" title="True Damage">⚡ TRUE</span>' : '', d.instantKill ? '<span class="b-badge execute" title="Execute">☠️ EXECUTE</span>' : '', d.isReflect ? '<span class="b-badge reflect">🔄 REFLECT</span>' : '', d.isDrain ? '<span class="b-badge drain">🩸 DRAIN</span>' : ''].filter(Boolean).join(' ');
    const hpDetail = showDetails && d.hpAfter !== undefined && d.maxHp ? ` (HP ${abbrNum(d.hpAfter)}/${abbrNum(d.maxHp)})` : '';
    return `<div class="b-sub-outcome"><span class="b-tree-branch">↳</span><span class="b-arrow">→</span><span class="b-target ${d.targetTeam || (actorClass === 'ally' ? 'enemy' : 'ally')}">${esc(d.targetName || 'Target')}</span><span class="b-outcome damage" title="HP loss: ${Number(hpLoss).toLocaleString()}">−${abbrNum(hpLoss)} HP <small>${esc(d.subtype === 'hp_siphon' ? 'HP siphon' : d.damageType || 'dmg')}</small>${hpDetail}</span>${d.absorbed ? `<span class="b-outcome shield">−${abbrNum(d.absorbed)} Shield</span>` : ''}${badges}</div>`;
  };
  const renderDamageGroup = hits => {
    if (hits.length === 1) return renderDamage(hits[0]);
    const target = hits[0];
    const total = hits.reduce((sum, h) => sum + (h.hpLoss ?? Math.max(0, (h.amount || 0) - (h.absorbed || 0))), 0);
    const absorbed = hits.reduce((sum, h) => sum + (h.absorbed || 0), 0);
    return `<details class="b-multihit-group"><summary class="b-sub-outcome b-multihit-summary"><span class="b-tree-branch">↳</span><span class="b-arrow">→</span><span class="b-target ${target.targetTeam || (actorClass === 'ally' ? 'enemy' : 'ally')}">${esc(target.targetName || 'Target')}</span><span class="b-outcome damage" title="Total HP loss: ${Number(total).toLocaleString()}">−${abbrNum(total)} HP <small>${esc(target.subtype === 'hp_siphon' ? 'HP siphon' : target.damageType || 'dmg')}</small></span>${absorbed ? `<span class="b-outcome shield">−${abbrNum(absorbed)} Shield</span>` : ''}<span class="b-badge combo">⚡ ${hits.length} HITS</span><span class="b-multihit-toggle" aria-hidden="true">▾</span></summary><div class="b-multihit-breakdown">${hits.map((h, i) => `<div class="b-multihit-item"><span class="b-hit-num">Hit ${i + 1}</span>${renderDamage(h)}</div>`).join('')}</div></details>`;
  };
  const renderNote = note => {
    let extra = '';
    if (showDetails) {
      if (note.curVal !== undefined && note.maxVal !== undefined && note.stat) extra = ` (${esc(note.stat)} ${abbrNum(note.curVal)}/${abbrNum(note.maxVal)})`;
      else if (note.subtype === 'freeze' || note.isFreeze || (note.text && note.text.includes('afflicted with freeze'))) {
        if (!note.text.includes('DEF') && !note.text.includes('SPEED')) extra = ' (- 10% DEF/ 20% SPEED)';
      }
    }
    return `<div class="b-sublines"><span class="b-subline ${note.type === 'thread' ? 'thread' : 'status'}">${note.type === 'thread' ? '🧵' : '•'} ${esc(note.text)}${extra}</span></div>`;
  };
  const renderMythical = event => `<div class="b-mythical-banner"><span class="b-mythical-icon" aria-hidden="true">👁️</span><div class="b-mythical-body"><span class="b-mythical-tag">MYTHICAL FORM AWAKENING</span><span class="b-mythical-desc">${esc(event.text)}</span></div></div>`;
  // Older/synthetic rows retain their category arrays. Newly grouped rows carry
  // an ordered timeline so reactions cannot jump ahead of the hit causing them.
  const timeline = row.timeline || [
    ...(row.damages || []).map(event => ({ type: 'damage', event })),
    ...(row.reflects || []).map(event => ({ type: 'reflect', event })),
    ...(row.reactions || []).map(event => ({ type: 'reaction', event })),
    ...(row.heals || []).map(event => ({ type: 'heal', event })),
    ...(row.shields || []).map(event => ({ type: 'shield', event })),
    ...(row.subrows || []).filter(event => !['reaction', 'reflect', 'revive'].includes(event.type)).map(event => ({ type: event.type === 'mythical' ? 'mythical' : 'note', event })),
    ...(row.revives || []).map(event => ({ type: 'revive', event })),
    ...(row.deaths || []).map(event => ({ type: 'death', event }))
  ];
  const outcomes = [];
  for (let i = 0; i < timeline.length; i++) {
    const { type, event } = timeline[i];
    if (type === 'damage') {
      const hits = [event], key = event.targetId || event.targetName;
      // Only adjacent hits collapse; an intervening awakening or reaction stays
      // between the exact hits that caused it.
      while (timeline[i + 1]?.type === 'damage' && (timeline[i + 1].event.targetId || timeline[i + 1].event.targetName) === key
        && timeline[i + 1].event.subtype === event.subtype && timeline[i + 1].event.damageType === event.damageType) hits.push(timeline[++i].event);
      outcomes.push(renderDamageGroup(hits));
    } else if (type === 'reaction' || type === 'reflect') {
      outcomes.push(`${type === 'reaction' ? `<span class="b-badge">Reaction · ${esc(event.actorName || 'Unit')}</span>` : ''}${renderDamage(event)}`);
    } else if (type === 'heal' || type === 'shield') {
      const shield = type === 'shield';
      outcomes.push(`<div class="b-sub-outcome"><span class="b-tree-branch">↳</span>${event.actorId && event.actorId !== row.actorId ? `<span class="b-badge">${shield ? 'Shield' : 'Recovery'} · ${esc(event.actorName || 'Unit')}</span>` : ''}<span class="b-arrow">→</span><span class="b-target ${event.targetTeam || actorClass}">${esc(event.targetName || 'Target')}</span><span class="b-outcome ${shield ? 'shield' : 'heal'}"${shield ? '' : ` title="Recovered ${Number(event.amount) || 0} HP"`}>${shield ? '🛡️ ' : ''}+${abbrNum(event.amount)} ${shield ? 'Shield' : 'HP'}</span></div>`);
    } else if (type === 'mythical') {
      outcomes.push(renderMythical(event));
    } else if (type === 'death') {
      outcomes.push(`<div class="b-sublines"><span class="b-subline" style="color:#ff8b8b;font-weight:600">${event.converted ? '🧵' : '💀'} ${esc(event.targetName)} ${event.converted ? 'is converted into a Marionette.' : 'falls.'}</span></div>`);
    } else {
      outcomes.push(renderNote(event));
    }
  }
  const detailsHtml = showDetails && (row.costSP !== undefined || row.cooldown !== undefined) ? `<span class="b-details-info">[Cost: ${row.costHP ? `${row.costHP} HP` : `${row.costSP || 0} SP`} | ${row.cooldown || 0} CD]</span>` : '';
  const isMythicalTurn = timeline.some(step => step.type === 'mythical' || step.event.subtype === 'mythical_authority') || /mythical/i.test(row.ability || '');
  return `<div class="b-row ${actorClass}-turn ${isMythicalTurn ? 'b-row-mythical mythical-turn' : ''}"><div class="b-turn-header"><span class="b-actor ${actorClass}">${esc(row.actorName)}</span><span class="b-ability">· ${esc(row.ability)}</span>${detailsHtml}</div>${outcomes.length ? `<div class="b-outcomes-block">${outcomes.join('')}</div>` : ''}</div>`;

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
  eventCount = null,
  animated = false,
  battlefieldImage = '',
  viewportId = '',
  preview = false,
  looping = false
}) {
  const visible = battlePresentationRows(flattenedRows, shownCount, eventCount);
  const hpMap = calculateCurrentHp(allies, enemies, visible);
  const known=new Set([...allies,...enemies].map(u=>u.id)),added=[...new Set(Object.values(hpMap))].filter(u=>u.id&&!known.has(u.id));
  const shownAllies=[...allies,...added.filter(u=>u.team==='ally')],shownEnemies=[...enemies,...added.filter(u=>u.team==='enemy')];

  // Keep earlier turns in place so incoming events cannot collapse the text being read.
  const contentHtml = visible.map(r => r.presentationPartial ? `<div class="battle-partial-row" aria-hidden="true">${renderTurnRowHtml(r, showDetails)}</div>` : renderTurnRowHtml(r, showDetails)).join('');

  return `<div class="battle-log-wrap" role="log" aria-live="polite" data-shown-count="${shownCount}" data-details="${!!showDetails}" data-paused="${paused}" data-animated="${animated}">
    <div class="battle-toolbar">
      <div class="speed-controls">
        <button type="button" data-pause ${isDone && !(preview && looping) ? 'disabled' : ''} aria-pressed="${paused}" onclick="window.G9.toggleTickerPause()">${paused ? 'Resume' : 'Pause'}</button>
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
    ${renderHpStrip(hpMap, shownAllies, shownEnemies, battlefieldImage)}
    <div class="battle-ticker-viewport" id="${esc(viewportId || (isSim ? 'sim-viewport' : 'battle-viewport'))}">
      ${contentHtml}
      ${!isDone ? `<div class="typing" style="padding:6px 8px;font-style:italic;color:var(--muted)">${paused ? 'Paused · Step to read the next action.' : preview ? 'Playing preview…' : 'Battling…'}</div>` : ''}
    </div>
    <div class="b-result-box ${success ? 'victory' : 'failure'}" ${isDone && summaryText ? '' : 'hidden'}>
      <h4>${preview ? 'Preview complete' : `Encounter Summary · ${battleOutcomeLabel(outcome, success, isSim)}`}</h4>
      <p>${esc(summaryText)}</p>
    </div>
  </div>`;
}

function updateBattleLogComponent(wrap, props) {
  const visible = battlePresentationRows(props.flattenedRows, props.shownCount, props.eventCount);
  const hpMap = calculateCurrentHp(props.allies, props.enemies, visible);
  const viewport = wrap.querySelector('.battle-ticker-viewport');
  const follow = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 35;
  const top = viewport.scrollTop, left = viewport.scrollLeft;
  for (const [team, units] of [['ally', props.allies], ['enemy', props.enemies]]) {
    const rank = wrap.querySelector(team === 'ally' ? '.gm-rank-allies' : '.gm-rank-enemies');
    const present = new Set(Array.from(rank.querySelectorAll('.gm-arena-unit'), node => node.dataset.unitId));
    for (const data of new Set(Object.values(hpMap))) {
      if (data.team === team && data.id && !present.has(data.id)) {
        const group = rank.querySelector(isBattleCompanion(data) ? '.gm-companion-formation' : '.gm-character-formation');
        group.insertAdjacentHTML('beforeend', renderCombatEntity(data, team, units.length, hpMap));
        present.add(data.id);
      }
    }
    for (const node of wrap.querySelectorAll(`.gm-arena-unit.${team}`)) {
      const u = units.find(unit => (unit.id || unit.name) === node.dataset.unitId) || hpMap[node.dataset.unitId] || units[Number(node.dataset.unitIndex)];
      if (!u) continue;
      const data = hpMap[u.id] || hpMap[u.name] || u;
      const companion = isBattleCompanion({ ...u, ...data });
      node.classList.toggle('companion', companion);
      node.dataset.unitRole = companion ? 'companion' : 'character';
      const group = rank.querySelector(companion ? '.gm-companion-formation' : '.gm-character-formation');
      if (node.parentElement !== group) group.append(node);
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
          for (const attribute of ['src', 'width', 'height', 'alt', 'onerror']) {
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
  viewport.querySelector('.battle-partial-row')?.remove();
  if (detailsChanged || props.shownCount < previousCount) {
    viewport.innerHTML = props.flattenedRows.slice(0, props.shownCount).map(row => renderTurnRowHtml(row, props.showDetails)).join('');
  } else {
    if (typing) typing.remove();
    viewport.insertAdjacentHTML('beforeend', props.flattenedRows.slice(previousCount, props.shownCount).map(row => renderTurnRowHtml(row, props.showDetails)).join(''));
  }
  const partial = visible.find(row => row.presentationPartial);
  if (partial) viewport.insertAdjacentHTML('beforeend', `<div class="battle-partial-row" aria-hidden="true">${renderTurnRowHtml(partial, props.showDetails)}</div>`);
  if (!props.isDone && typing) viewport.append(typing);
  if (typing) typing.textContent = props.paused ? 'Paused · Step to read the next action.' : props.preview ? 'Playing preview…' : 'Battling…';
  wrap.dataset.shownCount = props.shownCount;
  wrap.dataset.details = !!props.showDetails;
  wrap.dataset.paused = !!props.paused;
  wrap.dataset.animated = !!props.animated;
  for (const button of wrap.querySelectorAll('[data-speed]')) button.classList.toggle('active', Number(button.dataset.speed) === props.speed);
  wrap.querySelector('[data-skip]').hidden = props.isDone;
  const pause = wrap.querySelector('[data-pause]');
  pause.disabled = props.isDone && !(props.preview && props.looping); pause.textContent = props.paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', !!props.paused);
  wrap.querySelector('[data-step]').disabled = props.isDone;
  const details = wrap.querySelector('button[data-details]');
  details.classList.toggle('active', !!props.showDetails);
  details.textContent = props.showDetails ? 'Hide Details' : 'Show Details';
  const summary = wrap.querySelector('.b-result-box');
  summary.hidden = !props.isDone || !props.summaryText;
  summary.classList.toggle('victory', !!props.success); summary.classList.toggle('failure', !props.success);
  summary.querySelector('h4').textContent = props.preview ? 'Preview complete' : `Encounter Summary · ${battleOutcomeLabel(props.outcome, props.success, props.isSim)}`;
  summary.querySelector('p').textContent = props.summaryText;
  const backdrop = wrap.querySelector('.gm-dungeon-backdrop');
  const image = backdrop.querySelector('img');
  if (!props.battlefieldImage) image?.remove();
  else if (!image || image.getAttribute('src') !== props.battlefieldImage) {
    backdrop.innerHTML = `<img class="gm-battlefield-image" src="${esc(props.battlefieldImage)}" alt="" onload="layoutBattlefields(this.closest('.gm-dungeon-arena'))" onerror="this.hidden=true;layoutBattlefields(this.closest('.gm-dungeon-arena'))">`;
  }
  layoutBattlefields(wrap);
  wrap._battleHpMap = hpMap;
  viewport.scrollTop = follow ? viewport.scrollHeight : top;
  viewport.scrollLeft = left;
}

// ===== Browser UI =====
if (typeof document !== 'undefined') (() => {
  'use strict';
  const loadedGame=loadGame();
  let state=loadedGame||newGame(), tab='hall', selected=null, previewPath=PATH_KEYS[0], planning=null, run=null, notice='', tickerTimer=null, tickerSpeed=1, showBattleDetails=false, simBattleDetails=false, simMode='1v1', simA=[{path:PATH_KEYS[0],sequence:9},{path:PATH_KEYS[0],sequence:9}], simB=[{path:PATH_KEYS[1]||PATH_KEYS[0],sequence:9},{path:PATH_KEYS[1]||PATH_KEYS[0],sequence:9}], simResult=null;
  let simulatorSection='battle', galleryRank=5, gallerySearch='', galleryPath='', galleryPlacement='',
    galleryRate=1, gallerySwapped=false, galleryGuides=false, galleryReplayState=null;
  let battleEffects = null, battleEffectsWrap = null, battleEpoch = 0, tickerWait = null;
  function activeSimulatorPlayback() {
    return simulatorSection === 'battle' ? simResult : null;
  }
  function activePlayback() {
    return run || (tab === 'simulator' ? activeSimulatorPlayback() : null);
  }
  function activePlaybackViewport() {
    return run ? '#battle-viewport' : '#sim-viewport';
  }
  function stopTicker(preserve = false) {
    if (preserve && tickerWait && tickerTimer) {
      const elapsed = Math.max(0, performance.now() - tickerWait.started) * tickerWait.speed;
      tickerWait.remaining = Math.max(0, tickerWait.remaining - elapsed);
    } else if (!preserve) tickerWait = null;
    clearTimeout(tickerTimer); tickerTimer = null;
  }
  function clearBattleEffects() {
    stopGalleryReplay();
    battleEpoch++;
    battleEffects?.clear(); battleEffects = null; battleEffectsWrap = null;
  }
  function stopGalleryReplay() {
    if (!galleryReplayState) return;
    const replay = galleryReplayState; galleryReplayState = null;
    clearTimeout(replay.timer); replay.observer?.disconnect(); replay.effects.clear();
    replay.card.classList.remove('is-playing'); replay.card.dataset.playing = 'false';
    const status = replay.card.querySelector('[data-gallery-status]');
    if (status) status.textContent = 'Ready';
  }
  function galleryEntries() {
    return abilityPreviewCatalog().filter(entry => entry.sequence === galleryRank);
  }
  function galleryArtwork(entry) {
    const id = entry.ability.effectId || entry.ability.id;
    return G9_DATA.fx?.[`sequence${entry.sequence}Abilities`]?.[id];
  }
  function galleryPlacementFor(entry) {
    const id = entry.ability.effectId || entry.ability.id, spec = galleryArtwork(entry);
    if (['thread_binding', 'affliction_thread', 'dream_tether'].includes(id)) return 'thread';
    if (id === 'life_bloom' || spec?.mode === 'caster' || (entry.sequence === 7 && spec?.mode === 'support')) return 'self';
    return spec?.mode === 'travel' ? 'travel' : 'target';
  }
  function updateGalleryFilters() {
    for (const [id, value] of [['gallery-search', gallerySearch], ['gallery-path', galleryPath], ['gallery-placement', galleryPlacement]]) {
      const control = app.querySelector('#' + id); if (control && control.value !== value) control.value = value;
    }
    const cards = [...app.querySelectorAll('[data-gallery-ability]')];
    let count = 0;
    for (const card of cards) {
      const searchable = card.querySelector('header').textContent + ' ' + card.querySelector('.gallery-description').textContent;
      const matches = (!gallerySearch || searchable.toLocaleLowerCase().includes(gallerySearch.toLocaleLowerCase()))
        && (!galleryPath || card.dataset.path === galleryPath)
        && (!galleryPlacement || (galleryPlacement === 'split' ? card.dataset.split === 'true' : card.dataset.placement === galleryPlacement));
      card.hidden = !matches; if (matches) count++;
    }
    const output = app.querySelector('[data-gallery-count]');
    if (output) output.textContent = `${count} of ${cards.length} active abilities`;
    const empty = app.querySelector('[data-gallery-empty]');
    if (empty) empty.hidden = count > 0;
  }
  function replayGalleryAbility(id) {
    if (run || tab !== 'simulator' || simulatorSection !== 'animations') return;
    const entry = galleryEntries().find(value => (value.ability.effectId || value.ability.id) === id);
    const card = [...app.querySelectorAll('[data-gallery-ability]')].find(node => node.dataset.galleryAbility === id);
    if (!entry || !card || card.hidden) return;
    stopGalleryReplay();
    const stage = card.querySelector('.gallery-stage'), box = stage.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) stage.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    const status = card.querySelector('[data-gallery-status]');
    try {
      const demo = buildAbilityPreview({ path: entry.path, sequence: entry.sequence });
      const row = flattenTurnRows(demo.groupedRounds).find(value => value.type === 'turn' && value.actorId === demo.initialAllies[0]?.id);
      if (!row) throw new Error('No cast was recorded.');
      const own = event => event.actorId == null || event.actorId === row.actorId;
      const events = (row.timeline || []).map(step => step.event).filter(event => own(event) && event.targetId != null && event.targetId !== row.actorId);
      const target = events.find(event => event.type === 'damage' && !event.isDot && !event.isReaction && !event.isReflect)
        || events.find(event => ['heal', 'shield'].includes(event.type)) || events[0];
      const castStep = (row.timeline || []).find(step => step.type === 'damage' && step.event === target) || row.timeline?.[0];
      card.querySelector('[data-role="caster"]').dataset.unitId = row.actorId;
      card.querySelector('[data-role="target"]').dataset.unitId = target?.targetId ?? row.targetId ?? row.presentationTargetId ?? demo.initialEnemies[0]?.id;
      const effects = createCombatFx(card);
      effects.prepare([row]);
      card.classList.add('is-playing'); card.dataset.playing = 'true';
      const replay = { card, effects, timer: null, observer: null }; galleryReplayState = replay;
      const hold = readableCastDuration(row);
      effects.show({ type: 'cast', row, next: castStep }, galleryRate, hold);
      status.textContent = 'Playing cast';
      replay.timer = setTimeout(() => { if (galleryReplayState === replay) stopGalleryReplay(); }, hold / galleryRate);
      if (typeof window.IntersectionObserver === 'function') {
        replay.observer = new window.IntersectionObserver(entries => {
          if (galleryReplayState === replay && entries.some(value => !value.isIntersecting)) stopGalleryReplay();
        });
        replay.observer.observe(stage);
      }
    } catch (error) {
      stopGalleryReplay();
      console.error('Could not prepare gallery cast', error);
      status.textContent = 'Could not prepare this cast. Try Replay.';
    }
  }
  window.addEventListener('resize', stopGalleryReplay);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopGalleryReplay(); });
  const app=document.getElementById('app');
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pathName=p=>pathOf(p).name;
  const tierName=(p,s)=>tierFor(p,s).name;
  const activeRoster=()=>state.roster.filter(a=>a.status==='active');
  const combatReady=()=>activeRoster().filter(a=>a.awakened&&a.sequence<=9);
  let chapterAgentIds=[], chapterChoice=null, chapterSelectionMission=null, chapterSelectionInitialized=false;
  let dossierSkillType='active', dossierReturnFocus=null, dossierOpenSections=new Set();
  let portraitViewer=null;
  campaignEnsure(state);
  tab=campaignStatus(state).complete?'hall':'campaign';
  function chapterCommit(fn){
    const draft=clone(state), outcome=fn(draft);
    if(!outcome.ok){toast(outcome.reason);return null;}
    refreshRecruitmentIfDue(draft);
    maintainGuildBoards(draft);
    if(!saveGame(draft)){toast('The chapter could not be saved. Free browser storage and try again.');return null;}
    state=draft;return outcome;
  }
  function chapterBlocked(){
    if(state.pendingContract){toast('Record the saved contract outcome before changing the guild or starting another mission.');return true;}
    if(!state.campaign?.pending)return false;
    toast('Record the saved chapter outcome before changing the guild or starting another mission.');return true;
  }
  let recruitmentBusy=false,recruitReveal=false,recruitRevealTimer=null,marketReveal=false;
  function recruitmentCommit(fn){
    if(recruitmentBusy)return null;recruitmentBusy=true;
    try{const draft=clone(state);advanceGuildDay(draft);const outcome=fn(draft);if(!outcome.ok){toast(outcome.reason);return null;}if(!saveGame(draft)){toast('Recruitment could not be saved. Free browser storage and try again.');return null;}state=draft;return outcome;}finally{recruitmentBusy=false;}
  }
  function commit(fn){
    const draft=clone(state);advanceGuildDay(draft);const outcome=fn(draft);if(outcome?.ok===false){toast(outcome.reason);return false;}refreshRecruitmentIfDue(draft);maintainPathwayInventories(draft);maintainGuildBoards(draft);
    if(!saveGame(draft)){toast(saveError()||'The guild could not be saved. Free browser storage and retry; the action was not applied.');return false;}
    state=draft;render();return true;
  }
  function toast(msg){notice=msg;render();setTimeout(()=>{if(notice===msg){notice='';render()}},2400)}
  function render(options={}){
    const clockDraft=clone(state);advanceGuildDay(clockDraft);if(clockDraft.day!==state.day&&saveGame(clockDraft))state=clockDraft;
    if(portraitViewer)closePortrait();
    const currentDossier=app.querySelector('.character-dossier');
    if(options.resetDossier)dossierOpenSections=new Set();
    else if(currentDossier?.dataset.agentId===selected)dossierOpenSections=new Set(Array.from(currentDossier.querySelectorAll('details[data-dossier-section][open]'),el=>el.dataset.dossierSection));
    if(options.openSection)dossierOpenSections.add(options.openSection);
    stopTicker(true);
    clearBattleEffects();
    const pagePosition = { x: window.scrollX, y: window.scrollY };
    const scrollPositions = Array.from(app.querySelectorAll('.quest-modal, .battle-ticker-viewport, .character-dossier')).map(el => ({
      selector: el.id ? `#${el.id}` : el.classList.contains('character-dossier')?'.character-dossier':'.quest-modal',
      top: el.scrollTop,
      left: el.scrollLeft,
      follow: el.classList.contains('battle-ticker-viewport') && el.scrollHeight - el.scrollTop - el.clientHeight <= 35
    }));
    const active=activeRoster();
    app.innerHTML=`<header class="top"><div><div class="eyebrow">LEDGER OF THE GUILD</div><h1>Guild of Mystery</h1><p>Day ${state.day} · ${esc(state.calendar?.currentDate||'')} · ${esc(reputationRank(state.reputation).name)} · Reputation ${state.reputation}</p></div><div class="brand-mark">XXII</div></header>
    <section class="resources"><div><span>FUNDS</span><b>£${state.funds.toLocaleString()}</b></div><div><span>REPUTATION</span><b>${state.reputation}</b></div><div><span>CONTRACTS</span><b>${state.quests.length}</b></div></section>
    <nav class="tabs" aria-label="Guild sections">${[['hall','Guild Hall'],['campaign','Campaign'],['preview','Pathways'],['simulator','Battle Simulator'],['recruit','Recruitment'],['quests','Contracts'],['wanted','Wanted'],['market','Market'],['inventory','Inventory'],['chronicle','Chronicle']].map(([id,label])=>`<button class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''} onclick="window.G9.tab('${id}')">${label}</button>`).join('')}</nav>
    <main>${tab==='hall'?hall():tab==='campaign'?campaignPage():tab==='preview'?pathwayPreview():tab==='simulator'?battleSimulator():tab==='recruit'?recruit():tab==='quests'?quests():tab==='wanted'?wanted():tab==='market'?marketPage():tab==='inventory'?inventory():chronicleView()}</main>
    ${selected?dossier():''}${planning?assignmentModal():''}${run?runModal():''}${notice?`<div class="toast">${esc(notice)}</div>`:''}`;
    for (const position of scrollPositions) {
      const el = app.querySelector(position.selector);
      if (!el) continue;
      el.scrollTop = position.follow ? el.scrollHeight : position.top;
      el.scrollLeft = position.left;
    }
    layoutBattlefields(app);
    window.scrollTo(pagePosition.x, pagePosition.y);
    if (typeof prioritizeVisiblePartyPortraits === 'function') prioritizeVisiblePartyPortraits();
    const playing = activePlayback();
    const battleWrap = app.querySelector(activePlaybackViewport())?.closest('.battle-log-wrap');
    if (playing && battleWrap && playing.currentTurn < playing.turnRows.length) ensureBattleEffects(playing, battleWrap);
    updateGalleryFilters();
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
    if(url.origin!==base.origin||!/^data\/assets\/(?:characters|revisions)\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*_seq[0-9](?:\.[a-f0-9]{16})?\.png$/.test(relative)||url.hash||url.search&&!/^\?v=[a-f0-9]{16}$/.test(url.search))return;
    const filenameHash=relative.match(/\.([a-f0-9]{16})\.png$/)?.[1];
    if(filenameHash&&url.search!=='?v='+filenameHash)return;
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
  function ensureBattleEffects(playing, wrap) {
    if (battleEffectsWrap !== wrap) {
      clearBattleEffects(); battleEffectsWrap = wrap; battleEffects = createBattleEffects(wrap);
      battleEffects.prepare(playing.turnRows);
    }
    const isSim = !run;
    const map = wrap._battleHpMap || calculateCurrentHp(isSim ? playing.teamA : playing.initialAllies,
      isSim ? playing.teamB : playing.initialEnemies,
      battlePresentationRows(playing.turnRows, playing.currentTurn, playing.eventCount));
    battleEffects.sync(map);
    if (playing.paused) battleEffects.pause();
  }
  function scheduleTicker() {
    const playing = activePlayback();
    if (playing && !playing.paused && playing.currentTurn < playing.turnRows.length && !tickerTimer) {
      const wrap = app.querySelector(activePlaybackViewport())?.closest('.battle-log-wrap');
      if (!wrap) return;
      ensureBattleEffects(playing, wrap);
      if (!playing.entryShown && playing.currentTurn === 0) {
        battleEffects.show({ type: 'entry', arrivals: [...wrap.querySelectorAll('.gm-arena-unit.companion')] }, tickerSpeed);
        playing.entryShown = true;
      }
      const phase = `${playing.currentTurn}:${playing.eventCount ?? 'start'}`;
      if (!tickerWait || tickerWait.playing !== playing || tickerWait.phase !== phase) {
        tickerWait = { playing, phase, remaining: battlePresentationDuration(playing), started: 0, speed: tickerSpeed };
      }
      tickerWait.started = performance.now(); tickerWait.speed = battlePresentationRate(playing, tickerSpeed);
      const delay = tickerWait.remaining / tickerWait.speed;
      const epoch = battleEpoch;
      const timer = setTimeout(() => {
        if (tickerTimer !== timer || epoch !== battleEpoch) return;
        tickerTimer = null;
        const current = activePlayback();
        if (current !== playing) return;
        tickerWait = null;
        const cue = advanceBattlePresentation(playing);
        refreshBattle(cue);
      }, delay);
      tickerTimer = timer;
    }
  }
  function refreshBattle(cue = null) {
    const playing = activePlayback();
    const isSim = !run;
    const viewport = app.querySelector(activePlaybackViewport());
    if (!playing || !viewport) { render(); return; }
    const summary = isSim ? playing.summaryText : summarizeBattleEvents(playing.result.events || [], playing.result.battleSnapshot).summaryText;
    const isDone = playing.currentTurn >= playing.turnRows.length;
    const wrap = viewport.closest('.battle-log-wrap');
    const existing = new Set(wrap.querySelectorAll('.gm-arena-unit'));
    updateBattleLogComponent(wrap, {
      allies: isSim ? playing.teamA : playing.initialAllies,
      enemies: isSim ? playing.teamB : playing.initialEnemies,
      flattenedRows: playing.turnRows, shownCount: playing.currentTurn, isDone,
      eventCount: playing.eventCount, animated: true,
      showDetails: isSim ? simBattleDetails : showBattleDetails, speed: tickerSpeed, paused: !!playing.paused,
      summaryText: playing.isCampaign ? summary.replace(/Casualties/g, 'Agents recovered') : summary,
      success: isSim ? playing.success : playing.result.success,
      outcome: isSim ? playing.battleOutcome : playing.result.battleOutcome || playing.result.battleSnapshot?.outcome,
      isSim,
      battlefieldImage: battlefieldImageFor(isSim ? {} : playing.quest, isSim)
    });
    ensureBattleEffects(playing, wrap);
    if (cue) battleEffects.show({ ...cue, isDone, arrivals: [...wrap.querySelectorAll('.gm-arena-unit')].filter(node => !existing.has(node)) }, tickerSpeed, battlePresentationDuration(playing));
    if (isDone) battleEffects.finish();
    if (playing.paused) battleEffects.pause();
    const completion = app.querySelector('.battle-completion');
    if (!isSim && completion) completion.hidden = !isDone;
    if (typeof prioritizeVisiblePartyPortraits === 'function') prioritizeVisiblePartyPortraits();
    updateGalleryFilters();
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
    const navigation=`<div class="simulator-sections" role="group" aria-label="Simulator section"><button type="button" aria-pressed="${simulatorSection==='battle'}" class="${simulatorSection==='battle'?'active':''}" onclick="window.G9.simulatorSection('battle')">Battle</button><button type="button" aria-pressed="${simulatorSection==='animations'}" class="${simulatorSection==='animations'?'active':''}" onclick="window.G9.simulatorSection('animations')">Ability animations</button></div>`;
    if(simulatorSection==='animations')return `<section class="panel battle-simulator"><div class="section-head"><div><h2>Battle Simulator</h2><p>Compare a whole Sequence using the game's battle effects.</p></div>${navigation}</div>${animationGallery()}</section>`;
    const count=simMode==='1v1'?1:2;
    const side=(arr,label)=>`<div class="sim-side"><h3>${label}</h3>${arr.slice(0,count).map((x,i)=>`<div class="sim-unit"><label>${label} ${i+1} Pathway<select onchange="window.G9.simSet('${label==='Team A'?'A':'B'}',${i},'path',this.value)">${PATH_KEYS.map(k=>`<option value="${k}" ${x.path===k?'selected':''}>${esc(pathOf(k).name)}</option>`).join('')}</select></label><label>Sequence<select onchange="window.G9.simSet('${label==='Team A'?'A':'B'}',${i},'sequence',Number(this.value))">${Array.from({length:10},(_,j)=>9-j).map(n=>`<option value="${n}" ${x.sequence===n?'selected':''}>Sequence ${n}</option>`).join('')}</select></label><label>Trait<select onchange="window.G9.simSet('${label==='Team A'?'A':'B'}',${i},'traitId',this.value)"><option value="">Original trait baseline</option>${TRAIT_TIERS.map(t=>`<optgroup label="${t[0].toUpperCase()+t.slice(1)}">${Object.entries(TRAIT_DATA.entries).filter(([,d])=>d.tier===t).map(([id,d])=>`<option value="${id}" ${x.traitId===id?'selected':''}>${esc(d.name)}</option>`).join('')}</optgroup>`).join('')}</select></label></div>`).join('')}</div>`;
    return `<section class="panel battle-simulator"><div class="section-head"><div><h2>Battle Simulator</h2><p>Run a deterministic preview battle between any Pathway and Sequence combination.</p></div>${navigation}</div><div class="sim-battle-options" role="group" aria-label="Battle size"><button class="${simMode==='1v1'?'active':''}" onclick="window.G9.simMode('1v1')">1v1</button><button class="${simMode==='2v2'?'active':''}" onclick="window.G9.simMode('2v2')">2v2</button></div><div class="sim-grid">${side(simA,'Team A')}${side(simB,'Team B')}</div><div class="sim-actions"><button class="primary" onclick="window.G9.runSimulation()">Simulate Battle</button><button onclick="window.G9.clearSimulation()">Clear Log</button></div>${simResult?`<div class="sim-result"><div class="section-head"><h3>${battleOutcomeLabel(simResult.battleOutcome,simResult.success,true)}</h3><span>${simResult.rounds} rounds · ${simResult.balanceTrace.length} damage events</span></div><div class="sim-hp"><div><b>Team A</b> ${simResult.teamA.filter(x=>x.alive).length}/${simResult.teamA.length} standing</div><div><b>Team B</b> ${simResult.teamB.filter(x=>x.alive).length}/${simResult.teamB.length} standing</div></div><div class="balance-panel"><div class="section-head"><div><h3>Damage Breakdown</h3><p>Every hit: ability multiplier → raw damage → resistance → DEF → final damage, including effect contributions.</p></div></div><div class="balance-table-wrap"><table class="balance-table"><thead><tr><th>Rnd</th><th>Attacker</th><th>Ability</th><th>Stat</th><th>Mult.</th><th>Raw</th><th>Resist.</th><th>After Resist.</th><th>DEF</th><th>DEF Reduction</th><th>Effects</th><th>Final</th></tr></thead><tbody>${simResult.balanceTrace.map(t=>`<tr><td>${t.round}</td><td>${esc(t.attacker)}</td><td><b>${esc(t.ability)}</b><small>${esc(t.damageType)}${t.critical?' · CRIT':''}</small></td><td>${esc(t.stat)}</td><td>${(Number(t.abilityMultiplier||0)*100).toFixed(0)}%${t.effectiveMultiplier!==t.abilityMultiplier?`<small>eff ${(Number(t.effectiveMultiplier||0)*100).toFixed(0)}%</small>`:''}</td><td>${Math.round(t.raw||0)}</td><td>${Number(t.resistance||0).toFixed(1)}%</td><td>${Math.round(t.afterResistance||0)}</td><td>${Math.round(t.defense||0)}</td><td>${Math.round(t.defenseReduction||0)}</td><td>${t.effectContributions?.length?t.effectContributions.map(e=>`${esc(e.type)}${e.multiplier!=null?` ×${Number(e.multiplier).toFixed(2)}`:''}`).join('<br>'):'—'}</td><td><b>${Math.round(t.incoming??t.final??0)}</b></td></tr>`).join('')}</tbody></table></div></div><div class="sim-battle-log-wrap" style="margin-top:16px">
  <div class="section-head"><div><h3>Combat Log</h3><p>Unified turn-by-turn combat view.</p></div></div>
  ${renderBattleLogComponent({
    allies: simResult.teamA,
    enemies: simResult.teamB,
    flattenedRows: simResult.turnRows,
    shownCount: simResult.currentTurn,
    eventCount: simResult.eventCount, animated: true,
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
  function animationGallery(){
    const entries = galleryEntries();
    const placementLabels = { self: 'Caster', target: 'Target', travel: 'Travel', thread: 'Spanning threads', split: 'Split effects' };
    const idle = (src, placement, secondary = false, spec = {}, fixed = false, size = null) => {
      const angle = placement === 'travel' ? (spec.travelDirection === 'target_to_caster' ? 180 : 0) - (Number(spec.nativeAngleDeg) || 0) : 0;
      return `<img class="gallery-effect${secondary?' secondary':''}" data-placement="${placement}" style="--gallery-art-angle:${angle}deg${fixed?';--gallery-angle:0deg':''}${size?`;width:${size}px;height:${size}px`:''}" src="${esc(src)}" width="256" height="256" loading="lazy" decoding="async" alt="">`;
    };
    const cards = entries.map(entry => {
      const id = entry.ability.effectId || entry.ability.id, spec = galleryArtwork(entry), placement = galleryPlacementFor(entry);
      const description = abilityDescription(entry.ability, entry.path, entry.sequence);
      const caster = { id: 'preview_caster', name: pathName(entry.path), path: entry.path, sequence: entry.sequence };
      const target = { id: 'preview_target_0', name: 'Target', path: 'fool', sequence: 9 };
      const frame = galleryRank === 3 && spec ? G9_DATA.fx.sequence3Motion : null;
      const fixed = galleryRank === 3 && spec?.mode !== 'travel' || galleryRank === 4 && spec?.mode !== 'travel'
        && !['bizarro_transformation', 'unaging_mirror_clone', 'interdiction_roar'].includes(id);
      const secondary = spec?.secondaryAsset ? id === 'scarlet_blood_domain'
        ? idle(spec.secondaryAsset, 'travel', true, { travelDirection: 'target_to_caster' })
        : idle(spec.secondaryAsset, id === 'corrupted_flesh' ? 'target' : 'self', true, {}, !!frame, frame?.stationaryWidth)
        : spec?.ghostAsset ? idle(spec.ghostAsset, 'travel', true) : '';
      return `<article class="gallery-card" data-gallery-ability="${esc(id)}" data-path="${esc(entry.path)}" data-placement="${placement}" data-split="${!!secondary}" data-playing="false">
        <header><div class="gallery-path">${esc(pathName(entry.path))}<span>Active</span></div><h4>${esc(entry.ability.name)}</h4><p class="gallery-rank">Sequence ${entry.sequence} · ${esc(tierName(entry.path, entry.sequence))}</p></header>
        <p class="gallery-description" title="${esc(description)}">${esc(description)}</p>
        <div class="gallery-stage gm-dungeon-arena"><div class="gm-battlefield-canvas">
          <div class="gm-arena-unit gallery-unit" data-role="caster" data-unit-id="preview_caster"><div class="gm-unit-sprite-anchor">${getCombatSprite(caster,{variant:'full'})}</div><span class="gallery-unit-label">Caster</span></div>
          <div class="gm-arena-unit gallery-unit" data-role="target" data-unit-id="preview_target_0"><div class="gm-unit-sprite-anchor">${getCombatSprite(target,{variant:'full'})}</div><span class="gallery-unit-label">Target</span></div>
          <div class="gallery-idle" aria-hidden="true">${spec?.asset ? idle(spec.asset, placement, false, spec, fixed, frame ? placement === 'travel' ? frame.travelWidth : frame.stationaryWidth : null) + secondary : '<span class="gallery-standby">Replay to view the cast</span>'}</div>
        </div></div>
        <div class="gallery-card-actions"><span>${placementLabels[secondary?'split':placement]} · cast preview</span><div><button type="button" data-gallery-replay onclick="window.G9.galleryReplay(${esc(JSON.stringify(id))})" aria-label="Replay ${esc(entry.ability.name)}">↻ Replay</button><span data-gallery-status role="status">Ready</span></div></div>
      </article>`;
    }).join('');
    return `<section class="ability-gallery${gallerySwapped?' gallery-swapped':''}${galleryGuides?' gallery-guides-active':''}" aria-labelledby="gallery-title">
      <div class="gallery-intro"><h3 id="gallery-title">Art & placement preview</h3><p>Compare active abilities across a whole Sequence. Replay uses the same cast effects as battle, without changing your guild.</p></div>
      <div class="gallery-controls">
        <label for="gallery-sequence">Sequence<select id="gallery-sequence" onchange="window.G9.gallerySequence(Number(this.value))">${Array.from({length:10},(_,i)=>9-i).map(rank=>`<option value="${rank}" ${rank===galleryRank?'selected':''}>Sequence ${rank}</option>`).join('')}</select></label>
        <label class="gallery-search" for="gallery-search">Find an ability or Pathway<input id="gallery-search" type="search" value="${esc(gallerySearch)}" placeholder="Search abilities and Pathways…" oninput="window.G9.galleryFilter('search',this.value)"></label>
        <label for="gallery-path">Pathway<select id="gallery-path" onchange="window.G9.galleryFilter('path',this.value)"><option value="">All Pathways</option>${PATH_KEYS.map(path=>`<option value="${path}" ${galleryPath===path?'selected':''}>${esc(pathName(path))}</option>`).join('')}</select></label>
        <label for="gallery-placement">Placement<select id="gallery-placement" onchange="window.G9.galleryFilter('placement',this.value)"><option value="">All placements</option>${Object.entries(placementLabels).map(([value,label])=>`<option value="${value}" ${galleryPlacement===value?'selected':''}>${label}</option>`).join('')}</select></label>
        <label for="gallery-speed">Replay speed<select id="gallery-speed" onchange="window.G9.gallerySpeed(Number(this.value))">${[.5,1,1.5].map(rate=>`<option value="${rate}" ${galleryRate===rate?'selected':''}>${rate}×</option>`).join('')}</select></label>
        <label class="gallery-check"><input id="gallery-swap" type="checkbox" ${gallerySwapped?'checked':''} onchange="window.G9.gallerySwap(this.checked)">Swap sides</label>
        <label class="gallery-check"><input id="gallery-guides" type="checkbox" ${galleryGuides?'checked':''} onchange="window.G9.galleryGuides(this.checked)">Alignment guides</label>
      </div>
      <p class="gallery-count" data-gallery-count>${entries.length} of ${entries.length} active abilities</p>
      <div class="gallery-grid">${cards}<p class="gallery-empty" data-gallery-empty hidden>No active abilities match these filters.</p></div>
      <p class="muted gallery-note">64px characters · one cast at a time. This gallery previews art placement; it does not resolve damage, healing or statuses. A representative target is shown. Triggered effects may appear later in battle. Passive abilities are excluded.</p>
    </section>`;
  }
  function hall(){return `${campaignHallCard()}<section class="grid two"><div class="panel"><div class="section-head"><div><h2>Guild Roster</h2><p>Every character begins as an ordinary person.</p></div><span>${combatReady().length} combat-ready</span></div>${state.roster.map(agentCard).join('')||'<div class="empty"><h3>The roster is empty.</h3><p>Visit the Recruitment Office to hire your first ordinary person.</p></div>'}</div><div class="panel"><div class="section-head"><h2>Guild Ledger</h2><button class="small" onclick="window.G9.reset()">Reset</button></div><div class="ledger"><p><b>Reputation</b></p><p>${state.reputation} · <b>${esc(reputationRank(state.reputation).name)}</b>${nextReputationRank(state.reputation)?` · ${nextReputationRank(state.reputation).minimumReputation-state.reputation} to ${esc(nextReputationRank(state.reputation).name)}`:' · Highest guild rank'}. Higher ranks reveal stronger threats. Sequence 9 work remains available at every rank.</p><p><b>Digesting</b></p><p>Successful quests advance a character's understanding of their current potion. Individual contracts digest faster than team contracts.</p><p><b>Permanent loss</b></p><p>Death and failed advancement remove the character from the roster.</p></div></div></section>`}
  function statusBar(label,value){return `<div class="meter"><div><span>${label}</span><b>${Math.round(value||0)}/100</b></div><i><em style="width:${Math.min(100,Math.max(0,value||0))}%"></em></i></div>`}

  function traitDetails(a){return `<div class="trait-details">${traitBadge(a)} <b>${esc(traitName(a))}</b><p>${esc(traitDescription(a))}</p>${a.traitSource==='catalog_v1'&&!traitActive(a)?'<small>Activates after awakening.</small>':''}</div>`;}
  function agentCard(a){const dead=a.status!=='active';return `<article class="agent ${dead?'dead':''} ${a.awakened?'':'unawakened'}" onclick="window.G9.dossier('${a.id}')"><div class="portrait">${esc(a.name.slice(0,1))}</div><div class="agent-main"><div class="agent-title"><div><h3>${esc(a.name)}</h3><p>${esc(a.occupation||'Ordinary person')} · ${a.awakened?esc(pathName(a.path))+' · Sequence '+a.sequence+' — '+esc(tierName(a.path,a.sequence)):'Unawakened'}</p></div><span class="status ${a.status}">${a.awakened?'active':'unawakened'}</span></div>${a.awakened?`<div class="stats">${(()=>{const s=combatDisplayStats(a);return statPair('HP',s.hp)+statPair('SP',`${Math.round(a.sp??maxSPFor(a))} / ${maxSPFor(a)}`)+statPair('ATK',s.atk)+statPair('DEF',s.def)+statPair('INT',s.int)})()}</div>`:''}${statusBar('Madness',a.madness)}${statusBar('Corruption',a.corruption)}${statusBar('Injuries',a.injuries)}${a.madness>=50?'<p class="warning">At 50+ Madness, each action has an 18% chance to be lost. At 100 after a contract, the character is permanently lost.</p>':''}${a.injuries>0?'<p class="muted">Injuries reduce effective HP and other stats by up to 30% until treated.</p>':''}${a.awakened?statusBar('Digesting',a.digest):`<p class="muted">Choose any Pathway when awakening. Combat stats are revealed after awakening.</p>`}${traitDetails(a)}<div class="agent-actions">${!dead&&a.awakened&&a.unitType!=='marionette'&&a.sequence>0?`<button onclick="event.stopPropagation();window.G9.advance('${a.id}')">Advance</button>`:''}${!dead&&(a.injuries||0)>0?`<button onclick="event.stopPropagation();window.G9.heal('${a.id}')">Heal</button>`:''}</div></div></article>`}
  function recruit(){return `<section class="panel recruitment-office"><div class="section-head"><div><h2>Recruitment Office</h2><p>Refresh the four visible candidates, then choose whom to hire.</p></div><button ${state.funds<TRAIT_DATA.refreshCost||recruitReveal?'disabled':''} onclick="window.G9.refreshRecruit()">Refresh · £${TRAIT_DATA.refreshCost}</button></div><p class="recruit-odds">Per candidate: <span>Normal ${TRAIT_DATA.weights.normal}%</span> · <span>Rare ${TRAIT_DATA.weights.rare}%</span> · <span>Epic ${TRAIT_DATA.weights.epic}%</span> · <span>Legendary ${TRAIT_DATA.weights.legendary}%</span></p><div class="recruit-grid ${recruitReveal?'recruit-reveal':''}">${state.recruitPool.map(a=>`<article class="recruit" data-trait-tier="${traitRarity(a)}" onclick="window.G9.recruitInfo('${a.id}')"><div class="portrait large">${esc(a.name.slice(0,1))}</div><h3>${esc(a.name)}</h3><p>${esc(a.occupation)}</p><p class="muted">Combat stats are revealed after awakening.</p>${traitDetails(a)}<button class="primary" onclick="event.stopPropagation();window.G9.hire('${a.id}')">Hire · £${TRAIT_DATA.hireCost}</button></article>`).join('')}</div>${recruitReveal?'<button class="small" onclick="window.G9.skipRecruitReveal()">Skip reveal</button>':''}<p class="muted office-note">Free automatic refresh: ${state.recruitRefreshDay-state.day>0?`in ${state.recruitRefreshDay-state.day} real day(s)`:'available now'}. Hiring every candidate refills the office for free. Paid refresh does not advance the day.</p></section>`}

  function quests(){const rep=state.reputation;const tier=esc(reputationRank(rep).name);const target=questCountForReputation(rep);return `<section class="panel"><div class="section-head"><div><h2>Contract Board</h2><p>Reputation ${rep} · ${tier} · ${state.quests.length}/${target} contracts available.</p><p class="muted">Daily refresh at local midnight. Completed slots refill while stock remains. Used copies return after ${CONTRACT_POOL.returnDays} real days; declined copies return immediately. Beginner and progression posts are protected while their pool has stock.</p></div><button ${state.funds<CONTRACT_POOL.refreshCost||state.pendingContract||state.campaign?.pending?'disabled':''} onclick="window.G9.refreshContracts()">Refresh · £${CONTRACT_POOL.refreshCost}</button></div><details class="ledger"><summary>Contract odds & remaining copies</summary><p>Random-post odds for ${tier}, before depleted Sequences are excluded. Guaranteed beginner and progression posts change the final board mix.</p><div class="material-grid">${Object.entries(reputationRank(rep).sequenceOdds).sort((a,b)=>Number(b[0])-Number(a[0])).map(([seq,odds])=>`<div><b>Sequence ${seq}</b><p>${odds}% · ${contractPoolStock(state,Number(seq))} copies available</p></div>`).join('')}</div></details>${!state.quests.length?'<p class="muted">No contract copies are available. Cooling copies return automatically after three real days.</p>':''}${state.quests.map(q=>`<article class="quest" onclick="window.G9.plan('${q.id}')"><div>${q.difficultySequence<rosterProfile(activeRoster()).bestSequence?'<span class="warning-symbol" title="This threat is stronger than your highest-Sequence active agent.">⚠</span>':''}<span class="tag">${q.difficultySequence===10?'NORMAL':`SEQ ${q.difficultySequence}`}</span><span class="tag">${q.tags?.[0]?.toUpperCase()||'CONTRACT'}</span>${q.requiredPath?`<span class="tag">${esc(pathName(q.requiredPath))}</span>`:''}<h3>${esc(q.name)}</h3><p>${esc(q.brief)}</p><small>Reward £${q.rewards.funds} · +${q.rewards.reputation} reputation</small></div><button onclick="event.stopPropagation();window.G9.plan('${q.id}')">Open Contract</button><button class="small danger-btn" onclick="event.stopPropagation();window.G9.decline('${q.id}')">Decline</button></article>`).join('')}</section>`}
  function wanted(){return `<section class="panel"><div class="section-head"><div><h2>Wanted Board</h2><p>Named supernatural targets. Bring three awakened agents to defeat a named boss.</p></div></div>${state.wanted?.length?state.wanted.map(q=>`<article class="wanted-card" onclick="window.G9.planWanted('${q.id}')"><div class="wanted-eyebrow">WANTED — ${esc((q.name||'TARGET').replace(/^Wanted:\s*/i,''))}</div><h3>${esc(q.target||q.name)}</h3><div class="wanted-meta"><span><b>Known Path:</b> ${esc(q.knownPath||'Unknown')}</span><span><b>Threat:</b> ${esc(q.threat||'★★★☆☆')}</span><span><b>Last Seen:</b> ${esc(q.lastSeen||'Unknown')}</span></div><blockquote>${esc(q.story||q.brief)}</blockquote><h4>Objective</h4><p class="wanted-code">${esc(q.objectiveText||`Capture or kill ${q.target||q.name}`)}</p><h4>Boss phase</h4><p>${esc(q.mechanic||'')}</p><p class="wanted-code">Three awakened agents required · Enhanced potion digestion for each survivor</p><h4>Reward</h4><p class="wanted-code">£${q.rewards?.funds||0}<br>+ ${q.rewards?.reputation||0} Reputation<br>+ ${Object.entries(q.rewards?.materials||{}).map(([name,count])=>`${count} ${esc(name)}`).join(' · ')}</p><div class="wanted-actions"><button onclick="event.stopPropagation();window.G9.planWanted('${q.id}')">Hunt Target</button><button class="small danger-btn" onclick="event.stopPropagation();window.G9.declineWanted('${q.id}')">Decline for today</button></div></article>`).join(''):'<div class="empty"><h3>No active warrants.</h3><p>Warrants appear when reputation and three awakened agents meet a boss’s Sequence. Each named boss can be defeated once.</p></div>'}</section>`}
function marketPage(){const odds=marketWeaponOdds(state.reputation);return `<section class="panel recruitment-office"><div class="section-head"><div><h2>Weapon Market</h2><p>Choose from four offers. Free refresh at local midnight; buying all four refills the display.</p></div><button ${state.funds<MARKET.refreshCost||marketReveal?'disabled':''} onclick="window.G9.refreshMarket()">Refresh · £${MARKET.refreshCost}</button></div><p class="recruit-odds">${Object.entries(odds).map(([tier,weight])=>`<span>${tier[0].toUpperCase()+tier.slice(1)} ${weight}%</span>`).join(' · ')}</p><p class="muted">Epic weapons unlock at ${MARKET.unlockReputation.epic} reputation; Legendary at ${MARKET.unlockReputation.legendary}. Equipped weapons are lost when their agent is permanently lost.</p><div class="recruit-grid ${marketReveal?'recruit-reveal':''}">${state.market.offers.map(offer=>{const w=WEAPONS[offer.weaponId];return `<article class="recruit market-weapon" data-weapon-tier="${w.tier}" data-trait-tier="${w.tier}"><span class="trait-badge trait-${w.tier}">${esc(w.tier.toUpperCase())}</span><h3>${esc(w.name)}</h3><p>Weapon ATK +${w.atk} · ${w.kind==='gun'?'Gun':w.kind==='weapon'?'Melee':'Unarmed'}</p><p class="muted">${esc(w.text)}</p><button class="primary" ${state.funds<w.price?'disabled':''} onclick="window.G9.buyWeapon(${esc(JSON.stringify(offer.id))})">Buy · £${w.price}</button></article>`;}).join('')}</div></section><section class="panel"><div class="section-head"><div><h2>Advancement Materials</h2><p>Unlimited stock. Materials also supply occult treatment.</p></div></div><div class="material-grid">${Object.entries(MARKET.materialPrices).map(([material,price])=>`<article class="material market-material"><b>${esc(material)}</b><span>${state.materials[material]||0} owned · £${price} each</span><label>Quantity<select id="market-material-${Object.keys(MARKET.materialPrices).indexOf(material)}" onchange="const b=this.closest('.market-material').querySelector('button');b.disabled=Number(this.value)*${price}>${state.funds};b.textContent='Buy '+this.value+' · £'+(Number(this.value)*${price});">${[1,2,5,10].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><button ${state.funds<price?'disabled':''} onclick="window.G9.buyMaterial(${esc(JSON.stringify(material))},Number(document.getElementById('market-material-${Object.keys(MARKET.materialPrices).indexOf(material)}').value))">Buy 1 · £${price}</button></article>`).join('')}</div></section>`;}
  function inventory(){const entries=Object.entries(state.materials);return `<section class="panel"><div class="section-head"><div><h2>Guild Inventory</h2><p>Everything currently owned by the guild.</p></div></div><div class="inventory-summary"><div><span>FUNDS</span><b>£${state.funds.toLocaleString()}</b></div><div><span>REPUTATION</span><b>${state.reputation}</b></div><div><span>ROSTER</span><b>${activeRoster().length}</b></div></div><h3>Weapons</h3><div class="material-grid">${Object.values(WEAPONS).filter(w=>w.id!=='none'&&((state.weapons[w.id]||0)>0||state.roster.some(a=>a.weaponId===w.id))).map(w=>`<article class="material"><b>${esc(w.name)}</b><span>${state.weapons?.[w.id]||0} available</span><small>+${w.atk} ATK · ${w.kind==='gun'?'Gun accuracy starts at 50% and gains +5% per Gun Mastery level':'Weapon Mastery improves damage'}${w.bleed?` · ${Math.round(w.bleed*100)}% Bleed`:''}</small><small>${esc(w.text)}</small></article>`).join('')}</div><h3>Materials</h3><div class="material-grid">${entries.map(([name,count])=>`<article class="material"><b>${esc(name)}</b><span>${count}</span><small>Used for ${esc(Object.values(PATHS).find(x=>x.material===name)?.name||'Pathway')} advancement.</small><button class="small" onclick="window.G9.tab('market')">Purchase in Market</button></article>`).join('')}</div></section>`}
  function chronicleView(){return `<section class="panel"><div class="section-head"><h2>Guild Chronicle</h2><span>${state.chronicle.length} entries</span></div>${state.chronicle.map(x=>`<div class="chronicle"><span>DAY ${x.day}</span><p>${esc(x.text)}</p></div>`).join('')}</section>`}
  function combatDisplayStats(a){
  const base=a.awakened?effectiveStats(a):{...(a.stats||{})};
  const displayAgent={...a,stats:base},pm=passiveCombatModifier(displayAgent),w=weaponStats(displayAgent);
  return {hp:Math.round(base.hp*(pm.hp||1)),atk:Math.round(base.atk*pm.atk+w.atk),def:Math.round(base.def*pm.def),int:Math.round(base.int*pm.int),spd:Math.round(speedFor(displayAgent))};
}
function statPair(label,value){return `<span>${label} <b>${value}</b></span>`;}

function equipmentPicker(a){const options=Object.values(WEAPONS).filter(w=>w.id==='none'||w.id===a.weaponId||(state.weapons[w.id]||0)>0).map(w=>`<option value="${w.id}" ${a.weaponId===w.id?'selected':''}>${esc(w.name)} (+${w.atk} ATK) · ${state.weapons[w.id]||0} available</option>`).join('');return `<label class="equipment-select"><span>Equip Weapon</span><select onchange="window.G9.setWeapon(${esc(JSON.stringify(a.id))},this.value)">${options}</select></label>`}
  function pathwayInventoryPanel(a){
    const c=pathwayCollection(a);if(!c)return '';
    const view=clone(a),inv=ensurePathwayInventory(view),actionId=esc(JSON.stringify(a.id)),cap=pathwayAssetCapacity(a),limit=pathwayPreparationLimit(a),busy=!!(state.pendingContract||state.campaign?.pending);
    const acquisition={marionette:'Surviving conversions become owned marionettes. Prepared marionettes enter free at battle entry and share your thread capacity. Destroyed marionettes are lost.',record:'Witness eligible enemy spells. Unspent records survive between battles; replay consumes one record. One slot at Sequence 6, four from Sequence 5.',soul:'Your kills grant one soul with one random compatible ability. Five soul slots at every Sequence. Active powers are paid casts; passive powers require a two-turn manifestation.',spirit:'Your kills grant bound spirits, including damage-over-time and owned-companion kills. Prepare one spirit; defeated vessels recover in three real days.',device:'Successful contracts with a Paragon have a 50% device drop chance; Wanted victories guarantee a drop. One prepared device. Wrecked devices cost £50 to repair.',beast:'Successful contracts with a Moon agent have a 50% beast drop chance; Wanted victories guarantee a drop. One prepared beast. Defeated beasts recover in three real days.',formula:'Learn one formula every three successful contracts at your Sequence or one easier, from Sequence 6. Prepare one ritual that modifies your own spells.',doctrine:'Learn one doctrine every three successful contracts at your Sequence or one easier. Prepare one researched tactic; Spell Imitation remains local to its battle.',conditioning:'Learn Aggression Pattern after three encounters with successful hypnosis. Prepared conditioning replaces the charged command with one turn of offensive preference.'}[c.kind];
    const label=c.kind==='soul'?'Souls':c.kind==='record'?'Records':'Collection';
    const controllerRule=c.kind==='marionette'&&Number(GLOBAL_COMBAT.incoming_by_pathway_sequence?.fool?.[a.sequence]||1)!==1?`A full prepared army makes its controller take ×${Number(GLOBAL_COMBAT.incoming_by_pathway_sequence.fool[a.sequence]).toFixed(2)} HP damage after shields for that battle; fewer deployed marionettes reduce this burden proportionally.`:'';
    const cards=inv.assets.map(asset=>{
      const d=pathwayAssetDefinition(asset),spec=pathwayAssetSpec(asset),isPrepared=inv.prepared.includes(asset.id),usable=pathwayAssetUsable(a,asset),arg=esc(JSON.stringify(asset.id)),power=spec?abilityDescription(spec,asset.sourcePath,asset.sequence):d?.description||'A retained character profile with its own native abilities.';
      const title=pathwayAssetName(asset),condition=asset.condition==='wounded'?`Recovering until day ${asset.readyDay}`:asset.condition==='wrecked'?'Wrecked':a.sequence>asset.sequence?`Sealed until Sequence ${asset.sequence}`:a.sequence>c.unlock?`Deployment unlocks at Sequence ${c.unlock}`:isPrepared?'Prepared':'Stored';
      const cost=c.kind==='soul'?(spec.type==='passive'?`Base invocation: ${PATHWAY_ASSET_RULES.passiveSP} SP · 100 Depravity · ${PATHWAY_ASSET_RULES.passiveCooldown}-turn cooldown · ${PATHWAY_ASSET_RULES.passiveTurns} turns; one manifested passive at a time.`:`Base invocation: ${spec.costSP} SP · 100 Depravity · ${spec.cooldown}-turn cooldown. Soul ownership is retained.`):c.kind==='record'?`Base replay: ${spec.costSP} SP · 100 Records · ${spec.cooldown}-turn cooldown. One stored record is consumed.`:['device','beast','marionette'].includes(c.kind)?'Prepared, usable companions enter automatically without SP or an action and stay until defeated or battle end. Auto / Wanted / Hold policies apply.':c.kind==='spirit'?'Paid deployment uses the native skill cost. Character traits may modify resource costs.':'';
      const recovery=['device','marionette'].includes(c.kind)&&(asset.condition==='wrecked'||(asset.hpRatio??1)<1)?`<button type="button" ${busy?'disabled':''} onclick="window.G9.restoreAsset(${actionId},${arg})">Restore · £${PATHWAY_ASSET_RULES.repairCost}</button>`:['beast','spirit'].includes(c.kind)&&asset.condition==='ready'&&(asset.hpRatio??1)<1?`<button type="button" ${busy?'disabled':''} onclick="window.G9.restoreAsset(${actionId},${arg})">Rest · ${PATHWAY_ASSET_RULES.recoveryDays} days</button>`:'';
      return `<article class="pathway-asset ${isPrepared?'is-prepared':''}" data-asset-id="${esc(asset.id)}" data-asset-tier="${esc(asset.tier||'none')}"><header><h4>${esc(title)}</h4>${asset.tier?`<span class="trait-badge trait-${esc(asset.tier)}">${esc(asset.tier[0].toUpperCase()+asset.tier.slice(1))}</span>`:''}</header><p class="pathway-asset-status">Sequence ${asset.sequence} · ${esc(condition)}</p>${spec?`<p class="muted">${esc(pathName(asset.sourcePath))} · ${spec.type==='passive'?'Paid passive manifestation':'Active power'}</p>`:''}<p>${esc(power)}</p>${d?.drawback?`<p class="pathway-asset-drawback">${esc(d.drawback)}</p>`:''}${cost?`<small>${esc(cost)} Your combat trait still applies.</small>`:''}${asset.hpRatio!=null?`<small>Vessel health: ${Math.round(asset.hpRatio*100)}%</small>`:''}<small>Acquired: ${esc(asset.sourceContract||'Previous encounter')}${asset.sourceName?` · ${esc(asset.sourceName)}`:''}${asset.acquiredDay?` · Day ${asset.acquiredDay}`:''}</small><div class="pathway-asset-actions"><button type="button" ${busy||(!usable&&!isPrepared)?'disabled':''} onclick="window.G9.prepareAsset(${actionId},${arg})">${isPrepared?'Unprepare':'Prepare'}</button>${recovery}${['formula','doctrine','conditioning'].includes(c.kind)?'':`<button type="button" class="small danger-btn" ${busy?'disabled':''} onclick="window.G9.releaseAsset(${actionId},${arg})">Release</button>`}</div></article>`;
    }).join('');
    const learned=['formula','doctrine','conditioning'].includes(c.kind),progress=c.kind==='conditioning'?inv.progress.hypnosis:inv.progress.contracts,next=learned&&inv.assets.length<(PATHWAY_LEARNING_ORDER[c.kind]?.length||0)?`<p class="muted">Learning: ${progress} qualifying ${c.kind==='conditioning'?'hypnosis encounters':'contract victories'} · next unlock at ${(Math.floor(progress/PATHWAY_ASSET_RULES.learningContracts)+1)*PATHWAY_ASSET_RULES.learningContracts}.</p>`:'';
    const policy=!learned?`<label class="pathway-asset-policy">Automatic use<select ${busy?'disabled':''} onchange="window.G9.assetPolicy(${actionId},this.value)">${[['auto','Use prepared assets'],['wanted','Wanted battles only'],['hold','Hold assets']].map(([v,t])=>`<option value="${v}" ${inv.policy===v?'selected':''}>${t}</option>`).join('')}</select></label>`:'';
    const loot=['device','beast'].includes(c.kind)?`<details class="pathway-loot-reference"><summary>Possible drops · one per tier</summary><p>Among drops: Normal 74% · Rare 20% · Epic 5% · Legendary 1%. Contract Sequence sets the vessel's power ceiling.</p>${Object.values(PATHWAY_ASSET_DEFINITIONS).filter(d=>d.kind===c.kind).map(d=>`<div><b>${esc(d.tier[0].toUpperCase()+d.tier.slice(1))} — ${esc(d.name)}</b><p>${esc(d.description)}</p><small>${esc(d.drawback)}</small></div>`).join('')}</details>`:'';
    return `<section class="dossier-skill-panel pathway-inventory" id="dossier-inventory-panel" role="region" tabindex="0" aria-labelledby="dossier-inventory-title"><div class="section-head"><h3>${esc(c.name)}</h3><b>${label}: ${inv.assets.length}/${cap}</b></div><p>${esc(acquisition)} ${esc(controllerRule)}</p>${a.sequence>c.unlock?`<p class="gold-note">Combat use unlocks at Sequence ${c.unlock}.</p>`:''}<p class="muted">Prepared: ${inv.prepared.length}/${limit}. Stored assets provide no automatic stat bonuses.</p>${next}${policy}${busy?'<p class="muted">Record the saved battle outcome before changing your collection.</p>':''}<div class="pathway-asset-grid">${cards||'<p class="muted">This collection is empty. Earn assets through real encounters; simulations and the protected opening chapter do not grant them.</p>'}</div>${loot}</section>`;
  }
  function pathwayOutcomeMarkup(){
    if(run?.isCampaign)return '';
    const result=state.pendingContract?.result||run?.result;if(!result)return '';
    const gains=result.assetGains||[],offers=result.assetOffers||[];if(!gains.length&&!offers.length)return '';
    return `<section class="pathway-outcome"><h3>Pathway acquisitions</h3>${gains.map(g=>`<p><b>${esc(state.roster.find(a=>a.id===g.ownerId)?.name||'Returning agent')}</b> · ${esc(pathwayAssetName(g.asset))}${g.asset.tier?` · ${esc(g.asset.tier)}`:''} · Sequence ${g.asset.sequence}</p>`).join('')}${offers.map(o=>{const a=result.consequences.find(c=>c.type==='syncAgent'&&c.agentId===o.ownerId)?.agent,inv=a?.pathwayInventory,needsReplacement=(inv?.assets.length||0)>=pathwayAssetCapacity(a),arg=esc(JSON.stringify(o.id));return `<article class="pathway-asset-offer" data-offer-id="${esc(o.id)}"><h4>${esc(a?.name||'Returning agent')} · ${esc(pathwayAssetName(o.asset))}</h4><p>${esc(o.asset.tier||o.asset.kind)} · Sequence ${o.asset.sequence}</p>${o.choice===null?`${needsReplacement?`<label>Replace an existing asset<select onchange="if(this.value)window.G9.chooseAssetOffer(${arg},this.value)"><option value="">Choose which asset to release</option>${(inv?.assets||[]).map(x=>`<option value="${esc(x.id)}">${esc(pathwayAssetName(x))} · Sequence ${x.sequence}</option>`).join('')}</select></label>`:`<button type="button" onclick="window.G9.chooseAssetOffer(${arg},null)">Keep asset</button>`}<button type="button" class="small" onclick="window.G9.chooseAssetOffer(${arg},'decline')">Decline acquisition</button>`:`<p class="muted">${o.choice==='accepted'?'Added to the collection.':'Acquisition declined.'}</p>`}</article>`;}).join('')}</section>`;
  }
  function dossier(){
    const a=state.roster.find(x=>x.id===selected); if(!a)return '';
    const actionId=esc(JSON.stringify(a.id));
    const tier=a.awakened?tierFor(a.path,a.sequence):null,eff=a.awakened?combatDisplayStats(a):null;
    const cr=a.awakened?combatRates({...a,stats:effectiveStats(a)}):null;
    const intro=a.introduction||`An ordinary ${a.occupation||'person'} whose life has begun to intersect with the hidden world.`;
    const abilities=a.awakened?pathOf(a.path).sequences.filter(t=>t.sequence>=a.sequence).flatMap(t=>(t.abilities||[]).map(spec=>({...spec,sequence:t.sequence,name:t.name,text:traitAbilityDescription(a,spec,a.path,t.sequence)}))).sort((x,y)=>x.sequence-y.sequence):[];
    const skillType=typeof dossierSkillType==='undefined'||!['active','passive'].includes(dossierSkillType)?'active':dossierSkillType;
    const sections=typeof dossierOpenSections==='undefined'?new Set():dossierOpenSections,openSection=id=>sections.has(id)?'open':'';
    const skills=abilities.filter(x=>x.type===skillType);
    const next=a.awakened&&a.sequence>0?canTrain(state,a):null,weapon=weaponFor(a);
    const portrait=a.awakened&&typeof getCombatSprite==='function'?`<button type="button" class="dossier-portrait-zoom" aria-label="Enlarge character portrait" onclick="window.G9.openPortrait(this)">${getCombatSprite(a,{variant:'full',loading:'eager',priority:'auto'})}<span class="dossier-portrait-hint">Enlarge</span></button>`:`<span class="dossier-initial" aria-hidden="true">${esc(a.name.slice(0,1))}</span>`;
    const pathButtons=PATH_KEYS.map(p=>`<button class="path-choice" onclick="window.G9.choosePath(${actionId},'${p}')"><b>${esc(pathName(p))}</b><span>${esc(pathOf(p).role)}</span></button>`).join('');
    const tabMarkup=type=>{
      const count=abilities.filter(x=>x.type===type).length,active=type===skillType;
      return `<button type="button" role="tab" id="dossier-tab-${type}" aria-controls="dossier-skill-panel" aria-selected="${active}" tabindex="${active?'0':'-1'}" class="${active?'active':''}" onclick="window.G9.dossierSkillTab('${type}')"><b>${type==='active'?'Active':'Passive'}</b><span>${count} ${count===1?'ability':'abilities'}</span></button>`;
    };
    return `<div class="overlay dossier-overlay" onclick="window.G9.closeDossier()"><article class="modal character-dossier" data-agent-id="${esc(a.id)}" role="dialog" aria-modal="true" aria-labelledby="dossier-title" onclick="event.stopPropagation()">
      <button type="button" class="close" aria-label="Close character dossier" onclick="window.G9.closeDossier()">×</button>
      <div class="eyebrow">CHARACTER DOSSIER</div><h2 id="dossier-title" tabindex="-1">${esc(a.name)}</h2>
      <div class="dossier-identity"><div class="dossier-portrait">${portrait}</div><div class="dossier-progression"><p class="dossier-path">${a.awakened?esc(pathName(a.path)):'Ordinary person'}</p><p class="dossier-rank">${a.awakened?`Sequence ${a.sequence} — ${esc(tier.name)}`:'Unawakened'}</p><p class="muted">${esc(a.occupation||'Ordinary person')}</p>${a.awakened?statusBar('Digesting',a.digest):'<p class="muted">Choose a Pathway to begin.</p>'}</div></div>
      ${a.awakened?`<section class="dossier-equipment" aria-label="Equipment"><div class="dossier-equipment-slot" title="${esc(weapon.name)}"><span aria-hidden="true">${weapon.kind==='gun'?'⌁':weapon.kind==='unarmed'?'◇':'†'}</span><small>Weapon</small></div><div class="dossier-equipment-copy"><b>${esc(weapon.name)}</b><small class="trait-${weapon.tier||'normal'}">${esc((weapon.tier||'normal').toUpperCase())} · ${esc(weapon.text)}</small><small>Weapon ATK: +${weapon.atk} · ${weapon.kind==='gun'?'Gun':weapon.kind==='unarmed'?'Bare Hand':'Melee'} Mastery Lv.${weaponStats(a).mastery}</small>${equipmentPicker(a)}</div></section>`:''}
      ${a.awakened?`<div class="big-stats dossier-stats">${[['HP',eff.hp],['SP',`${Math.round(a.sp??maxSPFor(a))} / ${maxSPFor(a)}`],['ATK',eff.atk],['DEF',eff.def],['INT',eff.int],['Speed',cr?cr.speed.toFixed(1):eff.spd||'—']].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div>`:'<p class="muted">Combat stats are revealed after awakening.</p>'}
      ${a.awakened?`<details class="dossier-details dossier-abilities" data-dossier-section="abilities" ${openSection('abilities')}><summary>Abilities <span class="dossier-section-count">${abilities.length} unlocked</span></summary><div class="dossier-skill-tabs" role="tablist" aria-label="Active and passive abilities">${tabMarkup('active')}${tabMarkup('passive')}</div><section class="dossier-skill-panel" id="dossier-skill-panel" role="tabpanel" tabindex="0" aria-labelledby="dossier-tab-${skillType}">${skills.length?skills.map(skill=>`<article class="dossier-ability" data-sequence="${skill.sequence}" data-ability-type="${skill.type}"><h3>Sequence ${skill.sequence} — ${esc(skill.name)}</h3><p>${esc(nativeAbilityCooldown(a,skill)!==Number(skill.cooldown||0)?traitAbilityDescription(a,{...skill,cooldown:nativeAbilityCooldown(a,skill)},a.path,skill.sequence):skill.text)}</p><small>${skill.type==='active'?(abilityEffects(skill).some(e=>e.type==='signature'&&['door_record','tower_imitation'].includes(e.rule))?'Stored skill SP and cooldown':`${a.traitSource==='catalog_v1'||Number(weapon.skillCostMultiplier||1)!==1?'Adjusted cost shown above':`SP ${skill.costSP||0}`} · Cooldown ${nativeAbilityCooldown(a,skill)} turns`):'Always active'}${skill.damage?` · ${esc(abilityDamageText(skill))}`:''}</small></article>`).join(''):`<p class="muted">No ${skillType} abilities yet.</p>`}</section></details>`:''}
      ${pathwayCollection(a)?`<details class="dossier-details dossier-inventory" data-dossier-section="inventory" ${openSection('inventory')}><summary id="dossier-inventory-title">Pathway Inventory <span class="dossier-section-count">${a.pathwayInventory?.assets?.length||0} stored</span></summary>${pathwayInventoryPanel(a)}</details>`:''}
      ${!a.awakened?`<details class="dossier-details" data-dossier-section="awakening" open><summary>Awakening — Sequence 9</summary><p>This character is an ordinary human. Sequence 9 begins their supernatural pathway; it is not an ordinary-human tier. Choose any Pathway; combat stats and individual variation are revealed after awakening.</p><div class="path-grid">${pathButtons}</div></details>`:''}
      <details class="dossier-details" data-dossier-section="condition" ${openSection('condition')}><summary>Condition & combat details</summary>${statusBar('Madness',a.madness)}<p class="${a.madness>=50?'warning':'muted'}">At 50+ Madness: an 18% chance to lose each action. At 100 after a contract: permanent loss. Contract victory reduces Madness by 3; failure adds 12. Treating injuries also reduces it by 15.</p>${statusBar('Corruption',a.corruption)}<p class="muted">Corruption marks targets for anti-corruption vulnerability effects, including Sun purification. Normal contracts do not increase this meter.</p>${statusBar('Injuries',a.injuries)}${a.injuries>0?'<p class="muted">Injuries reduce effective HP and other stats by up to 30% until treated.</p>':''}${cr?`<div class="combat-rates"><span>Crit ${Math.round(cr.crit*100)}%</span><span>Crit Damage +${Math.round(cr.critDamage*100)}%</span><span>Dodge ${Math.round(cr.dodge*100)}%</span><span>Counter ${Math.round(cr.counter*100)}%</span><span>Speed ${cr.speed.toFixed(1)} · AV ${cr.av.toFixed(1)}</span><span>Archetype ${archetypeOf(a.path)}</span><span>Basic attack: ${archetypeOf(a.path)==='Physical'?'ATK':archetypeOf(a.path)==='Agility'?'75% ATK + 35% INT':'80% INT'}, plus weapon damage</span>${pathwayIncomingDamageScale(a)!==1?`<span>Pathway damage received ×${pathwayIncomingDamageScale(a).toFixed(2)} after shields</span>`:''}${Object.entries(GLOBAL_COMBAT.native_ability_damage_by_pathway_sequence?.[a.path]?.[a.sequence]||{}).map(([id,m])=>`<span>${esc(unlockedAbilities(a).find(s=>(s.effectId||s.id)===id)?.name||id)} native damage ×${Number(m).toFixed(2)} after defense</span>`).join('')}<span>Max SP ${maxSPFor(a)}</span><span>Element Resistance: ${Object.entries(cr.resistances||{}).map(([k,v])=>`${esc(k)} ${v>0?'+':''}${Math.round(v)}%`).join(' · ')||'None'}</span>${cr.passives?.length?`<span>Passives: ${cr.passives.map(esc).join(' · ')}</span>`:''}</div><div class="special-meter"><b>${esc(specialStatFor(a.path,a.sequence,a).name)} ${Math.round(specialStatFor(a.path,a.sequence,a).value)}/100</b><small>Gain: ${esc(specialStatFor(a.path,a.sequence,a).gain)} · Spend: ${esc(specialStatFor(a.path,a.sequence,a).spend)}</small></div>`:''}<p class="muted">Weapon Mastery: Gun ${weaponMasteryValue(a,'gun')} · Melee ${weaponMasteryValue(a,'weapon')} · Bare Hand ${weaponMasteryValue(a,'unarmed')}. Mastery is permanently attached to this character; changing weapons does not reset it.</p>${weapon.kind==='gun'?`<p class="muted">Gun Accuracy: ${Math.round((1-weaponStats(a).masteryMiss)*100)}%</p>`:''}${weapon.bleed?`<p class="muted">Bleed: ${Math.round(weapon.bleed*100)}% if target survives</p>`:''}${a.status==='active'&&a.injuries>0?`<button type="button" onclick="window.G9.heal(${actionId})">Treat injuries</button>`:''}</details>
      ${next?`<details class="dossier-details" data-dossier-section="advancement" ${openSection('advancement')}><summary>Advancement</summary><p>Next: <b>Sequence ${a.sequence-1} — ${esc(next.next.name)}</b>. Digesting: ${Math.round(a.digest||0)}%.</p><div class="requirement-box"><b>Requirements</b><span>Digesting: ${next.ready?'Complete':'Not complete'}</span><span>${esc(next.mat)}: ${state.materials[next.mat]||0}/${next.materialCost}</span><span>Funds: £${state.funds.toLocaleString()}/£${next.fundsCost}</span></div><button type="button" class="primary full" onclick="window.G9.advance(${actionId})">Review Advancement</button></details>`:''}
      ${a.awakened&&a.sequence===0?'<p class="gold-note">Sequence 0 — Deity. No further advancement.</p>':''}
      ${a.unitType==='marionette'?`<p class="dossier-restriction"><b>Owner:</b> ${esc(state.roster.find(x=>x.id===a.ownerId)?.name||a.ownerId||'Unknown')}<br>${esc((a.permanentTraits||['Marionette','Cannot advance','Permanent death']).join(' · '))}</p>`:''}
      <details class="dossier-details" data-dossier-section="biography" ${openSection('biography')}><summary>Biography & history</summary><h3>Introduction</h3><p>${esc(intro)}</p><h3>Combat Trait</h3>${traitBadge(a)}<p><b>${esc(traitName(a))}</b> — ${esc(traitDescription(a))}</p>${a.awakened?`<h3>Individual Variance</h3><p class="muted">Each stat has a fixed individual variation of ±10%. Advancement preserves these rolls.</p><div class="variance-box">${['hp','atk','def','int','speed'].map(key=>`<span>${key==='speed'?'Speed':key.toUpperCase()} ×${(a.statVariance?.[key]||1).toFixed(2)}</span>`).join('')}</div>`:''}<h3>History</h3>${(a.history||[]).slice().reverse().map(h=>`<p class="history"><small>Day ${h.day}</small> ${esc(h.text)}</p>`).join('')}</details>
      <div class="dossier-footer"><button type="button" onclick="window.G9.closeDossier()">Close</button></div>
    </article></div>`;
  }
  function assignmentModal(){const q=planning;const ready=combatReady().filter(a=>q.kind!=='wanted'||a.unitType!=='marionette');const selectedParty=ready.filter(a=>window.G9.selectedIds.includes(a.id)),rewards=q.kind==='wanted'?wantedRewardsForParty(q,selectedParty):q.rewards;return `<div class="overlay"><div class="modal"><button class="close" onclick="window.G9.cancelPlan()">×</button><div class="eyebrow">CONTRACT ASSIGNMENT</div><h2>${esc(q.name)}</h2><p>${esc(q.story||q.brief)}</p>${q.encounterVariant?`<p class="encounter-modifier"><b>${esc(q.encounterVariant.name)}</b> · ${esc(q.encounterVariant.description)}</p>`:''}<p><b>Threat:</b> Sequence ${q.difficultySequence}${q.kind==='wanted'?' boss · Three Beyonders required':''} · <b>Reward:</b> £${rewards.funds}</p><p class="muted assignment-materials"><b>Materials on victory:</b> ${Object.entries(rewards.materials||{}).map(([material,count])=>`${count} ${esc(material)}`).join(' · ')||(q.kind==='wanted'?'Select a party to preview its pathway materials.':'None')}</p><div class="dispatch-header"><h3>Assign Party (${q.requiredPartySize?'3':'1–3'} Beyonders) <span class="dispatch-count">${window.G9.selectedIds.length}/3 Selected</span></h3>${window.G9.selectedIds.length === 1&&q.kind!=='wanted' ? `<div class="solo-bonus-badge">⚡ <b>Solo Dispatch Active:</b> +${Math.round((G9D.system.digestion.individual_multiplier-1)*100)}% Potion Digestion Bonus upon completion!</div>` : ''}</div><div class="assign-list">${ready.length?ready.map(a=>`<button type="button" class="assign-row ${window.G9.selectedIds.includes(a.id)?'selected':''}" onclick="window.G9.toggleAssign('${a.id}')"><span class="assign-check">${window.G9.selectedIds.includes(a.id)?'✓':'○'}</span><span><b>${esc(a.name)}</b> · ${esc(pathName(a.path))} Seq ${a.sequence}<small>Digest ${a.digest||0}% · Victory +${digestGain(q,window.G9.selectedIds.length===1,a)}% · Injuries ${a.injuries||0}/100 · Effective HP ${combatDisplayStats(a).hp} · Weapon: ${esc(weaponFor(a).name)}</small></span><select onclick="event.stopPropagation()" onchange="window.G9.setWeapon('${a.id}',this.value)">${Object.values(WEAPONS).filter(w=>w.id==='none'||w.id===a.weaponId||(state.weapons[w.id]||0)>0).map(w=>`<option value="${w.id}" ${a.weaponId===w.id?'selected':''}>${esc(w.name)} (${state.weapons[w.id]||0})</option>`).join('')}</select></button>`).join(''):'<p class="muted">No awakened characters are available. Recruit and awaken someone first.</p>'}</div><div class="assign-actions"><button onclick="window.G9.saveTeam()">Save Selected Team</button><button onclick="window.G9.clearSelection()">Clear</button></div><button class="primary full" ${q.requiredPartySize&&window.G9.selectedIds.length!==q.requiredPartySize?'disabled':''} onclick="window.G9.launch()">${q.kind==='wanted'?'Confront Boss':'Begin Contract'}</button></div></div>`}
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
      eventCount: run.eventCount, animated: true,
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
      ${wanted?`<div class="wanted-meta"><span><b>Known Path:</b> ${esc(q.knownPath||'Unknown')}</span><span><b>Threat:</b> ${esc(q.threat||'★★★☆☆')}</span><span><b>Last Seen:</b> ${esc(q.lastSeen||'Unknown')}</span></div><blockquote>${esc(q.story||q.brief)}</blockquote><h4>Objective</h4><p class="wanted-code">${esc(q.objectiveText||'Capture or kill the target')}</p><h4>Boss phase</h4><p>${esc(q.mechanic||'')}</p><p class="wanted-code">Three awakened agents required · Enhanced potion digestion for each survivor</p><h4>Reward</h4><p class="wanted-code">£${q.rewards?.funds||0}<br>+ ${q.rewards?.reputation||0} Reputation</p>`:''}
      ${run.isCampaign?'<p class="campaign-protection">Cantor Vale · Sequence 9 Sleepless. Your chapter preparations are active; your agents are protected.</p>':''}
      ${run.result.retreat?.success?'<p class="warning retreat-result">Retreat succeeded. Returning agents have 99 injuries. Treat them in the Guild Hall before another dispatch.</p>':''}
      ${logHtml}
      ${isDone&&!run.isCampaign?`<section class="encounter-feedback"><h3>${run.result.success?'Contract rewards':'Outcome'}</h3><p>£${run.result.rewards?.funds||0} · +${run.result.rewards?.reputation||0} reputation${Object.entries(run.result.rewards?.materials||{}).map(([mat,count])=>` · ${count} ${esc(mat)}`).join('')}</p>${(run.result.rosterReport||[]).map(a=>`<p><b>${esc(a.name)}</b> · ${a.survived?`+${a.digestion}% digestion · ${a.injuries}/100 injuries`:'Permanently lost; equipped weapon lost'}</p>`).join('')}${(run.result.events||[]).some(e=>['weapon','pathway_asset'].includes(e.subtype))?`<details><summary>Weapon & collection effects</summary>${[...new Set(run.result.events.filter(e=>['weapon','pathway_asset'].includes(e.subtype)).map(e=>e.text))].map(text=>`<p>${esc(text)}</p>`).join('')}</details>`:''}</section>`:''}
      <div class="battle-completion" ${isDone ? '' : 'hidden'}>
      ${run.isCampaign?`<p>${esc(run.result.lines.at(-1)?.text||'')}</p>${run.result.success?campaignRewardMarkup(CAMPAIGN.missions[3].rewards):''}`:''}
      ${pathwayOutcomeMarkup()}
      <div class="result ${run.result.success?'success':'failure'}">${run.isCampaign?(run.result.success?'RESIDENTS RESCUED':'AGENTS RECOVERED · RETRY AVAILABLE'):run.result.success?(wanted?'TARGET ELIMINATED':'CONTRACT FULFILLED'):((run.result.battleOutcome||run.result.battleSnapshot?.outcome)==='timeout'?'ROUND LIMIT · CONTRACT INCOMPLETE':wanted?'HUNT FAILED':'CONTRACT FAILED')}</div><button class="primary full" ${(state.pendingContract?.result?.assetOffers||[]).some(o=>o.choice==null)?'disabled':''} onclick="window.G9.closeQuest()">${run.isCampaign?(run.result.success?'Record victory & continue':'Return and retry'):'Return to Guild'}</button>
      </div>
    </div></div>`;
  }
  window.G9={
    refreshMarket:()=>{if(chapterBlocked()||marketReveal)return;if(!commit(d=>refreshWeaponMarket(d)))return;marketReveal=true;render();setTimeout(()=>{marketReveal=false;render();},650);},
    buyWeapon:offerId=>{if(chapterBlocked())return;commit(d=>buyMarketWeapon(d,offerId));},
    buyMaterial:(material,quantity=1)=>{if(chapterBlocked())return;commit(d=>buyMarketMaterial(d,pathOf(material)?.material||material,quantity));},
    prepareAsset:(agentId,assetId)=>{commit(d=>changePathwayPreparation(d,agentId,assetId));},
    restoreAsset:(agentId,assetId)=>{commit(d=>restorePathwayAsset(d,agentId,assetId));},
    assetPolicy:(agentId,policy)=>{commit(d=>setPathwayAssetPolicy(d,agentId,policy));},
    releaseAsset:(agentId,assetId)=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===agentId),asset=a?.pathwayInventory?.assets.find(x=>x.id===assetId);if(!asset)return;if(!window.confirm(`Release ${pathwayAssetName(asset)} permanently?`))return;commit(d=>releasePathwayAsset(d,agentId,assetId));},
    chooseAssetOffer:(offerId,replaceId)=>{if(!run||run.isCampaign||run.currentTurn<run.turnRows.length)return;if(!commit(d=>choosePathwayAssetOffer(d,offerId,replaceId)))return;run.result=clone(state.pendingContract.result);render();},
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
      if(chapterBlocked())return;const st=campaignStatus(state);if(!st.current)return;
      if(!chapterAgentIds.length)return toast('Select at least one agent for the mission.');
      const outcome=chapterCommit(d=>campaignStart(d,st.current.id,chapterAgentIds,chapterChoice,Date.now()%2147483647));
      if(!outcome)return;
      planning=null;selected=null;run=campaignRunFromPending(outcome.pending);render();
    },
    resumeCampaign:()=>{if(state.campaign.pending){run=campaignRunFromPending(state.campaign.pending);tab='campaign';render();}},
    settleCampaign:()=>{
      const outcome=chapterCommit(d=>campaignSettle(d));if(!outcome)return;
      stopTicker();run=null;planning=null;chapterSelectionMission=null;tab='campaign';render();
    },
    setTickerSpeed: spd => {
      stopTicker(true);
      tickerSpeed = [.5, 1, 2, 4].includes(Number(spd)) ? Number(spd) : 1;
      battleEffects?.setSpeed(tickerSpeed);
      refreshBattle();
    },
    toggleTickerPause: () => {
      const playing = activePlayback();
      if (!playing) return;
      if (playing.currentTurn >= playing.turnRows.length) return;
      playing.paused = !playing.paused;
      stopTicker(true);
      if (playing.paused) battleEffects?.pause(); else battleEffects?.resume();
      refreshBattle();
    },
    stepTicker: () => {
      const playing = activePlayback();
      if (!playing) return;
      if (playing.currentTurn >= playing.turnRows.length) {
        return;
      }
      playing.paused = true;
      stopTicker();
      clearBattleEffects(); playing.eventCount = null;
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
    simulatorSection: section => {
      if (run || tab !== 'simulator' || !['battle', 'animations'].includes(section) || section === simulatorSection) return;
      stopTicker(); clearBattleEffects(); simulatorSection = section; render();
    },
    gallerySequence: rank => {
      if (run || tab !== 'simulator' || simulatorSection !== 'animations' || !Number.isInteger(Number(rank)) || Number(rank) < 0 || Number(rank) > 9) return;
      galleryRank = Number(rank); gallerySearch = ''; galleryPath = ''; galleryPlacement = ''; render();
    },
    galleryReplay: replayGalleryAbility,
    galleryFilter: (kind, value) => {
      if (run || tab !== 'simulator' || simulatorSection !== 'animations') return;
      if (kind === 'search') gallerySearch = String(value);
      else if (kind === 'path' && (!value || PATH_KEYS.includes(value))) galleryPath = value;
      else if (kind === 'placement' && ['', 'self', 'target', 'travel', 'thread', 'split'].includes(value)) galleryPlacement = value;
      else return;
      stopGalleryReplay(); updateGalleryFilters();
    },
    gallerySpeed: rate => {
      if (run || tab !== 'simulator' || simulatorSection !== 'animations' || ![.5, 1, 1.5].includes(Number(rate))) return;
      stopGalleryReplay(); galleryRate = Number(rate);
      const control = app.querySelector('#gallery-speed'); if (control) control.value = String(galleryRate);
    },
    gallerySwap: swapped => {
      if (run || tab !== 'simulator' || simulatorSection !== 'animations') return;
      stopGalleryReplay(); gallerySwapped = !!swapped;
      app.querySelector('.ability-gallery')?.classList.toggle('gallery-swapped', gallerySwapped);
      const control = app.querySelector('#gallery-swap'); if (control) control.checked = gallerySwapped;
    },
    galleryGuides: shown => {
      if (run || tab !== 'simulator' || simulatorSection !== 'animations') return;
      galleryGuides = !!shown;
      app.querySelector('.ability-gallery')?.classList.toggle('gallery-guides-active', galleryGuides);
      const control = app.querySelector('#gallery-guides'); if (control) control.checked = galleryGuides;
    },
    tab:t=>{tab=t;render()},previewPath:path=>{if(PATH_KEYS.includes(path)){previewPath=path;render()}},simMode:m=>{if(run)return;simMode=m;render()},simSet:(team,i,key,value)=>{if(run)return;const arr=team==='A'?simA:simB;if(arr[i])arr[i][key]=value;render()},clearSimulation:()=>{if(run)return;stopTicker();simResult=null;render()},runSimulation:()=>{if(run)return;const seed=Date.now()%2147483647;const count=simMode==='1v1'?1:2;const mk=(x,i)=>{const a=makeAgent(Math.random,{sequence:x.sequence,path:x.path,trait:'Stout Vitality',...(x.traitId?{traitId:x.traitId}:{})});a.id=`sim_${i}_${x.path}_${x.sequence}`;a.name=`${pathOf(x.path).name} Seq ${x.sequence}`;a.awakened=true;a.path=x.path;a.sequence=x.sequence;a.injuries=0;a.weaponId='none';a.weaponMastery={};a.sp=maxSPFor(a);restatAgent(a);return a;};const members=simA.slice(0,count).map((x,i)=>mk(x,i));const opponents=simB.slice(0,count).map((x,i)=>({path:x.path,sequence:x.sequence,...(x.traitId?{traitId:x.traitId}:{})}));const q={id:'sim',name:`${simMode} Battle`,brief:'Battle Simulator',story:'A controlled simulation. No guild resources are changed.',objective:'combat',difficultySequence:Math.min(...opponents.map(x=>x.sequence)),encounter:true,mundane:false,rewards:{funds:0,reputation:0,materials:{}},enemyCount:count,requiredPath:opponents[0].path};const res=resolveQuest(members,q,seed,{individual:count===1,simulationOpponents:opponents});const snap=res.battleSnapshot||{allies:[],enemies:[]};const simTurns = flattenTurnRows(groupEventsToRows(res.events||[]));
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
  alive: true,
  ...(snap.initialUnits || []).find(u => u.id === m.id)
})),
teamB: opponents.map((o, i) => ({
  id: snap.enemies[i]?.id || `enemy_${i}`,
  name: snap.enemies[i]?.name || `${pathOf(o.path).name} Seq ${o.sequence}`,
  path: o.path,
  sequence: o.sequence,
  team: 'enemy',
  hp: snap.enemies[i]?.maxHp ?? 100,
  maxHp: snap.enemies[i]?.maxHp ?? 100,
  alive: true,
  ...(snap.initialUnits || []).find(u => u.id === snap.enemies[i]?.id)
})),balanceTrace:snap.balanceTrace||[]};render()},fastTicker:()=>{if(!run)return;clearBattleEffects();run.eventCount=null;run.currentTurn=Math.min(run.turnRows.length,run.currentTurn+5);stopTicker();refreshBattle();},skipTicker:(isSim=false)=>{if(isSim&&run)return;const playing=isSim?activeSimulatorPlayback():run;if(!playing)return;playing.currentTurn=playing.turnRows.length;playing.eventCount=null;stopTicker();clearBattleEffects();refreshBattle();},dossier:id=>{dossierReturnFocus={id:document.activeElement?.id,action:document.activeElement?.getAttribute('onclick')};selected=id;dossierSkillType='active';render({resetDossier:true});document.getElementById('dossier-title')?.focus()},
    closeDossier:()=>{selected=null;render();const previous=dossierReturnFocus;const opener=previous?.id?document.getElementById(previous.id):previous?.action?Array.from(app.querySelectorAll('[onclick]')).find(el=>el.getAttribute('onclick')===previous.action):null;(opener||app.querySelector('.tabs [aria-current="page"]'))?.focus();dossierReturnFocus=null},
    dossierSkillTab:type=>{const a=state.roster.find(x=>x.id===selected);if(!a||!['active','passive','inventory'].includes(type))return;if(type==='inventory'){if(!pathwayCollection(a))return;render({openSection:'inventory'});document.getElementById('dossier-inventory-title')?.focus();return;}if(!a.awakened)return;dossierSkillType=type;render({openSection:'abilities'});document.getElementById(`dossier-tab-${type}`)?.focus()},
    recruitInfo:id=>{const a=state.recruitPool.find(x=>x.id===id);if(a){toast(`${a.name}: ${a.occupation}. ${traitRarity(a)} — ${traitName(a)}. ${traitDescription(a)}`)}},
    hire:id=>{if(chapterBlocked())return;const outcome=recruitmentCommit(d=>hireRecruitmentCandidate(d,id));if(outcome){clearTimeout(recruitRevealTimer);recruitReveal=false;render();}},
    refreshRecruit:()=>{if(chapterBlocked()||recruitReveal)return;const outcome=recruitmentCommit(d=>refreshRecruitmentOffice(d));if(outcome){recruitReveal=true;render();clearTimeout(recruitRevealTimer);recruitRevealTimer=setTimeout(()=>{if(recruitReveal){recruitReveal=false;render();}},650);}},
    skipRecruitReveal:()=>{clearTimeout(recruitRevealTimer);recruitReveal=false;render();},

    choosePath:(id,path)=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);if(!a||a.awakened||!PATH_KEYS.includes(path))return;const cost=1;if((state.materials[pathOf(path).material]||0)<cost)return toast(`You need 1 ${pathOf(path).material} to awaken.`);commit(d=>{const x=d.roster.find(y=>y.id===id);x.path=path;x.sequence=9;x.awakened=true;x.digest=0;x.stats=awakenStats(x,path);x.baseStats={...x.stats};x.maxSP=maxSPFor(x);x.sp=x.maxSP;x.cooldowns={};x.basePathSpeed=basePathSpeed(path);x.humanStats=x.humanStats||{...x.stats};const aw=tierFor(path,9), awA=aw.abilities?.[0]||{};x.abilities=[awA];x.abilityHistory=[{sequence:9,name:aw.name,ability:awA.text||aw.abilityText||aw.ability,type:awA.type||aw.type,effectId:awA.effectId||aw.effectId,damage:awA.damage||null,effects:awA.effects||[],effects:awA.effects||[]}];noteAgent(x,d.day,`Drank the ${pathName(path)} Sequence 9 potion and awakened as Sequence 9 ${tierFor(path,9).name}.`);chronicle(d,`${x.name} awakens as Sequence 9 ${pathName(path)}.`);d.materials[pathOf(path).material]-=cost;advanceGuildDay(d,1);if(d.quests.every(q=>!q.encounter))d.quests.push(makeQuest(()=>.5,9,10,Math.max(5,d.reputation),[path]));})},
    advance:id=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);const info=canTrain(state,a);if(!info)return;const readyText=info.ready?'READY':'NOT READY';const ok=confirm(`ADVANCE ${a.name}\n\nNext: Sequence ${a.sequence-1} ${info.next.name}\nDigesting: ${Math.round(a.digest||0)}% (${readyText})\nSuccess chance: ${Math.round(info.successChance*100)}%\n\nMaterials: ${info.mat} × ${info.materialCost}\nFunds: £${info.fundsCost}\n\nAdvance now?`);if(!ok)return;if(!info.ready)return toast('The potion is not fully digested yet. Complete more contracts.');if(!info.affordable)return toast(`You need ${info.materialCost} ${info.mat} and £${info.fundsCost}.`);const outcome=attemptTraining(a,Date.now()%2147483647);const saved=commit(d=>{const x=d.roster.find(y=>y.id===id);d.funds-=info.fundsCost;d.materials[info.mat]=(d.materials[info.mat]||0)-info.materialCost;if(outcome.ok){x.sequence-=1;x.digest=0;x.stats=advanceStats(x.stats,x.path,x.sequence);x.basePathSpeed=basePathSpeed(x.path,x.sequence);x.maxSP=maxSPFor(x);x.sp=Math.min(x.maxSP,x.sp||x.maxSP);x.cooldowns={};const nextA=info.next.abilities?.[0]||{};x.abilities=[...(x.abilities||[]),nextA];x.abilityHistory=[...(x.abilityHistory||[]),{sequence:x.sequence,name:info.next.name,ability:nextA.text||info.next.abilityText||info.next.ability,type:nextA.type||info.next.type,effectId:nextA.effectId||info.next.effectId,damage:nextA.damage||null,effects:nextA.effects||[],effects:nextA.effects||[]}];noteAgent(x,d.day,`Advanced to Sequence ${x.sequence} — ${info.next.name}. All prior abilities remain part of the character.`);chronicle(d,`${x.name} advances to Sequence ${x.sequence} (${info.next.name}).`)}else applyConsequences(d,[outcome.consequence]);advanceGuildDay(d,1);});if(saved)toast(outcome.line)},
    heal:id=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);if(!a||a.injuries<=0)return;const c=healCost(a);if(state.funds<c.funds)return toast(`Healing requires £${c.funds}.`);const mat=Object.keys(state.materials).find(k=>state.materials[k]>=c.material);if(!mat)return toast(`Healing requires ${c.material} material.`);commit(d=>{const x=d.roster.find(y=>y.id===id);d.funds-=c.funds;d.materials[mat]-=c.material;x.injuries=0;x.madness=Math.max(0,(x.madness||0)-15);noteAgent(x,d.day,'Received guild medical and occult treatment. Injuries restored to 0/100 and Madness reduced by 15.');chronicle(d,`${x.name} is treated for injuries.`);advanceGuildDay(d,1)})},
    refreshContracts:()=>{if(chapterBlocked())return;commit(d=>refreshContracts(d));},
    decline:id=>{if(chapterBlocked())return;if(!state.quests.some(q=>q.id===id))return;commit(d=>declineContract(d,id));},declineWanted:id=>{if(chapterBlocked())return;const q=state.wanted.find(q=>q.id===id);if(!q)return;commit(d=>{d.bossDeferrals={...(d.bossDeferrals||{}),[q.bossId]:d.day};d.wanted=d.wanted.filter(q=>q.id!==id);});},
    planWanted:id=>{planning=state.wanted.find(q=>q.id===id)||null;window.G9.selectedIds=[...(state.teams[id]||[])];render()},plan:id=>{planning=state.quests.find(q=>q.id===id)||null;window.G9.selectedIds=[...(state.teams[id]||[])];render()},
    setWeapon:(id,w)=>{if(chapterBlocked())return;const a=state.roster.find(x=>x.id===id);if(!a)return;if(w===a.weaponId)return;if(w!=='none'&&!(state.weapons[w]||0))return toast('No copies of that weapon remain.');commit(d=>{const x=d.roster.find(y=>y.id===id);if(x.weaponId&&x.weaponId!=='none')d.weapons[x.weaponId]=(d.weapons[x.weaponId]||0)+1;if(w&&w!=='none')d.weapons[w]=Math.max(0,(d.weapons[w]||0)-1);x.weaponId=w;});},
    toggleAssign:id=>{const i=window.G9.selectedIds.indexOf(id);if(i>=0)window.G9.selectedIds.splice(i,1);else if(window.G9.selectedIds.length<3)window.G9.selectedIds.push(id);else toast('A party can contain at most 3 characters.');render()},
    individual:()=>{if(window.G9.selectedIds.length!==1)toast('Select exactly one character first.');else render()},
    team:()=>{if(window.G9.selectedIds.length<2)toast('Select at least two characters for a team.');else render()},
    clearSelection:()=>{window.G9.selectedIds=[];render()},
    saveTeam:()=>{if(!planning||window.G9.selectedIds.length<1)return toast('Select at least one character.');const id=planning.id;if(commit(d=>{d.teams[id]=[...window.G9.selectedIds];chronicle(d,`A team was saved for ${planning.name}.`);})){planning=state.quests.find(q=>q.id===id)||state.wanted.find(q=>q.id===id);render();}},
    cancelPlan:()=>{planning=null;render()},
    launch:()=>{if(chapterBlocked())return;if(!planning)return;const ids=window.G9.selectedIds||[];if(ids.length<1)return toast('Assign at least one character.');const members=state.roster.filter(a=>ids.includes(a.id)&&a.status==='active'&&a.awakened);if(!members.length)return toast('At least one awakened character is required.');if(planning.requiredPartySize&&(members.length!==planning.requiredPartySize||members.some(a=>a.unitType==='marionette')))return toast('Wanted bosses require three awakened Beyonders.');const owners=new Set(members.filter(a=>a.unitType!=='marionette').map(a=>a.id));for(const m of members.filter(a=>a.unitType==='marionette')){if(!owners.has(m.ownerId))return toast('A Marionette can only deploy while its owner is in the party.');const owner=state.roster.find(a=>a.id===m.ownerId);const count=members.filter(a=>a.unitType==='marionette'&&a.ownerId===m.ownerId).length;if(count>threadSlots(owner.sequence))return toast(`The owner can deploy only ${threadSlots(owner.sequence)} Marionette(s) at this Sequence.`);}const q=planning;const individual=members.length===1;const result=resolveQuest(clone(members),q,Date.now()%2147483647,{individual,day:state.day});planning=null;const initialAllies = result.battleSnapshot?.initialUnits?.filter(u=>u.team==='ally') || clone(members).map(m=>{const hp=Math.round(effectiveStats(m).hp*(passiveCombatModifier(m).hp||1));return {id:m.id,name:m.name,team:'ally',path:m.path,sequence:m.sequence,unitType:m.unitType,maxHp:hp,hp,sp:m.sp??maxSPFor(m),maxSP:maxSPFor(m)};});
    const initialEnemies = result.battleSnapshot?.initialUnits?.filter(u=>u.team==='enemy') || (result.battleSnapshot?.enemies||[]).map(e=>({...e,team:'enemy',hp:e.maxHp,sp:0}));
    const turnRows = flattenTurnRows(groupEventsToRows(result.events||[]));
    const pending={quest:q,result,initialAllies,initialEnemies,turnRows,currentTurn:0,isSolo:individual};if(!commit(d=>{const outcome=reserveContractDispatch(d,q);if(!outcome.ok)return outcome;d.pendingContract=pending;})){planning=q;render();return;}run=clone(state.pendingContract);render()},
    closeQuest:()=>{if(!run||run.currentTurn<run.turnRows.length)return;if(run.isCampaign)return window.G9.settleCampaign();if(!commit(d=>settleContract(d)))return;stopTicker();run=null;planning=null;tab='hall';render()},
    reset:()=>{if(!confirm('Erase the current guild and begin again?'))return;const fresh=newGame();if(!saveGame(fresh,{reset:true}))return toast('The new guild could not be saved. The previous save is still available.');state=fresh;window.G9.selectedIds=[];run=null;planning=null;selected=null;chapterSelectionMission=null;stopTicker();tab='campaign';render()}
  };
  window.addEventListener('scroll',prioritizeVisiblePartyPortraits,{capture:true,passive:true});
  window.addEventListener('resize',()=>{layoutBattlefields(app);battleEffects?.reflow();prioritizeVisiblePartyPortraits();});
  document.addEventListener('keydown',event=>{
    const dialog=portraitViewer?.dialog||(selected&&app.querySelector('.character-dossier'));if(!dialog)return;
    if(event.key==='Escape'){event.preventDefault();portraitViewer?closePortrait():window.G9.closeDossier();return;}
    if(!portraitViewer&&event.target?.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();const tabs=['active','passive'];const i=tabs.indexOf(dossierSkillType),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;window.G9.dossierSkillTab(tabs[next]);return;
    }
    if(event.key==='Tab'){
      const controls=Array.from(dialog.querySelectorAll('button,input,select,summary,[tabindex="0"]')).filter(el=>!el.disabled&&el.getAttribute('tabindex')!=='-1'&&el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(first&&event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){event.preventDefault();last.focus();}
      else if(first&&!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
    }
  });
  window.G9.selectedIds=[];
  if(!loadedGame&&!saveGame(state))notice=saveError()||'The new guild could not be saved. Free browser storage before making changes.';
  window.addEventListener('focus',()=>render());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  window.setInterval(()=>{if(!document.hidden&&dayjs().format('YYYY-MM-DD')!==state.calendar?.currentDate)render();},60000);
  if(!state.recruitRefreshDay)state.recruitRefreshDay=state.day+7;
  campaignEnsure(state);
  if(state.campaign.pending){run=campaignRunFromPending(state.campaign.pending);tab='campaign';}else if(state.pendingContract){run=clone(state.pendingContract);tab='hall';}
  render();
})();
