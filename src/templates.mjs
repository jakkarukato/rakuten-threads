// ============================================================
//  投稿文のテンプレート
//  同じ文面の繰り返しは楽天アフィリエイトの規約違反（スパム扱い）に
//  なるため、日替わりでローテーションさせています。
//  ★文面はあなたの言葉に書き換えてください。そのままだと機械的な印象になります。
// ============================================================

import { config } from "./config.mjs";

/**
 * 楽天の商品名から販促ノイズを除去して短くする。
 * ランキング上位は【期間限定セール】★楽天1位★ のような装飾が多いため念入りに削る。
 */
export function cleanItemName(rawName, limit = 58) {
  let name = rawName
    .replace(/[【\[][^】\]]*[】\]]/g, " ")   // 【送料無料】[P10倍]
    .replace(/[（(][^）)]*[）)]/g, " ")       // （在庫あり）
    .replace(/★[^★]*★/g, " ")               // ★楽天1位★
    .replace(/＼[^／]*／/g, " ")              // ＼スーパーSALE／
    .replace(/《[^》]*》/g, " ")
    .replace(/^[\s\p{P}\p{S}]+/u, "")         // 先頭に残った記号
    .replace(/\s+/g, " ")
    .trim();

  if (name.length > limit) name = name.slice(0, limit - 1) + "…";
  return name;
}

const yen = (price) => `${Number(price).toLocaleString("ja-JP")}円`;

const stars = (average) => {
  const rounded = Math.round(Number(average) * 2) / 2;
  const full = Math.floor(rounded);
  const half = rounded - full >= 0.5 ? "☆" : "";
  return "★".repeat(full) + half;
};

// ------------------------------------------------------------
// テンプレート本体（item は楽天APIの商品オブジェクト）
// ------------------------------------------------------------
const templates = [
  (item, genre) =>
    `${genre.name}ランキング${item.rank}位。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)}`,

  (item) =>
    `レビュー${item.reviewCount}件で${Number(item.reviewAverage).toFixed(1)}。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)}`,

  (item) =>
    `${cleanItemName(item.itemName)}\n\n` +
    `${yen(item.itemPrice)}でこの評価はかなり良さそう。\n` +
    `${stars(item.reviewAverage)}（${item.reviewCount}件）`,

  (item, genre) =>
    `いま${genre.name}で売れてるやつ。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)} / ${stars(item.reviewAverage)}`,

  (item) =>
    `${item.reviewCount}人が評価してる。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)}`,

  (item, genre) =>
    `気になったので貼っておきます。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)}（${genre.name}ランキング${item.rank}位）`,
];

/**
 * 投稿文を組み立てる。
 * - 先頭に #PR（ステマ規制／楽天の禁止事項対応。絶対に外さないこと）
 * - ハッシュタグは3個まで（乱用は禁止事項）
 * - Threadsの上限500文字に収める。削るのは本文側で、URLと#PRは必ず残す
 */
export function buildPostText({ item, genre, dayIndex }) {
  const body = templates[dayIndex % templates.length](item, genre);
  const tags = ["#楽天市場", genre.tag].filter(Boolean).slice(0, 2).join(" ");

  const header = "#PR";
  const footer = `${item.affiliateUrl}\n\n${tags}`;

  let text = `${header}\n${body}\n\n${footer}`;

  if (text.length > config.maxTextLength) {
    const budget = config.maxTextLength - (header.length + footer.length + 4);
    text = `${header}\n${body.slice(0, Math.max(0, budget - 1))}…\n\n${footer}`;
  }

  return text;
}

export const templateCount = templates.length;
