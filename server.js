const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let maxPlayers = 4;
let currentPlayerIndex = -1;
let currentWordObj = null;
let gamePhase = 'waiting'; // waiting, playing, between_turns, results
let roundTimer = null;
let timeLeft = 60;
let timeLimit = 60;

// ターン（周）の管理
let currentRound = 1;
let maxRounds = 1;
let turnsPlayedInRound = 0;

const cuteWords = [
    { display: '🐼パンダ', answers: ['ぱんだ', 'パンダ', 'panda'] },
    { display: '🍓いちご', answers: ['いちご', 'イチゴ', '苺', 'ストロベリー', 'strawberry'] },
    { display: '🍔ハンバーガー', answers: ['はんばーがー', 'ハンバーガー', 'ばーがー', 'バーガー', 'hamburger', 'burger'] },
    { display: '🍦ソフトクリーム', answers: ['そふとくりーむ', 'ソフトクリーム', 'あいす', 'アイス', 'icecream'] },
    { display: '💩うんこ（笑）', answers: ['うんこ', 'ウンコ', 'うんち', 'ウンチ', 'poop'] },
    { display: '🍄キノコ', answers: ['きのこ', 'キノコ', 'マッシュルーム', 'mushroom'] },
    { display: '🐈ねこ', answers: ['ねこ', 'ネコ', '猫', 'にゃんこ', 'cat'] },
    { display: '🐕いぬ', answers: ['いぬ', 'イヌ', '犬', 'わんこ', 'dog'] },
    { display: '🌻ひまわり', answers: ['ひまわり', 'ヒマワリ', '向日葵', 'sunflower'] },
    { display: '🚗くるま', answers: ['くるま', 'クルマ', '車', 'じどうしゃ', 'car', '自動車'] },
    { display: '👻おばけ', answers: ['おばけ', 'オバケ', '幽霊', 'ゆうれい', 'ghost'] },
    { display: '🍎りんご', answers: ['りんご', 'リンゴ', '林檎', 'アップル', 'apple'] },
    { display: '🍌バナナ（意味深）', answers: ['ばなな', 'バナナ', 'banana'] },
    { display: '🍑もも', answers: ['もも', 'モモ', '桃', 'ピーチ', 'peach'] }
];

function levenshtein(s, t) {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] = i === 0 ? j : Math.min(arr[i - 1][j] + 1, arr[i][j - 1] + 1, arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1));
        }
    }
    return arr[t.length][s.length];
}

function kanaToHira(str) {
    return str.replace(/[\u30a1-\u30f6]/g, function(match) {
        return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
}

io.on('connection', (socket) => {
    socket.on('join_game', (playerName) => {
        if (players.length >= maxPlayers) {
            socket.emit('error', '満室だよ〜！ごめんね🥺');
            return;
        }

        players.push({
            id: socket.id,
            name: playerName || `Player ${players.length + 1}`,
            score: 0,
            hasGuessed: false
        });

        io.emit('update_players', players);
        socket.emit('game_state', { 
            phase: gamePhase, 
            timeLeft, 
            currentWord: (gamePhase === 'playing' ? (players[currentPlayerIndex]?.id === socket.id ? currentWordObj.display : '????') : '') 
        });
        
        if (gamePhase === 'playing' && players[currentPlayerIndex]) {
            io.emit('drawer_update', players[currentPlayerIndex].id);
        }
    });

    socket.on('start_game', (settings) => {
        if (players.length < 1) return;
        
        timeLimit = settings.timeLimit || 60;
        maxRounds = settings.rounds || 1;
        
        currentRound = 1;
        turnsPlayedInRound = 0;
        currentPlayerIndex = -1;
        
        players.forEach(p => p.score = 0);
        startNextTurn();
    });

    socket.on('return_to_lobby', () => {
        gamePhase = 'waiting';
        players.forEach(p => p.score = 0);
        io.emit('update_players', players);
        io.emit('game_state', { phase: 'waiting', timeLeft: 0 });
    });

    socket.on('draw', (data) => {
        socket.broadcast.emit('draw', data);
    });
    
    socket.on('clear_canvas', () => {
        io.emit('clear_canvas');
    });

    socket.on('send_message', (msg) => {
        const player = players.find(p => p.id === socket.id);
        if (!player) return;

        if (gamePhase === 'playing') {
            const isDrawer = players[currentPlayerIndex]?.id === socket.id;
            
            let isCorrect = false;
            let isAlmost = false;

            const cleanInput = msg.trim().toLowerCase().replace(/[\s　]/g, '');
            const normalizedInput = kanaToHira(cleanInput);

            if (!isDrawer && !player.hasGuessed) {
                for (let ans of currentWordObj.answers) {
                    const normalizedAns = kanaToHira(ans.toLowerCase().replace(/[\s　]/g, ''));
                    if (normalizedInput === normalizedAns) {
                        isCorrect = true; break;
                    }
                    if (normalizedAns.length >= 2) {
                        const dist = levenshtein(normalizedInput, normalizedAns);
                        if (dist === 1 || (dist === 2 && normalizedAns.length >= 5)) isAlmost = true;
                        else if (normalizedInput.length >= 2 && normalizedAns.includes(normalizedInput) && normalizedInput.length >= normalizedAns.length - 1) isAlmost = true;
                        else if (normalizedAns.length >= 2 && normalizedInput.includes(normalizedAns)) isAlmost = true;
                    }
                }
            }

            if (isCorrect) {
                player.hasGuessed = true;
                // スコア更新 (回答者+2pt、描いた人+1pt)
                player.score += 2;
                if (players[currentPlayerIndex]) {
                     players[currentPlayerIndex].score += 1;
                }

                io.emit('chat_message', { sender: 'System', text: `やば！${player.name}さん大正解！🎉✨（回答者+2pt / 出題者+1pt）`, color: '#ff66b2', type: 'correct' });
                io.emit('update_players', players);

                const allGuessed = players.every((p, idx) => idx === currentPlayerIndex || p.hasGuessed);
                if (allGuessed) endTurn();
            } else if (isAlmost && !isCorrect && !isDrawer && !player.hasGuessed) {
                io.to(socket.id).emit('chat_message', { sender: 'System', text: `「${msg}」…惜しい！あとちょっと！🥺`, color: '#ff9900', type: 'oshii' });
                io.emit('chat_message', { sender: player.name, text: msg, color: '#333' });
            } else {
                io.emit('chat_message', { sender: player.name, text: msg, color: '#333' });
            }
        } else {
             io.emit('chat_message', { sender: player.name, text: msg, color: '#333' });
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('update_players', players);
        
        if (players.length === 0) {
            gamePhase = 'waiting';
            if (roundTimer) clearInterval(roundTimer);
        } else if (gamePhase === 'playing' && currentPlayerIndex >= players.length) {
            endTurn();
        }
    });

    function startNextTurn() {
        if (players.length === 0) return;

        turnsPlayedInRound++;
        if (turnsPlayedInRound > players.length) {
            currentRound++;
            turnsPlayedInRound = 1;
        }

        if (currentRound > maxRounds) {
            endGame();
            return;
        }

        gamePhase = 'playing';
        players.forEach(p => p.hasGuessed = false);
        
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        currentWordObj = cuteWords[Math.floor(Math.random() * cuteWords.length)];
        
        timeLeft = timeLimit;
        
        io.emit('clear_canvas');
        io.emit('update_players', players);
        
        const roundInfoTxt = `${currentRound}周目 (${turnsPlayedInRound}/${players.length})`;
        const drawer = players[currentPlayerIndex];
        
        io.to(drawer.id).emit('round_start', { 
            word: currentWordObj.display, 
            timeLimit, 
            isDrawer: true,
            roundInfo: roundInfoTxt
        });
        
        players.forEach(p => {
            if (p.id !== drawer.id) {
                io.to(p.id).emit('round_start', { 
                    word: '????', 
                    timeLimit, 
                    isDrawer: false, 
                    drawerName: drawer.name,
                    roundInfo: roundInfoTxt 
                });
            }
        });

        if (roundTimer) clearInterval(roundTimer);
        roundTimer = setInterval(() => {
            timeLeft--;
            io.emit('timer', timeLeft);
            if (timeLeft <= 0) {
                endTurn();
            }
        }, 1000);
    }

    function endTurn() {
        if (roundTimer) clearInterval(roundTimer);
        gamePhase = 'between_turns';
        
        let isLastTurn = false;
        if (currentRound >= maxRounds && turnsPlayedInRound >= players.length) {
            isLastTurn = true;
        }

        const nextMsg = isLastTurn ? "結果発表にいくよ〜！🏆" : "5秒後に次行くよ！";
        io.emit('chat_message', { sender: 'System', text: `時間終了〜！正解は「${currentWordObj.display}」でした！✨ ${nextMsg}`, color: '#ff66b2', type: 'finish' });
        
        const drawerName = players[currentPlayerIndex] ? players[currentPlayerIndex].name : 'Unknown';
        // ギャラリー用に正解とお絵描き人の情報を送信
        io.emit('round_end', { players, word: currentWordObj.display, drawer: drawerName });
        io.emit('game_state', { phase: 'between_turns', timeLeft: 0, isLastTurn: isLastTurn });

        setTimeout(() => {
            if (gamePhase === 'between_turns') startNextTurn();
        }, 5000);
    }

    function endGame() {
        gamePhase = 'results';
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        io.emit('game_over', sortedPlayers);
    }
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
