/**
 * ODDINARY STORAGE MANAGER
 * Handles sessionStorage for active games & localStorage for saved player profiles
 */

const SESSION_KEY = 'oddinary_session_v2';
const SAVED_PLAYERS_KEY = 'oddinary_saved_players_v1';

const StorageManager = {
 /**
 * Save active game session to sessionStorage
 */
 saveSession: function(data) {
 try {
 sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
 } catch (e) {
 console.error('[StorageManager] Error saving session:', e);
 }
 },

 /**
 * Load active game session from sessionStorage
 */
  loadSession: function() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.players)) {
        return parsed;
      }
      return null;
    } catch (e) {
      console.error('[StorageManager] Error loading session:', e);
      return null;
    }
  },

 /**
 * Clear active session data
 */
 clearSession: function() {
 try {
 sessionStorage.removeItem(SESSION_KEY);
 } catch (e) {
 console.error('[StorageManager] Error clearing session:', e);
 }
 },

 /**
 * Get saved player names from localStorage
 */
 getSavedPlayers: function() {
 try {
 const raw = localStorage.getItem(SAVED_PLAYERS_KEY);
 if (!raw) return [];
 const players = JSON.parse(raw);
 return Array.isArray(players) ? players : [];
 } catch (e) {
 console.error('[StorageManager] Error reading saved players:', e);
 return [];
 }
 },

 /**
 * Save a single player name or array of player names to localStorage history
 */
 savePlayerNames: function(names) {
 try {
 const current = this.getSavedPlayers();
 const namesArray = Array.isArray(names) ? names : [names];
 
 namesArray.forEach(name => {
 const clean = (name || '').trim();
 if (!clean) return;
 // Remove existing duplicate case-insensitively
 const existingIdx = current.findIndex(n => n.toLowerCase() === clean.toLowerCase());
 if (existingIdx !== -1) {
 current.splice(existingIdx, 1);
 }
 // Prepend to top of list
 current.unshift(clean);
 });

 // Keep max 20 saved players
 const trimmed = current.slice(0, 20);
 localStorage.setItem(SAVED_PLAYERS_KEY, JSON.stringify(trimmed));
 } catch (e) {
 console.error('[StorageManager] Error saving player names:', e);
 }
 },

 /**
 * Clear all saved players from localStorage
 */
 clearSavedPlayers: function() {
 try {
 localStorage.removeItem(SAVED_PLAYERS_KEY);
 } catch (e) {
 console.error('[StorageManager] Error clearing saved players:', e);
 }
 }
};
