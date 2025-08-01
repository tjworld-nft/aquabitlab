#!/usr/bin/env python3
"""
AquaBit LAB Development Server
簡単にローカル開発サーバーを起動するためのスクリプト
"""

import http.server
import socketserver
import webbrowser
import threading
import time
import os
from pathlib import Path

PORT = 8080
DIRECTORY = Path(__file__).parent

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # キャッシュを無効化して、変更がすぐに反映されるようにする
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        # ログをもっと見やすくする
        print(f"🌐 {self.address_string()} - {format % args}")

def open_browser():
    """ブラウザを自動で開く"""
    time.sleep(1)  # サーバー起動を待つ
    urls = [
        f"http://localhost:{PORT}/",
        f"http://localhost:{PORT}/ai-salon/",
        f"http://localhost:{PORT}/ai-service.html",
        f"http://localhost:{PORT}/marine.html",
    ]
    
    print(f"\n🚀 AquaBit LAB Development Server")
    print(f"📍 Root: http://localhost:{PORT}/")
    print(f"🤖 AI学習サロン: http://localhost:{PORT}/ai-salon/")
    print(f"🔧 AI事業: http://localhost:{PORT}/ai-service.html")
    print(f"🌊 マリン事業: http://localhost:{PORT}/marine.html")
    print(f"\n💡 Ctrl+C でサーバーを停止")
    print("-" * 50)
    
    # AI学習サロンを自動で開く
    webbrowser.open(f"http://localhost:{PORT}/ai-salon/")

def main():
    try:
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            print(f"🔥 Starting AquaBit LAB Development Server...")
            print(f"📂 Serving: {DIRECTORY}")
            print(f"🌐 Port: {PORT}")
            
            # ブラウザを別スレッドで開く
            browser_thread = threading.Thread(target=open_browser)
            browser_thread.daemon = True
            browser_thread.start()
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n🛑 Server stopped by user")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Trying port {PORT + 1}...")
            PORT_NEW = PORT + 1
            try:
                with socketserver.TCPServer(("", PORT_NEW), CustomHTTPRequestHandler) as httpd:
                    print(f"🔥 Starting on port {PORT_NEW} instead...")
                    webbrowser.open(f"http://localhost:{PORT_NEW}/ai-salon/")
                    httpd.serve_forever()
            except KeyboardInterrupt:
                print(f"\n🛑 Server stopped by user")
        else:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()