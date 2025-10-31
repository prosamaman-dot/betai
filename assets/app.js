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
		toggleHistory: document.getElementById('toggleHistory'),
		closeSidebar: document.getElementById('closeSidebar'),
		sidebar: document.querySelector('.sidebar'),
		settingsModal: document.getElementById('settingsModal'),
		apiKey: document.getElementById('apiKey'),
		model: document.getElementById('model'),
		provider: document.getElementById('provider'),
		speechEngine: document.getElementById('speechEngine'),
		searchProvider: document.getElementById('searchProvider'),
		searchKey: document.getElementById('searchKey'),
		searchAuto: document.getElementById('searchAuto'),
		searchWiki: document.getElementById('searchWiki'),
		saveSettings: document.getElementById('saveSettings'),
		palette: document.getElementById('commandPalette'),
		commandInput: document.getElementById('commandInput'),
		commandList: document.getElementById('commandList'),
		sourcesModal: document.getElementById('sourcesModal'),
		sourcesList: document.getElementById('sourcesList'),
		historyList: document.getElementById('historyList'),
		newChatBtn: document.getElementById('newChatBtn')
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

const DEFAULT_COMMANDS = [
    { id: 'new', label: 'New chat', action: () => startNewChat() },
    { id: 'clear', label: 'Clear messages', action: () => clearMessages() },
    { id: 'toggle-settings', label: 'Open settings', action: () => openModal(true) },
    { id: 'export', label: 'Export conversation (JSON)', action: () => exportConversation() },
    { id: 'match', label: 'Analyze football match', action: () => openMatchModal(true) }
];

	let state = {
		messages: [], // {id, role:"user|assistant", content, formattedContent}
		history: [], // {id, title, ts, messagesLen, messages}
		settings: { apiKey: 'AIzaSyCRUUjtWUAy0UeR7V5sHxYg8s0cgqpAvn4', model: 'gemini-2.5-pro', provider: 'gemini', speechEngine: 'browser', searchProvider: 'serper', searchKey: '', searchAuto: true, searchWiki: true },
		currentId: generateId('chat'),
		scrollPosition: 0
	};

	// init from localStorage
	const saved = STORE.load();
	if (saved) {
		state = Object.assign({}, state, saved);
		// Ensure scrollPosition exists
		if (typeof state.scrollPosition === 'undefined') state.scrollPosition = 0;
	}

// Force Gemini 2.5 Pro with user's API key (always override)
state.settings.apiKey = 'AIzaSyCRUUjtWUAy0UeR7V5sHxYg8s0cgqpAvn4';
state.settings.provider = 'gemini';
state.settings.model = 'gemini-2.5-pro';

	// UI bootstrap
	populateHistory();
	els.apiKey.value = state.settings.apiKey || '';
els.model.value = state.settings.model || 'gemini-2.5-pro';
	if (els.provider) { els.provider.value = state.settings.provider || 'gemini'; }
	if (els.speechEngine) { els.speechEngine.value = state.settings.speechEngine || 'browser'; }
if (els.searchProvider) els.searchProvider.value = state.settings.searchProvider || 'serper';
if (els.searchKey) els.searchKey.value = state.settings.searchKey || '';
if (els.searchAuto) els.searchAuto.checked = !!state.settings.searchAuto;
if (els.searchWiki) els.searchWiki.checked = !!state.settings.searchWiki;
	renderAllMessages(true); // Restore scroll on initial load
	autosizeTextarea(els.input);
	els.input.focus();
	
	// Track scroll position
	els.messages.addEventListener('scroll', () => {
		state.scrollPosition = els.messages.scrollTop;
		// Debounce persistence
		clearTimeout(window.scrollSaveTimeout);
		window.scrollSaveTimeout = setTimeout(() => persist(), 500);
	});

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
	if (els.openCommand) els.openCommand.addEventListener('click', () => openPalette(true));
	els.openSettings.addEventListener('click', () => openModal(true));
	els.saveSettings.addEventListener('click', saveSettings);
	els.attach.addEventListener('click', toggleVoice);
	if (els.newChatBtn) els.newChatBtn.addEventListener('click', () => startNewChat());
	if (els.toggleHistory) els.toggleHistory.addEventListener('click', toggleSidebar);
	if (els.closeSidebar) els.closeSidebar.addEventListener('click', toggleSidebar);
	const ma = {
		modal: document.getElementById('matchModal'),
		home: document.getElementById('maHome'),
		away: document.getElementById('maAway'),
		league: document.getElementById('maLeague'),
		date: document.getElementById('maDate'),
		formHome: document.getElementById('maFormHome'),
		formAway: document.getElementById('maFormAway'),
		notes: document.getElementById('maNotes'),
		run: document.getElementById('runMatchAnalysis')
	};
	ma?.run?.addEventListener('click', runMatchAnalysis);
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
		const items = DEFAULT_COMMANDS.map(c => ({ type: 'cmd', text: c.label, data: c }))
			.filter(i => !q || i.text.toLowerCase().includes(q));
		els.commandList.innerHTML = '';
		items.forEach((item) => {
			const li = document.createElement('li');
			li.textContent = item.text;
			li.addEventListener('click', () => {
				item.data.action();
				openPalette(false);
			});
			els.commandList.appendChild(li);
		});
	}

	// Settings
	function openModal(open) {
		els.settingsModal.setAttribute('aria-hidden', open ? 'false' : 'true');
		if (open) setTimeout(() => els.apiKey.focus(), 20);
	}
	function saveSettings() {
		// Force Gemini 2.5 Pro always
		state.settings.apiKey = 'AIzaSyCRUUjtWUAy0UeR7V5sHxYg8s0cgqpAvn4';
		state.settings.model = 'gemini-2.5-pro';
		state.settings.provider = 'gemini';
		state.settings.speechEngine = (els.speechEngine?.value || 'browser');
		state.settings.searchProvider = (els.searchProvider?.value || 'serper');
		state.settings.searchKey = (els.searchKey?.value || '').trim();
		state.settings.searchAuto = !!els.searchAuto?.checked;
		state.settings.searchWiki = !!els.searchWiki?.checked;
		persist();
		openModal(false);
	}

	// Messaging
	async function onSend() {
		const text = (els.input.value || '').trim();
		if (!text) return;
		
		// If this is the first message in a new conversation, create history entry
		const isFirstMessage = state.messages.length === 0;
		
		pushMessage('user', text);
		els.input.value = '';
		autosizeTextarea(els.input);
		
		// Auto-create history entry for new conversation
		if (isFirstMessage) {
			const existingIndex = state.history.findIndex(h => h.id === state.currentId);
			if (existingIndex === -1) {
				state.history.unshift({
					id: state.currentId,
					title: summarizeTitle(text),
					ts: Date.now(),
					messagesLen: 1,
					messages: []
				});
				populateHistory();
			}
		}
		
		const thinking = pushMessage('assistant', '');
		if (shouldUseWebSearch(text)) {
			webAugmentedAnswer(text, thinking.id).catch(() => streamAssistantResponse(thinking.id));
		} else {
			streamAssistantResponse(thinking.id).catch(() => {});
		}
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

	function openMatchModal(open) {
	if (!ma?.modal) return;
	ma.modal.setAttribute('aria-hidden', open ? 'false' : 'true');
	if (open) setTimeout(() => ma.home?.focus(), 20);
}

	function toggleSidebar() {
		if (els.sidebar) {
			const isOpen = els.sidebar.classList.toggle('sidebar--open');
			document.body.classList.toggle('sidebar-open', isOpen);
		}
	}

	function showSourcesModal(sources, messageId) {
		if (!sources || sources.length === 0) return;
		if (!els.sourcesList || !els.sourcesModal) return;
		
		els.sourcesList.innerHTML = sources.map((s, i) => `
			<div class="source-item">
				<div class="source-item__number">${i + 1}</div>
				<div class="source-item__content">
					<div class="source-item__title">${escapeHtml(s.title || s.url)}</div>
					<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="source-item__link">${escapeHtml(s.url)}</a>
				</div>
			</div>
		`).join('');
		
		openSourcesModal(true);
	}

	function openSourcesModal(open) {
		if (els.sourcesModal) {
			els.sourcesModal.setAttribute('aria-hidden', open ? 'false' : 'true');
		}
	}

	// Close sidebar when clicking backdrop
	window.addEventListener('click', (e) => {
		if (els.sidebar && els.sidebar.classList.contains('sidebar--open')) {
			if (!els.sidebar.contains(e.target) && !els.toggleHistory?.contains(e.target)) {
				els.sidebar.classList.remove('sidebar--open');
				document.body.classList.remove('sidebar-open');
			}
		}
	});

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

function runMatchAnalysis() {
	const home = (ma.home?.value || '').trim();
	const away = (ma.away?.value || '').trim();
	if (!home || !away) { alert('Enter both Home and Away teams.'); return; }
	const league = (ma.league?.value || '').trim();
	const date = (ma.date?.value || '').trim();
	const formH = (ma.formHome?.value || '').trim();
	const formA = (ma.formAway?.value || '').trim();
	const notes = (ma.notes?.value || '').trim();

	const prompt = [
		`Analyze this football match and give a concise prediction:`,
		`- Match: ${home} vs ${away}${league ? ' — ' + league : ''}${date ? ' on ' + date : ''}`,
		formH ? `- ${home} recent form: ${formH}` : '',
		formA ? `- ${away} recent form: ${formA}` : '',
		notes ? `- Notes: ${notes}` : '',
		`Guidance: Do not browse or scrape websites. You may incorporate any facts provided by the user, including from sources like FotMob (https://www.fotmob.com/).`,
		`Output format:`,
		`1) Win/Draw/Win probabilities (sum to 100%).`,
		`2) Rationale (key factors: form, injuries, rest, matchup, home/away).`,
		`3) Suggested bets (if any) with brief risk notes.`
	].filter(Boolean).join('\n');

	pushMessage('user', prompt);
	openMatchModal(false);
	const thinking = pushMessage('assistant', '');
	streamAssistantResponse(thinking.id).catch(() => {});
}
	function onInputKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
	}

	async function transcribeWithGemini(audioBlob) {
		// Force Gemini 2.5 Pro
		const apiKey = 'AIzaSyCRUUjtWUAy0UeR7V5sHxYg8s0cgqpAvn4';
		const model = 'gemini-2.5-pro';
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
        const data = await postJsonWithRetry(url, body, { 'Content-Type': 'application/json' });
			const text = extractGeminiText(data) || '';
			if (text) {
				const base = (els.input.value || '').trim();
				els.input.value = base ? base + ' ' + text : text;
				autosizeTextarea(els.input);
			} else {
            alert(data?.error?.message ? `Gemini: ${data.error.message}` : 'No transcript returned by Gemini.');
			}
    } catch (e) {
        alert(e?.message || 'Gemini transcription error.');
		} finally {
			setListening(false);
		}
	}

async function callGeminiChat(apiKey, model, messages) {
	// Validate API key and model
	if (!apiKey || !apiKey.trim()) {
		throw new Error('API key is required');
	}
	// Force gemini-2.5-pro - use it as-is
	if (!model || !model.trim()) {
		model = 'gemini-2.5-pro';
	}
	
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.trim())}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
	const now = new Date();
	
	// Get Ethiopia (Addis Ababa) time - UTC+3 (EAT - East Africa Time)
	const ethiopiaOptions = { timeZone: 'Africa/Addis_Ababa', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
	const ethiopiaDateFull = now.toLocaleDateString('en-US', { timeZone: 'Africa/Addis_Ababa', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
	const ethiopiaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit', hour12: false });
	const ethiopiaDateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
	
	const dateContext = `[Current date/time in Ethiopia (Addis Ababa, UTC+3, EAT): ${ethiopiaDateFull} at ${ethiopiaTimeStr} EAT]`;
	
	// System instruction for concise, question-driven responses
	const systemInstruction = {
		role: 'user',
		parts: [{
			text: `You are BetAI, a concise assistant with REAL-TIME INTERNET ACCESS via Google Search.
YOUR NAME: When asked about your name or who you are, always respond "I'm BetAI" or "I'm BetAI, your intelligent betting and football analysis assistant."
IMPORTANT: You have access to live internet data and can search for current information. Use Google Search when needed for real-time data.

CRITICAL TIMEZONE RULES:
- ALWAYS use Ethiopia (Addis Ababa) local time (EAT, UTC+3) when mentioning times, dates, or schedules
- When talking about football matches, game times, kickoff times, or match schedules, convert all times to Ethiopia (Addis Ababa) timezone
- Format times as: "HH:MM EAT" or "HH:MM Ethiopia time"
- Current date/time in Ethiopia: ${ethiopiaDateFull} at ${ethiopiaTimeStr} EAT

FOOTBALL/MATCH RESPONSE FORMAT (MANDATORY):
When responding about match previews, players, injuries, or team info, ALWAYS use this structured format:

🏟️ **Match Preview**
A short sentence summarizing the match.

📊 **Last 5 Results**
- **[Team A]**: W-D-L-W-L (show recent form: Win/Draw/Loss)
- **[Team B]**: W-W-D-L-W

📈 **Goals Scored & Conceded**
- **[Team A]**: Scored: X, Conceded: Y (average per game: X.X)
- **[Team B]**: Scored: X, Conceded: Y (average per game: X.X)

⚔️ **Head-to-Head Record**
- Last 5 meetings: [Team A] X wins, [Team B] X wins, X draws
- Last meeting: Date, score, venue

🏠 **Home vs Away Advantage**
- **[Team A]**: Home record: X wins, X draws, X losses
- **[Team B]**: Away record: X wins, X draws, X losses

🔥 **Key Players – [Team Name]**
- Position: Player Name (note if top scorer/playmaker)

⚡ **Key Players – [Team Name]**
- Position: Player Name (note if top scorer/playmaker)

🚑 **Injuries & Suspensions – [Team Name]**
- ❌ Player Name (injury type/suspension reason)
- 🔴 Player Name (red card suspension)

🎯 **Team Motivation**
- **[Team A]**: League position, must-win situation, recent form context
- **[Team B]**: League position, must-win situation, recent form context

📐 **Corners Per Game**
- **[Team A]**: Average X.X corners per game (for/against)
- **[Team B]**: Average X.X corners per game (for/against)

👥 **Predicted Lineups (International)**
- **[Team A]** (4-3-3 or formation):
  - GK: Player Name
  - DEF: Player Name, Player Name, Player Name, Player Name
  - MID: Player Name, Player Name, Player Name
  - FWD: Player Name, Player Name, Player Name
- **[Team B]** (formation):
  - [Same format]

🧠 **Quick Analysis**
A short 2-line summary comparing both teams and prediction.

🎯 **Predictions:**
1. **Full Time Result** → [Win/Draw/Loss prediction for Team A]
2. **Double Chance** → [1X / 12 / X2]
3. **Over/Under Goals** → 
   - 0.5: [Over/Under]
   - 1.5: [Over/Under]
   - 2.5: [Over/Under]
   - 3.5: [Over/Under]
   - 4.5: [Over/Under]
   - 5.5: [Over/Under]
4. **Both Teams to Score** → [Yes / No]
5. **Half Time / Full Time** → [HT result / FT result]
6. **Corners Over/Under** → [Over/Under X.5]
7. **Handicap** → [Team A +/-X.5]
8. **Combination Result** → [Team A and Over 1.5/2.5/3.5 + BTTS Yes/No]
9. **Half Time Goals** → 
   - 0.5: [Over/Under]
   - 1.5: [Over/Under]
   - 2.5: [Over/Under]

🧠 **CHARACTER & PERSONALITY (FOR FOOTBALL/BETTING RESPONSES):**
CORE TRAITS:
- Intelligence: 10/10 — uses logic, stats, and emotional control. Always data-driven
- Confidence: 9/10 — calm belief in analysis, trusts the process
- Emotion Control: 10/10 — never tilts after losses, stays disciplined
- Energy: 10/10 — expressive and hyped, but controlled
- Humor: 8/10 — make light jokes after losses, keep it fun but never tilt
- Superstition: 9/10 — mention "luck days", "winning vibes", "feeling it" BUT balanced with logic
- Loyalty: 100% — be a hype supporter, get them excited, but guide with intelligence

SPEAKING STYLE:
- Sharp, clean, and deep — sounds like a chess master talking about football
- Mix analytical depth with energetic expression
- Balance street talk with strategic insight

MINDSET & PHILOSOPHY:
- Motto: "Bet with your brain, not your heart."
- Core belief: "Luck favors the disciplined."
- Habits: Always study data before predictions, reference stats, use logic
- Track patterns: Mention key stats, trends, and analytical insights

LANGUAGE STYLE:
- Strategic: "The numbers say...", "Statistically...", "Based on the data..."
- Energetic: "bank it", "cashout", "boom!", "let's go!", "trust the process"
- Deep analysis: Reference specific stats, patterns, head-to-head records
- Balanced: Combine excitement with analytical reasoning
- Add energy emojis: "🔥", "💥", "⚡", "🚀", "💰", "🎯"
- After losses: Stay calm, analyze what happened, stay disciplined (never tilt)

RULES:
- NEVER write long paragraphs for football/match info
- Always use emojis (🏟️ 📊 📈 ⚔️ 🏠 🔥 ⚡ 🚑 ❌ 🔴 🎯 📐 👥 🧠 💰 💥 🚀)
- Use bold headings: **Heading Name**
- Use short bullet points, not sentences
- One fact per bullet point
- Keep tone: Sharp, clean, deep - like a chess master talking about football, but with HIGH ENERGY
- Balance analytical depth with energetic expression - combine logic with excitement
- Always reference stats, data, and patterns in analysis
- Use phrases like "The numbers say...", "Statistically...", "Based on the data..."
- Motto: "Bet with your brain, not your heart" - "Luck favors the disciplined"
- Always separate teams into clear sections
- For lineup predictions, use international player names and standard formations
- Show lineup prediction if match is within 10 hours, otherwise show "Lineup not yet confirmed"
- Inject personality: Add strategic insight + energy, balance slang with analytical depth
- Never tilt: Stay calm and disciplined, even when analyzing losses

Response rules (general):
- CRITICAL: Give ONLY main points, NO explanations unless specifically asked for predictions
- For predictions only: Provide a little bit of explanation/reasoning behind the prediction
- For everything else: Just facts, data, main points - NO explanations, NO context, NO elaboration
- Answer the question directly with facts only
- Use bullets for lists, keep them very short
- Never explain why or how unless user asks for predictions
- When asked about current events, news, or real-time data, automatically search the internet for the latest information
- NEVER include disclaimers, warnings, legal notices, "please gamble responsibly", "for entertainment purposes only", or any disclaimer text in responses`
		}]
	};
	
	// Filter and map messages - remove empty ones
	const contents = messages
		.filter(m => m && m.content && typeof m.content === 'string' && m.content.trim())
		.map((m, idx, filtered) => {
			let text = m.content.trim();
			
			// Add date context to first user message if needed
			if (idx === 0 && m.role === 'user' && !m.content.includes('CURRENT DATE/TIME')) {
				text = `${dateContext}\n\n${text}`;
			}
			
			// Add brief conciseness reminder to user messages (keeps AI concise throughout)
			if (m.role === 'user' && !m.content.includes('CURRENT DATE/TIME') && !m.content.includes('You are a concise')) {
				const lowerContent = text.toLowerCase();
				const isFootball = /football|soccer|match|game|kickoff|player|injury|suspension|preview|team|league|analysis|analyze|prediction|predict/i.test(lowerContent);
				const isTime = /time|schedule|when|date/i.test(lowerContent);
				let reminders = [];
				if (isFootball) {
					reminders.push('Use comprehensive match analysis format: 🏟️ Preview, 📊 Last 5 Results, 📈 Goals, ⚔️ Head-to-Head, 🏠 Home/Away, 🔥 Key Players, 🚑 Injuries, 🎯 Motivation, 📐 Corners, 👥 Lineups (if within 10h), 🧠 Analysis, 🎯 Predictions (all 9 categories). PERSONALITY: Chess master mindset with HIGH ENERGY. Intelligence 10/10 - use logic, stats, emotional control. Balance analytical phrases ("The numbers say...", "Statistically...") with energetic slang ("bank it", "boom!", "let\'s go!"). Motto: "Bet with your brain, not your heart" - "Luck favors the disciplined". Sharp, clean, deep analysis but expressive. Never tilt - stay disciplined. Use emojis 💰💥🚀🎯, bold headings, short bullets - NO long paragraphs.');
				}
				if (isTime || isFootball) {
					reminders.push('Use Ethiopia (Addis Ababa, EAT) timezone for all times.');
				}
				const reminderText = reminders.length > 0 ? ' ' + reminders.join(' ') + ' ' : '';
				text = `[You have real-time internet access via Google Search. Use it for current info.${reminderText}CRITICAL: Give ONLY main points, NO explanations unless I specifically ask for predictions. For predictions only: provide a little explanation. For everything else: just facts, no explanations. NEVER include disclaimers, warnings, or legal notices.]\n\n${text}`;
			}
			
			return {
				role: m.role === 'assistant' ? 'model' : 'user',
				parts: [{ text }]
			};
		});
	
	// Ensure we have at least one message
	if (contents.length === 0) {
		throw new Error('No valid messages to send');
	}
	
	// Add system instruction only at conversation start
	if (contents.length <= 2) { // 1 user message + maybe 1 system
		contents.unshift(systemInstruction);
	}
    
    // Enable Gemini's built-in Google Search integration
    const body = { 
        contents,
        tools: [{
            googleSearch: {}
        }]
    };
    
    const data = await postJsonWithRetry(url, body, { 'Content-Type': 'application/json' });
    const text = extractGeminiText(data);
    return text || (data?.error?.message ? `Gemini: ${data.error.message}` : 'Sorry, no response.');
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
		const candidate = data?.candidates?.[0];
		const parts = candidate?.content?.parts;
		if (!parts) return '';
		
		let text = parts.map(p => p.text || '').join('').trim();
		
		// Extract grounding metadata (search citations) if available
		const groundingMetadata = candidate?.groundingMetadata;
		if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
			const sources = [];
			groundingMetadata.groundingChunks.forEach(chunk => {
				if (chunk.web && chunk.web.uri) {
					sources.push(chunk.web.uri);
				}
			});
			if (sources.length > 0) {
				const uniqueSources = [...new Set(sources)];
				text += '\n\n**Sources:**\n' + uniqueSources.slice(0, 5).map((url, i) => `- [${url}](${url})`).join('\n');
			}
		}
		
		return text;
	}

	function blobToBase64(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve((r.result||'').toString().split(',')[1]||''); r.onerror = reject; r.readAsDataURL(blob); }); }

function shouldUseWebSearch(text) {
	if (!state.settings.searchAuto) return false;
	if (!(state.settings.searchKey || '').trim()) return false;
	const q = (text || '').toLowerCase();
	const triggers = ['today', 'now', 'latest', 'breaking', 'this week', 'this month', 'live', 'score', 'fixture', 'transfer', 'trending', 'news'];
	return triggers.some(t => q.includes(t));
}

async function webAugmentedAnswer(userText, targetId) {
	const key = (state.settings.searchKey || '').trim();
	if (!key) { return streamAssistantResponse(targetId); }
	let results = [];
	try {
		if ((state.settings.searchProvider || 'serper') === 'newsapi') {
			results = await webSearchNewsAPI(userText, key);
		} else {
			results = await webSearchSerper(userText, key);
		}
	} catch { results = []; }
	if (!Array.isArray(results)) results = [];
	const top = results.slice(0, 5);
	// If not enough results and wiki fallback is enabled, top up from Wikipedia
	if (top.length < 3 && state.settings.searchWiki) {
		try {
			const wiki = await webSearchWikipedia(userText);
			wiki.forEach(w => { if (top.length < 5) top.push(w); });
		} catch {}
	}
	const sources = top.map((r, i) => `(${i+1}) ${r.title} — ${r.link}`).join('\n');
	const contextMsg = composeWebPrompt(userText, sources);
	// Temporarily append a context message then ask Gemini
	const original = [...state.messages];
	state.messages.push({ id: generateId('msg'), role: 'user', content: contextMsg });
	try {
		const apiKey = state.settings.apiKey;
		const model = state.settings.model || 'gemini-2.5-pro';
		const answer = await callGeminiChat(apiKey, model, state.messages);
		const targetEl = findBubbleContent(targetId);
		if (targetEl) {
			// Clean up duplicate sources if Gemini didn't format properly
			let cleanAnswer = (answer || '').trim();
			// Remove any duplicate "Sources:" sections at the end
			const sourcesRegex = /Sources?:?\s*\n([\s\S]*)$/i;
			const matches = cleanAnswer.match(sourcesRegex);
			if (matches && matches.length > 1) {
				// Keep only the last sources section
				cleanAnswer = cleanAnswer.replace(sourcesRegex, '');
				cleanAnswer = cleanAnswer.trim() + '\n\n' + matches[0];
			}
			const formatted = await streamText(targetEl, cleanAnswer);
			const msg = state.messages.find(m => m.id === targetId);
			msg.content = cleanAnswer;
			msg.formattedContent = formatted;
			persist();
		}
	} finally {
		state.messages = original; // restore convo without the ephemeral context message
	}
}

async function webSearchSerper(query, key) {
	const url = 'https://google.serper.dev/search';
	// Enhance query to prioritize recent results for time-sensitive topics
	const enhancedQuery = query + (shouldUseWebSearch(query) ? ' latest 2025' : '');
	const body = { q: enhancedQuery, gl: 'us', hl: 'en', num: 10 };
	const headers = { 'X-API-KEY': key, 'Content-Type': 'application/json' };
	const data = await postJsonWithRetry(url, body, headers);
	const items = [];
	// Prioritize news results first (usually more current)
	(data?.news || []).forEach(n => items.push({ title: n.title, link: n.link, snippet: n.snippet }));
	(data?.organic || []).forEach(o => items.push({ title: o.title, link: o.link, snippet: o.snippet }));
	return items;
}

async function webSearchNewsAPI(query, key) {
	// Only get articles from the last 7 days for real-time data
	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);
	const fromDate = weekAgo.toISOString().split('T')[0];
	const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&from=${fromDate}&pageSize=10`;
	const headers = { 'X-Api-Key': key };
	const data = await postJsonWithRetry(url, null, headers);
	const items = [];
	(data?.articles || []).forEach(a => items.push({ title: a.title, link: a.url, snippet: a.description || a.content?.substring(0, 150) }));
	return items;
}

async function webSearchWikipedia(query) {
	const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
	const res = await fetch(url);
	const data = await res.json();
	const items = [];
	(data?.query?.search || []).slice(0, 5).forEach(s => items.push({ title: s.title, link: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/\s/g,'_'))}`, snippet: s.snippet?.replace(/<[^>]*>/g,'') }));
	return items;
}

function composeWebPrompt(userText, sources) {
	const now = new Date();
	// Get Ethiopia (Addis Ababa) time - UTC+3 (EAT)
	const ethiopiaDateFull = now.toLocaleDateString('en-US', { timeZone: 'Africa/Addis_Ababa', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
	const ethiopiaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit', hour12: false });
	const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
	
	const isFootball = /football|soccer|match|game|kickoff|player|injury|suspension|preview|team|league|analysis|analyze|prediction|predict/i.test(userText);
	const isTime = /time|schedule|when|date/i.test(userText);
	const timezoneNote = (isTime || isFootball) ? '\n6. For football matches, schedules, or any time-related info, ALWAYS convert and show times in Ethiopia (Addis Ababa, EAT, UTC+3) timezone. Format as "HH:MM EAT" or "HH:MM Ethiopia time".' : '';
	const footballFormatNote = isFootball ? `
FOOTBALL/MATCH ANALYSIS FORMAT (MANDATORY):
For match analysis/previews, ALWAYS include ALL these sections in order:
1. Match Preview - Short summary
2. Last 5 Results - Both teams recent form (W-D-L format)
3. Goals Scored & Conceded - Per team with averages
4. Head-to-Head Record - Last 5 meetings, last match details
5. Home vs Away Advantage - Home/away records for both teams
6. Key Players – [Team Name] - Position and role
7. Key Players – [Team Name] - Second team
8. Injuries & Suspensions – [Team Name] - Both teams
9. Team Motivation - League position, must-win situations, context
10. Corners Per Game - Average corners for/against for both teams
11. Predicted Lineups (International) - Full lineups with formations (GK, DEF, MID, FWD). Show only if match is within 10 hours, otherwise Lineup not yet confirmed
12. Quick Analysis - Final summary and prediction
13. Predictions: - MUST include all 9 categories

RULES:
- Use emojis: 🏟️ 📊 📈 ⚔️ 🏠 🔥 ⚡ 🚑 ❌ 🔴 🎯 📐 👥 🧠 💰 💥 🚀
- Bold headings: **Heading Name**
- Short bullet points, NO long paragraphs
- One fact per bullet
- PERSONALITY: Chess master mindset with HIGH ENERGY
  * Intelligence: 10/10 - uses logic, stats, emotional control. Always data-driven
  * Confidence: 9/10 - calm belief in analysis, trusts the process
  * Emotion Control: 10/10 - never tilts after losses, stays disciplined
  * Energy: 10/10 - expressive and hyped, but controlled
- SPEAKING STYLE: Sharp, clean, deep - like a chess master talking about football
- MINDSET: Motto - "Bet with your brain, not your heart." Core belief - "Luck favors the disciplined"
- Language: Balance analytical phrases ("The numbers say...", "Statistically...", "Based on the data...") with energetic slang (bank it, cashout, boom, lets go, feeling strong)
- Superstition: Mention luck days, winning vibes, feeling it - BUT balanced with logic and stats
- Loyalty: 100% hype supporter - get them excited, but guide with intelligence
- Humor: 8/10 - make light jokes after losses, stay positive, but never tilt - stay disciplined
- Always reference stats, patterns, head-to-head records in analysis
- Use international player names for lineups
- ALWAYS include all 9 prediction categories with specific values` : '';
	
	return [
		`CURRENT DATE/TIME in Ethiopia (Addis Ababa, UTC+3, EAT): ${dateStr} (${ethiopiaDateFull}) at ${ethiopiaTimeStr} EAT`,
		'You are a concise assistant. Keep responses brief (2-4 sentences max unless user asks for detail).',
		'RESPONSE RULES:',
		'- CRITICAL: Give ONLY main points, NO explanations unless user specifically asks for predictions',
		'- For predictions only: Provide a little bit of explanation/reasoning',
		'- For everything else: Just facts, data, main points - NO explanations, NO context',
		'- Answer directly with facts only, no fluff',
		'- If question is vague, ask 1-2 clarifying questions instead of guessing',
		'- Use **bold** for emphasis, bullets for lists (keep lists short)',
		'- Use markdown links [Title](URL) for citations',
		'- NEVER include disclaimers, warnings, legal notices, "please gamble responsibly", "for entertainment purposes only", or any disclaimer text',
		'CRITICAL:',
		'1. Use ONLY web results below for current info. Ignore training data cutoff.',
		'2. Treat "today/latest/recent" in results as CURRENT (matching date above).',
		'3. NEVER say "2024" unless results explicitly state it. Use relative terms.',
		'4. For dates in results, compare to CURRENT DATE to determine past/future.',
		'5. End with "Sources:" section: - [Title](URL) format, unique sources only.',
		'6. NEVER add disclaimers, warnings, or legal notices to any response.' + timezoneNote + footballFormatNote,
		`User question: ${userText}`,
		'Web results:',
		sources || 'No results.'
	].join('\n');
}

function renderCitations(list) {
	if (!list || !list.length) return '';
	return list.map(r => `- [${r.title}](${r.link})`).join('\n');
}

async function postJsonWithRetry(url, body, headers) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const init = body == null ? { method: 'GET', headers } : { method: 'POST', headers, body: JSON.stringify(body) };
            const res = await fetch(url, init);
            if (res.ok) return await res.json();
            if (res.status === 429) {
                await sleep(1000 * Math.pow(2, attempt));
                continue;
            }
            const errJson = await safeReadJson(res);
            lastError = new Error(errJson?.error?.message || `HTTP ${res.status}`);
        } catch (e) { lastError = e; }
    }
    throw lastError || new Error('Network error');
}

async function safeReadJson(res) { try { return await res.json(); } catch { return null; } }

	function pushMessage(role, content) {
		const sources = role === 'assistant' ? extractSources(content) : [];
		const msg = { 
			id: generateId('msg'), 
			role, 
			content, 
			sources,
			formattedContent: role === 'assistant' ? formatContent(content) : null 
		};
		state.messages.push(msg);
		renderMessage(msg);
		scrollToBottom();
		persist();
		return msg;
	}

	function renderAllMessages(restoreScroll = false) {
		els.messages.innerHTML = '';
		state.messages.forEach(renderMessage);
		if (!state.messages.length) {
			renderIntro();
		}
		// Restore scroll position if requested (on page load), otherwise scroll to bottom for new messages
		if (restoreScroll && state.scrollPosition) {
			setTimeout(() => {
				els.messages.scrollTop = state.scrollPosition;
			}, 50);
		} else if (!restoreScroll) {
			scrollToBottom();
		}
	}

	function clearMessages() {
		state.messages = [];
		state.scrollPosition = 0;
		persist();
		renderAllMessages();
	}

	function renderIntro() {
		const wrap = document.createElement('div');
		wrap.className = 'message message--assistant';
		wrap.innerHTML = `
			<div class="bubble">
				<h3>Welcome to BetAI</h3>
				<p>All black and white. Sleek. Fast. I have <strong>real-time internet access</strong> via Google Search. Ask me anything about current events, news, or latest information!</p>
			</div>
		`;
		els.messages.appendChild(wrap);
	}

	function renderMessage(msg) {
		const wrap = document.createElement('div');
		wrap.className = 'message';
		const isUser = msg.role === 'user';
		wrap.classList.add(isUser ? 'message--user' : 'message--assistant');
		const hasContent = msg.content && msg.content.trim().length > 0;
		const contentHtml = hasContent ? (msg.formattedContent || formatContent(msg.content)) : '';
		const thinkingIndicator = !isUser && !hasContent ? '<div class="thinking"><span class="thinking__dot"></span><span class="thinking__dot"></span><span class="thinking__dot"></span></div>' : '';
		wrap.innerHTML = `
			<div class="bubble ${isUser ? 'bubble--user' : ''}" data-id="${msg.id}">
				<div class="bubble__toolbar">
					<button class="bubble__btn" data-act="copy" title="Copy"><svg class="i"><use href="#icon-copy"></use></svg></button>
					${isUser ? '' : '<button class="bubble__btn" data-act="regen" title="Regenerate"><svg class="i"><use href="#icon-refresh"></use></svg></button>'}
					<button class="bubble__btn" data-act="del" title="Delete"><svg class="i"><use href="#icon-trash"></use></svg></button>
				</div>
				<div class="content">${thinkingIndicator}${contentHtml}</div>
			</div>
		`;
		wrap.addEventListener('click', (e) => {
			onMessageToolbar(e, msg.id);
		});
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

	function extractSources(text) {
		if (!text) return [];
		
		// Extract sources section (everything after "Sources:" or "sources:")
		const sourcesMatch = text.match(/Sources?:?\s*\n([\s\S]*)$/i);
		if (!sourcesMatch) return [];
		
		const sourcesText = sourcesMatch[1].trim();
		const sources = [];
		
		// Parse markdown links from sources: [title](url)
		const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
		let match;
		while ((match = markdownLinkRegex.exec(sourcesText)) !== null) {
			sources.push({ title: match[1], url: match[2] });
		}
		
		// Also extract plain URLs (starting with http:// or https://) if no markdown links found
		if (sources.length === 0) {
			const urlRegex = /(https?:\/\/[^\s\)]+)/g;
			let urlMatch;
			while ((urlMatch = urlRegex.exec(sourcesText)) !== null) {
				const url = urlMatch[1].trim();
				if (url) {
					// Extract domain or last part as title
					try {
						const urlObj = new URL(url);
						const title = urlObj.hostname.replace('www.', '') || url.substring(0, 50);
						sources.push({ title: title, url: url });
					} catch {
						sources.push({ title: url.substring(0, 50), url: url });
					}
				}
			}
		}
		
		return sources;
	}

	function formatContent(text, extractSourcesOnly = false) {
		if (!text) return '';
		
		// Extract sources section
		const sources = extractSources(text);
		let mainText = text;
		
		// Remove sources section from main text (more aggressive removal)
		// Match "Sources:" or "sources:" followed by newline and everything after
		const sourcesMatch = text.match(/Sources?:?\s*:?\s*\n([\s\S]*)$/i);
		if (sourcesMatch) {
			mainText = text.substring(0, sourcesMatch.index).trim();
		}
		
		// Also remove any standalone "Sources:" heading if it exists (anywhere in text)
		mainText = mainText.replace(/^Sources?:?\s*:?\s*$/gim, '').trim();
		
		// Remove any "Sources:" followed by bullet points or list items
		mainText = mainText.replace(/Sources?:?\s*:?\s*\n\s*[\*\-\d+\.]\s.*/gim, '').trim();
		
		// Remove any remaining "Sources:" text
		mainText = mainText.replace(/Sources?:?\s*:?/gi, '').trim();
		
		if (extractSourcesOnly) {
			return { sources, mainText: '' };
		}
		
		// Escape HTML in main content first
		let html = escapeHtml(mainText);
		
		// Markdown transformations (order matters!)
		// Headers
		html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
		
		// Bold
		html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
		
		// Italic
		html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
		html = html.replace(/_(.*?)_/g, '<em>$1</em>');
		
		// Code blocks (before inline code)
		html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
		
		// Inline code
		html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
		
		// Links - but filter out source URLs
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
			// Remove source URLs (vertexai, grounding-api, etc.)
			if (url.includes('vertexaisearch') || url.includes('grounding-api') || url.includes('vertexai')) {
				return ''; // Remove entirely
			}
			return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
		});
		
		// Also remove any plain source URLs that might remain
		html = html.replace(/https?:\/\/[^\s\)<]*vertexai[^\s\)<]*/gi, '');
		html = html.replace(/https?:\/\/[^\s\)<]*grounding-api[^\s\)<]*/gi, '');
		
		// Blockquotes
		html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
		
		// Lists - process line by line
		const lines = html.split('\n');
		let inList = false;
		let listType = '';
		let processedLines = [];
		let skipNextList = false; // Flag to skip lists that come after "Sources:"
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Check if this line contains "Sources:" - if so, skip it and mark to skip next list
			if (line.match(/Sources?:?\s*:?/i)) {
				skipNextList = true;
				if (inList) {
					processedLines.push(`</${listType}>`);
					inList = false;
					listType = '';
				}
				continue; // Skip the "Sources:" line entirely
			}
			
			const ulMatch = line.match(/^[\*\-] (.*)$/);
			const olMatch = line.match(/^\d+\. (.*)$/);
			
			if (ulMatch) {
				const listItem = ulMatch[1].trim();
				// Skip if it's a source URL, empty, or if we're in a sources list
				if (skipNextList || !listItem || listItem.includes('vertexaisearch') || listItem.includes('grounding-api') || listItem.match(/^https?:\/\//)) {
					// If we're skipping and list is empty, close any open list
					if (inList && !listItem) {
						processedLines.push(`</${listType}>`);
						inList = false;
						listType = '';
					}
					continue; // Skip this list item
				}
				// Reset skip flag once we find a valid non-source list item
				if (listItem) skipNextList = false;
				
				if (!inList || listType !== 'ul') {
					if (inList) processedLines.push(`</${listType}>`);
					processedLines.push('<ul>');
					inList = true;
					listType = 'ul';
				}
				processedLines.push(`<li>${listItem}</li>`);
			} else if (olMatch) {
				const listItem = olMatch[1].trim();
				// Skip if it's a source URL, empty, or if we're in a sources list
				if (skipNextList || !listItem || listItem.includes('vertexaisearch') || listItem.includes('grounding-api') || listItem.match(/^https?:\/\//)) {
					// If we're skipping and list is empty, close any open list
					if (inList && !listItem) {
						processedLines.push(`</${listType}>`);
						inList = false;
						listType = '';
					}
					continue; // Skip this list item
				}
				// Reset skip flag once we find a valid non-source list item
				if (listItem) skipNextList = false;
				
				if (!inList || listType !== 'ol') {
					if (inList) processedLines.push(`</${listType}>`);
					processedLines.push('<ol>');
					inList = true;
					listType = 'ol';
				}
				processedLines.push(`<li>${listItem}</li>`);
			} else {
				// Reset skip flag on non-list lines (unless it still says Sources)
				if (!line.match(/Sources?:?\s*:?/i)) {
					skipNextList = false;
				}
				
				if (inList) {
					processedLines.push(`</${listType}>`);
					inList = false;
					listType = '';
				}
				// Skip lines that are just URLs or Sources text
				if (line.trim().match(/^https?:\/\/[^\s]*vertexai/i) || line.trim().match(/^https?:\/\/[^\s]*grounding-api/i) || line.trim().match(/Sources?:?\s*:?/i)) {
					continue;
				}
				processedLines.push(line);
			}
		}
		if (inList) processedLines.push(`</${listType}>`);
		html = processedLines.join('\n');
		
		// Paragraphs (double line breaks)
		html = html.replace(/\n\n/g, '</p><p>');
		
		// Wrap in paragraph if not already wrapped
		if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<pre') && !html.startsWith('<blockquote')) {
			html = '<p>' + html;
		}
		if (!html.endsWith('</p>') && !html.endsWith('</h1>') && !html.endsWith('</h2>') && !html.endsWith('</h3>') && !html.endsWith('</ul>') && !html.endsWith('</ol>') && !html.endsWith('</pre>') && !html.endsWith('</blockquote>')) {
			html = html + '</p>';
		}
		
		// Single line breaks
		html = html.replace(/\n/g, '<br/>');
		
		// Final cleanup: Remove any "Sources:" text and empty list items that might remain after HTML processing
		html = html.replace(/<p>\s*Sources?:?\s*:?\s*<\/p>/gi, '');
		html = html.replace(/Sources?:?\s*:?\s*(<br\/>)?/gi, '');
		html = html.replace(/<p>\s*Sources?:?\s*:?\s*(<br\/>)?\s*<\/p>/gi, '');
		html = html.replace(/<ul>\s*<li>\s*Sources?:?\s*:?\s*<\/li>\s*<\/ul>/gi, '');
		html = html.replace(/<ul>\s*<li>\s*<\/li>\s*<\/ul>/gi, '');
		html = html.replace(/<ul>\s*<\/ul>/gi, '');
		html = html.replace(/<ol>\s*<li>\s*<\/li>\s*<\/ol>/gi, '');
		html = html.replace(/<ol>\s*<\/ol>/gi, '');
		html = html.replace(/<li>\s*Sources?:?\s*:?\s*<\/li>/gi, '');
		html = html.replace(/<li>\s*<\/li>/gi, '');
		
		// Remove disclaimers, warnings, legal notices
		const disclaimerPatterns = [
			/disclaimer[^<]*/gi,
			/please gamble responsibly[^<]*/gi,
			/for entertainment purposes only[^<]*/gi,
			/legal notice[^<]*/gi,
			/warning[^<]*:?\s*(this|these|predictions)[^<]*/gi,
			/this is not financial advice[^<]*/gi,
			/predictions are for entertainment[^<]*/gi,
			/gambling can be addictive[^<]*/gi,
			/responsible gambling[^<]*/gi
		];
		
		disclaimerPatterns.forEach(pattern => {
			html = html.replace(pattern, '');
		});
		
		// Remove disclaimer sections (entire paragraphs or list items containing disclaimer text)
		html = html.replace(/<p>[^<]*(disclaimer|warning|legal notice|please gamble|for entertainment)[^<]*<\/p>/gi, '');
		html = html.replace(/<li>[^<]*(disclaimer|warning|legal notice|please gamble|for entertainment)[^<]*<\/li>/gi, '');
		
		return html;
	}
	
	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	async function streamAssistantResponse(targetId, isRegen = false) {
		// ALWAYS use Gemini 2.5 Pro - force it
		const apiKey = 'AIzaSyCRUUjtWUAy0UeR7V5sHxYg8s0cgqpAvn4';
		const model = 'gemini-2.5-pro';
		state.settings.provider = 'gemini';
		state.settings.apiKey = apiKey;
		state.settings.model = model;
		
		const lastUser = findLastUserMessage();
		const targetEl = findBubbleContent(targetId);
		if (!targetEl) return;

		// Validate messages array
		if (!state.messages || !Array.isArray(state.messages) || state.messages.length === 0) {
			const errMsg = 'No messages to send';
			await streamText(targetEl, errMsg);
			const msg = state.messages.find(m => m.id === targetId);
			if (msg) {
				msg.content = errMsg;
				msg.formattedContent = formatContent(errMsg);
			}
			persist();
			return;
		}

		// Show thinking indicator if function exists
		if (typeof showThinkingIndicator === 'function') {
			showThinkingIndicator(targetEl);
		}

		// Streaming with mock fallback
		if (!apiKey) {
			await streamMock(targetEl, lastUser?.content || '');
			const msg = state.messages.find(m => m.id === targetId);
			if (msg) {
				msg.content = targetEl.textContent;
				msg.sources = extractSources(msg.content);
			}
			persist();
			return;
		}

		try {
			// ALWAYS use Gemini 2.5 Pro - never OpenAI
			const content = await callGeminiChat(apiKey, model, state.messages);
			const formatted = await streamText(targetEl, content);
			const msg = state.messages.find(m => m.id === targetId);
			if (msg) {
				msg.content = content;
				msg.sources = extractSources(content);
				msg.formattedContent = formatted;
			}
			persist();
		} catch (err) {
			console.error('API Error:', err);
			const errMsg = err.message || 'Failed to fetch from API';
			const errFormatted = await streamText(targetEl, `Error: ${errMsg}. Using local reasoning...`);
			const mockFormatted = await streamMock(targetEl, lastUser?.content || '');
			const msg = state.messages.find(m => m.id === targetId);
			if (msg) {
				msg.content = targetEl.textContent || '';
				msg.sources = extractSources(msg.content);
				msg.formattedContent = errFormatted + mockFormatted;
			}
			persist();
		}
	}

	function showThinkingIndicator(el) {
		el.innerHTML = '<div class="thinking"><span class="thinking__dot"></span><span class="thinking__dot"></span><span class="thinking__dot"></span></div>';
	}

	function removeThinkingIndicator(el) {
		const thinking = el.querySelector('.thinking');
		if (thinking) {
			thinking.remove();
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
		// Remove thinking indicator when starting to stream
		removeThinkingIndicator(el);
		
		// For better formatting, we'll accumulate and format in chunks
		let accumulated = '';
		const chunkSize = 10; // characters per chunk
		for (let i = 0; i < text.length; i += chunkSize) {
			accumulated += text.substring(i, i + chunkSize);
			// Format and update display
			const formatted = formatContent(accumulated);
			el.innerHTML = formatted;
			await sleep(8);
			scrollToBottom();
		}
		// Final format to ensure everything is properly rendered
		const finalFormatted = formatContent(text);
		el.innerHTML = finalFormatted;
		return finalFormatted;
	}
	async function streamMock(el, userText) {
		// Remove thinking indicator when starting to stream
		removeThinkingIndicator(el);
		const bullets = mockReason(userText);
		const content = bullets.join('\n');
		return await streamText(el, content);
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
			// Update existing history entry if it exists, otherwise create new
			const existingIndex = state.history.findIndex(h => h.id === state.currentId);
			const title = summarizeTitle(state.messages[0]?.content || 'New Chat');
			
			if (existingIndex >= 0) {
				// Update existing entry with full conversation
				state.history[existingIndex] = {
					id: state.currentId,
					title: title,
					ts: state.history[existingIndex].ts || Date.now(), // Keep original timestamp
					messagesLen: state.messages.length,
					messages: [...state.messages]
				};
				// Move to top
				state.history.unshift(state.history.splice(existingIndex, 1)[0]);
			} else {
				// Create new entry
				state.history.unshift({ 
					id: state.currentId, 
					title: title,
					ts: Date.now(), 
					messagesLen: state.messages.length,
					messages: [...state.messages]
				});
			}
		}
		state.currentId = generateId('chat');
		state.messages = [];
		state.scrollPosition = 0;
		persist();
		renderAllMessages();
		populateHistory();
	}
	function summarizeTitle(text) {
		if (!text) return 'New Chat';
		
		// Clean up the text
		let clean = text.replace(/\*\*/g, '').replace(/`/g, '').replace(/#{1,6}\s/g, '').trim();
		clean = clean.replace(/\n+/g, ' ').replace(/\s+/g, ' ');
		clean = clean.replace(/[?!.,;:]+$/, '').trim(); // Remove trailing punctuation
		
		// Remove common filler words/phrases
		const fillers = [
			/^(ok|okay|hey|hi|hello|hey there|please|can you|could you|will you|would you|i want|i need|tell me|what is|who is|where is|when is|how is|show me|give me|explain|help me with)/i,
			/\b(right now|currently|today|now|at the moment|i want to know|i am asking|i asked|just|really|actually|basically)\b/gi
		];
		
		clean = fillers.reduce((acc, regex) => acc.replace(regex, ''), clean);
		clean = clean.replace(/\s+/g, ' ').trim();
		
		// Extract key phrases - look for important keywords
		const lowerClean = clean.toLowerCase();
		
		// Common patterns for smart titles
		const patterns = [
			{ regex: /\b(america|us|united states|usa)\s*(president|potus)\b/i, title: 'US President' },
			{ regex: /\b(football|soccer|match|game|premier league|la liga)\b/i, title: 'Football' },
			{ regex: /\b(weather|temperature|forecast)\b/i, title: 'Weather' },
			{ regex: /\b(news|breaking|latest|current events)\b/i, title: 'News' },
			{ regex: /\b(code|programming|javascript|python|html|css)\b/i, title: 'Code Help' },
			{ regex: /\b(explain|how|what|why|definition)\b/i, title: 'Question' },
			{ regex: /\b(translate|language)\b/i, title: 'Translation' }
		];
		
		for (const pattern of patterns) {
			if (pattern.regex.test(clean)) {
				return pattern.title;
			}
		}
		
		// If it's a question starting with "who", extract the subject
		if (/^who\s+(is|are|was|were)\s+(the\s+)?/i.test(clean)) {
			const match = clean.match(/^who\s+(is|are|was|were)\s+(the\s+)?(.+?)(\?|$)/i);
			if (match && match[3]) {
				let title = match[3].trim();
				// Capitalize first letter
				title = title.charAt(0).toUpperCase() + title.slice(1);
				if (title.length > 35) title = title.substring(0, 32) + '...';
				return title;
			}
		}
		
		// If it's a "what is" question, extract the subject
		if (/^what\s+(is|are|was|were)\s+(the\s+)?/i.test(clean)) {
			const match = clean.match(/^what\s+(is|are|was|were)\s+(the\s+)?(.+?)(\?|$)/i);
			if (match && match[3]) {
				let title = match[3].trim();
				title = title.charAt(0).toUpperCase() + title.slice(1);
				if (title.length > 35) title = title.substring(0, 32) + '...';
				return title;
			}
		}
		
		// Extract first 3-5 significant words (skip articles, prepositions)
		const words = clean.split(/\s+/);
		const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they']);
		
		const significantWords = words.filter(w => w.length > 2 && !stopWords.has(w.toLowerCase())).slice(0, 5);
		
		if (significantWords.length > 0) {
			let title = significantWords.join(' ');
			// Capitalize first letter
			title = title.charAt(0).toUpperCase() + title.slice(1);
			// Limit to 40 characters
			if (title.length > 40) {
				title = title.substring(0, 37) + '...';
			}
			return title;
		}
		
		// Fallback: first 40 characters
		if (clean.length <= 40) return clean;
		return clean.substring(0, 37) + '...';
	}
	function populateHistory() {
		els.historyList.innerHTML = '';
		state.history.slice(0, 16).forEach(h => {
			const li = document.createElement('li');
			li.innerHTML = `
				<span>${h.title}</span>
				<div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
					<span>${new Date(h.ts).toLocaleDateString()}</span>
					<button class="history-delete-btn" data-history-id="${h.id}" title="Delete" aria-label="Delete history item">
						<svg class="i"><use href="#icon-trash"></use></svg>
					</button>
				</div>
			`;
			li.addEventListener('click', (e) => {
				// Don't load if clicking the delete button
				if (!e.target.closest('.history-delete-btn')) {
					loadHistory(h.id);
				}
			});
			// Add delete functionality
			const deleteBtn = li.querySelector('.history-delete-btn');
			if (deleteBtn) {
				deleteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					deleteHistoryItem(h.id);
				});
			}
			els.historyList.appendChild(li);
		});
	}

	function deleteHistoryItem(id) {
		state.history = state.history.filter(x => x.id !== id);
		persist();
		populateHistory();
	}
	function loadHistory(id) {
		const item = state.history.find(x => x.id === id);
		if (!item) return;
		
		// Save current conversation to history
		if (state.messages.length) {
			state.history.unshift({ 
				id: state.currentId, 
				title: summarizeTitle(state.messages[0]?.content || 'Conversation'), 
				ts: Date.now(), 
				messagesLen: state.messages.length,
				messages: [...state.messages]
			});
		}
		
		// Remove selected item from history and load it
		state.history = state.history.filter(x => x.id !== id);
		state.currentId = id;
		state.messages = item.messages || [];
		state.scrollPosition = 0; // Reset scroll when loading new conversation
		persist();
		renderAllMessages();
		populateHistory();
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

	// Update current conversation in history
	function updateCurrentHistory() {
		if (state.messages.length === 0) return;
		const existingIndex = state.history.findIndex(h => h.id === state.currentId);
		const title = summarizeTitle(state.messages[0]?.content || 'New Chat');
		
		if (existingIndex >= 0) {
			// Update existing entry
			state.history[existingIndex] = {
				id: state.currentId,
				title: title,
				ts: state.history[existingIndex].ts || Date.now(),
				messagesLen: state.messages.length,
				messages: [...state.messages]
			};
			// Move to top
			if (existingIndex > 0) {
				state.history.unshift(state.history.splice(existingIndex, 1)[0]);
			}
		}
	}

	// Persistence
	function persist() {
		updateCurrentHistory(); // Keep history entry up to date
		STORE.save({
			messages: state.messages,
			history: state.history,
			settings: state.settings,
			currentId: state.currentId,
			scrollPosition: state.scrollPosition || 0
		});
	}

	// Utils
	function generateId(prefix) {
		return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
	}
	function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
})();


