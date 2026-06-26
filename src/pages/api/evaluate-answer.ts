import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { question, answer } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      `You are a strict but fair DevOps interviewer.

Question: ${question}
Candidate's answer: ${answer}

Evaluate the answer. Reply with ONLY valid JSON (no markdown fences):
{
  "score": <integer 0-10>,
  "feedback": "<2-3 sentences of specific, constructive feedback>",
  "ideal_points": ["<point 1>", "<point 2>", "<point 3>"]
}`
    );

    const raw = result.response.text().trim();
    let data;
    try {
      // Strip markdown fences if Gemini adds them anyway
      const clean = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      data = JSON.parse(clean);
    } catch {
      data = { score: 5, feedback: raw.slice(0, 300), ideal_points: [] };
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
}
