// ============================================================
//  設定ファイル
// ============================================================

export const config = {
  // GitHubユーザー名。楽天の「許可されているウェブサイト」と一致させること。
  githubUser: "jakkarukato",
  repoName: "rakuten-threads",

  // 紹介するジャンル。日替わりでローテーションします。
  // キーワード検索は精度が低かったため、ジャンル指定のランキングAPIを使います。
  // （ジャンルIDは楽天市場のカテゴリに対応。増やしたい場合はIDを追加）
  // 締めの質問は src/questions.mjs にまとめてあります（ジャンル別の質問は id で紐づけ）。
  genres: [
    { id: 564500, name: "スマホ・タブレット", tag: "#スマホ" },
    { id: 100026, name: "PC・周辺機器", tag: "#PC周辺機器" },
    { id: 211742, name: "オーディオ・カメラ", tag: "#ガジェット" },
    { id: 562637, name: "家電", tag: "#家電" },
  ],

  // ランキング順位を書くのはこの順位以内のときだけ。
  // 「29位」などは褒め言葉にならないので、それ以下なら順位を出さない。
  rankThreshold: 10,

  // 商品説明文（itemCaption）を投稿に使うか。
  // 店舗が自由に書く欄で、SEOキーワード・特定商取引法の表記・測定条件の注釈などが
  // 混在しており、何度フィルタを足しても別種のノイズを拾うため既定で無効にしている。
  useCaption: false,

  // 投稿する時刻（日本時間）
  postHour: 21,
  postMinute: 0,

  // Threadsの1投稿あたりの上限文字数
  maxTextLength: 500,

  // 承認時に書く一言のために空けておく文字数。
  // 自動生成の本文はこの分だけ短く作られる。0にすると余白を確保しない。
  commentReserve: 110,

  // 商品の抽出条件
  filter: {
    minPrice: 1000,
    maxPrice: 50000,
    minReviewCount: 30,
    minReviewAverage: 4.0,
  },

  // 過去の投稿を何件記憶しておくか。同じ商品・同じ質問が出ないようにするために使う。
  // 毎日投稿でも3年近く持つ件数にしている。
  historyLimit: 1000,
};

// 楽天APIに送るヘッダー。
// ★重要: 新APIで実際に検証されるのは Origin です。Refererだけでは
//   403 REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING になります（実測で確認済み）。
export const originUrl = `https://${config.githubUser}.github.io`;
export const refererUrl = `${originUrl}/${config.repoName}/`;
