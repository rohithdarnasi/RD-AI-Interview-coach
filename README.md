# 🚀 DevOps Interview Coach

AI-powered mock technical interview tool for DevOps & Cloud engineers.  
Ask real questions → evaluate answers → score you → give feedback → generate a study plan.

**Built with Python · Next.js · OpenAI · Deployed on Vercel**

---

## ✨ Features

- 🤖 **AI-generated questions** — unique, contextual DevOps/Cloud questions every time
- 📊 **Instant scoring** — 0–10 score per answer with constructive feedback
- 💡 **Ideal answer breakdown** — see exactly what a great answer covers
- 📚 **Streamed study plan** — personalized 1-week prep plan based on your weak areas
- 🎯 **10 topics** — Docker, Kubernetes, CI/CD, AWS, Terraform, Linux, Monitoring, Networking, SRE, Mixed
- 🎚️ **3 difficulty levels** — Junior, Mid-level, Senior

---

## 🚀 Web App — Deploy to Vercel (one click)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Add environment variable: `OPENAI_API_KEY` = your key from [platform.openai.com](https://platform.openai.com/api-keys)
4. Deploy — done!

### Run locally

```bash
npm install
export OPENAI_API_KEY="sk-..."
npm run dev
# Open http://localhost:3000
```

---

## 🐍 CLI Tool (Python)

The CLI showcases Python best practices: `dataclasses`, `type hints`, `enums`, `rich` TUI, `argparse`, `pathlib`, streaming.

### Setup

```bash
cd cli
pip install -r requirements.txt
export OPENAI_API_KEY="sk-..."
```

### Usage

```bash
# Interactive mode (recommended)
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

### Topics

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

Difficulty: `1` = Junior · `2` = Mid-level · `3` = Senior

---

## 🐍 Python Concepts Showcased

| Concept | Where |
|---------|-------|
| `dataclasses` with `field()` | `SessionState`, `Question`, `Answer` |
| Type hints + generics | Throughout (`list[str]`, `Optional`) |
| `Enum` with custom attributes | `Topic`, `Difficulty` |
| `argparse` | CLI argument handling |
| `@property` computed attrs | `SessionState.total_score`, `.grade`, `.verdict` |
| `rich` TUI | Panels, tables, progress bars |
| `pathlib.Path` | Session save/load |
| OpenAI streaming | Study plan via `stream=True` |
| JSON serialization | `to_dict()` method |
| Error handling | `try/except` with graceful fallbacks |

---

## 📋 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | Get from [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| AI | OpenAI `gpt-4o-mini` |
| CLI | Python 3.11+ · Rich · dataclasses · argparse |
| Frontend | Next.js 14 · TypeScript |
| Deployment | Vercel (serverless) |
| Streaming | Server-Sent Events (SSE) |

---

MIT License
