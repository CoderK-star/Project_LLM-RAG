from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from .config import Config
import os

class RAGGenerator:
    def __init__(self, vectorstore=None, retriever=None):
        self.config = Config()
        self.vectorstore = vectorstore
        self.llm = self._get_llm()
        
        if retriever:
            self.retriever = retriever
        elif vectorstore:
            self.retriever = vectorstore.as_retriever(search_kwargs={"k": 10})
        else:
            raise ValueError("Either vectorstore or retriever must be provided.")

    def _get_llm(self, override_config=None):
        # Determine effective values
        model_type = self.config.LLM_MODEL_TYPE
        model_name = self.config.LLM_MODEL_NAME
        openai_api_key = self.config.OPENAI_API_KEY
        ollama_base_url = self.config.OLLAMA_BASE_URL
        temperature = 0.3

        if override_config:
            model_type = override_config.get("type", model_type)
            model_name = override_config.get("name", model_name)
            address = override_config.get("address", "")
            if address:
                if model_type == "openai":
                    openai_api_key = address
                else:
                    ollama_base_url = address
            try:
                temperature = float(override_config.get("temp", 0.3))
            except:
                temperature = 0.3

        if model_type == "openai":
            return ChatOpenAI(
                model_name=model_name,
                openai_api_key=openai_api_key,
                temperature=temperature
            )
        else:
            return ChatOllama(
                model=model_name,
                base_url=ollama_base_url,
                temperature=temperature,
                num_ctx=8192  # Increased context window for "Notebook" style deep reading
            )

    def _format_docs_with_metadata(self, docs):
        """ドキュメントをメタデータ付きで整形する"""
        formatted_text = ""
        for i, doc in enumerate(docs):
            source = os.path.basename(doc.metadata.get("source", "Unknown"))
            page = doc.metadata.get("page", "")
            page_info = f" (Page {page})" if page else ""
            
            formatted_text += f"---\n[Source {i+1}: {source}{page_info}]\n{doc.page_content}\n"
        return formatted_text

    def get_answer(self, query, config_override=None):
        """質問に対してNotebookLMスタイルの深い回答を生成する"""
        
        # 0. LLMの準備 (オーバーライドがあれば一時的なLLMを作成)
        current_llm = self.llm
        if config_override:
            try:
                current_llm = self._get_llm(config_override)
            except Exception as e:
                print(f"Error creating override LLM: {e}")
                # Fallbck to default
                pass

        # 1. 関連ドキュメントの検索
        source_docs = self.retriever.invoke(query)
        
        if not source_docs:
            return {
                "answer": "申し訳ありませんが、提供された資料の中に、その質問に関連する情報は見つかりませんでした。",
                "source_documents": [],
                "metadata": []
            }

        # 2. コンテキストの整形 (ソース情報を明示)
        context_text = self._format_docs_with_metadata(source_docs)

        # 3. NotebookLMスタイルのプロンプト作成
        system_template = """あなたは優秀なリサーチアシスタントです。GoogleのNotebookLMのように、提供された資料の内容を深く理解し、それらを統合して洞察に満ちた回答を作成することが求められています。

以下のガイドラインに厳密に従ってください：
1. **資料への完全な準拠**: 回答は提供された【資料】にある情報のみに基づいている必要があります。外部の知識を使ってはいけません。
2. **統合と推論**: 単に事実を並べるだけでなく、複数の資料からの情報を関連付け、"なぜそうなるのか" という背景や理由を含めて説明してください。
3. **明確な引用**: 情報を提示する際は、必ずその情報源を明記してください。例:「〜であることが報告されています (Source 1: report.pdf)」。
4. **構造化**: 複雑なトピックは、見出しや箇条書きを使って論理的に構成してください。
5. **回答不能な場合**: 資料に答えがない場合は、正直に「資料に記載がありません」と答えてください。推測で答えないでください。

あなたの目標は、ユーザーが資料全体の本質を理解できるようにサポートすることです。"""

        human_template = """以下の【資料】を使用して、ユーザーの【質問】に詳しく答えてください。

【資料】
{context}

【質問】
{question}

回答:"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_template),
            ("human", human_template),
        ])

        # 4. 回答の生成
        chain = prompt | current_llm
        response = chain.invoke({"context": context_text, "question": query})

        return {
            "answer": response.content,
            "source_documents": [doc.page_content for doc in source_docs],
            "metadata": [doc.metadata for doc in source_docs]
        }
