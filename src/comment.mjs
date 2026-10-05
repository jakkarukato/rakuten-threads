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
  minLength: 430,
  // 無料提供などの商品で【PR】（5文字）を足しても500文字を超えないよう、少し余裕を持たせる
  maxLength: 495,
  // 範囲内の候補が複数あるときは、この文字数に近いものを選ぶ
  target: 490,

  // 各見出しに載せる最大数
  specLimit: 6,
  whoLimit: 6,
  checkLimit: 6,

  // ハッシュタグの最大数。商品から拾えたタグが少なくても、ジャンルのタグで5個以上になるようにする
  tagMin: 5,
  tagMax: 8,
};

// ------------------------------------------------------------
//  商品の種類・機能ごとの「向いている人」と「購入前に確かめたいこと」
//  当てはまるものは全部使う。書き出しの一文には、最初に当てはまったものを使う。
//  商品の種類を先に、どの商品にも付きやすい語（コンパクト等）を最後に並べる。
//  ★どちらも事実や一般的な注意だけ。使ってみた感想は書かない。
// ------------------------------------------------------------
//  ★kind: "product" は商品の種類、"feature" は機能。書き出しの一文には商品の種類を使う。
//    noun は書き出しで使う言葉（「〇〇向けの【モバイルバッテリー】。」）。"$match" なら商品名に出てきた言葉をそのまま使う。
//    first: true は、商品名の先頭にあれば他より優先する（アクセサリーや、より細かい種類）。
const TOPICS = [
  // --- 商品の種類：家電 ---
  { kind: "product", noun: "ヘアアイロン", pattern: /ヘアアイロン|カールアイロン|ストレートアイロン|コテ/, who: "髪のセットの時間を短くしたい人", check: "プレートの幅（mm）と、設定できる温度の範囲。" },
  { kind: "product", noun: "ドライヤー", pattern: /ドライヤー/, who: "髪を乾かす時間を短くしたい人", check: "風量と本体の重さ、コードの長さ。" },
  { kind: "product", noun: "美容家電", pattern: /脱毛器|美顔器|美容家電|頭皮ケア/, who: "自宅でスキンケアやボディケアをしたい人", check: "使える部位と、替えパーツやカートリッジの有無。" },
  { kind: "product", first: true, noun: "布団乾燥機", pattern: /布団乾燥機|ふとん乾燥機/, who: "布団をふかふかに乾かしたい人", check: "ホースを差し込む手間があるか、ダニ対策モードが使えるか。" },
  { kind: "product", first: true, noun: "布団クリーナー", pattern: /布団クリーナー|ふとんクリーナー|レイコップ/, who: "布団のダニやホコリが気になる人", check: "本体の重さと、使うときの音の大きさ。" },
  { kind: "product", first: true, noun: "充電ステーション", pattern: /チャージングステーション|Charging\s*Station|充電ステーション|充電ドック|充電スタンド/i, who: "スマホや時計、イヤホンをまとめて充電したい人", check: "同時に充電できる数と、対応している規格（MagSafe・Qi）。" },
  { kind: "product", noun: "除湿機", pattern: /除湿機|除湿器|衣類乾燥/, who: "部屋干しの洗濯物を早く乾かしたい人", check: "1日あたりの除湿量（L）と、タンクの容量。" },
  { kind: "product", noun: "加湿器", pattern: /加湿器/, who: "冬の乾燥が気になる人", check: "適用畳数と、給水やお手入れのしやすさ。" },
  { kind: "product", noun: "空気清浄機", pattern: /空気清浄機/, who: "ホコリや花粉が気になる人", check: "適用畳数と、交換フィルターの値段。" },
  { kind: "product", noun: "サーキュレーター", pattern: /サーキュレーター|扇風機/, who: "部屋の空気を動かしたい人", check: "首振りの範囲と、風量の段階。" },
  { kind: "product", noun: "暖房グッズ", pattern: /電気毛布|こたつ|セラミックファンヒーター|パネルヒーター|ホットカーペット/, who: "足元や寝るときの寒さをどうにかしたい人", check: "電気代の目安と、洗えるかどうか。" },
  { kind: "product", first: true, noun: "ロボット掃除機", pattern: /ロボット掃除機/, who: "掃除の時間を減らしたい人", check: "越えられる段差の高さと、充電台を置く場所があるか。" },
  { kind: "product", noun: "掃除機", pattern: /掃除機|クリーナー|スティッククリーナー/, who: "家の掃除をこまめにしたい人", check: "連続で使える時間と、本体の重さ。紙パック式かサイクロン式か。" },
  { kind: "product", noun: "調理家電", pattern: /自動調理|電気圧力鍋|スープメーカー/, who: "料理の手間を減らしたい人", check: "容量によって一度に作れる量が変わるので、家族の人数に合うか。" },
  { kind: "product", noun: "キッチン家電", pattern: /豆乳メーカー|ミキサー|ブレンダー|フードプロセッサー/, who: "手作りの飲み物やスープを手軽に作りたい人", check: "一度に作れる量と、使ったあとに洗う部品の数。" },
  { kind: "product", noun: "コーヒーメーカー", pattern: /コーヒーメーカー|エスプレッソマシン|全自動コーヒー/, who: "家でいれたてのコーヒーを飲みたい人", check: "豆から挽けるか、使える豆や粉の種類。" },
  { kind: "product", noun: "$match", pattern: /炊飯器|トースター|電子レンジ|オーブン|電気ケトル|ホットプレート|卓上IH/, who: "毎日の食事の支度をラクにしたい人", check: "本体のサイズと、置き場所に収まるか。" },
  { kind: "product", first: true, noun: "冷蔵庫マット", pattern: /冷蔵庫\s*マット|キズ防止|傷防止|床保護/, who: "床の傷やへこみが気になる人", check: "冷蔵庫の幅と奥行きに合うサイズか。置く前に測っておくと失敗しにくい。" },
  { kind: "product", first: true, noun: "かさ上げ台", pattern: /かさ上げ|防振.{0,6}(マット|台)|洗濯機.{0,6}(台|マット)/, who: "洗濯機まわりの掃除や振動が気になる人", check: "洗濯機の脚の位置と、置き台の耐荷重。" },
  { kind: "product", noun: "$match", pattern: /冷蔵庫|洗濯機|エアコン/, who: "家電を新しくしたい人", check: "設置できるサイズと、搬入経路の幅。" },

  // --- 商品の種類：PC・周辺機器 ---
  { kind: "product", noun: "パソコン", pattern: /デスクトップ\s*パソコン|ノート\s*パソコン|ノートPC|デスクトップPC/i, who: "新しくパソコンを用意したい人", check: "CPU・メモリ・ストレージの数値と、使いたいソフトの動作条件。" },
  { kind: "product", noun: "モニター", pattern: /モニター|ディスプレイ/, who: "画面を広く使って作業したい人", check: "画面のサイズと解像度、リフレッシュレート（Hz）。" },
  { kind: "product", noun: "キーボード", pattern: /キーボード/, who: "打ちやすさにこだわりたい人", check: "接続方法（有線・Bluetooth）と、キー配列（日本語・英語）。" },
  { kind: "product", noun: "マウス", pattern: /マウス|トラックボール/, who: "手の負担を減らしたい人", check: "サイズと重さ、静音かどうか。電池式か充電式か。" },
  { kind: "product", noun: "USBハブ", pattern: /USBハブ|USB-?C\s*ハブ|ドッキングステーション/i, who: "パソコンの端子が足りない人", check: "使いたい端子の種類と数、映像出力に対応しているか。" },
  { kind: "product", noun: "Wi-Fiルーター", pattern: /ルーター|中継機|メッシュWi-?Fi/i, who: "家のネットが不安定で困っている人", check: "対応する回線の速度と、家の広さに合う推奨の間取り。" },
  { kind: "product", noun: "セキュリティソフト", pattern: /セキュリティソフト|ウイルス対策|ノートン|ウイルスバスター|マカフィー|ESET/i, who: "パソコンやスマホを安全に使いたい人", check: "使える台数と契約の年数、対応しているOS。" },
  { kind: "product", noun: "プリンター", pattern: /プリンター|複合機/, who: "家で書類や写真を印刷したい人", check: "インクの種類と、スマホから印刷できるか。" },
  { kind: "product", noun: "外付けドライブ", pattern: /ブルーレイ|Blu-?ray|DVDドライブ|光学ドライブ/i, who: "ドライブのないPCでディスクを使いたい人", check: "再生用のソフトが付属しているか。PCの接続端子（USB-A / USB-C）に合うか。" },
  { kind: "product", noun: "シュレッダー", pattern: /シュレッダー/, who: "家で書類をまとめて処分したい人", check: "一度に裁断できる枚数と、ホチキスの針やカードに対応しているか。" },
  { kind: "product", noun: "収納グッズ", pattern: /収納|ラック|アーム金具|壁掛け/, who: "置き場所をすっきり片づけたい人", check: "取り付けられる場所と、耐えられる重さ。" },
  { kind: "product", noun: "$match", pattern: /microSD|SDカード|USBメモリ/i, who: "写真や動画をたくさん保存したい人", check: "使う機器が対応している容量と規格（SDXC・UHS-Iなど）。" },
  { kind: "product", noun: "$match", pattern: /外付けHDD|外付けSSD|ポータブルSSD|ハードディスク|SSD|HDD/i, who: "写真や動画、録画した番組をたくさん保存したい人", check: "容量と、パソコンやテレビにつなぐ端子が合うか。" },

  // --- 商品の種類：オーディオ・映像・カメラ ---
  { kind: "product", noun: "ストリーミング端末", pattern: /Fire TV|ストリーミング|Chromecast/i, who: "テレビで動画配信を見たい人", check: "テレビのHDMI端子に空きがあるか。" },
  { kind: "product", noun: "プロジェクター", pattern: /プロジェクター/, who: "家で大きな画面で映像を楽しみたい人", check: "明るさ（ルーメン）と、映したい壁までの距離。" },
  { kind: "product", first: true, noun: "テレビ保護パネル", pattern: /テレビ保護パネル|液晶保護パネル/, who: "テレビの画面を傷や衝撃から守りたい人", check: "テレビのインチ数と、取り付け方法。" },
  { kind: "product", noun: "スピーカー", pattern: /スピーカー|サウンドバー/, who: "家で音楽や映画の音を良くしたい人", check: "接続方法（Bluetooth・HDMI）と、置き場所に合うサイズ。" },
  { kind: "product", first: true, noun: "イヤホン", pattern: /骨伝導\s*(イヤホン|ヘッドホン)|オープンイヤー|イヤーカフ|耳を塞がない|耳をふさがない/, who: "耳をふさがずに音を聞きたい人", check: "音量を上げると音漏れしやすいので、使う場所に合うか。" },
  { kind: "product", noun: "ヘッドホン", pattern: /ヘッドホン|ヘッドフォン/, who: "音にしっかり包まれたい人", check: "本体の重さと、耳あての素材。" },
  { kind: "product", noun: "イヤホン", pattern: /イヤホン/, who: "通勤や家事の合間に音楽を聴きたい人", check: "連続再生時間と、ケースを含めた合計の再生時間。" },
  { kind: "product", first: true, noun: "ボイスレコーダー", pattern: /ボイスレコーダー|ICレコーダー|文字起こし/, who: "会議や打ち合わせの記録を残したい人", check: "連続で録音できる時間と、文字起こしに月額料金がかかるか。" },
  { kind: "product", noun: "スマートウォッチ", pattern: /スマートウォッチ|活動量計/, who: "運動や睡眠を記録したい人", check: "自分のスマホに対応しているか。電池の持ち。" },
  { kind: "product", noun: "カメラ用品", pattern: /三脚|ジンバル|一眼|ミラーレス|望遠レンズ/, who: "写真や動画をきれいに撮りたい人", check: "手持ちの機材に取り付けられるか。重さ。" },

  // --- 商品の種類：スマホまわり ---
  { kind: "product", noun: "タブレット", pattern: /(Android|Wi-?Fi|SIMフリー|\d+(\.\d+)?インチ).{0,10}タブレット|タブレット.{0,10}(\d+(\.\d+)?インチ|Wi-?Fiモデル|本体)/i, who: "動画や読書を大きな画面で楽しみたい人", check: "画面のサイズと重さ、Wi-FiモデルかSIM対応モデルか。" },
  { kind: "product", noun: "モバイルバッテリー", pattern: /モバイルバッテリー|Power\s*Bank/i, who: "外出先で充電が切れると困る人", check: "容量（mAh）と、飛行機に持ち込めるかどうか。" },
  { kind: "product", noun: "充電器", pattern: /充電器|急速充電器|ACアダプタ/, who: "充電まわりを整理したい人", check: "出力（W数）と、同時に充電できるポートの数。" },
  { kind: "product", noun: "充電ケーブル", pattern: /ケーブル/i, who: "充電やデータ転送のケーブルを買い替えたい人", check: "両端の端子の組み合わせと長さ、対応する充電の出力（W数）。" },
  { kind: "product", first: true, noun: "スマホスタンド", pattern: /スマホスタンド|携帯スタンド|スマホホルダー|タブレットスタンド|マルチスタンド|スマホ\s*リング/, who: "動画を見たりビデオ通話をするときにスマホを立てたい人", check: "対応するスマホの重さとサイズ、角度を変えられるか。" },
  { kind: "product", first: true, noun: "カメラ保護フィルム", pattern: /カメラ保護|カメラフィルム|レンズ保護/, who: "スマホのカメラの傷が気になる人", check: "対応機種の型番。似た名前の機種と間違えやすい。" },
  { kind: "product", first: true, noun: "保護フィルム", pattern: /保護フィルム|ガラスフィルム/, who: "画面の傷や割れが心配な人", check: "対応機種の型番と、ケースと干渉しないか。" },
  { kind: "product", first: true, noun: "スマホケース", pattern: /(iPhone|スマホ|Galaxy|Pixel|Android).{0,20}ケース|ケース.{0,10}(iPhone|スマホ)/i, who: "スマホを落としたときの傷や割れが心配な人", check: "対応機種と、カメラ部分やボタンの位置が合うか。" },


  // --- 商品の種類：追加分 ---
  { kind: "product", noun: "テレビ", pattern: /液晶テレビ|有機ELテレビ|4Kテレビ|\d{2}\s*(型|インチ).{0,8}テレビ|テレビ\s*\d{2}\s*(型|インチ)|REGZA|BRAVIA|AQUOS|VIERA/i, who: "大きい画面でテレビや動画を楽しみたい人", check: "部屋の広さに合う画面サイズと、置き場所の幅。録画に使える端子があるか。" },
  { kind: "product", noun: "オフィスソフト", pattern: /Office\s*(Home|Personal|Professional|2\d{3})|Microsoft\s*365|Word.{0,6}Excel/i, who: "WordやExcelを使いたい人", check: "何台まで使えるか、買い切りか1年ごとの契約か。" },
  { kind: "product", noun: "ラベルライター", pattern: /ラベルライター|テプラ|ネームランド/, who: "家の中のものを整理してラベルを貼りたい人", check: "使えるテープの幅と、専用テープの値段。" },
  { kind: "product", first: true, noun: "チェキ用フィルム", pattern: /チェキ用フィルム|instax.{0,12}フィルム|フィルム\s*\d+枚/i, who: "撮った写真をその場でプリントしたい人", check: "手持ちのチェキに合うサイズ（mini・SQUARE・WIDE）と枚数。" },
  { kind: "product", noun: "チェキ", pattern: /チェキ|instax|インスタントカメラ/i, who: "撮った写真をその場で手渡したい人", check: "フィルムの値段（1枚あたり）と、本体の電源の種類。" },
  { kind: "product", first: true, noun: "カードリーダー", pattern: /カードリーダー|カードリーダ\b/, who: "カメラやスマホのデータをパソコンに移したい人", check: "対応するカードの種類と、接続端子（USB-A / USB-C）。" },
  { kind: "product", noun: "インクカートリッジ", pattern: /互換インク|インクカートリッジ|純正インク|トナー/, who: "プリンターのインクを買い足したい人", check: "自分のプリンターの型番に合う品番かどうか。" },
  { kind: "product", noun: "電源タップ", pattern: /電源タップ|延長コード|OAタップ/, who: "机やテレビまわりの配線を整えたい人", check: "口数と全体の長さ、雷ガードやスイッチが付いているか。" },
  { kind: "product", noun: "スマートスピーカー", pattern: /スマートスピーカー|Echo\s*(Dot|Show|Pop)|Google\s*Nest/i, who: "声で家電や音楽を操作したい人", check: "使いたいサービスに対応しているか。" },
  { kind: "product", noun: "WEBカメラ", pattern: /WEBカメラ|ウェブカメラ|Webcam/i, who: "オンライン会議や配信の画質を上げたい人", check: "解像度（1080pなど）と、マイクが内蔵されているか。" },
  { kind: "product", noun: "ヘッドセット", pattern: /ヘッドセット/, who: "通話やオンライン会議が多い人", check: "マイクの位置と、接続方法（USB・Bluetooth）。" },
  { kind: "product", noun: "体組成計", pattern: /体重計|体組成計/, who: "体重や体脂肪を記録したい人", check: "スマホアプリと連携できるか。測れる項目。" },
  { kind: "product", noun: "電動歯ブラシ", pattern: /電動歯ブラシ|ドルツ|ソニッケアー/i, who: "歯みがきをていねいにしたい人", check: "替えブラシの値段と、充電の方式。" },
  { kind: "product", noun: "衣類スチーマー", pattern: /衣類スチーマー|スチームアイロン|ハンディアイロン/, who: "シャツのしわを手早く伸ばしたい人", check: "立ち上がりの時間と、水タンクの容量。" },
  { kind: "product", noun: "ドライブレコーダー", pattern: /ドライブレコーダー|ドラレコ/, who: "運転中の記録を残しておきたい人", check: "前後2カメラかどうか。対応するSDカードの容量。" },
  { kind: "product", noun: "双眼鏡", pattern: /双眼鏡|オペラグラス/, who: "ライブやスポーツ観戦で遠くを見たい人", check: "倍率と明るさ、首にかけたときの重さ。" },
  { kind: "product", noun: "乾電池", pattern: /乾電池|アルカリ電池|単[1-4]形/, who: "電池をまとめて買っておきたい人", check: "本数と、1本あたりの値段。" },
  { kind: "product", noun: "充電池", pattern: /充電池|エネループ|充電式電池/, who: "電池代を抑えたい人", check: "繰り返し使える回数と、充電器が付いているか。" },
  // --- 機能（書き出しには使わない） ---
  { kind: "feature", pattern: /端子一体|ケーブル内蔵|ケーブル一体|直挿し/, who: "ケーブルを持ち歩くのが面倒な人", check: "本体の端子（USB-C / Lightning）が自分のスマホに合うか。" },
  { kind: "feature", pattern: /MagSafe|マグセーフ/i, who: "マグネットで充電器やアクセサリーを付けたい人", check: "MagSafe対応の充電器やアクセサリーと組み合わせて使えるか。" },
  { kind: "feature", pattern: /ノイズキャンセリング|ノイキャン|\bANC\b/i, who: "電車や人の多い場所で音楽を聴く人", check: "ノイズキャンセリングの効き方は環境で変わるので、レビューの声もあわせて。" },
  { kind: "feature", pattern: /マルチポイント/, who: "スマホとPCを行き来しながら使う人", check: "同時に接続できる台数と、対応している機器。" },
  { kind: "feature", pattern: /外音取り込み|ヒアスルー|アンビエント/, who: "つけたまま周りの音も聞きたい人", check: "外音取り込みの切り替え方法（ボタンかアプリか）。" },
  { kind: "feature", pattern: /低遅延|ゲーミング|ゲームモード/, who: "動画やゲームで音のズレが気になる人", check: "低遅延モードが使える接続方法と対応機器。" },
  { kind: "feature", pattern: /IPX?\d|防水|防滴/i, who: "水まわりや屋外でも使いたい人", check: "防水等級（IPX〇）の数字。数字によって耐えられる水の量が違う。" },
  { kind: "feature", pattern: /GaN|窒化ガリウム/i, who: "充電器を小さく軽くしたい人", check: "出力（W数）と、同時に充電できるポートの数。" },
  { kind: "feature", pattern: /急速充電|高速充電|PD対応|PPS/i, who: "充電を待つ時間を短くしたい人", check: "急速充電を活かすには、ケーブルとスマホ側の対応も必要。" },
  { kind: "feature", pattern: /(1\d|[2-9]\d)\d{3}\s*mAh/i, who: "外出が長い日や旅行に持っていきたい人", check: "容量が大きいほど重くなるので、持ち歩く頻度とのバランス。" },
  { kind: "feature", pattern: /静音/, who: "動作音が気になる場所で使いたい人", check: "動作音の大きさ（dB）が書かれているか。" },
  { kind: "feature", pattern: /Nano|ミニ|超小型|コンパクト|軽量/i, who: "置き場所や持ち運びで困りたくない人", check: "サイズと重さの数値。" },
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
  { pattern: /モバイルバッテリー|Power\s*Bank|\d{4,5}\s*mAh/i, tags: ["#モバイルバッテリー", "#充電グッズ", "#旅行の持ち物"] },
  { pattern: /充電器|急速充電|高速充電|PD対応|GaN|窒化ガリウム/i, tags: ["#充電器", "#急速充電", "#充電グッズ"] },
  { pattern: /ケーブル/i, tags: ["#充電ケーブル", "#USBケーブル", "#充電グッズ"] },
  { scope: "full", pattern: /MagSafe|マグセーフ/i, tags: ["#MagSafe", "#マグネット充電"] },
  { scope: "full", pattern: /ワイヤレス充電|\bQi2?\b/i, tags: ["#ワイヤレス充電", "#置くだけ充電"] },
  { pattern: /iPhone.{0,20}ケース|ケース.{0,10}iPhone/i, tags: ["#iPhoneケース", "#スマホケース", "#iPhoneアクセサリー"] },
  { pattern: /スマホケース|(Galaxy|Pixel|Android).{0,20}ケース/i, tags: ["#スマホケース", "#スマホアクセサリー"] },
  { pattern: /ガラスフィルム|保護フィルム|画面保護/, tags: ["#保護フィルム", "#ガラスフィルム", "#画面保護"] },
  { pattern: /カメラ保護|レンズ保護|カメラフィルム/, tags: ["#カメラ保護", "#レンズ保護", "#スマホアクセサリー"] },
  { pattern: /スマホ\s*リング|スマホスタンド|スマホホルダー|車載/, tags: ["#スマホスタンド", "#スマホホルダー", "#スマホアクセサリー"] },
  { pattern: /タブレット\s*\d|(Android|Wi-?Fi|SIMフリー)\s*タブレット|iPad/i, tags: ["#タブレット", "#動画視聴", "#電子書籍"] },
  { pattern: /iPhone/i, tags: ["#iPhone"] },

  // --- オーディオ・映像・カメラ ---
  { pattern: /ワイヤレスイヤホン|完全ワイヤレス|Bluetooth.{0,8}イヤホン/i, tags: ["#ワイヤレスイヤホン", "#イヤホン", "#Bluetoothイヤホン"] },
  { pattern: /骨伝導\s*(イヤホン|ヘッドホン)|オープンイヤー|イヤーカフ|耳を(塞|ふさ)がない/, tags: ["#オープンイヤー", "#骨伝導イヤホン", "#イヤホン"] },
  { pattern: /ヘッドホン|ヘッドフォン/, tags: ["#ヘッドホン", "#オーディオ", "#音楽好き"] },
  { pattern: /イヤホン/, tags: ["#イヤホン", "#音楽好き"] },
  { scope: "full", pattern: /ノイズキャンセリング|ノイキャン|\bANC\b/i, tags: ["#ノイズキャンセリング"] },
  { pattern: /スピーカー|サウンドバー/, tags: ["#スピーカー", "#Bluetoothスピーカー", "#オーディオ"] },
  { pattern: /ボイスレコーダー|ICレコーダー|文字起こし/, tags: ["#ボイスレコーダー", "#文字起こし", "#仕事効率化"] },
  { pattern: /スマートウォッチ|活動量計/, tags: ["#スマートウォッチ", "#健康管理", "#運動習慣"] },
  { pattern: /テレビ保護パネル|液晶保護パネル/, tags: ["#テレビ保護パネル", "#テレビ", "#液晶保護"] },
  { pattern: /液晶テレビ|有機ELテレビ|4Kテレビ|\d{2}\s*(型|インチ).{0,8}テレビ|テレビ\s*\d{2}\s*(型|インチ)|REGZA|BRAVIA|AQUOS|VIERA/i, tags: ["#テレビ", "#液晶テレビ", "#大画面", "#リビング"] },
  { scope: "full", pattern: /4K/i, tags: ["#4K"] },
  { pattern: /Fire\s*TV/i, tags: ["#FireTVStick", "#動画配信", "#おうち時間"] },
  { pattern: /Chromecast|ストリーミング/i, tags: ["#ストリーミング", "#動画配信", "#おうち時間"] },
  { pattern: /プロジェクター/, tags: ["#プロジェクター", "#ホームシアター", "#おうち時間"] },
  { pattern: /チェキ|instax|インスタントカメラ/i, tags: ["#チェキ", "#インスタントカメラ", "#写真好き"] },
  { pattern: /三脚|ジンバル|一眼|ミラーレス|望遠レンズ/, tags: ["#カメラ", "#カメラ好き", "#写真好き"] },
  { pattern: /双眼鏡|オペラグラス/, tags: ["#双眼鏡", "#ライブ", "#観劇"] },

  // --- 記録メディア ---
  { pattern: /カードリーダー|カードリーダ\b/, tags: ["#カードリーダー", "#データ移行", "#PC周辺機器"] },
  { pattern: /microSD|SDXC|SDHC|SDカード/i, tags: ["#microSD", "#SDカード", "#記録メディア"] },
  { pattern: /外付け\s*(SSD|HDD)|ポータブルSSD|外付けハードディスク/i, tags: ["#外付けストレージ", "#データ保存", "#バックアップ"] },
  { pattern: /\bSSD\b|NVMe/i, tags: ["#SSD", "#データ保存"] },
  { pattern: /\bHDD\b|ハードディスク/i, tags: ["#ハードディスク", "#データ保存", "#バックアップ"] },
  { pattern: /USBメモリ/i, tags: ["#USBメモリ", "#データ保存"] },

  // --- PC・周辺機器 ---
  { pattern: /キーボード/, tags: ["#キーボード", "#PC周辺機器", "#デスク環境"] },
  { pattern: /マウス|トラックボール/, tags: ["#マウス", "#PC周辺機器", "#デスク環境"] },
  { pattern: /モニター|ディスプレイ/, tags: ["#モニター", "#デスク環境", "#作業効率化"] },
  { pattern: /モニターアーム|デスクライト|PCスタンド|ノートパソコンスタンド/, tags: ["#デスク環境", "#デスク周り", "#作業効率化"] },
  { pattern: /USBハブ|USB-?C\s*ハブ|ドッキングステーション/i, tags: ["#USBハブ", "#PC周辺機器", "#デスク環境"] },
  { pattern: /プリンター|複合機/, tags: ["#プリンター", "#複合機", "#印刷"] },
  { pattern: /互換インク|インクカートリッジ|純正インク|トナー/, tags: ["#プリンターインク", "#インクカートリッジ", "#印刷"] },
  { pattern: /ブルーレイ|Blu-?ray|DVDドライブ|光学ドライブ/i, tags: ["#外付けドライブ", "#DVDドライブ", "#PC周辺機器"] },
  { pattern: /シュレッダー/, tags: ["#シュレッダー", "#書類整理", "#個人情報保護"] },
  { pattern: /ラベルライター|テプラ|ネームランド/, tags: ["#ラベルライター", "#テプラ", "#整理収納"] },
  { pattern: /ノート\s*パソコン|ノートPC|デスクトップ\s*(パソコン|PC)/i, tags: ["#パソコン", "#PC買い替え", "#新生活"] },
  { pattern: /ルーター|中継機|メッシュWi-?Fi/i, tags: ["#WiFiルーター", "#ネット環境", "#無線LAN"] },
  { pattern: /Office\s*(Home|Personal|Professional|2\d{3})|Microsoft\s*365|Word.{0,6}Excel/i, tags: ["#Office", "#PCソフト", "#Excel"] },
  { pattern: /セキュリティソフト|ウイルス対策|ノートン|ウイルスバスター|マカフィー|ESET/i, tags: ["#セキュリティソフト", "#ウイルス対策", "#PCソフト"] },
  { pattern: /WEBカメラ|ウェブカメラ|Webcam/i, tags: ["#WEBカメラ", "#オンライン会議", "#在宅ワーク"] },
  { pattern: /ヘッドセット/, tags: ["#ヘッドセット", "#オンライン会議", "#在宅ワーク"] },
  { pattern: /電源タップ|延長コード|OAタップ/, tags: ["#電源タップ", "#延長コード", "#配線整理"] },
  { pattern: /収納ラック|収納棚|収納ケース|アーム金具|壁掛け\s*(ラック|棚|金具)/, tags: ["#収納", "#整理収納", "#すっきり収納"] },

  // --- 家電・暮らし ---
  { pattern: /ドライヤー/, tags: ["#ドライヤー", "#ヘアケア", "#美容家電"] },
  { pattern: /ヘアアイロン|カールアイロン|ストレートアイロン|コテ/, tags: ["#ヘアアイロン", "#ヘアケア", "#ヘアアレンジ"] },
  { pattern: /脱毛器|美顔器|美容家電|頭皮ケア/, tags: ["#美容家電", "#セルフケア"] },
  { pattern: /電動歯ブラシ|ドルツ|ソニッケアー/i, tags: ["#電動歯ブラシ", "#オーラルケア", "#歯磨き"] },
  { pattern: /体重計|体組成計/, tags: ["#体組成計", "#健康管理", "#ダイエット"] },
  { pattern: /布団乾燥機|ふとん乾燥機/, tags: ["#布団乾燥機", "#ダニ対策", "#寝具ケア"] },
  { pattern: /布団クリーナー|ふとんクリーナー/, tags: ["#布団クリーナー", "#ダニ対策", "#掃除"] },
  { pattern: /チャージングステーション|Charging\s*Station|充電ステーション|充電ドック/i, tags: ["#充電ステーション", "#充電器", "#デスク環境"] },
  { pattern: /除湿機|除湿器|衣類乾燥/, tags: ["#除湿機", "#部屋干し", "#梅雨対策"] },
  { pattern: /加湿器/, tags: ["#加湿器", "#乾燥対策", "#冬支度"] },
  { pattern: /空気清浄機/, tags: ["#空気清浄機", "#花粉対策", "#ハウスダスト"] },
  { pattern: /ロボット掃除機/, tags: ["#ロボット掃除機", "#時短家電", "#掃除"] },
  { pattern: /掃除機|クリーナー/, tags: ["#掃除機", "#コードレス掃除機", "#掃除グッズ"] },
  { pattern: /自動調理|電気圧力鍋|スープメーカー/, tags: ["#キッチン家電", "#時短家電", "#おうちごはん"] },
  { pattern: /ミキサー|ブレンダー|豆乳メーカー|フードプロセッサー/, tags: ["#キッチン家電", "#朝ごはん", "#料理好き"] },
  { pattern: /コーヒーメーカー|エスプレッソマシン|全自動コーヒー/, tags: ["#コーヒーメーカー", "#おうちカフェ", "#コーヒー好き"] },
  { pattern: /電子レンジ|オーブン|トースター|炊飯器|ケトル|ホットプレート|卓上IH/, tags: ["#キッチン家電", "#おうちごはん", "#料理好き"] },
  { pattern: /衣類スチーマー|スチームアイロン|ハンディアイロン/, tags: ["#衣類スチーマー", "#時短家電", "#シャツ"] },
  { pattern: /冷蔵庫\s*マット|キズ防止|傷防止|床保護/, tags: ["#冷蔵庫マット", "#床保護", "#新生活"] },
  { pattern: /かさ上げ|防振.{0,6}(マット|台)/, tags: ["#洗濯機かさ上げ台", "#洗濯機", "#掃除"] },
  { pattern: /冷蔵庫/, tags: ["#冷蔵庫", "#生活家電", "#新生活"] },
  { pattern: /洗濯機/, tags: ["#洗濯機", "#生活家電", "#新生活"] },
  { pattern: /エアコン/, tags: ["#エアコン", "#生活家電", "#暑さ対策"] },
  { pattern: /扇風機|サーキュレーター/, tags: ["#サーキュレーター", "#扇風機", "#暑さ対策"] },
  { pattern: /電気毛布|ヒーター|こたつ|暖房|セラミックファン|ホットカーペット/, tags: ["#あったかグッズ", "#寒さ対策", "#冬支度"] },
  { pattern: /スマートスピーカー|Echo\s*(Dot|Show|Pop)|Google\s*Nest/i, tags: ["#スマートスピーカー", "#スマートホーム", "#Alexa"] },
  { pattern: /ドライブレコーダー|ドラレコ/, tags: ["#ドライブレコーダー", "#車用品", "#ドライブ"] },
  { pattern: /乾電池|アルカリ電池|単[1-4]形/, tags: ["#乾電池", "#日用品", "#ストック買い"] },
  { pattern: /充電池|エネループ|充電式電池/, tags: ["#充電池", "#エコ", "#日用品"] },

  // --- 機能（最後に調べる） ---
  { scope: "full", pattern: /防水|IPX?\d/i, tags: ["#防水"] },
  { scope: "full", pattern: /静音/, tags: ["#静音"] },
  { scope: "full", pattern: /大容量/, tags: ["#大容量"] },
  { scope: "full", pattern: /Nano|ミニ|超小型|コンパクト|軽量/i, tags: ["#コンパクト"] },
];
// メーカー名・シリーズ名。商品名の先頭のほうに出てきたものだけ付ける（最大2つ）。
// 上から順に見るので、会社名を先、シリーズ名を後ろに並べる。
const BRAND_TAGS = [
  // --- スマホアクセサリー ---
  [/iFace/i, "#iFace"],
  [/Spigen|シュピゲン/i, "#Spigen"],
  [/\bESR\b/i, "#ESR"],
  [/TORRAS/i, "#TORRAS"],
  [/NIMASO/i, "#NIMASO"],
  [/PITAKA/i, "#PITAKA"],
  [/Simplism|シンプリズム/i, "#Simplism"],
  [/ラスタバナナ/, "#ラスタバナナ"],
  [/オウルテック|Owltech/i, "#オウルテック"],
  [/\bBelkin\b|ベルキン/i, "#Belkin"],
  [/\bCIO\b/, "#CIO"],
  [/UGREEN/i, "#UGREEN"],
  [/Baseus/i, "#Baseus"],
  [/AUKEY/i, "#AUKEY"],
  [/MOTTERU|モッテル/i, "#MOTTERU"],

  // --- オーディオ ---
  [/\bAnker\b/i, "#Anker"],
  [/SOUNDPEATS/i, "#SOUNDPEATS"],
  [/EarFun/i, "#EarFun"],
  [/AVIOT/i, "#AVIOT"],
  [/Shokz|ショックス/i, "#Shokz"],
  [/\bJabra\b/i, "#Jabra"],
  [/\bJBL\b/i, "#JBL"],
  [/\bBOSE\b/i, "#BOSE"],
  [/オーディオテクニカ|audio-?technica/i, "#オーディオテクニカ"],
  [/ゼンハイザー|Sennheiser/i, "#ゼンハイザー"],
  [/\bTribit\b/i, "#Tribit"],
  [/Edifier/i, "#Edifier"],
  [/\bfinal\b.{0,10}(イヤホン|ヘッドホン)/i, "#final"],
  [/\bBeats\b/i, "#Beats"],
  [/Nothing\s*(Ear|Phone)/i, "#Nothing"],

  // --- テレビ・映像・カメラ ---
  [/ハイセンス|Hisense/i, "#ハイセンス"],
  [/\bTCL\b/, "#TCL"],
  [/maxzen|マクスゼン/i, "#maxzen"],
  [/オリオン|\bORION\b/i, "#オリオン"],
  [/富士フイルム|FUJIFILM/i, "#富士フイルム"],
  [/\bNikon\b|ニコン/i, "#Nikon"],
  [/\bGoPro\b/i, "#GoPro"],
  [/\bDJI\b/, "#DJI"],

  // --- PC・周辺機器 ---
  [/バッファロー|BUFFALO/i, "#バッファロー"],
  [/エレコム|ELECOM/i, "#エレコム"],
  [/ロジクール|Logicool|Logitech/i, "#ロジクール"],
  [/SanDisk|サンディスク/i, "#SanDisk"],
  [/KIOXIA|キオクシア/i, "#KIOXIA"],
  [/Samsung|サムスン/i, "#Samsung"],
  [/Crucial|クルーシャル/i, "#Crucial"],
  [/Transcend|トランセンド/i, "#Transcend"],
  [/Seagate|シーゲイト/i, "#Seagate"],
  [/ウエスタンデジタル|Western\s*Digital|\bWD\b/i, "#WD"],
  [/TP-?Link/i, "#TPLink"],
  [/アイ・?オー・?データ|IODATA|I-O\s*DATA/i, "#IODATA"],
  [/エプソン|EPSON/i, "#エプソン"],
  [/キヤノン|キャノン|\bCanon\b/i, "#キヤノン"],
  [/ブラザー|brother/i, "#ブラザー"],
  [/キングジム/, "#キングジム"],
  [/マイクロソフト|Microsoft/i, "#マイクロソフト"],
  [/\bASUS\b|エイスース/i, "#ASUS"],
  [/\bLenovo\b|レノボ/i, "#Lenovo"],
  [/\bDell\b|デル\b/i, "#Dell"],
  [/富士通|FUJITSU/i, "#富士通"],
  [/\bNEC\b/i, "#NEC"],
  [/ノートン|Norton/i, "#ノートン"],
  [/\bESET\b/i, "#ESET"],
  [/マカフィー|McAfee/i, "#マカフィー"],
  [/ウイルスバスター|トレンドマイクロ/i, "#ウイルスバスター"],

  // --- 家電 ---
  [/パナソニック|Panasonic/i, "#パナソニック"],
  [/シャープ|SHARP/i, "#シャープ"],
  [/日立|HITACHI/i, "#日立"],
  [/東芝|TOSHIBA/i, "#東芝"],
  [/三菱電機|三菱/, "#三菱電機"],
  [/アイリスオーヤマ|アイリスプラザ|IRIS\s*OHYAMA/i, "#アイリスオーヤマ"],
  [/コロナ(?!対策|ウイルス)|\bCORONA\b/i, "#コロナ"],
  [/ダイキン|DAIKIN/i, "#ダイキン"],
  [/バルミューダ|BALMUDA/i, "#バルミューダ"],
  [/ダイソン|Dyson/i, "#ダイソン"],
  [/シロカ|siroca/i, "#シロカ"],
  [/ツインバード|TWINBIRD/i, "#ツインバード"],
  [/象印|ZOJIRUSHI/i, "#象印"],
  [/タイガー魔法瓶|タイガー|TIGER/i, "#タイガー"],
  [/デロンギ|DeLonghi/i, "#デロンギ"],
  [/recolte|レコルト/i, "#レコルト"],
  [/BRUNO|ブルーノ/i, "#BRUNO"],
  [/アラジン|Aladdin/i, "#アラジン"],
  [/コイズミ|KOIZUMI/i, "#コイズミ"],
  [/スリーアップ/, "#スリーアップ"],
  [/山善|YAMAZEN/i, "#山善"],
  [/ドリテック|dretec/i, "#ドリテック"],
  [/マキタ|makita/i, "#マキタ"],
  [/レイコップ|raycop/i, "#レイコップ"],
  [/SwitchBot/i, "#SwitchBot"],
  [/タニタ|TANITA/i, "#タニタ"],
  [/オムロン|OMRON/i, "#オムロン"],
  [/テスコム|TESCOM/i, "#テスコム"],
  [/クレイツ|CREATE\s*ION/i, "#クレイツ"],
  [/ヤーマン|YA-?MAN/i, "#ヤーマン"],
  [/リファ|ReFa/i, "#ReFa"],
  [/ハイアール|Haier/i, "#ハイアール"],
  [/\bAQUA\b|アクア\b/i, "#AQUA"],
  [/simplus|シンプラス/i, "#simplus"],

  // --- その他 ---
  [/\bApple\b|アップル/i, "#Apple"],
  [/Xiaomi|シャオミ/i, "#Xiaomi"],
  [/HUAWEI|ファーウェイ/i, "#HUAWEI"],
  [/\bAmazon\b|アマゾン/i, "#Amazon"],
  [/Nintendo|任天堂/i, "#Nintendo"],
  [/ALLDOCUBE/i, "#ALLDOCUBE"],

  // --- シリーズ名（会社名のあとに付ける） ---
  [/Soundcore|サウンドコア/i, "#Soundcore"],
  [/\bEufy\b|ユーフィ/i, "#Eufy"],
  [/AirPods/i, "#AirPods"],
  [/dynabook/i, "#dynabook"],
  [/ThinkPad/i, "#ThinkPad"],
  [/\bREGZA\b|レグザ/i, "#REGZA"],
  [/BRAVIA|ブラビア/i, "#BRAVIA"],
  [/AQUOS|アクオス/i, "#AQUOS"],
  [/VIERA|ビエラ/i, "#VIERA"],
  [/ドルツ|Doltz/i, "#ドルツ"],
  [/ソニッケアー|Sonicare/i, "#ソニッケアー"],
  [/エネループ|eneloop/i, "#エネループ"],
  [/プラズマクラスター/, "#プラズマクラスター"],
  [/ナノケア/, "#ナノケア"],
  [/ヘルシオ|HEALSIO/i, "#ヘルシオ"],
  [/\bSONY\b|ソニー/i, "#ソニー"],
];

// ジャンルごとのタグ（商品から拾えたタグが少ないときの補い。config.mjs の genres[].tag とは別）
const GENRE_TAGS = {
  564500: ["#スマホアクセサリー", "#ガジェット", "#便利グッズ", "#スマホグッズ", "#ガジェット好き"],
  100026: ["#デスク環境", "#作業効率化", "#ガジェット", "#在宅ワーク", "#デスク周り"],
  211742: ["#ガジェット", "#おうち時間", "#オーディオ", "#ガジェット好き", "#便利グッズ"],
  562637: ["#便利家電", "#暮らしを整える", "#時短家電", "#生活家電", "#家電好き"],
};

// 商品そのものを表すタグを探す範囲（商品名の先頭からの文字数）
const HEAD_LENGTH = 48;

/**
 * 商品名から関連するハッシュタグを作る。
 * 具体的なもの（商品の種類 → メーカー → ジャンル）の順に並べ、最大 tagMax 個まで。
 */
export function buildTags(item, genre) {
  const raw = String(item.itemName ?? "");
  // 販促文句を外した名前。カッコの中は消えるので、全体から探すときは元の商品名を使う
  const name = cleanItemName(raw, 300);
  // 商品名の後ろには「対応機種」や付属品が並ぶことが多い。
  // 商品そのものを表すタグは先頭だけを見て、機能を表すタグ（防水・静音など）は全体を見る。
  const head = name.slice(0, HEAD_LENGTH);

  const pick = (text, scope) =>
    TAG_RULES.filter((rule) => (rule.scope ?? "head") === scope && rule.pattern.test(text)).flatMap(
      (rule) => rule.tags
    );

  // 商品そのもののタグ。先頭から拾えなかったときだけ、商品名の全体から探す
  let productTags = pick(head, "head");
  if (!productTags.length) productTags = pick(raw, "head");
  const matched = [...productTags, ...pick(raw, "full")];

  // メーカー名とシリーズ名（iFace、コロナ、Soundcore など）。多すぎないよう2つまで
  const brands = BRAND_TAGS.filter(([pattern]) => pattern.test(head))
    .slice(0, 2)
    .map(([, tag]) => tag);
  const specific = unique([...matched, ...brands, genre.tag]);

  // ジャンルのタグは、足りないときだけ補う（関係の薄いタグを増やさないため）
  const fillers = (GENRE_TAGS[genre.id] ?? []).filter((tag) => !specific.includes(tag));
  const need = Math.max(0, COMMENT.tagMin - specific.length);
  return [...specific, ...fillers.slice(0, need)].slice(0, COMMENT.tagMax);
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

// ------------------------------------------------------------
//  「こんな人に」を増やすための候補。
//  商品名の先頭（HEAD_LENGTH 文字）に当てはまったものを使う。
//  ★事実や一般的な使い方だけ。「使ってみたら〇〇だった」は書かない。
// ------------------------------------------------------------
const AUDIENCE_RULES = [
  // --- スマホまわり ---
  { pattern: /モバイルバッテリー|Power\s*Bank|\d{4,5}\s*mAh/i, who: ["出張や旅行が多い人", "外でスマホを使う時間が長い人", "停電や災害の備えをしておきたい人"] },
  { pattern: /充電器|急速充電|PD対応|GaN/i, who: ["コンセントまわりを減らしたい人", "スマホとイヤホンを同時に充電したい人", "旅行用に小さい充電器が欲しい人"] },
  { pattern: /ケーブル/i, who: ["ケーブルが断線して困った人", "長さを使い分けたい人", "車の中や職場にも1本置いておきたい人"] },
  { pattern: /iPhone.{0,20}ケース|スマホケース|(Galaxy|Pixel|Android).{0,20}ケース/i, who: ["スマホを裸で持つのが不安な人", "見た目も気にして選びたい人", "子どもに渡すことがある人"] },
  { pattern: /ガラスフィルム|保護フィルム|画面保護/, who: ["指紋や皮脂が気になる人", "下取りや売却を考えている人", "画面を見る時間が長い人"] },
  { pattern: /カメラ保護|レンズ保護/, who: ["机に直接置くことが多い人", "スマホで写真をよく撮る人"] },
  { pattern: /スマホスタンド|スマホホルダー|車載/, who: ["動画を見ながら作業する人", "ビデオ通話をよくする人", "料理中にレシピを見る人"] },
  { pattern: /タブレット\s*\d|(Android|Wi-?Fi|SIMフリー)\s*タブレット|iPad/i, who: ["電子書籍や漫画を読む人", "動画を寝ながら見たい人", "子どもの学習用に使いたい人"] },

  // --- オーディオ・映像・カメラ ---
  { pattern: /ワイヤレスイヤホン|完全ワイヤレス|イヤホン/i, who: ["通話やオンライン会議が多い人", "運動しながら音楽を聴く人", "有線のコードが煩わしい人"] },
  { pattern: /骨伝導\s*(イヤホン|ヘッドホン)|オープンイヤー|イヤーカフ/, who: ["家族の呼びかけに気づきたい人", "長時間つけると耳が痛くなる人", "散歩や自転車で周りの音も聞きたい人"] },
  { pattern: /ヘッドホン|ヘッドフォン/, who: ["家で集中して音楽を聴きたい人", "映画や配信をじっくり楽しみたい人"] },
  { pattern: /スピーカー|サウンドバー/, who: ["テレビの声が聞き取りにくい人", "料理や掃除をしながら音楽を流したい人", "キャンプや風呂場でも使いたい人"] },
  { pattern: /ボイスレコーダー|ICレコーダー|文字起こし/, who: ["会議や授業の内容を後から確認したい人", "インタビューや商談をする人", "メモを取るのが追いつかない人"] },
  { pattern: /スマートウォッチ|活動量計/, who: ["歩数や睡眠を見える形にしたい人", "通知をスマホを出さずに見たい人"] },
  { pattern: /液晶テレビ|有機ELテレビ|4Kテレビ|REGZA|BRAVIA|AQUOS|VIERA/i, who: ["引っ越しや模様替えのタイミングの人", "家族でスポーツ観戦をする人", "動画配信をテレビで見たい人"] },
  { pattern: /Fire\s*TV|Chromecast|ストリーミング/i, who: ["古いテレビを使い続けたい人", "動画配信を複数契約している人"] },
  { pattern: /プロジェクター/, who: ["部屋を暗くして映画を見たい人", "大きなテレビを置く場所がない人"] },
  { pattern: /チェキ|instax|インスタントカメラ/i, who: ["旅行や誕生日の記録を残したい人", "友だちに写真を渡したい人"] },
  { pattern: /三脚|ジンバル|一眼|ミラーレス/, who: ["家族の写真をきれいに残したい人", "動画を撮って投稿している人"] },
  { pattern: /双眼鏡|オペラグラス/, who: ["ライブや舞台によく行く人", "野球やサッカーを観戦する人"] },

  // --- 記録メディア・PC ---
  { pattern: /microSD|SDカード|USBメモリ|SSD|HDD|ハードディスク/i, who: ["スマホの容量がいつも足りない人", "写真や動画を残しておきたい人", "パソコンのバックアップを取りたい人"] },
  { pattern: /カードリーダー/, who: ["カメラで撮った写真をすぐ見たい人", "パソコンにSDスロットがない人"] },
  { pattern: /キーボード|マウス|トラックボール/, who: ["長時間パソコンを使う人", "静かな場所で作業する人", "デスクの見た目をそろえたい人"] },
  { pattern: /モニター|ディスプレイ/, who: ["ノートパソコンの画面が狭い人", "資料を並べて作業する人", "在宅勤務が多い人"] },
  { pattern: /USBハブ|ドッキングステーション/i, who: ["ノートパソコンの端子が少ない人", "外部モニターにつなぎたい人"] },
  { pattern: /プリンター|複合機|インク|トナー/, who: ["子どもの書類や写真を印刷する人", "在宅で仕事の書類を扱う人"] },
  { pattern: /シュレッダー/, who: ["郵便物の宛名を気にする人", "在宅で書類が増えた人"] },
  { pattern: /ラベルライター|テプラ/, who: ["収納ケースの中身を分かるようにしたい人", "子どもの持ち物に名前を付ける人"] },
  { pattern: /ルーター|中継機|メッシュWi-?Fi/i, who: ["動画が止まることがある人", "家の奥まで電波が届かない人", "つなぐ機器が増えてきた人"] },
  { pattern: /Office|Microsoft\s*365/i, who: ["仕事や学校で書類を作る人", "家計簿や名簿を表で管理する人"] },
  { pattern: /セキュリティソフト|ウイルス対策|ノートン/i, who: ["家族のパソコンもまとめて守りたい人", "ネットで買い物をよくする人"] },
  { pattern: /WEBカメラ|ウェブカメラ|ヘッドセット/i, who: ["在宅勤務やオンライン授業がある人", "家族とビデオ通話する人"] },
  { pattern: /電源タップ|延長コード/, who: ["机の下の配線がごちゃごちゃな人", "コンセントが足りない人"] },
  { pattern: /ノート\s*パソコン|デスクトップ\s*(パソコン|PC)/i, who: ["古いパソコンの動作が重い人", "進学や就職で用意する人"] },

  // --- 家電・暮らし ---
  { pattern: /ドライヤー|ヘアアイロン|カールアイロン|コテ/, who: ["朝の支度を早く終えたい人", "髪の傷みが気になる人", "旅行に持っていきたい人"] },
  { pattern: /脱毛器|美顔器|美容家電/, who: ["自宅でケアを続けたい人", "サロンに行く時間がない人"] },
  { pattern: /電動歯ブラシ/, who: ["歯科で磨き方を指摘された人", "家族で使い分けたい人"] },
  { pattern: /体重計|体組成計/, who: ["毎日の変化を記録したい人", "家族で共有して使いたい人"] },
  { pattern: /布団乾燥機|ふとん乾燥機|布団クリーナー/, who: ["布団を外に干せない人", "ダニやカビが気になる人", "寝る前に布団を温めたい人"] },
  { pattern: /チャージングステーション|Charging\s*Station|充電ステーション|充電ドック/i, who: ["ガジェットを複数持っている人", "寝室や机の上をすっきりさせたい人"] },
  { pattern: /除湿機|衣類乾燥/, who: ["洗濯物を部屋干しする人", "梅雨や冬の結露が気になる人", "花粉の時期に外に干せない人"] },
  { pattern: /加湿器/, who: ["喉や肌の乾燥が気になる人", "暖房で部屋が乾く人"] },
  { pattern: /空気清浄機/, who: ["花粉やハウスダストが気になる人", "ペットを飼っている人", "料理のにおいが残る部屋の人"] },
  { pattern: /掃除機|クリーナー|ロボット掃除機/, who: ["コードを抜き差しするのが面倒な人", "ペットの毛が気になる人", "階段や車の中も掃除したい人"] },
  { pattern: /自動調理|電気圧力鍋|ミキサー|ブレンダー|スープメーカー/, who: ["帰りが遅い日が多い人", "作りおきをしたい人", "野菜をとる量を増やしたい人"] },
  { pattern: /コーヒーメーカー|エスプレッソ/, who: ["毎日コーヒーを買っている人", "来客にいれることがある人"] },
  { pattern: /電子レンジ|オーブン|トースター|炊飯器|ケトル|ホットプレート/, who: ["一人暮らしを始める人", "朝ごはんを手早く用意したい人", "古い家電を買い替えたい人"] },
  { pattern: /衣類スチーマー|スチームアイロン/, who: ["アイロン台を出すのが面倒な人", "スーツやシャツをよく着る人"] },
  { pattern: /冷蔵庫/, who: ["一人暮らしや二人暮らしの人", "作りおきを冷凍したい人"] },
  { pattern: /洗濯機|かさ上げ|防振/, who: ["集合住宅で音が気になる人", "洗濯機の下の掃除をしたい人"] },
  { pattern: /エアコン|扇風機|サーキュレーター/, who: ["部屋の温度にムラがある人", "電気代を抑えたい人"] },
  { pattern: /電気毛布|ヒーター|こたつ|ホットカーペット/, who: ["足元だけ温めたい人", "暖房をつけるほどでもない日がある人"] },
  { pattern: /スマートスピーカー|Echo|Google\s*Nest/i, who: ["手がふさがっていることが多い人", "家電をまとめて操作したい人"] },
  { pattern: /乾電池|充電池|エネループ/, who: ["リモコンや時計の電池をよく替える人", "ゲームのコントローラーに使う人"] },
  { pattern: /ドライブレコーダー|ドラレコ/, who: ["車で通勤している人", "万一のときの記録を残したい人"] },
  { pattern: /冷蔵庫\s*マット|床保護|キズ防止/, who: ["賃貸で床を傷つけたくない人", "引っ越しの予定がある人"] },
];

// 書き出しの一文。商品の種類（noun）が分かっているときに使う。「〇〇そう。」は使わない
const LEAD_TEMPLATES = [
  (who, noun) => `${who}向けの${noun}。`,
  (who, noun) => `${noun}を探している人へ。${who}に向いた一品です。`,
  (who, noun) => `${who}に向けた${noun}です。`,
  (who, noun) => `${noun}のなかでも、${who}に向いた一品。`,
];

// 商品の種類が分からなかったときの書き出し（機能から言えることだけ書く）
const LEAD_FALLBACKS = [
  (who) => `${who}に向けた一品。`,
  (who) => `${who}なら、チェックしておきたい一品です。`,
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

/** 商品名から拾った言葉を、書き出しで使う形にそろえる（「sdカード」→「SDカード」など） */
function normalizeNoun(word) {
  const w = String(word).trim();
  if (/^micro\s*sd$/i.test(w)) return "microSDカード";
  return w.replace(/^micro\s*sd/i, "microSD").replace(/^sd/i, "SD").replace(/ssd|hdd/gi, (s) => s.toUpperCase());
}

/**
 * 商品の種類を1つに決める。
 * ・first: true の種類（ケースやフィルムなどのアクセサリー）が商品名の先頭にあれば、それを使う
 * ・それ以外は、商品名のいちばん前に出てきた種類を使う（後ろに並ぶ「対応機器」や付属品を拾わないため）
 * @returns {{ topic: object, match: string } | null}
 */
function pickProductTopic(itemName, topics) {
  const raw = String(itemName ?? "");
  const head = cleanItemName(raw, 300).slice(0, 40);
  for (const topic of topics) {
    if (topic.kind !== "product" || !topic.first) continue;
    const m = head.match(topic.pattern);
    if (m) return { topic, match: m[0] };
  }
  let best = null;
  for (const topic of topics) {
    if (topic.kind !== "product") continue;
    const m = raw.match(topic.pattern);
    if (m && (!best || m.index < best.index)) best = { topic, match: m[0], index: m.index };
  }
  return best;
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
  const matched = TOPICS.filter((t) => t.pattern.test(`${item.itemName} ${specs.join(" ")}`));

  // 商品の種類は1つだけ使う（他の種類は、対応機器や付属品の名前を拾っただけのことが多い）
  const found = pickProductTopic(item.itemName, matched);
  const productTopic = found?.topic ?? null;
  const topics = [productTopic, ...matched.filter((t) => t.kind === "feature")].filter(Boolean);

  // 「こんな人に」は、商品の種類ごとの候補（AUDIENCE_RULES）も足して多めに出す
  const nameHead = cleanItemName(String(item.itemName ?? ""), 300).slice(0, HEAD_LENGTH);
  const extraWho = AUDIENCE_RULES.filter((rule) => rule.pattern.test(nameHead)).flatMap(
    (rule) => rule.who
  );

  // 商品に合う「こんな人に」が3つ以上あれば、ジャンル全体の候補は使わない
  const specificWho = unique([...topics.map((t) => t.who), ...extraWho]);
  const whoList = unique([
    ...specificWho,
    ...(specificWho.length >= 3 ? [] : GENRE_AUDIENCE[genre.id] ?? []),
    Number(item.reviewCount) >= 300 ? "レビューの多い定番から選びたい人" : "",
    Number(item.itemPrice) <= 3000 ? "予算を抑えて選びたい人" : "",
  ]);
  const checks = unique([...topics.map((t) => t.check), ...rotate(GENERIC_CHECKS, seed)]);

  // 書き出しは商品の種類から作る。種類が分からなければ機能から。どちらも無ければ書き出しは付けない
  // （ジャンル全体の「向いている人」は商品によっては合わないため、書き出しには使わない）
  const featureTopic = topics.find((t) => t.kind === "feature");
  let leadWho = "";
  let lead = "";
  if (productTopic) {
    leadWho = productTopic.who;
    const noun = productTopic.noun === "$match" ? normalizeNoun(found.match) : productTopic.noun;
    lead = LEAD_TEMPLATES[seed % LEAD_TEMPLATES.length](leadWho, noun);
  } else if (featureTopic) {
    leadWho = featureTopic.who;
    lead = LEAD_FALLBACKS[seed % LEAD_FALLBACKS.length](leadWho);
  }
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

  const otherWho = whoList.filter((w) => w !== leadWho);
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
    // スペックを多く、選んだ基準と締めの一文も入れ、「こんな人に」も多めに。
    // そのうえで目標の文字数に近いもの
    chosen = inRange.sort(
      (a, b) =>
        b.s - a.s ||
        extras(b) - extras(a) ||
        b.w - a.w ||
        Math.abs(a.text.length - COMMENT.target) - Math.abs(b.text.length - COMMENT.target)
    )[0];
  } else {
    // 下限に届かない場合は、500文字以内でいちばん長いもの
    const fits = plans.filter((p) => p.text.length <= COMMENT.maxLength);
    chosen = fits.length
      ? fits.sort((a, b) => b.text.length - a.text.length)[0]
      : plans[plans.length - 1];
  }

  let text = chosen.text;
  if (text.length > COMMENT.maxLength) text = text.slice(0, COMMENT.maxLength - 1) + "…";
  return { name, text };
}
