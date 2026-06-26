import Head from 'next/head'
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'interview' | 'feedback' | 'report' | 'studyplan'
type Difficulty = 'junior' | 'mid' | 'senior'
type QuestionType = 'conceptual' | 'practical' | 'scenario' | 'debugging' | 'design'

interface Question {
  question: string
  question_type: QuestionType
  topic: string
  difficulty: string
  number: number
}

interface Answer {
  question: Question
  userAnswer: string
  score: number
  feedback: string
  idealPoints: string[]
  timeTaken: number
}

interface SessionState {
  candidateName: string
  topic: string
  difficulty: Difficulty
  answers: Answer[]
  currentQuestion: Question | null
  questionNumber: number
}

const TOPICS: Record<string, string> = {
  docker: '🐳 Docker & Containers',
  kubernetes: '☸️  Kubernetes',
  cicd: '🔄 CI/CD Pipelines',
  aws: '☁️  AWS / Cloud',
  terraform: '🏗️  Terraform / IaC',
  linux: '🐧 Linux & Shell',
  monitoring: '📊 Monitoring & Observability',
  networking: '🌐 Networking & Security',
  sre: '🛡️  Site Reliability Engineering',
  mixed: '🎲 Mixed (All Topics)',
}

const DIFFICULTIES: { key: Difficulty; label: string; desc: string; color: string }[] = [
  { key: 'junior', label: 'Junior', desc: 'Fundamentals & basics', color: 'text-terminal-green border-terminal-green' },
  { key: 'mid', label: 'Mid-level', desc: 'Architecture & trade-offs', color: 'text-terminal-yellow border-terminal-yellow' },
  { key: 'senior', label: 'Senior', desc: 'System design & leadership', color: 'text-terminal-red border-terminal-red' },
]

const TYPE_COLORS: Record<QuestionType, string> = {
  conceptual: 'text-terminal-blue bg-terminal-blue/10 border-terminal-blue/30',
  practical: 'text-terminal-green bg-terminal-green/10 border-terminal-green/30',
  scenario: 'text-terminal-yellow bg-terminal-yellow/10 border-terminal-yellow/30',
  debugging: 'text-terminal-red bg-terminal-red/10 border-terminal-red/30',
  design: 'text-terminal-purple bg-terminal-purple/10 border-terminal-purple/30',
}

const TYPE_ICONS: Record<QuestionType, string> = {
  conceptual: '📖',
  practical: '⚙️',
  scenario: '🎯',
  debugging: '🔍',
  design: '🏛️',
}

const TOTAL_QUESTIONS = 5

// ─── Score helpers ─────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-terminal-green'
  if (score >= 5) return 'text-terminal-yellow'
  return 'text-terminal-red'
}

function getGrade(pct: number): string {
  if (pct >= 90) return 'A+ 🏆'
  if (pct >= 80) return 'A ⭐'
  if (pct >= 70) return 'B 👍'
  if (pct >= 60) return 'C 📚'
  return 'D 💪'
}

function getVerdict(pct: number): { text: string; color: string } {
  if (pct >= 80) return { text: '✅ Strong Hire', color: 'text-terminal-green' }
  if (pct >= 65) return { text: '🟡 Hire with Reservations', color: 'text-terminal-yellow' }
  if (pct >= 50) return { text: '🔄 Needs More Preparation', color: 'text-terminal-yellow' }
  return { text: '❌ Not Ready — Keep Practicing', color: 'text-terminal-red' }
}

// ─── Components ───────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 8 ? '#3fb950' : score >= 5 ? '#e3b341' : '#f85149'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-terminal-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full score-bar-fill transition-all"
          style={{ width: `${(score / 10) * 100}%`, background: color }}
        />
      </div>
      <span className="font-mono text-sm font-bold" style={{ color }}>
        {score}/10
      </span>
    </div>
  )
}

function Terminal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-terminal-border bg-terminal-bg/50">
        <div className="w-3 h-3 rounded-full bg-terminal-red/70" />
        <div className="w-3 h-3 rounded-full bg-terminal-yellow/70" />
        <div className="w-3 h-3 rounded-full bg-terminal-green/70" />
        <span className="ml-2 text-xs text-terminal-dim font-mono">devops-coach</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Spinner({ text = 'Processing...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 text-terminal-cyan">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="font-mono text-sm animate-pulse">{text}</span>
    </div>
  )
}

// ─── Setup Screen ─────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (name: string, topic: string, diff: Difficulty) => void }) {
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')

  const canStart = name.trim() && topic && difficulty

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">🚀</div>
        <h1 className="text-3xl font-bold font-mono text-terminal-cyan mb-2">
          DevOps Interview Coach
        </h1>
        <p className="text-terminal-dim text-sm font-mono">
          AI-powered mock interviews · Real questions · Instant feedback
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-terminal-dim font-mono">
          <span className="px-2 py-0.5 bg-terminal-surface border border-terminal-border rounded">Python</span>
          <span className="px-2 py-0.5 bg-terminal-surface border border-terminal-border rounded">FastAPI</span>
          <span className="px-2 py-0.5 bg-terminal-surface border border-terminal-border rounded">Next.js</span>
          <span className="px-2 py-0.5 bg-terminal-surface border border-terminal-border rounded">Claude AI</span>
        </div>
      </div>

      <Terminal>
        {/* Name */}
        <div className="mb-6">
          <label className="block text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">
            $ candidate_name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name..."
            className="w-full bg-terminal-bg border border-terminal-border rounded px-4 py-2.5 
                       font-mono text-terminal-text placeholder:text-terminal-border
                       focus:outline-none focus:border-terminal-cyan transition-colors"
          />
        </div>

        {/* Topic */}
        <div className="mb-6">
          <label className="block text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">
            $ select_topic
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TOPICS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTopic(key)}
                className={`text-left px-3 py-2.5 rounded border font-mono text-sm transition-all
                  ${topic === key
                    ? 'border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan'
                    : 'border-terminal-border text-terminal-dim hover:border-terminal-dim hover:text-terminal-text'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-8">
          <label className="block text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">
            $ set_difficulty
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                className={`px-3 py-3 rounded border font-mono text-sm transition-all text-center
                  ${difficulty === d.key
                    ? `${d.color} bg-current/10`
                    : 'border-terminal-border text-terminal-dim hover:border-terminal-dim'
                  }`}
              >
                <div className="font-bold">{d.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Start */}
        <button
          onClick={() => canStart && onStart(name.trim(), topic, difficulty as Difficulty)}
          disabled={!canStart}
          className={`w-full py-3 rounded font-mono font-bold text-sm transition-all
            ${canStart
              ? 'bg-terminal-green text-terminal-bg hover:bg-terminal-green/80 glow-green'
              : 'bg-terminal-border text-terminal-dim cursor-not-allowed'
            }`}
        >
          {canStart ? '▸ START INTERVIEW' : '▸ Fill all fields to begin'}
        </button>
      </Terminal>

      <p className="text-center text-xs text-terminal-dim font-mono mt-4">
        5 questions · AI-evaluated · Personalized study plan
      </p>
    </div>
  )
}

// ─── Interview Screen ──────────────────────────────────────────────────────

function InterviewScreen({
  session, onAnswerSubmit, loading, currentAnswer, setCurrentAnswer,
}: {
  session: SessionState
  onAnswerSubmit: (answer: string) => void
  loading: boolean
  currentAnswer: string
  setCurrentAnswer: (v: string) => void
}) {
  const q = session.currentQuestion
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startTime = useRef(Date.now())

  useEffect(() => {
    startTime.current = Date.now()
    textareaRef.current?.focus()
  }, [q])

  if (!q && loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Spinner text="Generating question..." />
      </div>
    )
  }

  if (!q) return null

  const progress = ((session.questionNumber - 1) / TOTAL_QUESTIONS) * 100
  const qColor = TYPE_COLORS[q.question_type as QuestionType] || TYPE_COLORS.conceptual

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-slide-in">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-mono text-terminal-dim mb-1.5">
          <span>{session.candidateName} · {TOPICS[session.topic]?.replace(/^.+?\s/, '')}</span>
          <span>Question {session.questionNumber} / {TOTAL_QUESTIONS}</span>
        </div>
        <div className="h-1 bg-terminal-border rounded-full overflow-hidden">
          <div
            className="h-full bg-terminal-cyan rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <Terminal className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${qColor}`}>
            {TYPE_ICONS[q.question_type as QuestionType]} {q.question_type.toUpperCase()}
          </span>
          <span className="text-xs font-mono text-terminal-dim">#{q.number}</span>
        </div>
        <p className="text-terminal-text leading-relaxed font-mono text-sm">
          <span className="text-terminal-green mr-2">▸</span>
          {q.question}
        </p>
      </Terminal>

      {/* Answer area */}
      <div className="mb-4">
        <label className="block text-xs font-mono text-terminal-dim mb-1.5">
          $ your_answer (be thorough — mention specific tools, commands, or examples)
        </label>
        <textarea
          ref={textareaRef}
          value={currentAnswer}
          onChange={e => setCurrentAnswer(e.target.value)}
          disabled={loading}
          placeholder="Type your answer here... Explain your reasoning, mention specific tools, configs, and real-world experience."
          rows={7}
          className="w-full bg-terminal-surface border border-terminal-border rounded px-4 py-3
                     font-mono text-sm text-terminal-text placeholder:text-terminal-border
                     focus:outline-none focus:border-terminal-cyan transition-colors resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onAnswerSubmit(currentAnswer)}
          disabled={loading || !currentAnswer.trim()}
          className={`flex-1 py-2.5 rounded font-mono font-bold text-sm transition-all
            ${!loading && currentAnswer.trim()
              ? 'bg-terminal-cyan text-terminal-bg hover:bg-terminal-cyan/80'
              : 'bg-terminal-border text-terminal-dim cursor-not-allowed'
            }`}
        >
          {loading ? '⏳ Evaluating...' : '▸ SUBMIT ANSWER'}
        </button>
        <button
          onClick={() => onAnswerSubmit('')}
          disabled={loading}
          className="px-4 py-2.5 rounded font-mono text-sm border border-terminal-border 
                     text-terminal-dim hover:border-terminal-dim hover:text-terminal-text 
                     transition-all disabled:opacity-50"
        >
          Skip
        </button>
      </div>

      {loading && (
        <div className="mt-4 flex justify-center">
          <Spinner text="Claude is evaluating your answer..." />
        </div>
      )}
    </div>
  )
}

// ─── Feedback Screen ───────────────────────────────────────────────────────

function FeedbackScreen({
  answer, questionNumber, onNext, isLast,
}: {
  answer: Answer
  questionNumber: number
  onNext: () => void
  isLast: boolean
}) {
  const scoreColor = getScoreColor(answer.score)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-terminal-cyan text-sm">
          Question {questionNumber} Feedback
        </h2>
        <span className={`font-mono font-bold text-2xl ${scoreColor}`}>
          {answer.score}/10
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <ScoreBar score={answer.score} />
      </div>

      {/* Your answer */}
      <Terminal className="mb-4">
        <p className="text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">Your Answer</p>
        <p className="text-terminal-text/80 text-sm font-mono leading-relaxed">
          {answer.userAnswer || '[Skipped]'}
        </p>
      </Terminal>

      {/* Feedback */}
      <div className={`border rounded-lg p-4 mb-4 ${
        answer.score >= 7 ? 'border-terminal-green/30 bg-terminal-green/5' :
        answer.score >= 5 ? 'border-terminal-yellow/30 bg-terminal-yellow/5' :
                            'border-terminal-red/30 bg-terminal-red/5'
      }`}>
        <p className="text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">📊 Evaluation</p>
        <p className="text-terminal-text text-sm leading-relaxed">{answer.feedback}</p>
      </div>

      {/* Ideal points */}
      {answer.idealPoints.length > 0 && (
        <div className="border border-terminal-blue/30 bg-terminal-blue/5 rounded-lg p-4 mb-6">
          <p className="text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">💡 Key Points for Full Marks</p>
          <ul className="space-y-1.5">
            {answer.idealPoints.map((pt, i) => (
              <li key={i} className="text-sm text-terminal-text flex gap-2">
                <span className="text-terminal-green flex-shrink-0">✓</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-3 rounded font-mono font-bold text-sm bg-terminal-cyan 
                   text-terminal-bg hover:bg-terminal-cyan/80 transition-all"
      >
        {isLast ? '▸ VIEW FINAL REPORT' : `▸ NEXT QUESTION (${questionNumber + 1}/${TOTAL_QUESTIONS})`}
      </button>
    </div>
  )
}

// ─── Report Screen ─────────────────────────────────────────────────────────

function ReportScreen({
  session, onStudyPlan, onRestart,
}: {
  session: SessionState
  onStudyPlan: () => void
  onRestart: () => void
}) {
  const total = session.answers.reduce((s, a) => s + a.score, 0)
  const max = session.answers.length * 10
  const pct = Math.round((total / max) * 100)
  const grade = getGrade(pct)
  const verdict = getVerdict(pct)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">{pct >= 70 ? '🏆' : pct >= 50 ? '📈' : '💪'}</div>
        <h2 className="font-mono text-2xl font-bold text-terminal-cyan mb-1">Interview Complete</h2>
        <p className="text-terminal-dim text-sm font-mono">{session.candidateName} · {TOPICS[session.topic]}</p>
      </div>

      {/* Scorecard */}
      <Terminal className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-mono text-terminal-dim mb-0.5">TOTAL SCORE</p>
            <p className={`font-mono text-3xl font-bold ${getScoreColor(total / session.answers.length)}`}>
              {total}<span className="text-terminal-dim text-lg">/{max}</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-mono text-terminal-dim mb-0.5">PERCENTAGE</p>
            <p className={`font-mono text-3xl font-bold ${getScoreColor(pct / 10)}`}>{pct}%</p>
          </div>
          <div>
            <p className="text-xs font-mono text-terminal-dim mb-0.5">GRADE</p>
            <p className="font-mono text-xl font-bold text-terminal-yellow">{grade}</p>
          </div>
          <div>
            <p className="text-xs font-mono text-terminal-dim mb-0.5">DIFFICULTY</p>
            <p className="font-mono text-lg font-bold text-terminal-text capitalize">{session.difficulty}</p>
          </div>
        </div>
        <div className={`border rounded px-3 py-2 text-center font-mono font-bold ${verdict.color} border-current/20 bg-current/5`}>
          {verdict.text}
        </div>
      </Terminal>

      {/* Per-question breakdown */}
      <div className="mb-6 space-y-2">
        {session.answers.map((ans, i) => (
          <div key={i} className="bg-terminal-surface border border-terminal-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <span className="text-xs font-mono text-terminal-dim">Q{i + 1} · {ans.question.question_type}</span>
                <p className="text-sm text-terminal-text/80 mt-0.5 line-clamp-2">{ans.question.question}</p>
              </div>
              <span className={`font-mono font-bold text-sm flex-shrink-0 ${getScoreColor(ans.score)}`}>
                {ans.score}/10
              </span>
            </div>
            <ScoreBar score={ans.score} />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onStudyPlan}
          className="flex-1 py-3 rounded font-mono font-bold text-sm bg-terminal-blue 
                     text-white hover:bg-terminal-blue/80 transition-all"
        >
          📚 Get Study Plan
        </button>
        <button
          onClick={onRestart}
          className="px-6 py-3 rounded font-mono text-sm border border-terminal-border 
                     text-terminal-dim hover:border-terminal-text hover:text-terminal-text transition-all"
        >
          🔄 New Interview
        </button>
      </div>
    </div>
  )
}

// ─── Study Plan Screen ────────────────────────────────────────────────────

function StudyPlanScreen({ session, onRestart }: { session: SessionState; onRestart: () => void }) {
  const [planText, setPlanText] = useState('')
  const [loading, setLoading] = useState(true)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const total = session.answers.reduce((s, a) => s + a.score, 0)
    const max = session.answers.length * 10

    const body = {
      candidate_name: session.candidateName,
      topic: session.topic,
      difficulty: session.difficulty,
      total_score: total,
      max_score: max,
      answers: session.answers.map(a => ({
        question: a.question.question,
        score: a.score,
      })),
    }

    fetch('/api/study-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { setLoading(false); return }
        const text = decoder.decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') { setLoading(false); return }
            try {
              const { chunk } = JSON.parse(payload)
              if (chunk) setPlanText(prev => prev + chunk)
            } catch {}
          }
        }
        pump()
      })
      pump()
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-terminal-cyan font-bold">📚 Your Study Plan</h2>
        {loading && <Spinner text="Generating..." />}
      </div>

      <Terminal className="mb-6 min-h-[300px]">
        {planText ? (
          <div className="markdown-content text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{planText}</ReactMarkdown>
            {loading && <span className="cursor" />}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <Spinner text="Claude is crafting your personalized study plan..." />
          </div>
        )}
      </Terminal>

      <button
        onClick={onRestart}
        className="w-full py-3 rounded font-mono font-bold text-sm bg-terminal-green 
                   text-terminal-bg hover:bg-terminal-green/80 transition-all"
      >
        🚀 Start Another Interview
      </button>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [session, setSession] = useState<SessionState>({
    candidateName: '',
    topic: '',
    difficulty: 'mid',
    answers: [],
    currentQuestion: null,
    questionNumber: 1,
  })
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentFeedback, setCurrentFeedback] = useState<Answer | null>(null)
  const answerStartTime = useRef(Date.now())

  const startInterview = useCallback(async (name: string, topic: string, difficulty: Difficulty) => {
    const newSession: SessionState = {
      candidateName: name,
      topic,
      difficulty,
      answers: [],
      currentQuestion: null,
      questionNumber: 1,
    }
    setSession(newSession)
    setLoading(true)
    setPhase('interview')

    const q = await fetchQuestion(topic, difficulty, 1, [], [])
    setSession(s => ({ ...s, currentQuestion: q }))
    setLoading(false)
    answerStartTime.current = Date.now()
  }, [])

  const fetchQuestion = async (
    topic: string, difficulty: string, number: number,
    prevQ: string[], typesUsed: string[]
  ): Promise<Question> => {
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic, difficulty, question_number: number,
        previous_questions: prevQ,
        question_types_used: typesUsed,
      }),
    })
    return res.json()
  }

  const submitAnswer = useCallback(async (userAnswer: string) => {
    if (!session.currentQuestion) return
    const timeTaken = (Date.now() - answerStartTime.current) / 1000
    setLoading(true)

    // Evaluate
    const evalRes = await fetch('/api/evaluate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: session.topic,
        difficulty: session.difficulty,
        question_text: session.currentQuestion.question,
        question_type: session.currentQuestion.question_type,
        user_answer: userAnswer,
      }),
    })
    const evaluation = await evalRes.json()

    const answer: Answer = {
      question: session.currentQuestion,
      userAnswer,
      score: evaluation.score,
      feedback: evaluation.feedback,
      idealPoints: evaluation.ideal_points || [],
      timeTaken,
    }

    setSession(s => ({ ...s, answers: [...s.answers, answer] }))
    setCurrentFeedback(answer)
    setCurrentAnswer('')
    setLoading(false)
    setPhase('feedback')
  }, [session])

  const nextQuestion = useCallback(async () => {
    const nextNum = session.questionNumber + 1

    if (nextNum > TOTAL_QUESTIONS) {
      setPhase('report')
      return
    }

    setLoading(true)
    setPhase('interview')

    const prevQ = session.answers.map(a => a.question.question)
    const typesUsed = session.answers.map(a => a.question.question_type)

    const q = await fetchQuestion(session.topic, session.difficulty, nextNum, prevQ, typesUsed)
    setSession(s => ({ ...s, currentQuestion: q, questionNumber: nextNum }))
    setLoading(false)
    answerStartTime.current = Date.now()
  }, [session])

  const restart = useCallback(() => {
    setPhase('setup')
    setSession({
      candidateName: '',
      topic: '',
      difficulty: 'mid',
      answers: [],
      currentQuestion: null,
      questionNumber: 1,
    })
    setCurrentAnswer('')
    setCurrentFeedback(null)
  }, [])

  return (
    <>
      <Head>
        <title>DevOps Interview Coach — AI Mock Interviews</title>
      </Head>

      <div className="min-h-screen bg-terminal-bg">
        {/* Top bar */}
        <div className="border-b border-terminal-border bg-terminal-surface/50 backdrop-blur sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚀</span>
              <span className="font-mono text-sm font-bold text-terminal-cyan">DevOps Coach</span>
            </div>
            {phase !== 'setup' && (
              <div className="flex items-center gap-3 text-xs font-mono text-terminal-dim">
                {session.answers.length > 0 && (
                  <span className="text-terminal-green">
                    {session.answers.reduce((s, a) => s + a.score, 0)}/{session.answers.length * 10} pts
                  </span>
                )}
                <button onClick={restart} className="hover:text-terminal-text transition-colors">
                  ↩ restart
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {phase === 'setup' && <SetupScreen onStart={startInterview} />}

        {phase === 'interview' && (
          <InterviewScreen
            session={session}
            onAnswerSubmit={submitAnswer}
            loading={loading}
            currentAnswer={currentAnswer}
            setCurrentAnswer={setCurrentAnswer}
          />
        )}

        {phase === 'feedback' && currentFeedback && (
          <FeedbackScreen
            answer={currentFeedback}
            questionNumber={session.questionNumber}
            onNext={nextQuestion}
            isLast={session.questionNumber >= TOTAL_QUESTIONS}
          />
        )}

        {phase === 'report' && (
          <ReportScreen
            session={session}
            onStudyPlan={() => setPhase('studyplan')}
            onRestart={restart}
          />
        )}

        {phase === 'studyplan' && (
          <StudyPlanScreen session={session} onRestart={restart} />
        )}

        {/* Footer */}
        <div className="border-t border-terminal-border mt-8">
          <div className="max-w-2xl mx-auto px-4 py-4 text-center text-xs font-mono text-terminal-dim">
            Built with Python · FastAPI · Next.js · Claude AI ·{' '}
            <a href="https://github.com" className="text-terminal-cyan hover:underline">GitHub</a>
          </div>
        </div>
      </div>
    </>
  )
}
