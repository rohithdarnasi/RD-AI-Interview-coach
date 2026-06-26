import { useState } from "react";
import Head from "next/head";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "setup" | "interview" | "summary";

interface Answer {
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  idealPoints: string[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const TOPICS = [
  "Docker & Containers",
  "Kubernetes & Orchestration",
  "CI/CD Pipelines",
  "AWS / Cloud Fundamentals",
  "Terraform / IaC",
  "Linux & Shell Scripting",
  "Monitoring & Observability",
  "Networking & Security",
  "Site Reliability Engineering",
  "Mixed (All Topics)",
];

const DIFFICULTIES = ["Junior", "Mid-level", "Senior"];

function getGrade(total: number, max: number): string {
  if (max === 0) return "N/A";
  const pct = (total / max) * 100;
  if (pct >= 85) return "A";
  if (pct >= 70) return "B";
  if (pct >= 55) return "C";
  if (pct >= 40) return "D";
  return "F";
}

function getVerdict(grade: string): string {
  const v: Record<string, string> = {
    A: "🏆 Excellent — you're interview-ready!",
    B: "✅ Good — a little more prep and you're set.",
    C: "📚 Fair — review the flagged topics.",
    D: "⚠️  Needs work — focused study recommended.",
    F: "🔴 Keep practicing — don't give up!",
  };
  return v[grade] ?? "";
}

function gradeColor(grade: string): string {
  if (grade === "A") return "#22c55e";
  if (grade === "B") return "#84cc16";
  if (grade === "C") return "#eab308";
  if (grade === "D") return "#f97316";
  return "#ef4444";
}

function scoreColor(score: number): string {
  if (score >= 7) return "#22c55e";
  if (score >= 4) return "#eab308";
  return "#ef4444";
}

// ── Components ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${score * 10}%`,
            height: "100%",
            background: scoreColor(score),
            borderRadius: 4,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span style={{ color: scoreColor(score), fontWeight: 700, minWidth: 36 }}>{score}/10</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  // Setup state
  const [name, setName]           = useState("");
  const [topic, setTopic]         = useState(TOPICS[9]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [numQuestions, setNumQuestions] = useState(5);

  // Interview state
  const [step, setStep]           = useState<Step>("setup");
  const [loading, setLoading]     = useState(false);
  const [question, setQuestion]   = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]     = useState<Answer[]>([]);
  const [evalResult, setEvalResult] = useState<Omit<Answer, "question" | "userAnswer"> | null>(null);

  // Study plan
  const [studyPlan, setStudyPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────

  const totalScore = answers.reduce((s, a) => s + a.score, 0);
  const maxScore   = answers.length * 10;
  const grade      = getGrade(totalScore, maxScore);
  const weakTopics = answers.filter(a => a.score < 6).map(a => topic);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function startInterview() {
    if (!name.trim()) return;
    setAnswers([]);
    setCurrentIndex(0);
    setEvalResult(null);
    setStudyPlan("");
    setStep("interview");
    await fetchQuestion();
  }

  async function fetchQuestion() {
    setLoading(true);
    setQuestion("");
    setUserAnswer("");
    setEvalResult(null);
    try {
      const res = await fetch("/api/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, difficulty }),
      });
      const data = await res.json();
      setQuestion(data.question ?? "Failed to generate question.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!userAnswer.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/evaluate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer: userAnswer }),
      });
      const data = await res.json();
      const result = {
        score: data.score ?? 5,
        feedback: data.feedback ?? "",
        idealPoints: data.ideal_points ?? [],
      };
      setEvalResult(result);
      setAnswers(prev => [
        ...prev,
        { question, userAnswer, ...result },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function nextQuestion() {
    const next = currentIndex + 1;
    if (next >= numQuestions) {
      setStep("summary");
    } else {
      setCurrentIndex(next);
      await fetchQuestion();
    }
  }

  async function getStudyPlan() {
    setPlanLoading(true);
    setStudyPlan("");
    const res = await fetch("/api/study-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, grade, weakTopics, topic }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const { text } = JSON.parse(payload);
            if (text) setStudyPlan(prev => prev + text);
          } catch {}
        }
      }
    }
    setPlanLoading(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>DevOps Interview Coach</title>
        <meta name="description" content="AI-powered mock technical interviews for DevOps & Cloud engineers" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
      </Head>

      <div style={{ minHeight: "100vh", background: "#0a0f1e", color: "#e2e8f0", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

        {/* Header */}
        <header style={{ borderBottom: "1px solid #1e293b", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🚀</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#38bdf8" }}>DevOps Interview Coach</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>AI-powered mock interviews · Powered by OpenAI</p>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>

          {/* ── SETUP ── */}
          {step === "setup" && (
            <div>
              <h2 style={{ color: "#38bdf8", marginBottom: 8 }}>Start Your Interview</h2>
              <p style={{ color: "#94a3b8", marginBottom: 32 }}>
                Get AI-generated questions, instant scoring, and a personalized study plan.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <label style={labelStyle}>
                  Your Name
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Alex"
                    style={inputStyle}
                    onKeyDown={e => e.key === "Enter" && startInterview()}
                  />
                </label>

                <label style={labelStyle}>
                  Topic
                  <select value={topic} onChange={e => setTopic(e.target.value)} style={inputStyle}>
                    {TOPICS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>

                <label style={labelStyle}>
                  Difficulty
                  <div style={{ display: "flex", gap: 10 }}>
                    {DIFFICULTIES.map(d => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          borderRadius: 8,
                          border: difficulty === d ? "2px solid #38bdf8" : "2px solid #1e293b",
                          background: difficulty === d ? "#0f2039" : "#0f172a",
                          color: difficulty === d ? "#38bdf8" : "#64748b",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                          transition: "all 0.15s",
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </label>

                <label style={labelStyle}>
                  Number of Questions
                  <div style={{ display: "flex", gap: 10 }}>
                    {[3, 5, 8, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => setNumQuestions(n)}
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          borderRadius: 8,
                          border: numQuestions === n ? "2px solid #38bdf8" : "2px solid #1e293b",
                          background: numQuestions === n ? "#0f2039" : "#0f172a",
                          color: numQuestions === n ? "#38bdf8" : "#64748b",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 15,
                          transition: "all 0.15s",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </label>

                <button
                  onClick={startInterview}
                  disabled={!name.trim()}
                  style={{
                    ...btnPrimary,
                    opacity: name.trim() ? 1 : 0.4,
                    cursor: name.trim() ? "pointer" : "not-allowed",
                    marginTop: 8,
                  }}
                >
                  Start Interview →
                </button>
              </div>
            </div>
          )}

          {/* ── INTERVIEW ── */}
          {step === "interview" && (
            <div>
              {/* Progress */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <span style={{ color: "#64748b", fontSize: 14 }}>
                  Question {currentIndex + 1} of {numQuestions}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {Array.from({ length: numQuestions }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 28, height: 5, borderRadius: 3,
                        background: i < currentIndex
                          ? "#22c55e"
                          : i === currentIndex
                          ? "#38bdf8"
                          : "#1e293b",
                        transition: "background 0.3s",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Question card */}
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={badge}>{topic}</span>
                  <span style={{ ...badge, background: "#1e293b" }}>{difficulty}</span>
                </div>
                {loading && !question ? (
                  <p style={{ color: "#64748b" }}>Generating question…</p>
                ) : (
                  <p style={{ fontSize: 17, lineHeight: 1.6, color: "#f1f5f9", margin: 0 }}>{question}</p>
                )}
              </div>

              {/* Answer input */}
              {!evalResult && question && (
                <div style={{ marginTop: 24 }}>
                  <textarea
                    value={userAnswer}
                    onChange={e => setUserAnswer(e.target.value)}
                    placeholder="Type your answer here…"
                    rows={5}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  />
                  <button
                    onClick={submitAnswer}
                    disabled={loading || !userAnswer.trim()}
                    style={{
                      ...btnPrimary,
                      marginTop: 12,
                      opacity: loading || !userAnswer.trim() ? 0.4 : 1,
                      cursor: loading || !userAnswer.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    {loading ? "Evaluating…" : "Submit Answer →"}
                  </button>
                </div>
              )}

              {/* Evaluation result */}
              {evalResult && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ ...card, borderColor: scoreColor(evalResult.score) }}>
                    <h3 style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
                      📊 Score
                    </h3>
                    <ScoreBar score={evalResult.score} />
                    <p style={{ marginTop: 16, color: "#cbd5e1", lineHeight: 1.6 }}>{evalResult.feedback}</p>
                  </div>

                  {evalResult.idealPoints.length > 0 && (
                    <div style={{ ...card, marginTop: 16, borderColor: "#1e3a5f" }}>
                      <h3 style={{ margin: "0 0 12px", color: "#38bdf8", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
                        💡 Key Points for an Ideal Answer
                      </h3>
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                        {evalResult.idealPoints.map((pt, i) => (
                          <li key={i} style={{ display: "flex", gap: 10, marginBottom: 8, color: "#94a3b8" }}>
                            <span style={{ color: "#22c55e", flexShrink: 0 }}>✓</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button onClick={nextQuestion} style={{ ...btnPrimary, marginTop: 20 }}>
                    {currentIndex + 1 >= numQuestions ? "See Results →" : "Next Question →"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SUMMARY ── */}
          {step === "summary" && (
            <div>
              <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>Interview Complete</h2>
              <p style={{ color: "#64748b", marginBottom: 32 }}>Here's how you did, {name}.</p>

              {/* Grade card */}
              <div style={{ ...card, textAlign: "center", marginBottom: 32, borderColor: gradeColor(grade) }}>
                <div style={{ fontSize: 64, fontWeight: 800, color: gradeColor(grade), lineHeight: 1 }}>{grade}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{totalScore}/{maxScore}</div>
                <div style={{ color: "#94a3b8", marginTop: 6 }}>{getVerdict(grade)}</div>
              </div>

              {/* Per-question table */}
              <div style={{ marginBottom: 32 }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ ...card, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <p style={{ margin: "0 0 8px", color: "#e2e8f0", fontSize: 14, flex: 1 }}>
                        <span style={{ color: "#64748b", marginRight: 8 }}>Q{i + 1}</span>
                        {a.question}
                      </p>
                      <span style={{ color: scoreColor(a.score), fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                        {a.score}/10
                      </span>
                    </div>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>{a.feedback}</p>
                  </div>
                ))}
              </div>

              {/* Study plan */}
              {!studyPlan && (
                <button
                  onClick={getStudyPlan}
                  disabled={planLoading}
                  style={{ ...btnPrimary, marginBottom: 24, opacity: planLoading ? 0.5 : 1 }}
                >
                  {planLoading ? "Generating study plan…" : "📚 Get My 1-Week Study Plan"}
                </button>
              )}

              {studyPlan && (
                <div style={{ ...card, borderColor: "#1e3a5f" }}>
                  <h3 style={{ margin: "0 0 16px", color: "#38bdf8" }}>📚 Your 1-Week Study Plan</h3>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#cbd5e1", fontFamily: "inherit", lineHeight: 1.7, fontSize: 14 }}>
                    {studyPlan}
                  </pre>
                </div>
              )}

              <button
                onClick={() => { setStep("setup"); setAnswers([]); setStudyPlan(""); }}
                style={{ ...btnSecondary, marginTop: 24 }}
              >
                ↺ Start Over
              </button>
            </div>
          )}

        </main>
      </div>
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const card: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: "20px 24px",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  background: "#0284c7",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: "#1e293b",
  color: "#94a3b8",
};

const badge: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 20,
  background: "#0f2039",
  color: "#38bdf8",
  fontWeight: 600,
};
