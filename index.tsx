/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import saveAs from 'file-saver';
import { auth, firestore } from './shared_firebase.ts';
// FIX: Removed Firebase v9 modular imports. Switched to v8 namespaced API calls below.
import { setCurrentUserProfile, getCurrentUserProfile } from './shared_user.ts';
import { applyTheme, toggleTheme, updateThemeToggleUI } from './shared_theme.ts';
import { showToast } from './shared_ui.ts';
import { renderLoginView, renderRegisterView, renderForgotPasswordView } from './view_auth.ts';
import { renderDashboard } from './view_dashboard.ts';
import { renderUserManagementView, handleUserPermissionsFormSubmit, handleUserSearch, attachUserManagementListener } from './view_user_management.ts';
import { renderOaReplyPage } from './feature_oa_reply.ts';
import { renderFormalQualityCheckPage, resetFormalCheckState } from './feature_formal_quality_check.ts';
import { renderSubstantiveQualityCheckPage } from './feature_substantive_quality_check.ts';
import { renderPriorityReviewMaterialsPage } from './feature_priority_review_materials.ts';
// Username settings view is no longer used.

// --- APP STATE & ROUTER ---
const appContainer = document.getElementById('app')!;
let unsubscribeUserListener: (() => void) | null = null;
let isProcessingAuthAction = false; // Flag to prevent navigation race conditions

const navigateTo = async (view) => {
    // Detach any active real-time listeners from the previous view
    if (unsubscribeUserListener) {
        unsubscribeUserListener();
        unsubscribeUserListener = null;
    }

    appContainer.innerHTML = ''; // Clear previous view
    window.location.hash = view;

    const currentUser = getCurrentUserProfile();
    const hasPermission = (featureId) => {
        if (!currentUser) return false;
        return currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.includes(featureId));
    };

    switch(view) {
        case 'login':
            if (currentUser) { navigateTo('dashboard'); return; }
            renderLoginView(appContainer);
            break;
        case 'register':
            if (currentUser) { navigateTo('dashboard'); return; }
            renderRegisterView(appContainer);
            break;
        case 'forgot-password':
            if (currentUser) { navigateTo('dashboard'); return; }
            renderForgotPasswordView(appContainer);
            break;
        case 'dashboard':
            if (!currentUser) { navigateTo('login'); return; }
            renderDashboard(appContainer);
            break;
        case 'oa-reply':
            if (!currentUser) { navigateTo('login'); return; }
            if (!hasPermission(view)) { showToast('权限不足，无法访问该页面。'); navigateTo('dashboard'); return; }
            renderOaReplyPage(appContainer);
            break;
        case 'formal-quality-check':
             if (!currentUser) { navigateTo('login'); return; }
             if (!hasPermission(view)) { showToast('权限不足，无法访问该页面。'); navigateTo('dashboard'); return; }
            renderFormalQualityCheckPage(appContainer);
            break;
        case 'substantive-quality-check':
            if (!currentUser) { navigateTo('login'); return; }
            if (!hasPermission(view)) { showToast('权限不足，无法访问该页面。'); navigateTo('dashboard'); return; }
            renderSubstantiveQualityCheckPage(appContainer);
            break;
        case 'priority-review-materials':
             if (!currentUser) { navigateTo('login'); return; }
             if (!hasPermission(view)) { showToast('权限不足，无法访问该页面。'); navigateTo('dashboard'); return; }
            renderPriorityReviewMaterialsPage(appContainer);
            break;
        case 'user-management':
             if (!currentUser) { navigateTo('login'); return; }
             if (currentUser?.role !== 'admin') { showToast('只有管理员可以访问用户管理页面。'); navigateTo('dashboard'); return; }
             renderUserManagementView(appContainer);
             unsubscribeUserListener = attachUserManagementListener();
             break;
        // Username settings case removed
        default:
            navigateTo(currentUser ? 'dashboard' : 'login');
    }
    attachGlobalEventListeners();
};


// --- HELPERS ---
const loadAndSetUserProfile = async (user) => {
    const userDoc = await firestore.collection("users").doc(user.uid).get();
    if (userDoc.exists) {
        const profileData: any = { uid: user.uid, ...userDoc.data() };
        setCurrentUserProfile(profileData);
        return true; // Indicates success
    } else {
        // This case might happen if a user is created in Auth but not in Firestore.
        await auth.signOut();
        setCurrentUserProfile(null);
        showToast('用户资料不存在，请重新登录或注册。');
        return false; // Indicates failure
    }
};

// --- EVENT HANDLERS ---
const handleAuthFormSubmit = async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const view = window.location.hash.substring(1);
    const getInputElement = (name) => form.elements.namedItem(name) as HTMLInputElement;

    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (!submitButton) return;
    
    const originalButtonHTML = submitButton.innerHTML;
    const showSpinner = () => {
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <div class="inline-block h-5 w-5 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span class="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">正在处理...</span>
            </div>
        `;
    };
    const hideSpinner = () => {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    };
    
    showSpinner();
    isProcessingAuthAction = true;

    try {
        switch (view) {
            case 'login': {
                const email = getInputElement('email').value;
                const password = getInputElement('password').value.trim();
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                if (userCredential.user) {
                   const profileLoaded = await loadAndSetUserProfile(userCredential.user);
                   if (profileLoaded) {
                       navigateTo('dashboard');
                       // On successful navigation, the button is destroyed, so we don't call hideSpinner.
                   } else {
                       // Error was shown by loadAndSetUserProfile
                       hideSpinner();
                   }
                } else {
                     throw new Error('登录失败，请重试。');
                }
                break;
            }
            case 'register': {
                const email = getInputElement('email').value;
                const username = getInputElement('username').value.trim();
                const password = getInputElement('password').value.trim();
                const confirmPassword = getInputElement('confirm-password').value.trim();

                if (password !== confirmPassword) {
                    throw new Error('两次输入的密码不匹配。');
                }
                 if (!username) {
                    throw new Error('用户名不能为空。');
                }

                let tempUser = null;
                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    tempUser = userCredential.user;

                    if (!tempUser) throw new Error('用户创建失败，请重试。');

                    const usernameQuery = await firestore.collection("users").where("username", "==", username).get();
                    if (!usernameQuery.empty) {
                        throw new Error('该用户名已被使用，请选择其他用户名。');
                    }
                    
                    const profileData = {
                        email: tempUser.email,
                        username: username,
                        role: 'user',
                        permissions: []
                    };
                    await firestore.collection("users").doc(tempUser.uid).set(profileData);
                    await auth.signOut();
                    showToast('注册成功！请登录。');
                    navigateTo('login');
                } catch(regError) {
                    if (tempUser) {
                        await tempUser.delete().catch(delErr => console.error("Failed to clean up temporary user:", delErr));
                    }
                    throw regError;
                }
                break;
            }
            case 'forgot-password': {
                const email = getInputElement('email').value;
                await auth.sendPasswordResetEmail(email);
                showToast('密码重置邮件已发送，请检查您的邮箱。');
                hideSpinner();
                break;
            }
        }
    } catch (error) {
        showToast(`操作失败: ${(error as Error).message}`);
        hideSpinner();
    } finally {
        setTimeout(() => { isProcessingAuthAction = false; }, 200);
    }
};


const handleAppContainerClick = (e: Event) => {
    const target = e.target as HTMLElement;

    // Handle all navigation links with data-view attribute
    const navLink = target.closest('a[data-view], div[data-view], button[data-view]');
    if (navLink) {
        e.preventDefault();
        const view = navLink.getAttribute('data-view');
        if (view) navigateTo(view);
        return;
    }

    // Handle password visibility toggle
    const passwordToggle = target.closest('.password-toggle');
    if (passwordToggle) {
        const passwordInput = passwordToggle.previousElementSibling as HTMLInputElement;
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            passwordToggle.textContent = 'visibility';
        } else {
            passwordInput.type = 'password';
            passwordToggle.textContent = 'visibility_off';
        }
        return;
    }

    // Handle User Management form submissions
    const permissionsForm = target.closest('.user-permissions-form');
    if (permissionsForm && e.type === 'submit') {
        e.preventDefault();
        handleUserPermissionsFormSubmit(permissionsForm as HTMLFormElement);
        return;
    }
    
};

const attachGlobalEventListeners = () => {
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.removeEventListener('submit', handleAuthFormSubmit);
        authForm.addEventListener('submit', handleAuthFormSubmit);
    }
    
    // Use event delegation for all other clicks in the app container
    appContainer.removeEventListener('click', handleAppContainerClick);
    appContainer.addEventListener('click', handleAppContainerClick);
    appContainer.removeEventListener('submit', handleAppContainerClick);
    appContainer.addEventListener('submit', handleAppContainerClick);

    const backToDashboardBtn = document.getElementById('back-to-dashboard');
    if (backToDashboardBtn) backToDashboardBtn.addEventListener('click', () => navigateTo('dashboard'));

    const settingsBtn = document.getElementById('settings-btn');
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!settingsBtn.contains(e.target as Node) && !settingsDropdown.contains(e.target as Node)) {
                settingsDropdown.classList.add('hidden');
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            isProcessingAuthAction = true;
            await auth.signOut();
            setCurrentUserProfile(null); // Clear user profile
            navigateTo('login');
            setTimeout(() => { isProcessingAuthAction = false; }, 100);
        });
    }

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if(themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    
    // This is the fix: ensure the theme button's UI is updated on every navigation
    updateThemeToggleUI();

    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleUserSearch);
    }
};


// --- APP INITIALIZATION ---
const initApp = () => {
    applyTheme(localStorage.getItem('theme') || 'light');
    
    auth.onAuthStateChanged(async (user) => {
        if (isProcessingAuthAction) {
            return; // Suppress navigation while a manual auth action is in progress
        }
        
        if (user) {
            try {
                await loadAndSetUserProfile(user);
            } catch (error) {
                console.error("Error fetching user profile during initial load:", error);
                await auth.signOut();
                setCurrentUserProfile(null);
                showToast('加载用户资料失败，请重试。');
            }
        } else {
            setCurrentUserProfile(null);
        }

        // Determine initial view after auth state is confirmed
        const currentHash = window.location.hash.substring(1);
        const validViews = ['dashboard', 'oa-reply', 'formal-quality-check', 'substantive-quality-check', 'priority-review-materials', 'user-management'];
        
        if (getCurrentUserProfile()) {
            // If user is logged in, navigate to dashboard or the intended page
            navigateTo(validViews.includes(currentHash) ? currentHash : 'dashboard');
        } else {
            // If user is not logged in, navigate to login or a public page
            const publicViews = ['login', 'register', 'forgot-password'];
            navigateTo(publicViews.includes(currentHash) ? currentHash : 'login');
        }
    });
};

initApp();