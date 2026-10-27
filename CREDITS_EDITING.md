# CREDITS の編集

トップページの既存の「CREDITS」ボタンから credits.html に移動します。Unity の再ビルドは不要です。

## メンバー名の入力

credits.html の「制作メンバー編集欄」を検索してください。

次のようになっている各行の dd 内の span を、表示したい名前に置き換えます。

```html
<div><dt>ゲーム開発</dt><dd class="member-name">お名前・お名前</dd></div>
```

役割は dt の中です。行（div）をコピーすれば追加できます。未記入時は点線の空欄を表示します。ブラウザ上で入力・保存するフォームではなく、HTMLを編集するテンプレートです。

## 確認した出典（2026-10-26）

- エリアBGMは依頼されたURLで曲名・作者を確認。柳ヶ瀬／ハロウィンはご指定どおり同じ23925。
- MOERU MUSICは提供URLを記載。曲名・作者は公式ページから取得できなかったため推測で追加していない。
- タイトルボタン音は提供URL（効果音ラボの一覧）。個別の効果音名は未特定。
- 鮎ライド：Unity側 Docs/AUDIO_CREDITS.md の AyuMode.mp3 行、Required notices。Laszlo - Here We Are [NCS Release]、抜粋ループ。
- On-Jin、ポケットサウンド、OtoLogic、効果音ラボの表記も同資料とNOTICE.mdから記載。

### 鮎ライドの許諾確認

Docs/AUDIO_CREDITS.md には「申請・書面確認待ち」と記載されている。ユーザーからも取得済みの回答はまだない。
2026-10-26確認の https://ncs.io/usage-policy では、ゲーム利用はライセンス申請フォームに連絡するよう案内されている。学生・インディー映画制作の項目でも連絡が必要。「非販売の学生制作だから自動的にゲーム利用も許可」とは判断できない。
クレジット追加は許諾取得の代わりにならない。申請・承諾記録をチームで確認すること。今回、音源やUnityプロジェクトは変更していない。

### Unity Asset の照合

Assets 配下の .meta の AssetOrigin.packageName / productId と公式商品ページを照合した。プロジェクトへの導入を確認した一覧であり、全アセットの現在の公開ビルドへの使用・同梱状況までは監査していない。

| アセット | productId | 確認したローカルファイル |
|---|---|---|
| Fantasy Skybox FREE | 18353 | Assets/Arts/Downloaded Assets/Fantasy Skybox FREE/ReleaseNotes.txt.meta |
| AllSky Free - 10 Sky / Skybox Set | 146014 | Assets/yukina_3D/GifuStationSkybox/GifuStationPanorama.png.meta |
| Breakable Spooky Pumpkins | 12060 | Assets/yukina_3D/Spooky pumpkins/scene.unity.meta |
| Simple Stylized Cardboard Boxes | 308830 | Assets/yukina_3D/Cardboard Boxes/Lighting Settings.lighting.meta |
| Fireworks | 101035 | Assets/Fireworks/Scenes/Demo Scene.unity.meta |
| 3D_Effects_VariousHit | 312657 | Assets/EasyAssets/Hit_Effect_Pack/Readme_Jp.pdf.meta |
| 3D Games Effects Pack Free | 42285 | Assets/Arts/Downloaded Assets/_Creepy_Cat/3D Games Effects Pack Free/Example_01.unity.meta |

各商品の公式URLは credits.html のリンクを参照。素材本体はWebリポジトリへコピーしていない。
