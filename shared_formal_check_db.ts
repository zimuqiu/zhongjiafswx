
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- TYPE DEFINITIONS for HISTORY ---

// Defines the structure of an issue found during a formal quality check.
interface FormalCheckIssue {
    issue: string;
    suggestion: string;
}

// Defines the structure of a category's result in a formal quality check.
interface FormalCheckCategoryResult {
    category: string;
    issues: FormalCheckIssue[];
    charCount?: number;
}

// Defines the structure for a single entry in the formal check history.
export interface FormalCheckHistoryEntry {
    id: number;
    date: string;
    fileName: string;
    checkResult: FormalCheckCategoryResult[];
    totalCost: number;
}

// Defines the structure of an issue found during a substantive quality check.
interface SubstantiveCheckIssue {
  issueCategory: string;
  reasoning: string;
  suggestion: string;
}

// Defines the structure of the overall result from a substantive quality check.
export interface SubstantiveCheckResult {
  issues: SubstantiveCheckIssue[];
}

// Defines the structure for a single entry in the substantive check history.
export interface SubstantiveCheckHistoryEntry {
  id: number;
  date: string;
  fileName: string;
  checkResult: SubstantiveCheckResult | null;
  totalCost: number;
}

// Defines a single match item found during priority review scanning.
export interface PriorityReviewMatchItem {
    classification: string;
    table: string;
    domain: string;
}

// Defines the result structure for Priority Review.
export interface PriorityReviewResultDB {
    allClassifications: string[]; // All extracted classification numbers from the app file
    allMatches: PriorityReviewMatchItem[]; // New: All potential matches found in the tables (Candidate Pool)
    
    // The "Best Match" selected by AI for keyword extraction
    matchedClassification: string; 
    matchedTable: string;
    matchedDomain: string;
    matchedKeywords: string[];
    
    reasoning: string; // Explanation of the logic
}

// Defines the structure for a single entry in the priority review history.
export interface PriorityReviewHistoryEntry {
    id: number;
    date: string;
    applicationFileName: string;
    tableFileNames: string[];
    checkResult: PriorityReviewResultDB | null;
    totalCost: number;
}


// --- FORMAL CHECK HISTORY DATABASE ---
// This database stores the history of formal quality checks performed by the user.
// It uses localStorage for simple client-side persistence.

export const formalCheckHistoryDb = {
    /**
     * Retrieves the history of formal checks from localStorage.
     * Guarantees a strongly-typed array is returned.
     * @returns {FormalCheckHistoryEntry[]} An array of history entries, or an empty array if none exists or data is corrupt.
     */
    getHistory: (): FormalCheckHistoryEntry[] => {
        const key = 'formal_check_history';
        try {
            const historyJSON = localStorage.getItem(key);
            if (!historyJSON) return [];
            
            const history = JSON.parse(historyJSON);
            if (!Array.isArray(history)) {
                console.warn("Corrupted formal check history found. Clearing it.");
                localStorage.removeItem(key);
                return [];
            }
            return history as FormalCheckHistoryEntry[];
        } catch (e) {
            console.error("Failed to parse formal check history, clearing it:", e);
            localStorage.removeItem(key);
            return [];
        }
    },

    /**
     * Adds a new entry to the formal check history.
     * The history is capped at 50 entries.
     * @param {FormalCheckHistoryEntry} entry - The history entry object to add.
     */
    addHistoryEntry: (entry: FormalCheckHistoryEntry) => {
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
     * Guarantees a strongly-typed array is returned.
     * @returns {SubstantiveCheckHistoryEntry[]} An array of history entries, or an empty array if none exists or data is corrupt.
     */
    getHistory: (): SubstantiveCheckHistoryEntry[] => {
        const key = 'substantive_check_history';
        try {
            const historyJSON = localStorage.getItem(key);
            if (!historyJSON) return [];

            const history = JSON.parse(historyJSON);
            if (!Array.isArray(history)) {
                console.warn("Corrupted substantive check history found. Clearing it.");
                localStorage.removeItem(key);
                return [];
            }
            return history as SubstantiveCheckHistoryEntry[];
        } catch (e) {
            console.error("Failed to parse substantive check history, clearing it:", e);
            localStorage.removeItem(key);
            return [];
        }
    },

    /**
     * Adds a new entry to the substantive check history.
     * The history is capped at 50 entries.
     * @param {SubstantiveCheckHistoryEntry} entry - The history entry object to add.
     */
    addHistoryEntry: (entry: SubstantiveCheckHistoryEntry) => {
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

// --- PRIORITY REVIEW HISTORY DATABASE ---
export const priorityReviewHistoryDb = {
    /**
     * Retrieves the history from localStorage.
     */
    getHistory: (): PriorityReviewHistoryEntry[] => {
        const key = 'priority_review_history';
        try {
            const historyJSON = localStorage.getItem(key);
            if (!historyJSON) return [];

            const history = JSON.parse(historyJSON);
            if (!Array.isArray(history)) {
                console.warn("Corrupted priority review history found. Clearing it.");
                localStorage.removeItem(key);
                return [];
            }
            return history as PriorityReviewHistoryEntry[];
        } catch (e) {
            console.error("Failed to parse priority review history, clearing it:", e);
            localStorage.removeItem(key);
            return [];
        }
    },

    /**
     * Adds a new entry to the history.
     */
    addHistoryEntry: (entry: PriorityReviewHistoryEntry) => {
        const history = priorityReviewHistoryDb.getHistory();
        history.unshift(entry);
        if (history.length > 50) {
            history.pop();
        }
        try {
            localStorage.setItem('priority_review_history', JSON.stringify(history));
        } catch (e) {
            console.error("Failed to save priority review history:", e);
        }
    }
};
