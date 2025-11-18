/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- FORMAL CHECK HISTORY DATABASE ---
// This database stores the history of formal quality checks performed by the user.
// It uses localStorage for simple client-side persistence.

export const formalCheckHistoryDb = {
    /**
     * Retrieves the history of formal checks from localStorage.
     * @returns {Array} An array of history entries, or an empty array if none exists or an error occurs.
     */
    getHistory: () => {
        try {
            const history = localStorage.getItem('formal_check_history');
            return history ? JSON.parse(history) : [];
        } catch (e) {
            console.error("Failed to parse formal check history:", e);
            return [];
        }
    },

    /**
     * Adds a new entry to the formal check history.
     * The history is capped at 50 entries.
     * @param {object} entry - The history entry object to add.
     */
    addHistoryEntry: (entry) => {
        const history = formalCheckHistoryDb.getHistory();
        history.unshift(entry); // Add to the beginning to show newest first
        if (history.length > 50) {
            history.pop(); // Limit history size
        }
        try {
            localStorage.setItem('formal_check_history', JSON.stringify(history));
        } catch (e) {
            console.error("Failed to save formal check history:", e);
        }
    }
};

// --- SUBSTANTIVE CHECK HISTORY DATABASE ---
// This database stores the history of substantive quality checks performed by the user.
export const substantiveCheckHistoryDb = {
    /**
     * Retrieves the history of substantive checks from localStorage.
     * @returns {Array} An array of history entries, or an empty array if none exists or an error occurs.
     */
    getHistory: () => {
        try {
            const history = localStorage.getItem('substantive_check_history');
            return history ? JSON.parse(history) : [];
        } catch (e) {
            console.error("Failed to parse substantive check history:", e);
            return [];
        }
    },

    /**
     * Adds a new entry to the substantive check history.
     * The history is capped at 50 entries.
     * @param {object} entry - The history entry object to add.
     */
    addHistoryEntry: (entry) => {
        const history = substantiveCheckHistoryDb.getHistory();
        history.unshift(entry); // Add to the beginning to show newest first
        if (history.length > 50) {
            history.pop(); // Limit history size
        }
        try {
            localStorage.setItem('substantive_check_history', JSON.stringify(history));
        } catch (e) {
            console.error("Failed to save substantive check history:", e);
        }
    }
};