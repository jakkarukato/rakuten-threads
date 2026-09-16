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
  // 付ける場合は上部に置くのが適切とされている。ユーザーの希望で既定は付けない（"【PR】" にすると付く）。
  prLabel: "",

  // 紹介文全体の文字数（商品情報も含む）
  minLength: 400,
  // 無料提供などの商品で【PR】（5文字）を足しても500文字を超えないよう、少し余裕を持たせる
  maxLength: 495,
  // 範囲内の候補が複数あるときは、この文字数に近いものを選ぶ
  target: 460,

  // 各見出しに載せる最大数
  specLimit: 5,
  whoLimit: 4,
  checkLimit: 6,

  // ハッシュタグの最大数。商品から拾えたタグが少なくても、ジャンルのタグで5個以上になるようにする
  tagMax: 8,
};

// ------------------------------------------------------------
//  商品の種類・機能ごとの「向いている人」と「購入前に確かめたいこと」
//  当てはまるものは全部使う。書き出しの一文には、最初に当てはまったものを使う。
//  商品の種類を先に、どの商品にも付きやすい語（コンパクト等）を最後に並べる。
//  ★どちらも事実や一般的な注意だけ。使ってみた感想は書かない。
// ------------------------------------------------------------
const TOPICS = [
  // --- 商品の種類：家電 ---
  { pattern: /ヘアアイロン|カールアイロン|ストレートアイロン|コテ/, who: "髪のセットの時間を短くしたい人", check: "プレートの幅（mm）と、設定できる温度の範囲。" },
  { pattern: /ドライヤー/, who: "髪を乾かす時間を短くしたい人", check: "風量と本体の重さ、コードの長さ。" },
  { pattern: /除湿機|衣類乾燥/, who: "部屋干しの洗濯物を早く乾かしたい人", check: "1日あたりの除湿量（L）と、タンクの容量。" },
  { pattern: /豆乳メーカー|ミキサー|ブレンダー|スープメーカー/, who: "手作りの飲み物やスープを手軽に作りたい人", check: "一度に作れる量と、使ったあとに洗う部品の数。" },
  { pattern: /シュレッダー/, who: "家で書類をまとめて処分したい人", check: "一度に裁断できる枚数と、ホチキスの針やカードに対応しているか。" },
  { pattern: /自動調理|電気圧力鍋/, who: "料理の手間を減らしたい人", check: "容量によって一度に作れる量が変わるので、家族の人数に合うか。" },
  { pattern: /ロボット掃除機/, who: "掃除の時間を減らしたい人", check: "越えられる段差の高さと、充電台を置く場所があるか。" },
  { pattern: /冷蔵庫\s*マット|キズ防止|傷防止|床保護/, who: "床の傷やへこみが気になる人", check: "冷蔵庫の幅と奥行きに合うサイズか。置く前に測っておくと失敗しにくい。" },

  // --- 商品の種類：PC・周辺機器 ---
  { pattern: /デスクトップ\s*パソコン|ノート\s*パソコン|ノートPC|デスクトップPC/i, who: "新しくパソコンを用意したい人", check: "CPU・メモリ・ストレージの数値と、使いたいソフトの動作条件。" },
  { pattern: /プリンター|複合機/, who: "家で書類や写真を印刷したい人", check: "インクの種類と、スマホから印刷できるか。" },
  { pattern: /ブルーレイ|Blu-?ray|DVDドライブ|光学ドライブ/i, who: "ドライブのないPCでディスクを使いたい人", check: "再生用のソフトが付属しているか。PCの接続端子（USB-A / USB-C）に合うか。" },
  { pattern: /microSD|SDカード|SSD|USBメモリ|外付けHDD|ハードディスク|HDD/i, who: "写真や動画をたくさん保存したい人", check: "使う機器が対応している容量と規格。" },

  // --- 商品の種類：オーディオ・映像 ---
  { pattern: /Fire TV|ストリーミング|Chromecast/i, who: "テレビで動画配信を見たい人", check: "テレビのHDMI端子に空きがあるか。" },
  { pattern: /テレビ保護パネル|液晶保護パネル/, who: "テレビの画面を傷や衝撃から守りたい人", check: "テレビのインチ数と、取り付け方法。" },
  { pattern: /骨伝導|オープンイヤー|イヤーカフ|耳を塞がない|耳をふさがない/, who: "耳をふさがずに音を聞きたい人", check: "音量を上げると音漏れしやすいので、使う場所に合うか。" },
  { pattern: /イヤホン|ヘッドホン|ヘッドフォン/, who: "通勤や家事の合間に音楽を聴きたい人", check: "連続再生時間と、ケースを含めた合計の再生時間。" },

  // --- 商品の種類：スマホまわり ---
  { pattern: /カメラ保護|カメラフィルム|レンズ保護/, who: "スマホのカメラの傷が気になる人", check: "対応機種の型番。似た名前の機種と間違えやすい。" },
  { pattern: /保護フィルム|ガラスフィルム/, who: "画面の傷や割れが心配な人", check: "対応機種の型番と、ケースと干渉しないか。" },
  { pattern: /(iPhone|スマホ|Galaxy|Pixel|Android).{0,20}ケース|ケース.{0,10}(iPhone|スマホ)/i, who: "スマホを落としたときの傷や割れが心配な人", check: "対応機種と、カメラ部分やボタンの位置が合うか。" },

  // --- 機能 ---
  { pattern: /端子一体|ケーブル内蔵|ケーブル一体|直挿し/, who: "ケーブルを持ち歩くのが面倒な人", check: "本体の端子（USB-C / Lightning）が自分のスマホに合うか。" },
  { pattern: /(type-?c|USB|Lightning).{0,12}ケーブル|充電ケーブル/i, who: "充電やデータ転送のケーブルを買い替えたい人", check: "両端の端子の組み合わせと長さ、対応する充電の出力（W数）。" },
  { pattern: /MagSafe|マグセーフ/i, who: "マグネットで充電器やアクセサリーを付けたい人", check: "MagSafe対応の充電器やアクセサリーと組み合わせて使えるか。" },
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

// ジャンル全体に当てはまる「向いている人」（キーは config.mjs の genres[].id）
const GENRE_AUDIENCE = {
  564500: ["スマホを長く快適に使いたい人", "スマホまわりの小物を見直したい人"],
  100026: ["作業環境を整えたい人", "在宅での作業が多い人"],
  211742: ["音や映像まわりを充実させたい人", "家での楽しみを増やしたい人"],
  562637: ["暮らしを少し便利にしたい人", "毎日の手間を少し減らしたい人"],
};

// ------------------------------------------------------------
//  ハッシュタグ
//  商品名に出てきた言葉から、関連するものだけを付ける。
//  上から順に見て、当てはまったものを前に並べる（具体的なものほど前）。
// ------------------------------------------------------------
const TAG_RULES = [
  // --- スマホまわり ---
  { pattern: /モバイルバッテリー|\d{4,5}\s*mAh/i, tags: ["#モバイルバッテリー", "#充電器"] },
  { pattern: /充電器|急速充電|高速充電|PD対応|GaN|窒化ガリウム/i, tags: ["#充電器", "#急速充電"] },
  { pattern: /(type-?c|usb|lightning).{0,12}ケーブル|充電ケーブル/i, tags: ["#充電ケーブル"] },
  { scope: "full", pattern: /MagSafe|マグセーフ/i, tags: ["#MagSafe"] },
  { scope: "full", pattern: /ワイヤレス充電|\bQi2?\b/i, tags: ["#ワイヤレス充電"] },
  { pattern: /iPhone.{0,20}ケース|ケース.{0,10}iPhone/i, tags: ["#iPhoneケース", "#スマホケース"] },
  { pattern: /スマホケース|(Galaxy|Pixel|Android).{0,20}ケース/i, tags: ["#スマホケース"] },
  { pattern: /ガラスフィルム|保護フィルム|画面保護/, tags: ["#保護フィルム", "#スマホアクセサリー"] },
  { pattern: /カメラ保護|レンズ保護|カメラフィルム/, tags: ["#カメラ保護", "#スマホアクセサリー"] },
  { pattern: /スマホ\s*リング|スマホスタンド|スマホホルダー|車載/, tags: ["#スマホスタンド"] },
  { pattern: /iPhone/i, tags: ["#iPhone"] },

  // --- オーディオ・映像・カメラ ---
  { pattern: /ワイヤレスイヤホン|完全ワイヤレス|Bluetooth.{0,8}イヤホン/i, tags: ["#ワイヤレスイヤホン", "#イヤホン"] },
  { pattern: /骨伝導|オープンイヤー|イヤーカフ|耳を(塞|ふさ)がない/, tags: ["#オープンイヤー", "#イヤホン"] },
  { pattern: /ヘッドホン|ヘッドフォン/, tags: ["#ヘッドホン"] },
  { pattern: /イヤホン/, tags: ["#イヤホン"] },
  { scope: "full", pattern: /ノイズキャンセリング|ノイキャン|\bANC\b/i, tags: ["#ノイズキャンセリング"] },
  { pattern: /スピーカー/, tags: ["#スピーカー", "#オーディオ"] },
  { pattern: /スマートウォッチ|活動量計/, tags: ["#スマートウォッチ"] },
  { pattern: /Fire\s*TV/i, tags: ["#FireTVStick", "#おうち時間"] },
  { pattern: /Chromecast|ストリーミング/i, tags: ["#ストリーミング", "#おうち時間"] },
  { pattern: /テレビ保護パネル|液晶保護パネル/, tags: ["#テレビ", "#液晶保護"] },
  { pattern: /プロジェクター/, tags: ["#プロジェクター", "#おうち時間"] },
  { pattern: /三脚|ジンバル|一眼|ミラーレス|望遠レンズ/, tags: ["#カメラ", "#カメラ好き"] },

  // --- 記録メディア・PC周辺機器 ---
  { pattern: /microSD|SDXC|SDHC|SDカード/i, tags: ["#microSD", "#SDカード"] },
  { pattern: /外付け\s*(SSD|HDD)|ポータブルSSD|外付けハードディスク/i, tags: ["#外付けストレージ"] },
  { pattern: /\bSSD\b|NVMe/i, tags: ["#SSD"] },
  { pattern: /\bHDD\b|ハードディスク/i, tags: ["#ハードディスク"] },
  { pattern: /USBメモリ/i, tags: ["#USBメモリ"] },
  { pattern: /キーボード/, tags: ["#キーボード", "#デスク環境"] },
  { pattern: /マウス|トラックボール/, tags: ["#マウス", "#デスク環境"] },
  { pattern: /モニター|ディスプレイ/, tags: ["#モニター", "#デスク環境"] },
  { pattern: /モニターアーム|デスクライト|PCスタンド|ノートパソコンスタンド/, tags: ["#デスク環境", "#作業効率化"] },
  { pattern: /USBハブ|ドッキングステーション|変換アダプタ/i, tags: ["#USBハブ", "#PC周辺機器"] },
  { pattern: /プリンター|複合機/, tags: ["#プリンター"] },
  { pattern: /ブルーレイ|Blu-?ray|DVDドライブ|光学ドライブ/i, tags: ["#外付けドライブ", "#PC周辺機器"] },
  { pattern: /シュレッダー/, tags: ["#シュレッダー", "#書類整理"] },
  { pattern: /ノート\s*パソコン|ノートPC|デスクトップ\s*(パソコン|PC)/i, tags: ["#パソコン"] },
  { pattern: /ルーター|Wi-?Fi\s*[67]|無線LAN|中継機/i, tags: ["#WiFiルーター", "#ネット環境"] },

  // --- 家電・暮らし ---
  { pattern: /ドライヤー/, tags: ["#ドライヤー", "#ヘアケア"] },
  { pattern: /ヘアアイロン|カールアイロン|ストレートアイロン|コテ/, tags: ["#ヘアアイロン", "#ヘアケア"] },
  { pattern: /脱毛器|美顔器|美容家電/, tags: ["#美容家電"] },
  { pattern: /除湿機|衣類乾燥/, tags: ["#除湿機", "#部屋干し"] },
  { pattern: /加湿器/, tags: ["#加湿器", "#乾燥対策"] },
  { pattern: /空気清浄機/, tags: ["#空気清浄機"] },
  { pattern: /ロボット掃除機/, tags: ["#ロボット掃除機", "#時短家電"] },
  { pattern: /掃除機|クリーナー/, tags: ["#掃除機", "#掃除グッズ"] },
  { pattern: /自動調理|電気圧力鍋|スープメーカー/, tags: ["#キッチン家電", "#時短家電"] },
  { pattern: /ミキサー|ブレンダー|豆乳メーカー/, tags: ["#キッチン家電"] },
  { pattern: /電子レンジ|オーブン|トースター|炊飯器|ケトル|コーヒーメーカー|ホットプレート/, tags: ["#キッチン家電"] },
  { pattern: /冷蔵庫\s*マット|キズ防止|傷防止|床保護/, tags: ["#床保護", "#新生活"] },
  { pattern: /冷蔵庫|洗濯機|エアコン/, tags: ["#生活家電"] },
  { pattern: /扇風機|サーキュレーター/, tags: ["#サーキュレーター"] },
  { pattern: /電気毛布|ヒーター|こたつ|暖房|セラミックファン/, tags: ["#あったかグッズ"] },

  // --- 機能（最後に調べる） ---
  { scope: "full", pattern: /防水|IPX?\d/i, tags: ["#防水"] },
  { scope: "full", pattern: /静音/, tags: ["#静音"] },
  { scope: "full", pattern: /大容量/, tags: ["#大容量"] },
  { scope: "full", pattern: /Nano|ミニ|超小型|コンパクト|軽量/i, tags: ["#コンパクト"] },
];

// メーカー名。商品名に出てきたものだけ付ける
const BRAND_TAGS = [
  [/\bAnker\b/i, "#Anker"],
  [/TORRAS/i, "#TORRAS"],
  [/エレコム|ELECOM/i, "#エレコム"],
  [/バッファロー|BUFFALO/i, "#バッファロー"],
  [/SanDisk|サンディスク/i, "#SanDisk"],
  [/ロジクール|Logicool/i, "#ロジクール"],
  [/アイリスオーヤマ|アイリスプラザ|IRIS\s*OHYAMA/i, "#アイリスオーヤマ"],
  [/recolte|レコルト/i, "#レコルト"],
  [/SOUNDPEATS/i, "#SOUNDPEATS"],
  [/EarFun/i, "#EarFun"],
  [/\bJBL\b/i, "#JBL"],
  [/\bBOSE\b/i, "#BOSE"],
  [/\bSONY\b|ソニー/i, "#ソニー"],
  [/シャープ|SHARP/i, "#シャープ"],
  [/パナソニック|Panasonic/i, "#パナソニック"],
  [/Xiaomi|シャオミ/i, "#Xiaomi"],
  [/UGREEN/i, "#UGREEN"],
  [/Baseus/i, "#Baseus"],
  [/AVIOT/i, "#AVIOT"],
  [/\bCIO\b/, "#CIO"],
  [/山善|YAMAZEN/i, "#山善"],
  [/\bAmazon\b|アマゾン/i, "#Amazon"],
];

// ジャンルごとのタグ（商品から拾えたタグが少ないときの補い。config.mjs の genres[].tag とは別）
const GENRE_TAGS = {
  564500: ["#スマホアクセサリー", "#ガジェット", "#便利グッズ"],
  100026: ["#デスク環境", "#作業効率化", "#ガジェット"],
  211742: ["#オーディオ", "#おうち時間", "#ガジェット好きな人と繋がりたい"],
  562637: ["#時短家電", "#便利家電", "#暮らしを整える"],
};

// どの商品にも付けるタグ
const BASE_TAGS = ["#楽天ROOM", "#楽天市場"];

// 商品そのものを表すタグを探す範囲（商品名の先頭からの文字数）
const HEAD_LENGTH = 36;

/**
 * 商品名から関連するハッシュタグを作る。
 * 具体的なもの（商品の種類 → メーカー → ジャンル → 楽天）の順に並べ、最大 tagMax 個まで。
 */
export function buildTags(item, genre) {
  const name = cleanItemName(String(item.itemName ?? ""), 300);
  // 商品名の後ろには「対応機種」や付属品が並ぶことが多い。
  // 商品そのものを表すタグは先頭だけを見て、機能を表すタグ（防水・静音など）は全体を見る。
  const head = name.slice(0, HEAD_LENGTH);

  const pick = (text, scope) => {
    const found = [];
    for (const rule of TAG_RULES) {
      const target = rule.scope === "full" ? text : scope;
      if (rule.pattern.test(target)) found.push(...rule.tags);
    }
    return found;
  };

  // 先頭からは何も拾えなかったときだけ、商品名の全体から探す
  let matched = pick(name, head);
  if (!matched.length) matched = pick(name, name);

  const brand = BRAND_TAGS.find(([pattern]) => pattern.test(head));
  const tags = unique([
    ...matched,
    brand ? brand[1] : "",
    genre.tag,
    ...(GENRE_TAGS[genre.id] ?? []),
    ...BASE_TAGS,
  ]);
  return tags.slice(0, COMMENT.tagMax);
}

// どの商品にも当てはまる「購入前にチェック」
const GENERIC_CHECKS = [
  "価格はセールやクーポンで変わるので、購入前の最新価格。",
  "高評価だけでなく、低評価のレビューに書かれている内容。",
  "色やサイズ違いがある場合、選び間違いがないか。",
  "配送日とポイント倍率。ショップによって違う。",
  "保証期間と、困ったときの問い合わせ先。",
  "付属品（ケーブルや説明書など）に何が含まれているか。",
  "返品や交換の条件。ショップによって違う。",
];

// 書き出しの一文。「〇〇そう。」は使わない
const LEAD_TEMPLATES = [
  (who) => `${who}向けのアイテム。`,
  (who) => `${who}なら、チェックしておきたい一品。`,
  (who) => `${who}の選択肢に入れておきたいアイテム。`,
  (who) => `${who}に向けたアイテム。`,
];

// 選んだ基準の一文（config.filter の実際の条件から作る）
const SELECTION_TEMPLATES = [
  (genre, f) => `${genre.name}の売れ筋ランキングから、レビュー★${f.avg}以上・${f.count}件以上の商品を選んでいます。`,
  (genre, f) => `レビュー★${f.avg}以上、${f.count}件以上の商品だけを、${genre.name}の売れ筋から選んでいます。`,
];

// 締めの一文
const CLOSING_TEMPLATES = [
  "詳しい仕様やサイズは、商品ページで確認してみてください。",
  "気になったら、商品ページでレビューの中身もあわせて見てみてください。",
  "購入前に、商品ページで最新の価格と在庫をチェックしてみてください。",
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

/**
 * 商品名。
 * ・「A / A iPhone 17/16…」のように「 / 」で同じ名前を繰り返している場合は最初の部分だけにする
 * ・名前の中にスペックが出てきたら、そこで切る（スペック欄と二重になるため）
 */
export function displayName(rawName, specs) {
  let name = cleanItemName(rawName, 200);
  const first = name.split(/\s+\/\s+/)[0];
  if (first.length >= 8) name = first;
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
  const tags = buildTags(item, genre);
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
  const filter = {
    avg: Number(config.filter.minReviewAverage).toFixed(1),
    count: Number(config.filter.minReviewCount),
  };
  const selection = SELECTION_TEMPLATES[(seed >>> 5) % SELECTION_TEMPLATES.length](genre, filter);
  const closing = CLOSING_TEMPLATES[(seed >>> 7) % CLOSING_TEMPLATES.length];

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

  const compose = (p) => {
    const lines = [];
    if (COMMENT.prLabel) lines.push(COMMENT.prLabel);
    if (lead) lines.push(lead);
    lines.push(numbers);
    if (p.selection) lines.push(selection);
    lines.push("", `■${name}`, `${yen(item.itemPrice)} / ★${stars}（レビュー${count}件）`);
    if (p.s > 0) lines.push("", "■注目ポイント", ...bullets.slice(0, p.s).map((b) => `・${b}`));
    if (p.w > 0) lines.push("", "■こんな人に", ...otherWho.slice(0, p.w).map((w) => `・${w}`));
    if (p.c > 0) lines.push("", "■購入前にチェック", ...checks.slice(0, p.c).map((c) => `・${c}`));
    if (p.closing) lines.push("", closing);
    if (tags.length) lines.push("", tags.join(" "));
    return lines.join("\n");
  };

  // 載せる項目の数を変えた候補を全部作り、400〜500文字に収まるものを選ぶ
  const plans = [];
  for (let s = bullets.length; s >= 0; s--) {
    for (let w = Math.min(COMMENT.whoLimit, otherWho.length); w >= 0; w--) {
      for (let c = Math.min(COMMENT.checkLimit, checks.length); c >= 0; c--) {
        for (const selectionOn of [true, false]) {
          for (const closingOn of [true, false]) {
            const p = { s, w, c, selection: selectionOn, closing: closingOn };
            p.text = compose(p);
            plans.push(p);
          }
        }
      }
    }
  }

  const extras = (p) => Number(p.selection) + Number(p.closing);
  const inRange = plans.filter(
    (p) => p.text.length >= COMMENT.minLength && p.text.length <= COMMENT.maxLength
  );
  let chosen;
  if (inRange.length) {
    // スペックを多く、選んだ基準と締めの一文も入れ、その中で目標の文字数に近いもの
    chosen = inRange.sort(
      (a, b) =>
        b.s - a.s ||
        extras(b) - extras(a) ||
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
