# 走れ！ ぎだにゃん！ — website

## サイトURL
https://game.gidaisai.jp/index.html

## ファイル構成

- `index.html`：ホーム
- `game/`：難易度選択、各ステージ、ゲーム用CSS・JavaScript、漫画、Unityビルド
- `assets/css/`：共通の基本スタイル・ボタン、ホーム用のスタイル
- `images/`：ホームなどサイト共通の画像
- `photo/`：おまけの撮影画面、CSS・JavaScript、フレーム・ポーズ素材
- `tests/`：ゲームとフォトの動作確認

以前の `stage1.html` などのステージURLと `photo.html` は、GitHub Pagesの `404.html` から新しい場所へ案内します。ローカルで旧URLを確認する場合も、404時にこのHTMLを返すサーバーが必要です。

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

### `game/script.js`を変更する

次の行を探す。

```javascript
const UNITY_URL = "./index.html?v=20260925-1609";
```

末尾のバージョンを今回の値へ変更する。

```javascript
const UNITY_URL = "./index.html?v=20260930-1530";
```

### `game/index.html`を変更する

次の行を探す。

```javascript
const buildVersion = "20260925-1609";
```

`game/script.js`と同じ値へ変更する。

```javascript
const buildVersion = "20260930-1530";
```

`game/script.js`と`game/index.html`のバージョンは、必ず同じ値にする。

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
game/script.js
```

ビルドによって内容が変わらなかったファイルは、変更一覧に表示されない場合がある。

`game/index.html`と`game/script.js`については、基本的にキャッシュバージョン以外が変更されていないことを確認する。

## 6. ローカルで動作確認する

HTMLファイルを直接ダブルクリックして開かないこと。

Visual Studio CodeのLive Serverなど、HTTPサーバーを使用して `game/stage1.html` を開く。

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
git add game
git commit -m "Unityビルドを更新"
git push
```

GitHubでPull Requestを作成し、`main`ブランチへマージする。

GitHub Pagesの公開元は`main`ブランチのため、作業ブランチへプッシュしただけでは公開ページは更新されない。

## 8. 公開ページを確認する

公開URL：

https://1zuminmin.github.io/gidanyan-runner_website/game/stage1.html

マージ後、公開ページへ反映されるまで数分かかる場合がある。

古いビルドが表示される場合は、ページをスーパーリロードする。

- Windows：`Ctrl + F5`
- Mac：`Command + Shift + R`

## よくある問題

### 読み込みファイルが404になる

`game/index.html`内のファイル名と、`game/Build`内のファイル名を確認する。

すべて小文字の `unity` で統一する。

### 古いゲームが表示される

`game/script.js`と`game/index.html`のキャッシュバージョンが更新されているか確認する。

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
| `game/stage1.html` | Easy | `Easy.unity` |
| `game/stage2.html` | Normal | `Normal.unity` |
| `game/stage3.html` | Hard | `Hard.unity` |
| `game/stage4.html` | EX（スコアアタック！） | `Special.unity` |

4ステージは既存の4ページの漫画と1つのUnityビルドを共用します。ページの`data-difficulty`を`game/script.js`が読み、iframeのURLへ`difficulty=easy`／`normal`／`hard`／`ex`を付けます。ステージページと漫画は `game/` 以下にまとめています。

漫画は元画像の白い余白を表示範囲から除き、コマの大きさに枠を合わせます。4枚共通の表示範囲は1536×2048pxの画像内の左上(142, 566)、幅1252×高さ916pxで、元画像は変更していません。画像を差し替える際は `game/style.css` の `.manga-box` の表示範囲も確認してください。上部の「戻る」は難易度選択へ戻り、漫画の下に並ぶBACK／NEXTは漫画のページを移動します。1ページ目ではBACKを無効にし、最終ページではゲームの準備完了後にNEXTがPLAYへ変わります。

2026年10月7日時点でUnityのNormal・Hard・SpecialはMainの複製で、ゲーム内容・設定も共通です。各ボタンはそれぞれの専用シーンへ接続しますが、難易度の調整はUnity側の今後の作業です。

ゲーム中はPCでも、画面上でマウスを押したまま上下左右へ動かして離すとスワイプできます。左右でレーン移動、上でジャンプ、下でスライドします。

低速回線では漫画を優先します。1ページ目を取得・デコードして表示した後、残り3枚を順番に先読みし、4枚すべての準備が整ってからUnityを読み込みます。NEXTは次の画像の準備が整うまで無効にし、準備済みの画像要素へ切り替えると同時にページ番号を更新します。画像の失敗・60秒のタイムアウト時は「漫画を再試行」を表示し、取得できたページを維持したまま失敗したページから再開します。Unityの180秒のタイムアウトはUnityの読み込み開始時から計測します。

Unity側ではWebBootstrap → 対象シーンの順に読み込みます。`game/launch.js`はUnity本体と対象シーンの両方の準備完了を待ってから親ページへ通知します。難易度・読み込みID・送信元が一致した通知だけでPLAYを有効にします。失敗時は同じ難易度で再試行します。

ゲームへの直接アクセスで難易度を省略した場合はNormalです。空文字・不明な難易度はエラーを表示し、別の難易度を代わりに起動しません。

### 接続に対応したビルドの作成

Unity側の `Tools > Gidanyan Runner > Build Web (All Stages)` を使い、WebBootstrap・Easy・Normal・Hard・Specialを含むビルドを作成します。従来のMainのみのビルドは準備完了通知に対応していないため使用できません。

`Builds/WebDifficulty/Build`内の4ファイルを上記の名前へそろえて`game/Build`へコピーし、`StreamingAssets`も`game/StreamingAssets`へ反映します。初回および接続処理の更新時は、ビルド出力の`launch.js`も`game/launch.js`へコピーします。元ファイルはUnity側の`Assets/WebGLTemplates/GidanyanMobile/launch.js`です。Web独自の`game/index.html`は維持してください。

`game/script.js`のUNITY_URL、`game/index.html`のbuildVersion、およびlaunch.jsを読み込むURLのバージョンを更新します。

### 検証

`node --test tests/difficulty.test.mjs`で漫画を優先する取得順、低速時のページ送り、画像の失敗・タイムアウト・再試行、全4ステージのUnity準備完了の順序、選択したステージの一致を確認できます。HTTPサーバー上では全4ステージで漫画→PLAY→ゲーム開始、スマートフォン幅の表示を確認します。

`node --test tests/structure.test.mjs`でHTMLから参照するファイルの存在を確認します。PlaywrightとChromeを使う `node --test tests/game.browser.mjs` では、GitHub Pagesと同じサブディレクトリ構成でホーム→難易度選択→漫画→PLAY→戻るの遷移、画像・CSSの取得、旧URLからの移動を確認します。このテストではUnity本体を代用するため、ゲーム本体の実機確認は別に行ってください。

## おまけ：ぎだにゃんフォト（試作）

ホームの「PHOTO」から `photo/index.html` へ移動するとカメラの利用を要求します。フレーム3種・OFFと、ポーズ2種・OFFを選び、撮影後にPNG保存または撮り直しができます。対応端末では共有メニューから写真への保存もできます。写真・映像のアップロード処理はありません。

- カメラはHTTPSまたはlocalhostで利用してください。スマートフォンからPCのHTTPのLANアドレスへアクセスしてもカメラは使えません。
- 写真は1080×1440px（3:4）です。カメラ映像を3:4の全面に合わせて中央で切り取り、自撮りカメラだけ左右反転します。映像の倍率・位置・切り取り範囲はフレームの種類やOFFにかかわらず固定し、その上にポーズ、フレームの順で重ねます。ぎだにゃんはフレームの下に入り、プレビューと保存は同じCanvasを使います。
- インスタ風・X風フレームは周囲5％の余白、角丸、外側の薄い影を付けて重ねます。`FRAME_CARD` が配置・角丸の設定です。3つ目のオリジナルフレームは1080×1440pxの写真全体に素材をそのまま配置し、余白・追加の角丸・影を付けません。素材の縦横比と透過部分を維持し、保存PNGにも同じ仕上がりを反映します。画面の黒枠は保存画像には含まれません。
- インスタ風・X風はカメラ映像とぎだにゃんを重ねてから、角丸カードの外側をぼかします。オリジナルではぼかしを使わず、カメラ映像は全体を鮮明に保ち、ぎだにゃんだけが素材の内枠に沿って72px幅で透明になるようフェードします。左上・右下の曲線に合わせて枠の外へ自然に消え、装飾は手前に重なります（`ORIGINAL_FRAME_WINDOW` で位置・曲率・フェード幅を調整）。保存PNGにも同じ処理を反映し、フレームOFFではぼかし・フェードとも解除します。ぼかしは180×240pxの作業画像で計算し、フェード済みポーズは再利用するため、Canvasの`filter`機能には依存しません。
- 撮影画面は端末の表示領域に収まり、下部1列に「フレーム／ポーズ」「前後切替」「撮影」の3組を配置します。フレーム・ポーズは文字ボタンを押すたびに順送りし、最後のOFFの次は最初に戻ります。フレームOFFではフレームレイヤーだけを非表示にし、ポーズは独立して選べます。横向きの低い画面では操作を右側に配置します。右上の「遊び方」で説明を開けます。
- 撮影完了、ホームへ戻る、ページを離れる、タブを隠すタイミングでカメラを停止します。タブへ戻った場合は「起動」で再開します。
- 「保存」はブラウザのダウンロードです。保存先は端末によって異なります。撮影後の画像を長押しする方法も利用できます。
- フレーム3種とポーズ2種は `photo/images/` の制作済みPNGを使用します（`frame-insta.png`、`frame-x.png`、`frame-original.png`、`pose-1.png`、`pose-2.png`）。素材はすべて1080×1440pxの透過キャンバスで、映像を見せる部分は透明にします。インスタ風・X風はカード領域、オリジナルとポーズは写真全体に配置します。半透明の装飾も使えます。参照先は `photo/photo-renderer.mjs` の `FRAMES` / `POSES`、ポーズの描画範囲は `POSE_AREA` で設定します。オリジナルの枠形状を変えた場合は `ORIGINAL_FRAME_WINDOW` のフェード境界も合わせて調整してください。

既存テストは `node --test tests/difficulty.test.mjs`。撮影機能のブラウザテストはPlaywrightとChromeを使い、`node --test tests/photo.browser.mjs` で実行します（必要なら `npm install --no-save --package-lock=false playwright`、Edgeを使う場合は環境変数 `PHOTO_TEST_BROWSER=msedge`）。ブラウザテストはテスト用映像のみを使用し、実際のカメラを起動しません。

実機ではiPhoneのSafari・AndroidのChromeで、許可、前後カメラ切替、保存／長押し保存、撮り直し、ホームへの復帰を確認してください。
