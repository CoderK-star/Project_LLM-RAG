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
        """LLMインスタンスを取得する"""
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
            except (ValueError, TypeError):
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
                num_ctx=8192
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

    def _build_system_prompt(self):
        """NotebookLMスタイルのシステムプロンプトを構築する"""
        return """あなたは優秀なリサーチアシスタントです。GoogleのNotebookLMのように、提供された資料の内容を深く理解し、それらを統合して洞察に満ちた回答を作成することが求められています。

以下のガイドラインに厳密に従ってください：
1. **資料への完全な準拠**: 回答は提供された【資料】にある情報のみに基づいている必要があります。外部の知識を使ってはいけません。
2. **統合と推論**: 単に事実を並べるだけでなく、複数の資料からの情報を関連付け、"なぜそうなるのか" という背景や理由を含めて説明してください。
3. **明確な引用**: 情報を提示する際は、必ずその情報源を明記してください。例:「〜であることが報告されています (Source 1: report.pdf)」。
4. **構造化**: 複雑なトピックは、見出しや箇条書きを使って論理的に構成してください。
5. **回答不能な場合**: 資料に答えがない場合は、正直に「資料に記載がありません」と答えてください。推測で答えないでください。
6. **会話の継続性**: 会話履歴が提供されている場合は、前の会話の内容を踏まえて回答してください。

あなたの目標は、ユーザーが資料全体の本質を理解できるようにサポートすることです。"""

    def _build_messages(self, query, context_text, chat_history=None, image_data=None):
        """プロンプトメッセージを構築する"""
        messages = [SystemMessage(content=self._build_system_prompt())]

        # 会話履歴を含める
        if chat_history:
            for msg in chat_history[-10:]:  # 最新10件まで
                role = msg.get("role", "")
                text = msg.get("text", "")
                if not text:
                    continue
                if role == "user":
                    messages.append(HumanMessage(content=text))
                elif role == "system":
                    from langchain_core.messages import AIMessage
                    messages.append(AIMessage(content=text))

        human_text = f"""以下の【資料】を使用して、ユーザーの【質問】に詳しく答えてください。
もし画像が提供されている場合は、その画像の内容も考慮して回答してください。

【資料】
{context_text}

【質問】
{query}

回答:"""

        if image_data:
            content_blocks = [
                {"type": "text", "text": human_text},
                {"type": "image_url", "image_url": {"url": image_data}}
            ]
            messages.append(HumanMessage(content=content_blocks))
        else:
            messages.append(HumanMessage(content=human_text))

        return messages

    def get_answer(self, query, config_override=None, image_data=None, chat_history=None):
        """質問に対してNotebookLMスタイルの深い回答を生成する"""
        
        # LLMの準備 (オーバーライドがあれば一時的なLLMを作成)
        current_llm = self.llm
        if config_override:
            try:
                current_llm = self._get_llm(config_override)
            except Exception as e:
                print(f"Error creating override LLM, falling back to default: {e}")

        # 関連ドキュメントの検索
        source_docs = self.retriever.invoke(query)
        
        if not source_docs:
            return {
                "answer": "申し訳ありませんが、提供された資料の中に、その質問に関連する情報は見つかりませんでした。",
                "source_documents": [],
                "metadata": []
            }

        # コンテキストの整形 (ソース情報を明示)
        context_text = self._format_docs_with_metadata(source_docs)

        # メッセージの構築
        messages = self._build_messages(query, context_text, chat_history, image_data)

        # 回答の生成
        try:
            response = current_llm.invoke(messages)
            content = response.content
        except Exception as e:
            content = f"エラーが発生しました: {str(e)}"

        return {
            "answer": content,
            "source_documents": [doc.page_content for doc in source_docs],
            "metadata": [doc.metadata for doc in source_docs]
        }

    def get_answer_stream(self, query, config_override=None, image_data=None, chat_history=None):
        """ストリーミングで回答を生成するジェネレータ"""
        
        current_llm = self.llm
        if config_override:
            try:
                current_llm = self._get_llm(config_override)
            except Exception as e:
                print(f"Error creating override LLM, falling back to default: {e}")

        # 関連ドキュメントの検索
        source_docs = self.retriever.invoke(query)
        
        if not source_docs:
            yield {
                "type": "complete",
                "answer": "申し訳ありませんが、提供された資料の中に、その質問に関連する情報は見つかりませんでした。",
                "source_documents": [],
                "metadata": []
            }
            return

        context_text = self._format_docs_with_metadata(source_docs)
        messages = self._build_messages(query, context_text, chat_history, image_data)

        # ソース情報を先に送信
        yield {
            "type": "sources",
            "source_documents": [doc.page_content for doc in source_docs],
            "metadata": [doc.metadata for doc in source_docs]
        }

        # ストリーミングで回答を生成
        full_answer = ""
        try:
            for chunk in current_llm.stream(messages):
                token = chunk.content
                if token:
                    full_answer += token
                    yield {"type": "token", "token": token}
        except Exception as e:
            yield {"type": "error", "message": str(e)}
            return

        yield {"type": "done", "answer": full_answer}
