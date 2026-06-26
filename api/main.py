"""
DevOps Interview Coach — FastAPI Backend
Exposes REST endpoints consumed by the Next.js frontend.
Showcases: FastAPI, Pydantic v2, async generators (SSE), dataclasses, type hints.
"""

from __future__ import annotations

import os
import json
import asyncio
import textwrap
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncGenerator, Optional

from openai import AsyncOpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ─── Setup ────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="DevOps Interview Coach API",
    description="AI-powered DevOps/Cloud mock interview engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

TOPICS = {
    "docker": "Docker & Containers",
    "kubernetes": "Kubernetes & Orchestration",
    "cicd": "CI/CD Pipelines",
    "aws": "AWS / Cloud Fundamentals",
    "terraform": "Infrastructure as Code (Terraform)",
    "linux": "Linux & Shell Scripting",
    "monitoring": "Monitoring & Observability",
    "networking": "Networking & Security",
    "sre": "Site Reliability Engineering",
    "mixed": "Mixed (All Topics)",
}

DIFFICULTY_LEVELS = {
    "junior": "Focus on foundational concepts, basic commands, and simple scenarios.",
    "mid": "Include architecture decisions, trade-offs, and real-world scenarios.",
    "senior": "Focus on system design, scaling challenges, incident response, and leadership scenarios.",
}


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class GenerateQuestionRequest(BaseModel):
    topic: str
    difficulty: str
    question_number: int
    previous_questions: list[str] = Field(default_factory=list)
    question_types_used: list[str] = Field(default_factory=list)


class EvaluateAnswerRequest(BaseModel):
    topic: str
    difficulty: str
    question_text: str
    question_type: str
    user_answer: str


class StudyPlanRequest(BaseModel):
    candidate_name: str
    topic: str
    difficulty: str
    total_score: int
    max_score: int
    answers: list[dict]


class QuestionResponse(BaseModel):
    question: str
    question_type: str
    topic: str
    difficulty: str
    number: int


class EvaluationResponse(BaseModel):
    score: int
    feedback: str
    ideal_points: list[str]


# ─── AI Logic ─────────────────────────────────────────────────────────────────

def get_client() -> AsyncOpenAI:
    key = OPENAI_API_KEY
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return AsyncOpenAI(api_key=key)


async def call_openai_async(system: str, user: str, max_tokens: int = 1200) -> str:
    """Async call to OpenAI GPT-4o."""
    client = get_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return response.choices[0].message.content.strip()


async def stream_openai(system: str, user: str) -> AsyncGenerator[str, None]:
    """Stream OpenAI responses as SSE chunks."""
    client = get_client()
    stream = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=800,
        stream=True,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    async for chunk in stream:
        text = chunk.choices[0].delta.content
        if text:
            yield f"data: {json.dumps({'chunk': text})}\n\n"

    yield "data: [DONE]\n\n"


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/topics")
async def get_topics():
    return {"topics": TOPICS}


@app.get("/difficulties")
async def get_difficulties():
    return {"difficulties": list(DIFFICULTY_LEVELS.keys())}


@app.post("/generate-question", response_model=QuestionResponse)
async def generate_question(req: GenerateQuestionRequest):
    topic_label = TOPICS.get(req.topic, req.topic)
    diff_desc = DIFFICULTY_LEVELS.get(req.difficulty, "")
    prev_q_text = "\n".join(f"- {q}" for q in req.previous_questions) or "None yet"

    system = textwrap.dedent("""
        You are a senior DevOps/Cloud hiring manager conducting a technical interview.
        Generate ONE realistic, specific interview question. Be direct and professional.
        
        Respond in this exact JSON format:
        {"question": "...", "type": "conceptual|practical|scenario|debugging|design"}
        
        Types: conceptual=theory, practical=how-to, scenario=real problem, 
               debugging=diagnose issue, design=architect solution
        
        Return ONLY valid JSON. No markdown fences. No extra text.
    """).strip()

    user = textwrap.dedent(f"""
        Topic: {topic_label}
        Difficulty: {req.difficulty} — {diff_desc}
        Question #{req.question_number} of 5
        Previous questions (avoid repeating): {prev_q_text}
        Types already used: {', '.join(req.question_types_used) or 'none'}
        Prefer a different type. Generate question #{req.question_number}.
    """).strip()

    raw = await call_openai_async(system, user)

    try:
        data = json.loads(raw)
        return QuestionResponse(
            question=data["question"],
            question_type=data.get("type", "conceptual"),
            topic=req.topic,
            difficulty=req.difficulty,
            number=req.question_number,
        )
    except (json.JSONDecodeError, KeyError):
        return QuestionResponse(
            question=raw[:400],
            question_type="conceptual",
            topic=req.topic,
            difficulty=req.difficulty,
            number=req.question_number,
        )


@app.post("/evaluate-answer", response_model=EvaluationResponse)
async def evaluate_answer(req: EvaluateAnswerRequest):
    system = textwrap.dedent("""
        You are an expert DevOps/Cloud interviewer evaluating a candidate's answer.
        Be fair, constructive, and specific. Score honestly.
        
        Respond in this EXACT JSON format:
        {
            "score": <integer 0-10>,
            "feedback": "<2-3 sentence constructive feedback>",
            "ideal_points": ["<key point 1>", "<key point 2>", "<key point 3>"]
        }
        
        Scoring: 9-10=exceptional, 7-8=good, 5-6=adequate, 3-4=weak, 0-2=poor
        Return ONLY valid JSON. No markdown fences.
    """).strip()

    user = textwrap.dedent(f"""
        Topic: {TOPICS.get(req.topic, req.topic)}
        Difficulty: {req.difficulty}
        Question Type: {req.question_type}
        Question: {req.question_text}
        
        Candidate's Answer:
        {req.user_answer if req.user_answer.strip() else "[No answer / Skipped]"}
        
        Evaluate this answer.
    """).strip()

    raw = await call_openai_async(system, user)

    try:
        data = json.loads(raw)
        return EvaluationResponse(
            score=max(0, min(10, int(data.get("score", 5)))),
            feedback=data.get("feedback", "Answer recorded."),
            ideal_points=data.get("ideal_points", []),
        )
    except (json.JSONDecodeError, KeyError, ValueError):
        return EvaluationResponse(
            score=5,
            feedback="Answer evaluated. Keep practicing to strengthen your knowledge.",
            ideal_points=["Review core concepts", "Practice hands-on", "Study real-world scenarios"],
        )


@app.post("/study-plan/stream")
async def stream_study_plan(req: StudyPlanRequest):
    """Stream the study plan using SSE for real-time display."""
    weak_areas = [
        a.get("question", "")[:40] for a in req.answers if a.get("score", 10) < 6
    ]
    pct = round((req.total_score / req.max_score) * 100, 1) if req.max_score else 0

    system = "You are a DevOps career coach. Respond in markdown. Be specific and actionable."

    user = textwrap.dedent(f"""
        Candidate: {req.candidate_name}
        Topic: {TOPICS.get(req.topic, req.topic)}
        Difficulty: {req.difficulty}
        Score: {req.total_score}/{req.max_score} ({pct}%)
        Weak areas (score < 6): {', '.join(weak_areas) if weak_areas else 'None — excellent!'}
        
        Write a 1-week study plan with:
        1. Top 3 priority topics
        2. Specific resources (docs, free labs, projects)  
        3. One hands-on project to build this week
        4. Two interview tips tailored to their performance
        
        Under 350 words. Use markdown headers and bullets.
    """).strip()

    return StreamingResponse(
        stream_openai(system, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Run (dev) ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
