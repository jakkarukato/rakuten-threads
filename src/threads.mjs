// ============================================================
//  Threads API (Meta)
//  ・投稿は2段階：メディアコンテナ作成 → 公開
//  ・トークンは60日で失効。24時間以上経過していれば更新できる
//  ・無料。1プロフィールあたり 250投稿 / 24時間
// ============================================================

const BASE = "https://graph.threads.net";
const VERSION = "v1.0";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません。`);
  return value;
}

async function post(path, params) {
  const res = await fetch(`${BASE}/${VERSION}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  const body = await res.text();
  if (!res.ok) {
    // トークンはログに出さない
    throw new Error(`Threads APIエラー (HTTP ${res.status}): ${body}`);
  }
  return JSON.parse(body);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * テキスト投稿を公開する。
 * @param {string} text 投稿本文（500文字以内）
 * @returns {Promise<string>} 公開された投稿のID
 */
export async function publishText(text) {
  const userId = requireEnv("THREADS_USER_ID");
  const accessToken = requireEnv("THREADS_ACCESS_TOKEN");

  if (text.length > 500) {
    throw new Error(`本文が500文字を超えています（${text.length}文字）。`);
  }

  console.log("① メディアコンテナを作成中…");
  const container = await post(`${userId}/threads`, {
    media_type: "TEXT",
    text,
    access_token: accessToken,
  });
  console.log(`   コンテナID: ${container.id}`);

  // 公式ドキュメントの推奨に従い、公開前に待機する
  console.log("   サーバー処理を30秒待機…");
  await sleep(30_000);

  console.log("② 投稿を公開中…");
  const published = await post(`${userId}/threads_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });

  return published.id;
}

/**
 * 長期トークンを更新する（有効期限が60日延びる）。
 * @returns {Promise<{token: string, expiresInDays: number}>}
 */
export async function refreshAccessToken() {
  const accessToken = requireEnv("THREADS_ACCESS_TOKEN");

  const params = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: accessToken,
  });

  const res = await fetch(`${BASE}/refresh_access_token?${params}`);
  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `トークン更新に失敗 (HTTP ${res.status}): ${body}\n` +
        "【対処】60日以上放置するとトークンは永久に失効します。" +
        "その場合はMetaの管理画面で取得し直してください。"
    );
  }

  const json = JSON.parse(body);
  return {
    token: json.access_token,
    expiresInDays: Math.round((json.expires_in ?? 0) / 86400),
  };
}
