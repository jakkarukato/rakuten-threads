# Threads商品紹介 投稿支援ツール

楽天市場の売れ筋ランキングから商品を選び、紹介文を作って Threads に投稿します。
**投稿前にあなたの承認が入ります。** 承認しなければ投稿されません。

## 動作の流れ

```
毎日 20:50 (JST)  GitHub Actions が起動
                  └ 楽天ランキングから商品を選び、紹介文を生成
                  └ 承認待ちで停止（スマホに通知が届く）

あなたが内容を確認して Approve を押す
                  └ Threads API で投稿
                  └ 紹介済みリストを更新（同じ商品を二度紹介しない）
```

承認を押さなければ、その日は投稿されません。
気に入らない文面はそのまま放置すればスキップされます。

---

## セットアップ

### 1. 楽天ウェブサービス

https://webservice.rakuten.co.jp/ でアプリを申請します。

| 項目 | 記入内容 |
|---|---|
| 申請名 | `Threads商品紹介 投稿支援ツール` |
| アプリケーションURL | `https://jakkarukato.github.io/rakuten-threads/` |
| 申請タイプ | **Webアプリケーション** |
| 許可されているウェブサイト | `jakkarukato.github.io` |
| 期待されるQPS | `1` |
| APIアクセススコープ | 楽天市場API のみ |

承認されると **applicationId** と **accessKey** が発行されます。

### 2. 楽天アフィリエイト

https://affiliate.rakuten.co.jp/ で楽天会員としてログインし、規約に同意。
**審査はありません。** アフィリエイトIDを控えます。

### 3. Meta開発者アカウントとアプリ

1. https://developers.facebook.com/ でアプリを作成
2. ユースケースに **Threads API** を追加
3. 権限に `threads_basic` と `threads_content_publish` を追加
4. **Threads testers** に自分のThreadsアカウントを追加し、
   Threadsアプリ側の設定から招待を承認する

自分のアカウントに投稿するだけなら、**Metaの審査（App Review）は不要**です。

### 4. 長期トークンとユーザーIDを取得

アプリダッシュボードで短期トークン（1時間有効）を発行したあと、
以下を実行して長期トークン（60日有効）とユーザーIDを取得します。

`ID.txt` に追記されるだけで、画面には表示されません（ログ流出を防ぐため）。

```bash
APP_SECRET="ここにアプリのシークレット"; SHORT="ここに短期トークン"; LONG=$(curl -s "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=$APP_SECRET&access_token=$SHORT" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4); UID=$(curl -s "https://graph.threads.net/v1.0/me?fields=id&access_token=$LONG" | grep -o '"id":"[^"]*"' | cut -d'"' -f4); printf '\nTHREADS_ACCESS_TOKEN\n%s\nTHREADS_USER_ID\n%s\n' "$LONG" "$UID" >> ID.txt; echo "ID.txt に追記しました"
```

### 5. GitHub Secrets を登録

**Settings → Secrets and variables → Actions**

| 名前 | 値 |
|---|---|
| `RAKUTEN_APP_ID` | 楽天のapplicationId |
| `RAKUTEN_ACCESS_KEY` | 楽天のaccessKey |
| `RAKUTEN_AFFILIATE_ID` | 楽天アフィリエイトID |
| `THREADS_USER_ID` | 手順4で取得 |
| `THREADS_ACCESS_TOKEN` | 手順4で取得 |
| `GH_PAT` | 手順7で作成 |

### 6. 承認ステップを有効にする（最重要）

**Settings → Environments → New environment**

- 名前は **`threads-post`**（コードと一致させること）
- **Required reviewers** にチェックを入れ、自分を指定
- Save

**この設定をしないと、承認なしで投稿されてしまいます。** 必ず設定してください。

### 7. トークン自動更新用のPAT

Threadsの長期トークンは60日で失効し、放置すると復旧に手作業が必要になります。
月2回、自動で更新するために Personal Access Token を作ります。

1. https://github.com/settings/personal-access-tokens/new
2. Repository access: このリポジトリのみ
3. Permissions → Repository permissions → **Secrets: Read and write**
4. 生成されたトークンを `GH_PAT` という名前でSecretsに登録

### 8. テスト実行

**Actions → Threadsへの投稿 → Run workflow**

`dry_run` に**チェックを入れたまま**実行すると、投稿せずに文面だけ確認できます。
実行結果のサマリーに生成された投稿文が表示されます。

問題なければ `dry_run` のチェックを外して実行。承認待ちで止まるので、
内容を確認して **Review deployments → Approve** を押すと投稿されます。

---

## 運用の注意（守らないとアカウント停止の対象です）

楽天アフィリエイトは違反時、**予告なしの利用停止と成果報酬の返金請求**を規定しています。

- **`【PR】` を消さない。** ステマ規制対応。楽天の禁止事項に明記されています。
  Threadsは先頭のハッシュタグを本文から抜くため、`#PR` ではなく `【PR】` を使っています
- **文面テンプレを自分の言葉に書き換える。** 既定のままだと「内容の薄い投稿」と判定されます
- **承認時に一言そえる。** 機械的な投稿の連続がスパム判定の主因です
- **1日1件を超えない**
- **複数アカウントで同じ内容を流さない。** 明確に禁止されています
- ハッシュタグは3個まで（乱用は禁止事項）

Threadsは楽天アフィリエイトの掲載可能SNSに含まれています
（Instagram、X、YouTube、楽天ROOM、TikTok、Pinterest、Lemon8、Facebook、Threads、moflog）。

---

## 設定の変更

`src/config.mjs` で変更できます。

- `genres` … 紹介するジャンル（楽天のジャンルID）
- `filter` … 価格帯、最低レビュー数、最低評価
- `maxTextLength` … Threadsの上限（500文字）

投稿時刻は `.github/workflows/post.yml` の cron を変更してください（UTC指定）。

---

## 技術メモ（ハマりどころ）

実際に叩いて判明した、ドキュメントに書かれていない挙動です。

### 1. 楽天の新APIで必要なのは Referer ではなく Origin

`Referer` を送っても `403 REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING` を返します。
エラーメッセージは REFERRER と言っていますが、実際に検証されているのは **`Origin`** です。

| 送ったヘッダー | 結果 |
|---|---|
| `Referer` のみ | 403 |
| `Origin` のみ | **200** |
| 両方 | 200 |

`Origin` はパスなしのオリジンだけを送ります（`https://jakkarukato.github.io`）。

### 2. ランキングAPIはパスの接頭辞が違う

| API | パス |
|---|---|
| 商品検索 | `/ichibams/api/IchibaItem/Search/20260701` |
| ランキング | `/ichibaranking/api/IchibaItem/Ranking/20220601` |

検索APIと同じ `/ichibams/api/` でランキングを叩くと 404 になります。

### 3. キーワード検索は精度が低い

`keyword=ワイヤレスイヤホン` で30件取得したところ、
商品名に「イヤホン」を含むものは **0件** でした
（中古CD、雪用ワイパー、書道セットなどが返る）。
商品説明文の店舗テンプレートにヒットしているものと思われます。

このため本ツールはキーワード検索ではなく、
**ジャンルID指定のランキングAPI**を使っています。

### 4. Threads APIの制約

- 投稿は2段階（コンテナ作成 → 公開）。間に約30秒の待機が推奨されています
- 1プロフィールあたり **250投稿 / 24時間**。無料
- 長期トークンは **60日で失効**。24時間以上経過していれば更新可能
- **60日を過ぎると永久に失効**し、取得し直しになります

### 5. 公開リポジトリではログも公開される

トークンを `console.log` で出すと全世界に見えます。
`src/refresh-token.mjs` は新しいトークンを一切出力せず、
標準入力経由で `gh secret set` に渡しています。

### 6. Threadsは先頭のハッシュタグを本文から抜く

`#PR` を本文の先頭に置いて投稿したところ、実際に公開された本文は `PR` になっていました
（`#` が消える）。末尾のハッシュタグはそのまま残るため、先頭のものだけがトピックタグとして
抽出されているようです。

広告表記は景品表示法および楽天の規約上の必須項目なので、
ハッシュタグに依存しない `【PR】` を使っています。

### 7. 楽天のaffiliateUrlに改行が混入することがある

同じ商品でもURLの形式が複数あり、**パスの途中に改行が入った形式**が返ることがあります。

```
https://hb.afl.rakuten.co.jp/hgc/xxxx.xxxx.xxxx.xxxx
/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2F...
```

そのまま投稿するとリンクが途中で切れ、クリックしても商品ページに飛べません
（＝報酬が発生しません）。`buildPostText` で空白類を全て除去しています。

取得時点では混入していないことも多いため、**取得したデータを目視しただけでは気づけません。**
実際に投稿された本文をAPIで取り出して初めて判明しました。
