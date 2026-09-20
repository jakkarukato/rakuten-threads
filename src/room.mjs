// ============================================================
//  楽天ROOM用の「今日の候補」ページを作る
//
//   1. ジャンルごとに楽天の売れ筋ランキングを取得（config.filter で絞り込み済み）
//   2. 最近候補に出した商品は除く
//   3. ジャンルごとに上位から数件ずつ選ぶ
//   4. 紹介文の下書きを作る（スペック・価格・レビュー数など事実だけ）
//   5. docs/room/index.html に書き出す（GitHub Pages で公開される）
//
//  ★このツールは投稿しません。
//    楽天ROOMの規約は、プログラムで機械的に投稿する行為を禁止しています。
//    候補を見て「ROOMに投稿」を押し、紹介文を貼るのは、本人が手でやります。
// ============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { fetchRanking, sleep } from "./rakuten.mjs";
import { buildComment } from "./comment.mjs";

// ---------- 設定 ----------
const ROOM = {
  // 1日に出す候補の数
  total: 10,

  // 1つのジャンルから取る上限（ふだんは 3+3+2+2 で10件。取れないジャンルがあれば他のジャンルで補う）
  perGenre: 4,

  // 一度候補に出した商品を、何日間は出さないか
  skipDays: 60,

  // 紹介文の中身（文字数、PR表記など）の設定は src/comment.mjs の COMMENT にある。
};

const SHOWN_PATH = path.join(process.cwd(), "state", "room-shown.json");
const PAGE_PATH = path.join(process.cwd(), "docs", "room", "index.html");

// ---------- 小道具 ----------
const yen = (price) => `${Number(price).toLocaleString("ja-JP")}円`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** https で始まるURLだけを通す */
function safeUrl(url) {
  const text = String(url ?? "");
  return /^https:\/\//.test(text) ? text : "";
}

/** 日本時間の日付（例: 2026年9月15日(火)） */
function jstDateLabel(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

/** 商品画像のURL。APIの形式ゆれに対応し、少し大きめのサイズを指定する */
function imageUrlOf(item) {
  const first = item.mediumImageUrls?.[0];
  const url = typeof first === "string" ? first : first?.imageUrl;
  return safeUrl(url ? url.replace(/_ex=\d+x\d+/, "_ex=300x300") : "");
}

async function loadShown() {
  try {
    const data = JSON.parse(await readFile(SHOWN_PATH, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 商品ページのURL（ふつうの商品ページ）。
 * affiliateId を付けてランキングAPIを呼ぶと itemUrl もアフィリエイトリンクで返り、
 * しかも途中に改行が混ざってリンクが切れることがある。自分で開くためのリンクなので、
 * アフィリエイトリンクの pc パラメータから、元の商品ページのURLを取り出して使う。
 */
function plainItemUrl(item) {
  const raw = String(item.itemUrl ?? "").replace(/\s+/g, "");
  try {
    const url = new URL(raw);
    if (url.hostname === "hb.afl.rakuten.co.jp") {
      return safeUrl(url.searchParams.get("pc") ?? "");
    }
    return safeUrl(url.href);
  } catch {
    return "";
  }
}

// ---------- ページ ----------
function renderCard({ genre, item, name, comment }, index) {
  const image = imageUrlOf(item);
  const link = plainItemUrl(item);
  const rows = Math.min(26, comment.split("\n").length + 1);
  const rank = Number(item.rank) ? ` · ランキング${Number(item.rank)}位` : "";

  return `
  <article class="card">
    <div class="head">
      ${image ? `<img src="${escapeHtml(image)}" alt="" width="96" height="96" loading="lazy">` : ""}
      <div class="info">
        <p class="meta">${escapeHtml(genre.name)}${rank}</p>
        <h2>${escapeHtml(name)}</h2>
        <p class="price">${escapeHtml(yen(item.itemPrice))}<span>★${Number(item.reviewAverage).toFixed(1)}（${Number(item.reviewCount)}件）</span></p>
      </div>
    </div>
    <textarea id="c${index}" rows="${rows}" readonly>${escapeHtml(comment)}</textarea>
    <label class="pr-toggle"><input type="checkbox" data-pr="c${index}"> 無料提供・イベント参加・お試しクーポン利用の商品（【PR】を付ける）</label>
    <div class="actions">
      <button type="button" data-copy="c${index}">紹介文をコピー</button>
      ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">商品ページを開く</a>` : ""}
    </div>
  </article>`;
}

function renderPage(picks, generatedAt) {
  const cards = picks.map(renderCard).join("\n");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>今日の楽天ROOM候補</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f5f2; --card: #ffffff; --text: #1d1d1f; --sub: #6b6b70; --line: #e3e1dc; --accent: #bf0000; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #141414; --card: #1f1f1f; --text: #eeeeee; --sub: #a0a0a5; --line: #333333; --accent: #e04545; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; line-height: 1.6; }
  main { max-width: 40rem; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
  h1 { font-size: 1.35rem; margin: 0; }
  .date { color: var(--sub); margin: .25rem 0 1rem; }
  .steps { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: .75rem 1rem; margin-bottom: 1.25rem; font-size: .92rem; }
  .steps ol { margin: .25rem 0; padding-left: 1.25rem; }
  .steps p { margin: .4rem 0 0; color: var(--sub); font-size: .85rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
  .head { display: flex; gap: .875rem; align-items: flex-start; }
  .head img { width: 96px; height: 96px; object-fit: contain; border-radius: 8px; background: #ffffff; flex-shrink: 0; }
  .info { min-width: 0; }
  .meta { margin: 0; color: var(--sub); font-size: .8rem; }
  h2 { font-size: 1rem; margin: .15rem 0; overflow-wrap: anywhere; }
  .price { margin: 0; font-weight: 700; }
  .price span { font-weight: 400; color: var(--sub); margin-left: .5rem; font-size: .9rem; }
  textarea { width: 100%; margin-top: .75rem; padding: .6rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; font-size: .88rem; resize: vertical; }
  .pr-toggle { display: flex; gap: .4rem; align-items: center; margin-top: .5rem; font-size: .85rem; color: var(--sub); }
  .actions { display: flex; gap: .5rem; margin-top: .5rem; }
  .actions button, .actions a { flex: 1; text-align: center; padding: .7rem .5rem; border-radius: 8px; font: inherit; font-size: .92rem; font-weight: 600; text-decoration: none; cursor: pointer; }
  .actions button { background: var(--accent); color: #ffffff; border: none; }
  .actions a { background: transparent; color: var(--text); border: 1px solid var(--line); }
  footer { color: var(--sub); font-size: .8rem; text-align: center; margin-top: 2rem; }
  footer a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>今日の楽天ROOM候補</h1>
  <p class="date">${escapeHtml(jstDateLabel(generatedAt))} 更新 · ${picks.length}件</p>

  <section class="steps">
    <ol>
      <li>気になる商品の「紹介文をコピー」を押す</li>
      <li>「商品ページを開く」から、「ROOMに投稿」を押す</li>
      <li>コメント欄に貼って投稿する（書きたければ一言足す）</li>
    </ol>
    <p>使っていない商品を「使った」と書かないこと。オリジナル写真は自分で撮ったものだけ。</p>
  </section>
${cards}

  <footer>
    <p>毎朝6時ごろに自動で更新されます。このページのリンクはアフィリエイトリンクではありません。</p>
    <p>Supported by <a href="https://webservice.rakuten.co.jp/">楽天ウェブサービス</a></p>
  </footer>
</main>
<script>
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-copy]");
    if (!button) return;
    const area = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(area.value);
    } catch {
      area.select();
      document.execCommand("copy");
    }
    const label = button.textContent;
    button.textContent = "コピーしました";
    setTimeout(() => { button.textContent = label; }, 1500);
  });
  // 無料提供などの商品は【PR】が必須。チェックを入れたら紹介文の先頭に付け、外したら消す
  document.addEventListener("change", (event) => {
    const box = event.target.closest("input[data-pr]");
    if (!box) return;
    const area = document.getElementById(box.dataset.pr);
    const mark = "【PR】" + String.fromCharCode(10);
    const body = area.value.startsWith(mark) ? area.value.slice(mark.length) : area.value;
    area.value = box.checked ? mark + body : body;
  });
</script>
</body>
</html>
`;
}

// ---------- 本体 ----------
async function main() {
  const shown = await loadShown();
  const cutoff = Date.now() - ROOM.skipDays * 86_400_000;
  const recent = new Set(
    shown.filter((entry) => Date.parse(entry.shownAt) >= cutoff).map((entry) => entry.itemCode)
  );

  const lists = [];
  for (const [index, genre] of config.genres.entries()) {
    // 楽天APIのレート制限対策（1.5秒以上あける）
    if (index > 0) await sleep(2000);

    let items;
    try {
      items = await fetchRanking(genre.id);
    } catch (error) {
      console.error(`[${genre.name}] ランキングの取得に失敗しました\n${error.message}`);
      continue;
    }

    const fresh = items.filter((item) => !recent.has(item.itemCode));
    console.log(`${genre.name}: 条件を満たす商品 ${items.length}件 → まだ出していない商品 ${fresh.length}件`);
    lists.push({ genre, items: fresh });
  }

  // ジャンルを順番に回りながら1件ずつ取り、合計 ROOM.total 件になるまで選ぶ。
  // 3件取れるジャンルが日によって変わるように、開始するジャンルをずらす。
  const picks = [];
  if (lists.length) {
    const offset = Math.floor(Date.now() / 86_400_000) % lists.length;
    for (let round = 0; round < ROOM.perGenre && picks.length < ROOM.total; round++) {
      for (let i = 0; i < lists.length && picks.length < ROOM.total; i++) {
        const list = lists[(offset + i) % lists.length];
        const item = list.items[round];
        if (!item) continue;
        const { name, text } = buildComment(item, list.genre);
        picks.push({ genre: list.genre, item, name, comment: text });
      }
    }
  }

  if (picks.length < ROOM.total) {
    console.log(
      `※ 候補が ${picks.length}件しか選べませんでした（目標 ${ROOM.total}件）。` +
        `${ROOM.skipDays}日以内に出した商品は除いているためです。`
    );
  }

  if (picks.length === 0) {
    throw new Error(
      "候補が1件も選べませんでした。上のログで、ランキングの取得に失敗していないか確認してください。"
    );
  }

  const now = new Date();
  await mkdir(path.dirname(PAGE_PATH), { recursive: true });
  await writeFile(PAGE_PATH, renderPage(picks, now), "utf-8");

  const updated = [
    ...shown,
    ...picks.map(({ genre, item, name }) => ({
      itemCode: item.itemCode,
      name,
      genre: genre.name,
      shownAt: now.toISOString(),
    })),
  ].slice(-3000);
  await mkdir(path.dirname(SHOWN_PATH), { recursive: true });
  await writeFile(SHOWN_PATH, JSON.stringify(updated, null, 2) + "\n", "utf-8");

  console.log(`\n候補 ${picks.length}件でページを作りました: docs/room/index.html`);
  for (const { genre, name, comment } of picks) {
    console.log(`\n----- [${genre.name}] ${name} -----`);
    console.log(comment);
  }
}

main().catch((error) => {
  console.error("\n[エラー]");
  console.error(error.message);
  process.exit(1);
});
