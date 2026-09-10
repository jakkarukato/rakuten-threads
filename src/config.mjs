// ============================================================
//  設定ファイル
// ============================================================

export const config = {
  // GitHubユーザー名。
  // 楽天の「許可されているウェブサイト」に登録する値と必ず一致させること。
  // ここがズレると楽天APIが 403 HTTP_REFERRER_NOT_ALLOWED を返します。
  githubUser: "jakkarukato",

  // リポジトリ名（GitHubで作るリポジトリと同じ名前にする）
  repoName: "rakuten-threads",

  // 紹介する商品のキーワード。日替わりでローテーションします。
  // 同じジャンルでも切り口を変えることで、投稿の内容が単調になるのを防ぎます。
  keywords: [
    "ワイヤレスイヤホン",
    "モバイルバッテリー 大容量",
    "デスク周り ガジェット",
    "スマートウォッチ",
    "USB-C 充電器",
    "PC周辺機器 便利",
    "スマホ アクセサリー",
  ],

  // 投稿する時刻（日本時間）
  postHour: 21,
  postMinute: 0,

  // Threadsの1投稿あたりの上限文字数
  maxTextLength: 500,

  // 商品の抽出条件
  search: {
    hits: 30,              // 取得件数（1〜30）
    minPrice: 1000,        // 安すぎる商品を除外
    maxPrice: 30000,       // 高すぎる商品を除外
    minReviewCount: 20,    // レビューが少ない商品を除外
    minReviewAverage: 4.0, // 評価が低い商品を除外
  },

  // 過去に紹介した商品を何件記憶しておくか（重複投稿の防止）
  historyLimit: 300,
};

// 楽天APIに送る Referer。申請時の「許可されているウェブサイト」と一致する必要があります。
export const refererUrl = `https://${config.githubUser}.github.io/${config.repoName}/`;

// 許可ドメイン欄に入力すべき値
export const allowedDomain = `${config.githubUser}.github.io`;
