/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';
import { formalCheckHistoryDb } from './shared_formal_check_db.ts';
import { showToast, createFileUploadInput, renderSettingsDropdown } from './shared_ui.ts';
import { generateContentWithRetry, getAi } from './shared_api.ts';

// Set up PDF.js worker to run in the background
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs';

// --- FEATURE STATE ---
const getInitialFormalCheckState = () => ({
    file: null as File | null,
    isLoading: false,
    loadingStep: null as string | null,
    checkResult: [] as any[],
    error: '',
    viewMode: 'main' as 'main' | 'historyList' | 'historyDetail',
    selectedHistoryId: null as number | null,
    totalCost: 0,
});
let formalCheckState = getInitialFormalCheckState();

export const resetFormalCheckState = () => {
    formalCheckState = getInitialFormalCheckState();
};

// --- FEATURE CONSTANTS ---
const formalCheckCategories = [
    {
        category: '摘要',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. 技术领域需与说明书中技术领域保持一致 (未质检)
2. 案件名称需与发明名称一致
3. 字数（含标点）不得超过300字
`
    },
    {
        category: '权利要求书',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. 检查从属权利要求是否缺乏引用基础。
2. 独立权利要求和从属权利要求的总项数是否为10项。
3. 独立权利要求的总项数是否超过3项。
4. 产品类独立权利要求是否正确划界，将与现有技术相同的特征写入前序部分，并在特征部分对前序部分中的特征作进一步限定。 (未质检)
5. 权利要求是否清楚，是否存在否定性限定，或使用“约”、“接近”、“等”、“或类似物”、“可以”、“可”等模糊用语。
6. 独立权利要求中是否包含复杂公式（允许使用初等函数等简单形式）。
7. 独立权利要求中是否都包含“其特征在于”。
8. 解释的参数与公式中的参数是否保持一致。
9. 检查权利要求编号（如权利要求1、权利要求2等）格式是否正确，编号后应为“.”，而非顿号、逗号或冒号。
`
    },
    {
        category: '技术领域',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. 技术领域需与摘要的技术领域保持一致 (未质检)
`
    },
    {
        category: '背景技术',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. 对于以A结尾的引用文件：公开号/申请公布号为…….的中国专利申请文件；对于以B结尾的引用文件：公告号/授权公告号为…….的中国专利文件；对于以U结尾的引用文件：公告号/公开号为…….的中国专利文件；广州保护中心要求以A结尾的引用文件使用公开号;推荐使用公开号或者公告号
2. 相关叙述不得出现“对比文件”、“发明”、“实用新型”字眼
3. 对于引用文件的赘述需要保持一致，例如：若上文引用的是以A结尾的对比文件，则下文中的相关叙述应为该申请文件
4. 广州地区不能出现“广泛”
`
    },
    {
        category: '发明内容',
        rules: `
严格按照以下规则质检（不要过度联想）：        
1. 章节末尾是否对发明的有益效果进行了总结说明。
`
    },
    {
        category: '附图说明',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. “...的第一结构示意图”、“...第二结构示意图”等相关表述是否过于笼统，需要具体说明是哪个视角或哪些部件的示意图。
2. 附图标记是否只使用“数字”进行标号，而不是“字母+数字”的形式（例如滑块123a、手柄12b）。
3. 是否出现套话。
`
    },
    {
        category: '具体实施方式',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. 是否缺少对附图的引用和说明。
2. 公式后是否添加了标点。
3. 实施例中是否存在大段（例如超过50字）复制发明内容部分的技术效果分析内容。
4. 背景技术的分析内容是否被写入实施例中。
5. 套话总字数是否超过200字。
`
    },
    {
        category: '说明书附图',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. 由于AI无法直接分析图像内容，所有关于附图本身的规则均未质检。
`
    }
];

const reRenderContent = () => {
    const contentContainer = document.getElementById('formal-check-content-container');
    if (contentContainer) {
        contentContainer.innerHTML = renderFormalCheckContent();
    }
}


// --- RENDER FUNCTIONS ---
const renderFormalCheckSidebar = () => {
    const isHistoryView = formalCheckState.viewMode === 'historyList' || formalCheckState.viewMode === 'historyDetail';
    const historyBtnText = isHistoryView ? '返回质检' : '历史记录';
    const historyBtnIcon = isHistoryView ? 'arrow_back' : 'history';

    return `
    <aside class="h-full bg-gray-50 dark:bg-gray-800 w-64 p-4 flex flex-col border-r border-gray-200 dark:border-gray-700 shrink-0" style="width: 20rem;">
        <div class="flex-grow space-y-6">
            ${createFileUploadInput('formal-check-file', '上传专利文件 (PDF)', false, 'application/pdf')}
        </div>
        <div class="mt-auto space-y-4">
            <div class="space-y-2">
                <button id="start-formal-check-btn" class="w-full bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3" disabled>
                    <span class="material-symbols-outlined">science</span>
                    开始质检
                </button>
                <button id="view-formal-check-history-btn" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-3">
                    <span class="material-symbols-outlined">${historyBtnIcon}</span>
                    ${historyBtnText}
                </button>
            </div>
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button id="reset-formal-check-btn" class="w-full bg-red-600 text-white font-bold p-3 rounded-full hover:bg-red-700 transition-colors flex items-center justify-center gap-3">
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
                        <span class="font-bold text-green-600 dark:text-green-400">¥ ${formalCheckState.totalCost.toFixed(4)}</span>
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
    const entry = history.find(item => item.id === formalCheckState.selectedHistoryId);
    if (!entry) {
        formalCheckState.viewMode = 'historyList';
        formalCheckState.selectedHistoryId = null;
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
    switch (formalCheckState.viewMode) {
        case 'historyList':
            return renderFormalCheckHistoryList();
        case 'historyDetail':
            return renderFormalCheckHistoryDetail();
        case 'main':
        default:
            if (formalCheckState.isLoading) {
                return `
                    <div class="flex flex-col items-center justify-center h-full">
                        <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                        <p class="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300" id="formal-check-loading-step">${formalCheckState.loadingStep || '正在准备质检...'}</p>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">AI正在分析文件，请稍候。</p>
                    </div>
                `;
            }

            if (formalCheckState.error) {
                 const errorContent = `
                    <div class="max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
                        <span class="material-symbols-outlined text-6xl mb-4 text-red-500">report_problem</span>
                        <h3 class="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">质检时出现错误</h3>
                        <div class="bg-red-50 dark:bg-gray-800 border border-red-200 dark:border-red-700 p-4 rounded-lg text-left w-full">
                            <pre class="text-red-700 dark:text-red-300 whitespace-pre-wrap font-sans text-sm">${formalCheckState.error}</pre>
                        </div>
                        <p class="mt-6 text-sm text-gray-500 dark:text-gray-400">请在左侧点击“重新开始”按钮返回重试。</p>
                    </div>
                `;
                if (formalCheckState.checkResult && formalCheckState.checkResult.length > 0) {
                    return `<div>${renderFormalCheckResults(formalCheckState.checkResult)}<hr class="my-8 border-gray-300 dark:border-gray-600">${errorContent}</div>`
                }
                return errorContent;
            }

            if (formalCheckState.checkResult && formalCheckState.checkResult.length > 0) {
                return renderFormalCheckResults(formalCheckState.checkResult);
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

// --- LOGIC FUNCTIONS ---
const extractTextFromPageContent = (textContent, pageHeight: number): string => {
    if (textContent.items.length === 0) return '';
    const TOP_MARGIN_PERCENT = 0.08;
    const BOTTOM_MARGIN_PERCENT = 0.08;
    const topMarginThreshold = pageHeight * (1 - TOP_MARGIN_PERCENT);
    const bottomMarginThreshold = pageHeight * BOTTOM_MARGIN_PERCENT;
    const HEADER_FOOTER_REGEX = new RegExp([
        '^\\s*(-?\\s*\\d+\\s*-?)$',
        '^\\s*第\\s*\\d+\\s*页(?:\\s*[,，]?\\s*共\\s*\\d+\\s*页)?\\s*$',
        '^\\s*\\d+\\s*\\/\\s*\\d+\\s*$',
        'page',
        '^\\s*CN[\\s\\d.,-]*[A-ZBU]\\s*$'
    ].join('|'), 'i');

    const lines = new Map<number, any[]>();
    for (const item of textContent.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform[5];
        const roundedY = Math.round(y);
        if (!lines.has(roundedY)) lines.set(roundedY, []);
        lines.get(roundedY)!.push(item);
    }

    const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);
    const pageLines: string[] = [];
    for (const y of sortedY) {
        const lineItems = lines.get(y)!;
        lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
        let lineText = lineItems.map(item => item.str).join('').trim();
        if (!lineText) continue;

        const yCoord = lineItems[0].transform[5];
        const isHeaderZone = yCoord > topMarginThreshold;
        const isFooterZone = yCoord < bottomMarginThreshold;
        if ((isHeaderZone || isFooterZone) && HEADER_FOOTER_REGEX.test(lineText)) continue;

        lineText = lineText.replace(/^\s*(?:\[\d+\]|\d{1,3}(?!\d))\s*/, '').trim();
        if (lineText) pageLines.push(lineText);
    }
    return pageLines.join('\n');
};

const extractSectionsFromPdf = async (file: File, onProgress: (message: string) => void): Promise<{ sections: Record<string, string>, fullText: string }> => {
    onProgress('正在加载PDF文件...');
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    const cleanPageTexts: string[] = [];
    onProgress('正在提取所有页面文本...');
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        onProgress(`正在处理第 ${pageNum}/${pdf.numPages} 页...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        const cleanBodyText = extractTextFromPageContent(textContent, viewport.height);
        cleanPageTexts.push(cleanBodyText);
    }

    const fullText = cleanPageTexts.join('\n\n').trim();
    onProgress('正在根据标题切分章节...');

    const titleRegexes = [
        { title: '摘要', regex: /^\s*(?:说明书)?\s*摘\s*要\s*$/m },
        { title: '摘要附图', regex: /^\s*摘\s*要\s*附\s*图\s*$/m },
        { title: '权利要求书', regex: /^\s*权\s*利\s*要\s*求\s*书\s*$/m },
        { title: '技术领域', regex: /^\s*技\s*术\s*领\s*域\s*$/m },
        { title: '背景技术', regex: /^\s*背\s*景\s*技\s*术\s*$/m },
        { title: '发明内容', regex: /^\s*发\s*明\s*内\s*容\s*$/m },
        { title: '附图说明', regex: /^\s*附\s*图\s*说\s*明\s*$/m },
        { title: '具体实施方式', regex: /^\s*具\s*体\s*实\s*施\s*方\s*式\s*$/m },
    ];
    
    const sections: Record<string, string> = {};
    const foundSections: { title: string, index: number, regex: RegExp }[] = [];

    titleRegexes.forEach(({ title, regex }) => {
        const match = fullText.match(regex);
        if (match && typeof match.index === 'number') {
            foundSections.push({ title, index: match.index, regex });
        }
    });

    foundSections.sort((a, b) => a.index - b.index);

    foundSections.forEach((section, i) => {
        const startIndex = section.index;
        const nextSection = foundSections[i + 1];
        const endIndex = nextSection ? nextSection.index : fullText.length;
        let sectionText = fullText.substring(startIndex, endIndex);
        sectionText = sectionText.replace(section.regex, '').trim();
        sections[section.title] = sectionText;
    });

    if (sections['附图说明'] && !sections['说明书附图']) {
        sections['说明书附图'] = sections['附图说明'];
    }

    const finalSections: Record<string, string> = {};
    formalCheckCategories.forEach(cat => {
        finalSections[cat.category] = sections[cat.category] || '';
    });
    
    return { sections: finalSections, fullText };
};

const countCharactersConsideringFormulas = (text: string): number => {
    const formulaRegex = /\b\S+(?:\s*[-+*\/=<>≤≥]\s*\S+)+\b/g;
    const textWithFormulasReplaced = text.replace(formulaRegex, 'F');
    return textWithFormulasReplaced.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length;
};

// --- EVENT HANDLERS & MAIN FUNCTION ---
const handleStartFormalCheck = async () => {
    const ai = getAi();
    if (!ai) {
        showToast('AI服务初始化失败，请刷新页面重试。');
        return;
    }
    if (!formalCheckState.file) {
        showToast('请先上传一个文件。');
        return;
    }

    const MAX_FILE_SIZE_MB = 10;
    if (formalCheckState.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        showToast(`文件大小不能超过 ${MAX_FILE_SIZE_MB}MB。`);
        return;
    }

    formalCheckState = { ...getInitialFormalCheckState(), file: formalCheckState.file, isLoading: true };
    reRenderContent();
    updateFormalCheckDOM();


    const onProgress = (message: string) => {
        formalCheckState.loadingStep = message;
        const loadingStepElement = document.getElementById('formal-check-loading-step');
        if (loadingStepElement) loadingStepElement.textContent = message;
    };

    try {
        onProgress('正在分析PDF并提取章节...');
        const { sections: extractedSections } = await extractSectionsFromPdf(formalCheckState.file, onProgress);

        const overallIssuesFromLocalCheck: { issue: string, suggestion: string }[] = [];
        const sectionsToExcludeForCount = ['摘要附图', '说明书附图'];
        const characterCount = Object.entries(extractedSections)
            .filter(([sectionName]) => !sectionsToExcludeForCount.includes(sectionName))
            .reduce((total, [, sectionText]) => total + countCharactersConsideringFormulas(sectionText), 0);

        if (characterCount < 10000) {
            overallIssuesFromLocalCheck.push({
                issue: '机械领域总字数（含标点，不含空格）不足1W字。',
                suggestion: `当前总字数（约 ${characterCount} 字）不满足要求，请扩充说明书等部分的内容。`
            });
        }
        
        onProgress(`正在并行检查所有 ${formalCheckCategories.length} 个类别...`);
        
        const commonOverallRules = `
- 检查是否叠字，如果有叠字，判断语句是否通顺（例如：的的）
- 检查是否同时出现两个标点（例如：。。或者，，或者，。）
- 每句句子的句末需要有标点
`;

        const issueSchema = {
            type: Type.ARRAY,
            description: "该类别下发现的问题列表。如果没有问题，则为空数组。",
            items: {
                type: Type.OBJECT,
                properties: {
                    issue: { type: Type.STRING, description: "发现的具体问题的描述。" },
                    suggestion: { type: Type.STRING, description: "针对该问题的修改建议。" }
                },
                required: ["issue", "suggestion"]
            }
        };
        
        const locallyGeneratedIssues = new Map<string, { issue: string, suggestion: string }[]>();
        const categoryMetadata = new Map<string, { charCount?: number }>();

        const checkPromises = formalCheckCategories.map(category => {
            const sectionText = extractedSections[category.category];
            let categoryRules = category.rules;

            if (category.category === '摘要') {
                const charCount = countCharactersConsideringFormulas(sectionText);
                categoryMetadata.set(category.category, { charCount });
            
                if (charCount > 300) {
                    if (!locallyGeneratedIssues.has(category.category)) locallyGeneratedIssues.set(category.category, []);
                    locallyGeneratedIssues.get(category.category)!.push({
                        issue: `摘要字数（含标点，不含空格）为 ${charCount} 字，超过了300字的限制。`,
                        suggestion: '请将摘要内容缩减至300字以内。'
                    });
                }
                categoryRules = categoryRules.split('\n').filter(line => !line.includes('字数（含标点）不得超过300字')).join('\n');
            }

            if (!sectionText || sectionText.trim() === '' || categoryRules.trim() === '') {
                return Promise.resolve({ response: { text: '[]' }, cost: 0 });
            }
            
            const prompt = `# **角色与指令 (Role and Directives)**
你是一位经验极其丰富的中国专利代理人，同时也是一位顶级的中文校对专家，拥有超过20年的从业经验，对专利申请文件的形式要求和文字准确性了如指掌。你的任务是扮演一名严谨细致的质量审核专家，对提供的专利文件章节进行全面的形式质检和错别字校对。

你的所有判断**必须**严格基于我发送给你的“待检章节文本”。你将同时依据【类别规则】、【通用规则】和【错别字校对】三项任务进行检查，并以专业、清晰的语言指出所有发现的问题。

# **核心工作流程 (Core Workflow)**
对于下方规则中的每一条，你都**必须**遵循以下思考和执行步骤：
1.  **专业审查 (Professional Review)**: 像一位资深代理人一样，仔细阅读“待检章节文本”，在上下文中理解并定位与规则相关的具体表述或格式。
2.  **精确判断 (Precise Judgment)**: 基于你的专业知识，判断定位到的文本是否违反了规则。
3.  **清晰报告 (Clear Reporting)**: 如果发现违反规则的情况，就生成一个问题对象，用专业且易于理解的语言描述问题并提出修改建议。如果完全符合规则，则不生成任何内容。

# **当前任务: “${category.category}” 类别质检**
## **【类别规则】**
${categoryRules}

## **【通用规则】(请对本章节文本同时检查以下通用规则)**
${commonOverallRules}

## **【额外任务：错别字校对】**
在进行上述规则检查的同时，你还必须像一位火眼金睛的校对专家一样，仔细通读“待检章节文本”，找出所有用词错误、打字错误或不符合规范的汉字。
- 将发现的每一个错别字也作为一个问题对象添加到最终的JSON数组中。
- 在 \`issue\` 字段中，清晰地指出原文中的错别字是什么，并提供上下文，例如：“在句子‘...’中，‘[错别字]’应为‘[正确字]’。”
- 在 \`suggestion\` 字段中，直接给出修正后的词语或句子片段。

# **输出要求 (Output Requirements)**
你的最终输出**必须**是一个JSON对象数组，严格遵守所提供的模式。
- 如果在此类别下未发现任何问题（包括规则问题和错别字），你**必须**返回一个空数组 \`[]\`。
- 不要输出任何解释、注释或多余的文本。直接输出JSON数组。
`;
            
            const contents = { parts: [{ text: prompt }, { text: `# 待检章节文本\n\n${sectionText}` }] };

            return generateContentWithRetry({
                model: 'gemini-2.5-pro',
                contents: contents,
                config: { responseMimeType: "application/json", responseSchema: issueSchema },
            });
        });

        const categoryResults = await Promise.allSettled(checkPromises);
        
        const finalResults: any[] = [];
        const errors: string[] = [];
        let accumulatedCost = 0;
        const allOverallIssuesFromAPI: {issue: string, suggestion: string}[] = [];
        
        categoryResults.forEach((result, index) => {
            const category = formalCheckCategories[index];
            if (result.status === 'fulfilled') {
                const { response, cost } = result.value;
                accumulatedCost += cost;
                try {
                    const aiIssues: {issue: string, suggestion: string}[] = JSON.parse(response.text.trim());
                    const localIssuesForCategory = locallyGeneratedIssues.get(category.category) || [];
                    const combinedIssues = [...localIssuesForCategory, ...aiIssues];

                    const categorySpecificIssues: {issue: string, suggestion: string}[] = [];
                    const overallKeywords = ['叠字', '两个标点', '句末', '的的', '。。', '，。'];
                    
                    for (const item of combinedIssues) {
                        if (overallKeywords.some(kw => item.issue.includes(kw))) {
                            allOverallIssuesFromAPI.push(item);
                        } else {
                            categorySpecificIssues.push(item);
                        }
                    }

                    const metadata = categoryMetadata.get(category.category);
                    finalResults.push({ category: category.category, issues: categorySpecificIssues, ...metadata });
                } catch (e) {
                    errors.push(`- ${category.category}: 模型为“${category.category}”类别返回了无效的数据格式。`);
                }
            } else {
                errors.push(`- ${category.category}: ${(result.reason as Error).message}`);
            }
        });
        
        const uniqueOverallIssuesFromAPI = Array.from(new Map(allOverallIssuesFromAPI.map(item => [item.issue, item])).values());
        finalResults.push({
            category: '总体',
            issues: [...overallIssuesFromLocalCheck, ...uniqueOverallIssuesFromAPI],
            charCount: characterCount
        });

        formalCheckState.totalCost = accumulatedCost;
        formalCheckState.checkResult = finalResults;
        
        if (errors.length > 0) formalCheckState.error = `部分类别检查失败:\n\n${errors.join('\n')}`;
        if (errors.length === 0) showToast('质检完成并已存入历史记录。');
        else showToast('部分质检成功，结果已存入历史记录。', 5000);
        
        formalCheckHistoryDb.addHistoryEntry({
            id: Date.now(),
            date: new Date().toLocaleString('zh-CN', { hour12: false }),
            fileName: formalCheckState.file!.name,
            checkResult: finalResults,
            totalCost: formalCheckState.totalCost,
        });

    } catch (error) {
        const err = error as Error;
        formalCheckState.error = err.message;
        showToast(`质检失败: ${formalCheckState.error}`, 5000);
    } finally {
        formalCheckState.isLoading = false;
        formalCheckState.loadingStep = null;
        reRenderContent();
    }
};

const updateFormalCheckDOM = () => {
    const fileListContainer = document.getElementById('formal-check-file-file-list');
    if (fileListContainer) {
        if (formalCheckState.file) {
            fileListContainer.innerHTML = `
            <div class="bg-gray-200 dark:bg-gray-700 p-1 px-2 rounded-md text-xs flex justify-between items-center transition-all">
                <span class="material-symbols-outlined text-base mr-2 text-gray-500 dark:text-gray-400">description</span>
                <span class="truncate flex-grow" title="${formalCheckState.file.name}">${formalCheckState.file.name}</span>
                <button class="remove-file-btn ml-2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500" data-filename="${formalCheckState.file.name}" aria-label="移除 ${formalCheckState.file.name}">
                    <span class="material-symbols-outlined text-sm pointer-events-none">close</span>
                </button>
            </div>
            `;
        } else {
            fileListContainer.innerHTML = '';
        }
    }

    const startBtn = document.getElementById('start-formal-check-btn') as HTMLButtonElement;
    if (startBtn) startBtn.disabled = !formalCheckState.file;
};

const attachFormalCheckEventListeners = () => {
    const pageElement = document.getElementById('formal-check-page');
    if (!pageElement) return;

    pageElement.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        const detailBtn = target.closest('.view-formal-check-detail-btn');
        if (detailBtn) {
            const id = (detailBtn as HTMLElement).dataset.historyId;
            if (id) {
                formalCheckState.selectedHistoryId = parseInt(id, 10);
                formalCheckState.viewMode = 'historyDetail';
                reRenderContent();
            }
            return;
        }

        const backBtn = target.closest('#back-to-formal-history-list');
        if (backBtn) {
            formalCheckState.selectedHistoryId = null;
            formalCheckState.viewMode = 'historyList';
            reRenderContent();
            return;
        }

        const removeBtn = target.closest('.remove-file-btn');
        if (removeBtn) {
            const filename = removeBtn.getAttribute('data-filename');
            if (formalCheckState.file?.name === filename) {
                formalCheckState.file = null;
                updateFormalCheckDOM();
                showToast(`文件 "${filename}" 已移除。`);
            }
            return;
        }

        const startBtn = target.closest('#start-formal-check-btn');
        if (startBtn) {
            handleStartFormalCheck();
            return;
        }

        const historyBtn = target.closest('#view-formal-check-history-btn');
        if (historyBtn) {
            formalCheckState.viewMode = (formalCheckState.viewMode === 'main') ? 'historyList' : 'main';
            formalCheckState.selectedHistoryId = null;
            renderFormalQualityCheckPage(document.getElementById('app')!);
            return;
        }

        const resetBtn = target.closest('#reset-formal-check-btn');
        if (resetBtn) {
            resetFormalCheckState();
            renderFormalQualityCheckPage(document.getElementById('app')!);
            return;
        }
    });

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
                formalCheckState.file = file;
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

export const renderFormalQualityCheckPage = (appContainer: HTMLElement) => {
    appContainer.innerHTML = `
        <div id="formal-check-page" class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
             <header class="flex justify-between items-center gap-4 p-5 md:p-8 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-3xl font-bold">形式质检</h2>
                </div>
                ${renderSettingsDropdown()}
            </header>
            <div class="flex flex-grow overflow-hidden">
                ${renderFormalCheckSidebar()}
                <main class="flex-grow p-5 md:p-8 overflow-y-auto" id="formal-check-content-container">
                    ${renderFormalCheckContent()}
                </main>
            </div>
        </div>`;
    attachFormalCheckEventListeners();
};