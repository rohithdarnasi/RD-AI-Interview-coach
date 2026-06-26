import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { topic, difficulty, question_text, question_type, user_answer } = req.body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const client = new Anthropic({ apiKey })
  const topicLabel = TOPICS[topic] || topic

  const system = `You are an expert DevOps/Cloud interviewer evaluating a candidate's answer.
Be fair, constructive, and specific. Score honestly — don't be overly generous or harsh.

Respond in this EXACT JSON format:
{
  "score": <integer 0-10>,
  "feedback": "<2-3 sentence constructive feedback paragraph>",
  "ideal_points": ["<key point 1>", "<key point 2>", "<key point 3>"]
}

Scoring: 9-10=exceptional (deep knowledge, edge cases), 7-8=good (main concepts, minor gaps), 
5-6=adequate (basics, missing details), 3-4=weak (gaps/misconceptions), 0-2=poor/no content.

Return ONLY valid JSON. No markdown fences.`

  const user = `Topic: ${topicLabel}
Difficulty: ${difficulty}
Question Type: ${question_type}
Question: ${question_text}

Candidate's Answer:
${user_answer?.trim() || '[No answer / Skipped]'}

Evaluate this answer now.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    try {
      const data = JSON.parse(raw)
      return res.json({
        score: Math.max(0, Math.min(10, parseInt(data.score) || 5)),
        feedback: data.feedback || 'Answer recorded.',
        ideal_points: data.ideal_points || [],
      })
    } catch {
      return res.json({
        score: 5,
        feedback: 'Answer evaluated. Keep practicing to strengthen your knowledge.',
        ideal_points: ['Review core concepts', 'Practice hands-on labs', 'Study real-world scenarios'],
      })
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Evaluation failed' })
  }
}
