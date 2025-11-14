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
apiKey: "AIzaSyAr7Cm0_FN9Ulmjg8DUf9b5pqo7-eI8mDE",
  authDomain: "aifswx.firebaseapp.com",
  projectId: "aifswx",
  storageBucket: "aifswx.firebasestorage.app",
  messagingSenderId: "724723964501",
  appId: "1:724723964501:web:a4f1cb6ff3f273778d92dc"
};

// Initialize Firebase App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();