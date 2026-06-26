#!/usr/bin/env python3
"""
DevOps Interview Coach - CLI Tool
AI-powered mock technical interview using OpenAI API.
Showcases: dataclasses, type hints, enums, rich TUI, argparse, pathlib, JSON I/O
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from openai import OpenAI
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TextColumn
from rich.prompt import Prompt
from rich.table import Table
from rich import box

# ── Constants ────────────────────────────────────────────────────────────────

HISTORY_DIR = Path.home() / ".devops_coach"
console = Console()


# ── Enums ────────────────────────────────────────────────────────────────────

class Topic(Enum):
    DOCKER      = (1,  "Docker & Containers")
    KUBERNETES  = (2,  "Kubernetes & Orchestration")
    CICD        = (3,  "CI/CD Pipelines")
    AWS         = (4,  "AWS / Cloud Fundamentals")
    TERRAFORM   = (5,  "Terraform / IaC")
    LINUX       = (6,  "Linux & Shell Scripting")
    MONITORING  = (7,  "Monitoring & Observability")
    NETWORKING  = (8,  "Networking & Security")
    SRE         = (9,  "Site Reliability Engineering")
    MIXED       = (10, "Mixed (All Topics)")

    def __init__(self, number: int, label: str):
        self.number = number
        self.label = label

    @classmethod
    def from_number(cls, n: int) -> "Topic":
        for t in cls:
            if t.number == n:
                return t
        raise ValueError(f"No topic with number {n}")


class Difficulty(Enum):
    JUNIOR    = (1, "Junior")
    MID       = (2, "Mid-level")
    SENIOR    = (3, "Senior")

    def __init__(self, level: int, label: str):
        self.level = level
        self.label = label

    @classmethod
    def from_level(cls, n: int) -> "Difficulty":
        for d in cls:
            if d.level == n:
                return d
        raise ValueError(f"No difficulty with level {n}")


# ── Dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class Question:
    text: str
    topic: str
    difficulty: str
    number: int


@dataclass
class Answer:
    question: Question
    user_answer: str
    score: int                        # 0–10
    feedback: str
    ideal_points: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "question": self.question.text,
            "topic": self.question.topic,
            "difficulty": self.question.difficulty,
            "user_answer": self.user_answer,
            "score": self.score,
            "feedback": self.feedback,
            "ideal_points": self.ideal_points,
        }


@dataclass
class SessionState:
    name: str
    topic: Topic
    difficulty: Difficulty
    total_questions: int
    answers: list[Answer] = field(default_factory=list)
    started_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def total_score(self) -> int:
        return sum(a.score for a in self.answers)

    @property
    def max_score(self) -> int:
        return len(self.answers) * 10

    @property
    def grade(self) -> str:
        if not self.answers:
            return "N/A"
        pct = self.total_score / self.max_score * 100
        if pct >= 85: return "A"
        if pct >= 70: return "B"
        if pct >= 55: return "C"
        if pct >= 40: return "D"
        return "F"

    @property
    def verdict(self) -> str:
        g = self.grade
        verdicts = {
            "A": "🏆 Excellent — you're interview-ready!",
            "B": "✅ Good — a little more prep and you're set.",
            "C": "📚 Fair — review the flagged topics.",
            "D": "⚠️  Needs work — focused study recommended.",
            "F": "🔴 Keep practicing — don't give up!",
        }
        return verdicts.get(g, "")

    def weak_topics(self) -> list[str]:
        """Return topics where score < 6."""
        return [a.question.topic for a in self.answers if a.score < 6]

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "topic": self.topic.label,
            "difficulty": self.difficulty.label,
            "started_at": self.started_at,
            "total_score": self.total_score,
            "max_score": self.max_score,
            "grade": self.grade,
            "answers": [a.to_dict() for a in self.answers],
        }


# ── OpenAI helpers ────────────────────────────────────────────────────────────

def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        console.print("[red]❌  OPENAI_API_KEY environment variable not set.[/red]")
        console.print("    Get your key at: https://platform.openai.com/api-keys")
        sys.exit(1)
    return OpenAI(api_key=api_key)


def generate_question(client: OpenAI, topic: Topic, difficulty: Difficulty, number: int) -> Question:
    prompt = (
        f"Generate a single {difficulty.label}-level DevOps/Cloud technical interview question "
        f"about {topic.label}. "
        "Return ONLY the question text, no numbering, no preamble."
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.9,
    )
    text = response.choices[0].message.content.strip()
    return Question(text=text, topic=topic.label, difficulty=difficulty.label, number=number)


def evaluate_answer(client: OpenAI, question: Question, user_answer: str) -> Answer:
    prompt = f"""You are a strict but fair DevOps interviewer.

Question: {question.text}
Candidate's answer: {user_answer}

Evaluate the answer. Reply with ONLY valid JSON (no markdown fences):
{{
  "score": <integer 0-10>,
  "feedback": "<2-3 sentences of specific, constructive feedback>",
  "ideal_points": ["<point 1>", "<point 2>", "<point 3>"]
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.3,
    )
    raw = response.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Graceful fallback
        data = {"score": 5, "feedback": raw[:300], "ideal_points": []}

    return Answer(
        question=question,
        user_answer=user_answer,
        score=int(data.get("score", 5)),
        feedback=data.get("feedback", ""),
        ideal_points=data.get("ideal_points", []),
    )


def stream_study_plan(client: OpenAI, session: SessionState) -> None:
    weak = session.weak_topics()
    focus = ", ".join(weak) if weak else session.topic.label

    prompt = (
        f"Create a concise 1-week DevOps study plan for {session.name} "
        f"(grade: {session.grade}) focusing on: {focus}. "
        "Use plain text with day headers (Day 1:, Day 2:, etc.). Be specific and actionable. "
        "Keep it under 300 words."
    )

    console.print("\n[bold cyan]📚 Your Personalized 1-Week Study Plan[/bold cyan]\n")

    with client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        stream=True,
    ) as stream:
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                console.print(delta, end="")

    console.print("\n")


# ── Display helpers ───────────────────────────────────────────────────────────

def show_banner() -> None:
    console.print(Panel.fit(
        "[bold cyan]🚀  DevOps Interview Coach  🚀[/bold cyan]\n"
        "[dim]AI-Powered Mock Technical Interviews[/dim]\n"
        "[dim]Built with Python · Powered by OpenAI[/dim]",
        box=box.DOUBLE,
        border_style="cyan",
    ))


def show_question(q: Question, total: int) -> None:
    console.print(Panel(
        f"[bold yellow]{q.text}[/bold yellow]",
        title=f"[bold]Question {q.number} of {total}[/bold]  ·  {q.topic}  ·  {q.difficulty}",
        border_style="yellow",
        padding=(1, 2),
    ))


def show_evaluation(answer: Answer) -> None:
    score = answer.score
    filled = "█" * score
    empty  = "░" * (10 - score)
    color  = "green" if score >= 7 else "yellow" if score >= 4 else "red"

    console.print(Panel(
        f"[bold]Score:[/bold] [{color}]{filled}{empty}[/{color}] [bold]{score}/10[/bold]\n\n"
        f"{answer.feedback}",
        title="📊 Evaluation",
        border_style=color,
        padding=(1, 2),
    ))

    if answer.ideal_points:
        console.print("[bold cyan]💡 Key Points for an Ideal Answer[/bold cyan]")
        for point in answer.ideal_points:
            console.print(f"  [green]✓[/green] {point}")
        console.print()


def show_summary(session: SessionState) -> None:
    table = Table(
        title=f"📋 Session Summary — {session.name}",
        box=box.ROUNDED,
        border_style="cyan",
        show_lines=True,
    )
    table.add_column("#",         style="dim",    width=4)
    table.add_column("Topic",     style="cyan",   width=28)
    table.add_column("Score",     justify="center", width=8)
    table.add_column("Verdict",   width=10)

    for a in session.answers:
        score = a.score
        color = "green" if score >= 7 else "yellow" if score >= 4 else "red"
        verdict = "✅" if score >= 7 else "⚠️" if score >= 4 else "❌"
        table.add_row(
            str(a.question.number),
            a.question.topic,
            f"[{color}]{score}/10[/{color}]",
            verdict,
        )

    console.print(table)
    console.print(
        f"\n[bold]Total:[/bold] {session.total_score}/{session.max_score}  "
        f"[bold]Grade:[/bold] {session.grade}  "
        f"{session.verdict}\n"
    )


# ── Session persistence ───────────────────────────────────────────────────────

def save_session(session: SessionState) -> Path:
    HISTORY_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = HISTORY_DIR / f"session_{ts}.json"
    path.write_text(json.dumps(session.to_dict(), indent=2))
    return path


def show_history() -> None:
    HISTORY_DIR.mkdir(exist_ok=True)
    files = sorted(HISTORY_DIR.glob("session_*.json"), reverse=True)

    if not files:
        console.print("[dim]No past sessions found.[/dim]")
        return

    table = Table(title="📁 Session History", box=box.ROUNDED, border_style="cyan")
    table.add_column("Date",       width=20)
    table.add_column("Name",       width=14)
    table.add_column("Topic",      width=28)
    table.add_column("Score",      justify="center", width=10)
    table.add_column("Grade",      justify="center", width=6)

    for f in files[:10]:
        try:
            d = json.loads(f.read_text())
            table.add_row(
                d.get("started_at", "")[:19].replace("T", " "),
                d.get("name", ""),
                d.get("topic", ""),
                f"{d.get('total_score', 0)}/{d.get('max_score', 0)}",
                d.get("grade", ""),
            )
        except (json.JSONDecodeError, KeyError):
            continue

    console.print(table)


# ── Interactive prompts ───────────────────────────────────────────────────────

def prompt_topic() -> Topic:
    console.print("\n[bold]Choose a topic:[/bold]")
    for t in Topic:
        console.print(f"  [cyan]{t.number:>2}[/cyan]  {t.label}")
    while True:
        val = Prompt.ask("\nTopic number", default="10")
        try:
            return Topic.from_number(int(val))
        except (ValueError, KeyError):
            console.print("[red]Invalid choice, try again.[/red]")


def prompt_difficulty() -> Difficulty:
    console.print("\n[bold]Choose difficulty:[/bold]")
    for d in Difficulty:
        console.print(f"  [cyan]{d.level}[/cyan]  {d.label}")
    while True:
        val = Prompt.ask("\nDifficulty", default="2")
        try:
            return Difficulty.from_level(int(val))
        except (ValueError, KeyError):
            console.print("[red]Invalid choice, try again.[/red]")


# ── Main interview loop ───────────────────────────────────────────────────────

def run_interview(
    client: OpenAI,
    name: str,
    topic: Topic,
    difficulty: Difficulty,
    num_questions: int,
) -> SessionState:

    session = SessionState(
        name=name,
        topic=topic,
        difficulty=difficulty,
        total_questions=num_questions,
    )

    for i in range(1, num_questions + 1):
        console.print(f"\n[dim]Generating question {i}…[/dim]")
        question = generate_question(client, topic, difficulty, i)
        show_question(question, num_questions)

        user_answer = Prompt.ask("[bold green]Your answer[/bold green]")
        if not user_answer.strip():
            user_answer = "(no answer provided)"

        console.print("[dim]Evaluating…[/dim]")
        answer = evaluate_answer(client, question, user_answer)
        show_evaluation(answer)
        session.answers.append(answer)

    return session


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="DevOps Interview Coach — AI-powered mock interviews",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Topics:  1=Docker 2=Kubernetes 3=CI/CD 4=AWS 5=Terraform\n"
            "         6=Linux 7=Monitoring 8=Networking 9=SRE 10=Mixed\n"
            "Difficulty: 1=Junior  2=Mid-level  3=Senior"
        ),
    )
    parser.add_argument("--name",       type=str, help="Your name")
    parser.add_argument("--topic",      type=int, choices=range(1, 11), metavar="1-10")
    parser.add_argument("--difficulty", type=int, choices=[1, 2, 3],    metavar="1-3")
    parser.add_argument("--questions",  type=int, default=5,            metavar="N")
    parser.add_argument("--history",    action="store_true",            help="Show past sessions")
    args = parser.parse_args()

    show_banner()

    if args.history:
        show_history()
        return

    client = get_client()

    # Gather inputs interactively if not passed as flags
    name       = args.name       or Prompt.ask("\n[bold]Your name[/bold]")
    topic      = Topic.from_number(args.topic) if args.topic else prompt_topic()
    difficulty = Difficulty.from_level(args.difficulty) if args.difficulty else prompt_difficulty()
    n          = args.questions

    console.print(
        f"\n[bold]Starting:[/bold] {n} questions  ·  {topic.label}  ·  {difficulty.label}\n"
    )

    try:
        session = run_interview(client, name, topic, difficulty, n)
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Interview interrupted.[/yellow]")
        return

    show_summary(session)
    stream_study_plan(client, session)

    path = save_session(session)
    console.print(f"[dim]Session saved → {path}[/dim]\n")


if __name__ == "__main__":
    main()
