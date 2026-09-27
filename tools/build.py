#!/usr/bin/env python3
"""AquaBit LAB — ページの組み立て

src/pages/*.html（先頭に JSON の前書き）に、共通の head・ヘッダー・フッターを差し込んで
リポジトリ直下に書き出す。書き出したHTMLはコミットする（サーバーでは組み立てない）。

    python3 tools/build.py

・前書き（<!--@ {...} @-->）のキー
    title, description, path, og, nav, crumbs, jsonld, head, body_class, out
・本文の中で使える置き換え
    {{arr}}              ボタン用の矢印
    {{ext}}              外部リンクの斜め矢印
    {{icon:名前}}         線のアイコン（ICONS を参照）
    {{icon:名前:class}}   同上＋クラス
    {{bits}}             装飾用のビットの絵（SVG）
    {{V}}                CSS/JS のキャッシュ番号
    {{ai_links:目的}}      「AIに相談する」のリンク群
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
SITE = "https://aquabit-lab.com"
V = "20260927"          # css/js を変えたら上げる（.htaccess で1か月キャッシュしている）
LINE_URL = "https://lin.ee/obePsOF"
MAIL = "info@aquabit-lab.com"

NAV = [
    ("ai", "/ai-service", "AI導入サポート", "AI ADOPTION"),
    ("works", "/works", "実績・取り組み", "WORKS"),
    ("salon", "/ai-salon/", "AI学習サロン", "SALON"),
    ("marine", "/marine", "マリン事業", "MARINE"),
    ("about", "/about", "ABLとは", "ABOUT"),
]

# ---------------------------------------------------------------- アイコン
def _svg(body, cls="ico"):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>')

ICONS = {
    "arrow": '<path d="M4 12h15M13 6l6 6-6 6"/>',
    "ext": '<path d="M7 17L17 7M9 7h8v8"/>',
    "check": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.6"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    "build": '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.6-.6-2.6z"/>',
    "teach": '<path d="M3 9l9-4.5L21 9l-9 4.5z"/><path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11"/><path d="M21 9v5"/>',
    "pen": '<path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/>',
    "send": '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    "doc": '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15.5h6M9 9h2"/>',
    "search": '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/><path d="M8.5 11h5M11 8.5v5"/>',
    "web": '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 8.5h18M6.5 6.5h.01M9 6.5h.01"/>',
    "phone": '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    "film": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>',
    "agent": '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M10 16.5h4"/><circle cx="12" cy="3.5" r="1"/>',
    "shield": '<path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    "line": '<path d="M12 4C7 4 3 7.2 3 11.2c0 3.5 3.1 6.4 7.3 7l-.5 2.6c-.1.4.3.7.6.5L14 18c4.3-.5 7-3.4 7-6.8C21 7.2 17 4 12 4z"/>',
    "mail": '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    "book": '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    "music": '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    "wave": '<path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-3 5 0"/><path d="M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-3 5 0" opacity=".5"/><path d="M12 3.5v3.5M9.5 5h5"/>',
    "users": '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16 14.2c2.3.2 3.9 1.8 4.5 4.3"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    "question": '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6M12 17h.01"/>',
    "grid": '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
}

def icon(name, cls="ico"):
    return _svg(ICONS[name], cls)

ARR = icon("arrow", "arr")
EXT = icon("ext", "arr")

# ロゴの「しずく → 波紋 → ビット」を線画にした装飾
def bits_svg():
    sq = []
    import random
    rnd = random.Random(7)
    for i in range(34):
        y = 250 - i * 6.2 - rnd.random() * 10
        spread = 6 + i * 1.5
        x = 300 + rnd.uniform(-spread, spread)
        s = 8 + rnd.random() * 6 if i < 10 else 5 + rnd.random() * 6
        op = max(0.18, 1 - i / 38)
        sq.append(f'<rect x="{x - s/2:.1f}" y="{y - s/2:.1f}" width="{s:.1f}" height="{s:.1f}" rx="1.4" fill="#3fe3e6" opacity="{op:.2f}"/>')
    rings = "".join(
        f'<ellipse cx="300" cy="300" rx="{r}" ry="{r*0.28:.1f}" fill="none" stroke="#3fe3e6" stroke-width="{w}" opacity="{o}"/>'
        for r, w, o in [(38, 2, 0.9), (86, 1.6, 0.6), (148, 1.3, 0.38), (222, 1, 0.22), (296, 1, 0.12)]
    )
    return (f'<svg viewBox="0 0 600 420" aria-hidden="true" focusable="false">{rings}'
            f'<path d="M300 262c-6 12-9 20-9 27a9 9 0 0 0 18 0c0-7-3-15-9-27z" fill="#3fe3e6"/>{"".join(sq)}</svg>')

# ---------------------------------------------------------------- AIに相談する
AI_PROMPTS = {
    "site": ("AquaBit LAB（https://aquabit-lab.com/ 神奈川の個人事業。個人・中小企業のAI導入サポートとAI学習サロン、"
             "ダイビングスクール「三浦 海の学校」を運営）に相談するか迷っています。まず https://aquabit-lab.com/llms.txt を読んでください。"
             "そのうえで、私の仕事の内容と困りごとを質問してから、AIでできそうなことと、AquaBit LABに頼むのが合っているかどうかを率直に教えてください。"
             "料金や条件はサイトの最新情報を優先し、不確かなことは断定せず、正式な相談はお問い合わせフォーム（https://aquabit-lab.com/contact）を案内してください。"),
}

def ai_links(key="site"):
    q = quote(AI_PROMPTS[key])
    links = [
        ("ChatGPTで聞く", f"https://chatgpt.com/?q={q}"),
        ("Claudeで聞く", f"https://claude.ai/new?q={q}"),
        ("Perplexityで聞く", f"https://www.perplexity.ai/search?q={q}"),
    ]
    return "".join(f'<a href="{u}" target="_blank" rel="noopener noreferrer">{t}</a>' for t, u in links)

# ---------------------------------------------------------------- 共通部品
def head(meta):
    title = meta["title"]
    desc = meta["description"]
    path = meta["path"]
    url = SITE + path
    og = SITE + "/images/abl/" + meta.get("og", "og-home.jpg")
    robots = meta.get("robots", "index,follow,max-image-preview:large")
    ld = meta.get("jsonld", [])
    crumbs = meta.get("crumbs")
    if crumbs:
        items = [{"@type": "ListItem", "position": 1, "name": "ホーム", "item": SITE + "/"}]
        for i, (name, p) in enumerate(crumbs, start=2):
            items.append({"@type": "ListItem", "position": i, "name": name, "item": SITE + p})
        ld = ld + [{"@type": "BreadcrumbList", "itemListElement": items}]
    ld_html = ""
    if ld:
        graph = {"@context": "https://schema.org", "@graph": ld}
        ld_html = '<script type="application/ld+json">' + json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + "</script>"
    extra = meta.get("head", "")
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#03121f">
<meta property="og:type" content="{meta.get('og_type', 'website')}">
<meta property="og:site_name" content="AquaBit LAB">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="{meta.get('og_title', title)}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@500;700;800&display=swap" media="print" onload="this.media='all'">
<link rel="stylesheet" href="/css/abl.css?v={V}">
<script>document.documentElement.classList.add('js')</script>
{extra}{ld_html}
</head>
"""

def header(active):
    links = []
    mlinks = []
    for key, href, label, en in NAV:
        cur = ' aria-current="page"' if key == active else ""
        links.append(f'<a href="{href}"{cur}>{label}</a>')
        mlinks.append(f'<a class="mnav__link" href="{href}"{cur}>{label}<small>{en}</small></a>')
    return f"""<a class="skip" href="#main">本文へ移動</a>
<header class="site-header" data-header>
  <div class="wrap">
    <a class="brand" href="/" aria-label="AquaBit LAB ホーム">
      <img src="/images/logo-mark.webp" alt="" width="38" height="38">
      <span><b>AquaBit LAB</b><small>SEA × AI</small></span>
    </a>
    <nav class="gnav" aria-label="メインメニュー">
      {''.join(links)}
      <a class="btn btn--sm" href="/contact?topic=ai">相談する</a>
    </nav>
    <button class="menu-btn" type="button" aria-controls="mnav" aria-expanded="false" aria-label="メニューを開く" data-menu><span></span></button>
  </div>
</header>
<div class="mnav" id="mnav" data-mnav hidden>
  <a class="mnav__link" href="/">ホーム<small>HOME</small></a>
  {''.join(mlinks)}
  <a class="mnav__link" href="/contact">お問い合わせ<small>CONTACT</small></a>
  <div class="btn-row">
    <a class="btn btn--aqua btn--lg" href="/contact?topic=ai">AI導入の相談をする {ARR}</a>
    <a class="btn btn--line btn--lg" href="{LINE_URL}" target="_blank" rel="noopener">LINEで聞く</a>
  </div>
</div>
"""

def footer():
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="footer__top">
      <div class="footer__brand">
        <a class="brand" href="/"><img src="/images/logo-mark.webp" alt="" width="38" height="38" loading="lazy"><span><b>AquaBit LAB</b><small>SEA × AI</small></span></a>
        <p class="footer__tag">海とAI、<br>二つの未来へ。</p>
        <p>個人・中小企業のAI導入サポートと、神奈川・三浦のダイビングスクール「三浦 海の学校」。「自分には無理」を「できた」に変える、二つの事業のラボです。</p>
      </div>
      <div class="footer__col">
        <h2 class="footer__h">AI事業</h2>
        <ul>
          <li><a href="/ai-service">AI導入サポート</a></li>
          <li><a href="/ai-service#diagnosis">3分でわかる最初の一歩</a></li>
          <li><a href="/works">実績・取り組み</a></li>
          <li><a href="/ai-salon/">AI学習サロン</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h2 class="footer__h">マリン事業</h2>
        <ul>
          <li><a href="/marine">マリン事業について</a></li>
          <li><a href="https://miura-diving.com/" target="_blank" rel="noopener">三浦 海の学校 <small>↗</small></a></li>
          <li><a href="https://miura-diving.com/manga/" target="_blank" rel="noopener">まんがで読むダイビング <small>↗</small></a></li>
          <li><a href="https://miura-diving.com/bluelogbook/" target="_blank" rel="noopener">Blue Logbook <small>↗</small></a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h2 class="footer__h">AquaBit LAB</h2>
        <ul>
          <li><a href="/about">ABLとは・代表</a></li>
          <li><a href="/contact">お問い合わせ</a></li>
          <li><a href="{LINE_URL}" target="_blank" rel="noopener">公式LINE <small>↗</small></a></li>
          <li><a href="https://www.tj-web3.com/" target="_blank" rel="noopener">TJ（代表の個人サイト） <small>↗</small></a></li>
          <li><a href="https://tj-music.com/" target="_blank" rel="noopener">TJ Music <small>↗</small></a></li>
        </ul>
      </div>
    </div>
    <div class="ai-ask">
      <div>
        <h2 class="ai-ask__h">このラボのこと、あなたのAIに聞いてみる</h2>
        <p>ボタンを押すと、お使いのAIがこのサイトの案内（llms.txt）を読んで、あなたの仕事に合うかどうかを一緒に考えてくれます。</p>
      </div>
      <div class="ai-ask__links">{ai_links('site')}</div>
      <small>※回答はAIによる案内です。最新の内容と正式なご相談は、<a href="/contact">お問い合わせ</a>からどうぞ。</small>
    </div>
    <div class="footer__bottom">
      <nav aria-label="規約"><a href="/privacy-policy">プライバシーポリシー</a><a href="/tokushoho">特定商取引法に基づく表記</a><a href="mailto:{MAIL}">{MAIL}</a></nav>
      <p class="footer__made">© 2026 AquaBit LAB — このサイトも、AIといっしょに作っています。</p>
    </div>
  </div>
</footer>
<script src="/js/abl.js?v={V}" defer></script>
"""

# ---------------------------------------------------------------- 組み立て
FM = re.compile(r"^<!--@\s*(\{.*?\})\s*@-->\s*", re.S)

def render(src: Path):
    raw = src.read_text(encoding="utf-8")
    m = FM.match(raw)
    if not m:
        raise SystemExit(f"前書きがありません: {src}")
    meta = json.loads(m.group(1))
    body = raw[m.end():]

    def sub_icon(mm):
        parts = mm.group(1).split(":")
        return icon(parts[0], parts[1] if len(parts) > 1 else "ico")
    body = re.sub(r"\{\{icon:([a-z\-]+(?::[a-z_\- ]+)?)\}\}", sub_icon, body)
    body = (body.replace("{{arr}}", ARR).replace("{{ext}}", EXT).replace("{{bits}}", bits_svg())
                .replace("{{V}}", V).replace("{{line}}", LINE_URL).replace("{{mail}}", MAIL))
    body = re.sub(r"\{\{ai_links:([a-z]+)\}\}", lambda mm: ai_links(mm.group(1)), body)
    left = re.findall(r"\{\{[^}]+\}\}", body)
    if left:
        raise SystemExit(f"{src.name}: 置き換えられていない印があります {left[:5]}")

    cls = meta.get("body_class", "")
    html = (head(meta)
            + f'<body class="{cls}">\n'
            + header(meta.get("nav", ""))
            + f'<main id="main">\n{body.strip()}\n</main>\n'
            + (footer() if not meta.get("no_footer") else "")
            + meta.get("scripts", "")
            + "</body>\n</html>\n")
    out = ROOT / meta.get("out", src.stem + ".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out, meta

def main():
    pages = sorted((SRC / "pages").glob("*.html"))
    only = set(sys.argv[1:])
    for p in pages:
        if only and p.stem not in only:
            continue
        out, meta = render(p)
        print(f"  {p.name:22s} → {out.relative_to(ROOT)}  ({len(out.read_bytes())//1024} KB)")

if __name__ == "__main__":
    main()
