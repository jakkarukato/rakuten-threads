// ============================================================
//  楽天ROOMの紹介文を組み立てる
//
//  ・事実から言えることだけで書く（使用感や、書き手の気持ちは書かない）
//  ・「〇〇そう。」のような同じ言い回しを毎回くり返さない
//  ・楽天ROOMの投稿は500文字まで。400〜500文字に収まるよう、載せる項目の数を調整する
//
//  Node.js の機能に依存しない（ブラウザでも動かして確認できるようにするため）
// ============================================================

import { config } from "./config.mjs";
import { cleanItemName, extractSpecs, pickSpecNote } from "./templates.mjs";

export const COMMENT = {
  // 先頭の広告表記。楽天アフィリエイトの公式ガイドラインでは通常のアフィリエイト投稿は任意だが、
  // 付ける場合は上部に置くのが適切とされている。不要なら "" にする。
  prLabel: "【PR】",

  // 紹介文全体の文字数（商品情報も含む）
  minLength: 400,
  maxLength: 500,
  // 範囲内の候補が複数あるときは、この文字数に近いものを選ぶ
  target: 460,

  // 「注目ポイント」に載せるスペックの最大数
  specLimit: 5,
};

// ------------------------------------------------------------
//  商品の種類・機能ごとの「向いている人」と「購入前に確かめたいこと」
//  上から順に調べる。商品の種類を先に、どの商品にも付きやすい語（コンパクト等）を最後に。
//  ★どちらも事実や一般的な注意だけ。使ってみた感想は書かない。
// ------------------------------------------------------------
const TOPICS = [
  // --- 商品の種類 ---
  { pattern: /シュレッダー/, who: "家で書類をまとめて処分したい人", check: "一度に裁断できる枚数と、ホチキスの針やカードに対応しているか。" },
  { pattern: /自動調理|電気圧力鍋/, who: "料理の手間を減らしたい人", check: "容量によって一度に作れる量が変わるので、家族の人数に合うか。" },
  { pattern: /ロボット掃除機/, who: "掃除の時間を減らしたい人", check: "越えられる段差の高さと、充電台を置く場所があるか。" },
  { pattern: /冷蔵庫\s*マット|キズ防止|傷防止|床保護/, who: "床の傷やへこみが気になる人", check: "冷蔵庫の幅と奥行きに合うサイズか。置く前に測っておくと失敗しにくい。" },
  { pattern: /Fire TV|ストリーミング|Chromecast/i, who: "テレビで動画配信を見たい人", check: "テレビのHDMI端子に空きがあるか。" },
  { pattern: /ブルーレイ|Blu-?ray|DVDドライブ|光学ドライブ/i, who: "ドライブのないPCでディスクを使いたい人", check: "再生用のソフトが付属しているか。PCの接続端子（USB-A / USB-C）に合うか。" },
  { pattern: /microSD|SDカード|SSD|USBメモリ|外付けHDD/i, who: "写真や動画をたくさん保存したい人", check: "使う機器が対応している最大容量と規格。" },
  { pattern: /カメラ保護|カメラフィルム|レンズ保護/, who: "スマホのカメラの傷が気になる人", check: "対応機種の型番。似た名前の機種と間違えやすい。" },
  { pattern: /保護フィルム|ガラスフィルム/, who: "画面の傷や割れが心配な人", check: "対応機種の型番と、ケースと干渉しないか。" },
  { pattern: /骨伝導|オープンイヤー|耳を塞がない|耳をふさがない/, who: "耳をふさぐのが苦手な人", check: "音量を上げると音漏れしやすいので、使う場所に合うか。" },

  // --- 機能 ---
  { pattern: /端子一体|ケーブル内蔵|ケーブル一体|直挿し/, who: "ケーブルを持ち歩くのが面倒な人", check: "本体の端子（USB-C / Lightning）が自分のスマホに合うか。" },
  { pattern: /ノイズキャンセリング|ノイキャン|\bANC\b/i, who: "電車や人の多い場所で音楽を聴く人", check: "ノイズキャンセリングの効き方は環境で変わるので、レビューの声もあわせて。" },
  { pattern: /マルチポイント/, who: "スマホとPCを行き来しながら使う人", check: "同時に接続できる台数と、対応している機器。" },
  { pattern: /外音取り込み|ヒアスルー|アンビエント/, who: "つけたまま周りの音も聞きたい人", check: "外音取り込みの切り替え方法（ボタンかアプリか）。" },
  { pattern: /低遅延|ゲーミング|ゲームモード/, who: "動画やゲームで音のズレが気になる人", check: "低遅延モードが使える接続方法と対応機器。" },
  { pattern: /IPX?\d|防水|防滴/i, who: "運動中や雨の日にも使いたい人", check: "防水等級（IPX〇）の数字。数字によって耐えられる水の量が違う。" },
  { pattern: /GaN|窒化ガリウム/i, who: "充電器を小さく軽くしたい人", check: "出力（W数）と、同時に充電できるポートの数。" },
  { pattern: /急速充電|高速充電|PD対応|PPS/i, who: "充電を待つ時間を短くしたい人", check: "急速充電を活かすには、ケーブルとスマホ側の対応も必要。" },
  { pattern: /(1\d|[2-9]\d)\d{3}\s*mAh|大容量/i, who: "外出が長い日や旅行に持っていきたい人", check: "容量が大きいほど重くなるので、持ち歩く頻度とのバランス。" },
  { pattern: /静音/, who: "動作音が気になる場所で使いたい人", check: "動作音の大きさ（dB）が書かれているか。" },

  // --- 最後に調べる ---
  { pattern: /Nano|ミニ|超小型|コンパクト|軽量/i, who: "荷物を少しでも軽くしたい人", check: "サイズと重さの数値。" },
];

// どのジャンルでも当てはまる「向いている人」（キーは config.mjs の genres[].id）
const GENRE_AUDIENCE = {
  564500: ["スマホを長く快適に使いたい人", "スマホまわりの小物を見直したい人"],
  100026: ["作業環境を整えたい人", "在宅での作業が多い人"],
  211742: ["音や映像まわりを充実させたい人", "家での楽しみを増やしたい人"],
  562637: ["暮らしを少し便利にしたい人", "家事の手間を減らしたい人"],
};

// どの商品にも当てはまる「購入前にチェック」
const GENERIC_CHECKS = [
  "価格はセールやクーポンで変わるので、購入前の最新価格。",
  "高評価だけでなく、低評価のレビューに書かれている内容。",
  "色やサイズ違いがある場合、選び間違いがないか。",
  "配送日とポイント倍率。ショップによって違う。",
];

// 書き出しの一文。「〇〇そう。」は使わない
const LEAD_TEMPLATES = [
  (who) => `${who}向けのアイテム。`,
  (who) => `${who}なら、チェックしておきたい一品。`,
  (who) => `${who}の選択肢に入れておきたいアイテム。`,
  (who) => `${who}に向けたアイテム。`,
];

// ---------- 小道具 ----------
const yen = (price) => `${Number(price).toLocaleString("ja-JP")}円`;

/** 商品ごとに決まった数を返す（同じ商品なら毎回同じ言い回し、商品が変われば変わる） */
function hashOf(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

const unique = (list) => [...new Set(list.filter(Boolean))];

const rotate = (list, n) => {
  if (!list.length) return list;
  const k = n % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
};

/** 商品名。名前の中にスペックが出てきたら、そこで切る（スペック欄と二重になるため） */
export function displayName(rawName, specs) {
  let name = cleanItemName(rawName, 200);
  const cut = specs
    .map((spec) => name.indexOf(spec))
    .filter((i) => i > 6)
    .sort((a, b) => a - b)[0];
  if (cut !== undefined) name = name.slice(0, cut).trim();
  return name.length > 60 ? name.slice(0, 59) + "…" : name;
}

/** レビューの数字について（事実から言える範囲） */
function reviewSentence(item, seed) {
  const count = Number(item.reviewCount);
  const average = Number(item.reviewAverage);
  const stars = average.toFixed(1);
  const variant = seed % 2;

  if (count >= 1000 && average >= 4.4) {
    const rounded = `${(Math.floor(count / 1000) * 1000).toLocaleString("ja-JP")}件以上`;
    return variant === 0
      ? `レビュー${rounded}で★${stars}。これだけ数があると、選ぶときの安心感がちがう。`
      : `レビュー${rounded}で★${stars}。数も評価もそろっているのは強い。`;
  }
  if (count >= 300 && average >= 4.3) {
    const shown = count.toLocaleString("ja-JP");
    return variant === 0
      ? `レビュー${shown}件で★${stars}。評価が安定していて、参考にしやすい。`
      : `レビュー${shown}件で★${stars}。買った人の満足度が高めなのが分かる。`;
  }
  if (average >= 4.6) return `★${stars}と、かなり高めの評価。`;
  return `レビューは${count.toLocaleString("ja-JP")}件で★${stars}。`;
}

/**
 * 紹介文を作る。
 * @param {object} item 楽天ランキングAPIの商品
 * @param {object} genre config.mjs の genres の要素
 * @returns {{ name: string, text: string }}
 */
export function buildComment(item, genre) {
  const seed = hashOf(item.itemCode);
  const specs = extractSpecs(item.itemName, COMMENT.specLimit);
  const name = displayName(item.itemName, specs);
  const topics = TOPICS.filter((t) => t.pattern.test(`${item.itemName} ${specs.join(" ")}`));

  const whoList = unique([
    ...topics.map((t) => t.who),
    ...(GENRE_AUDIENCE[genre.id] ?? []),
    Number(item.reviewCount) >= 300 ? "レビューの多い定番から選びたい人" : "",
    Number(item.itemPrice) <= 3000 ? "予算を抑えて選びたい人" : "",
  ]);
  const checks = unique([...topics.map((t) => t.check), ...rotate(GENERIC_CHECKS, seed)]);

  const lead = whoList.length ? LEAD_TEMPLATES[seed % LEAD_TEMPLATES.length](whoList[0]) : "";
  const rank = Number(item.rank);
  const rankText =
    rank >= 1 && rank <= config.rankThreshold ? `${genre.name}のランキングでは${rank}位。` : "";
  const numbers = `${reviewSentence(item, seed >>> 3)}${rankText}`;

  // 専門用語の言い換えは、最初に該当した1つだけ添える
  let noted = false;
  const bullets = specs.map((spec) => {
    const note = noted ? "" : pickSpecNote([spec]);
    if (!note) return spec;
    noted = true;
    return `${spec}（${note}）`;
  });

  const otherWho = whoList.slice(1);
  const stars = Number(item.reviewAverage).toFixed(1);
  const count = Number(item.reviewCount).toLocaleString("ja-JP");

  const compose = (specN, whoN, checkN) => {
    const lines = [];
    if (COMMENT.prLabel) lines.push(COMMENT.prLabel);
    if (lead) lines.push(lead);
    lines.push(numbers);
    lines.push("", `■${name}`, `${yen(item.itemPrice)} / ★${stars}（レビュー${count}件）`);
    if (specN > 0) lines.push("", "■注目ポイント", ...bullets.slice(0, specN).map((b) => `・${b}`));
    if (whoN > 0) lines.push("", "■こんな人に", ...otherWho.slice(0, whoN).map((w) => `・${w}`));
    if (checkN > 0) lines.push("", "■購入前にチェック", ...checks.slice(0, checkN).map((c) => `・${c}`));
    if (genre.tag) lines.push("", genre.tag);
    return lines.join("\n");
  };

  // 載せる項目の数を変えた候補を全部作り、400〜500文字に収まるものを選ぶ
  const plans = [];
  for (let s = bullets.length; s >= 0; s--) {
    for (let w = Math.min(3, otherWho.length); w >= 0; w--) {
      for (let c = Math.min(3, checks.length); c >= 0; c--) {
        plans.push({ s, text: compose(s, w, c) });
      }
    }
  }

  const inRange = plans.filter(
    (p) => p.text.length >= COMMENT.minLength && p.text.length <= COMMENT.maxLength
  );
  let chosen;
  if (inRange.length) {
    // スペックを多く載せられるものを優先し、その中で目標の文字数に近いもの
    chosen = inRange.sort(
      (a, b) =>
        b.s - a.s ||
        Math.abs(a.text.length - COMMENT.target) - Math.abs(b.text.length - COMMENT.target)
    )[0];
  } else {
    // 400文字に届かない場合は、500文字以内でいちばん長いもの
    const fits = plans.filter((p) => p.text.length <= COMMENT.maxLength);
    chosen = fits.length
      ? fits.sort((a, b) => b.text.length - a.text.length)[0]
      : plans[plans.length - 1];
  }

  let text = chosen.text;
  if (text.length > COMMENT.maxLength) text = text.slice(0, COMMENT.maxLength - 1) + "…";
  return { name, text };
}
