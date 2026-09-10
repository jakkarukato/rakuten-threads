// ============================================================
//  楽天市場 ランキングAPI (2026年新仕様)
//
//  ・エンドポイントのパス接頭辞が検索APIと異なる点に注意
//      商品検索  : /ichibams/api/...
//      ランキング: /ichibaranking/api/...
//  ・applicationId と accessKey の両方が必須
//  ・★Origin ヘッダーが必須。Referer だけでは 403 になる（実測で確認済み）
// ============================================================

import { config, originUrl, refererUrl } from "./config.mjs";

const RANKING_ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。GitHubのSecrets、またはローカルの .env を確認してください。`
    );
  }
  return value;
}

/**
 * 指定ジャンルの売れ筋ランキングを取得する。
 * @param {number} genreId 楽天のジャンルID
 * @returns {Promise<Array>} 条件を満たす商品の配列（ランキング順）
 */
export async function fetchRanking(genreId) {
  const params = new URLSearchParams({
    applicationId: requireEnv("RAKUTEN_APP_ID"),
    accessKey: requireEnv("RAKUTEN_ACCESS_KEY"),
    affiliateId: requireEnv("RAKUTEN_AFFILIATE_ID"),
    genreId: String(genreId),
    format: "json",
  });

  const res = await fetch(`${RANKING_ENDPOINT}?${params.toString()}`, {
    headers: {
      // ★これが無いと 403。Referer は補助的に添えるだけ。
      Origin: originUrl,
      Referer: refererUrl,
      Accept: "application/json",
    },
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `楽天APIエラー (HTTP ${res.status})\n` +
        `送信したOrigin: ${originUrl}\n` +
        `レスポンス: ${body}\n\n` +
        hintForResponse(res.status, body)
    );
  }

  const json = JSON.parse(body);
  const items = (json.Items ?? []).map((entry) => entry.Item ?? entry);

  const { minPrice, maxPrice, minReviewCount, minReviewAverage } = config.filter;

  return items.filter((item) => {
    const price = Number(item.itemPrice);
    return (
      item.affiliateUrl &&
      price >= minPrice &&
      price <= maxPrice &&
      Number(item.reviewCount) >= minReviewCount &&
      Number(item.reviewAverage) >= minReviewAverage
    );
  });
}

function hintForResponse(status, body) {
  if (body.includes("REFERRER_MISSING") || body.includes("REFERRER_NOT_ALLOWED")) {
    return (
      "【対処】Originヘッダーが送られていないか、楽天側の「許可されているウェブサイト」に " +
      `${config.githubUser}.github.io が登録されていません。`
    );
  }
  if (status === 429) {
    return "【対処】レート制限です。リクエスト間隔を1.5秒以上空けてください。";
  }
  if (status === 401 || status === 403) {
    return "【対処】applicationId / accessKey を確認してください。新仕様では両方必須です。";
  }
  if (status === 404) {
    return "【対処】エンドポイントのパスを確認してください。ランキングAPIは /ichibaranking/api/ です。";
  }
  return "";
}

/** レート制限対策のスリープ */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
