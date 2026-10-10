#!/usr/bin/env python3
"""Display the QA Scoreboard and query which models/images suck."""

import argparse
import sys
from pathlib import Path
import yaml

HERE = Path(__file__).parent
ROOT = HERE.parent.parent.parent
SCORES_YAML = ROOT / "docs/qa-scores.yaml"

def print_scoreboard(only_bad: bool = False):
    if not SCORES_YAML.exists():
        print(f"❌ File not found: {SCORES_YAML}")
        sys.exit(1)
        
    data = yaml.safe_load(SCORES_YAML.read_text())
    models = data.get("models", [])
    
    if only_bad:
        models = [m for m in models if m.get("scores", {}).get("overall", 0) < 6.0 or "CAGARE" in m.get("tier", "")]
        title = "💩 MODELLI CHE FANNO CAGARE (Score < 6.0 / Severely Flawed)"
    else:
        title = "📊 CARCHESS3D — QA SCOREBOARD"
        
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78)
    
    if not models:
        print("  🎉 Nessun modello trovato in questa categoria! Tutto pulito.")
        print("=" * 78 + "\n")
        return

    # Table Header
    print(f"{'Piece':<10} {'Model':<25} {'Face':<6} {'Prop':<6} {'Back':<6} {'Tot':<6} {'Tier'}")
    print("-" * 78)
    
    for m in models:
        piece = m.get("piece", "-")
        name = m.get("model_name", "-")
        sc = m.get("scores", {})
        f_score = f"{sc.get('face_likeness', 0):.1f}"
        p_score = f"{sc.get('companion_fidelity', 0):.1f}"
        b_score = f"{sc.get('back_view', 0):.1f}"
        tot_score = f"{sc.get('overall', 0):.1f}"
        tier = m.get("tier", "-")
        
        print(f"{piece:<10} {name:<25} {f_score:<6} {p_score:<6} {b_score:<6} {tot_score:<6} {tier}")
        
        # In details mode or when filtering bad ones, print summary and flaws
        if only_bad:
            print(f"   💬 Sintesi: {m.get('summary', '')}")
            flaws = m.get("structural_flaws", []) + m.get("aesthetic_flaws", [])
            if flaws:
                print("   ⚠️ Difetti principali:")
                for fl in flaws[:4]:
                    print(f"      • {fl}")
            print("-" * 78)
            
    if not only_bad:
        print("=" * 78)
        print("💡 Usa 'just shittest' o 'python3 tools/model-pipeline/critic/scoreboard.py --cagare'")
        print("   per vedere solo quelli bocciati e le ragioni esatte.")
    print()

def main():
    parser = argparse.ArgumentParser(description="Query CarChess3D QA Scores")
    parser.add_argument("--cagare", "--worst", "-w", action="store_true", help="Mostra solo i modelli che fanno cagare (< 6.0)")
    args = parser.parse_args()
    
    print_scoreboard(only_bad=args.cagare)

if __name__ == "__main__":
    main()
