// ============================================================
//  Typefully API v2
//  - plan_at : 指定時刻の枠に「下書き」として置く。自分が確定するまで投稿されない（推奨）
//  - publish_at : 指定時刻に自動投稿される（全自動。規約リスクが上がる）
// ============================================================

const BASE = "https://api.typefully.com/v2";

function apiKey() {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("環境変数 TYPEFULLY_API_KEY が設定されていません。");
  return key;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Typefully APIエラー (HTTP ${res.status}): ${body}`);
  }
  return body ? JSON.parse(body) : null;
}

/** 接続済みアカウント一覧。social_set_id を調べるのに使う */
export async function listSocialSets() {
  return request("/social-sets");
}

/**
 * Threads向けの下書きを作成する。
 * @param {string} text 投稿本文
 * @param {string} scheduledAt ISO8601（タイムゾーン付き）例: 2026-09-11T21:00:00+09:00
 * @param {boolean} autoPublish true なら確認なしで自動投稿
 */
export async function createThreadsDraft({ text, scheduledAt, autoPublish = false, title }) {
  const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;
  if (!socialSetId) {
    throw new Error(
      "環境変数 TYPEFULLY_SOCIAL_SET_ID が設定されていません。`node src/list-sets.mjs` で確認できます。"
    );
  }

  const payload = {
    platforms: { threads: { text } },
    draft_title: title,
  };

  // plan_at と publish_at は排他。既定は plan_at（本人確認あり）。
  if (autoPublish) {
    payload.publish_at = scheduledAt;
  } else {
    payload.plan_at = scheduledAt;
  }

  return request(`/social-sets/${socialSetId}/drafts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
