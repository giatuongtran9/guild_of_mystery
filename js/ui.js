// js/ui.js — Responsive Guild Master UI with Fool Sprites, Party Dispatch & Stage Combat
(() => {
  // Load or create the game state
  let state = (typeof loadGame === 'function' ? loadGame() : null);
  if (!state && typeof newGame === 'function') {
    state = newGame();
    if (typeof saveGame === 'function') saveGame(state);
  }

  let activeTab = 'contracts';
  let activeBattleData = null;
  let inspectingAgentId = null;
  let partySelection = [];

  // 1. Character Sprite Mapping (Supports both data/assets/characters/fool/ and data/assets/characters/)
  function getCharacterSprite(pathKey, seqNum) {
    if (pathKey === 'fool' && seqNum >= 0 && seqNum <= 9) {
      return `data/assets/characters/fool/fool_seq${seqNum}.png`;
    }
    return null;
  }

  // Sequence Badge Titles and Fallback Emojis
  function getSequenceBadge(pathKey, seqNum) {
    if (pathKey === 'fool') {
      const foolBadges = {
        9: { icon: "🔮", title: "Seer" },
        8: { icon: "🎭", title: "Clown" },
        7: { icon: "🎩", title: "Magician" },
        6: { icon: "👤", title: "Faceless" },
        5: { icon: "🧵", title: "Marionettist" },
        4: { icon: "🎪", title: "Bizarro Sorcerer" },
        3: { icon: "⏳", title: "Scholar of Yore" },
        2: { icon: "✨", title: "Miracle Invoker" },
        1: { icon: "👁️", title: "Attendant of Mysteries" },
        0: { icon: "🃏", title: "The Fool" }
      };
      return foolBadges[seqNum] || { icon: "🃏", title: `Seq ${seqNum}` };
    }
    return { icon: "⚡", title: `Seq ${seqNum}` };
  }

  // Renders sprite img with fallback to emoji
  function renderAvatar(hero, extraStyle = '') {
    const sprite = getCharacterSprite(hero.path, hero.sequence);
    const badge = getSequenceBadge(hero.path, hero.sequence);
    if (sprite) {
      return `
        <div class="gm-avatar-wrapper" ${extraStyle}>
          <img src="${sprite}" class="gm-sprite-img" alt="${hero.name || badge.title}" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex'">
          <span class="gm-avatar-fallback" style="display:none">${badge.icon}</span>
        </div>
      `;
    }
    return `
      <div class="gm-avatar-wrapper" ${extraStyle}>
        <span class="gm-avatar-fallback">${badge.icon}</span>
      </div>
    `;
  }

  function renderApp(currentState) {
    if (currentState) state = currentState;
    const root = document.getElementById('app');
    if (!root || !state) return;

    const gold = state.funds ?? state.resources?.gold ?? 1000;
    const materialsCount = state.materials ? Object.values(state.materials).reduce((a,b)=>a+b, 0) : 0;
    const rosterCount = (state.roster || []).length;
    const questsAvailable = (state.quests || []).length;

    root.innerHTML = `
      <header class="gm-header">
        <div class="gm-header-title">
          <span>Guild of Mystery</span>
          <span style="color:var(--gold-bright)">Day ${state.day || 1}</span>
        </div>
        <div class="gm-res-row">
          <div class="gm-res-item"><span class="gm-res-label">Funds:</span><span class="gm-res-val" style="color:var(--gold-bright)">🪙 £${gold}</span></div>
          <div class="gm-res-item"><span class="gm-res-label">Materials:</span><span class="gm-res-val">📦 ${materialsCount}</span></div>
          <div class="gm-res-item"><span class="gm-res-label">Beyonders:</span><span class="gm-res-val">👥 ${rosterCount}</span></div>
          <div class="gm-res-item"><span class="gm-res-label">Reputation:</span><span class="gm-res-val">⭐ ${state.reputation || 0}</span></div>
        </div>
      </header>

      <main class="gm-content-view">
        ${renderActiveTab(state)}
      </main>

      <nav class="gm-tab-nav">
        <button class="gm-tab-btn ${activeTab==='contracts'?'active':''}" onclick="window.GM.setTab('contracts')">
          <span class="gm-tab-icon">📜</span>
          <span>Contracts</span>
        </button>
        <button class="gm-tab-btn ${activeTab==='roster'?'active':''}" onclick="window.GM.setTab('roster')">
          <span class="gm-tab-icon">👥</span>
          <span>Roster</span>
        </button>
        <button class="gm-tab-btn ${activeTab==='pathways'?'active':''}" onclick="window.GM.setTab('pathways')">
          <span class="gm-tab-icon">🔮</span>
          <span>Pathways</span>
        </button>
        <button class="gm-tab-btn ${activeTab==='guild'?'active':''}" onclick="window.GM.setTab('guild')">
          <span class="gm-tab-icon">🏛️</span>
          <span>Guild</span>
        </button>
      </nav>

      ${inspectingAgentId ? renderInspectModal(state, inspectingAgentId) : ''}
    `;
  }

  function renderActiveTab(state) {
    switch (activeTab) {
      case 'contracts': return renderContractsTab(state);
      case 'roster': return renderRosterTab(state);
      case 'pathways': return renderPathwaysTab(state);
      case 'guild': return renderGuildTab(state);
      default: return renderContractsTab(state);
    }
  }

  // --- CONTRACTS & PARTY DISPATCH ---
  function renderContractsTab(state) {
    if (activeBattleData) return renderActiveBattle(state, activeBattleData);

    const quests = state.quests || [];
    const roster = (state.roster || []).filter(a => a.status === 'active');
    const isSolo = partySelection.length === 1;

    return `
      <div class="gm-section-title">
        <span>Party Deployment (1–3 Beyonders)</span>
        <small style="color:${partySelection.length > 0 ? 'var(--gold-bright)' : 'var(--muted)'}">
          ${partySelection.length}/3 Selected
        </small>
      </div>

      <div class="gm-dispatch-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--muted)">Select 1, 2, or 3 Beyonders for the expedition:</span>
          ${partySelection.length > 0 ? `<button onclick="window.GM.clearParty()" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline">Clear Selection</button>` : ''}
        </div>

        <div class="gm-party-selector">
          ${roster.length === 0 ? `<div style="font-size:12px;color:var(--muted);padding:8px">No active Beyonders in roster. Visit the Guild tab to recruit!</div>` : ''}
          ${roster.map(a => {
            const sel = partySelection.includes(a.id);
            const badge = getSequenceBadge(a.path, a.sequence);
            return `
              <div class="gm-party-chip ${sel ? 'selected' : ''}" onclick="window.GM.togglePartySelect('${a.id}')">
                <div style="display:flex;justify-content:center;margin-bottom:4px">
                  ${renderAvatar(a)}
                </div>
                <div style="font-size:11px;font-weight:600">${(a.name || 'Agent').split(' ')[0]}</div>
                <small style="color:var(--gold);font-size:10px">${badge.title}</small>
              </div>
            `;
          }).join('')}
        </div>

        ${isSolo ? `
          <div class="gm-dispatch-notice">
            <span>⚡</span>
            <span><strong>Solo Dispatch Active:</strong> +50% Potion Digestion Bonus upon contract completion!</span>
          </div>
        ` : ''}
      </div>

      <div class="gm-section-title">Available Contracts</div>

      <div class="gm-cards-grid">
        ${quests.length === 0 ? `<div class="gm-card" style="color:var(--muted)">No contracts available right now.</div>` : ''}
        ${quests.map(q => `
          <div class="gm-card">
            <div class="gm-card-header">
              <div class="gm-avatar-wrapper"><span style="font-size:22px">⚔️</span></div>
              <div class="gm-card-info">
                <div class="gm-card-title">${q.name || q.title || 'Dungeon Contract'}</div>
                <div class="gm-card-subtitle">Difficulty: Seq ${q.difficultySequence ?? 9}</div>
              </div>
            </div>
            <p style="font-size:12px;color:var(--muted);margin:8px 0">${q.brief || q.story || 'Venture into the depths to retrieve mystical materials.'}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              <div style="font-size:11px;color:var(--gold)">
                Reward: 🪙 £${q.rewards?.funds || 50} • Rep +${q.rewards?.reputation || 2}
              </div>
              <button class="gm-btn" ${partySelection.length === 0 ? 'disabled' : ''} onclick="window.GM.startExpedition('${q.id}')">
                ${partySelection.length === 0 ? 'Select Party' : `Deploy (${partySelection.length})`}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // --- GUILD MASTER COMBAT PRESENTATION (No Animations) ---
  function renderActiveBattle(state, battle) {
    const party = battle.party || [];
    const enemy = battle.enemy || { name: "Corrupted Entity", hp: 120, maxHp: 120 };
    const logs = battle.logs || [];

    const enemyMaxHp = enemy.maxHp || 100;
    const enemyCurHp = Math.max(0, enemy.hp ?? enemyMaxHp);
    const enemyPct = Math.round((enemyCurHp / enemyMaxHp) * 100);

    return `
      <div class="gm-section-title">
        <span>Dungeon Expedition</span>
        <small style="color:var(--red);font-weight:bold">IN COMBAT</small>
      </div>

      <div class="gm-battle-stage-wrapper">
        <!-- Stage: Enemy Opposite at Top, Party Sprites at Bottom -->
        <div class="gm-battle-arena">
          <!-- TOP: ENEMY OPPOSITE -->
          <div class="gm-arena-enemy-top">
            <div class="gm-enemy-sprite-box">
              <div class="gm-enemy-avatar">👾</div>
              <div style="font-weight:700;font-size:13px;color:var(--bone)">${enemy.name}</div>
              <div class="gm-bar-track" style="width:140px;height:8px">
                <div class="gm-bar-fill-hp" style="width:${enemyPct}%"></div>
              </div>
              <small style="font-size:10px;color:var(--muted)">${enemyCurHp} / ${enemyMaxHp} HP</small>
            </div>
          </div>

          <!-- BOTTOM: PARTY SPRITES WITH LIVE HP/MP BARS -->
          <div class="gm-arena-party-bottom">
            ${party.map(hero => {
              const maxHp = (hero.stats && hero.stats.hp) ? hero.stats.hp : 100;
              const curHp = Math.max(0, hero.currentHp ?? maxHp);
              const hpPct = Math.round((curHp / maxHp) * 100);

              const maxMp = (hero.stats && hero.stats.mp) ? hero.stats.mp : (hero.maxSP || 50);
              const curMp = Math.max(0, hero.currentMp ?? maxMp);
              const mpPct = Math.round((curMp / maxMp) * 100);

              return `
                <div class="gm-combat-hero">
                  ${renderAvatar(hero, 'style="width:56px;height:56px"')}
                  <div class="gm-combat-name">${(hero.name || 'Hero').split(' ')[0]}</div>
                  <div class="gm-combat-bars">
                    <div class="gm-bar-track">
                      <div class="gm-bar-fill-hp" style="width:${hpPct}%" title="HP: ${curHp}/${maxHp}"></div>
                    </div>
                    <div class="gm-bar-track">
                      <div class="gm-bar-fill-mp" style="width:${mpPct}%" title="MP: ${curMp}/${maxMp}"></div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- UNDERNEATH: CHRONOLOGICAL BATTLE LOG -->
        <div>
          <div class="gm-section-title">Chronological Battle Log</div>
          <div class="gm-battle-log-card" id="gmBattleLog">
            ${logs.length === 0 ? `<div style="color:var(--muted)">Combat commencing...</div>` : ''}
            ${logs.map((log, idx) => `
              <div class="gm-log-entry">
                <span style="color:var(--muted)">[Turn ${idx + 1}]</span> ${log}
              </div>
            `).join('')}
          </div>
          <div style="margin-top:10px;display:flex;justify-content:flex-end">
            ${battle.isDone ? `
              <button class="gm-btn" onclick="window.GM.finishExpedition()">Return to Guild</button>
            ` : `
              <button class="gm-btn" onclick="window.GM.stepCombat()">Next Round</button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // --- ROSTER TAB ---
  function renderRosterTab(state) {
    const roster = state.roster || [];
    return `
      <div class="gm-section-title">
        <span>Beyonders Roster</span>
        <small>${roster.length} Recruited</small>
      </div>
      <div class="gm-cards-grid">
        ${roster.length === 0 ? `<div class="gm-card" style="color:var(--muted)">No Beyonders recruited yet. Go to Guild tab to hire!</div>` : ''}
        ${roster.map(a => {
          const badge = getSequenceBadge(a.path, a.sequence);
          const maxHp = (a.stats && a.stats.hp) ? a.stats.hp : 100;
          return `
            <div class="gm-card" style="cursor:pointer" onclick="window.GM.inspectAgent('${a.id}')">
              <div class="gm-card-header">
                ${renderAvatar(a)}
                <div class="gm-card-info">
                  <div class="gm-card-title">${a.name}</div>
                  <div class="gm-card-subtitle">Sequence ${a.sequence} • ${badge.title}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:3px">
                    HP: ${maxHp} • Digestion: ${Math.round(a.digest || a.digestion || 0)}%
                  </div>
                </div>
                <span style="color:var(--line-gold);font-size:18px">›</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- PATHWAYS TAB ---
  function renderPathwaysTab(state) {
    const foolSeqs = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    return `
      <div class="gm-section-title">
        <span>The Fool Pathway</span>
        <small style="color:var(--gold)">Lord of the Mysteries</small>
      </div>
      <div class="gm-cards-grid">
        ${foolSeqs.map(seq => {
          const badge = getSequenceBadge('fool', seq);
          const dummy = { path: 'fool', sequence: seq, name: badge.title };
          return `
            <div class="gm-card">
              <div class="gm-card-header">
                ${renderAvatar(dummy)}
                <div class="gm-card-info">
                  <div class="gm-card-title">Sequence ${seq}: ${badge.title}</div>
                  <div class="gm-card-subtitle" style="color:var(--muted)">data/assets/characters/fool/fool_seq${seq}.png</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- GUILD TAB (Recruiting & Facilities) ---
  function renderGuildTab(state) {
    const pool = state.recruitPool || [];
    return `
      <div class="gm-section-title">Recruitment Office</div>
      <div class="gm-cards-grid">
        ${pool.length === 0 ? `<div class="gm-card" style="color:var(--muted)">No candidates available right now.</div>` : ''}
        ${pool.map(c => `
          <div class="gm-card">
            <div class="gm-card-header">
              <div class="gm-avatar-wrapper"><span style="font-size:20px">👤</span></div>
              <div class="gm-card-info">
                <div class="gm-card-title">${c.name}</div>
                <div class="gm-card-subtitle">${c.occupation || 'Civilian'} • Recommended: ${c.recommendedPath || 'fool'}</div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              <span style="font-size:11px;color:var(--gold)">Cost: £150</span>
              <button class="gm-btn" onclick="window.GM.hire('${c.id}')">Hire</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // --- INSPECT MODAL ---
  function renderInspectModal(state, agentId) {
    const a = (state.roster || []).find(x => x.id === agentId);
    if (!a) return '';
    const badge = getSequenceBadge(a.path, a.sequence);

    return `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="gm-card" style="width:100%;max-width:420px;background:#171813;border:1px solid var(--line-gold);box-shadow:var(--shadow)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-weight:700;color:var(--gold-bright)">Beyonder Dossier</span>
            <button onclick="window.GM.closeInspect()" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer">✕</button>
          </div>
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
            ${renderAvatar(a, 'style="width:64px;height:64px"')}
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--bone)">${a.name}</div>
              <div style="color:var(--gold);font-size:12px">Seq ${a.sequence} • ${badge.title}</div>
              <div style="color:var(--muted);font-size:11px">Digestion: ${Math.round(a.digest || a.digestion || 0)}%</div>
            </div>
          </div>
          <div style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#11120e;padding:10px;border-radius:6px;border:1px solid var(--line)">
            <div>HP: <strong>${a.stats?.hp || 100}</strong></div>
            <div>MP/SP: <strong>${a.stats?.mp || a.sp || 50}</strong></div>
            <div>ATK: <strong>${a.stats?.atk || 12}</strong></div>
            <div>DEF: <strong>${a.stats?.def || 10}</strong></div>
          </div>
          <div style="margin-top:14px;text-align:right">
            <button class="gm-btn" onclick="window.GM.closeInspect()">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  // --- WINDOW CONTROLLER EXPORTS ---
  window.GM = {
    setTab(t) {
      activeTab = t;
      renderApp();
    },
    togglePartySelect(id) {
      const idx = partySelection.indexOf(id);
      if (idx >= 0) {
        partySelection.splice(idx, 1);
      } else {
        if (partySelection.length < 3) {
          partySelection.push(id);
        }
      }
      renderApp();
    },
    clearParty() {
      partySelection = [];
      renderApp();
    },
    inspectAgent(id) {
      inspectingAgentId = id;
      renderApp();
    },
    closeInspect() {
      inspectingAgentId = null;
      renderApp();
    },
    hire(id) {
      if (!state) return;
      const c = (state.recruitPool || []).find(x => x.id === id);
      if (!c) return;
      if ((state.funds || 0) < 150) {
        alert("Not enough funds (£150 required).");
        return;
      }
      state.funds -= 150;
      state.recruitPool = state.recruitPool.filter(x => x.id !== id);
      c.status = 'active';
      c.path = c.recommendedPath || 'fool';
      c.sequence = 9;
      c.digest = 0;
      c.stats = { hp: 100, mp: 50, atk: 15, def: 10 };
      state.roster.push(c);
      if (typeof saveGame === 'function') saveGame(state);
      renderApp();
    },
    startExpedition(questId) {
      if (!state) return;
      const q = (state.quests || []).find(x => x.id === questId);
      const party = (state.roster || []).filter(a => partySelection.includes(a.id));
      if (party.length === 0) return;

      activeBattleData = {
        quest: q,
        party: JSON.parse(JSON.stringify(party)),
        enemy: { name: (q && q.name) ? "Guards of " + q.name : "Corrupted Entity", hp: 100 + (q?.difficultySequence ? (10-q.difficultySequence)*30 : 20), maxHp: 100 + (q?.difficultySequence ? (10-q.difficultySequence)*30 : 20) },
        isDone: false,
        logs: [
          `Expedition launched into ${q?.name || 'the dungeon'} with ${party.length} Beyonder(s).`,
          party.length === 1 ? "⚡ Solo Dispatch Active: +50% Potion Digestion Bonus applied." : "Coordinated party formation assembled."
        ]
      };
      renderApp();
    },
    stepCombat() {
      if (!activeBattleData) return;
      const b = activeBattleData;
      if (b.isDone) return;

      // Instant calculation (No animations)
      const dmgToEnemy = b.party.reduce((sum, hero) => sum + (hero.stats?.atk || 12), 0);
      b.enemy.hp = Math.max(0, b.enemy.hp - dmgToEnemy);
      b.logs.push(`Party assaulted the enemy for ${dmgToEnemy} damage!`);

      if (b.enemy.hp <= 0) {
        b.isDone = true;
        const isSolo = b.party.length === 1;
        const digestGain = isSolo ? 30 : 20;
        b.logs.push(`Enemy defeated! Contract fulfilled.`);
        b.logs.push(`Party members digested +${digestGain}% of their current potion!`);
        
        // Apply rewards to state
        if (state) {
          state.funds = (state.funds || 0) + (b.quest?.rewards?.funds || 60);
          state.reputation = (state.reputation || 0) + (b.quest?.rewards?.reputation || 2);
          for (const member of b.party) {
            const r = state.roster.find(x => x.id === member.id);
            if (r) r.digest = Math.min(100, (r.digest || 0) + digestGain);
          }
          state.quests = (state.quests || []).filter(x => x.id !== b.quest?.id);
          if (typeof saveGame === 'function') saveGame(state);
        }
      } else {
        const target = b.party[Math.floor(Math.random() * b.party.length)];
        const enemyDmg = 12;
        target.currentHp = Math.max(0, (target.currentHp ?? target.stats?.hp ?? 100) - enemyDmg);
        b.logs.push(`${b.enemy.name} struck ${target.name} for ${enemyDmg} damage!`);
      }
      renderApp();
    },
    finishExpedition() {
      activeBattleData = null;
      partySelection = [];
      renderApp();
    }
  };

  // Expose both window.GM and window.G9 for full compatibility
  window.G9 = window.GM;

  // Render on initial load to clear loading screen
  renderApp();
})();
