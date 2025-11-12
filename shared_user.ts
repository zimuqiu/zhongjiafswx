/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- CURRENT USER STATE MANAGEMENT ---

// This module holds the global state for the currently logged-in user's profile.
// The profile is fetched from Firestore upon successful authentication.

let currentUserProfile: any | null = null;

/**
 * Sets the current user's profile data. Called from the main app logic
 * when authentication state changes.
 * @param profile The user's profile object from Firestore, or null if logged out.
 */
export const setCurrentUserProfile = (profile: any | null) => {
    currentUserProfile = profile;
};

/**
 * Gets the current user's profile data.
 * @returns The user's profile object or null.
 */
export const getCurrentUserProfile = () => {
    return currentUserProfile;
};
