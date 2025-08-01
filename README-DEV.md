# AquaBit LAB 開発環境

## 🚀 クイックスタート

```bash
# サーバー起動（ブラウザが自動で開きます）
./dev.sh start

# サーバー停止
./dev.sh stop

# サーバー状態確認
./dev.sh status

# サーバー再起動
./dev.sh reload
```

## 📍 アクセス先

- **🏠 ホーム**: http://localhost:8080/
- **🤖 AI学習サロン**: http://localhost:8080/ai-salon/
- **🔧 AI事業**: http://localhost:8080/ai-service.html
- **🌊 マリン事業**: http://localhost:8080/marine.html

## 🛠️ 開発時の便利機能

### 自動ブラウザ起動
サーバー起動時に自動でAI学習サロンページが開きます

### キャッシュ無効化
変更がすぐに反映されるよう、キャッシュを無効化しています

### わかりやすいログ
アクセスログが見やすく表示されます

## 🔧 手動でPythonサーバー起動

```bash
# カスタムサーバー（推奨）
python3 server.py

# 標準HTTPサーバー
python3 -m http.server 8080
```

## 📝 ファイル構成

```
AquaBit LAB HP.php/
├── server.py          # カスタム開発サーバー
├── dev.sh             # 開発環境管理スクリプト
├── ai-salon/          # AI学習サロンLP
│   ├── index.html
│   └── img/           # 画像ファイル
├── ai-service.html    # AI事業ページ
├── marine.html        # マリン事業ページ
└── index.html         # ホームページ
```

## 💡 使い方のヒント

1. **ファイル編集後**: ブラウザでF5キーで更新
2. **画像追加後**: `img/` フォルダに配置してリロード
3. **CSS変更後**: キャッシュが無効化されているので即座に反映
4. **JavaScriptデバッグ**: ブラウザの開発者ツールを使用

## 🐛 トラブルシューティング

### ポートが使用中の場合
```bash
# プロセスを確認
lsof -i :8080

# 強制終了
./dev.sh stop
```

### ブラウザが開かない場合
手動でアクセス: http://localhost:8080/ai-salon/

### 画像が表示されない場合
- パスが `img/filename.png` になっているか確認
- ファイル名の大文字小文字を確認
- 画像ファイルが存在するか確認