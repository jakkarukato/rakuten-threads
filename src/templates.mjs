// ============================================================
//  投稿文の組み立て
//
//  楽天にはレビュー本文を取得する公式APIが無いため、口コミそのものは使えません。
//  代わりに以下を材料にしています。
//    ・itemName の【】内にあるスペック（販促文言は除外）
//    ・itemCaption の冒頭（店舗が書いた商品説明の見出し部分）
//    ・reviewAverage / reviewCount（レビューの数値）
//
//  同じ文面の繰り返しは楽天アフィリエイトの規約違反（スパム扱い）になるため、
//  日替わりで型をローテーションさせています。
//  ★言い回しはあなたの言葉に書き換えてください。
// ============================================================

import { config } from "./config.mjs";

// 販促文言。スペックとして扱いたくないものを弾く
const PROMO =
  /(セール|SALE|クーポン|OFF|オフ|ポイント|倍|送料|期間限定|限定|まで|円|%|％|マラソン|訳あり|あす楽|即納|在庫|レビュー|ランキング|１位|1位|プレゼント|ギフト包装|新生活|母の日|父の日)/i;

/** 商品名から販促ノイズを除いた本体部分を取り出す */
export function cleanItemName(rawName, limit = 46) {
  let name = String(rawName)
    .replace(/[【\[][^】\]]*[】\]]/g, " ")
    .replace(/[（(][^）)]*[）)]/g, " ")
    .replace(/★[^★]*★/g, " ")
    .replace(/＼[^／]*／/g, " ")
    .replace(/《[^》]*》/g, " ")
    .replace(/^[\s\p{P}\p{S}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length > limit) name = name.slice(0, limit - 1) + "…";
  return name;
}

/**
 * 商品名の【】から、スペックらしき箇条書きを取り出す。
 * 例: 【最大20時間再生 / 5W出力 / IP67防塵防水規格】→ ["最大20時間再生", "5W出力", "IP67防塵防水規格"]
 */
export function extractSpecs(rawName, limit = 3) {
  const blocks = [...String(rawName).matchAll(/[【\[]([^】\]]+)[】\]]/g)].map((m) => m[1]);
  const specs = [];

  for (const block of blocks) {
    for (const piece of block.split(/[\/・、,|｜]/)) {
      const s = piece.trim();
      if (s.length < 4 || s.length > 20) continue;
      if (PROMO.test(s)) continue;
      if (specs.includes(s)) continue;
      specs.push(s);
    }
  }
  return specs.slice(0, limit);
}

/**
 * 商品説明文の冒頭から、見出しにあたる一節を取り出す。
 * 多くの店舗は「見出し（全角スペース）本文…」の形で書いているため、
 * 最初の空白までを見出しとみなす。取れなければ最初の一文で代用する。
 */
export function extractHook(caption, limit = 44) {
  if (!caption) return "";

  const text = String(caption)
    .replace(/<[^>]*>/g, " ")
    .replace(/&[#a-z0-9]+;/gi, " ")
    .trim();

  const head = text.split(/[\s\u3000]+/)[0] ?? "";
  let hook =
    head.length >= 8 && head.length <= limit
      ? head
      : (text.split(/[。!！?？\n]/)[0] ?? "").trim();

  hook = hook.replace(/[\s\u3000]+/g, " ").trim();
  if (!hook || hook.length < 6) return "";
  if (hook.length > limit) hook = hook.slice(0, limit - 1) + "…";
  return hook;
}

const yen = (price) => `${Number(price).toLocaleString("ja-JP")}円`;

const stars = (average) => {
  const rounded = Math.round(Number(average) * 2) / 2;
  const full = Math.floor(rounded);
  return "★".repeat(full) + (rounded - full >= 0.5 ? "☆" : "");
};

// ------------------------------------------------------------
//  型（日替わりでローテーション）
//  各関数は「行の配列」を返す。null / "" の行は捨てられる。
//  specs を含む行は、文字数が足りないときに後ろから削られる。
// ------------------------------------------------------------
const variants = [
  (f) => [
    f.hook ? `${f.hook}。` : null,
    "",
    f.name,
    `${f.price} / ${f.stars}（レビュー${f.reviewCount}件）`,
    f.specs.length ? "" : null,
    ...f.specs.map((s) => `・${s}`),
  ],

  (f) => [
    `${f.genre.name}ランキング${f.rank}位。`,
    "",
    f.name,
    f.hook || null,
    "",
    `${f.price}　${f.stars}（${f.reviewCount}件）`,
    ...f.specs.map((s) => `・${s}`),
  ],

  (f) => [
    `レビュー${f.reviewCount}件で${f.reviewAverage}。これは気になる。`,
    "",
    f.name,
    `${f.price}`,
    f.specs.length ? "" : null,
    ...f.specs.map((s) => `・${s}`),
    f.hook ? `\n${f.hook}` : null,
  ],

  (f) => [
    f.hook ? `${f.hook}` : `いま${f.genre.name}で売れてるやつ。`,
    "",
    f.name,
    `${f.price} / ${f.stars} ${f.reviewCount}件のレビュー`,
    f.specs.length ? "" : null,
    ...f.specs.map((s) => `・${s}`),
  ],

  (f) => [
    `${f.name}`,
    "",
    f.hook || null,
    "",
    `${f.price}`,
    `${f.stars}（${f.reviewCount}件）`,
    ...f.specs.map((s) => `・${s}`),
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
 * - 500文字に収まるよう、スペック → 説明文 の順に削る
 */
export function buildPostText({ item, genre, dayIndex }) {
  const header = "【PR】";
  const url = String(item.affiliateUrl).replace(/\s+/g, "");
  const tags = ["#楽天市場", genre.tag].filter(Boolean).join(" ");
  const footer = `${url}\n\n${tags}`;

  const allSpecs = extractSpecs(item.itemName);
  const hook = extractHook(item.itemCaption);

  const fields = {
    name: cleanItemName(item.itemName),
    price: yen(item.itemPrice),
    stars: stars(item.reviewAverage),
    reviewCount: item.reviewCount,
    reviewAverage: Number(item.reviewAverage).toFixed(1),
    rank: item.rank,
    genre,
    hook,
    specs: allSpecs,
  };

  const variant = variants[dayIndex % variants.length];

  // 収まるまで、スペックを1つずつ削り、それでも駄目なら説明文を落とす
  for (let specCount = allSpecs.length; specCount >= 0; specCount--) {
    for (const withHook of [true, false]) {
      const body = render(
        variant({
          ...fields,
          specs: allSpecs.slice(0, specCount),
          hook: withHook ? hook : "",
        })
      );
      const text = `${header}\n${body}\n\n${footer}`;
      if (text.length <= config.maxTextLength) return text;
    }
  }

  // ここまで来たら商品名が異常に長い。最低限の形にする
  const minimal = `${header}\n${cleanItemName(item.itemName, 30)}\n${fields.price}\n\n${footer}`;
  return minimal.slice(0, config.maxTextLength);
}

export const variantCount = variants.length;
