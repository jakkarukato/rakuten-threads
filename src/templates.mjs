// ============================================================
//  投稿文のテンプレート
//  同じ文面の繰り返しは楽天アフィリエイトの規約違反（スパム扱い）に
//  なるため、日替わりでローテーションさせています。
//  ★文面はあなたの言葉に書き換えてください。そのままだと機械的な印象になります。
// ============================================================

import { config } from "./config.mjs";

/** 楽天の商品名からノイズ（【送料無料】等）を除去して短くする */
export function cleanItemName(rawName, limit = 60) {
  let name = rawName
    .replace(/[【\[][^】\]]*[】\]]/g, " ") // 【送料無料】などを除去
    .replace(/[（(][^）)]*[）)]/g, " ")     // （在庫あり）などを除去
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
// テンプレート本体
// 引数の item は楽天APIの商品オブジェクト
// ------------------------------------------------------------
const templates = [
  (item) =>
    `レビュー${item.reviewCount}件で${Number(item.reviewAverage).toFixed(1)}。\n` +
    `${cleanItemName(item.itemName)}\n\n` +
    `${yen(item.itemPrice)}\n` +
    `${stars(item.reviewAverage)}`,

  (item) =>
    `${cleanItemName(item.itemName)}\n\n` +
    `${yen(item.itemPrice)}でこの評価はかなり良さそう。\n` +
    `${stars(item.reviewAverage)}（${item.reviewCount}件）`,

  (item) =>
    `今日見つけたもの。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)} / ${stars(item.reviewAverage)} ${item.reviewCount}件`,

  (item) =>
    `${item.reviewCount}人が評価してるやつ。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)}`,

  (item) =>
    `気になったので貼っておきます。\n\n` +
    `${cleanItemName(item.itemName)}\n` +
    `${yen(item.itemPrice)}（評価${Number(item.reviewAverage).toFixed(1)}）`,

  (item) =>
    `${cleanItemName(item.itemName)}\n\n` +
    `${stars(item.reviewAverage)} レビュー${item.reviewCount}件\n` +
    `${yen(item.itemPrice)}`,
];

/** ハッシュタグ（乱用は規約違反なので3個まで） */
function hashtags(keyword) {
  const base = keyword.split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, "");
  return ["#楽天", "#楽天市場", base ? `#${base}` : ""]
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

/**
 * 投稿文を組み立てる。
 * - 先頭に #PR（ステマ規制／楽天の禁止事項対応。絶対に外さないこと）
 * - Threadsの上限500文字に収める
 */
export function buildPostText({ item, keyword, dayIndex }) {
  const template = templates[dayIndex % templates.length];
  const body = template(item);
  const tags = hashtags(keyword);
  const url = item.affiliateUrl;

  const header = "#PR";
  const footer = `${url}\n\n${tags}`;

  let text = `${header}\n${body}\n\n${footer}`;

  // 500文字を超える場合は本文側を削る（URLと#PRは絶対に消さない）
  if (text.length > config.maxTextLength) {
    const budget = config.maxTextLength - (header.length + footer.length + 4);
    const trimmed = body.slice(0, Math.max(0, budget - 1)) + "…";
    text = `${header}\n${trimmed}\n\n${footer}`;
  }

  return text;
}

export const templateCount = templates.length;
