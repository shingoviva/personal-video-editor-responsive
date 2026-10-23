# B4 Mac出力時計の修正

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


追記：等速の音声先行は[Phase 1e報告](PVE-AV-SYNC-FIX.md)で修正しました。速度変更とBrowser音声には未解決の同期問題があり、公開判断は保留です。本書の以前の測定値は履歴として保持します。

2026-10-23。バージョン更新・公開は行いません。

## 原因と方式の判断

確認済み：各中間動画の先頭PTSは0ですが、AAC primingを含むconcat入力の開始時刻が負になります。FFmpegの通常の入力時刻シフトにより、結合した動画は先頭PTSが約21msになります。短尺H.264ではクリップごとの並べ替え遅延も異なり、結合時にDTSが重複してmuxerが補正します。コンテナの長さを継ぎ足す方法は音声パディングも動画の間隔へ持ち込みます。

30fpsの局所実FFmpeg再現では、中間音声の先頭PTS/DTSは−1024/48000秒、動画は次のとおりでした（段階別記録（開発監査資料・配布対象外））。

| 段階 | 動画先頭PTS / time_base | DTS |
|---|---|---|
| 各クリップ生成後 | 0 / 1/90000 | −6000 |
| 旧concat直後 | 1890 / 1/90000 = 21ms | −4110 |
| 新copy concat直後 | 0 / 1/90000 | −6000 |
| 新最終出力 | 0 / 1/90000 | −6000 |

旧B4はこの出力へ`fps`/`setpts`と追加encodeを適用していました。実写dissolve +0.2秒MAE77.517（基準<9）、この補正だけを迂回した診断では3.138でした。再サンプリングと非可逆encodeを時計修復に使う方式は廃止します。

候補比較：

- 追加encode：画質とサンプル対応を変えるため不採用。
- 結合後PTSの無条件丸め：内部異常まで正当化するため不採用。
- 動画専用intermediate：追加ファイル/I/Oが必要。現在のsilent音声を使う合成経路も変更するため今回は不採用。
- **入力時計を保持するcopy concat＋実フレーム長の明示＋DTSの再構成**を採用。画のPTS・圧縮画・パケット順は変更せず、全パケットの検査を前後に行います。

`-copyts`でAAC由来の自動シフトを防止します。さらにMP4/MOVの既定movie timescale=1000では3フレーム/29.97fpsの尺が0.1001→0.100秒になるため、結合・最終出力のmovie timescaleもvideo trackと同じ90000/180000/360000へ設定します。各境界の累積フレーム番号からµsへ変換し、その差をconcat durationへ指定します。個々の丸め誤差を加算しません。必要な並べ替え遅延は各中間動画の「パケット番号−表示フレーム番号」の最大から求め、2フレーム固定とはしません。`setts=pts=PTS:dts=...:duration=...`をstream copyに適用します。これは画像filter/encoderではありません。

API根拠：[FFmpeg concatのdurationと時刻](https://www.ffmpeg.org/ffmpeg-formats.html#concat)、[settsのPTS/DTS・N/TB](https://www.ffmpeg.org/ffmpeg-bitstream-filters.html#setts)。使用環境はFFmpeg8.0.1。対応外・不正な時計は成功扱いせず中止します。

## 変更範囲

- `engine/core.py`：`video_packet_clock` / `video_timing_matches` / `render`。中間・結合後・最終出力の全packet検査。時計だけを理由とする追加encodeを除去。FX/TEXT自体に必要な既存合成encodeは維持。
- `tests/output-timing.test.py`：8fps×H.264/ProRes、短尺、画素hash/順序、正常・開始ずれ・内部PTS異常・中間異常時の中止。

- `tests/real-transitions.qa.py`：従来の24箇所MAE<9を維持し、全6結合のpacket時計・copy経路・時計用encode禁止を回帰条件に追加。成果物は固有の一時フォルダへ保存。
- `scripts/check-output-timing-quality.py`：任意の実写素材で画素hash・色・encode回数・原本保全を確認する入口。
- `.github/workflows/validate.yml`：新規native回帰試験をCIへ追加。
- 本報告・証拠JSONと、従来のB4/統合報告の参照注記。

保存形式・編集時間モデル・B1〜B3・音声エンジンは変更しません。処理順は「素材時刻からクリップ生成→クリップ内transition→copy結合→FX/TEXT→実音声の別mix→最終mux/必要な合成→decode＋全packet時計検査」です。中間音声は既存のsilentトラックで、実音声の再構成は従来どおりです。

## 検証結果

| 確認 | 結果 |
|---|---|
| 8fps×H.264/AAC・ProRes HQ/PCM、1・2フレームを含む結合 | 16条件PASS。各クリップ→結合→納品ファイルの全デコード画素hashと順序が一致 |
| 同じ8fps×2codec、transition＋FX＋raster TEXT | 16条件PASS。12フレーム、最終PTS誤差0 |
| 有理数PTSの比較 | 上記32条件および既存8fps試験の最大誤差 **0秒**。ffprobeの小数表示だけの差は最大0.333334µs（29.97fps/frame8） |
| 正常CFR / 開始+21ms / 内部frame10だけ+10ms | 正常のみ通過。内部異常はnb_frames=30・avg=30・start=0・duration=1の正常な要約でも検出 |
| 不正な中間動画の注入 | 失敗として中止。時計修復の追加encodeや成功応答なし |
| 実写transition、preview30/final60fps | 従来基準MAE<9で24箇所PASS。dissolve +0.2秒 **77.517→3.138**、final60fps同位置2.220 |
| 修正前の正常な診断基準（B4補正のみ迂回）との比較 | hard300・transition300・末尾参照264フレーム、全デコード画素hash一致。画素差0、フレーム順序同一 |
| 実写HEVC入力2本→H.264 High、各6秒 | 各180フレーム、part→joined→final全画素hash/順序/色metadata一致。MAE=0・PSNR=∞（初回encode済みのpart基準）。動画encode各1回、時計用encode **0回** |
| ProRes10bit gradient | 最終実行で865段階。全ネイティブplaneのhashが結合前後・最終出力で一致。8bit RGB比較に置き換えていません |

対象fps：24000/1001、24、25、30000/1001、30、50、60000/1001、60。PTSは有理数の理想時刻と整数timestamp×time_baseを比較しています。許容値は緩めていません。packet検査はPTSが対応するトラックtickへ正確に一致すること、重複/欠落がないこと、DTSが単調でPTSを超えないことを要求します。packet durationのみコンテナの整数丸め1tickを許容します。最終stream要約もstart/duration/avgを確認します。

中間ファイルのstream.durationには既定movie clockの丸めがあるため、その要約だけで正しいフレームを拒否しません。全packetのPTS/順序/長さから結合時間を決定します。先頭ずれや内部異常を単純に丸めて「修復」する処理は設けていません。対応の根拠がない異常ではエラーを返します。

## 画質・色・性能

H.264 High/yuv420p/TV/BT.709/AAC、ProRes HQ/yuv422p10le/BT.709/PCM s24leを保持しました。ProResのrange項目は前後とも取得不可で、明示的なrange metadataを保証したとの判断はしません。既存のSDR/709出力仕様を検証したもので、HDR/P3/Rec.2020への対応追加ではありません。

通常出力には`timed`動画も時計用encoderも生成しません。処理引数のcopy・video filter不在と、全デコードフレームhashの双方で確認しました。transition・FX・TEXT自体に必要な既存encodeは維持します。

実写6秒のcopy結合は約0.075/0.081秒。別の120秒/720p/3600フレーム生成済みfixtureの時計copy経路は0.078秒・子CPU0.085秒、動画encode0・画素hash一致でした（全プロジェクトの120秒render benchmarkではありません）。全packet検査も行うためprobeのコストは増えます。同fixtureの入力検査は0.088秒、検査出力は一時ファイルへ流し、メモリはフレーム数相当のbytearrayに制限します。旧補正の29秒と総処理時間の単純な比較はしません。追加の非可逆encode・`timed`動画一世代分のディスクは不要です。

## 回帰確認と残る問題

- 全89 JS入口の`npm test`と`npm run build`：PASS。
- 既存native12本（frame-window/clip-boundary/transitions/prores/export-optimizations/effect-consistency/material-fx/layers/region-zoom/overlay-only/multitrack/reliability）：PASS。B2/B3の実FFmpeg PCM試験もPASS。初回のB2/B3実行補助は引数不足で停止しましたが、正しいfixture引数で再実行して確認しました。
- HTTPのupload/render/download・認証・range・保存復元：PASS。最終候補ZIPのCRC・engine/test一致・launcher0755/bash構文・展開後HTTP：確認結果を証拠へ保存。
- Chrome155で実際の認証upload→29.97fps、dissolve＋FX＋raster TEXT付きH.264/ProRes出力→download：PASS。H.264の独立video要素でdecode/seekも確認。ProResの独立decodeはFFmpegで確認しています。
- 保存/UndoやB1〜B3実装は開始時hashを維持。text最適化02・Feature Labは元作業を保持し、パッケージ候補だけから除外。versionは2.2.83のまま、公開/commit/pushなし。
- **既知の音声先行は未修正**：flash/beepで3条件ともsource比−19.333ms、既存2ms基準はFAILです。映像のフラッシュ時刻は正しい出力フレーム境界を維持しています。これを全品質PASSとして扱いません。
- 未検証：物理MacのQuickTime/GUI導入、旧FFmpeg、HDR/広色域metadata、実写の長時間4K・ディスク逼迫・電断、実聴。大量クリップ/長尺の総処理性能上限も保証しません。使用環境はmacOS arm64・FFmpeg8.0.1、最終主要native試験はPython3.9.6（補助検証の一部は3.10.4）です。

**判断：B4出力時計の今回のブロッカーは修正済みとして再統合検証へ進めます。正式公開の承認ではありません。** 音声19msと以前の性能測定の懸念は、次の統合判定で分離して扱う必要があります。

再実行入口：`python3 tests/output-timing.test.py <結果JSON>`、`python3 tests/timeline-timing-native.test.py <結果JSON>`、`python3 tests/real-transitions.qa.py`（指定の任意実写素材がある場合）、`python3 scripts/check-output-timing-quality.py <出力先> <読取専用素材...>`。集約証拠はb4-output-timing-evidence（開発監査資料・配布対象外）。全生ログ・生成動画・検証ZIPは`/tmp/pve-b4-output/`、実写QA固有フォルダは同ログ末尾に記録し、private画像/動画はGitへ追加していません。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
