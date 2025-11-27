
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { formalCheckHistoryDb } from './shared_formal_check_db.ts';
import { showToast, createFileUploadInput, renderSettingsDropdown, renderModelSwitchButton, setupModelSwitchLogic } from './shared_ui.ts';
import { 
    formalCheckStore,
    handleStartFormalCheck 
} from './feature_formal_quality_check.ts';

// --- RENDER FUNCTIONS ---
const renderFormalCheckSidebar = () => {
    // FIX: Access state via formalCheckStore.getState()
    const isHistoryView = formalCheckStore.getState().viewMode === 'historyList' || formalCheckStore.getState().viewMode === 'historyDetail';
    const historyBtnText = isHistoryView ? '返回质检' : '历史记录';
    const historyBtnIcon = isHistoryView ? 'arrow_back' : 'history';

    return `
    <aside class="h-full bg-gray-50 dark:bg-gray-800 w-64 p-4 flex flex-col border-r border-gray-200 dark:border-gray-700 shrink-0" style="width: 20rem;">
        <div class="flex-grow space-y-6">
            ${createFileUploadInput('formal-check-file', '上传专利文件 (PDF)', false, 'application/pdf')}
        </div>
        <div class="mt-auto space-y-4">
            <div class="space-y-2">
                <button id="start-formal-check-btn" type="button" class="w-full bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3" disabled>
                    <span class="material-symbols-outlined">science</span>
                    开始质检
                </button>
                <button id="view-formal-check-history-btn" type="button" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">${historyBtnIcon}</span>
                    ${historyBtnText}
                </button>
            </div>
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button id="reset-formal-check-btn" type="button" class="w-full bg-red-600 text-white font-bold p-3 rounded-full hover:bg-red-700 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">refresh</span>
                    重新开始
                </button>
            </div>
        </div>
    </aside>
`};

const renderFormalCheckResults = (results: any[]) => {
    const totalIssues = results.reduce((acc, category) => acc + category.issues.length, 0);
    const categoryCount = results.length;

    return `
        <div class="w-full max-w-5xl mx-auto">
            <div class="mb-6">
                <h3 class="text-3xl font-bold">质检完成</h3>
                <div class="flex justify-between items-center mt-1">
                    <p class="text-gray-500 dark:text-gray-400">
                        共扫描 ${categoryCount} 个类别，发现 ${totalIssues} 个潜在问题。
                    </p>
                    <div class="flex items-center gap-2 text-lg">
                        <span class="material-symbols-outlined text-green-600 dark:text-green-400">payments</span>
                        <span class="font-semibold text-gray-700 dark:text-gray-200">本次质检AI消费:</span>
                        <span class="font-bold text-green-600 dark:text-green-400">¥ ${formalCheckStore.getState().totalCost.toFixed(4)}</span>
                    </div>
                </div>
            </div>
            <div class="space-y-6">
                ${results.map(category => `
                    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                         <details open class="group">
                            <summary class="flex justify-between items-center cursor-pointer list-none">
                                <h4 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
                                    ${category.category}
                                    ${category.charCount !== undefined ? `<span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">(检测字数: ${category.charCount})</span>` : ''}
                                </h4>
                                <div class="flex items-center gap-2">
                                    ${category.issues.length > 0
                                        ? `<span class="bg-red-100 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">${category.issues.length} 个问题</span>`
                                        : `<span class="bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">无问题</span>`
                                    }
                                    <span class="material-symbols-outlined transition-transform duration-200 group-open:rotate-180">expand_more</span>
                                </div>
                            </summary>
                            <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                ${category.issues.length > 0 ? `
                                <ul class="space-y-4 text-gray-700 dark:text-gray-300">
                                    ${category.issues.map((item: {issue: string, suggestion: string}) => `
                                        <li class="pl-6 relative">
                                            <span class="material-symbols-outlined text-red-500 absolute left-0 top-1">error</span>
                                            <p class="font-medium text-gray-900 dark:text-gray-100">${item.issue}</p>
                                            <p class="mt-1 text-sm text-green-700 dark:text-green-400"><strong>建议:</strong> ${item.suggestion}</p>
                                        </li>
                                    `).join('')}
                                </ul>
                                ` : ''}
                            </div>
                         </details>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

const renderFormalCheckHistoryList = () => {
    const history = formalCheckHistoryDb.getHistory();
    const title = '质检历史记录';

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
                            <p class="font-semibold text-gray-800 dark:text-gray-200" title="${entry.fileName}">${entry.fileName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${entry.date}</p>
                        </div>
                        <button class="view-formal-check-detail-btn bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm" data-history-id="${entry.id}">
                            查看详情
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

const renderFormalCheckHistoryDetail = () => {
    const history = formalCheckHistoryDb.getHistory();
    // FIX: Access state via formalCheckStore.getState()
    const entry = history.find(item => item.id === formalCheckStore.getState().selectedHistoryId);
    if (!entry) {
        // FIX: Update state via formalCheckStore.setState()
        formalCheckStore.setState({ viewMode: 'historyList', selectedHistoryId: null });
        return renderFormalCheckHistoryList();
    }
    
    return `
        <div class="w-full max-w-5xl mx-auto">
            <div class="flex items-center gap-4 mb-6">
                <button id="back-to-formal-history-list" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回历史列表">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                    <h3 class="text-3xl font-bold" title="${entry.fileName}">历史详情: ${entry.fileName}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">检查时间: ${entry.date}</p>
                </div>
            </div>
            ${renderFormalCheckResults(entry.checkResult)}
        </div>
    `;
};

const renderFormalCheckContent = () => {
    // FIX: Access state via formalCheckStore.getState()
    const state = formalCheckStore.getState();
    switch (state.viewMode) {
        case 'historyList':
            return renderFormalCheckHistoryList();
        case 'historyDetail':
            return renderFormalCheckHistoryDetail();
        case 'main':
        default:
            if (state.isLoading) {
                return `
                    <div class="flex flex-col items-center justify-center h-full">
                        <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                        <p class="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300" id="formal-check-loading-step">${state.loadingStep || '正在准备质检...'}</p>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">AI正在分析文件，请稍候。</p>
                    </div>
                `;
            }

            if (state.error) {
                 const errorContent = `
                    <div class="max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
                        <span class="material-symbols-outlined text-6xl mb-4 text-red-500">report_problem</span>
                        <h3 class="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">质检时出现错误</h3>
                        <div class="bg-red-50 dark:bg-gray-800 border border-red-200 dark:border-red-700 p-4 rounded-lg text-left w-full">
                            <pre class="text-red-700 dark:text-red-300 whitespace-pre-wrap font-sans text-sm">${state.error}</pre>
                        </div>
                        <p class="mt-6 text-sm text-gray-500 dark:text-gray-400">请在左侧点击“重新开始”按钮返回重试。</p>
                    </div>
                `;
                if (state.checkResult && state.checkResult.length > 0) {
                    return `<div>${renderFormalCheckResults(state.checkResult)}<hr class="my-8 border-gray-300 dark:border-gray-600">${errorContent}</div>`
                }
                return errorContent;
            }

            if (state.checkResult && state.checkResult.length > 0) {
                return renderFormalCheckResults(state.checkResult);
            }

            return `
                <div class="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                    <span class="material-symbols-outlined text-6xl mb-4">description</span>
                    <h3 class="text-xl font-semibold">准备开始形式质检</h3>
                    <p>请在左侧上传一份专利文件，然后点击“开始质检”。</p>
                </div>
            `;
    }
};

const reRenderContent = () => {
    const contentContainer = document.getElementById('formal-check-content-container');
    if (contentContainer) {
        contentContainer.innerHTML = renderFormalCheckContent();
    }
}

const updateFormalCheckDOM = () => {
    const fileListContainer = document.getElementById('formal-check-file-file-list');
    // FIX: Access state via formalCheckStore.getState()
    const state = formalCheckStore.getState();
    if (fileListContainer) {
        if (state.file) {
            fileListContainer.innerHTML = `
            <div class="bg-gray-200 dark:bg-gray-700 p-1 px-2 rounded-md text-xs flex justify-between items-center transition-all">
                <span class="material-symbols-outlined text-base mr-2 text-gray-500 dark:text-gray-400">description</span>
                <span class="truncate flex-grow" title="${state.file.name}">${state.file.name}</span>
                <button class="remove-file-btn ml-2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500" data-filename="${state.file.name}" aria-label="移除 ${state.file.name}">
                    <span class="material-symbols-outlined text-sm pointer-events-none">close</span>
                </button>
            </div>
            `;
        } else {
            fileListContainer.innerHTML = '';
        }
    }

    const startBtn = document.getElementById('start-formal-check-btn') as HTMLButtonElement;
    if (startBtn) startBtn.disabled = !state.file;
};

const attachFileInputListeners = () => {
    const fileInput = document.getElementById('formal-check-file') as HTMLInputElement;
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
                // FIX: Update state via formalCheckStore.setState()
                formalCheckStore.setState({ file: file });
                updateFormalCheckDOM();
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
    updateFormalCheckDOM();
};

const updateView = () => {
    const pageContainer = document.getElementById('formal-check-page');
    if (!pageContainer) return;
    const sidebarContainer = pageContainer.querySelector('aside');
    if (sidebarContainer) {
        sidebarContainer.outerHTML = renderFormalCheckSidebar();
    }
    reRenderContent();
    attachFileInputListeners();
}

const attachFormalCheckEventListeners = () => {
    const pageElement = document.getElementById('formal-check-page');
    if (!pageElement) return () => {};

    const clickHandler = (e: Event) => {
        const target = e.target as HTMLElement;

        const detailBtn = target.closest('.view-formal-check-detail-btn');
        if (detailBtn) {
            e.preventDefault();
            const id = (detailBtn as HTMLElement).dataset.historyId;
            if (id) {
                // FIX: Update state via formalCheckStore.setState()
                formalCheckStore.setState({ selectedHistoryId: parseInt(id, 10), viewMode: 'historyDetail' });
                reRenderContent();
            }
            return;
        }

        const backBtn = target.closest('#back-to-formal-history-list');
        if (backBtn) {
            e.preventDefault();
            // FIX: Update state via formalCheckStore.setState()
            formalCheckStore.setState({ selectedHistoryId: null, viewMode: 'historyList' });
            reRenderContent();
            return;
        }

        const removeBtn = target.closest('.remove-file-btn');
        if (removeBtn) {
            e.preventDefault();
            const filename = removeBtn.getAttribute('data-filename');
            // FIX: Access state via formalCheckStore.getState()
            if (formalCheckStore.getState().file?.name === filename) {
                // FIX: Update state via formalCheckStore.setState()
                formalCheckStore.setState({ file: null });
                updateFormalCheckDOM();
                showToast(`文件 "${filename}" 已移除。`);
            }
            return;
        }

        const startBtn = target.closest('#start-formal-check-btn');
        if (startBtn) {
            e.preventDefault(); // Stop default submit behavior
            // Use setTimeout to ensure the current click event processing is complete
            // before we manipulate the DOM, preventing the double-click issue.
            setTimeout(async () => {
                // FIX: Access state via formalCheckStore.getState()
                const currentFile = formalCheckStore.getState().file;
                formalCheckStore.resetState();
                // FIX: Update state via formalCheckStore.setState()
                formalCheckStore.setState({ 
                    file: currentFile,
                    isLoading: true,
                    loadingStep: '正在准备质检...'
                });
                reRenderContent(); // Show spinner
                
                await handleStartFormalCheck();
                
                // FIX: Update state via formalCheckStore.setState()
                formalCheckStore.setState({
                    isLoading: false,
                    loadingStep: null
                });
                reRenderContent(); // Show results
            }, 0);
            return;
        }

        const historyBtn = target.closest('#view-formal-check-history-btn');
        if (historyBtn) {
            e.preventDefault();
            // FIX: Access and update state via store
            const newViewMode = (formalCheckStore.getState().viewMode === 'main') ? 'historyList' : 'main';
            formalCheckStore.setState({ viewMode: newViewMode, selectedHistoryId: null });
            updateView();
            return;
        }

        const resetBtn = target.closest('#reset-formal-check-btn');
        if (resetBtn) {
            e.preventDefault();
            formalCheckStore.resetState();
            updateView();
            return;
        }
    };
    pageElement.addEventListener('click', clickHandler);
    
    attachFileInputListeners();
    // FIX: Return an unsubscribe function to be used by the router to prevent memory leaks.
    return () => {
        pageElement.removeEventListener('click', clickHandler);
    };
};

export const renderFormalQualityCheckPage = (appContainer: HTMLElement) => {
    appContainer.innerHTML = `
        <div id="formal-check-page" class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
             <header class="flex justify-between items-center gap-4 p-4 md:p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-2xl font-bold">形式质检</h2>
                </div>
                <div class="flex items-center gap-4">
                    ${renderModelSwitchButton()}
                    ${renderSettingsDropdown()}
                </div>
            </header>
            <div class="flex flex-grow overflow-hidden">
                ${renderFormalCheckSidebar()}
                <main class="flex-grow p-5 md:p-8 overflow-y-auto" id="formal-check-content-container">
                    ${renderFormalCheckContent()}
                </main>
            </div>
        </div>`;
    
    setupModelSwitchLogic();
    // FIX: Return the unsubscribe function from attachFormalCheckEventListeners.
    return attachFormalCheckEventListeners();
};
