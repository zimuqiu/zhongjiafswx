/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { renderSettingsDropdown } from './shared_ui.ts';
import { getCurrentUserProfile } from './shared_user.ts';

export const renderUsernameSettingsView = (appContainer: HTMLElement) => {
    const currentUser = getCurrentUserProfile();
    const currentUsername = currentUser?.username || '';
    const isAdmin = currentUser?.email === '2721750438@qq.com';

    appContainer.innerHTML = `
        <div class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
             <header class="flex justify-between items-center gap-4 p-5 md:p-8 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-3xl font-bold">用户名设置</h2>
                </div>
                ${renderSettingsDropdown()}
            </header>
            <main class="flex-grow p-5 md:p-8 overflow-y-auto">
                <div class="max-w-xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <form id="username-settings-form">
                        <div class="space-y-6">
                            <div>
                                <label for="current-username" class="block text-sm font-medium text-gray-500 dark:text-gray-400">当前用户名</label>
                                <input type="text" id="current-username" value="${currentUsername}" disabled class="mt-1 block w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none sm:text-sm">
                            </div>
                            <div>
                                <label for="new-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300">新用户名</label>
                                <input type="text" id="new-username" name="new-username" required class="mt-1 block w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm" placeholder="请输入新的用户名" ${isAdmin ? 'disabled' : ''}>
                                ${isAdmin ? '<p class="mt-2 text-sm text-yellow-600 dark:text-yellow-500">管理员用户名不允许修改。</p>' : ''}
                            </div>
                        </div>
                        <div class="mt-8 text-right">
                            <button type="submit" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${isAdmin ? 'disabled' : ''}>
                                保存更改
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>`;
};
