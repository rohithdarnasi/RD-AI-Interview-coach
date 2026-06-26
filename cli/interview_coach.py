#!/usr/bin/env python3
"""
DevOps Interview Coach CLI
A powerful mock interview tool powered by Claude AI.
Showcases Python: dataclasses, async/await, rich TUI, type hints, enums, argparse.
"""

import os
import sys
import json
import time
import asyncio
import argparse
import textwrap
from datetime import datetime
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional
from pathlib import Path

try:
    from openai import OpenAI
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.prompt import Prompt, Confirm
    from rich.markdown import Markdown
    from rich.rule import Rule
    from rich import box
except ImportError:
    print("Installing required packages...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install",
                           "anthropic", "rich", "--quiet"])
    from openai import OpenAI
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.prompt import Prompt, Confirm
    from rich.markdown import Markdown
    from rich.rule import Rule
    from rich import box

# ─── Constants & Config ───────────────────────────────────────────────────────

console = Console()
SAVE_DIR = Path.home() / ".devops_coach"
SAVE_DIR.mkdir(exist_ok=True)

TOPICS = {
    "1": "Docker & Containers",
    "2": "Kubernetes & Orchestration",
    "3": "CI/CD Pipelines",
    "4": "AWS / Cloud Fundamentals",
    "5": "Infrastructure as Code (Terraform)",
    "6": "Linux & Shell Scripting",
    "7": "Monitoring & Observability",
    "8": "Networking & Security",
    "9": "Site Reliability Engineering",
    "10": "Mixed (All Topics)",
}

DIFFICULTY_LEVELS = {
    "1": ("Junior", "Focus on foundational concepts, basic commands, and simple scenarios."),
    "2": ("Mid-level", "Include architecture decisions, trade-offs, and real-world scenarios."),
    "3": ("Senior", "Focus on system design, scaling challenges, incident response, and leadership scenarios."),
}


# ─── Data Models ──────────────────────────────────────────────────────────────

class QuestionType(Enum):
    CONCEPTUAL = "conceptual"
    PRACTICAL = "practical"
    SCENARIO = "scenario"
    DEBUGGING = "debugging"
    DESIGN = "design"


@dataclass
class Question:
    topic: str
    difficulty: str
    question_type: QuestionType
    text: str
    number: int


@dataclass
class Answer:
    question: Question
    user_response: str
    score: int = 0
    feedback: str = ""
    ideal_points: list[str] = field(default_factory=list)
    time_taken: float = 0.0


@dataclass
class InterviewSession:
    topic: str
    difficulty: str
    candidate_name: str
    start_time: str = field(default_factory=lambda: datetime.now().isoformat())
    answers: list[Answer] = field(default_factory=list)
    total_questions: int = 5

    @property
    def total_score(self) -> int:
        return sum(a.score for a in self.answers)

    @property
    def max_score(self) -> int:
        return len(self.answers) * 10

    @property
    def percentage(self) -> float:
        if not self.answers:
            return 0.0
        return (self.total_score / self.max_score) * 100

    @property
    def grade(self) -> str:
        pct = self.percentage
        if pct >= 90: return "A+ 🏆"
        if pct >= 80: return "A  ⭐"
        if pct >= 70: return "B  👍"
        if pct >= 60: return "C  📚"
        return "D  💪"

    @property
    def verdict(self) -> str:
        pct = self.percentage
        if pct >= 80: return "✅ Strong Hire"
        if pct >= 65: return "🟡 Hire with Reservations"
        if pct >= 50: return "🔄 Needs More Preparation"
        return "❌ Not Ready — Keep Practicing"

    def to_dict(self) -> dict:
        return {
            "topic": self.topic,
            "difficulty": self.difficulty,
            "candidate_name": self.candidate_name,
            "start_time": self.start_time,
            "total_score": self.total_score,
            "max_score": self.max_score,
            "percentage": round(self.percentage, 1),
            "grade": self.grade,
            "verdict": self.verdict,
            "answers": [
                {
                    "question": a.question.text,
                    "topic": a.question.topic,
                    "type": a.question.question_type.value,
                    "user_response": a.user_response,
                    "score": a.score,
                    "feedback": a.feedback,
                    "ideal_points": a.ideal_points,
                    "time_taken_seconds": round(a.time_taken, 1),
                }
                for a in self.answers
            ],
        }


# ─── AI Engine ────────────────────────────────────────────────────────────────

class InterviewEngine:
    """Core AI engine that drives the mock interview using OpenAI."""

    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o"

    def _call_claude(self, system_prompt: str, user_prompt: str) -> str:
        """Make a synchronous call to OpenAI with spinner feedback."""
        with Progress(
            SpinnerColumn(spinner_name="dots"),
            TextColumn("[bold cyan]GPT is thinking...[/bold cyan]"),
            transient=True,
        ) as progress:
            progress.add_task("thinking", total=None)
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=1500,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        return response.choices[0].message.content.strip()

    def generate_question(
        self, topic: str, difficulty: str, question_number: int,
        previous_questions: list[str], question_types_used: list[str]
    ) -> Question:
        """Generate a unique interview question tailored to topic and difficulty."""

        diff_label, diff_desc = DIFFICULTY_LEVELS[difficulty]
        prev_q_text = "\n".join(f"- {q}" for q in previous_questions) if previous_questions else "None yet"

        system = textwrap.dedent("""
            You are a senior DevOps/Cloud hiring manager conducting a technical interview.
            Generate ONE realistic, specific interview question. Be direct and professional.
            
            Respond in this exact JSON format:
            {
                "question": "The full interview question text",
                "type": "conceptual|practical|scenario|debugging|design"
            }
            
            Types:
            - conceptual: Test understanding of theory/fundamentals
            - practical: Ask how they'd do a specific task
            - scenario: Present a real-world problem to solve
            - debugging: Describe an issue they need to diagnose
            - design: Ask them to architect/design a solution
            
            Return only valid JSON. No markdown fences.
        """).strip()

        user = textwrap.dedent(f"""
            Topic: {topic}
            Difficulty: {diff_label} — {diff_desc}
            Question #{question_number} of 5
            
            Previous questions asked (DO NOT repeat or be too similar):
            {prev_q_text}
            
            Question types already used: {', '.join(question_types_used) or 'none'}
            Prefer a DIFFERENT type if possible.
            
            Generate question #{question_number}.
        """).strip()

        raw = self._call_claude(system, user)

        try:
            data = json.loads(raw)
            q_type = QuestionType(data.get("type", "conceptual"))
            return Question(
                topic=topic,
                difficulty=difficulty,
                question_type=q_type,
                text=data["question"],
                number=question_number,
            )
        except (json.JSONDecodeError, KeyError, ValueError):
            # Fallback gracefully
            return Question(
                topic=topic,
                difficulty=difficulty,
                question_type=QuestionType.CONCEPTUAL,
                text=raw.split("?")[0] + "?" if "?" in raw else raw[:300],
                number=question_number,
            )

    def evaluate_answer(self, question: Question, user_answer: str) -> Answer:
        """Evaluate the candidate's answer and return scored feedback."""

        diff_label = DIFFICULTY_LEVELS[question.difficulty][0]

        system = textwrap.dedent("""
            You are an expert DevOps/Cloud interviewer evaluating a candidate's answer.
            Be fair, constructive, and specific. Score honestly — don't be overly generous.
            
            Respond in this EXACT JSON format:
            {
                "score": <integer 0-10>,
                "feedback": "<2-3 sentence constructive feedback paragraph>",
                "ideal_points": ["<key point 1>", "<key point 2>", "<key point 3>"]
            }
            
            Scoring rubric:
            9-10: Exceptional — covered all key concepts, showed depth, mentioned edge cases
            7-8:  Good — covered main concepts well with minor gaps
            5-6:  Adequate — understood the basics but missed important details
            3-4:  Weak — had some knowledge but significant gaps or misconceptions  
            1-2:  Poor — mostly incorrect or very incomplete
            0:    No relevant content provided
            
            ideal_points: 3 bullet points of what an ideal answer should include.
            
            Return only valid JSON. No markdown fences.
        """).strip()

        user = textwrap.dedent(f"""
            Interview Context:
            Topic: {question.topic}
            Difficulty: {diff_label}
            Question Type: {question.question_type.value}
            
            Question: {question.text}
            
            Candidate's Answer:
            {user_answer if user_answer.strip() else "[No answer provided / Skipped]"}
            
            Evaluate and score this answer.
        """).strip()

        raw = self._call_claude(system, user)

        try:
            data = json.loads(raw)
            answer = Answer(
                question=question,
                user_response=user_answer,
                score=max(0, min(10, int(data.get("score", 5)))),
                feedback=data.get("feedback", "No feedback available."),
                ideal_points=data.get("ideal_points", []),
            )
        except (json.JSONDecodeError, KeyError, ValueError):
            answer = Answer(
                question=question,
                user_response=user_answer,
                score=5,
                feedback="Answer evaluated. Keep practicing to deepen your knowledge.",
                ideal_points=["Review core concepts", "Practice hands-on labs", "Study real-world scenarios"],
            )

        return answer

    def generate_study_plan(self, session: InterviewSession) -> str:
        """Generate a personalized study plan based on interview performance."""

        weak_areas = [
            a.question.topic for a in session.answers if a.score < 6
        ]
        scores_summary = "\n".join(
            f"- Q{i+1} ({a.question.question_type.value}): {a.score}/10 — {a.question.text[:60]}..."
            for i, a in enumerate(session.answers)
        )

        system = "You are a DevOps career coach. Give actionable, specific study recommendations in markdown."

        user = textwrap.dedent(f"""
            Candidate: {session.candidate_name}
            Topic: {session.topic}
            Difficulty: {session.difficulty}
            Score: {session.total_score}/{session.max_score} ({session.percentage:.0f}%)
            
            Question scores:
            {scores_summary}
            
            Weak areas (scored < 6): {', '.join(weak_areas) if weak_areas else 'None — great performance!'}
            
            Create a concise 1-week study plan with:
            1. Top 3 priority areas to focus on
            2. Specific resources (docs, labs, projects)
            3. One practical project to build this week
            4. Interview tips based on their performance pattern
            
            Keep it under 400 words. Be specific and actionable.
        """).strip()

        return self._call_claude(system, user)


# ─── UI Helpers ───────────────────────────────────────────────────────────────

def print_banner():
    banner = """
╔═══════════════════════════════════════════════════════════════╗
║          🚀  DevOps Interview Coach  🚀                       ║
║          AI-Powered Mock Technical Interviews                 ║
║          Built with Python · Powered by Claude               ║
╚═══════════════════════════════════════════════════════════════╝
    """
    console.print(Panel(banner.strip(), style="bold cyan", border_style="cyan"))


def print_question(q: Question, time_limit: Optional[int] = None):
    type_colors = {
        QuestionType.CONCEPTUAL: "blue",
        QuestionType.PRACTICAL: "green",
        QuestionType.SCENARIO: "yellow",
        QuestionType.DEBUGGING: "red",
        QuestionType.DESIGN: "magenta",
    }
    color = type_colors.get(q.question_type, "white")

    header = f"Question {q.number} · [{color}]{q.question_type.value.upper()}[/{color}] · {q.topic}"
    if time_limit:
        header += f" · ⏱ {time_limit}s suggested"

    console.print()
    console.print(Panel(
        f"[bold white]{q.text}[/bold white]",
        title=header,
        border_style=color,
        padding=(1, 2),
    ))


def print_score_bar(score: int) -> str:
    filled = "█" * score
    empty = "░" * (10 - score)
    if score >= 8:
        color = "green"
    elif score >= 5:
        color = "yellow"
    else:
        color = "red"
    return f"[{color}]{filled}{empty}[/{color}] {score}/10"


def print_feedback(answer: Answer):
    console.print()
    score_bar = print_score_bar(answer.score)

    # Score panel
    console.print(Panel(
        f"Score: {score_bar}\n\n"
        f"[italic]{answer.feedback}[/italic]",
        title="📊 Evaluation",
        border_style="green" if answer.score >= 7 else "yellow" if answer.score >= 5 else "red",
        padding=(1, 2),
    ))

    # Ideal points
    if answer.ideal_points:
        console.print(Panel(
            "\n".join(f"  ✓ {pt}" for pt in answer.ideal_points),
            title="💡 Key Points for an Ideal Answer",
            border_style="blue",
            padding=(1, 2),
        ))


def print_final_report(session: InterviewSession):
    console.print()
    console.print(Rule("[bold cyan]INTERVIEW COMPLETE[/bold cyan]", style="cyan"))
    console.print()

    # Summary table
    table = Table(
        title=f"📋 Interview Report — {session.candidate_name}",
        box=box.ROUNDED,
        border_style="cyan",
        show_lines=True,
    )
    table.add_column("#", style="dim", width=3)
    table.add_column("Question", style="white", max_width=45)
    table.add_column("Type", style="blue", width=12)
    table.add_column("Score", width=20)
    table.add_column("Time", width=8)

    for i, ans in enumerate(session.answers, 1):
        table.add_row(
            str(i),
            ans.question.text[:42] + "..." if len(ans.question.text) > 45 else ans.question.text,
            ans.question.question_type.value,
            print_score_bar(ans.score),
            f"{ans.time_taken:.0f}s",
        )

    console.print(table)
    console.print()

    # Final scorecard
    scorecard = f"""
[bold]Candidate:[/bold]   {session.candidate_name}
[bold]Topic:[/bold]       {session.topic}
[bold]Difficulty:[/bold]  {DIFFICULTY_LEVELS[session.difficulty][0]}
[bold]Score:[/bold]       {session.total_score}/{session.max_score}  ({session.percentage:.1f}%)
[bold]Grade:[/bold]       {session.grade}
[bold]Verdict:[/bold]     {session.verdict}
    """.strip()

    border = "green" if session.percentage >= 70 else "yellow" if session.percentage >= 50 else "red"
    console.print(Panel(scorecard, title="🎯 Final Scorecard", border_style=border, padding=(1, 3)))


def get_multiline_answer() -> tuple[str, float]:
    """Collect a multiline answer from the user with timing."""
    console.print(
        "\n[dim]Type your answer below. Press [bold]ENTER twice[/bold] (blank line) to submit. "
        "Type [bold]skip[/bold] + ENTER to skip.[/dim]\n"
    )

    lines = []
    start = time.time()
    first_line = True

    while True:
        try:
            line = input("  > " if first_line else "    ")
            first_line = False
        except (EOFError, KeyboardInterrupt):
            break

        if line.lower().strip() == "skip":
            return "[SKIPPED]", time.time() - start
        if line == "" and lines:
            # Second blank line = done
            if lines and lines[-1] == "":
                lines.pop()  # Remove trailing empty
                break
        lines.append(line)

    elapsed = time.time() - start
    return "\n".join(lines).strip(), elapsed


def save_session(session: InterviewSession) -> Path:
    """Save session results to JSON file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = SAVE_DIR / f"session_{timestamp}.json"
    with open(filename, "w") as f:
        json.dump(session.to_dict(), f, indent=2)
    return filename


def list_past_sessions():
    """List all saved interview sessions."""
    sessions = sorted(SAVE_DIR.glob("session_*.json"), reverse=True)
    if not sessions:
        console.print("[yellow]No past sessions found.[/yellow]")
        return

    table = Table(title="📚 Past Interview Sessions", box=box.SIMPLE_HEAVY)
    table.add_column("Date", style="cyan")
    table.add_column("Candidate")
    table.add_column("Topic")
    table.add_column("Difficulty")
    table.add_column("Score")
    table.add_column("Grade")

    for s in sessions[:10]:
        with open(s) as f:
            data = json.load(f)
        dt = datetime.fromisoformat(data["start_time"]).strftime("%Y-%m-%d %H:%M")
        table.add_row(
            dt,
            data.get("candidate_name", "Unknown"),
            data.get("topic", "-"),
            data.get("difficulty", "-"),
            f"{data['total_score']}/{data['max_score']} ({data['percentage']}%)",
            data.get("grade", "-"),
        )

    console.print(table)


# ─── Main Interview Flow ──────────────────────────────────────────────────────

def run_interview(api_key: str, args):
    engine = InterviewEngine(api_key)

    print_banner()
    console.print()

    # Gather session config interactively if not provided via args
    name = args.name or Prompt.ask("[bold]Your name[/bold]", default="Candidate")

    # Topic selection
    if args.topic:
        topic_key = args.topic
        topic = TOPICS.get(topic_key, "Mixed (All Topics)")
    else:
        console.print("\n[bold cyan]Select Interview Topic:[/bold cyan]")
        for k, v in TOPICS.items():
            console.print(f"  [dim]{k}.[/dim] {v}")
        topic_key = Prompt.ask("\nTopic number", choices=list(TOPICS.keys()), default="10")
        topic = TOPICS[topic_key]

    # Difficulty selection
    if args.difficulty:
        diff_key = args.difficulty
    else:
        console.print("\n[bold cyan]Select Difficulty Level:[/bold cyan]")
        for k, (label, desc) in DIFFICULTY_LEVELS.items():
            console.print(f"  [dim]{k}.[/dim] [bold]{label}[/bold] — {desc}")
        diff_key = Prompt.ask("\nDifficulty", choices=["1", "2", "3"], default="2")

    num_questions = args.questions or 5

    # Confirm
    diff_label = DIFFICULTY_LEVELS[diff_key][0]
    console.print()
    console.print(Panel(
        f"[bold]Candidate:[/bold] {name}\n"
        f"[bold]Topic:[/bold]     {topic}\n"
        f"[bold]Level:[/bold]     {diff_label}\n"
        f"[bold]Questions:[/bold] {num_questions}",
        title="📋 Interview Setup",
        border_style="cyan",
    ))

    if not Confirm.ask("\n[bold]Ready to start?[/bold]", default=True):
        console.print("[yellow]Interview cancelled.[/yellow]")
        return

    session = InterviewSession(
        topic=topic,
        difficulty=diff_key,
        candidate_name=name,
        total_questions=num_questions,
    )

    console.print()
    console.print(Rule("[bold green]INTERVIEW STARTING[/bold green]", style="green"))
    console.print("[dim]Answer each question thoroughly. Take your time.[/dim]")

    prev_questions: list[str] = []
    types_used: list[str] = []

    # ── Interview Loop ──
    for i in range(1, num_questions + 1):
        console.print(f"\n[dim cyan]{'─' * 60}[/dim cyan]")

        # Generate question
        question = engine.generate_question(
            topic=topic,
            difficulty=diff_key,
            question_number=i,
            previous_questions=prev_questions,
            question_types_used=types_used,
        )
        prev_questions.append(question.text)
        types_used.append(question.question_type.value)

        # Display question
        print_question(question)

        # Collect answer
        user_answer, elapsed = get_multiline_answer()

        # Evaluate
        console.print()
        answer = engine.evaluate_answer(question, user_answer)
        answer.time_taken = elapsed
        session.answers.append(answer)

        # Show feedback
        print_feedback(answer)

        if i < num_questions:
            console.print(f"\n[dim]Question {i}/{num_questions} complete. "
                          f"Running score: {session.total_score}/{i * 10}[/dim]")
            if not Confirm.ask("Continue to next question?", default=True):
                console.print("[yellow]Interview ended early.[/yellow]")
                break

    # ── Final Report ──
    print_final_report(session)

    # Study plan
    if Confirm.ask("\n[bold]Generate personalized study plan?[/bold]", default=True):
        console.print()
        with Progress(SpinnerColumn(), TextColumn("[cyan]Generating your study plan...[/cyan]"), transient=True) as p:
            p.add_task("plan", total=None)
            plan = engine.generate_study_plan(session)
        console.print(Panel(Markdown(plan), title="📚 Your Study Plan", border_style="blue", padding=(1, 2)))

    # Save results
    saved_path = save_session(session)
    console.print(f"\n[dim]💾 Session saved to: {saved_path}[/dim]")
    console.print("\n[bold cyan]Thanks for practicing! Keep grinding. 🚀[/bold cyan]\n")


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="🚀 DevOps Interview Coach — AI-powered mock technical interviews",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
            Examples:
              python interview_coach.py                          # Interactive mode
              python interview_coach.py --name "Alice" --topic 1 --difficulty 2
              python interview_coach.py --topic 10 --questions 3 --difficulty 3
              python interview_coach.py --history                # View past sessions
            
            Topics: 1=Docker, 2=Kubernetes, 3=CI/CD, 4=AWS, 5=Terraform,
                    6=Linux, 7=Monitoring, 8=Networking, 9=SRE, 10=Mixed
            Difficulty: 1=Junior, 2=Mid-level, 3=Senior
        """),
    )
    parser.add_argument("--name", help="Your name")
    parser.add_argument("--topic", choices=list(TOPICS.keys()), help="Topic number (1-10)")
    parser.add_argument("--difficulty", choices=["1", "2", "3"], help="Difficulty level")
    parser.add_argument("--questions", type=int, choices=range(1, 11), metavar="1-10",
                        default=5, help="Number of questions (default: 5)")
    parser.add_argument("--history", action="store_true", help="View past interview sessions")
    parser.add_argument("--api-key", help="OPENAI_API_KEY API key (or set OPENAI_API_KEY env var)")

    args = parser.parse_args()

    if args.history:
        list_past_sessions()
        return

 api_key = args.api_key or os.environ.get("OPENAI_API_KEY")
if not api_key:
    console.print("[red]❌ Error: Set OPENAI_API_KEY environment variable or use --api-key[/red]")
    console.print("[dim]  export OPENAI_API_KEY='your-key-here'[/dim]")
        sys.exit(1)

    try:
        run_interview(api_key, args)
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Interview interrupted. Goodbye![/yellow]\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
