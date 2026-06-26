import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { topic, difficulty } = req.body;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Generate a single ${difficulty}-level DevOps/Cloud technical interview question about ${topic}. Return ONLY the question text, no numbering, no preamble.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.9,
    });

    const question = completion.choices[0].message.content?.trim();
    res.status(200).json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate question" });
  }
}
