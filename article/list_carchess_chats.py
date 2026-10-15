
def redact(text):
    import re
    text = re.sub(r"sk-or-[A-Za-z0-9_-]+", "sk-or-REDACTED_KEY", text)
    text = re.sub(r"sk-[A-Za-z0-9_-]{20,}", "sk-REDACTED_KEY", text)
    text = re.sub(r"hf_[A-Za-z0-9]{20,}", "hf_REDACTED_TOKEN", text)
    text = re.sub(r"AIza[0-9A-Za-z_-]{30,}", "AIza_REDACTED_KEY", text)
    text = re.sub(r"gh[op]_[A-Za-z0-9]{20,}", "ghp_REDACTED_TOKEN", text)
    text = text.replace(""/usr/local/" + "google"", "/usr/local/corp")
    text = re.sub(r"\"/home/\" + r\"[a-z_][a-z0-9_-]*/\"", "~/", text)
    return text
#!/usr/bin/env python3
"""List, filter, and inspect all Antigravity chat sessions on pupurabbux related to CarChess3D.

Usage:
    python3 article/list_carchess_chats.py [--markdown] [--json] [--export-md <path>] [--export-json <path>]
"""

import argparse
import glob
import json
import os
import sys
from datetime import datetime
from pathlib import Path

KEYWORDS = [
    "carchess", "carlesso", "colmar", "swamp", "trellis",
    "bishop-ale", "knight-seby", "pupurabbu", "king-riccardo",
    "queen-kate", "pawn-puffin", "scacchi", "hunyuan", "3dgames"
]

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
        models_seen = set()
        total_chars = 0

        try:
            with open(f, "r", encoding="utf-8", errors="ignore") as fp:
                for line in fp:
                    step_count += 1
                    total_chars += len(line)
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
                    full_text = content + " " + thinking
                    
                    if any(kw in full_text.lower() for kw in KEYWORDS):
                        has_carchess = True
                    
                    if data.get("type") == "USER_INPUT":
                        clean_prompt = content.strip()
                        if clean_prompt:
                            user_prompts.append({
                                "step": step_count,
                                "timestamp": ts,
                                "text": clean_prompt
                            })

        except Exception as e:
            continue

        if has_carchess or any(any(kw in p["text"].lower() for kw in KEYWORDS) for p in user_prompts):
            sessions.append({
                "conversation_id": conv_id,
                "first_time": first_time,
                "last_time": last_time,
                "steps": step_count,
                "user_messages_count": len(user_prompts),
                "first_prompt": user_prompts[0]["text"] if user_prompts else "",
                "user_prompts": user_prompts,
                "log_path": f
            })

    sessions.sort(key=lambda s: s["first_time"] or "")
    return sessions

def generate_markdown(sessions):
    md = []
    md.append("# 📜 CarChess3D — Catalogo Completo delle Chat e Sessioni su pupurabbux\n")
    md.append(f"*Estratto il {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} — Trovate **{len(sessions)} sessioni** dedicate o collegate a CarChess3D.*\n")
    md.append("---\n")
    md.append("## 📊 Tabella Cronologica delle Sessioni\n")
    md.append("| # | Inizio (UTC) | Session ID | Step | Prompt Utente | Primo Prompt / Argomento |")
    md.append("|---|:---|:---|:---:|:---:|:---|")
    
    for idx, s in enumerate(sessions, 1):
        ts = s["first_time"][:19].replace("T", " ") if s["first_time"] else "N/A"
        cid = s["conversation_id"]
        steps = s["steps"]
        up_count = s["user_messages_count"]
        first_p = s["first_prompt"].replace("\n", " ")[:90].replace("|", "\\|")
        md.append(f"| {idx} | `{ts}` | [`{cid[:8]}...`](conversation://{cid}) | {steps} | {up_count} | {first_p}... |")

    md.append("\n---\n")
    md.append("## 🔍 Dettaglio delle Sessioni Principali\n")
    
    for idx, s in enumerate(sessions, 1):
        ts_start = s["first_time"][:19].replace("T", " ") if s["first_time"] else "N/A"
        ts_end = s["last_time"][:19].replace("T", " ") if s["last_time"] else "N/A"
        cid = s["conversation_id"]
        
        md.append(f"### {idx}. Sessione `{cid}`\n")
        md.append(f"- **Data/Ora**: `{ts_start}` → `{ts_end}`")
        md.append(f"- **Volume**: {s['steps']} step di log, {s['user_messages_count']} messaggi utente")
        md.append(f"- **Log path**: `{s['log_path']}`\n")
        
        if s["user_prompts"]:
            md.append("**Estratto messaggi utente:**\n")
            for p in s["user_prompts"][:5]:
                p_text = p['text'].replace("\n", " \n> ")
                md.append(f"> 💬 *[Step {p['step']} @ {p['timestamp'][:19] if p['timestamp'] else ''}]*\n> {p_text}\n")
            if len(s["user_prompts"]) > 5:
                md.append(f"*(...altri {len(s['user_prompts']) - 5} messaggi utente nel transcript)*\n")
        md.append("---\n")
        
    return "\n".join(md)

def main():
    parser = argparse.ArgumentParser(description="List CarChess3D Antigravity Sessions")
    parser.add_argument("--markdown", action="store_true", help="Print or export markdown")
    parser.add_argument("--json", action="store_true", help="Print or export json")
    parser.add_argument("--export-md", type=str, default="article/sources/chats_list.md", help="Export markdown file path")
    parser.add_argument("--export-json", type=str, default="article/sources/telemetry/chats_index.json", help="Export json file path")
    args = parser.parse_args()

    sessions = scan_sessions()
    print(f"Scanned brain logs. Found {len(sessions)} CarChess3D sessions.")

    # Export markdown
    md_content = generate_markdown(sessions)
    # Sanitize home path in outputs
    home_dir = os.path.expanduser("~")
    md_content = redact(md_content)

    if args.export_md:
        os.makedirs(os.path.dirname(args.export_md), exist_ok=True)
        with open(args.export_md, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"Saved Markdown report to: {args.export_md}")

    # Export JSON
    
    # Sanitize home path in sessions
    home_dir = os.path.expanduser("~")
    for s in sessions:
        if "log_path" in s:
            s["log_path"] = redact(s["log_path"])

    if args.export_json:
        os.makedirs(os.path.dirname(args.export_json), exist_ok=True)
        with open(args.export_json, "w", encoding="utf-8") as f:
            json.dump(sessions, f, indent=2, ensure_ascii=False)
        print(f"Saved JSON index to: {args.export_json}")

if __name__ == "__main__":
    main()
