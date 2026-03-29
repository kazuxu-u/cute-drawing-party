const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const https = require('https');
const fs = require('fs');
const mongoose = require('mongoose'); // 🆕 データベースの味方！💎✨💍

// --- 🛡️ サーバー最強伝説！落ちないためのガード ✨ ---
function safeEmit(target, event, data) {
    try {
        if (target && typeof target.emit === 'function') {
            target.emit(event, data);
        }
    } catch (e) {
        console.error(`[EMIT-ERR] Failed to emit ${event}: ${e.message}`);
    }
}

function safeIoEmit(event, data) {
    try {
        io.emit(event, data);
    } catch (e) {
        console.error(`[IO-EMIT-ERR] Failed to io.emit ${event}: ${e.message}`);
    }
}

// --- 🛡️ サーバー最強伝説！落ちないためのガード ✨ ---
process.on('uncaughtException', (err) => {
    console.error(`[CRITICAL-ERR] Uncaught Exception: ${err.stack || err}`);
    // 致命的なエラー時は潔く終了して再起動を待つお🥺
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[CRITICAL-REJ] Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

const DRAWINGS_DIR = path.join(__dirname, 'public', 'drawings');
const METADATA_FILE = path.join(__dirname, 'drawings_metadata.json');
const PLAYER_DATA_FILE = path.join(__dirname, 'players_persistence.json');

// --- 💾 MongoDB Schema (Data Warehouse) ✨💍 ---
const playerSchema = new mongoose.Schema({
    token: { type: String, unique: true, required: true },
    name: String,
    password: String, // 🆕 パスワードもDBに保存するおッ！✨💍
    lv: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    lastLogin: { type: Date, default: Date.now }
});
const Player = mongoose.model('Player', playerSchema);

const drawingSchema = new mongoose.Schema({
    filename: String,
    artist: String,
    prompt: String,
    imageData: String, // 🆕 画像データそのものもDBに保存しちゃうおッ！💎✨💍
    timestamp: { type: Date, default: Date.now }
});
const Drawing = mongoose.model('Drawing', drawingSchema);

// --- 💾 永続化データ管理システム (Hybrid MongoDB/JSON) ✨💍 ---
let persistentData = {};
const MONGO_URI = process.env.MONGO_URI;
let lastDBError = null; // 🆕 エラーを記録するおッ！💎

async function connectDB() {
    if (!MONGO_URI) {
        console.warn('[DB-WARN] MONGO_URI is missing. Falling back to local JSON persistence. 🥺');
        lastDBError = 'MONGO_URI is missing';
        return;
    }
    try {
        await mongoose.connect(MONGO_URI);
        console.log('[DB-OK] Connected to MongoDB Atlas! 💎✨💍');
        lastDBError = null;
    } catch (e) {
        lastDBError = e.message;
        console.error(`[DB-ERR] Connection failed: ${e.message}`);
    }
}

async function loadPlayerData() {
    try {
        if (MONGO_URI && mongoose.connection.readyState === 1) {
            // MongoDBからロード
            const players = await Player.find({});
            players.forEach(p => {
                persistentData[p.token] = { 
                    name: p.name, 
                    password: p.password, // 🆕 パスワードもしっかり復元！💎
                    lv: p.lv, 
                    xp: p.xp, 
                    score: p.score 
                };
            });
            console.log(`[DB-LOAD] ${players.length} players loaded from MongoDB.`);
        }
        
        // 移行期：ローカルファイルがあればマージッ！💍✨ (保険だおッ！)
        if (fs.existsSync(PLAYER_DATA_FILE)) {
            const content = fs.readFileSync(PLAYER_DATA_FILE, 'utf8');
            const localData = JSON.parse(content || '{}');
            let mergedCount = 0;
            for (const token in localData) {
                if (!persistentData[token]) {
                    persistentData[token] = localData[token];
                    mergedCount++;
                }
            }
            if (mergedCount > 0) {
                console.log(`[JSON-MERGE] Merged ${mergedCount} new players from local JSON. ✨💍`);
            }
            
            // MongoDBが空なら移行するよッ！💎✨💍
            if (MONGO_URI && mongoose.connection.readyState === 1) {
                console.log('[MIGRATION] Migrating local JSON to MongoDB… 🚀');
                for (const token in persistentData) {
                    const p = persistentData[token];
                    await Player.findOneAndUpdate({ token }, { ...p, token }, { upsert: true });
                }
                console.log('[MIGRATION] Migration complete! ✨💍');
            }
        }
    } catch (e) {
        console.error(`[LOAD-ERR] Failed to load player data: ${e.message}`);
        persistentData = {};
    }
}

async function savePlayerData(targetToken = null) {
    try {
        // ローカルファイルにもバックアップ（PC開発用）💅
        fs.writeFileSync(PLAYER_DATA_FILE, JSON.stringify(persistentData, null, 2));

        if (MONGO_URI && mongoose.connection.readyState === 1) {
            if (targetToken && persistentData[targetToken]) {
                // 特定のプレイヤーだけ更新して高速化！⚡
                const p = persistentData[targetToken];
                await Player.findOneAndUpdate({ token: targetToken }, { ...p, token: targetToken }, { upsert: true });
                console.log(`[DB-SAVE] Saved to MongoDB: ${p.name} (${targetToken}) ✨💍`);
            } else {
                // 全員分保存
                const ops = Object.keys(persistentData).map(token => ({
                    updateOne: {
                        filter: { token },
                        update: { ...persistentData[token], token },
                        upsert: true
                    }
                }));
                if (ops.length > 0) {
                    await Player.bulkWrite(ops);
                    console.log(`[DB-SAVE] Bulk saved ${ops.length} players to MongoDB. ✨💍`);
                }
            }
        }
    } catch (e) {
        console.error(`[SAVE-ERR] Failed to save player data: ${e.message}`);
    }
}

// 🆕 起動時に接続と読み込み！💎✨ (後で一番下で呼ぶおッ！💅)
const initApp = async () => {
    await connectDB();
    await loadPlayerData();
    
    // 保存用ディレクトリがなければ作成
    if (!fs.existsSync(DRAWINGS_DIR)) {
        fs.mkdirSync(DRAWINGS_DIR, { recursive: true });
    }

    server.listen(PORT, () => {
        console.log(`[READY] Server listening on port ${PORT} 🚀`);
        console.log(`[READY] Total managed players in memory: ${Object.keys(persistentData).length} 💎✨💍`);
    });
};

const PORT = process.env.PORT || 3000;

// ギャラリーの画像がちゃんと読み込まれてるかチェックするためのログ！💍✨
app.use('/drawings/:filename', async (req, res, next) => {
    const filename = req.params.filename;
    const filePath = path.join(DRAWINGS_DIR, filename);

    // 1. まずはディスクにあるかチェック！💅
    if (fs.existsSync(filePath)) {
        console.log(`[IMG-DISK] Serving from disk: ${filename}`);
        return res.sendFile(filePath);
    }

    // 2. ディスクになければDBから探すおッ！💎✨💍 (Render対策)
    if (MONGO_URI && mongoose.connection.readyState === 1) {
        try {
            const doc = await Drawing.findOne({ filename });
            if (doc && doc.imageData) {
                console.log(`[IMG-DB] Serving from MongoDB: ${filename} 💎✨💍`);
                const img = Buffer.from(doc.imageData.replace(/^data:image\/png;base64,/, ""), 'base64');
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': img.length,
                    'Cache-Control': 'public, max-age=31536000' // キャッシュもしっかり！✨
                });
                return res.end(img);
            }
        } catch (e) {
            console.error(`[IMG-DB-ERR] ${e.message}`);
        }
    }

    console.log(`[IMG-404] Not found: ${filename} 🥺`);
    res.status(404).send('Not found');
});

// 静的ディレクトリのマッピングは↑に任せるからコメントアウト！💍✨
// app.use('/drawings', express.static(DRAWINGS_DIR));

// ソロモード用にお題リストを全部返すよ！💎✨💍
// cuteWordsは下の方で定義されてるけど、function宣言じゃないから
// ここで呼ぶとエラーになる可能性があるため、もっと下に移動するね！💅✨
// ...と思ったけど、安全のためにapp.listenの直前に書くのが一番確実かも！💍✨

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({limit: '10mb'})); // 🎉 グローバルに設定！

// 画像保存 API (ミドルウェアはグローバルに移したよ✨)
app.post('/api/save_drawing', async (req, res) => {
    const { image, artist, prompt } = req.body;
    if (!image || !artist || !prompt) return res.status(400).json({ error: 'Missing data' });

    const filename = `drawing_${Date.now()}.png`;
    const filePath = path.join(DRAWINGS_DIR, filename);

    // Base64を保存（物理ファイルはRenderだと消えちゃうけど、当面はこれで！💎）
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    fs.writeFile(filePath, base64Data, 'base64', async (err) => {
        if (err) return res.status(500).json({ error: 'Save failed' });

        try {
            // MongoDBに保存ッ！画像データも一緒だおッ！💎✨💍
            if (MONGO_URI && mongoose.connection.readyState === 1) {
                await Drawing.create({ 
                    filename, 
                    artist, 
                    prompt, 
                    imageData: image, // 🆕 これが永続化の鍵！💍 
                    timestamp: Date.now() 
                });
                
                // 1000枚制限の管理（DB版）💅
                const count = await Drawing.countDocuments();
                if (count > 1000) {
                    const oldest = await Drawing.findOne().sort({ timestamp: 1 });
                    if (oldest) {
                        const oldestPath = path.join(DRAWINGS_DIR, oldest.filename);
                        if (fs.existsSync(oldestPath)) {
                            try { fs.unlinkSync(oldestPath); } catch (e) {}
                        }
                        await Drawing.findByIdAndDelete(oldest._id);
                    }
                }
            }
            
            // 下位互換：ローカルJSONにも一応残す（画像データは重いからJSONには入れないお！💅）
            let metadata = [];
            if (fs.existsSync(METADATA_FILE)) {
                try {
                    const content = fs.readFileSync(METADATA_FILE, 'utf8');
                    metadata = JSON.parse(content || '[]');
                } catch(e) { metadata = []; }
            }
            metadata.push({ filename, artist, prompt, timestamp: Date.now() });
            if (metadata.length > 1000) metadata.shift();
            fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

            console.log(`[SAVE] Drawing saved by ${artist} (Prompt: ${prompt}) -> ${filename}`);
            res.json({ success: true, filename });
        } catch (e) {
            console.error(`[SAVE-DB-ERR] ${e.message}`);
            res.status(500).json({ error: 'Database save failed' });
        }
    });
});

// 画像検索プロキシ (ローカル保存された絵を検索)
app.get('/api/search', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {
        let results = [];
        if (MONGO_URI && mongoose.connection.readyState === 1) {
            // MongoDBから検索！💎✨💍
            const docs = await Drawing.find({ 
                prompt: { $regex: query, $options: 'i' } 
            }).sort({ timestamp: -1 }).limit(100);
            
            results = docs.map(m => ({
                id: m.filename,
                title: `${m.prompt} (by ${m.artist})`,
                thumbnail: `/drawings/${m.filename}`,
                url: `/drawings/${m.filename}`
            }));
        } else {
            // フォールバック：JSONから
            const metadata = JSON.parse(fs.readFileSync(METADATA_FILE));
            const filtered = metadata.filter(m => m.prompt.toLowerCase().includes(query.toLowerCase()));
            results = filtered.map(m => ({
                id: m.filename,
                title: `${m.prompt} (by ${m.artist})`,
                thumbnail: `/drawings/${m.filename}`,
                url: `/drawings/${m.filename}`
            })).reverse();
        }
        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: 'Failed to search drawings' });
    }
});

// ギャラリー全取得 API
app.get('/api/gallery', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
        let results = [];
        if (MONGO_URI && mongoose.connection.readyState === 1) {
            // MongoDBから全取得！💎✨💍
            const docs = await Drawing.find({}).sort({ timestamp: -1 }).limit(200);
            results = docs.map(m => ({
                id: m.filename,
                title: `${m.prompt} (by ${m.artist})`,
                thumbnail: `/drawings/${m.filename}`,
                url: `/drawings/${m.filename}`,
                artist: m.artist,
                prompt: m.prompt,
                timestamp: m.timestamp
            }));
        } else {
            // フォールバック
            const metadata = JSON.parse(fs.readFileSync(METADATA_FILE));
            results = metadata.map(m => ({
                id: m.filename,
                title: `${m.prompt} (by ${m.artist})`,
                thumbnail: `/drawings/${m.filename}`,
                url: `/drawings/${m.filename}`,
                artist: m.artist,
                prompt: m.prompt,
                timestamp: m.timestamp
            })).reverse();
        }
        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});

// 画像削除 API (BAN用) 💅✨
app.post('/api/delete_drawing', async (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Missing filename' });

    try {
        // DBから削除
        if (MONGO_URI && mongoose.connection.readyState === 1) {
            await Drawing.findOneAndDelete({ filename });
        }
        
        // ディスクから削除
        const filePath = path.join(DRAWINGS_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        // JSONからも一応消す
        if (fs.existsSync(METADATA_FILE)) {
            let metadata = JSON.parse(fs.readFileSync(METADATA_FILE));
            metadata = metadata.filter(m => m.filename !== filename);
            fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// --- 🏰 ルーム管理システム 🏰 ---
const rooms = {
    'R-1': createRoomState('R-1', 'キュート・ルーム💖'),
    'R-2': createRoomState('R-2', 'ぎゃる・ルーム💅'),
    'R-3': createRoomState('R-3', 'えも・ルーム💍'),
    'R-4': createRoomState('R-4', 'ぴんく・ルーム🎀'),
    'R-5': createRoomState('R-5', 'あおい・ルーム💎'),
    'R-6': createRoomState('R-6', 'まぢ・ルーム🔥'),
    'R-7': createRoomState('R-7', 'ゆめかわ・ルーム🦄'),
    'R-8': createRoomState('R-8', 'ねおん・ルーム🌟')
};

function createRoomState(id, name) {
    return {
        id,
        name,
        players: [],
        maxPlayers: 4,
        hostName: '', // ホストの名前💅
        comment: '',  // ルームのコメント✨
        password: '', // 4桁のパスワード🔒
        currentPlayerIndex: -1,
        currentWordObj: null,
        recentWords: [],
        gamePhase: 'waiting',
        currentRound: 1,
        maxRounds: 3,
        turnsPlayedInRound: 0,
        timeLeft: 120,
        timeLimit: 120,
        pointsAwardedThisTurn: false,
        isStartingNextTurn: false,
        isLastTurnGlobal: false,
        npcTimers: {},
        roundTimer: null,
        nextTurnTimer: null
    };
}

function getRoomBySocket(socket) {
    for (const id in rooms) {
        const room = rooms[id];
        if (room.players.some(p => p.id === socket.id)) return room;
    }
    return null;
}

function safeRoomEmit(room, event, data) {
    try {
        io.to(room.id).emit(event, data);
    } catch (e) {
        console.error(`[ROOM-EMIT-ERR] Failed to emit ${event} to room ${room.id}: ${e.message}`);
    }
}

const cuteWords = {
    mix: [], // 後でぜんぶまとめる用
    mix_safe: [], // ヤバい以外をぜんぶまとめる用☀️✨💍
    animal: [
        { display: '🐼パンダ', answers: ['ぱんだ', 'パンダ', 'panda'] },
        { display: '🐈ねこ', answers: ['ねこ', 'ネコ', '猫', 'にゃんこ', 'cat'] },
        { display: '🐕いぬ', answers: ['いぬ', 'イヌ', '犬', 'わんこ', 'dog'] },
        { display: '🐰うさぎ', answers: ['うさぎ', 'ウサギ', '兎', 'rabbit'] },
        { display: '🐧ぺんぎん', answers: ['ぺんぎん', 'ペンギン', 'penguin'] },
        { display: '🐘ゾウ', answers: ['ぞう', 'ゾウ', '象', 'elephant'] },
        { display: '🦒きりん', answers: ['きりん', 'キリン', 'giraffe'] },
        { display: '🦁らいおん', answers: ['らいおん', 'ライオン', 'lion', 'がおー'] },
        { display: '🐒ごりら...じゃなくて猿', answers: ['さる', 'サル', '猿', 'さるやま', 'monkey', 'ごりら', 'ゴリラ', 'gorilla', 'うほっ', 'ウホッ'] },
        { display: '🦊きつね', answers: ['きつね', 'キツネ', '狐', 'fox', 'こんこん'] },
        { display: '🐻くま', answers: ['くま', 'クマ', '熊', 'bear'] },
        { display: '🐨こあら', answers: ['こあら', 'コアラ', 'koala'] },
        { display: '🐷ぶた', answers: ['ぶた', 'ブタ', '豚', 'pig'] },
        { display: '🐭ねずみ', answers: ['ねずみ', 'ネズミ', '鼠', 'mouse'] },
        { display: '🐯とら', answers: ['とら', 'トラ', '虎', 'tiger'] },
        { display: '🐮うし', answers: ['うし', 'ウシ', '牛', 'cow'] },
        { display: '🐴うま', answers: ['うま', 'ウマ', '馬', 'horse'] },
        { display: '🐸かえる', answers: ['かえる', 'カエル', '蛙', 'frog'] },
        { display: '🐍へび', answers: ['へび', 'ヘビ', '蛇', 'snake'] },
        { display: '🐬いるか', answers: ['いるか', 'イルカ', 'dolphin'] }
    ],
    food: [
        { display: '🍓いちご', answers: ['いちご', 'イチゴ', '苺', 'ストロベリー', 'strawberry'] },
        { display: '🍔ハンバーガー', answers: ['はんばーがー', 'ハンバーガー', 'ばーがー', 'バーガー', 'hamburger', 'burger'] },
        { display: '🍦ソフトクリーム', answers: ['そふとくりーむ', 'ソフトクリーム', 'あいす', 'アイス', 'icecream'] },
        { display: '🍄キノコ', answers: ['きのこ', 'キノコ', 'マッシュルーム', 'mushroom'] },
        { display: '🍎りんご', answers: ['りんご', 'リンゴ', '林檎', 'アップル', 'apple'] },
        { display: '🍑もも', answers: ['もも', 'モモ', '桃', 'ピーチ', 'peach'] },
        { display: '🍣すし', answers: ['すし', '寿司', 'スシ', 'おすし', 'sushi'] },
        { display: '🍜らーめん', answers: ['らーめん', 'ラーメン', 'ramen'] },
        { display: '🍰けーき', answers: ['けーき', 'ケーキ', 'cake', 'ショートケーキ'] },
        { display: '🥩やきにく', answers: ['やきにく', '焼肉', '肉', 'にく'] },
        { display: '🍕ぴざ', answers: ['ぴざ', 'ピザ', 'pizza'] },
        { display: '🍩どーなつ', answers: ['どーなつ', 'ドーナツ', 'donut'] },
        { display: '🍫ちょこ', answers: ['ちょこ', 'チョコ', 'チョコレート', 'chocolate'] },
        { display: '🍮ぷりん', answers: ['ぷりん', 'プリン', 'pudding'] },
        { display: '🍙おにぎり', answers: ['おにぎり', 'オニギリ', 'おむすび', 'riceball'] },
        { display: '🍛かれー', answers: ['かれー', 'カレー', 'カレーライス', 'curry'] },
        { display: '🍞ぱん', answers: ['ぱん', 'パン', '食パン', 'bread'] },
        { display: '🍳めだまやき', answers: ['めだまやき', '目玉焼き', 'フライエッグ', 'fried egg'] },
        { display: '🍟ふらいどぽてと', answers: ['ぽてと', 'ポテト', 'フライドポテト', 'potato'] },
        { display: '🍈めろん', answers: ['めろん', 'メロン', 'melon'] }
    ],
    daily: [
        { display: '🚗くるま', answers: ['くるま', 'クルマ', '車', 'じどうしゃ', 'car', '自動車'] },
        { display: '🌻ひまわり', answers: ['ひまわり', 'ヒマワリ', '向日葵', 'sunflower'] },
        { display: '👻おばけ', answers: ['おばけ', 'オバケ', '幽霊', 'ゆうれい', 'ghost'] },
        { display: '🏠いえ', answers: ['いえ', '家', 'ハウス', 'house', 'おうち'] },
        { display: '📱すまほ', answers: ['スマホ', 'すまほ', 'スマートフォン', '携帯', 'けいたい', 'iphone'] },
        { display: '🚲じてんしゃ', answers: ['じてんしゃ', '自転車', 'ちゃり', 'チャリ', 'bicycle'] },
        { display: '👓めがね', answers: ['めがね', 'メガネ', '眼鏡', 'めがねぇ', 'めがねっ娘', 'glasses'] },
        { display: '⏰めざましどけい', answers: ['めざましどけい', '目覚まし時計', '時計', 'とけい'] },
        { display: '🧻といれっとぺーぱー', answers: ['といれっとぺーぱー', 'トイレットペーパー', 'ペーパー'] },
        { display: '📺てれび', answers: ['てれび', 'テレビ', 'tv'] },
        { display: '💻ぱそこん', answers: ['ぱそこん', 'パソコン', 'pc'] },
        { display: '🛌べっど', answers: ['べっど', 'ベッド', 'ふとん', '布団', 'bed'] },
        { display: '🚿しゃわー', answers: ['しゃわー', 'シャワー', 'shower'] },
        { display: '🦷はぶらし', answers: ['はぶらし', '歯ブラシ', '歯みがき'] },
        { display: '🌂かさ', answers: ['かさ', '傘', 'アンブレラ', 'umbrella'] },
        { display: '🔑かぎ', answers: ['かぎ', '鍵', 'キー', 'key'] },
        { display: '👠はいひーる', answers: ['はいひーる', 'ハイヒール', 'ヒール', '靴', 'くつ'] },
        { display: '👗わんぴーす', answers: ['わんぴーす', 'ワンピース', 'ふく', '服'] },
        { display: '👜かばん', answers: ['かばん', '鞄', 'バッグ', 'カバン', 'bag'] },
        { display: '🧴けしょうすい', answers: ['けしょうすい', '化粧水', 'コスメ', 'スキンケア'] }
    ],
    yabai: [
        { display: '💩うんこ（笑）', answers: ['うんこ', 'ウンコ', 'うんち', 'ウンチ', 'poop', 'くさい', 'ぶりぶり'] },
        { display: '🍌バナナ（意味深）', answers: ['ばなな', 'バナナ', 'banana', '🍌', 'ちんこ', 'おてぃんてぃん'] },
        { display: '🍒さくらんぼ（意味深）', answers: ['さくらんぼ', 'サクランボ', 'ちぇりー', 'チェリー', 'cherry', 'たまたま'] },
        { display: '🍄きのこ（意味深）', answers: ['きのこ', 'キノコ', 'マッシュルーム'] },
        { display: '💋くちびる', answers: ['くちびる', '唇', 'キス', 'きす', 'ちゅー', 'lip', 'lips'] },
        { display: '👙びきに', answers: ['びきに', 'ビキニ', 'みずぎ', '水着', 'bikini'] },
        { display: '🩲ぱんつ', answers: ['ぱんつ', 'パンツ', 'したぎ', '下着', 'panties'] },
        { display: '🍆なす（意味深）', answers: ['なす', 'ナス', '茄子', 'eggplant'] },
        { display: '🍈メロン（意味深）', answers: ['めろん', 'メロン', 'おっぱい', '巨乳', '胸'] },
        { display: '🍑デカ尻', answers: ['でかしり', 'デカ尻', 'お尻', 'しり', 'butt'] },
        { display: '🍼哺乳瓶（バブみ）', answers: ['ほにゅうびん', '哺乳瓶', 'みるく', 'ミルク', 'ばぶ'] },
        { display: '🛏️ベッドイン', answers: ['べっどいん', 'ベッドイン', 'べっど', 'おとまり', 'えっち'] },
        { display: '🏩ラブホ', answers: ['らぶほ', 'ラブホ', 'ホテル', 'ほてる'] },
        { display: '⛓️手錠', answers: ['てじょう', '手錠', '拘束', 'こうそく'] },
        { display: '💥ムチ（SM）', answers: ['むち', 'ムチ', '鞭', 'SM'] },
        { display: '🕯️ロウソク', answers: ['ろうそく', 'ロウソク', '蝋燭'] },
        { display: '🐕首輪', answers: ['くびわ', '首輪', 'ぺっと', 'ペット'] },
        { display: '💄キスマーク', answers: ['きすまーく', 'キスマーク'] },
        { display: '📳おもちゃ（意味深）', answers: ['おもちゃ', 'ろーたー', 'ローター', 'バイブ'] },
        { display: '🔴テンガ', answers: ['てんが', 'テンガ', 'TENGA', 'おなほ'] },
        { display: '📳マッサージ機（意味深）', answers: ['まっさーじき', 'マッサージ機', 'でんま', '電マ'] },
        { display: '🧼ソープ', answers: ['そーぷ', 'ソープ', 'お風呂'] },
        { display: '👙ボディーストッキング', answers: ['ぼでぃーすとっきんぐ', 'ボディーストッキング', 'タイツ'] },
        { display: '🤤よだれダラダラ', answers: ['よだれ', 'ヨダレ', '涎'] },
        { display: '🥛怪しい液体', answers: ['あやしいえきたい', '液体', 'みるく', 'ミルク', '精液'] },
        { display: '🎀リボン緊縛', answers: ['りぼん', 'リボン', 'しばり', '緊縛'] },
        { display: '🥚ローター（卵型）', answers: ['ろーたー', 'ローター', 'おもちゃ'] },
        { display: '🤤涎だらだら喘ぎ顔', answers: ['あえぎがお', 'よだれ', 'あえぎ'] },
        { display: '🍑お尻ペンペン', answers: ['しりぺんぺん', 'しり', 'おしり'] },
        { display: '🧊氷攻め', answers: ['こおりぜめ', 'こおり'] },
        { display: '🥛顔射（！？）', answers: ['がんしゃ', 'みるく', 'しおふき'] },
        { display: '👄ディープキス', answers: ['でぃーぷきす', 'きす'] },
        { display: '🧴ローションまみれ', answers: ['ろーしょん', 'ぬるぬる'] },
        { display: '🛀泡風呂で密着', answers: ['あわぶろ', 'おふろ'] },
        { display: '👘はだけた浴衣', answers: ['ゆかた', 'はだける'] },
        { display: '👗透け透けワンピ', answers: ['すけすけ', 'わんぴーす'] },
        { display: '🥵興奮して顔真っ赤', answers: ['こうふん', 'かおまっか'] },
        { display: '👣足コキ', answers: ['あしこき', 'あし'] },
        { display: '🖐️手コキ', answers: ['てこき', 'て'] },
        { display: '🥧パイズリ', answers: ['ぱいずり', 'おっぱい'] },
        { display: '🐱クリ（意味深）', answers: ['くり', 'くりとりす'] },
        { display: '💎真珠（意味深）', answers: ['しんじゅ', 'しんじゅいれ', 'ぴあす'] },
        { display: '🔥発情期', answers: ['はつじょう', 'さかり'] },
        { display: '🐕‍🦺散歩（SM）', answers: ['さんぽ', 'どえむ', 'SM'] },
        { display: '🥛ザーメン（直球）', answers: ['ざーめん', 'えきたい', 'みるく'] },
        { display: '💦潮吹き', answers: ['しおふき', 'みず'] },
        { display: '🍑桃尻を揉む', answers: ['おしり', 'もむ', 'しり'] },
        { display: '🍼バブみを感じる', answers: ['まざこん', 'ばぶみ'] },
        { display: '👗ミニスカの中覗き', answers: ['のぞき', 'ぱんつ'] },
        { display: '🥵絶頂寸前', answers: ['ぜっちょう', 'いく'] },
        { display: '👄アゴクイ', answers: ['あごくい', 'いけめん'] },
        { display: '👅耳舐め', answers: ['みになめ', 'みみ'] },
        { display: '🚿シャワー室で二人きり', answers: ['しゃわー', 'みっちゃく'] },
        { display: '🖐️胸を揉む', answers: ['おっぱい', 'もむ'] },
        { display: '💏熱い抱擁', answers: ['はぐ', 'だきしめる'] },
        { display: '🥵欲求不満', answers: ['もんもん', 'したい'] },
        { display: '👙手ブラ', answers: ['てぶら', 'おっぱい'] },
        { display: '🔞バック（意味深）', answers: ['ばっく', 'うしろから', 'いぬ'] },
        { display: '🍑生尻', answers: ['なまじり', 'おしり', 'はだか'] },
        { display: '🧴ヌルヌル液体', answers: ['ぬるぬる', 'ろーしょん', 'えきたい'] },
        { display: '🎀亀甲縛り', answers: ['きっこうしばり', 'しばり', 'りぼん'] },
        { display: '🥛オトナのミルク', answers: ['おとなのみるく', 'みるく', 'せいえき'] },
        { display: '🩲勝負下着', answers: ['しょうぶしたぎ', 'ぱんつ', 'らんじぇりー'] },
        { display: '💋キスマーク', answers: ['きすまーく', 'きす'] },
        { display: '🤤アヘ顔Wピース', answers: ['あへがお', 'だぶるぴーす', 'ぜっちょう'] },
        { display: '👢ニーハイ', answers: ['にーはい', 'ぜったいりょういき'] },
        { display: '💦潮吹き（海水…？ｗ）', answers: ['しおふき', 'みず', 'えきたい'] },
        { display: '🛌ピロートーク', answers: ['ぴろーとーく', 'おはなし', 'ねごと'] },
        { display: '🥵絶頂！アッー！', answers: ['ぜっちょう', 'いく', 'フィニッシュ'] },
        { display: '👄ディープな交流', answers: ['きす', 'ちゅー', 'みっちゃく'] }
    ],
    situation: [
        { display: '💑デート', answers: ['でーと', 'デート', 'date'] },
        { display: '🛁お風呂', answers: ['おふろ', 'お風呂', 'ふろ', 'bath'] },
        { display: '💕壁ドン', answers: ['かべどん', '壁ドン', 'kabedon'] },
        { display: '🛏️添い寝', answers: ['そいね', '添い寝', 'soine'] },
        { display: '💋キス待ち', answers: ['きすまち', 'キス待ち', 'きす'] },
        { display: '💏密着', answers: ['みっちゃく', '密着', 'ぎゅー', 'ハグ'] },
        { display: '💰パパ活', answers: ['ぱぱかつ', 'パパ活', 'ぢぢい', 'おぢ'], isEcchi: true },
        { display: '💔浮気発覚', answers: ['うわき', '浮気', 'うわきはっかく', '修羅場'] },
        { display: '🍻合コン', answers: ['ごうこん', '合コン', '飲み会', 'のみかい'] },
        { display: '👀ナンパ待ち', answers: ['なんぱ', 'ナンパ', 'ナンパ待ち', '声かけられ待ち'] },
        { display: '🌅朝帰り', answers: ['あさがえり', '朝帰り', '始発'] },
        { display: '😘キス', answers: ['きす', 'キス', 'ちゅー'] },
        { display: '💌告白', answers: ['こくはく', '告白', 'すき', '好き'] },
        { display: '💍プロポーズ', answers: ['ぷろぽーず', 'プロポーズ', '結婚', 'けっこん'] },
        { display: '💢喧嘩', answers: ['けんか', '喧嘩', 'ケンカ', '怒り'] },
        { display: '🍺酔っ払い', answers: ['よっぱらい', '酔っ払い', 'よいどれ'] },
        { display: '🥱サボり', answers: ['さぼり', 'サボり', 'さぼる', '休憩'] },
        { display: '🥺ぴえん', answers: ['ぴえん', 'ぴえん🥺', '泣く', 'なき'] },
        { display: '💖推し活', answers: ['おしかつ', '推し活', 'おし', '推し', 'オタク'] },
        { display: '📸自撮り', answers: ['じどり', '自撮り', 'せるふぃー', '盛り'] },
        { display: '🚿一緒にお風呂', answers: ['おふろ', '一緒にお風呂', '混浴'], isEcchi: true },
        { display: '🍱あーんして', answers: ['あーん', 'あーんして', '食事'] },
        { display: '👔ネクタイを緩める', answers: ['ねくたい', 'ネクタイ', 'セクシー'] },
        { display: '🧼背中を流す', answers: ['せなか', '背中を流す', 'お風呂'] },
        { display: '🌅朝のひととき', answers: ['あさ', '朝', '添い寝', '朝帰り'] },
        { display: '🧥シャツ一枚', answers: ['しゃつ', 'シャツ', '裸シャツ'], isEcchi: true },
        { display: '🚃満員電車で密着', answers: ['でんしゃ', 'みっちゃく', 'ちかん', '満員電車'], isEcchi: true },
        { display: '🏫放課後の教室で…', answers: ['ほうかご', 'きょうしつ', 'ないしょ'], isEcchi: true },
        { display: '🎡観覧車の頂上でキス', answers: ['かんらんしゃ', 'きす', 'でーと'], isEcchi: true },
        { display: '🌙夜の公園で二人きり', answers: ['こうえん', 'よる', 'ふたりきり'] },
        { display: '🏢会社の給湯室で…', answers: ['きゅうとうしつ', 'かいしゃ', 'ふりん', 'ないしょ'], isEcchi: true },
        { display: '👗試着室に二人で入る', answers: ['しちゃくしつ', 'ふたり', 'ないしょ'], isEcchi: true },
        { display: '🏊プールサイドで休憩', answers: ['ぷーる', 'みずぎ', 'きゅうけい'] },
        { display: '⛺テントの中で密着', answers: ['きゃんぷ', 'みっちゃく'], isEcchi: true },
        { display: '🎬映画館の後ろの席で', answers: ['えいがかん', 'ないしょ'], isEcchi: true },
        { display: '🎡誰もいない遊園地', answers: ['ゆうえんち', 'ふたりきり'] },
        { display: '🚗車内での密会', answers: ['くるま', 'ふりん', 'でーと'], isEcchi: true },
        { display: '⛩️神社でお参り（という名のデート）', answers: ['じんじゃ', 'でーと'] },
        { display: '🚿お風呂でマッサージ', answers: ['おふろ', 'まっさーじ'], isEcchi: true },
        { display: '🛌昼からベッド', answers: ['ひるま', 'えっち'], isEcchi: true }
    ],
    pose: [
        { display: '✌️ぴーす', answers: ['ぴーす', 'ピース', 'peace'] },
        { display: '😉ウインク', answers: ['ういんく', 'ウインク', 'wink'] },
        { display: '🫶ハート作る', answers: ['はーと', 'ハート', 'heart'] },
        { display: '🫦セクシーポーズ', answers: ['せくしー', 'セクシーポーズ', 'グラビア'], isEcchi: true },
        { display: '💦アヘ顔（笑）', answers: ['あへがお', 'アヘ顔', 'ahegao'], isEcchi: true },
        { display: '🦵M字開脚（ヤバ', answers: ['えむじかいきゃく', 'M字開脚', 'm字'], isEcchi: true },
        { display: '👀振り向き', answers: ['ふりむき', '振り向き', 'みかえり'] },
        { display: '💅ギャルピース', answers: ['ぎゃるぴーす', 'ギャルピ', 'ギャル'] },
        { display: '🤸コマネチ', answers: ['こまねち', 'コマネチ'] },
        { display: '🫰指ハート', answers: ['ゆびはーと', '指ハート', 'きゅんです'] },
        { display: '🦢がちょーん', answers: ['がちょーん', 'ガチョーン'] },
        { display: '👅あっかんべー', answers: ['あっかんべー', '舌出し', 'ベロ出し'] },
        { display: '🥺体育座り', answers: ['たいいくずわり', '体育座り', '三角座り'] },
        { display: '🙇‍♀️土下座', answers: ['どげざ', '土下座', 'ごめんなさい'] },
        { display: '🌟ジョジョ立ち', answers: ['じょじょだち', 'ジョジョ立ち', 'ジョジョ'] },
        { display: '🦷シェー', answers: ['しぇー', 'シェー', 'おそ松'] },
        { display: '🥺ぶりっ子', answers: ['ぶりっこ', 'ぶりっ子', 'あざとい'] },
        { display: '🙌万歳', answers: ['ばんざい', '万歳', 'バンザイ'] },
        { display: '💪ガッツポーズ', answers: ['がっつぽーず', 'ガッツポーズ', 'よっしゃ'] },
        { display: '🐶四つん這い', answers: ['よつんばい', '四つん這い', '犬のポーズ'], isEcchi: true },
        { display: '👅ペロペロ', answers: ['ぺろぺろ', '舌出し', 'ベロ出し'], isEcchi: true },
        { display: '🤟内緒ポーズ', answers: ['ないしょ', 'しーっ', '秘密'] },
        { display: '👙胸を寄せる', answers: ['おっぱい', '胸', '寄せる', '谷間'], isEcchi: true },
        { display: '🦵網タイツ', answers: ['あみたいつ', '網タイツ', '足', '脚'], isEcchi: true },
        { display: '💃自撮りポーズ', answers: ['じどり', 'せるふぃー', 'もり'] },
        { display: '💋舌ぺろポーズ', answers: ['したぺろ', 'てへぺろ', 'べろ'], isEcchi: true },
        { display: '👗スカートをめくる', answers: ['すかーと', 'ぱんつ', 'めくる'], isEcchi: true },
        { display: '🤱授乳ポーズ（！？）', answers: ['じゅにゅう', 'おっぱい'], isEcchi: true },
        { display: '🛌誘ってる寝ポーズ', answers: ['ねそべり', 'うわめづかい', 'ねころび'], isEcchi: true },
        { display: '🦵太ももを強調', answers: ['ふともも', 'あし', 'ぜったいりょういき'], isEcchi: true },
        { display: '🙆‍♀️手で胸を隠す', answers: ['てぶら', 'おっぱい', 'かくす'], isEcchi: true },
        { display: '🍑Ｔバック食い込み', answers: ['ぱんつ', 'くいこみ'], isEcchi: true },
        { display: '🥵欲情して腰を振る', answers: ['こしふり', 'こうふん'], isEcchi: true },
        { display: '💋指を舐める', answers: ['ゆびなめ', 'せくしー'], isEcchi: true },
        { display: '💦汗だくでハァハァ', answers: ['あせだく', 'いきぎれ'], isEcchi: true },
        { display: '🧜‍♀️脚を絡める', answers: ['あし', 'みっちゃく'], isEcchi: true }
    ],
    job: [
        { display: '👮警察官', answers: ['けいさつかん', '警察官', 'おまわりさん', '警察'] },
        { display: '🧑‍🚒消防士', answers: ['しょうぼうし', '消防士'] },
        { display: '🧑‍⚕️医者', answers: ['いしゃ', '医者', 'ドクター', 'お医者さん'] },
        { display: '🩺看護師', answers: ['かんごし', '看護師', 'ナース'] },
        { display: '👨‍✈️パイロット', answers: ['ぱいろっと', 'パイロット'] },
        { display: '🧑‍🏫先生', answers: ['せんせい', '先生', '教師', 'きょうし'] },
        { display: '🪚大工', answers: ['だいく', '大工', '大工さん'] },
        { display: '🧑‍🍳コック', answers: ['こっく', 'コック', 'シェフ', '料理人'] },
        { display: '✂️美容師', answers: ['びようし', '美容師'] },
        { display: '🧑‍🚀宇宙飛行士', answers: ['うちゅうひこうし', '宇宙飛行士'] },
        { display: '📹ユーチューバー', answers: ['ゆーちゅーばー', 'ユーチューバー', 'youtuber'] },
        { display: '🎤歌手', answers: ['かしゅ', '歌手', 'シンガー', 'ボーカル'] },
        { display: '✨アイドル', answers: ['あいどる', 'アイドル'] },
        { display: '⚾野球選手', answers: ['やきゅうせんしゅ', '野球選手', 'プロ野球選手'] },
        { display: '🕵️探偵', answers: ['たんてい', '探偵'] },
        { display: '💼サラリーマン', answers: ['さらりーまん', 'サラリーマン', '会社員'] },
        { display: '🧑‍🌾農家', answers: ['のうか', '農家', 'お百姓さん'] },
        { display: '🎩マジシャン', answers: ['まじしゃん', 'マジシャン', '手品師'] },
        { display: '✍️漫画家', answers: ['まんがか', '漫画家'] },
        { display: '👨‍⚖️裁判官', answers: ['さいばんかん', '裁判官', 'judge'] }
    ],
    vehicle: [
        { display: '🚗車', answers: ['くるま', '車', '自動車'] },
        { display: '🚲自転車', answers: ['じてんしゃ', '自転車', 'チャリ'] },
        { display: '🚃電車', answers: ['でんしゃ', '電車', '列車'] },
        { display: '🚅新幹線', answers: ['しんかんせん', '新幹線'] },
        { display: '✈️飛行機', answers: ['ひこうき', '飛行機'] },
        { display: '🚁ヘリコプター', answers: ['へりこぷたー', 'ヘリコプター', 'ヘリ'] },
        { display: '🚢船', answers: ['ふね', '船', '客船', 'ボート'] },
        { display: '⛵ヨット', answers: ['よっと', 'ヨット'] },
        { display: '🛥️潜水艦', answers: ['せんすいかん', '潜水艦'] },
        { display: '🚑救急車', answers: ['きゅうきゅうしゃ', '救急車'] },
        { display: '🚓パトカー', answers: ['ぱとかー', 'パトカー'] },
        { display: '🚒消防車', answers: ['しょうぼうしゃ', '消防車'] },
        { display: '🚜トラクター', answers: ['とらくたー', 'トラクター'] },
        { display: '🚚トラック', answers: ['とらっく', 'トラック'] },
        { display: '🚌バス', answers: ['ばす', 'バス'] },
        { display: '🚕タクシー', answers: ['たくしー', 'タクシー'] },
        { display: '🚀ロケット', answers: ['ろけっと', 'ロケット'] },
        { display: '🛸ＵＦＯ', answers: ['ゆーふぉー', 'うぉー', 'UFO', 'ユーフォー'] },
        { display: '🎈気球', answers: ['ききゅう', '気球'] },
        { display: '🏍️バイク', answers: ['ばいく', 'バイク', 'オートバイ'] }
    ],
    landmark: [
        { display: '🗼東京タワー', answers: ['とうきょうたわー', '東京タワー'] },
        { display: '🗼スカイツリー', answers: ['すかいつりー', 'スカイツリー', '東京スカイツリー'] },
        { display: '🗽自由の女神', answers: ['じゆうのめがみ', '自由の女神'] },
        { display: '🗼エッフェル塔', answers: ['えっふぇるとう', 'エッフェル塔'] },
        { display: '🏜️ピラミッド', answers: ['ぴらみっど', 'ピラミッド'] },
        { display: '🏢ピサの斜塔', answers: ['ぴさのしゃとう', 'ピサの斜塔'] },
        { display: '🦁スフィンクス', answers: ['すふぃんくす', 'スフィンクス'] },
        { display: '🏛️凱旋門', answers: ['がいせんもん', '凱旋門'] },
        { display: '🧱万里の長城', answers: ['ばんりのちょうじょう', '万里の長城'] },
        { display: '🎭オペラハウス', answers: ['おぺらはうす', 'オペラハウス'] },
        { display: '🏯大仏さん', answers: ['だいぶつ', '大仏', 'だいぶつさん', 'Buddha'] },
        { display: '🏟️コロッセオ', answers: ['ころっせお', 'コロッセオ'] },
        { display: '🕰️ビッグベン', answers: ['びっぐべん', 'ビッグベン'] },
        { display: '🏮雷門', answers: ['かみなりもん', '雷門', '浅草寺'] },
        { display: '🏯金閣寺', answers: ['きんかくじ', '金閣寺'] },
        { display: '🏯大阪城', answers: ['おおさかじょう', '大阪城'] },
        { display: '🗿モアイ像', answers: ['もあいぞう', 'モアイ像', 'モアイ'] },
        { display: '🏯五重塔', answers: ['ごじゅうのとう', '五重塔', 'pagoda'] },
        { display: '🏯姫路城', answers: ['ひめじじょう', '姫路城'] },
        { display: '🗿マーライオン', answers: ['まーらいおん', 'マーライオン'] }
    ],
    item: [
        { display: '🪥歯ブラシ', answers: ['はぶらし', '歯ブラシ'] },
        { display: '🧻トイレットペーパー', answers: ['といれっとぺーぱー', 'トイレットペーパー'] },
        { display: '🧴シャンプー', answers: ['しゃんぷー', 'シャンプー'] },
        { display: '✂️ハサミ', answers: ['はさみ', 'ハサミ'] },
        { display: '🕰️時計', answers: ['とけい', '時計'] },
        { display: '☂️傘', answers: ['かさ', '傘', 'アンブレラ'] },
        { display: '👓メガネ', answers: ['めがね', 'メガネ', '眼鏡'] },
        { display: '📱スマホ', answers: ['すまほ', 'スマホ', 'スマートフォン', '携帯'] },
        { display: '💻パソコン', answers: ['ぱそこん', 'パソコン', 'PC'] },
        { display: '🗑️ゴミ箱', answers: ['ごみばこ', 'ゴミ箱'] },
        { display: '🤧ティッシュ', answers: ['てぃっしゅ', 'ティッシュ'] },
        { display: '🥄スプーン', answers: ['すぷーん', 'スプーン'] },
        { display: '🥤コップ', answers: ['こっぷ', 'コップ', 'グラス'] },
        { display: '🍳フライパン', answers: ['ふらいぱん', 'フライパン'] },
        { display: '🔪包丁', answers: ['ほうちょう', '包丁', 'ナイフ'] },
        { display: '📺テレビ', answers: ['てれび', 'テレビ'] },
        { display: '🧺洗濯機', answers: ['せんたくき', '洗濯機'] },
        { display: '🧹掃除機', answers: ['そうじき', '掃除機'] },
        { display: '🔌コンセント', answers: ['こんせんと', 'コンセント', 'プラグ'] },
        { display: '🔋電池', answers: ['でんち', '電池', 'バッテリー'] }
    ],
    bug: [
        { display: '🦋ちょうちょ', answers: ['ちょう', 'ちょうちょ', 'チョウ', 'butterfly'] },
        { display: '🐝はち', answers: ['はち', 'ハチ', '蜂', 'bee'] },
        { display: '🐞てんとう虫', answers: ['てんとうむし', 'テントウムシ', 'てんとう虫', 'ladybug'] },
        { display: '🐜あり', answers: ['あり', 'アリ', 'ant'] },
        { display: '🕷️くも', answers: ['くも', 'クモ', '蜘蛛', 'spider'] },
        { display: '🦗バッタ', answers: ['ばった', 'バッタ', 'grasshopper'] },
        { display: '🪲カブトムシ', answers: ['かぶとむし', 'カブトムシ', 'beetle'] },
        { display: '🦟か（蚊）', answers: ['か', 'カ', '蚊', 'mosquito'] },
        { display: '🪰はえ', answers: ['はえ', 'ハエ', 'fly'] },
        { display: '🐛いもむし', answers: ['いもむし', 'イモムシ', 'caterpillar'] },
        { display: '🐌かたつむり', answers: ['かたつむり', 'カタツムリ', 'snail'] },
        { display: '🪳ゴキブリ（笑）', answers: ['ごきぶり', 'ゴキブリ', 'G', 'cockroach'] },
        { display: '🐜カマキリ', answers: ['かまきり', 'カマキリ', 'mantis'] },
        { display: '🦟セミ', answers: ['せみ', 'セミ', '蝉', 'cicada'] },
        { display: '🏮ホタル', answers: ['ほたる', 'ホタル', '蛍', 'firefly'] }
    ]
};
cuteWords.mix = [...cuteWords.animal, ...cuteWords.food, ...cuteWords.daily, ...cuteWords.yabai, ...cuteWords.situation, ...cuteWords.pose, ...cuteWords.job, ...cuteWords.vehicle, ...cuteWords.landmark, ...cuteWords.item, ...cuteWords.bug];
cuteWords.mix_safe = [...cuteWords.animal, ...cuteWords.food, ...cuteWords.daily, ...cuteWords.situation, ...cuteWords.pose, ...cuteWords.job, ...cuteWords.vehicle, ...cuteWords.landmark, ...cuteWords.item, ...cuteWords.bug]
    .filter(word => !word.isEcchi);

// ソロモード用にお題リストを全部返すよ！💎✨💍
app.get('/api/words', (req, res) => {
    res.json(cuteWords);
});

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
    return str.replace(/[\u30a1-\u30f6]/g, function (match) {
        return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
}

function checkReadiness(room, settings, socketId) {
    if (room.gamePhase !== 'waiting' && room.gamePhase !== 'between_turns') return;
    if (room.isLastTurnGlobal) return;

    // NPC以外のプレイヤーを取得
    const humans = room.players.filter(p => p && !p.isNpc);
    if (humans.length === 0) return;

    // --- 👑 設定とカテゴリーの保存 💅 ---
    if (socketId) {
        const p = room.players.find(ptr => ptr.id === socketId);
        if (p && settings) {
            // 個人のカテゴリー設定を保存 💖
            if (settings.category) {
                p.category = settings.category;
            }
            
            // ホスト（最初の人間）なら全体のルール（周回数・制限時間）を更新 👑
            const host = humans[0];
            if (socketId === host.id) {
                let changed = false;
                if (settings.timeLimit !== undefined && room.timeLimit !== settings.timeLimit) {
                    room.timeLimit = settings.timeLimit;
                    changed = true;
                }
                if (settings.rounds !== undefined && room.maxRounds !== settings.rounds) {
                    room.maxRounds = settings.rounds;
                    changed = true;
                }
                if (changed) {
                    console.log(`[SETTINGS-SYNC] Room ${room.id} Host ${host.name} updated rules: Rounds=${room.maxRounds}, Time=${room.timeLimit}s ✨`);
                }
            }
        }
    }

    const allReady = humans.every(p => p && p.isReady);
    console.log(`[READY-CHECK-ROOM] Room: ${room.id}, Humans: ${humans.length}, Ready: ${humans.filter(p => p && p.isReady).length}, AllReady: ${allReady}`);
    
    if (allReady) {
        if (room.gamePhase === 'waiting') {
            console.log(`[START-ROOM] Room ${room.id} starting game: Rounds=${room.maxRounds}, Time=${room.timeLimit}s 🚀`);
            room.gamePhase = 'playing';
            
            room.currentRound = 1;
            room.turnsPlayedInRound = 0;
            room.currentPlayerIndex = -1;
            room.isLastTurnGlobal = false;

            room.players.forEach(p => {
                p.score = 0;
                p.isReady = false;
            });
            
            safeRoomEmit(room, 'game_start_imminent');
            setTimeout(() => {
                if (room.gamePhase !== 'playing' || room.players.length === 0) return;
                startNextTurn(room);
            }, 1000);
        } else if (room.gamePhase === 'between_turns') {
            room.gamePhase = 'playing';
            
            room.players.forEach(p => {
                if (p) p.isReady = false;
            });
            
            startNextTurn(room);
        }
    }
}

function startNextTurn(room) {
    try {
        if (room.players.length === 0) {
            console.log(`[WARN-ROOM] Room ${room.id} has no players left to start next turn`);
            room.isStartingNextTurn = false;
            return;
        }
        if (room.isStartingNextTurn) {
            console.log(`[WARN-ROOM] Room ${room.id} startNextTurn called while already starting. Ignoring.`);
            return;
        }
        
        // 周回の整合性チェック 💅
        if (room.turnsPlayedInRound >= room.players.length || room.currentPlayerIndex === -1) {
            if (room.currentPlayerIndex !== -1) {
                room.currentRound++;
                room.turnsPlayedInRound = 0;
                console.log(`[ROUND-INC-ROOM] Room ${room.id}: All human/NPC players finished. Now Round ${room.currentRound}`);
            } else {
                console.log(`[ROUND-START-ROOM] Room ${room.id}: Game starting at Round 1`);
            }
        }

        // 指定周回数を超えてたら強制終了ッ！ 🏁
        if (room.maxRounds > 0 && room.currentRound > room.maxRounds) {
            console.log(`[GAME-END-ROOM] Room ${room.id}: Max rounds reached (${room.maxRounds}). currentRound is ${room.currentRound}. Ending.`);
            endGame(room);
            return;
        }

        room.isStartingNextTurn = true;
        room.turnsPlayedInRound++;
        room.gamePhase = 'playing';
        room.players.forEach(p => { if (p) p.hasGuessed = false; });

        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        const drawer = room.players[room.currentPlayerIndex];

        if (!drawer) {
            console.error(`[CRITICAL-ROOM] Room ${room.id}: No drawer found at index`, room.currentPlayerIndex);
            room.isStartingNextTurn = false;
            return;
        }

        // お題リストの選定：描き手の設定したカテゴリーを優先するよ！🛡️💍
        const category = drawer.category || 'mix';
        const wordList = cuteWords[category] || cuteWords.mix;
        
        let attempts = 0;
        let pickedWord = null;
        
        // 直近10回に出たお題は避けるようにするねッ！✨🤟💎
        while (attempts < 15) {
            pickedWord = wordList[Math.floor(Math.random() * wordList.length)];
            if (!room.recentWords.includes(pickedWord.display) || wordList.length <= room.recentWords.length) {
                break;
            }
            attempts++;
        }
        
        room.currentWordObj = pickedWord || wordList[0];
        if (!room.currentWordObj) {
            room.currentWordObj = cuteWords.mix[Math.floor(Math.random() * cuteWords.mix.length)];
        }
        
        // 履歴に追加（最大10個まで覚えるお💅）
        room.recentWords.unshift(room.currentWordObj.display);
        if (room.recentWords.length > 10) room.recentWords.pop();
        
        console.log(`[TURN-START-ROOM] Room: ${room.id}, Round: ${room.currentRound}/${room.maxRounds}, Turn: ${room.turnsPlayedInRound}/${room.players.length}, Drawer: ${drawer.name}`);

        room.timeLeft = room.timeLimit;
        room.pointsAwardedThisTurn = false;

        safeRoomEmit(room, 'clear_canvas');
        safeRoomEmit(room, 'update_players', room.players);

        const roundInfoTxt = (room.maxRounds === 0) 
            ? `${room.currentRound}周目 (∞)` 
            : `${room.currentRound}周目 (${room.turnsPlayedInRound}/${room.players.length})`;

        safeEmit(io.to(drawer.id), 'round_start', {
            word: room.currentWordObj.display,
            timeLimit: room.timeLimit,
            isDrawer: true,
            roundInfo: roundInfoTxt
        });

        room.players.forEach(p => {
            if (p && p.id !== drawer.id) {
                safeEmit(io.to(p.id), 'round_start', {
                    word: '????',
                    timeLimit: room.timeLimit,
                    isDrawer: false,
                    drawerName: drawer.name,
                    roundInfo: roundInfoTxt
                });
            }
        });

        room.players.forEach(p => {
            if (p && p.isNpc) handleNpcAction(room, p);
        });

        if (room.roundTimer) clearInterval(room.roundTimer);
        safeRoomEmit(room, 'timer', room.timeLeft);

        room.roundTimer = setInterval(() => {
            if (room.timeLimit > 0) {
                room.timeLeft--;
                safeRoomEmit(room, 'timer', room.timeLeft);
                if (room.timeLeft <= 0) {
                    clearInterval(room.roundTimer);
                    endTurn(room);
                }
            } else {
                safeRoomEmit(room, 'timer', '∞');
            }
        }, 1000);

        if (room.nextTurnTimer) {
            clearTimeout(room.nextTurnTimer);
            room.nextTurnTimer = null;
        }
    } catch (e) {
        console.error(`[END-TURN-ERR-ROOM] Room ${room.id}: ${e}`);
    } finally {
        room.isStartingNextTurn = false; 
    }
}

function endTurn(room) {
    try {
        if (room.roundTimer) clearInterval(room.roundTimer);
        room.gamePhase = 'between_turns';

        room.players.forEach(p => {
            if (p && p.isNpc && room.npcTimers[p.id]) {
                room.npcTimers[p.id].forEach(t => {
                    if (t.type === 'interval') clearInterval(t.timer);
                    else clearTimeout(t.timer);
                });
                room.npcTimers[p.id] = [];
            }
        });

        let isLastTurn = false;
        if (room.maxRounds > 0 && room.currentRound >= room.maxRounds && room.turnsPlayedInRound >= room.players.length) {
            isLastTurn = true;
            room.isLastTurnGlobal = true;
        }

        const nextMsg = isLastTurn ? "結果発表にいくよ〜！🏆" : "全員が「準備オッケー！」したら次に行くよっ！💖💅✨";
        const wordDisplay = room.currentWordObj ? room.currentWordObj.display : '????';
        
        safeRoomEmit(room, 'chat_message', { sender: 'System', text: `時間終了〜！正解は「${wordDisplay}」でした！✨ ${nextMsg}`, color: '#ff66b2', type: 'finish' });

        const drawer = room.players[room.currentPlayerIndex];
        const drawerName = drawer ? drawer.name : 'Unknown';
        
        safeRoomEmit(room, 'round_end', { players: room.players, word: wordDisplay, drawer: drawerName });
        safeRoomEmit(room, 'game_state', { phase: 'between_turns', timeLeft: 0, isLastTurn: isLastTurn });

        if (isLastTurn) {
            setTimeout(() => {
                if (room.gamePhase === 'between_turns') endGame(room);
            }, 5000);
        }
    } catch (err) {
        console.error(`[ERR-ROOM] Room ${room.id} error in endTurn: ${err.stack}`);
    }
}

function endGame(room) {
    try {
        room.gamePhase = 'results';
        room.isLastTurnGlobal = false;
        // 点数順にソート（nullチェック付き）💍
        const sortedPlayers = [...room.players]
            .filter(p => p !== null)
            .sort((a, b) => (b.score || 0) - (a.score || 0));
        safeRoomEmit(room, 'game_over', sortedPlayers);
        console.log(`[GAME-OVER-ROOM] Room ${room.id}: Results emitted.`);
    } catch (err) {
        console.error(`[ERR-ROOM] Room ${room.id} error in endGame: ${err.stack}`);
    }
}

function getWordHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getNpcDrawingStrategy(word) {
    const w = word.toLowerCase();
    const hash = getWordHash(word);
    let color = '#ff66b2';
    let pattern = 'cloud';
    let category = 'other';

    const patterns = ['spiral', 'cloud', 'horizontal', 'vertical', 'zigzag', 'star', 'square', 'heart'];
    pattern = patterns[hash % patterns.length];

    if (w.match(/赤|🍎|🍓|🍣|🍓|🍒|🍅|🔥|💋|🚨/)) color = '#ff0000';
    else if (w.match(/青|水|海|空|🌊|☁️|💎|🐬|💧|🧊|✈️|🚅/)) color = '#00aaff';
    else if (w.match(/緑|森|木|草|🌿|🌲|🥗|🍏|🧤|🥦|🐛/)) color = '#22aa22';
    else if (w.match(/黄|星|雷|バナナ|月|🍌|⭐|🌙|☀️|🍋|🧀|🍳/)) color = '#ffff00';
    else if (w.match(/橙|オレンジ|🍊|🥕|🎃|🍔|🦊/)) color = '#ff8800';
    else if (w.match(/茶|うちぬ|ねこ|いぬ|動物|犬|猫|土|💩|🐕|🐈|🐻|🟫|🪵|🍞|🍩/)) color = '#8b4513';
    else if (w.match(/紫|ぶどう|🍇| eggplant|👿|💅/)) color = '#8800ff';
    else if (w.match(/桃|ピンク|🍑|🌸|💍|👙|💄|🔞|💋|🤤|🥵|🍼|🩲/)) color = '#ff66b2';
    else if (w.match(/白|雪|歯|🥛|雲|🦷|🍚/)) color = '#ffffff';
    else if (w.match(/黒|髪|影|💣|🕶️|🕷️|🎱/)) color = '#333333';
    else if (w.match(/銀|金|塔|機械|🏢|🗼|⌚|🥄|🩶|💛|🏠|🎁/)) color = '#aaaaaa';

    if (w.match(/いぬ|ねこ|パンダ|クマ|ウサギ|ペンギン|動物|🐕|🐈|🐻|🦄|🦒/)) category = 'animal';
    else if (w.match(/ハンバーガー|ピザ|ラーメン|プリン|寿司|食べ物|🍎|🍔|🍣/)) category = 'food';
    else if (w.match(/車|くるま|飛行機|電車|のりもの|🚗|✈️|🚄/)) category = 'vehicle';
    else if (w.match(/塔|ビル|家|建物|ピラミッド|🗼|🏠|🏢/)) category = 'landmark';
    else if (w.match(/唇|エッチ|セクシー|ヤバい|💋|🔞|👙|🤤|🥵|🍼|🩲|🍑|🎀|🛌|💦/)) category = 'yabai';

    if (w.match(/りんご|ボール|太陽|顔|まる|円|地球|メロン|天/)) pattern = 'spiral';
    else if (w.match(/塔|木|人|縦|ビル|エッフェル/)) pattern = 'vertical';
    else if (w.match(/海|道|波|横|ベッド/)) pattern = 'horizontal';
    
    const offsetX = (hash % 150) - 75;
    const offsetY = (hash % 100) - 50;

    return { color, pattern, offsetX, offsetY, hash, category };
}

function handleNpcAction(room, npc) {
    if (!room.npcTimers[npc.id]) room.npcTimers[npc.id] = [];
    room.npcTimers[npc.id].forEach(t => {
        if (t.type === 'interval') clearInterval(t.timer);
        else clearTimeout(t.timer);
    });
    room.npcTimers[npc.id] = [];

    const isDrawer = (room.players[room.currentPlayerIndex]?.id === npc.id);

    if (isDrawer) {
        if (!room.currentWordObj) {
            console.error(`[NPC-ERR-ROOM] Room ${room.id}: No currentWordObj found for drawer NPC`);
            return;
        }
        const strategy = getNpcDrawingStrategy(room.currentWordObj.display);
        const getNpcComment = (word) => {
            const w = word.toLowerCase();
            if (w.match(/🍎|🍓|🍔|🍣|たべもの/)) return [`${word}、おいしそうに描くね！😋💖`, `お腹空いてきちゃった～ｗ🍴✨`, `かずぅさんも一口食べる？（意味深）`];
            if (w.match(/🐶|🐱|くま|どうぶつ/)) return [`${word}、かわいく描けるかな～？🐾💍`, `モフモフ感出すのがポイントだよ！✨`, `アタシ、こういうの飼いた～い！💖`];
            if (w.match(/車|飛行機|のりもの/)) return [`${word}、かっこよく描いちゃうよ！💨🚀`, `スピード感出してきた～！✨`, `これに乗ってデート行きたいな～！💎💍`];
            if (w.match(/唇|セクシー|ヤバい|エッチ|エロ|🔞|🥵|💋|🍑/)) return [
                `ちょっとエッチすぎ？ｗ🔞💖`, 
                `これ描くの恥ずかしいんだけど～！🫣✨`, 
                `かずぅさん、こういうの好きなんでしょ？（笑）`, 
                `顔赤くなってない？大丈夫～？🔥💅`,
                `ギャルの本気（セクシーver）見せちゃうよ！💍✨`
            ];
            return [
                `${word}、描くのムズすぎない？ｗ✨`,
                `この辺のラインがポイントだよ💖💍`,
                `筆が乗ってきた～！🎨💎🚀`,
                `見て、可愛くなってきてない？💅💎`,
                `ギャルの本気見せちゃうよ💍✨💅`
            ];
        };

        const comments = getNpcComment(room.currentWordObj.display);
        const commentInterval = setInterval(() => {
            if (room.gamePhase !== 'playing') { clearInterval(commentInterval); return; }
            safeRoomEmit(room, 'chat_message', { sender: npc.name, text: comments[Math.floor(Math.random() * comments.length)], color: '#333' });
        }, 5000 + Math.random() * 4000);
        room.npcTimers[npc.id].push({ timer: commentInterval, type: 'interval' });

        let step = 0;
        let lastX = 0, lastY = 0;
        const drawInterval = setInterval(() => {
            if (room.gamePhase !== 'playing') { clearInterval(drawInterval); return; }
            
            let x0, y0, x1, y1;
            const centerX = 300 + strategy.offsetX, centerY = 250 + strategy.offsetY;
            let nextX, nextY;
            const c = strategy.category;
            
            if (c === 'animal') {
                if (step < 60) { const a = step * 0.15; const r = step * 0.8; nextX = centerX + Math.cos(a) * r; nextY = centerY + Math.sin(a) * r; }
                else if (step < 80) { const a = step * 0.3; const r = 15; nextX = centerX - 40 + Math.cos(a) * r; nextY = centerY - 50 + Math.sin(a) * r; }
                else { const a = step * 0.3; const r = 15; nextX = centerX + 40 + Math.cos(a) * r; nextY = centerY - 50 + Math.sin(a) * r; }
            } else if (c === 'vehicle') {
                if (step < 60) { const s = step % 60; if (s < 15) { nextX = centerX - 60 + s * 8; nextY = centerY - 30; } else if (s < 30) { nextX = centerX + 60; nextY = centerY - 30 + (s-15) * 4; } else if (s < 45) { nextX = centerX + 60 - (s-30) * 8; nextY = centerY + 30; } else { nextX = centerX - 60; nextY = centerY + 30 - (s-45) * 4; } }
                else if (step < 80) { const a = step * 0.4; const r = 12; nextX = centerX - 40 + Math.cos(a) * r; nextY = centerY + 35 + Math.sin(a) * r; }
                else { const a = step * 0.4; const r = 12; nextX = centerX + 40 + Math.cos(a) * r; nextY = centerY + 35 + Math.sin(a) * r; }
            } else if (c === 'food') {
                if (step < 50) { nextX = centerX - 80 + (step * 3.2); nextY = centerY + 40 + Math.sin(step * 0.5) * 5; }
                else { const t = step * 0.2; const r = 50 + Math.sin(t * 3) * 10; nextX = centerX + Math.cos(t) * r; nextY = centerY + Math.sin(t) * r - 10; }
            } else if (c === 'landmark') {
                if (step < 70) { nextX = centerX + (Math.random() - 0.5) * 40; nextY = centerY + 80 - step * 2.2; }
                else { nextX = centerX + (step - 85) * 10; nextY = centerY - 80 + Math.random() * 10; }
            } else if (c === 'yabai') {
                if (step < 60) { const t = step * 0.15; nextX = centerX + 16 * Math.pow(Math.sin(t), 3) * 8; nextY = centerY - (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 8; }
                else { nextX = centerX + (Math.random() - 0.5) * 150; nextY = centerY + (Math.random() - 0.5) * 150; }
            } else {
                switch (strategy.pattern) {
                    case 'spiral': const a = step * 0.15; const r = (step % 400) * 0.4; nextX = centerX + Math.cos(a) * r; nextY = centerY + Math.sin(a) * r; break;
                    case 'cloud': const t_cloud = step * 0.2; const r_cloud = 80 + Math.sin(t_cloud * 2) * 20; nextX = centerX + Math.cos(t_cloud) * r_cloud + Math.sin(step * 0.5) * 30; nextY = centerY + Math.sin(t_cloud) * r_cloud + Math.cos(step * 0.5) * 30; break;
                    case 'star': const a_star = (step * 0.7); const r_star = (step % 2 === 0) ? 100 : 40; nextX = centerX + Math.cos(a_star) * r_star; nextY = centerY + Math.sin(a_star) * r_star; break;
                    default: nextX = centerX + (Math.random() - 0.5) * 200; nextY = centerY + (Math.random() - 0.5) * 200;
                }
            }

            const margin = 25;
            const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
            x1 = clamp(nextX, margin, 600 - margin);
            y1 = clamp(nextY, margin, 500 - margin);
            x0 = (step === 0) ? x1 : lastX; y0 = (step === 0) ? y1 : lastY;

            safeRoomEmit(room, 'draw', { x0, y0, x1, y1, color: strategy.color, size: 8 + Math.random() * 8, isEraser: false, isGlow: true, isRainbow: (strategy.category === 'yabai' && Math.random() > 0.8) });

            if (step === 10) safeRoomEmit(room, 'chat_message', { sender: npc.name, text: 'まずは大体の形から描くね！✨', color: '#333' });
            else if (step === 60 && (c === 'animal' || c === 'vehicle')) safeRoomEmit(room, 'chat_message', { sender: npc.name, text: (c === 'animal' ? '次はこれ、耳だよ！🐾' : 'タイヤも付けちゃうよ！🚗'), color: '#333' });
            else if (step === 90) safeRoomEmit(room, 'chat_message', { sender: npc.name, text: '仕上げに細かく描いていくよ💖💍', color: '#333' });

            lastX = x1; lastY = y1; step++;
        }, 80);
        room.npcTimers[npc.id].push({ timer: drawInterval, type: 'interval' });

        const finishTimeout = setTimeout(() => {
            clearInterval(drawInterval);
            clearInterval(commentInterval);
            if (room.gamePhase === 'playing' && room.players[room.currentPlayerIndex]?.id === npc.id) {
                safeRoomEmit(room, 'chat_message', { sender: npc.name, text: 'できた！可愛くない？💖✨💍', color: '#ff66b2' });
                endTurn(room);
            }
        }, 12000 + Math.random() * 8000);
        room.npcTimers[npc.id].push({ timer: finishTimeout, type: 'timeout' });
    } else {
        const delay = (20 + Math.random() * 40) * 1000;
        const guessTimeout = setTimeout(() => {
            if (room.gamePhase !== 'playing' || npc.hasGuessed) return;
            const answer = room.currentWordObj.answers[0];
            const prefix = ['', 'え、これ', 'もしかして', 'わかった！', 'んー、', 'これ', '絶対'];
            const suffix = ['', 'じゃない？ｗ', 'かも！💖', 'だと思う！✨', 'だよ💅', 'だよね💍'];
            const text = prefix[Math.floor(Math.random() * prefix.length)] + answer + suffix[Math.floor(Math.random() * suffix.length)];
            handleChatMessage(room, npc, text);
        }, delay);
        room.npcTimers[npc.id].push({ timer: guessTimeout, type: 'timeout' });
    }
}

function getLevelThreshold(lv) {
    return (lv * 30) + 100;
}

async function addXp(room, player, amount) {
    if (!player) return;
    if (player.xp === undefined) player.xp = 0;
    if (player.lv === undefined) player.lv = 0;
    
    player.xp += amount;
    let leveledUp = false;
    
    // かずぅさん指定の設計：(Lv * 30) + 100
    while (player.xp >= getLevelThreshold(player.lv)) {
        player.xp -= getLevelThreshold(player.lv);
        player.lv++;
        leveledUp = true;
    }
    
    if (player.token) {
        if (!persistentData[player.token]) {
            persistentData[player.token] = { name: player.name || 'Unknown', score: 0, xp: 0, lv: 0 };
        }
        persistentData[player.token].xp = player.xp;
        persistentData[player.token].lv = player.lv;
        persistentData[player.token].name = player.name; // 最新の名前をキープ！💅
        await savePlayerData(player.token);
    }
    
    if (leveledUp) {
        safeRoomEmit(room, 'chat_message', { 
            sender: 'System', 
            text: `✨🆙 LEVEL UP!! ${player.name}さんは Lv.${player.lv} になったよ！おめ！💖💍✨`, 
            color: '#ffcc00' 
        });
        // クライアント側で演出を出せるように通知
        io.to(player.id).emit('level_up_effect', { lv: player.lv });
    }
}

async function handleChatMessage(room, player, msg, socket) {
    if (room.gamePhase === 'playing') {
        const isDrawer = room.players[room.currentPlayerIndex]?.id === player.id;
        let isCorrect = false;
        let isAlmost = false;

        const cleanInput = msg.trim().toLowerCase().replace(/[\s　]/g, '');
        const normalizedInput = kanaToHira(cleanInput);

        if (!isDrawer && !player.hasGuessed && room.currentWordObj) {
            for (let ans of room.currentWordObj.answers) {
                const normalizedAns = kanaToHira(ans.toLowerCase().replace(/[\s　]/g, ''));
                if (normalizedInput === normalizedAns) { isCorrect = true; break; }
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
            if (!room.pointsAwardedThisTurn) {
                room.pointsAwardedThisTurn = true;
                player.score += 1;
                if (player.token) {
                    if (!persistentData[player.token]) {
                        persistentData[player.token] = { name: player.name || 'Unknown', score: 0, xp: 0, lv: 0 };
                    }
                    persistentData[player.token].score = (persistentData[player.token].score || 0) + 1; // 🎯 修正：上書きじゃなくて加算するおッ！✨💍
                    player.totalScore = persistentData[player.token].score; // メモリ上の「トータル」も更新ッ！💅
                    persistentData[player.token].xp = player.xp || 0;
                    persistentData[player.token].lv = player.lv || 0;
                    persistentData[player.token].name = player.name;
                    await savePlayerData(player.token);
                }
                if (room.players[room.currentPlayerIndex]) {
                    room.players[room.currentPlayerIndex].score += 1;
                    const drawer = room.players[room.currentPlayerIndex];
                    if (drawer.token) {
                        if (!persistentData[drawer.token]) {
                            persistentData[drawer.token] = { name: drawer.name || 'Unknown', score: 0, xp: 0, lv: 0 };
                        }
                        persistentData[drawer.token].score = (persistentData[drawer.token].score || 0) + 1; // 🎯 描き手も累積スコア加算ッ！🎨
                        drawer.totalScore = persistentData[drawer.token].score;
                        persistentData[drawer.token].name = drawer.name;
                        await savePlayerData(drawer.token);
                    }
                    // 描き手にも20XP！🎨
                    await addXp(room, drawer, 20);
                }
                
                // 回答者にも20XP！🎯
                await addXp(room, player, 20);

                safeRoomEmit(room, 'chat_message', { sender: 'System', text: `やば！${player.name}さんが1番乗りで大正解！🎉✨（回答者+1pt,20XP / 出題者+1pt,20XP）`, color: '#ff66b2', type: 'correct' });
            } else {
                safeRoomEmit(room, 'chat_message', { sender: 'System', text: `${player.name}さんも正解！👏（ポイントは最初の人だけだよ！）`, color: '#ff66b2', type: 'correct' });
            }
            safeRoomEmit(room, 'update_players', room.players);
            if (player.isNpc) {
                safeRoomEmit(room, 'chat_message', { sender: player.name, text: msg, color: '#333' });
            } else {
                // 🆕 人間の正解メッセージも「ド派手タイプ」で送信するおッ！💎✨💍
                safeRoomEmit(room, 'chat_message', { sender: player.name, text: msg, color: '#333', type: 'correct_user' });
            }
        } else if (isAlmost && !isCorrect && !isDrawer && !player.hasGuessed) {
            if (!player.isNpc) safeEmit(io.to(player.id), 'chat_message', { sender: 'System', text: `「${msg}」…惜しい！あとちょっと！🥺`, color: '#ff9900', type: 'oshii' });
            safeRoomEmit(room, 'chat_message', { sender: player.name, text: msg, color: '#333' });
        } else {
            safeRoomEmit(room, 'chat_message', { sender: player.name, text: msg, color: '#333' });
        }
    } else {
        safeRoomEmit(room, 'chat_message', { sender: player.name, text: msg, color: '#333' });
    }
}

io.on('connection', (socket) => {
    // 🆕 プレイヤー登録（はじめて！）💅✨
    socket.on('register', async (data) => {
        let { name, password } = data;
        if (!name || !password) {
            safeEmit(socket, 'register_failed', '名前とパスワードを入れてねッ！🥺');
            return;
        }

        // 🆕 切断されてたら再接続を試みるおッ！！💖🚀
        if (MONGO_URI && mongoose.connection.readyState !== 1) {
            console.log('[DB-RETRY-REG] Connection lost. Retrying before register... 🔄');
            await connectDB();
            await loadPlayerData();
        }

        // 🆕 正規化とトリム！💎✨
        name = name.trim().normalize('NFC');
        password = password.trim();

        // 名前の重複チェック（大文字小文字無視で可愛くチェック！💅）
        const nameExists = Object.values(persistentData).some(p => (p.name || '').trim().normalize('NFC').toLowerCase() === name.toLowerCase());
        if (nameExists) {
            safeEmit(socket, 'register_failed', 'その名前はもう誰かが使ってるおッ！諦めて！💔');
            return;
        }

        const token = `tk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        persistentData[token] = { 
            name, 
            password, // ⚠️ 本来はハッシュ化すべきだけど、今回は楽しさ優先で平文だお！💍
            score: 0, 
            xp: 0, 
            lv: 0 
        };
        await savePlayerData(token);
        console.log(`[REGISTER] New player: ${name} (Token: ${token})`);
        socket.emit('register_success', { token, name });
    });

    // 🆕 ログイン処理！💎✨
    socket.on('login', async (data) => {
        let { name, password } = data;
        if (!name || !password) {
            safeEmit(socket, 'login_failed', '名前とパスワードを入れてねッ！💍');
            return;
        }

        // 🆕 正規化とトリム！💎✨
        name = name.trim().normalize('NFC');
        password = password.trim();

        // 🆕 切断されてたら再接続を試みるおッ！！💖🚀
        if (MONGO_URI && mongoose.connection.readyState !== 1) {
            console.log('[DB-RETRY] Connection lost. Retrying... 🔄');
            await connectDB();
            await loadPlayerData(); // 再接続できたらデータも最新にするおッ！💎
        }

        console.log(`[LOGIN-TRY] Name: [${name}]`);

        const playerEntry = Object.entries(persistentData).find(([t, p]) => (p.name || '').trim().normalize('NFC').toLowerCase() === name.toLowerCase());
        if (!playerEntry) {
            const dbState = mongoose.connection.readyState;
            const count = Object.keys(persistentData).length;
            const samples = Object.values(persistentData).slice(0, 5).map(p => p.name).join(', ');
            
            console.warn(`[LOGIN-FAIL] Player not found: [${name}]. Memory count: ${count}, DB state: ${dbState}`);
            
            safeEmit(socket, 'login_failed', {
                msg: 'そんな子知らないおッ！はじめて？💅',
                debug: {
                    name,
                    memoryCount: count,
                    dbState: dbState === 1 ? 'CONNECTED' : `DISCONNECTED (${lastDBError || 'Unknown Error'})`,
                    samples: samples || 'NONE'
                }
            });
            return;
        }

        const [token, player] = playerEntry;
        if (player.password !== password) {
            safeEmit(socket, 'login_failed', 'パスワードが違うおッ！浮気した？💔');
            return;
        }

        console.log(`[LOGIN] Player logged in: ${name}`);
        socket.emit('login_success', { token, name, score: player.score, xp: player.xp, lv: player.lv });
    });

    // 🆕 ルーム一覧の取得（タイトル画面 or ルーム選択画面用）💅✨💍
    socket.on('get_rooms', () => {
        const roomData = Object.values(rooms).map(r => ({
            id: r.id,
            name: r.name,
            playerCount: r.players.length,
            gamePhase: r.gamePhase,
            hostName: r.hostName || '', // ホスト名
            comment: r.comment || '',   // コメント
            hasPassword: !!r.password   // パスワードの有無
        }));
        socket.emit('room_list', roomData);
    });

    // 🆕 指定したルームに参加！🚀✨💍
    socket.on('join_room', async (data) => {
        const { roomId, playerName, playerToken, password, roomComment } = data;
        const room = rooms[roomId];
        if (!room) {
            safeEmit(socket, 'error', 'ルームが見つからないよ🥺');
            return;
        }

        // 入室人数制限（最大4人ッ！💅）
        if (room.players.length >= room.maxPlayers) {
            safeEmit(socket, 'error', '満室だよ〜！他のルームを選んでね🥺');
            return;
        }

        // 誰もいないルームなら、最初に入った人がホストになって設定を決めるおッ！💎✨
        if (room.players.length === 0) {
            room.hostName = playerName;
            room.comment = (roomComment || '').substring(0, 8); // 8文字制限
            room.password = (password || '').substring(0, 4); // 4桁制限
        } else {
            // パスワードがかかってる場合のチェック🔒
            if (room.password && room.password !== password) {
                safeEmit(socket, 'join_failed', 'パスワードが違うよッ！🙅‍♀️');
                return;
            }
        }

        // トークンがあったら以前のデータを思い出してあげるよ！✨💍💅
        if (playerToken) {
            if (!persistentData[playerToken]) {
                persistentData[playerToken] = { name: playerName, score: 0, xp: 0, lv: 0 };
            } else {
                persistentData[playerToken].name = playerName; // 名前変更にも対応！✨
            }
            await savePlayerData(playerToken);
        }
        const saved = (playerToken && persistentData[playerToken]) ? persistentData[playerToken] : { score: 0, xp: 0, lv: 0 };
        
        // 既に同じトークンで入ってる子がいたらチェックするおッ！✨💍💅
        if (playerToken) {
            const existingPlayer = room.players.find(p => p.token === playerToken);
            if (existingPlayer) {
                if (existingPlayer.id === socket.id) {
                    // 同じソケットなら完全に再接続だから入れ替えるおッ！💅
                    const idx = room.players.indexOf(existingPlayer);
                    room.players.splice(idx, 1);
                } else {
                    // 🆕 ソケットIDが違うなら、別タブか何かで入ろうとしてるおッ！💎✨💍
                    // テストしやすくするために、名前をちょっと変えて共存させてあげるよッ！🤟💖
                    console.log(`[JOIN-MULTI] Same token [${playerToken}] but different socket. Allowing coexist for testing. ✨`);
                }
            }
        }

        let finalName = playerName || `Player ${room.players.length + 1}`;
        // 🆕 同名のプレイヤーがルームにいたら、(2)とか付けて区別するおッ！💎✨💍
        let dupCount = 1;
        const baseName = playerName || 'Player';
        while (room.players.some(p => p.name === finalName)) {
            dupCount++;
            finalName = `${baseName}(${dupCount})`;
        }

        const newPlayer = {
            id: socket.id,
            token: playerToken,
            name: finalName,
            score: 0,
            totalScore: saved.score || 0,
            xp: saved.xp || 0,
            lv: saved.lv || 0,
            hasGuessed: false,
            isReady: false,
            isNpc: false
        };

        room.players.push(newPlayer);
        socket.join(room.id);

        console.log(`[JOIN-ROOM] Room ${room.id}: ${name} joined (Host: ${room.hostName})`);

        socket.emit('join_success', { roomId: room.id, roomName: room.name });
        
        safeRoomEmit(room, 'update_players', room.players);
        safeEmit(socket, 'game_state', {
            phase: room.gamePhase,
            timeLeft: room.timeLeft,
            currentWord: (room.gamePhase === 'playing' ? (room.players[room.currentPlayerIndex]?.id === socket.id ? room.currentWordObj.display : '????') : '')
        });

        if (room.gamePhase === 'playing' && room.players[room.currentPlayerIndex]) {
            safeEmit(socket, 'drawer_update', room.players[room.currentPlayerIndex].id);
        }

        // ルーム一覧を更新（人数やホスト情報が変わったからねッ！💅）
        io.emit('room_list', Object.values(rooms).map(r => ({
            id: r.id,
            name: r.name,
            playerCount: r.players.length,
            gamePhase: r.gamePhase,
            hostName: r.hostName,
            comment: r.comment,
            hasPassword: !!r.password
        })));
    });

    socket.on('reset_player_data', async (targetToken) => {
        console.log(`[ADMIN-ACTION] Purifying (DELETING) player data for token: ${targetToken}`);
        if (!targetToken) return;
        
        // 1. 全ルームから対象プレイヤーを物理的に削除するおッ！😱💅
        for (const rid in rooms) {
            const room = rooms[rid];
            const initialCount = room.players.length;
            room.players = room.players.filter(p => p.token !== targetToken);
            
            if (room.players.length !== initialCount) {
                safeRoomEmit(room, 'update_players', room.players);
                io.emit('room_list', Object.values(rooms).map(r => ({ id: r.id, name: r.name, playerCount: r.players.length, gamePhase: r.gamePhase })));
            }
        }
        
        // 2. 永続化データから「魂」を消去ッ！！💀💍
        if (persistentData[targetToken]) {
            delete persistentData[targetToken];
            if (MONGO_URI && mongoose.connection.readyState === 1) {
                try { await Player.findOneAndDelete({ token: targetToken }); } catch(e) {}
            }
            await savePlayerData(); // JSONにも反映
        }
        
        io.emit('chat_message', { 
            sender: 'System', 
            text: `⚠️ プレイヤーの魂が「浄化（消滅）」されたよッ！南無三ッ！✨💀💍`, 
            color: '#ff3300' 
        });

        const allPlayers = Object.keys(persistentData).map(token => ({
            token,
            ...persistentData[token],
            isOnline: Object.values(rooms).some(r => r.players.some(p => p.token === token))
        }));
        socket.emit('open_admin_panel', allPlayers);
    });

    socket.on('modify_player_data', async (data) => {
        const { targetToken, xp, lv, score } = data;
        console.log(`[ADMIN-ACTION] Modifying player data for token: ${targetToken} -> XP:${xp}, LV:${lv}, Score:${score}`);
        if (!targetToken) return;

        // メモリ上のデータ更新
        for (const rid in rooms) {
            rooms[rid].players.forEach(p => {
                if (p.token === targetToken) {
                    if (xp !== undefined) p.xp = Number(xp);
                    if (lv !== undefined) p.lv = Number(lv);
                    if (score !== undefined) p.score = Number(score);
                }
            });
        }

        if (!persistentData[targetToken]) {
            persistentData[targetToken] = { name: 'Unknown', score: 0, xp: 0, lv: 0 };
        }
        if (xp !== undefined) persistentData[targetToken].xp = Number(xp);
        if (lv !== undefined) persistentData[targetToken].lv = Number(lv);
        if (score !== undefined) persistentData[targetToken].score = Number(score);
        
        await savePlayerData(targetToken);

        // 全ルームに通知するおッ！💅✨💍
        for (const rid in rooms) {
            const room = rooms[rid];
            if (room.players.some(p => p.token === targetToken)) {
                safeRoomEmit(room, 'update_players', room.players);
            }
        }

        io.emit('chat_message', { 
            sender: 'System', 
            text: `🛠️ プレイヤーデータが「神（管理者）」によって書き換えられたよッ！✨💍`, 
            color: '#ffcc00' 
        });

        // 管理者に最新の全プレイヤーリストを再送してUIを更新するおッ！💅✨💍
        const allPlayers = Object.keys(persistentData).map(token => ({
            token,
            ...persistentData[token],
            isOnline: Object.values(rooms).some(r => r.players.some(p => p.token === token))
        }));
        socket.emit('open_admin_panel', allPlayers);
    });

    socket.on('start_game', (settings) => {
        const room = getRoomBySocket(socket);
        if (!room || room.players.length < 1) return;

        console.log(`[START-MANUAL-ROOM] Room ${room.id} manual start! 🚀`);
        
        if (settings) {
            room.timeLimit = settings.timeLimit ?? 120;
            room.maxRounds = (settings.rounds !== undefined) ? settings.rounds : 3;
        }

        room.gamePhase = 'playing';
        room.currentRound = 1;
        room.turnsPlayedInRound = 0;
        room.currentPlayerIndex = -1;
        room.isLastTurnGlobal = false;

        room.players.forEach(p => {
            p.score = 0;
            p.isReady = false;
        });

        safeRoomEmit(room, 'game_start_imminent');
        if (room.nextTurnTimer) clearTimeout(room.nextTurnTimer);
        room.nextTurnTimer = setTimeout(() => {
            room.nextTurnTimer = null;
            startNextTurn(room);
        }, 1000);
    });

    socket.on('return_to_lobby', () => {
        const room = getRoomBySocket(socket);
        if (!room) return;
        
        room.gamePhase = 'waiting';
        room.players.forEach(p => {
            p.score = 0;
            p.isReady = false;
        });
        safeRoomEmit(room, 'update_players', room.players);
        safeRoomEmit(room, 'game_state', { phase: 'waiting', timeLeft: 0 });
    });

    socket.on('manual_turn_end', () => {
        const room = getRoomBySocket(socket);
        if (!room) return;
        
        const isDrawer = (room.players[room.currentPlayerIndex] && room.players[room.currentPlayerIndex].id === socket.id);
        const isSolo = (room.players.length === 1 && room.players[0].id === socket.id);
        
        if (room.gamePhase === 'playing' && (isDrawer || isSolo)) {
            const name = room.players[room.currentPlayerIndex] ? room.players[room.currentPlayerIndex].name : 'Unknown';
            safeRoomEmit(room, 'chat_message', { sender: 'System', text: `描き手の${name}さんがターンを終了させたよ！✨`, color: '#ff66b2' });
            endTurn(room);
        }
    });

    socket.on('draw', (data) => {
        const room = getRoomBySocket(socket);
        if (room) socket.to(room.id).emit('draw', data);
    });

    socket.on('fill', (data) => {
        const room = getRoomBySocket(socket);
        if (room) socket.to(room.id).emit('fill', data);
    });

    socket.on('sync_canvas', (dataURL) => {
        const room = getRoomBySocket(socket);
        if (room) socket.to(room.id).emit('sync_canvas', dataURL);
    });

    socket.on('clear_canvas', () => {
        const room = getRoomBySocket(socket);
        if (room) safeRoomEmit(room, 'clear_canvas');
    });

    socket.on('send_message', async (msg) => {
        const room = getRoomBySocket(socket);
        if (!room) return;

        const trimmedMsg = msg.trim();
        if (trimmedMsg === '/kill') {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                const allPlayers = Object.keys(persistentData).map(token => ({
                    token,
                    ...persistentData[token],
                    isOnline: Object.values(rooms).some(r => r.players.some(p => p.token === token))
                }));
                safeEmit(socket, 'open_admin_panel', allPlayers);
            }
            return;
        }

        if (trimmedMsg === '/ban') {
            socket.emit('redirect', '/ban.html');
            return;
        }

        if (trimmedMsg === '/list') {
            const listMsg = "💋 秘密のメニューだよ 💋<br>🔹 /pt0 : スコアを0にする💅<br>🔹 /npc : ギャル友召喚💖<br>🔹 /kill : 管理パネル🔞<br>🔹 /list : メニュー表示✨";
            socket.emit('chat_message', { sender: 'System', text: listMsg, color: '#ff66b2' });
            return;
        }

        if (trimmedMsg === '/npc') {
            if (room.players.length >= room.maxPlayers) {
                socket.emit('chat_message', { sender: 'System', text: '満室だよ🥺', color: '#ff66b2' });
                return;
            }
            const npcName = npcNames[Math.floor(Math.random() * npcNames.length)];
            const npcId = 'npc_' + Math.random().toString(36).substr(2, 9);
            const npcToken = 'token_npc_' + npcId;

            room.players.push({
                id: npcId, token: npcToken, name: npcName, score: 0, hasGuessed: false, isReady: true, isNpc: true
            });
            safeRoomEmit(room, 'update_players', room.players);
            safeRoomEmit(room, 'chat_message', { sender: 'System', text: `${npcName}が遊びに来たよ！💖✨`, color: '#ff66b2' });
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        if (trimmedMsg === '/pt0') {
            player.score = 0;
            safeRoomEmit(room, 'update_players', room.players);
            return;
        }

        await handleChatMessage(room, player, msg, socket);
    });

    socket.on('toggle_ready', (settings) => {
        const room = getRoomBySocket(socket);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || (room.gamePhase !== 'waiting' && room.gamePhase !== 'between_turns')) return;

        player.isReady = !player.isReady;
        safeRoomEmit(room, 'update_players', room.players);
        checkReadiness(room, settings, socket.id);
    });

    socket.on('leave_room', () => {
        handlePlayerLeaveRoom(socket);
    });

    socket.on('disconnect', () => {
        handlePlayerLeaveRoom(socket);
    });

    function handlePlayerLeaveRoom(socket) {
        const room = getRoomBySocket(socket);
        if (!room) return;

        const index = room.players.findIndex(p => p.id === socket.id);
        if (index === -1) return;

        const p = room.players[index];
        console.log(`[LEAVE-ROOM] ${p.name} left room ${room.id}.`);
        room.players.splice(index, 1);
        
        // Socket.ioのレコメンデーションに従ってルームから退出ッ！🚪✨
        socket.leave(room.id);

        const humanPlayers = room.players.filter(p => !p.isNpc);
        if (humanPlayers.length === 0) {
            // NPCの後始末
            room.players.forEach(p_npc => {
                if (p_npc.isNpc && room.npcTimers[p_npc.id]) {
                    room.npcTimers[p_npc.id].forEach(t => {
                        if (t.type === 'interval') clearInterval(t.timer);
                        else clearTimeout(t.timer);
                    });
                }
            });
            room.players = [];
            room.npcTimers = {};
            room.gamePhase = 'waiting';
            room.hostName = ''; // ホスト情報リセット💅
            room.comment = '';  // コメントリセット✨
            room.password = ''; // パスワードリセット🔒
            if (room.roundTimer) clearInterval(room.roundTimer);
        } else {
            if (index < room.currentPlayerIndex) {
                room.currentPlayerIndex--;
            } else if (index === room.currentPlayerIndex) {
                room.currentPlayerIndex--;
                if (room.gamePhase === 'playing') {
                    safeRoomEmit(room, 'chat_message', { sender: 'System', text: '描き手がいなくなっちゃったから、次のターンに行くねッ！🥺', color: '#ff66b2' });
                    endTurn(room);
                }
            }
        }

        safeRoomEmit(room, 'update_players', room.players);
        // ルーム一覧を更新（人数が変わったからねッ！💅）
        io.emit('room_list', Object.values(rooms).map(r => ({ id: r.id, name: r.name, playerCount: r.players.length, gamePhase: r.gamePhase })));
    }





    // チャットメッセージ処理を関数化してNPCも使えるようにする💅
});

// 🚀 すべての準備が整ってから起動ッ！！💎✨💍🤟
initApp();
