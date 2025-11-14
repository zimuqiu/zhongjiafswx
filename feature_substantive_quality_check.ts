/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { showToast } from './shared_ui.ts';
import { generateContentWithRetry, getAi, getAiError } from './shared_api.ts';

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
export let state = getInitialState();

export const resetState = () => {
    state = getInitialState();
}


// --- LOGIC FUNCTIONS ---
export const handleStartSubstantiveCheck = async () => {
    const ai = getAi();
    if (!ai) {
        const errorMsg = getAiError() || '请刷新页面重试。';
        showToast(`AI服务初始化失败: ${errorMsg}`);
        return;
    }
    if (!state.files.application || state.files.references.length === 0) {
        showToast('请至少上传一份申请文件和一份对比文件。');
        return;
    }
    
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
    }
};