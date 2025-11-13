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
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
        firebase.initializeApp(firebaseConfig);
    } else {
        console.error("Firebase configuration is missing. Make sure you have set up your environment variables (e.g., in a .env.local file for local development).");
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background-color: #f3f4f6;">
                    <div style="text-align: center; padding: 2rem; border-radius: 0.5rem; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h1 style="color: #dc2626; font-size: 1.5rem; margin-bottom: 1rem;">应用配置错误</h1>
                        <p style="color: #4b5563;">Firebase 配置信息缺失。</p>
                        <p style="color: #4b5563; margin-top: 0.5rem;">如果您是开发者，请确保已在 <code>.env.local</code> 文件中正确设置了环境变量。</p>
                        <p style="margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">(Please check the console for more details)</p>
                    </div>
                </div>
            `;
        }
    }
}

// Get and export Firebase services
export const auth = firebase.auth();
export const firestore = firebase.firestore();