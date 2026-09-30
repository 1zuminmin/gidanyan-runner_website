# 走れ！ ぎだにゃん！ — website
# Unity WebGL 新ビルド適用手順

## 1. UnityでWebGLビルドを作成する

Unity側では、次の設定でWebGLビルドを出力する。

- Compression Format：`Brotli`
- Decompression Fallback：有効

ビルド後、`Build`フォルダに以下の4ファイルがあることを確認する。

- `*.data.unityweb`
- `*.framework.js.unityweb`
- `*.loader.js`
- `*.wasm.unityweb`

## 2. ビルドファイルを入れ替える

Webサイト側の `game/Build` フォルダを開く。

新しいビルドの4ファイルを、次の名前で上書きする。

| Unityから出力されたファイル | Webサイト側のファイル名 |
|---|---|
| `*.data.unityweb` | `unity.data.unityweb` |
| `*.framework.js.unityweb` | `unity.framework.js.unityweb` |
| `*.loader.js` | `unity.loader.js` |
| `*.wasm.unityweb` | `unity.wasm.unityweb` |

ファイル名は必ず小文字の `unity` に統一する。

GitHub Pagesではファイル名の大文字・小文字が区別されるため、`Unity.data.unityweb` のような大文字の名前にしないこと。

## 3. `game/index.html`は上書きしない

Unityが出力した `index.html` は使用しない。

このWebサイトの `game/index.html` には、次の処理が追加されている。

- キャッシュ制御
- ゲームの先読み
- 読み込み完了通知
- 読み込み失敗時の再試行
- エラー表示

Unityの `index.html` で上書きすると、漫画の最終ページで「PLAY」が表示されなくなる場合がある。

誤って上書きした場合は、コミット前に次のコマンドで元に戻す。

```powershell
git restore game/index.html
```

その後、次の手順でキャッシュバージョンだけ変更する。

## 4. キャッシュバージョンを更新する

ビルド日時を、次の形式で決める。

```text
YYYYMMDD-HHmm
```

例：

```text
20260930-1530
```

### `script.js`を変更する

次の行を探す。

```javascript
const UNITY_URL = "./game/index.html?v=20260925-1609";
```

末尾のバージョンを今回の値へ変更する。

```javascript
const UNITY_URL = "./game/index.html?v=20260930-1530";
```

### `game/index.html`を変更する

次の行を探す。

```javascript
const buildVersion = "20260925-1609";
```

`script.js`と同じ値へ変更する。

```javascript
const buildVersion = "20260930-1530";
```

`script.js`と`game/index.html`のバージョンは、必ず同じ値にする。

## 5. 変更内容を確認する

次のコマンドを実行する。

```powershell
git status --short
git diff --check
```

主に変更されるファイルは以下のとおり。

```text
game/Build/unity.data.unityweb
game/Build/unity.framework.js.unityweb
game/Build/unity.loader.js
game/Build/unity.wasm.unityweb
game/index.html
script.js
```

ビルドによって内容が変わらなかったファイルは、変更一覧に表示されない場合がある。

`game/index.html`と`script.js`については、基本的にキャッシュバージョン以外が変更されていないことを確認する。

## 6. ローカルで動作確認する

HTMLファイルを直接ダブルクリックして開かないこと。

Visual Studio CodeのLive Serverなど、HTTPサーバーを使用して `stage1.html` を開く。

以下の内容を確認する。

1. 漫画が4ページ目まで表示される
2. 漫画を読んでいる間にゲームが先読みされる
3. 読み込み完了後に「PLAY」が表示される
4. 「PLAY」を押すとゲームが表示される
5. ゲームを操作できる
6. 「再試行」や読み込みエラーが表示されない

## 7. GitHubへ反映する

作業ブランチで次のコマンドを実行する。

```powershell
git add game script.js
git commit -m "Unityビルドを更新"
git push
```

GitHubでPull Requestを作成し、`main`ブランチへマージする。

GitHub Pagesの公開元は`main`ブランチのため、作業ブランチへプッシュしただけでは公開ページは更新されない。

## 8. 公開ページを確認する

公開URL：

https://1zuminmin.github.io/gidanyan-runner_website/stage1.html

マージ後、公開ページへ反映されるまで数分かかる場合がある。

古いビルドが表示される場合は、ページをスーパーリロードする。

- Windows：`Ctrl + F5`
- Mac：`Command + Shift + R`

## よくある問題

### 読み込みファイルが404になる

`game/index.html`内のファイル名と、`game/Build`内のファイル名を確認する。

すべて小文字の `unity` で統一する。

### 古いゲームが表示される

`script.js`と`game/index.html`のキャッシュバージョンが更新されているか確認する。

2か所には必ず同じ値を設定する。

### 「PLAY」が表示されない

`game/index.html`がUnity出力のファイルで上書きされている可能性がある。

次のコマンドでWebサイト用のファイルへ戻す。

```powershell
git restore game/index.html
```

その後、`buildVersion`だけを新しい値へ変更する。

### ローカルでは動くがGitHub Pagesでは動かない

ファイル名の大文字・小文字を確認する。

Windowsでは大文字・小文字が違っていても動く場合があるが、GitHub Pagesでは別ファイルとして扱われる。
