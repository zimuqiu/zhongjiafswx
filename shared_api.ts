/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";
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
let ai;
try {
    ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
}

export const getAi = () => ai;

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

    for (let i = 0; i < retries; i++) {
        try {
            const inputChars = getInputChars(params.contents);
            const apiCallPromise = ai.models.generateContent(params);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`请求超时（超过 ${requestTimeout / 1000} 秒）。`)), requestTimeout)
            );

            const response = await Promise.race([apiCallPromise, timeoutPromise]);
            
            const outputChars = response.text?.length || 0;
            const cost = calculateCost(inputChars, outputChars);
            return { response, cost };

        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${i + 1} of ${retries} failed:`, error);
            
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
