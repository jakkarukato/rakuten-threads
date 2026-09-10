// ============================================================
//  楽天市場 商品検索API (2026年新仕様)
//  - エンドポイント: openapi.rakuten.co.jp
//  - applicationId と accessKey の両方が必須
//  - Webアプリケーションタイプは Referer ヘッダーの照合あり
// ============================================================

import { config, refererUrl } from "./config.mjs";

const ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";

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
 * キーワードで楽天市場の商品を検索する。
 * @returns {Promise<Array>} 商品オブジェクトの配列
 */
export async function searchItems(keyword) {
  const params = new URLSearchParams({
    applicationId: requireEnv("RAKUTEN_APP_ID"),
    accessKey: requireEnv("RAKUTEN_ACCESS_KEY"),
    affiliateId: requireEnv("RAKUTEN_AFFILIATE_ID"),
    keyword,
    hits: String(config.search.hits),
    sort: "-reviewCount",
    imageFlag: "1",      // 画像がある商品のみ
    availability: "1",   // 在庫がある商品のみ
    hasReviewFlag: "1",  // レビューがある商品のみ
    minPrice: String(config.search.minPrice),
    maxPrice: String(config.search.maxPrice),
    format: "json",
  });

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: {
      // ★これが無いと 403 HTTP_REFERRER_MISSING になります
      Referer: refererUrl,
      Accept: "application/json",
    },
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `楽天APIエラー (HTTP ${res.status})\n` +
        `送信したReferer: ${refererUrl}\n` +
        `レスポンス: ${body}\n\n` +
        hintForStatus(res.status, body)
    );
  }

  const json = JSON.parse(body);
  const items = (json.Items ?? []).map((entry) => entry.Item ?? entry);

  return items.filter(
    (item) =>
      Number(item.reviewCount) >= config.search.minReviewCount &&
      Number(item.reviewAverage) >= config.search.minReviewAverage &&
      item.affiliateUrl
  );
}

function hintForStatus(status, body) {
  if (body.includes("REFERRER_NOT_ALLOWED")) {
    return (
      "【対処】楽天ウェブサービスの「許可されているウェブサイト」に " +
      `${config.githubUser}.github.io が登録されているか確認してください。`
    );
  }
  if (body.includes("REFERRER_MISSING")) {
    return "【対処】Refererヘッダーが送信されていません。申請タイプが「Webアプリケーション」か確認してください。";
  }
  if (status === 429) {
    return "【対処】レート制限です。新APIはリクエスト間隔を1.5秒以上空ける必要があります。";
  }
  if (status === 401 || status === 403) {
    return "【対処】applicationId / accessKey が正しいか確認してください。新仕様では両方必須です。";
  }
  return "";
}

/** レート制限対策のスリープ（複数キーワードを回す場合に使用） */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
