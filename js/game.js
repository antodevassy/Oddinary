/**
 * ODDINARY GAME LOGIC & STATE ENGINE
 */

// --- Analytics Helper ---
const Analytics = {
 logEvent: function(eventName, params = {}) {
 try {
 if (window.gtag) {
 window.gtag('event', eventName, params);
 }
 console.log(`[Analytics] ${eventName}:`, params);
 } catch(e) {
 console.error('[Analytics] Error logging event:', e);
 }
 }
};

// --- Word Selector Instance ---
const wordSelector = new WordSelector();

// --- Preload Logo Image for Share Canvas ---
const shareLogoImg = new Image();
shareLogoImg.src = 'assets/logo.png';

// --- Game State Schema ---
const State = {
 players: [],
 playerOrder: [], 
 roles: {}, 
 words: { common: "", odd: "" },
 oddPlayerIds: [],
 votes: {}, 
 round: 0,
 config: { 
 shuffle: false, 
 timer: true, 
 timerDuration: 3, 
 imposterCount: 1, 
 imposterHasWord: true, 
 voting: true,
 secretAlliance: false,
 sound: true
 },
 stepIndex: 0,
 pendingVoteTarget: null,
 pendingForgotPlayer: null,
 pendingRemovePlayerId: null,
 selectedTargets: [],
 timerInterval: null,
 timerPaused: false,
 discussionTimeLeft: 0,
 stats: {
 imposterCountTimes: {},
 imposterCaughtTimes: {},
 correctGuesses: {},
 votesReceived: {}
 }
};

const $ = (id) => document.getElementById(id);
const Screens = ['landing', 'setup', 'reveal', 'discuss', 'voting', 'voting-complete', 'results', 'scoreboard', 'game-over'];
let shouldPreventRefresh = true;

// Helper to push history entry & prevent back navigation during active game rounds
function lockHistoryState() {
  try {
    for (let i = 0; i < 3; i++) {
      window.history.pushState({ oddinary: true }, '', location.href);
    }
  } catch (e) {}
}

// Prevent refresh warning during active game rounds (excludes setup & landing)
window.addEventListener('beforeunload', (e) => {
  const activeEl = document.querySelector('.screen.active');
  const activeId = activeEl ? activeEl.id.replace('screen-', '') : '';
  const isGameInProgress = activeId && !['landing', 'setup'].includes(activeId);

  if (!shouldPreventRefresh || !isGameInProgress) return;

  Analytics.logEvent('game_abandoned', { round: State.round });
  e.preventDefault();
  e.returnValue = 'Game in progress. Are you sure you want to leave or refresh?';
  return e.returnValue;
});

// Traps hardware back button, browser back, and swipe-back gestures during active game & game-over screens
window.addEventListener('popstate', () => {
  const activeEl = document.querySelector('.screen.active');
  const activeId = activeEl ? activeEl.id.replace('screen-', '') : '';
  const isGameInProgress = activeId && !['landing', 'setup'].includes(activeId);

  if (!isGameInProgress || !shouldPreventRefresh) return;

  // Immediately re-push history state so browser stays on current page
  lockHistoryState();

  if (typeof Game !== 'undefined' && Game.askEndGame) {
    Game.askEndGame();
  }
});

// Intercept refresh and back keyboard shortcuts (F5, Ctrl+R, Cmd+R, Alt+LeftArrow) during active game & game-over screens
window.addEventListener('keydown', (e) => {
  const activeEl = document.querySelector('.screen.active');
  const activeId = activeEl ? activeEl.id.replace('screen-', '') : '';
  const isGameInProgress = activeId && !['landing', 'setup'].includes(activeId);

  if (!isGameInProgress || !shouldPreventRefresh) return;

  // Block F5, Ctrl+R, Cmd+R, Ctrl+Shift+R, Cmd+Shift+R
  if (
    e.key === 'F5' ||
    ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof Game !== 'undefined' && Game.askEndGame) {
      Game.askEndGame();
    }
    return false;
  }

  // Block Alt + Left Arrow (browser back shortcut)
  if (e.altKey && (e.key === 'ArrowLeft' || e.keyCode === 37)) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof Game !== 'undefined' && Game.askEndGame) {
      Game.askEndGame();
    }
    return false;
  }
}, true);

// --- Game Controller Engine ---
const Game = {
  init: () => {
    Game.loadSession();
    if (!State.players || State.players.length === 0) {
      State.players = [
        { id: 101, name: "", score: 0 },
        { id: 102, name: "", score: 0 },
        { id: 103, name: "", score: 0 }
      ];
    }
    AudioEngine.muted = !State.config.sound;
    Game.updatePlayerCountBadge();
    Game.updateRoundBadges();

    // If on play.html or setup screen is present, render setup inputs & settings!
    if ($('players-list')) {
      Game.renderSetupInputs();
      Game.renderRecentPlayerChips();
      Game.updateImposterUI();

      if ($('setting-imposter-word')) $('setting-imposter-word').checked = State.config.imposterHasWord;
      if ($('setting-voting')) $('setting-voting').checked = State.config.voting !== false;
      if ($('setting-shuffle')) $('setting-shuffle').checked = State.config.shuffle;
      if ($('setting-secret-alliance')) $('setting-secret-alliance').checked = State.config.secretAlliance;
      if ($('setting-timer')) $('setting-timer').checked = State.config.timer !== false;
      if ($('setting-sound')) $('setting-sound').checked = State.config.sound !== false;
      if ($('setting-category')) $('setting-category').value = State.config.category || 'all';
      Game.updateCategorySetting(State.config.category || 'all', 'init');
      if (State.config.timer !== false) {
        if ($('timer-slider-container')) $('timer-slider-container').classList.remove('hidden');
      } else {
        if ($('timer-slider-container')) $('timer-slider-container').classList.add('hidden');
      }
    }
  },

  updateCategorySetting: (catKey, source = 'setup') => {
    State.config.category = catKey || 'all';

    if ($('setting-category')) $('setting-category').value = State.config.category;
    if ($('mid-setting-category')) $('mid-setting-category').value = State.config.category;

    const pathData = (typeof CATEGORY_ICONS !== 'undefined' && CATEGORY_ICONS[State.config.category]) 
      ? CATEGORY_ICONS[State.config.category] 
      : (typeof CATEGORY_ICONS !== 'undefined' ? CATEGORY_ICONS.all : '');

    if (pathData) {
      const fullSvg = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:var(--primary); display:block;">${pathData}</svg>`;
      if ($('cat-icon-setup')) $('cat-icon-setup').innerHTML = fullSvg;
      if ($('cat-icon-mid')) $('cat-icon-mid').innerHTML = fullSvg;
    }

    if (source !== 'init') {
      AudioEngine.play('category_switch');
    }
    Game.saveSession();
  },

  updateRoundBadges: () => {
    const roundText = `ROUND ${State.round || 1}`;
    ['reveal-round-badge', 'discuss-round-badge', 'voting-round-badge', 'results-round-badge', 'scoreboard-round-badge'].forEach(id => {
      const el = $(id);
      if (el) el.innerText = roundText;
    });
  },

  updatePlayerCountBadge: () => {
    const badge = $('setup-player-count-badge');
    if (badge) {
      badge.innerText = `${State.players.length} Players`;
    }
  },

  toggleAdvancedSettingsAccordion: () => {
    const content = $('advanced-settings-content');
    const arrow = $('advanced-accordion-icon');
    if (!content) return;
    const isCollapsed = content.classList.contains('collapsed');
    if (isCollapsed) {
      content.classList.remove('collapsed');
      if (arrow) arrow.innerText = '▲';
    } else {
      content.classList.add('collapsed');
      if (arrow) arrow.innerText = '▼';
    }
  },

  saveSession: () => {
    const data = {
      players: State.players,
      config: State.config,
      round: State.round,
      stats: State.stats
    };
    StorageManager.saveSession(data);
  },

  loadSession: () => {
    const data = StorageManager.loadSession();
    if (data) {
      if (data.players) State.players = data.players;
      if (data.config) State.config = { ...State.config, ...data.config };
      if (data.round) State.round = data.round;
      if (data.stats) State.stats = data.stats;
      if (State.config.voting === undefined || !data.round || data.round === 0) State.config.voting = true;
      if (State.config.timer === undefined || !data.round || data.round === 0) State.config.timer = true;
      if (State.config.secretAlliance === undefined) State.config.secretAlliance = false;
      if (State.config.sound === undefined) State.config.sound = true;
    }
  },

  showScreen: (name) => {
    Screens.forEach(s => {
      const el = $(`screen-${s}`);
      if (el) el.classList.remove('active');
    });
    const target = $(`screen-${name}`);
    if (target) target.classList.add('active');
    if (name !== 'landing' && name !== 'setup') {
      lockHistoryState();
    }
    window.scrollTo(0, 0);

    if (name === 'landing' || name === 'setup') {
      AudioEngine.playBGM('menu');
    } else if (name === 'reveal') {
      AudioEngine.playBGM('reveal');
    } else if (name === 'discuss') {
      AudioEngine.playBGM('investigation');
    } else if (name === 'voting' || name === 'voting-complete') {
      AudioEngine.playBGM('voting');
    } else if (name === 'results' || name === 'scoreboard' || name === 'game-over') {
      AudioEngine.playBGM('results');
    }
  },

  toggleRules: () => {
    const modal = $('modal-rules');
    if (modal) modal.classList.toggle('open');
  },

  toggleSoundSetting: (enabled) => {
    State.config.sound = enabled;
    AudioEngine.muted = !enabled;
    if (enabled) {
      AudioEngine.play('click');
    } else {
      AudioEngine.stopBGM();
    }
    Game.saveSession();
  },

  showAllianceInfo: () => $('modal-alliance-info') && $('modal-alliance-info').classList.add('open'),
  closeAllianceInfo: () => $('modal-alliance-info') && $('modal-alliance-info').classList.remove('open'),

  showShuffleInfo: () => $('modal-shuffle-info') && $('modal-shuffle-info').classList.add('open'),
  closeShuffleInfo: () => $('modal-shuffle-info') && $('modal-shuffle-info').classList.remove('open'),

  showTimerInfo: () => $('modal-timer-info') && $('modal-timer-info').classList.add('open'),
  closeTimerInfo: () => $('modal-timer-info') && $('modal-timer-info').classList.remove('open'),

  showSoundInfo: () => $('modal-sound-info') && $('modal-sound-info').classList.add('open'),
  closeSoundInfo: () => $('modal-sound-info') && $('modal-sound-info').classList.remove('open'),

    toggleVotingSetting: (checked) => {
    State.config.voting = !!checked;
    Game.saveSession();
  },

  toggleTimerSettings: () => {
    const enabled = $('setting-timer') && $('setting-timer').checked;
    State.config.timer = !!enabled;
    const sliderContainer = $('timer-slider-container');
    if (sliderContainer) {
      if (enabled) {
        sliderContainer.classList.remove('hidden');
      } else {
        sliderContainer.classList.add('hidden');
      }
    }
    Game.saveSession();
  },

  updateTimerValue: (value) => {
    const display = $('timer-value-display');
    if (display) display.innerText = `${value} min`;
    State.config.timerDuration = parseInt(value);
  },

 goToSetup: () => {
 Analytics.logEvent('start_game_clicked');
 Game.showScreen('setup');
 Game.renderSetupInputs();
 Game.renderRecentPlayerChips();
 Game.updateImposterUI();
 
 $('setting-imposter-word').checked = State.config.imposterHasWord;
 $('setting-voting').checked = State.config.voting !== false;
 $('setting-shuffle').checked = State.config.shuffle;
 $('setting-secret-alliance').checked = State.config.secretAlliance;
 $('setting-timer').checked = State.config.timer;
 $('setting-sound').checked = State.config.sound;
 if (State.config.timer) {
   $('timer-slider-container').classList.remove('hidden');
 } else {
   $('timer-slider-container').classList.add('hidden');
 }
 },

  goHome: () => Game.showScreen('landing'),

  quitGame: () => {
    shouldPreventRefresh = false;
    StorageManager.clearSession();
    State.round = 0;
    State.stats = { imposterCountTimes: {}, imposterCaughtTimes: {}, correctGuesses: {}, votesReceived: {} };
    State.players = [];
    State.playerOrder = [];
    State.roles = {};
    State.words = { common: "", odd: "" };
    State.oddPlayerIds = [];
    State.votes = {};
    window.location.href = 'index.html';
  },  addPlayer: (name = "") => {
    if (State.players.length >= 30) {
      Game.showAlert("Maximum 30 players!", "Limit Reached");
      return;
    }
    AudioEngine.play('pop');
    State.players.push({ id: Date.now() + Math.floor(Math.random()*100), name: name, score: 0 });
    Game.saveSession();
    Game.renderSetupInputs(true);
    Game.updatePlayerCountBadge();
    Game.updateImposterUI();
  },

  quickAddRecentPlayer: (name) => {
    if (!name) return;
    AudioEngine.play('pop');
    
    // Find first empty player input or add a new player
    const emptyPlayer = State.players.find(p => !p.name.trim());
    if (emptyPlayer) {
      emptyPlayer.name = name;
    } else {
      if (State.players.length >= 30) {
        Game.showAlert("Maximum 30 players!", "Limit Reached");
        return;
      }
      State.players.push({ id: Date.now() + Math.floor(Math.random()*100), name: name, score: 0 });
    }
    Game.saveSession();
    Game.renderSetupInputs();
    Game.renderRecentPlayerChips();
    Game.updatePlayerCountBadge();
    Game.updateImposterUI();
  },

  clearSavedPlayersHistory: () => {
    AudioEngine.play('click');
    StorageManager.clearSavedPlayers();
    Game.renderRecentPlayerChips();
  },

  removePlayer: (index) => {
    if (State.players.length <= 3) return Game.showAlert("Minimum 3 players required!", "Warning");
    AudioEngine.play('pop');
    State.players.splice(index, 1);
    
    const maxImposters = Math.max(1, Math.floor(State.players.length / 3));
    if (State.config.imposterCount > maxImposters) {
      State.config.imposterCount = maxImposters;
    }

    if (State.config.imposterCount <= 1 && State.config.secretAlliance) {
      State.config.secretAlliance = false;
      const setupCheck = $('setting-secret-alliance');
      const midCheck = $('mid-setting-secret-alliance');
      if (setupCheck) setupCheck.checked = false;
      if (midCheck) midCheck.checked = false;
    }

    Game.saveSession();
    Game.renderSetupInputs();
    Game.updatePlayerCountBadge();
    Game.updateImposterUI();
  },

  playAgain: () => {
    State.players.forEach(p => p.score = 0);
    State.round = 0;
    State.stats = { imposterCountTimes: {}, imposterCaughtTimes: {}, correctGuesses: {}, votesReceived: {} };
    Game.updateCategorySetting('all');
    Game.saveSession();
    Game.setupNextRound();
  },

  startNewGameSetup: () => {
    State.round = 0;
    State.stats = { imposterCountTimes: {}, imposterCaughtTimes: {}, correctGuesses: {}, votesReceived: {} };
    State.players.forEach(p => p.score = 0);
    State.config.timer = true;
    State.config.voting = true;
    Game.updateCategorySetting('all');
    if (State.config.imposterCount <= 1 && State.config.secretAlliance) {
      State.config.secretAlliance = false;
      const setupCheck = $('setting-secret-alliance');
      const midCheck = $('mid-setting-secret-alliance');
      if (setupCheck) setupCheck.checked = false;
      if (midCheck) midCheck.checked = false;
    }
    Game.saveSession();
    Game.goToSetup();
  },
 
 validatePlayerName: (index) => {
 const errorEl = $('setup-error');
 const currentName = State.players[index].name.trim();
 
 const hasDuplicate = State.players.some((p, i) => 
 i !== index && p.name.trim().toLowerCase() === currentName.toLowerCase() && currentName !== ""
 );
 
 if (hasDuplicate) {
 errorEl.innerText = "Duplicate name! Please use unique names.";
 errorEl.classList.add('show');
 setTimeout(() => errorEl.classList.remove('show'), 3000);
 return false;
 }
 
 errorEl.classList.remove('show');
 return true;
 },

 onInputChange: (el, index) => {
 State.players[index].name = el.value;
 Game.validatePlayerName(index);
 Game.saveSession();
 },

 handleDragStart: (e, index) => {
 e.dataTransfer.setData('text/plain', index);
 e.currentTarget.classList.add('dragging');
 Haptics.light();
 },

 handleDragEnd: (e) => {
 e.currentTarget.classList.remove('dragging');
 document.querySelectorAll('.input-group').forEach(el => el.style.borderTop = 'none');
 },

 handleDragOver: (e, listId = 'players-list') => {
 e.preventDefault();
 const list = $(listId);
 const afterElement = Game.getDragAfterElement(e.clientY, list);
 const dragging = document.querySelector('.dragging');
 if (afterElement == null) {
 list.appendChild(dragging);
 } else {
 list.insertBefore(dragging, afterElement);
 }
 },

 getDragAfterElement: (y, list) => {
 const draggableElements = [...list.querySelectorAll('.input-group:not(.dragging)')];
 return draggableElements.reduce((closest, child) => {
 const box = child.getBoundingClientRect();
 const offset = y - box.top - box.height / 2;
 if (offset < 0 && offset > closest.offset) {
 return { offset: offset, element: child };
 } else {
 return closest;
 }
 }, { offset: Number.NEGATIVE_INFINITY }).element;
 },

 handleDrop: (e, listId = 'players-list', isMidgame = false) => {
 e.preventDefault();
 const list = $(listId);
 if (!list) return;
 
 const newList = [];
 list.querySelectorAll('.input-group').forEach(el => {
 const index = parseInt(el.getAttribute('data-player-index'));
 if (!isNaN(index) && State.players[index]) {
 newList.push(State.players[index]);
 }
 });
 State.players = newList;
 Game.saveSession();
  if (isMidgame) {
  Game.renderManagePlayersList();
  } else {
 Game.renderSetupInputs();
 }
 },

 startGame: () => {
 const errorEl = $('setup-error');
 
 const hasEmpty = State.players.some(p => !p.name.trim());
 if (hasEmpty) {
 errorEl.innerText = "All players must have a name!";
 errorEl.classList.add('show');
 setTimeout(() => errorEl.classList.remove('show'), 3000);
 return;
 }
 
 const names = State.players.map(p => p.name.trim().toLowerCase()).filter(n => n !== "");
 const hasDuplicates = names.some((name, idx) => names.indexOf(name) !== idx);
 if (hasDuplicates) {
 errorEl.innerText = "All player names must be unique!";
 errorEl.classList.add('show');
 setTimeout(() => errorEl.classList.remove('show'), 3000);
 return;
 }
 
 if (State.players.length < 3) {
 errorEl.innerText = "Minimum 3 players required!";
 errorEl.classList.add('show');
 setTimeout(() => errorEl.classList.remove('show'), 3000);
 return;
 }

 // Save Player Names into localStorage history
 const validPlayerNames = State.players.map(p => p.name.trim());
 StorageManager.savePlayerNames(validPlayerNames);

 // Sync config
 State.config.shuffle = $('setting-shuffle').checked;
 State.config.timer = $('setting-timer').checked;
 State.config.imposterHasWord = $('setting-imposter-word').checked;
 State.config.voting = $('setting-voting').checked;
  State.config.secretAlliance = $('setting-secret-alliance').checked;
  State.config.sound = $('setting-sound').checked;
  if ($('setting-category')) State.config.category = $('setting-category').value;
  AudioEngine.muted = !State.config.sound;
 
 if (State.config.timer) {
 State.config.timerDuration = parseInt($('timer-duration-slider').value);
 }

 Analytics.logEvent('game_started', {
 player_count: State.players.length,
 imposter_count: State.config.imposterCount,
 stealth_mode: State.config.imposterHasWord,
 voting_enabled: State.config.voting,
 secret_alliance: State.config.secretAlliance
 });

 Game.saveSession();
 Game.setupNextRound();
 },

  setupNextRound: () => {
    State.round++;
    Game.updateRoundBadges();
    State.players.forEach(p => p.roundScore = 0);
    const pair = wordSelector.getRandomPair(State.config.category || 'all');
 
 if (Math.random() > 0.5) {
 State.words.common = pair[0];
 State.words.odd = pair[1];
 } else {
 State.words.common = pair[1];
 State.words.odd = pair[0];
 }

 const pIds = State.players.map(p => p.id);
 
 State.oddPlayerIds = [];
 const availableIndices = Array.from({length: pIds.length}, (_, i) => i);
 for (let i = 0; i < State.config.imposterCount; i++) {
 const idx = Math.floor(Math.random() * availableIndices.length);
 const playerIdx = availableIndices.splice(idx, 1)[0];
 State.oddPlayerIds.push(pIds[playerIdx]);
 }
 
 State.roles = {};
 pIds.forEach(id => {
 State.roles[id] = State.oddPlayerIds.includes(id) ? 'odd' : 'common';
 });

 State.playerOrder = [...pIds];
 if (State.config.shuffle) {
 State.playerOrder.sort(() => Math.random() - 0.5);
 }

 State.stepIndex = 0;
 State.votes = {};
 Game.showRevealScreen();
 },

 showRevealScreen: () => {
 const playerId = State.playerOrder[State.stepIndex];
 const player = State.players.find(p => p.id === playerId);
 
 $('reveal-player-name').innerText = player.name;
 $('reveal-counter').innerText = `Player ${State.stepIndex + 1}/${State.players.length}`;
 $('word-card').classList.remove('flipped');
 
 const role = State.roles[playerId];
 const labelEl = $('reveal-role-label');
 const wordEl = $('secret-word-display');
 const cardBack = document.querySelector('.card-back');
 
 const existingHint = cardBack.querySelector('.alliance-card-hint');
 if (existingHint) existingHint.remove();

 if (role === 'odd') {
      if (State.config.imposterHasWord) {
        wordEl.innerText = State.words.odd;
        labelEl.innerText = "Your secret word is:";
        wordEl.classList.remove('text-danger');
      } else {
        labelEl.innerText = "You are the";
        wordEl.innerText = "ODDINARY";
        wordEl.classList.add('text-danger');
      }

      if (State.config.secretAlliance && State.oddPlayerIds.length > 1) {
        const partnerIds = State.oddPlayerIds.filter(id => id !== playerId);
        const partnerNames = partnerIds.map(id => State.players.find(p => p.id === id).name);
        
        const allianceHint = document.createElement('div');
        allianceHint.className = 'alliance-card-hint';
        allianceHint.innerHTML = `<span style="display:inline-flex; vertical-align:-2px; margin-right:4px;"><svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:var(--primary);"><path d="M2 12h20c0-1.7-1.5-2.8-3.2-2.8h-.8L16.5 4.2C16.2 2.9 15 2 13.6 2h-3.2C9 2 7.8 2.9 7.5 4.2L6 9.2H5.2C3.5 9.2 2 10.3 2 12zm4.5 2.5C4.6 14.5 3 16.1 3 18s1.6 3.5 3.5 3.5 3.5-1.6 3.5-3.5c0-.4-.1-.7-.2-1h4.4c-.1.3-.2.6-.2 1 0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5-1.6-3.5-3.5-3.5c-1.4 0-2.6.8-3.1 2h-4.8c-.5-1.2-1.7-2-3.1-2z"/></svg></span> <strong>Secret Alliance:</strong> ${partnerNames.join(', ')} ${partnerNames.length > 1 ? 'are also Oddinaries' : 'is also an Oddinary'}`;
        cardBack.appendChild(allianceHint);
      }
    } else {
 labelEl.innerText = "Your secret word is:";
 wordEl.innerText = State.words.common;
 wordEl.classList.remove('text-danger');
 }
 
  const nextBtn = $('btn-next-player');
  nextBtn.classList.add('reveal-btn-hidden');
  
  if (State.stepIndex === State.players.length - 1) {
  nextBtn.innerHTML = `Start Investigation`;
  } else {
  nextBtn.innerHTML = `Hide & Pass`;
  }
  
  State.canFlip = false;
  Game.showScreen('reveal');
  
  setTimeout(() => {
  State.canFlip = true;
  }, 500);
  },

  flipCard: () => {
  if (!State.canFlip) return;
  
  const card = $('word-card');
  if (card.classList.contains('flipped')) return;
  
  AudioEngine.play('flip');
  card.classList.add('flipped');
  setTimeout(() => {
  $('btn-next-player').classList.remove('reveal-btn-hidden');
  }, 800);
  },

  nextReveal: () => {
  AudioEngine.play('click');
  $('btn-next-player').classList.add('reveal-btn-hidden');
  $('word-card').classList.remove('flipped');
 
 setTimeout(() => {
 State.stepIndex++;
 if (State.stepIndex < State.players.length) {
 Game.showRevealScreen();
 } else {
 Game.startDiscussion();
 }
 }, 600);
 },

  startDiscussion: () => {
    Game.updateRoundBadges();
    Game.showScreen('discuss');
    const timerContainer = $('timer-container');
    const discussTimerSettings = $('discuss-timer-settings');
    
    const vBtn = $('btn-start-voting');
    if (vBtn) vBtn.innerText = !State.config.voting ? "Reveal Oddinary" : "Start Voting";

    if (State.config.timer) {
      timerContainer.classList.remove('hidden');
      discussTimerSettings.classList.add('hidden');
      State.discussionTimeLeft = State.config.timerDuration * 60;
      AudioEngine.play('timer_start');
      Game.tickDiscussionTimer();
    } else {
      timerContainer.classList.add('hidden');
      discussTimerSettings.classList.remove('hidden');
      const discussCheck = $('discuss-setting-timer');
      if (discussCheck) discussCheck.checked = false;
      const sliderCont = $('discuss-timer-slider-container');
      if (sliderCont) sliderCont.classList.add('hidden');
    }
  },

  tickDiscussionTimer: () => {
    clearTimeout(State.timerInterval);
    const timerDisplay = $('timer-display');
    const tick = () => {
      if (State.discussionTimeLeft < 0) return;
      const m = Math.floor(State.discussionTimeLeft / 60).toString().padStart(2,'0');
      const s = (State.discussionTimeLeft % 60).toString().padStart(2,'0');
      if (timerDisplay) timerDisplay.innerText = `${m}:${s}`;
      
      if (State.discussionTimeLeft > 0) {
        if (State.discussionTimeLeft <= 10) {
          if (timerDisplay) timerDisplay.classList.add('timer-urgent');
          AudioEngine.play('tick');
        } else {
          if (timerDisplay) timerDisplay.classList.remove('timer-urgent');
        }
        State.discussionTimeLeft--;
        State.timerInterval = setTimeout(tick, 1000); 
      } else {
        if (timerDisplay) timerDisplay.classList.remove('timer-urgent');
        AudioEngine.play('alarm');
        Game.showAlert("Investigation time is up! Start voting now.", "Time's Up");
      }
    };
    tick();
  },

 addDiscussionTime: (seconds) => {
 const wasStopped = State.discussionTimeLeft <= 0;
 State.discussionTimeLeft += seconds;
 if (wasStopped) {
 Game.tickDiscussionTimer();
 } else {
 const m = Math.floor(State.discussionTimeLeft / 60).toString().padStart(2,'0');
 const s = (State.discussionTimeLeft % 60).toString().padStart(2,'0');
 $('timer-display').innerText = `${m}:${s}`;
 }
 },

 toggleDiscussTimerSettings: () => {
 const enabled = $('discuss-setting-timer').checked;
 const sliderContainer = $('discuss-timer-slider-container');
 if (enabled) {
 sliderContainer.classList.remove('hidden');
 } else {
 sliderContainer.classList.add('hidden');
 }
 },

 updateDiscussTimerValue: (val) => {
 $('discuss-timer-value-display').innerText = `${val} min`;
 },

 runLocalTimer: () => {
 const duration = parseInt($('discuss-timer-duration-slider').value);
 const timerContainer = $('timer-container');
 const discussTimerSettings = $('discuss-timer-settings');
 
 timerContainer.classList.remove('hidden');
 discussTimerSettings.classList.add('hidden');
 
 State.discussionTimeLeft = duration * 60;
 Game.tickDiscussionTimer();
 },

 askCloseReveal: () => $('modal-close-reveal').classList.add('open'),
 cancelCloseReveal: () => $('modal-close-reveal').classList.remove('open'),
 confirmCloseReveal: () => {
 $('modal-close-reveal').classList.remove('open');
 if (State.round > 0) {
 State.round--;
 }
 State.players.forEach(p => p.roundScore = 0);
 State.votes = {};
 Game.saveSession();
 Game.goToScoreboard();
 },

  showForgotWord: () => {
    // Pause investigation timer if running
    if (State.discussionTimeLeft > 0 && State.timerInterval) {
      State.timerPaused = true;
      clearTimeout(State.timerInterval);
    }

    const list = $('forgot-word-player-list');
    if (!list) return;
    list.innerHTML = "";
    
    // Switch to step 1
    if ($('forgot-step-select')) $('forgot-step-select').classList.remove('hidden');
    if ($('forgot-step-confirm')) $('forgot-step-confirm').classList.add('hidden');
    if ($('forgot-step-reveal')) $('forgot-step-reveal').classList.add('hidden');
    
    State.players.forEach(p => {
      const btn = document.createElement('button');
      btn.className = "forgot-player-btn";
      btn.innerHTML = `
        <span style="display:flex; align-items:center; gap:10px;">
          <svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:var(--primary); opacity:0.85;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          ${p.name}
        </span>
        <svg class="player-chevron" viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
      `;
      btn.onclick = () => {
        AudioEngine.play('click');
        Game.askForgotConfirm(p.id);
      };
      list.appendChild(btn);
    });
    
    if ($('modal-forgot-word')) $('modal-forgot-word').classList.add('open');
  },

  closeForgotWord: () => {
    if ($('modal-forgot-word')) $('modal-forgot-word').classList.remove('open');
    State.pendingForgotPlayer = null;
    
    // Resume investigation timer if it was paused
    if (State.timerPaused && State.discussionTimeLeft > 0) {
      State.timerPaused = false;
      Game.tickDiscussionTimer();
    }
  },

  askForgotConfirm: (playerId) => {
    State.pendingForgotPlayer = playerId;
    const player = State.players.find(p => p.id === playerId);
    if (player && $('confirm-forgot-name')) $('confirm-forgot-name').innerText = player.name;
    
    // Smooth in-place transition to Step 2 (no modal flashes)
    if ($('forgot-step-select')) $('forgot-step-select').classList.add('hidden');
    if ($('forgot-step-confirm')) $('forgot-step-confirm').classList.remove('hidden');
  },

  cancelForgotConfirm: () => {
    State.pendingForgotPlayer = null;
    // Smooth in-place transition back to Step 1
    if ($('forgot-step-confirm')) $('forgot-step-confirm').classList.add('hidden');
    if ($('forgot-step-select')) $('forgot-step-select').classList.remove('hidden');
  },

  showForgotWordReveal: () => {
    const playerId = State.pendingForgotPlayer;
    const role = State.roles[playerId];
    const labelEl = $('forgot-word-label');
    const wordEl = $('forgot-word-display');
    const hintContainer = $('forgot-alliance-hint-container');
    if (hintContainer) hintContainer.innerHTML = "";
    
    if (role === 'odd') {
      if (State.config.imposterHasWord) {
        if (wordEl) {
          wordEl.innerText = State.words.odd;
          wordEl.classList.remove('text-danger');
          wordEl.classList.add('text-primary');
        }
        if (labelEl) labelEl.innerText = "Your secret word is:";
      } else {
        if (labelEl) labelEl.innerText = "You are the";
        if (wordEl) {
          wordEl.innerText = "ODDINARY";
          wordEl.classList.add('text-danger');
          wordEl.classList.remove('text-primary');
        }
      }

      if (State.config.secretAlliance && State.oddPlayerIds.length > 1 && hintContainer) {
        const partnerIds = State.oddPlayerIds.filter(id => id !== playerId);
        const partnerNames = partnerIds.map(id => State.players.find(p => p.id === id).name);
        
        hintContainer.innerHTML = `
          <div class="alliance-card-hint" style="margin-top: 12px;">
            <span style="display:inline-flex; vertical-align:-2px; margin-right:4px;"><svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:var(--primary);"><path d="M2 12h20c0-1.7-1.5-2.8-3.2-2.8h-.8L16.5 4.2C16.2 2.9 15 2 13.6 2h-3.2C9 2 7.8 2.9 7.5 4.2L6 9.2H5.2C3.5 9.2 2 10.3 2 12zm4.5 2.5C4.6 14.5 3 16.1 3 18s1.6 3.5 3.5 3.5 3.5-1.6 3.5-3.5c0-.4-.1-.7-.2-1h4.4c-.1.3-.2.6-.2 1 0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5-1.6-3.5-3.5-3.5c-1.4 0-2.6.8-3.1 2h-4.8c-.5-1.2-1.7-2-3.1-2z"/></svg></span>
            <strong>Secret Alliance:</strong> ${partnerNames.join(', ')} ${partnerNames.length > 1 ? 'are also Oddinaries' : 'is also an Oddinary'}
          </div>
        `;
      }
    } else {
      if (labelEl) labelEl.innerText = "Your secret word is:";
      if (wordEl) {
        wordEl.innerText = State.words.common;
        wordEl.classList.remove('text-danger');
        wordEl.classList.add('text-primary');
      }
    }
    
    // Smooth in-place transition to Step 3
    if ($('forgot-step-confirm')) $('forgot-step-confirm').classList.add('hidden');
    if ($('forgot-step-reveal')) $('forgot-step-reveal').classList.remove('hidden');
  },

  closeWordReveal: () => {
    Game.closeForgotWord();
  },

  showPointsRules: () => $('modal-points-rules').classList.add('open'),
  closePointsRules: () => $('modal-points-rules').classList.remove('open'),

  startVoting: () => {
    clearTimeout(State.timerInterval);
    State.stepIndex = 0;
    State.votes = {};
    State.selectedTargets = [];

    if (!State.config.voting) {
      Game.revealImpostersRL();
    } else {
      Game.showVotingScreen();
    }
  },

  revealImpostersRL: () => {
    State.players.forEach(p => p.roundScore = 0);
    const oddIds = State.oddPlayerIds || [];
    const imposterNames = oddIds.map(id => {
      const player = State.players.find(p => p.id == id);
      return player ? player.name : '';
    }).filter(Boolean);

    Game.triggerSuspenseReveal(imposterNames, 0, () => {
      Game.renderResults({}, "ODDINARY REVEALED");
    });
  },

  showVotingScreen: () => {
    const voterId = State.playerOrder[State.stepIndex];
    const voter = State.players.find(p => p.id === voterId);
    State.selectedTargets = [];
    
    $('voter-name').innerText = voter.name;
    
    const list = $('voting-list');
    list.innerHTML = "";
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = "voting-options-list";
    
    State.players.forEach(p => {
      if (p.id === voterId) return; 
      
      const btn = document.createElement('button');
      btn.className = "vote-option-btn";
      btn.id = `vote-btn-${p.id}`;
      btn.innerText = p.name; 
      btn.onclick = () => Game.toggleVoteSelect(p.id);
      optionsContainer.appendChild(btn);
    });
    list.appendChild(optionsContainer);

    const activeImposterCount = State.oddPlayerIds.length;

    const controls = document.createElement('div');
    controls.className = "voting-controls-box";
    controls.innerHTML = `
      <p class="text-muted" style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin: 0;">
        Select ${activeImposterCount} ${activeImposterCount > 1 ? 'Oddinaries' : 'Oddinary'}
      </p>
      <button id="btn-confirm-votes" class="btn btn-primary" style="width: 100%; margin: 0; opacity: 0.4; pointer-events: none;" onclick="Game.confirmMultiVotes()">Submit Votes</button>
    `;
    list.appendChild(controls);
    
    Game.updateRoundBadges();
    Game.showScreen('voting');
  },

  toggleVoteSelect: (targetId) => {
    AudioEngine.play('click');
    const idx = State.selectedTargets.indexOf(targetId);
    const max = State.oddPlayerIds.length;
    const btn = $(`vote-btn-${targetId}`);

    if (idx > -1) {
      State.selectedTargets.splice(idx, 1);
      if (btn) btn.classList.remove('selected');
    } else {
      if (State.selectedTargets.length >= max) {
        if (max === 1) {
          const oldId = State.selectedTargets[0];
          const oldBtn = $(`vote-btn-${oldId}`);
          if (oldBtn) oldBtn.classList.remove('selected');
          State.selectedTargets = [targetId];
          if (btn) btn.classList.add('selected');
        } else {
          return;
        }
      } else {
        State.selectedTargets.push(targetId);
        if (btn) btn.classList.add('selected');
      }
    }

    const confirmBtn = $('btn-confirm-votes');
    if (confirmBtn) {
      if (State.selectedTargets.length === max) {
        confirmBtn.style.opacity = "1";
        confirmBtn.style.pointerEvents = "auto";
      } else {
        confirmBtn.style.opacity = "0.4";
        confirmBtn.style.pointerEvents = "none";
      }
    }
  },

 confirmMultiVotes: () => {
 AudioEngine.play('click');
 const voterId = State.playerOrder[State.stepIndex];
 Game.submitVote(voterId, [...State.selectedTargets]);
 },

 submitVote: (voterId, targetIds) => {
 State.votes[voterId] = targetIds;
 State.stepIndex++;
 
 if (State.stepIndex < State.players.length) {
 Game.showVotingScreen();
 } else {
 Game.calculateResults();
 }
 },

 calculateResults: () => {
 const totalVotesCast = Object.values(State.votes).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 1), 0);
 if (totalVotesCast === 0 && State.config.voting) {
 if (State.round > 0) State.round--;
 State.players.forEach(p => p.roundScore = 0);
 State.votes = {};
 Game.saveSession();
 Game.goToScoreboard();
 return;
 }

 const voteCounts = {}; 
 let maxVotes = 0;
 
 State.players.forEach(p => { 
 voteCounts[p.id] = 0; 
 p.roundScore = 0; 
 });
 
 Object.values(State.votes).forEach(targetIds => {
 targetIds.forEach(targetId => {
 voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
 State.stats.votesReceived[targetId] = (State.stats.votesReceived[targetId] || 0) + 1;
 });
 });

 for (const pid in voteCounts) {
 if (voteCounts[pid] > maxVotes) maxVotes = voteCounts[pid];
 }

 const mostVotedIds = Object.keys(voteCounts).filter(pid => voteCounts[pid] === maxVotes && maxVotes > 0);
 const oddIds = State.oddPlayerIds;
 
 oddIds.forEach(id => {
 State.stats.imposterCountTimes[id] = (State.stats.imposterCountTimes[id] || 0) + 1;
 });

 State.players.forEach(p => {
 const playerVotes = State.votes[p.id] || [];
 const isVoterImposter = oddIds.includes(p.id);

 playerVotes.forEach(vId => {
 const targetId = parseInt(vId); 
 if (oddIds.includes(targetId)) {
  if (isVoterImposter) {
  p.roundScore += 5;
  AudioEngine.play('betrayal');
  } else {
 p.roundScore += 15;
 State.stats.correctGuesses[p.id] = (State.stats.correctGuesses[p.id] || 0) + 1;
 }
 }
 });
 });

 const caughtImposters = oddIds.filter(id => mostVotedIds.includes(id.toString()));
 const isAnyCaught = caughtImposters.length > 0;
 
 oddIds.forEach(id => {
 const votesOnMe = voteCounts[id] || 0;
 const imposterPlayer = State.players.find(p => p.id == id);
 
 if (mostVotedIds.includes(id.toString()) && votesOnMe > 0) {
 State.stats.imposterCaughtTimes[id] = (State.stats.imposterCaughtTimes[id] || 0) + 1;
 } else if (votesOnMe === 0) {
 imposterPlayer.roundScore += 20;
 } else {
 imposterPlayer.roundScore += 10;
 }
 });
    let isPerfectEscape = oddIds.every(id => (voteCounts[id] || 0) === 0);
    let roundStatus = isAnyCaught ? 
      (caughtImposters.length > 1 ? "Oddinaries Caught!" : "Oddinary Caught!") : 
      (isPerfectEscape ? "Perfect Escape!" : (oddIds.length > 1 ? "Oddinaries Escaped!" : "Oddinary Escaped!"));
    
    State.players.forEach(p => p.score += p.roundScore);
    Game.saveSession();

    const imposterNames = oddIds.map(id => {
      const player = State.players.find(p => p.id == id);
      return player ? player.name : '';
    }).filter(Boolean);
    State.pendingRevealData = {
      imposterNames: imposterNames,
      highestVoteCount: maxVotes,
      voteCounts: voteCounts,
      roundStatus: roundStatus
    };
    Game.showScreen('voting-complete');
  },

  startImposterRevealAnimation: () => {
    if (!State.config.voting) {
      const oddIds = State.oddPlayerIds || [];
      const imposterNames = oddIds.map(id => {
        const player = State.players.find(p => p.id == id);
        return player ? player.name : '';
      }).filter(Boolean);

      Game.triggerSuspenseReveal(imposterNames, 0, () => {
        Game.renderResults({}, "ODDINARY REVEALED");
      });
      return;
    }

    if (!State.pendingRevealData) return;
    const data = State.pendingRevealData;
    Game.triggerSuspenseReveal(data.imposterNames, data.highestVoteCount, () => {
      Game.renderResults(data.voteCounts, data.roundStatus);
    });
  },

 triggerSuspenseReveal: (imposterNames, voteCount, callback) => {
 const overlay = $('suspense-overlay');
 const nameBox = $('suspense-name-box');
 const nameEl = $('suspense-imposter-name');
 const dotsEl = $('suspense-dots');

 nameEl.innerText = imposterNames.join(', ');
 
 overlay.classList.remove('hidden');
 nameBox.classList.remove('reveal-active');
 dotsEl.innerText = ".";
 dotsEl.style.opacity = "1";
 dotsEl.style.transition = "opacity 0.3s ease";
 
 AudioEngine.play('suspense');

 let step = 1;
 const interval = setInterval(() => {
 step++;
 if (step === 2) dotsEl.innerText = "..";
 else if (step === 3) dotsEl.innerText = "...";
 else clearInterval(interval);
 }, 350);

 // Fade out dots before revealing the name
 setTimeout(() => {
 dotsEl.style.opacity = "0";
 }, 900);

 setTimeout(() => {
 dotsEl.style.display = "none";
 nameBox.classList.add('reveal-active');
 AudioEngine.play('reveal');
 }, 1200);

 setTimeout(() => {
 overlay.classList.add('hidden');
 dotsEl.style.display = "";
 dotsEl.style.opacity = "1";
 if (callback) callback();
 }, 4200);
 },

  renderResults: (voteCounts, roundStatus) => {
    const displayStatus = (roundStatus || "ROUND COMPLETE").toUpperCase();
    if (displayStatus.includes('CAUGHT')) {
      AudioEngine.play('imposter_caught');
    } else if (displayStatus.includes('ESCAPED') || displayStatus.includes('VICTORY')) {
      AudioEngine.play('innocent_voted');
    } else {
      AudioEngine.play('fanfare');
    }
  
    const statusHeader = $('round-status-header');
    const cardEl = $('results-imposter-card');

 if (statusHeader) {
 statusHeader.innerText = displayStatus;
 if (displayStatus.includes('CAUGHT')) {
 statusHeader.style.color = "var(--primary)";
 if (cardEl) {
 cardEl.style.borderColor = "var(--primary)";
 cardEl.style.background = "rgba(46, 204, 113, 0.08)";
 }
 } else if (displayStatus.includes('REVEALED')) {
 statusHeader.style.color = "var(--accent-gold)";
 if (cardEl) {
 cardEl.style.borderColor = "var(--accent-gold)";
 cardEl.style.background = "rgba(241, 196, 15, 0.08)";
 }
 } else {
 statusHeader.style.color = "var(--danger)";
 if (cardEl) {
 cardEl.style.borderColor = "var(--danger)";
 cardEl.style.background = "rgba(217, 58, 58, 0.08)";
 }
 }
 }

 $('res-common-word').innerText = State.words.common;
 
 const oddWordRow = $('res-odd-word-row');
 if (State.config.imposterHasWord) {
 oddWordRow.classList.remove('hidden');
 $('res-odd-word').innerText = State.words.odd;
 } else {
 oddWordRow.classList.add('hidden');
 }

 const list = $('round-score-list');
 list.innerHTML = "";
 
 const sorted = [...State.players].sort((a,b) => b.roundScore - a.roundScore);
 sorted.forEach((p, idx) => {
    const isImposter = State.oddPlayerIds.includes(p.id);
    const roleIcon = isImposter 
      ? `<svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:var(--danger); display:block;"><path d="M2 12h20c0-1.7-1.5-2.8-3.2-2.8h-.8L16.5 4.2C16.2 2.9 15 2 13.6 2h-3.2C9 2 7.8 2.9 7.5 4.2L6 9.2H5.2C3.5 9.2 2 10.3 2 12zm4.5 2.5C4.6 14.5 3 16.1 3 18s1.6 3.5 3.5 3.5 3.5-1.6 3.5-3.5c0-.4-.1-.7-.2-1h4.4c-.1.3-.2.6-.2 1 0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5-1.6-3.5-3.5-3.5c-1.4 0-2.6.8-3.1 2h-4.8c-.5-1.2-1.7-2-3.1-2z"/></svg>`
      : `<svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:none; stroke:var(--primary); stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; display:block;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    
    const card = document.createElement('div');
    card.style.background = isImposter ? "#2D1515" : "var(--bg-card)";
    card.style.border = isImposter ? "1px solid rgba(217, 58, 58, 0.3)" : "1px solid rgba(255,255,255,0.06)";
    card.style.padding = "10px 14px";
    card.style.borderRadius = "12px";
    card.style.display = "flex";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap: 8px;">
        <span style="display:flex; align-items:center;">${roleIcon}</span>
        <span style="font-weight: 700; color: ${isImposter ? 'var(--danger)' : 'white'}; font-size: 0.95rem;">${p.name}</span>
      </div>
      <div style="font-weight: 900; color: ${p.roundScore > 0 ? 'var(--primary)' : 'var(--text-muted)'}; font-size: 1.05rem;">
        +${p.roundScore}
      </div>
    `;
    list.appendChild(card);
 });

 const noVotingNote = $('no-voting-results-note');
 if (noVotingNote) {
 if (!State.config.voting) {
 noVotingNote.classList.remove('hidden');
 } else {
 noVotingNote.classList.add('hidden');
 }
 }

 Analytics.logEvent('round_completed', { round: State.round });
 Game.updateRoundBadges();
 Game.showScreen('results');
 },

  goToScoreboard: (fromNormalReveal = false) => {
    Game.updateRoundBadges();
    const area = $('scoreboard-list');
    if (area) area.innerHTML = "";
    
    const scoreboardNote = $('scoreboard-no-voting-note');
    if (scoreboardNote) {
      if (!State.config.voting) {
        scoreboardNote.classList.remove('hidden');
      } else {
        scoreboardNote.classList.add('hidden');
      }
    }
    
    const btnBack = $('btn-back-to-results');
    if (btnBack) {
      if (fromNormalReveal && State.round > 0 && State.oddPlayerIds && State.oddPlayerIds.length > 0) {
        btnBack.style.visibility = 'visible';
      } else {
        btnBack.style.visibility = 'hidden';
      }
    }

 const sorted = [...State.players].sort((a,b) => b.score - a.score);

 sorted.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = "list-item";
    if (idx === 0) item.style.borderColor = "var(--accent-gold)";
    
    const rankColor = idx === 0 ? "var(--accent-gold)" : (idx === 1 ? "#CBD5E1" : (idx === 2 ? "#CD7F32" : "var(--text-muted)"));

    item.innerHTML = `
      <div style="display:flex; align-items:center; flex: 1;">
        <span style="font-weight:900; font-size:1.1rem; width:35px; text-align:center; margin-right:8px; color: ${rankColor};">#${idx+1}</span>
        <span style="font-size:1.1rem; font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${p.name}</span>
      </div>
      <div style="text-align:right;">
        <span class="text-primary" style="font-weight:900; font-size:1.15rem; display:block;">${p.score}</span>
      </div>
    `;
    area.appendChild(item);
 });

 Game.showScreen('scoreboard');
 },

 openManagePlayers: () => {
 State.editingPlayerIndex = null;
 Game.renderManagePlayersList();
 $('modal-manage-players').classList.add('open');
 },

 startInlinePlayerName: (index) => {
 State.editingPlayerIndex = index;
 Game.renderManagePlayersList();
 },

 cancelInlinePlayerName: () => {
 State.editingPlayerIndex = null;
 Game.renderManagePlayersList();
 },

 saveInlinePlayerName: (index) => {
 const input = $(`inline-edit-input-${index}`);
 if (!input) return;
 const newName = input.value.trim();

 if (!newName) {
 Game.showAlert("Please enter a valid player name.", "Invalid Name");
 return;
 }

 const isDuplicate = State.players.some((p, i) => i !== index && p.name.trim().toLowerCase() === newName.toLowerCase());
 if (isDuplicate) {
 Game.showAlert("Duplicate name! Please use a unique name.", "Duplicate Name");
 return;
 }

 State.players[index].name = newName;
 State.editingPlayerIndex = null;

 // Save new name to history
 StorageManager.savePlayerNames(newName);
 Game.saveSession();
 Game.renderManagePlayersList();
 Game.goToScoreboard();
 },

 closeManagePlayers: () => {
 State.editingPlayerIndex = null;
 $('modal-manage-players').classList.remove('open');
 Game.goToScoreboard();
 },

 askRemovePlayerMidgame: (index) => {
 const player = State.players[index];
 if (!player) return;
 if (State.players.length <= 3) {
 Game.showAlert("Minimum 3 players are required.", "Minimum Players Reached");
 return;
 }
 Game.openRemovePlayerConfirm(player.id);
 },

openDeletePlayers: () => Game.openManagePlayers(),
 closeDeletePlayers: () => $('modal-manage-players').classList.remove('open'),
 openRearrangePlayers: () => Game.openManagePlayers(),
 closeRearrangePlayers: () => $('modal-manage-players').classList.remove('open'),

  showGameOverScreen: () => {
    AudioEngine.play('championship');
    ConfettiFX.launch();
    Analytics.logEvent('game_completed', { total_rounds: State.round });
    
    const sorted = [...State.players].sort((a,b) => (b.score || 0) - (a.score || 0));
    const allPointsZero = State.players.every(p => (p.score || 0) === 0);

    // 1. Populate Ranks List
    const ranksList = $('game-over-ranks-list');
    if (ranksList) {
      ranksList.innerHTML = '';
      sorted.forEach((p, idx) => {
        const rankColor = idx === 0 ? "var(--accent-gold)" : (idx === 1 ? "#CBD5E1" : (idx === 2 ? "#CD7F32" : "var(--text-muted)"));
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.1rem; font-weight: 900; min-width: 28px; text-align: center; color: ${rankColor};">#${idx + 1}</span>
            <span style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">${p.name}</span>
          </div>
          <span style="font-weight: 900; color: var(--primary); font-size: 1.15rem;">${p.score || 0} pts</span>
        `;
        ranksList.appendChild(item);
      });
    }

    if (allPointsZero || State.round === 0) {
      $('game-over-winner-name').innerText = sorted[0] ? sorted[0].name : "Player";
      $('stat-dangerous-imposter-name').innerText = "-";
      $('stat-dangerous-imposter-sub').innerText = "-";
      $('stat-best-detective-name').innerText = "-";
      $('stat-best-detective-sub').innerText = "-";
      $('stat-most-suspected-name').innerText = "-";
      $('stat-most-suspected-sub').innerText = "-";
    } else {
      const winner = sorted[0] || { name: 'Player', score: 0 };
      $('game-over-winner-name').innerText = winner.name;

      let mostDangerous = null;
      let lowestCaughtRatio = 999;
      State.players.forEach(p => {
        const imposterTimes = State.stats.imposterCountTimes[p.id] || 0;
        const caughtTimes = State.stats.imposterCaughtTimes[p.id] || 0;
        if (imposterTimes > 0) {
          const ratio = caughtTimes / imposterTimes;
          if (ratio < lowestCaughtRatio) {
            lowestCaughtRatio = ratio;
            mostDangerous = { player: p, caught: caughtTimes };
          }
        }
      });
      if (mostDangerous) {
        $('stat-dangerous-imposter-name').innerText = mostDangerous.player.name;
        $('stat-dangerous-imposter-sub').innerText = `Caught ${mostDangerous.caught} time${mostDangerous.caught !== 1 ? 's' : ''}`;
      } else {
        $('stat-dangerous-imposter-name').innerText = "-";
        $('stat-dangerous-imposter-sub').innerText = "-";
      }

      let bestDetective = null;
      let maxGuesses = 0;
      State.players.forEach(p => {
        const guesses = State.stats.correctGuesses[p.id] || 0;
        if (guesses > maxGuesses) {
          maxGuesses = guesses;
          bestDetective = { player: p, guesses: guesses };
        }
      });
      if (bestDetective) {
        $('stat-best-detective-name').innerText = bestDetective.player.name;
        $('stat-best-detective-sub').innerText = `${bestDetective.guesses} correct guess${bestDetective.guesses !== 1 ? 'es' : ''}`;
      } else {
        $('stat-best-detective-name').innerText = "-";
        $('stat-best-detective-sub').innerText = "-";
      }

      let mostSuspected = null;
      let maxVotes = 0;
      State.players.forEach(p => {
        const votes = State.stats.votesReceived[p.id] || 0;
        if (votes > maxVotes) {
          maxVotes = votes;
          mostSuspected = { player: p, votes: votes };
        }
      });
      if (mostSuspected) {
        $('stat-most-suspected-name').innerText = mostSuspected.player.name;
        $('stat-most-suspected-sub').innerText = `Suspected ${mostSuspected.votes} time${mostSuspected.votes !== 1 ? 's' : ''}`;
      } else {
        $('stat-most-suspected-name').innerText = "-";
        $('stat-most-suspected-sub').innerText = "-";
      }
    }

    Game.showScreen('game-over');
  },

  playAgain: () => {
    State.players.forEach(p => p.score = 0);
    State.round = 0;
    State.stats = { imposterCountTimes: {}, imposterCaughtTimes: {}, correctGuesses: {}, votesReceived: {} };
    Game.saveSession();
    Game.setupNextRound();
  },

  startNewGameSetup: () => {
    State.round = 0;
    State.stats = { imposterCountTimes: {}, imposterCaughtTimes: {}, correctGuesses: {}, votesReceived: {} };
    State.players.forEach(p => p.score = 0);
    State.config.timer = true;
    State.config.voting = true;
    if (State.config.imposterCount <= 1 && State.config.secretAlliance) {
      State.config.secretAlliance = false;
      const setupCheck = $('setting-secret-alliance');
      const midCheck = $('mid-setting-secret-alliance');
      if (setupCheck) setupCheck.checked = false;
      if (midCheck) midCheck.checked = false;
    }
    Game.saveSession();
    Game.goToSetup();
  },

  openShareResultsModal: () => {
    Game.generateShareCanvas();
    const modal = $('modal-share-results');
    if (modal) modal.classList.add('open');
  },

  closeShareResultsModal: () => {
    const modal = $('modal-share-results');
    if (modal) modal.classList.remove('open');
  },

  generateShareCanvas: () => {
    const canvas = $('share-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const sorted = [...State.players].sort((a,b) => (b.score || 0) - (a.score || 0));
    const winner = sorted[0] || { name: 'Player', score: 0 };
    const allPlayers = sorted;

    const baseW = 600;
    const scale = 2.5; // Ultra HD High-DPI 1500px Canvas

    const logoW = 220 * scale;
    let logoH = 50 * scale;
    if (shareLogoImg.naturalWidth && shareLogoImg.naturalHeight) {
      logoH = (shareLogoImg.naturalHeight / shareLogoImg.naturalWidth) * logoW;
    }
    const logoY = 24 * scale;
    const logoBottom = logoY + logoH - (8 * scale);

    const subtitleY = logoBottom + (10 * scale);
    const winnerY = logoBottom + (24 * scale);
    const winnerH = 72 * scale;
    const statsY = winnerY + winnerH + (14 * scale);
    const statsH = 84 * scale;
    const standingsY = statsY + statsH + (16 * scale);
    const standingsCardH = (52 + allPlayers.length * 36 + 12) * scale;
    const footerY = standingsY + standingsCardH + (24 * scale);
    const totalH = footerY + (24 * scale);

    canvas.width = baseW * scale;
    canvas.height = Math.max(600 * scale, totalH);
    const w = canvas.width;
    const h = canvas.height;

    const render = () => {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Dark Background
      ctx.fillStyle = '#07080A';
      ctx.fillRect(0, 0, w, h);

      // 2. Ambient Gradient Glow
      const grad = ctx.createRadialGradient(w / 2, 120 * scale, 10 * scale, w / 2, 120 * scale, 400 * scale);
      grad.addColorStop(0, 'rgba(107, 207, 45, 0.28)');
      grad.addColorStop(1, 'rgba(7, 8, 10, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 3. Card Border
      ctx.strokeStyle = 'rgba(107, 207, 45, 0.45)';
      ctx.lineWidth = 5 * scale;
      ctx.strokeRect(14 * scale, 14 * scale, w - (28 * scale), h - (28 * scale));

      // 4. Logo Image ALWAYS at Top (Full-Size Crisp PNG)
      ctx.drawImage(shareLogoImg, (w - logoW) / 2, logoY, logoW, logoH);

      // Subtitle
      const roundCount = State.round || 1;
      const roundWord = roundCount === 1 ? 'ROUND' : 'ROUNDS';
      ctx.fillStyle = '#F1C40F';
      ctx.font = `800 ${14 * scale}px Inter, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`GAME RESULTS • ${roundCount} ${roundWord} PLAYED`, w / 2, subtitleY);

      // 5. Winner Box (Oddinary Champion Name Only - no points)
      ctx.fillStyle = 'rgba(24, 26, 32, 0.95)';
      ctx.strokeStyle = '#F1C40F';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.roundRect(45 * scale, winnerY, w - (90 * scale), winnerH, 16 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F1C40F';
      ctx.font = `900 ${13 * scale}px Inter, -apple-system, sans-serif`;
      ctx.fillText('ODDINARY CHAMPION', w / 2, winnerY + (24 * scale));

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${25 * scale}px Inter, -apple-system, sans-serif`;
      ctx.fillText(`${winner.name}`, w / 2, winnerY + (54 * scale));

      // 6. Highlights / Stats Row
      let dangerousName = "-";
      let dangerousSub = "-";
      let detectiveName = "-";
      let detectiveSub = "-";
      let suspectedName = "-";
      let suspectedSub = "-";

      const allPointsZero = State.players.every(p => (p.score || 0) === 0);
      if (!allPointsZero && State.round > 0) {
        let lowestCaughtRatio = 999;
        State.players.forEach(p => {
          const imposterTimes = State.stats.imposterCountTimes[p.id] || 0;
          const caughtTimes = State.stats.imposterCaughtTimes[p.id] || 0;
          if (imposterTimes > 0) {
            const ratio = caughtTimes / imposterTimes;
            if (ratio < lowestCaughtRatio) {
              lowestCaughtRatio = ratio;
              dangerousName = p.name;
              dangerousSub = `Caught ${caughtTimes} time${caughtTimes !== 1 ? 's' : ''}`;
            }
          }
        });

        let maxGuesses = 0;
        State.players.forEach(p => {
          const guesses = State.stats.correctGuesses[p.id] || 0;
          if (guesses > maxGuesses) {
            maxGuesses = guesses;
            detectiveName = p.name;
            detectiveSub = `${guesses} correct guess${guesses !== 1 ? 'es' : ''}`;
          }
        });

        let maxVotes = 0;
        State.players.forEach(p => {
          const votes = State.stats.votesReceived[p.id] || 0;
          if (votes > maxVotes) {
            maxVotes = votes;
            suspectedName = p.name;
            suspectedSub = `Suspected ${votes} time${votes !== 1 ? 's' : ''}`;
          }
        });
      }

      const statsList = [
        { label: 'DANGEROUS ODDINARY', val: dangerousName, sub: dangerousSub },
        { label: 'BEST DETECTIVE', val: detectiveName, sub: detectiveSub },
        { label: 'MOST SUSPECTED', val: suspectedName, sub: suspectedSub }
      ];

      const boxW = (w - (90 * scale) - (18 * scale)) / 3;
      statsList.forEach((s, idx) => {
        const boxX = (45 * scale) + idx * (boxW + (9 * scale));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.roundRect(boxX, statsY, boxW, statsH, 12 * scale);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#6E7382';
        ctx.font = `800 ${9.5 * scale}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(s.label, boxX + boxW / 2, statsY + (20 * scale));

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `800 ${14 * scale}px Inter, -apple-system, sans-serif`;
        ctx.fillText(s.val, boxX + boxW / 2, statsY + (44 * scale));

        ctx.fillStyle = '#F1C40F';
        ctx.font = `700 ${10.5 * scale}px Inter, -apple-system, sans-serif`;
        ctx.fillText(s.sub, boxX + boxW / 2, statsY + (64 * scale));
      });

      // 7. Standings Card (header: LEADERBOARD)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect(45 * scale, standingsY, w - (90 * scale), standingsCardH, 16 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6E7382';
      ctx.font = `800 ${13 * scale}px Inter, -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('LEADERBOARD', 68 * scale, standingsY + (32 * scale));

      ctx.textAlign = 'right';
      ctx.fillText('POINTS', w - (68 * scale), standingsY + (32 * scale));

      let yPos = standingsY + (64 * scale);

      allPlayers.forEach((p, idx) => {
        const medal = `#${idx + 1}`;
        ctx.fillStyle = idx === 0 ? '#F1C40F' : '#FFFFFF';
        ctx.font = `700 ${16 * scale}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${medal}  ${p.name}`, 68 * scale, yPos);

        ctx.fillStyle = '#6BCF2D';
        ctx.font = `800 ${16 * scale}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(`${p.score || 0} pts`, w - (68 * scale), yPos);
        yPos += 36 * scale;
      });

      // 8. Footer text
      ctx.fillStyle = '#6E7382';
      ctx.font = `600 ${13.5 * scale}px Inter, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Play free at https://oddinary.vercel.app', w / 2, footerY);
    };

    if (shareLogoImg.complete && shareLogoImg.naturalWidth !== 0) {
      render();
    } else {
      shareLogoImg.onload = render;
      render();
    }
  },

  downloadShareImage: () => {
    const canvas = $('share-card-canvas');
    if (!canvas) return;

    const roundCount = State.round || 1;
    const filename = `oddinary-champion-round-${roundCount}.png`;

    try {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            Game._directDataUrlDownload(canvas, filename);
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.style.display = 'none';
          link.download = filename;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            if (link.parentNode) link.parentNode.removeChild(link);
            URL.revokeObjectURL(url);
          }, 1000);
          Game.showAlert('Results image downloaded to your device!', 'Saved');
        }, 'image/png');
      } else {
        Game._directDataUrlDownload(canvas, filename);
      }
    } catch (e) {
      console.error('Blob download error:', e);
      Game._directDataUrlDownload(canvas, filename);
    }
  },

  _directDataUrlDownload: (canvas, filename) => {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.style.display = 'none';
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 1000);
      Game.showAlert('Results image downloaded to your device!', 'Saved');
    } catch (err) {
      console.error('Direct download error:', err);
      Game.showAlert('Unable to download image automatically. Please check browser permissions!', 'Download Error');
    }
  },

  doNativeShare: async () => {
    const sorted = [...State.players].sort((a,b) => (b.score || 0) - (a.score || 0));
    const winner = sorted[0] || { name: 'Player', score: 0 };
    const text = `${winner.name} won Oddinary - Word Imposter Game with ${winner.score || 0} points!\nCan you catch the Oddinary? Play free at https://oddinary.vercel.app/`;

    const canvas = $('share-card-canvas');
    if (canvas && navigator.canShare) {
      try {
        canvas.toBlob(async (blob) => {
          if (blob && navigator.share) {
            const file = new File([blob], 'oddinary-champion.png', { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: 'Oddinary - Word Imposter Game Results',
                text: text,
                files: [file]
              });
              return;
            }
          }
          if (navigator.share) {
            await navigator.share({
              title: 'Oddinary - Word Imposter Game Results',
              text: text,
              url: 'https://oddinary.vercel.app/'
            });
          }
        });
        return;
      } catch (err) {
        console.log('Share canceled or not allowed:', err);
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Oddinary - Word Imposter Game Results',
          text: text,
          url: 'https://oddinary.vercel.app/'
        });
      } catch (e) {}
    } else {
      Game.copyShareText();
    }
  },

  copyShareText: () => {
    const sorted = [...State.players].sort((a,b) => (b.score || 0) - (a.score || 0));
    const winner = sorted[0] || { name: 'Player', score: 0 };
    let msg = `Oddinary - Word Imposter Game\nChampion: ${winner.name} (${winner.score || 0} pts)\n\nFinal Leaderboard:\n`;
    sorted.forEach((p, idx) => {
      const rank = `${idx + 1}.`;
      msg += `${rank} ${p.name}: ${p.score || 0} pts\n`;
    });
    msg += `\nPlay free with friends on one phone: https://oddinary.vercel.app/`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg).then(() => {
        Game.showAlert('Match summary copied to clipboard!', 'Copied');
      });
    } else {
      Game.showAlert(msg, 'Match Summary');
    }
  },

  openAddPlayerMidgame: () => {
 $('new-player-name-midgame').value = "";
 $('add-player-midgame-error').classList.remove('show');
 $('modal-add-player-midgame').classList.add('open');
 setTimeout(() => $('new-player-name-midgame').focus(), 100);
 },

 closeAddPlayerMidgame: () => {
 $('modal-add-player-midgame').classList.remove('open');
 Game.openManagePlayers();
 },

 confirmAddPlayerMidgame: () => {
 const nameInput = $('new-player-name-midgame');
 const name = nameInput.value.trim();
 const errorEl = $('add-player-midgame-error');

 if (!name) {
 errorEl.innerText = "Please enter a name.";
 errorEl.classList.add('show');
 return;
 }

 const isDuplicate = State.players.some(p => p.name.trim().toLowerCase() === name.toLowerCase());
 if (isDuplicate) {
 errorEl.innerText = "Duplicate name! Please use a unique name.";
 errorEl.classList.add('show');
 return;
 }

 if (State.players.length >= 30) {
 errorEl.innerText = "Maximum 30 players!";
 errorEl.classList.add('show');
 return;
 }

 State.players.push({ id: Date.now(), name: name, score: 0 });
 StorageManager.savePlayerNames(name);
 Game.saveSession();
 Game.closeAddPlayerMidgame();
 Game.openManagePlayers();
 Game.updateImposterUI();
 },

 openRemovePlayerConfirm: (playerId) => {
 if (State.players.length <= 3) {
 Game.showAlert("Minimum 3 players are required.", "Minimum Players Reached");
 return;
 }
 State.pendingRemovePlayerId = playerId;
 const player = State.players.find(p => p.id === playerId);
 $('remove-player-name').innerText = player.name;
 $('modal-remove-player-confirm').classList.add('open');
 },

 closeRemovePlayerConfirm: () => {
 $('modal-remove-player-confirm').classList.remove('open');
 State.pendingRemovePlayerId = null;
 Game.openManagePlayers();
 },

 confirmRemovePlayerMidgame: () => {
 const playerId = State.pendingRemovePlayerId;
 State.players = State.players.filter(p => p.id !== playerId);
 
 const maxImposters = Math.max(1, Math.floor(State.players.length / 3));
 if (State.config.imposterCount > maxImposters) {
 State.config.imposterCount = maxImposters;
 }

 Game.saveSession();
 Game.closeRemovePlayerConfirm();
 Game.openManagePlayers();
 Game.updateImposterUI();
 },

 askResetScores: () => $('modal-reset-scores-confirm').classList.add('open'),
 cancelResetScores: () => $('modal-reset-scores-confirm').classList.remove('open'),
 confirmResetScores: () => {
 State.players.forEach(p => p.score = 0);
 Game.saveSession();
 Game.cancelResetScores();
 Game.goToScoreboard();
 },

 openMidgameSettings: () => {
    $('mid-setting-shuffle').checked = State.config.shuffle;
    $('mid-setting-timer').checked = State.config.timer;
    $('mid-setting-voting').checked = State.config.voting;
    $('mid-setting-secret-alliance').checked = State.config.secretAlliance;
    $('mid-setting-sound').checked = State.config.sound;
    $('mid-timer-duration-slider').value = State.config.timerDuration;
    $('mid-timer-value-display').innerText = `${State.config.timerDuration} min`;
    $('mid-imposter-count-display').innerText = State.config.imposterCount;
    $('mid-setting-imposter-word').checked = State.config.imposterHasWord;
    if ($('mid-setting-category')) $('mid-setting-category').value = State.config.category || 'all';
    Game.updateCategorySetting(State.config.category || 'all', 'mid');
    
    Game.updateImposterUI();
    Game.toggleMidTimerSettings();
    $('modal-midgame-settings').classList.add('open');
  },

 closeMidgameSettings: () => $('modal-midgame-settings').classList.remove('open'),

 toggleMidTimerSettings: () => {
 const enabled = $('mid-setting-timer').checked;
 const sliderContainer = $('mid-timer-slider-container');
 if (enabled) {
 sliderContainer.classList.remove('hidden');
 } else {
 sliderContainer.classList.add('hidden');
 }
 },

 updateMidTimerValue: (value) => {
 $('mid-timer-value-display').innerText = `${value} min`;
 },

 saveMidgameSettings: () => {
    State.config.shuffle = $('mid-setting-shuffle').checked;
    State.config.timer = $('mid-setting-timer').checked;
    State.config.voting = $('mid-setting-voting').checked;
    State.config.secretAlliance = $('mid-setting-secret-alliance').checked;
    State.config.sound = $('mid-setting-sound').checked;
    AudioEngine.muted = !State.config.sound;
    State.config.timerDuration = parseInt($('mid-timer-duration-slider').value);
    State.config.imposterCount = parseInt($('mid-imposter-count-display').innerText);
    State.config.imposterHasWord = $('mid-setting-imposter-word').checked;
    if ($('mid-setting-category')) State.config.category = $('mid-setting-category').value;
    Game.updateCategorySetting(State.config.category || 'all', 'mid');
    
    $('setting-shuffle').checked = State.config.shuffle;
    $('setting-timer').checked = State.config.timer;
    $('setting-voting').checked = State.config.voting !== false;
    $('setting-secret-alliance').checked = State.config.secretAlliance;
    $('setting-sound').checked = State.config.sound;
    $('timer-duration-slider').value = State.config.timerDuration;
    $('timer-value-display').innerText = `${State.config.timerDuration} min`;
    $('setting-imposter-word').checked = State.config.imposterHasWord;
 
 const setupCount = $('setup-imposter-count-display');
 if (setupCount) setupCount.innerText = State.config.imposterCount;

 if (State.config.timer) {
 const timerContainer = $('timer-container');
 const discussTimerSettings = $('discuss-timer-settings');
 if (timerContainer && discussTimerSettings) {
 timerContainer.classList.remove('hidden');
 discussTimerSettings.classList.add('hidden');
 if (State.discussionTimeLeft <= 0 || !State.timerInterval) {
 State.discussionTimeLeft = State.config.timerDuration * 60;
 Game.tickDiscussionTimer();
 }
 }
 } else {
 const timerContainer = $('timer-container');
 if (timerContainer) timerContainer.classList.add('hidden');
 clearTimeout(State.timerInterval);
 }
 
 Game.toggleTimerSettings();
 Game.saveSession();
 Game.closeMidgameSettings();
 },

 showStealthModeInfo: () => $('modal-stealth-info').classList.add('open'),
 closeStealthModeInfo: () => $('modal-stealth-info').classList.remove('open'),

 showVotingInfo: () => $('modal-voting-info').classList.add('open'),
 closeVotingInfo: () => $('modal-voting-info').classList.remove('open'),

 handlePlayerEnter: (e, idx) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const nextInput = document.getElementById(`player-input-${idx + 1}`);
 if (nextInput) {
 nextInput.focus();
 } else if (State.players[idx].name.trim() !== "") {
 Game.addPlayer();
 }
 }
 },

 toggleSecretAllianceSetting: (el, screenType) => {
 const countDisplay = screenType === 'mid' ? $('mid-imposter-count-display') : $('setup-imposter-count-display');
 const activeCount = countDisplay ? parseInt(countDisplay.innerText) : State.config.imposterCount;

 if (el.checked && activeCount <= 1) {
 AudioEngine.play('click');
 Game.showAlert("Secret Alliance requires at least 2 Imposters. Increase the Imposter count to enable this feature.", "Secret Alliance Rule");
 setTimeout(() => {
 el.checked = false;
 State.config.secretAlliance = false;
 const setupCheck = $('setting-secret-alliance');
 const midCheck = $('mid-setting-secret-alliance');
 if (setupCheck) setupCheck.checked = false;
 if (midCheck) midCheck.checked = false;
 Game.saveSession();
 }, 50);
 } else {
 State.config.secretAlliance = el.checked;
 if (screenType === 'setup') {
 const mid = $('mid-setting-secret-alliance');
 if (mid) mid.checked = el.checked;
 } else {
 const setup = $('setting-secret-alliance');
 if (setup) setup.checked = el.checked;
 }
 Game.saveSession();
 }
 },

 adjustImposterCount: (delta, screenType = 'setup') => {
    const maxImposters = Math.max(1, Math.floor(State.players.length / 3)); 
    let newCount = State.config.imposterCount + delta;
    
    if (delta > 0 && newCount > maxImposters) {
      const neededPlayers = (State.config.imposterCount + 1) * 3;
      if (neededPlayers > 30 || State.players.length >= 30) {
        Game.showAlert("Maximum 10 Oddinaries allowed for the 30 player limit.", "Max Limit Reached");
      } else {
        Game.showAlert(`You need at least ${neededPlayers} players to add another Imposter.`, "More Players Needed");
      }
      return;
    }

 if (delta < 0 && newCount < 1) {
 Game.showAlert("A game must have at least 1 Imposter!", "Imposter Required");
 return;
 }
 
 State.config.imposterCount = newCount;

 if (newCount <= 1 && State.config.secretAlliance) {
 State.config.secretAlliance = false;
 const setupCheck = $('setting-secret-alliance');
 const midCheck = $('mid-setting-secret-alliance');
 if (setupCheck) setupCheck.checked = false;
 if (midCheck) midCheck.checked = false;
 }
 Game.updateImposterUI();
 Game.saveSession();
 },

 updateImposterUI: () => {
  const count = State.config.imposterCount;
  if (count <= 1 && State.config.secretAlliance) {
  State.config.secretAlliance = false;
  const setupCheck = $('setting-secret-alliance');
  const midCheck = $('mid-setting-secret-alliance');
  if (setupCheck) setupCheck.checked = false;
  if (midCheck) midCheck.checked = false;
  }
  const screens = ['setup', 'mid'];
 screens.forEach(s => {
 const display = $(`${s}-imposter-count-display`);
 const plusBtn = $(`${s}-imposter-plus`);
 const minusBtn = $(`${s}-imposter-minus`);

 if (display) display.innerText = count;
 
 if (plusBtn) {
 plusBtn.style.opacity = "1";
 plusBtn.style.pointerEvents = "auto";
 plusBtn.style.filter = "none";
 }

 if (minusBtn) {
 minusBtn.style.opacity = "1";
 minusBtn.style.pointerEvents = "auto";
 minusBtn.style.filter = "none";
 }
 });
 },

 showVotingBreakdown: () => {
 const list = $('voting-breakdown-list');
 list.innerHTML = "";
 
 const table = document.createElement('table');
 table.style.width = "100%";
 table.style.borderCollapse = "collapse";
 table.style.marginTop = "10px";
 
 table.innerHTML = `
 <thead>
 <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
 <th style="padding: 12px; text-align: left; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Voter</th>
 <th style="padding: 12px; text-align: right; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Suspects</th>
 </tr>
 </thead>
 <tbody id="voting-table-body"></tbody>
 `;
 list.appendChild(table);
 const tbody = $('voting-table-body');

 State.players.forEach(voter => {
 const targetIds = State.votes[voter.id] || [];
 if (targetIds.length === 0) return;

 const targetChips = targetIds.map(id => {
 const p = State.players.find(player => player.id == id);
 if (!p) return 'Unknown';
 const isImposter = State.oddPlayerIds.includes(p.id);
 return `<span class="${isImposter ? 'text-danger' : 'text-white'}" style="font-weight: 900;">${p.name}</span>`;
 }).join('<br>');

 const isVoterImposter = State.oddPlayerIds.includes(voter.id);
 const voterNameDisplay = isVoterImposter ? `<span class="text-danger" style="font-weight: 900;">${voter.name}</span>` : voter.name;

 const row = document.createElement('tr');
 row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
 row.innerHTML = `
 <td style="padding: 12px; text-align: left; vertical-align: middle; font-weight: 600;">${voterNameDisplay}</td>
 <td style="padding: 12px; text-align: right; vertical-align: middle; line-height: 1.4;">${targetChips}</td>
 `;
 tbody.appendChild(row);
 });
 
 $('modal-voting-breakdown').classList.add('open');
 },

 closeVotingBreakdown: () => $('modal-voting-breakdown').classList.remove('open'),

  showAlert: (message, title = "Notice", type = null) => {
    $('alert-title').innerText = title;
    $('alert-message').innerText = message;

    const iconContainer = $('alert-icon-container');
    if (iconContainer) {
      const isSuccess = type === 'success' || /saved|copied|downloaded|success/i.test(title);
      if (isSuccess) {
        iconContainer.innerHTML = `<svg viewBox="0 0 24 24" style="width:48px; height:48px; fill:var(--primary);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
      } else {
        iconContainer.innerHTML = `<svg viewBox="0 0 24 24" style="width:48px; height:48px; fill:var(--accent-gold);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
      }
    }

    $('modal-alert').classList.add('open');
  },

 closeAlert: () => $('modal-alert').classList.remove('open'),

 backToResults: () => Game.showScreen('results'),
 
 askEndGame: () => $('modal-end-game-confirm').classList.add('open'),
 cancelEndGame: () => $('modal-end-game-confirm').classList.remove('open'),

  confirmEndGame: () => {
    const modal = $('modal-end-game-confirm');
    if (modal) modal.classList.remove('open');
    Game.showGameOverScreen();
  },

  closeAllOpenModals: () => {
    const openModals = document.querySelectorAll('.modal.open');
    openModals.forEach(m => m.classList.remove('open'));
  }
};

// --- Global Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    Game.closeAllOpenModals();
  }
});

// --- Confetti FX Engine ---
const ConfettiFX = {
  launch: () => {
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '99999';
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6BCF2D', '#9CFF3A', '#F1C40F', '#FFFFFF', '#E63946', '#38BDF8'];
    const particles = [];
    const count = 75;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.4 - canvas.height * 0.2,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4.5,
        vy: Math.random() * 3 + 2.5,
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 9,
        opacity: 1
      });
    }

    let startTime = performance.now();
    const duration = 3500;

    const render = (now) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rSpeed;
        if (elapsed > 2000) {
          p.opacity = Math.max(0, 1 - (elapsed - 2000) / 1500);
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (elapsed < duration) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    requestAnimationFrame(render);
  }
};
