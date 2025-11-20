
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';
import { createStore } from './shared_store.ts';
import { generateContentWithRetry, getAi } from './shared_api.ts';
import { showToast } from './shared_ui.ts';
import { priorityReviewHistoryDb, PriorityReviewResultDB } from './shared_formal_check_db.ts';
import { getPriorityReviewData, ReviewTableData } from './shared_priority_review_data.ts';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs';

// --- TYPES ---
export type PriorityReviewResult = PriorityReviewResultDB;

// --- STATE ---
const getInitialState = () => ({
    applicationFile: null as File | null,
    isLoading: false,
    loadingStep: null as string | null,
    result: null as PriorityReviewResult | null,
    error: '',
    totalCost: 0,
    viewMode: 'main' as 'main' | 'historyList' | 'historyDetail',
    selectedHistoryId: null as number | null,
});

const store = createStore(getInitialState());

export const priorityReviewStore = {
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    resetState: () => store.setState(getInitialState())
};

// --- PDF EXTRACTION ---
const extractTextFromPdf = async (file: File): Promise<string> => {
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument(typedarray).promise;
    let fullText = '';
    // Optimized: Reduce max pages to scan. First 8 pages usually cover Biblio, Abstract, Claims, and Intro.
    const maxPages = 8; 
    const numPages = Math.min(pdf.numPages, maxPages);

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .filter((item: any) => item.str.trim().length > 0)
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n\n';
    }
    return fullText;
};

// --- OPTIMIZATION HELPERS ---

// 1. Extract IPC codes locally using regex to pre-filter the huge table
const extractIPCsLocally = (text: string): string[] => {
    // Matches: G06F 16/29, G06F16/29, H04L 29/08, etc.
    // Also handles cases without space: G06F16/29
    const ipcRegex = /\b([A-H]\d{2}[A-Z])\s*(\d{1,4})\/(\d{2,})\b/gi;
    const matches = text.match(ipcRegex);
    if (!matches) return [];
    
    // Normalize to "G06F16/29" format for comparison
    return Array.from(new Set(matches.map(m => m.replace(/\s+/g, '').toUpperCase()))); 
};

// 2. Filter the built-in data table based on extracted IPCs
const filterTableDataLocally = (fullData: ReviewTableData[], extractedIPCs: string[]): ReviewTableData[] => {
    // If no IPCs found (e.g. image PDF), return full data (fallback)
    if (extractedIPCs.length === 0) return fullData; 

    const relevantRows = new Set<ReviewTableData>();

    for (const row of fullData) {
        // Row IPCs often look like: "G06F11*, G06F21*(不含...)"
        const criteria = row.ipc.split(/[,;、]/).map(s => s.trim());

        for (const criterion of criteria) {
            // Clean exclusion notes: "G06F11*(不含...)" -> "G06F11*"
            const cleanCriterion = criterion.split('(')[0].trim().replace(/\s+/g, '').toUpperCase(); 
            if (!cleanCriterion) continue;

            const isWildcard = cleanCriterion.endsWith('*');
            const baseCode = isWildcard ? cleanCriterion.slice(0, -1) : cleanCriterion;

            for (const docIPC of extractedIPCs) {
                // Check if docIPC starts with the baseCode
                // Example: criterion "G06F" matches doc "G06F16/29"
                if (docIPC.startsWith(baseCode)) {
                    relevantRows.add(row);
                    break; 
                }
            }
        }
    }
    
    // If filtering resulted in empty set (no match found), fallback to full data or maybe a subset?
    // Let's return full data if empty, assuming maybe our local regex missed something specific 
    // or the table has very broad categories not matched by specific IPCs.
    // However, usually if IPCs are extracted but don't match, it means the patent truly isn't in the list.
    // But to be safe for AI analysis, if we found IPCs but 0 matches, we might want to let AI double check 
    // with full data OR just return the empty set which implies "No Match".
    // Let's return empty set here, the UI/AI will handle "No Match".
    return Array.from(relevantRows);
};

// 3. Truncate text to only send relevant sections to AI
const extractKeySections = (text: string): string => {
    // Ensure we capture the bibliographic section (usually on first page) where (51) Int. Cl. resides.
    // Taking first 1000 characters is generally safe for the header info without consuming too many tokens.
    let result = `【申请文件首页信息(含(51)分类号)】\n${text.substring(0, 1000)}\n\n`;

    // Regex strategies to find sections. Note: PDF text extraction is often messy.
    // We look for keywords and take a chunk after them.
    
    // Try to find Claims (just the first part is enough for classification usually)
    const claimsMatch = text.match(/(?:权利要求(?:书)?|Claims)[:\s]*([\s\S]{100,2000}?)(?=(说明书|技术领域|背景技术|附图说明|$))/i);
    
    // Try to find Technical Field / Background
    const backgroundMatch = text.match(/(?:技术领域|背景技术|Technical\s*Field|Background)[:\s]*([\s\S]{100,1500}?)(?=(发明内容|附图说明|具体实施方式|$))/i);

    if (claimsMatch) result += `【权利要求(部分)】\n${claimsMatch[1].trim()}\n\n`;
    if (backgroundMatch) result += `【技术背景/领域】\n${backgroundMatch[1].trim()}\n\n`;
    
    return result;
};


// --- MAIN LOGIC ---
export const handleStartPriorityReview = async () => {
    const state = priorityReviewStore.getState();

    if (!state.applicationFile) {
        showToast('请上传发明申请文件。');
        return;
    }

    try {
        await getAi();
        priorityReviewStore.setState({ isLoading: true, error: '' });
        const updateStep = (msg: string) => priorityReviewStore.setState({ loadingStep: msg });

        // 1. Extract text from Application (First 8 pages)
        updateStep('正在解析申请文件...');
        const rawAppText = await extractTextFromPdf(state.applicationFile);

        // 2. Local IPC Extraction & Table Filtering
        updateStep('正在进行IPC预筛选...');
        const extractedIPCs = extractIPCsLocally(rawAppText);
        const fullTableData = getPriorityReviewData();
        
        let tableDataToUse = fullTableData;
        let isFiltered = false;

        if (extractedIPCs.length > 0) {
            const filteredData = filterTableDataLocally(fullTableData, extractedIPCs);
            // Only use filtered data if we actually found matches. 
            // If we found IPCs but 0 matches, it means it likely doesn't belong to any category, 
            // but we pass the empty list to let AI confirm "No Match".
            // If we passed full list, AI might hallucinate a weak match.
            tableDataToUse = filteredData;
            isFiltered = true;
        } else {
            // Optimization: If no IPCs found, maybe just send the headers? 
            // No, sending full table is safer but expensive.
        }

        // 3. Prepare Content for AI
        const refinedAppText = extractKeySections(rawAppText);
        
        // Prepare table string
        // If table is empty after filtering, we still send context but expect AI to say "No Match".
        const tableDataString = tableDataToUse.length > 0 
            ? tableDataToUse.map(row => 
                `ID:${row.id} | 表:${row.sourceTable} | 领域:${row.name} | IPC:${row.ipc} | 关键词:${row.keywords}`
              ).join('\n')
            : "（根据提取的IPC号未在标准库中找到匹配项，请确认申请文件是否属于相关领域）";

        // 4. AI Analysis
        updateStep('AI正在进行最终决策...');
        
        const prompt = `
# **角色**
你是一位资深的专利流程管理专家，精通《专利优先审查管理办法》。

# **任务目标**
1. 从【申请文件】中提取**所有**IPC分类号，并严格区分**主分类号**和**副分类号**。
2. 基于提供的【参考标准库数据】（该数据可能已根据IPC进行了初步筛选），找出分类号能匹配上的**所有**产业领域（候选池）。
3. 结合【申请文件】的技术方案，从候选池中选择**最贴切、最能体现技术价值**的一个领域（最佳匹配）。
4. **关键词提炼**：从该最佳匹配领域的“关键词”列中，**仅挑选出一个**最符合本申请技术方案的词汇。

# **输入数据**
1. **申请文件内容**: (包含首页信息、权利要求、技术领域等关键段落)
2. **参考标准库数据**: (可能是全量库，也可能是基于IPC预筛选后的子集)

# **严格执行步骤**

**步骤 1: 提取分类号 (Extraction)**
在【申请文件内容】的首页信息中，**严格仅查找并提取**位于 "(51) Int. Cl."（或类似变体如 "(51) Int.Cl."、"(51)Int. Cl."）标识下方或后方的分类号列表。
- **严禁**提取说明书文本、对比文件或其他位置出现的分类号。**只认准(51)标识。**
- 提取到的列表中的**第一个**IPC分类号，必须标记为 **"主分类号"**。
- 提取到的列表中的**其余所有**IPC分类号，必须标记为 **"副分类号"**。
- 格式示例："主分类号: G06F 16/00", "副分类号: G06N 3/00"。

**步骤 2: 构建候选池 (Candidate Pooling)**
对于每一个提取出的分类号，遍历提供的【参考标准库数据】。
记录下**每一个**IPC分类号命中的行。
**IPC匹配规则**:
- **通配符匹配 (*)**: 如表中IPC为 "G06F*"，则 "G06F 16/00" 视为命中。
- **前缀匹配**: 如表中IPC为 "G06F"，则 "G06F 16/00" 视为命中。
**注意**: 如果【参考标准库数据】为空或极少，且无法匹配，请明确指出。

**步骤 3: 择优决策 (Best Match Selection)**
阅读【申请文件内容】的技术细节。
审查步骤 2 中找到的“候选池”。
判断哪一个命中项（产业领域）与本申请的技术方案最吻合。

**步骤 4: 关键词提炼 (Keyword Selection)**
1. 找到步骤 3 选定的最佳匹配行。
2. 查看该行的“关键词”列内容（可能包含多个词，如“地理信息系统; GIS; 数字地图”）。
3. 结合申请文件，从这些词汇中**甄选出一个且仅一个**最精准的词。
4. **警告：严禁返回多个词或直接复制整列。**

**步骤 5: 撰写分析理由**
清晰解释提取了哪些IPC，命中了哪些条目，以及为何选择最终结果。

# **输出格式 (JSON)**
{
    "allClassifications": ["主分类号: G06F...", "副分类号: ..."],
    "allMatches": [
        { "classification": "主分类号: G06F...", "table": "新三样", "domain": "电动汽车" }
    ],
    "bestMatch": {
        "classification": "主分类号: G06F...",
        "table": "关键数字技术",
        "domain": "大数据",
        "keywords": ["唯一的一个关键词"]
    },
    "reasoning": "【分类号提取】...\\n\\n【候选池分析】...\\n\\n【最终决策】...\\n\\n【关键词选择】..."
}
`;

        const parts = [
            { text: prompt },
            { text: `\n\n=== 申请文件内容 (核心片段) ===\n${refinedAppText}` },
            { text: `\n\n=== 参考标准库数据 (${isFiltered ? '已基于本地IPC预筛选' : '全量数据'}) ===\n${tableDataString.substring(0, 900000)}` } 
        ];

        const { response, cost } = await generateContentWithRetry({
            model: 'gemini-3-pro-preview',
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });

        const aiResult = JSON.parse(response.text.trim());
        
        const result: PriorityReviewResult = {
            allClassifications: aiResult.allClassifications || [],
            allMatches: aiResult.allMatches || [],
            matchedClassification: aiResult.bestMatch?.classification || '无',
            matchedTable: aiResult.bestMatch?.table || '无匹配',
            matchedDomain: aiResult.bestMatch?.domain || '无匹配',
            matchedKeywords: aiResult.bestMatch?.keywords || [],
            reasoning: aiResult.reasoning || '无分析理由'
        };

        priorityReviewStore.setState({
            isLoading: false,
            loadingStep: null,
            result: result,
            totalCost: cost
        });
        showToast('分析完成！');
        
        priorityReviewHistoryDb.addHistoryEntry({
            id: Date.now(),
            date: new Date().toLocaleString('zh-CN', { hour12: false }),
            applicationFileName: state.applicationFile.name,
            tableFileNames: isFiltered ? ['内置标准库 (智能预筛)'] : ['内置标准库 (全量)'],
            checkResult: result,
            totalCost: cost
        });

    } catch (error) {
        console.error("Priority Review Analysis Failed:", error);
        priorityReviewStore.setState({
            isLoading: false,
            loadingStep: null,
            error: (error as Error).message
        });
        showToast(`分析失败: ${(error as Error).message}`, 5000);
    }
};
