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

// Firebase configuration is loaded from environment variables.
// Your build tool (like Vite, Create React App, etc.) should be configured
// to load variables from a `.env.local` file into `process.env`.
//
// IMPORTANT: Most modern build tools require a specific prefix for environment
// variables to be exposed to the client-side browser code for security reasons.
// For example:
// - Vite requires the prefix `VITE_` (e.g., VITE_FIREBASE_API_KEY)
// - Create React App requires the prefix `REACT_APP_` (e.g., REACT_APP_FIREBASE_API_KEY)
//
// Please ensure your `.env.local` file uses the correct variable names with the
// required prefix for your project's build setup.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();