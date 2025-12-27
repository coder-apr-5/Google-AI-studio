

import { GoogleGenAI, Type, Content } from "@google/genai";
import { ProductCategory, Product, Farmer } from "../types";

// Use Vite's environment variable pattern with hackathon fallback
const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// HACKATHON FALLBACK: Only use if env var is missing (remove in production)
const FALLBACK_API_KEY = "AIzaSyDElpj5eaEXHsFSb_GfcQzwS0273mE11kw";

const API_KEY = ENV_API_KEY || FALLBACK_API_KEY;

// Track if using fallback for UI warning
export const isUsingFallbackKey = !ENV_API_KEY;

if (!ENV_API_KEY) {
  console.warn("[GeminiService] VITE_GEMINI_API_KEY not set. Using fallback key for demo.");
  console.warn("[GeminiService] AI features may be limited. Check your .env configuration.");
}

// Initialize GoogleGenAI with API key
const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

// FIX: Updated function to return ProductCategory enum type for category to match component state type.
export const generateProductDetails = async (imageBase64: string, mimeType: string): Promise<{ name: string; category: ProductCategory; description: string; is_valid_agri?: boolean }> => {
  try {
    const imagePart = fileToGenerativePart(imageBase64, mimeType);
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
          parts: [
            imagePart,
            { text: "Analyze this image. First determine if it shows a valid agricultural product (fruits, vegetables, grains, crops, or farm produce). If it's NOT an agricultural product (like electronics, furniture, people, animals, etc.), set is_valid_agri to false. If it IS agricultural, suggest a product name, category from ('Fruit', 'Vegetable', 'Grain', 'Other'), and a brief description. Return JSON with: is_valid_agri (boolean), name (string), category (string), description (string)." },
          ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_valid_agri: { type: Type.BOOLEAN, description: "True only if the image shows agricultural produce (fruits, vegetables, grains, crops)." },
            name: { type: Type.STRING, description: "The suggested name of the product." },
            category: { type: Type.STRING, description: "The suggested category: Fruit, Vegetable, Grain, or Other." },
            description: { type: Type.STRING, description: "A brief, appealing description for the product." }
          },
          required: ["is_valid_agri", "name", "category", "description"],
        },
      },
    });

    const text = result.text.trim();
    const parsedResult = JSON.parse(text) as { is_valid_agri: boolean; name: string; category: string; description: string };

    // Validate category and convert string to ProductCategory enum
    const categoryString = parsedResult.category || '';
    const categoryEnumValue = Object.values(ProductCategory).find(
      (c) => c.toLowerCase() === categoryString.toLowerCase()
    );

    return {
      is_valid_agri: parsedResult.is_valid_agri,
      name: parsedResult.name,
      description: parsedResult.description,
      category: categoryEnumValue || ProductCategory.Other,
    };
  } catch (error) {
    console.error("Error generating product details with Gemini:", error);
    throw new Error("Failed to generate product details. Please try again or enter manually.");
  }
};

export const verifyProductListing = async (productData: { name: string, description: string, imageBase64: string, mimeType: string }): Promise<{ isVerified: boolean; feedback: string }> => {
    try {
        const imagePart = fileToGenerativePart(productData.imageBase64, productData.mimeType);
        const prompt = `You are an agricultural product authenticity verifier. Analyze the image and compare it with the product name ("${productData.name}") and description ("${productData.description}"). Check for visual quality and authenticity. Respond with JSON containing 'isVerified' (boolean) and 'feedback' (string). 'isVerified' should be true only if the image clearly matches the product name and appears to be of good quality. The feedback should explain your reasoning concisely.`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isVerified: { type: Type.BOOLEAN, description: "True if the product image matches the text and seems authentic." },
                        feedback: { type: Type.STRING, description: "A concise explanation for the verification status." }
                    },
                    required: ["isVerified", "feedback"]
                }
            }
        });

        const text = result.text.trim();
        return JSON.parse(text) as { isVerified: boolean; feedback: string };
    } catch (error) {
        console.error("Error verifying product listing with Gemini:", error);
        throw new Error("Failed to verify product. The AI service may be temporarily unavailable.");
    }
};

export const verifyFarmerProfile = async (farmer: Farmer): Promise<{ isVerified: boolean; feedback: string }> => {
    try {
        const prompt = `You are a trust and safety specialist for an agricultural marketplace called Anna Bazaar. Analyze the following farmer profile data for authenticity and trustworthiness. A plausible profile has a descriptive bio, a reasonable number of years farming, and a specific location. A generic, vague, or suspicious profile should be flagged.
        
        Data:
        - Name: "${farmer.name}"
        - Bio: "${farmer.bio}"
        - Years Farming: ${farmer.yearsFarming}
        - Location: "${farmer.location}"

        Respond ONLY with a JSON object containing 'isVerified' (boolean) and 'feedback' (string). The feedback should be a concise, one-sentence explanation for your decision. For example, if verified: "Profile details appear consistent and trustworthy." If not verified: "Profile bio is too generic and lacks specific details."`;
        
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isVerified: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING }
                    },
                    required: ["isVerified", "feedback"]
                }
            }
        });
        
        const text = result.text.trim();
        return JSON.parse(text) as { isVerified: boolean; feedback: string };
    } catch (error) {
        console.error("Error verifying farmer profile with Gemini:", error);
        throw new Error("Failed to verify farmer. The AI service may be temporarily unavailable.");
    }
};


export const generateCounterOfferSuggestion = async (details: { productName: string; originalPrice: number; offeredPrice: number; quantity: number }): Promise<number> => {
    if (!API_KEY) {
        throw new Error("Gemini API key is not configured.");
    }
    
    const { productName, originalPrice, offeredPrice, quantity } = details;

    try {
        const prompt = `As a negotiation expert for an agricultural marketplace, suggest a reasonable counter-offer price. The product is '${productName}'. The original price per item is ₹${originalPrice}. The buyer has offered ₹${offeredPrice} per item for a quantity of ${quantity}. Your counter-offer should be fair to both the farmer and the buyer, encouraging a successful deal. Respond only with a JSON object containing a single key 'suggestedPrice' which is a number.`;
        
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestedPrice: { type: Type.NUMBER }
                    },
                    required: ["suggestedPrice"]
                }
            }
        });

        const text = result.text.trim();
        const parsedResult = JSON.parse(text) as { suggestedPrice: number };

        return parsedResult.suggestedPrice;
    } catch (error) {
        console.error("Error generating counter-offer suggestion with Gemini:", error);
        throw new Error("Failed to generate suggestion. Please try again.");
    }
};

export const getChatResponse = async (
  history: Content[],
  newMessage: string,
  useThinkingMode: boolean
): Promise<string> => {
  if (!API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const modelName = useThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
  
  const contents: Content[] = [
    ...history,
    { role: 'user', parts: [{ text: newMessage }] }
  ];

  try {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      // FIX: Correctly placed thinkingConfig inside the main config object.
      config: {
        systemInstruction: "You are Anna, a helpful assistant for the Anna Bazaar agricultural marketplace. You can answer questions about products, farming, negotiations, and general topics. Be friendly and concise.",
        ...(useThinkingMode && { thinkingConfig: { thinkingBudget: 32768 } })
      }
    });

    const text = result.text;
    if (!text) {
      throw new Error("Received an empty response from the AI.");
    }
    return text;
  } catch (error) {
    console.error(`Error getting chat response with ${modelName}:`, error);
    throw new Error("Sorry, I'm having trouble connecting to my brain right now. Please try again later.");
  }
};