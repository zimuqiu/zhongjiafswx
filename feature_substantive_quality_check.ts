/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { showToast } from './shared_ui.ts';
import { generateContentWithRetry, getAi } from './shared_api.ts';
import { substantiveCheckHistoryDb } from './shared_formal_check_db.ts';
import { createStore } from './shared_store.ts';

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
    },
    isLoading: false,
    loadingStep: null as string | null,
    checkResult: null as { issues: any[] } | null,
    error: '',
    totalCost: 0,
    viewMode: 'main' as 'main' | 'historyList' | 'historyDetail',
    selectedHistoryId: null as number | null,
});

const store = createStore(getInitialState());
export const substantiveCheckStore = {
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    resetState: () => store.setState(getInitialState())
};
/** @deprecated Use substantiveCheckStore.resetState() instead. */
export const resetState = substantiveCheckStore.resetState;


// --- LOGIC FUNCTIONS ---
export const handleStartSubstantiveCheck = async () => {
    const state = substantiveCheckStore.getState();
    if (!state.files.application) {
        showToast('请上传一份待质检的申请文件。');
        return;
    }
    
    try {
        await getAi(); // Ensure AI is initialized and key is provided before proceeding.

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
            substantiveCheckStore.setState({ loadingStep: message });
        };

        updateLoadingStep('正在转换申请文件...');
        const applicationPart = await fileToPart(state.files.application);
        
        const prompt = `
# **角色**
你是一位极其资深的中国专利审查员，拥有超过20年的实质审查经验，对专利法第26条第3款关于“说明书应当对发明作出清楚、完整的说明，以所属技术领域的技术人员能够实现为准”的规定有着权威且深刻的理解。你的任务是扮演一名严苛的质量把关专家，对提供的专利申请文件进行全面的“公开不充分”风险排查。

# **战略目标/任务**
严格、客观、全面地审查“待检申请文件”的说明书和权利要求书，识别并报告所有可能违反专利法第26条第3款的潜在缺陷。你的分析必须精准定位问题，并提供具有可操作性的修改建议。

# **核心审查维度 (审查框架)**
你必须从以下几个核心维度，对文件进行逐一审查：

1.  **未解决的技术问题**:
    -   说明书是否明确记载了发明所要解决的技术问题？
    -   背景技术部分是否对现有技术的缺点进行了客观、恰当的描述，从而衬托出本发明的技术问题？

2.  **技术方案不完整**:
    -   说明书公开的技术方案是否足以解决其声称的技术问题？
    -   是否缺少必要的结构、步骤、条件或参数，导致技术人员无法实施？
    -   对于化学、生物等领域的发明，实施例是否充分，实验数据是否可靠？

3.  **技术效果不可信**:
    -   说明书记载的有益效果是否是本领域技术人员通过阅读全文能够合理预期或验证的？
    -   是否存在夸大其词、缺乏实验数据支撑或与技术方案无直接因果关系的效果描述？

4.  **权利要求得不到说明书支持**:
    -   权利要求中概括的技术方案，是否能在说明书的具体实施方式中找到对应的、充分的支撑？
    -   是否存在权利要求的保护范围宽泛，而说明书中仅给出了极少数孤立实施例的情况？
    -   权利要求中的每一个技术特征，是否都能在说明书中找到明确、一致的记载？

# **输出要求**
你的最终输出**必须**是一个JSON对象，严格遵守所提供的模式。不要输出任何解释、注释或多余的文本。`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                issues: {
                    type: Type.ARRAY,
                    description: "发现的所有“公开不充分”问题的列表。如果没有问题，则为空数组。",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            issueCategory: {
                                type: Type.STRING,
                                description: "问题所属的类别，必须是 '未解决的技术问题'、'技术方案不完整'、'技术效果不可信' 或 '权利要求得不到说明书支持' 之一。"
                            },
                            reasoning: {
                                type: Type.STRING,
                                description: "详细的分析和论证过程，解释为什么存在公开不充分的问题，并引用原文作为证据。"
                            },
                            suggestion: {
                                type: Type.STRING,
                                description: "针对该问题提出的具体、可操作的修改或补充建议。"
                            }
                        },
                        required: ["issueCategory", "reasoning", "suggestion"]
                    }
                }
            },
            required: ["issues"]
        };

        updateLoadingStep('正在调用AI进行分析...');
        const contents = { parts: [{ text: prompt }, { text: `\n\n--- 待检申请文件 (${state.files.application.name}) ---\n` }, applicationPart] };
        
        const { response, cost } = await generateContentWithRetry({
            model: 'gemini-3-pro-preview',
            contents: contents,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });

        
        try {
            const checkResult = JSON.parse(response.text.trim());
            substantiveCheckStore.setState({ totalCost: cost, checkResult });
        } catch (e) {
            console.error("Failed to parse AI response:", response.text);
            throw new Error("模型返回了无效的数据格式。");
        }
        showToast('实质质检完成并已存入历史记录。');

        substantiveCheckHistoryDb.addHistoryEntry({
            id: Date.now(),
            date: new Date().toLocaleString('zh-CN', { hour12: false }),
            fileName: state.files.application!.name,
            checkResult: substantiveCheckStore.getState().checkResult,
            totalCost: cost,
        });

    } catch (error) {
        const err = error as Error;
        substantiveCheckStore.setState({ error: err.message });
        if (err.message !== 'API Key validation failed.') {
             showToast(`质检失败: ${err.message}`, 5000);
        }
    }
};