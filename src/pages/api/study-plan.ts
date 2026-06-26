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

export const config = { api: { responseLimit: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { candidate_name, topic, difficulty, total_score, max_score, answers } = req.body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const client = new Anthropic({ apiKey })
  const topicLabel = TOPICS[topic] || topic
  const pct = max_score > 0 ? Math.round((total_score / max_score) * 100) : 0
  const weakAreas = (answers || [])
    .filter((a: any) => a.score < 6)
    .map((a: any) => (a.question || '').slice(0, 50))

  const system = 'You are a DevOps career coach. Respond in clean markdown. Be specific and actionable.'
  const user = `Candidate: ${candidate_name}
Topic: ${topicLabel}
Difficulty: ${difficulty}
Score: ${total_score}/${max_score} (${pct}%)
Weak areas (score < 6): ${weakAreas.length ? weakAreas.join('; ') : 'None — excellent performance!'}

Write a concise 1-week study plan:
## Priority Topics
(top 3 to focus on)

## Resources
(specific docs, free labs, YouTube channels, hands-on platforms)

## This Week's Project
(one concrete hands-on project to build)

## Interview Tips
(2 specific tips based on their performance pattern)

Under 350 words. Use markdown headers and bullet points.`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: user }],
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ chunk: chunk.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
}
