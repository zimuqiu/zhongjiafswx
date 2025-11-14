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
// 参见: https://firebase.google.com/docs/web/setup#available-libraries
const firebaseConfig = {
   apiKey: "AIzaSyAr7Cm0_FN9Ulmjg8DUf9b5pqo7-eI8mDE",
  authDomain: "aifswx.firebaseapp.com",
  projectId: "aifswx",
  storageBucket: "aifswx.firebasestorage.app",
  messagingSenderId: "724723964501",
  appId: "1:724723964501:web:a4f1cb6ff3f273778d92dc"
};

// Initialize Firebase App.
// Check if the app is already initialized to prevent errors on hot-reloads.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get and export Firebase services from the global object.
export const auth = firebase.auth();
export const firestore = firebase.firestore();