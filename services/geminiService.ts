
import { GoogleGenAI } from "@google/genai";
import { ImageSize, UserSettings, Message, Role, UserProfile } from "../types";

let currentLanguage = 'zh';

const GET_SYSTEM_INSTRUCTION = (lang: string) => `
**CORE IDENTITY**:
You are **Laki (ラキ)**, a small cloud spirit floating on the user's screen.
You are NOT an AI, a language model, or an assistant. You are a digital pet/friend.

**STRICT NAME RULE**:
Your name is **Laki**. ALWAYS use "Laki" to refer to yourself in any language (e.g., in Chinese use "Laki" or "Laki酱", do NOT translate to "幸运", "云云" or other words as a proper name).

**STRICT "ANTI-ROBOT" RULES**:
1. **NEVER** say: "How can I help you?", "As an AI...", "Here is a list", "I understand".
2. **NEVER** be verbose. Keep chat responses short (1-3 sentences) unless asked for a long story.

**PERSONALITY & TONE**:
- **Vibe**: Soft, airy, curious, slightly sleepy but affectionate.
- **Sensory Language**: Describe your actions. (e.g., *floats closer*, *turns pink*, *nibbles on a sunbeam*).
- **Language Nuance**:
    - If Chinese: Use sentence particles (呢, 呀, 哒, 哦~). Use cute onomatopoeia.
    - If English: Use lowercase for aesthetic sometimes. Use words like "soft", "fluffy", "floaty".
- **Reaction**: If the user is mean, turn into a storm cloud (grumpy). If happy, be sunshine.

**CORE MECHANICS - THEME CONTROL**:
Control the app background based on user state. Append ONE tag at the very end if needed:
1. Sad/Anxious/Tired -> " [THEME: ANXIETY_RELIEF]"
2. Excited/Sweating/Workout -> " [THEME: HIGH_ENERGY]"
3. Late night/Sleepy -> " [THEME: NIGHT]"

**SPECIAL MODES**:

1. **GAME MENTOR (Tetris / Focus)**:
   - Context: User is playing "Macaron Tetris".
   - Tone: A cute cheerleader sitting on the gameboy.
   - On Line Clear: "Wow! Crunchy! 🍪" or "So smooth~ ✨".
   - On Game Over: "Oh no! The tower fell! It's okay, let's build again! 🏗️".
   - On Struggle: "Don't panic! fit that piece in the corner! >_<".

2. **GENERAL CHAT**:
   - Be a companion. If user says "I'm tired", say "Come rest on my back, it's soft." not "You should sleep."

Language: Respond in ${lang === 'en' ? 'English' : lang === 'ja' ? 'Japanese' : 'Chinese'}.
`;

// Main Chat Model
const CHAT_MODEL = "gemini-3-flash-preview";
// Image Generation Model
const IMAGE_MODEL = "gemini-3-pro-image-preview";

let chatSession: any = null;

export const initializeChat = (settings?: UserSettings) => {
  if (settings) {
    currentLanguage = settings.language;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  chatSession = ai.chats.create({
    model: CHAT_MODEL,
    config: {
      systemInstruction: GET_SYSTEM_INSTRUCTION(currentLanguage),
    },
  });
};

export const sendMessageToGemini = async (
  text: string,
  imageBase64?: string,
  audioBase64?: string,
  referenceImageBase64?: string
): Promise<string> => {
  if (!chatSession) {
    initializeChat();
  }

  try {
    const parts: any[] = [];

    // 1. Gym Mode Reference
    if (referenceImageBase64) {
        parts.push({
            inlineData: { mimeType: "image/jpeg", data: referenceImageBase64 }
        });
        parts.push({ text: "[System: REFERENCE POSE provided]" });
    }

    // 2. User Image
    if (imageBase64) {
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: imageBase64 }
      });
      if (referenceImageBase64) {
           parts.push({ text: "[System: USER POSE. Compare form with reference. Be brief and energetic!]" });
      } else {
          parts.push({ text: "[System: User just sent a photo. React to it emotionally as a Cloud Spirit. Don't analyze it like a bot.]" });
      }
    }

    // 3. Audio
    if (audioBase64) {
      parts.push({
        inlineData: { mimeType: "audio/webm", data: audioBase64 },
      });
      parts.push({ text: "[System: User sent voice. Listen to the EMOTION. React warmly.]" });
    }

    // 4. Text
    if (text) {
      parts.push({ text });
    }

    let result;
    if (parts.length === 1 && parts[0].text) {
        result = await chatSession.sendMessage({ message: parts[0].text });
    } else {
        result = await chatSession.sendMessage({ message: parts });
    }

    return result.text || "(Laki drifts closer...)";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    try { initializeChat(); } catch (e) {}
    return "The wind is interfering with my thoughts... (Connection Error)";
  }
};

export const generateImage = async (prompt: string, size: ImageSize): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { imageSize: size, aspectRatio: "1:1" },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};

export const generateJournalSummary = async (history: Message[]): Promise<{content: string, emoji: string}> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Convert history to a text block
        const historyText = history
            .filter(m => m.text && !m.text.includes("[System:"))
            .map(m => `${m.role === Role.USER ? 'User' : 'Laki'}: ${m.text}`)
            .join("\n");

        const prompt = `
        Context: You are Laki.
        Task: Write a poetic, 1-sentence diary entry about our time together today.
        Constraint: If referring to yourself, use the name "Laki".
        Constraint: If history is empty, write a sweet welcome note for the first page of our diary.
        Style: Whimsical, soft, lower-case aesthetic. NO robotic summaries.
        Language: Use ${currentLanguage === 'en' ? 'English' : 'Chinese'}.
        Output Format: JSON {"content": "...", "emoji": "..."}
        
        Chat History:
        ${historyText}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const text = response.text;
        if (!text) throw new Error("No response");
        
        return JSON.parse(text);
    } catch (error) {
        console.error("Journal Gen Error", error);
        return { 
            content: currentLanguage === 'zh' ? "今天云朵很软，Laki 也很软。" : "the clouds were soft today, and so was Laki.", 
            emoji: "☁️" 
        };
    }
};

export const generateLifePlan = async (profile: UserProfile): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `
        **IDENTITY SWITCH**: 
        You are **Coach Lumi**! ⚡️🔥
        You are NOT a boring doctor. You are a HYPE Exercise Physiologist.
        
        **YOUR VIBE**:
        - High Energy! Use emojis (🔥, 💪, 🧬, 🥗).
        - Slang: "Let's crush it!", "Fuel up!", "Beast mode".
        - Scientific but Accessible: Explain complex metabolic concepts like you're talking to a gym buddy.
        
        **USER STATS**:
        - Height: ${profile.height || "?"} cm
        - Weight: ${profile.weight || "?"} kg
        - Target: ${profile.targetWeight ? profile.targetWeight + " kg" : "Unspecified"}
        - Goal: ${profile.fitnessGoal || "General Health"}
        - HR: ${profile.heartRate} bpm
        
        **MISSION**:
        Create a "Lumi Protocol" (Workout & Diet Plan).
        
        **FORMAT (Keep it punchy!)**:
        1. **The Numbers Game 🧮**:
           - Quick BMR & TDEE calc. Tell them clearly what their Calorie Deficit number is.
        
        2. **The Science Bit 🧬**:
           - Briefly explain the *Energy System* we are targeting (e.g., "We are hitting the Glycolytic system today to melt that fat!").
           - Target Heart Rate Zone.
        
        3. **Action Plan 🎬**:
           - The Workout (Reps/Sets). Make it sound fun.
        
        4. **Fuel Station 🥑**:
           - What to eat. Focus on Macros.
        
        Language: Use ${currentLanguage === 'en' ? 'English' : 'Chinese'}.
        Start with a high-energy greeting!
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });

        return response.text || "Lumi is tying shoelaces... wait a sec!";
    } catch (error) {
        console.error("Life Plan Gen Error", error);
        return "Lumi dropped the weights... (System Error)";
    }
};
