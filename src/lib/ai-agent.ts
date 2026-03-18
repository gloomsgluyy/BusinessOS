
export interface AIConfig {
    apiKey: string;
}

export interface ExpenseData {
    amount: number;
    date: string;
    description: string;
    category: string;
    merchant: string;
}

export class AIAgent {
    private apiKey: string;
    private baseUrl = "https://openrouter.ai/api/v1";

    constructor(config?: AIConfig) {
        this.apiKey = config?.apiKey || "";
    }

    private async callMsg(messages: any[], model: string = "meta-llama/llama-4-scout-17b-16e-instruct") {
        // Use local API Proxy to avoid CORS/Browser issues and match server-side environment
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                messages
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
            throw new Error(err.error?.message || `API Error: ${res.status}`);
        }

        return res.json();
    }



    async chat(messages: any[], model?: string) {
        try {
            // Text chat uses plain string content (standard OpenAI format)
            // Only parseReceipt uses array format for multimodal (image) inputs
            const data = await this.callMsg(messages, model || "openai/gpt-oss-120b");
            const content = data.choices[0]?.message?.content;
            return content || "Sorry, I couldn't generate a response.";
        } catch (error: any) {
            console.error("AI Chat Error:", error);
            return `Error: ${error.message || "Unknown error"}. Please check your API Key.`;
        }
    }

    async analyzeImage(base64Image: string): Promise<string> {
        try {
            const data = await this.callMsg([
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Describe this image in detail for a business context. What is it, what is happening, and what are the key data points visible?" },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]
                }
            ], "meta-llama/llama-4-scout-17b-16e-instruct");

            return data.choices[0]?.message?.content || "No description generated.";
        } catch (error: any) {
            console.error("Image Analysis Error:", error);
            return `Error analyzing image: ${error.message}`;
        }
    }

    async parseReceipt(base64Image: string, model: string = "meta-llama/llama-4-scout-17b-16e-instruct"): Promise<ExpenseData | null> {
        try {
            const data = await this.callMsg([
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this receipt image from Indonesia. IMPORTANT RULES for Amount Extraction:\n1. '.' (dot) is ONLY a thousand separator (e.g., 6.462.035 -> 6462035).\n2. ',' (comma) is ONLY a decimal separator (e.g., 26.760,00 -> 26760.00).\n3. If you see ',00' or similar after a comma, it refers to cents/decimal parts. Do NOT add these zeroes to the integer value.\nExample: 'Rp 26.760,00' must be extracted as 26760 (number).\nExtract the following fields in JSON format: amount (number, clean raw value), date (ISO string), description (string), category (string), merchant (string). Return ONLY raw JSON." },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]
                }
            ], model);

            const text = data.choices[0]?.message?.content || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as ExpenseData;
            }
            return null;
        } catch (error) {
            console.error("Receipt Parsing Error:", error);
            return null;
        }
    }
}

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};
