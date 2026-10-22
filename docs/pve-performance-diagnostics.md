# PVE Performance Diagnostics

## 目的と範囲

PVE 2.2.80の既存 `?previewDiagnostics` を拡張した、明示的に有効化する開発者用の測定機能です。レンダラー、再生時計、先読み、同期補正、FX順、画質設定、出力エンジンの最適化は行っていません。通常URLではパネル・observer・GPU query・詳細記録を生成しません。通常コードに追加した観測点はnull確認のみです（一部関数はtry/finallyを通ります）。診断OFFでもゼロコストとは断言せず、後述の外部対照測定を行います。

基礎調査：[アーキテクチャ監査](pve-performance-architecture-audit.md)。再生・合成の維持事項は [preview-playback.md](preview-playback.md)、[effect-compositing.md](effect-compositing.md) を参照してください。

## 起動・測定・保存

1. テスト用プロジェクトを開いた状態で、URLに `?previewDiagnostics` を付けます。既存のqueryがあれば `&previewDiagnostics` です。ページ再読み込み前に通常どおり編集を保存してください。
2. 右上の小さい「PVE 診断」を開きます。パネルは折り畳めます。通常画面のCSSやツール配置は変更しません。
3. A〜Gのシナリオ、開始・終了秒、ウォームアップ秒、反復数を指定します。区間はタイムライン内に限定します。プロジェクトの内容は自動変更しません。
4. モードを選び「区間測定」を押します。ユーザー操作を起点として音声をunlockし、ウォームアップ→指定位置へシーク→本測定を行います。Safari等で再生が許可されない場合は通常の再生ボタンを一度操作してから再試行します。
5. 「停止」は現在の測定と再生を終了します。指定終了まで完了しなかった測定は `finishedRange:false` で、比較CLIは条件不成立として扱います。
6. 「JSON保存」で機械可読結果、「要約保存」でMarkdownを保存します。「直近2回比較」は簡易表示です。厳密な反復比較にはCLIを使います。
7. 「消去」は診断履歴とtraceを消去します。プロジェクト・素材・編集履歴は消去しません。同一セッションで繰り返せます。保持は直近12測定です。

ページが非表示になると測定を停止し、比較不能な中断として残します。ベンチマーク中は同じ表示サイズで、パネルを折り畳み、操作・別タブ移動を避けてください。

開発用の `window.pvePerformance` は診断URLでだけ作られます。`runRange(config)`、`stop()`、`clear()`、`reports()`、`summary()` を利用できます。`reports()` は匿名化済み完成レポートのコピーを返します。通常URLでは作成しません。

## モードと測定範囲

| モード | 記録内容 | 使い方 |
|---|---|---|
| 通常URL | 診断パネル・observer・記録なし | 本当の通常利用対照 |
| 診断URLのOFF対照 | 区間運転・開始終了条件。詳細hookは停止。起動時の診断wrapperと既知resource registryは存在 | 軽量/詳細との外部CPU対照。通常URLと完全同一ではない |
| 軽量 | draw/hold/seek、動画要素callback、WebGL呼び出し数、資源snapshot | 原因切り分けの最初の測定 |
| 詳細 | 軽量＋同期CPU区間＋対応環境のlong task | 工程別の候補特定 |
| 詳細＋GPU timer | 詳細＋WebGL1 timer queryを10 shader drawに一回 | 必要なときだけ。軽量／timer無効の値と混ぜない |

ブラウザ全体のメソッドを通常モードで常時patchしません。診断URLではCanvasのcontext取得、当該WebGL contextのtexture/draw、ImageBitmap、Worker生成等へ局所wrapperを設定します。返り値・呼び出し先・呼び出し順を保ち、診断が開始されていなければ詳細集計を止めます。停止後のqueryは破棄し、動画callback、timer、PerformanceObserverを解除します。Worker内部のCanvas等にはこのmain-document wrapperは入りません。

## 指標の意味

### プレビュー

- `drawAttempts`：`draw()` への要求回数。cadenceで省略された要求も含みます。
- `drawCompletions`：再生中の `paintPreview()` が保留を返さず、同期処理を完了した回数。GPU完了・物理画面提示とは異なります。
- `drawSubmissionRate`：完了提出間隔から求めたHzです。**present FPSとは呼びません。**
- `drawIntervals`：提出間隔のp50/p95/p99/max。締切超過は実効目標間隔の1.5倍超、長い停止は250ms超という診断上の基準です。ブラウザの正式なdropped frame定義ではありません。
- `videoElementIntervals`：`requestVideoFrameCallback` のcallback間隔を動画要素ごとに観測し、同一時刻の再通知を除いてまとめた値です。複数動画では複数ストリームの分布であり、最終画面の提示間隔ではありません。
- `firstFrameLatency`：再生操作開始→最初の完成構図の提出まで。待機、音声準備、decode、JSが混ざる経過時間です。
- `seekLatency`：`seekVideoFrame()` 呼び出し→目的フレーム到着promise完了まで。キャンセル・失敗は成功時間へ加算しません。純粋なCPU時間ではありません。
- `holdCount/holdDuration`：主映像／下層／画像の到着待ちで完成済み構図を維持した連続episodeと観測時間。診断開始以前の保持は含みません。
- `syncError`：要求した素材内時刻と動画要素currentTimeの差（ms）。出力音声のレイテンシや、完成画面と実音の差ではありません。
- `targetFps/effectiveResolutions`：完了提出時の実効cadenceとCanvas描画サイズ。入力動画サイズとは別です。

### CPU・メインスレッド

詳細モードでtickPlayback、paintPreview、layers.visibility、evaluation.opacity、evaluation.scaleMotion、fx.extract、fx.update、text.redraw、dom.clock、audio.automation、sync.controlを計測します。呼び出し数、合計、平均、p50/p95/p99、最大を記録します。

全て同期区間のinclusive時間です。**tickとpaint、paintとtext、paintとopacityなどを足して総CPU時間にしません。** layers区間に含む非同期更新は呼び出し提出までです。DOM区間はJSからの寸法読取・書込のコストで、ブラウザ内部の全layout/style/paint時間を分離したものではありません。音量カーブの生成とWeb AudioのDSP実行も別です。

### GPU・転送

- textureUploads：`texImage2D` 呼び出し数。カーブ用textureも含みます。
- shaderDraws / renderers：context匿名IDごとのdraw、upload回数、入力寸法、出力寸法。
- repeatedUploads：同じsourceと観測可能なrevisionへの再upload。動画のrVFC mediaTimeまたはdecoded frame counter、immutable ImageBitmapを対象にします。内容が変わる通常Canvasを勝手に同じ画像と判定しません。
- staticTextRedraws：ラスタ設定・Canvas寸法・文字poseが同じ状態の連続テロップ再描画。削除できる処理と確定する値ではなく、最適化候補です。
- estimatedUploadBytes：API寸法×RGBA4bytesの見積もり。実際のバス帯域、YUV変換、GPU memoryではありません。
- GPU duration：`EXT_disjoint_timer_query` がある場合の**shader draw区間**を非同期pollします。texture uploadやCSS compositorを含む総GPU時間ではありません。disjoint結果は破棄します。`gl.finish()`、readPixelsや、結果を待つループは使いません。最大8 pending query/context、10 drawに一回、停止時破棄です。

### メディア・メモリ

動画要素の総数・再生中数は、main documentおよび登録されたdetached要素の観測です。ハードウェアデコーダーの実稼働数ではありません。sourceSwitchesは約1Hzのsnapshotでsource変化を検出するため短い変更を取りこぼし得ます。standbyの採用が準備済みかは既存adoptイベントで記録します。

Canvas/texture/ImageBitmap/Workerは追跡できたmain-document資源です。WeakRefで不用意な強参照保持を避け、最大512登録です。Canvasの存在と、GPUの実メモリ解放、GC時刻は同じではありません。src解除・Canvas縮小後もオブジェクトが存在する場合があります。Worker内で生成されたCanvas/texture/bitmap、ブラウザ内部デコーダーバッファは数に含まれません。継続増加はリークの疑いであって確定ではありません。

`performance.memory.usedJSHeapSize` が存在する場合だけJS heap値を記録します。Safariでは通常利用できません。ブラウザ全体RAMとGPU使用量はunsupportedです。高負荷な全体メモリ測定APIを周期的に呼び出しません。

## JSONスキーマと匿名化

機械可読定義：[pve-performance-diagnostics-v1.schema.json](schemas/pve-performance-diagnostics-v1.schema.json)。`schemaVersion` はSemVerの1.xです。後方互換の追加fieldを許容し、読み手は未知fieldを無視します。意味の破壊的変更はmajorを変更します。

単体JSONには次を含みます：`schemaVersion, appVersion, buildCommit, environment, capabilities, projectProfile, scenario, measurementConfig, playbackMetrics, cpuMetrics, gpuMetrics, mediaMetrics, memoryMetrics, resourceLifecycle, events, warnings, measurementLimitations`。

複数回保存では `{ "schemaVersion":"1.0.0", "runs":[ ...単体レポート ] }` です。`buildCommit` はHTMLの `meta[name=pve-build-commit]` がない場合nullです。未コミットの変更に既存HEADを付けて「そのコミットの実装」と誤認させません。実測証拠には別途ソースdigestを記録できます。

測定項目の例：

```json
{"value":33.4,"unit":"ms","method":"completed draw submission intervals","status":"observed","sampleCount":120}
```

`status` は `observed / estimated / unsupported / not_measured`。未取得はnullです。0は「観測して0件」等の意味がある場合のみ使います。分布にはtotal/mean/p50/p95/p99/max/retainedSampleCountを追加します。snapshotの寸法・種類・個数などはメタデータの配列／objectです。時刻はローカル性能時計からの経過で、測定日時はISO日時です。

素材・クリップのIDはsession内匿名ID、profileは数値と許可したenumのwhitelistから生成します。ファイル名、project名、テロップ本文、font名、絶対path、URL、実フレーム、音声、解析説明文を出力しません。OS/ブラウザ情報は比較条件としてUA/platformを記録します。本文やfontの匿名化により、同じ文字数でも描画負荷が完全に等しいとは証明できません。

各metricの保持は最大2048値、eventは1200、resource historyは120 snapshot、完成runは12です。count/total/maxは全測定のstreaming集計、上限後のpercentileは直近の保持サンプルです。JSON生成・sort・Markdown生成は停止後に行います。診断自体のbyte数はJSON文字長×2の推定で、実heap割当量ではありません。長時間測定より短い区間の反復を推奨します。

## 比較の方法

同一素材、同一project、同一区間・mode・GPU timer設定・viewport・DPR・preview画質で3回以上測定します。ウォームアップ長、熱状態、電源、他アプリ、ブラウザの表示状態も揃えてください。測定した順序による影響を見るため、OFF→軽量→詳細だけでなく逆順・交互測定も有効です。

```sh
node scripts/compare-performance.mjs before.json after.json comparison.md
```

CLIは単体／runs bundleを受け付けます。schema major、記録された環境・profile・シナリオ・区間・mode・warmup・GPU計測・実効解像度等が異なれば警告して改善率を出しません。未完了区間、欠測、推定転送量等も安易に改善判定しません。3回未満、中央値差5%以下、反復のmin–maxが重なる場合は判断保留です。これは統計学的な有意差検定ではなく、過大な改善主張を避ける保守的基準です。

匿名メタデータ一致は同じ素材バイト列やfontを保証しません。比較前に人間／ベンチマーク側で素材同一性を確認してください。CPU区間合計、GPUとCPUの合計、動画要素callbackの複数streamを足したFPSを改善指標に使いません。

## 再現用ベンチマークと診断負荷

`scripts/benchmark-performance.mjs` は独立した一時Chrome contextを使う任意の開発用ハーネスです。Playwrightは環境側から供給し、PVEへ依存追加していません。`tests/fixtures/performance-projects.mjs` がA〜Gの合成projectを生成します。既存のユーザーprojectは変更しません。

```sh
# 別のテスト用static serverを起動し、そのURLで使用してください。
PVE_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
node scripts/benchmark-performance.mjs http://127.0.0.1:PORT/ synthetic-1080p30.mp4 output-directory
```

fixtureは8秒以上、1920×1080/30fps/H.264＋AACを想定します。別specの素材ではfixture metadataも一致させてください。初回baselineはFFmpeg testsrc2/sineで作成した8秒の素材を使用しています。

A：単一無補正、B：色/LOOK相当、C：3layer/dissolve、D：装飾文字、E：FOCUS/ズームと保存済み追従座標、F：これら併用、G：4音声lane＋gain/volume automationです。Eは解析済みpathの再生負荷であり、顔検出Workerの解析速度試験ではありません。

診断URLのOFF/軽量/詳細を各3回、1〜5秒の4秒区間、0.5秒warmupで取得します。外部CDPのTaskDuration/ScriptDuration/LayoutDurationも記録します。CDPのbatchにはwarmup/seek/準備を含むため、CPU spanや4秒区間だけのCPU時間と混同しません。通常URLでのOFF対照は別途外部観測が必要です。

## Mac・iPhoneの制約と未検証範囲

Chromeヘッドレスの測定は、Safari本体・iPhone実機の基準値ではありません。GPU timer、longtask、JS heapはブラウザ次第です。OS内部のdecode時間、ブラウザ全体RAM、物理画面present、GPU residencyはこの診断だけで取得できません。iPhone動的budgetで解像度が変わったrunは、画質条件が同じ改善として比較しません。

Safariでの手順は、実機で同じprojectと区間を開き、軽量を3回→詳細を3回、JSONと要約を保存することです。最後にFX/clip削除→Undo/Redo→再測定で、既知資源とWorkerが増え続けないか見ます。診断URLを外して通常の編集・音声・seek・exportも確認してください。結果の不足を0や架空の実測値で補いません。

## 初回ベースライン・追加検証

[初回測定と制約](pve-performance-diagnostics-baseline.md) に結果を記録しています。通常URLを含む外部負荷対照は `scripts/benchmark-diagnostics-overhead.mjs URL fixture.mp4 overhead.json`、Chrome/WebKitのUI/保存QAは `scripts/check-performance-browser.mjs URL fixture.mp4 output-directory` です。これらも環境側のPlaywrightを使用します。負荷対照と、正確な指定区間の診断JSONを混同しないでください。

任意で `PVE_SCENARIOS=F PVE_MODES=detailed` により対象を限定できます。テスト用static serverには多数のES moduleの同時接続を受けられるものを使用してください。今回の簡易Pythonサーバーは `request_queue_size=128` に調整して接続リセットを防ぎました。

保存済みJSONのschema検証：

```sh
node tests/performance-schema-validator.mjs report.json
```

scopeが異なるWebKit一時contextでは、既存のBlob永続化がAbortErrorになる場合がありました。診断は通常のファイル入力とメモリ上の編集経路でも利用できます。実機の保存機能に同じ問題があると断定せず、実機Safariでは別途確認してください。

パネルの「移動」をドラッグすると、previewや編集対象を避けて位置を変更できます。折り畳みと合わせ、通常操作や計測中の画面を妨げない位置で使用してください。

## 実装ファイル

- `dist/preview-diagnostics.js`：既存traceを拡張。計測の開始停止、世代・上限、集計、ブラウザhookと非同期GPU query。
- `dist/performance-report.js`：匿名profile、分布、JSON/Markdown、条件比較と反復のばらつき判定。`cpuMetrics` のキー（`audio.automation`等）に含むピリオドを、object階層と誤認しない比較を行います。
- `dist/performance-diagnostics-ui.js`：診断URLだけの移動・折り畳み可能なパネル、範囲運転、保存。
- `dist/app.js`、`audio-preview.js`、`creative.js`、`motion-transform.js`、`text-render.js`、`media-state.js`、`preview-playback-scheduler.js`、`preview.js`：既存の所有権・順序を保った観測点。
- `scripts/compare-performance.mjs`：比較CLI。その他のbenchmark/QA scriptはテスト環境用。
- `tests/performance-diagnostics.test.mjs`、`performance-schema-validator.mjs`、`fixtures/performance-projects.mjs`：計測・比較・schema・再現fixtureの試験。
- `package.json`：新しい診断試験を既存 `npm test` に追加。依存ライブラリの追加・更新なし。既存のローカルFeature Lab設定は保持し、本診断へ組み込みません。
