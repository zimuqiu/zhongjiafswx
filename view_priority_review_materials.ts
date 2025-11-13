/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { renderSettingsDropdown } from './shared_ui.ts';

export const renderPriorityReviewMaterialsPage = (appContainer: HTMLElement) => {
    appContainer.innerHTML = `
        <div class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
             <header class="flex justify-between items-center gap-4 p-4 md:p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-2xl font-bold">优审材料制作</h2>
                </div>
                ${renderSettingsDropdown()}
            </header>
            <main class="flex-grow p-5 md:p-8 overflow-y-auto">
                <p>这里是“优审材料制作”的内容区域。</p>
            </main>
        </div>`;
};
