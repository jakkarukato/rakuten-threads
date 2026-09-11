// ============================================================
//  Threadsの長期トークンを更新し、GitHub Secretsに書き戻す。
//  トークンは絶対に標準出力へ出さない（公開リポジトリではログも公開されるため）。
// ============================================================

import { execFileSync } from "node:child_process";
import { refreshAccessToken } from "./threads.mjs";

const { token, expiresInDays } = await refreshAccessToken();
console.log(`トークンを更新しました。あと約${expiresInDays}日有効です。`);

const repo = process.env.GITHUB_REPOSITORY;
if (!process.env.GH_TOKEN) {
  throw new Error(
    "GH_TOKEN（Secrets書き込み権限のあるPAT）が未設定のため、Secretsを更新できません。\n" +
      "GH_PAT シークレットを登録してください。"
  );
}

// 標準入力経由で渡す。コマンドライン引数に載せるとプロセス一覧から見える可能性がある。
execFileSync("gh", ["secret", "set", "THREADS_ACCESS_TOKEN", "--repo", repo], {
  input: token,
  stdio: ["pipe", "inherit", "inherit"],
});

console.log("THREADS_ACCESS_TOKEN を更新しました。");
