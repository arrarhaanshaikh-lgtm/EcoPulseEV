export async function sendChatMessage(data: { message: string }): Promise<string> {
  const env = import.meta.env as any;
  const apiKey = env?.VITE_GEMINI_API_KEY || env?.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ Gemini API key is missing!");
    return "API Key Missing: Please add VITE_GEMINI_API_KEY=your_key to your .env file and restart the server.";
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: data.message }],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: "You are EcoPulse AI, an EV charging assistant for EcoPulse EV. Provide brief, helpful advice on EV charging stations, low wait times, and grid load balancing.",
              },
            ],
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Gemini API Error:", result);
      return `Gemini Error: ${result?.error?.message || "Invalid response from API."}`;
    }

    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || "No response received from Gemini.";
  } catch (err) {
    console.error("❌ AI Fetch Error:", err);
    return "Network error while connecting to Gemini AI.";
  }
}