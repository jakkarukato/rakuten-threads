// ============================================================
//  ステップ1：投稿内容の準備（まだ投稿はしない）
//   1. 日替わりのジャンルで楽天の売れ筋ランキングを取得
//   2. 過去に紹介済みの商品を除外
//   3. 紹介文を生成（#PR付き・テンプレは日替わり）
//   4. out/post.json に書き出し、Actionsのサマリーに表示
//  実際の投稿は、あなたが承認したあと publish.mjs が行います。
// ============================================================

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { fetchRanking } from "./rakuten.mjs";
import { buildPostText } from "./templates.mjs";

const HISTORY_PATH = path.join(process.cwd(), "state", "posted.json");
const OUT_PATH = path.join(process.cwd(), "out", "post.json");

// ---------- 日本時間 ----------
function jstParts(date = new Date()) {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return {
    year,
    month,
    day,
    dayOfYear: Math.floor(
      (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000
    ),
  };
}

async function loadHistory() {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

/** GitHub Actions に値を渡す */
async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

/** 承認画面で内容を確認できるよう、実行サマリーに書き出す */
async function writeSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
  }
}

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
    await setOutput("has_post", "0");
    await writeSummary(
      `## 本日はスキップ\n\n${genre.name} のランキングに、まだ紹介していない商品がありませんでした。`
    );
    return;
  }

  const text = buildPostText({
    item: candidate,
    genre,
    dayIndex: today.dayOfYear,
    // 承認時のコメントを入れる余白を残しておく
    reserve: config.commentReserve,
  });

  console.log("\n----- 生成された投稿文 -----");
  console.log(text);
  console.log(`--------------------------- (${text.length}文字)`);

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        text,
        itemCode: candidate.itemCode,
        itemName: candidate.itemName,
        genre: genre.name,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  await setOutput("has_post", "1");

  // ★承認する人がここを読んで判断します
  await writeSummary(
    [
      `## 投稿内容の確認`,
      ``,
      `**ジャンル**: ${genre.name} / **${text.length}文字**`,
      ``,
      "```",
      text,
      "```",
      ``,
      `**承認するときのコメント欄に書いた一言が、投稿の先頭に入ります。**`,
      ``,
      `使ったことがある物なら、そのまま感想を。`,
      `使っていない物は「使った」と書かないこと。`,
      `「〇〇からの乗り換え先を探してて、これが候補に残ってる」のように、`,
      `買う前の目線で書けば嘘にならず、読む人の反応も変わりません。`,
      ``,
      ``,
      `下の **Review deployments** から承認してください。`,
      `承認しなければ投稿されません。`,
    ].join("\n")
  );
}

run().catch((error) => {
  console.error("\n[エラー]");
  console.error(error.message);
  process.exit(1);
});
