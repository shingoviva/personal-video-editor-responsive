# 初回性能診断・検証結果（2026-10-22）

## 対象と測定条件

公開済みPVE 2.2.80へ診断hookを追加した未公開ソースが対象です。最適化やrenderer置換は行っていません。`appVersion` は2.2.80、未コミット実装のため `buildCommit` はnullです。公開版そのものの計測と混同しないでください。

- 隔離したHeadless Chrome 155、macOS、viewport/screen 1440×900、DPR1、バランス30Hz、通常WebGL1プレビュー。
- 合成1920×1080/30fps H.264＋48kHz AAC、8秒。FFmpeg testsrc2＋sineから生成。実写素材・個人素材は不使用。
- 区間1〜5秒、0.5秒のウォームアップ後、各条件3回。Fは色補正、3layer、dissolve、装飾文字、FOCUS/ズーム、4音声laneとgain automationを併用。
- 初期シリーズA〜G×OFF/軽量/詳細×3回＝63測定。初期の軽量/詳細JSONを記録。実装段階が異なるため、初期シリーズと最終Fを最適化前後として比較しません。初期OFFの未取得status表現はその後訂正したため、そのJSONは比較用証拠から除外しました。
- 最終Fは同じhook構成で詳細＋GPU timerを3回測定。CPUとGPUの値は別々に解釈し、合計していません。
- 外部負荷対照は、通常URL（診断なし）／軽量／詳細（GPU timerなし）を順序を入れ替えて各3回。CDP `TaskDuration / wall time` を取得。

証拠：[保存フォルダ](../../.codex-context/audit-evidence/performance-diagnostics-2026-10-22/manifest.json)。同フォルダに匿名JSON、Markdown、Chrome/WebKitの画面、テストログ、fixture SHA256とソースdigestを保存しています。実装・収集・比較方法は [診断手順](pve-performance-diagnostics.md) を参照してください。

## 最終Fの結果

3回の中央値です。対象区間は動画時間4秒。表中のCPU平均は各呼び出しの平均、CPU合計は各runの区間合計の中央値です。

| 指標 | 観測値 | 解釈 |
|---|---:|---|
| draw提出頻度 | 約30Hz | 物理画面のpresent FPSではない |
| draw間隔p95 | 47.2ms | 目標30Hzの間隔と、rAF・処理待ち等の影響を含む |
| tickPlayback CPU平均 | 2.229ms | paint/audio等を含む親区間 |
| paintPreview CPU平均 | 0.907ms | GPU完了時間ではない |
| 音量automation生成CPU平均／合計 | 0.695ms／384.2ms | 複数laneの反復呼び出し。同期制御にも内包される |
| DOM clock CPU平均／合計 | 0.200ms／49.1ms | JSからの寸法読取・書込。全layout時間ではない |
| layers.visibility CPU平均／合計 | 0.377ms／46.7ms | 非同期lower更新は呼び出し提出まで |
| text.redraw CPU平均／合計 | 0.157ms／19.1ms | 文字poseが静的でも再描画している |
| GPU shader draw平均 | 0.814ms | 複数contextでサンプルしたdraw区間。texture転送・CSS合成は含まない |
| texture upload API回数 | 394回 | カーブ・release等も含むAPI呼び出し数 |
| 同一source/revisionへの再upload | 50回 | 省略可能と確定した数ではない |
| 静的文字の反復描画 | 122回 | 設定・寸法・poseが同じ連続描画 |
| 推定upload対象量 | 約3.25GB | API寸法ベース。実バス転送量ではない |

各runの長い停止（250ms超）は0回、締切超過は4/0/2回、完成構図の保持episodeは1/0/0回（保持時間15.8/0/0ms）でした。再生開始から初回完成構図提出までは約143〜164msです。seek要求の時間には既に位置が合っている呼び出しも含まれるため、純粋なデコードseek時間と見なしません。

最後のsnapshotでは既知Canvas9、WebGL context4、texture8、動画要素6、再生中動画要素3、Worker0でした。これはハードウェアdecoder数やGPUメモリ量ではありません。今回の短時間測定から、長時間編集時のメモリリークの有無は確定できません。

## 初期A〜Gの観測（仮説を絞る参考値）

詳細モード各3回の中央値。以下を最終Fや別ブラウザと比較して改善率を出さないでください。

| シナリオ | draw間隔p95 ms | paint CPU平均 ms | audio automation平均 ms | text描画平均 ms |
|---|---:|---:|---:|---:|
| A 単一・無補正 | 35.6 | 0.428 | 0.705 | 0.002 |
| B 色補正 | 45.5 | 0.406 | 0.734 | 0.003 |
| C 3layer・遷移 | 45.1 | 0.660 | 0.645 | 0.002 |
| D 装飾文字 | 37.1 | 0.573 | 0.735 | 0.204 |
| E 画面FX・追従path | 35.5 | 0.604 | 0.714 | 0.003 |
| F 複合 | 47.5 | 0.930 | 0.700 | 0.145 |
| G 複数音声 | 44.9 | 0.322 | 0.833 | 0.005 |

textがない場合の小さい値は空collectionの確認・clear等の呼び出し時間です。Bのpaint平均がAより少し低いことを「色補正すると速くなる」とは評価しません。反復・ブラウザ内部・同一shader内の処理差の影響を分離できていないためです。

## 診断自体の負荷

外部CDPのTaskDurationを同じUI操作からの約4秒のwall timeで割った値です。**Mac全体のCPU使用率ではなく、当該rendererのタスク時間比率**です。クリック後の開始準備と停止処理を含みます。実際の素材内時刻は約1.99秒から5.77〜5.81秒で、厳密な区間比較JSONの代わりにはしません。

| モード | 中央値 | 3回の範囲 |
|---|---:|---:|
| 通常URL・診断なし | 33.169% | 33.161〜34.300% |
| 軽量 | 33.108% | 32.598〜33.256% |
| 詳細・GPU timerなし | 33.181% | 33.113〜33.701% |

ばらつきが重なり、今回の測定から小さい診断オーバーヘッドを分離できませんでした。診断が速くした／完全に無負荷とは主張しません。GPU timerありの場合の追加負荷はこの対照から定量化していません。iPhoneでの負荷、熱・電池・長時間測定は未検証です。

## 動作・回帰検証

- `npm test`：87スクリプトPASS。既存の同期、seek、到着待ち、layer/transition、文字、FX、停止再開、削除・差し替え、Undo/Redo、resource解放等の試験を含みます。
- `npm run build`：PASS。静的asset、JS構文、import参照、既存UI構造を確認。依存ライブラリ追加・更新、CSS/HTMLの通常画面変更なし。
- 新規試験：OFF時の非生成、bounded集計、機密値の除外、JSON必須項目、未取得null、単発／複数回比較、条件差、WebGL返り値・identity、非同期query、再upload、資源とquery解放。
- 実JSONをschema定義で検証。自己比較は判断保留、異なるproject/scenarioは比較不能となり改善率を表示しないことをCLIで確認。
- Chrome：通常URLに診断UI/trace/global APIなし。診断待機時のpicture screenshotは通常モードとbyte一致。Fの測定完了、JSON・Markdownダウンロード、消去を確認。ページ例外なし。
- Playwright WebKit、390×844のモバイル画面：実際のファイル読み込み・V1配置から単一動画を測定、JSON・Markdown保存、消去PASS。GPU timer、long task、JS heapが取れない場合のunsupportedを確認。ページ例外なし。
- このWebKit一時contextでは100byteのBlobでも既存vault保存がAbortErrorになりました。保存処理は変更せず、アプリのメモリ上の編集経路を使って診断を確認しています。永続保存の合格とは報告しません。
- Safari本体・実機iPhone、実写HDR、長時間編集、実機でのexportは今回未検証です。WebKitの画面エミュレーションをiPhone実機測定とは呼びません。

## 実測に基づく次回候補

1. **音量automationの前処理**を最初の限定実験候補にします。複合Fで約384ms/4秒、初期Gでも約321ms/4秒のCPU時間を観測し、文字やFXの個別JS区間より大きかったためです。gainAt内部の反復filter/map/sortを事前化できるか、音声サンプル・開始gate・fade/hold点を変えずに検証します。これはまだ速度改善の実証ではありません。
2. 次に、**同一revisionのuploadと静的文字描画の再利用**を独立した実験として検討します。回数は観測できましたが、転送の実CPU/GPUコストの全分離はできていないため、現時点で大きな改善率を約束しません。今回の文字CPU合計は音量automationより小さく、静的監査だけで文字を最優先にする根拠はありません。
3. **DOM clock、複数layer/遷移時の待機**を実写素材でも測ります。GPU drawの平均だけから「GPUに余裕」「decodeが遅い」と断定しません。素材デコード時間そのものはAPIから取れていません。

詳細：[最適化バックログ](pve-performance-optimization-backlog.md)。今回の範囲で最適化は未実施、公開も行っていません。
