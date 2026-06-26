import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'

const TOPICS: Record<string, string> = {
  docker: 'Docker & Containers',
  kubernetes: 'Kubernetes & Orchestration',
  cicd: 'CI/CD Pipelines',
  aws: 'AWS / Cloud Fundamentals',
  terraform: 'Infrastructure as Code (Terraform)',
  linux: 'Linux & Shell Scripting',
  monitoring: 'Monitoring & Observability',
  networking: 'Networking & Security',
  sre: 'Site Reliability Engineering',
  mixed: 'Mixed (All Topics)',
}

const DIFFICULTY_DESC: Record<string, string> = {
  junior: 'Focus on foundational concepts, basic commands, and simple scenarios.',
  mid: 'Include architecture decisions, trade-offs, and real-world scenarios.',
  senior: 'Focus on system design, scaling challenges, incident response, and leadership scenarios.',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { topic, difficulty, question_number, previous_questions = [], question_types_used = [] } = req.body

 const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

const client = new OpenAI({ apiKey })
  const topicLabel = TOPICS[topic] || topic
  const diffDesc = DIFFICULTY_DESC[difficulty] || ''
  const prevQ = previous_questions.length > 0
    ? previous_questions.map((q: string) => `- ${q}`).join('\n')
    : 'None yet'

  const system = `You are a senior DevOps/Cloud hiring manager conducting a technical interview.
Generate ONE realistic, specific interview question. Be direct and professional.

Respond in this exact JSON format:
{"question": "...", "type": "conceptual|practical|scenario|debugging|design"}

Types: conceptual=theory/fundamentals, practical=how-to task, scenario=real problem, debugging=diagnose issue, design=architect solution
Return ONLY valid JSON. No markdown fences. No extra text.`

  const user = `Topic: ${topicLabel}
Difficulty: ${difficulty} — ${diffDesc}
Question #${question_number} of 5
Previous questions (avoid repeating):
${prevQ}
Types already used: ${question_types_used.join(', ') || 'none'}
Prefer a different type if possible. Generate question #${question_number}.`

  try {
   const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 600,
    messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ],
})
const raw = response.choices[0].message.content?.trim() ?? ''

    try {
      const data = JSON.parse(raw)
      return res.json({
        question: data.question,
        question_type: data.type || 'conceptual',
        topic,
        difficulty,
        number: question_number,
      })
    } catch {
      return res.json({
        question: raw.slice(0, 400),
        question_type: 'conceptual',
        topic,
        difficulty,
        number: question_number,
      })
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate question' })
  }
}
