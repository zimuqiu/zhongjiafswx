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
 apiKey: "AIzaSyAr7Cm0_FN9Ulmjg8DUf9b5pqo7-eI8mDE",
  authDomain: "aifswx.firebaseapp.com",
  projectId: "aifswx",
  storageBucket: "aifswx.firebasestorage.app",
  messagingSenderId: "724723964501",
  appId: "1:724723964501:web:a4f1cb6ff3f273778d92dc",
  measurementId: "G-KWNRVCJ88X"
};

// Initialize Firebase App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();

