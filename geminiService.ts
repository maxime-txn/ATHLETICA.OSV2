
import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog, NutritionLog, ActivitySession, AnalysisResponse, AnalysisError } from "./types";

// Fonction utilitaire pour préparer le contexte texte
const prepareContext = (
  training: TrainingLog[],
  nutrition: NutritionLog[],
  activity: ActivitySession[],
  userWeight: number
) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentTraining = training.filter(t => new Date(t.date) >= thirtyDaysAgo);
  const recentActivity = activity.filter(a => new Date(a.date) >= thirtyDaysAgo);
  const recentNutrition = nutrition.filter(n => new Date(n.date) >= thirtyDaysAgo);

  const enduranceContext = recentActivity.map(s => 
    `[${s.date}] ${s.type} (${s.mode || 'N/A'}): ${s.distance}km en ${s.duration}min, HR:${s.hr || 'N/A'}, Segments:${s.segments?.length || 0}`
  ).join('\n');

  const strengthContext = recentTraining.map(t => 
    `[${t.date}] ${t.session}: ${t.exercise} ${t.weight}kg x ${t.reps}`
  ).join('\n');
  
  const nutritionContext = recentNutrition.map(n =>
    `[${n.date}] P:${n.totals.prot || 0}g, G:${n.totals.carb || 0}g, L:${n.totals.fat || 0}g`
  ).join('\n');

  return `
  ### DONNÉES ATHLÈTE (30 JOURS) ###
  POIDS ACTUEL : ${userWeight}kg
  
  HISTORIQUE ENDURANCE :
  ${enduranceContext || "Aucune séance cardio."}

  HISTORIQUE MUSCULATION :
  ${strengthContext || "Aucune séance musculation."}

  HISTORIQUE NUTRITION :
  ${nutritionContext || "Aucune donnée nutrition."}
  `;
};

// Analyse Automatique (Dashboard)
export const analyzeAthletePerformance = async (
  training: TrainingLog[],
  nutrition: NutritionLog[],
  activity: ActivitySession[],
  userWeight: number = 80
): Promise<AnalysisResponse | AnalysisError> => {
  
  const contextData = prepareContext(training, nutrition, activity, userWeight);

  const systemInstruction = `Tu es l'IA analytique d'Athletica OS.
  TON OBJECTIF : Générer un rapport JSON strict et ultra-concis pour le tableau de bord de l'athlète.
  
  RÈGLES :
  1. Utilise Google Search SI NÉCESSAIRE pour vérifier des standards.
  2. Sois direct, pas de blabla.
  3. "loadScore" est une estimation 0-100 de la charge d'entraînement globale.
  
  FORMAT JSON ATTENDU :
  {
    "headline": "Titre court (max 5 mots)",
    "advice": "Conseil précis (max 25 mots)",
    "trend": "UP" | "FLAT" | "DOWN",
    "metrics": { "consistency": number, "pr": "string", "loadScore": number }
  }`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contextData,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              advice: { type: Type.STRING },
              trend: { type: Type.STRING, enum: ["UP", "FLAT", "DOWN"] },
              metrics: {
                type: Type.OBJECT,
                properties: {
                  consistency: { type: Type.NUMBER },
                  pr: { type: Type.STRING },
                  loadScore: { type: Type.NUMBER }
                },
                required: ["consistency", "pr", "loadScore"]
              }
            },
            required: ["headline", "advice", "trend", "metrics"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide");
    let result = JSON.parse(text.trim());
    
    // Ajout des sources si disponibles
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      result.groundingUrls = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({ title: chunk.web.title, uri: chunk.web.uri }));
    }

    return result as AnalysisResponse;

  } catch (error) {
    console.error("Analysis Error:", error);
    return { isError: true, message: "Erreur analyse." };
  }
};

// NOUVEAU : Chatbot Conversationnel
export const sendChatMessage = async (
  message: string,
  training: TrainingLog[],
  nutrition: NutritionLog[],
  activity: ActivitySession[],
  chatHistory: { role: string, parts: { text: string }[] }[]
): Promise<string> => {
  
  const contextData = prepareContext(training, nutrition, activity, 80); // Poids hardcodé pour l'instant
  
  const systemInstruction = `Tu es le Coach Intelligent d'Athletica OS.
  Tu as accès à tout l'historique d'entraînement de l'utilisateur (ci-dessous).
  
  TES DIRECTIVES :
  1. Réponds UNIQUEMENT aux questions sur le sport, la santé, la nutrition et la performance.
  2. Utilise les données fournies pour justifier tes réponses (ex: "Vu ta séance de mardi...").
  3. Sois encourageant mais réaliste et scientifique.
  4. Si tu as besoin d'infos externes (ex: record du monde, étude récente), utilise ton outil de recherche.
  5. Fais des réponses courtes et structurées (listes à puces si besoin).

  CONTEXTE DONNÉES :
  ${contextData}
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ message });
    return result.text || "Désolé, je n'ai pas pu générer de réponse.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Erreur de connexion avec le cerveau du coach.";
  }
};
