// js/ui.js — Responsive Guild Master UI with Fool Sprites, Party Dispatch & Stage Combat
(() => {
  let activeTab = 'contracts';
  let activeBattleData = null;
  let inspectingAgentId = null;
  let partySelection = [];

  // 1. Character Sprite Mapping (Fool Pathway Seq 9 to 0 under data/assets/characters/)
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

  // Renders sprite img with fallback
  function renderAvatar(hero, extraClass = '') {
    const sprite = getCharacterSprite(hero.path, hero.sequence);
    const badge = getSequenceBadge(hero.path, hero.sequence);
    if (sprite) {
      return `
        <div class="gm-avatar-wrapper ${extraClass}">
          <img src="${sprite}" class="gm-sprite-img" alt="${hero.name || badge.title}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="gm-avatar-fallback" style="display:none">${badge.icon}</span>
        </div>
      `;
    }
    return `
      <div class="gm-avatar-wrapper ${extraClass}">
        <span class="gm-avatar-fallback">${badge.icon}</span>
      </div>
    `;
  }

  function renderApp(state) {
    const root = document.getElementById('app');
    if (!root) return;

    const gold = state.resources?.gold ?? 0;
    const materials = state.resources?.materials ?? 0;
    const rosterCount = (state.roster || []).length;
    const questsAvailable = (state.quests || []).length;

    root.innerHTML = `
      <header class="gm-header">
        <div class="gm-header-title">
          <span>Guild of Mystery</span>
          <span style="color:var(--muted)">v0.3.0</span>
        </div>
        <div class="gm-res-row">
          <div class="gm-res-item"><span class="gm-res-label">Gold:</span><span class="gm-res-val" style="color:var(--gold-bright)">🪙 ${gold}</span></div>
          <div class="gm-res-item"><span class="gm-res-label">Materials:</span><span class="gm-res-val">📦 ${materials}</span></div>
          <div class="gm-res-item"><span class="gm-res-label">Beyonders:</span><span class="gm-res-val">👥 ${rosterCount}</span></div>
          <div class="gm-res-item"><span class="gm-res-label">Active Contracts:</span><span class="gm-res-val">📜 ${questsAvailable}</span></div>
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
        <span>Party Deployment</span>
        <small style="color:${partySelection.length > 0 ? 'var(--gold-bright)' : 'var(--muted)'}">
          ${partySelection.length}/3 Selected
        </small>
      </div>

      <div class="gm-dispatch-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--muted)">Select 1, 2, or 3 Beyonders for the expedition:</span>
          ${partySelection.length > 0 ? `<button onclick="window.GM.clearParty()" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline">Clear</button>` : ''}
        </div>

        <div class="gm-party-selector">
          ${roster.length === 0 ? `<div style="font-size:12px;color:var(--muted);padding:8px">No active Beyonders available in roster.</div>` : ''}
          ${roster.map(a => {
            const sel = partySelection.includes(a.id);
            const badge = getSequenceBadge(a.path, a.sequence);
            return `
              <div class="gm-party-chip ${sel ? 'selected' : ''}" onclick="window.GM.togglePartySelect('${a.id}')">
                <div style="display:flex;justify-content:center;margin-bottom:4px">
                  ${renderAvatar(a)}
                </div>
                <div style="font-size:11px;font-weight:600">${a.name.split(' ')[0]}</div>
                <small style="color:var(--gold);font-size:10px">${badge.title}</small>
              </div>
            `;
          }).join('')}
        </div>

        ${isSolo ? `
          <div class="gm-dispatch-notice">
            <span>⚡</span>
            <span><strong>Solo Dispatch Active:</strong> +50% Potion Digestion Bonus upon return!</span>
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
                <div class="gm-card-title">${q.title || 'Dungeon Contract'}</div>
                <div class="gm-card-subtitle">Recommended: Seq ${q.recommendedSeq || 9} • Tier ${q.tier || 1}</div>
              </div>
            </div>
            <p style="font-size:12px;color:var(--muted);margin:8px 0">${q.description || 'Venture into the depths to retrieve mystical materials.'}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              <div style="font-size:11px;color:var(--gold)">
                Reward: 🪙 ${q.rewardGold || 50} • 📦 ${q.rewardMaterials || 10}
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
              const maxHp = hero.stats?.hp || 100;
              const curHp = Math.max(0, hero.currentHp ?? maxHp);
              const hpPct = Math.round((curHp / maxHp) * 100);

              const maxMp = hero.stats?.mp || 50;
              const curMp = Math.max(0, hero.currentMp ?? maxMp);
              const mpPct = Math.round((curMp / maxMp) * 100);

              return `
                <div class="gm-combat-hero">
                  ${renderAvatar(hero, 'style="width:56px;height:56px"')}
                  <div class="gm-combat-name">${hero.name.split(' ')[0]}</div>
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
            <button class="gm-btn" onclick="window.GM.stepCombat()">Next Round</button>
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
        ${roster.length === 0 ? `<div class="gm-card" style="color:var(--muted)">No Beyonders recruited yet.</div>` : ''}
        ${roster.map(a => {
          const badge = getSequenceBadge(a.path, a.sequence);
          const maxHp = a.stats?.hp || 100;
          return `
            <div class="gm-card" style="cursor:pointer" onclick="window.GM.inspectAgent('${a.id}')">
              <div class="gm-card-header">
                ${renderAvatar(a)}
                <div class="gm-card-info">
                  <div class="gm-card-title">${a.name}</div>
                  <div class="gm-card-subtitle">Sequence ${a.sequence} • ${badge.title}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:3px">
                    HP: ${maxHp} • Digestion: ${a.digestion || 0}%
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
                  <div class="gm-card-subtitle" style="color:var(--muted)">Asset: fool_seq${seq}.png</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- GUILD TAB ---
  function renderGuildTab(state) {
    const facilities = state.facilities || [];
    return `
      <div class="gm-section-title">Guild Headquarters</div>
      <div class="gm-cards-grid">
        <div class="gm-card">
          <div class="gm-card-title">Tarot Club Sanctuary</div>
          <p style="font-size:12px;color:var(--muted);margin:6px 0">Gather above the gray fog to exchange mystical items and recipes.</p>
        </div>
        <div class="gm-card">
          <div class="gm-card-title">Alchemy Workshop</div>
          <p style="font-size:12px;color:var(--muted);margin:6px 0">Brew potions and distill beyonder characteristics.</p>
        </div>
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
              <div style="color:var(--muted);font-size:11px">Digestion: ${a.digestion || 0}%</div>
            </div>
          </div>
          <div style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#11120e;padding:10px;border-radius:6px;border:1px solid var(--line)">
            <div>HP: <strong>${a.stats?.hp || 100}</strong></div>
            <div>MP: <strong>${a.stats?.mp || 50}</strong></div>
            <div>Phys Atk: <strong>${a.stats?.atk || 12}</strong></div>
            <div>Spirit Atk: <strong>${a.stats?.spirit || 16}</strong></div>
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
      if (window.Engine && window.Engine.state) renderApp(window.Engine.state);
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
      if (window.Engine && window.Engine.state) renderApp(window.Engine.state);
    },
    clearParty() {
      partySelection = [];
      if (window.Engine && window.Engine.state) renderApp(window.Engine.state);
    },
    inspectAgent(id) {
      inspectingAgentId = id;
      if (window.Engine && window.Engine.state) renderApp(window.Engine.state);
    },
    closeInspect() {
      inspectingAgentId = null;
      if (window.Engine && window.Engine.state) renderApp(window.Engine.state);
    },
    startExpedition(questId) {
      const state = window.Engine?.state;
      if (!state) return;
      const party = (state.roster || []).filter(a => partySelection.includes(a.id));
      activeBattleData = {
        questId,
        party: JSON.parse(JSON.stringify(party)),
        enemy: { name: "Wraith of the Sewers", hp: 120, maxHp: 120 },
        logs: [
          `Expedition launched with ${party.length} Beyonder(s).`,
          party.length === 1 ? "Solo bonus triggered (+50% Digestion multiplier)." : "Standard formation assembled."
        ]
      };
      renderApp(state);
    },
    stepCombat() {
      if (!activeBattleData || !window.Engine?.state) return;
      const b = activeBattleData;
      // Instant calculation (No animations)
      const dmgToEnemy = b.party.reduce((sum, hero) => sum + (hero.stats?.atk || 10), 0);
      b.enemy.hp = Math.max(0, b.enemy.hp - dmgToEnemy);
      b.logs.push(`Party dealt ${dmgToEnemy} damage to ${b.enemy.name}.`);

      if (b.enemy.hp <= 0) {
        b.logs.push(`Enemy defeated! Contract complete.`);
        setTimeout(() => {
          activeBattleData = null;
          partySelection = [];
          renderApp(window.Engine.state);
        }, 1200);
      } else {
        const target = b.party[Math.floor(Math.random() * b.party.length)];
        const enemyDmg = 15;
        target.currentHp = Math.max(0, (target.currentHp ?? target.stats?.hp ?? 100) - enemyDmg);
        b.logs.push(`${b.enemy.name} struck ${target.name} for ${enemyDmg} damage!`);
      }
      renderApp(window.Engine.state);
    }
  };

  // Expose render callback to game engine
  window.renderUI = renderApp;
})();
