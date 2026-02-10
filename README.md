# Waste Sorting RAG System

このプロジェクトは、ごみ分別・排出ルールに関する情報を検索・回答するRAGシステムです。

## セットアップ

1. **依存関係のインストール**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **環境設定**
   - `.env.example` を `.env` にコピーし、必要事項を記入してください。
   - Ollamaを使用する場合は、Ollamaが起動しており、指定したモデル（例: `llama3`, `nomic-embed-text`）がプルされていることを確認してください。

3. **データの準備**
   - `backend/data/raw/` ディレクトリに、ごみ分別ルールのPDFまたはテキストファイルを配置してください。

4. **インジェスト（初期化）**
   ドキュメントをベクトルデータベースに取り込みます。
   ```bash
   python main.py --ingest
   ```

5. **バックエンドサーバーの起動**
   ```bash
   python app.py
   ```
   サーバーは `http://localhost:8000` で起動します。

6. **フロントエンドの表示**
   - `frontend/index.html` をブラウザで開いてください。

## ディレクトリ構造
- `backend/src/`: コアロジック（読み込み、ベクトル化、生成）
- `backend/data/raw/`: 取り込み前のドキュメント
- `backend/data/chroma_db/`: 作成されたベクトルデータベース
- `frontend/`: Web UIデモ
