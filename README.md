# Threads商品紹介 投稿支援ツール

楽天市場APIで商品を探し、紹介文の下書きを作って、Typefully経由でThreadsの21時の枠に登録します。

投稿は **`plan_at`（下書きとして枠に置くだけ）** で登録されるため、
自分がTypefullyで確認して確定するまで投稿されません。
楽天アフィリエイトは「同じ内容・内容の薄い投稿の繰り返し」をスパムとして禁止しているため、
全自動ではなくこの半自動構成を既定にしています。

---

## セットアップ手順

### 1. 設定を書き換える

`src/config.mjs` を開き、次の2つを変更します。

- `githubUser` … あなたのGitHubユーザー名（**必須**）
- `keywords` … 紹介したい商品のジャンル

### 2. GitHubにリポジトリを作る

リポジトリ名は `rakuten-threads`（`config.mjs` の `repoName` と揃える）。
**Public** で作成してください（PrivateだとGitHub Pagesが有料プラン扱いになります）。

```bash
git init
git add .
git commit -m "初期セットアップ"
git branch -M main
git remote add origin https://github.com/jakkarukato/rakuten-threads.git
git push -u origin main
```

### 3. GitHub Pages を有効化する

リポジトリの **Settings → Pages** で
Source = `Deploy from a branch`、Branch = `main` / `/docs` を選択して保存。

数分後に `https://jakkarukato.github.io/rakuten-threads/` が開けるようになります。
**このURLが実際に開けることを確認してから、次の楽天への申請に進んでください。**

### 4. 楽天ウェブサービスに申請する

https://webservice.rakuten.co.jp/ から新規申請。記入内容は以下のとおり。

| 項目 | 記入内容 |
|---|---|
| 申請名 | `Threads商品紹介 投稿支援ツール` |
| アプリケーションURL | `https://jakkarukato.github.io/rakuten-threads/` |
| 申請タイプ | **Webアプリケーション**（バックエンドサービスは固定IPが必要なのでNG） |
| 許可されているウェブサイト | `jakkarukato.github.io` ※楽天のドメイン例は消す |
| APIアクセススコープ | 楽天一葉API（＝楽天市場API）のみ |
| 期待されるQPS | `1` |

説明欄と使用目的は `docs/index.html` の文面をそのまま使えます。

承認されると **applicationId** と **accessKey** が発行されます（新仕様では両方必須）。

### 5. 楽天アフィリエイトに登録する

https://affiliate.rakuten.co.jp/ で楽天会員としてログインし、規約に同意。
**審査はありません。** アフィリエイトIDを控えておきます。

### 6. Typefully を設定する

1. Threadsアカウントを接続
2. **Settings → API** でAPIキーを発行
3. `social_set_id` を調べる：

```bash
TYPEFULLY_API_KEY=xxx node src/list-sets.mjs
```

### 7. GitHub Secrets に登録する

リポジトリの **Settings → Secrets and variables → Actions** で以下5つを登録。

| 名前 | 値 |
|---|---|
| `RAKUTEN_APP_ID` | 楽天ウェブサービスのapplicationId |
| `RAKUTEN_ACCESS_KEY` | 楽天ウェブサービスのaccessKey |
| `RAKUTEN_AFFILIATE_ID` | 楽天アフィリエイトのID |
| `TYPEFULLY_API_KEY` | TypefullyのAPIキー |
| `TYPEFULLY_SOCIAL_SET_ID` | 手順6で調べたID |

### 8. テスト実行

**Actions** タブ →「毎日の投稿下書き作成」→ **Run workflow**。
`dry_run` に **チェックを入れたまま**実行すると、Typefullyには登録せず
生成される文面だけをログで確認できます。

問題なければ `dry_run` のチェックを外して本番実行。

---

## 運用の注意（守らないとアカウント停止の対象です）

- **`#PR` を消さない。** ステマ規制対応。楽天の禁止事項に明記されています
- **文面テンプレを自分の言葉に書き換える。** 既定のままだと機械的で「内容の薄い投稿」と判定されます
- **確定前に一言そえる。** plan_at で置かれた下書きに自分のコメントを足してから投稿するのが理想
- **1日1件を超えない。** 繰り返し投稿はスパム判定されます
- **複数アカウントで同じ内容を流さない。** 明確に禁止されています
- ハッシュタグは3個まで（乱用は禁止事項）

## 実行タイミング

| 何が | いつ |
|---|---|
| GitHub Actions が起動 | 毎日 09:00（日本時間） |
| Typefully に下書きが置かれる | その日の 21:00 の枠 |
| 実際に投稿される | あなたがTypefullyで確定したとき |

`src/config.mjs` の `postHour` で投稿時刻を変更できます。

## 全自動にしたい場合

`.github/workflows/daily.yml` の `AUTO_PUBLISH` を `"1"` にすると
`publish_at` で登録され、確認なしで21時に投稿されます。
規約リスクが上がるため推奨しません。
