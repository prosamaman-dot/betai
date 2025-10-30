// Minimal advanced chat client using only vanilla JS
// Black & White only visuals handled in CSS

(function () {
	const els = {
		messages: document.getElementById('messages'),
		input: document.getElementById('input'),
		send: document.getElementById('send'),
		attach: document.getElementById('attach'),
		openCommand: document.getElementById('openCommand'),
		openSettings: document.getElementById('openSettings'),
		settingsModal: document.getElementById('settingsModal'),
		apiKey: document.getElementById('apiKey'),
		model: document.getElementById('model'),
		provider: document.getElementById('provider'),
		speechEngine: document.getElementById('speechEngine'),
		saveSettings: document.getElementById('saveSettings'),
		palette: document.getElementById('commandPalette'),
		commandInput: document.getElementById('commandInput'),
		commandList: document.getElementById('commandList'),
		templateList: document.getElementById('templateList'),
		historyList: document.getElementById('historyList')
	};

	const STORE = {
		key: 'betai__state',
		load() {
			try {
				const raw = localStorage.getItem(this.key);
				return raw ? JSON.parse(raw) : null;
			} catch { return null; }
		},
		save(state) {
			localStorage.setItem(this.key, JSON.stringify(state));
		}
	};

	const DEFAULT_TEMPLATES = [
		{ id: 'code-review', title: 'Code Review', prompt: 'Review my code and suggest improvements.' },
		{ id: 'ideas', title: 'Brainstorm Ideas', prompt: 'Brainstorm creative ideas about: ' },
		{ id: 'explain', title: 'Explain Like I\'m 5', prompt: 'Explain this simply: ' },
		{ id: 'optimize', title: 'Optimize Prompt', prompt: 'Rewrite my prompt to be clearer and more effective: ' }
	];

const DEFAULT_COMMANDS = [
    { id: 'new', label: 'New chat', action: () => startNewChat() },
    { id: 'clear', label: 'Clear messages', action: () => clearMessages() },
    { id: 'toggle-settings', label: 'Open settings', action: () => openModal(true) },
    { id: 'export', label: 'Export conversation (JSON)', action: () => exportConversation() }
];

	let state = {
		messages: [], // {id, role:"user|assistant", content}
		history: [], // {id, title, ts, messagesLen}
		templates: DEFAULT_TEMPLATES,
		settings: { apiKey: '', model: 'gemini-2.5-pro', provider: 'gemini', speechEngine: 'browser' },
		currentId: generateId('chat')
	};

	// init from localStorage
	const saved = STORE.load();
	if (saved) {
		state = Object.assign({}, state, saved, {
			templates: saved.templates?.length ? saved.templates : DEFAULT_TEMPLATES
		});
	}

// If no key set yet, prefill with provided Gemini key (user-supplied)
if (!state.settings.apiKey) {
    state.settings.apiKey = 'AIzaSyCRUUjtWUAy0UeR7V5sHxYg8s0cgqpAvn4';
}
// Ensure provider/model defaults to Gemini 2.5 Pro
if (!state.settings.provider) state.settings.provider = 'gemini';
if (!state.settings.model) state.settings.model = 'gemini-2.5-pro';

	// UI bootstrap
	populateTemplates();
	populateHistory();
	els.apiKey.value = state.settings.apiKey || '';
els.model.value = state.settings.model || 'gemini-2.5-pro';
	if (els.provider) { els.provider.value = state.settings.provider || 'gemini'; }
	if (els.speechEngine) { els.speechEngine.value = state.settings.speechEngine || 'browser'; }
	renderAllMessages();
	autosizeTextarea(els.input);
	els.input.focus();

	// Speech recognition setup (Web Speech API) + optional MediaRecorder for OpenAI
	let recognition = null;
	let isListening = false;
	let mediaRecorder = null;
	let audioChunks = [];
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	if (SpeechRecognition) {
		recognition = new SpeechRecognition();
		recognition.lang = 'en-US';
		recognition.interimResults = true;
		recognition.continuous = false;
		recognition.addEventListener('result', (e) => {
			let interim = '';
			let finalText = '';
			for (let i = e.resultIndex; i < e.results.length; i++) {
				const res = e.results[i];
				if (res.isFinal) { finalText += res[0].transcript; } else { interim += res[0].transcript; }
			}
			const base = (els.input.value || '').trim();
			els.input.value = (base ? base + ' ' : '') + (finalText || interim);
			autosizeTextarea(els.input);
		});
		recognition.addEventListener('end', () => {
			setListening(false);
		});
		recognition.addEventListener('error', () => {
			setListening(false);
		});
	}

	// Events
	els.send.addEventListener('click', onSend);
	els.input.addEventListener('keydown', onInputKeydown);
	els.openCommand.addEventListener('click', () => openPalette(true));
	els.openSettings.addEventListener('click', () => openModal(true));
	els.saveSettings.addEventListener('click', saveSettings);
	els.attach.addEventListener('click', toggleVoice);
	window.addEventListener('click', (e) => {
		if (e.target?.dataset?.close === 'modal') openModal(false);
		if (e.target?.dataset?.close === 'palette') openPalette(false);
	});
	window.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			openPalette(true);
		}
		if (e.key === 'Escape') { openPalette(false); openModal(false); }
	});

// Health ping to verify JS loaded
try { console.debug('BetAI: app initialized'); } catch {}

	// Palette logic
	els.commandInput.addEventListener('input', renderPalette);
	function openPalette(open) {
		els.palette.setAttribute('aria-hidden', open ? 'false' : 'true');
		if (open) { renderPalette(); setTimeout(() => els.commandInput.focus(), 10); }
	}
	function renderPalette() {
		const q = els.commandInput.value.toLowerCase().trim();
		const items = [
			...DEFAULT_COMMANDS.map(c => ({ type: 'cmd', text: c.label, data: c })),
			...state.templates.map(t => ({ type: 'tpl', text: `Template: ${t.title}`, data: t }))
		].filter(i => !q || i.text.toLowerCase().includes(q));
		els.commandList.innerHTML = '';
		items.forEach((item) => {
			const li = document.createElement('li');
			li.textContent = item.text;
			li.addEventListener('click', () => {
				if (item.type === 'cmd') item.data.action();
				if (item.type === 'tpl') applyTemplate(item.data);
				openPalette(false);
			});
			els.commandList.appendChild(li);
		});
	}

	function applyTemplate(t) {
		els.input.value = t.prompt;
		autosizeTextarea(els.input);
		els.input.focus();
	}

	// Settings
	function openModal(open) {
		els.settingsModal.setAttribute('aria-hidden', open ? 'false' : 'true');
		if (open) setTimeout(() => els.apiKey.focus(), 20);
	}
	function saveSettings() {
		state.settings.apiKey = (els.apiKey.value || '').trim();
		state.settings.model = (els.model.value || 'gemini-2.0-pro').trim();
		state.settings.provider = (els.provider?.value || 'gemini');
		state.settings.speechEngine = (els.speechEngine?.value || 'browser');
		persist();
		openModal(false);
	}

	// Messaging
	async function onSend() {
		const text = (els.input.value || '').trim();
		if (!text) return;
		pushMessage('user', text);
		els.input.value = '';
		autosizeTextarea(els.input);
		const thinking = pushMessage('assistant', '');
		streamAssistantResponse(thinking.id).catch(() => {});
	}

async function toggleVoice() {
    const engine = state.settings.speechEngine || 'browser';
    if (engine === 'browser') {
        if (!recognition) { alert('Voice input is not supported in this browser. Try Chrome or Edge.'); return; }
        if (!isListening) { try { recognition.start(); setListening(true); } catch { setListening(false); } }
        else { try { recognition.stop(); } catch {} setListening(false); }
        return;
    }
    // OpenAI Whisper via MediaRecorder
    if (!isListening) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            const mime = getBestAudioMime();
            mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
            mediaRecorder.ondataavailable = (e) => { if (e.data.size) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: mime });
                if ((state.settings.provider || 'gemini') === 'gemini') {
                    await transcribeWithGemini(blob);
                } else {
                    await transcribeWithOpenAI(blob);
                }
                stream.getTracks().forEach(t => t.stop());
                mediaRecorder = null; audioChunks = [];
            };
            mediaRecorder.start();
            setListening(true);
        } catch (e) {
            setListening(false);
            alert('Microphone permission denied or not available.');
        }
    } else {
        try { mediaRecorder?.stop(); } catch {}
        setListening(false);
    }
}

	function setListening(val) {
		isListening = val;
		els.attach.classList.toggle('listening', !!val);
		els.attach.setAttribute('aria-pressed', val ? 'true' : 'false');
	}

function getBestAudioMime() {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    return 'audio/webm';
}

async function transcribeWithOpenAI(audioBlob) {
    const apiKey = (state.settings.apiKey || '').trim();
    if (!apiKey) { alert('Add your OpenAI API key in Settings to use Whisper.'); return; }
    try {
        const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([audioBlob], `speech.${ext}`, { type: audioBlob.type });
        const form = new FormData();
        form.append('file', file);
        form.append('model', 'whisper-1');
        form.append('language', 'en');
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: form
        });
        if (!res.ok) throw new Error('Transcription failed');
        const data = await res.json();
        const text = data?.text || '';
        if (text) {
            const base = (els.input.value || '').trim();
            els.input.value = base ? base + ' ' + text : text;
            autosizeTextarea(els.input);
        } else {
            alert('No transcript returned.');
        }
    } catch (e) {
        alert('OpenAI transcription error.');
    } finally {
        setListening(false);
    }
}
	function onInputKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
	}

	async function transcribeWithGemini(audioBlob) {
		const apiKey = (state.settings.apiKey || '').trim();
		const model = state.settings.model || 'gemini-2.0-pro';
		if (!apiKey) { alert('Add your Gemini API key in Settings.'); return; }
		const base64 = await blobToBase64(audioBlob);
		const mime = audioBlob.type || 'audio/webm';
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
		const body = {
			contents: [
				{
					role: 'user',
					parts: [
						{ text: 'Transcribe the following audio into plain text. Return only the transcript.' },
						{ inline_data: { mime_type: mime, data: base64 } }
					]
				}
			]
		};
		try {
			const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!res.ok) throw new Error('Gemini transcription failed');
			const data = await res.json();
			const text = extractGeminiText(data) || '';
			if (text) {
				const base = (els.input.value || '').trim();
				els.input.value = base ? base + ' ' + text : text;
				autosizeTextarea(els.input);
			} else {
				alert('No transcript returned by Gemini.');
			}
		} catch (e) {
			alert('Gemini transcription error.');
		} finally {
			setListening(false);
		}
	}

	async function callGeminiChat(apiKey, model, messages) {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
		const contents = messages.map(m => ({
			role: m.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: m.content }]
		}));
		if (!contents.length) contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
		const body = { contents };
		const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
		const data = await res.json();
		return extractGeminiText(data) || 'Sorry, no response.';
	}

	async function callOpenAIChat(apiKey, model, messages) {
		const sys = { role: 'system', content: 'You are a concise, helpful assistant.' };
		const convo = messages.map(m => ({ role: m.role, content: m.content }));
		const body = { model, messages: [sys, ...convo] };
		const res = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
			body: JSON.stringify(body)
		});
		const data = await res.json();
		return data?.choices?.[0]?.message?.content || 'Sorry, no response.';
	}

	function extractGeminiText(data) {
		const parts = data?.candidates?.[0]?.content?.parts;
		if (!parts) return '';
		return parts.map(p => p.text || '').join('').trim();
	}

	function blobToBase64(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve((r.result||'').toString().split(',')[1]||''); r.onerror = reject; r.readAsDataURL(blob); }); }

	function pushMessage(role, content) {
		const msg = { id: generateId('msg'), role, content };
		state.messages.push(msg);
		renderMessage(msg);
		scrollToBottom();
		persist();
		return msg;
	}

	function renderAllMessages() {
		els.messages.innerHTML = '';
		state.messages.forEach(renderMessage);
		if (!state.messages.length) {
			renderIntro();
		}

function clearMessages() {
    state.messages = [];
    persist();
    renderAllMessages();
}
	}

	function renderIntro() {
		const wrap = document.createElement('div');
		wrap.className = 'message';
		wrap.innerHTML = `
			<div class="avatar">A</div>
			<div class="bubble">
				<h3>Welcome to BetAI</h3>
				<p>All black and white. Sleek. Fast. Type your question below.</p>
			</div>
		`;
		els.messages.appendChild(wrap);
	}

	function renderMessage(msg) {
		const wrap = document.createElement('div');
		wrap.className = 'message';
		const isUser = msg.role === 'user';
		wrap.innerHTML = `
			<div class="avatar">${isUser ? 'U' : 'A'}</div>
			<div class="bubble ${isUser ? 'bubble--user' : ''}" data-id="${msg.id}">
				<div class="bubble__toolbar">
					<button class="bubble__btn" data-act="copy" title="Copy"><svg class="i"><use href="#icon-copy"></use></svg></button>
					${isUser ? '' : '<button class="bubble__btn" data-act="regen" title="Regenerate"><svg class="i"><use href="#icon-refresh"></use></svg></button>'}
					<button class="bubble__btn" data-act="del" title="Delete"><svg class="i"><use href="#icon-trash"></use></svg></button>
				</div>
				<div class="content">${formatContent(msg.content)}</div>
			</div>
		`;
		wrap.addEventListener('click', (e) => onMessageToolbar(e, msg.id));
		els.messages.appendChild(wrap);
	}

	function onMessageToolbar(e, id) {
		const btn = e.target.closest('.bubble__btn');
		if (!btn) return;
		const act = btn.dataset.act;
		if (act === 'copy') {
			const m = state.messages.find(x => x.id === id);
			navigator.clipboard?.writeText(m?.content || '');
			return;
		}
		if (act === 'del') {
			state.messages = state.messages.filter(x => x.id !== id);
			renderAllMessages();
			persist();
			return;
		}
		if (act === 'regen') {
			const idx = state.messages.findIndex(x => x.id === id);
			if (idx > -1) {
				state.messages[idx].content = '';
				renderAllMessages();
				streamAssistantResponse(id, true).catch(() => {});
			}
		}
	}

	function formatContent(text) {
		if (!text) return '';
		// simple markdown-ish
		const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return escaped
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/`([^`]+)`/g, '<code>$1<\/code>')
			.replace(/\n\n/g, '<br/><br/>')
			.replace(/\n/g, '<br/>');
	}

	async function streamAssistantResponse(targetId, isRegen = false) {
		const apiKey = state.settings.apiKey;
		const model = state.settings.model || (state.settings.provider === 'gemini' ? 'gemini-2.0-pro' : 'gpt-4o-mini');
		const lastUser = findLastUserMessage();
		const targetEl = findBubbleContent(targetId);
		if (!targetEl) return;

		// Streaming with mock fallback
		if (!apiKey) {
			await streamMock(targetEl, lastUser?.content || '');
			const msg = state.messages.find(m => m.id === targetId);
			msg.content = targetEl.textContent;
			persist();
			return;
		}

		try {
			targetEl.textContent = '';
			let content = '';
			if (state.settings.provider === 'gemini') {
				content = await callGeminiChat(apiKey, model, state.messages);
			} else {
				content = await callOpenAIChat(apiKey, model, state.messages);
			}
			await streamText(targetEl, content);
			const msg = state.messages.find(m => m.id === targetId);
			msg.content = content;
			persist();
		} catch (err) {
			await streamText(targetEl, 'Failed to fetch from API. Using local reasoning...');
			await streamMock(targetEl, lastUser?.content || '');
			const msg = state.messages.find(m => m.id === targetId);
			msg.content = targetEl.textContent;
			persist();
		}
	}

	function findBubbleContent(id) {
		const bubble = document.querySelector(`.bubble[data-id="${id}"] .content`);
		return bubble || null;
	}
	function findLastUserMessage() {
		for (let i = state.messages.length - 1; i >= 0; i--) {
			if (state.messages[i].role === 'user') return state.messages[i];
		}
		return null;
	}

	async function streamText(el, text) {
		for (let i = 0; i < text.length; i++) {
			el.innerHTML += text[i] === '\n' ? '<br/>' : text[i];
			await sleep(6);
			scrollToBottom();
		}
	}
	async function streamMock(el, userText) {
		const bullets = mockReason(userText);
		const content = bullets.join('\n');
		await streamText(el, content);
	}
	function mockReason(input) {
		const base = input || 'your query';
		return [
			`Here\'s a structured answer about ${base}:`,
			`1) Summary: A concise overview in plain language.`,
			`2) Key Points:`,
			`- Context and assumptions`,
			`- Steps or strategy`,
			`- Edge cases and cautions`,
			`3) Next Actions: concrete steps to proceed.`
		];
	}

	function scrollToBottom() {
		els.messages.scrollTo({ top: els.messages.scrollHeight });
	}

	function autosizeTextarea(t) {
		const resize = () => {
			t.style.height = 'auto';
			t.style.height = Math.min(220, t.scrollHeight) + 'px';
		};
		['input','keydown','change'].forEach(ev => t.addEventListener(ev, resize));
		resize();
	}

	// Conversation history
	function startNewChat() {
		if (state.messages.length) {
			state.history.unshift({ id: state.currentId, title: summarizeTitle(state.messages[0]?.content || 'Conversation'), ts: Date.now(), messagesLen: state.messages.length });
		}
		state.currentId = generateId('chat');
		state.messages = [];
		persist();
		renderAllMessages();
		populateHistory();
	}
	function summarizeTitle(text) {
		return (text.slice(0, 28) + (text.length > 28 ? '…' : '')).replace(/\n/g, ' ');
	}
	function populateHistory() {
		els.historyList.innerHTML = '';
		state.history.slice(0, 16).forEach(h => {
			const li = document.createElement('li');
			li.innerHTML = `<span>${h.title}</span><span>${new Date(h.ts).toLocaleDateString()}</span>`;
			li.addEventListener('click', () => loadHistory(h.id));
			els.historyList.appendChild(li);
		});
	}
	function loadHistory(id) {
		const item = state.history.find(x => x.id === id);
		if (!item) return;
		state.history = state.history.filter(x => x.id !== id);
		state.history.unshift({ id: state.currentId, title: summarizeTitle(state.messages[0]?.content || 'Conversation'), ts: Date.now(), messagesLen: state.messages.length });
		state.currentId = id;
		state.messages = item.messages || []; // legacy safeguard
		persist();
		renderAllMessages();
		populateHistory();
	}

	// Templates
	function populateTemplates() {
		els.templateList.innerHTML = '';
		state.templates.forEach(t => {
			const li = document.createElement('li');
			li.textContent = t.title;
			li.title = t.prompt;
			li.addEventListener('click', () => applyTemplate(t));
			els.templateList.appendChild(li);
		});
	}

	// Export
	function exportConversation() {
		const data = {
			id: state.currentId,
			messages: state.messages,
			when: new Date().toISOString()
		};
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = `betai-${Date.now()}.json`;
		document.body.appendChild(a); a.click(); a.remove();
		URL.revokeObjectURL(url);
	}

	// Persistence
	function persist() {
		STORE.save({
			messages: state.messages,
			history: state.history,
			templates: state.templates,
			settings: state.settings,
			currentId: state.currentId
		});
	}

	// Utils
	function generateId(prefix) {
		return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
	}
	function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
})();


