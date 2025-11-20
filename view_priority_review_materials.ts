/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { priorityReviewHistoryDb } from './shared_formal_check_db.ts';
import { showToast, createFileUploadInput, renderSettingsDropdown } from './shared_ui.ts';
import { 
    priorityReviewStore,
    handleStartPriorityReview,
    PriorityReviewResult
} from './feature_priority_review_materials.ts';

// --- RENDER FUNCTIONS ---

const renderSidebar = () => {
    const state = priorityReviewStore.getState();
    const isHistoryView = state.viewMode === 'historyList' || state.viewMode === 'historyDetail';
    const historyBtnText = isHistoryView ? '返回分析' : '历史记录';
    const historyBtnIcon = isHistoryView ? 'arrow_back' : 'history';

    return `
    <aside class="h-full bg-gray-50 dark:bg-gray-800 w-64 p-4 flex flex-col border-r border-gray-200 dark:border-gray-700 shrink-0" style="width: 20rem;">
        <div class="flex-grow space-y-6">
            ${createFileUploadInput('priority-review-file', '上传发明申请文件 (PDF)', false, 'application/pdf')}
        </div>
        <div class="mt-auto space-y-4">
            <div class="space-y-2">
                <button id="start-priority-review-btn" class="w-full bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3" disabled>
                    <span class="material-symbols-outlined">travel_explore</span>
                    开始分析
                </button>
                <button id="view-priority-review-history-btn" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">${historyBtnIcon}</span>
                    ${historyBtnText}
                </button>
            </div>
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button id="reset-priority-review-btn" class="w-full bg-red-600 text-white font-bold p-3 rounded-full hover:bg-red-700 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">refresh</span>
                    重新开始
                </button>
            </div>
        </div>
    </aside>
`};

const renderResults = (result: PriorityReviewResult, totalCost: number) => {
    if (!result) return '';

    return `
        <div class="w-full max-w-5xl mx-auto">
            <div class="mb-6">
                <h3 class="text-3xl font-bold">优审材料匹配完成</h3>
                <div class="flex justify-between items-center mt-1">
                    <p class="text-gray-500 dark:text-gray-400">
                        已在标准库中找到最佳匹配项。
                    </p>
                    <div class="flex items-center gap-2 text-lg">
                        <span class="material-symbols-outlined text-green-600 dark:text-green-400">payments</span>
                        <span class="font-semibold text-gray-700 dark:text-gray-200">本次AI消费:</span>
                        <span class="font-bold text-green-600 dark:text-green-400">¥ ${totalCost.toFixed(4)}</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-6">
                <!-- Best Match Card -->
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-blue-200 dark:border-blue-700 shadow-lg">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="material-symbols-outlined text-3xl text-blue-600">recommend</span>
                        <h4 class="text-2xl font-bold text-gray-800 dark:text-gray-100">最佳匹配结果</h4>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">所属产业领域</p>
                            <p class="text-xl font-semibold text-blue-700 dark:text-blue-400">${result.matchedDomain}</p>
                        </div>
                         <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">对应标准表</p>
                            <p class="text-lg font-medium text-gray-800 dark:text-gray-200">${result.matchedTable}</p>
                        </div>
                         <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">匹配分类号 (IPC)</p>
                            <p class="text-lg font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block">${result.matchedClassification}</p>
                        </div>
                         <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">提取分类号总数</p>
                            <p class="text-lg text-gray-800 dark:text-gray-200">${result.allClassifications.length} 个</p>
                        </div>
                    </div>

                     <div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">推荐关键词 (用于填写请求书)</p>
                        <div class="flex flex-wrap gap-2">
                            ${result.matchedKeywords.map(kw => `
                                <span class="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded dark:bg-blue-900 dark:text-blue-300 select-all">${kw}</span>
                            `).join('')}
                            ${result.matchedKeywords.length === 0 ? '<span class="text-gray-400 italic">无特定关键词</span>' : ''}
                        </div>
                    </div>
                </div>

                <!-- Reasoning -->
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                        <span class="material-symbols-outlined text-gray-500">psychology</span>
                        AI 匹配逻辑分析
                    </h3>
                    <div class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 font-sans whitespace-pre-wrap leading-relaxed text-sm">${result.reasoning}</div>
                </div>

                <!-- All Candidates -->
                 <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <details>
                        <summary class="font-bold text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                            <span class="material-symbols-outlined">list</span>
                            查看所有候选匹配项 (${result.allMatches.length})
                        </summary>
                        <div class="mt-4 overflow-x-auto">
                            <table class="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th scope="col" class="px-6 py-3">分类号</th>
                                        <th scope="col" class="px-6 py-3">标准表</th>
                                        <th scope="col" class="px-6 py-3">产业领域</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${result.allMatches.map(match => `
                                        <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                            <td class="px-6 py-4 font-mono">${match.classification}</td>
                                            <td class="px-6 py-4">${match.table}</td>
                                            <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">${match.domain}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
};

const renderHistoryList = () => {
    const history = priorityReviewHistoryDb.getHistory();
    const title = '优审历史记录';

    if (history.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                <span class="material-symbols-outlined text-6xl mb-4">history_toggle_off</span>
                <h3 class="text-xl font-semibold">${title}</h3>
                <p>暂无历史记录。</p>
            </div>
        `;
    }

    return `
        <div class="w-full max-w-5xl mx-auto">
            <h3 class="text-3xl font-bold mb-6">${title}</h3>
            <div class="space-y-4">
                ${history.map(entry => `
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-gray-200" title="${entry.applicationFileName}">${entry.applicationFileName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${entry.date}</p>
                        </div>
                        <button class="view-history-detail-btn bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm" data-history-id="${entry.id}">
                            查看详情
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

const renderHistoryDetail = () => {
    const history = priorityReviewHistoryDb.getHistory();
    const state = priorityReviewStore.getState();
    const entry = history.find(item => item.id === state.selectedHistoryId);
    
    if (!entry) {
        priorityReviewStore.setState({ viewMode: 'historyList', selectedHistoryId: null });
        return renderHistoryList();
    }

    if (!entry.checkResult) return '<p>数据损坏。</p>';

    return `
        <div class="w-full max-w-5xl mx-auto">
            <div class="flex items-center gap-4 mb-6">
                <button id="back-to-history-list" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回历史列表">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                    <h3 class="text-3xl font-bold" title="${entry.applicationFileName}">历史详情: ${entry.applicationFileName}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">时间: ${entry.date}</p>
                </div>
            </div>
            ${renderResults(entry.checkResult, entry.totalCost)}
        </div>
    `;
};


const renderContent = () => {
    const state = priorityReviewStore.getState();
    switch (state.viewMode) {
        case 'historyList':
            return renderHistoryList();
        case 'historyDetail':
            return renderHistoryDetail();
        case 'main':
        default:
            if (state.isLoading) {
                return `
                    <div class="flex flex-col items-center justify-center h-full">
                        <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                        <p class="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300" id="priority-review-loading-step">${state.loadingStep || '正在准备分析...'}</p>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">AI正在匹配产业领域，请稍候。</p>
                    </div>
                `;
            }

            if (state.error) {
                return `
                    <div class="max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
                        <span class="material-symbols-outlined text-6xl mb-4 text-red-500">report_problem</span>
                        <h3 class="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">分析时出现错误</h3>
                        <div class="bg-red-50 dark:bg-gray-800 border border-red-200 dark:border-red-700 p-4 rounded-lg text-left w-full">
                            <pre class="text-red-700 dark:text-red-300 whitespace-pre-wrap font-sans text-sm">${state.error}</pre>
                        </div>
                        <p class="mt-6 text-sm text-gray-500 dark:text-gray-400">请在左侧点击“重新开始”按钮返回重试。</p>
                    </div>
                `;
            }

            if (state.result) {
                return renderResults(state.result, state.totalCost);
            }

            return `
                <div class="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                    <span class="material-symbols-outlined text-6xl mb-4">travel_explore</span>
                    <h3 class="text-xl font-semibold">准备开始优先审查材料分析</h3>
                    <p class="max-w-md mt-2">请在左侧上传发明申请文件 (PDF)。系统将自动提取分类号，匹配《战略性新兴产业分类》等标准表，并生成推荐的领域和关键词。</p>
                </div>
            `;
    }
};

const updateDOM = () => {
    const state = priorityReviewStore.getState();
    const fileListContainer = document.getElementById('priority-review-file-file-list');
    
    if (fileListContainer) {
        if (state.applicationFile) {
            fileListContainer.innerHTML = `
            <div class="bg-gray-200 dark:bg-gray-700 p-1 px-2 rounded-md text-xs flex justify-between items-center transition-all">
                <span class="material-symbols-outlined text-base mr-2 text-gray-500 dark:text-gray-400">description</span>
                <span class="truncate flex-grow" title="${state.applicationFile.name}">${state.applicationFile.name}</span>
                <button class="remove-file-btn ml-2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500" data-filename="${state.applicationFile.name}" aria-label="移除 ${state.applicationFile.name}">
                    <span class="material-symbols-outlined text-sm pointer-events-none">close</span>
                </button>
            </div>
            `;
        } else {
            fileListContainer.innerHTML = '';
        }
    }

    const startBtn = document.getElementById('start-priority-review-btn') as HTMLButtonElement;
    if (startBtn) {
        startBtn.disabled = !state.applicationFile;
    }
};

const reRenderContent = () => {
    const contentContainer = document.getElementById('priority-review-content-container');
    if (contentContainer) {
        contentContainer.innerHTML = renderContent();
    }
}

const attachFileInputListeners = () => {
    const fileInput = document.getElementById('priority-review-file') as HTMLInputElement;
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const file = target.files ? target.files[0] : null;
            if (file) {
                if (file.type !== 'application/pdf') {
                    showToast('请上传PDF格式的文件。');
                    target.value = '';
                    return;
                }
                priorityReviewStore.setState({ applicationFile: file });
                updateDOM();
            }
        });

        const dropArea = fileInput.closest('[data-upload-area]');
        if (dropArea) {
            dropArea.addEventListener('dragover', (e) => e.preventDefault());
            dropArea.addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();
                if (e.dataTransfer) {
                    fileInput.files = e.dataTransfer.files;
                    const changeEvent = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(changeEvent);
                }
            });
        }
    }
    updateDOM();
};

const updateView = () => {
    const pageContainer = document.getElementById('priority-review-page');
    if (!pageContainer) return;
    const sidebarContainer = pageContainer.querySelector('aside');
    if (sidebarContainer) {
        sidebarContainer.outerHTML = renderSidebar();
    }
    reRenderContent();
    attachFileInputListeners();
};

const attachEventListeners = () => {
    const pageElement = document.getElementById('priority-review-page');
    if (!pageElement) return () => {};

    const clickHandler = (e: Event) => {
        const target = e.target as HTMLElement;

        // Start Button
        const startBtn = target.closest('#start-priority-review-btn');
        if (startBtn) {
             setTimeout(async () => {
                const state = priorityReviewStore.getState();
                const currentFile = state.applicationFile;
                
                priorityReviewStore.resetState();
                priorityReviewStore.setState({ 
                    applicationFile: currentFile,
                    isLoading: true, 
                    loadingStep: '初始化...' 
                });
                reRenderContent();

                await handleStartPriorityReview();
                
                reRenderContent();
            }, 0);
            return;
        }

        // Reset Button
        const resetBtn = target.closest('#reset-priority-review-btn');
        if (resetBtn) {
            priorityReviewStore.resetState();
            updateView();
            return;
        }

        // Remove File
        const removeBtn = target.closest('.remove-file-btn');
        if (removeBtn) {
            priorityReviewStore.setState({ applicationFile: null });
            updateDOM();
            return;
        }

        // History Toggle
        const historyBtn = target.closest('#view-priority-review-history-btn');
        if (historyBtn) {
            const state = priorityReviewStore.getState();
            const newViewMode = state.viewMode === 'main' ? 'historyList' : 'main';
            priorityReviewStore.setState({ viewMode: newViewMode, selectedHistoryId: null });
            updateView();
            return;
        }

        // View History Detail
        const detailBtn = target.closest('.view-history-detail-btn');
        if (detailBtn) {
            const id = (detailBtn as HTMLElement).dataset.historyId;
            if (id) {
                priorityReviewStore.setState({ viewMode: 'historyDetail', selectedHistoryId: parseInt(id, 10) });
                reRenderContent();
            }
            return;
        }

        // Back to History List
        const backBtn = target.closest('#back-to-history-list');
        if (backBtn) {
            priorityReviewStore.setState({ viewMode: 'historyList', selectedHistoryId: null });
            reRenderContent();
            return;
        }
    };

    pageElement.addEventListener('click', clickHandler);
    attachFileInputListeners();

    return () => {
        pageElement.removeEventListener('click', clickHandler);
    };
};

export const renderPriorityReviewMaterialsPage = (appContainer: HTMLElement) => {
    appContainer.innerHTML = `
        <div id="priority-review-page" class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
             <header class="flex justify-between items-center gap-4 p-4 md:p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-2xl font-bold">优审材料制作</h2>
                </div>
                ${renderSettingsDropdown()}
            </header>
            <div class="flex flex-grow overflow-hidden">
                ${renderSidebar()}
                <main class="flex-grow p-5 md:p-8 overflow-y-auto" id="priority-review-content-container">
                    ${renderContent()}
                </main>
            </div>
        </div>`;
    
    return attachEventListeners();
};
