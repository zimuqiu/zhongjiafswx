/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import GenerateContentResponse to correctly type the API response.
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
// FIX: Removed unused import for promptForApiKey.
import { showToast } from './shared_ui.ts';

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


// --- GEMINI API ---
let ai: GoogleGenAI | null = null;

export const getAi = async (): Promise<GoogleGenAI> => {
    if (ai) {
        return ai;
    }

    try {
        // FIX: Per coding guidelines, API key must be obtained from process.env.API_KEY.
        const newAiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
        // Test with a simple request to validate the key early
        await newAiInstance.models.generateContent({model: 'gemini-2.5-flash', contents: 'Hi'});
        ai = newAiInstance;
        return ai;
    } catch (error) {
        ai = null;
        console.error("Failed to initialize GoogleGenAI or invalid API key:", error);
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('API key not valid')) {
             // FIX: Updated error message to reflect that the key comes from the environment.
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
    const aiClient = await getAi();

    for (let i = 0; i < retries; i++) {
        try {
            const inputChars = getInputChars(params.contents);
            
            const consumeStream = async (): Promise<{ text: string }> => {
                const stream = await aiClient.models.generateContentStream(params);
                let aggregatedText = '';
                for await (const chunk of stream) {
                    aggregatedText += chunk.text;
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
            console.error(`Attempt ${i + 1} of ${retries} failed:`, error);
            const errorMessage = lastError.message.toLowerCase();

            // If the error is an invalid API key, clear it and fail immediately.
            if (errorMessage.includes('api key not valid')) {
                // FIX: Removed sessionStorage logic as API key comes from the environment.
                ai = null; // Force re-initialization on next call.
                // FIX: Updated error message to reflect that the key comes from the environment.
                throw new Error('API密钥无效。请检查您的环境配置。');
            }
            
            if (i < retries - 1) {
                const jitter = Math.random() * 1000;
                const delay = initialDelay * Math.pow(2, i) + jitter;
                const delayInSeconds = (delay / 1000).toFixed(1);

                showToast(`AI服务连接失败，${delayInSeconds}秒后重试... (第 ${i + 2}/${retries} 次)`, Math.round(delay));
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.error("All retry attempts failed.");
                throw new Error(`AI服务连接失败。多次尝试后仍无法连接，请检查您的网络或稍后再试。\n\n根本原因: ${lastError.message}`);
            }
        }
    }
    throw new Error(`AI服务连接失败: ${lastError.message}`);
};
