/**
 * ODDINARY UI & DOM RENDERING CONTROLLER
 */

// --- Helper: Create a single player input row element ---
Game._createPlayerRow = function(p, idx, animate) {
  const grp = document.createElement('div');
  grp.className = "input-group";
  if (animate) grp.classList.add('input-group-enter');
  grp.id = `player-group-${idx}`;
  grp.setAttribute('data-player-index', idx);
  grp.draggable = true;

  grp.ondragstart = (e) => Game.handleDragStart(e, idx);
  grp.ondragend = (e) => Game.handleDragEnd(e);

  grp.innerHTML = `
    <span class="player-num">#${idx + 1}</span>
    <input type="text"
           id="player-input-${idx}"
           value="${p.name || ''}"
           placeholder="Enter player name"
           oninput="Game.onInputChange(this, ${idx})"
           onkeydown="Game.handlePlayerEnter(event, ${idx})"
           autocomplete="off"
    >
    <div class="drag-handle" title="Drag to reorder">
      <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:currentColor;"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
    </div>
    <button class="btn btn-icon btn-danger" onclick="AudioEngine.play('click'); Game.removePlayer(${idx})" style="width:44px; height:44px; min-height:0; border-radius:12px;">
      <svg viewBox="0 0 24 24" style="width:20px; height:20px;"><path d="M5 11h14v2H5z" fill="currentColor"/></svg>
    </button>
  `;
  return grp;
};

// --- Render Setup Player Input Fields ---
Game.renderSetupInputs = function(scrollToLast = false) {
  const list = $('players-list');
  if (!list) return;

  if (!list.ondragover) {
    list.ondragover = (e) => Game.handleDragOver(e, 'players-list');
    list.ondrop = (e) => Game.handleDrop(e, 'players-list', false);
  }

  // If scrollToLast is true and the list already has the right number of children
  // minus the new one, just append the last player (no full rebuild = no flicker).
  const existingCount = list.children.length;
  if (scrollToLast && existingCount === State.players.length - 1 && existingCount > 0) {
    const newIdx = State.players.length - 1;
    const newPlayer = State.players[newIdx];
    if (newPlayer) {
      const grp = Game._createPlayerRow(newPlayer, newIdx, true);
      list.appendChild(grp);

      setTimeout(() => {
        const lastInput = document.getElementById(`player-input-${newIdx}`);
        if (lastInput) {
          lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          lastInput.focus();
        }
      }, 100);
    }
    return;
  }

  // Full rebuild (initial load, drag-reorder, remove player, etc.)
  list.innerHTML = "";

  State.players.forEach((p, idx) => {
    if (!p) return;
    const grp = Game._createPlayerRow(p, idx, false);
    list.appendChild(grp);
  });

  if (scrollToLast && State.players.length > 0) {
    setTimeout(() => {
      const lastIndex = State.players.length - 1;
      const lastInput = document.getElementById(`player-input-${lastIndex}`);
      if (lastInput) {
        lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastInput.focus();
      }
    }, 100);
  }
};

// --- Render Saved Player Chips (Recent Players) ---
Game.renderRecentPlayerChips = function() {
  const container = $('recent-players-container');
  if (!container) return;
  
  const saved = StorageManager.getSavedPlayers();
  if (saved.length === 0) {
    container.classList.add('hidden');
    return;
  }

  // Filter out names currently already added in State.players
  const currentActiveNames = State.players.map(p => (p.name || '').trim().toLowerCase());
  const availableRecent = saved.filter(name => !currentActiveNames.includes(name.toLowerCase()));

  if (availableRecent.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="recent-players-title">
      <span style="display:flex; align-items:center; gap:5px;"><svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:var(--accent-gold);"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg> Quick-Add Recent Friends</span>
      <button class="clear-recent-btn" onclick="Game.clearSavedPlayersHistory()" title="Clear saved history">Clear</button>
    </div>
    <div class="recent-players-chips">
      ${availableRecent.map(name => `
        <button class="player-chip" onclick="Game.quickAddRecentPlayer('${name.replace(/'/g, "\\'")}')">
          + ${name}
        </button>
      `).join('')}
    </div>
  `;
};

// --- Render Mid-game Manage Players List ---
Game.renderManagePlayersList = function() {
  const list = $('manage-players-list');
  const subtext = $('manage-players-subtext');
  if (!list) return;
  list.innerHTML = '';

  if (subtext) {
    subtext.innerText = 'Add, edit, remove, or drag to reorder players';
  }

  State.players.forEach((player, i) => {
    const div = document.createElement('div');
    div.className = 'player-select-item';
    div.draggable = State.editingPlayerIndex === null;
    div.dataset.index = i;
    div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius); border: 1px solid rgba(255,255,255,0.12); width: 100%; box-sizing: border-box;';

    if (State.editingPlayerIndex === null) {
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', i);
        div.style.opacity = '0.4';
      });
      div.addEventListener('dragend', () => {
        div.style.opacity = '1';
      });
      div.addEventListener('dragover', (e) => e.preventDefault());
      div.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = i;
        if (!isNaN(fromIdx) && fromIdx !== toIdx) {
          const moved = State.players.splice(fromIdx, 1)[0];
          State.players.splice(toIdx, 0, moved);
          Game.saveSession();
          Game.renderManagePlayersList();
        }
      });
    }

    if (State.editingPlayerIndex === i) {
      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; margin-right: 8px;">
          <input type="text" id="inline-edit-input-${i}" value="${player.name}" maxlength="20" style="width: 100%; padding: 6px 10px; font-size: 0.95rem; font-weight: 700; background: rgba(0,0,0,0.3); border: 1px solid var(--primary); color: white; border-radius: 8px; box-sizing: border-box;" onkeydown="if(event.key==='Enter') Game.saveInlinePlayerName(${i}); if(event.key==='Escape') Game.cancelInlinePlayerName();">
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="btn btn-primary" style="margin: 0; padding: 6px 12px; font-size: 0.85rem; min-height: 0; line-height: 1; display:flex; align-items:center; justify-content:center;" onclick="AudioEngine.play('click'); Game.saveInlinePlayerName(${i})"><svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>
          <button class="btn" style="margin: 0; padding: 6px 10px; font-size: 0.85rem; min-height: 0; line-height: 1; display:flex; align-items:center; justify-content:center;" onclick="AudioEngine.play('click'); Game.cancelInlinePlayerName()"><svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; margin-right: 8px;">
          <span style="color: var(--text-muted); cursor: grab; user-select: none; display:flex; align-items:center;"><svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor;"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg></span>
          <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${player.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="btn" style="margin: 0; padding: 6px 10px; font-size: 0.85rem; min-height: 0; line-height: 1; display:flex; align-items:center; justify-content:center;" onclick="AudioEngine.play('click'); Game.startInlinePlayerName(${i})" title="Edit Name"><svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
          <button class="btn btn-danger" style="margin: 0; padding: 6px 10px; font-size: 0.85rem; min-height: 0; line-height: 1; display:flex; align-items:center; justify-content:center;" onclick="AudioEngine.play('click'); Game.askRemovePlayerMidgame(${i})" title="Delete Player"><svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      `;
    }
    list.appendChild(div);
  });

  if (State.editingPlayerIndex !== null && State.editingPlayerIndex !== undefined) {
    const input = $(`inline-edit-input-${State.editingPlayerIndex}`);
    if (input) {
      setTimeout(() => { 
        input.focus(); 
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }, 50);
    }
  }
};

// --- DOMContentLoaded Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed:', err));
  }

  document.querySelectorAll('.copyright-year').forEach(el => {
    el.innerText = new Date().getFullYear();
  });

  // Universal sound & click listener
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
      shouldPreventRefresh = false;
    }
    const target = e.target.closest('button, .btn, .switch, .close-btn, .setting-info-btn, .player-select-item, .player-chip, input[type="checkbox"], input[type="range"], .stepper-btn, .card-container');
    if (target) {
      AudioEngine.play('click');
    }
  }, true);

  Game.init();
  if (typeof InstallPrompt !== 'undefined') InstallPrompt.init();
  Analytics.logEvent('homepage_opened');
});