/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// This file initializes Firebase using the v9 compatibility layer to maintain
// the v8 namespaced API syntax used throughout the application. This ensures
// that existing code continues to work without a full migration to the v9 modular API.

// FIX: Switched to Firebase v9 compat imports to fix type errors while preserving v8 syntax.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// These configuration values are injected by the build environment (e.g., Vercel).
// DO NOT hardcode secrets here. Set them in your Vercel project's Environment Variables.
// The `PUBLIC_` prefix is a convention to denote variables safe for client-side exposure.
const firebaseConfig = {
   apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
   authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
   projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
   storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
   messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
   appId: process.env.PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase App
if (!firebase.apps.length) {
    if (!firebaseConfig.apiKey) {
        console.error("Firebase configuration is missing. Make sure environment variables are set.");
    } else {
        firebase.initializeApp(firebaseConfig);
    }
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();