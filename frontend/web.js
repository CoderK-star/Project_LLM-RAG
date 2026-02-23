document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatLog = document.getElementById('chatLog');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const sourceList = document.getElementById('sourceList');
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
    const connectionStatus = document.getElementById('connectionStatus');
    const footerStatus = document.getElementById('footerStatus');

    // History Sidebar UI elements
    const historySidebar = document.getElementById('historySidebar');
    const toggleHistorySidebarBtn = document.getElementById('toggleHistorySidebar');
    const historySessionList = document.getElementById('historySessionList');
    const historySidebarSearch = document.getElementById('historySidebarSearch');
    const historySidebarNewChat = document.getElementById('historySidebarNewChat');
    const historySidebarOverlay = document.getElementById('historySidebarOverlay');

    // --- State ---
    let currentChatSession = [];
    let activeSessionId = null;
    let lastUserQuery = null;
    let currentImageBase64 = null;
    let isStreaming = false;

    // Per-message source storage: maps message DOM elements to their source arrays
    const messageSourcesMap = new WeakMap();

    // --- Sanitization helper ---
    function sanitize(html) {
        if (window.DOMPurify) {
            return DOMPurify.sanitize(html, { ADD_TAGS: ['img'], ADD_ATTR: ['src', 'style', 'alt'] });
        }
        return html;
    }

    // --- Theme Logic ---
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

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }

    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', toggleTheme);
        initTheme();
    }

    // --- Mobile Navigation ---
    const mobileHome = document.getElementById('mobileHome');
    const mobileNewChat = document.getElementById('mobileNewChat');
    const mobileHistory = document.getElementById('mobileHistory');
    const mobileSettings = document.getElementById('mobileSettings');
    const mobileTheme = document.getElementById('mobileTheme');

    if (mobileHome) mobileHome.addEventListener('click', () => { closeHistorySidebar(); showSection('mainUI'); });
    if (mobileNewChat) mobileNewChat.addEventListener('click', () => {
        if (chatLog.children.length === 0) return;
        if (confirm('現在の対話を終了して、新規チャットを開始しますか？')) {
            startNewChat();
        }
    });
    if (mobileHistory) mobileHistory.addEventListener('click', () => toggleHistorySidebar());
    if (mobileSettings) mobileSettings.addEventListener('click', () => openSettingsBtn.click());
    if (mobileTheme) mobileTheme.addEventListener('click', toggleTheme);

    // --- Image Feature ---
    const imageBtn = document.getElementById('imageBtn');
    const imageInput = document.getElementById('imageInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const previewImg = document.getElementById('previewImg');
    const removeImageBtn = document.getElementById('removeImage');

    imageBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentImageBase64 = e.target.result;
                previewImg.src = currentImageBase64;
                imagePreviewContainer.classList.remove('hidden');
                imageBtn.classList.add('active');
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        currentImageBase64 = null;
        imageInput.value = "";
        imagePreviewContainer.classList.add('hidden');
        imageBtn.classList.remove('active');
    });

    // --- Marked.js Configuration ---
    if (window.marked) {
        marked.setOptions({ breaks: false, gfm: true });
    }

    // --- Speech Recognition ---
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

    // --- TTS ---
    function speakText(text) {
        if (ttsEnabledSelect.value === 'false') return;
        const cleanText = text.replace(/[#*`_~\[\]]/g, '').slice(0, 300); 
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ja-JP';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
    }

    // --- Panel Resize ---
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

    // --- UI Section Switching ---
    function showSection(sectionId) {
        mainUI.classList.add('hidden');
        settingsUI.classList.add('hidden');

        const target = document.getElementById(sectionId);
        if (target) target.classList.remove('hidden');

        document.querySelectorAll('.setting-btn').forEach(btn => btn.classList.remove('active'));
    }

    goHomeBtn.addEventListener('click', () => showSection('mainUI'));
    openSettingsBtn.addEventListener('click', () => showSection('settingsUI'));
    closeSettingsBtn.addEventListener('click', () => showSection('mainUI'));

    // --- Temperature Slider ---
    tempRange.addEventListener('input', () => {
        tempValue.textContent = tempRange.value;
    });

    // --- New Chat ---
    function startNewChat() {
        saveSessionToHistory();
        chatLog.innerHTML = '';
        loadFileList();
        currentChatSession = [];
        activeSessionId = null;
        addMessage("新しいセッションを開始しました。ごみの分別や出し方について質問してください。", "system");
        renderHistorySidebar();
        showSection('mainUI');
    }



    // --- Export ---
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

    // --- Settings ---
    saveSettingsBtn.addEventListener('click', () => {
        const type = document.getElementById('modelType').value;
        const name = document.getElementById('modelNameInput').value.trim();
        const address = document.getElementById('apiAddress').value.trim();
        const apiBase = document.getElementById('apiBaseUrl').value.trim();
        
        if (!name) { alert('モデル名を入力してください。'); return; }

        if (apiBase) {
            localStorage.setItem('api_base_url', apiBase.replace(/\/$/, ""));
        } else {
            localStorage.removeItem('api_base_url');
        }

        const config = {
            type: type,
            name: name,
            address: address,
            temp: tempRange.value,
            tts: ttsEnabledSelect.value
        };
        localStorage.setItem('rag_config', JSON.stringify(config));
        loadAndDisplaySettings();

        saveSettingsBtn.textContent = '設定を更新しました';
        saveSettingsBtn.style.background = '#22c55e';
        setTimeout(() => {
            saveSettingsBtn.textContent = '設定を適用';
            saveSettingsBtn.style.background = '';
        }, 2000);
    });

    // --- Settings Presets ---
    const savePresetBtn = document.getElementById('savePreset');
    const presetNameInput = document.getElementById('presetName');
    const presetListEl = document.getElementById('presetList');

    function getPresets() {
        return JSON.parse(localStorage.getItem('rag_presets') || '[]');
    }

    function savePresets(presets) {
        localStorage.setItem('rag_presets', JSON.stringify(presets));
    }

    function getCurrentSettingsSnapshot() {
        return {
            apiBase: document.getElementById('apiBaseUrl').value.trim(),
            type: document.getElementById('modelType').value,
            name: document.getElementById('modelNameInput').value.trim(),
            address: document.getElementById('apiAddress').value.trim(),
            temp: tempRange.value,
            tts: ttsEnabledSelect.value
        };
    }

    function applyPreset(preset) {
        document.getElementById('apiBaseUrl').value = preset.apiBase || '';
        document.getElementById('modelType').value = preset.type || 'ollama';
        document.getElementById('modelNameInput').value = preset.name || '';
        document.getElementById('apiAddress').value = preset.address || '';
        tempRange.value = preset.temp || 0.0;
        tempValue.textContent = tempRange.value;
        if (preset.tts) ttsEnabledSelect.value = preset.tts;

        // Trigger a save so it takes effect immediately
        saveSettingsBtn.click();
    }

    function renderPresets() {
        const presets = getPresets();
        if (presets.length === 0) {
            presetListEl.innerHTML = '<div class="preset-empty">保存されたプリセットはありません</div>';
            return;
        }
        presetListEl.innerHTML = presets.map((p, i) => {
            const modeLabel = p.type === 'openai' ? 'OpenAI' : 'Ollama';
            return `
            <div class="preset-card" data-index="${i}">
                <div class="preset-card-info">
                    <div class="preset-card-name">${sanitize(p.label)}</div>
                    <div class="preset-card-detail">${modeLabel} / ${sanitize(p.name || '未設定')}</div>
                </div>
                <div class="preset-card-actions">
                    <button class="preset-load-btn" data-index="${i}" title="このプリセットを適用">適用</button>
                    <button class="preset-delete-btn" data-index="${i}" title="削除">&times;</button>
                </div>
            </div>`;
        }).join('');

        presetListEl.querySelectorAll('.preset-load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                const presets = getPresets();
                if (presets[idx]) applyPreset(presets[idx]);
            });
        });

        presetListEl.querySelectorAll('.preset-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                const presets = getPresets();
                presets.splice(idx, 1);
                savePresets(presets);
                renderPresets();
            });
        });
    }

    savePresetBtn.addEventListener('click', () => {
        const label = presetNameInput.value.trim();
        if (!label) { alert('プリセット名を入力してください。'); return; }

        const snapshot = getCurrentSettingsSnapshot();
        snapshot.label = label;

        const presets = getPresets();
        const existing = presets.findIndex(p => p.label === label);
        if (existing > -1) {
            presets[existing] = snapshot;
        } else {
            presets.push(snapshot);
        }
        savePresets(presets);
        presetNameInput.value = '';
        renderPresets();

        savePresetBtn.textContent = 'セーブしました';
        savePresetBtn.style.background = '#22c55e';
        setTimeout(() => {
            savePresetBtn.textContent = '設定をセーブ';
            savePresetBtn.style.background = '';
        }, 2000);
    });

    renderPresets();

    // --- Load settings from backend /config + localStorage ---
    async function loadAndDisplaySettings() {
        const statusModelName = document.getElementById('statusModelName');
        const statusEngineMode = document.getElementById('statusEngineMode');

        // バックエンドURL欄を復元
        const apiBaseInput = document.getElementById('apiBaseUrl');
        if (apiBaseInput) {
            apiBaseInput.value = localStorage.getItem('api_base_url') || '';
        }

        // まずlocalStorageのオーバーライドをチェック
        const savedConfig = localStorage.getItem('rag_config');
        if (savedConfig) {
            const c = JSON.parse(savedConfig);
            document.getElementById('modelType').value = c.type || 'ollama';
            document.getElementById('modelNameInput').value = c.name || '';
            document.getElementById('apiAddress').value = c.address || '';
            tempRange.value = c.temp || 0.0;
            tempValue.textContent = tempRange.value;
            if (c.tts) ttsEnabledSelect.value = c.tts;

            if (statusModelName) statusModelName.textContent = c.name || '未設定';
            if (statusEngineMode) {
                const modeLabel = c.type === 'openai' ? 'OpenAI API' : 'ローカル (Ollama)';
                statusEngineMode.textContent = modeLabel;
            }
            return;
        }

        // localStorageに設定がなければバックエンドから取得
        try {
            const apiBase = getApiBase();
            const response = await fetch(`${apiBase}/config`);
            if (response.ok) {
                const serverConfig = await response.json();
                document.getElementById('modelType').value = serverConfig.model_type || 'ollama';
                document.getElementById('modelNameInput').value = serverConfig.model_name || '';
                // APIキーは返さないのでaddressは空
                document.getElementById('apiAddress').value = serverConfig.ollama_base_url || '';

                if (statusModelName) statusModelName.textContent = serverConfig.model_name || '未設定';
                if (statusEngineMode) {
                    const modeLabel = serverConfig.model_type === 'openai' ? 'OpenAI API' : 'ローカル (Ollama)';
                    statusEngineMode.textContent = modeLabel;
                }

                if (connectionStatus) connectionStatus.textContent = '接続: 確立済み // システム準備完了';
                if (footerStatus) footerStatus.textContent = `モデル: ${serverConfig.model_name}`;
            }
        } catch (e) {
            console.warn('Could not fetch server config:', e);
            if (statusModelName) statusModelName.textContent = '未設定';
            if (statusEngineMode) statusEngineMode.textContent = '不明';
            if (connectionStatus) connectionStatus.textContent = '接続: サーバーに接続できません';
        }
    }

    function getApiBase() {
        const saved = localStorage.getItem('api_base_url');
        if (saved) return saved.replace(/\/$/, "");
        // __API_BASE__ is replaced at build time for cloud deployment;
        // when served from the same origin (local dev), it stays empty.
        const buildTime = "__API_BASE__";
        if (buildTime && !buildTime.startsWith("__")) return buildTime.replace(/\/$/, "");
        return "";
    }

    // 初期ロード
    loadAndDisplaySettings();

    // --- Health check ---
    async function checkHealth() {
        try {
            const apiBase = getApiBase();
            const res = await fetch(`${apiBase}/health`);
            if (res.ok) {
                const data = await res.json();
                if (connectionStatus) {
                    connectionStatus.textContent = data.status === 'ready' 
                        ? '接続: 確立済み // システム準備完了' 
                        : '接続: 確立済み // 初期化中...';
                }
            }
        } catch {
            if (connectionStatus) connectionStatus.textContent = '接続: サーバーに接続できません';
        }
    }
    checkHealth();
    loadFileList();

    // --- Message rendering ---

    function renderMarkdown(text) {
        let cleaned = text.trim().replace(/\n{3,}/g, '\n\n');
        if (window.marked) {
            return sanitize(marked.parse(cleaned));
        }
        return sanitize(cleaned.replace(/\n/g, '<br>'));
    }

    function addMessage(text, role, isRestoration = false) {
        if (!isRestoration) {
            currentChatSession.push({ role, text, timestamp: new Date().toLocaleTimeString() });
            if (currentChatSession.length > 1) saveSessionToHistory();
        }

        const msg = document.createElement('div');
        msg.className = `msg ${role}`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const label = role === 'user' ? 'ユーザ' : 'GCA system';
        
        let formattedContent;
        if (role !== 'user') {
            formattedContent = renderMarkdown(text);
        } else {
            formattedContent = sanitize(text.replace(/\n/g, '<br>'));
        }

        msg.innerHTML = `
            <div class="msg-info">${sanitize(label)} // ${timestamp}</div>
            <div class="content">${formattedContent}</div>
        `;
        
        chatLog.appendChild(msg);
        chatLog.scrollTop = chatLog.scrollHeight;

        if (role === 'system' && !isRestoration) {
            speakText(text);
        }
    }

    function createStreamingMessage() {
        const msg = document.createElement('div');
        msg.className = 'msg system';
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        msg.innerHTML = `
            <div class="msg-info">GCA system // ${timestamp}</div>
            <div class="content"><span class="loading-dots">回答を生成中...</span></div>
        `;
        
        chatLog.appendChild(msg);
        chatLog.scrollTop = chatLog.scrollHeight;
        return msg;
    }

    function updateStreamingMessage(msgElement, fullText) {
        const contentDiv = msgElement.querySelector('.content');
        contentDiv.innerHTML = renderMarkdown(fullText);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function finalizeStreamingMessage(msgElement, fullText) {
        const contentDiv = msgElement.querySelector('.content');
        contentDiv.innerHTML = renderMarkdown(fullText);

        // 復元ボタンとソースボタンを追加
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'response-actions';

        const isShort = fullText.length < 100;
        const sources = messageSourcesMap.get(msgElement) || [];
        const hasSources = sources.length > 0;

        actionsDiv.innerHTML = `
            ${hasSources ? '<button class="source-dots-btn" title="ソースを表示">&#x22EF;</button>' : ''}
            ${isShort ? '<span class="short-response-warning">&#x26A0; 回答が短い可能性があります</span>' : ''}
            <button class="restore-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;">
                    <path d="M9 14L4 9l5-5"/>
                    <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
                </svg>
                元に戻す
            </button>
        `;

        msgElement.parentNode.insertBefore(actionsDiv, msgElement.nextSibling);

        // Source dots button handler
        const sourceDotsBtn = actionsDiv.querySelector('.source-dots-btn');
        if (sourceDotsBtn) {
            sourceDotsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSourcePopup(sourceDotsBtn, sources);
            });
        }

        const restoreBtn = actionsDiv.querySelector('.restore-btn');
        restoreBtn.addEventListener('click', () => {
            actionsDiv.remove();
            msgElement.remove();
            currentChatSession.pop(); // system msg

            const userMsg = chatLog.lastElementChild;
            if (userMsg && userMsg.classList.contains('user')) {
                userMsg.remove();
                currentChatSession.pop(); // user msg
                if (lastUserQuery) {
                    userInput.value = lastUserQuery;
                    userInput.style.height = 'auto';
                    userInput.style.height = (userInput.scrollHeight) + 'px';
                }
            }
        });

        // セッション保存
        currentChatSession.push({ role: 'system', text: fullText, timestamp: new Date().toLocaleTimeString() });
        if (currentChatSession.length > 1) saveSessionToHistory();
        
        chatLog.scrollTop = chatLog.scrollHeight;
        speakText(fullText);
    }

    // --- Source Popup & File List ---

    function toggleSourcePopup(anchorBtn, sources) {
        // Close any existing popup first
        const existingPopup = document.querySelector('.source-popup');
        if (existingPopup) {
            if (existingPopup._anchorBtn === anchorBtn) {
                existingPopup.remove();
                return;
            }
            existingPopup.remove();
        }

        const apiBase = getApiBase();
        const popup = document.createElement('div');
        popup.className = 'source-popup';
        popup._anchorBtn = anchorBtn;

        let html = '<div class="source-popup-header">ソース一覧</div>';
        html += '<div class="source-popup-list">';
        sources.forEach((s, i) => {
            const filename = typeof s === 'string' ? s : s.filename;
            const page = (typeof s === 'object' && s.page !== null && s.page !== undefined) ? s.page + 1 : null;
            const pageFragment = page ? `#page=${page}` : '';
            const pageLabel = page ? ` (p.${page})` : '';
            const fileUrl = `${apiBase}/files/${encodeURIComponent(filename)}${pageFragment}`;
            html += `
                <a class="source-popup-item" href="${sanitize(fileUrl)}" target="_blank" rel="noopener noreferrer">
                    <span class="source-popup-icon">&#x1F4C4;</span>
                    <span class="source-popup-filename">[${i + 1}] ${sanitize(filename)}${pageLabel}</span>
                </a>
            `;
        });
        html += '</div>';
        popup.innerHTML = html;

        document.body.appendChild(popup);

        const btnRect = anchorBtn.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();

        let top = btnRect.top - popupRect.height - 8;
        let left = btnRect.left + btnRect.width / 2 - popupRect.width / 2;

        if (top < 8) {
            top = btnRect.bottom + 8;
        }
        if (left < 8) left = 8;
        if (left + popupRect.width > window.innerWidth - 8) {
            left = window.innerWidth - popupRect.width - 8;
        }

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
    }

    // Close source popup on click outside
    document.addEventListener('click', (e) => {
        const popup = document.querySelector('.source-popup');
        if (popup && !popup.contains(e.target) && !e.target.closest('.source-dots-btn')) {
            popup.remove();
        }
    });

    // Close source popup on chat scroll
    chatLog.addEventListener('scroll', () => {
        const popup = document.querySelector('.source-popup');
        if (popup) popup.remove();
    });

    async function loadFileList() {
        const apiBase = getApiBase();
        try {
            const response = await fetch(`${apiBase}/files`);
            if (!response.ok) throw new Error('Failed to fetch files');
            const data = await response.json();
            const files = data.files || [];

            if (files.length === 0) {
                sourceList.innerHTML = '<div class="source-empty">PDFファイルなし</div>';
                return;
            }

            sourceList.innerHTML = files.map(filename => {
                const fileUrl = `${apiBase}/files/${encodeURIComponent(filename)}`;
                return `
                    <a class="source-file-link" href="${sanitize(fileUrl)}" target="_blank" rel="noopener noreferrer">
                        <span class="source-file-icon">&#x1F4C4;</span>
                        <span class="source-file-name">${sanitize(filename)}</span>
                    </a>
                `;
            }).join('');
        } catch (e) {
            console.warn('Could not load file list:', e);
            sourceList.innerHTML = '<div class="source-empty">ファイル一覧を取得できません</div>';
        }
    }

    // --- Send / Streaming Handler ---

    async function handleSend(queryText = null) {
        const text = queryText || userInput.value.trim();
        if (!text && !currentImageBase64) return;
        if (isStreaming) return;

        lastUserQuery = text;
        
        const requestImage = currentImageBase64;

        // UIロック
        isStreaming = true;
        userInput.disabled = true;
        sendBtn.disabled = true;
        voiceInputBtn.disabled = true;
        imageBtn.disabled = true;

        // ユーザーメッセージ表示
        const displayContent = requestImage 
            ? `${text}\n<br><img src="${requestImage}" style="max-width: 200px; border-radius: 4px; margin-top: 5px;">` 
            : text;
        addMessage(displayContent, 'user');
        userInput.value = '';
        userInput.style.height = '40px';

        // 画像UIリセット
        currentImageBase64 = null;
        imageInput.value = "";
        imagePreviewContainer.classList.add('hidden');
        imageBtn.classList.remove('active');
        
        // ストリーミングメッセージ作成
        const streamMsg = createStreamingMessage();

        try {
            const config = JSON.parse(localStorage.getItem('rag_config') || '{}');
            const apiBase = getApiBase();
            
            // 会話履歴を送信（最新10件、システムメッセージを除いた軽量版）
            const history = currentChatSession.slice(-10).map(m => ({
                role: m.role,
                text: m.text.slice(0, 500) // テキストは500文字に制限
            }));

            const requestBody = {
                prompt: text,
                config: {
                    type: config.type,
                    name: config.name,
                    address: config.address,
                    temp: config.temp
                },
                location: null,
                image: requestImage,
                history: history
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分タイムアウト

            const response = await fetch(`${apiBase}/query/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP Error ${response.status}`);
            }

            // SSEストリーム読み取り
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullAnswer = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 未完成の行を保持

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const chunk = JSON.parse(jsonStr);
                        
                        if (chunk.type === 'sources') {
                            messageSourcesMap.set(streamMsg, chunk.sources);
                        } else if (chunk.type === 'token') {
                            fullAnswer += chunk.token;
                            updateStreamingMessage(streamMsg, fullAnswer);
                        } else if (chunk.type === 'done') {
                            finalizeStreamingMessage(streamMsg, chunk.answer || fullAnswer);
                        } else if (chunk.type === 'complete') {
                            // ドキュメントが見つからない場合
                            messageSourcesMap.set(streamMsg, chunk.sources || []);
                            finalizeStreamingMessage(streamMsg, chunk.answer);
                        } else if (chunk.type === 'error') {
                            throw new Error(chunk.message);
                        }
                    } catch (parseError) {
                        if (parseError.message && !parseError.message.includes('JSON')) {
                            throw parseError;
                        }
                    }
                }
            }

            // ストリーム正常完了後、まだfinalizeされてない場合
            if (fullAnswer && !streamMsg.nextElementSibling?.classList?.contains('response-actions')) {
                finalizeStreamingMessage(streamMsg, fullAnswer);
            }

        } catch (error) {
            console.error('Fetch Error:', error);
            
            // ストリーミングメッセージを削除
            if (streamMsg.parentNode) streamMsg.remove();

            let errorMsg = "システムエラー: ";
            if (error.name === 'AbortError') {
                errorMsg += "タイムアウトが発生しました。バックエンドの処理が遅延しています。";
            } else if (error.message.includes("Failed to fetch")) {
                errorMsg += "サーバーに接続できません。バックエンドが起動しているか確認してください。";
            } else {
                errorMsg += `予期せぬエラーが発生しました (${error.message})`;
            }
            addMessage(errorMsg, "system");
        } finally {
            isStreaming = false;
            userInput.disabled = false;
            sendBtn.disabled = false;
            voiceInputBtn.disabled = false;
            imageBtn.disabled = false;
            userInput.focus();
        }
    }

    sendBtn.addEventListener('click', () => handleSend());

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = '40px';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // 初期メッセージ
    addMessage("システムを起動しました。ごみの分別や出し方について質問してください。", "system");

    // --- History Sidebar ---

    function toggleHistorySidebar() {
        const isExpanded = document.body.classList.toggle('sidebar-expanded');
        if (isExpanded) {
            renderHistorySidebar();
        }
        // Reset any inline transform from drag
        if (historySidebar) historySidebar.style.transform = '';
    }

    function closeHistorySidebar() {
        document.body.classList.remove('sidebar-expanded');
        if (historySidebar) historySidebar.style.transform = '';
    }

    if (toggleHistorySidebarBtn) {
        toggleHistorySidebarBtn.addEventListener('click', toggleHistorySidebar);
    }

    if (historySidebarOverlay) {
        historySidebarOverlay.addEventListener('click', closeHistorySidebar);
    }

    // --- Mobile drag handle for history sidebar ---
    (function initDragHandle() {
        const dragHandle = document.getElementById('historyDragHandle');
        if (!dragHandle || !historySidebar) return;

        let startY = 0;
        let currentTranslateY = 0;
        let isDragging = false;
        const DISMISS_THRESHOLD = 100; // px to swipe down to dismiss

        function getY(e) {
            return e.touches ? e.touches[0].clientY : e.clientY;
        }

        function onDragStart(e) {
            if (window.innerWidth >= 768) return;
            isDragging = true;
            startY = getY(e);
            currentTranslateY = 0;
            historySidebar.style.transition = 'none';
        }

        function onDragMove(e) {
            if (!isDragging) return;
            const deltaY = getY(e) - startY;
            // Only allow dragging downward (positive direction)
            currentTranslateY = Math.max(0, deltaY);
            historySidebar.style.transform = 'translateY(' + currentTranslateY + 'px)';
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            historySidebar.style.transition = '';
            if (currentTranslateY > DISMISS_THRESHOLD) {
                closeHistorySidebar();
            } else {
                historySidebar.style.transform = '';
            }
            currentTranslateY = 0;
        }

        // Touch events
        dragHandle.addEventListener('touchstart', onDragStart, { passive: true });
        dragHandle.addEventListener('touchmove', onDragMove, { passive: false });
        dragHandle.addEventListener('touchend', onDragEnd);
        dragHandle.addEventListener('touchcancel', onDragEnd);

        // Mouse events (for testing on desktop)
        dragHandle.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    })();

    if (historySidebarNewChat) {
        historySidebarNewChat.addEventListener('click', () => {
            if (chatLog.children.length > 0) {
                startNewChat();
            }
            if (window.innerWidth < 768) closeHistorySidebar();
        });
    }

    if (historySidebarSearch) {
        historySidebarSearch.addEventListener('input', (e) => {
            renderHistorySidebar(e.target.value);
        });
    }

    function saveSessionToHistory() {
        if (currentChatSession.length <= 1) return;

        const sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
        const sessionTitle = currentChatSession.find(m => m.role === 'user')?.text.slice(0, 30) || '新しいチャット';

        const sessionData = {
            id: activeSessionId || Date.now().toString(),
            title: sessionTitle,
            timestamp: new Date().toLocaleString(),
            messages: currentChatSession
        };

        if (!activeSessionId) activeSessionId = sessionData.id;

        const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
        if (existingIndex > -1) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }

        localStorage.setItem('chat_history', JSON.stringify(sessions));
        renderHistorySidebar();
    }

    function deleteSession(sessionId) {
        if (!confirm('このセッションを削除しますか？')) return;

        let sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem('chat_history', JSON.stringify(sessions));

        if (activeSessionId === sessionId) {
            activeSessionId = null;
            currentChatSession = [];
            chatLog.innerHTML = '';
            loadFileList();
            addMessage("セッションが削除されました。新しい質問をどうぞ。", "system");
        }

        renderHistorySidebar();
    }

    function getDateLabel(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '今日';
        if (diffDays === 1) return '昨日';
        if (diffDays <= 7) return '過去7日間';
        if (diffDays <= 30) return '過去30日間';
        return 'それ以前';
    }

    function renderHistorySidebar(filterTerm = '') {
        const sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
        const filtered = sessions.filter(s =>
            !filterTerm ||
            s.title.toLowerCase().includes(filterTerm.toLowerCase()) ||
            s.messages.some(m => m.text.toLowerCase().includes(filterTerm.toLowerCase()))
        );

        if (filtered.length === 0) {
            historySessionList.innerHTML = '<div class="history-empty">会話履歴がありません</div>';
            return;
        }

        let html = '';
        let lastGroup = '';

        filtered.forEach(session => {
            const group = getDateLabel(session.timestamp);
            if (group !== lastGroup) {
                html += `<div class="history-date-group">${group}</div>`;
                lastGroup = group;
            }

            const isActive = session.id === activeSessionId;
            const msgCount = session.messages.length;

            html += `
                <div class="history-session-item${isActive ? ' active' : ''}" data-session-id="${session.id}">
                    <div class="history-session-info">
                        <div class="history-session-title">${sanitize(session.title)}</div>
                        <div class="history-session-meta">${msgCount} メッセージ</div>
                    </div>
                    <button class="history-session-delete" data-session-id="${session.id}" title="削除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>`;
        });

        historySessionList.innerHTML = html;

        historySessionList.querySelectorAll('.history-session-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.history-session-delete')) return;
                const sessionId = item.dataset.sessionId;
                loadSession(sessionId);
            });
        });

        historySessionList.querySelectorAll('.history-session-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSession(btn.dataset.sessionId);
            });
        });
    }

    function loadSession(sessionId) {
        const sessions = JSON.parse(localStorage.getItem('chat_history') || '[]');
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;

        saveSessionToHistory();

        chatLog.innerHTML = '';
        currentChatSession = [...session.messages];
        activeSessionId = session.id;

        const oldTts = ttsEnabledSelect.value;
        ttsEnabledSelect.value = 'false';
        currentChatSession.forEach(msg => {
            addMessage(msg.text, msg.role, true);
        });
        ttsEnabledSelect.value = oldTts;

        showSection('mainUI');
        renderHistorySidebar();

        if (window.innerWidth < 768) closeHistorySidebar();
    }

    renderHistorySidebar();

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(() => {
            console.log('Service Worker registered');
        }).catch(err => {
            console.warn('SW registration failed:', err);
        });
    }
});
