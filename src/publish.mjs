// ============================================================
//  ステップ2：承認後の投稿
//
//  out/post.json を読み、Threadsに投稿し、紹介済みリストを更新します。
//  このスクリプトは、あなたがGitHub上で承認したあとにのみ実行されます。
//
//  承認ダイアログのコメント欄に書いた一言は、投稿の先頭に差し込まれます。
//  「なぜ良いと思ったか」は機械には書けない（書けば嘘になる）ので、
//  そこだけは人が書く、という設計です。
// ============================================================

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { publishText } from "./threads.mjs";

const HISTORY_PATH = path.join(process.cwd(), "state", "posted.json");
const OUT_PATH = path.join(process.cwd(), "out", "post.json");

/** 承認時に書かれたコメントを取り出す */
async function fetchApprovalComment() {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !runId || !token) return "";

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/runs/${runId}/approvals`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) {
    console.log(`承認コメントを取得できませんでした (HTTP ${res.status})。コメント無しで続行します。`);
    return "";
  }

  const reviews = await res.json();
  const withComment = (Array.isArray(reviews) ? reviews : []).filter(
    (r) => r.state === "approved" && String(r.comment ?? "").trim()
  );
  const latest = withComment[withComment.length - 1];
  return latest ? String(latest.comment).trim() : "";
}

/** 【PR】の直後にあなたの一言を差し込む */
function insertComment(text, comment) {
  if (!comment) return text;

  const room = config.maxTextLength - text.length - 2;
  if (room < 10) {
    console.log("文字数に余裕がないため、コメントは差し込みませんでした。");
    return text;
  }

  let line = comment.replace(/\r/g, "").trim();
  if (line.length > room) line = line.slice(0, room - 1) + "…";

  const nl = text.indexOf("\n");
  if (nl < 0) return `${line}\n\n${text}`;
  return `${text.slice(0, nl + 1)}${line}\n\n${text.slice(nl + 1)}`;
}

async function run() {
  const payload = JSON.parse(await readFile(OUT_PATH, "utf-8"));

  const comment = await fetchApprovalComment();
  const text = insertComment(payload.text, comment);

  console.log(`投稿する商品: ${payload.itemName}`);
  console.log(comment ? `承認コメント: あり（${comment.length}文字）` : "承認コメント: なし");
  console.log(`本文: ${text.length}文字\n`);
  console.log("----- 実際に投稿する本文 -----");
  console.log(text);
  console.log("-----------------------------\n");

  const postId = await publishText(text);
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
    question: payload.question,
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
