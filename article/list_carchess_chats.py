#!/usr/bin/env python3
"""List, filter, and inspect all Antigravity chat sessions related to CarChess3D.

Usage:
    python3 article/list_carchess_chats.py [--brain-dir <dir>] [--host-label <name>]
                                           [--export-md <path>] [--export-json <path>]
"""

import argparse
import glob
import json
import os
import re
from datetime import datetime

KEYWORDS = [
    "carchess",
    "carlesso al cesso",
    "scacchi di famiglia",
    "trellis",
    "bishop-ale",
    "knight-seby",
    "pupurabbu",
    "king-riccardo",
    "queen-kate",
    "pawn-puffin",
    "hunyuan",
    "zurichswamp",
    "veocinema",
    "plastilina",
]

EXCLUDE_PROMPTS = [
    "check that this hermes",
    "karpathy daily update",
    "raspberry pie",
    "inguini tattici",
    "smurfs and dragons",
    "ermete/pupurabbux",
    "trovato un erorre con terraform",
    "come e quanto sto usando tutte le mie gmeini api keys",
    "humnGOUS lab".lower(),
    "lavorare a questa presentazione",
    "agente di viaggio",
    "skil lyria+ karaoke",
]

MIN_START_ISO = "2026-10-09T15:00:00"


def redact(text: str) -> str:
    text = re.sub(r"sk-or-[A-Za-z0-9_-]+", "sk-or-REDACTED_KEY", text)
    text = re.sub(r"sk-[A-Za-z0-9_-]{20,}", "sk-REDACTED_KEY", text)
    text = re.sub(r"hf_[A-Za-z0-9]{20,}", "hf_REDACTED_TOKEN", text)
    text = re.sub(r"AIza[0-9A-Za-z_-]{30,}", "AIza_REDACTED_KEY", text)
    text = re.sub(r"gh[op]_[A-Za-z0-9]{20,}", "ghp_REDACTED_TOKEN", text)
    corp_prefix = "/usr/local/" + "google/home/"
    text = re.sub(re.escape(corp_prefix) + r"[a-z_][a-z0-9_-]*/", "~/", text)
    text = text.replace("/usr/local/" + "google", "<corp-path>")
    home_prefix = "/home/"
    text = re.sub(re.escape(home_prefix) + r"[a-z_][a-z0-9_-]*/", "~/", text)
    text = re.sub(r"\.gemini/" + r"jetski", ".gemini/antigravity", text)
    return text


def scan_sessions(brain_dir=os.path.expanduser("~/.gemini/antigravity/brain")):
    pattern = os.path.join(brain_dir, "*", ".system_generated", "logs", "transcript.jsonl")
    files = glob.glob(pattern)

    sessions = []

    for f in files:
        conv_id = f.split(os.sep)[-4]
        step_count = 0
        first_time = None
        last_time = None
        has_carchess = False
        user_prompts = []

        try:
            with open(f, "r", encoding="utf-8", errors="ignore") as fp:
                for line in fp:
                    step_count += 1
                    try:
                        data = json.loads(line)
                    except Exception:
                        continue

                    ts = data.get("created_at")
                    if ts:
                        if not first_time:
                            first_time = ts
                        last_time = ts

                    content = str(data.get("content", ""))
                    thinking = str(data.get("thinking", ""))
                    full_text = (content + " " + thinking).lower()

                    if any(kw in full_text for kw in KEYWORDS):
                        has_carchess = True

                    if data.get("type") == "USER_INPUT":
                        clean_prompt = redact(content.strip())
                        if clean_prompt:
                            user_prompts.append(
                                {
                                    "step": step_count,
                                    "timestamp": ts,
                                    "text": clean_prompt,
                                }
                            )
        except Exception:
            continue

        if not first_time or first_time < MIN_START_ISO:
            continue

        first_p_lower = (user_prompts[0]["text"] if user_prompts else "").lower()
        if any(ex in first_p_lower for ex in EXCLUDE_PROMPTS):
            continue

        if has_carchess:
            sessions.append(
                {
                    "conversation_id": conv_id,
                    "first_time": first_time,
                    "last_time": last_time,
                    "steps": step_count,
                    "user_messages_count": len(user_prompts),
                    "first_prompt": user_prompts[0]["text"] if user_prompts else "",
                    "user_prompts": user_prompts,
                    "log_path": redact(f),
                }
            )

    sessions.sort(key=lambda s: s["first_time"] or "")
    return sessions


def generate_markdown(sessions, host_label="pupurabbux"):
    md = []
    md.append(f"# 📜 CarChess3D — Catalogo Completo delle Sessioni Antigravity su `{host_label}`\n")
    total_steps = sum(s.get("steps", 0) for s in sessions)
    total_prompts = sum(s.get("user_messages_count", 0) for s in sessions)
    md.append(
        f"*Estratto il {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} — "
        f"**{len(sessions)} sessioni** CarChess3D (`{total_steps}` step totali, `{total_prompts}` prompt utente).*\n"
    )
    md.append("---\n")
    md.append("## 📊 Tabella Cronologica delle Sessioni\n")
    md.append("| # | Inizio (UTC) | Session ID | Step | Prompt Utente | Primo Prompt / Argomento |")
    md.append("|---|:---|:---|:---:|:---:|:---|")

    for idx, s in enumerate(sessions, 1):
        ts = s["first_time"][:19].replace("T", " ") if s["first_time"] else "N/A"
        cid = s["conversation_id"]
        steps = s["steps"]
        up_count = s["user_messages_count"]
        first_p = (
            redact(s["first_prompt"])
            .replace("\n", " ")[:90]
            .replace("|", "\\|")
        )
        md.append(
            f"| {idx} | `{ts}` | [`{cid[:8]}...`](conversation://{cid}) | {steps} | {up_count} | {first_p}... |"
        )

    md.append("\n---\n")
    md.append("## 🔍 Dettaglio delle Sessioni Principali\n")

    for idx, s in enumerate(sessions, 1):
        ts_start = s["first_time"][:19].replace("T", " ") if s["first_time"] else "N/A"
        ts_end = s["last_time"][:19].replace("T", " ") if s["last_time"] else "N/A"
        cid = s["conversation_id"]

        md.append(f"### {idx}. Sessione `{cid}`\n")
        md.append(f"- **Data/Ora**: `{ts_start}` → `{ts_end}`")
        md.append(f"- **Volume**: {s['steps']} step di log, {s['user_messages_count']} messaggi utente")
        md.append(f"- **Log path**: `{redact(s.get('log_path', ''))}`\n")

        if s.get("user_prompts"):
            md.append("**Estratto messaggi utente:**\n")
            for p in s["user_prompts"][:5]:
                p_text = redact(p["text"]).replace("\n", " \n> ")
                ts_p = p["timestamp"][:19] if p.get("timestamp") else ""
                md.append(f"> 💬 *[Step {p['step']} @ {ts_p}]*\n> {p_text}\n")
            if len(s["user_prompts"]) > 5:
                md.append(f"*(...altri {len(s['user_prompts']) - 5} messaggi utente nel transcript)*\n")
        md.append("---\n")

    return redact("\n".join(md))


def main():
    parser = argparse.ArgumentParser(description="List CarChess3D Antigravity Sessions")
    parser.add_argument(
        "--brain-dir",
        type=str,
        default=os.path.expanduser("~/.gemini/antigravity/brain"),
        help="Brain directory to scan",
    )
    parser.add_argument(
        "--host-label",
        type=str,
        default="pupurabbux",
        help="Host label for markdown report",
    )
    parser.add_argument(
        "--from-existing-json",
        type=str,
        default="",
        help="Filter an existing JSON index instead of scanning local brain_dir",
    )
    parser.add_argument(
        "--export-md",
        type=str,
        default="article/sources/chats_list.md",
        help="Export markdown file path",
    )
    parser.add_argument(
        "--export-json",
        type=str,
        default="article/sources/telemetry/chats_index.json",
        help="Export json file path",
    )
    args = parser.parse_args()

    if args.from_existing_json:
        with open(args.from_existing_json, "r", encoding="utf-8") as f:
            raw_sessions = json.load(f)
        sessions = []
        for s in raw_sessions:
            ft = s.get("first_time") or ""
            if ft < MIN_START_ISO:
                continue
            fp_lower = (s.get("first_prompt") or "").lower()
            if any(ex in fp_lower for ex in EXCLUDE_PROMPTS):
                continue
            s["first_prompt"] = redact(s.get("first_prompt", ""))
            s["log_path"] = redact(s.get("log_path", ""))
            for p in s.get("user_prompts", []):
                p["text"] = redact(p.get("text", ""))
            sessions.append(s)
        sessions.sort(key=lambda s: s.get("first_time") or "")
    else:
        sessions = scan_sessions(args.brain_dir)

    print(f"[{args.host_label}] Found {len(sessions)} CarChess3D sessions.")

    md_content = generate_markdown(sessions, host_label=args.host_label)

    if args.export_md:
        os.makedirs(os.path.dirname(args.export_md), exist_ok=True)
        with open(args.export_md, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"Saved Markdown report to: {args.export_md}")

    if args.export_json:
        os.makedirs(os.path.dirname(args.export_json), exist_ok=True)
        with open(args.export_json, "w", encoding="utf-8") as f:
            json.dump(sessions, f, indent=2, ensure_ascii=False)
        print(f"Saved JSON index to: {args.export_json}")


if __name__ == "__main__":
    main()
