import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { question, answer } = req.body;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `You are a strict but fair DevOps interviewer.

Question: ${question}
Candidate's answer: ${answer}

Evaluate the answer. Reply with ONLY valid JSON (no markdown fences):
{
  "score": <integer 0-10>,
  "feedback": "<2-3 sentences of specific, constructive feedback>",
  "ideal_points": ["<point 1>", "<point 2>", "<point 3>"]
}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content?.trim() ?? "{}";
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { score: 5, feedback: raw.slice(0, 300), ideal_points: [] };
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
}
