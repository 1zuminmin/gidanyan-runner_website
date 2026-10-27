# CREDITS の編集

トップページの既存の「CREDITS」ボタンから credits.html に移動します。Unity の再ビルドは不要です。

## メンバー名の入力

credits.html の「制作メンバー編集欄」を検索してください。

次のようになっている各行の dd 内の span を、表示したい名前に置き換えます。

```html
<div><dt>ゲーム</dt><dd class="member-name"><span>お名前</span><span>お名前</span></dd></div>
```

ジャンルは dt の中です。span を追加すると同じジャンルに名前を追加できます。複数のジャンルを担当している方は、それぞれに掲載できます。行（div）をコピーするとジャンルを追加できます。ブラウザ上で入力・保存するフォームではなく、HTMLを編集するテンプレートです。

## 確認した出典（2026-10-26）

- エリアBGMは依頼されたURLで曲名・作者を確認。柳ヶ瀬／ハロウィンはご指定どおり同じ23925。
- MOERU MUSICは提供URLを記載。曲名・作者は公式ページから取得できなかったため推測で追加していない。
- タイトルボタン音は提供URL（効果音ラボの一覧）。個別の効果音名は未特定。
- 鮎ライド：2026-10-28に提供されたURLで「Rush Recklessly / FLASH☆BEAT」を確認し更新。https://opentracks.com/bgm/detail/23946
- Unity側 Docs/AUDIO_CREDITS.md でも現在の音源は AyuRideBGM2.mp3、旧NCS音源は削除済みと記録されている。今回の作業はWebクレジットのみ。
- その他の効果音の使用箇所は同資料の Provider-licensed audio の対応表に基づく。
- On-Jinの禁止表記は維持。公式規約 https://on-jin.com/kiyaku.php では音源がむき出しになる配布の場合に表記が必須。Unity側NOTICE.mdでも必須表記として管理されており、全配布形態で不要との確認が取れていないため削除しない。
- OtoLogicの作者・曲名・CC BY 4.0リンクは維持し、「音声の加工なし（ファイル名変更）」の説明だけ削除。
- Special Thanksは皆さまへのお礼、試遊で長く遊んでくれた方へのお礼の順に掲載。二つのお礼を同じ thanks-message クラスで表示する。

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
