/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { renderSettingsDropdown, showToast, createFileUploadInput } from './shared_ui.ts';
import {
    state,
    resetState,
    handleStartSubstantiveCheck,
} from './feature_substantive_quality_check.ts';


// --- RENDER FUNCTIONS ---
const renderSidebar = () => `
    <aside class="h-full bg-gray-50 dark:bg-gray-800 w-64 p-4 flex flex-col border-r border-gray-200 dark:border-gray-700 shrink-0" style="width: 20rem;">
        <div class="flex-grow space-y-6">
            ${createFileUploadInput('substantive-check-application', '上传申请文件', false, '.pdf,.doc,.docx,.txt')}
            ${createFileUploadInput('substantive-check-references', '上传对比文件', true, '.pdf,.doc,.docx,.txt')}
        </div>
        <div class="mt-auto space-y-4">
            <button id="start-substantive-check-btn" class="w-full bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3" disabled>
                <span class="material-symbols-outlined">gavel</span>
                开始质检
            </button>
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button id="reset-substantive-check-btn" class="w-full bg-red-600 text-white font-bold p-3 rounded-full hover:bg-red-700 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">refresh</span>
                    重新开始
                </button>
            </div>
        </div>
    </aside>
`;

const renderResults = () => {
    if (!state.checkResult) return '';

    const { noveltyAnalysis, inventiveStepAnalysis, issues } = state.checkResult;
    const totalIssues = issues.length;

    return `
        <div class="w-full max-w-5xl mx-auto">
            <div class="mb-8">
                <h3 class="text-3xl font-bold">实质质检完成</h3>
                <div class="flex justify-between items-center mt-2">
                    <p class="text-gray-500 dark:text-gray-400">
                        共发现 ${totalIssues} 个潜在的实质性问题。
                    </p>
                    <div class="flex items-center gap-2 text-lg">
                        <span class="material-symbols-outlined text-green-600 dark:text-green-400">payments</span>
                        <span class="font-semibold text-gray-700 dark:text-gray-200">本次质检AI消费:</span>
                        <span class="font-bold text-green-600 dark:text-green-400">¥ ${state.totalCost.toFixed(4)}</span>
                    </div>
                </div>
            </div>

            <div class="space-y-8">
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">新颖性分析摘要</h4>
                    <p class="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${noveltyAnalysis}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">创造性分析摘要</h4>
                    <p class="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${inventiveStepAnalysis}</p>
                </div>
                
                <div>
                    <h4 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 mt-10">潜在问题列表</h4>
                    ${issues.length > 0 ? issues.map(item => `
                        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
                            <details open class="group">
                                <summary class="flex justify-between items-center cursor-pointer list-none">
                                    <div class="flex items-center gap-4">
                                        <span class="font-bold text-lg text-gray-900 dark:text-gray-100">${item.claimNumber}</span>
                                        <span class="font-semibold ${item.issueType === '新颖性' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}">${item.issueType}</span>
                                    </div>
                                    <span class="material-symbols-outlined transition-transform duration-200 group-open:rotate-180">expand_more</span>
                                </summary>
                                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                                    <div>
                                        <h5 class="font-semibold text-gray-700 dark:text-gray-300 mb-1">相关对比文件:</h5>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">${item.referenceDocuments.join(', ')}</p>
                                    </div>
                                    <div>
                                        <h5 class="font-semibold text-gray-700 dark:text-gray-300 mb-1">问题分析:</h5>
                                        <p class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${item.reasoning}</p>
                                    </div>
                                    <div>
                                        <h5 class="font-semibold text-green-700 dark:text-green-400 mb-1">修改建议:</h5>
                                        <p class="text-sm text-green-600 dark:text-green-300 whitespace-pre-wrap">${item.suggestion}</p>
                                    </div>
                                </div>
                            </details>
                        </div>
                    `).join('') : '<p class="text-gray-500 dark:text-gray-400">未发现具体的实质性问题。</p>'}
                </div>
            </div>
        </div>
    `;
};


const renderContent = () => {
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
        return renderResults();
    }

    return `
        <div class="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <span class="material-symbols-outlined text-6xl mb-4">gavel</span>
            <h3 class="text-xl font-semibold">准备开始实质质检</h3>
            <p>请在左侧上传一份申请文件和至少一份对比文件，然后点击“开始质检”。</p>
        </div>
    `;
};


const updateDOM = () => {
    const ids = ['substantive-check-application', 'substantive-check-references'];
    ids.forEach(id => {
        const fileListContainer = document.getElementById(`${id}-file-list`);
        if (!fileListContainer) return;

        const files = id === 'substantive-check-references' ? state.files.references : (state.files.application ? [state.files.application] : []);

        fileListContainer.innerHTML = files.map(f => `
            <div class="bg-gray-200 dark:bg-gray-700 p-1 px-2 rounded-md text-xs flex justify-between items-center transition-all">
                <span class="material-symbols-outlined text-base mr-2 text-gray-500 dark:text-gray-400">description</span>
                <span class="truncate flex-grow" title="${f.name}">${f.name}</span>
                <button class="remove-file-btn ml-2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white" data-input-id="${id}" data-filename="${f.name}" aria-label="移除 ${f.name}">
                    <span class="material-symbols-outlined text-sm pointer-events-none">close</span>
                </button>
            </div>
        `).join('<div class="h-1"></div>');
    });

    const startBtn = document.getElementById('start-substantive-check-btn') as HTMLButtonElement;
    if (startBtn) {
        startBtn.disabled = !state.files.application || state.files.references.length === 0;
    }
};


// --- EVENT HANDLERS & BINDING ---
const attachEventListeners = () => {
    const pageElement = document.getElementById('substantive-check-page');
    if (!pageElement) return;

    pageElement.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const contentContainer = document.getElementById('substantive-check-content-container');

        const startBtn = target.closest('#start-substantive-check-btn');
        if (startBtn) {
            setTimeout(async () => {
                state.isLoading = true;
                state.loadingStep = '正在准备文件...';
                state.checkResult = null;
                state.error = '';
                if (contentContainer) contentContainer.innerHTML = renderContent();
                
                await handleStartSubstantiveCheck();

                state.isLoading = false;
                state.loadingStep = null;
                if (contentContainer) contentContainer.innerHTML = renderContent();
            }, 0);
            return;
        }

        const resetBtn = target.closest('#reset-substantive-check-btn');
        if (resetBtn) {
            resetState();
            renderSubstantiveQualityCheckPage(document.getElementById('app')!);
            return;
        }

        const removeBtn = target.closest('.remove-file-btn');
        if (removeBtn) {
            const inputId = removeBtn.getAttribute('data-input-id');
            const filename = removeBtn.getAttribute('data-filename');
            if (!inputId || !filename) return;

            if (inputId === 'substantive-check-references') {
                state.files.references = state.files.references.filter(f => f.name !== filename);
            } else if (state.files.application?.name === filename) {
                state.files.application = null;
            }
            updateDOM();
            showToast(`文件 "${filename}" 已移除。`);
        }
    });

    const fileInputs = [
        document.getElementById('substantive-check-application'),
        document.getElementById('substantive-check-references')
    ];

    fileInputs.forEach(input => {
        if (!input) return;
        const handleFileChange = (files: FileList | null) => {
            if (!files) return;
            const inputId = input.id;
            if (inputId === 'substantive-check-references') {
                state.files.references.push(...Array.from(files));
            } else {
                state.files.application = files[0] || null;
            }
            updateDOM();
        };

        input.addEventListener('change', (e) => {
            handleFileChange((e.target as HTMLInputElement).files);
        });

        const dropArea = input.closest('[data-upload-area]');
        if (dropArea) {
            dropArea.addEventListener('dragover', (e) => e.preventDefault());
            dropArea.addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();
                if (e.dataTransfer) handleFileChange(e.dataTransfer.files);
            });
        }
    });

    updateDOM();
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
    attachEventListeners();
};