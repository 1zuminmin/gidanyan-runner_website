# クリア後ストーリーの入れ方

各フォルダに漫画画像を置き、manifest.json に表示順のファイル名を記入します。
- easy/ : Easy
- normal/ : Normal
- hard/ : Hard
- ex/ : Extra (Omake)

例: easy/01.png と easy/02.png を置いたら、manifest.json の easy を ["01.png", "02.png"] にします。
PNG・JPG・JPEG・WebP に対応。ファイル名は半角英数字・ハイフン・アンダースコアで指定してください。
ページ数は自由。画像全体を幅に合わせて1ページずつ表示し、左右にスワイプ・横スクロールして切り替えます。、漫画は余白込みの完成画像で用意してください。
空の配列の場合は「準備中」を表示します。開始前の漫画には影響しません。

## Unityとの連携
新しいWebGLビルドが必要です。今回のUnityソース変更を含めてビルドし、game/Build のビルド一式を更新してください。
Unityから window.gidanyanRunState("easy", "cleared") のように通知され、launch.js が親ページに安全な送信元・コース・読み込みID付きで渡します。
started: リトライ等でボタンを隠す / cleared: ゴール成功 / failed: 失敗（Easy・Normal・Hardでは表示しない。エンドレス形式のExtraは終了後に表示する）。
旧ビルドは通知を送らないので、ウェブサイトだけ更新してもボタンは出ません。
全画面表示中はPLAY画面の外側が見えないため、全画面を解除して下にスクロールしてください。
