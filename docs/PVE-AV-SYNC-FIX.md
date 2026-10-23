# Phase 1e 音画同期の調査・等速修正

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


2026-10-23。**等速の19.333ms先行は修正済み。ただし同期全体は未解決、2.2.84の再統合判定は保留を推奨します。** 速度変更の2ms超過と、比較で見つかったChrome内書き出しの遅延を、合格済み試験で打ち消しません。version2.2.83、公開・commit・pushなし。

## 根本原因と最小修正

確認した原因は、等速でも`atempo=1.000000000`を通していたことです。FFmpegのatempoは波形の相関に基づき断片の位置を調整するWSOLA処理です。tempo=1でもPCMの恒等変換になりません。[使用版の実装](https://github.com/FFmpeg/FFmpeg/blob/n8.0.1/libavfilter/af_atempo.c)。

`engine/core.py:atempo()`へ、**速度が正確に1なら`anull`を返す**3行を追加しました。19.333msやsample数の補正定数、遅延・trim追加、resamplerやmix設定の変更はありません。非等速フィルターは3990速度で旧版と文字列一致し、0.5倍の実出力PCMも旧helperと完全一致しました。Speedモデル・音声エンジンの作り直しは行っていません。

変更ファイル：`engine/core.py`、`tests/av-sync.test.py`、`tests/av_sync_helpers.py`、`scripts/check-av-sync.py`、`.github/workflows/validate.yml`、本報告・証拠・従来報告の参照注記。`audio_engine.py`、B1〜B4、全UI、text最適化02・Feature Labの元差分は維持しています。

## 段階別の切り分け

元のflash/beep素材（48kHz AAC）の同じデコード基準で、絶対振幅0.05を最初に超えるサンプルを比較しました。トラックのPTS開始と、波形の立ち上がりは区別します。

| 段階 | 修正前sample / 秒 | 修正後sample / 秒 |
|---|---|---|
| 元素材のデコードPCM | 48001 / 1.000020833 | 同じ |
| 切り出し・速度処理後piece PCM | 47073 / 0.980687500 | 48001 / 1.000020833 |
| piece結合後PCM | 47073 / 0.980687500 | 48001 / 1.000020833 |
| gain・窓trim・レーン結合後PCM | 47073 / 0.980687500 | 48001 / 1.000020833 |
| 最終mux前音声 | 47073 / 0.980687500 | 48001 / 1.000020833 |
| H.264/AAC・ProRes/PCMの最終decode | 47073 / 0.980687500 | 48001 / 1.000020833 |

単独フィルター比較でも、`atrim`・`asetpts`・`apad`までは48001、`atempo=1`を加えた段階だけ47073でした。最終limiter/mix/muxより前に既にずれています。閾値0.01では旧onsetが46982となり、波形の変化と閾値の影響もあります。928sampleを普遍的なencoder delayとは扱いません。

独立したcoded impulse波形の相互相関でも、旧unit-atempoによる位置変化を確認しました。例：48k PCM入力の0.5/1/1.5秒マーカーは−1024/−966/−1024sample、44.1k PCM入力は48k換算で−1078/−1115/−1078sample。修正後はすべて0sampleです。PCM入力でも発生するため、AACだけの問題ではありません。

- **AAC priming / decoder**：入力AACの先頭packet PTSは−1024、skip_samples=1024、stream start_time=0。44.1k/48kで時間換算が異なります。比較基準はskip処理を適用した実デコードPCMです。
- **trim / resampling**：音声窓・sample rate変換を分離して検査しました。44.1kの半サンプルに落ちるtrimは、48k比較で最大1sampleの差でした。変換方式は変更していません。
- **gain / mix / limiter**：pieceのずれを引き継いでいたことを段階記録で確認。修正後に新しい先行を加えていません。
- **最終AAC encode / mux**：final-audio.m4aと最終MP4の先頭音声packetはともにPTS−1024・skip1024、start_time=0。デコード後の相互相関は0sample。ProRes/PCMはPTS0、skipなしで同じ位置です。

相互相関用PCMは48kHzへ統一し、元streamのsample rateも別に記録しています。詳細なsample数・sample rate・PTS/DTS/time_base・skip情報は段階記録（開発監査資料・配布対象外）とAAC出力段階記録（開発監査資料・配布対象外）へ保存しました。映像PTSと音声PTS、物理PCM配列の位置を混同していません。

## 数値・コーデック・編集試験

既存`check-release-av-sync.py`は変更せず、2ms音声基準・1µs映像基準を維持しました。

| 確認 | 結果 |
|---|---|
| 既存beep：H.264 30/29.97、ProRes 30 | 全3条件PASS。source比−19.333ms→**0ms**。映像flashは30fpsでframe30/1秒、29.97でframe30/1.001秒 |
| AAC/PCM入力×44.1/48k×H.264/ProRes出力×24/29.97/30/60fps | 32条件、0.5/1/1.5秒の相互相関位置差**0sample**。映像flashのフレーム番号も確認。実際の音画差の最大は29.97fpsの1.5msで2ms以内 |
| trim/splitされた動画原音、途中配置の連動音声、2音声レーン | 12条件PASS。source座標から算出した位置との差は最大**1sample＝20.833µs**、最小相関0.932 |
| 120秒、44.1/48k、AAC/PCM入力、両出力 | 8条件PASS。0.5/60/119.5秒すべて位置差0sample、冒頭〜終端の差も**0sample**。3点・1sample分解能での測定で、無制限の長尺保証ではありません |

相互相関は既知の符号付き短い波形を使い、integer sample単位で探索します。44.1kの半サンプルtrimについては近傍の分数位相も評価しますが、整数lagの精度条件は変えません。AACのpre-echoを単一閾値だけで判定していません。

追加AV試験のflashは既存QAと同じ50msです。初期の1/60秒flashは24fps変換で消える場合があり、同期の観測用として不適切だったため区別しました。元の既存beep試験、マーカーの時刻、2ms基準は変更していません。映像フレームへ量子化される差と、音声サンプルの時計誤差も分離しています。

## 未解決：速度変更

0.5/1.25/2倍、44.1/48k、AAC/PCM入力、両出力の**24条件はすべて、少なくとも1マーカーで2ms基準FAIL**です。相互相関は最低0.899と十分で、単なる閾値の誤検出としては扱えません。

| 速度 | マーカーの先行範囲 |
|---|---|
| 0.5倍 | 0.333〜44.104ms |
| 1.25倍 | 13.333〜19.271ms |
| 2倍 | 5.417〜18.000ms |

例：48k PCMの2倍では、0.5/1/1.5秒の元マーカーに対して−288/−576/−864sampleとなります。同一素材内でも位置ごとに変化し、固定遅延では修復できません。旧helperで再生成した0.5倍PCMが修正後と完全一致しており、今回の回帰ではありません。

現在の非等速WSOLA処理に残る波形位置精度の問題です。PTSだけを変更しても移動した波形は戻りません。pitchを変える単純resamplingへの置換は既存仕様を変えるため採用せず、内容を解析して時刻を後付け補正する方式も実装していません。既存環境にはrubberbandフィルターがありません。次に、pitchを維持する方式のtransient位置・遅延・長時間精度を比較し、依存関係と音楽の品質を検証する必要があります。この部分を解決済みとはしません。

## PCM・画質・B4と自動回帰

- 等速pieceと元デコードPCMの最大絶対差は**5.96×10⁻⁸**（floatのchannel/sample format変換を含む）。最終ProRes/PCMも0.5倍gainのsource基準との差は最大1.70×10⁻⁷（24bit等の変換を含む）でした。mux前後のデコードPCMは両codec・4入力の8条件すべて完全一致しました。不要な波形伸縮を除き、gain/envelope/declick・AAC/PCMの既存出力設定を維持しました。
- 同一flash/beep動画の修正前後60フレームはネイティブデコードhashが完全一致。映像の変更・時計用再encodeはありません。
- B4出力時計32条件と別の8fps試験：PASS、正確PTS誤差0、copy concat維持。B2/B3実PCM試験もPASS。
- 全89 JS入口の`npm test`、`npm run build`、関連native12本、HTTP upload/render/download：PASS。
- 新規等速回帰`tests/av-sync.test.py`（44条件）はCIへ追加。調査用`check-av-sync.py`は旧unit処理を再現するsectionと、未解決のspeed sectionを分離し、speedのFAIL時はexit 1を返します。
- Mac候補ZIPは元作業を触らず一時コピーで作成し、core/tests一致・CRC・launcher・text02/Lab除外を確認。版は2.2.83のままです。

## ブラウザ比較と判断

Chrome155からMac APIへupload→H.264/ProRes書き出し→downloadした44.1/48kの4出力は、独立FFmpeg decode・時計検査・PCM位置差0sampleで合格しました。

同じ素材のChrome内WebCodecs書き出し2条件では、全3マーカーが**+2112sample＝44ms遅延**しました。相関0.957以上で、packet時計は正常でも波形位置がずれています。encoder primingとコンテナへの反映の関係は未特定で、原因を確定したとの判断はしません。Macの等速先行と別問題として記録し、ブラウザコードは変更していません。2112sampleも普遍的な補正値として使いません。

未検証：実機QuickTime/Safari/iPhone・実聴、実録音/実写の多様なAAC encoder、元のAVトラック開始時刻が異なる素材・欠落/不連続PTS・VFR、120秒を超える長尺、極端な速度や速度カーブ。APIの従来の`verified`はdecode/出力時計の検査であり、未解決の速度波形同期まで保証しません。

**等速の最小修正は採用候補です。ただし、音画同期を全面解決したとして2.2.84の再統合検証へ進める判断は保留します。** まずnative非等速の2ms超過を限定課題として継続し、Browserの44msは別経路で原因調査が必要です。

再実行：`python3 tests/av-sync.test.py <結果JSON>`、既存`python3 scripts/check-release-av-sync.py <repo> <出力先>`、`python3 scripts/check-av-sync.py <使い捨て出力先> --section stages|long|speed`（`--delivery H.264`でAAC出力の段階記録）。証拠はav-sync-evidence（開発監査資料・配布対象外）、全ログ・合成素材・一時候補は`/tmp/pve-av-sync/`。実ユーザー素材/保存済みプロジェクトは使用・変更していません。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
