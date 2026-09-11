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
    .replace(/《[^》]*》/g, " ");

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

/**
 * 商品名からスペックらしき語を取り出す。
 * 材料は【】の中身と、「|」以降（無ければ商品名全体）のスペース区切りのキーワード列。
 */
export function extractSpecs(rawName, limit = 4) {
  const raw = String(rawName);
  const candidates = [];

  // 【】の中身は「/」区切りが多い
  for (const m of raw.matchAll(/[【\[]([^】\]]+)[】\]]/g)) {
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
  for (const c of candidates) {
    const s = c.trim().replace(/[、。]$/, "");
    if (s.length < 4 || s.length > 16) continue;
    if (PROMO.test(s)) continue;
    if (NOISE.has(s)) continue;
    if (head.includes(s)) continue;
    if (specs.some((x) => x.includes(s) || s.includes(x))) continue;
    specs.push(s);
    if (specs.length >= limit) break;
  }
  return specs;
}

/** 商品説明文を「見出し」と「続く一文」に分ける */
export function extractCaption(caption) {
  if (!caption) return { hook: "", detail: "" };

  const text = String(caption)
    .replace(/<[^>]*>/g, " ")
    .replace(/&[#a-z0-9]+;/gi, " ")
    .trim();

  // 多くの店舗は「見出し（空白）本文…」の形で書いている
  const parts = text.split(/[\s\u3000]+/);
  let hook = parts[0] ?? "";
  let rest = parts.slice(1).join(" ");

  if (hook.length < 8 || hook.length > 52) {
    // 見出しらしきものが取れないときは最初の一文を見出しにする
    const sentences = text.split(/(?<=。)/);
    hook = (sentences[0] ?? "").trim();
    rest = sentences.slice(1).join("");
  }

  hook = hook.replace(/[\s\u3000]+/g, " ").replace(/。$/, "").trim();
  if (hook.length > 52) hook = hook.slice(0, 51) + "…";
  if (hook.length < 6) hook = "";

  // 続く説明の一文
  let detail = (rest.split(/(?<=。)/)[0] ?? "").replace(/[\s\u3000]+/g, " ").trim();
  if (detail.length > 64) detail = detail.slice(0, 63) + "…";
  if (detail.length < 12) detail = "";

  return { hook, detail };
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
    f.hook ? `${f.hook}。` : null,
    "",
    f.name,
    "",
    f.detail || null,
    f.specs.length ? "" : null,
    ...f.specs.map((s) => `・${s}`),
    "",
    `${f.price} / ${f.stars}（レビュー${f.reviewCount}件）`,
  ],

  (f) => [
    `${f.genre.name}ランキング${f.rank}位。`,
    "",
    f.name,
    `${f.price}　${f.stars}（${f.reviewCount}件）`,
    "",
    f.hook ? `${f.hook}。` : null,
    f.detail || null,
    f.specs.length ? "" : null,
    ...f.specs.map((s) => `・${s}`),
  ],

  (f) => [
    `レビュー${f.reviewCount}件で${f.reviewAverage}。これは気になる。`,
    "",
    f.name,
    f.price,
    "",
    f.hook ? `${f.hook}。` : null,
    f.detail || null,
    f.specs.length ? "" : null,
    ...f.specs.map((s) => `・${s}`),
  ],

  (f) => [
    f.hook ? `${f.hook}。` : `いま${f.genre.name}で売れてるやつ。`,
    "",
    f.name,
    "",
    ...f.specs.map((s) => `・${s}`),
    f.specs.length ? "" : null,
    f.detail || null,
    "",
    `${f.price} / ${f.stars} ${f.reviewCount}件のレビュー`,
  ],

  (f) => [
    f.name,
    "",
    f.hook ? `${f.hook}。` : null,
    f.detail || null,
    f.specs.length ? "" : null,
    ...f.specs.map((s) => `・${s}`),
    "",
    `${f.price}`,
    `${f.stars}（${f.reviewCount}件）`,
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
 * - 500文字に収まるよう、スペック → 説明の一文 → 見出し の順に削る
 */
export function buildPostText({ item, genre, dayIndex }) {
  const header = "【PR】";
  const url = String(item.affiliateUrl).replace(/\s+/g, "");
  const tags = ["#楽天市場", genre.tag].filter(Boolean).join(" ");
  const footer = `${url}\n\n${tags}`;

  const allSpecs = extractSpecs(item.itemName);
  const { hook, detail } = extractCaption(item.itemCaption);

  const base = {
    name: cleanItemName(item.itemName),
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
  for (const keepDetail of [true, false]) {
    for (const keepHook of [true, false]) {
      for (let n = allSpecs.length; n >= 0; n--) {
        plans.push({ n, keepDetail, keepHook });
      }
    }
  }

  for (const plan of plans) {
    const body = render(
      variant({
        ...base,
        specs: allSpecs.slice(0, plan.n),
        hook: plan.keepHook ? hook : "",
        detail: plan.keepDetail ? detail : "",
      })
    );
    const text = `${header}\n${body}\n\n${footer}`;
    if (text.length <= config.maxTextLength) return text;
  }

  const minimal = `${header}\n${cleanItemName(item.itemName, 30)}\n${base.price}\n\n${footer}`;
  return minimal.slice(0, config.maxTextLength);
}

export const variantCount = variants.length;
