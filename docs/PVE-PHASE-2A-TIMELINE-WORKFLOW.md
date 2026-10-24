# Phase 2a — FXパターン編集（実装・検証済み／未公開）

基準：公開2.2.84 `901ac235dbb6d272a086e4e0d1f163176bdcf862`。開始時にGit/remote mainの一致を確認し、独立clone `.codex-context/development/pve-phase2a` / branch `development/phase2a` を作成しました。旧2.2.83作業ツリー・text02・Feature Labは統合していません。versionは2.2.84のまま、commit/push/deployは行いません。

## 1. 事実：上限と再現

|対象|公開2.2.84|今回|
|---|---|---|
|素材|project.media 200|変更なし。物理ファイル複製なし|
|映像/音声clip|それぞれ200、V3/A4トラック|変更なし|
|TEXT|全overlayトラック共通300、sanitizeで超過分をslice|変更なし。Ctrl複製は事前に全体拒否|
|FX通常追加|全overlayトラック共通100|合計400、フラッシュ以外は100|
|FXドラッグ複製|独立した旧20個制限、Altのみ、1個だけ複製|Ctrl/Altで選択群を共通処理。20個制限を解消|
|FX保存復元|sanitizeのsliceで101個目以降が欠落|超過は明示エラー。400以内は末端まで保持|
|Mac出力|表示中FX100を超えるとエラー|project全体400／非flash100で一致|

旧コードで50→50、100→100、101→100、200→100となる復元を再現しました。素材・クリップ・TEXT・FXは別予算で、トラック単位のFX個数制限や、全種類の合計ITEMS上限はありません。100/20の性能上の定量根拠は既存コード・関連資料から確認できず、ハードコードされた検査です。動的な同時稼働FX数や端末負荷の検査ではありません。

**採用判断**：50/100/200を計測し、200個パターンの1回複製に必要な400個まで評価しました。無制限化せず、重い解析・motion等を含む非flashの予算は従来100のままです。400は全端末で快適と保証する数ではありません。400での再描画/スクロールの引っかかりも下記に記録します。

## 2. 選択・複製の契約

既存のShift追加選択と矩形選択はVIDEO/AUDIO/FX/TEXTの混在に対応しています。従来の通常ドラッグは選択群を移動できますが、Altドラッグは途中でcompanionsを空にして単体だけ複製していました。新しい選択UIは追加していません。

Ctrlを押して選択済みclip本体をドラッグすると複製プレビューを表示し、ドロップ時に選択群全体を確定します。Altも同じ処理を使えます。通常移動・trim・タッチ操作の所有者は従来の処理のままです。CtrlはCmdへ置換していません。

- 全要素へ同じ時間差を適用し、長さ・空白・重なり・元IN/OUT・速度・パラメータ・keyframe・B2境界情報をdeep cloneします。所属トラックは固定で、縦ドラッグによるトラックの付け替えは行いません。
- 吸着ONは既存の編集fps/端点/等間隔の規則でドラッグの基準要素だけを決め、全体に共通deltaを適用します。音声を基準にしたときは映像フレームへ量子化しません。OFFではフレーム丸めをしません。群内の相対間隔を各々丸めません。
- 範囲外drop・上限超過・ID衝突は全体拒否。0秒より前へ動かす場合は群の最初を0へ制限し、相対差を維持します。終端は24時間制約で検査します。
- drop前はDOMのghostのみ。project・素材・保存・履歴を変更しません。Esc/pointercancel/ウィンドウ失焦でghostを破棄します。確定時のcheckpoint/saveは1回、Undo/Redoも1回です。確定後は新しい群を選択します。
- MacのCtrlクリックでcontextmenuが出る経路は、複製ジェスチャーの間だけ抑止します。Ctrl付きbutton=2も扱い、通常の右クリックは維持します。修飾キー以外の編集キーは複製中だけ競合を抑止します。

## 3. ID・リンク・容量の安全性

追加前に全コレクションの容量、複製ID、時刻を検査し、確定直前にも再検査します。元データは動かしません。新IDは既存IDと重複を拒否し、再複製も同様です。動画・画像・音声のmedia IDは共有し、File/OPFS素材を物理複製しません。

既存仕様どおり、選択動画に連動中の音声は選択外でも1回だけ一緒に複製します。動画のaudioDetachedと音声のsourceClipを新IDへ対応させ、両方選択しても音声を二重追加しません。音声だけを複製した場合は独立音声（linked=false/sourceClip=null）とし、選択外の元動画へ同期してしまうことを避けます。非連動の選択外要素を勝手に追加しません。任意の新しい親子モデルは追加していません。

**互換性**：保存schema/versionは改訂しません。ただし公開2.2.84のloaderはFX101個目以降をsliceします。この開発版で100を超えたprojectを公開版へ戻す場合、必ず別名backupを保ち、元ファイルへ上書きしないでください。正式採用時のリリースノートにも必要です。今回ユーザーの既存projectを移行・上書きしていません。

## 4. 実測

macOS上の実Chrome/WebKit、1600×1100 viewport、同じ合成project・ズーム3・専用context。静止画＋V3/A4/TEXT併用でタイムラインを測定しました。rAF間隔は物理表示時刻やGPU完了を保証しません。seekは静止画基準で、実カメラ動画のdecode待ちの代表値ではありません。単発の前後測定から改善率の断定はしません。

|ブラウザ・FX数|全timeline描画中央値:公開版→候補(ms)|複製move中央値/最大(ms)|scroll rAF中央値/最大(ms)|seek中央値(ms)|project bytes|
|---|---:|---:|---:|---:|---:|
|chrome 50|2.60 → 2.60|0.40 / 3.70|16.50 / 17.60|4.15|10,332|
|chrome 100|2.90 → 3.60|0.65 / 4.90|16.65 / 19.90|4.45|15,418|
|chrome 200|4.70 → 4.60|0.90 / 10.50|16.70 / 23.40|5.55|25,759|
|chrome 400|8.50 → 8.30|—|16.70 / 56.90|9.50|46,432|
|webkit 50|11.00 → 11.00|1.00 / 5.00|17.00 / 22.00|2.00|10,332|
|webkit 100|14.00 → 14.00|3.00 / 9.00|17.00 / 18.00|2.00|15,418|
|webkit 200|20.00 → 20.00|4.50 / 15.00|17.00 / 19.00|2.00|25,759|
|webkit 400|33.00 → 35.00|—|17.00 / 19.00|3.00|46,432|


chromeのFX追加200回：中央値 8.40ms、最大 23.30ms。実UIの同じ追加handlerを実行し、200個到達を確認。

webkitのFX追加200回：中央値 21.00ms、最大 43.00ms。実UIの同じ追加handlerを実行し、200個到達を確認。

公開版の200/400個はloaderを通すと100へ切り捨てられるため、同一の正規化済みデータをQA getterから渡した描画比較です。公開版で200/400個を通常保存できるという意味ではありません。描画は各3回、scrollは30 rAF、seekは20地点です。中央値の差は測定変動を含み、改善/退行率を確定する統計試験ではありません。

初期の1px PNGによる測定はdecode完了を保証できなかったため採用せず、最終表は640×360の有効PNGのdecode完了後だけを採用しています。複製move時間はQA wrapperで実handler本体を計測し、Playwright操作全体の待ち時間とは区別しました。

chrome 再生/停止/再開：50 FX rAF中央 16.75ms / 最大 18.10ms、100 FX rAF中央 16.65ms / 最大 17.50ms、200 FX rAF中央 16.60ms / 最大 17.60ms。bitmap decodeとclock進行を確認。静止画と短い測定であり長尺実写の保証ではありません。

webkit 再生/停止/再開：50 FX rAF中央 16.50ms / 最大 19.00ms、100 FX rAF中央 16.00ms / 最大 20.00ms、200 FX rAF中央 16.00ms / 最大 20.00ms。bitmap decodeとclock進行を確認。静止画と短い測定であり長尺実写の保証ではありません。

640×360・2秒・30fps WebCodecs合成：chrome 0 FX 0.538秒、chrome 50 FX 0.375秒、chrome 100 FX 0.331秒、chrome 200 FX 0.343秒、chrome 400 FX 0.337秒。

640×360・2秒・30fps WebCodecs合成：webkit 0 FX 0.837秒、webkit 50 FX 0.612秒、webkit 100 FX 0.604秒、webkit 200 FX 0.601秒、webkit 400 FX 0.603秒。

320×180・2秒・30fps Mac合成：50 FX 1.145秒、100 FX 1.300秒、200 FX 1.606秒、400 FX 2.338秒。全件60frame/2秒。Macとブラウザは解像度が違うため処理速度を相互比較しません。

ドラッグ中の尺の再計算を各ghostから除き、開始時に1回へ集約しました。全描画・メディア解析・codecの変更はしていません。50〜100個の更新は小さく、400個の全再描画は特にWebKitで1frame予算を超えます。iPhone実機の快適性は未確認です。

## 5. 検証

|検証|結果|
|---|---|
|全JavaScript / build|94入口PASS。static・204 cache依存参照・version維持・MediaBunny pin再適用PASS|
|新しい複製局所試験|2/10/50/100/200、相対差、deep clone、内部リンク、B2 metadata、ID衝突、容量競合、境界失敗の原状保持PASS|
|既存gesture局所試験|通常単体・群移動、trim、単体Altコピー、途中Alt、pointer所有者PASS|
|実Chrome / macOS WebKit|Ctrl 2/10/50/100/200、Alt混在、Shift選択、吸着ON/OFF、反復、連動音声、Esc、範囲外、400近傍全体拒否、1Undo/Redo、autosave、projectファイル再読込PASS|
|保存素材の復元|Chrome/永続WebKitで素材画像をIndexedDBへ保存し、複製後とproject再読込後のbitmap復元、保存素材が1件のままであることを確認PASS|
|プレビュー|50/100/200、画像decode完了、clock進行、停止/再開PASS|
|WebCodecs MP4|各5本=10本。0/50/100/200/400、全60frame/2秒、AAC roll/elst/packet数、後半FX、独立decode PASS|
|混在WebCodecs MP4|両ブラウザの0/200 FXで計4本。TEXT・V1/V3・A1/A4併用、映像/音声の独立decode PASS|
|音声の不変性|全14本：各経路のFXなしと音声PCM・AAC圧縮packetが完全一致。元素材PCMとの計70markerでlag 0sample、2ms基準を維持|
|Mac FFmpeg追加試験|50/100/200/400、2秒/60frame、有効音声付き独立decode、401拒否PASS|
|影響するPython/FFmpeg/HTTP|既存8本PASS：effect-consistency、creative、export-optimizations、multitrack、av-sync、output-timing、server、prores|
|元作業と公開基準|846 file/hash・HEAD・index不変。公開基準clone clean。remote/main・versionの変更なし|

B1保存安全性、B2/B3音量曲線、B4時間精度、AAC preroll/実測priming/正式muxのJS回帰を全件実施しました。PythonのMac等速同期/時計/ProResと実ブラウザ出力も確認し、新しい回帰は確認していません。今回対象外の実写全素材・全Macパッケージ再生成・全Python29本・物理ループバックまで再認証したわけではありません。

長いログ・合成MP4・baseline probe・独立decode結果は `.codex-context/development/pve-phase2a-evidence/` に保存し、repo/公開物には混ぜていません。`final-valid-image/`、`baseline-valid-image/`、`playback/`、`exports/independent.json`、`mixed-exports/independent.json`、`original-preservation.json`が最終証拠です。素材保持の追加検証は`retained-media/`（Chrome）、`retained-webkit/`（WebKit）です。初期PNG fixture・一時WebKit profile・module取得の試験環境失敗は最終PASSへ読み替えず、それぞれ修正/条件分離後に再実行しました。HTTP取得の単発失敗は検証サーバーの待ち行列確保と初期load完了待ちで再現しなくなりましたが、根本原因の断定はしません。


数値テストと調査用baseline probeを分離しています。baselineの欠落を成功条件にした回帰テストはありません。単体試験に加え、マウス/キーボードでChrome/WebKitの実handlerを実行しました。QA用getter/fixture/更新時間の計測のみ注入し、通常アプリにはテストAPI・observerを追加していません。

## 6. 変更ファイル

- `dist/model.js`：FX予算、canAddEffect/validateEffectCapacity、sanitizeの黙った切り捨て廃止。
- `dist/timeline-duplicate.js`：plan/commit、全体事前検査・ID・リンク・deep clone。
- `dist/timeline-duplicate-gesture.js`：既存timelineへのCtrl/Alt専用capture、ghost・吸着・取消。
- `dist/app.js`：新handler接続、選択・履歴・保存との統合、FX追加/旧複製入口の予算統一。
- `dist/timeline-paste.js`：既存pasteでも非flash予算を維持（既存の部分paste仕様は変更なし）。
- `dist/style.css`：ghost/無効drop表示のみ。`dist/i18n.js`と既存ヘルプ：Ctrl/AltドラッグとEscの案内。
- `engine/core.py`：Mac側のFX個数検査のみ。
- `tests/timeline-duplicate.test.mjs`、`tests/phase2a-fx.test.py`、`scripts/check-phase2a-browser.mjs`、`scripts/check-phase2a-export.mjs/.py`、`package.json`：回帰・実測入口。
- 本書と`PVE-ROADMAP.md`。過去の公開レポートや配布ZIPは変更しません。

## 7. 未確認事項と推奨

- 実iPhone/Safari、物理Ctrl＋マウス環境のOS設定差、長尺4K/60fps＋多数の解析FXは未確認。macOS WebKit試験をiPhone実機PASSとはしません。
- WebKit一時profileでFXなし出力がtransient errorになりました。既存QAと同じ永続専用profileでは0〜400全件成功。一時profileでは素材BlobのIndexedDB保存もAbortになりました。専用永続profileでは素材保持/再読込も成功しました。大量FX固有の回帰とは確認されていませんが、一時環境の制約を解決済みともしていません。
- 既存のWebKit native AAC品質差・Mac非等速WSOLA制約は未修正。今回のFX有無でAAC内容が変化しないことと別に扱います。
- 400個の同時解析/同時motionなどは保証しません。TEXT300超のloader slice、既存コピー/ペーストの部分追加は別課題で、今回のCtrl群複製には持ち込んでいません。
- Quick/Master Export・素材解析待ち・出力時間はROADMAPへ計測課題として追加しただけです。

**推奨：機能試験に合格し、開発候補への採用を推奨します。** 正式公開前に代表MVの実素材パターンとiPhone実機、100超projectの旧版への復帰注意を確認してください。次版番号・公開は今回決定しません。
