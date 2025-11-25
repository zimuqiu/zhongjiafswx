
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as docx from 'docx';
import saveAs from 'file-saver';
import { renderSettingsDropdown, showToast, createFileUploadInput } from './shared_ui.ts';
import {
    // FIX: Renamed import from 'state' to 'substantiveCheckStore' to match the exported member.
    substantiveCheckStore,
    resetState,
    handleStartSubstantiveCheck,
} from './feature_substantive_quality_check.ts';
import { substantiveCheckHistoryDb, SubstantiveCheckResult } from './shared_formal_check_db.ts';


// --- TYPE GUARD ---
/**
 * A type guard to safely check if the provided data is a valid SubstantiveCheckResult.
 * This ensures that data from localStorage or API calls conforms to the expected structure
 * before being used in rendering, preventing runtime errors.
 * @param data The data to check, of unknown type.
 * @returns {boolean} True if the data is a valid SubstantiveCheckResult, false otherwise.
 */
function isCheckResultValid(data: unknown): data is SubstantiveCheckResult {
    // Check if it's a non-null object
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    // Check if it has an 'issues' property that is an array
    // We cast to `any` here within the check to access the property,
    // which is safe inside this type guard.
    if (!('issues' in data) || !Array.isArray((data as any).issues)) {
        return false;
    }
    return true;
}

// --- EXPORT FUNCTION ---
const handleExportWord = (checkResult: SubstantiveCheckResult) => {
    try {
        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: [
                    new docx.Paragraph({
                        text: "实质质检报告 (公开不充分)",
                        heading: docx.HeadingLevel.TITLE,
                        alignment: docx.AlignmentType.CENTER,
                        spacing: { after: 400 }
                    }),
                    ...checkResult.issues.flatMap((issue, index) => [
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: `${index + 1}. [${issue.issueCategory}]`,
                                    bold: true,
                                    size: 28 // 14pt
                                })
                            ],
                            spacing: { before: 300, after: 150 }
                        }),
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: "问题分析:",
                                    bold: true,
                                    size: 24 // 12pt
                                })
                            ],
                            spacing: { after: 100 }
                        }),
                        new docx.Paragraph({
                            text: issue.reasoning,
                            spacing: { after: 200 }
                        }),
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: "修改建议:",
                                    bold: true,
                                    size: 24, // 12pt
                                    color: "2E7D32" // Green color
                                })
                            ],
                            spacing: { after: 100 }
                        }),
                        new docx.Paragraph({
                            text: issue.suggestion,
                            spacing: { after: 400 }
                        }),
                        new docx.Paragraph({ // Separator
                            text: "",
                            border: {
                                bottom: { color: "E0E0E0", space: 1, style: docx.BorderStyle.SINGLE, size: 6 }
                            }
                        })
                    ])
                ],
            }],
        });

        docx.Packer.toBlob(doc).then(blob => {
            saveAs(blob, `实质质检报告_${new Date().toISOString().split('T')[0]}.docx`);
            showToast('报告已导出！');
        });
    } catch (error) {
        console.error("Export failed:", error);
        showToast('导出失败，请重试。');
    }
};


// --- RENDER FUNCTIONS ---
const renderSidebar = () => {
    // FIX: Access state via substantiveCheckStore.getState()
    const isHistoryView = substantiveCheckStore.getState().viewMode === 'historyList' || substantiveCheckStore.getState().viewMode === 'historyDetail';
    const historyBtnText = isHistoryView ? '返回质检' : '历史记录';
    const historyBtnIcon = isHistoryView ? 'arrow_back' : 'history';

    return `
    <aside class="h-full bg-gray-50 dark:bg-gray-800 w-64 p-4 flex flex-col border-r border-gray-200 dark:border-gray-700 shrink-0" style="width: 20rem;">
        <div class="flex-grow space-y-6">
            ${createFileUploadInput('substantive-check-application', '上传申请文件', false, '.pdf,.doc,.docx,.txt')}
        </div>
        <div class="mt-auto space-y-4">
            <div class="space-y-2">
                <button id="start-substantive-check-btn" class="w-full bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3" disabled>
                    <span class="material-symbols-outlined">gavel</span>
                    开始质检
                </button>
                <button id="view-substantive-check-history-btn" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">${historyBtnIcon}</span>
                    ${historyBtnText}
                </button>
            </div>
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button id="reset-substantive-check-btn" class="w-full bg-red-600 text-white font-bold p-3 rounded-full hover:bg-red-700 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">refresh</span>
                    重新开始
                </button>
            </div>
        </div>
    </aside>
`};

const renderResults = (checkResult: unknown, totalCost: number) => {
    // Use the robust type guard to validate the data structure.
    if (!isCheckResultValid(checkResult)) {
        return `
            <div class="bg-white dark:bg-gray-800 p-10 rounded-lg text-center">
                <span class="material-symbols-outlined text-5xl text-yellow-500 mb-4">warning</span>
                <h4 class="text-2xl font-bold">数据格式错误</h4>
                <p class="text-gray-500 dark:text-gray-400 mt-2">无法显示此历史记录的结果，数据可能已损坏。</p>
            </div>
        `;
    }
    
    // After the guard, TypeScript knows checkResult is a valid SubstantiveCheckResult.
    const issues = checkResult.issues;
    const totalIssues = issues.length;

    const getCategoryIconAndColor = (category: string) => {
        switch (category) {
            case '未解决的技术问题': return { icon: 'help_outline', color: 'text-orange-600 dark:text-orange-400' };
            case '技术方案不完整': return { icon: 'engineering', color: 'text-red-600 dark:text-red-400' };
            case '技术效果不可信': return { icon: 'science', color: 'text-purple-600 dark:text-purple-400' };
            case '权利要求得不到说明书支持': return { icon: 'link_off', color: 'text-yellow-600 dark:text-yellow-400' };
            default: return { icon: 'error', color: 'text-gray-500' };
        }
    };

    const groupedIssues = issues.reduce((acc, issue) => {
        const category = issue.issueCategory;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(issue);
        return acc;
    }, {} as Record<string, any[]>);

    return `
        <div class="w-full max-w-5xl mx-auto">
            <div class="mb-8">
                <h3 class="text-3xl font-bold">公开不充分（26.3）质检完成</h3>
                <div class="flex justify-between items-center mt-2">
                    <p class="text-gray-500 dark:text-gray-400">
                        共发现 ${totalIssues} 个潜在的公开不充分问题。
                    </p>
                    <div class="flex items-center gap-2 text-lg">
                        <span class="material-symbols-outlined text-green-600 dark:text-green-400">payments</span>
                        <span class="font-semibold text-gray-700 dark:text-gray-200">本次质检AI消费:</span>
                        <span class="font-bold text-green-600 dark:text-green-400">¥ ${totalCost.toFixed(4)}</span>
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                 ${issues.length > 0 ? Object.entries(groupedIssues).map(([category, categoryIssues]) => {
                    const { icon, color } = getCategoryIconAndColor(category);
                    return `
                        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                             <details open class="group">
                                <summary class="flex justify-between items-center cursor-pointer list-none">
                                    <div class="flex items-center gap-3">
                                        <span class="material-symbols-outlined ${color}">${icon}</span>
                                        <h4 class="text-xl font-semibold ${color}">${category}</h4>
                                    </div>
                                     <div class="flex items-center gap-2">
                                        <span class="bg-red-100 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">${categoryIssues.length} 个问题</span>
                                        <span class="material-symbols-outlined transition-transform duration-200 group-open:rotate-180">expand_more</span>
                                    </div>
                                </summary>
                                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div class="space-y-6">
                                        ${categoryIssues.map((item, index) => `
                                            <div>
                                                <h5 class="font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-baseline">
                                                    ${categoryIssues.length > 1 ? `<span class="text-lg font-bold mr-2">${index + 1}.</span>` : ''}
                                                    <span>问题分析:</span>
                                                </h5>
                                                <p class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${item.reasoning}</p>
                                                <h5 class="font-semibold text-green-700 dark:text-green-400 mb-1 mt-3">修改建议:</h5>
                                                <p class="text-sm text-green-600 dark:text-green-300 whitespace-pre-wrap">${item.suggestion}</p>
                                            </div>
                                        `).join('<hr class="my-6 border-gray-200 dark:border-gray-600">')}
                                    </div>
                                </div>
                             </details>
                        </div>
                    `;
                 }).join('') : `
                    <div class="bg-white dark:bg-gray-800 p-10 rounded-lg text-center">
                        <span class="material-symbols-outlined text-5xl text-green-500 mb-4">check_circle</span>
                        <h4 class="text-2xl font-bold">检查通过</h4>
                        <p class="text-gray-500 dark:text-gray-400 mt-2">未发现明显的公开不充分问题。</p>
                    </div>
                 `}
            </div>

            ${issues.length > 0 ? `
            <div class="mt-8 text-center">
                <button id="export-substantive-check-word-btn" class="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto">
                    <span class="material-symbols-outlined">download</span>
                    导出质检报告 (Word)
                </button>
            </div>
            ` : ''}
        </div>
    `;
};

const renderHistoryList = () => {
    const history = substantiveCheckHistoryDb.getHistory(); // Guaranteed to be an array
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
                        <button class="view-substantive-check-detail-btn bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm" data-history-id="${entry.id}">
                            查看详情
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

const renderHistoryDetail = () => {
    const history = substantiveCheckHistoryDb.getHistory(); // Guaranteed to be an array
    // FIX: Access state via substantiveCheckStore.getState()
    const state = substantiveCheckStore.getState();
    
    const entry = history.find(item => item.id === state.selectedHistoryId);
    if (!entry) {
        // FIX: Update state via substantiveCheckStore.setState()
        substantiveCheckStore.setState({ viewMode: 'historyList', selectedHistoryId: null });
        return renderHistoryList();
    }
    
    return `
        <div class="w-full max-w-5xl mx-auto">
            <div class="flex items-center gap-4 mb-6">
                <button id="back-to-substantive-history-list" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回历史列表">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                    <h3 class="text-3xl font-bold" title="${entry.fileName}">历史详情: ${entry.fileName}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">检查时间: ${entry.date}</p>
                </div>
            </div>
            ${renderResults(entry.checkResult, entry.totalCost)}
        </div>
    `;
};


const renderContent = () => {
    // FIX: Access state via substantiveCheckStore.getState()
    const state = substantiveCheckStore.getState();
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
                        <p class="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300" id="substantive-check-loading-step">${state.loadingStep || '正在准备质检...'}</p>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">AI正在进行深度分析，请稍候。</p>
                    </div>
                `;
            }

            if (state.error) {
                return `
                    <div class="max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
                        <span class="material-symbols-outlined text-6xl mb-4 text-red-500">report_problem</span>
                        <h3 class="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">质检时出现错误</h3>
                        <div class="bg-red-50 dark:bg-gray-800 border border-red-200 dark:border-red-700 p-4 rounded-lg text-left w-full">
                            <pre class="text-red-700 dark:text-red-300 whitespace-pre-wrap font-sans text-sm">${state.error}</pre>
                        </div>
                        <p class="mt-6 text-sm text-gray-500 dark:text-gray-400">请在左侧点击“重新开始”按钮返回重试。</p>
                    </div>
                `;
            }

            if (state.checkResult) {
                return renderResults(state.checkResult, state.totalCost);
            }

            return `
                <div class="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                    <span class="material-symbols-outlined text-6xl mb-4">gavel</span>
                    <h3 class="text-xl font-semibold">准备开始公开不充分质检</h3>
                    <p>请在左侧上传一份待检申请文件，然后点击“开始质检”。</p>
                </div>
            `;
    }
};


const updateDOM = () => {
    // FIX: Access state via substantiveCheckStore.getState()
    const state = substantiveCheckStore.getState();
    const ids = ['substantive-check-application'];
    ids.forEach(id => {
        const fileListContainer = document.getElementById(`${id}-file-list`);
        if (!fileListContainer) return;

        const files = state.files.application ? [state.files.application] : [];

        fileListContainer.innerHTML = files.map(f => `
            <div class="bg-gray-200 dark:bg-gray-700 p-1 px-2 rounded-md text-xs flex justify-between items-center transition-all">
                <span class="material-symbols-outlined text-base mr-2 text-gray-500 dark:text-gray-400">description</span>
                <span class="truncate flex-grow" title="${f.name}">${f.name}</span>
                <button class="remove-file-btn ml-2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white" data-input-id="${id}" data-filename="${f.name}" aria-label="移除 ${f.name}">
                    <span class="material-symbols-outlined text-sm pointer-events-none">close</span>
                </button>
            </div>
        `).join('');
    });

    const startBtn = document.getElementById('start-substantive-check-btn') as HTMLButtonElement;
    if (startBtn) {
        startBtn.disabled = !state.files.application;
    }
};


// --- EVENT HANDLERS & BINDING ---
const reRenderContent = () => {
    const contentContainer = document.getElementById('substantive-check-content-container');
    if (contentContainer) {
        contentContainer.innerHTML = renderContent();
    }
}

const attachFileInputListeners = () => {
    const fileInput = document.getElementById('substantive-check-application') as HTMLInputElement;

    if (fileInput) {
        const handleFileChange = (files: FileList | null) => {
            if (!files || files.length === 0) return;
            // FIX: Update state via substantiveCheckStore.setState()
            substantiveCheckStore.setState({ files: { application: files[0] || null } });
            updateDOM();
        };

        fileInput.addEventListener('change', (e) => {
            handleFileChange((e.target as HTMLInputElement).files);
        });

        const dropArea = fileInput.closest('[data-upload-area]');
        if (dropArea) {
            dropArea.addEventListener('dragover', (e) => e.preventDefault());
            dropArea.addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();
                if (e.dataTransfer) handleFileChange(e.dataTransfer.files);
            });
        }
    }
    
    updateDOM();
};

const updateView = () => {
    const pageContainer = document.getElementById('substantive-check-page');
    if (!pageContainer) return;
    const sidebarContainer = pageContainer.querySelector('aside');
    if (sidebarContainer) {
        sidebarContainer.outerHTML = renderSidebar();
    }
    reRenderContent();
    attachFileInputListeners();
}

const attachEventListeners = () => {
    const pageElement = document.getElementById('substantive-check-page');
    if (!pageElement) return () => {};

    const clickHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        const contentContainer = document.getElementById('substantive-check-content-container');
        // FIX: Access state via substantiveCheckStore.getState()
        const state = substantiveCheckStore.getState();

        const startBtn = target.closest('#start-substantive-check-btn');
        if (startBtn) {
            setTimeout(async () => {
                const currentFile = state.files.application;
                resetState();
                // FIX: Update state via substantiveCheckStore.setState()
                substantiveCheckStore.setState({ 
                    files: { application: currentFile },
                    isLoading: true,
                    loadingStep: '正在准备文件...'
                });
                if (contentContainer) contentContainer.innerHTML = renderContent();
                
                await handleStartSubstantiveCheck();

                // FIX: Update state via substantiveCheckStore.setState()
                substantiveCheckStore.setState({ isLoading: false, loadingStep: null });
                if (contentContainer) contentContainer.innerHTML = renderContent();
            }, 0);
            return;
        }

        const resetBtn = target.closest('#reset-substantive-check-btn');
        if (resetBtn) {
            resetState();
            updateView();
            return;
        }

        const removeBtn = target.closest('.remove-file-btn');
        if (removeBtn) {
            const inputId = removeBtn.getAttribute('data-input-id');
            const filename = removeBtn.getAttribute('data-filename');
            if (!inputId || !filename) return;

            if (state.files.application?.name === filename) {
                // FIX: Update state via substantiveCheckStore.setState()
                substantiveCheckStore.setState({ files: { application: null } });
            }
            updateDOM();
            showToast(`文件 "${filename}" 已移除。`);
            return;
        }

        const historyBtn = target.closest('#view-substantive-check-history-btn');
        if (historyBtn) {
            // FIX: Access and update state via store
            const newViewMode = (state.viewMode === 'main') ? 'historyList' : 'main';
            substantiveCheckStore.setState({ viewMode: newViewMode, selectedHistoryId: null });
            updateView();
            return;
        }

        const detailBtn = target.closest('.view-substantive-check-detail-btn');
        if (detailBtn) {
            const id = (detailBtn as HTMLElement).dataset.historyId;
            if (id) {
                // FIX: Update state via substantiveCheckStore.setState()
                substantiveCheckStore.setState({ selectedHistoryId: parseInt(id, 10), viewMode: 'historyDetail' });
                reRenderContent();
            }
            return;
        }

        const backBtn = target.closest('#back-to-substantive-history-list');
        if (backBtn) {
            // FIX: Update state via substantiveCheckStore.setState()
            substantiveCheckStore.setState({ selectedHistoryId: null, viewMode: 'historyList' });
            reRenderContent();
            return;
        }

        const exportBtn = target.closest('#export-substantive-check-word-btn');
        if (exportBtn) {
            let resultToExport: SubstantiveCheckResult | null = null;

            if (state.viewMode === 'main') {
                // Safe cast because we check for checkResult validity before rendering the button
                resultToExport = state.checkResult as SubstantiveCheckResult;
            } else if (state.viewMode === 'historyDetail' && state.selectedHistoryId) {
                const history = substantiveCheckHistoryDb.getHistory();
                const entry = history.find(item => item.id === state.selectedHistoryId);
                resultToExport = entry?.checkResult || null;
            }

            if (resultToExport) {
                handleExportWord(resultToExport);
            } else {
                showToast('无法导出：未找到质检结果。');
            }
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


export const renderSubstantiveQualityCheckPage = (appContainer: HTMLElement) => {
    appContainer.innerHTML = `
        <div id="substantive-check-page" class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
             <header class="flex justify-between items-center gap-4 p-4 md:p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-2xl font-bold">实质质检</h2>
                </div>
                ${renderSettingsDropdown()}
            </header>
            <div class="flex flex-grow overflow-hidden">
                ${renderSidebar()}
                <main class="flex-grow p-5 md:p-8 overflow-y-auto" id="substantive-check-content-container">
                    ${renderContent()}
                </main>
            </div>
        </div>`;
    // FIX: Return the unsubscribe function from attachEventListeners.
    return attachEventListeners();
};
