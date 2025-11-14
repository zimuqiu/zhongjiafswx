/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// This file initializes Firebase using the globally available `firebase` object
// provided by the official Firebase CDN scripts (UMD bundles). This approach
// avoids ES module resolution issues encountered with third-party CDNs like esm.sh
// and provides a more stable and reliable integration.

// Declare the global firebase object for TypeScript. This object is attached to
// the window scope by the scripts loaded in index.html.
declare const firebase: any;

// TODO: 用您应用的 Firebase 项目配置替换以下内容


// src/config/firebase.config.js
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};
// Initialize Firebase App.
// Check if the app is already initialized to prevent errors on hot-reloads.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get and export Firebase services from the global object.
export const auth = firebase.auth();
export const firestore = firebase.firestore();