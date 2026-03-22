const socket = io();

// 必要なDOM要素の取得
const playerList = document.getElementById('playerList');
const playerNameInput = document.getElementById('playerNameInput');
const joinBtn = document.getElementById('joinBtn');
const soloModeBtn = document.getElementById('soloModeBtn');
const bgmToggleBtn = document.getElementById('bgmToggleBtn'); 
const setupArea = document.getElementById('setupArea');
const gameSettings = document.getElementById('gameSettings');
const timeLimitSelect = document.getElementById('timeLimitSelect');
const roundsSelect = document.getElementById('roundsSelect');
const categorySelect = document.getElementById('categorySelect'); // 追加
const startBtn = document.getElementById('startBtn');
const timerDisplay = document.getElementById('timerDisplay');
const wordDisplay = document.getElementById('wordDisplay');
const roundDisplay = document.getElementById('roundDisplay');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const podiumOverlay = document.getElementById('podiumOverlay');
const podiumContainer = document.getElementById('podiumContainer');
const backToWaitingBtn = document.getElementById('backToWaitingBtn');
const galleryContainer = document.getElementById('galleryContainer');

const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const eraserBtn = document.getElementById('eraserBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const exitSoloBtn = document.getElementById('exitSoloBtn');
const toolbar = document.getElementById('toolbar');

let myId = null;
let isDrawing = false;
let canIDraw = false;
let inSoloMode = false;
let currentSettings = { color: '#000000', size: 5, isEraser: false };
let gallery = []; 

// 音声関連
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let isBgmOn = true; // 最初からONにする

// 自作BGMリスト
const bgmList = [
    'おえかきパレット・ポップ01.mp3',
    'おえかきパレット・ポップ02.mp3'
];
let currentBgmIndex = 0;
const bgmPlayer = document.getElementById('bgmPlayer');

if (bgmPlayer) {
    bgmPlayer.volume = 0.15; // 音量ちょっと小さめが心地いい
    bgmPlayer.src = encodeURI(bgmList[currentBgmIndex]);
    
    // 1曲終わったら次の曲へ自動で進む処理
    bgmPlayer.addEventListener('ended', () => {
        currentBgmIndex = (currentBgmIndex + 1) % bgmList.length;
        bgmPlayer.src = encodeURI(bgmList[currentBgmIndex]);
        if (isBgmOn) {
            bgmPlayer.play().catch(e => console.log("BGM loop error", e));
        }
    });
}

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function startBGM() {
    if (bgmPlayer && isBgmOn) {
        bgmPlayer.play().then(() => {
            bgmToggleBtn.textContent = '🎵 BGM: ON中💕';
            bgmToggleBtn.style.background = '#66ccff';
            bgmToggleBtn.style.color = '#fff';
            bgmToggleBtn.style.border = 'none';
        }).catch(e => {
            console.error(e);
            // 自動再生エラーで弾かれた時のフェイルセーフ
            bgmToggleBtn.textContent = '🎵 BGM: オフ（クリックでON！）';
            bgmToggleBtn.style.background = '#ffccdd';
            bgmToggleBtn.style.color = '#ff66b2';
            bgmToggleBtn.style.border = '2px solid #ff66b2';
            isBgmOn = false;
        });
    }
}

function stopBGM() {
    if (bgmPlayer) bgmPlayer.pause();
    bgmToggleBtn.textContent = '🎵 BGM: オフ（クリックでON！）';
    bgmToggleBtn.style.background = '#ffccdd';
    bgmToggleBtn.style.color = '#ff66b2';
    bgmToggleBtn.style.border = '2px solid #ff66b2';
}

if (bgmToggleBtn) {
    bgmToggleBtn.addEventListener('click', () => {
        initAudio();
        if (!isBgmOn) {
            isBgmOn = true;
            startBGM();
        } else {
            isBgmOn = false;
            stopBGM();
        }
    });
}

// 画面を最初にクリックしたタイミングでBGMスタート
document.addEventListener('click', () => {
    initAudio();
    if (isBgmOn && bgmPlayer && bgmPlayer.paused) {
        startBGM();
    }
}, { once: true });

function playSE(type) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;

    if (type === 'correct') {
        // ピロリロン♪
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t + i * 0.05);
            gain.gain.linearRampToValueAtTime(0.15, t + i * 0.05 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.05 + 0.3);
            osc.start(t + i * 0.05);
            osc.stop(t + i * 0.05 + 0.3);
        });
    } else if (type === 'oshii') {
        // ぽわん♪
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.3);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    } else if (type === 'finish') {
        // パパンパラパーン♪
        [523.25, 698.46, 880.00, 1046.50].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.value = freq;
            let startT = t + (i < 3 ? i * 0.15 : 0.6);
            let dur = i < 3 ? 0.1 : 0.8;
            gain.gain.setValueAtTime(0, startT);
            gain.gain.linearRampToValueAtTime(0.15, startT + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startT + dur);
            osc.start(startT);
            osc.stop(startT + dur);
        });
    }
}

// Canvas周り
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

let lastX = 0, lastY = 0;

function drawLine(x0, y0, x1, y1, color, size, isErase) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = isErase ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.stroke();
    ctx.closePath();
}

canvas.addEventListener('mousedown', (e) => {
    if (!canIDraw) return;
    isDrawing = true;
    lastX = e.offsetX; lastY = e.offsetY;
});
canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !canIDraw) return;
    drawLine(lastX, lastY, e.offsetX, e.offsetY, currentSettings.color, currentSettings.size, currentSettings.isEraser);
    if (!inSoloMode) {
        socket.emit('draw', { x0: lastX, y0: lastY, x1: e.offsetX, y1: e.offsetY, color: currentSettings.color, size: currentSettings.size, isEraser: currentSettings.isEraser });
    }
    lastX = e.offsetX; lastY = e.offsetY;
});
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

colorPicker.addEventListener('change', (e) => { currentSettings.color = e.target.value; currentSettings.isEraser = false; });
sizePicker.addEventListener('input', (e) => currentSettings.size = e.target.value);
eraserBtn.addEventListener('click', () => currentSettings.isEraser = true);
clearBtn.addEventListener('click', () => { 
    if(canIDraw) {
        if (!inSoloMode) socket.emit('clear_canvas'); 
        else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
});

if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = "my_cute_drawing.png";
        a.click();
    });
}

if (soloModeBtn) {
    soloModeBtn.addEventListener('click', () => {
        initAudio();
        if (isBgmOn) startBGM();
        inSoloMode = true;
        canIDraw = true;
        overlay.classList.add('hidden');
        podiumOverlay.classList.add('hidden');
        toolbar.style.pointerEvents = 'auto';
        toolbar.style.opacity = '1';
        
        saveBtn.classList.remove('hidden');
        exitSoloBtn.classList.remove('hidden');
        
        roundDisplay.textContent = '🎨 ソロお絵描き';
        wordDisplay.textContent = '自由にお絵描きしてね！';
        timerDisplay.textContent = '∞';
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
}

if (exitSoloBtn) {
    exitSoloBtn.addEventListener('click', () => {
        inSoloMode = false;
        canIDraw = false;
        saveBtn.classList.add('hidden');
        exitSoloBtn.classList.add('hidden');
        socket.emit('return_to_lobby'); 
    });
}

socket.on('connect', () => { myId = socket.id; });

socket.on('update_players', (players) => {
    if (inSoloMode) return;
    playerList.innerHTML = '';
    let amIin = false;
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.name} : ${p.score}pt`;
        if (p.hasGuessed) li.textContent += ' 🎉';
        if (p.id === myId) { li.style.borderLeft = '5px solid var(--primary-color)'; amIin = true; }
        playerList.appendChild(li);
    });
    if (amIin) {
        playerNameInput.style.display = 'none';
        joinBtn.style.display = 'none';
        if (soloModeBtn) soloModeBtn.style.display = 'none';
        gameSettings.classList.remove('hidden');
    }
});

socket.on('game_state', (state) => {
    if (inSoloMode) return;
    if (state.phase === 'waiting') {
        gallery = [];
        overlay.classList.remove('hidden');
        overlayText.innerHTML = 'ゲームの開始を待ってるよ🥺<br>（ヤラシイ絵は描かないように！🙅‍♀️笑）';
        podiumOverlay.classList.add('hidden');
        toolbar.style.pointerEvents = 'none';
        toolbar.style.opacity = '0.5';
        canIDraw = false;
        roundDisplay.textContent = '🏁 --周目';
        wordDisplay.textContent = 'お題：----';
        timerDisplay.textContent = '⏱️ --';
    } else if (state.phase === 'between_turns') {
        overlay.classList.remove('hidden');
        if (state.isLastTurn) {
            overlayText.innerHTML = '全ターン終了〜お疲れさま！✨<br>いよいよ結果発表だよ！🏆';
        } else {
            overlayText.innerHTML = '次のターンにいくよ〜！✨<br>心の準備してね！';
        }
        canIDraw = false;
        toolbar.style.pointerEvents = 'none';
        toolbar.style.opacity = '0.5';
    }
});

socket.on('round_start', (data) => {
    if (inSoloMode) return;
    overlay.classList.add('hidden');
    podiumOverlay.classList.add('hidden');
    wordDisplay.textContent = `お題：${data.word}`;
    roundDisplay.textContent = `🏁 ${data.roundInfo}`;
    
    canIDraw = data.isDrawer;
    if (canIDraw) {
        toolbar.style.pointerEvents = 'auto';
        toolbar.style.opacity = '1';
        addChatMessage('System', 'あなたの番だよ！絵を描いてね！🖌️✨', '#ff66b2');
    } else {
        toolbar.style.pointerEvents = 'none';
        toolbar.style.opacity = '0.5';
        addChatMessage('System', `${data.drawerName}さんがお絵描き中…！当ててみて！👀`, '#ff66b2');
    }
});

socket.on('timer', (time) => { if(!inSoloMode) timerDisplay.textContent = `⏱️ ${time}`; });
socket.on('draw', (data) => { if(!inSoloMode) drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser); });
socket.on('clear_canvas', () => { if(!inSoloMode) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }});

socket.on('round_end', (data) => {
    if (inSoloMode) return;
    const imgData = canvas.toDataURL('image/png');
    gallery.push({ imgData, word: data.word, drawer: data.drawer });
    playSE('finish');
});

socket.on('chat_message', (data) => {
    if (inSoloMode) return;
    addChatMessage(data.sender, data.text, data.color);
    if (data.type === 'correct') playSE('correct');
    else if (data.type === 'oshii') playSE('oshii');
});

socket.on('error', (msg) => { alert(msg); });

socket.on('game_over', (sortedPlayers) => {
    if (inSoloMode) return;
    playSE('finish');
    podiumOverlay.classList.remove('hidden');
    overlay.classList.add('hidden');
    podiumContainer.innerHTML = '';
    
    const displayOrder = [];
    if (sortedPlayers.length > 1) displayOrder.push({ ...sortedPlayers[1], rank: 2 });
    if (sortedPlayers.length > 0) displayOrder.push({ ...sortedPlayers[0], rank: 1 });
    if (sortedPlayers.length > 2) displayOrder.push({ ...sortedPlayers[2], rank: 3 });

    displayOrder.forEach(p => {
        const div = document.createElement('div'); div.className = `podium-item rank-${p.rank}`;
        let medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉';
        div.innerHTML = `
            <div class="podium-score">${p.score}pt</div>
            <div class="podium-name">${medal} ${p.name}</div>
            <div class="podium-rank">${p.rank}位</div>
        `;
        podiumContainer.appendChild(div);
    });

    if (galleryContainer) {
        galleryContainer.innerHTML = '';
        gallery.forEach((item, index) => {
            const itemDiv = document.createElement('div'); itemDiv.className = 'gallery-item';
            itemDiv.innerHTML = `
                <p style="margin:5px 0; font-weight:bold;">${item.drawer} が描いた 「${item.word}」</p>
                <img src="${item.imgData}" alt="絵" style="width:100%; border:2px solid #ccc; border-radius:10px;">
                <a href="${item.imgData}" download="drawing_${index}.png" class="cute-btn" style="text-decoration:none; display:inline-block; margin-top:10px; font-size:0.9rem;">📥 保存する</a>
            `;
            galleryContainer.appendChild(itemDiv);
        });
    }
});

backToWaitingBtn.addEventListener('click', () => { socket.emit('return_to_lobby'); });

joinBtn.addEventListener('click', () => {
    initAudio();
    if (isBgmOn) startBGM();
    const name = playerNameInput.value.trim();
    if(name === "") return alert("名前入れてよね！🥺");
    socket.emit('join_game', name);
});

startBtn.addEventListener('click', () => {
    socket.emit('start_game', { 
        timeLimit: parseInt(timeLimitSelect.value),
        rounds: parseInt(roundsSelect.value),
        category: categorySelect ? categorySelect.value : 'mix'
    });
});

function sendMessage() {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit('send_message', msg);
        chatInput.value = '';
    }
}

sendBtn.addEventListener('click', sendMessage);

let isInputComposing = false;
chatInput.addEventListener('compositionstart', () => { isInputComposing = true; });
chatInput.addEventListener('compositionend', () => { isInputComposing = false; });

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (isInputComposing || e.keyCode === 229) return;
        e.preventDefault();
        sendMessage();
    }
});

function addChatMessage(sender, text, color) {
    const div = document.createElement('div'); div.className = 'chat-msg';
    div.innerHTML = `<strong style="color: ${color || '#333'}">${sender}:</strong> ${text}`;
    chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight;
}
