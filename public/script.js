const socket = io();

// 🆕 レベル制限データを即座に受け取れるように、接続直後にリスナーを登録ッ！💎✨💍
socket.on('min_lvs_update', (data) => {
    window.minLvPerCategory = data;
    console.log("[CAT-SYNC] min_lvs_update received:", data);
    if (typeof myLv !== 'undefined') updateCategorySelect(myLv);
});

// 必要なDOM要素の取得
const playerList = document.getElementById('playerList');
let lastPlayersList = []; // 🆕 キャッシュ用にお引越しッ！💎✨💍
const playerNameInput = document.getElementById('playerNameInput');
const joinBtn = document.getElementById('joinBtn');
const soloModeBtn = document.getElementById('soloModeBtn');
const bgmToggleBtn = document.getElementById('bgmToggleBtn'); 
const setupArea = document.getElementById('setupArea');
const gameSettings = document.getElementById('gameSettings');
const timeLimitSelect = document.getElementById('timeLimitSelect');
const roundsSelect = document.getElementById('roundsSelect');
const categorySelect = document.getElementById('categorySelect'); // 追加
const readyBtn = document.getElementById('readyBtn');
const readyBubble = document.getElementById('readyBubble'); // 🆕 追加ッ！💅
const timerDisplay = document.getElementById('timerDisplay');
const wordDisplay = document.getElementById('wordDisplay');
const roundDisplay = document.getElementById('roundDisplay');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const podiumOverlay = document.getElementById('podiumOverlay');
const podiumContainer = document.getElementById('podiumContainer');
const backToWaitingBtn = document.getElementById('backToWaitingBtn');
const galleryContainer = document.getElementById('galleryContainer');
const wordPopupOverlay = document.getElementById('wordPopupOverlay');
const wordPopupText = document.getElementById('wordPopupText');
const wordPopupSubtext = document.getElementById('wordPopupSubtext');
const danmakuContainer = document.getElementById('danmakuContainer');
const sparkleContainer = document.getElementById('sparkleContainer'); // 追加✨

// --- 💎 タイトル画面・ルーム選択の制御 💎 ---
const titleScreen = document.getElementById('titleScreen');
const gameStartBtn = document.getElementById('gameStartBtn');
const roomSelectScreen = document.getElementById('roomSelectScreen');
const roomGrid = document.getElementById('roomGrid');
const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');

const initialAuthButtons = document.getElementById('initialAuthButtons');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const authFormArea = document.getElementById('authFormArea');
const authFormTitle = document.getElementById('authFormTitle');
const authNameInput = document.getElementById('authNameInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const authBackBtn = document.getElementById('authBackBtn');
const authSubmitBtn = document.getElementById('authSubmitBtn');

const roomPasswordModal = document.getElementById('roomPasswordModal');
const joinPasswordInput = document.getElementById('joinPasswordInput');
const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
const confirmPasswordBtn = document.getElementById('confirmPasswordBtn');
const welcomeBackArea = document.getElementById('welcomeBackArea'); // 🆕 追加ッ！✨
const welcomeBackMsg = document.getElementById('welcomeBackMsg'); // 🆕 追加ッ！✨
const autoLoginBtn = document.getElementById('autoLoginBtn'); // 🆕 追加ッ！✨
const switchUserBtn = document.getElementById('switchUserBtn'); // 🆕 追加ッ！✨

let pendingJoinRoomId = null;
let currentAuthMode = 'register';
let playerToken = localStorage.getItem('galPlayerToken') || '';
let currentPlayerName = localStorage.getItem('galAuthName') || ''; 

// 🆕 ログイン・登録の初期表示処理ッ！✨💍
function restoreCredentials() {
    const savedName = localStorage.getItem('galAuthName');
    const savedPass = localStorage.getItem('galAuthPass');
    if (savedName) authNameInput.value = savedName;
    if (savedPass) authPasswordInput.value = savedPass;
    
    // 🆕 おかえり！フローの初期化 💖💍
    if (playerToken && savedName && initialAuthButtons) {
        initialAuthButtons.classList.add('hidden');
        welcomeBackArea.classList.remove('hidden');
        welcomeBackMsg.innerHTML = `おかえり、<span style="color:#ff3399;">${savedName}</span>さん💖<br><span style="font-size:0.9rem; color:#888;">前回のバイブスで再開しちゃう？✨</span>`;
    }
}
restoreCredentials();

// 🆕 おかえり！ボタンのイベント 💎✨
if (autoLoginBtn) {
    autoLoginBtn.addEventListener('click', () => {
        initAudio(); // 音を鳴らす準備ッ！🎹
        const name = localStorage.getItem('galAuthName');
        const password = localStorage.getItem('galAuthPass');
        if (name && password) {
            // 🆕 正規化して送信！💎✨
            const normalizedName = name.trim().normalize('NFC');
            socket.emit('login', { name: normalizedName, password: password.trim() });
        } else {
            // 万が一データが欠けてたら通常ログインへ
            welcomeBackArea.classList.add('hidden');
            initialAuthButtons.classList.remove('hidden');
        }
    });
}

if (switchUserBtn) {
    switchUserBtn.addEventListener('click', () => {
        welcomeBackArea.classList.add('hidden');
        initialAuthButtons.classList.remove('hidden');
    });
}

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        initAudio(); // 音を鳴らす準備ッ！🎹
        currentAuthMode = 'login';
        authFormTitle.innerText = 'ログインだおッ！🔑';
        authSubmitBtn.innerText = 'ログインして開始！🚀';
        initialAuthButtons.classList.add('hidden');
        authFormArea.classList.remove('hidden');
    });
}

if (registerBtn) {
    registerBtn.addEventListener('click', () => {
        initAudio();
        currentAuthMode = 'register';
        authFormTitle.innerText = '会員登録だおッ！🐣';
        authSubmitBtn.innerText = '登録して開始！🚀';
        initialAuthButtons.classList.add('hidden');
        authFormArea.classList.remove('hidden');
    });
}

if (authBackBtn) {
    authBackBtn.addEventListener('click', () => {
        authFormArea.classList.add('hidden');
        initialAuthButtons.classList.remove('hidden');
    });
}

if (authSubmitBtn) {
    authSubmitBtn.addEventListener('click', () => {
        // ✨ 正規化とトリムを徹底！🚀
        const name = authNameInput.value.trim().normalize('NFC');
        const password = authPasswordInput.value.trim();
        
        if (!name || !password) {
            alert("名前とパスワードは必須だおッ！🥺💔");
            return;
        }

        // 情報を保存ッ！💎✨💍
        localStorage.setItem('galAuthName', name);
        localStorage.setItem('galAuthPass', password);

        if (currentAuthMode === 'register') {
            socket.emit('register', { name, password });
        } else {
            console.log(`[DEBUG] Attempting login with name: [${name}]`);
            socket.emit('login', { name, password });
        }
    });
}

// 🆕 認証レスポンスの処理ッ！✨💍🌈
socket.on('register_success', (data) => {
    playerToken = data.token;
    currentPlayerName = data.name; // 🆕 現在のプレイヤー名を更新ッ！✨
    myLv = 0; // 🆕 新規はLV0ッ！🐣
    localStorage.setItem('galPlayerToken', playerToken);
    localStorage.setItem('galAuthName', currentPlayerName); // 🆕 念のため保存！💎
    transitionToRoomSelection();
});

socket.on('register_failed', (msg) => { alert(msg); });

socket.on('login_success', (data) => {
    playerToken = data.token;
    currentPlayerName = data.name; // 🆕 現在のプレイヤー名を更新ッ！✨
    myLv = data.lv || 0; // 🆕 レベルを保存ッ！✨
    localStorage.setItem('galPlayerToken', playerToken);
    localStorage.setItem('galAuthName', currentPlayerName); // 🆕 念のため保存！💎
    transitionToRoomSelection();
});

socket.on('login_failed', (data) => { 
    if (typeof data === 'string') {
        const currentName = localStorage.getItem('galAuthName');
        alert(`${data}\n\n[DEBUG] 送信した名前: [${currentName}]`); 
    } else {
        const { msg, debug } = data;
        let debugStr = `[DEBUG]\n送信名: [${debug.name}]\nメモリ数: ${debug.memoryCount}\nDB状態: ${debug.dbState}\nサンプル: ${debug.samples}`;
        alert(`${msg}\n\n${debugStr}`);
    }
});

function transitionToRoomSelection() {
    titleScreen.style.opacity = '0';
    titleScreen.style.pointerEvents = 'none';
    
    setTimeout(() => {
        titleScreen.classList.add('hidden');
        roomSelectScreen.classList.remove('hidden');
        socket.emit('get_rooms');
    }, 800);
    
    const savedName = localStorage.getItem('galAuthName') || 'かずぅさん';
    addChatMessage('System', `ウェルカムだお、${savedName}さんッ！💖 今日のバイブスも最高すぎッ！💅💎✨ 最高なパーティーにしちゃおッ！！💍🔥`, '#ff66b2');
}

if (refreshRoomsBtn) {
    refreshRoomsBtn.addEventListener('click', () => {
        socket.emit('get_rooms');
    });
}

const backToTitleBtn = document.getElementById('backToTitleBtn');
if (backToTitleBtn) {
    backToTitleBtn.addEventListener('click', () => {
        roomSelectScreen.classList.add('hidden');
        titleScreen.classList.remove('hidden');
        titleScreen.style.opacity = '1';
        titleScreen.style.pointerEvents = 'auto';
    });
}

// 画像検索関連の要素
const searchImageBtn = document.getElementById('searchImageBtn');
const imageSearchContainer = document.getElementById('imageSearchContainer');
const searchResultList = document.getElementById('searchResultList');
const closeSearchBtn = document.getElementById('closeSearchBtn');

// ギャラリー関連の要素
const openGalleryBtn = document.getElementById('openGalleryBtn');
const galleryOverlay = document.getElementById('galleryOverlay');
const fullGalleryContainer = document.getElementById('fullGalleryContainer');
const closeGalleryBtn = document.getElementById('closeGalleryBtn');

const banOverlay = document.getElementById('banOverlay');
const banGrid = document.getElementById('banGrid');
const closeBanBtn = document.getElementById('closeBanBtn');

const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');

// 保存モーダル関連
const savePromptModal = document.getElementById('savePromptModal');
const modalPromptInput = document.getElementById('modalPromptInput');
const modalArtistInput = document.getElementById('modalArtistInput');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const confirmSaveBtn = document.getElementById('confirmSaveBtn');
let pendingSaveData = null; // 保存待ちの画像データ

const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const penBtn = document.getElementById('penBtn'); // ペンボタン追加
const eraserBtn = document.getElementById('eraserBtn');
const fillBtn = document.getElementById('fillBtn'); // 塗りつぶしボタン追加
const undoBtn = document.getElementById('undoBtn'); // 戻すボタン追加
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const gallerySubmitBtn = document.getElementById('gallerySubmitBtn'); // 追加
const nextWordBtn = document.getElementById('nextWordBtn'); // 追加✨💍
const rainbowBtn = document.getElementById('rainbowBtn'); // 追加🌈
const glowBtn = document.getElementById('glowBtn'); // 追加🌟
const exitSoloBtn = document.getElementById('exitSoloBtn');
const turnEndBtn = document.getElementById('turnEndBtn'); // 追加
const turnEndBubble = document.getElementById('turnEndBubble'); // 🆕 追加ッ！💅
const heartBtn = document.getElementById('heartBtn'); // 🆕 究極のハートペン！💖
const sidebar = document.querySelector('.sidebar'); // サイドバー取得💅
const toolbar = document.getElementById('toolbar');
const adminOverlay = document.getElementById('adminOverlay');
const adminPlayerList = document.getElementById('adminPlayerList');
const closeAdminBtn = document.getElementById('closeAdminBtn');
const exitRoomBtn = document.getElementById('exitRoomBtn');

// 🆕 特製確認モーダル用 💎✨
const customConfirmOverlay = document.getElementById('customConfirmOverlay');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
let currentConfirmAction = null;

let myId = null;
let myLv = 0; // 🆕 自分のレベルを記憶しておくおッ！💎
let lastKnownPlayerCount = 0; // 🆕 入室音判定用の新規カウントだおッ！💍✨
let isDrawing = false;
let canIDraw = false;
let inSoloMode = false;
let currentSettings = { color: '#000000', size: 5, isEraser: false, isFill: false, isGlow: false, isRainbow: false, isHeart: false };
let gallery = []; 
let drawHistory = []; // UNDO用の履歴配列 
let currentWordText = '';
let showEmoji = false;

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

// --- 🍪 クッキー操作ヘルパー 🍪 ---
function setCookie(name, value, days = 7) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function getCookie(name) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
}

// クッキー・トークン・名前の復元（新システムに移行したからお役御免だおッ！💅✨）
if (!playerToken) {
    playerToken = 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('galPlayerToken', playerToken);
}

function startBGM() {
    if (bgmPlayer && isBgmOn) {
        bgmPlayer.play().then(() => {
            bgmToggleBtn.dataset.tooltip = 'BGM: ON中💕';
            bgmToggleBtn.style.background = '#66ccff';
            bgmToggleBtn.style.color = '#fff';
            bgmToggleBtn.style.border = 'none';
        }).catch(e => {
            console.error(e);
            // 自動再生エラーで弾かれた時のフェイルセーフ
            bgmToggleBtn.dataset.tooltip = 'BGM: OFF（クリックでON！）';
            bgmToggleBtn.style.background = '#ffccdd';
            bgmToggleBtn.style.color = '#ff66b2';
            bgmToggleBtn.style.border = '2px solid #ff66b2';
            isBgmOn = false;
        });
    }
}

function stopBGM() {
    if (bgmPlayer) bgmPlayer.pause();
    bgmToggleBtn.dataset.tooltip = 'BGM: OFF（クリックでON！）';
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
    } else if (type === 'heart') {
        // ピキュインッ💖
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(1760, t + 0.1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    } else if (type === 'join') {
        // ✨ チャラリーン♪（入室音） 💍🤟💖
        [523.25, 659.25].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const startT = t + i * 0.12;
            gain.gain.setValueAtTime(0, startT);
            gain.gain.linearRampToValueAtTime(0.15, startT + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.25);
            osc.start(startT);
            osc.stop(startT + 0.25);
        });
    }
}

// Canvas周り
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

let lastX = 0, lastY = 0;

function drawLine(x0, y0, x1, y1, color, size, isErase, isGlow, isRainbow, isHeart) {
    let finalColor = color;
    if (isRainbow && !isErase) {
        // 描画タイミングごとに色を絶妙に変えてエモい虹にするよ！🌈✨
        // 線の場所(x,y)と時間で色を混ぜて、よりオーラ感のあるグラデーションに！💍
        const hue = (Date.now() / 5 + (x0 + y0) / 2) % 360;
        finalColor = `hsl(${hue}, 100%, 65%)`; // ちょっとパステル寄りの明るい虹に！💖
    }

    ctx.save(); // 状態を保存💕
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = isErase ? '#ffffff' : finalColor;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isGlow && !isErase) {
        // オーラ全開！キラキラ感を3倍以上にアップ！🌟✨
        ctx.shadowBlur = size * 4; 
        ctx.shadowColor = finalColor;
        // 重ねて描画することで、より眩しくするよ！💎
        ctx.stroke();
        ctx.shadowBlur = size * 2;
        
        // スパークル（火花）を散らすよ！✨💍
        if (Math.random() > 0.7) {
            createSparkle(x1, y1, finalColor);
        }
    } else if (isRainbow && !isErase) {
        // 虹色ペンの時もたまにキラキラさせる！🌈✨
        if (Math.random() > 0.85) {
            createSparkle(x1, y1, finalColor);
        }
    }

    ctx.stroke();
    ctx.closePath();
    ctx.restore(); // 状態を戻す✨

    // 🆕 💖ペンの時はハートをドバドバ出すよ！💅✨
    if (isHeart && !isErase) {
        if (Math.random() > 0.4) { // 通常より多めに出すお！💎
            createSparkle(x1, y1, '#ff3399', true); 
            if (Math.random() > 0.8) playSE('heart');
        }
    }
}

// ✨ キラキラ（スパークル）を生成する関数！💖
function createSparkle(x, y, color, isHeartMode = false) {
    if (!sparkleContainer) return;
    
    // 💖 エフェクト大増量！盛り盛り仕様にするよ！💅✨
    const count = isHeartMode ? 2 : 3; // ハートペンなら少し多めに！💍
    
    for (let i = 0; i < count; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = isHeartMode ? 'sparkle heart' : 'sparkle';
        
        // ✨ 修正：パーセント（%）で座標を指定するよ！💅
        // これならキャンバスがどんなサイズにリサイズされても、ペン先にピタッと重なるね！💎💍
        sparkle.style.left = `${(x / 1250) * 100}%`; // 🆕 1250px（枠ギリギリサイズ）に合わせて位置を補正ッ！💎✨💍
        sparkle.style.top = `${(y / 700) * 100}%`; // 🆕 700px（新しいキャンバス高）に合わせて位置を補正ッ！💍✨
        
        // ランダムな方向に飛ばす！シュババッ！💨
        const angle = Math.random() * Math.PI * 2;
        const velocity = isHeartMode ? (5 + Math.random() * 10) : (3 + Math.random() * 8); 
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        sparkle.style.setProperty('--vx', `${vx}px`);
        sparkle.style.setProperty('--vy', `${vy}px`);
        
        // 宝石やハートをランダムに！💎💍💖✨🌟💄🍭🌈
        const shapes = isHeartMode ? ['💖', '💕', '🏩', '🔞', '💋', '🔥'] : ['✨', '💖', '⭐', '💎', '🌸', '💍', '🌟', '💄', '🍭', '🌈', '🔥'];
        sparkle.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        sparkle.style.backgroundColor = 'transparent';
        sparkle.style.fontSize = isHeartMode ? `${20 + Math.random() * 25}px` : `${12 + Math.random() * 20}px`; 
        sparkle.style.textShadow = `0 0 15px ${isHeartMode ? '#ff3399' : color}`; 

        sparkleContainer.appendChild(sparkle);
        
        // 消す時間もモードで調整💅
        const duration = isHeartMode ? 1000 : 800;
        setTimeout(() => {
            sparkle.remove();
        }, duration);
    }
}

// 履歴保存機能（Undo用）
function saveState() {
    if (drawHistory.length > 20) drawHistory.shift(); // 最大20回まで戻れるように
    drawHistory.push(canvas.toDataURL());
}

// 塗りつぶし（バケツ）アルゴリズム
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

function floodFill(startX, startY, fillColorHex) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    
    if(startX < 0 || startX >= width || startY < 0 || startY >= height) return;
    
    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];
    
    const fillRgb = hexToRgb(fillColorHex);
    
    // 同じ色の場合は何もしない（無限ループ防止）
    if (startR === fillRgb.r && startG === fillRgb.g && startB === fillRgb.b && startA === fillRgb.a) {
        return;
    }

    const matchStartColor = (pos) => {
        // アルファ値が0（透明）のピクセルも白(255,255,255)として扱うなどの調整も可能ですが、
        // 今回はシンプルにRGBとAの完全一致で判定
        return data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;
    };
    
    const colorPixel = (pos) => {
        data[pos] = fillRgb.r;
        data[pos + 1] = fillRgb.g;
        data[pos + 2] = fillRgb.b;
        data[pos + 3] = 255;
    };

    const pixelStack = [[startX, startY]];
    
    while (pixelStack.length) {
        const newPos = pixelStack.pop();
        const x = newPos[0];
        let y = newPos[1];
        
        let pixelPos = (y * width + x) * 4;
        
        while (y-- >= 0 && matchStartColor(pixelPos)) {
            pixelPos -= width * 4;
        }
        
        pixelPos += width * 4;
        y++;
        
        let reachLeft = false;
        let reachRight = false;
        
        while (y++ < height - 1 && matchStartColor(pixelPos)) {
            colorPixel(pixelPos);
            
            if (x > 0) {
                if (matchStartColor(pixelPos - 4)) {
                    if (!reachLeft) {
                        pixelStack.push([x - 1, y]);
                        reachLeft = true;
                    }
                } else if (reachLeft) {
                    reachLeft = false;
                }
            }
            
            if (x < width - 1) {
                if (matchStartColor(pixelPos + 4)) {
                    if (!reachRight) {
                        pixelStack.push([x + 1, y]);
                        reachRight = true;
                    }
                } else if (reachRight) {
                    reachRight = false;
                }
            }
            
            pixelPos += width * 4;
        }
    }
    
    ctx.putImageData(imgData, 0, 0);
}

// 座標をキャンバスの解像度に合わせる魔法✨💍🤟
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

canvas.addEventListener('mousedown', (e) => {
    if (!canIDraw) return;
    
    // 描画・塗りつぶしが始まる前に現在の状態を保存
    saveState();
    
    const pos = getMousePos(e);
    
    if (currentSettings.isFill) {
        // 塗りつぶしモード
        const color = currentSettings.color;
        floodFill(pos.x, pos.y, color);
        if (!inSoloMode) {
            socket.emit('fill', { x: pos.x, y: pos.y, color: color });
        }
        return; // 線を引かないようにここでreturn
    }

    isDrawing = true;
    lastX = pos.x; lastY = pos.y;
});
canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !canIDraw) return;
    const pos = getMousePos(e);
    drawLine(lastX, lastY, pos.x, pos.y, currentSettings.color, currentSettings.size, currentSettings.isEraser, currentSettings.isGlow, currentSettings.isRainbow, currentSettings.isHeart);
    if (!inSoloMode) {
        socket.emit('draw', { 
            x0: lastX, y0: lastY, x1: pos.x, y1: pos.y, 
            color: currentSettings.color, size: currentSettings.size, 
            isEraser: currentSettings.isEraser,
            isGlow: currentSettings.isGlow,
            isRainbow: currentSettings.isRainbow,
            isHeart: currentSettings.isHeart
        });
    }
    lastX = pos.x; lastY = pos.y;
});
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

// ✨ タッチ対応！スマホ・タブレット・タッチパネルでもお絵描きできるように！💍🤟💖
function getTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
    };
}

canvas.addEventListener('touchstart', (e) => {
    if (!canIDraw) return;
    e.preventDefault(); // スクロール防止！💅
    saveState();
    const touch = e.touches[0];
    const pos = getTouchPos(touch);
    if (currentSettings.isFill) {
        const color = currentSettings.color;
        floodFill(pos.x, pos.y, color);
        if (!inSoloMode) {
            socket.emit('fill', { x: pos.x, y: pos.y, color: color });
        }
        return;
    }
    isDrawing = true;
    lastX = pos.x; lastY = pos.y;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (!isDrawing || !canIDraw) return;
    e.preventDefault(); // スクロール防止！💅
    const touch = e.touches[0];
    const pos = getTouchPos(touch);
    drawLine(lastX, lastY, pos.x, pos.y, currentSettings.color, currentSettings.size, currentSettings.isEraser, currentSettings.isGlow, currentSettings.isRainbow, currentSettings.isHeart);
    if (!inSoloMode) {
        socket.emit('draw', {
            x0: lastX, y0: lastY, x1: pos.x, y1: pos.y,
            color: currentSettings.color, size: currentSettings.size,
            isEraser: currentSettings.isEraser,
            isGlow: currentSettings.isGlow,
            isRainbow: currentSettings.isRainbow,
            isHeart: currentSettings.isHeart
        });
    }
    lastX = pos.x; lastY = pos.y;
}, { passive: false });

canvas.addEventListener('touchend', () => isDrawing = false);
canvas.addEventListener('touchcancel', () => isDrawing = false);

function setActiveTool(btn) {
    if (penBtn) penBtn.classList.remove('active');
    if (eraserBtn) eraserBtn.classList.remove('active');
    if (fillBtn) fillBtn.classList.remove('active');
    // 特殊ボタンはトグル方式にするからここでは外さないよ💅✨
    if (btn && !btn.classList.contains('effect-btn')) btn.classList.add('active');
}
// 初期状態はペン
if (penBtn) setActiveTool(penBtn);

colorPicker.addEventListener('input', (e) => {
    currentSettings.color = e.target.value; 
});

colorPicker.addEventListener('change', (e) => { 
    currentSettings.color = e.target.value; 
    if (currentSettings.isEraser) {
        currentSettings.isEraser = false; 
        setActiveTool(penBtn);
    }
    // 塗りつぶしの時は塗りつぶしモードを維持する
});
sizePicker.addEventListener('input', (e) => currentSettings.size = e.target.value);
if (penBtn) {
    penBtn.addEventListener('click', () => { 
        currentSettings.isEraser = false; 
        currentSettings.isFill = false; 
        setActiveTool(penBtn);
    });
}
eraserBtn.addEventListener('click', () => { 
    currentSettings.isEraser = true; 
    currentSettings.isFill = false; 
    setActiveTool(eraserBtn);
});
if (fillBtn) {
    fillBtn.addEventListener('click', () => { 
        currentSettings.isFill = true; 
        currentSettings.isEraser = false; 
        setActiveTool(fillBtn);
    });
}

if (rainbowBtn) {
    rainbowBtn.addEventListener('click', () => {
        currentSettings.isRainbow = !currentSettings.isRainbow;
        rainbowBtn.classList.toggle('active');
        if (currentSettings.isRainbow) {
            currentSettings.isEraser = false;
            setActiveTool(penBtn);
        }
    });
}

if (glowBtn) {
    glowBtn.addEventListener('click', () => {
        currentSettings.isGlow = !currentSettings.isGlow;
        glowBtn.classList.toggle('active');
    });
}
if (heartBtn) {
    heartBtn.addEventListener('click', () => {
        currentSettings.isHeart = !currentSettings.isHeart;
        heartBtn.classList.toggle('active');
        if (currentSettings.isHeart) {
            currentSettings.isEraser = false;
            setActiveTool(penBtn);
            addChatMessage('System', '💖ペン発動！描くたびにハートが溢れちゃうお…🔞💖', '#ff3399');
        }
    });
}
if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        if (!canIDraw || drawHistory.length === 0) return;
        const previousState = drawHistory.pop();
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, 1250, 700);
            ctx.drawImage(img, 0, 0);
            if (!inSoloMode) {
                socket.emit('sync_canvas', previousState);
            }
        };
        img.src = previousState;
    });
}
if (turnEndBtn) {
    turnEndBtn.addEventListener('click', () => {
        if (canIDraw && !inSoloMode) {
            socket.emit('manual_turn_end');
            turnEndBtn.classList.add('hidden'); // 連打防止
            if (turnEndBubble) turnEndBubble.classList.add('hidden'); // 吹き出しも消す！✨
        }
    });
}
clearBtn.addEventListener('click', () => { 
    if(canIDraw) {
        saveState();
        if (!inSoloMode) socket.emit('clear_canvas'); 
        else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
});

const emojiToggleBtn = document.getElementById('emojiToggleBtn');
if (emojiToggleBtn) {
    emojiToggleBtn.addEventListener('click', () => {
        showEmoji = !showEmoji;
        emojiToggleBtn.dataset.tooltip = showEmoji ? 'スタンプ: ON✨' : 'スタンプ: OFF';
        if (currentWordText) {
            wordDisplay.textContent = `お題：${getDisplayText(currentWordText)}`;
        }
    });
}

function getDisplayText(word) {
    if (showEmoji || !word) return word;
    return word.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/gu, '');
}

if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = "my_cute_drawing.png";
        a.click();
    });
}

if (gallerySubmitBtn) {
    gallerySubmitBtn.addEventListener('click', () => {
        const imgData = canvas.toDataURL('image/png');
        const artist = playerNameInput.value.trim() || "ギャル（匿名）";
        const currentWord = "自由にお絵描き"; // ソロモードのデフォルト
        
        showSaveModal(imgData, artist, currentWord);
    });
}

// --- カテゴリー選択時の演出💍 ---
categorySelect.addEventListener('change', (e) => {
    if (e.target.value === 'yabai') {
        addChatMessage('System', 'キャーッ！ヤバい（笑）カテゴリー選んじゃった！🫣💖 覚悟してね！🤟✨', '#ff00ff');
        wordDisplay.classList.add('yabai-glow');
    } else {
        wordDisplay.classList.remove('yabai-glow');
    }
});

// --- 保存モーダルの制御 ---
function showSaveModal(imgData, artist, prompt) {
    pendingSaveData = imgData;
    modalArtistInput.value = artist;
    modalPromptInput.value = prompt;
    savePromptModal.classList.remove('hidden');
    savePromptModal.style.display = 'flex';
}

function closeSaveModal() {
    savePromptModal.classList.add('hidden');
    savePromptModal.style.display = 'none';
    pendingSaveData = null;
}

if (cancelSaveBtn) {
    cancelSaveBtn.addEventListener('click', closeSaveModal);
}

if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener('click', () => {
        const artist = modalArtistInput.value.trim() || "ギャル（匿名）";
        const prompt = modalPromptInput.value.trim() || "無題";
        
        if (pendingSaveData) {
            saveDrawingToServer(pendingSaveData, artist, prompt);
            closeSaveModal();
            addChatMessage('System', 'ギャラリーに保存したよ！🖼️💖', '#ff66b2');
        }
    });
}

// --- 画像検索機能 (保存された絵を検索) ---
async function searchSavedDrawings(query) {
    if (!query) return;
    
    // 検索中っぽく表示
    searchResultList.innerHTML = '<p style="padding:10px; color:#f6b;">みんなの絵を探してるよ…待っててね💖</p>';
    
    try {
        // サーバーの検索APIを叩く
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        searchResultList.innerHTML = '';
        
        if (data.results && data.results.length > 0) {
            data.results.forEach(img => {
                const imgEl = document.createElement('img');
                imgEl.src = img.thumbnail;
                imgEl.className = 'search-result-img';
                imgEl.title = img.title;
                imgEl.onerror = () => { imgEl.src = 'https://via.placeholder.com/150?text=Error'; console.error('Image load failed:', img.thumbnail); };
                
                // クリックしたら別タブで開く
                imgEl.onclick = () => window.open(img.url, '_blank');
                
                searchResultList.appendChild(imgEl);
            });
        } else {
            searchResultList.innerHTML = '<p style="padding:10px;">画像見つからなかった…ごめんね🥺<br>（まだ誰も描いてないかも！）</p>';
        }
    } catch (error) {
        console.error('Search API error:', error);
        searchResultList.innerHTML = '<p style="padding:10px; color:red;">エラー出ちゃった！ごめん！😭</p>';
    }
}

// --- ギャラリー表示機能 ---
async function openGallery() {
    fullGalleryContainer.innerHTML = '<p style="padding:40px; font-size:1.5rem; color:#f6b;">思い出をロード中…💕</p>';
    galleryOverlay.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/gallery');
        const data = await response.json();
        
        fullGalleryContainer.innerHTML = '';
        
        if (data.results && data.results.length > 0) {
            data.results.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'gallery-item';
                // 時間を読みやすくする
                const date = new Date(item.timestamp).toLocaleString();
                
                itemDiv.innerHTML = `
                    <p style="margin:5px 0; font-size:0.8rem; color:#999;">${date}</p>
                    <p style="margin:5px 0; font-weight:bold;">${item.artist} が描いた<br>「${item.prompt}」</p>
                    <img src="${item.thumbnail}" alt="絵" style="width:100%; border:2px solid #eee; border-radius:10px;" onerror="console.error('Gallery image load failed:', this.src); this.src='https://via.placeholder.com/300?text=Load+Error';">
                    <a href="${item.url}" download="drawing_${index}.png" class="cute-btn" style="text-decoration:none; display:inline-block; margin-top:10px; font-size:0.8rem; padding:5px 15px;">📥 保存</a>
                `;
                fullGalleryContainer.appendChild(itemDiv);
            });
        } else {
            fullGalleryContainer.innerHTML = '<p style="padding:40px; font-size:1.5rem;">まだ誰も描いてないみたい…🥺<br>お絵描きして思い出を作ろう！✨</p>';
        }
    } catch (error) {
        console.error('Gallery API error:', error);
        fullGalleryContainer.innerHTML = '<p style="padding:40px; color:red;">ロードに失敗しちゃった！😭</p>';
    }
}

function closeGallery() {
    galleryOverlay.classList.add('hidden');
}

if (openGalleryBtn) {
    openGalleryBtn.addEventListener('click', openGallery);
}
if (closeGalleryBtn) {
    closeGalleryBtn.addEventListener('click', closeGallery);
}

async function saveDrawingToServer(image, artist, prompt) {
    try {
        const response = await fetch('/api/save_drawing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, artist, prompt })
        });
        const result = await response.json();
        console.log('Drawing saved:', result);
    } catch (error) {
        console.error('Failed to save drawing:', error);
    }
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
        
        // サイドバーを隠してキャンバスを中央に！チャット見切れ防止💅✨
        if (sidebar) sidebar.style.display = 'none';
        
        // 名前を保存💕
        const name = playerNameInput.value.trim();
        if (name) localStorage.setItem('galDrawingName', name);

        saveBtn.classList.remove('hidden');
        gallerySubmitBtn.classList.remove('hidden'); // 追加
        nextWordBtn.classList.remove('hidden'); // 追加✨🎲
        exitSoloBtn.classList.remove('hidden');
        
        roundDisplay.textContent = '🎨 ソロお絵描き';
        wordDisplay.textContent = '自由にお絵描きしてね！';
        timerDisplay.textContent = '∞';
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
}

if (nextWordBtn) {
    nextWordBtn.addEventListener('click', async () => {
        if (!inSoloMode) return;
        try {
            const response = await fetch('/api/words');
            const data = await response.json();
            const allWords = Object.values(data).flat();
            const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
            currentWordText = randomWord.display;
            wordDisplay.textContent = `お題：${getDisplayText(currentWordText)}`;
            if (currentWordText.includes('yabai') || (categorySelect && categorySelect.value === 'yabai')) {
                wordDisplay.classList.add('yabai-glow');
            } else {
                wordDisplay.classList.remove('yabai-glow');
            }
            addChatMessage('System', `次のお題は「${getDisplayText(currentWordText)}」だよ！描いてみて！🖌️✨`, '#ff66b2');
        } catch (e) {
            console.error('Failed to fetch words for solo mode:', e);
            wordDisplay.textContent = 'お題：適当に描いちゃえ！🤣';
        }
    });
}

if (exitSoloBtn) {
    exitSoloBtn.addEventListener('click', () => {
        inSoloMode = false;
        canIDraw = false;
        saveBtn.classList.add('hidden');
        gallerySubmitBtn.classList.add('hidden');
        nextWordBtn.classList.add('hidden');
        exitSoloBtn.classList.add('hidden');
        if (sidebar) sidebar.style.display = 'flex';
        socket.emit('return_to_lobby'); 
    });
}

socket.on('connect', () => { myId = socket.id; });

socket.on('update_players', (players) => {
    if (inSoloMode) return;

    // 🆕 誰かが入室した時に音を鳴らすおッ！チャラリーン♪💍🤟💖
    if (players.length > lastKnownPlayerCount && lastKnownPlayerCount > 0) {
        playSE('join');
    }
    lastKnownPlayerCount = players.length;

    lastPlayersList = players; // キャッシュしておくおッ！💎
    playerList.innerHTML = '';
    
    const playerMe = players.find(p => p.id === myId);
    if (playerMe) updateCategorySelect(playerMe.lv || 0);

    let amIin = false;
    const MIN_SLOTS = 4; // 👈 最低4人分の枠を表示するおッ！💎
    
    players.forEach(p => {
        const li = document.createElement('li');
        li.className = 'player-item'; // 🆕 クラス追加ッ！💅✨
        
        // 🆕 XP進捗の計算ッ！💎✨💍 (公式: (Lv + 1) * 5)
        const currentLv = p.lv || 0;
        const nextLvXp = (currentLv + 1) * 5;
        const xpPercent = Math.min(100, Math.floor(((p.xp || 0) / nextLvXp) * 100));
        
        // 🆕 自分の時だけバルーンを出すおッ！🤟💖
        const xpBalloonHtml = (p.id === myId) ? `
            <div class="player-xp-bubble">
                <div>NEXT LEVEL: ${p.xp || 0} / ${nextLvXp} XP</div>
                <div class="xp-progress-bar">
                    <div class="xp-progress-fill" style="width: ${xpPercent}%"></div>
                </div>
            </div>
        ` : '';
        
        li.innerHTML = `
            <span class="player-lv-badge">Lv.${p.lv || 0}</span> 
            <span>${p.name} : ${p.score}pt</span>
            ${xpBalloonHtml}
        `;
        
        if (p.isReady) {
            const badge = document.createElement('span');
            badge.className = 'ready-badge';
            badge.textContent = 'OK! ✨';
            li.appendChild(badge);
            li.classList.add('is-ready');
        }
        if (p.hasGuessed) li.innerHTML += ' 🎉';
        if (p.id === myId) { 
            li.style.borderLeft = '5px solid var(--primary-color)'; 
            amIin = true;
            if (readyBtn) {
                if (p.isReady) {
                    readyBtn.textContent = '💖 準備完了！ 💖';
                    readyBtn.classList.add('ready-active');
                } else {
                    readyBtn.textContent = '✨ 準備オッケー！ ✨';
                    readyBtn.classList.remove('ready-active');
                }
            }
        }
        playerList.appendChild(li);
    });

    // 🌟 足りない枠を空枠で埋めるおッ！🤟💖
    for (let i = players.length; i < MIN_SLOTS; i++) {
        const li = document.createElement('li');
        li.className = 'player-item empty-slot'; // 空枠専用クラス✨
        li.innerHTML = `
            <span class="player-lv-badge" style="background:#eee; color:#aaa; border-color:#ddd;">-</span> 
            <span style="color: #aaa; font-style: italic;">参加者まち...🥺</span>
        `;
        li.style.background = 'rgba(255, 255, 255, 0.2)';
        li.style.border = '2px dashed #ffccdd';
        playerList.appendChild(li);
    }

    const humans = players.filter(p => !p.isNpc);
    const readyHumans = humans.filter(p => p.isReady);
    const meAuth = players.find(p => p.id === myId);
    if (readyBubble) {
        if (meAuth && !meAuth.isReady && readyHumans.length > 0 && readyHumans.length < humans.length) {
            readyBubble.classList.remove('hidden');
            if (humans.length - readyHumans.length === 1) {
                readyBubble.textContent = 'あと一人っ！早く押して〜！💅✨';
            } else {
                readyBubble.textContent = 'みんな！準備オッケー押して！💖';
            }
        } else {
            readyBubble.classList.add('hidden');
        }
    }

    if (amIin) {
        playerNameInput.style.display = 'none';
        joinBtn.style.display = 'none';
        if (soloModeBtn) soloModeBtn.style.display = 'none';
        gameSettings.classList.remove('hidden');

        // 👑 設定権限の制御（ボスの証ッ！一番上の人だけができるように！）💅✨
        const isHost = humans[0] && (humans[0].id === myId);
        const hostOnlyArea = document.getElementById('hostOnlySettings');
        
        if (hostOnlyArea) {
            if (isHost) {
                hostOnlyArea.style.opacity = '1';
                hostOnlyArea.style.pointerEvents = 'auto';
                timeLimitSelect.disabled = false;
                roundsSelect.disabled = false;
                
                if (!document.getElementById('hostOnlyLabel')) {
                    const label = document.createElement('div');
                    label.id = 'hostOnlyLabel';
                    label.innerHTML = '👑 <span style="font-size:0.8rem;">あなたはホスト（設定可能！）</span>';
                    label.style.color = '#ff9900';
                    label.style.fontWeight = 'bold';
                    label.style.marginBottom = '5px';
                    hostOnlyArea.insertBefore(label, hostOnlyArea.firstChild);
                }
            } else {
                hostOnlyArea.style.opacity = '0.6';
                hostOnlyArea.style.pointerEvents = 'none';
                timeLimitSelect.disabled = true;
                roundsSelect.disabled = true;
                
                const label = document.getElementById('hostOnlyLabel');
                if (label) label.remove();
            }
        }
        
        // カテゴリー選択は常に有効！💅✨
        if (categorySelect) categorySelect.disabled = false;
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
            overlayText.innerHTML = '次のターンにいくよ〜！✨<br>みんなが「準備オッケー！」したらスタート！💅💖';
        }
        canIDraw = false;
        if (turnEndBtn) turnEndBtn.classList.add('hidden'); // ターン終了時に隠す
        if (turnEndBubble) turnEndBubble.classList.add('hidden'); // 吹き出しも隠す！💅
        toolbar.style.pointerEvents = 'none';
        toolbar.style.opacity = '0.5';
        timerDisplay.textContent = '⏱️ --'; // ターン間は -- にするよ！💖
    }
});

socket.on('round_start', (data) => {
    if (inSoloMode) return;
    overlay.classList.add('hidden');
    podiumOverlay.classList.add('hidden');
    
    currentWordText = data.word;
    wordDisplay.textContent = `お題：${getDisplayText(data.word)}`;
    roundDisplay.textContent = `🏁 ${data.roundInfo}`;
    
    drawHistory = []; // 新しいターンの時に履歴リセット
    canIDraw = data.isDrawer;
    
    if (wordPopupOverlay) {
        wordPopupOverlay.style.opacity = '1';
        wordPopupOverlay.classList.remove('hidden');
        
        if (canIDraw) {
            wordPopupText.innerHTML = `<span style="font-size:2.5rem; color:#666; display:block; margin-bottom:15px;">お題</span>${getDisplayText(data.word)}`;
            wordPopupSubtext.textContent = 'あなたが描く番だよ！🖌️✨';
        } else {
            wordPopupText.innerHTML = `${data.drawerName}<br><span style="font-size:2.5rem; color:#666; display:block; margin-top:10px;">の番！</span>`;
            wordPopupSubtext.textContent = '何を描いてるか当てよう！👀';
        }
        
        // ポップアップ中は操作無効
        toolbar.style.pointerEvents = 'none';
        toolbar.style.opacity = '0.5';

        setTimeout(() => {
            wordPopupOverlay.style.opacity = '0';
            setTimeout(() => {
                wordPopupOverlay.classList.add('hidden');
                // フェードアウト後に操作可能にする
                if (canIDraw) {
                    toolbar.style.pointerEvents = 'auto';
                    toolbar.style.opacity = '1';
                    if (turnEndBtn) {
                        turnEndBtn.classList.remove('hidden'); // 描き手の時だけ表示✨
                        // 🆕 最初は隠しておくよ！誰かが正解してから出すし！💅✨
                        if (turnEndBubble) turnEndBubble.classList.add('hidden');
                    }
                    addChatMessage('System', 'あなたの番だよ！絵を描いてね！🖌️✨', '#ff66b2');
                } else {
                    toolbar.style.pointerEvents = 'none';
                    toolbar.style.opacity = '0.5';
                    if (turnEndBtn) turnEndBtn.classList.add('hidden'); // 描き手じゃない時は隠す
                    addChatMessage('System', `${data.drawerName}さんがお絵描き中…！当ててみて！👀`, '#ff66b2');
                }
            }, 500);
        }, 2000);
    } else {
        // フォールバック
        if (canIDraw) {
            toolbar.style.pointerEvents = 'auto';
            toolbar.style.opacity = '1';
            addChatMessage('System', 'あなたの番だよ！絵を描いてね！🖌️✨', '#ff66b2');
        } else {
            toolbar.style.pointerEvents = 'none';
            toolbar.style.opacity = '0.5';
            addChatMessage('System', `${data.drawerName}さんがお絵描き中…！当ててみて！👀`, '#ff66b2');
        }
    }
});

socket.on('timer', (time) => { if(!inSoloMode) timerDisplay.textContent = `⏱️ ${time}`; });
socket.on('draw', (data) => { if(!inSoloMode) drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser, data.isGlow, data.isRainbow, data.isHeart); });
socket.on('fill', (data) => { if(!inSoloMode) floodFill(data.x, data.y, data.color); });
socket.on('sync_canvas', (dataURL) => { 
    if(!inSoloMode) { 
        const img = new Image();
        img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
        img.src = dataURL;
    }
});
socket.on('clear_canvas', () => { if(!inSoloMode) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }});

socket.on('round_end', (data) => {
    if (inSoloMode) return;
    const imgData = canvas.toDataURL('image/png');
    gallery.push({ imgData, word: data.word, drawer: data.drawer });
    if (turnEndBtn) turnEndBtn.classList.add('hidden'); // ターン終わったら確実に隠す
    if (turnEndBubble) turnEndBubble.classList.add('hidden'); // 吹き出しも確実に隠す！💅
    playSE('finish');
    
    // 自分が描いた番だったらサーバーに保存する！✨
    if (canIDraw) {
        // 自分自身（描いた人）の名前を取得
        const me = data.players.find(p => p.id === myId);
        const defaultArtist = me ? me.name : 'Unknown';
        
        // カスタムモーダルを出すよ！✨
        showSaveModal(imgData, defaultArtist, data.word);
    }
});

socket.on('chat_message', (data) => {
    if (inSoloMode) return;
    addChatMessage(data.sender, data.text, data.color, data.type); 
    
    // 🆕 弾幕（Danmaku）の出し方を調整ッ！💎✨💍
    if (data.sender !== 'System') {
        // プレイヤーのメッセージを弾幕にするおッ！🤟
        // 正解の時は超デカく（isBig=true）して目立たせる！✨💍
        createDanmaku(data.text, data.color, data.type === 'correct_user', data.type);
    }
    
    if (data.type === 'correct_user') {
        playSE('correct');
        // キラキラ演出を連発！！✨💎💍
        for(let i=0; i<5; i++) {
            setTimeout(() => createWinSparkle(Math.random()*100, Math.random()*100), i * 200);
        }
        
        if (canIDraw && turnEndBubble) {
            turnEndBubble.classList.remove('hidden');
            turnEndBubble.textContent = '誰かが正解したよッ！👏✨ はよ「終了」押して次行こ！💖🤙';
        }
    }
    else if (data.type === 'correct') {
        // システムアナウンス（正解おめでとう！）はチャットのみでOK
    }
    else if (data.type === 'oshii') playSE('oshii');
});

socket.on('error', (msg) => { alert(msg); });

// 🆕 ゲーム終了：ランキング発表（エモさ爆上げver.） ✨🏆💍
// 🆕 ゲーム終了：ランキング発表（エモさ爆上げ順次公開ver.） ✨🏆💍 ❤️‍🔥
socket.on('game_over', async (sortedPlayers) => {
    if (inSoloMode) return;
    
    // UIリセット
    overlay.classList.add('hidden');
    podiumOverlay.classList.remove('hidden');
    podiumOverlay.style.display = 'flex';
    podiumContainer.innerHTML = '';
    
    // 戻るボタンとかは最初隠しておくよ💅
    backToWaitingBtn.style.display = 'none';
    const scrollTip = document.getElementById('galleryScrollTip');
    if (scrollTip) scrollTip.style.display = 'none';

    // ランキング順位を正確に割り当てるよ💎
    const rankedPlayers = sortedPlayers.map((p, i) => ({ ...p, rank: i + 1 }));
    
    // 3位以上とそれ以外に分ける✨
    const podiumPlayers = rankedPlayers.slice(0, 3);
    const otherPlayers = rankedPlayers.slice(3);

    // --- 🎭 順次公開ロジック開始！ ---
    // 下から順番に：4位以下 -> 3位 -> 2位 -> 1位 🚀
    
    // 1. 4位以下をサクッと表示（いれば）💅
    if (otherPlayers.length > 0) {
        otherPlayers.forEach(p => {
            const card = createRankCard(p, 'rank-other');
            podiumContainer.appendChild(card);
            setTimeout(() => card.classList.add('reveal'), 100);
        });
        await new Promise(r => setTimeout(r, 1000));
    }

    // 2. 3位 -> 2位 -> 1位 の順でタメながら発表！✨💍
    const reveals = [...podiumPlayers].reverse(); // [3位, 2位, 1位] にする
    
    for (const p of reveals) {
        const delay = p.rank === 1 ? 2500 : 1500; // 1位の前はめっちゃタメる！💎
        await new Promise(r => setTimeout(r, delay));
        
        const card = createRankCard(p, `rank-${p.rank}`);
        // 1位は真ん中に置きたいから、ちょっと工夫するよ💍
        if (p.rank === 1 && podiumContainer.children.length >= 2) {
            // 2位と3位の間に挿入！✨
            podiumContainer.insertBefore(card, podiumContainer.children[1]);
        } else {
            podiumContainer.appendChild(card);
        }

        // 表示！シュバッ！✨
        setTimeout(() => {
            card.classList.add('reveal');
            
            // 演出：音とキラキラ💎
            if (p.rank === 1) {
                playSE('correct'); // ファンファーレ的な！🎉
                // 大漁キラキラッ！！🐟✨
                for (let i = 0; i < 30; i++) {
                    setTimeout(() => createWinSparkle(Math.random() * 100, Math.random() * 50), i * 50);
                }
            } else {
                playSE('oshii'); // ちょっといい音♪
                createWinSparkle(50, 50);
            }
        }, 50);
    }

    // 3. 最後にボタンとギャラリーへの案内を出すよッ！💖
    await new Promise(r => setTimeout(r, 2000));
    backToWaitingBtn.style.display = 'block';
    if (scrollTip) scrollTip.style.display = 'block';

    // ギャラリーの作成
    if (galleryContainer) {
        galleryContainer.innerHTML = '';
        gallery.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-item';
            itemDiv.innerHTML = `
                <p style="margin:5px 0; font-weight:bold;">${item.drawer} が描いた 「${item.word}」</p>
                <img src="${item.imgData}" alt="絵">
                <a href="${item.imgData}" download="drawing_${index}.png" class="cute-btn" style="text-decoration:none; display:inline-block; margin-top:10px; font-size:0.9rem; padding: 10px 20px;">📥 保存する</a>
            `;
            galleryContainer.appendChild(itemDiv);
        });
    }
});

// ランクカードを作るヘルパー関数💅✨
function createRankCard(player, className) {
    const card = document.createElement('div');
    card.className = `rank-card ${className}`;
    
    let medal = '💎';
    if (player.rank === 1) medal = '🥇';
    else if (player.rank === 2) medal = '🥈';
    else if (player.rank === 3) medal = '🥉';
    else medal = `${player.rank}位`;

    card.innerHTML = `
        <div class="medal">${medal}</div>
        <div class="name">${player.name}</div>
        <div class="score">${player.score} pt</div>
    `;
    return card;
}

backToWaitingBtn.addEventListener('click', () => { socket.emit('return_to_lobby'); });

// 以前の join_game はタイトル画面の「GAME START」で名前チェックする方式にしたよ💅
// ここでは特に何もしないけど、コードから消さずにコメントアウトしておくね✨
/*
joinBtn.addEventListener('click', () => {
    initAudio();
    if (isBgmOn) startBGM();
    const name = playerNameInput.value.trim();
    if(name === "") return alert("名前入れてよね！🥺");
    
    localStorage.setItem('galDrawingName', name); 
    setCookie('galPlayerName', name);
    
    socket.emit('join_game', name, playerToken);
});
*/

// 🆕 ルーム一覧を受け取って表示！💅✨💍
socket.on('room_list', (rooms) => {
    if (!roomGrid) return;
    roomGrid.innerHTML = '';
    
    rooms.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card';
        if (room.playerCount >= 4) card.classList.add('full'); // 4人制限💅

        const isFree = room.playerCount === 0;
        const hostInfo = room.hostName ? `👑 ${room.hostName}` : '誰もいないお🥺';
        const commentInfo = room.comment ? room.comment : (isFree ? '新しいルームを作っちゃお！💖' : 'まったりお絵描き中✨');

        card.innerHTML = `
            <div class="room-lock-icon">${room.hasPassword ? '🔒' : '🔓'}</div>
            <h3 class="room-name">${commentInfo}</h3>
            <div class="room-host">${hostInfo}</div>
            <div class="room-players">👤 ${room.playerCount} / 4</div>
            <button class="join-room-btn animate-pulse" ${room.playerCount >= 4 ? 'disabled' : ''}>
                ${room.playerCount >= 4 ? '満室🥺' : (isFree ? 'ルームを作る🚀' : '遊びに行く！💖')}
            </button>
        `;
        
        const btn = card.querySelector('.join-room-btn');
        btn.addEventListener('click', () => {
            const name = authNameInput.value.trim(); // 認証済みの名前を使うよッ！💅
            
            if (isFree) {
                // ルーム作成モーダルを開く
                pendingJoinRoomId = room.id;
                roomSetupModal.classList.remove('hidden');
                setupCommentInput.value = '初心者歓迎！💖';
                setupPasswordInput.value = '';
            } else if (room.hasPassword) {
                // パスワード入力モーダルを開く
                pendingJoinRoomId = room.id;
                roomPasswordModal.classList.remove('hidden');
                joinPasswordInput.value = '';
            } else {
                // そのまま入室
                socket.emit('join_room', { 
                    roomId: room.id, 
                    playerName: name, 
                    playerToken: playerToken 
                });
            }
        });
        
        roomGrid.appendChild(card);
    });
});

// 🆕 ルーム作成・パスワードモーダルのボタン処理 ✨💍
if (cancelSetupBtn) cancelSetupBtn.addEventListener('click', () => { roomSetupModal.classList.add('hidden'); });
if (confirmSetupBtn) {
    confirmSetupBtn.addEventListener('click', () => {
        const name = authNameInput.value.trim();
        const comment = setupCommentInput.value.trim();
        const password = setupPasswordInput.value.trim();
        
        socket.emit('join_room', {
            roomId: pendingJoinRoomId,
            playerName: name,
            playerToken: playerToken,
            roomComment: comment,
            password: password
        });
        
        roomSetupModal.classList.add('hidden');
    });
}

if (cancelPasswordBtn) cancelPasswordBtn.addEventListener('click', () => { roomPasswordModal.classList.add('hidden'); });
if (confirmPasswordBtn) {
    confirmPasswordBtn.addEventListener('click', () => {
        const name = authNameInput.value.trim();
        const password = joinPasswordInput.value.trim();
        
        socket.emit('join_room', {
            roomId: pendingJoinRoomId,
            playerName: name,
            playerToken: playerToken,
            password: password
        });
        
        roomPasswordModal.classList.add('hidden');
    });
}

// 🆕 入室失敗（パスワード間違いなど）の処理 🙅‍♀️
socket.on('join_failed', (msg) => {
    alert(msg);
    // パスワード間違いなら再度入力を促すか、モーダルを閉じない
    if (msg.includes('パスワード')) {
        roomPasswordModal.classList.remove('hidden');
        joinPasswordInput.value = '';
    }
});

// 🆕 参加成功！ゲーム画面に切り替えるよッ！✨💍💖
socket.on('join_success', (data) => {
    roomSelectScreen.style.opacity = '0';
    roomSelectScreen.style.pointerEvents = 'none';
    
    // 🧹 チャットをまっさらにクリア！✨💍
    if (chatBox) chatBox.innerHTML = '';
    lastKnownPlayerCount = 0; // 🆕 カウントをリセットして入室音に備えるおッ！！💎✨
    
    setTimeout(() => {
        roomSelectScreen.classList.add('hidden');
        // モーダルも念のため隠すおッ！💎✨
        roomSetupModal.classList.add('hidden');
        roomPasswordModal.classList.add('hidden');
        
        // 親のコンテナを表示させてから setupArea を表示するおッ！💎✨
        document.querySelector('.container').classList.remove('hidden');
        setupArea.classList.remove('hidden');
        playArea.classList.add('hidden'); // プレイ画面はまだ隠しておく💅

        if (data.minLvPerCategory) {
            window.minLvPerCategory = data.minLvPerCategory; // グローバルに保存！💎
            // 自分のレベルに合わせてカテゴリーリストを更新するお
            updateCategorySelect(myLv); // 🆕 myLv を使うように修正ッ！✨💍
        }

        if (chatBox) chatBox.innerHTML = ''; // 🆕 チャットをクリアして、ルームのバイブスに集中！💎✨
        addChatMessage('System', `${data.roomName} に参加したよ！盛り上がっていこー！✨💍`, '#ff66b2');
    }, 500);
});

// 🆕 カテゴリーのLV制限を反映させるおッ！💎✨💍
function updateCategorySelect(myLv) {
    if (!categorySelect || !window.minLvPerCategory) return;
    
    Array.from(categorySelect.options).forEach(opt => {
        const catKey = opt.value;
        const minLv = window.minLvPerCategory[catKey] || 1;
        
        // 🆕 デバッグ用ログ！💍 (ブラウザのコンソールで確認できるお)
        console.log(`[CAT-CHECK] ${catKey}: PlayerLv=${myLv}, MinLv=${minLv} -> ${myLv < minLv ? 'DISABLED' : 'OK'}`);

        if (myLv < minLv) {
            opt.disabled = true;
            opt.style.color = '#ccc';
            opt.style.background = '#f5f5f5';
            opt.text = `${opt.text.split(' (')[0]} (Lv.${minLv}〜)`;
        } else {
            opt.disabled = false;
            opt.style.color = '';
            opt.style.background = '';
            opt.text = opt.text.split(' (')[0]; // 元の名前に戻す
        }
    });

    // もし選択中のカテゴリーがロックされちゃったら、mixに戻すお💅
    if (categorySelect.selectedOptions[0]?.disabled) {
        categorySelect.value = 'mix';
    }
}

// lastPlayersList moved to top

if (readyBtn) {
    readyBtn.addEventListener('click', () => {
        socket.emit('toggle_ready', { 
            timeLimit: parseInt(timeLimitSelect.value),
            rounds: parseInt(roundsSelect.value),
            category: categorySelect ? categorySelect.value : 'mix'
        });
    });
}

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    // 💎 /point コマンドでお題LV設定モーダルを開くおッ！🎯✨
    if (msg === '/point') {
        chatInput.value = '';
        openLvModal();
        return;
    }

    socket.emit('send_message', msg);
    chatInput.value = '';
}

// --- 💎 お題難易度LV設定モーダルのロジック 💅✨ ---
const lvSettingsOverlay = document.getElementById('lvSettingsOverlay');
const wordLvSlider = document.getElementById('wordLvSlider');
const lvDisplayNumber = document.getElementById('lvDisplayNumber');
const lvDisplayEmoji = document.getElementById('lvDisplayEmoji');
const lvDisplayDesc = document.getElementById('lvDisplayDesc');
const saveLvBtn = document.getElementById('saveLvBtn');
const closeLvBtn = document.getElementById('closeLvBtn');

// 🆕 タブとパネルの要素
const tabMyPrefs = document.getElementById('tabMyPrefs');
const tabWordMaster = document.getElementById('tabWordMaster');
const paneMyPrefs = document.getElementById('paneMyPrefs');
const paneWordMaster = document.getElementById('paneWordMaster');
const wordMasterContainer = document.getElementById('wordMasterContainer');
const saveAllMasterLvsBtn = document.getElementById('saveAllMasterLvsBtn');

const LV_EMOJI = ['🌱','🌱','💧','💧','🌊','🌊','🔥','🔥','⚡','⚡','🌙','🌙','🍀','🍀','🔰','🔰','💎','💎','👑','💀'];
const LV_DESC = [
    '初心者向け！気楽に描こう💕', '初心者向け！気楽に描こう💕',
    'ちょっとだけ難しいよ🌱', 'ちょっとだけ難しいよ🌱',
    '中くらいの難しさ！💪', '中くらいの難しさ！💪',
    '脳みそ使うよ🧠✨', '脳みそ使うよ🧠✨',
    'かなり手強い…⚡', 'かなり手強い…⚡',
    '上級者向け！夜に向きやってみて🌙', '上級者向け！夜に向きやってみて🌙',
    'マジで難しい！💀', 'マジで難しい！💀',
    'ヤバいLV！鬼畜だよ🔰', 'ヤバいLV！鬼畜だよ🔰',
    'ほぼ神様レベル…💎', 'ほぼ神様レベル…💎',
    '👑最強鬼畜！受けて立てる？👑', '💀伝説のLV！覚悟しな💀',
];

function openLvModal() {
    if (!lvSettingsOverlay) return;
    lvSettingsOverlay.classList.remove('hidden');
    lvSettingsOverlay.style.display = 'flex';
    switchLvTab('myPrefs'); // 最初は自分の設定を出す
}

function switchLvTab(tab) {
    if (!tabMyPrefs || !tabWordMaster || !paneMyPrefs || !paneWordMaster) return;
    
    if (tab === 'myPrefs') {
        tabMyPrefs.classList.add('active');
        tabMyPrefs.style.color = 'var(--primary-color)';
        tabMyPrefs.style.borderBottom = '5px solid var(--primary-color)';
        tabWordMaster.classList.remove('active');
        tabWordMaster.style.color = '#888';
        tabWordMaster.style.borderBottom = '5px solid transparent';
        paneMyPrefs.classList.remove('hidden');
        paneWordMaster.classList.add('hidden');
    } else {
        tabWordMaster.classList.add('active');
        tabWordMaster.style.color = 'var(--primary-color)';
        tabWordMaster.style.borderBottom = '5px solid var(--primary-color)';
        tabMyPrefs.classList.remove('active');
        tabMyPrefs.style.color = '#888';
        tabMyPrefs.style.borderBottom = '5px solid transparent';
        paneWordMaster.classList.remove('hidden');
        paneMyPrefs.classList.add('hidden');
        
        // マスターリストを表示する時はデータを要求するお！
        socket.emit('request_all_words');
    }
}

if (tabMyPrefs) tabMyPrefs.addEventListener('click', () => switchLvTab('myPrefs'));
if (tabWordMaster) tabWordMaster.addEventListener('click', () => switchLvTab('wordMaster'));

// 💎 サーバーからお題データが届いたお！💅✨
socket.on('all_words_data', (categories) => {
    if (!wordMasterContainer) return;
    wordMasterContainer.innerHTML = '';
    
    // カテゴリー名を日本語にするマッピング
    const catNames = {
        animal: '🐾 動物', food: '🍓 食べ物', daily: '🏠 日用品', yabai: '🔞 ヤバい系',
        situation: '💑 シチュエーション', pose: '💃 ポーズ', job: '👮 職業',
        vehicle: '🚀 乗り物', landmark: '🗼 名所', item: '📦 アイテム', bug: '🦟 虫'
    };

    for (const catKey in categories) {
        const words = categories[catKey];
        const catSection = document.createElement('div');
        catSection.style.marginBottom = '30px';
        
        const title = document.createElement('h3');
        title.textContent = catNames[catKey] || catKey;
        title.style.borderLeft = '10px solid var(--primary-color)';
        title.style.paddingLeft = '15px';
        title.style.marginBottom = '15px';
        title.style.fontSize = '1.4rem';
        catSection.appendChild(title);
        
        const list = document.createElement('div');
        list.style.display = 'grid';
        list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        list.style.gap = '10px';
        
        words.forEach(word => {
            const item = document.createElement('div');
            item.style.background = '#fff';
            item.style.padding = '10px 15px';
            item.style.borderRadius = '15px';
            item.style.border = '1px solid #eee';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.className = 'word-lv-edit-item';
            
            const label = document.createElement('span');
            label.textContent = word.display;
            label.style.fontSize = '0.9rem';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '1';
            input.max = '20';
            input.value = word.lv;
            input.dataset.display = word.display; // 検索キー
            input.style.width = '45px';
            input.style.padding = '5px';
            input.style.borderRadius = '8px';
            input.style.border = '2px solid #ffcce6';
            input.style.textAlign = 'center';
            input.style.fontWeight = 'bold';
            
            item.appendChild(label);
            item.appendChild(input);
            list.appendChild(item);
        });
        
        catSection.appendChild(list);
        wordMasterContainer.appendChild(catSection);
    }
});

// 💾 全お題のLVを一括保存するおッ！✨
if (saveAllMasterLvsBtn) {
    saveAllMasterLvsBtn.addEventListener('click', () => {
        const inputs = wordMasterContainer.querySelectorAll('input[type="number"]');
        const changes = [];
        inputs.forEach(input => {
            changes.push({
                display: input.dataset.display,
                lv: parseInt(input.value, 10)
            });
        });
        
        socket.emit('bulk_set_word_lvs', changes);
        saveAllMasterLvsBtn.textContent = '⌛ 保存中...';
        saveAllMasterLvsBtn.disabled = true;
    });
}

socket.on('word_lvs_saved', (data) => {
    if (saveAllMasterLvsBtn) {
        saveAllMasterLvsBtn.textContent = '✅ 保存完了ッ！✨';
        setTimeout(() => {
            saveAllMasterLvsBtn.textContent = '💾 全て保存ッ！';
            saveAllMasterLvsBtn.disabled = false;
        }, 2000);
    }
    addChatMessage('System', `${data.count}個のお題LVを更新したよッ！💎💅`, '#ff66b2');
});

if (wordLvSlider) {
    wordLvSlider.addEventListener('input', () => {
        const lv = parseInt(wordLvSlider.value, 10);
        if (lvDisplayNumber) lvDisplayNumber.textContent = `LV ${lv}`;
        if (lvDisplayEmoji) lvDisplayEmoji.textContent = LV_EMOJI[lv - 1] || '🌟';
        if (lvDisplayDesc) lvDisplayDesc.textContent = LV_DESC[lv - 1] || '';
    });
}

if (saveLvBtn) {
    saveLvBtn.addEventListener('click', () => {
        const lv = parseInt(wordLvSlider.value, 10);
        socket.emit('set_word_lv', lv);
        if (lvSettingsOverlay) {
            lvSettingsOverlay.classList.add('hidden');
            lvSettingsOverlay.style.display = 'none';
        }
    });
}

if (closeLvBtn) {
    closeLvBtn.addEventListener('click', () => {
        if (lvSettingsOverlay) {
            lvSettingsOverlay.classList.add('hidden');
            lvSettingsOverlay.style.display = 'none';
        }
    });
}

// サーバーから確認が来たらチャットに出すおッ！💎
socket.on('word_lv_updated', (lv) => {
    addChatMessage('System', `🎯 お題のLVをLV${lv}に設定したよ！次のターンから適用されるよッ！💅✨`, '#ff66b2');
});


// 送信ボタンは削除されたので、Enterキーのみで送信するよ💅✨

// 画像検索ボタンのイベント
if (searchImageBtn) {
    searchImageBtn.addEventListener('click', () => {
        if (!currentWordText || currentWordText === '????') {
            alert('お題が出てない時は検索できないよ！🥺');
            return;
        }
        
        // 絵文字を抜いたお題をクエリにする
        const query = getDisplayText(currentWordText);
        imageSearchContainer.classList.remove('hidden');
        searchSavedDrawings(query);
    });
}

// 閉じるボタン
if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
        imageSearchContainer.classList.add('hidden');
    });
}

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

function addChatMessage(sender, text, color, type) {
    const container = document.createElement('div');
    const isMe = sender === (currentPlayerName || localStorage.getItem('galAuthName') || localStorage.getItem('galDrawingName') || '自分');
    
    container.className = isMe ? 'chat-msg-container mine' : 'chat-msg-container';
    
    let html = '';
    // 🆕 他人のメッセージかSystemメッセージなら、吹き出しの上に名前を出すおッ！💎✨💍
    if (!isMe) {
        html += `<span class="chat-name" style="color: ${color || '#ff66b2'}">${sender}</span>`;
    }
    
    // 🆕 吹き出し本体の生成
    const baseClass = isMe ? 'chat-msg mine' : 'chat-msg';
    const bubbleClass = (type === 'correct_user') ? `${baseClass} correct-user` : baseClass;
    html += `
        <div class="${bubbleClass}">
            <span class="msg-text">${text}</span>
        </div>
    `;
    
    container.innerHTML = html;
    chatBox.appendChild(container);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function createDanmaku(text, color, isBig = false, type = '') {
    if (!danmakuContainer) return;
    
    const div = document.createElement('div');
    // 🆕 正解なら専用のキラキラ＆超巨大クラスを付与ッ！🚀✨💍
    div.className = isBig ? 'danmaku-item danmaku-correct' : 'danmaku-item';
    
    if (type === 'correct_user') {
        // プレイヤーの打ち込んだ答えそのものをデカく出す！✨💍
        div.textContent = text;
    } else if (isBig) {
        div.textContent = `💎✨ 正解：${text} ✨💎`;
    } else {
        div.textContent = text;
    }
    
    // 表示予定の最大の高さ (文字がはみ出さないように)
    const padding = isBig ? 150 : 50;
    const maxHeight = danmakuContainer.clientHeight - padding; 
    const topPos = Math.random() * (maxHeight > 0 ? maxHeight : (isBig ? 300 : 450)); 
    // 弾幕を右端からスタートさせる設定だよ！🚀
    div.style.left = '100%'; 
    div.style.top = `${topPos}px`;
    
    danmakuContainer.appendChild(div);
    
    requestAnimationFrame(() => {
        const textWidth = div.scrollWidth || div.clientWidth;
        const containerWidth = danmakuContainer.clientWidth || 1250; // 🆕 1250px（枠ギリギリサイズ）ベースに！💍
        
        // デカい弾幕はちょっとゆっくり見せたいから 7秒、通常は 5秒にするよ✨
        const duration = isBig ? 7 : 5;
        div.style.transition = `transform ${duration}s linear`;
        // 右端(100%)からコンテナの幅＋自分の幅の分だけ左にスライド！シュババッ！！💨
        div.style.transform = `translateX(-${containerWidth + textWidth + 200}px)`;
    });
    
    setTimeout(() => {
        if (div && div.parentNode) {
            div.remove();
        }
    }, 7500);
}

// ✨ 正解時やランキング発表時にキラキラエフェクトを降らせるよ！✨💍💖 (Advanced Emo Edition)
function createWinSparkle(x, y) {
    const container = document.body; // 画面全体に降らせる！✨
    
    for (let i = 0; i < 8; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'win-sparkle';
        sparkle.innerHTML = ['✨', '💎', '💖', '💍', '🪄', '🍭', '🎀', '🔥'][Math.floor(Math.random() * 8)];
        
        // 開始位置
        // x, y が 0~100 のパーセントならそれに合わせる、なければランダム
        const startX = (x !== undefined) ? (x + (Math.random() * 20 - 10)) : (Math.random() * 100);
        const startY = (y !== undefined) ? (y + (Math.random() * 20 - 10)) : (Math.random() * 100);
        
        sparkle.style.left = `${startX}vw`; // 画面幅基準
        sparkle.style.top = `${startY}vh`;
        sparkle.style.fontSize = `${Math.random() * 30 + 20}px`;
        
        // 飛び散る距離（CSSの変数に渡すよ！）💅
        const dx = (Math.random() - 0.5) * 400;
        const dy = (Math.random() - 0.5) * 400;
        sparkle.style.setProperty('--dx', `${dx}px`);
        sparkle.style.setProperty('--dy', `${dy}px`);
        
        container.appendChild(sparkle);
        
        // 終わったら消去！💎
        setTimeout(() => sparkle.remove(), 1500);
    }
}

// サーバーからページ移動の指示があった時用💅✨
socket.on('redirect', (url) => {
    if (url === '/ban.html') {
        openBanOverlay();
    } else {
        window.location.href = url;
    }
});

// BANオーバーレイを開くよ！💅✨
async function openBanOverlay() {
    banOverlay.classList.remove('hidden');
    banOverlay.style.display = 'flex';
    
    const resp = await fetch('/api/gallery');
    const data = await resp.json();
    
    banGrid.innerHTML = '';
    data.results.forEach(d => {
        const card = document.createElement('div');
        card.className = 'drawing-card'; // ban.htmlのスタイルを一部流用
        card.style.background = 'white';
        card.style.borderRadius = '20px';
        card.style.padding = '15px';
        card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
        
        card.innerHTML = `
            <img src="${d.url}" alt="${d.prompt}" style="width:100%; border-radius:10px; margin-bottom:10px;">
            <div style="font-size:0.9rem; color:#666; margin-bottom:15px;">
                <strong>${d.prompt}</strong><br>
                by ${d.artist}<br>
                ${new Date(d.timestamp).toLocaleString()}
            </div>
            <button class="cute-btn" style="background:#ff3344; color:white; width:100%;" onclick="banDrawing('${d.id}')">🚫 BAN！</button>
        `;
        banGrid.appendChild(card);
    });
}

// 絵をBANするよ！😱💅
window.banDrawing = async function(filename) {
    if (!confirm('マジでこの絵消しちゃう？😱💅')) return;
    
    const resp = await fetch('/api/delete_drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
    });
    
    if (resp.ok) {
        alert('お掃除完了ッ！✨✨');
        openBanOverlay(); // 再読み込み！
    } else {
        alert('なんかエラー出ちゃった🥺');
    }
};

closeBanBtn.addEventListener('click', () => {
    banOverlay.classList.add('hidden');
    banOverlay.style.display = 'none';
});

// ページ読み込み時に保存された名前を復元するよ！💅✨
window.addEventListener('DOMContentLoaded', () => {
    const savedName = getCookie('galPlayerName') || localStorage.getItem('galDrawingName');
    if (savedName && playerNameInput) {
        playerNameInput.value = savedName;
    }
    updateScale(); // 初回実行！💎
});

// 🚪 ルームから脱出するおッ！✨💍
if (exitRoomBtn) {
    exitRoomBtn.addEventListener('click', () => {
        showCustomConfirm('マジでこのルームからおさらばしちゃう？🥺💔', () => {
            socket.emit('leave_room');
            
            // UIをルーム選択画面に戻すおッ！💅✨
            document.querySelector('.container').classList.add('hidden');
            roomSelectScreen.classList.remove('hidden');
            roomSelectScreen.style.display = 'flex'; // 確実に表示！💎
            roomSelectScreen.style.opacity = '1'; // 👈 透明度を戻すおッ！✨💍
            roomSelectScreen.style.pointerEvents = 'auto'; // 👈 操作できるように戻すおッ！🤟💖
            
            // ステータスをリセット
            inSoloMode = false;
            canIDraw = false;
            isDrawing = false;
            
            // ルーム一覧を最新にする
            socket.emit('get_rooms');
        });
    });
}

// --- 💎 デスクトップUI維持スケーリングの魔法 (Overlays Included!) 💎 ---
function updateScale() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;
    
    // 💎 新時代の「ハイブリッド・フルワイド・スケーリング」開幕っ！💅✨💍
    // 横幅は 100% ギリギリまで使い切るのがギャルの鉄則！🤟💖
    
    const baseHeight = 1000; // 👈 全体の縦を 100px 広くして、さらに快適にッ！💎✨
    const baseWidth = 2150;  // 👈 センターパネルのさらなる拡張（1200px）に合わせて 2150px に最適化ッ！✨💍
    
    const currentHeight = window.innerHeight;
    const currentWidth = window.innerWidth;
    
    // 縦横どっちかキツい方に合わせて縮めるおッ！🚀
    const scale = Math.min(currentHeight / baseHeight, currentWidth / baseWidth);
    
    // 👗 メインコンテナだけをスケーリング対象に！💍
    const targets = ['.container'];
    
    targets.forEach(selector => {
        const els = document.querySelectorAll(selector);
        els.forEach(el => {
            // 💎 新時代の「ピクセル・パーフェクト・センター・スケーリング」！🤟💖
            el.style.position = 'absolute';
            el.style.top = '0';
            el.style.left = '50%';
            
            // 幅と高さは基準値でガッチリ固定するおッ！💎（これがズレると中身が崩れる！）
            el.style.width = `${baseWidth}px`;
            if (selector === '.container') {
                el.style.height = `${baseHeight}px`; // 👈 `auto`は絶ッ対にNG！中身が押しつぶされる原因！💅
                el.style.maxHeight = 'none'; // 👈 制限解除！
            } else {
                el.style.height = 'auto';
                el.style.minHeight = `${baseHeight}px`;
            }
            
            el.style.transform = `translateX(-50%) scale(${scale})`;
            el.style.transformOrigin = 'top center'; // 👈 中央起点でスケーリング！✨
            
            el.style.display = 'flex';
            if (selector === '.container') {
                el.style.flexDirection = 'row';
                el.style.alignItems = 'stretch';
                el.style.justifyContent = 'center'; // 横方向に中央寄せ！💍
            } else {
                el.style.flexDirection = 'column';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'flex-start'; // 縦は上から！💅
            }

            if (el.classList.contains('full-overlay')) {
                // el.style.overflowY = 'visible'; // 👈 不要ッ！CSSで制御するおッ！💅💍
            }
        });
    });
    
    console.log(`[APP-WIDE-SCALE] Scale: ${scale.toFixed(3)} (W: ${currentWidth}, H: ${currentHeight})`);
}

window.addEventListener('resize', updateScale);
window.addEventListener('load', updateScale);
socket.on('level_up_effect', (data) => {
    // レベルアップ演出！🆙✨💍
    const msg = `🆙✨ LEVEL UP! Lv.${data.lv} ✨🆙`;
    addChatMessage('System', msg, '#ffcc00');
    
    // 画面中央にデカデカと表示
    const popup = document.createElement('div');
    popup.className = 'level-up-popup';
    popup.textContent = msg;
    document.body.appendChild(popup);
    
    playSE('celebration');
    
    // クラッカーエフェクト🎉
    for(let i=0; i<30; i++) {
        setTimeout(() => {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            createSparkle(x, y, '#ffcc00', true);
        }, i * 50);
    }
    
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => popup.remove(), 1000);
    }, 3000);
});

// 🆕 ギャル専用・特製確認モーダルを表示するよッ！💎✨💍
function showCustomConfirm(msg, onOk) {
    confirmMessage.innerText = msg;
    currentConfirmAction = onOk;
    customConfirmOverlay.classList.remove('hidden');
    customConfirmOverlay.style.display = 'flex';
}

if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', () => {
        if (currentConfirmAction) currentConfirmAction();
        customConfirmOverlay.classList.add('hidden');
        customConfirmOverlay.style.display = 'none';
        currentConfirmAction = null;
    });
}
if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => {
        customConfirmOverlay.classList.add('hidden');
        customConfirmOverlay.style.display = 'none';
        currentConfirmAction = null;
    });
}

socket.on('open_admin_panel', (players) => {
    if (!adminOverlay) return;
    
    adminOverlay.classList.remove('hidden');
    adminOverlay.style.display = 'flex';
    updateAdminPlayerList(players);
});

function updateAdminPlayerList(allPlayers) {
    if (!adminPlayerList) return;
    adminPlayerList.innerHTML = '';
    
    // トークン（ID）付きで全プレイヤーを表示するお！💖✨💍
    allPlayers.forEach(p => {
        const card = document.createElement('div');
        card.className = 'admin-player-card';
        if (!p.isOnline) card.style.opacity = '0.7'; // オフラインはちょっと薄く

        const shortToken = p.token ? p.token.substring(0, 8) + '...' : 'Guest';
        const statusBadge = p.isOnline 
            ? '<span class="status-badge online">ONLINE 💖</span>' 
            : '<span class="status-badge offline">OFFLINE 🥺</span>';

        card.innerHTML = `
            <div class="admin-player-info">
                <div class="admin-player-name-row">
                    <span class="admin-player-name">${p.name || 'Unknown'}</span>
                    ${statusBadge}
                </div>
                <div class="admin-player-id">ID: <code>${shortToken}</code></div>
                <div class="admin-edit-fields">
                    <label>LV: <input type="number" class="edit-lv" value="${p.lv || 0}" style="width:50px;"></label>
                    <label>XP: <input type="number" class="edit-xp" value="${p.xp || 0}" style="width:60px;"></label>
                    <label>Pts: <input type="number" class="edit-score" value="${p.score || 0}" style="width:50px;"></label>
                </div>
            </div>
            <div class="admin-actions">
                <button class="apply-btn" data-token="${p.token}">✅ 適用</button>
                <button class="reset-btn" data-token="${p.token}" style="margin-top:5px;">💀 浄化</button>
            </div>
        `;
        adminPlayerList.appendChild(card);
    });
}

if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', () => {
        adminOverlay.classList.add('hidden');
        adminOverlay.style.display = 'none';
    });
}

// ボタンのイベント委譲
if (adminPlayerList) {
    adminPlayerList.addEventListener('click', (e) => {
        const resetBtn = e.target.closest('.reset-btn');
        const applyBtn = e.target.closest('.apply-btn');
        
        if (resetBtn) {
            const token = resetBtn.getAttribute('data-token');
            console.log(`[ADMIN] Reset request for token: ${token}`);
            // alert(`[DEBUG] 浄化ボタンが押されたお！トークン: ${token}`); // デバッグ用は外すね💅
            
            showCustomConfirm('本当にこのプレイヤーを浄化（リセット）しちゃう？🥺💍', () => {
                socket.emit('reset_player_data', token);
            });
        } 
        else if (applyBtn) {
            const token = applyBtn.getAttribute('data-token');
            const card = applyBtn.closest('.admin-player-card');
            const lv = card.querySelector('.edit-lv').value;
            const xp = card.querySelector('.edit-xp').value;
            const score = card.querySelector('.edit-score').value;
            
            console.log(`[ADMIN] Modify request for token: ${token}, val: lv=${lv}, xp=${xp}, score=${score}`);
            if (token) {
                socket.emit('modify_player_data', {
                    targetToken: token,
                    lv: parseInt(lv),
                    xp: parseInt(xp),
                    score: parseInt(score)
                });
                alert('神（管理者）の力でデータを書き換えたお！💖✨💍');
            }
        }
    });
}
