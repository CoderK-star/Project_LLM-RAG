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

    def get_hybrid_retriever(self, chunks):
        """ベクトル検索とキーワード検索（BM25）を組み合わせたハイブリッドリトリーバーを返す"""
        print("Initializing hybrid retriever...")
        
        # ドキュメントが空の場合は警告を出してベクトル検索のみを返す
        if not chunks or len(chunks) == 0:
            print("WARNING: No documents found. Please add PDF/TXT files to data/raw folder.")
            print("The system will start but RAG queries may not work properly.")
            # 空のベクトルストアを作成して返す
            vectorstore = Chroma(
                persist_directory=self.config.CHROMA_DB_DIR,
                embedding_function=self.embeddings
            )
            return vectorstore.as_retriever(search_kwargs={"k": 6})
        
        # 1. ベクトルストアを作成（または更新）
        vectorstore = self.create_vectorstore(chunks)
        # NotebookLMスキーム: より多くのコンテキストを取得してLLM側でフィルタリング・統合させる
        vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 10})
        
        # 2. キーワード検索（BM25）のリトリーバー
        bm25_retriever = BM25Retriever.from_documents(chunks)
        bm25_retriever.k = 10
        
        # 3. アンサンブル（重み付け：ベクトル 0.6, BM25 0.4 - セマンティック検索を優先）
        ensemble_retriever = EnsembleRetriever(
            retrievers=[vector_retriever, bm25_retriever],
            weights=[0.6, 0.4]
        )
        
        return ensemble_retriever
