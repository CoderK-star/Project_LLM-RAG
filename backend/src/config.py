import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_MODEL_TYPE = os.getenv("LLM_MODEL_TYPE", "ollama")
    LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "qwen2.5:3b")
    EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "nomic-embed-text")
    DATA_RAW_DIR = os.getenv("DATA_RAW_DIR", "data/raw")
    DATA_PROCESSED_DIR = os.getenv("DATA_PROCESSED_DIR", "data/processed")
    CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "data/chroma_db")

    def to_dict(self):
        """設定を辞書として返す（APIキーは除外）"""
        return {
            "model_type": self.LLM_MODEL_TYPE,
            "model_name": self.LLM_MODEL_NAME,
            "embedding_model": self.EMBEDDING_MODEL_NAME,
            "ollama_base_url": self.OLLAMA_BASE_URL,
            "has_openai_key": bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY != "none"),
        }
