# AquaBit LAB Website — aquabit-lab.com

代表・吉田哲司（TJ）の個人屋号「AquaBit LAB」の公式サイト。
**主役は個人・中小企業の「AI導入サポート」**。マリン事業（三浦 海の学校）はその実験場として位置づけ、
「自分の店をAIで回してきた実践」を証拠として見せる構成（2026-09-27 全面リニューアル）。

## ページ

| URL | 原稿 | 役割 |
|---|---|---|
| `/` | `src/pages/index.html` | トップ。ヒーロー＝ロゴの「しずく→波紋→ビット」を自作WebGLで動かしたもの |
| `/ai-service` | `src/pages/ai-service.html` | AI導入サポート（3つの進め方・用途・**3分診断**・自社事例・流れ・料金・FAQ） |
| `/lab` | `src/pages/lab.html` | ラボの中（2026-11 新設）。人とAIの線引き・ショート動画の工場と動画のレントゲン（X-RAY）・伸びた回の数字・12原則・予約投稿の仕組み・鬼と仏・AIの係8役 |
| `/works` | `src/pages/works.html` | 実績・取り組み（種類で絞り込み。`/works#apps` `#media` `#web` `#create` `#teach`） |
| `/ai-salon/` | `src/pages/ai-salon.html` | AI学習サロン（月額9,800円・Stripe） |
| `/marine` | `src/pages/marine.html` | マリン事業 → miura-diving.com への橋渡し |
| `/about` | `src/pages/about.html` | ABLとは・代表プロフィール・事業者情報 |
| `/contact` | `src/pages/contact.html` | お問い合わせ（相談の種類つき・3分診断の結果を引き継ぐ） |
| `/tokushoho` `/privacy-policy` `/404` | `src/pages/*.html` | 法務・エラー |
| `/ryumyaku/` | `src/pages/ryumyaku.html` | iPhone アプリ「龍脈マップ」の案内とサポート（App Store のサポート URL） |
| `/ryumyaku/privacy/` | `src/pages/ryumyaku-privacy.html` | 龍脈マップのプライバシーポリシー（App Store のプライバシーポリシー URL） |
| `/hotoke/` | `src/pages/hotoke.html` | iPhone アプリ「仏のたとえ」の案内とサポート（App Store のサポート URL・2026-11-10 公開） |
| `/hotoke/privacy/` | `src/pages/hotoke-privacy.html` | 仏のたとえのプライバシーポリシー |
| `/gyoji-album/` | `src/pages/gyoji-album.html` | iPhone アプリ「うちの行事アルバム」の案内とサポート（App Store のサポート URL・2026-11-12 公開） |
| `/gyoji-album/privacy/` | `src/pages/gyoji-album-privacy.html` | うちの行事アルバムのプライバシーポリシー |
| `/umi-himekuri/` | `src/pages/umi-himekuri.html` | iPhone アプリ「海の日めくり」の案内とサポート（App Store のサポート URL・2026-11-14 公開） |
| `/umi-himekuri/privacy/` | `src/pages/umi-himekuri-privacy.html` | 海の日めくりのプライバシーポリシー |
| `/hotoke/feed.json` | （直接置く） | アプリが読む新しい話と動画の一覧。動画は `hotoke/v/`。アプリ側の道具 `~/Developer/hotoke-app-20261109/tools/feed_video.py` が足す（キャッシュ5分・`hotoke/.htaccess`） |
| `/ryumyaku/data/` | `src/pages/ryumyaku-data.html` | 龍脈マップの場所のデータと作り方（OpenStreetMap の ODbL 4.6 のための公開）。ファイルは `ryumyaku/data/` に直接置く（`.htaccess` で .gz をそのまま渡す） |

## 仕組み

- **HTMLは組み立て式**。`src/pages/*.html`（先頭にJSONの前書き）に、共通の head・ヘッダー・フッター・構造化データを
  `tools/build.py` が差し込んで、リポジトリ直下に書き出す。**書き出したHTMLもコミットする**（サーバーでは組み立てない）。
  ```bash
  python3 tools/build.py            # 全ページ
  python3 tools/build.py works      # 1ページだけ
  ```
  直接 `*.html`（直下）を直しても、次の build で上書きされるので **必ず `src/pages/` を直す**。
- デザインは `css/abl.css`（色・文字・部品すべて）。動きは `js/abl.js`（メニュー・出現・絞り込み・3分診断・フォーム）。
- ヒーローの水面は `js/ripple.js`（WebGL1・依存ライブラリなし・約10KB）。
  - 読み込みが落ち着いてから始め（requestIdleCallback）、対応ブラウザではシェーダーを並行コンパイル。
  - 使えない端末・`prefers-reduced-motion` は静止画 `images/abl/hero-poster.webp` のまま／1枚だけ描く。
  - `?ripple=off` で無効、`?still` で1枚だけ、`?q=low` で低解像度。
  - 静止画の作り直し：`_dev/ripple-test?capture&still` を 1600×900 で撮って webp に。
- 画像は `images/abl/`（すべてWebP・実物の写真とアプリ画面。AIの“それっぽい”イメージ画像は使わない）。
- OGP画像は `images/abl/og-*.jpg`（1200×630）。作り直しは `_dev/og.html` ＋ `tools/og.mjs`。
- AI検索向けの案内 `llms.txt`。料金・特典・実績の数字を変えたらここも直す。

## 2026-11 リデザイン（「このサイトは、いま動いているラボの窓。」）

- 設計は Fable（2026-11-08）。海＝暗い舞台 `.stage`／AI＝紙の帳面 `.paper` と行 `.ledger`。白いカード・ティッカー・方眼・ビットの飾り（`{{bits}}`）は使わない。
- ラボの時計（LAB NOW）・24時間リング・ヘッダーの稼働ランプは **2026-11-08 に外した**（吉田さん：運用をやめた日に、サイトが「済」と言い続けるのは困る）。定時の時刻や「毎日」と言い切る書き方もしない。仕組みは「〜してきた」「〜する仕組み」で書く。
- **動画のレントゲン（X-RAY）**：`[data-xray]`。動画は `video/lab/`（540×960・無音・約2MB・`preload="none"`・30%見えてから読む）。層の `data-from`/`data-to`（秒）で、その秒を作っているものが光る（時刻順に並べ、全編の層は末尾）。動きを減らす設定・省データでは読まない。
- ヒーローの水面がビットに変わると `html.is-bits` が付き、見出しの「現場の道具」の色が変わる（`js/ripple.js`）。
- 数字（再生回数など）は `/lab` と `/works` にだけ書く。トップに置かない（直し忘れを防ぐ）。
- 公開前に `python3 tools/check.py`：言わない言葉（必ず・絶対・日本初・No.1・最先端・全自動・バズ など）、古い数（アプリ2本・まんが22話）、郵便番号の形、`{{…}}` の置き換え忘れ、外部リンクの rel、img の width/height/alt を見る。

## アプリの案内ページ（サポート）の部品（2026-11-14・まず `/gyoji-album/` に入れた）

- **画面の帯** `.shots`：ストアのスクリーンショットから、宣伝の見出しを外した画面だけを切り出した絵（`images/abl/shot-<アプリ>-0N.webp`・幅600px・四隅は透明）。スマホは横に送り、幅1000px以上は5枚が並ぶ。絵の下に「画面の中の写真は、試験用の絵です。」を残す。
- **よくある質問**：小見出し `<h3 class="faq__h">` と `<div class="faq">` を組にして分ける。各 `<details>` に `id="faq-…"` を付けると、`/gyoji-album/#faq-receive` のようなリンクで、その答えが開く（`js/abl.js`。ページをひらいた時と、ページの中のリンクを押した時の両方）。番号つきの手順は `<ol class="howto">`。
- **押しやすさ**：矢印つきの文字リンクは `.tap`（2つ並べるときは `.linkrow`）、表（`.dl`）の中のリンクは `dl` に `.dl--tap`（1行に2つ並べる `dd` には `.dl__links`）。どちらも見た目と行の高さは変えずに、押せる高さを44px以上にする。パンくず（`.crumbs a`・全ページ）も同じやり方で、見た目とキーボードで選んだ時の枠はそのまま。
- **最初の1画面**：ヒーローの `<section class="phero …">` に `.phero--app` を付けると、幅360px以下で上下の間を詰め（App Store のバッジが1画面目に入る）、文字を大きくした時に題とリードの右はしが切れない。同じページの下の節の見出し（`.h2`）も、文字を大きくした時は句の途中で折り返す（ふだんの折り返しは変わらない。全ページの `.h2` には付けない：`/marine` の見出しが幅320pxで崩れる）。
- **お問い合わせ**：アプリのページからは `/contact?topic=app&app=<アプリの鍵>` へつなぐ。フォームがアプリ向けの見た目（リード・種類は1つ・会社名の欄なし）になり、本文に「【アプリ名】／機種／iOS／どの画面で何が起きたか」のひな形が入る。
  アプリの鍵と名前は `js/abl.js` の `APPS`（一覧に無い値は使わない）。種類 `app` は `src/pages/contact.html` と `send-mail.php` の `$topics` の**両方**に要る（片方だけだと送信がエラーになる。`tools/test_contact.py` の `FormTopicsTests` が、フォームの value と `$topics` の鍵が同じ集まりかを見る）。
  アプリ向けの見た目のときは、隠した欄（`data-biz`：会社名・LINE の行・「書いておくと早いこと」）を止めて、送る中身にも入れない。本文がひな形のままなら送らない。どのアプリか決まらないとき（`app` が無い・ふつうの `/contact` で「アプリのこと」をえらんだ）は、「どのアプリのことかを、はじめにお書きください。」と出す。ふつうの `/contact` で「アプリのこと」をえらんでいる間は、お店の相談の例文（`data-app-ex`）を隠す。
- 版の番号は、本文に書かない（下の表の「いまの版」1か所だけ・日付なし）。アプリの版を上げたら、表を直す。構造化データには版を書かない。
- アプリを見ないと分からない事（設定の場所・手順）は、確かめてから書く。
- 折らないまとまり `<span class="nw">…</span>` のすぐ後ろに「。」「、」を置かない（広い幅で、次の行が「。」から始まる）。句読点は `.nw` の中に入れる：`<span class="nw">（無料）。</span>`。
- **まだ直していない物（2026-11-14）**：リンクを送ったときに出る絵 `images/abl/og-gyoji-album.jpg` は、見出しの終わり「を、」が明るいスマホの絵に重なっている。絵の日本語は Mac の書体（ヒラギノ）なので、Mac で `tools/og.mjs` を回して直す（見出しの折り返しか、後ろの絵の位置）。

## 決めごと

- **数字・実績を作らない**。使ってよいのは公開済みのもの（認定ダイバー1,500名+／ウェビナー50回+・参加500名+／
  1997年〜・2001年PADIコースディレクター／App Store公開8本／まんが24話／「魚歌」19曲／Kindle12冊）。
  お客さまの声は、実在・掲載許可のあるものだけ。
- 旧住所・旧固定電話は、どのページにも出さない（このリポジトリは公開なので、ここにも書かない）。所在地は「神奈川県三浦市（詳細は請求時に開示）」。
- トーンは「海とAI、二つの未来へ」。短く断定。ただし誇大表現（必ず・絶対・日本初・No.1）と恐怖で煽る書き方はしない。
- 「人が決める／AIが作る」を分けて書く（`tag--human` と `tag--ai`）。送信・公開の最終判断は人。

## キャッシュ（重要）

`.htaccess` で CSS/JS を1か月キャッシュしている。`css/abl.css` `js/*.js` を変えたら
`tools/build.py` の `V = "YYYYMMDD"` を上げて build し直す（全ページの `?v=` が変わる）。
index.html の `ripple.js?v=` は前書き（head）に直書きなので一緒に上げる。

## ローカル確認

```bash
php -S 127.0.0.1:8983 -t . tools/router.php
```
`tools/router.php` が本番の .htaccess と同じURLの動き（クリーンURL・.html→301・404）を再現する。
`send-mail.php` はローカルでは `ABL_MAIL_DRYRUN=1` になり、**メールを実際には送らない**。

## デプロイ

- `main` へ push → GitHub Actions（`.github/workflows/deploy.yml`）が Xserver の `aquabit-lab.com/public_html/` へ **FTPS（暗号化）** で差分アップロード（2026-11-08 に平文FTPから切り替え・アクションはコミットIDで固定・ログは standard でファイル一覧を出さない）。
- `src/` `tools/` `_dev/` `README.md` などはアップロード対象外。
- 2026-09-27 に `dangerous-clean-slate`（毎回サーバーを全消しして再アップロード）を外した。以後は差分だけ。


## お問い合わせの迷惑投稿対策（2026-10-13）

- `send-mail.php?action=token` がセッションに紐付く使い切りトークンを発行。フォームはJavaScriptで取得し、サーバー側で3秒〜2時間の有効期間を検証する。複数タブは最大20個まで保持。
- `contact-guard.php` が送信元IP（10分3件・1日20件）、メール（1時間3件）、同じ本文（1時間3件）を制限。30文字未満の短文は名前も照合し、別のお客さまの定型質問を巻き込まない。同じメール＋本文は24時間重複送信を抑止する。言語や名前の国籍による判定はしない。
- 記録は公開ディレクトリ外の一時領域に保存。個人情報そのものは記録せず、秘密値を用いた照合ハッシュと時刻のみを保存する。24時間以上前の記録は次回の処理時に除去。ロック＋原子的な置換で同時送信でも制限を維持し、保存に失敗した場合はメールを送らず503を返す。
- 制限・障害時は入力を保持し、直接メールの連絡先を案内。JavaScript/Cookie無効時も直接メールを利用できる。`ABL_MAIL_DRYRUN=1` はメール配送だけを止め、対策は無効にしない。
- ローカル回帰テスト：`python3 tools/test_contact.py`。外部へのメール送信なし。正常な日本語/英語、トークン、再送、並列リクエスト、保存障害を検証する。
- デプロイ後はフォームHTML/JSの版、トークン取得のCookieとno-store、トークン無しPOSTの拒否を確認する。通常のメール送信を伴う本番テストとは区別する。
- この対策は汎用ボットと連投を抑えるもの。セッションを取得して内容も変更するボットまで完全には防げない。再発時は拒否ログとアクセスログを調べ、必要に応じて追加のボット認証を検討する。
