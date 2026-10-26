# Cloudflare Workers + D1（公開ランキング）

既存の Node ローカルサーバーとは別の公開用実装です。Unity の再ビルドは不要です。

## ダッシュボードで設定

1. D1 `gidanyan-ranking` を作り、Worker `gidanyan-ranking-api` に名前 `DB` でバインドする。
2. Worker の Edit code で `worker.js` の全文を、このフォルダの `worker.mjs` の全文に置き換え、Deploy する。拡張子は画面上の worker.js のままでよい。
3. D1 データベースを開き Console で `schema.sql` を実行する。これはこの実装用の空の D1 に対して行う。ローカル Node の runs は構造が異なるため、SQLite ファイルをそのまま取り込まない。
4. Worker URL の `/` にアクセスし `{"ok":true,"service":"gidanyan-ranking-api","ruleset":"ex-v1"}` が返ることを確認する。表が未作成の間は 500 になる。
5. `/api/leaderboard` で top が空配列、total が 0 であることを確認する。
6. 最後に `game/ranking-config.json` の apiBase を `https://gidanyan-ranking-api.game-yuru9.workers.dev` に変更して Web リポジトリを公開する。バックエンドの確認前には切り替えない。
7. 公開サイトで EX を最初からプレイし、記録を登録する。別回線のスマホでランキングを確認する。

デフォルトの許可 Origin は `https://game.gidaisai.jp` のみ。追加する場合は Worker のテキスト環境変数 `ALLOWED_ORIGINS` にカンマ区切りで指定する。末尾 / は付けない。Worker URL を直接開く確認では Origin は不要。

## 仕様と限界

- 既存と同じ ex-v1：走行距離の整数値 + キャンディ × 3750。時間は整合性確認に使用。
- ブラウザのトークンを SHA-256 で保存。端末をまたぐアカウント同期はない。
- 一人一件の自己ベスト、同点は同順位。同点・低いスコアでは名前も更新しない。
- 一人一件の現在の開始記録。新しいプレイ開始時に古い未登録記録を置き換える。開始から48時間で期限切れ。
- 同じ run の同じ内容は再送可能。異なる内容の再送は409。D1 batch 内の条件付き書き込みで競合時も二重登録を防ぐ。
- 個人順位はスコア帯別の集計と該当帯のインデックス検索を使用。新規・更新・削除で集計をトリガーにより保つ。
- 開始要求は同じブラウザにつき1秒間隔。共有Wi-Fiを丸ごと120回/分で制限しない。これは包括的な不正アクセス制限ではない。
- トークンやスコアはクライアント生成。検算しているが改造クライアントを完全には排除できない。賞品を伴う競技向けの不正対策ではない。
- 無料枠を超えると利用できなくなる可能性がある。イベントの繰り返しプレイ・プリフライト・順位検索も利用量に含まれる。20,000人の無料利用を保証しない。
- `tests/cloudflare-ranking.test.mjs` は Node SQLite を D1 API 相当で包んだローカルテスト。20,000件の順位整合性も確認するが、Cloudflare実環境の負荷試験や課金量測定ではない。

確認: `node --test tests/cloudflare-ranking.test.mjs`
公式の batch トランザクション仕様: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
