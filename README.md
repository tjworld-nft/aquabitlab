# AquaBit LAB Website

AquaBit LABの公式ウェブサイトです。WordPressから静的HTMLサイトに移行しました。

## 概要

- **マリン事業**: ダイビングを中心とした海のアクティビティサービス
- **AI事業**: AI技術の教育・指導およびソリューション開発
- **教育コンテンツ**: Udemyコースと書籍の提供

## 技術スタック

- **Frontend**: HTML5 + CSS3 + JavaScript（ビルド不要の静的サイト）
- **ヒーロー描画**: three.js の WebGPURenderer（WebGPU / WebGL2 自動フォールバック）
- **デプロイ**: GitHub Actions + FTP (Xserver)

## ファイル構成

```
├── index.html            # トップページ（WebGPUヒーロー）
├── about.html            # ABLとは？（WebGPUヒーロー）
├── marine.html           # マリン事業
├── ai-service.html       # AI事業
├── ai-salon/index.html   # AI学習サロン LP
├── contact.html          # お問い合わせ
├── privacy-policy.html   # プライバシーポリシー
├── tokushoho.html        # 特定商取引法に基づく表記
├── css/aqua.css          # 共通デザインシステム（ダークテーマ／全ページ共通）
├── js/site.js            # 共通UI（ナビ・スクロール出現・FAQ・お問い合わせ送信）
├── js/hero.min.js        # ヒーロー描画のビルド済みバンドル（コミット対象）
├── src/hero.js           # ↑のソース（three.js / TSL）
├── src/ogp-card.html     # OGP画像の生成テンプレート
├── tools/build-ogp.sh    # OGP画像の生成スクリプト
├── robots.txt
└── sitemap.xml
```

## ヒーロー描画について

トップページと ABL ページの背景は `src/hero.js` が描いています。

- `WebGPURenderer` を使い、**WebGPU が使える環境では GPU コンピュートシェーダ**で
  約3.6〜22万個の粒子を流体的に動かします（マウスに反応して渦を巻きます）。
- WebGPU が無い環境では three.js が自動的に **WebGL2 にフォールバック**し、
  粒子の位置を頂点シェーダ側の手続き計算に切り替えて同じ見た目を保ちます。
- どちらも動かない場合は `images/aqua-hero.webp` の静止画が表示されます。
- 端末性能に応じて粒子数・解像度を自動調整し、`prefers-reduced-motion` や
  タブ非表示、ヒーローが画面外のときは描画を止めます。

### ビルド

`src/hero.js` を編集したら再ビルドしてください（`js/hero.min.js` はコミットします）。

```bash
npm install
npm run build
```

### キャッシュ対策（重要）

`.htaccess` で CSS / JS を1ヶ月キャッシュしているため、`css/aqua.css` `js/site.js`
`js/hero.min.js` を変更したら、各HTMLの読み込みURLに付けている `?v=YYYYMMDD` を
新しい日付に一括で書き換えてください。これを忘れると、再訪問者に古いCSSが当たって
レイアウトが崩れます。

```bash
grep -rl 'v=20260731' *.html | xargs sed -i '' 's/v=20260731/v=YYYYMMDD/g'
```

### OGP画像の生成

`src/ogp-card.html` から `images/ogp.png` / `ogp-marine.png` / `ogp-ai.png` を作り直します。

```bash
./tools/build-ogp.sh
```

## 開発・デプロイ

### ローカル開発

```bash
python3 -m http.server 8000
```

ブラウザで http://localhost:8000 を開きます。
`?renderer=webgl` を付けると WebGL フォールバックを、`?q=low` などで品質設定を確認できます。

### 本番デプロイ

- `main` ブランチへの push で自動デプロイ
- GitHub Actions 経由で Xserver に FTP アップロード
- `node_modules/` `src/` `tools/` はアップロード対象外

## 注意事項

- Web3事業セクションは削除済み
- WordPress依存を完全に除去
- 全ページでレスポンシブ対応・OGP設定済み
