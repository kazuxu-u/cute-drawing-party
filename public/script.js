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
const readyBtn = document.getElementById('readyBtn');
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

// --- 💎 タイトル画面の制御 💎 ---
const titleScreen = document.getElementById('titleScreen');
const gameStartBtn = document.getElementById('gameStartBtn');

if (gameStartBtn) {
    gameStartBtn.addEventListener('click', () => {
        initAudio();
        if (isBgmOn) startBGM();
        
        // フェードアウトさせて消す！💅
        titleScreen.style.opacity = '0';
        titleScreen.style.pointerEvents = 'none';
        
        // 演出用に少し遅らせてDOMから消す（or 非表示）
        setTimeout(() => {
            titleScreen.classList.add('hidden');
        }, 800);
        
        addChatMessage('System', 'パーティーへようこそ！楽しんでねっ💖✨', '#ff66b2');
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
const sidebar = document.querySelector('.sidebar'); // サイドバー取得💅
const toolbar = document.getElementById('toolbar');

let myId = null;
let isDrawing = false;
let canIDraw = false;
let inSoloMode = false;
let currentSettings = { color: '#000000', size: 5, isEraser: false, isFill: false, isGlow: false, isRainbow: false };
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

// プレイヤー識別用のトークン生成（または取得）🚀
let playerToken = getCookie('galPlayerToken');
if (!playerToken) {
    playerToken = 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    setCookie('galPlayerToken', playerToken);
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
    }
}

// Canvas周り
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

let lastX = 0, lastY = 0;

function drawLine(x0, y0, x1, y1, color, size, isErase, isGlow, isRainbow) {
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
}

// ✨ キラキラ（スパークル）を生成する関数！💖
function createSparkle(x, y, color) {
    if (!sparkleContainer) return;
    
    // 💖 エフェクト大増量！盛り盛り仕様にするよ！💅✨
    const count = 3; // 1回で3個出しちゃう欲張りセット！💍
    
    for (let i = 0; i < count; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        
        // ✨ 修正：パーセント（%）で座標を指定するよ！💅
        // これならキャンバスがどんなサイズにリサイズされても、ペン先にピタッと重なるね！💎💍
        sparkle.style.left = `${(x / 600) * 100}%`;
        sparkle.style.top = `${(y / 500) * 100}%`;
        
        // ランダムな方向に飛ばす！シュババッ！💨
        const angle = Math.random() * Math.PI * 2;
        const velocity = 3 + Math.random() * 8; // ちょっと遠くまで飛ばすよ！💎
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        sparkle.style.setProperty('--vx', `${vx}px`);
        sparkle.style.setProperty('--vy', `${vy}px`);
        
        // 宝石やハートをランダムに！💎💍💖✨🌟💄🍭🌈
        const shapes = ['✨', '💖', '⭐', '💎', '🌸', '💍', '🌟', '💄', '🍭', '🌈', '🔥'];
        sparkle.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        sparkle.style.backgroundColor = 'transparent';
        sparkle.style.fontSize = `${12 + Math.random() * 20}px`; // デカくするよ！💅
        sparkle.style.textShadow = `0 0 10px ${color}`; // 色に合わせて光らせる！✨

        sparkleContainer.appendChild(sparkle);
        
        // 0.8秒くらいで消す！（回転率UP💅）
        setTimeout(() => {
            sparkle.remove();
        }, 800);
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
    drawLine(lastX, lastY, pos.x, pos.y, currentSettings.color, currentSettings.size, currentSettings.isEraser, currentSettings.isGlow, currentSettings.isRainbow);
    if (!inSoloMode) {
        socket.emit('draw', { 
            x0: lastX, y0: lastY, x1: pos.x, y1: pos.y, 
            color: currentSettings.color, size: currentSettings.size, 
            isEraser: currentSettings.isEraser,
            isGlow: currentSettings.isGlow,
            isRainbow: currentSettings.isRainbow
        });
    }
    lastX = pos.x; lastY = pos.y;
});
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

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
if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        if (!canIDraw || drawHistory.length === 0) return;
        const previousState = drawHistory.pop();
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        
        // サーバーからお題リストをもらってくるよ！💎
        try {
            const response = await fetch('/api/words');
            const data = await response.json();
            
            // 全カテゴリーからランダムに選ぶよ！✨
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
        gallerySubmitBtn.classList.add('hidden'); // 追加
        nextWordBtn.classList.add('hidden'); // 追加✨🎲
        exitSoloBtn.classList.add('hidden');
        
        // サイドバーを復活させるよ！💅✨
        if (sidebar) sidebar.style.display = 'flex';
        
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
        li.innerHTML = `<span>${p.name} : ${p.score}pt</span>`;
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
            
            // 自分の準備状態に合わせてボタンの表示を変えるし！💅✨
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
            overlayText.innerHTML = '次のターンにいくよ〜！✨<br>みんなが「準備オッケー！」したらスタート！💅💖';
        }
        canIDraw = false;
        if (turnEndBtn) turnEndBtn.classList.add('hidden'); // ターン終了時に隠す
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
            wordPopupText.innerHTML = `<span style="font-size:1.5rem; color:#666;">お題：</span><br>${getDisplayText(data.word)}`;
            wordPopupSubtext.textContent = 'あなたが描く番だよ！🖌️✨';
        } else {
            wordPopupText.innerHTML = `${data.drawerName} <span style="font-size:1.5rem; color:#666;">の番！</span>`;
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
                    if (turnEndBtn) turnEndBtn.classList.remove('hidden'); // 描き手の時だけ表示✨
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
socket.on('draw', (data) => { if(!inSoloMode) drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser, data.isGlow, data.isRainbow); });
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
    addChatMessage(data.sender, data.text, data.color);
    if (data.sender !== 'System' || data.type === 'correct') {
        createDanmaku(data.text, data.color, data.type === 'correct');
    }
    if (data.type === 'correct') {
        playSE('correct');
        createWinSparkle(); // ✨ 修正：名前が被ってたのを直したよ！💅
    }
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
    
    // クッキーとローカルストレージ両方に保存しちゃう欲張りセット！💅✨💍
    localStorage.setItem('galDrawingName', name); 
    setCookie('galPlayerName', name);
    
    socket.emit('join_game', name, playerToken); // トークンも一緒に送るよ！🚀
});

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
    if (msg) {
        socket.emit('send_message', msg);
        chatInput.value = '';
    }
}

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

function addChatMessage(sender, text, color) {
    const div = document.createElement('div');
    // 自分のメッセージならクラスを足すよ💅✨
    const isMe = sender === (localStorage.getItem('galDrawingName') || '自分');
    div.className = isMe ? 'chat-msg mine' : 'chat-msg';
    
    div.innerHTML = `
        <strong style="color: ${color || '#333'}">${sender}</strong>
        <span class="msg-text">${text}</span>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function createDanmaku(text, color, isBig = false) {
    if (!danmakuContainer) return;
    
    const div = document.createElement('div');
    div.className = isBig ? 'danmaku-item big' : 'danmaku-item';
    div.textContent = isBig ? `✨💖 ${text} 💖✨` : text;
    
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
        const containerWidth = danmakuContainer.clientWidth || 600;
        
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

// ✨ 正解した時にキラキラエフェクトを降らせるよ！✨💍💖
function createWinSparkle(x, y) {
    const container = document.getElementById('sparkleContainer');
    if (!container) return;
    
    for (let i = 0; i < 10; i++) {
        const sparkle = document.createElement('div');
        sparkle.innerHTML = ['✨', '💍', '💖', '💎', '🌟'][Math.floor(Math.random() * 5)];
        sparkle.style.position = 'absolute';
        sparkle.style.left = `${x || Math.random() * 100}%`;
        sparkle.style.top = `${y || Math.random() * 100}%`;
        sparkle.style.fontSize = `${Math.random() * 20 + 10}px`;
        sparkle.style.pointerEvents = 'none';
        sparkle.style.zIndex = '1000';
        sparkle.style.transition = 'all 1s ease-out';
        
        container.appendChild(sparkle);
        
        // 飛び散るアニメーション！💅✨
        setTimeout(() => {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 100 + 50;
            sparkle.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`;
            sparkle.style.opacity = '0';
        }, 10);
        
        setTimeout(() => sparkle.remove(), 1000);
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

// --- 💎 デスクトップUI維持スケーリングの魔法 💎 ---
function updateScale() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;
    
    // 💎 新時代の「ハイブリッド・フルワイド・スケーリング」開幕っ！💅✨💍
    // 横幅は 100% ギリギリまで使い切るのがギャルの鉄則！🤟💖
    
    const baseHeight = 920; // ちょっと余裕を持たせたベース高さ
    const currentHeight = window.innerHeight;
    const scale = Math.min(currentHeight / baseHeight, 1.0);
    
    const container = document.querySelector('.container');
    if (container) {
        if (scale < 1.0) {
            // 画面が低い時は、中身をキュッと縮めて見切れを防止！💎
            container.style.transform = `scale(${scale})`;
            container.style.transformOrigin = 'top center';
            container.style.width = `${100 / scale}%`; // スケール分を打ち消して横幅を100%に維持！💅
            container.style.height = `${100 / scale}%`;
        } else {
            container.style.transform = 'none';
            container.style.width = '100%';
            container.style.height = '100%';
        }
    }
    
    console.log(`[APP-WIDE-SCALE] Width: 100%, Height-Scale: ${scale.toFixed(3)} (ViewHeight: ${currentHeight})`);
}

window.addEventListener('resize', updateScale);
window.addEventListener('load', updateScale);
