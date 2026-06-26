import type { NextApiRequest, NextApiResponse } from "next";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { question, answer } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `You are a strict but fair DevOps interviewer.

Question: ${question}
Candidate's answer: ${answer}

Evaluate the answer. Reply with ONLY valid JSON (no markdown fences):
{
  "score": <integer 0-10>,
  "feedback": "<2-3 sentences of specific, constructive feedback>",
  "ideal_points": ["<point 1>", "<point 2>", "<point 3>"]
}`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!raw) {
      console.error("Gemini response:", JSON.stringify(data));
      return res.status(500).json({ error: "No evaluation returned" });
    }

    let parsed;
    try {
      const clean = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { score: 5, feedback: raw.slice(0, 300), ideal_points: [] };
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
}
