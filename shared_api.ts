
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import GenerateContentResponse to correctly type the API response.
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
// FIX: Removed unused import for promptForApiKey.
import { showToast } from './shared_ui.ts';

// --- MODEL CONFIGURATION ---
export const MODELS = {
    SMART: 'gemini-3-pro-preview',
    FAST: 'gemini-2.5-pro' // Using Flash as the robust fallback for 2.5 series
};

let currentModelId = MODELS.SMART;

export const getActiveModel = () => currentModelId;

export const setActiveModel = (modelId: string) => {
    currentModelId = modelId;
    updateModelButtonUI();
};

export const toggleModel = () => {
    currentModelId = currentModelId === MODELS.SMART ? MODELS.FAST : MODELS.SMART;
    updateModelButtonUI();
    showToast(`已切换至模型: ${getModelDisplayName(currentModelId)}`);
    return currentModelId;
};

export const getModelDisplayName = (modelId: string) => {
    return modelId === MODELS.SMART ? 'Gemini 3.0 Pro' : 'Gemini 2.5 Pro';
};

// Helper to update UI across the app without reloading
const updateModelButtonUI = () => {
    const wrappers = document.querySelectorAll('.model-switch-wrapper');
    wrappers.forEach(wrapper => {
        // Update trigger text
        const nameSpan = wrapper.querySelector('.current-model-name');
        if (nameSpan) nameSpan.textContent = getModelDisplayName(currentModelId);

        // Update dropdown active state checkmarks
        const options = wrapper.querySelectorAll('.model-option');
        options.forEach(opt => {
            const model = (opt as HTMLElement).dataset.model;
            const checkmark = opt.querySelector('.checkmark');
            if (checkmark) {
                if (model === currentModelId) {
                    checkmark.classList.remove('opacity-0');
                } else {
                    checkmark.classList.add('opacity-0');
                }
            }
        });
    });
};

// --- GEMINI API PRICING ---
const GEMINI_PRO_PRICING = {
    // Prices in Yuan (¥) per 1,000 characters. Based on an estimation.
    INPUT_PRICE_PER_1K_CHARS: 0.0125,
    OUTPUT_PRICE_PER_1K_CHARS: 0.0250,
};

const calculateCost = (inputChars: number, outputChars: number): number => {
    const inputCost = (inputChars / 1000) * GEMINI_PRO_PRICING.INPUT_PRICE_PER_1K_CHARS;
    const outputCost = (outputChars / 1000) * GEMINI_PRO_PRICING.OUTPUT_PRICE_PER_1K_CHARS;
    return inputCost + outputCost;
};


// --- GEMINI API & KEY ROTATION ---
// Parse API keys from environment variable (comma-separated support)
const API_KEYS = (process.env.API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
let currentKeyIndex = 0;
let ai: GoogleGenAI | null = null;

const rotateApiKey = () => {
    if (API_KEYS.length <= 1) return false;
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    ai = null; // Force re-initialization with new key
    console.log(`Rotated to API Key index: ${currentKeyIndex}`);
    return true;
};

export const getAi = async (): Promise<GoogleGenAI> => {
    if (ai) {
        return ai;
    }

    try {
        const currentKey = API_KEYS[currentKeyIndex];
        if (!currentKey) {
            throw new Error('No API Key found in environment variables.');
        }
        
        // FIX: Per coding guidelines, API key must be obtained from process.env.API_KEY (parsed above).
        const newAiInstance = new GoogleGenAI({ apiKey: currentKey });
        // Test with a simple request to validate the key early
        // await newAiInstance.models.generateContent({model: 'gemini-2.5-pro', contents: 'Hi'});
        ai = newAiInstance;
        return ai;
    } catch (error) {
        ai = null;
        console.error("Failed to initialize GoogleGenAI or invalid API key:", error);
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('API key not valid')) {
             showToast('提供的API密钥无效。');
        } else {
             showToast('AI服务初始化失败，请检查网络或配置。');
        }
        throw new Error('API Key validation failed.');
    }
};

export const generateContentWithRetry = async (params, retries = 5, initialDelay = 5000, requestTimeout = 150000): Promise<{ response: any, cost: number }> => {
    let lastError: Error = new Error('AI 服务未知错误。');

    const getInputChars = (contents: any): number => {
        if (!contents) return 0;
        if (typeof contents === 'string') return contents.length;
        if (Array.isArray(contents)) return contents.reduce((sum, part) => sum + getInputChars(part), 0);
        if (typeof contents === 'object' && contents.parts) return getInputChars(contents.parts);
        if (typeof contents === 'object' && contents.text) return contents.text?.length || 0;
        return 0;
    };
    
    // Ensure we have a valid AI client before starting retries.
    // Note: getAi() might throw if no keys are valid initially.
    await getAi();

    for (let i = 0; i < retries; i++) {
        try {
            // Re-fetch AI client in case it was reset (rotated) in previous iteration
            const aiClient = await getAi();
            
            // FORCE override the model with the currently active global model
            const currentParams = { ...params, model: getActiveModel() };
            
            const inputChars = getInputChars(currentParams.contents);
            
            const consumeStream = async (): Promise<{ text: string }> => {
                const stream = await aiClient.models.generateContentStream(currentParams);
                let aggregatedText = '';
                for await (const chunk of stream) {
                    aggregatedText += (chunk.text || '');
                }
                return { text: aggregatedText };
            };
            
            const apiCallPromise = consumeStream();
            
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`请求超时（超过 ${requestTimeout / 1000} 秒）。`)), requestTimeout)
            );

            const response = await Promise.race([apiCallPromise, timeoutPromise]) as { text: string };
            
            const outputChars = response.text?.length || 0;
            const cost = calculateCost(inputChars, outputChars);
            return { response, cost };

        } catch (error) {
            lastError = error as Error;
            const errorMessage = lastError.message.toLowerCase();
            console.error(`Attempt ${i + 1} of ${retries} failed on model ${getActiveModel()} with Key [${currentKeyIndex}]:`, error);

            // If the error is an invalid API key, clear it and fail immediately.
            if (errorMessage.includes('api key not valid')) {
                ai = null; 
                throw new Error('API密钥无效。请检查您的环境配置。');
            }

            // --- AUTO KEY ROTATION LOGIC ---
            // Check for Resource Exhausted (429) or Quota related errors
            if (errorMessage.includes('429') || errorMessage.includes('resource exhausted') || errorMessage.includes('quota')) {
                // Try rotating the key if multiple keys are available
                const rotated = rotateApiKey();
                if (rotated) {
                    console.warn(`Rate limit hit. Rotated to Key Index: ${currentKeyIndex}`);
                    showToast('检测到请求限制，正在切换备用API Key重试...', 3000);
                    // Reset retries or just continue? 
                    // To avoid infinite loops with many bad keys, we count this as a failure attempt but continue immediately.
                    // Or we could be generous and decrement i to verify the new key fully.
                    // Let's just continue loop, effectively treating rotation as one retry step.
                    // But we add a small delay to be safe.
                    await new Promise(res => setTimeout(res, 1000));
                    continue; 
                } else {
                    console.warn("Rate limit hit, but no other keys available to rotate.");
                }
            }
            
            if (i < retries - 1) {
                const jitter = Math.random() * 1000;
                const delay = initialDelay * Math.pow(2, i) + jitter;
                const delayInSeconds = (delay / 1000).toFixed(1);

                showToast(`请求失败，${delayInSeconds}秒后重试... (第 ${i + 2}/${retries} 次)`, Math.round(delay));
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.error("All retry attempts failed.");
                throw new Error(`AI服务连接失败。多次尝试后仍无法连接，请检查您的网络或稍后再试。\n\n根本原因: ${lastError.message}`);
            }
        }
    }
    throw new Error(`AI服务连接失败: ${lastError.message}`);
};
