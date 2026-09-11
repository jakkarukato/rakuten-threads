// ============================================================
//  ステップ2：承認後の投稿
//  out/post.json を読み、Threadsに投稿し、紹介済みリストを更新します。
//  このスクリプトは、あなたがGitHub上で承認したあとにのみ実行されます。
// ============================================================

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { publishText } from "./threads.mjs";

const HISTORY_PATH = path.join(process.cwd(), "state", "posted.json");
const OUT_PATH = path.join(process.cwd(), "out", "post.json");

async function run() {
  const payload = JSON.parse(await readFile(OUT_PATH, "utf-8"));

  console.log(`投稿する商品: ${payload.itemName}`);
  console.log(`本文: ${payload.text.length}文字\n`);

  const postId = await publishText(payload.text);
  console.log(`\n投稿しました。post id: ${postId}`);

  // 成功したときだけ紹介済みに記録する
  let history = [];
  try {
    history = JSON.parse(await readFile(HISTORY_PATH, "utf-8"));
  } catch {
    history = [];
  }

  history.push({
    itemCode: payload.itemCode,
    itemName: payload.itemName,
    genre: payload.genre,
    postId,
    postedAt: new Date().toISOString(),
  });

  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeFile(
    HISTORY_PATH,
    JSON.stringify(history.slice(-config.historyLimit), null, 2) + "\n",
    "utf-8"
  );
  console.log("紹介済みリストを更新しました。");

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## 投稿完了\n\n${payload.itemName}\n\npost id: \`${postId}\`\n`
    );
  }
}

run().catch((error) => {
  console.error("\n[エラー]");
  console.error(error.message);
  process.exit(1);
});
