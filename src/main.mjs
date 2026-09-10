// ============================================================
//  メイン処理
//   1. 日替わりのジャンルで楽天の売れ筋ランキングを取得
//   2. 過去に紹介済みの商品を除外
//   3. 紹介文を生成（#PR付き・テンプレは日替わり）
//   4. Typefullyに当日21時の枠で下書きを登録
// ============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { fetchRanking } from "./rakuten.mjs";
import { buildPostText } from "./templates.mjs";
import { createThreadsDraft } from "./typefully.mjs";

const HISTORY_PATH = path.join(process.cwd(), "state", "posted.json");
const DRY_RUN = process.env.DRY_RUN === "1";
const AUTO_PUBLISH = process.env.AUTO_PUBLISH === "1";

// ---------- 日本時間の扱い ----------
function jstParts(date = new Date()) {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return {
    year,
    month,
    day,
    hour: shifted.getUTCHours(),
    dayOfYear: Math.floor(
      (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000
    ),
  };
}

/** 次の投稿時刻（日本時間）をISO8601で返す。すでに過ぎていれば翌日。 */
function nextSlotIso() {
  const now = jstParts();
  let { year, month, day } = now;

  if (now.hour >= config.postHour) {
    ({ year, month, day } = jstParts(new Date(Date.now() + 86400000)));
  }

  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(config.postHour)}:${pad(
    config.postMinute
  )}:00+09:00`;
}

// ---------- 紹介済み商品の記録 ----------
async function loadHistory() {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

async function saveHistory(history) {
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  const trimmed = history.slice(-config.historyLimit);
  await writeFile(HISTORY_PATH, JSON.stringify(trimmed, null, 2) + "\n", "utf-8");
}

// ---------- 本体 ----------
async function run() {
  const today = jstParts();
  const genre = config.genres[today.dayOfYear % config.genres.length];
  console.log(`本日のジャンル: ${genre.name}（genreId=${genre.id}）`);

  const history = await loadHistory();
  const seen = new Set(history.map((entry) => entry.itemCode));

  const items = await fetchRanking(genre.id);
  console.log(`ランキング取得: 条件を満たす商品 ${items.length}件`);

  const candidate = items.find((item) => !seen.has(item.itemCode));
  if (!candidate) {
    console.log("紹介できる新しい商品が見つかりませんでした。今日はスキップします。");
    return;
  }

  const text = buildPostText({ item: candidate, genre, dayIndex: today.dayOfYear });
  const scheduledAt = nextSlotIso();

  console.log("\n----- 生成された投稿文 -----");
  console.log(text);
  console.log(`--------------------------- (${text.length}文字)`);
  console.log(`投稿予定: ${scheduledAt}`);
  console.log(`モード: ${AUTO_PUBLISH ? "publish_at（全自動投稿）" : "plan_at（要・本人確認）"}`);

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 のため、Typefullyへの登録はスキップしました。");
    return;
  }

  const draft = await createThreadsDraft({
    text,
    scheduledAt,
    autoPublish: AUTO_PUBLISH,
    title: `${genre.name} / ${today.year}-${today.month}-${today.day}`,
  });

  console.log(`\nTypefullyに登録しました。draft id: ${draft?.id ?? "(不明)"}`);

  history.push({
    itemCode: candidate.itemCode,
    itemName: candidate.itemName,
    genre: genre.name,
    postedAt: scheduledAt,
  });
  await saveHistory(history);
  console.log("紹介済みリストを更新しました。");
}

run().catch((error) => {
  console.error("\n[エラー]");
  console.error(error.message);
  process.exit(1);
});
