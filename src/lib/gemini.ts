const GEMINI_API_KEY = "AIzaSyCZ3XGzKPYWP8cjWWwVv2AzmuE7a2Arw50";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;

export async function geminiChat(messages: {role: 'user'|'model', parts: {text: string}[]}[]) {
  const res = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: messages,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });
  if (!res.ok) throw new Error("Gemini API error");
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "[No response]";
} 