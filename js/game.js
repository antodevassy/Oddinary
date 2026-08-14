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
        timer: false, 
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
    discussionTimeLeft: 0,
    stats: {
        imposterCountTimes: {},
        imposterCaughtTimes: {},
        correctGuesses: {},
        votesReceived: {}
    }
};

const $ = (id) => document.getElementById(id);
const Screens = ['landing', 'setup', 'reveal', 'discuss', 'voting', 'voting-complete', 'results', 'scoreboard'];
let shouldPreventRefresh = true;

// Prevent refresh warning during active game
window.addEventListener('beforeunload', (e) => {
    const landingEl = $('screen-landing');
    const isLanding = landingEl && landingEl.classList.contains('active');
    if (!shouldPreventRefresh || isLanding) return;

    if (State.round > 0) {
        Analytics.logEvent('game_abandoned', { round: State.round });
        e.preventDefault();
        e.returnValue = '';
    }
});

// --- Game Controller Engine ---
const Game = {
    init: () => {
        Game.loadSession();
        if (State.players.length === 0) {
            State.players = [
                { id: 101, name: "", score: 0 },
                { id: 102, name: "", score: 0 },
                { id: 103, name: "", score: 0 }
            ];
        }
        AudioEngine.muted = !State.config.sound;
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
            if (State.config.voting === undefined) State.config.voting = true;
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
        window.scrollTo(0, 0);

        if (name === 'landing' || name === 'setup') {
            AudioEngine.playBGM('menu');
        } else if (name === 'reveal') {
            AudioEngine.playBGM('reveal');
        } else if (name === 'discuss') {
            AudioEngine.playBGM('investigation');
        } else if (name === 'voting' || name === 'voting-complete') {
            AudioEngine.playBGM('voting');
        } else if (name === 'results' || name === 'scoreboard') {
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

    showAllianceInfo: () => $('modal-alliance-info').classList.add('open'),
    closeAllianceInfo: () => $('modal-alliance-info').classList.remove('open'),

    toggleTimerSettings: () => {
        const enabled = $('setting-timer').checked;
        const sliderContainer = $('timer-slider-container');
        if (enabled) {
            sliderContainer.classList.remove('hidden');
        } else {
            sliderContainer.classList.add('hidden');
        }
    },

    updateTimerValue: (value) => {
        $('timer-value-display').innerText = `${value} min`;
        State.config.timerDuration = parseInt(value);
    },

    goToSetup: () => {
        Analytics.logEvent('start_game_clicked');
        Game.showScreen('setup');
        Game.renderSetupInputs();
        Game.renderRecentPlayerChips();
        Game.updateImposterUI();
        
        $('setting-imposter-word').checked = State.config.imposterHasWord;
        $('setting-voting').checked = State.config.voting;
        $('setting-shuffle').checked = State.config.shuffle;
        $('setting-secret-alliance').checked = State.config.secretAlliance;
        $('setting-timer').checked = State.config.timer;
        $('setting-sound').checked = State.config.sound;
        if (State.config.timer) $('timer-slider-container').classList.remove('hidden');
    },

    goHome: () => Game.showScreen('landing'),

    addPlayer: (name = "") => {
        if (State.players.length >= 30) {
            Game.showAlert("Maximum 30 players!", "Limit Reached");
            return;
        }
        State.players.push({ id: Date.now() + Math.floor(Math.random()*100), name: name, score: 0 });
        Game.saveSession();
        Game.renderSetupInputs(true);
        Game.updateImposterUI();
    },

    quickAddRecentPlayer: (name) => {
        if (!name) return;
        AudioEngine.play('click');
        
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
        Game.updateImposterUI();
    },

    clearSavedPlayersHistory: () => {
        AudioEngine.play('click');
        StorageManager.clearSavedPlayers();
        Game.renderRecentPlayerChips();
    },

    removePlayer: (index) => {
        if (State.players.length <= 3) return Game.showAlert("Minimum 3 players required!", "Warning");
        State.players.splice(index, 1);
        
        const maxImposters = Math.max(1, Math.floor(State.players.length / 3));
        if (State.config.imposterCount > maxImposters) {
            State.config.imposterCount = maxImposters;
        }

        Game.saveSession();
        Game.renderSetupInputs();
        Game.updateImposterUI();
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
            Game.renderRearrangeInputs();
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
        State.players.forEach(p => p.roundScore = 0);
        const pair = wordSelector.getRandomPair();
        
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
                wordEl.innerText = "IMPOSTER";
                wordEl.classList.add('text-danger');
            }

            if (State.config.secretAlliance && State.oddPlayerIds.length > 1) {
                const partnerIds = State.oddPlayerIds.filter(id => id !== playerId);
                const partnerNames = partnerIds.map(id => State.players.find(p => p.id === id).name);
                
                const allianceHint = document.createElement('div');
                allianceHint.className = 'alliance-card-hint';
                allianceHint.innerHTML = `🤝 <strong>Secret Alliance:</strong> ${partnerNames.join(', ')} ${partnerNames.length > 1 ? 'are also Imposters' : 'is also an Imposter'}`;
                cardBack.appendChild(allianceHint);
            }
        } else {
            labelEl.innerText = "Your secret word is:";
            wordEl.innerText = State.words.common;
            wordEl.classList.remove('text-danger');
        }
        
        const nextBtn = $('btn-next-player');
        nextBtn.classList.add('hidden');
        
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
            $('btn-next-player').classList.remove('hidden');
        }, 800);
    },

    nextReveal: () => {
        AudioEngine.play('click');
        $('btn-next-player').classList.add('hidden');
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
        Game.showScreen('discuss');
        const timerContainer = $('timer-container');
        const discussTimerSettings = $('discuss-timer-settings');
        
        const vBtn = $('btn-start-voting');
        if (vBtn) vBtn.innerText = !State.config.voting ? "Reveal Imposter" : "Start Voting";

        if (State.config.timer) {
            timerContainer.classList.remove('hidden');
            discussTimerSettings.classList.add('hidden');
            State.discussionTimeLeft = State.config.timerDuration * 60;
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
            timerDisplay.innerText = `${m}:${s}`;
            
            if (State.discussionTimeLeft > 0) {
                if (State.discussionTimeLeft <= 5) {
                    AudioEngine.play('tick');
                }
                State.discussionTimeLeft--;
                State.timerInterval = setTimeout(tick, 1000); 
            } else {
                AudioEngine.play('alarm');
                Game.showAlert("Investigation time is up! Start voting now.", "⌛ Time's Up");
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
        const list = $('forgot-word-player-list');
        list.innerHTML = "";
        
        State.players.forEach(p => {
            const item = document.createElement('div');
            item.className = "player-select-item";
            item.innerText = p.name;
            item.onclick = () => Game.askForgotConfirm(p.id);
            list.appendChild(item);
        });
        
        $('modal-forgot-word').classList.add('open');
    },

    closeForgotWord: () => $('modal-forgot-word').classList.remove('open'),

    askForgotConfirm: (playerId) => {
        State.pendingForgotPlayer = playerId;
        const player = State.players.find(p => p.id === playerId);
        $('confirm-forgot-name').innerText = player.name;
        $('modal-forgot-word').classList.remove('open');
        $('modal-confirm-forgot').classList.add('open');
    },

    cancelForgotConfirm: () => {
        $('modal-confirm-forgot').classList.remove('open');
        State.pendingForgotPlayer = null;
        $('modal-forgot-word').classList.add('open');
    },

    showForgotWordReveal: () => {
        const playerId = State.pendingForgotPlayer;
        const role = State.roles[playerId];
        const labelEl = $('forgot-word-label');
        const wordEl = $('forgot-word-display');
        const modalContent = document.querySelector('#modal-word-reveal .modal-content');
        
        const existingHint = modalContent.querySelector('.alliance-card-hint');
        if (existingHint) existingHint.remove();
        
        if (role === 'odd') {
            if (State.config.imposterHasWord) {
                wordEl.innerText = State.words.odd;
                labelEl.innerText = "Your word is:";
                wordEl.classList.remove('text-danger');
                wordEl.classList.add('text-primary');
            } else {
                labelEl.innerText = "You are the";
                wordEl.innerText = "IMPOSTER";
                wordEl.classList.add('text-danger');
                wordEl.classList.remove('text-primary');
            }

            if (State.config.secretAlliance && State.oddPlayerIds.length > 1) {
                const partnerIds = State.oddPlayerIds.filter(id => id !== playerId);
                const partnerNames = partnerIds.map(id => State.players.find(p => p.id === id).name);
                
                const allianceHint = document.createElement('div');
                allianceHint.className = 'alliance-card-hint';
                allianceHint.innerHTML = `🤝 <strong>Secret Alliance:</strong> ${partnerNames.join(', ')} ${partnerNames.length > 1 ? 'are also Imposters' : 'is also an Imposter'}`;
                modalContent.appendChild(allianceHint);
            }
        } else {
            labelEl.innerText = "Your word is:";
            wordEl.innerText = State.words.common;
            wordEl.classList.remove('text-danger');
            wordEl.classList.add('text-primary');
        }
        
        $('modal-word-reveal').classList.add('open');
        $('modal-confirm-forgot').classList.remove('open');
    },

    closeWordReveal: () => {
        $('modal-word-reveal').classList.remove('open');
        State.pendingForgotPlayer = null;
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
            const player = State.players.find(p => p.id === id);
            return player ? player.name : '';
        }).filter(Boolean);

        Game.triggerSuspenseReveal(imposterNames, 0, () => {
            Game.renderResults({}, "IMPOSTER REVEALED");
        });
    },

    showVotingScreen: () => {
        const voterId = State.playerOrder[State.stepIndex];
        const voter = State.players.find(p => p.id === voterId);
        State.selectedTargets = [];
        
        $('voter-name').innerText = voter.name;
        
        const list = $('voting-list');
        list.innerHTML = "";
        
        State.players.forEach(p => {
            if (p.id === voterId) return; 
            
            const btn = document.createElement('BUTTON');
            btn.className = "btn";
            btn.id = `vote-btn-${p.id}`;
            btn.innerText = p.name; 
            btn.onclick = () => Game.toggleVoteSelect(p.id);
            list.appendChild(btn);
        });

        const activeImposterCount = State.oddPlayerIds.length;

        const controls = document.createElement('div');
        controls.className = "content-area";
        controls.innerHTML = `
            <p class="text-muted" style="margin-top: 10px;">Select ${activeImposterCount} player${activeImposterCount > 1 ? 's' : ''}</p>
            <button id="btn-confirm-votes" class="btn btn-primary" style="opacity: 0.5; pointer-events: none;" onclick="Game.confirmMultiVotes()">Submit Votes</button>
        `;
        list.appendChild(controls);
        
        Game.showScreen('voting');
    },

    toggleVoteSelect: (targetId) => {
        AudioEngine.play('click');
        const idx = State.selectedTargets.indexOf(targetId);
        const max = State.oddPlayerIds.length;
        const btn = $(`vote-btn-${targetId}`);

        if (idx > -1) {
            State.selectedTargets.splice(idx, 1);
            btn.style.borderColor = "var(--text-muted)";
            btn.style.background = "var(--bg-card)";
        } else {
            if (State.selectedTargets.length >= max) {
                if (max === 1) {
                    const oldId = State.selectedTargets[0];
                    const oldBtn = $(`vote-btn-${oldId}`);
                    if (oldBtn) {
                        oldBtn.style.borderColor = "var(--text-muted)";
                        oldBtn.style.background = "var(--bg-card)";
                    }
                    State.selectedTargets = [targetId];
                    btn.style.borderColor = "var(--primary)";
                    btn.style.background = "rgba(107, 207, 45, 0.1)";
                } else {
                    return;
                }
            } else {
                State.selectedTargets.push(targetId);
                btn.style.borderColor = "var(--primary)";
                btn.style.background = "rgba(107, 207, 45, 0.1)";
            }
        }

        const confirmBtn = $('btn-confirm-votes');
        if (State.selectedTargets.length === max) {
            confirmBtn.style.opacity = "1";
            confirmBtn.style.pointerEvents = "auto";
        } else {
            confirmBtn.style.opacity = "0.5";
            confirmBtn.style.pointerEvents = "none";
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
            (caughtImposters.length > 1 ? "Imposters Caught!" : "Imposter Caught!") : 
            (isPerfectEscape ? "Perfect Escape!" : (oddIds.length > 1 ? "Imposters Escaped!" : "Imposter Escaped!"));
        
        State.players.forEach(p => p.score += p.roundScore);
        Game.saveSession();

        const imposterNames = oddIds.map(id => State.players.find(p => p.id === id).name);
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
                const player = State.players.find(p => p.id === id);
                return player ? player.name : '';
            }).filter(Boolean);

            Game.triggerSuspenseReveal(imposterNames, 0, () => {
                Game.renderResults({}, "IMPOSTER REVEALED");
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
        
        AudioEngine.play('suspense');

        let step = 1;
        const interval = setInterval(() => {
            step++;
            if (step === 2) dotsEl.innerText = "..";
            else if (step === 3) dotsEl.innerText = "...";
            else clearInterval(interval);
        }, 350);

        setTimeout(() => {
            nameBox.classList.add('reveal-active');
            AudioEngine.play('reveal');
        }, 1200);

        setTimeout(() => {
            overlay.classList.add('hidden');
            if (callback) callback();
        }, 2800);
    },

    renderResults: (voteCounts, roundStatus) => {
        AudioEngine.play('fanfare');
        
        const statusHeader = $('round-status-header');
        const cardEl = $('results-imposter-card');
        const displayStatus = (roundStatus || "ROUND COMPLETE").toUpperCase();

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
            const medal = idx === 0 ? "🥇" : (idx === 1 ? "🥈" : (idx === 2 ? "🥉" : ""));
            const icon = isImposter ? "🕵️" : (medal || "👤");
            
            const card = document.createElement('div');
            card.style.background = isImposter ? "rgba(217, 58, 58, 0.08)" : "var(--bg-card)";
            card.style.border = isImposter ? "1px solid rgba(217, 58, 58, 0.3)" : "1px solid rgba(255,255,255,0.06)";
            card.style.padding = "10px 14px";
            card.style.borderRadius = "12px";
            card.style.display = "flex";
            card.style.justifyContent = "space-between";
            card.style.alignItems = "center";

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap: 8px;">
                    <span style="font-size: 1.1rem;">${icon}</span>
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
        Game.showScreen('results');
    },

    goToScoreboard: () => {
        const area = $('scoreboard-list');
        area.innerHTML = "";
        
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
            if (State.round > 0 && State.oddPlayerIds && State.oddPlayerIds.length > 0) {
                btnBack.style.display = 'block';
            } else {
                btnBack.style.display = 'none';
            }
        }

        const sorted = [...State.players].sort((a,b) => b.score - a.score);

        sorted.forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = "list-item";
            if (idx === 0) item.style.borderColor = "var(--accent-gold)";
            
            const medalEmoji = idx === 0 ? "🥇" : (idx === 1 ? "🥈" : (idx === 2 ? "🥉" : `#${idx+1}`));

            item.innerHTML = `
                <div style="display:flex; align-items:center; flex: 1;">
                    <span style="font-weight:900; font-size:1.1rem; width:35px; text-align:center; margin-right:8px;">${medalEmoji}</span>
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
        Analytics.logEvent('game_completed', { total_rounds: State.round });
        
        const allPointsZero = State.players.every(p => (p.score || 0) === 0);

        if (allPointsZero || State.round === 0) {
            $('game-over-winner-name').innerText = "-";
            $('game-over-winner-score').innerText = "0 points";
            $('stat-dangerous-imposter-name').innerText = "-";
            $('stat-dangerous-imposter-sub').innerText = "-";
            $('stat-best-detective-name').innerText = "-";
            $('stat-best-detective-sub').innerText = "-";
            $('stat-most-suspected-name').innerText = "-";
            $('stat-most-suspected-sub').innerText = "-";
        } else {
            const sorted = [...State.players].sort((a,b) => b.score - a.score);
            const winner = sorted[0] || { name: 'Player', score: 0 };

            $('game-over-winner-name').innerText = winner.name;
            $('game-over-winner-score').innerText = `${winner.score} points`;

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

    openRearrangePlayers: () => {
        Game.renderRearrangeInputs();
        $('modal-rearrange-players').classList.add('open');
    },

    closeRearrangePlayers: () => {
        $('modal-rearrange-players').classList.remove('open');
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
        $(`mid-imposter-count-display`).innerText = State.config.imposterCount;
        $(`mid-setting-imposter-word`).checked = State.config.imposterHasWord;
        
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
        
        $('setting-shuffle').checked = State.config.shuffle;
        $('setting-timer').checked = State.config.timer;
        $('setting-voting').checked = State.config.voting;
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
            Game.showAlert(
                `You need at least ${neededPlayers} players to add another Imposter.`,
                "More Players Needed"
            );
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

    showAlert: (message, title = "Notice") => {
        $('alert-title').innerText = title;
        $('alert-message').innerText = message;
        $('modal-alert').classList.add('open');
    },

    closeAlert: () => $('modal-alert').classList.remove('open'),

    backToResults: () => Game.showScreen('results'),
    
    askEndGame: () => $('modal-end-game-confirm').classList.add('open'),
    cancelEndGame: () => $('modal-end-game-confirm').classList.remove('open'),

    confirmEndGame: () => {
        StorageManager.clearSession();
        shouldPreventRefresh = false;
        location.href = 'index.html';
    }
};
