#!/usr/bin/env python3
"""AquaBit LAB — 書き出した HTML の機械検査

    python3 tools/check.py           # 全ページ
    python3 tools/check.py index lab # 指定のページだけ

・言わない言葉（誇大・煽り）が本文に無いか
・旧住所・旧固定電話が出ていないか（文字列はここに書かない＝公開リポジトリ。郵便番号の形だけ見る）
・置き換え忘れの {{…}}、外部の target=_blank に rel が付いているか、img に width/height・alt があるか
・数字の正本と食い違う古い数（アプリ2本・まんが22話 など）が残っていないか
NG が1つでもあれば終了コード1。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FORBID = [
    "必ず", "絶対", "日本初", "No.1", "ナンバーワン", "最先端", "革命", "圧倒的", "全自動", "無人で", "放置で",
    "バズ", "爆発的", "誰でも簡単", "効果保証", "完全自動", "24時間監視", "ゼロトラスト",
]
STALE = [
    (r"アプリ\s*[2456]\s*本", "アプリは7本"),
    (r"(?<![0-9])22\s*話", "まんがは24話"),
    (r"2026年9月時点", "数字の時点が古い"),
]
# 本文以外（script・style・JSON-LD・コメント）は検査しない
STRIP = re.compile(r"<(script|style)\b.*?</\1>|<!--.*?-->", re.S | re.I)


def pages(only):
    out = []
    for p in sorted(ROOT.glob("*.html")) + sorted(ROOT.glob("*/index.html")) + sorted(ROOT.glob("*/*/index.html")):
        if any(seg in p.parts for seg in ("src", "_dev", "node_modules", "tools")):
            continue
        if p.name in ("ai-salon-pamphlet.html",):
            continue
        key = p.stem if p.name != "index.html" else (p.parent.name if p.parent != ROOT else "index")
        if only and key not in only:
            continue
        out.append((key, p))
    return out


def main():
    only = set(sys.argv[1:])
    ng = 0
    for key, p in pages(only):
        raw = p.read_text(encoding="utf-8")
        body = STRIP.sub(" ", raw)
        text = re.sub(r"<[^>]+>", " ", body)
        errs = []
        for w in FORBID:
            if w in text:
                errs.append(f"言わない言葉「{w}」")
        for pat, why in STALE:
            if re.search(pat, text):
                errs.append(f"古い数（{why}）: {re.search(pat, text).group(0)}")
        if re.search(r"〒?2\d{2}-\d{4}", text):
            errs.append("郵便番号の形の文字列（旧住所でないか確認）")
        if "{{" in raw:
            errs.append("置き換え忘れの {{…}}")
        if re.search(r"(?<!\{)\{(arr|ext)\}(?!\})", raw):
            errs.append("かっこが1つだけの {arr}/{ext}（{{…}} の書き損じ）")
        for m in re.finditer(r"<a\b[^>]*target=\"_blank\"[^>]*>", raw):
            if "noopener" not in m.group(0):
                errs.append("target=_blank に rel=noopener が無い: " + m.group(0)[:80])
        for m in re.finditer(r"<img\b[^>]*>", raw):
            tag = m.group(0)
            if " alt=" not in tag:
                errs.append("img に alt が無い: " + tag[:80])
            if " width=" not in tag or " height=" not in tag:
                errs.append("img に width/height が無い: " + tag[:80])
        status = "OK" if not errs else "NG"
        print(f"{status}  {key}")
        for e in errs:
            print("     - " + e)
        ng += len(errs)
    if ng:
        print(f"\nNG {ng} 件")
        sys.exit(1)
    print("\nすべて OK")


if __name__ == "__main__":
    main()
