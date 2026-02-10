from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import sys
import os

# プロジェクトルート（backendディレクトリ）をパスに追加
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.loader import DocumentProcessor
from src.vectorstore import VectorStoreManager
from src.generator import RAGGenerator
from src.config import Config
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORSを許可（フロントエンドからのアクセス用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# フロントエンドの静的ファイル配信
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
print(f"Frontend directory: {FRONTEND_DIR}")

class QueryRequest(BaseModel):
    prompt: str
    config: dict | None = None

class SourceInfo(BaseModel):
    filename: str
    snippet: str
    page: int | None = None

class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]

# グローバル変数として保持（サーバー起動時に1回ロード）
generator = None

@app.on_event("startup")
async def startup_event():
    global generator
    try:
        config = Config()
        processor = DocumentProcessor()
        vs_manager = VectorStoreManager()
        
        # ハイブリッド検索のためにドキュメントをロードして準備
        docs = processor.load_documents(config.DATA_RAW_DIR)
        chunks = processor.split_documents(docs)
        hybrid_retriever = vs_manager.get_hybrid_retriever(chunks)
        
        generator = RAGGenerator(retriever=hybrid_retriever)
        print("✓ RAG components (Hybrid) loaded successfully.")
    except Exception as e:
        print(f"⚠ Error loading RAG components: {e}")
        print("  The server will start but queries may not work.")

@app.get("/health")
async def health_check():
    """RAGコンポーネントの準備状況を返す"""
    return {
        "status": "ready" if generator is not None else "loading",
        "rag_initialized": generator is not None
    }

@app.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    if generator is None:
        raise HTTPException(
            status_code=503, 
            detail="RAGシステムが初期化されていません。data/raw フォルダにPDFまたはTXTファイルを追加してサーバーを再起動してください。"
        )
    
    result = generator.get_answer(request.prompt, request.config)
    
    # Build detailed source information with snippets
    sources = []
    seen_snippets = set()  # Deduplicate similar sources
    for i, (content, meta) in enumerate(zip(result["source_documents"], result["metadata"])):
        snippet = content[:200].replace("\n", " ").strip() + "..." if len(content) > 200 else content.replace("\n", " ").strip()
        # Avoid duplicate snippets
        if snippet not in seen_snippets:
            seen_snippets.add(snippet)
            sources.append(SourceInfo(
                filename=meta.get("source", "Unknown").split("/")[-1].split("\\")[-1],
                snippet=snippet,
                page=meta.get("page")
            ))
    
    return QueryResponse(
        answer=result["answer"],
        sources=sources
    )

# フロントエンドのルート（APIエンドポイントより後に定義）
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/style.css")
async def serve_css():
    return FileResponse(os.path.join(FRONTEND_DIR, "style.css"), media_type="text/css")

@app.get("/web.js")
async def serve_js():
    return FileResponse(os.path.join(FRONTEND_DIR, "web.js"), media_type="application/javascript")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
