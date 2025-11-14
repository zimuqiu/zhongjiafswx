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

// Your Firebase project configuration should now be set in your deployment environment's
// environment variables (e.g., in Vercel). This prevents exposing sensitive keys
// directly in the source code.
// Use `import.meta.env` for client-side variables, prefixed with `VITE_`.
// FIX: Cast `import.meta` to `any` to resolve TypeScript errors. This is a workaround
// for a missing Vite client type definition in the project's TS config.
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();