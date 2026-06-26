import type { NextApiRequest, NextApiResponse } from "next";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { topic, difficulty } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate a single ${difficulty}-level DevOps/Cloud technical interview question about ${topic}. Return ONLY the question text, no numbering, no preamble.`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const question = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!question) {
      console.error("Gemini response:", JSON.stringify(data));
      return res.status(500).json({ error: "No question returned" });
    }

    res.status(200).json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate question" });
  }
}
