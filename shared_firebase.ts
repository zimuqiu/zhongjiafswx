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
// NOTE: For production deployment on platforms like Vercel, it is highly
// recommended to use environment variables. This setup now relies *exclusively*
// on environment variables for both local development and production.
// Fallback dummy values have been added to prevent the app from crashing if
// environment variables are not set. The app will load but Firebase will not connect.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSy_DUMMY_API_KEY_FOR_INITIALIZATION",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy-project.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy-project.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:dummydummydummy"
};

// Initialize Firebase App
if (!firebase.apps.length) {
    if (!process.env.VITE_FIREBASE_API_KEY || !process.env.VITE_FIREBASE_PROJECT_ID) {
        console.warn(
            "Firebase configuration not found in environment variables. " +
            "Using dummy values for initialization. The app will load, but Firebase services will be unavailable. " +
            "If you are a developer, please set up your environment variables (e.g., in a .env.local file)."
        );
    }

    try {
        firebase.initializeApp(firebaseConfig);
    } catch (error) {
        console.error("Fatal Error: Firebase initialization failed.", error);
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background-color: #f3f4f6;">
                    <div style="text-align: center; padding: 2rem; border-radius: 0.5rem; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h1 style="color: #dc2626; font-size: 1.5rem; margin-bottom: 1rem;">应用配置错误</h1>
                        <p style="color: #4b5563;">Firebase 初始化失败。</p>
                        <p style="color: #4b5563; margin-top: 0.5rem;">这可能是由于配置信息格式错误造成的。请检查控制台获取详细信息。</p>
                    </div>
                </div>
            `;
        }
    }
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();
