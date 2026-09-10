// TYPEFULLY_SOCIAL_SET_ID を調べるための補助スクリプト
//   実行: node src/list-sets.mjs
import { listSocialSets } from "./typefully.mjs";

const sets = await listSocialSets();
console.log("接続済みアカウント一覧:\n");
for (const set of sets.data ?? sets) {
  console.log(`  id: ${set.id}`);
  console.log(`  name: ${set.name ?? "(名称なし)"}`);
  console.log("  ---");
}
console.log("\n↑の id を TYPEFULLY_SOCIAL_SET_ID に設定してください。");
