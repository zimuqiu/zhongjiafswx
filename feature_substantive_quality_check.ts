/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { renderSettingsDropdown, showToast, createFileUploadInput } from './shared_ui.ts';
import { generateContentWithRetry, getAi } from './shared_api.ts';

// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error('Failed to read file as base64 string.'));
        }
    };
    reader.onerror = error => reject(error);
});

const getMimeType = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes = {
        'pdf': 'application/pdf',
        'doc': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain',
    };
    return mimeTypes[extension] || 'application/octet-stream';
};


// --- FEATURE STATE ---
const getInitialState = () => ({
    files: {
        application: null as File | null,
        references: [] as File[],
    },
    isLoading: false,
    loadingStep: null as string | null,
    checkResult: null as { noveltyAnalysis: string; inventiveStepAnalysis: string; issues: any[] } | null,
    error: '',
    totalCost: 0,
});
let state = getInitialState();

const resetState = () => {
    state = getInitialState();
}

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

// --- LOGIC FUNCTIONS ---
const handleStartSubstantiveCheck = async () => {
    const ai = getAi();
    if (!ai) {
        showToast('AI服务初始化失败，请刷新页面重试。');
        return;
    }
    if (!state.files.application || state.files.references.length === 0) {
        showToast('请至少上传一份申请文件和一份对比文件。');
        return;
    }

    state.isLoading = true;
    state.loadingStep = '正在准备文件...';
    state.checkResult = null;
    state.error = '';
    
    const contentContainer = document.getElementById('substantive-check-content-container');
    if (contentContainer) contentContainer.innerHTML = renderContent();

    try {
        const fileToPart = async (file: File) => {
            const base64Data = await fileToBase64(file);
            return {
                inlineData: {
                    mimeType: getMimeType(file.name),
                    data: base64Data,
                },
            };
        };

        const updateLoadingStep = (message: string) => {
            state.loadingStep = message;
            const stepEl = document.getElementById('substantive-check-loading-step');
            if (stepEl) stepEl.textContent = message;
        };

        updateLoadingStep('正在转换申请文件...');
        const applicationPart = await fileToPart(state.files.application);
        const referenceParts = [];
        for (let i = 0; i < state.files.references.length; i++) {
            updateLoadingStep(`正在转换对比文件 ${i + 1}/${state.files.references.length}...`);
            const refFile = state.files.references[i];
            const refPart = await fileToPart(refFile);
            referenceParts.push({ text: `\n\n--- 对比文件 ${i+1} (${refFile.name}) ---\n` });
            referenceParts.push(refPart);
        }

        const prompt = `
# **角色**
你是一位经验极其丰富的中国专利审查员，拥有超过15年的实质审查经验，对专利法第22条的新颖性和创造性有深刻理解。你的任务是对一份发明专利申请进行全面的实质性质检。

# **战略目标/任务**
严格、客观地将“待检申请文件”的权利要求与一份或多份“对比文件”进行比较，以确定其是否满足新颖性（专利法第22条第2款）和创造性（专利法第22条第3款）的要求。

# **工作流程与分析框架**

## **1. 新颖性审查 (Novelty - Article 22.2)**
- **任务**: 逐一审查“待检申请文件”的每一项权利要求。
- **方法**: 将该权利要求的技术方案与**每一份**“对比文件”中公开的内容进行**单独比对**。
- **判断**: 如果某一项权利要求的所有技术特征被**某一份**对比文件**完全公开**，则该权利要求不具备新颖性。
- **记录**: 详细记录不具备新颖性的权利要求、对应的对比文件以及理由。

## **2. 创造性审查 (Inventive Step - Article 22.3)**
- **前提**: 只对具备新颖性的权利要求进行此项审查。
- **方法**:
    a. **确定最接近的现有技术**: 从所有对比文件中，找出一份与该权利要求技术领域相同、要解决的技术问题和技术效果最接近、且公开了最多技术特征的对比文件，将其作为“最接近的现有技术”。
    b. **确定区别特征和实际解决的技术问题**: 找出该权利要求相对于“最接近的现有技术”的区别技术特征，并基于该区别特征所带来的技术效果，客观地重新确定发明实际解决的技术问题。
    c. **判断非显而易见性**: 判断要求保护的发明对本领域的技术人员来说是否显而易见。重点判断：
        - 在“最接近的现有技术”的基础上，结合**其他对比文件**或**本领域的公知常识**，是否给出了将上述区别特征应用到最接近的现有技术中以解决该实际技术问题的**技术启示**。
        - 如果存在这种技术启示，则发明是显而易见的，不具备创造性。
- **记录**: 详细记录不具备创造性的权利要求、判断所依据的对比文件组合、以及详细的“三步法”论证过程。

# **输出要求**
你的最终输出**必须**是一个JSON对象，严格遵守所提供的模式。不要输出任何解释、注释或多余的文本。`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                noveltyAnalysis: {
                    type: Type.STRING,
                    description: "对新颖性审查的总体结论性摘要。"
                },
                inventiveStepAnalysis: {
                    type: Type.STRING,
                    description: "对创造性审查的总体结论性摘要。"
                },
                issues: {
                    type: Type.ARRAY,
                    description: "发现的具体问题列表。如果没有问题，则为空数组。",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            claimNumber: {
                                type: Type.STRING,
                                description: "存在问题的权利要求的编号，例如 '权利要求 1'。"
                            },
                            issueType: {
                                type: Type.STRING,
                                description: "问题类型，必须是 '新颖性' 或 '创造性' 之一。"
                            },
                            referenceDocuments: {
                                type: Type.ARRAY,
                                description: "导致该问题的对比文件的名称列表。",
                                items: { type: Type.STRING }
                            },
                            reasoning: {
                                type: Type.STRING,
                                description: "详细的分析和论证过程，解释为什么不具备新颖性或创造性。对于创造性，应包含三步法分析。"
                            },
                            suggestion: {
                                type: Type.STRING,
                                description: "针对该问题提出的修改或争辩建议。"
                            }
                        },
                        required: ["claimNumber", "issueType", "referenceDocuments", "reasoning", "suggestion"]
                    }
                }
            },
            required: ["noveltyAnalysis", "inventiveStepAnalysis", "issues"]
        };

        updateLoadingStep('正在调用AI进行分析...');
        const contents = { parts: [{ text: prompt }, { text: `\n\n--- 待检申请文件 (${state.files.application.name}) ---\n` }, applicationPart, ...referenceParts] };
        
        const { response, cost } = await generateContentWithRetry({
            model: 'gemini-2.5-pro',
            contents: contents,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });

        state.totalCost = cost;
        try {
            state.checkResult = JSON.parse(response.text.trim());
        } catch (e) {
            console.error("Failed to parse AI response:", response.text);
            throw new Error("模型返回了无效的数据格式。");
        }
        showToast('实质质检完成！');

    } catch (error) {
        const err = error as Error;
        state.error = err.message;
        showToast(`质检失败: ${state.error}`, 5000);
    } finally {
        state.isLoading = false;
        state.loadingStep = null;
        if (contentContainer) contentContainer.innerHTML = renderContent();
    }
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

        const startBtn = target.closest('#start-substantive-check-btn');
        if (startBtn) {
            handleStartSubstantiveCheck();
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
