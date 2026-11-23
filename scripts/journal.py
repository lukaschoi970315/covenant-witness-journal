#!/usr/bin/env python3
"""언약 증인 일지 도구

사용법:
  python3 scripts/journal.py                  # 오늘 기록 페이지 만들기 (주간 · 월간 · 연간 페이지도 없으면 함께)
  python3 scripts/journal.py day 2026-11-23   # 특정 날짜 기록 페이지
  python3 scripts/journal.py week [날짜]        # 해당 날짜가 속한 주(주일 시작) 주간 페이지
  python3 scripts/journal.py month [YYYY-MM]  # 월간 페이지
  python3 scripts/journal.py year [YYYY]      # 연간 페이지
  python3 scripts/journal.py build            # 증인 기록 모음 · 대시보드 · 월간/연간 표 자동 정리

records/ 안의 기록에서 `언약::` `만남::` `작품::` `성취::` `응답::` `전도::` 로 시작하는 줄을 찾아
witness/ 폴더의 증인 기록 모음과 README 대시보드를 자동으로 만듭니다.
날짜 기준 시간대는 환경변수 TZ 를 따릅니다 (예: TZ=America/Los_Angeles, TZ=Asia/Seoul).
"""
from __future__ import annotations

import calendar
import datetime as dt
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORDS = ROOT / "records"
TEMPLATES = ROOT / "templates"
WITNESS = ROOT / "witness"
README = ROOT / "README.md"
REPO = os.environ.get("GITHUB_REPOSITORY", "lukaschoi970315/covenant-witness-journal")
BRANCH = "main"

WEEKDAYS = ["월", "화", "수", "목", "금", "토", "주일"]

# (표시, 파일 이름, 아이콘, 제목, 설명)
CATEGORIES = [
    ("언약", "covenant", "📖", "붙잡은 언약", "강단을 통해 선포된 말씀을 나의 언약으로 붙잡은 기록"),
    ("만남", "encounters", "🤝", "근본의 만남", "낮에 하나님이 예비하신 근본의 만남"),
    ("작품", "masterpieces", "🌙", "최고의 작품", "밤에 하나님이 나를 통해 남기게 하신 최고의 작품"),
    ("성취", "fulfillment", "✨", "성취된 말씀", "붙잡은 말씀이 나의 삶에서 이루어진 기록"),
    ("응답", "prayer-answers", "🙏", "기도 응답", "기도하고 응답받은 기록"),
    ("전도", "evangelism", "🔥", "전도 역사", "하나님께서 나의 삶을 통해 하신 전도 역사"),
]
CAT = {c[0]: c for c in CATEGORIES}
NAMES = [c[0] for c in CATEGORIES]

MARKER_RE = re.compile(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)?(" + "|".join(NAMES) + r")\s*::\s*(.*)$")
AUTO_RE = re.compile(r"<!--\s*([A-Z]+):START\s*-->.*?<!--\s*\1:END\s*-->", re.S)
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
DAY_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
WEEK_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})-week")


# ───────────────────────── 공통 ─────────────────────────
def wd(d: dt.date) -> str:
    return WEEKDAYS[d.weekday()]


def sunday_of(d: dt.date) -> dt.date:
    """해당 날짜가 속한 주의 주일(주의 첫날)."""
    return d - dt.timedelta(days=(d.weekday() + 1) % 7)


def day_path(d: dt.date) -> Path:
    return RECORDS / f"{d:%Y}" / f"{d:%m}" / f"{d:%Y-%m-%d}.md"


def week_path(s: dt.date) -> Path:
    return RECORDS / f"{s:%Y}" / f"{s:%m}" / f"{s:%Y-%m-%d}-week.md"


def month_path(y: int, m: int) -> Path:
    return RECORDS / f"{y:04d}" / f"{m:02d}" / "README.md"


def year_path(y: int) -> Path:
    return RECORDS / f"{y:04d}" / "README.md"


def rel(path: Path, frm: Path) -> str:
    """frm 파일 기준 path 의 상대 링크."""
    return Path(os.path.relpath(path, frm.parent)).as_posix()


def edit_url(path: Path) -> str:
    return f"https://github.com/{REPO}/edit/{BRANCH}/{path.relative_to(ROOT).as_posix()}"


def cell(text: str, n: int = 40) -> str:
    text = text.replace("|", "\\|").strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def today() -> dt.date:
    return dt.date.today()


# ───────────────────────── 페이지 만들기 ─────────────────────────
def render(name: str, **kw) -> str:
    text = (TEMPLATES / name).read_text(encoding="utf-8")
    for k, v in kw.items():
        text = text.replace("{{%s}}" % k, str(v))
    return text


def create(path: Path, text: str) -> bool:
    shown = path.relative_to(ROOT).as_posix()
    if path.exists():
        print(f"  이미 있음: {shown}")
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"  ✅ 생성: {shown}")
    return True


def new_year(y: int) -> None:
    create(year_path(y), render("yearly.md", year=y))


def new_month(y: int, m: int) -> None:
    new_year(y)
    create(month_path(y, m), render("monthly.md", year=y, month=m))


def new_week(d: dt.date) -> None:
    s = sunday_of(d)
    new_month(s.year, s.month)
    create(week_path(s), render("weekly.md", sunday=s.isoformat(),
                                saturday=(s + dt.timedelta(days=6)).isoformat()))


def new_day(d: dt.date) -> None:
    new_month(d.year, d.month)
    new_week(d)
    create(day_path(d), render("daily.md", date=d.isoformat(), weekday=wd(d)))


# ───────────────────────── 기록 읽기 ─────────────────────────
def parse(text: str) -> dict[str, list[str]]:
    text = AUTO_RE.sub("", text)
    text = COMMENT_RE.sub("", text)
    items: dict[str, list[str]] = {n: [] for n in NAMES}
    in_code = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        m = MARKER_RE.match(line)
        if m and m.group(2).strip():
            items[m.group(1)].append(m.group(2).strip())
    return items


def classify(path: Path) -> dict | None:
    parts = path.relative_to(RECORDS).parts
    stem = path.stem
    try:
        if m := DAY_RE.fullmatch(stem):
            d = dt.date(*map(int, m.groups()))
            return dict(kind="day", date=d, rank=0, label=f"{d} ({wd(d)})")
        if m := WEEK_RE.fullmatch(stem):
            d = dt.date(*map(int, m.groups()))
            return dict(kind="week", date=d, rank=1, label=f"{d} 주간")
        if stem == "README":
            if len(parts) == 3 and re.fullmatch(r"\d{4}", parts[0]) and re.fullmatch(r"\d{2}", parts[1]):
                y, mo = int(parts[0]), int(parts[1])
                d = dt.date(y, mo, calendar.monthrange(y, mo)[1])
                return dict(kind="month", date=d, rank=2, label=f"{y}년 {mo}월 (월간)")
            if len(parts) == 2 and re.fullmatch(r"\d{4}", parts[0]):
                y = int(parts[0])
                return dict(kind="year", date=dt.date(y, 12, 31), rank=3, label=f"{y}년 (연간)")
    except ValueError:
        return None
    return None


def load() -> list[dict]:
    entries = []
    if not RECORDS.exists():
        return entries
    for path in sorted(RECORDS.rglob("*.md")):
        info = classify(path)
        if not info:
            continue
        info["path"] = path
        info["items"] = parse(path.read_text(encoding="utf-8"))
        info["filled"] = any(info["items"].values())
        entries.append(info)
    return entries


def first(e: dict, name: str, n: int = 40) -> str:
    v = e["items"][name]
    return cell(v[0], n) if v else ""


# ───────────────────────── 자동 정리 ─────────────────────────
def write_if_changed(path: Path, text: str) -> None:
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"  🔄 정리: {path.relative_to(ROOT).as_posix()}")


def replace_block(path: Path, name: str, content: str) -> None:
    text = path.read_text(encoding="utf-8")
    pat = re.compile(r"(<!--\s*%s:START\s*-->)(.*?)(<!--\s*%s:END\s*-->)" % (name, name), re.S)
    if not pat.search(text):
        return
    new = pat.sub(lambda m: f"{m.group(1)}\n{content.strip()}\n{m.group(3)}", text, count=1)
    write_if_changed(path, new)


def build_witness(entries: list[dict]) -> None:
    nav = " · ".join(f"[{c[2]} {c[3]}]({c[1]}.md)" for c in CATEGORIES)
    for name, slug, icon, title, desc in CATEGORIES:
        rows = [(e, t) for e in entries for t in e["items"][name]]
        rows.sort(key=lambda r: (r[0]["date"], r[0]["rank"]), reverse=True)
        out = [
            f"# {icon} {title}",
            "",
            f"> {desc}",
            ">",
            f"> 🤖 `records/` 의 `{name}::` 줄을 모아 자동으로 만들어지는 페이지입니다. 직접 수정하지 말고 날짜별 기록을 수정하세요.",
            "",
            f"[🏠 처음으로](../README.md) · {nav}",
            "",
            f"**총 {len(rows)}건**",
        ]
        cur_y = cur_m = None
        for e, t in rows:
            y = e["date"].year
            if y != cur_y:
                out += ["", f"## {y}년", ""]
                cur_y, cur_m = y, None
            mo = None if e["kind"] == "year" else e["date"].month
            if mo is not None and mo != cur_m:
                out += ([] if out[-1] == "" else [""]) + [f"### {mo}월", ""]
                cur_m = mo
            out.append(f"- **[{e['label']}]({rel(e['path'], WITNESS / 'x.md')})** — {t}")
        if not rows:
            out += ["", "_아직 기록이 없습니다. 날짜별 기록에 `" + name + ":: 내용` 을 적으면 이곳에 모아집니다._"]
        write_if_changed(WITNESS / f"{slug}.md", "\n".join(out) + "\n")


def build_week_blocks(entries: list[dict], days: dict[dt.date, dict]) -> None:
    t = today()
    for e in entries:
        if e["kind"] != "week":
            continue
        lines = []
        for i in range(7):
            d = e["date"] + dt.timedelta(days=i)
            de = days.get(d)
            head = f"{d:%m/%d} ({wd(d)})"
            if de:
                bits = [f"📖 {first(de, '언약')}" if de["items"]["언약"] else "",
                        f"🌙 {first(de, '작품')}" if de["items"]["작품"] else ""]
                bits = " · ".join(b for b in bits if b) or "_기록 중_"
                lines.append(f"- [{head}]({rel(de['path'], e['path'])}) — {bits}")
            else:
                lines.append(f"- {head} — {'_기록 없음_' if d <= t else '·'}")
        replace_block(e["path"], "WEEK", "\n".join(lines))


def build_month_blocks(entries: list[dict]) -> None:
    for e in entries:
        if e["kind"] != "month":
            continue
        y, mo = e["date"].year, e["date"].month
        weeks = [w for w in entries if w["kind"] == "week" and (w["date"].year, w["date"].month) == (y, mo)]
        ds = sorted((d for d in entries if d["kind"] == "day" and (d["date"].year, d["date"].month) == (y, mo)),
                    key=lambda d: d["date"])
        lines = []
        if weeks:
            lines.append("**⛪ 주간 (강단 말씀 · 포럼):** " +
                         " · ".join(f"[{w['date']:%m/%d} 주간]({rel(w['path'], e['path'])})" for w in weeks))
            lines.append("")
        if ds:
            lines += ["| 날짜 | 📖 언약 | 🤝 근본의 만남 | 🌙 최고의 작품 | ✨ | 🙏 | 🔥 |",
                      "|---|---|---|---|:-:|:-:|:-:|"]
            for d in ds:
                c = lambda n: str(len(d["items"][n])) if d["items"][n] else ""
                lines.append(f"| [{d['date']:%m/%d} ({wd(d['date'])})]({rel(d['path'], e['path'])}) | "
                             f"{first(d, '언약', 30)} | {first(d, '만남', 30)} | {first(d, '작품', 30)} | "
                             f"{c('성취')} | {c('응답')} | {c('전도')} |")
        else:
            lines.append("_아직 기록이 없습니다._")
        replace_block(e["path"], "MONTH", "\n".join(lines))


def count(es: list[dict], name: str) -> int:
    return sum(len(x["items"][name]) for x in es)


def build_year_blocks(entries: list[dict]) -> None:
    for e in entries:
        if e["kind"] != "year":
            continue
        y = e["date"].year
        lines = ["| 월 | 📅 기록한 날 | 📖 언약 | 🤝 만남 | 🌙 작품 | ✨ 성취 | 🙏 응답 | 🔥 전도 |",
                 "|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|"]
        any_month = False
        for mo in range(1, 13):
            es = [x for x in entries if x["kind"] in ("day", "week", "month")
                  and (x["date"].year, x["date"].month) == (y, mo)]
            mp = month_path(y, mo)
            if not es and not mp.exists():
                continue
            any_month = True
            days_n = sum(1 for x in es if x["kind"] == "day" and x["filled"])
            label = f"[{mo}월]({rel(mp, e['path'])})" if mp.exists() else f"{mo}월"
            lines.append(f"| {label} | {days_n} | " + " | ".join(str(count(es, n)) for n in NAMES) + " |")
        if not any_month:
            lines = ["_아직 기록이 없습니다._"]
        replace_block(e["path"], "YEAR", "\n".join(lines))


def build_dashboard(entries: list[dict], days: dict[dt.date, dict]) -> None:
    t = today()
    recorded = {d for d, e in days.items() if e["filled"]}
    streak, cur = 0, (t if t in recorded else t - dt.timedelta(days=1))
    while cur in recorded:
        streak += 1
        cur -= dt.timedelta(days=1)

    tp, wp = day_path(t), week_path(sunday_of(t))
    lines = ["### ✏️ 오늘 기록하기", ""]
    if tp.exists():
        lines.append(f"**[✏️ {t} ({wd(t)}) 오늘의 기록 쓰기]({edit_url(tp)})** · "
                     f"[📄 보기]({rel(tp, README)})"
                     + (f" · [⛪ 이번 주 강단 말씀 · 포럼 쓰기]({edit_url(wp)})" if wp.exists() else ""))
    else:
        lines.append(f"_{t} 페이지가 아직 없습니다. **Actions → 🌅 오늘의 기록 페이지 만들기 → Run workflow** 를 누르세요._")

    lines += ["", "### 📊 지금까지의 증인 기록", "",
              "| 📅 기록한 날 | 🔗 연속 기록 | " + " | ".join(f"{c[2]} {c[0]}" for c in CATEGORIES) + " |",
              "|:-:|:-:|" + ":-:|" * len(CATEGORIES),
              f"| **{len(recorded)}일** | **{streak}일** | "
              + " | ".join(f"[{count(entries, c[0])}](witness/{c[1]}.md)" for c in CATEGORIES) + " |"]

    recent = sorted((e for e in days.values() if e["filled"]), key=lambda e: e["date"], reverse=True)[:7]
    lines += ["", "### 🕊️ 최근 기록", ""]
    if recent:
        lines += ["| 날짜 | 📖 언약 | 🤝 근본의 만남 | 🌙 최고의 작품 |", "|---|---|---|---|"]
        for e in recent:
            lines.append(f"| [{e['label']}]({rel(e['path'], README)}) | {first(e, '언약')} | "
                         f"{first(e, '만남')} | {first(e, '작품')} |")
    else:
        lines.append("_첫 기록을 기다리고 있습니다. 오늘부터 시작합니다!_ 🙏")

    y = t.year
    per = [sum(1 for d in recorded if (d.year, d.month) == (y, mo)) for mo in range(1, 13)]
    head = [f"[{mo}월]({rel(month_path(y, mo), README)})" if month_path(y, mo).exists() else f"{mo}월"
            for mo in range(1, 13)]
    yl = f"[{y}년]({rel(year_path(y), README)})" if year_path(y).exists() else f"{y}년"
    lines += ["", f"### 📅 {yl} 월별 기록한 날", "",
              "| " + " | ".join(head) + " |", "|" + ":-:|" * 12,
              "| " + " | ".join(str(n) if n else "·" for n in per) + " |"]
    replace_block(README, "DASHBOARD", "\n".join(lines))


def build() -> None:
    entries = load()
    days = {e["date"]: e for e in entries if e["kind"] == "day"}
    build_witness(entries)
    build_week_blocks(entries, days)
    build_month_blocks(entries)
    build_year_blocks(entries)
    build_dashboard(entries, days)
    print(f"  📊 기록 {len(entries)}개 정리 완료")


# ───────────────────────── 실행 ─────────────────────────
def main(argv: list[str]) -> None:
    cmd = argv[0] if argv else "today"
    arg = argv[1] if len(argv) > 1 else None
    if cmd in ("today", "day"):
        new_day(dt.date.fromisoformat(arg) if arg else today())
    elif cmd == "week":
        new_week(dt.date.fromisoformat(arg) if arg else today())
    elif cmd == "month":
        y, m = map(int, arg.split("-")) if arg else (today().year, today().month)
        new_month(y, m)
    elif cmd == "year":
        new_year(int(arg) if arg else today().year)
    elif cmd == "build":
        build()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
