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
		googleCseId: document.getElementById('googleCseId'),
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
		settings: { apiKey: 'csk-j9njfnrf9tctv246fdtph3xht6dh8pfrpmr3jnhrcyjpr38k', model: 'gpt-oss-120b', provider: 'cerebras', speechEngine: 'browser', searchProvider: 'browser', searchKey: 'AIzaSyBGOCzmup_XqlMK1z1rN1vQKLBtUJfMI_g', googleCseId: '624ea501b034f402e', searchAuto: true, searchWiki: true },
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

// Use Cerebras API
state.settings.apiKey = 'csk-j9njfnrf9tctv246fdtph3xht6dh8pfrpmr3jnhrcyjpr38k';
state.settings.provider = 'cerebras';
state.settings.model = 'gpt-oss-120b';
state.settings.searchAuto = true; // Enable auto-search

	// UI bootstrap
	populateHistory();
	els.apiKey.value = state.settings.apiKey || '';
els.model.value = state.settings.model || 'gpt-oss-120b';
	if (els.provider) { els.provider.value = state.settings.provider || 'cerebras'; }
	if (els.speechEngine) { els.speechEngine.value = state.settings.speechEngine || 'browser'; }
if (els.searchProvider) els.searchProvider.value = state.settings.searchProvider || 'browser';
if (els.searchKey) els.searchKey.value = state.settings.searchKey || 'AIzaSyBGOCzmup_XqlMK1z1rN1vQKLBtUJfMI_g';
if (els.googleCseId) els.googleCseId.value = state.settings.googleCseId || '624ea501b034f402e';
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
		// Use Cerebras API
		state.settings.apiKey = (els.apiKey?.value || 'csk-j9njfnrf9tctv246fdtph3xht6dh8pfrpmr3jnhrcyjpr38k').trim();
		state.settings.model = (els.model?.value || 'gpt-oss-120b').trim();
		state.settings.provider = (els.provider?.value || 'cerebras');
		state.settings.speechEngine = (els.speechEngine?.value || 'browser');
		state.settings.searchProvider = (els.searchProvider?.value || 'browser');
		state.settings.searchKey = (els.searchKey?.value || 'AIzaSyBGOCzmup_XqlMK1z1rN1vQKLBtUJfMI_g').trim();
		state.settings.googleCseId = (els.googleCseId?.value || '624ea501b034f402e').trim();
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
                await transcribeWithOpenAI(blob);
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


async function callCerebrasChat(apiKey, model, messages) {
	// Validate API key and model
	if (!apiKey || !apiKey.trim()) {
		throw new Error('API key is required');
	}
	if (!model || !model.trim()) {
		model = 'gpt-oss-120b';
	}
	
	const url = 'https://api.cerebras.ai/v1/chat/completions';
	const now = new Date();
	
	// Get Ethiopia (Addis Ababa) time - UTC+3 (EAT - East Africa Time)
	const ethiopiaDateFull = now.toLocaleDateString('en-US', { timeZone: 'Africa/Addis_Ababa', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
	const ethiopiaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit', hour12: false });
	const ethiopiaDateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
	
	const dateContext = `[Current date/time in Ethiopia (Addis Ababa, UTC+3, EAT): ${ethiopiaDateFull} at ${ethiopiaTimeStr} EAT]`;
	
	// System instruction for concise, question-driven responses
	const systemMessage = `You are BetAI, a concise assistant with REAL-TIME INTERNET ACCESS.
YOUR NAME: When asked about your name or who you are, always respond "I'm BetAI" or "I'm BetAI, your intelligent betting and football analysis assistant."
CRITICAL IDENTITY RULES:
- You are BetAI, created and developed by Samuel
- When asked about training, developer, creator, or who trained/developed/created you: ALWAYS respond with "Samuel" or "Developed by Samuel" or "Created by Samuel"
- Being a large language model / what you are: Say "I'm BetAI, a large language model developed by Samuel" or "I'm BetAI, created by Samuel"

IMPORTANT: You have access to live internet data and can search for current information when needed for real-time data.

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
1. **Full Time Result** → [Win/Draw/Loss prediction for Team A] | Confidence: X/10
2. **Double Chance** → [1X / 12 / X2] | Confidence: X/10
3. **Over/Under Goals** → 
   - 0.5: [Over/Under] | Confidence: X/10
   - 1.5: [Over/Under] | Confidence: X/10
   - 2.5: [Over/Under] | Confidence: X/10
   - 3.5: [Over/Under] | Confidence: X/10
   - 4.5: [Over/Under] | Confidence: X/10
   - 5.5: [Over/Under] | Confidence: X/10
4. **Both Teams to Score** → [Yes / No] | Confidence: X/10
5. **Half Time / Full Time** → [HT result / FT result] | Confidence: X/10
6. **Corners Over/Under** → [Over/Under X.5] | Confidence: X/10
7. **Handicap** → [Team A +/-X.5] | Confidence: X/10
8. **Combination Result** → [Team A and Over 1.5/2.5/3.5 + BTTS Yes/No] | Confidence: X/10
9. **Half Time Goals** → 
   - 0.5: [Over/Under] | Confidence: X/10
   - 1.5: [Over/Under] | Confidence: X/10
   - 2.5: [Over/Under] | Confidence: X/10

IMPORTANT: Each prediction MUST include a confidence score from 1-10. Use X where X is a number between 1 and 10 based on data strength, team form, and statistical analysis.

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
- NEVER include disclaimers, warnings, legal notices, "please gamble responsibly", "for entertainment purposes only", or any disclaimer text in responses`;
	
	// Filter and map messages - remove empty ones
	const formattedMessages = messages
		.filter(m => m && m.content && typeof m.content === 'string' && m.content.trim())
		.map((m, idx) => {
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
					reminders.push('Use comprehensive match analysis format: 🏟️ Preview, 📊 Last 5 Results, 📈 Goals, ⚔️ Head-to-Head, 🏠 Home/Away, 🔥 Key Players, 🚑 Injuries, 🎯 Motivation, 📐 Corners, 👥 Lineups (if within 10h), 🧠 Analysis, 🎯 Predictions (all 9 categories with confidence scores out of 10 for each). PERSONALITY: Chess master mindset with HIGH ENERGY. Intelligence 10/10 - use logic, stats, emotional control. Balance analytical phrases ("The numbers say...", "Statistically...") with energetic slang ("bank it", "boom!", "let\'s go!"). Motto: "Bet with your brain, not your heart" - "Luck favors the disciplined". Sharp, clean, deep analysis but expressive. Never tilt - stay disciplined. Use emojis 💰💥🚀🎯, bold headings, short bullets - NO long paragraphs.');
				}
				if (isTime || isFootball) {
					reminders.push('Use Ethiopia (Addis Ababa, EAT) timezone for all times.');
				}
				const reminderText = reminders.length > 0 ? ' ' + reminders.join(' ') + ' ' : '';
				text = `[Your identity: You are BetAI, developed by Samuel. When asked about your creator/developer, always say "Samuel" or "Developed by Samuel". You have real-time internet access. Use it for current info.${reminderText}CRITICAL: Give ONLY main points, NO explanations unless I specifically ask for predictions. For predictions only: provide a little explanation. For everything else: just facts, no explanations. NEVER include disclaimers, warnings, or legal notices.]\n\n${text}`;
			}
			
			return {
				role: m.role === 'assistant' ? 'assistant' : 'user',
				content: text
			};
		});
	
	// Ensure we have at least one message
	if (formattedMessages.length === 0) {
		throw new Error('No valid messages to send');
	}
	
	// Add system message at the beginning
	const allMessages = [
		{ role: 'system', content: systemMessage },
		...formattedMessages
	];
    
	const body = { 
		model: model.trim(),
		messages: allMessages
	};
    
	const data = await postJsonWithRetry(url, body, { 
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${apiKey.trim()}`
	});
	
	const text = data?.choices?.[0]?.message?.content || '';
	return text || (data?.error?.message ? `Cerebras: ${data.error.message}` : 'Sorry, no response.');
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


	function blobToBase64(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve((r.result||'').toString().split(',')[1]||''); r.onerror = reject; r.readAsDataURL(blob); }); }

function shouldUseWebSearch(text) {
	if (!state.settings.searchAuto) {
		// FORCE search for match queries even if auto-search is off
		const q = (text || '').toLowerCase();
		if (q.includes('today') && (q.includes('match') || q.includes('game') || q.includes('fixture'))) {
			return true; // Always search for "today match" queries
		}
		return false;
	}
	// Browser search doesn't require API key, so we can always use it if auto-search is enabled
	const q = (text || '').toLowerCase();
	const triggers = ['today', 'now', 'latest', 'breaking', 'this week', 'this month', 'live', 'score', 'fixture', 'transfer', 'trending', 'news'];
	const footballTriggers = ['match', 'matches', 'game', 'games', 'football', 'soccer', 'team', 'teams', 'player', 'players', 'league', 'premier', 'champions league', 'la liga', 'serie a', 'bundesliga', 'kickoff', 'kick off', 'preview', 'result', 'results'];
	// Always search for football/match queries or time-sensitive queries
	return triggers.some(t => q.includes(t)) || footballTriggers.some(t => q.includes(t));
}

async function webAugmentedAnswer(userText, targetId) {
	let results = [];
	const isFootballQuery = /football|soccer|match|matches|game|games|team|player|league|fixture|score|kickoff|preview/i.test(userText);
	
	try {
		const provider = state.settings.searchProvider || 'browser';
		if (provider === 'browser') {
			// Use browser-based search (connects to Google and football websites)
			results = await webSearchBrowser(userText);
		} else if (provider === 'newsapi') {
			const key = (state.settings.searchKey || '').trim();
			if (key) {
				results = await webSearchNewsAPI(userText, key);
			}
		} else {
			// Serper (Google Search API) - best for football matches
			const key = (state.settings.searchKey || '').trim();
			if (key) {
				results = await webSearchSerper(userText, key);
			} else {
				// If no Serper key, use browser search
				results = await webSearchBrowser(userText);
			}
		}
	} catch (e) {
		console.warn('Search failed:', e);
		results = [];
	}
	
	if (!Array.isArray(results)) results = [];
	
	// For football queries, prioritize football sites and return more results
	const top = isFootballQuery ? results.slice(0, 8) : results.slice(0, 5);
	
	// If not enough results and wiki fallback is enabled, top up from Wikipedia
	if (top.length < 3 && state.settings.searchWiki && !isFootballQuery) {
		try {
			const wiki = await webSearchWikipedia(userText);
			wiki.forEach(w => { if (top.length < 8) top.push(w); });
		} catch {}
	}
	
	// Include snippets (actual content) not just titles/links - CRITICAL for real data
	const sources = top.map((r, i) => {
		const snippet = (r.snippet || '').trim();
		return `(${i+1}) Title: ${r.title}\nLink: ${r.link}\nContent: ${snippet || 'No snippet available'}`;
	}).join('\n\n');
	
	// If no real results found, don't let AI make up data
	if (top.length === 0 || !top.some(r => r.snippet && r.snippet.trim().length > 10)) {
		const contextMsg = composeWebPrompt(userText, 'NO_SEARCH_RESULTS_FOUND');
		const original = [...state.messages];
		state.messages.push({ id: generateId('msg'), role: 'user', content: contextMsg });
		try {
			const apiKey = state.settings.apiKey;
			const model = state.settings.model || 'gpt-oss-120b';
			const answer = await callCerebrasChat(apiKey, model, state.messages);
			const targetEl = findBubbleContent(targetId);
			if (targetEl) {
				const formatted = await streamText(targetEl, answer);
				const msg = state.messages.find(m => m.id === targetId);
				msg.content = answer;
				msg.formattedContent = formatted;
				persist();
			}
		} finally {
			state.messages = original;
		}
		return;
	}
	
	const contextMsg = composeWebPrompt(userText, sources);
	// Temporarily append a context message then ask Cerebras
	const original = [...state.messages];
	state.messages.push({ id: generateId('msg'), role: 'user', content: contextMsg });
	try {
		const apiKey = state.settings.apiKey;
		const model = state.settings.model || 'gpt-oss-120b';
		const answer = await callCerebrasChat(apiKey, model, state.messages);
		const targetEl = findBubbleContent(targetId);
		if (targetEl) {
			// Clean up duplicate sources if Cerebras didn't format properly
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

async function webSearchGoogleCSE(query, additionalParams = {}) {
	// 🌐 Google Custom Search Engine API - Best for searching internet
	const apiKey = state.settings.searchKey || 'AIzaSyBGOCzmup_XqlMK1z1rN1vQKLBtUJfMI_g';
	const cseId = state.settings.googleCseId || '624ea501b034f402e';
	
	if (!apiKey || !cseId) {
		throw new Error('Google CSE API key or ID not configured');
	}
	
	const isFootballQuery = /football|soccer|match|matches|game|games|team|player|league|fixture|score|kickoff|preview|result/i.test(query);
	const isTodayQuery = /today|now|live|current/i.test(query);
	
	// Enhance query for football searches - make it more specific for today's matches
	let enhancedQuery = query;
	if (isFootballQuery && isTodayQuery) {
		const now = new Date();
		const todayFull = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		const todayShort = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const todayISO = now.toISOString().split('T')[0]; // YYYY-MM-DD
		
		// Multiple query variations for better coverage
		enhancedQuery = `${query} ${todayFull} ${todayShort} ${todayISO} fixtures schedule live scores today matches`;
		// Also add site filters for reliable sources
		enhancedQuery += ' site:espn.com OR site:bbc.com/sport OR site:skysports.com OR site:fotmob.com OR site:livescore.com OR site:goal.com OR site:premierleague.com OR site:uefa.com OR site:theguardian.com/football';
	} else if (isFootballQuery) {
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		enhancedQuery = `${query} ${today} site:espn.com OR site:bbc.com/sport OR site:skysports.com OR site:fotmob.com OR site:livescore.com OR site:goal.com OR site:theguardian.com/football`;
	}
	
	// Build URL with optional parameters
	let url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cseId)}&q=${encodeURIComponent(enhancedQuery)}&num=10`;
	
	// Add date restriction for recent results if available
	if (additionalParams.dateRestrict) {
		url += `&dateRestrict=${additionalParams.dateRestrict}`;
	}
	
	// Add sort parameter for relevance
	if (additionalParams.sort) {
		url += `&sort=${additionalParams.sort}`;
	}
	
	try {
		const response = await fetch(url);
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('Google CSE API error:', response.status, errorData);
			throw new Error(`Google CSE API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
		}
		const data = await response.json();
		const items = [];
		
		// Process search results - CRITICAL: Include snippets (actual content)
		if (data.items && Array.isArray(data.items)) {
			data.items.forEach(item => {
				const url = (item.link || '').toLowerCase();
				const isFootballSite = /espn|bbc|sky|sport|football|fotmob|livescore|goal|guardian|telegraph|premierleague|uefa|soccer/i.test(url);
				const snippet = (item.snippet || item.htmlSnippet || '').trim();
				
				// Enhanced snippet: combine snippet with htmlSnippet if available
				let fullSnippet = snippet;
				if (item.htmlSnippet && item.htmlSnippet !== snippet) {
					// Remove HTML tags and combine
					const cleanHtml = item.htmlSnippet.replace(/<[^>]*>/g, ' ').trim();
					if (cleanHtml.length > snippet.length) {
						fullSnippet = cleanHtml.substring(0, 500); // Limit to 500 chars
					}
				}
				
				// Only include items with actual content (snippet)
				if (fullSnippet.length > 20) {
					// Score result quality (higher score = better)
					let qualityScore = 0;
					if (isFootballSite) qualityScore += 10;
					if (fullSnippet.length > 100) qualityScore += 5;
					if (fullSnippet.length > 200) qualityScore += 5;
					if (/today|live|fixture|match|score|kickoff|game/i.test(fullSnippet)) qualityScore += 5;
					if (/time|schedule|venue|stadium/i.test(fullSnippet)) qualityScore += 3;
					
					items.push({
						title: item.title || '',
						link: item.link || '',
						snippet: fullSnippet,
						priority: isFootballSite ? 0 : 1,
						qualityScore: qualityScore
					});
				}
			});
		}
		
		// Sort by priority first, then quality score
		items.sort((a, b) => {
			if (a.priority !== b.priority) return a.priority - b.priority;
			return (b.qualityScore || 0) - (a.qualityScore || 0);
		});
		
		console.log(`Google CSE found ${items.length} results with content for query: ${query}`);
		return items.slice(0, 15); // Return more results for better coverage
	} catch (e) {
		console.error('Google CSE search failed:', e);
		throw e;
	}
}

// Run multiple parallel searches for better coverage
async function webSearchGoogleCSEParallel(query) {
	const isTodayMatchQuery = /today.*match|today.*game|today.*fixture|match.*today|game.*today/i.test(query);
	
	if (!isTodayMatchQuery) {
		// Single search for non-"today" queries
		return await webSearchGoogleCSE(query);
	}
	
	// For "today's matches", run multiple searches in parallel for better results
	const searchQueries = [
		query, // Original query
		`${query} live scores fixtures`,
		`${query} today schedule kickoff times`,
		`${query} matches today results`
	];
	
	const searchPromises = searchQueries.map((q, index) => {
		// Stagger requests slightly to avoid rate limits
		return new Promise(resolve => {
			setTimeout(async () => {
				try {
					const results = await webSearchGoogleCSE(q, {
						dateRestrict: 'd1', // Last day only for real-time data
						sort: 'date' // Sort by date for newest first
					});
					resolve(results || []);
				} catch (e) {
					console.warn(`Parallel search ${index} failed:`, e);
					resolve([]);
				}
			}, index * 200); // 200ms delay between requests
		});
	});
	
	// Wait for all searches to complete
	const allResults = await Promise.all(searchPromises);
	
	// Merge and deduplicate results
	const mergedItems = [];
	const seenLinks = new Set();
	
	allResults.forEach(resultSet => {
		resultSet.forEach(item => {
			if (!seenLinks.has(item.link)) {
				seenLinks.add(item.link);
				mergedItems.push(item);
			}
		});
	});
	
	// Re-sort by priority and quality
	mergedItems.sort((a, b) => {
		if (a.priority !== b.priority) return a.priority - b.priority;
		return (b.qualityScore || 0) - (a.qualityScore || 0);
	});
	
	console.log(`Parallel search found ${mergedItems.length} unique results`);
	return mergedItems.slice(0, 15);
}

async function webSearchBrowser(query) {
	// 🌐 Browser-based search - uses Google Custom Search Engine API
	// Specifically searches Google and popular football websites for match info
	const items = [];
	const isFootballQuery = /football|soccer|match|matches|game|games|team|player|league|fixture|score|kickoff|preview|result/i.test(query);
	
	try {
		// Try Google Custom Search Engine API first (best option)
		const apiKey = state.settings.searchKey || 'AIzaSyBGOCzmup_XqlMK1z1rN1vQKLBtUJfMI_g';
		const cseId = state.settings.googleCseId || '624ea501b034f402e';
		
		if (apiKey && cseId) {
			try {
				// Use parallel search for better real-time data coverage
				const googleResults = await webSearchGoogleCSEParallel(query);
				googleResults.forEach(item => {
					if (!items.find(i => i.link === item.link)) {
						items.push(item);
					}
				});
			} catch (e) {
				console.warn('Google CSE search failed, trying alternatives:', e);
			}
		}
		
		// If we got good results from Google CSE, return them
		if (items.length >= 3) {
			return items.slice(0, 10);
		}
		
		// Fallback to DuckDuckGo for additional results
		try {
			let enhancedQuery = query;
			if (isFootballQuery) {
				const today = new Date().toISOString().split('T')[0];
				enhancedQuery = `${query} ${today}`;
			}
			
			const ddgApiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(enhancedQuery)}&format=json&no_html=1&skip_disambig=1`;
			const ddgRes = await fetch(ddgApiUrl);
			const ddgData = await ddgRes.json();
			
			// Add instant answer if available
			if (ddgData.AbstractText) {
				items.push({
					title: ddgData.Heading || query,
					link: ddgData.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
					snippet: ddgData.AbstractText,
					priority: 2
				});
			}
			
			// Add related topics
			if (ddgData.RelatedTopics) {
				ddgData.RelatedTopics.slice(0, 5).forEach(topic => {
					if (topic.Text && topic.FirstURL && !items.find(i => i.link === topic.FirstURL)) {
						const url = topic.FirstURL.toLowerCase();
						const isFootballSite = /espn|bbc|sky|sport|football|fotmob|livescore|goal|guardian|telegraph/i.test(url);
						
						items.push({
							title: topic.Text.substring(0, 150),
							link: topic.FirstURL,
							snippet: topic.Text.substring(0, 200),
							priority: isFootballSite ? 1 : 2
						});
					}
				});
			}
		} catch (e) {
			console.warn('DuckDuckGo search failed:', e);
		}
		
		// For football queries, add direct links to popular football sites
		if (isFootballQuery && items.length < 5) {
			const footballSites = [
				{ name: 'ESPN Football', url: `https://www.espn.com/soccer/` },
				{ name: 'BBC Sport', url: `https://www.bbc.com/sport/football` },
				{ name: 'Sky Sports', url: `https://www.skysports.com/football` },
				{ name: 'FotMob', url: `https://www.fotmob.com/` },
				{ name: 'LiveScore', url: `https://www.livescore.com/en/` }
			];
			
			footballSites.forEach(site => {
				if (!items.find(i => i.link.includes(site.url))) {
					items.push({
						title: `${query} - ${site.name}`,
						link: site.url,
						snippet: `Check ${site.name} for latest ${query} information`,
						priority: 0
					});
				}
			});
		}
		
		// Search Wikipedia for additional context (only if needed)
		if (items.length < 5 && state.settings.searchWiki) {
			try {
				const wikiResults = await webSearchWikipedia(query);
				wikiResults.forEach(w => {
					if (items.length < 10 && !items.find(i => i.link === w.link)) {
						items.push({ ...w, priority: 3 });
					}
				});
			} catch (e) {
				console.warn('Wikipedia search failed:', e);
			}
		}
		
		// Sort by priority and return top results
		items.sort((a, b) => (a.priority || 2) - (b.priority || 2));
		
		return items.slice(0, 10);
	} catch (e) {
		console.warn('Browser search failed, trying fallback:', e);
		// Fallback to Wikipedia
		try {
			return await webSearchWikipedia(query);
		} catch {
			// Last resort: return direct links to football sites
			if (isFootballQuery) {
				return [
					{ title: `${query} - ESPN`, link: `https://www.espn.com/soccer/`, snippet: 'Check ESPN for latest football information' },
					{ title: `${query} - BBC Sport`, link: `https://www.bbc.com/sport/football`, snippet: 'Check BBC Sport for latest football news' },
					{ title: `${query} - Sky Sports`, link: `https://www.skysports.com/football`, snippet: 'Check Sky Sports for latest football updates' }
				];
			}
			return [];
		}
	}
}

async function webSearchSerper(query, key) {
	const url = 'https://google.serper.dev/search';
	// Enhance query to prioritize recent results and football sites for match queries
	const isFootballQuery = /football|soccer|match|matches|game|games|team|player|league|fixture|score/i.test(query);
	let enhancedQuery = query;
	
	if (shouldUseWebSearch(query)) {
		enhancedQuery = query + ' latest 2025';
	}
	
	// For football queries, add popular football site filters
	if (isFootballQuery) {
		enhancedQuery += ' site:espn.com OR site:bbc.com/sport OR site:skysports.com OR site:fotmob.com OR site:livescore.com OR site:goal.com OR site:premierleague.com';
	}
	
	const body = { q: enhancedQuery, gl: 'us', hl: 'en', num: 15 };
	const headers = { 'X-API-KEY': key, 'Content-Type': 'application/json' };
	const data = await postJsonWithRetry(url, body, headers);
	const items = [];
	
	// Prioritize news results first (usually more current)
	(data?.news || []).forEach(n => {
		const url = (n.link || '').toLowerCase();
		const isFootballSite = /espn|bbc|sky|sport|football|fotmob|livescore|goal|guardian|telegraph|premierleague|uefa/i.test(url);
		items.push({ 
			title: n.title, 
			link: n.link, 
			snippet: n.snippet,
			priority: isFootballSite ? 0 : 1 // Football sites get higher priority
		});
	});
	
	// Add organic results
	(data?.organic || []).forEach(o => {
		const url = (o.link || '').toLowerCase();
		const isFootballSite = /espn|bbc|sky|sport|football|fotmob|livescore|goal|guardian|telegraph|premierleague|uefa/i.test(url);
		if (!items.find(i => i.link === o.link)) {
			items.push({ 
				title: o.title, 
				link: o.link, 
				snippet: o.snippet,
				priority: isFootballSite ? 0 : 2
			});
		}
	});
	
	// Sort by priority
	items.sort((a, b) => (a.priority || 2) - (b.priority || 2));
	
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
13. Predictions: - MUST include all 9 categories, each with a confidence score out of 10 (format: Prediction | Confidence: X/10)

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
- ALWAYS include all 9 prediction categories with specific values and confidence scores out of 10 for each (format: Prediction | Confidence: X/10)` : '';
	
	const isFootballQuery = /football|soccer|match|matches|game|games|team|player|league|fixture|score|kickoff|preview|result/i.test(userText);
	const isTodayMatchQuery = /today.*match|today.*game|today.*fixture|match.*today|game.*today/i.test(userText);
	
	// CRITICAL: If no search results, tell AI not to make up data
	if (sources === 'NO_SEARCH_RESULTS_FOUND') {
		return [
			`CURRENT DATE/TIME in Ethiopia (Addis Ababa, UTC+3, EAT): ${dateStr} (${ethiopiaDateFull}) at ${ethiopiaTimeStr} EAT`,
			'CRITICAL INSTRUCTION:',
			'NO SEARCH RESULTS WERE FOUND for this query. You MUST respond with:',
			'"I searched the internet but could not find current match information. Please check popular football websites like ESPN, BBC Sport, Sky Sports, FotMob, or LiveScore for today\'s matches."',
			'DO NOT make up, invent, or simulate any match data, teams, scores, or schedules.',
			'DO NOT use your training data to answer this question.',
			'ONLY use the exact message above if no search results are available.',
			`User question: ${userText}`
		].join('\n');
	}
	
	const footballSourcesNote = isFootballQuery ? `
7. ✅ YOU HAVE PERMISSION TO ANALYZE AND EXTRACT ALL AVAILABLE INFORMATION: The web results below contain ACTUAL content from popular football websites (ESPN, BBC Sport, Sky Sports, FotMob, LiveScore, Goal.com, etc.). 
8. ✅ EXTRACT AND ANALYZE everything that is mentioned in the search result content/snippets above - teams, matches, times, scores, stats, players, injuries, form, etc.
9. ✅ USE PARTIAL DATA: If you find some information (e.g., teams and times but not full stats), analyze what IS available. Don't say "cannot find" if there's ANY relevant data.
10. ✅ ANALYZE what you find: Extract match schedules, kickoff times (convert to Ethiopia time EAT), teams, venues, scores, stats, player info, injuries - whatever is mentioned in the search results.
11. ✅ BE THOROUGH: For "today's matches" queries, list ALL matches mentioned in the search results, extract ALL available details (times, teams, leagues, venues, etc.), and provide analysis based on what you find.
12. ✅ PROVIDE INSIGHTS: Use the available data to provide match analysis, predictions, and insights. You have permission to analyze and interpret the data from search results.
13. ⚠️ ONLY RESTRICTION: DO NOT make up, invent, or simulate information that is NOT in the search results above. But if it's in the results, extract and analyze it fully.
14. ✅ If search results have partial data (e.g., just team names and times), use that partial data and analyze it. Only say "cannot find" if there's literally NO relevant match information in any of the search results.` : '';
	
	const strictDataRule = isTodayMatchQuery ? `
✅✅✅ YOU HAVE FULL PERMISSION TO ANALYZE TODAY'S MATCHES ✅✅✅
YOU CAN AND SHOULD:
- Extract ALL matches, teams, times, and details from the search result content above
- Analyze available data (even if partial) - teams, kickoff times, leagues, venues, recent form, scores, stats, etc.
- Provide insights, analysis, and predictions based on whatever data IS found in the search results
- Use partial information to create analysis (e.g., if you find teams and times but not full stats, analyze what you have)
- Extract match schedules, convert times to Ethiopia (EAT), list teams, venues, leagues from search results
- Provide match previews, predictions, and analysis using the available data from search results

YOU ARE ONLY FORBIDDEN FROM:
- Making up match data that is NOT in the search results above
- Inventing teams, times, scores, or stats that don't appear in the search snippets
- Using your training data/knowledge cutoff if it contradicts or isn't supported by search results

BOTTOM LINE: Extract EVERYTHING you can find from the search results above and provide thorough analysis. Only say "cannot find" if there's literally ZERO relevant match information in all the search results.` : '';
	
	return [
		`CURRENT DATE/TIME in Ethiopia (Addis Ababa, UTC+3, EAT): ${dateStr} (${ethiopiaDateFull}) at ${ethiopiaTimeStr} EAT`,
		'You are BetAI, a concise assistant. Keep responses brief (2-4 sentences max unless user asks for detail).',
		'CRITICAL IDENTITY: You are BetAI. When asked about your name, respond "I\'m BetAI". You were CREATED and DEVELOPED by Samuel. When asked about training, developer, creator, or who trained/developed/created you: ALWAYS respond with "Samuel", "Developed by Samuel", "Created by Samuel", "Trained by Samuel", or "I\'m BetAI, a large language model developed by Samuel".',
		'',
		'✅✅✅ DATA EXTRACTION AND ANALYSIS RULES ✅✅✅',
		'1. EXTRACT AND ANALYZE ALL INFORMATION from the web search results provided below. You have FULL PERMISSION to use this data.',
		'2. BE THOROUGH: Extract teams, matches, times, scores, stats, players, injuries, form - EVERYTHING mentioned in the search results.',
		'3. USE PARTIAL DATA: If search results contain some information (e.g., teams and times but not full stats), analyze what IS available. Don\'t refuse to analyze if data is partial.',
		'4. PROVIDE INSIGHTS: Analyze the extracted data, provide match previews, predictions, and insights based on what you find in search results.',
		'5. ONLY RESTRICTION: DO NOT make up, invent, or simulate information that is NOT in the search results below.',
		'6. Treat "today/latest/recent" in results as CURRENT (matching date above).',
		'7. NEVER say "2024" or any past year unless results explicitly state it. Use relative terms.',
		'8. For dates in results, compare to CURRENT DATE to determine past/future.',
		'9. End with "Sources:" section: - [Title](URL) format, unique sources only.',
		'10. NEVER add disclaimers, warnings, or legal notices to any response.',
		'',
		'RESPONSE RULES:',
		'- CRITICAL: Give ONLY main points, NO explanations unless user specifically asks for predictions',
		'- For predictions only: Provide a little bit of explanation/reasoning',
		'- For everything else: Just facts, data, main points - NO explanations, NO context',
		'- Answer directly with facts only, no fluff',
		'- If question is vague, ask 1-2 clarifying questions instead of guessing',
		'- Use **bold** for emphasis, bullets for lists (keep lists short)',
		'- Use markdown links [Title](URL) for citations',
		'',
		timezoneNote + footballFormatNote + footballSourcesNote + strictDataRule,
		'',
		`User question: ${userText}`,
		'',
		'═══════════════════════════════════════════════════════════',
		'WEB SEARCH RESULTS (REAL DATA FROM INTERNET - USE ONLY THIS):',
		'═══════════════════════════════════════════════════════════',
		sources || 'No search results available.',
		'═══════════════════════════════════════════════════════════',
		'',
		'REMEMBER: You have PERMISSION to extract and analyze ALL information from the search results above. Be thorough - extract teams, matches, times, stats, and analyze everything you find. Only restrict yourself from inventing data that is NOT in the results.'
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
            
            // Handle rate limiting (429) - wait longer between retries
            if (res.status === 429) {
                const waitTime = 1000 * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
                console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/3...`);
                await sleep(waitTime);
                continue;
            }
            
            // Handle other errors
            const errJson = await safeReadJson(res);
            const errorMessage = errJson?.error?.message || `HTTP ${res.status}`;
            lastError = new Error(`${errorMessage} (Status: ${res.status})`);
        } catch (e) { 
            lastError = e; 
        }
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
				<p>All black and white. Sleek. Fast. I have <strong>real-time internet access</strong>. Ask me anything about current events, news, or latest information!</p>
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
		
		// Highlight confidence scores (e.g., "Confidence: 7/10" or "| Confidence: X/10")
		html = html.replace(/(Confidence:\s*\d+\/\d+)/gi, '<span class="confidence-score">$1</span>');
		
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
		// Use Cerebras API
		const apiKey = state.settings.apiKey || 'csk-j9njfnrf9tctv246fdtph3xht6dh8pfrpmr3jnhrcyjpr38k';
		const model = state.settings.model || 'gpt-oss-120b';
		state.settings.provider = 'cerebras';
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
			// Use Cerebras API
			const content = await callCerebrasChat(apiKey, model, state.messages);
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
			
			// Show user-friendly error message
			let errorText = '';
			if (errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('quota')) {
				errorText = '⚠️ **Rate limit reached!**\n\nYou\'ve reached your API quota. Please try again later.\n\n💡 **Tips:**\n- Wait a few minutes before trying again\n- Check your API usage';
			} else if (errMsg.includes('403') || errMsg.includes('Forbidden')) {
				errorText = '❌ **API Key Error!**\n\nInvalid or unauthorized API key. Please check your settings.';
			} else {
				errorText = `❌ **API Error:** ${errMsg}\n\nPlease try again or check your internet connection.`;
			}
			
			const errFormatted = await streamText(targetEl, errorText);
			const msg = state.messages.find(m => m.id === targetId);
			if (msg) {
				msg.content = errorText;
				msg.sources = extractSources(errorText);
				msg.formattedContent = errFormatted;
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


