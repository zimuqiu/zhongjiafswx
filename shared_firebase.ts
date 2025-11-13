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

// TODO: 用您应用的 Firebase 项目配置替换以下内容
// 参见: https://firebase.google.com/docs/web/setup#available-libraries
// SECURE: Replaced hardcoded keys with environment variables for Vercel deployment.
// You must set these variables in your Vercel project settings.
const firebaseConfig = {
   apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();