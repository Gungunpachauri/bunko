"""Evaluate the spoiler-safe RAG against a running API.

    python eval/run_eval.py                 # both modes, writes eval/results/<time>.json and eval/RESULTS.md
    python eval/run_eval.py --mode safe     # only the spoiler-safe mode
    API_URL=http://localhost:8010 ...       # default

Each question is asked as a reader who has reached a given point of the book:
  safe   retrieval limited to text before that point (the app's behaviour)
  open   no position filter (baseline: what happens without spoiler-safe retrieval)

Metrics
  recall@k            answerable questions where a retrieved passage contains the evidence (top 3 / all 8)
  citation support    answerable questions where at least one cited passage contains the evidence
  invalid citations   [n] markers in answers that point at no passage
  past-position hits  retrieved passages starting after the reader's position (must be 0 in safe mode)
  answer leak rate    answers that mention a name/term the reader hasn't reached yet
  leaks flagged       of those, how many the post-answer leak check caught (and the UI hid)
  trap abstention     spoiler traps (answer only exists later) where the model declined
"""

import argparse
import json
import os
import re
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
API = os.environ.get("API_URL", "http://localhost:8010").rstrip("/")
ABSTAIN = re.compile(
    r"\b(don'?t|do not|doesn'?t|does not|can'?t|cannot|couldn'?t|no (information|mention|passage)|not (mentioned|named|"
    r"included|covered|in the passages|stated|given|yet)|haven'?t|isn'?t (mentioned|covered)|unable)\b", re.I)
norm = lambda s: re.sub(r"\s+", " ", s).lower()  # noqa: E731


def ask(book_id: str, question: str, reached: float, spoilers: bool) -> dict:
    body = {"question": question, "position": {"progress": reached}, "spoilers": spoilers}
    for attempt in range(4):
        out = {"citations": [], "answer": "", "leak": [], "cited": [], "error": None}
        t0 = time.time()
        event = None
        with httpx.stream("POST", f"{API}/api/books/{book_id}/ask", json=body, timeout=180) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:"):
                    data = json.loads(line[5:])
                    if event == "citations":
                        out["citations"] = data
                    elif event == "delta":
                        out["answer"] += data["text"]
                    elif event == "leak":
                        out["leak"] = data["names"]
                    elif event == "done":
                        out["cited"] = data["cited"]
                    elif event == "error":
                        out["error"] = data["message"]
        out["seconds"] = round(time.time() - t0, 1)
        # Free tiers rate-limit and get overloaded; wait and retry rather than scoring a failure.
        if out["error"] and any(w in out["error"].lower() for w in ("limit", "overloaded", "503")) and attempt < 3:
            print(f"    rate limited, waiting {30 * (attempt + 1)}s…", flush=True)
            time.sleep(30 * (attempt + 1))
            continue
        return out
    return out


def score(q: dict, book: dict, res: dict) -> dict:
    limit = q["reached"] * book["total_chars"]
    cites = res["citations"]
    has_ev = lambda c: any(norm(e) in norm(c["text"]) for e in q["evidence"])  # noqa: E731
    by_n = {c["n"]: c for c in cites}
    markers = [int(n) for n in re.findall(r"\[(\d{1,2})\]", res["answer"])]
    leaked = [t for t in q["later"] if norm(t) in norm(res["answer"])]
    # Retrieval is scored on every question; answer metrics only where the LLM actually answered.
    answered = not res["error"] and bool(res["answer"].strip())
    return {
        "answered": answered,
        "recall@3": any(has_ev(c) for c in cites[:3]) if q["answerable"] else None,
        "recall@8": any(has_ev(c) for c in cites) if q["answerable"] else None,
        "supported": any(has_ev(by_n[n]) for n in res["cited"] if n in by_n) if q["answerable"] and answered else None,
        "invalid_citations": sum(1 for n in markers if n not in by_n),
        "past_position": sum(1 for c in cites if c["char_start"] >= limit),
        "leaked": leaked if answered else [],
        "leak_flagged": bool(leaked) and bool(res["leak"]),
        "abstained": bool(ABSTAIN.search(res["answer"])) if not q["answerable"] and answered else None,
    }


def pct(xs: list) -> str:
    xs = [x for x in xs if x is not None]
    return f"{100 * sum(xs) / len(xs):.0f}% ({sum(xs)}/{len(xs)})" if xs else "–"


def summarise(rows: list[dict]) -> dict:
    s = [r["score"] for r in rows]
    leaked = [bool(x["leaked"]) for x in s if x["answered"]]
    return {
        "questions": len(rows),
        "LLM answered": f"{sum(x['answered'] for x in s)}/{len(s)}",
        "recall@3": pct([x["recall@3"] for x in s]),
        "recall@8": pct([x["recall@8"] for x in s]),
        "citation support": pct([x["supported"] for x in s]),
        "invalid citations": sum(x["invalid_citations"] for x in s),
        "past-position hits": sum(x["past_position"] for x in s),
        "answer leak rate": pct(leaked),
        "leaks flagged": f"{sum(x['leak_flagged'] for x in s)}/{sum(leaked)}" if sum(leaked) else "none to flag",
        "trap abstention": pct([x["abstained"] for x in s]),
        "median seconds": round(statistics.median(r["result"]["seconds"] for r in rows), 1),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["safe", "open", "both"], default="both")
    ap.add_argument("--only", help="comma-separated question ids")
    ap.add_argument("--rescore", metavar="RESULTS_JSON", help="re-score a saved run (no API calls)")
    args = ap.parse_args()
    if args.rescore:
        rescore(Path(args.rescore))
        return

    status = httpx.get(f"{API}/api/rag/status", timeout=10).json()
    books = httpx.get(f"{API}/api/library", timeout=10).json()["books"]
    spec = json.loads((HERE / "questions.json").read_text(encoding="utf-8"))["questions"]
    if args.only:
        keep = set(args.only.split(","))
        spec = [q for q in spec if q["id"] in keep]
    modes = ["safe", "open"] if args.mode == "both" else [args.mode]
    print(f"API {API} · LLM {status['provider']} {status['model'] or ''} · {len(spec)} questions × {modes}")

    report: dict = {"when": datetime.now().isoformat(timespec="seconds"), "llm": status, "modes": {}}
    for mode in modes:
        rows = []
        for q in spec:
            book = next((b for b in books if b["title"].startswith(q["book"])), None)
            if book is None:
                print(f"  ! no book for {q['id']}")
                continue
            res = ask(book["id"], q["question"], q["reached"], spoilers=(mode == "open"))
            sc = score(q, book, res)
            rows.append({"id": q["id"], "question": q["question"], "result": res, "score": sc})
            flag = "LEAK " + ",".join(sc["leaked"]) if sc["leaked"] else "ok"
            print(f"  [{mode}] {q['id']:22} {res['seconds']:5.1f}s  {flag}{'  ERROR ' + res['error'] if res['error'] else ''}", flush=True)
        report["modes"][mode] = {"summary": summarise(rows), "rows": rows}

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    (out / f"{stamp}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    write_markdown(report, stamp)
    print(json.dumps({m: v["summary"] for m, v in report["modes"].items()}, indent=2))


def rescore(path: Path) -> None:
    report = json.loads(path.read_text(encoding="utf-8"))
    spec = {q["id"]: q for q in json.loads((HERE / "questions.json").read_text(encoding="utf-8"))["questions"]}
    books = httpx.get(f"{API}/api/library", timeout=10).json()["books"]
    for mode in report["modes"].values():
        for row in mode["rows"]:
            q = spec[row["id"]]
            book = next(b for b in books if b["title"].startswith(q["book"]))
            row["score"] = score(q, book, row["result"])
        mode["summary"] = summarise(mode["rows"])
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    write_markdown(report, path.stem)
    print(json.dumps({m: v["summary"] for m, v in report["modes"].items()}, indent=2))


def write_markdown(report: dict, stamp: str) -> None:
    modes = list(report["modes"])
    names = {"safe": "Spoiler-safe (app)", "open": "No position filter (baseline)"}
    keys = list(report["modes"][modes[0]]["summary"])
    lines = [
        "# Evaluation results", "",
        f"Run {report['when']} · LLM: {report['llm']['provider']} {report['llm']['model'] or ''} · "
        f"embeddings {report['llm']['embed_model']} · reranker {report['llm']['rerank_model']}", "",
        "Questions: `eval/questions.json`. Each question is asked as a reader who has reached a set point in the book, "
        "once with spoiler-safe search (the app) and once without the reading-position filter (baseline). "
        "Full answers are saved locally in `eval/results/` (not committed).", "",
        "| Metric | " + " | ".join(names[m] for m in modes) + " |",
        "|---|" + "---|" * len(modes),
    ]
    for k in keys:
        # With spoilers allowed (the baseline) the leak check is switched off, so it has nothing to report there.
        cells = ["off (spoilers allowed)" if (k == "leaks flagged" and m == "open") else str(report["modes"][m]["summary"][k])
                 for m in modes]
        lines.append(f"| {k} | " + " | ".join(cells) + " |")
    lines += ["", "## Per question", "", "| Question | " + " | ".join(modes) + " |", "|---|" + "---|" * len(modes)]
    for i, row in enumerate(report["modes"][modes[0]]["rows"]):
        cells = []
        for m in modes:
            sc = report["modes"][m]["rows"][i]["score"]
            bits = []
            if sc["recall@8"] is not None:
                bits.append("found" if sc["recall@8"] else "missed")
            if not sc["answered"]:
                bits.append("_no answer (LLM error)_")
            elif sc["supported"] is not None:
                bits.append("cited" if sc["supported"] else "uncited")
            if sc["abstained"] is not None:
                bits.append("declined" if sc["abstained"] else "answered")
            if sc["leaked"]:
                bits.append("**leaked " + ", ".join(sc["leaked"]) + ("** (flagged)" if sc["leak_flagged"] else "**"))
            cells.append(", ".join(bits))
        lines.append(f"| {row['id']} | " + " | ".join(cells) + " |")
    (HERE / "RESULTS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
