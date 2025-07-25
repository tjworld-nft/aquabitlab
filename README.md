# AquaBit LAB Website

AquaBit LABの公式ウェブサイトです。WordPressから静的HTMLサイトに移行しました。

## 概要

- **マリン事業**: ダイビングを中心とした海のアクティビティサービス
- **AI事業**: AI技術の教育・指導およびソリューション開発
- **教育コンテンツ**: Udemyコースと書籍の提供

## 技術スタック

- **Frontend**: 純粋なHTML5 + CSS3 + JavaScript
- **デザイン**: Apple風レスポンシブデザイン
- **デプロイ**: GitHub Actions + FTP (Xserver)

## 開発・デプロイ

### ローカル開発
```bash
# HTTPサーバーを起動
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

### 本番デプロイ
- `main`ブランチへのpushで自動デプロイ
- GitHub Actions経由でXserverにFTPアップロード

## ファイル構成

```
├── index.html          # メインページ
├── about.html          # ABLとは？
├── ai-service.html     # AI事業
├── contact.html        # お問い合わせ
├── education.html      # 教育コンテンツ
├── marine.html         # マリン事業
├── privacy-policy.html # プライバシーポリシー
└── style.css          # 共通スタイル（使用していない）
```

## 注意事項

- Web3事業セクションは削除済み
- WordPress依存を完全に除去
- 全ページでレスポンシブ対応
- 軽量かつ高速な静的サイト