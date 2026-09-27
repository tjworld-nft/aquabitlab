# AquaBit LAB Website — aquabit-lab.com

代表・吉田哲司（TJ）の個人屋号「AquaBit LAB」の公式サイト。
**主役は個人・中小企業の「AI導入サポート」**。マリン事業（三浦 海の学校）はその実験場として位置づけ、
「自分の店をAIで回してきた実践」を証拠として見せる構成（2026-09-27 全面リニューアル）。

## ページ

| URL | 原稿 | 役割 |
|---|---|---|
| `/` | `src/pages/index.html` | トップ。ヒーロー＝ロゴの「しずく→波紋→ビット」を自作WebGLで動かしたもの |
| `/ai-service` | `src/pages/ai-service.html` | AI導入サポート（3つの進め方・用途・**3分診断**・自社事例・流れ・料金・FAQ） |
| `/works` | `src/pages/works.html` | 実績・取り組み（種類で絞り込み。`/works#apps` `#media` `#web` `#create` `#teach`） |
| `/ai-salon/` | `src/pages/ai-salon.html` | AI学習サロン（月額9,800円・Stripe） |
| `/marine` | `src/pages/marine.html` | マリン事業 → miura-diving.com への橋渡し |
| `/about` | `src/pages/about.html` | ABLとは・代表プロフィール・事業者情報 |
| `/contact` | `src/pages/contact.html` | お問い合わせ（相談の種類つき・3分診断の結果を引き継ぐ） |
| `/tokushoho` `/privacy-policy` `/404` | `src/pages/*.html` | 法務・エラー |

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

## 決めごと

- **数字・実績を作らない**。使ってよいのは公開済みのもの（認定ダイバー1,500名+／ウェビナー50回+・参加500名+／
  1997年〜・2001年PADIコースディレクター／App Store公開2本／まんが22話／「魚歌」19曲／Kindle12冊）。
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

- `main` へ push → GitHub Actions（`.github/workflows/deploy.yml`）が Xserver の `aquabit-lab.com/public_html/` へFTPで差分アップロード。
- `src/` `tools/` `_dev/` `README.md` などはアップロード対象外。
- 2026-09-27 に `dangerous-clean-slate`（毎回サーバーを全消しして再アップロード）を外した。以後は差分だけ。
