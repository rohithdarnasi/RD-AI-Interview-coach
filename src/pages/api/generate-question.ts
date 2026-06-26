import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { topic, difficulty } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      `Generate a single ${difficulty}-level DevOps/Cloud technical interview question about ${topic}. Return ONLY the question text, no numbering, no preamble.`
    );
    const question = result.response.text().trim();
    res.status(200).json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate question" });
  }
}
