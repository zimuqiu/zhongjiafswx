
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

// --- GEMINI API PRICING (CNY per 1000 characters) ---
// Estimates based on ~1 Token = 4 Characters and Exchange Rate $1 USD ≈ ¥7.25 CNY
const PRICING_RATES = {
    [MODELS.SMART]: {
        // High-end reasoning model (Reference: ~$3.50/1M input tokens, ~$10.50/1M output tokens)
        INPUT: 0.0065, 
        OUTPUT: 0.0190
    },
    [MODELS.FAST]: {
        // Efficient/Standard model (Reference: ~$1.25/1M input tokens, ~$3.75/1M output tokens or lower for Flash)
        // Setting significantly lower to reflect "Fast/Cost-effective" choice
        INPUT: 0.0025,
        OUTPUT: 0.0075
    },
    'default': {
        INPUT: 0.0050,
        OUTPUT: 0.0150
    }
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

const calculateCost = (modelId: string, inputChars: number, outputChars: number): number => {
    const rates = PRICING_RATES[modelId] || PRICING_RATES['default'];
    const inputCost = (inputChars / 1000) * rates.INPUT;
    const outputCost = (outputChars / 1000) * rates.OUTPUT;
    return inputCost + outputCost;
};


// --- GEMINI API & KEY ROTATION ---
// Parse API keys from environment variable (comma-separated support)
const API_KEYS = (process.env.API_KEY || '').split(',').map(k => k.trim()).filter(k => k);

// Initialize with a random index to distribute load evenly from the start
let currentKeyIndex = API_KEYS.length > 0 ? Math.floor(Math.random() * API_KEYS.length) : 0;
let ai: GoogleGenAI | null = null;

// Helper: Pick a random *different* key index for rotation on error
const rotateApiKeyRandomly = () => {
    if (API_KEYS.length <= 1) return false;
    
    let nextIndex = currentKeyIndex;
    // Loop until we find a different index
    while (nextIndex === currentKeyIndex) {
        nextIndex = Math.floor(Math.random() * API_KEYS.length);
    }
    
    currentKeyIndex = nextIndex;
    ai = null; // Force re-initialization with new key
    console.log(`Rate limit encountered. Rotated randomly to API Key index: ${currentKeyIndex}`);
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
    
    // STRATEGY: For every new high-level request, pick a random key from the pool.
    // This ensures load balancing even without errors.
    if (API_KEYS.length > 1) {
        currentKeyIndex = Math.floor(Math.random() * API_KEYS.length);
        ai = null; // Force getAi() to re-initialize with the new random key
        // console.log(`Starting request with Random Key Index: ${currentKeyIndex}`);
    }

    // Ensure we have a valid AI client before starting retries.
    await getAi();

    for (let i = 0; i < retries; i++) {
        try {
            // Re-fetch AI client in case it was reset (rotated) in previous iteration
            const aiClient = await getAi();
            
            // FORCE override the model with the currently active global model
            const activeModel = getActiveModel();
            const currentParams = { ...params, model: activeModel };
            
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
            const cost = calculateCost(activeModel, inputChars, outputChars);
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
                // Try rotating the key randomly if multiple keys are available
                const rotated = rotateApiKeyRandomly();
                if (rotated) {
                    showToast('检测到请求限制，正在切换备用API Key重试...', 3000);
                    // Add a small delay before immediate retry with new key
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
