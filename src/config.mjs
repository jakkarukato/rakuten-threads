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
  genres: [
    { id: 564500, name: "スマホ・タブレット",   tag: "#スマホ" },
    { id: 100026, name: "PC・周辺機器",         tag: "#PC周辺機器" },
    { id: 211742, name: "オーディオ・カメラ",   tag: "#ガジェット" },
    { id: 562637, name: "家電",                 tag: "#家電" },
  ],

  // 投稿する時刻（日本時間）
  postHour: 21,
  postMinute: 0,

  // Threadsの1投稿あたりの上限文字数
  maxTextLength: 500,

  // 商品の抽出条件
  filter: {
    minPrice: 1000,
    maxPrice: 50000,
    minReviewCount: 30,
    minReviewAverage: 4.0,
  },

  // 過去に紹介した商品を何件記憶しておくか（重複投稿の防止）
  historyLimit: 300,
};

// 楽天APIに送るヘッダー。
// ★重要: 新APIで実際に検証されるのは Origin です。Refererだけでは
//   403 REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING になります（実測で確認済み）。
export const originUrl = `https://${config.githubUser}.github.io`;
export const refererUrl = `${originUrl}/${config.repoName}/`;
