#!/bin/bash

# AquaBit LAB 開発環境セットアップスクリプト
# 使い方: ./dev.sh [start|stop|status|reload]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"

function start_server() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "🔥 サーバーは既に実行中です (PID: $(cat $PID_FILE))"
        echo "🌐 http://localhost:8080/ai-salon/"
        return 1
    fi
    
    echo "🚀 AquaBit LAB 開発サーバーを起動しています..."
    cd "$SCRIPT_DIR"
    python3 server.py &
    echo $! > "$PID_FILE"
    echo "✅ サーバーが起動しました (PID: $!)"
    echo "🌐 AI学習サロン: http://localhost:8080/ai-salon/"
    echo "🛑 停止するには: ./dev.sh stop"
}

function stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            echo "🛑 サーバーを停止しました (PID: $PID)"
        else
            echo "⚠️  プロセスが見つかりません (PID: $PID)"
        fi
        rm -f "$PID_FILE"
    else
        echo "⚠️  サーバーは実行されていません"
    fi
    
    # Pythonサーバープロセスを確実に終了
    pkill -f "python3 server.py" 2>/dev/null || true
    pkill -f "python3 -m http.server" 2>/dev/null || true
}

function server_status() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "🟢 サーバーは実行中です (PID: $(cat $PID_FILE))"
        echo "🌐 http://localhost:8080/ai-salon/"
    else
        echo "🔴 サーバーは停止しています"
        [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
    fi
}

function reload_server() {
    echo "🔄 サーバーを再起動しています..."
    stop_server
    sleep 2
    start_server
}

case "${1:-start}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    status)
        server_status
        ;;
    reload|restart)
        reload_server
        ;;
    *)
        echo "使い方: $0 [start|stop|status|reload]"
        echo ""
        echo "🚀 start   - サーバーを開始"
        echo "🛑 stop    - サーバーを停止"
        echo "📊 status  - サーバー状態を確認"
        echo "🔄 reload  - サーバーを再起動"
        exit 1
        ;;
esac