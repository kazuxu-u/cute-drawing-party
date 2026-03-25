const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const https = require('https');
const fs = require('fs');

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

// 保存用ディレクトリがなければ作成
if (!fs.existsSync(DRAWINGS_DIR)) {
    fs.mkdirSync(DRAWINGS_DIR, { recursive: true });
}

// メタデータファイルの初期化
if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify([]));
}

const PORT = process.env.PORT || 3000;

// ギャラリーの画像がちゃんと読み込まれてるかチェックするためのログ！💍✨
app.use('/drawings', (req, res, next) => {
    console.log(`[IMG-REQ] Request for image: ${req.url}`);
    next();
});

// 静的ディレクトリのマッピングを強化！💍✨
app.use('/drawings', express.static(DRAWINGS_DIR));

// ソロモード用にお題リストを全部返すよ！💎✨💍
// cuteWordsは下の方で定義されてるけど、function宣言じゃないから
// ここで呼ぶとエラーになる可能性があるため、もっと下に移動するね！💅✨
// ...と思ったけど、安全のためにapp.listenの直前に書くのが一番確実かも！💍✨

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({limit: '10mb'})); // 🎉 グローバルに設定！

// 画像保存 API (ミドルウェアはグローバルに移したよ✨)
app.post('/api/save_drawing', (req, res) => {
    const { image, artist, prompt } = req.body;
    if (!image || !artist || !prompt) return res.status(400).json({ error: 'Missing data' });

    const filename = `drawing_${Date.now()}.png`;
    const filePath = path.join(DRAWINGS_DIR, filename);

    // Base64を保存
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) return res.status(500).json({ error: 'Save failed' });

        // メタデータ更新（エラーハンドリング強化！）💎✨
        let metadata = [];
        try {
            if (fs.existsSync(METADATA_FILE)) {
                const content = fs.readFileSync(METADATA_FILE, 'utf8');
                metadata = JSON.parse(content || '[]');
            }
        } catch (e) {
            console.error(`[METADATA-ERR] Failed to read/parse metadata: ${e}`);
            metadata = []; // 壊れてたらリセットしちゃうッ！💅
        }
        metadata.push({ filename, artist, prompt, timestamp: Date.now() });

        // 1000枚制限
        if (metadata.length > 1000) {
            const oldest = metadata.shift();
            const oldestPath = path.join(DRAWINGS_DIR, oldest.filename);
            if (fs.existsSync(oldestPath)) {
                try { fs.unlinkSync(oldestPath); } catch (e) {}
            }
        }

        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
        console.log(`[SAVE] Drawing saved by ${artist} (Prompt: ${prompt}) -> ${filename}`);
        res.json({ success: true, filename });
    });
});

// 画像検索プロキシ (ローカル保存された絵を検索)
app.get('/api/search', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE));
        
        // お題（部分一致）で検索
        const filtered = metadata.filter(m => 
            m.prompt.toLowerCase().includes(query.toLowerCase())
        );

        const results = filtered.map(m => ({
            id: m.filename,
            title: `${m.prompt} (by ${m.artist})`,
            thumbnail: `/drawings/${m.filename}`,
            url: `/drawings/${m.filename}`
        })).reverse();

        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: 'Failed to search drawings' });
    }
});

// ギャラリー全取得 API
app.get('/api/gallery', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE));
        const results = metadata.map(m => ({
            id: m.filename,
            title: `${m.prompt} (by ${m.artist})`,
            thumbnail: `/drawings/${m.filename}`,
            url: `/drawings/${m.filename}`,
            artist: m.artist,
            prompt: m.prompt,
            timestamp: m.timestamp
        })).reverse();
        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});

// 画像削除 API (BAN用) 💅✨ (ミドルウェアはグローバルに移したよ💍)
app.post('/api/delete_drawing', (req, res) => {
    const { filename } = req.body;
    console.log(`[BAN-REQ] Deleting drawing: ${filename}`); // ログ追加！✨
    
    if (!filename) {
        console.error('[BAN-ERROR] Missing filename in request body');
        return res.status(400).json({ error: 'Missing filename' });
    }

    const filePath = path.join(DRAWINGS_DIR, filename);
    console.log(`[BAN-PATH] Target file: ${filePath}`);
    
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[BAN-FILE] Successfully deleted from disk: ${filename}`);
        } else {
            console.warn(`[BAN-WARN] File not found on disk: ${filename}`);
        }
        
        // メタデータからも消すよ！💍
        if (fs.existsSync(METADATA_FILE)) {
            let metadata = JSON.parse(fs.readFileSync(METADATA_FILE));
            const initialCount = metadata.length;
            metadata = metadata.filter(m => m.filename !== filename);
            
            if (metadata.length < initialCount) {
                fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
                console.log(`[BAN-META] Removed from metadata: ${filename}`);
            } else {
                console.warn(`[BAN-META] Not found in metadata: ${filename}`);
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error(`[BAN-FAIL] Error during deletion: ${e.message}`);
        res.status(500).json({ error: 'Delete failed' });
    }
});

let players = [];
let maxPlayers = 4;
let currentPlayerIndex = -1;
let currentWordObj = null;
let currentWordList = []; // 選ばれたカテゴリー用リスト
let isLastTurnGlobal = false; // 🆕 最後のターンかどうかをグローバルに持つよ！💍
let gamePhase = 'waiting'; // waiting, playing, between_turns, results
let roundTimer = null;
let timeLeft = 120;
let timeLimit = 120;
let pointsAwardedThisTurn = false;
let nextTurnTimer = null; // 🆕 ターン遷移タイマーを管理ッ！💅
let isStartingNextTurn = false;
let isSyncingCanvas = false; // 🆕 キャンバス同期中フラグ

// トークンごとの得点記録メモ📝💅
let persistentScores = {}; 

// NPC関連の管理用
let npcTimers = {}; // { playerId: [timeoutId, ...] }
const npcNames = ['AIギャル💖れいな', 'AIギャル💅ゆき', 'AIギャル👗みく', 'AIギャル💍なな'];

// ターン（周）の管理
let currentRound = 1;
let maxRounds = 3;
let turnsPlayedInRound = 0;

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
        { display: '👙手ブラ', answers: ['てぶら', 'おっぱい'] }
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

function checkReadiness(settings, socketId) {
    if (gamePhase !== 'waiting' && gamePhase !== 'between_turns') return;
    if (isLastTurnGlobal) return;

    // NPC以外のプレイヤーを取得
    const humans = players.filter(p => p && !p.isNpc);
    if (humans.length === 0) return;

    // --- 👑 設定権限チェック！ホスト(最初の人間)の設定を常に反映させるよ💅 ---
    const host = humans[0];
    if (settings && socketId === host.id) {
        let changed = false;
        if (settings.timeLimit !== undefined && timeLimit !== settings.timeLimit) {
            timeLimit = settings.timeLimit;
            changed = true;
        }
        if (settings.rounds !== undefined && maxRounds !== settings.rounds) {
            maxRounds = settings.rounds;
            changed = true;
        }
        if (settings.category && currentWordList !== (cuteWords[settings.category] || cuteWords.mix)) {
            currentWordList = cuteWords[settings.category] || cuteWords.mix;
            changed = true;
        }
        
        if (changed) {
            console.log(`[SETTINGS-SYNC] Host ${host.name} updated settings: Rounds=${maxRounds}, Time=${timeLimit}s ✨`);
            // ホストの設定が変わったことをみんなにこっそり教える？（うるさいからログだけでいいかも💅）
        }
    }

    const allReady = humans.every(p => p && p.isReady);
    console.log(`[READY-CHECK] Total humans: ${humans.length}, Ready: ${humans.filter(p => p && p.isReady).length}, AllReady: ${allReady}`);
    
    if (allReady) {
        if (gamePhase === 'waiting') {
            console.log(`[START] Starting game with settings: Rounds=${maxRounds}, Time=${timeLimit}s 🚀`);
            gamePhase = 'playing';
            
            currentRound = 1;
            turnsPlayedInRound = 0;
            currentPlayerIndex = -1;
            isLastTurnGlobal = false;

            players.forEach(p => {
                p.score = 0;
                p.isReady = false;
            });
            
            safeIoEmit('game_start_imminent');
            setTimeout(() => {
                // 1秒後のチェック：フェーズが変わってたり人数が減ってたら中止💅
                if (gamePhase !== 'playing' || players.length === 0) return;
                startNextTurn();
            }, 1000);
        } else if (gamePhase === 'between_turns') {
            gamePhase = 'playing';
            
            players.forEach(p => {
                if (p) p.isReady = false;
            });
            
            startNextTurn();
        }
    }
}

function startNextTurn() {
    try {
        if (players.length === 0) {
            console.log('[WARN] No players left to start next turn');
            isStartingNextTurn = false;
            return;
        }
        if (isStartingNextTurn) {
            console.log('[WARN] startNextTurn called while already starting. Ignoring.');
            return;
        }
        
        // 周回の整合性チェック 💅
        if (turnsPlayedInRound >= players.length || currentPlayerIndex === -1) {
            if (currentPlayerIndex !== -1) {
                currentRound++;
                turnsPlayedInRound = 0;
                console.log(`[ROUND-INC] All human/NPC players finished. Now Round ${currentRound}`);
            } else {
                console.log(`[ROUND-START] Game starting at Round 1`);
            }
        }

        // 指定周回数を超えてたら強制終了ッ！ 🏁
        if (maxRounds > 0 && currentRound > maxRounds) {
            console.log(`[GAME-END] Max rounds reached (${maxRounds}). currentRound is ${currentRound}. Ending.`);
            endGame();
            return;
        }

        isStartingNextTurn = true;
        turnsPlayedInRound++;
        gamePhase = 'playing';
        players.forEach(p => { if (p) p.hasGuessed = false; });

        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        const drawer = players[currentPlayerIndex];

        if (!drawer) {
            console.error('[CRITICAL] No drawer found at index', currentPlayerIndex);
            isStartingNextTurn = false;
            return;
        }
        
        // お題リストの最終防衛ライン 🛡️
        if (!currentWordList || currentWordList.length === 0) {
            currentWordList = cuteWords.mix;
        }
        currentWordObj = currentWordList[Math.floor(Math.random() * currentWordList.length)];
        if (!currentWordObj) {
            currentWordObj = { display: '失敗', answers: ['しっぱい'] };
        }
        
        console.log(`[TURN-START] Round: ${currentRound}/${maxRounds}, Turn: ${turnsPlayedInRound}/${players.length}, Drawer: ${drawer.name}`);

        timeLeft = timeLimit;
        pointsAwardedThisTurn = false;

        safeIoEmit('clear_canvas');
        safeIoEmit('update_players', players);

        const roundInfoTxt = (maxRounds === 0) 
            ? `${currentRound}周目 (∞)` 
            : `${currentRound}周目 (${turnsPlayedInRound}/${players.length})`;

        safeEmit(io.to(drawer.id), 'round_start', {
            word: currentWordObj.display,
            timeLimit,
            isDrawer: true,
            roundInfo: roundInfoTxt
        });

        players.forEach(p => {
            if (p && p.id !== drawer.id) {
                safeEmit(io.to(p.id), 'round_start', {
                    word: '????',
                    timeLimit,
                    isDrawer: false,
                    drawerName: drawer.name,
                    roundInfo: roundInfoTxt
                });
            }
        });

        players.forEach(p => {
            if (p && p.isNpc) handleNpcAction(p);
        });

        if (roundTimer) clearInterval(roundTimer);
        safeIoEmit('timer', timeLeft);

        roundTimer = setInterval(() => {
            if (timeLimit > 0) {
                timeLeft--;
                safeIoEmit('timer', timeLeft);
                if (timeLeft <= 0) {
                    clearInterval(roundTimer);
                    endTurn();
                }
            } else {
                safeIoEmit('timer', '∞');
            }
        }, 1000);

        if (nextTurnTimer) {
            clearTimeout(nextTurnTimer);
            nextTurnTimer = null;
        }
    } catch (e) {
        console.error(`[END-TURN-ERR] ${e}`);
        isStartingNextTurn = false; // エラーでもロック解除
    }
}

function endTurn() {
    try {
        if (roundTimer) clearInterval(roundTimer);
        gamePhase = 'between_turns';

        players.forEach(p => {
            if (p && p.isNpc && npcTimers[p.id]) {
                npcTimers[p.id].forEach(t => {
                    if (t.type === 'interval') clearInterval(t.timer);
                    else clearTimeout(t.timer);
                });
                npcTimers[p.id] = [];
            }
        });

        let isLastTurn = false;
        if (maxRounds > 0 && currentRound >= maxRounds && turnsPlayedInRound >= players.length) {
            isLastTurn = true;
            isLastTurnGlobal = true;
        }

        const nextMsg = isLastTurn ? "結果発表にいくよ〜！🏆" : "全員が「準備オッケー！」したら次に行くよっ！💖💅✨";
        const wordDisplay = currentWordObj ? currentWordObj.display : '????';
        
        safeIoEmit('chat_message', { sender: 'System', text: `時間終了〜！正解は「${wordDisplay}」でした！✨ ${nextMsg}`, color: '#ff66b2', type: 'finish' });

        const drawer = players[currentPlayerIndex];
        const drawerName = drawer ? drawer.name : 'Unknown';
        
        safeIoEmit('round_end', { players, word: wordDisplay, drawer: drawerName });
        safeIoEmit('game_state', { phase: 'between_turns', timeLeft: 0, isLastTurn: isLastTurn });

        if (isLastTurn) {
            setTimeout(() => {
                if (gamePhase === 'between_turns') endGame();
            }, 5000);
        }
    } catch (err) {
        console.error(`[ERR] Error in endTurn: ${err.stack}`);
    }
}

function endGame() {
    try {
        gamePhase = 'results';
        isLastTurnGlobal = false;
        // 点数順にソート（nullチェック付き）💍
        const sortedPlayers = [...players]
            .filter(p => p !== null)
            .sort((a, b) => (b.score || 0) - (a.score || 0));
        safeIoEmit('game_over', sortedPlayers);
        console.log('[GAME-OVER] Results emitted.');
    } catch (err) {
        console.error(`[ERR] Error in endGame: ${err.stack}`);
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
    else if (w.match(/桃|ピンク|🍑|🌸|💍|👙|💄/)) color = '#ff66b2';
    else if (w.match(/白|雪|歯|🥛|雲|🦷|🍚/)) color = '#ffffff';
    else if (w.match(/黒|髪|影|💣|🕶️|🕷️|🎱/)) color = '#333333';
    else if (w.match(/銀|金|塔|機械|🏢|🗼|⌚|🥄|🩶|💛|🏠|🎁/)) color = '#aaaaaa';

    if (w.match(/いぬ|ねこ|パンダ|クマ|ウサギ|ペンギン|動物|🐕|🐈|🐻|🦄|🦒/)) category = 'animal';
    else if (w.match(/ハンバーガー|ピザ|ラーメン|プリン|寿司|食べ物|🍎|🍔|🍣/)) category = 'food';
    else if (w.match(/車|くるま|飛行機|電車|のりもの|🚗|✈️|🚄/)) category = 'vehicle';
    else if (w.match(/塔|ビル|家|建物|ピラミッド|🗼|🏠|🏢/)) category = 'landmark';
    else if (w.match(/唇|エッチ|セクシー|ヤバい|💋|🔞|👙/)) category = 'yabai';

    if (w.match(/りんご|ボール|太陽|顔|まる|円|地球|メロン|天/)) pattern = 'spiral';
    else if (w.match(/塔|木|人|縦|ビル|エッフェル/)) pattern = 'vertical';
    else if (w.match(/海|道|波|横|ベッド/)) pattern = 'horizontal';
    
    const offsetX = (hash % 150) - 75;
    const offsetY = (hash % 100) - 50;

    return { color, pattern, offsetX, offsetY, hash, category };
}

function handleNpcAction(npc) {
    if (!npcTimers[npc.id]) npcTimers[npc.id] = [];
    npcTimers[npc.id].forEach(t => {
        if (t.type === 'interval') clearInterval(t.timer);
        else clearTimeout(t.timer);
    });
    npcTimers[npc.id] = [];

    const isDrawer = (players[currentPlayerIndex]?.id === npc.id);

    if (isDrawer) {
        if (!currentWordObj) {
            console.error('[NPC-ERR] No currentWordObj found for drawer NPC');
            return;
        }
        const strategy = getNpcDrawingStrategy(currentWordObj.display);
        const getNpcComment = (word) => {
            const w = word.toLowerCase();
            if (w.match(/🍎|🍓|🍔|🍣|たべもの/)) return [`${word}、おいしそうに描くね！😋💖`, `お腹空いてきちゃった～ｗ🍴✨`];
            if (w.match(/🐶|🐱|くま|どうぶつ/)) return [`${word}、かわいく描けるかな～？🐾💍`, `モフモフ感出すのがポイントだよ！✨`];
            if (w.match(/🚗|飛行機|のりもの/)) return [`${word}、かっこよく描いちゃうよ！💨🚀`, `スピード感出してきた～！✨`];
            if (w.match(/唇|セクシー|ヤバい/)) return [`ちょっとエッチすぎ？ｗ🔞💖`, `これ描くの恥ずかしいんだけど～！🫣✨`];
            return [
                `${word}、描くのムズすぎない？ｗ✨`,
                `この辺のラインがポイントだよ💖💍`,
                `筆が乗ってきた～！🎨💎🚀`,
                `見て、可愛くなってきてない？💅💎`,
                `ギャルの本気見せちゃうよ💍✨💅`
            ];
        };

        const comments = getNpcComment(currentWordObj.display);
        const commentInterval = setInterval(() => {
            if (gamePhase !== 'playing') { clearInterval(commentInterval); return; }
            safeIoEmit('chat_message', { sender: npc.name, text: comments[Math.floor(Math.random() * comments.length)], color: '#333' });
        }, 5000 + Math.random() * 4000);
        npcTimers[npc.id].push({ timer: commentInterval, type: 'interval' });

        let step = 0;
        let lastX = 0, lastY = 0;
        const drawInterval = setInterval(() => {
            if (gamePhase !== 'playing') { clearInterval(drawInterval); return; }
            
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

            safeIoEmit('draw', { x0, y0, x1, y1, color: strategy.color, size: 8 + Math.random() * 8, isEraser: false, isGlow: true, isRainbow: (strategy.category === 'yabai' && Math.random() > 0.8) });

            if (step === 10) safeIoEmit('chat_message', { sender: npc.name, text: 'まずは大体の形から描くね！✨', color: '#333' });
            else if (step === 60 && (c === 'animal' || c === 'vehicle')) safeIoEmit('chat_message', { sender: npc.name, text: (c === 'animal' ? '次はこれ、耳だよ！🐾' : 'タイヤも付けちゃうよ！🚗'), color: '#333' });
            else if (step === 90) safeIoEmit('chat_message', { sender: npc.name, text: '仕上げに細かく描いていくよ💖💍', color: '#333' });

            lastX = x1; lastY = y1; step++;
        }, 80);
        npcTimers[npc.id].push({ timer: drawInterval, type: 'interval' });

        const finishTimeout = setTimeout(() => {
            clearInterval(drawInterval);
            clearInterval(commentInterval);
            if (gamePhase === 'playing' && players[currentPlayerIndex]?.id === npc.id) {
                safeIoEmit('chat_message', { sender: npc.name, text: 'できた！可愛くない？💖✨💍', color: '#ff66b2' });
                endTurn();
            }
        }, 12000 + Math.random() * 8000);
        npcTimers[npc.id].push({ timer: finishTimeout, type: 'timeout' });
    } else {
        const delay = (20 + Math.random() * 40) * 1000;
        const guessTimeout = setTimeout(() => {
            if (gamePhase !== 'playing' || npc.hasGuessed) return;
            const answer = currentWordObj.answers[0];
            const prefix = ['', 'え、これ', 'もしかして', 'わかった！', 'んー、', 'これ', '絶対'];
            const suffix = ['', 'じゃない？ｗ', 'かも！💖', 'だと思う！✨', 'だよ💅', 'だよね💍'];
            const text = prefix[Math.floor(Math.random() * prefix.length)] + answer + suffix[Math.floor(Math.random() * suffix.length)];
            handleChatMessage(npc, text);
        }, delay);
        npcTimers[npc.id].push({ timer: guessTimeout, type: 'timeout' });
    }
}

function handleChatMessage(player, msg) {
    if (gamePhase === 'playing') {
        const isDrawer = players[currentPlayerIndex]?.id === player.id;
        let isCorrect = false;
        let isAlmost = false;

        const cleanInput = msg.trim().toLowerCase().replace(/[\s　]/g, '');
        const normalizedInput = kanaToHira(cleanInput);

        if (!isDrawer && !player.hasGuessed && currentWordObj) {
            for (let ans of currentWordObj.answers) {
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
            if (!pointsAwardedThisTurn) {
                pointsAwardedThisTurn = true;
                player.score += 1;
                if (player.token) persistentScores[player.token] = player.score;
                if (players[currentPlayerIndex]) {
                    players[currentPlayerIndex].score += 1;
                    const drawerToken = players[currentPlayerIndex].token;
                    if (drawerToken) persistentScores[drawerToken] = players[currentPlayerIndex].score;
                }
                safeIoEmit('chat_message', { sender: 'System', text: `やば！${player.name}さんが1番乗りで大正解！🎉✨（回答者+1pt / 出題者+1pt）`, color: '#ff66b2', type: 'correct' });
            } else {
                safeIoEmit('chat_message', { sender: 'System', text: `${player.name}さんも正解！👏（ポイントは最初の人だけだよ！）`, color: '#ff66b2', type: 'correct' });
            }
            safeIoEmit('update_players', players);
            if (player.isNpc) safeIoEmit('chat_message', { sender: player.name, text: msg, color: '#333' });
        } else if (isAlmost && !isCorrect && !isDrawer && !player.hasGuessed) {
            if (!player.isNpc) safeEmit(io.to(player.id), 'chat_message', { sender: 'System', text: `「${msg}」…惜しい！あとちょっと！🥺`, color: '#ff9900', type: 'oshii' });
            safeIoEmit('chat_message', { sender: player.name, text: msg, color: '#333' });
        } else {
            safeIoEmit('chat_message', { sender: player.name, text: msg, color: '#333' });
        }
    } else {
        safeIoEmit('chat_message', { sender: player.name, text: msg, color: '#333' });
    }
}

io.on('connection', (socket) => {
    socket.on('join_game', (playerName, playerToken) => {
        if (players.length >= maxPlayers) {
            safeEmit(socket, 'error', '満室だよ〜！ごめんね🥺');
            return;
        }

        // トークンがあったら以前の得点を思い出してあげるよ！✨💍💅
        const savedScore = (playerToken && persistentScores[playerToken]) ? persistentScores[playerToken] : 0;
        const name = playerName || `Player ${players.length + 1}`;

        players.push({
            id: socket.id,
            token: playerToken,
            name: name,
            score: savedScore,
            hasGuessed: false,
            isReady: false, // 🆕 準備中モード追加！
            isNpc: false
        });

        console.log(`[JOIN] ${name} joined with token ${playerToken} (Score: ${savedScore})`);

        safeIoEmit('update_players', players);
        safeEmit(socket, 'game_state', {
            phase: gamePhase,
            timeLeft,
            currentWord: (gamePhase === 'playing' ? (players[currentPlayerIndex]?.id === socket.id ? currentWordObj.display : '????') : '')
        });

        if (gamePhase === 'playing' && players[currentPlayerIndex]) {
            safeIoEmit('drawer_update', players[currentPlayerIndex].id);
        }
    });

    socket.on('start_game', (settings) => {
        if (players.length < 1) return;

        console.log(`[START-LEGACY] Host clicked start button! 🚀`);
        gamePhase = 'playing';

        if (settings) {
            timeLimit = settings.timeLimit ?? 120;
            maxRounds = (settings.rounds !== undefined) ? settings.rounds : 3;
            if (settings.category) {
                currentWordList = cuteWords[settings.category] || cuteWords.mix;
            }
        }

        currentRound = 1;
        turnsPlayedInRound = 0;
        currentPlayerIndex = -1;
        isLastTurnGlobal = false;

        players.forEach(p => {
            p.score = 0;
            p.isReady = false;
        });

        safeIoEmit('game_start_imminent');
        if (nextTurnTimer) clearTimeout(nextTurnTimer);
        nextTurnTimer = setTimeout(() => {
            nextTurnTimer = null;
            startNextTurn();
        }, 1000);
    });

    socket.on('return_to_lobby', () => {
        gamePhase = 'waiting';
        players.forEach(p => {
            p.score = 0;
            p.isReady = false; // ロビーに戻ったらリセット！✨
        });
        safeIoEmit('update_players', players);
        safeIoEmit('game_state', { phase: 'waiting', timeLeft: 0 });
    });

    socket.on('manual_turn_end', () => {
        if (gamePhase === 'playing' && players[currentPlayerIndex]?.id === socket.id) {
            safeIoEmit('chat_message', { sender: 'System', text: `描き手の${players[currentPlayerIndex].name}さんがターンを終了させたよ！✨`, color: '#ff66b2' });
            endTurn();
        }
    });

    socket.on('draw', (data) => {
        try { socket.broadcast.emit('draw', data); } catch(e) {}
    });

    socket.on('fill', (data) => {
        try { socket.broadcast.emit('fill', data); } catch(e) {}
    });

    socket.on('sync_canvas', (dataURL) => {
        try { socket.broadcast.emit('sync_canvas', dataURL); } catch(e) {}
    });

    socket.on('clear_canvas', () => {
        safeIoEmit('clear_canvas');
    });

    socket.on('send_message', (msg) => {
        // --- 🧹 BANページへの誘導 (/ban) ---
        if (msg.trim() === '/ban') {
            socket.emit('redirect', '/ban.html');
            socket.emit('chat_message', { sender: 'System', text: '💅 BANページにジャンプするよ！お掃除よろしくねッ！💖', color: '#ff66b2' });
            return;
        }

        // --- 📜 コマンド一覧 (/list) ---
        if (msg.trim() === '/list') {
            const listMsg = "💋 秘密のメニューだよ 💋<br>" +
                           "--------------------------<br>" +
                           "🔹 /pt0 : 自分のポイントを0にするよ🤫<br>" +
                           "🔹 /npc : AIギャル友を召喚するよ💖💅<br>" +
                           "🔹 /list : この一覧を表示するよ✨💍";
            socket.emit('chat_message', { sender: 'System', text: listMsg, color: '#ff66b2' });
            return;
        }

        // --- 👱‍♀️ NPC召喚 (/npc) ---
        if (msg.trim() === '/npc') {
            if (players.length >= maxPlayers) {
                socket.emit('chat_message', { sender: 'System', text: '満室でギャル友呼べないよ🥺ごめんね！', color: '#ff66b2' });
                return;
            }
            const npcName = npcNames[Math.floor(Math.random() * npcNames.length)];
            const npcId = 'npc_' + Math.random().toString(36).substr(2, 9);
            const npcToken = 'token_npc_' + npcId;

            players.push({
                id: npcId,
                token: npcToken,
                name: npcName,
                score: 0,
                hasGuessed: false,
                isReady: true, // NPCはいつでもオッケーっしょ！💅✨💍
                isNpc: true
            });
            safeIoEmit('update_players', players);
            safeIoEmit('chat_message', { sender: 'System', text: `${npcName}が遊びに来たよ！💖✨`, color: '#ff66b2' });
            return;
        }

        const player = players.find(p => p.id === socket.id);
        if (!player) return;

        // --- 🤫 隠しコマンド！ (/pt0) ---
        if (msg.trim() === '/pt0') {
            player.score = 0;
            if (player.token) persistentScores[player.token] = 0;
            safeIoEmit('update_players', players);
            safeEmit(socket, 'chat_message', { sender: 'System', text: '🤫 ポイントをリセットしたよ✨', color: '#ff66b2' });
            return;
        }

        handleChatMessage(player, msg);
    });

    // 🆕 「準備オッケー！」のトグル処理 ✨💍💖
    socket.on('toggle_ready', (settings) => {
        const player = players.find(p => p.id === socket.id);
        if (!player || (gamePhase !== 'waiting' && gamePhase !== 'between_turns')) {
            console.log(`[READY-REJECT] ${player?.name || 'Unknown'} tried to toggle ready but gamePhase is ${gamePhase}`);
            return;
        }

        player.isReady = !player.isReady;
        console.log(`[READY-TOGGLE] ${player.name} is now ${player.isReady ? 'READY! 💖' : 'not ready... 🥺'} (Phase: ${gamePhase})`);
        
        safeIoEmit('update_players', players);

        // 全員準備オッケーならスタート！🚀✨（待機中 or ターン間）
        checkReadiness(settings, socket.id);
    });


    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        
        // 人間が一人もいなくなったらNPCも全員消去するよ！💎💅✨
        const humanPlayers = players.filter(p => !p.isNpc);
        if (humanPlayers.length === 0) {
            // NPCのタイマーを全部掃除💍
            players.forEach(p => {
                if (p.isNpc && npcTimers[p.id]) {
                    npcTimers[p.id].forEach(t => {
                        if (t.type === 'interval') clearInterval(t.timer);
                        else clearTimeout(t.timer);
                    });
                }
            });
            players = [];
            npcTimers = {};
            gamePhase = 'waiting';
            if (roundTimer) clearInterval(roundTimer);
        }

        safeIoEmit('update_players', players);

        if (gamePhase === 'playing' && (currentPlayerIndex >= players.length || (players[currentPlayerIndex] && players[currentPlayerIndex].id === socket.id))) {
            endTurn();
        }
    });





    // チャットメッセージ処理を関数化してNPCも使えるようにする💅
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
