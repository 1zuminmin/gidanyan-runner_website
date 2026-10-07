# 走れ！ ぎだにゃん！ — website

## ぎだにゃんフォト（試作）

ホームの「PHOTO」から `photo.html` へ移動するとカメラの利用を要求します。フレーム3種・OFFと、ポーズ2種・OFFを選び、撮影後にPNG保存または撮り直しができます。対応端末では共有メニューから写真への保存もできます。写真・映像のアップロード処理はありません。

- カメラはHTTPSまたはlocalhostで利用してください。スマートフォンからPCのHTTPのLANアドレスへアクセスしてもカメラは使えません。
- 写真は1080×1440px（3:4）です。カメラ映像を3:4の全面に合わせて中央で切り取り、自撮りカメラだけ左右反転します。映像の倍率・位置・切り取り範囲はフレームの種類やOFFにかかわらず固定し、その上にフレーム、ポーズの順で重ねます。プレビューと保存は同じCanvasを使います。
- 撮影画面は端末の表示領域に収まり、下部1列に「フレーム／ポーズ」「前後切替」「撮影」の3組を配置します。フレーム・ポーズは文字ボタンを押すたびに順送りし、最後のOFFの次は最初に戻ります。フレームOFFではフレームレイヤーだけを非表示にし、ポーズは独立して選べます。横向きの低い画面では操作を右側に配置します。右上の「遊び方」で説明を開けます。
- 撮影完了、ホームへ戻る、ページを離れる、タブを隠すタイミングでカメラを停止します。タブへ戻った場合は「起動」で再開します。
- 「保存」はブラウザのダウンロードです。保存先は端末によって異なります。撮影後の画像を長押しする方法も利用できます。
- インスタ風・X風フレームは制作済みの `images/photo/frame-insta.png` / `frame-x.png` を使用します。オリジナルフレームとポーズは仮素材です。残りの素材も透過PNG等へ差し替え、`photo-renderer.mjs` の `FRAMES` / `POSES` のパスを変更してください。フレームは1080×1440pxの透過キャンバスに自由に配置し、映像を見せる部分は透明にします。外枠や写真窓の指定は不要で、半透明の装飾も使えます。ポーズは共通の300×360pxの透明キャンバスを想定し、`POSE_AREA` で配置します。

既存テストは `node --test tests/difficulty.test.mjs`。撮影機能のブラウザテストはPlaywrightとChromeを使い、`node --test tests/photo.browser.mjs` で実行します（必要なら `npm install --no-save --package-lock=false playwright`、Edgeを使う場合は環境変数 `PHOTO_TEST_BROWSER=msedge`）。ブラウザテストはテスト用映像のみを使用し、実際のカメラを起動しません。

実機ではiPhoneのSafari・AndroidのChromeで、許可、前後カメラ切替、保存／長押し保存、撮り直し、ホームへの復帰を確認してください。

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
2. 漫画4枚の準備後、読んでいる間にゲームが先読みされる
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

## 難易度とUnityの接続

| ページ | 表示 | Unityシーン |
|---|---|---|
| `stage1.html` | Easy | `Easy.unity` |
| `stage2.html` | Normal | 現在の `Main.unity` |
| `stage3.html` | Hard（準備中） | 未実装のため起動しない |

EasyとNormalは既存の4ページの漫画を共用します。ページの`data-difficulty`を`script.js`が読み、iframeのURLへ`difficulty=easy`または`difficulty=normal`を付けます。URL・漫画の画像ファイル名は従来のstage番号を維持しています。

ゲーム中はPCでも、画面上でマウスを押したまま上下左右へ動かして離すとスワイプできます。左右でレーン移動、上でジャンプ、下でスライドします。

低速回線では漫画を優先します。1ページ目を取得・デコードして表示した後、残り3枚を順番に先読みし、4枚すべての準備が整ってからUnityを読み込みます。NEXTは次の画像の準備が整うまで無効にし、準備済みの画像要素へ切り替えると同時にページ番号を更新します。画像の失敗・60秒のタイムアウト時は「漫画を再試行」を表示し、取得できたページを維持したまま失敗したページから再開します。Unityの180秒のタイムアウトはUnityの読み込み開始時から計測します。

Unity側ではWebBootstrap → 対象シーンの順に読み込みます。`game/launch.js`はUnity本体と対象シーンの両方の準備完了を待ってから親ページへ通知します。難易度・読み込みID・送信元が一致した通知だけでPLAYを有効にします。失敗時は同じ難易度で再試行します。

ゲームへの直接アクセスで難易度を省略した場合はNormalです。Hard・空文字・不明な難易度はエラーを表示し、別の難易度を代わりに起動しません。

### 接続に対応したビルドの作成

Unity側の `Tools > Gidanyan Runner > Build Web (Easy and Normal)` を使い、WebBootstrap・Easy・Mainを含むビルドを作成します。従来のMainのみのビルドは準備完了通知に対応していないため使用できません。

`Builds/WebDifficulty/Build`内の4ファイルを上記の名前へそろえて`game/Build`へコピーし、`StreamingAssets`も`game/StreamingAssets`へ反映します。初回および接続処理の更新時は、ビルド出力の`launch.js`も`game/launch.js`へコピーします。元ファイルはUnity側の`Assets/WebGLTemplates/GidanyanMobile/launch.js`です。Web独自の`game/index.html`は維持してください。

`script.js`のUNITY_URL、`game/index.html`のbuildVersion、およびlaunch.jsを読み込むURLのバージョンを更新します。

### 検証

`node --test tests/difficulty.test.mjs`で漫画を優先する取得順、低速時のページ送り、画像の失敗・タイムアウト・再試行、Unity準備完了の順序、難易度の一致を確認できます。HTTPサーバー上ではEasyとNormalで漫画→PLAY→ゲーム開始、Hardで準備中とBACK、スマートフォン幅の表示を確認します。
