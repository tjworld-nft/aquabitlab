#!/usr/bin/env bash
# OGP画像（1200x630）を src/ogp-card.html から生成する。
#   使い方: ./tools/build-ogp.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8791
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

cd "$ROOT"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

shot() { # shot <出力ファイル> <クエリ文字列>
  "$CHROME" --headless=new --hide-scrollbars --virtual-time-budget=8000 \
    --window-size=1200,630 --screenshot="$ROOT/images/$1" \
    "http://127.0.0.1:$PORT/src/ogp-card.html?$2" >/dev/null 2>&1
  echo "  images/$1"
}

echo "OGP画像を生成中..."
shot ogp.png ""
shot ogp-marine.png "title=%E9%87%8D%E5%8A%9B%E3%81%8B%E3%82%89%E8%A7%A3%E6%94%BE%E3%81%95%E3%82%8C%E3%81%9F%E3%80%81%7C%E3%82%82%E3%81%86%E3%81%B2%E3%81%A8%E3%81%A4%E3%81%AE%E4%B8%96%E7%95%8C%E3%81%B8%E3%80%82&sub=%E3%83%9E%E3%83%AA%E3%83%B3%E4%BA%8B%E6%A5%AD%20%2F%20%E3%83%80%E3%82%A4%E3%83%93%E3%83%B3%E3%82%B0%E4%BD%93%E9%A8%93&tags=Diving,Experience,Ocean&bg=aquabit-marine.png"
shot ogp-ai.png "title=AI%E3%81%A8%E3%81%84%E3%81%86%E9%AD%94%E6%B3%95%E3%82%92%E3%80%81%7C%E3%81%82%E3%81%AA%E3%81%9F%E3%81%AE%E6%89%8B%E3%81%AE%E4%B8%AD%E3%81%AB%E3%80%82&sub=AI%E4%BA%8B%E6%A5%AD%20%2F%20%E7%94%9F%E6%88%90AI%E6%B4%BB%E7%94%A8%E3%83%BB%E5%88%B6%E4%BD%9C%E3%83%BB%E6%95%99%E8%82%B2&tags=Generative%20AI,Web,App&bg=aquabit-ai.png"

echo "完了"
