// ============================================================
//  投稿文の組み立て
//
//  楽天にはレビュー本文を取得する公式APIが無いため、口コミそのものは使えません。
//  代わりに以下を材料にしています。
//    ・itemName の「|」以降や【】内にあるスペックのキーワード列
//    ・itemCaption の見出しと、続く説明の一文
//    ・reviewAverage / reviewCount
//
//  同じ文面の繰り返しは楽天アフィリエイトの規約違反（スパム扱い）になるため、
//  日替わりで型をローテーションさせています。
//  ★言い回しはあなたの言葉に書き換えてください。
// ============================================================

import { config } from "./config.mjs";
import { SHARED_QUESTIONS, GENRE_QUESTIONS } from "./questions.mjs";

// 販促文言。スペックとして扱いたくないもの
const PROMO =
  /(セール|SALE|クーポン|OFF|オフ|ポイント|倍|送料|期間限定|限定|まで|円|%|％|マラソン|訳あり|あす楽|即納|在庫|レビュー|ランキング|1位|１位|プレゼント|ギフト|新生活|father|mother)/i;

// 商品カテゴリそのものを指すような、情報量のない語
const NOISE = new Set([
  "イヤホン", "ヘッドホン", "スピーカー", "ワイヤレス", "ワイアレス", "ワイヤレスイヤホン",
  "コスパ", "オンライン", "ドライバー", "マイク", "本体", "新品", "正規品", "国内正規品",
  "人気", "おすすめ", "高音質", "アウトレット", "スマホ", "スマートフォン",
]);

/** 商品名から販促ノイズを除く（「|」があればその手前が製品名） */
export function cleanItemName(rawName, limit = 52) {
  let name = String(rawName)
    .replace(/[【\[][^】\]]*[】\]]/g, " ")
    .replace(/[（(][^）)]*[）)]/g, " ")
    .replace(/★[^★]*★/g, " ")
    .replace(/＼[^／]*／/g, " ")
    .replace(/《[^》]*》/g, " ")
    // 販促の決まり文句（「楽天1位」「楽天で一番売れた」「高評価★4.55」「正規品」など）
    .replace(/楽天\s*(ランキング)?\s*\d+\s*位[^\s]*/g, " ")
    .replace(/楽天で一番売れた|高評価\s*★?\s*[\d.]+|正規品|新品|公式(ショップ|店)?|送料無料|あす楽/g, " ")
    .replace(/[「」『』●◆◇■□▲△▼▽♪★☆]/g, " ")
    .replace(/\s*／\s*/g, " ");

  // 「|」以降はスペックのキーワード列なので製品名からは外す
  const pipe = name.search(/[|｜]/);
  if (pipe > 8) name = name.slice(0, pipe);

  name = name
    .replace(/^[\s\p{P}\p{S}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length > limit) name = name.slice(0, limit - 1) + "…";
  return name;
}

// 英語だけのスペックでも残す、よく使われる規格名
const KEEP_ENGLISH = /^(USB-?[AC]|Type-?C|Lightning|MagSafe|Qi2?|GaN|PPS|ANC|ENC|LDAC|aptX.*|AAC|Wi-?Fi.*|HDMI|SSD|HDD|NVMe|microSD.*|SDXC|SDHC|Blu-?ray|MFi|OLED|LED)$/i;

// ノイズキャンセリングの表記ゆれ
const NC_PATTERN = /ノイズキャンセ|ノイキャン|\bANC\b/i;

// スペックの種類。同じ種類が2つ以上並ばないようにするために使う
const SPEC_CATEGORIES = [
  ["nc", NC_PATTERN],
  ["battery", /時間(再生|駆動|連続)|連続再生|持続時間|バッテリー/],
  ["water", /防水|防滴|防塵|IPX?\d/i],
  ["multipoint", /マルチポイント/],
  ["bluetooth", /Bluetooth|ブルートゥース/i],
  ["codec", /LDAC|aptX|ハイレゾ/i],
  ["charge", /急速充電|高速充電|PD|PPS/i],
];

function categoryOf(spec) {
  const hit = SPEC_CATEGORIES.find(([, pattern]) => pattern.test(spec));
  return hit ? hit[0] : null;
}

/**
 * 商品名からスペックらしき語を取り出す。
 * 材料は【】の中身と、「|」以降（無ければ商品名全体）のスペース区切りのキーワード列。
 */
export function extractSpecs(rawName, limit = 4) {
  const raw = String(rawName);
  const candidates = [];

  // 【】の中身は「/」区切りが多い
  for (const m of raw.matchAll(/[【\[]([^】\]]+)[】\]]/g)) {
    // 販促の【】（クーポン期間など）は、割ると日時の断片が残るのでブロックごと捨てる
    if (PROMO.test(m[1])) continue;
    candidates.push(...m[1].split(/[\/・、,|｜]/));
  }

  // 「|」以降のキーワード列。無ければ商品名全体を見る
  const stripped = raw.replace(/[【\[][^】\]]*[】\]]/g, " ").replace(/★[^★]*★/g, " ");
  const pipe = stripped.search(/[|｜]/);
  const keywordZone = pipe >= 0 ? stripped.slice(pipe + 1) : stripped;

  // 「Bluetooth 5.3」のようにバージョン番号が分かれてしまうので繋ぎ直す
  const tokens = [];
  for (const t of keywordZone.split(/[\s\u3000]+/)) {
    const s = t.trim();
    if (!s) continue;
    if (/^[\d.]+$/.test(s) && tokens.length) tokens[tokens.length - 1] += ` ${s}`;
    else tokens.push(s);
  }
  candidates.push(...tokens);

  // 製品名そのものの語をスペック扱いしないよう、先頭部分に含まれる語は除く
  const head = cleanItemName(raw, 22);

  const specs = [];
  const usedCategories = new Set();

  // ★ノイズキャンセリングは購入の決め手になりやすいので、表記が長くても必ず拾って先頭に置く。
  //   「最大42dBのアクティブノイズキャンセリング」のように書かれていると文字数制限で落ちるため、
  //   ここだけは表記を「ノイズキャンセリング（最大42dB）」に整えて扱う。
  const ncToken = candidates.find((c) => NC_PATTERN.test(c));
  if (ncToken) {
    const db = ncToken.match(/最大\s*(\d+)\s*dB/i) ?? ncToken.match(/(\d+)\s*dB/i);
    specs.push(db ? `ノイズキャンセリング（最大${db[1]}dB）` : "ノイズキャンセリング");
    usedCategories.add("nc");
  }

  for (const c of candidates) {
    const s = c.trim().replace(/^[\p{P}\p{S}]+/u, "").replace(/[、。]$/, "");
    if (s.length < 4 || s.length > 16) continue;
    // 「11 01:59」のような数字と記号だけの断片を弾く
    if ((s.match(/\p{L}/gu) ?? []).length < 2) continue;
    // 英語だけの断片（Built-In, Connector など）は外す。規格名や数字の入ったものは残す
    if (/^[A-Za-z][A-Za-z\s\-]*$/.test(s) && !KEEP_ENGLISH.test(s)) continue;
    if (PROMO.test(s)) continue;
    if (NOISE.has(s)) continue;
    if (head.includes(s)) continue;
    if (specs.some((x) => x.includes(s) || s.includes(x))) continue;

    // 同じ種類のスペックは1つだけ（「最大36時間再生」と「長いバッテリー持続時間」など）
    const category = categoryOf(s);
    if (category && usedCategories.has(category)) continue;
    if (category) usedCategories.add(category);

    specs.push(s);
    if (specs.length >= limit) break;
  }
  return specs;
}

/** 商品説明文を「見出し」と「続く一文」に分ける */
// 楽天の商品説明には、検索対策としてギフト用途の語が大量に並べられていることが多い。
// ------------------------------------------------------------
//  商品説明文の選別
//
//  itemCaption は店舗が自由に書く欄で、次のものが混在している。
//    ・検索対策のキーワード羅列（「お正月 御年賀 お中元 …」）
//    ・特定商取引法などの法定表記（「当店は日本国内に所在する事業者であります」）
//    ・配送や返品の案内
//    ・本来欲しい商品説明
//
//  禁止語を足し続けてもきりがないため、「商品の説明文らしさ」を
//  満たすものだけを通す方式にしている。
// ------------------------------------------------------------

// 商品説明の文末や言い回しに現れる語（これが無ければ採用しない）
const PRODUCT_MARK =
  /(搭載|対応|可能|実現|採用|設計|備え|使える|楽しめ|聴け|持ち運|軽量|コンパクト|長時間|快適|防水|防塵|充電|接続|音質|操作|装着)/;

// 店舗都合・法定表記・販促の語（ひとつでもあれば落とす）
const NOT_PRODUCT =
  /(当店|弊社|当社|事業者|注文|ご購入|個人情報|提供いたし|返品|交換|キャンセル|配送|発送|送料|営業日|お問い合わせ|問合せ|免責|規約|保証書|領収書|ラッピング|のし|熨斗|在庫|入荷|メーカー希望|定価|税込|税別|お?正月|御?年賀|御?年始|お?中元|お?歳暮|母の日|父の日|敬老の日|バレンタイン|ホワイトデー|クリスマス|ハロウィン|お盆|帰省|ゴールデンウィーク|大型連休|内祝|快気祝|香典返し|ギフト|プレゼント|贈り物|贈答|季節を問わ|誕生日|クーポン|ポイント|ランキング|楽天|1位|１位)/;

/** 商品の説明文として使える一文か */
function looksLikeProductSentence(s) {
  if (!s) return false;
  if (NOT_PRODUCT.test(s)) return false;
  if (!PRODUCT_MARK.test(s)) return false;
  // 日本語の文に空白はあまり出てこない。多いものは語の羅列とみなす
  if ((s.match(/[\s\u3000]/g) ?? []).length > 3) return false;
  // 名詞の羅列を弾く。文章なら助詞や活用語尾のひらがなが混ざる
  if ((s.match(/[\u3041-\u3096]/g) ?? []).length < 6) return false;
  return true;
}

/**
 * 商品説明文から、商品の説明として読める一文を取り出す。
 * 条件を満たすものが無ければ空文字を返す（説明文は省略される）。
 */
export function extractCaption(caption) {
  if (!caption) return { hook: "", detail: "" };

  const text = String(caption)
    .replace(/<[^>]*>/g, " ")
    .replace(/&[#a-z0-9]+;/gi, " ")
    .trim();

  const segments = text
    .split(/(?<=。)|[\s\u3000]+/)
    .map((s) => s.trim().replace(/。$/, ""))
    .filter(Boolean);

  const good = [];
  for (const s of segments) {
    if (s.length < 14 || s.length > 60) continue;
    if (!looksLikeProductSentence(s)) continue;
    if (good.some((g) => g.includes(s) || s.includes(g))) continue;
    good.push(s);
    if (good.length >= 2) break;
  }

  return { hook: good[0] ?? "", detail: good[1] ?? "" };
}

// ------------------------------------------------------------
//  スペックの意味を平易な言葉にする
//
//  「なぜ良いか」は商品を使っていないと書けない（書けば嘘になる）が、
//  「そのスペックが何を意味するか」は用語の言い換えなので事実として書ける。
// ------------------------------------------------------------
//  ★対象は「説明が要る用語」だけに絞っている。
//    ノイズキャンセリングや「最大20時間再生」のように意味が通じるものに
//    言い換えを付けると、かえってくどくなるため入れていない。
const SPEC_NOTES = [
  [/マルチポイント/, "スマホとPCに同時につないでおける"],
  [/GaN|窒化ガリウム/i, "同じ出力でも小さくて軽い"],
  [/LDAC|aptX|AAC対応|ハイレゾ/i, "音源の情報量を落とさずに聴ける"],
  [/パッシブラジエーター/, "小さくても低音が出る"],
  [/外音取り込み|アンビエント|ヒアスルー/, "つけたまま人と話せる"],
  [/低遅延|ゲーミングモード|ゲームモード/, "動画やゲームで音がズレにくい"],
  [/PD対応|Power ?Delivery|PPS/i, "対応機種なら短い時間で充電できる"],
  [/Qi2|Qi対応|ワイヤレス充電/i, "置くだけで充電できる"],
  [/IP\d\d|IPX\d/i, "水や汗に強い規格"],
  [/\d+\s*mAh/i, "スマホを何度も充電できる容量"],
  [/ANC(?!.*キャンセ)/i, "ノイズキャンセリングのこと"],
  [/ENC|CVC|cVc/i, "通話中に自分の声だけを拾ってくれる"],
  [/マグセーフ|MagSafe/i, "磁石でぴたっと付く"],
];

/** スペックの中から、意味を説明できるものを1つ選んで一言にする */
export function pickSpecNote(specs) {
  for (const spec of specs) {
    for (const [pattern, note] of SPEC_NOTES) {
      if (pattern.test(spec)) return note;
    }
  }
  return "";
}

const yen = (price) => `${Number(price).toLocaleString("ja-JP")}円`;

const stars = (average) => {
  const rounded = Math.round(Number(average) * 2) / 2;
  const full = Math.floor(rounded);
  return "★".repeat(full) + (rounded - full >= 0.5 ? "☆" : "");
};

// ------------------------------------------------------------
//  型（日替わりでローテーション）。null / "" の行は捨てられる
// ------------------------------------------------------------
const variants = [
  (f) => [
    f.lead,
    "",
    f.name,
    `${f.price} / ${f.stars}（レビュー${f.reviewCount}件）`,
    "",
    ...f.specs.map((s) => `・${s}`),
    f.note ? `\n${f.note}。` : null,
    f.detail ? `\n${f.detail}。` : null,
  ],

  (f) => [
    f.lead,
    "",
    f.name,
    "",
    ...f.specs.map((s) => `・${s}`),
    f.note ? `\n${f.note}。` : null,
    "",
    `${f.price}　${f.stars}（${f.reviewCount}件）`,
    f.detail ? `\n${f.detail}。` : null,
  ],

  (f) => [
    `レビュー${f.reviewCount}件で${f.reviewAverage}。`,
    "",
    f.name,
    f.price,
    "",
    ...f.specs.map((s) => `・${s}`),
    f.note ? `\n${f.note}。` : null,
    f.detail ? `\n${f.detail}。` : null,
  ],

  (f) => [
    f.lead,
    "",
    f.name,
    "",
    f.detail ? `${f.detail}。\n` : null,
    ...f.specs.map((s) => `・${s}`),
    f.note ? `\n${f.note}。` : null,
    "",
    `${f.price} / ${f.stars} ${f.reviewCount}件のレビュー`,
  ],

  (f) => [
    f.name,
    `${f.price}`,
    "",
    f.lead,
    "",
    ...f.specs.map((s) => `・${s}`),
    f.note ? `\n${f.note}。` : null,
    "",
    `${f.stars}（レビュー${f.reviewCount}件）`,
  ],
];

const render = (lines) =>
  lines
    .filter((line) => line !== null && line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * 投稿文を組み立てる。
 * - 先頭に【PR】（Threadsは先頭のハッシュタグを本文から抜くため #PR は使わない）
 * - アフィリエイトURLの空白類は除去（改行混入でリンクが切れるのを防ぐ）
 * - 500文字に収まるよう、説明文 → スペックの意味 → スペック の順に削る
 */
// ------------------------------------------------------------
//  締めの一行
//
//  Threadsは会話量で評価されるため、返信を誘う一文を入れる。
//  ★事実の主張を含まない質問だけを置いている。
//    「探してる」「迷ってる」のような書き手の状況は、
//    プログラムが言えば捏造になるので入れていない。
//    それを書きたいときは、承認時のコメント欄に人が書く。
// ------------------------------------------------------------
/**
 * 締めの質問を1つ選ぶ。質問そのものは questions.mjs にある。
 *
 * まだ一度も使っていない質問からランダムに選ぶ。全部使い切ったら、
 * いちばん昔に使ったもの（上位10個）から選ぶ。これで全質問を一巡するまで同じ質問は出ない。
 *
 * @param {object} genre config.mjs の genres の要素
 * @param {string[]} usedQuestions これまでに投稿した質問（古い順）
 */
export function pickQuestion(genre, usedQuestions = []) {
  const pool = [...SHARED_QUESTIONS, ...(GENRE_QUESTIONS[genre.id] ?? [])];

  const lastUsed = new Map();
  usedQuestions.forEach((q, i) => lastUsed.set(q, i));

  const unused = pool.filter((q) => !lastUsed.has(q));
  const choices = unused.length
    ? unused
    : [...pool].sort((a, b) => lastUsed.get(a) - lastUsed.get(b)).slice(0, 10);

  return choices[Math.floor(Math.random() * choices.length)];
}

/** 事実だけで書ける、数字についての一言 */
function dataRemark(item) {
  const count = Number(item.reviewCount);
  const average = Number(item.reviewAverage);
  if (count >= 300 && average >= 4.5) {
    return `レビュー${count}件で★${average.toFixed(1)}。母数が多いぶん参考にしやすい。`;
  }
  return "";
}

/**
 * 投稿文を組み立てる。
 * - 先頭に【PR】（Threadsは先頭のハッシュタグを本文から抜くため #PR は使わない）
 * - アフィリエイトURLの空白類は除去（改行混入でリンクが切れるのを防ぐ）
 * - 500文字に収まるよう、説明文 → 数字の一言 → スペックの意味 → スペック の順に削る
 * - reserve を指定すると、承認時に人が書く一言のぶん余白を残す
 */
export function buildPostText({ item, genre, dayIndex, reserve = 0, question }) {
  const header = "【PR】";
  const url = String(item.affiliateUrl).replace(/\s+/g, "");
  const tags = ["#楽天市場", genre.tag].filter(Boolean).join(" ");
  const footer = `${url}\n\n${tags}`;

  const allSpecs = extractSpecs(item.itemName);
  // 商品説明文は既定で使わない（config.useCaption を参照）
  const { hook, detail } = config.useCaption
    ? extractCaption(item.itemCaption)
    : { hook: "", detail: "" };

  // 商品名の中にスペックが出てきたら、そこで名前を切る。
  // 「|」の無い商品名はスペックが名前に混ざっていて、箇条書きと二重になるため。
  let fullName = cleanItemName(item.itemName, 200);
  const cutAt = allSpecs
    .map((spec) => fullName.indexOf(spec))
    .filter((i) => i > 6)
    .sort((a, b) => a - b)[0];
  if (cutAt !== undefined) fullName = fullName.slice(0, cutAt).trim();
  const displayName = fullName.length > 52 ? fullName.slice(0, 51) + "…" : fullName;
  const note = pickSpecNote(allSpecs);

  // 締めの質問と、数字についての一言
  const closer = question ?? pickQuestion(genre);
  const remark = dataRemark(item);

  // 書き出しの一行。商品説明が使えればそれ、無ければ上位のときだけ順位で始める。
  const lead = hook
    ? `${hook}。`
    : Number(item.rank) <= config.rankThreshold
      ? `${genre.name}ランキング${item.rank}位。`
      : null;

  const base = {
    lead,
    name: displayName,
    price: yen(item.itemPrice),
    stars: stars(item.reviewAverage),
    reviewCount: item.reviewCount,
    reviewAverage: Number(item.reviewAverage).toFixed(1),
    rank: item.rank,
    genre,
  };

  const variant = variants[dayIndex % variants.length];

  // 情報量の多い順に試し、収まった時点で採用する
  const plans = [];
  for (const keepRemark of [true, false]) {
    for (const keepDetail of [true, false]) {
      for (const keepNote of [true, false]) {
        for (let n = allSpecs.length; n >= 0; n--) {
          plans.push({ n, keepDetail, keepNote, keepRemark });
        }
      }
    }
  }

  for (const plan of plans) {
    const body = render(
      variant({
        ...base,
        specs: allSpecs.slice(0, plan.n),
        note: plan.keepNote ? note : "",
        detail: plan.keepDetail ? detail : "",
      })
    );
    const parts = [body];
    if (plan.keepRemark && remark) parts.push(remark);
    parts.push(closer);
    const text = header + "\n" + parts.join("\n\n") + "\n\n" + footer;
    if (text.length <= config.maxTextLength - reserve) return text;
  }

  const minimal = `${header}\n${cleanItemName(item.itemName, 30)}\n${base.price}\n\n${footer}`;
  return minimal.slice(0, config.maxTextLength);
}

export const variantCount = variants.length;
