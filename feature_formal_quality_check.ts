
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';
import { formalCheckHistoryDb } from './shared_formal_check_db.ts';
import { showToast } from './shared_ui.ts';
import { generateContentWithRetry, getAi, getActiveModel } from './shared_api.ts';
import { createStore } from './shared_store.ts';

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

const store = createStore(getInitialFormalCheckState());
export const formalCheckStore = {
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    resetState: () => store.setState(getInitialFormalCheckState())
};

// --- FEATURE CONSTANTS ---
export const formalCheckCategories = [
    {
        category: '摘要',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. **技术领域一致性**：检查摘要中记载的“涉及...技术领域”与说明书中“技术领域”章节记载的内容是否一致。
2. **发明名称一致性**：检查摘要中记载的“具体涉及...”后面的发明名称与说明书中的发明名称是否一致。
3. 字数（含标点）不得超过300字
`
    },
    {
        category: '权利要求书',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. **引用基础**：检查是否存在缺乏引用基础的**从属权利要求**。
2. **总项数**：检查独立权利要求和从属权利要求的**总项数是否超过10项**。
3. **独立权利要求项数**：检查**独立权利要求的总项数是否超过3项**。
4. **划界**：产品类独立权利要求是否正确划界，将与现有技术相同的特征写入前序部分，并在特征部分对前序部分中的特征作进一步限定。 (此项无需AI质检)
5. **清晰度**：检查权利要求是否清楚，是否存在**否定性限定**，或使用“**约**”、“**接近**”、“**等**”、“**或类似物**”、“**可以**”、“**可**”等模糊用语。
6. **复杂公式**：检查**独立权利要求**中是否包含复杂公式（允许使用初等函数等简单形式）。
7. **“其特征在于”**：检查**独立权利要求**中是否都包含“其特征在于”。
8. **参数一致性**：检查解释的参数与公式中的参数是否保持一致。
9. **编号格式**：检查权利要求编号（如权利要求1、权利要求2等）格式是否正确，编号后应为“**.**”，而非顿号、逗号或冒号。
`
    },
    {
        category: '技术领域',
        rules: `
严格按照以下规则质检（不要过度联想）：
1. **一致性**：检查本章节记载的技术领域是否与“摘要”中记载的技术领域保持一致。
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

// --- LOGIC FUNCTIONS ---

// Helper: Convert a PDF page to a Base64 Image
// Optimized (Plan A): Increased scale and quality for better OCR accuracy
const renderPageAsImage = async (page: any): Promise<string> => {
    const scale = 2.5; // Increased from 1.5 to 2.5 for better detail (e.g., subscripts)
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) throw new Error("Failed to create canvas context");

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    // Increased from 0.6 to 0.85 to reduce compression artifacts
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    // Remove header to get pure base64
    return dataUrl.split(',')[1];
};

// Updated: Uses Vision Model to extract text and formulas with Parallel Chunking (Plan 2)
const extractSectionsFromPdfWithVision = async (file: File, onProgress: (message: string) => void): Promise<{ sections: Record<string, string>, totalCost: number }> => {
    onProgress('正在加载PDF文件...');
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    // Chunk configuration
    const PAGES_PER_CHUNK = 5; 
    const maxPagesToProcess = 50; // Slightly increased limit as we are optimizing
    const numPages = Math.min(pdf.numPages, maxPagesToProcess);
    
    const chunks: number[][] = [];
    for (let i = 1; i <= numPages; i += PAGES_PER_CHUNK) {
        const chunkPages = [];
        for (let j = 0; j < PAGES_PER_CHUNK && (i + j) <= numPages; j++) {
            chunkPages.push(i + j);
        }
        chunks.push(chunkPages);
    }

    onProgress(`PDF共 ${numPages} 页，将分为 ${chunks.length} 组并行进行AI视觉识别...`);

    let totalCost = 0;
    const chunkTexts = new Array(chunks.length).fill('');
    let completedChunks = 0;

    // Helper function to process a single chunk
    const processChunk = async (pageNumbers: number[], chunkIndex: number) => {
        // Parallelize page rendering within the chunk
        const imagePartsPromises = pageNumbers.map(async (pageNum) => {
            const page = await pdf.getPage(pageNum);
            const base64Image = await renderPageAsImage(page);
            return {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image
                }
            };
        });

        const imageParts = await Promise.all(imagePartsPromises);

        const prompt = `
# 角色任务
你是一个高精度的专利文档数字化专家。你的任务是将提供的专利文档片段图片转换为清晰、结构化的Markdown文本。

# 核心要求
1.  **公式还原 (至关重要)**：
    -   识别文中所有的数学公式、化学反应式和变量。
    -   **必须**将它们转换为标准的 **LaTeX 格式**，并用单个美元符号包裹（例如 \`$E=mc^2$\`）。
    -   特别注意还原上下标、希腊字母和特殊符号，修复可能因图片模糊导致的识别错误。
2.  **结构保留**：
    -   保留标准的专利章节标题（如“摘要”、“权利要求书”、“技术领域”、“背景技术”、“发明内容”、“附图说明”、“具体实施方式”），使用 Markdown 的二级标题（##）标记。
    -   如果图片包含页眉、页脚或行号，请去除，只保留正文。
3.  **内容完整**：
    -   按顺序输出图片中的所有文字内容，不要进行摘要或省略。
    -   直接输出内容，不要添加“以下是识别结果”等引导语。
`;

        // Call Gemini for this chunk using dynamic model
        const { response, cost } = await generateContentWithRetry({
            model: getActiveModel(),
            contents: {
                parts: [{ text: prompt }, ...imageParts]
            }
        });

        return { text: response.text.trim(), cost };
    };

    // Execute chunks in parallel
    // We map each chunk to a promise and wait for all of them.
    const promises = chunks.map((pages, index) => 
        processChunk(pages, index).then(result => {
            chunkTexts[index] = result.text;
            totalCost += result.cost;
            completedChunks++;
            onProgress(`正在AI识别中... 已完成 ${completedChunks}/${chunks.length} 组`);
        })
    );

    await Promise.all(promises);

    const fullText = chunkTexts.join('\n\n');
    
    onProgress('AI识别完成，正在切分章节...');

    // Updated regex to handle potential Markdown headers (##) or plain text headers
    const titleRegexes = [
        { title: '摘要', regex: /^\s*(?:##\s*)?(?:说明书)?\s*摘\s*要\s*$/m },
        { title: '摘要附图', regex: /^\s*(?:##\s*)?摘\s*要\s*附\s*图\s*$/m },
        { title: '权利要求书', regex: /^\s*(?:##\s*)?权\s*利\s*要\s*求\s*书\s*$/m },
        { title: '技术领域', regex: /^\s*(?:##\s*)?技\s*术\s*领\s*域\s*$/m },
        { title: '背景技术', regex: /^\s*(?:##\s*)?背\s*景\s*技\s*术\s*$/m },
        { title: '发明内容', regex: /^\s*(?:##\s*)?发\s*明\s*内\s*容\s*$/m },
        { title: '附图说明', regex: /^\s*(?:##\s*)?附\s*图\s*说\s*明\s*$/m },
        { title: '具体实施方式', regex: /^\s*(?:##\s*)?具\s*体\s*实\s*施\s*方\s*式\s*$/m },
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
        // Remove the title line itself
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
    
    // 额外保留摘要和技术领域，以便后续进行交叉比对（即使用户未明确要求检查这些章节）
    if (sections['技术领域']) finalSections['技术领域'] = sections['技术领域'];
    if (sections['摘要']) finalSections['摘要'] = sections['摘要'];

    return { sections: finalSections, totalCost: totalCost };
};

const countCharactersConsideringFormulas = (text: string): number => {
    // Match standard LaTeX formulas ($...$)
    const latexFormulaRegex = /\$[^$]+\$/g;
    // Keep legacy heuristic for non-converted parts just in case
    const legacyFormulaRegex = /\b\S+(?:\s*[-+*\/=<>≤≥]\s*\S+)+\b/g;
    
    let processedText = text.replace(latexFormulaRegex, 'F');
    processedText = processedText.replace(legacyFormulaRegex, 'F');
    
    return processedText.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length;
};

// --- EVENT HANDLERS & MAIN FUNCTION ---
export const handleStartFormalCheck = async () => {
    const state = formalCheckStore.getState();
    if (!state.file) {
        showToast('请先上传一个文件。');
        return;
    }

    // Increased limit slightly as we aren't strictly parsing text client-side anymore, 
    // but images add up. 10MB is still a reasonable safety net.
    const MAX_FILE_SIZE_MB = 10;
    if (state.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        showToast(`文件大小不能超过 ${MAX_FILE_SIZE_MB}MB。`);
        return;
    }

    const onProgress = (message: string) => {
        formalCheckStore.setState({ loadingStep: message });
    };

    try {
        await getAi(); // Ensure AI is initialized and key is provided before proceeding.

        // Step 1: Extract sections using Vision Model with Parallel Chunking
        const { sections: extractedSections, totalCost: extractionCost } = await extractSectionsFromPdfWithVision(state.file, onProgress);
        
        let accumulatedCost = extractionCost;

        // Step 2: Perform checks on the extracted Markdown text
        
        const overallIssuesFromLocalCheck: { issue: string, suggestion: string }[] = [];
        
        onProgress(`正在并行检查所有 ${formalCheckCategories.length} 个类别...`);
        
        const commonOverallRules = `
- 检查是否叠字，如果有叠字，判断语句是否通顺（例如：的的）
- 检查是否同时出现两个标点（例如：。。或者，，或者，。）
- 检查是否存在错字、错词
- 每句句子的句末需要有标点
- **忽略换行处的空格问题**：文本已转换为Markdown格式，请忽略Markdown语法中的标准换行和段落间距。
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
            let additionalContext = "";

            // 交叉引用逻辑：为“摘要”和“技术领域”提供对比文本
            if (category.category === '摘要') {
                const techFieldText = extractedSections['技术领域'];
                if (techFieldText) {
                    additionalContext = `\n\n## 参考对比文本：说明书-技术领域\n${techFieldText}\n\n(请基于上述参考文本，检查摘要中的“技术领域”和“发明名称”是否与之一致)`;
                }
                
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
            else if (category.category === '技术领域') {
                const abstractText = extractedSections['摘要'];
                if (abstractText) {
                    additionalContext = `\n\n## 参考对比文本：说明书-摘要\n${abstractText}\n\n(请基于上述参考文本，检查本段落的技术领域描述是否与摘要一致)`;
                }
            }

            if (!sectionText || sectionText.trim() === '' || categoryRules.trim() === '') {
                return Promise.resolve({ response: { text: '[]' }, cost: 0 });
            }
            
            const prompt = `# **角色与指令 (Role and Directives)**
你是一位经验极其丰富的中国专利代理人，同时也是一位顶级的中文校对专家，拥有超过20年的从业经验，对专利申请文件的形式要求和文字准确性了如指掌。你的任务是扮演一名严谨细致的质量审核专家，对提供的专利文件章节进行全面的形式质检和错别字校对。

你的所有判断**必须**严格基于我发送给你的“待检章节文本”（Markdown格式）以及可能提供的“参考对比文本”。你将同时依据【类别规则】、【通用规则】和【错别字校对】三项任务进行检查，并以专业、清晰的语言指出所有发现的问题。

# **核心工作流程 (Core Workflow)**
对于下方规则中的每一条，你都**必须**遵循以下思考和执行步骤：
1.  **专业审查 (Professional Review)**: 像一位资深代理人一样，仔细阅读“待检章节文本”，在上下文中理解并定位与规则相关的具体表述或格式。
2.  **精确判断 (Precise Judgment)**: 基于你的专业知识，判断定位到的文本是否违反了规则。如果规则涉及一致性检查，请务必对照“参考对比文本”。
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
            
            const contents = { parts: [{ text: prompt }, { text: `# 待检章节文本 (Markdown)\n\n${sectionText}${additionalContext}` }] };

            return generateContentWithRetry({
                model: getActiveModel(),
                contents: contents,
                config: { responseMimeType: "application/json", responseSchema: issueSchema },
            });
        });

        const categoryResults = await Promise.allSettled(checkPromises);
        
        const finalResults: any[] = [];
        const errors: string[] = [];
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
                    const overallKeywords = ['叠字', '两个标点', '句末', '的的', '。。', '，。', '空格'];
                    
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
            issues: [...overallIssuesFromLocalCheck, ...uniqueOverallIssuesFromAPI]
        });

        const finalError = errors.length > 0 ? `部分类别检查失败:\n\n${errors.join('\n')}` : '';
        formalCheckStore.setState({
            totalCost: accumulatedCost,
            checkResult: finalResults,
            error: finalError,
        });
        
        if (errors.length === 0) showToast('质检完成并已存入历史记录。');
        else showToast('部分质检成功，结果已存入历史记录。', 5000);
        
        formalCheckHistoryDb.addHistoryEntry({
            id: Date.now(),
            date: new Date().toLocaleString('zh-CN', { hour12: false }),
            fileName: state.file!.name,
            checkResult: finalResults,
            totalCost: accumulatedCost,
        });

    } catch (error) {
        const err = error as Error;
        formalCheckStore.setState({ error: err.message });
        if (err.message !== 'API Key validation failed.') {
            showToast(`质检失败: ${err.message}`, 5000);
        }
    }
};
