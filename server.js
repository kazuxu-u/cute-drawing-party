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
let timeLeft = 120;
let timeLimit = 120;

// ターン（周）の管理
let currentRound = 1;
let maxRounds = 3;
let turnsPlayedInRound = 0;
let currentWordList = []; // 選ばれたカテゴリー用リスト

const cuteWords = {
    mix: [], // 後でぜんぶまとめる用
    animal: [
        { display: '🐼パンダ', answers: ['ぱんだ', 'パンダ', 'panda'] },
        { display: '🐈ねこ', answers: ['ねこ', 'ネコ', '猫', 'にゃんこ', 'cat'] },
        { display: '🐕いぬ', answers: ['いぬ', 'イヌ', '犬', 'わんこ', 'dog'] },
        { display: '🐰うさぎ', answers: ['うさぎ', 'ウサギ', '兎', 'rabbit'] },
        { display: '🐧ぺんぎん', answers: ['ぺんぎん', 'ペンギン', 'penguin'] },
        { display: '🐘ゾウ', answers: ['ぞう', 'ゾウ', '象', 'elephant'] },
        { display: '🦒きりん', answers: ['きりん', 'キリン', 'giraffe'] },
        { display: '🦁らいおん', answers: ['らいおん', 'ライオン', 'lion'] },
        { display: '🐒ごりら...じゃなくて猿', answers: ['さる', 'サル', '猿', 'さるやま', 'monkey', 'ごりら', 'ゴリラ', 'gorilla'] },
        { display: '🦊きつね', answers: ['きつね', 'キツネ', '狐', 'fox'] },
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
        { display: '💩うんこ（笑）', answers: ['うんこ', 'ウンコ', 'うんち', 'ウンチ', 'poop'] },
        { display: '🍌バナナ（意味深）', answers: ['ばなな', 'バナナ', 'banana', '🍌'] },
        { display: '🍒さくらんぼ（意味深）', answers: ['さくらんぼ', 'サクランボ', 'ちぇりー', 'チェリー', 'cherry'] },
        { display: '🍄きのこ（意味深）', answers: ['きのこ', 'キノコ', 'マッシュルーム'] },
        { display: '💋くちびる', answers: ['くちびる', '唇', 'キス', 'きす', 'ちゅー', 'lip', 'lips'] },
        { display: '👙びきに', answers: ['びきに', 'ビキニ', 'みずぎ', '水着', 'bikini'] },
        { display: '🩲ぱんつ', answers: ['ぱんつ', 'パンツ', 'したぎ', '下着', 'panties'] },
        { display: '🍆なす（意味深）', answers: ['なす', 'ナス', '茄子', 'eggplant'] },
        { display: '🍈メロン（意味深）', answers: ['めろん', 'メロン', 'おっぱい', '巨乳', '胸'] },
        { display: '🍑ピーチ（意味深）', answers: ['ぴーち', 'ピーチ', '桃', 'しり', 'お尻', 'おしり'] },
        { display: '🍼哺乳瓶（バブみ）', answers: ['ほにゅうびん', '哺乳瓶', 'みるく', 'ミルク', 'ばぶ'] },
        { display: '🛏️ベッドイン', answers: ['べっどいん', 'ベッドイン', 'べっど', 'おとまり', 'えっち'] },
        { display: '🏩ラブホ', answers: ['らぶほ', 'ラブホ', 'ホテル', 'ほてる'] },
        { display: '⛓️手錠', answers: ['てじょう', '手錠', '拘束', 'こうそく'] },
        { display: '💥ムチ（SM）', answers: ['むち', 'ムチ', '鞭', 'SM'] },
        { display: '🕯️ロウソク', answers: ['ろうそく', 'ロウソク', '蝋燭'] },
        { display: '🐕首輪', answers: ['くびわ', '首輪', 'ぺっと', 'ペット'] },
        { display: '💄キスマーク', answers: ['きすまーく', 'キスマーク'] },
        { display: '📳おもちゃ（意味深）', answers: ['おもちゃ', 'ろーたー', 'ローター', 'バイブ'] },
        { display: '🔴あかいやつ', answers: ['てんが', 'テンガ', 'TENGA', 'おなほ'] }
    ],
    situation: [
        { display: '🌙お泊まり', answers: ['おとまり', 'お泊まり', 'お泊り', 'sleepover'] },
        { display: '🛁お風呂', answers: ['おふろ', 'お風呂', 'ふろ', 'bath'] },
        { display: '💕壁ドン', answers: ['かべどん', '壁ドン', 'kabedon'] },
        { display: '🛏️添い寝', answers: ['そいね', '添い寝', 'soine'] },
        { display: '💋キス待ち', answers: ['きすまち', 'キス待ち', 'きす'] },
        { display: '💏密着', answers: ['みっちゃく', '密着', 'ぎゅー', 'ハグ'] },
        { display: '💰パパ活', answers: ['ぱぱかつ', 'パパ活', 'ぢぢい', 'おぢ'] },
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
        { display: '📸自撮り', answers: ['じどり', '自撮り', 'せるふぃー', '盛り'] }
    ],
    pose: [
        { display: '✌️ぴーす', answers: ['ぴーす', 'ピース', 'peace'] },
        { display: '😉ウインク', answers: ['ういんく', 'ウインク', 'wink'] },
        { display: '🫶ハート作る', answers: ['はーと', 'ハート', 'heart'] },
        { display: '🫦セクシーポーズ', answers: ['せくしー', 'セクシーポーズ', 'グラビア'] },
        { display: '💦アヘ顔（笑）', answers: ['あへがお', 'アヘ顔', 'ahegao'] },
        { display: '🦵M字開脚（ヤバ', answers: ['えむじかいきゃく', 'M字開脚', 'm字'] },
        { display: '👀振り向き', answers: ['ふりむき', '振り向き', 'みかえり'] },
        { display: '💅ギャルピース', answers: ['ぎゃるぴーす', 'ギャルピ', 'ギャル'] },
        { display: '🐰ルダハート', answers: ['るだはーと', 'ルダハート', 'ほっぺハート'] },
        { display: '🫰指ハート', answers: ['ゆびはーと', '指ハート', 'きゅんです'] },
        { display: '🦷虫歯ポーズ', answers: ['むしばぽーず', '虫歯ポーズ', '小顔'] },
        { display: '👅あっかんべー', answers: ['あっかんべー', '舌出し', 'ベロ出し'] },
        { display: '🥺体育座り', answers: ['たいいくずわり', '体育座り', '三角座り'] },
        { display: '🙇‍♀️土下座', answers: ['どげざ', '土下座', 'ごめんなさい'] },
        { display: '🌟ジョジョ立ち', answers: ['じょじょだち', 'ジョジョ立ち', 'ジョジョ'] },
        { display: '🦷シェー', answers: ['しぇー', 'シェー', 'おそ松'] },
        { display: '🥺ぶりっ子', answers: ['ぶりっこ', 'ぶりっ子', 'あざとい'] },
        { display: '🙌万歳', answers: ['ばんざい', '万歳', 'バンザイ'] },
        { display: '💪ガッツポーズ', answers: ['がっつぽーず', 'ガッツポーズ', 'よっしゃ'] },
        { display: '🐶四つん這い', answers: ['よつんばい', '四つん這い', '犬のポーズ'] }
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
        { display: '⚖️弁護士', answers: ['べんごし', '弁護士'] }
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
        { display: '🕌タージマハル', answers: ['たーじまはる', 'タージマハル'] },
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

        timeLimit = settings.timeLimit || 120;
        maxRounds = settings.rounds || 3;
        const category = settings.category || 'mix';
        currentWordList = cuteWords[category] || cuteWords.mix;

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

    socket.on('fill', (data) => {
        socket.broadcast.emit('fill', data);
    });

    socket.on('sync_canvas', (dataURL) => {
        socket.broadcast.emit('sync_canvas', dataURL);
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
        currentWordObj = currentWordList[Math.floor(Math.random() * currentWordList.length)];

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
