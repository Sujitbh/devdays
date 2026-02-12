
import { GoogleGenAI, Type } from "@google/genai";
import { DetectionResult } from "../types";

export const analyzeAerialImage = async (base64Image: string): Promise<DetectionResult> => {
  // Always initialize GoogleGenAI with process.env.API_KEY directly inside the call context
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Analyze this aerial image of the Louisiana coast for avian activity and habitat health. 
  Focus on identifying bird colonies (Pelicans, Roseate Spoonbills, Herons), counting nests, and evaluating land-loss indicators.
  Return the analysis in a structured format.`;

  // Use gemini-3-pro-preview for complex reasoning and scientific analysis tasks
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          species: { type: Type.STRING, description: "Primary bird species detected" },
          count: { type: Type.NUMBER, description: "Estimated number of birds" },
          confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
          habitatType: { 
            type: Type.STRING, 
            description: "Type of habitat observed",
            enum: ["Marsh", "Barrier Island", "Swamp", "Open Water"]
          },
          nestingDetected: { type: Type.BOOLEAN, description: "Whether active nesting sites are visible" },
          notes: { type: Type.STRING, description: "Summary of biological observations" },
          threats: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Observed threats like erosion, pollution, or invasive species"
          }
        },
        required: ["species", "count", "confidence", "habitatType", "nestingDetected", "notes"]
      }
    }
  });

  try {
    // Access the .text property directly as per the latest SDK guidelines
    const text = response.text?.trim() || "{}";
    return JSON.parse(text) as DetectionResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Analysis failed to produce valid data.");
  }
};
