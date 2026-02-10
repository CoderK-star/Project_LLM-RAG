document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chatLog');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const sourceList = document.getElementById('sourceList');
    const newChatBtn = document.getElementById('newChat');
    const clearBtn = document.getElementById('clearChat');
    const exportBtn = document.getElementById('exportData');
    
    const goHomeBtn = document.getElementById('goHome');
    const openSettingsBtn = document.getElementById('openSettings');
    const closeSettingsBtn = document.getElementById('closeSettings');
    const mainUI = document.getElementById('mainUI');
    const settingsUI = document.getElementById('settingsUI');
    const tempRange = document.getElementById('tempRange');
    const tempValue = document.getElementById('tempValue');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const ttsEnabledSelect = document.getElementById('ttsEnabled');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const toggleThemeBtn = document.getElementById('toggleTheme');

    // Theme Logic
    const updateThemeIcon = (theme) => {
        const sunIcon = toggleThemeBtn.querySelector('.theme-sun');
        const moonIcon = toggleThemeBtn.querySelector('.theme-moon');
        if (theme === 'dark') {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
    };

    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    };

    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
        initTheme();
    }

    // History Dashboard UI elements
    const historyDashboard = document.getElementById('historyDashboard');
    const openHistoryDashboardBtn = document.getElementById('openHistoryDashboard');
    const closeDashboardBtn = document.getElementById('closeDashboard');
    const sessionGrid = document.getElementById('sessionGrid');
    const emptyState = document.getElementById('emptyState');
    const historySearchInput = document.getElementById('historySearch');
    const deleteSessionBtn = document.getElementById('deleteSession');

    const historyUI = document.getElementById('historyUI');
    const historyDetails = document.getElementById('historyDetails');
    const closeHistoryBtn = document.getElementById('closeHistory');
    const resumeChatBtn = document.getElementById('resumeChat');

    let currentChatSession = [];
    let activeSessionId = null;
    let lastUserQuery = null;  // Store for regeneration

    // Marked.js の設定
    if (window.marked) {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    // 音声解析 (Speech Recognition)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            userInput.style.height = (userInput.scrollHeight) + 'px';
            voiceInputBtn.classList.remove('recording');
        };

        recognition.onerror = () => voiceInputBtn.classList.remove('recording');
        recognition.onend = () => voiceInputBtn.classList.remove('recording');
    }

    voiceInputBtn.addEventListener('click', () => {
        if (!recognition) {
            alert("このブラウザは音声入力をサポートしていません。");
            return;
        }
        if (voiceInputBtn.classList.contains('recording')) {
            recognition.stop();
        } else {
            voiceInputBtn.classList.add('recording');
            recognition.start();
        }
    });

    // 音声合成 (TTS)
    function speakText(text) {
        if (ttsEnabledSelect.value === 'false') return;
        
        // Remove markdown and tags for cleaner speech
        const cleanText = text.replace(/[#*`_~\[\]]/g, '').slice(0, 300); 
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ja-JP';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
    }

    // パネルのリサイズ機能
    const resizer = document.getElementById('resizer');
    const leftSide = document.querySelector('.left-side');
    let isResizing = false;
    let startX, startWidth;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(leftSide).width, 10);
        
        document.body.style.cursor = 'col-resize';
        resizer.classList.add('dragging');
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        
        if (newWidth > 180 && newWidth < 500) {
            leftSide.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = 'default';
        resizer.classList.remove('dragging');
        document.body.style.userSelect = '';
    });

    // UI切替
    function showSection(sectionId) {
        // 全てのメインコンテナを隠す
        mainUI.classList.add('hidden');
        settingsUI.classList.add('hidden');
        historyDashboard.classList.add('hidden');
        historyUI.classList.add('hidden');

        // 指定されたセクションを表示
        const target = document.getElementById(sectionId);
        if (target) target.classList.remove('hidden');

        // サイドバーのactive状態を更新（オプション）
        document.querySelectorAll('.setting-btn').forEach(btn => btn.classList.remove('active'));
    }

    goHomeBtn.addEventListener('click', () => {
        showSection('mainUI');
    });

    openSettingsBtn.addEventListener('click', () => {
        showSection('settingsUI');
    });

    closeSettingsBtn.addEventListener('click', () => {
        showSection('mainUI');
    });

    // 温度のスライダー調整
    tempRange.addEventListener('input', () => {
        tempValue.textContent = tempRange.value;
    });

    // 新規チャット
    newChatBtn.addEventListener('click', () => {
        if (chatLog.children.length === 0) return;
        if (confirm('現在の対話を終了して、新規チャットを開始しますか？')) {
            saveSessionToHistory();
            chatLog.innerHTML = '';
            sourceList.innerHTML = '(Waiting for query...)';
            currentChatSession = [];
            activeSessionId = null;
            addMessage("新しいセッションを開始しました。ごみの分別や出し方について質問してください。", "system");
        }
    });

    // データエクスポート
    exportBtn.addEventListener('click', () => {
        if (currentChatSession.length === 0) {
            alert('エクスポートするデータがありません。');
            return;
        }
        const blob = new Blob([JSON.stringify(currentChatSession, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-session-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // 設定保存
    saveSettingsBtn.addEventListener('click', () => {
        const type = document.getElementById('modelType').value;
        const name = document.getElementById('modelNameInput').value.trim();
        const address = document.getElementById('apiAddress').value.trim();
        
        // バリデーション
        if (!name) {
            alert('モデル名を入力してください。');
            return;
        }
        if (!address) {
            alert('APIアドレスを入力してください。');
            return;
        }

        const config = {
            type: type,
            name: name,
            address: address,
            temp: tempRange.value,
            tts: ttsEnabledSelect.value
        };
        localStorage.setItem('rag_config', JSON.stringify(config));
        
        // 画面のステータス表示を即座に更新
        loadAndDisplaySettings();

        saveSettingsBtn.textContent = 'SYSTEM UPDATED';
        saveSettingsBtn.style.background = '#22c55e';
        setTimeout(() => {
            saveSettingsBtn.textContent = 'APPLY SYSTEM CHANGES';
            saveSettingsBtn.style.background = '';
        }, 2000);
    });

    // 設定の読み込みと表示更新
    function loadAndDisplaySettings() {
        const savedConfig = localStorage.getItem('rag_config');
        const statusModelName = document.getElementById('statusModelName');
        const statusEngineMode = document.getElementById('statusEngineMode');

        if (savedConfig) {
            const c = JSON.parse(savedConfig);
            // フォームへの反映
            document.getElementById('modelType').value = c.type || 'ollama';
            document.getElementById('modelNameInput').value = c.name || '';
            document.getElementById('apiAddress').value = c.address || '';
            tempRange.value = c.temp || 0.0;
            tempValue.textContent = tempRange.value;
            if (c.tts) ttsEnabledSelect.value = c.tts;

            // ステータス表示の更新
            if (statusModelName) statusModelName.textContent = c.name || 'Not Configured';
            if (statusEngineMode) {
                const modeLabel = c.type === 'openai' ? 'OpenAI API' : 'Local (Ollama)';
                statusEngineMode.textContent = `${modeLabel}`;
            }
        } else {
             // デフォルト設定
             if (statusModelName) statusModelName.textContent = 'Not Configured';
             if (statusEngineMode) statusEngineMode.textContent = 'Unknown';
        }
    }

    // 初期ロード実行
    loadAndDisplaySettings();

    function addMessage(text, role, isRestoration = false, showRegenerate = false) {
        if (!isRestoration) {
            currentChatSession.push({ role, text, timestamp: new Date().toLocaleTimeString() });
            // Debounced save
            if (currentChatSession.length > 1) saveSessionToHistory();
        }

        const msg = document.createElement('div');
        msg.className = `msg ${role}`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const label = role === 'user' ? 'ユーザ' : 'GCA system';
        
        // Markdown rendering using Marked.js
        let formattedContent = text;
        if (window.marked && role !== 'user') {
            formattedContent = marked.parse(text);
        } else {
            // User messages or fallback
            formattedContent = text.replace(/\n/g, '<br>');
        }

        // Check if response is too short (likely incomplete)
        const isShortResponse = role === 'system' && text.length < 100 && !text.includes('ERROR') && !text.includes('起動');
        
        let regenerateBtn = '';
        if ((showRegenerate || isShortResponse) && role === 'system' && !text.includes('起動') && !text.includes('新しいセッション')) {
            regenerateBtn = `
                <div class="response-actions">
                    ${isShortResponse ? '<span class="short-response-warning">⚠ 回答が短い可能性があります</span>' : ''}
                    <button class="restore-btn">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;">
                            <path d="M9 14L4 9l5-5"/>
                            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
                        </svg>
                        Restore
                    </button>
                </div>
            `;
        }

        msg.innerHTML = `
            <div class="msg-info">${label} // ${timestamp}</div>
            <div class="content">${formattedContent}</div>
            ${regenerateBtn}
        `;
        
        // Add restore handler
        const restoreBtn = msg.querySelector('.restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                if (currentChatSession.length > 0) {
                    msg.remove(); // Remove system msg
                    currentChatSession.pop(); // Remove system msg from history
                    
                    // Remove preceding user message
                    const userMsg = chatLog.lastElementChild;
                    if (userMsg && userMsg.classList.contains('user')) {
                        userMsg.remove();
                        currentChatSession.pop(); // Remove user msg from history
                        if (lastUserQuery) {
                            userInput.value = lastUserQuery;
                        }
                    }
                }
            });
        }
        
        chatLog.appendChild(msg);
        chatLog.scrollTop = chatLog.scrollHeight;

        if (role === 'system') {
            speakText(text);
        }
    }

    function updateSources(sources) {
        if (!sources || sources.length === 0) {
            sourceList.innerHTML = '<div class="source-empty">参照元なし</div>';
            return;
        }
        sourceList.innerHTML = sources.map((s, i) => {
            const filename = typeof s === 'string' ? s : s.filename;
            const snippet = typeof s === 'object' && s.snippet ? s.snippet : '';
            const page = typeof s === 'object' && s.page !== null ? ` (p.${s.page + 1})` : '';
            return `
            <div class="source-card">
                <div class="source-card-title">
                    [${i+1}] ${filename}${page}
                </div>
                ${snippet ? `<div class="source-card-snippet">${snippet}</div>` : ''}
            </div>
        `}).join('');
    }

    // Separate function to add message with regenerate button (for query responses)
    function addMessageWithRegenerate(text, query) {
        currentChatSession.push({ role: 'system', text, timestamp: new Date().toLocaleTimeString() });
        if (currentChatSession.length > 1) saveSessionToHistory();

        const msg = document.createElement('div');
        msg.className = 'msg system';
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let formattedContent = text;
        if (window.marked) {
            formattedContent = marked.parse(text);
        }

        const isShort = text.length < 100;

        msg.innerHTML = `
            <div class="msg-info">GCA system // ${timestamp}</div>
            <div class="content">${formattedContent}</div>
            <div class="response-actions">
                ${isShort ? '<span class="short-response-warning">⚠ 回答が短い可能性があります</span>' : ''}
                <button class="restore-btn">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;">
                        <path d="M9 14L4 9l5-5"/>
                        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
                    </svg>
                    Restore to last checkpoint
                </button>
            </div>
        `;
        
        const restoreBtn = msg.querySelector('.restore-btn');
        restoreBtn.addEventListener('click', () => {
            msg.remove();
            currentChatSession.pop(); // Remove system msg

            // User message is previous sibling of the system message
            // Since we just removed 'msg', we need to check the *now* last element?
            // No, getting 'previousElementSibling' before removing, or...
            // Actually, if we just removed msg, then chatLog.lastElementChild IS the user message (assuming it was the last pair)
            
            const userMsg = chatLog.lastElementChild;
            if (userMsg && userMsg.classList.contains('user')) {
                userMsg.remove();
                currentChatSession.pop(); // Remove user msg
                userInput.value = query;
                userInput.style.height = 'auto';
                userInput.style.height = (userInput.scrollHeight) + 'px';
            }
        });
        
        chatLog.appendChild(msg);
        chatLog.scrollTop = chatLog.scrollHeight;
        speakText(text);
    }

    async function handleSend(queryText = null, isRegeneration = false) {
        const text = queryText || userInput.value.trim();
        if (!text) return; // バリデーション: 空送信を防止

        // Store for potential regeneration
        lastUserQuery = text;

        // UIの状態を「処理中」にロック
        userInput.disabled = true;
        sendBtn.disabled = true;
        voiceInputBtn.disabled = true;

        if (!isRegeneration) {
            addMessage(text, 'user');
            userInput.value = '';
            userInput.style.height = '40px';
        }
        
        // Thinking state UI
        const thinkingId = 'thinking-' + Date.now();
        const thinkingMsg = document.createElement('div');
        thinkingMsg.className = 'msg system';
        thinkingMsg.id = thinkingId;
        thinkingMsg.innerHTML = `
            <div class="msg-info"> // Processing...</div>
            <div class="loading-dots">${isRegeneration ? '再生成中...' : 'ANALYZING KNOWLEDGE BASE...'}</div>
        `;
        chatLog.appendChild(thinkingMsg);
        chatLog.scrollTop = chatLog.scrollHeight;

        try {
            const config = JSON.parse(localStorage.getItem('rag_config') || '{}');
            // 同一オリジンの場合は相対パスを使用（CORS問題を回避）
            const apiBase = config.address ? config.address.replace(/\/$/, "") : "";
            
            // タイムアウト処理 (120秒 - ローカルLLM対応)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            // リクエストボディに設定を含める
            const requestBody = {
                prompt: text,
                config: {
                    type: config.type,
                    name: config.name,
                    address: config.address,
                    temp: config.temp
                }
            };

            const response = await fetch(`${apiBase}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            chatLog.removeChild(thinkingMsg);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP Error ${response.status}`);
            }

            const data = await response.json();
            if (!data.answer) throw new Error("不正なレスポンス形式です。");

            // Always show regenerate button for query responses
            addMessageWithRegenerate(data.answer, lastUserQuery);
            updateSources(data.sources);
        } catch (error) {
            console.error('Fetch Error:', error);
            if (thinkingMsg.parentNode) chatLog.removeChild(thinkingMsg);

            let errorMsg = "SYSTEM ERROR: ";
            if (error.name === 'AbortError') {
                errorMsg += "タイムアウトが発生しました。バックエンドの処理が遅延しています。";
            } else if (error.message.includes("Failed to fetch")) {
                errorMsg += "サーバーに接続できません。バックエンドが起動しているか確認してください。";
            } else {
                errorMsg += `予期せぬエラーが発生しました (${error.message})`;
            }
            addMessage(errorMsg, "system");
        } finally {
            // UIのロック解除
            userInput.disabled = false;
            sendBtn.disabled = false;
            voiceInputBtn.disabled = false;
            userInput.focus();
        }
    }

    sendBtn.addEventListener('click', handleSend);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // 入力に合わせて高さを自動調整
    userInput.addEventListener('input', () => {
        userInput.style.height = '40px';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // 初期化メッセージ
    addMessage("システムを起動しました。ごみの分別や出し方について質問してください。", "system");

    // --- History Management ---

    function saveSessionToHistory() {
        if (currentChatSession.length <= 1) return; 

        const sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
        const sessionTitle = currentChatSession.find(m => m.role === 'user')?.text.slice(0, 30) || 'New Chat';
        
        const sessionData = {
            id: activeSessionId || Date.now().toString(),
            title: sessionTitle,
            timestamp: new Date().toLocaleString(),
            messages: currentChatSession
        };

        const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
        if (existingIndex > -1) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }

        localStorage.setItem('chat_history', JSON.stringify(sessions));
    }

    // セッション削除機能
    function deleteSession(sessionId) {
        if (!confirm('このセッションを削除しますか？')) return;
        
        let sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem('chat_history', JSON.stringify(sessions));
        
        // 現在表示中のセッションが削除された場合
        if (activeSessionId === sessionId) {
            activeSessionId = null;
            currentChatSession = [];
        }
        
        // ダッシュボードを再描画
        renderHistoryDashboard(historySearchInput.value);
    }

    function renderHistoryDashboard(filterTerm = '') {
        const sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
        const filtered = sessions.filter(s => 
            s.title.toLowerCase().includes(filterTerm.toLowerCase()) || 
            s.messages.some(m => m.text.toLowerCase().includes(filterTerm.toLowerCase()))
        );

        if (filtered.length === 0) {
            sessionGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        sessionGrid.style.display = 'grid';
        sessionGrid.innerHTML = '';

        filtered.forEach(session => {
            const card = document.createElement('div');
            card.className = 'session-card';
            
            const lastMsg = session.messages[session.messages.length - 1]?.text || '';
            
            card.innerHTML = `
                <button class="session-delete-btn" title="このセッションを削除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <div class="session-card-title">${session.title}</div>
                <div class="session-card-meta">
                    <span>${session.timestamp}</span>
                    <span>${session.messages.length} messages</span>
                </div>
                <div class="session-card-preview">${lastMsg}</div>
            `;

            // 削除ボタンのイベント
            const deleteBtn = card.querySelector('.session-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // カードのクリックイベントを防止
                deleteSession(session.id);
            });

            card.addEventListener('click', () => showHistoryDetail(session));
            sessionGrid.appendChild(card);
        });
    }

    historySearchInput.addEventListener('input', (e) => {
        renderHistoryDashboard(e.target.value);
    });

    openHistoryDashboardBtn.addEventListener('click', () => {
        showSection('historyDashboard');
        renderHistoryDashboard();
    });

    closeDashboardBtn.addEventListener('click', () => {
        showSection('mainUI');
    });

    let viewingSession = null;
    function showHistoryDetail(session) {
        viewingSession = session;
        historyDetails.innerHTML = '';
        
        session.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `msg ${msg.role}`;
            const label = msg.role === 'user' ? 'ユーザ' : 'GCA system';
            
            let formattedContent = msg.text;
            if (window.marked && msg.role !== 'user') {
                formattedContent = marked.parse(msg.text);
            } else {
                formattedContent = msg.text.replace(/\n/g, '<br>');
            }

            div.innerHTML = `
                <div class="msg-info">${label} // ${new Date().toLocaleTimeString()}</div>
                <div class="content">${formattedContent}</div>
            `;
            historyDetails.appendChild(div);
        });

        historyUI.classList.remove('hidden');
    }

    closeHistoryBtn.addEventListener('click', () => {
        historyUI.classList.add('hidden');
    });

    deleteSessionBtn.addEventListener('click', () => {
        if (!viewingSession) return;
        if (confirm('このセッションを完全に削除しますか？')) {
            let sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
            sessions = sessions.filter(s => s.id !== viewingSession.id);
            localStorage.setItem('chat_history', JSON.stringify(sessions));
            
            historyUI.classList.add('hidden');
            renderHistoryDashboard();
        }
    });

    resumeChatBtn.addEventListener('click', () => {
        if (!viewingSession) return;
        
        if (confirm('この会話を現在のチャットに復元しますか？')) {
            chatLog.innerHTML = '';
            currentChatSession = [...viewingSession.messages];
            activeSessionId = viewingSession.id;
            
            currentChatSession.forEach(msg => {
                // Temporary disable speech for restoration
                const oldTts = ttsEnabledSelect.value;
                ttsEnabledSelect.value = 'false';
                addMessage(msg.text, msg.role, true); 
                ttsEnabledSelect.value = oldTts;
            });

            showSection('mainUI');
        }
    });

    // --- End History Management ---
});
