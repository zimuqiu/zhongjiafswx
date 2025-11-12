/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { renderSettingsDropdown } from './shared_ui.ts';
import { getCurrentUserProfile } from './shared_user.ts';

export const renderDashboard = (appContainer: HTMLElement) => {
    const panels = [
        { id: 'oa-reply', title: 'OA答复' },
        { id: 'formal-quality-check', title: '形式质检' },
        { id: 'substantive-quality-check', title: '实质质检' },
        { id: 'priority-review-materials', title: '优审材料制作' }
    ];

    const currentUser = getCurrentUserProfile();
    const hasPermission = (featureId) => {
        if (!currentUser) return false;
        return currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.includes(featureId));
    };

    const accessiblePanels = panels.filter(panel => hasPermission(panel.id));

    appContainer.innerHTML = `
        <div class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
            <header class="flex justify-between items-center p-4 md:p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <h2 class="text-2xl font-bold">功能选区</h2>
                ${renderSettingsDropdown()}
            </header>
            <main class="flex-grow p-5 md:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8 overflow-y-auto content-start">
                ${accessiblePanels.map(panel => `
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex flex-col justify-between border border-gray-200 dark:border-gray-700 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:border-blue-500 h-[25vh]" data-view="${panel.id}">
                        <div>
                            <h3 class="text-2xl font-semibold mb-5">${panel.title}</h3>
                        </div>
                        <div class="mt-auto text-right">
                            <a href="#" class="text-blue-500 dark:text-blue-400 font-bold inline-flex items-center gap-2 group" data-view="${panel.id}">
                                开始使用
                                <span class="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1">arrow_forward</span>
                            </a>
                        </div>
                    </div>
                `).join('')}
                 ${accessiblePanels.length === 0 ? '<p class="col-span-full text-center text-gray-500 dark:text-gray-400">暂无可用功能。请联系管理员分配权限。</p>' : ''}
            </main>
        </div>`;
};
