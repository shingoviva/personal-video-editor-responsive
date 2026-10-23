# PVE 2.2.84 安定化アップデート統合検証

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


追記：等速の音声先行は[Phase 1e報告](PVE-AV-SYNC-FIX.md)で修正しました。速度変更とBrowser音声には未解決の同期問題があり、公開判断は保留です。本書の以前の測定値は履歴として保持します。

追記：B4のMac出力時計は[Phase 1d-2修正報告](PVE-B4-OUTPUT-TIMING-FIX.md)で再設計・検証しました。本書の旧補正に関する失敗記録は履歴として保持し、公開判断は再統合検証で行います。

2026-10-23。**公開不可。B4の再検討が必要です。** 全自動回帰の通過より、追加の実写・品質試験で確認した失敗を優先します。今回は検証のみで、アプリコード修正・version更新・commit・push・デプロイは行っていません。

## 1. 対象と保全

検証開始時は`main` / `9b2f10aeb573e237b85fef4a0fb0d533e5ccd28d`、package/core/UIは **2.2.83**。公開先`github-responsive`の`main`も`git ls-remote`で同じSHAを確認しました。ローカル追跡refの「ahead 1」は古い追跡情報で、公開先との差を意味しません。参照は[Vision](PVE-PRODUCT-VISION.md)、[Roadmap](PVE-ROADMAP.md)、B1〜B4報告書です。

元の未公開差分を退避・リセットせず、`/tmp/pve284/candidate`に検証用コピーを作成しました。比較対象はHEADのクリーンな`/tmp/pve284/baseline`。実素材は読み取りだけ、一時PVE_DATA・新規ブラウザcontext・使い捨てOPFSを使用しました。候補の正確な構成はmanifest（開発監査資料・配布対象外）、保全確認はscope（開発監査資料・配布対象外）を参照してください。

| 未公開差分 | 公開対象の判断 / 今回の扱い |
|---|---|
| B1 素材保存、B2 hold形状、B3 点数、B4 時間基準 | 安定化の候補。ただし現状のB4を含む公開は不可 |
| `dist/text-render.js`、対応test、`scripts/check-text-preview.mjs`、最適化02の資料/current-architecture追記 | 採用保留。候補の本体/test/architectureはHEADへ戻したコピーを検証し、最適化用資料・scriptを除外。元作業は保持 |
| `dist/feature-lab.html`、`dist/lab/**`、setup/test、packageのLab script、.gitignoreのLab変更 | 正式版から除外。候補だけから削除/HEAD復元し、ZIPにも含まれないことを検査 |
| AGENTS短縮、docs/development、scripts/test-related | 開発補助。機能変更と別単位で判断。実行補助として使い、配布runtime差分とは区別 |
| Product Vision/UX/Roadmap、B1〜B4報告・証拠・回帰test | 開発資料/検証として採用候補。過去の不具合probeを正解判定testへ流用しない |
| 今回追加したrelease QA script/報告 | 開発用。検証済みMac ZIPには今回追加scriptを後から混入させていない |

候補のruntime変更は`dist/{app,project-storage,clip-envelope,clip-envelope-ui,timeline-time,timeline-gestures,overlay-timeline,model,mobile-model,i18n}.js`、`dist/index.html`、`engine/{core,audio_engine}.py`。対応test/fixture/scriptと資料はmanifestに記録しました。Mac配布物は検証用の2.2.83表記のままで、2.2.84公開物ではありません。将来の公開許可後にversion/cache-bustingを揃えて再検証する必要があります。

## 2. 統合テスト結果

| 検証 | 結果 / 範囲 |
|---|---|
| JavaScript / build | `npm test`全89エントリー、`npm run build`成功。最適化02を除外したtext testを含む |
| CIのPython/FFmpeg/HTTP | 22本すべて成功。LOOK、画像、色/FX、レイヤー、境界、速度、トランジション、音声、ProRes、信頼性、各出力形式、serverを含む |
| CI外の既存native | spatial-scale、B2 native、B3 native、B4 native成功。B2は264ケース/6,227,896サンプル差0、B3の1026点出力と失敗cleanup、B4の8fpsも再確認 |
| 既存の実写transition QA | **候補FAIL**：最初のpreview dissolve +0.2秒でMAE77.517（既存基準9未満）。**HEAD基準版はQA全体PASS** |
| Chrome / WebKit | B1実OPFS失敗注入、B2/B3/B4実操作・Undo/Redo・project保存復元、preview controls、診断UIが成功（B1/端末内出力はChrome） |
| ブラウザ実出力 | Chrome WebCodecs/OPFSで8fpsのH.264/AAC作成、別のMediabunny decoderでフレーム数・画の所属・PTSを確認 |
| Mac実出力 | H.264/AAC、ProRes10bit/PCM、8fpsのPTSとフレーム数、独立FFmpeg全尺decode成功。ただし内容・同期の追加試験は下記の失敗あり |
| Mac ZIP | CRC、主要8ソースとのバイト一致、Lab/実素材/最適化02の除外、Launch実行属性0755・shell構文、展開済みエンジンでHTTP試験成功。12,599,674 bytes |

全結果（開発監査資料・配布対象外）、追加native（開発監査資料・配布対象外）、browser結果（開発監査資料・配布対象外）、ZIP検査（開発監査資料・配布対象外）、展開後検査（開発監査資料・配布対象外）。任意実写QAの失敗を、CI22本の成功に埋めていません。ローカルFFmpegにはdrawtextがなく、該当試験はraster caption経路を確認しました。

## 3. 保存・素材の安全性

B1の既存/新規×lookup・writer・write・close・abort失敗、再試行、同ID並行、移行失敗時の参照維持を単体とChrome実OPFSで再確認。再リンク・素材差し替えはJSモデル/呼出元試験、project roundtripとHTTP保存復元も通過しています。外部フォルダpickerでの実操作を今回確認したわけではありません。

統合OPFS試験では、1024音量点（holdRampSeconds/editBoundaryあり）と24000/1001編集fpsを含むprojectを新規保存→20回素材再コピー/保存→20回通常上書き→再読込しました。旧20世代のSHA-256は全一致、音量点と編集fpsを復元できました。

| 素材1MiBの試験 | 結果 |
|---|---:|
| 明示的な再コピー | 20回 → 20世代、20MiB |
| 現行参照 | 1MiB |
| 現行projectから参照されない旧世代 | **19MiB** |
| 通常上書き保存20回による素材追加 | **0世代** |

不必要世代を自動削除しない安全性と、再コピー回数に比例する容量増加のトレードオフです。別保存projectが旧世代を参照し得るため、今回cleanup機能や無断削除を追加していません。容量記録（開発監査資料・配布対象外）。外部プロセス競合、満杯/抜線/電断の実験は未確認です。

## 4. 音声・時間・プレビュー

- holdの5msランプ、微小境界、split/trim、254/255/256/257〜1026点、反復編集、連動音声、複数レーンの既存回帰は成功。ブラウザPCM、native envelope比較、保存/Undo整合を維持しています。
- 24000/1001・24・25・30000/1001・30・50・60000/1001・60で編集rate・素材rate・出力rateを別々に確認。映像/音声/FX/TEXTの移動、trim、split、磁石ON/OFF、frame step、rate変更Undo/Redoとproject復元が成功。独立した音声のサブフレームを保持します。
- 通常再生、再生中シーク・ヘッドdrag、停止/再開・loop、レイヤー/transition/色/text/FX、速度・ソース写像は既存JS/native試験、複合previewは実診断シナリオFで確認。合成が実写で正しいという保証は、下記transition失敗のため成立しません。
- B4の元からの入力精度差も維持：受信pointer座標に対する計算差は約4.44e-16秒だが、WebKitのpixel入力は今回の倍率で要求座標との差が最大約8.22ms。ズーム/フレーム送り/数値入力の分解能と区別します。

**追加の閃光/ビープ試験は未達です。** 1秒の白フレームとビープを作り、デコード後の音声しきい値0.05を同じ方法で比較しました。

| 出力 | 候補の白フレーム開始 | 候補の音声開始 | 元素材decodeに対する音声差 |
|---|---:|---:|---:|
| H.264 30 | 1.000000s | 0.9806875s | **-19.333ms** |
| H.264 29.97 | 1.001000s | 0.9806875s | **-19.333ms** |
| ProRes HQ 30 | 1.000000s | 0.9806875s | **-19.333ms** |

元AACをdecodeしたビープ開始は1.000020833s。QA開始時に定めた音声差2msの基準を超過しました。同じ音声先行はHEADにもあり、**B1〜B4で新たに生じた回帰ではありません**。HEADの映像開始はH.264で1.054333s、ProResで1sで、B4はH.264映像時刻を改善する一方、音声の既存先行は残ります。これは合成マーカーの測定であり、聴感/実機遅延の断定ではありません。一律19msの補正を実装・推奨していません。候補（開発監査資料・配布対象外） / HEAD（開発監査資料・配布対象外）。

## 5. B4補正の重点評価

### 実写transitionの新規回帰

同じ候補コード・素材・QA条件で、**試験プロセス内だけ**`video_timing_matches`を常にTrueにして補正をbypassしました。アプリファイルは変更していません。

| 条件 | dissolve +0.2秒のMAE | 既存基準 |
|---|---:|---|
| 現行B4補正あり | **77.517** | FAIL |
| 補正だけbypass | **3.138** | PASS（9未満） |

HEADの実写QA全体もPASSです。したがって、B4結合後のPTS再サンプリング/再エンコード経路に起因する回帰と判断します。単色・短尺の既存試験では検出できませんでした。切分け結果（開発監査資料・配布対象外）。私的実写の比較画像と動画は`/tmp/pve284/`に保持し、Git/ZIPへ入れていません。

### 再エンコードの画質・形式

実写HEVC/1080p60の2素材を使い、**実際のB4補正直前/直後のファイル**を取得しました。PTSだけ正規化して同じフレーム順で比較した値です。原素材との差ではなく、追加の一世代による差を測ります。

| 素材/出力条件 | SSIM | PSNR | 補正の追加時間 |
|---|---:|---:|---:|
| 実写1 / High H.264 | 0.995554 | 49.894dB | 6.62s / 映像6s |
| 実写2 / High H.264 | 0.994163 | 48.495dB | 7.59s / 映像6s |
| 実写1 / Maximum H.264 | 0.995947 | 50.827dB | 7.76s / 映像6s |
| 10bit gradient / ProRes HQ、動画だけ21msずらして補正を強制 | 0.999956 | 73.916dB | 0.23s / 映像3s |

**数値として追加の画質損失を確認したため、ご指定どおり公開ブロッカーです。** 視認上の許容可否を独断で合格にしていません。H.264 High/yuv420p、ProRes HQ/yuv422p10le、BT.709のmatrix/transfer/primariesは前後で一致。H.264のrange=tvは保持。ProResのrange項目は前後とも取得不可で、メタデータの包括的な保持保証とはしません。ProResのluma階調数は877→877で8bitへ落ちていませんが、画素値は同一ではありません。audioのdecode hashは補正前後で一致し、audio startも変わりません。通常ProResは補正非発動、上表のProResは明示的な異常注入です。実写（開発監査資料・配布対象外） / 10bit（開発監査資料・配布対象外）。

### 発動判定・長めの出力

正常な単体CFRは検査を通過し、21msの先頭ずれは検出しました。一方、**第10フレームだけ+10ms、先頭/総尺/平均fpsは正常**にした人工例を、検査は正常として受理しました。実運用で同じ異常が発生すると確認したわけではありませんが、stream要約だけでは全PTSを保証できません。正常素材の通常H.264出力でも、今回3/3で結合後21msずれにより補正が発動し、「異常素材だけの稀な追加処理」とはいえません。

実写をloopして作った120秒/1280×720/30fpsでは、補正に **28.97秒、子process CPU合計69.47秒、追加出力42,070,661 bytes（約40.1MiB）**。入力43,794,774 bytesも同時に必要です。SSIM0.997039/PSNR50.545dB、audio hash一致、補正後のclock要約は正常でした。元正常版→異常offset版→補正版の検証用3ファイルを作った測定で、実務の長時間撮影や4Kの上限を保証しません。native回帰との並行実行中なので、処理時間はその負荷条件での値です。実写6秒のエンジン領域の追加ピークは約28.7〜42.5MB（サンプリング測定）。120秒記録（開発監査資料・配布対象外）。

## 6. 操作レスポンス

同一macOS arm64/Chrome155 headless、1440×900/DPR1、同一1080p30 H.264/AACを使用。重いnative QA終了後、HEAD→候補→候補→HEADのABBA順。各batchは既存診断light、0.5秒warmup＋4秒×3回、40回連続await seek。両版とも実効1280×720。text最適化02は両方とも不使用です。

| scenario | main-thread TaskDuration差 | 描画提出間隔p95中央値 HEAD→候補 | seek p95 HEAD→候補 |
|---|---:|---:|---:|
| A 通常 | +2.50% | 34.9→41.5ms | 104.5→99.8ms |
| F レイヤー/transition/色/text/FX/4音声 | -2.89% | 43.25→44.55ms | 200.1→200.8ms |
| G 4音声レーン | +0.58% | 42.9→43.3ms | 99.0→100.2ms |

Aは悪化傾向があるため追加確認しました。診断に9反復を要求しましたが上限で実測は両版6反復です。提出率は両方約30Hzを維持する一方、p95はHEAD中央値34.8ms、候補41.6ms、TaskDurationは候補+9.53%でした。サンプルのp95は両版とも約35/48msの二群で、提出タイミングのばらつきが大きい測定です。改善と記載せず、原因未確定の性能課題として残します。詳細profileの結果は性能記録（開発監査資料・配布対象外）を参照してください。

詳細診断＋CPU samplingでは、paintPreview平均0.256→0.243ms、audio.automation平均0.516→0.533msでした。主なCPUサンプルは両版とも既存のtranslateDOMで約4.02→4.11秒。音量評価の旧方式復活ではなく、DOM翻訳と提出タイミングが主な調査対象ですが、Aの差との因果は未確定です。detailedの値をlightの値と直接混ぜていません。追加profileでは候補の初回診断起動がtimeoutし、新contextの再取得は成功しました。

音量compile/schedulerの`audio-preview.js`と`audio-timeline.js`はHEADとバイト一致。Gに大幅なCPU退行は見られず、PCM/多数点回帰も成功しました。旧filter/map/sort方式へ戻した事実はありません。全体CPUが完全同等だという保証はしていません。TaskDurationは計測batch全体のmain-thread CPUで、OS全process CPUではありません。提出間隔は実画面presentではなく、実機の滑らかさとも区別します。

## 7. 公開判定と次の作業

| 優先 | 問題 / 判断 |
|---|---|
| **P0 / 新規** | B4補正で実写transitionが破綻。bypass比較で経路を特定。既存機能を維持できず公開不可 |
| **P0 / 新規** | 追加lossy encodeによる実測画質損失。Maximum/ProResも差0ではない。今回の公開基準を満たさない |
| P1 / 検査限界 | 内部10ms PTSずれをstream要約検査が見逃す。時計正常化の保証範囲を見直す |
| P1 / 既存継続 | 合成beepが約19.33ms先行。B1〜B4の新規回帰ではないが、納品向けの同期精度として未解決 |
| P2 / 要追跡 | 通常再生Aのp95/CPU差。明確な全体性能同等とは判断しない |
| P2 / 運用制約 | 素材再コピーの旧世代が増える。通常保存では増えない。安全な整理手段は未実装 |

**B1〜B4統合版は公開不可、B4の採用推奨を統合検証結果で見直します。** 次は結合段階の時刻生成を修正し、既存transitionの内容と画質を変えずに出力clockを成立させる小さな修正を別作業にします。timestampだけの修復、intermediate方式などは案であり、未実装です。正常時を確実にcopy経路へ保ち、内部PTS異常・今回の実写再現・A/Vマーカーを回帰へ加える必要があります。補正を無断でOFFにして公開する案は採用していません。

## 8. 未検証・ユーザー実機での確認

実機iPhone/Safari、Mac GUIのインストール/QuickTime再生、スピーカー/ヘッドホンでの実聴、外部フォルダpicker・実ディスク満杯/切断/電断、長時間4K/HDR・P3/Rec.2020、30分以上の負荷、クリーン端末/旧FFmpegは未確認です。BT.709実写8bitと合成10bit勾配を、HDR実写の検証として扱いません。

ブロッカー修正後、ユーザー実機では①既存projectの別名backup→保存/再読込/再リンク、②iPhoneで連続seek・hold ramp・多点/連動音声・停止再開、③MV実写のtransition/色/テロップ比較、④音画マーカーと実聴、⑤ブラウザH.264とMac H.264/ProResの独立再生、⑥長尺の時間・空き容量・発熱を確認してください。今回の失敗を実機確認へ丸投げせず、再現済みP0は先に開発側で解消する必要があります。

## 再実行入口

既存の`npm test/build`、`.github/workflows/validate.yml`のnative22本、`scripts/package-mac.py`、B1〜B4のbrowser scriptを再利用しました。今回の追加測定は`check-release-timing-quality.py`（PVE_QA_FORCE_GRADIENTで10bit異常注入）、`check-release-transition-isolation.py`、`check-release-av-sync.py`、`check-release-storage-growth.mjs`です。対象repo/一時出力/QA素材を引数で渡し、アプリ本体を変更しません。Pythonの実写比較には既存QAと同じPillow/numpyが必要です。

長い数値/ログは証拠フォルダ（開発監査資料・配布対象外）へ保存。元動画・実写比較画像・生成動画・ZIP・CPU profile原本は`/tmp/pve284/`に保持しました。元の未公開作業、実素材、保存済みprojectは破棄していません。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
