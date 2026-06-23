#!/usr/bin/env python3
"""Rebuild docs/HANDBOOK.md annexes from docs/*.md. Preserves content before SYNTHESIZED:START."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "docs"
OUT = ROOT / "HANDBOOK.md"

SYNTH_START = "<!-- SYNTHESIZED:START -->"
SYNTH_END = "<!-- SYNTHESIZED:END -->"

SOURCES = [
    ("APP-OVERVIEW-AND-TESTING.md", "App overview & testing (full)", "annex-app-overview--testing-full"),
    ("USER-FLOW-AND-DATA-PIPELINE.md", "User flow & runtime pipeline", "annex-user-flow--runtime-pipeline"),
    ("ZONE-CONTENT-AND-DATA.md", "Zone content, scrape & presentation", "annex-zone-content-scrape--presentation"),
    ("PROFILE-ANSWERS-ZONE-TECH.md", "Profile, journey questions & mechanical truth", "annex-profile-journey-questions--mechanical-truth"),
    ("ZAI-AND-QUESTIONS-RULES.md", "Zai, Deep Dive & question registry", "annex-zai-deep-dive--question-registry"),
    ("INTELLIGENCE-LOOP-MANIFEST.md", "Intelligence loop (Hermes, Neon, verify)", "annex-intelligence-loop-hermes-neon-verify"),
    ("ULM-APPLICATION-LOOP.md", "ULM ceilings & spawn", "annex-ulm-ceilings--spawn"),
    ("HYBRID-DATA-PIPELINE.md", "Hybrid data pipeline (cost tiers)", "annex-hybrid-data-pipeline-cost-tiers"),
    ("FULL-APP-SPEC.md", "Full app spec (architecture, APIs, DB)", "annex-full-app-spec-architecture-apis-db"),
    ("SUPPLEMENTAL-SYSTEMS.md", "Gary mode, pattern shift, rebirth vault", "annex-gary-mode-pattern-shift-rebirth-vault"),
    ("SENTINEL.md", "Sentinel live layer", "annex-sentinel-live-layer"),
    ("HERMES-ULM-JIT-BRIEF.md", "Hermes vs JIT scrape", "annex-hermes-vs-jit-scrape"),
    ("HERMES-VPS-SETUP.md", "Hermes VPS setup", "annex-hermes-vps-setup"),
    ("MOTION-FAMILY.md", "Motion DNA", "annex-motion-dna"),
    ("DEPLOY-VERCEL.md", "Vercel deploy & checks", "annex-vercel-deploy--checks"),
    ("DEV-TEST-AUDIT.md", "Dev test & audit runbook", "annex-dev-test--audit-runbook"),
    ("PUBLIC-UK-APIS.md", "UK public APIs", "annex-uk-public-apis"),
    ("APP-FLOW-AND-PIPELINE.md", "App flow & pipeline (architect)", "annex-app-flow--pipeline-architect"),
    ("PRODUCT-ARCHITECTURE-SPEC.md", "Product architecture notes", "annex-product-architecture-notes"),
]


def bump_headings(text: str, levels: int = 2) -> str:
    def repl(m):
        hashes = m.group(1)
        return "#" * min(6, len(hashes) + levels) + m.group(2)

    return re.sub(r"^(#{1,6})(\s)", repl, text, flags=re.MULTILINE)


def main() -> None:
    if not OUT.exists():
        raise SystemExit(f"Missing {OUT}")

    text = OUT.read_text(encoding="utf-8")
    a = text.find(SYNTH_START)
    if a == -1:
        raise SystemExit(f"Missing {SYNTH_START} in {OUT}")

    preamble = text[:a].rstrip() + "\n\n"

    parts = [preamble, SYNTH_START, "\n"]
    # Preserve synthesized body until SYNTH_END
    b = text.find(SYNTH_END, a)
    if b != -1:
        parts.append(text[a + len(SYNTH_START) : b + len(SYNTH_END)].strip())
        parts.append("\n\n")
    else:
        raise SystemExit(f"Missing {SYNTH_END} in {OUT}")

    parts.append("---\n\n## Annexes (full source docs)\n\n")

    for fname, title, anchor in SOURCES:
        path = ROOT / fname
        body = path.read_text(encoding="utf-8")
        body = re.sub(r"^#\s+.*\n", "", body, count=1)
        parts.append(f"\n---\n\n## Annex: {title} {{#{anchor}}}\n\n")
        parts.append(f"*Source file: `{fname}`*\n\n")
        parts.append(bump_headings(body, 2))

    parts.append(
        """
---

## Code index (quick)

| Path | Role |
|------|------|
| `app/zone/page.tsx` | Zone orchestrator |
| `app/components/JourneyBentoCard.tsx` | Bento + Solo Focus expand |
| `app/components/SoloFocusMotherStack.tsx` | Canonical expanded column |
| `app/components/AskZaiDeepDiveSheet.tsx` | Deep dive + Continue in Zai |
| `app/api/answers/route.ts` | Canonical discovery birth |
| `app/api/scrape-sync/route.ts` | Zone hydrate + trigger |
| `app/api/zai/route.ts` | Read-only Zai |
| `lib/journeys.ts` | 13×3 questions |
| `lib/zone/buildZoneViewModel.ts` | Zone VM |
| `lib/brains/buildUserImpact.ts` | £/kg engine |
| `lib/soloFocusCopy.ts` | Headlines, dedupe, True Tip |
| `lib/zone/auditorNarrative.ts` | Mechanical prose fallbacks |
| `lib/zone/zoneVoice.ts` | Warm Auditor voice |
| `lib/agents/researchAgent.ts` | Firecrawl + persist |
| `lib/zai/chatBoundaries.ts` | Zai scrape sandbox |

---

*End of Master Handbook. Regenerate annexes: `python3 scripts/consolidate-handbook.py`*
"""
    )

    OUT.write_text("".join(parts), encoding="utf-8")
    print(f"Wrote {OUT} ({len(OUT.read_text().splitlines())} lines)")


if __name__ == "__main__":
    main()
