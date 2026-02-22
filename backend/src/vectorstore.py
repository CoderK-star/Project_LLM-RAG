import os
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from .config import Config

class VectorStoreManager:
    def __init__(self):
        self.config = Config()
        self.embeddings = self._get_embeddings()

    def _get_embeddings(self):
        if self.config.LLM_MODEL_TYPE == "openai":
            return OpenAIEmbeddings(openai_api_key=self.config.OPENAI_API_KEY)
        else:
            return OllamaEmbeddings(
                model=self.config.EMBEDDING_MODEL_NAME,
                base_url=self.config.OLLAMA_BASE_URL
            )

    def create_vectorstore(self, chunks):
        """チャンクからベクトルデータベースを作成する"""
        print("Creating vector store...")
        vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            persist_directory=self.config.CHROMA_DB_DIR
        )
        print(f"Vector store created and saved to {self.config.CHROMA_DB_DIR}")
        return vectorstore

    def load_vectorstore(self):
        """既存のベクトルデータベースを読み込む"""
        return Chroma(
            persist_directory=self.config.CHROMA_DB_DIR,
            embedding_function=self.embeddings
        )

    def has_existing_vectorstore(self):
        """既存のベクトルデータベースが存在するか確認する"""
        db_dir = self.config.CHROMA_DB_DIR
        return os.path.exists(db_dir) and any(
            f.endswith('.sqlite3') or f.endswith('.bin') or f == 'chroma.sqlite3'
            for f in os.listdir(db_dir)
        ) if os.path.exists(db_dir) else False

    def get_hybrid_retriever(self, chunks, force_reingest=False):
        """ベクトル検索とキーワード検索（BM25）を組み合わせたハイブリッドリトリーバーを返す"""
        print("Initializing hybrid retriever...")
        
        # ドキュメントが空の場合は警告を出してベクトル検索のみを返す
        if not chunks or len(chunks) == 0:
            print("WARNING: No documents found. Please add PDF/TXT files to data/raw folder.")
            print("The system will start but RAG queries may not work properly.")
            if self.has_existing_vectorstore():
                print("Loading existing vector store...")
                vectorstore = self.load_vectorstore()
            else:
                vectorstore = Chroma(
                    persist_directory=self.config.CHROMA_DB_DIR,
                    embedding_function=self.embeddings
                )
            return vectorstore.as_retriever(search_kwargs={"k": 6})
        
        # 既存のベクトルストアがあり、強制再取り込みでなければ再利用
        if self.has_existing_vectorstore() and not force_reingest:
            print("Loading existing vector store (use /ingest to rebuild)...")
            vectorstore = self.load_vectorstore()
        else:
            vectorstore = self.create_vectorstore(chunks)
        
        vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 6})
        
        bm25_retriever = BM25Retriever.from_documents(chunks)
        bm25_retriever.k = 6
        
        # アンサンブル（重み付け：ベクトル 0.6, BM25 0.4 - セマンティック検索を優先）
        ensemble_retriever = EnsembleRetriever(
            retrievers=[vector_retriever, bm25_retriever],
            weights=[0.6, 0.4]
        )
        
        return ensemble_retriever
