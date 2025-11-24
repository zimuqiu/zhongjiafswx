/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as docx from 'docx';
import saveAs from 'file-saver';
import { showToast, createFileUploadInput, renderSettingsDropdown } from './shared_ui.ts';
import {
    // FIX: Changed import from 'oaReplyState' to 'oaReplyStore' as per the exported member name.
    oaReplyStore,
    resetOAReplyState,
    handleStartAnalysis,
    generateAmendmentExplanation,
    generateTechnicalProblemAnalysis,
    generateNonObviousnessAnalysis,
    generateFinalResponse,
    handleOneClickGeneration,
    oaHistoryDb
} from './feature_oa_reply.ts';


// --- RENDER FUNCTIONS / VIEWS ---

const oaNavItems = [
    { id: 'upload-files', label: '上传文件', icon: 'upload_file' },
    { id: 'distinguishing-features', label: '确定区别特征', icon: 'difference' },
    { id: 'amendment-explanation', label: '修改说明', icon: 'edit_document' },
    { id: 'technical-problem', label: '确定技术问题', icon: 'biotech' },
    { id: 'non-obviousness', label: '非显而易见性分析', icon: 'lightbulb' },
    { id: 'final-response', label: '最终答复文件', icon: 'assignment_turned_in' },
];

const renderOANav = () => {
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();
    const currentStep = state.currentStep;
    // If currentStep is 'history', no nav item should be highlighted, or maybe we treat it differently.
    // For now, let's just check if currentStep matches any nav item ID.
    
    const isHistoryView = currentStep === 'history';
    const historyBtnText = isHistoryView ? '返回分析' : '历史记录';
    const historyBtnIcon = isHistoryView ? 'arrow_back' : 'history';

    return `
        <nav class="h-full bg-gray-50 dark:bg-gray-800 w-72 p-4 flex flex-col border-r border-gray-200 dark:border-gray-700 shrink-0">
            <ul class="flex flex-col gap-2">
                ${oaNavItems.map(item => `
                    <li>
                        <a href="#" class="flex items-center gap-3 p-3 rounded-md transition-colors ${currentStep === item.id ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}" data-step="${item.id}">
                            <span class="material-symbols-outlined">${item.icon}</span>
                            <span>${item.label}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>
            <div class="mt-auto space-y-4">
                <button id="view-oa-history-btn" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">${historyBtnIcon}</span>
                    ${historyBtnText}
                </button>
                <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                     <button id="restart-oa" class="w-full flex items-center justify-center gap-2 p-3 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 transition-colors">
                        <span class="material-symbols-outlined">refresh</span>
                        重新开始
                    </button>
                </div>
            </div>
        </nav>
    `;
}

const renderUploadFilesContent = () => `
    <div class="w-full max-w-4xl mx-auto">
        <h3 class="text-2xl font-bold mb-6">上传文件</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${createFileUploadInput('application', '发明申请文件')}
            ${createFileUploadInput('officeAction', '审查意见通知书')}
            ${createFileUploadInput('reference1', '对比文件1')}
            ${createFileUploadInput('otherReferences', '其他对比文件', true)}
        </div>
        <div class="mt-8 text-center">
            <button id="start-analysis-btn" class="bg-blue-600 text-white font-bold py-4 px-12 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                开始分析
            </button>
        </div>
    </div>
`;

const renderDistinguishingFeaturesContent = () => {
    const title = '确定区别特征';
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();

    if (state.isLoading) {
        // If loading, check if it's specifically for feature analysis or the one-click process
        const loadingMessage = state.loadingStep === 'distinguishing-features' 
            ? '正在分析中，请稍候...' 
            : (state.loadingStep || '正在处理...');
            
        return `
         <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg">
                <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                <p class="mt-4 text-gray-700 dark:text-gray-300">${loadingMessage}</p>
            </div>
         </div>
        `;
    }

    if (state.analysisResult) { // This now primarily serves to show error messages
        return `
         <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="prose dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-6 rounded-lg border border-red-500/50">
               <p class="text-red-500 dark:text-red-400">抱歉，分析过程中出现错误：</p>
               <p>${state.analysisResult}</p>
            </div>
         </div>
        `;
    }
    
    if (!state.distinguishingFeatures || state.distinguishingFeatures.length === 0) {
        return `
         <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
               <p>未找到可供选择的区别技术特征。请返回上一步检查上传的文件。</p>
            </div>
         </div>
        `;
    }
    
    const getRecommendationBadge = (recommendation) => {
        switch (recommendation) {
            case '强烈推荐': return `<span class="bg-green-600 text-green-100 text-xs font-bold me-2 px-3 py-1 rounded-full">强烈推荐</span>`;
            case '推荐': return `<span class="bg-blue-600 text-blue-100 text-xs font-bold me-2 px-3 py-1 rounded-full">推荐</span>`;
            case '不推荐': return `<span class="bg-gray-500 text-gray-100 text-xs font-bold me-2 px-3 py-1 rounded-full">不推荐</span>`;
            default: return `<span class="bg-yellow-600 text-yellow-100 text-xs font-bold me-2 px-3 py-1 rounded-full">${recommendation}</span>`;
        }
    };

    const claimFeatures = state.distinguishingFeatures.filter(f => f.category === 'claim');
    const specificationFeatures = state.distinguishingFeatures.filter(f => f.category === 'specification');

    const renderFeatureList = (features, title) => {
        if (features.length === 0) return '';
        return `
            <div class="mt-6">
                <h4 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">${title}</h4>
                <div class="space-y-4">
                    ${features.map(item => {
                        const originalIndex = state.distinguishingFeatures.indexOf(item);
                        const isChecked = state.selectedFeatures.some(sf => sf.feature === item.feature);
                        return `
                            <div class="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-200 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-500/5 dark:has-[:checked]:bg-gray-800/50">
                                <div class="flex items-start gap-4">
                                    <input type="checkbox" id="feature-${originalIndex}" name="selected-feature" class="mt-1.5 h-5 w-5 shrink-0 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-600 focus:ring-2 cursor-pointer" ${isChecked ? 'checked' : ''}>
                                    <div class="flex-1">
                                        <label for="feature-${originalIndex}" class="font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">${item.feature}</label>
                                        <div class="mt-3">
                                            <p class="text-sm font-semibold text-blue-500 dark:text-blue-400 mb-1">特征出处</p>
                                            <p class="text-sm text-gray-500 dark:text-gray-400">${item.source}</p>
                                        </div>
                                        <div class="mt-4">
                                            <p class="text-sm font-semibold text-blue-500 dark:text-blue-400 mb-1">技术效果</p>
                                            <p class="text-sm text-gray-500 dark:text-gray-400">${item.beneficialEffect}</p>
                                        </div>
                                        <div class="mt-4 flex items-center gap-3">
                                            <p class="text-sm font-semibold text-blue-500 dark:text-blue-400">决策建议</p>
                                            ${getRecommendationBadge(item.recommendation)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    return `
     <div class="w-full max-w-4xl mx-auto">
        <h3 class="text-2xl font-bold mb-6">${title}</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6">以下是AI分析得出的区别技术特征。请选择您希望在答复中采用的特征，可从两组中任意选择：</p>
        <div id="features-list">
            ${renderFeatureList(claimFeatures, 'A. 现有权要中已被审查员指出的区别特征')}
            ${renderFeatureList(specificationFeatures, 'B. 说明书记载但未写入权利要求的技术特征')}
        </div>
        <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button id="confirm-features-btn" class="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors">
                确认选择并进入下一步
            </button>
            <button id="one-click-generate-btn" class="w-full sm:w-auto bg-purple-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                <span class="material-symbols-outlined">auto_fix_high</span>
                一键生成最终答复
            </button>
        </div>
     </div>
    `;
}

const renderAmendmentExplanationContent = () => {
    const title = '修改说明';
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();

    if (state.isLoading && state.loadingStep === 'amendment-explanation') {
        return `
         <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg">
                <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                <p class="mt-4 text-gray-700 dark:text-gray-300">正在生成修改说明，请稍候...</p>
            </div>
         </div>
        `;
    }

    return `
        <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">AI已根据您选择的区别特征生成了权利要求修改说明的草稿。请在此基础上进行编辑和完善。</p>
            <textarea id="amendment-explanation-text" rows="18" class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-700 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500 transition-colors">${state.amendmentExplanationText}</textarea>
            <div class="mt-8 text-center">
                <button id="confirm-amendment-btn" class="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors">
                    确认并进入下一步
                </button>
            </div>
        </div>
    `;
};

const renderTechnicalProblemContent = () => {
    const title = '确定技术问题';
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();
    
    if (state.isLoading && state.loadingStep === 'technical-problem') {
        return `
         <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg">
                <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                <p class="mt-4 text-gray-700 dark:text-gray-300">正在生成分析内容，请稍候...</p>
            </div>
         </div>
        `;
    }

    return `
        <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="space-y-8">
                <div>
                    <label for="features-summary" class="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">1. 区别技术特征汇总</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">将选择的技术特征汇总成一段文字，作为答复意见的正式部分。</p>
                    <textarea id="features-summary" rows="5" class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-700 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500 transition-colors">${state.technicalProblemFeaturesSummary}</textarea>
                </div>
                <div>
                    <label for="technical-problem-statement" class="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">2. 确定技术问题</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">根据区别特征，用简洁的语言概括本发明实际解决的技术问题。</p>
                    <textarea id="technical-problem-statement" rows="3" class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-700 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500 transition-colors">${state.technicalProblemStatement}</textarea>
                </div>
                <div>
                    <label for="effects-analysis" class="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">3. 有益效果分析</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">详细分析每个区别特征是如何解决上述技术问题，并带来了何种有益效果。</p>
                    <textarea id="effects-analysis" rows="8" class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-700 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500 transition-colors">${state.technicalProblemEffectsAnalysis}</textarea>
                </div>
            </div>
            <div class="mt-8 text-center">
                <button id="confirm-problem-btn" class="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors">
                    确认并进入下一步
                </button>
            </div>
        </div>
    `;
};

const renderNonObviousnessContent = () => {
    const title = '非显而易见性分析';
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();

    if (state.isLoading && state.loadingStep === 'non-obviousness') {
        return `
         <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg">
                <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                <p class="mt-4 text-gray-700 dark:text-gray-300">正在生成非显而易见性分析，请稍候...</p>
            </div>
         </div>
        `;
    }

    return `
        <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">AI已根据“三步法”生成非显而易见性分析草稿。请在此基础上进行编辑和完善，以构建最终的法律论证。</p>
            <textarea id="non-obviousness-analysis" rows="18" class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-700 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500 transition-colors">${state.nonObviousnessAnalysisText}</textarea>
            <div class="mt-8 text-center">
                <button id="confirm-non-obviousness-btn" class="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors">
                    确认并生成最终答复文件
                </button>
            </div>
        </div>
    `;
};

const renderFinalResponseContent = () => {
    const title = '最终答复文件';
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();

    if (state.isLoading && state.loadingStep === 'final-response') {
        return `
         <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg">
                <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                <p class="mt-4 text-gray-700 dark:text-gray-300">正在生成最终答复文件，请稍候...</p>
            </div>
         </div>
        `;
    }

    return `
        <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="bg-blue-50 dark:bg-gray-800/50 border border-blue-200 dark:border-gray-700 p-4 rounded-lg mb-6 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">monetization_on</span>
                    <span class="font-semibold text-gray-800 dark:text-gray-200">本次OA答复AI消费总计:</span>
                </div>
                <span class="text-xl font-bold text-blue-600 dark:text-blue-400">¥ ${state.totalCost.toFixed(4)}</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">AI已生成最终答复文件草稿。请在此基础上进行最终的编辑和完善，然后导出为Word文件。</p>
            <textarea id="final-response-text" rows="20" class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-700 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500 transition-colors">${state.finalResponseText}</textarea>
            <div class="mt-8 text-center">
                <button id="export-word-btn" class="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto">
                    <span class="material-symbols-outlined">download</span>
                    导出Word文件
                </button>
            </div>
        </div>
    `;
};

const renderHistoryListContent = (history) => {
    const title = '历史记录';
    if (history.length === 0) {
        return `
            <div class="w-full max-w-4xl mx-auto">
                <h3 class="text-2xl font-bold mb-6">${title}</h3>
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg text-center">
                    <p class="text-gray-500 dark:text-gray-400">暂无历史记录。</p>
                </div>
            </div>
        `;
    }
    return `
        <div class="w-full max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold mb-6">${title}</h3>
            <div class="space-y-4">
                ${history.map(entry => `
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-gray-200" title="${entry.files.application || '无申请文件'}">${entry.files.application || '未命名会话'}</p>
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
}

const renderHistoryDetailContent = (entry) => {
    const title = '历史记录详情';
    const allFiles = [
        { label: '发明申请文件', name: entry.files.application },
        { label: '审查意见通知书', name: entry.files.officeAction },
        { label: '对比文件1', name: entry.files.reference1 },
        ...(entry.files.otherReferences || []).map((name, i) => ({ label: `其他对比文件 ${i+1}`, name })),
    ].filter(f => f.name);

    return `
        <div class="w-full max-w-4xl mx-auto">
            <div class="flex items-center gap-4 mb-6">
                <button id="back-to-history-list" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回历史列表">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <h3 class="text-2xl font-bold">${title}</h3>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg space-y-6">
                <div>
                    <h4 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">会话信息</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400"><strong>创建时间:</strong> ${entry.date}</p>
                </div>
                <div>
                    <h4 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">使用文件</h4>
                    <ul class="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        ${allFiles.length > 0 ? allFiles.map(f => `<li><strong>${f.label}:</strong> ${f.name}</li>`).join('') : '<li>未记录文件信息。</li>'}
                    </ul>
                </div>
                <div>
                    <h4 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">最终答复文件内容</h4>
                    <textarea readonly class="w-full h-96 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-700 dark:text-gray-300 font-mono text-sm">${entry.finalResponseText}</textarea>
                </div>
            </div>
        </div>
    `;
}

const renderHistoryContent = () => {
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();
    if (state.selectedHistoryId) {
        const history = oaHistoryDb.getHistory();
        const entry = history.find(item => item.id === state.selectedHistoryId);
        return entry ? renderHistoryDetailContent(entry) : '<p>未找到该历史记录。</p>';
    } else {
        const history = oaHistoryDb.getHistory();
        return renderHistoryListContent(history);
    }
}

const renderOAContent = () => {
    // FIX: Access state via oaReplyStore.getState()
    const currentStep = oaReplyStore.getState().currentStep;
    switch (currentStep) {
        case 'upload-files':
            return renderUploadFilesContent();
        case 'distinguishing-features':
            return renderDistinguishingFeaturesContent();
        case 'amendment-explanation':
            return renderAmendmentExplanationContent();
        case 'technical-problem':
            return renderTechnicalProblemContent();
        case 'non-obviousness':
            return renderNonObviousnessContent();
        case 'final-response':
            return renderFinalResponseContent();
        case 'history':
            return renderHistoryContent();
        default:
            return `<div class="w-full max-w-4xl mx-auto"><h3 class="text-2xl font-bold mb-6">${oaNavItems.find(i => i.id === currentStep)?.label}</h3><p>此功能正在开发中。</p></div>`;
    }
}


// --- UI UPDATE & EVENT HANDLERS ---

const updateOANavClasses = () => {
    const navContainer = document.querySelector('#oa-reply-page nav');
    if (!navContainer) return;

    // FIX: Access state via oaReplyStore.getState()
    const currentStep = oaReplyStore.getState().currentStep;
    const allLinks = navContainer.querySelectorAll('a[data-step]');

    allLinks.forEach(link => {
        const linkEl = link as HTMLElement;
        const linkStep = linkEl.dataset.step;
        if (linkStep === currentStep) {
            linkEl.classList.add('bg-blue-600', 'text-white', 'font-semibold');
            linkEl.classList.remove('hover:bg-gray-200', 'dark:hover:bg-gray-700');
        } else {
            linkEl.classList.remove('bg-blue-600', 'text-white', 'font-semibold');
            linkEl.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-700');
        }
    });
};

const updateFileListsDOM = () => {
    const fileInputIds = ['application', 'officeAction', 'reference1', 'otherReferences'];
    fileInputIds.forEach(id => {
        const fileListContainer = document.getElementById(`${id}-file-list`);
        if (!fileListContainer) return;

        // FIX: Access state via oaReplyStore.getState()
        const files = id === 'otherReferences'
            ? oaReplyStore.getState().files.otherReferences
            : (oaReplyStore.getState().files[id] ? [oaReplyStore.getState().files[id]] : []);

        fileListContainer.innerHTML = files.map(f => `
            <div class="bg-gray-200 dark:bg-gray-700 p-1 px-2 rounded-md text-xs flex justify-between items-center transition-all">
                <span class="material-symbols-outlined text-base mr-2 text-gray-500 dark:text-gray-400">description</span>
                <span class="truncate flex-grow" title="${f.name}">${f.name}</span>
                <button class="remove-file-btn ml-2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500" data-input-id="${id}" data-filename="${f.name}" aria-label="移除 ${f.name}">
                    <span class="material-symbols-outlined text-sm pointer-events-none">close</span>
                </button>
            </div>
        `).join('');
    });
};

const updateStartAnalysisButtonState = () => {
    const startBtn = document.getElementById('start-analysis-btn') as HTMLButtonElement;
    if (startBtn) {
        // FIX: Access state via oaReplyStore.getState()
        const { application, officeAction, reference1 } = oaReplyStore.getState().files;
        startBtn.disabled = !(application && officeAction && reference1);
    }
};

const updateOAReplyView = () => {
    updateOANavClasses();
    const contentContainer = document.getElementById('oa-content-container');
    if (contentContainer) {
        contentContainer.innerHTML = renderOAContent();
    }
    attachOAContentEventListeners();
};

const attachOAContentEventListeners = () => {
    // FIX: Access state via oaReplyStore.getState()
    const state = oaReplyStore.getState();
    // Step-specific listeners
    if (state.currentStep === 'upload-files') {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const files = target.files ? Array.from(target.files) : [];
                const inputId = target.id;

                if (inputId === 'otherReferences') {
                    // FIX: Update state via oaReplyStore.setState() by creating a new array
                    oaReplyStore.setState(prevState => ({ files: { ...prevState.files, otherReferences: [...prevState.files.otherReferences, ...files] } }));
                } else {
                    // FIX: Update state via oaReplyStore.setState()
                    oaReplyStore.setState(prevState => ({ files: { ...prevState.files, [inputId]: files[0] || null } }));
                }
                updateFileListsDOM();
                updateStartAnalysisButtonState();
            });
        });

        const dropAreas = document.querySelectorAll('[data-upload-area]');
        dropAreas.forEach(area => {
            area.addEventListener('dragover', (e) => e.preventDefault());
            area.addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();
                const input = area.querySelector('input[type="file"]') as HTMLInputElement;
                if (input && e.dataTransfer) {
                    input.files = e.dataTransfer.files;
                    const changeEvent = new Event('change', { bubbles: true });
                    input.dispatchEvent(changeEvent);
                }
            });
        });
        
        const startBtn = document.getElementById('start-analysis-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                // Use setTimeout to decouple from the click event's lifecycle
                setTimeout(async () => {
                    // FIX: Update state via oaReplyStore.setState()
                    oaReplyStore.setState({ isLoading: true, loadingStep: 'distinguishing-features', currentStep: 'distinguishing-features' });
                    updateOAReplyView(); // Render loading view

                    try {
                        await handleStartAnalysis();
                    } catch (error) {
                        showToast(`分析失败: ${(error as Error).message}`, 5000);
                    } finally {
                        // FIX: Update state via oaReplyStore.setState()
                        oaReplyStore.setState({ isLoading: false, loadingStep: null });
                        updateOAReplyView(); // Render results or error view
                    }
                }, 0);
            });
        }
        
        updateFileListsDOM();
        updateStartAnalysisButtonState();
    }
    
    if (state.currentStep === 'distinguishing-features') {
        // Helper function to save selected features from DOM to State
        const saveSelectedFeatures = () => {
            const selectedCheckboxes = document.querySelectorAll('#features-list input[type="checkbox"]:checked');
            const newSelectedFeatures = Array.from(selectedCheckboxes).map(cb => {
                const index = parseInt((cb as HTMLElement).id.split('-')[1], 10);
                return oaReplyStore.getState().distinguishingFeatures[index];
            });

            const oldSelectionJSON = JSON.stringify(oaReplyStore.getState().selectedFeatures.map(f => f.feature).sort());
            const newSelectionJSON = JSON.stringify(newSelectedFeatures.map(f => f.feature).sort());
            const selectionChanged = oldSelectionJSON !== newSelectionJSON;

            const newState: any = { selectedFeatures: newSelectedFeatures };

            if (selectionChanged) {
                newState.amendmentExplanationText = '';
                newState.technicalProblemFeaturesSummary = '';
                newState.technicalProblemStatement = '';
                newState.technicalProblemEffectsAnalysis = '';
                newState.nonObviousnessAnalysisText = '';
                newState.finalResponseText = '';
            }
            
            oaReplyStore.setState(newState);
            return newSelectedFeatures;
        };

        const confirmBtn = document.getElementById('confirm-features-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const features = saveSelectedFeatures();
                if (features.length === 0) {
                    showToast('请至少选择一个区别技术特征。');
                    return;
                }

                if (!oaReplyStore.getState().amendmentExplanationText) {
                    setTimeout(async () => {
                        oaReplyStore.setState({ isLoading: true, loadingStep: 'amendment-explanation', currentStep: 'amendment-explanation' });
                        updateOAReplyView();
                        try {
                            await generateAmendmentExplanation();
                        } catch (error) {
                            console.error("Failed to generate amendment explanation:", error);
                        } finally {
                            oaReplyStore.setState({ isLoading: false, loadingStep: null });
                            updateOAReplyView();
                        }
                    }, 0);
                } else {
                    oaReplyStore.setState({ currentStep: 'amendment-explanation' });
                    updateOAReplyView();
                }
            });
        }

        const oneClickBtn = document.getElementById('one-click-generate-btn');
        if (oneClickBtn) {
            oneClickBtn.addEventListener('click', () => {
                const features = saveSelectedFeatures();
                if (features.length === 0) {
                    showToast('请至少选择一个区别技术特征。');
                    return;
                }

                // Start the chain
                setTimeout(async () => {
                    // Trigger loading UI immediately
                    oaReplyStore.setState({ isLoading: true, loadingStep: '正在启动一键生成...' });
                    updateOAReplyView();

                    try {
                        await handleOneClickGeneration();
                        // Upon success, move to final step
                        oaReplyStore.setState({ currentStep: 'final-response', isLoading: false, loadingStep: null });
                        updateOAReplyView();
                        showToast('一键生成完成！');
                    } catch (error) {
                        console.error("One-click generation failed:", error);
                        oaReplyStore.setState({ isLoading: false, loadingStep: null });
                        updateOAReplyView();
                        showToast(`生成中断: ${(error as Error).message}`, 5000);
                    }
                }, 0);
            });
        }
    }
    
    if (state.currentStep === 'amendment-explanation') {
        const confirmBtn = document.getElementById('confirm-amendment-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const newText = (document.getElementById('amendment-explanation-text') as HTMLTextAreaElement).value;
                // FIX: Access state via oaReplyStore.getState()
                const contentChanged = newText !== oaReplyStore.getState().amendmentExplanationText;
                
                const newState: any = { amendmentExplanationText: newText };

                if (contentChanged) {
                    newState.technicalProblemFeaturesSummary = '';
                    newState.technicalProblemStatement = '';
                    newState.technicalProblemEffectsAnalysis = '';
                    newState.nonObviousnessAnalysisText = '';
                    newState.finalResponseText = '';
                }

                // FIX: Update state via oaReplyStore.setState()
                oaReplyStore.setState(newState);

                // FIX: Access state via oaReplyStore.getState()
                if (!oaReplyStore.getState().technicalProblemFeaturesSummary) {
                    setTimeout(async () => {
                        // FIX: Update state via oaReplyStore.setState()
                        oaReplyStore.setState({ isLoading: true, loadingStep: 'technical-problem', currentStep: 'technical-problem' });
                        updateOAReplyView();
                        try {
                            await generateTechnicalProblemAnalysis();
                        } catch (error) {
                            console.error("Failed to generate technical problem analysis:", error);
                        } finally {
                            // FIX: Update state via oaReplyStore.setState()
                            oaReplyStore.setState({ isLoading: false, loadingStep: null });
                            updateOAReplyView();
                        }
                    }, 0);
                } else {
                    // FIX: Update state via oaReplyStore.setState()
                    oaReplyStore.setState({ currentStep: 'technical-problem' });
                    updateOAReplyView();
                }
            });
        }
    }

    if (state.currentStep === 'technical-problem') {
        const confirmBtn = document.getElementById('confirm-problem-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const newSummary = (document.getElementById('features-summary') as HTMLTextAreaElement).value;
                const newStatement = (document.getElementById('technical-problem-statement') as HTMLTextAreaElement).value;
                const newAnalysis = (document.getElementById('effects-analysis') as HTMLTextAreaElement).value;

                // FIX: Access state via oaReplyStore.getState()
                const currentState = oaReplyStore.getState();
                const contentChanged = newSummary !== currentState.technicalProblemFeaturesSummary ||
                                        newStatement !== currentState.technicalProblemStatement ||
                                        newAnalysis !== currentState.technicalProblemEffectsAnalysis;

                const newState: any = {
                    technicalProblemFeaturesSummary: newSummary,
                    technicalProblemStatement: newStatement,
                    technicalProblemEffectsAnalysis: newAnalysis
                };

                if (contentChanged) {
                    newState.nonObviousnessAnalysisText = '';
                    newState.finalResponseText = '';
                }

                // FIX: Update state via oaReplyStore.setState()
                oaReplyStore.setState(newState);

                // FIX: Access state via oaReplyStore.getState()
                if (!oaReplyStore.getState().nonObviousnessAnalysisText) {
                    setTimeout(async () => {
                        // FIX: Update state via oaReplyStore.setState()
                        oaReplyStore.setState({ isLoading: true, loadingStep: 'non-obviousness', currentStep: 'non-obviousness' });
                        updateOAReplyView();
                        try {
                            await generateNonObviousnessAnalysis();
                        } catch (error) {
                            console.error("Failed to generate non-obviousness analysis:", error);
                        } finally {
                            // FIX: Update state via oaReplyStore.setState()
                            oaReplyStore.setState({ isLoading: false, loadingStep: null });
                            updateOAReplyView();
                        }
                    }, 0);
                } else {
                    // FIX: Update state via oaReplyStore.setState()
                    oaReplyStore.setState({ currentStep: 'non-obviousness' });
                    updateOAReplyView();
                }
            });
        }
    }
    
    if (state.currentStep === 'non-obviousness') {
        const confirmBtn = document.getElementById('confirm-non-obviousness-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const newAnalysisText = (document.getElementById('non-obviousness-analysis') as HTMLTextAreaElement).value;
                // FIX: Access state via oaReplyStore.getState()
                const contentChanged = newAnalysisText !== oaReplyStore.getState().nonObviousnessAnalysisText;
                
                const newState: any = { nonObviousnessAnalysisText: newAnalysisText };

                if (contentChanged) {
                    newState.finalResponseText = '';
                }
                
                // FIX: Update state via oaReplyStore.setState()
                oaReplyStore.setState(newState);
                
                // FIX: Access state via oaReplyStore.getState()
                if (!oaReplyStore.getState().finalResponseText) {
                     setTimeout(async () => {
                        // FIX: Update state via oaReplyStore.setState()
                        oaReplyStore.setState({ isLoading: true, loadingStep: 'final-response', currentStep: 'final-response' });
                        updateOAReplyView();
                        try {
                            await generateFinalResponse();
                        } catch (error) {
                             console.error("Failed to generate final response:", error);
                        } finally {
                            // FIX: Update state via oaReplyStore.setState()
                            oaReplyStore.setState({ isLoading: false, loadingStep: null });
                            updateOAReplyView();
                        }
                    }, 0);
                } else {
                    // FIX: Update state via oaReplyStore.setState()
                    oaReplyStore.setState({ currentStep: 'final-response' });
                    updateOAReplyView();
                }
            });
        }
    }

    if (state.currentStep === 'final-response') {
        const exportBtn = document.getElementById('export-word-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const finalResponseText = (document.getElementById('final-response-text') as HTMLTextAreaElement).value;

                try {
                    const paragraphs = finalResponseText.split('\n').map(line =>
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: line,
                                    font: '宋体',
                                    size: 24, // 12pt (小四)
                                })
                            ],
                            spacing: {
                                line: 360, // 1.5 line spacing
                            },
                            indent: {
                                firstLine: 480, // Two-character indent
                            },
                            alignment: docx.AlignmentType.JUSTIFIED,
                        })
                    );

                    const doc = new docx.Document({
                        sections: [{
                            properties: {},
                            children: paragraphs,
                        }],
                    });

                    docx.Packer.toBlob(doc).then(blob => {
                        saveAs(blob, "最终答复文件.docx");
                        showToast('文件已开始下载！');
                    });
                } catch (error) {
                    console.error("Error creating Word document:", error);
                    showToast('导出Word文件时出错，请检查控制台获取更多信息。');
                }
            });
        }
    }

    if (state.currentStep === 'history') {
        const detailButtons = document.querySelectorAll('.view-history-detail-btn');
        detailButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const currentTarget = e.currentTarget as HTMLElement;
                const id = currentTarget.dataset.historyId;
                if (id) {
                    // FIX: Update state via oaReplyStore.setState()
                    oaReplyStore.setState({ selectedHistoryId: parseInt(id, 10) });
                    updateOAReplyView();
                }
            });
        });

        const backBtn = document.getElementById('back-to-history-list');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                // FIX: Update state via oaReplyStore.setState()
                oaReplyStore.setState({ selectedHistoryId: null });
                updateOAReplyView();
            });
        }
    }
};

export const renderOaReplyPage = (appContainer: HTMLElement) => {
    appContainer.innerHTML = `
        <div id="oa-reply-page" class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
            <header class="flex justify-between items-center gap-4 p-4 md:p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-2xl font-bold">OA答复</h2>
                </div>
                ${renderSettingsDropdown()}
            </header>
            <div class="flex flex-grow overflow-hidden">
                ${renderOANav()}
                <main class="flex-grow p-8 overflow-y-auto" id="oa-content-container">
                    ${renderOAContent()}
                </main>
            </div>
        </div>
    `;
    
    const pageElement = document.getElementById('oa-reply-page');
    if (!pageElement) return () => {};

    const clickHandler = (e: Event) => {
        const target = e.target as HTMLElement;

        // Nav Items
        const navLink = target.closest('nav a[data-step]');
        if (navLink) {
            e.preventDefault();
            const step = (navLink as HTMLElement).dataset.step;
            // FIX: Access state via oaReplyStore.getState()
            if (step && step !== oaReplyStore.getState().currentStep) {
                // FIX: Update state via oaReplyStore.setState()
                if (step === 'history') {
                    oaReplyStore.setState({ selectedHistoryId: null }); 
                }
                oaReplyStore.setState({ currentStep: step });
                updateOAReplyView();
            }
            return;
        }

        // History Button (Bottom Sidebar)
        const historyBtn = target.closest('#view-oa-history-btn');
        if (historyBtn) {
            e.preventDefault();
            const state = oaReplyStore.getState();
            if (state.currentStep !== 'history') {
                oaReplyStore.setState({ currentStep: 'history', selectedHistoryId: null });
                updateOAReplyView();
            } else {
                // Toggle back to upload files if already on history
                oaReplyStore.setState({ currentStep: 'upload-files' });
                updateOAReplyView();
            }
            return;
        }

        const restartBtn = target.closest('#restart-oa');
        if (restartBtn) {
            resetOAReplyState();
            updateOAReplyView();
            return;
        }

        const removeBtn = target.closest('.remove-file-btn');
        if (removeBtn) {
            const inputId = removeBtn.getAttribute('data-input-id');
            const filename = removeBtn.getAttribute('data-filename');
            if (!inputId || !filename) return;

            // FIX: Access state via oaReplyStore.getState()
            const { files: currentFileState } = oaReplyStore.getState();
            let updatedFiles;
            let fileRemoved = false;
            
            if (inputId === 'otherReferences') {
                const newOtherRefs = currentFileState.otherReferences.filter(f => f.name !== filename);
                if (newOtherRefs.length < currentFileState.otherReferences.length) {
                    updatedFiles = { ...currentFileState, otherReferences: newOtherRefs };
                    fileRemoved = true;
                }
            } else if (currentFileState[inputId] && (currentFileState[inputId] as File).name === filename) {
                updatedFiles = { ...currentFileState, [inputId]: null };
                fileRemoved = true;
            }
            
            if (fileRemoved && updatedFiles) {
                // FIX: Update state via oaReplyStore.setState()
                oaReplyStore.setState({ files: { ...updatedFiles } });
                updateFileListsDOM();
                updateStartAnalysisButtonState();
                showToast(`文件 "${filename}" 已移除。`);
            }
        }
    };
    pageElement.addEventListener('click', clickHandler);
    
    updateOAReplyView();
    // FIX: Return an unsubscribe function to be used by the router to prevent memory leaks.
    return () => pageElement.removeEventListener('click', clickHandler);
};