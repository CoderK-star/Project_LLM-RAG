#!/usr/bin/env python
"""
ごみ収集アシスタント - 起動スクリプト
==================================================
このスクリプトを実行すると、RAGシステムが起動し、
ブラウザが自動的に開きます。

使用方法:
    python start.py
    または
    ダブルクリックで実行
"""

import os
import sys
import time
import threading
import webbrowser
import subprocess
import urllib.request
import json

# プロジェクトのルートディレクトリを取得
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
VENV_PYTHON = os.path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe")

# 設定
HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}"


def check_requirements():
    """必要な環境をチェック"""
    print("=" * 50)
    print("  ごみ収集アシスタント - RAG System")
    print("=" * 50)
    print()
    
    # 仮想環境の確認
    if os.path.exists(VENV_PYTHON):
        print(f"✓ 仮想環境を検出: {VENV_PYTHON}")
        return VENV_PYTHON
    else:
        print("! 仮想環境が見つかりません。システムのPythonを使用します。")
        return sys.executable


def wait_for_rag_ready(max_wait=120):
    """サーバーとRAGコンポーネントの準備完了を待つ"""
    health_url = f"{URL}/health"
    start_time = time.time()
    
    print(f"\n⏳ サーバーとRAGコンポーネントの準備を待っています...")
    
    while time.time() - start_time < max_wait:
        try:
            req = urllib.request.Request(health_url)
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                if data.get("status") == "ready":
                    print(f"✅ RAGシステムの準備が完了しました！")
                    print(f"\n🌐 ブラウザを開いています: {URL}")
                    webbrowser.open(URL)
                    return True
                else:
                    # まだローディング中
                    time.sleep(1)
        except Exception:
            # サーバーがまだ起動していない
            time.sleep(1)
    
    # タイムアウトしてもブラウザを開く
    print(f"\n⚠ RAGシステムの初期化に時間がかかっていますが、ブラウザを開きます...")
    print(f"\n🌐 ブラウザを開いています: {URL}")
    webbrowser.open(URL)
    return False


def main():
    python_exe = check_requirements()
    
    print(f"\n🚀 サーバーを起動しています...")
    print(f"   URL: {URL}")
    print(f"   終了するには Ctrl+C を押してください")
    print("-" * 50)
    
    # RAG準備完了後にブラウザを開くスレッドを開始
    browser_thread = threading.Thread(target=wait_for_rag_ready, daemon=True)
    browser_thread.start()
    
    # 作業ディレクトリをbackendに変更
    os.chdir(BACKEND_DIR)
    
    # .envファイルをロードするためにプロジェクトルートからコピー（存在すれば）
    env_file = os.path.join(PROJECT_ROOT, ".env")
    if os.path.exists(env_file):
        # 環境変数として読み込み
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()
    
    # Uvicornでサーバーを起動
    try:
        subprocess.run([
            python_exe, "-m", "uvicorn",
            "app:app",
            "--host", HOST,
            "--port", str(PORT),
            "--reload"
        ], check=True)
    except KeyboardInterrupt:
        print("\n\n👋 サーバーを終了しました。")
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        input("Enterキーを押して終了...")


if __name__ == "__main__":
    main()
