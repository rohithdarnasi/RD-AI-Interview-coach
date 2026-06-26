# 🚀 DevOps Interview Coach

> AI-powered mock technical interview tool for DevOps & Cloud engineers.  
> Ask real questions → evaluate answers → score you → give feedback → generate a study plan.

**Built with Python (FastAPI CLI) · Next.js · Claude AI · Deployed on Vercel**

---

## ✨ Features

- 🤖 **AI-generated questions** — unique, contextual DevOps/Cloud interview questions every time
- 📊 **Instant scoring** — 0–10 score per answer with constructive feedback
- 💡 **Ideal answer breakdown** — see exactly what a great answer covers
- 📚 **Streamed study plan** — personalized 1-week prep plan based on your weak areas
- 🎯 **10 topics** — Docker, Kubernetes, CI/CD, AWS, Terraform, Linux, Monitoring, Networking, SRE, Mixed
- 🎚️ **3 difficulty levels** — Junior, Mid-level, Senior
- 🖥️ **CLI tool** (Python/Rich TUI) + **Web app** (Next.js)
- 💾 **Session history** — CLI saves all sessions to `~/.devops_coach/`

---

## 🗂️ Project Structure

```
devops-interview-coach/
├── cli/
│   ├── interview_coach.py     # 🐍 Python CLI — main Python showcase
│   └── requirements.txt
├── api/
│   ├── main.py                # 🐍 FastAPI backend (optional self-host)
│   └── requirements.txt
├── src/
│   ├── pages/
│   │   ├── index.tsx          # Main interview UI
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   └── api/
│   │       ├── generate-question.ts   # Next.js serverless → Claude
│   │       ├── evaluate-answer.ts
│   │       └── study-plan.ts          # SSE streaming
│   └── styles/globals.css
├── package.json
├── next.config.js
├── tailwind.config.js
└── vercel.json
```

---

## 🚀 Quick Start — Web App (Vercel)

### 1. Deploy to Vercel (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/devops-interview-coach)

After deploying:
1. Go to **Settings → Environment Variables**
2. Add `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
3. Redeploy

### 2. Run locally

```bash
git clone https://github.com/YOUR_USERNAME/devops-interview-coach
cd devops-interview-coach

# Install dependencies
npm install

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Start dev server
npm run dev
# Open http://localhost:3000
```

---

## 🐍 CLI Tool (Python)

The CLI is the Python showcase — uses `dataclasses`, `rich` TUI, `argparse`, type hints, enums, async patterns.

### Setup

```bash
cd cli
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Usage

```bash
# Interactive mode (recommended first time)
python interview_coach.py

# With flags
python interview_coach.py --name "Alice" --topic 2 --difficulty 3 --questions 5

# Quick 3-question Docker junior drill
python interview_coach.py --name "Bob" --topic 1 --difficulty 1 --questions 3

# View past session history
python interview_coach.py --history

# Help
python interview_coach.py --help
```

**Topic numbers:**
| # | Topic |
|---|-------|
| 1 | Docker & Containers |
| 2 | Kubernetes & Orchestration |
| 3 | CI/CD Pipelines |
| 4 | AWS / Cloud Fundamentals |
| 5 | Terraform / IaC |
| 6 | Linux & Shell Scripting |
| 7 | Monitoring & Observability |
| 8 | Networking & Security |
| 9 | Site Reliability Engineering |
| 10 | Mixed (All Topics) |

**Difficulty:** `1` = Junior, `2` = Mid-level, `3` = Senior

### CLI Screenshot

```
╔═══════════════════════════════════════════════════════════════╗
║          🚀  DevOps Interview Coach  🚀                       ║
║          AI-Powered Mock Technical Interviews                 ║
║          Built with Python · Powered by Claude                ║
╚═══════════════════════════════════════════════════════════════╝

? Your name: Alice
? Topic: [10] Mixed (All Topics)
? Difficulty: [2] Mid-level

┌─ Question 1 · SCENARIO · Mixed (All Topics) ──────────────┐
│                                                             │
│  ▸ Your Kubernetes cluster is experiencing high memory      │
│    pressure. Pods are being OOMKilled. Walk me through      │
│    your diagnosis and remediation steps.                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

  > I would first check pod resource requests/limits with
    kubectl describe pod... [answer]

📊 Evaluation
  Score: ████████░░ 8/10
  Good understanding of OOM scenarios. You correctly identified
  resource limits and mentioned kubectl top. Missing: mention of
  VPA/HPA for autoscaling and node-level pressure via kubectl
  describe node.

💡 Key Points for an Ideal Answer
  ✓ Check limits with kubectl describe / kubectl top pods
  ✓ Adjust resource requests and limits appropriately
  ✓ Consider VPA, HPA, or node scaling strategies
```

---

## 🔧 Self-hosted FastAPI Backend

If you prefer running the Python backend yourself instead of Next.js serverless:

```bash
cd api
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."
uvicorn main:app --reload --port 8000

# API docs: http://localhost:8000/docs
```

Endpoints:
- `POST /generate-question` — generate interview question
- `POST /evaluate-answer` — score and evaluate answer
- `POST /study-plan/stream` — SSE stream study plan

---

## 🌐 Deploy to Vercel

### GitHub → Vercel flow

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "feat: devops interview coach"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/devops-interview-coach.git
git push -u origin main

# 2. Import on Vercel
# Go to vercel.com → New Project → Import your repo
# Framework: Next.js (auto-detected)
# Add env var: ANTHROPIC_API_KEY

# 3. Deploy — done!
```

The `vercel.json` is included and pre-configured.

---

## 🐍 Python Concepts Showcased

| Concept | Where |
|---------|-------|
| `dataclasses` with `field()` | `SessionState`, `Question`, `Answer` |
| Type hints + generics | Throughout (`list[str]`, `Optional`, `AsyncGenerator`) |
| `Enum` | `QuestionType` |
| `argparse` | CLI argument handling |
| `@property` computed attrs | `SessionState.total_score`, `.grade`, `.verdict` |
| `rich` TUI | Full terminal UI with panels, tables, progress |
| `pathlib.Path` | Session save/load |
| `asyncio` + thread executor | FastAPI async Claude calls |
| FastAPI + Pydantic v2 | REST API with validation |
| SSE streaming | `/study-plan/stream` endpoint |
| JSON serialization | `to_dict()` method |
| Error handling patterns | `try/except` with graceful fallbacks |
| Context managers | `anthropic.messages.stream()` |

---

## 📋 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `open api key` | ✅ Yes | Get from [console.anthropic.com](https://console.anthropic.com) |

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| AI | Claude claude-opus-4-6 via Anthropic SDK |
| CLI | Python 3.11+ · Rich · dataclasses · argparse |
| Backend | FastAPI · Pydantic v2 · uvicorn |
| Frontend | Next.js 14 · TypeScript · Tailwind CSS |
| Deployment | Vercel (serverless) |
| Streaming | Server-Sent Events (SSE) |

---

## 📄 License

MIT — use freely, build on it, ace your interviews.
