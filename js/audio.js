/**
 * ODDINARY WEB AUDIO API SYNTHESIZER & HAPTICS ENGINE
 * Pure synthesized sound effects & tactile mobile haptic feedback - zero external audio assets required!
 */

const Haptics = {
 vibrate: function(pattern) {
 if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
 try {
 navigator.vibrate(pattern);
 } catch(e) {
 // Ignore silent vibration failures on non-supported platforms
 }
 }
 },
 light: function() { this.vibrate(15); },
 medium: function() { this.vibrate(35); },
 heavy: function() { this.vibrate([50, 40, 50]); },
 reveal: function() { this.vibrate([40, 50, 60]); }
};

const AudioEngine = {
 ctx: null,
 muted: false,
 lastPlayTime: 0,
 currentBGMStage: null,
 bgmElements: {},

 init: function() {
 if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
 const AudioCtx = window.AudioContext || window.webkitAudioContext;
 this.ctx = new AudioCtx();
 }
 },

 stopBGM: function() {
 Object.keys(this.bgmElements).forEach(k => {
 if (this.bgmElements[k]) {
 this.bgmElements[k].pause();
 this.bgmElements[k].currentTime = 0;
 }
 });
 this.currentBGMStage = null;
 },

 playBGM: function(stage) {
 // Standby for custom BGM audio streams
 this.stopBGM();
 },

 play: function(type) {
 if (this.muted) return;
 const nowMs = Date.now();
 if (type === 'click' && nowMs - this.lastPlayTime < 40) return;
 if (type === 'click') this.lastPlayTime = nowMs;

 try {
 if (!this.ctx) this.init();
 if (this.ctx && this.ctx.state === 'suspended') {
 this.ctx.resume();
 }
 const now = this.ctx.currentTime;

 if (type === 'click') {
 Haptics.light();
 const osc = this.ctx.createOscillator();
 const gain = this.ctx.createGain();
 osc.type = 'sine';
 osc.frequency.setValueAtTime(600, now);
 osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
 gain.gain.setValueAtTime(0.2, now);
 gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
 osc.connect(gain);
 gain.connect(this.ctx.destination);
 osc.start(now);
 osc.stop(now + 0.05);
 } else if (type === 'flip') {
 Haptics.medium();
 const osc = this.ctx.createOscillator();
 const gain = this.ctx.createGain();
 osc.type = 'triangle';
 osc.frequency.setValueAtTime(300, now);
 osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
 gain.gain.setValueAtTime(0.15, now);
 gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
 osc.connect(gain);
 gain.connect(this.ctx.destination);
 osc.start(now);
 osc.stop(now + 0.15);
 } else if (type === 'tick') {
 Haptics.light();
 const osc = this.ctx.createOscillator();
 const gain = this.ctx.createGain();
 osc.type = 'square';
 osc.frequency.setValueAtTime(800, now);
 gain.gain.setValueAtTime(0.08, now);
 gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
 osc.connect(gain);
 gain.connect(this.ctx.destination);
 osc.start(now);
 osc.stop(now + 0.03);
 } else if (type === 'alarm') {
 Haptics.heavy();
 [0, 0.12].forEach(delay => {
 const osc = this.ctx.createOscillator();
 const gain = this.ctx.createGain();
 osc.type = 'sine';
 osc.frequency.setValueAtTime(880, now + delay);
 gain.gain.setValueAtTime(0.2, now + delay);
 gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.1);
 osc.connect(gain);
 gain.connect(this.ctx.destination);
 osc.start(now + delay);
 osc.stop(now + delay + 0.1);
 });
 } else if (type === 'suspense') {
 // Soft, warm sine-wave chord swell (C4 & G4)
 [261.63, 392.00].forEach(freq => {
 const osc = this.ctx.createOscillator();
 const gain = this.ctx.createGain();
 osc.type = 'sine';
 osc.frequency.setValueAtTime(freq, now);
 gain.gain.setValueAtTime(0.01, now);
 gain.gain.linearRampToValueAtTime(0.08, now + 0.8);
 gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
 osc.connect(gain);
 gain.connect(this.ctx.destination);
 osc.start(now);
 osc.stop(now + 1.2);
 });
 } else if (type === 'reveal') {
 Haptics.reveal();
 // Crisp, melodic 3-note bell chime (C5 -> E5 -> G5)
 [523.25, 659.25, 783.99].forEach((freq, idx) => {
 const osc = this.ctx.createOscillator();
 const gain = this.ctx.createGain();
 osc.type = 'sine';
 osc.frequency.setValueAtTime(freq, now + idx * 0.07);
 gain.gain.setValueAtTime(0.18, now + idx * 0.07);
 gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
 osc.connect(gain);
 gain.connect(this.ctx.destination);
 osc.start(now + idx * 0.07);
 osc.stop(now + idx * 0.07 + 0.35);
 });
 } else if (type === 'fanfare') {
 Haptics.heavy();
 const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
 notes.forEach((freq, idx) => {
 const osc = this.ctx.createOscillator();
 const gain = this.ctx.createGain();
 osc.type = 'triangle';
 osc.frequency.setValueAtTime(freq, now + idx * 0.08);
 gain.gain.setValueAtTime(0.2, now + idx * 0.08);
 gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.3);
 osc.connect(gain);
 gain.connect(this.ctx.destination);
 osc.start(now + idx * 0.08);
 osc.stop(now + idx * 0.08 + 0.3);
 });
 }
 } catch(e) {
 console.error('[AudioEngine] Playback error:', e);
 }
 }
};
