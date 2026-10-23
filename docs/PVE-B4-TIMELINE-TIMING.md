# Phase 1d / B4 タイムライン時間基準

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


追記：B4のMac出力時計は[Phase 1d-2修正報告](PVE-B4-OUTPUT-TIMING-FIX.md)で再設計・検証しました。本書の旧補正に関する失敗記録は履歴として保持し、公開判断は再統合検証で行います。

**統合検証で判断更新**：[2.2.84公開準備評価](PVE-2.2.84-RELEASE-READINESS.md)にて実写transitionの回帰と補正による追加画質損失を確認。以下は個別試験時点の記録で、当時の採用推奨を現時点の公開承認として扱いません。現候補は公開不可です。
2026-10-23、未公開。以下を実装前の判断として記録する。結果は検証後に追記。

## 採用する時間契約

- 現行は秒のNumberで素材IN/OUT、タイムラインstart、overlay開始/終了を保存する。独立編集fpsは存在せず、ドラッグが固定30fps、フレーム送りが素材fps、exportが別fpsで不整合だった。
- 編集時刻の正本は引き続き連続した秒。任意属性`timelineRate:{numerator,denominator}`を追加し、編集fpsだけを保持する。初期値/旧projectは30/1。タイムライン内の一つの設定場所で変更できる。設定変更で保存済み時刻を変換しない。
- 素材fpsはデコード/素材情報、編集fpsは映像・overlayのドラッグ時グリッドとフレーム送り、export.fpsは出力サンプル列を定める。三者を自動連動しない。
- 23.976/29.97/59.94は24000/1001、30000/1001、60000/1001。フレーム時刻は整数番号×分母/分子から計算し、反復加算しない。
- 吸着OFFはグリッド・端/ヘッド/マーカー磁石・等間隔吸着を無効化。範囲制限と最小長は残る。ONは映像/overlayを編集グリッドへ置き、近い参照時刻への磁石と等間隔合わせを優先する。参照が音声などのサブフレーム時刻ならその正確な値を保持する。
- 音声自身のドラッグはONでもフレーム量子化しない。磁石は利用可能。グループ移動は主対象の規則で共通のdeltaを決め、相対位置を保つ。
- 数値入力・分割・再生ヘッドの秒を強制量子化しない。フレーム送りだけは全体タイムラインの直前/直後の編集フレーム境界へ進む（素材fps/速度には非依存）。
- 速度変換は既存sourceOffset/outputOffset/timingBaseを使用し、元映像時刻と出力時刻の対応は改変しない。最小長は既存の安全制約としてグリッドから分離し、今回一律1フレームへ置換しない。

## 保存への影響

version=1の任意属性追加のみで既存秒はそのまま。読み込み時に不足する編集fpsだけ30を補う。自動ファイル移行/上書き/素材変更は行わない。旧版への逆保存では編集fpsの設定を保証しないため、戻す前にprojectを別名保存して退避する。既存時刻のリタイムを伴う移行は不要。

## 原因・修正箇所

**確認した事実**：固定30fpsの丸めが磁石ON判定の外にあり、OFFでも1/24秒→1/30秒、1/60秒→1/30秒となった。修正前の8条件（開発監査資料・配布対象外）。フレーム送りは素材fpsを速度写像へ通しており、空白時だけ30fpsだった。

| ファイル / 関数 | 変更 |
|---|---|
| `dist/timeline-time.js` | normalizeTimelineRate / editingFrameTime / quantizeTimelineTime / stepTimelineFrame / frameRateValue。8レートの有理数、絶対フレーム番号からの時刻計算 |
| `dist/timeline-gestures.js` | snapClipPosition / bindTimeline。OFFで生の秒を保持、ONは編集rate。音声はrate=nullで量子化しない |
| `dist/overlay-timeline.js` | snapOverlayStart / bindOverlayTimeline。FX/TEXTの移動・両端trimも同じrate、bypassで磁石と量子化の両方を解除 |
| `dist/model.js` | project / sanitize。任意timelineRateの初期値・正規化。既存時刻・速度・音量は変換しない |
| `dist/app.js` / `index.html` / `i18n.js` | 編集fpsの単一設定、設定Undo/Redo、映像/overlay/マーカー/ドロップへのrate受渡し、音声ドロップのグリッド除外、編集境界を基準とするstep。空白末尾の送りも許可 |
| `dist/mobile-model.js` | outputSettingsで23.976/29.97/59.94という出力ラベルを対応する有理数へ解決。編集fpsは参照しない。既存ミキサーは変更なし |
| `engine/core.py` | export_frame_rate / export_video_timescale / video_timing_matches / render。出力レートの有理数解決、正確なPTSを表現できるMP4時間基準、結合後の時計検査・条件付き補正 |

**追加検証で確認**：2フレームの短いクリップを含むMac出力では、12フレームあるのに先頭PTS=0.021秒、avg_frame_rate=540000/18769となるケースがあった。フレーム数だけの検査では発見できない。補正前記録（開発監査資料・配布対象外）。AACの開始時刻と結合時のB-frame/DTS処理が関与するとの技術的推定で、原因を特定のFFmpeg版だけへ断定しない。

結合後に開始時刻・フレーム数・duration・平均fpsを確認し、不整合なら既存の`video_frame_window`でPTSをゼロ起点の連続フレームへ揃える。FX/TEXT合成より前に実行し、音声はcopyする。正常なら追加encodeしない。23.976は360k、59.94は180k、その他は既存90kのtimescaleを使い、1フレームを整数tickで表す。これは保存された編集時刻の変更ではなく、指定された出力サンプル列への整合である。

## 8種類のfpsでの結果

| 編集/出力レート | 0.5秒の出力フレーム数 | 元のcut=0.08341666666666667秒以後の最初の青フレーム |
|---|---:|---:|
| 24000/1001 | 12 | 2 |
| 24/1 | 12 | 3 |
| 25/1 | 13 | 3 |
| 30000/1001 | 15 | 3 |
| 30/1 | 15 | 3 |
| 50/1 | 25 | 5 |
| 60000/1001 | 30 | 5 |
| 60/1 | 30 | 6 |

フレーム番号は0起点。出力は時刻`n×分母/分子`の画を採るため、元cutを変更せず、次に到来する出力フレームから青になる。編集24000/1001・素材60fpsのMac動画、編集24000/1001・素材情報25fpsのブラウザ画像で、同じ8出力レートを実行し、デコード後の画の所属も一致した。出力尺の末端はceil(連続尺×出力fps)フレームとなり、連続秒の尺と1フレーム未満の差が生じ得る。音声をその映像グリッドへ丸めない。

- 局所：8レートすべてで映像/音声move・IN/OUT、FX/TEXT move・IN/OUT、ON/OFF、サブフレーム参照への磁石、bypass、5速度カーブの分割/逆写像、JSON復元を確認。各レートで4万回の往復step、1000回のgrid移動、100回trim、約200万フレーム座標も検証。
- 最大計算誤差 **1.7763568394002505e-15秒**（30fps、速度付きsplitの総尺）。最大フレーム換算誤差 **1.0658141036401503e-13フレーム**。許容5e-10秒は事前の固定値で、修正のために緩めていない。
- Chrome155 / WebKit26.5：8レート×ON/OFFで実マウスによる映像・音声・FX・TEXT移動、映像OUT trim、フレームボタン、split、編集fps変更と各編集のUndo/Redo、projectダウンロード→ファイル選択復元が成功。受信pointer座標から計算した指定時刻との差は両ブラウザ最大 **4.440892098500626e-16秒**（25fps、splitの2.4秒）。空白末尾も後ろへ飛び戻らず送れる。
- ポインター自体の座標分解能は別に測定。試験で要求した移動量0.2137秒に対しChrome最大1.1572e-7秒、WebKit最大 **0.008217808219178085秒** の入力座標差があった。これは今回の倍率でのピクセル入力との差で、内部時刻精度と混同しない。小数ピクセルを持たない操作はズームで細かくし、厳密なフレーム指定はframe step/数値入力を使用する。
- Chrome実WebCodecs/OPFS MP4：8レートのフレーム数・画の境界一致。packet PTS最大誤差 **5.551115123125783e-17秒**（24000/1001、frame9）。使い捨て画像のみで、各出力を削除。
- Mac実FFmpeg8.0.1 H.264/AAC：8レートの整数PTS×time_baseと有理フレーム時刻が **全フレームで完全一致（誤差0）**。ffprobeの6桁表示だけを比較すると最大3.3333e-7秒（29.97、frame8）で、実PTS誤差とは区別した。cutと音声start=0.00037秒はproject上で不変、音声の継続・全体decodeも成功。

## 音声・速度・保存安全性

連動対象は既存syncLinkedAudio/sourceOffset/outputOffsetを通る。映像主導の連動移動は同じdeltaを適用し、独立音声主導では量子化しない。Speedの積分・逆変換・timingBaseとB2/B3音量評価式は変更していない。素材fpsはVFRの推定値を含むため、編集フレーム送りを「元素材の必ず次のデコードフレーム」とは定義しない。

保存時刻はJSONで往復し、旧projectのtimelineRate不足は30/1だけ補う。rateを変えても既存クリップのstart/IN/OUT、export.fps、素材fpsが不変であることを確認した。UIのrate変更は通常の履歴トランザクションでUndo/Redoする。今回の試験は隔離コンテキスト・一時PVE_DATAのみで、実ユーザーの素材や保存projectには触れていない。

## 回帰・性能

- JS局所timeline＋export **34/89**、`npm test`全89エントリー（B4新試験はtimeline-timeからimport）、`npm run build`成功。既存overlay試験のbypass期待値だけ自由配置へ更新し、B1〜B3の期待値・閾値は変更していない。
- 最終全JSは既存creative試験のNode→Python呼出しがsandbox内だけ停止したため、同試験の通常環境での即時成功を確認後、一時PVE_DATAを指定した通常環境で完走を確認。試験のassertや対象アプリを変更して回避していない。
- Python実処理：新B4 8fps、既存frame-window 24/30/60、export-optimizations（単フレーム・動く画・worker分離・FX）、transitions、ProRes10bit/PCM・効果・raster textが成功。
- B1保存本体/試験、B2/B3のclip-envelope/UI、audio-preview、native render_tracks、text最適化、Lab/packageは開始hash不変。native gain_envelope_expressionも関数本文不変。mobile-modelは出力rateの2変更を逆変換すると開始時と一致。保全記録（開発監査資料・配布対象外）。
- 時刻補正が必要な0.5秒・160×90の8出力では追加encode各 **0.0495〜0.0549秒**。再エンコードは追加の世代損失・時間・ファイルサイズに影響し得る。実写長尺での画質/速度は未評価で、改善済みと断定しない。正常な時計では処理を追加せず、probeはstream情報だけを読み、全フレームの本番常駐配列を作らない。

## 未確認・採用判断

実機iPhone/Safari、VFR実写のフレーム単位実聴、長時間反復、Mac ZIP/HTTP全体、FFmpeg旧版、補正encodeが発動する実写長尺の画質/速度は未確認。Mac時刻補正の検査はstream要約であり、全ケースの全内部PTS異常を証明するものではない。既存の最小長（例：通常clipの元時間1ms、freezeとoverlay dragの33.333ms、保存正規化側の既存最小長）とslider刻みはグリッドとは独立に維持しており、すべてのUIを1フレーム最小長へ統一したわけではない。時計表示は既存の百分秒で、フレーム番号表示やドロップフレームtimecodeは今回追加していない。

**B4の実装採用は推奨、B1〜B4統合版の公開は別途判定**。特に追加encodeの実写長尺評価と、全Python/HTTP・Macパッケージの統合確認を公開前に行う。バージョン更新・公開は行っていない。将来のSpeed/アンカーは「連続秒の編集結果」「編集グリッド」「出力サンプル列」「元素材時間の双方向写像」を別々に持ち、設定変更で既存アンカーを勝手にリタイムしない。

再実行：`node tests/timeline-frame-accuracy.test.mjs`、`python3 tests/timeline-timing-native.test.py <結果JSON>`。実ブラウザは`PVE_PLAYWRIGHT_MODULE`を設定し、`scripts/check-timeline-timing-browser.mjs <repo HTTP URL> <出力先>`と`scripts/check-timeline-export-browser.mjs <repo HTTP URL> <結果JSON>`。長い結果はb4-timing-evidence（開発監査資料・配布対象外）へ保存。`reproduce-before.mjs`は凍結した旧関数による調査用で、修正後の正解を判定する回帰試験から分離した。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
