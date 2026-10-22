# PVE 2.2.81 公開前検証記録

## 採用内容

複数の音声トラックや音量キーフレームを使用した際の処理を最適化しました。従来の音量調整結果を維持しながら、プレビュー再生時のCPU負荷を軽減しています。

音量キーフレームの前処理をカーブ生成につき1回へ整理し、共通評価式を維持。診断機能は`?previewDiagnostics`を付けた場合だけ有効です。プロジェクトschema・映像/音声品質・gate・同期clock・Web Audio予約の仕様は変更していません。WebGPU/Rust/新renderer/追加実験は非導入です。

## 公開範囲

- 音量最適化：dist/audio-preview.js、dist/mobile-model.js。
- 診断：preview-diagnostics/performance-report/performance-diagnostics-uiとapp/creative/media-state/motion-transform/preview-playback-scheduler/preview/text-renderの計測hook。
- 回帰試験、診断用fixture・schema・計測/比較CLI、設計/診断/最適化資料、before/after生JSONをdocs/performance-evidence/optimization-01へ保存。
- package.json/lock、distの版付き参照、engine/core.pyのbuild表記を2.2.81へ統一。ui-polish試験の固定cache期待値も更新。audio-preview/mobile-render-worker/material-fx-workerのmobile-model依存URLにも版番号を付け、旧キャッシュに新しいexportがない問題を予防。旧unversioned応答を残した実ブラウザー回帰と依存URL試験を追加。
- README/VALIDATION/GITHUB_PUBLISHINGに履歴。Mac ZIPとpackage-mac.pyに新診断試験が必要とするschemaを同梱。
- 対象外：Feature Lab HTML/dist/lab、setup-feature-lab.py、feature-lab.test.mjs、test:feature-labコマンド、Lab用.gitignore変更。これらは元の作業ツリーに保持し、cleanな公開候補へ含めません。

## 最終検証

npm test 88本・build・Python動画処理22本・実HTTP試験・Mac ZIP生成と展開後の追加試験がPASS。音量数値188,584件と予約列が旧式と一致。Chrome/WebKit各1,008,000レーン別PCMと固定順合算は誤差0。native mixerの丸め差と計測条件は[最適化01](pve-volume-automation-optimization-01.md)参照。

Chromeの通常画面で保存→リセット→読み込み→再生、シーク/停止/再開、Undo/Redo、端末内1080p30 H.264/AACの実worker書き出しを確認。動画36フレームとAACをffprobeで検証し、全decode成功。Mac FFmpegは実処理/HTTPのPython試験で検証しました。MacアプリGUI操作を実施したという意味ではありません。

通常URLで診断UI未表示、controller/activeなし、PerformanceObserver生成0、timer extension要求0、診断フックなしを確認。診断URLでは複合F再生・JSON/Markdown出力・schema/比較CLIが機能します。

## 未検証・実機確認

Safari本体/iPhone実機、実音声の聴音と出力latency、長時間編集、Mac GUIエンジン接続操作は未確認です。実機では既存.projectを開き、4音声レーン・fade/hold付きで再生→seek→停止→再開、保存→reset→restore、短い1080p30 MP4書き出しを確認してください。動画末尾と音量点の急変、レイヤー合成・字幕・FXの同時再生にも注意してください。

既知のPlaywright WebKit一時contextのBlob保存制限は今回の新不具合とは断定せず、メモリー内素材経路に限定して確認しました。現在、最適化が新しく生んだ重大な失敗は検出していません。

## 公開手順とロールバック

mainの対象差分を明示ステージしてcommitし、同一HEADを既存GitHub repoとSites sourceへ通常push。Validate editor成功を確認後、手動Pages workflowと既存public Sitesへ配信。Sitesのaccess policyは変更しません。公開URLの2.2.81配信・通常画面・保存復元・再生・書き出しを確認します。公開結果のcommit/Actions/deployment IDは最終報告へ記録します。

問題時はユーザーに.project保存を案内してから、履歴を改変せず2.2.81の2コミットを新しい順（依存URL対策→最適化本体）にgit revertし、同じValidate→Pages公開手順で戻します。元の安定HEADは54c7cf28889eecd79b9d4a7491314f9b6213f7ea（2.2.80）。Sitesはversion72を既存public audienceへ再deployできます。ブラウザー保存領域は消去しません。Mac ZIPも直前版へ戻し、キャッシュ解消のため再読み込みを案内します。データschemaは変更していません。
