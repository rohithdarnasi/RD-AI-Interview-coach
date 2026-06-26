import type { NextApiRequest, NextApiResponse } from "next";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, grade, weakTopics, topic } = req.body;
  const focus = weakTopics?.length ? weakTopics.join(", ") : topic;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `Create a concise 1-week DevOps study plan for ${name} (grade: ${grade}) focusing on: ${focus}. Use plain text with day headers (Day 1:, Day 2:, etc.). Be specific and actionable. Keep it under 300 words.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Gemini REST doesn't support true SSE streaming easily on serverless,
    // so we fetch the full response and stream it word-by-word to the client.
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Could not generate study plan.";

    // Stream word by word so the UI still feels live
    const words = text.split(" ");
    for (const word of words) {
      res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    res.end();
  }
}
