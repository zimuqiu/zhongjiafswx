/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { getCurrentUserProfile } from './shared_user.ts';

// --- UI COMPONENTS ---
let currentToast: HTMLElement | null = null;
export const showToast = (message, duration = 3000) => {
    if (currentToast) {
        currentToast.remove();
    }
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 translate-y-20 bg-gray-700 text-white py-3 px-6 rounded-full text-sm z-50 opacity-0 transition-all duration-300';
    toast.textContent = message;
    document.getElementById('app')?.appendChild(toast);
    currentToast = toast;

    setTimeout(() => {
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
            if (currentToast === toast) currentToast = null;
        }, 500);
    }, duration);
};

// FIX: Removed promptForApiKey function as per coding guidelines. API key must come from process.env.API_KEY.


export const renderSettingsDropdown = () => {
    const currentUser = getCurrentUserProfile();
    const isAuthenticated = !!currentUser;
    const isAdmin = currentUser?.role === 'admin';
    return `
    <div class="relative">
        <button id="settings-btn" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="设置">
            <span class="material-symbols-outlined">settings</span>
        </button>
        <div id="settings-dropdown" class="hidden absolute right-0 top-full mt-2 bg-white dark:bg-gray-700 rounded-lg shadow-lg overflow-hidden w-48 z-10 border border-gray-200 dark:border-gray-600">
            <button id="theme-toggle-btn" class="w-full text-left p-3 text-gray-700 dark:text-gray-200 text-sm hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 flex items-center justify-between">
                <span id="theme-toggle-text"></span>
                <span id="theme-toggle-icon" class="material-symbols-outlined"></span>
            </button>
            ${(isAuthenticated && isAdmin) ? `<a href="#" data-view="user-management" class="block w-full text-left p-3 text-gray-700 dark:text-gray-200 text-sm hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 flex items-center justify-between"><span>用户管理</span><span class="material-symbols-outlined">manage_accounts</span></a>` : ''}
            ${isAuthenticated ? `<a href="#" id="logout-btn" class="block w-full text-left p-3 text-gray-700 dark:text-gray-200 text-sm hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600">退出登录</a>` : ''}
        </div>
    </div>
`;
};

export const createAuthForm = (title, fields, actions, links, extraContentInsideForm = '', extraContentOutsideForm = '') => `
    <div class="relative w-full h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
        <div class="absolute top-5 right-5 z-20">
            ${renderSettingsDropdown()}
        </div>
        <div class="flex justify-center items-center w-full h-full p-5">
            <div class="bg-white dark:bg-gray-800 p-10 rounded-lg shadow-2xl w-full max-w-md">
                <h1 class="text-center mb-8 text-3xl font-bold">${title}</h1>
                <form id="auth-form" class="flex flex-col gap-5">
                    ${fields.map(field => `
                        <div class="flex flex-col">
                            <label for="${field.id}" class="mb-2 text-sm text-gray-500 dark:text-gray-400">${field.label}</label>
                            <div class="relative flex items-center">
                                <input type="${field.type}" id="${field.id}" name="${field.name}" value="${field.value || ''}" required class="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-gray-200 w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
                                ${field.type === 'password' ? '<span class="material-symbols-outlined absolute right-3 cursor-pointer text-gray-500 dark:text-gray-400 password-toggle" aria-label="切换密码可见性" role="button">visibility_off</span>' : ''}
                            </div>
                        </div>
                    `).join('')}
                    ${extraContentInsideForm}
                    ${actions.map(action => `<button type="${action.type}" class="bg-blue-600 text-white border-none p-4 rounded-lg text-lg font-bold cursor-pointer transition-colors hover:bg-blue-700 mt-3">${action.text}</button>`).join('')}
                </form>
                <div class="text-center mt-6">
                    ${links.map(link => `<a href="#" data-view="${link.view}" class="text-blue-500 dark:text-blue-400 text-sm mx-2 hover:underline">${link.text}</a>`).join(' <span class="text-gray-400 dark:text-gray-500">|</span> ')}
                    ${extraContentOutsideForm}
                </div>
            </div>
        </div>
    </div>
`;

export const createFileUploadInput = (id, label, multiple = false, accept = '') => `
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg">
        <label class="font-semibold text-gray-700 dark:text-gray-300 mb-2 block">${label}</label>
        <label for="${id}" data-upload-area="true" class="relative flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-500 transition-colors">
            <div class="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                <span class="material-symbols-outlined text-4xl text-gray-500 dark:text-gray-400">upload_file</span>
                <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">点击或拖拽文件上传</p>
            </div>
            <input id="${id}" name="${id}" type="file" class="hidden" ${multiple ? 'multiple' : ''} accept="${accept}" />
        </label>
        <div id="${id}-file-list" class="mt-2 text-sm text-gray-500 dark:text-gray-400 space-y-1"></div>
    </div>
`;
