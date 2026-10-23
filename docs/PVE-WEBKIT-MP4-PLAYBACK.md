# Phase 1h — WebKit MP4再生・AAC priming調査

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


2026-10-23。version 2.2.83、公開候補2.2.84の限定調査です。**本体変更なし。version変更・commit・push・公開なし。** 既存のPhase 1f/1g、B1〜B4、保留差分を保持しています。

## 1. 結論と確度

**原因は、PVE出力の`elst`だけではApple系に対する明示的priming表現が不完全だったことと、強い因果証拠で一致しました。** 同じ圧縮データへ標準の`sgpd`＋`sbgp`（roll sample group）だけを追加すると、WebKit AudioContextの−2112sampleが0になり、Chrome/FFmpegも0を維持しました。`sgpd`単独では改善しません。

Appleは、両sample groupを含む完全な表現が必要で、不完全な場合の解釈は未規定、groupがなければ暗黙の2112sampleを想定すると説明しています。従来報告の「正しいedit list＋WebKitの追加skip」は、**edit listの数値は合っているが、priming表現全体が不足していた**と更新します。[Apple一次資料](https://developer.apple.com/documentation/quicktime-file-format/using_track_structures_to_represent_encode_delay_explictly)

ただし、**問題をAudioContext限定とは判定できません。** WebKit HTMLVideoElement→MediaElementAudioSourceの観測でも、group補完の前後で約44ms変化しました。通常の音声出力デバイスまで含む2ms同期、Safari、補完版QuickTimeの互換性は未確認です。今回は調査用fixtureで止め、正式muxへの組込みは提案に留めます。

## 2. 同一ファイルの独立デコード

PVE生成物の出力音声は48kHzです。基準は同じAACをFFmpegでデコードしたPCM。符号付きマーカー128sample窓の正規化相互相関を1sample刻みで測定しました。同期基準2msは変更していません。負lagは先行です。

| 2秒・48kHz出力 | FFmpeg | Chrome decodeAudioData | WebKit decodeAudioData |
|---|---:|---:|---:|
| 凍結旧方式 | +2112 | +2112 | 0 |
| Phase 1f保存MP4／Phase 1g現行 | 0 | 0 | −2112、冒頭10ms点欠落 |
| 同じAAC＋sgpdのみ | 0 | 0 | −2112 |
| 同じAAC＋sgpd/sbgp、roll −1 | 0 | 0 | **0、冒頭点保持** |
| 同じAAC＋sgpd/sbgp、roll −2（比較用） | 0 | 0 | 0 |
| elstを24000へ変更（採用不可の対照） | +2112 | +2112 | 0 |

最後の方式はChrome/FFmpegを壊し、2秒末尾マーカーも失います。WebKitだけに合わせた相殺は採用しません。elstを±480sample動かす対照では、各decoderの位置も±480変化し、groupなしのWebKitにはさらに−2112が残りました。elstを無効化した対照はWebKit decode失敗、他では校正prefixが露出しました。

44.1/48kHzの入力 × AAC/PCM × 40ms/2秒/60秒のChrome生成12条件、WebKit生成8条件、保存Phase 1f 1条件、上表の比較素材1条件（重複）を試験。**roll −1補完の22行・3decoder＝66比較／276マーカーで最大lag 0sample、drift 0sample、最小相関0.9999999999915。** 60秒は0.01/0.5/30/59.5/59.99秒、短尺は10/20/30msを確認しました。

代表映像は60frameで、flash開始frame15/30/45のPTSは0.5/1/1.5秒。補完前後の全frame PTSと独立decode輝度列が一致しました。冒頭10ms音声点に対応するflashは30fps上の0.033333秒へ量子化されるため、そこを物理音画2msの証拠には使いません。映像時計（開発監査資料・配布対象外）

これは**同じAACのコンテナ解釈の一致**です。Phase 1gのWebKit native AAC冒頭品質不足を改善した判定ではありません。加工前・補完後のFFmpeg全PCMは22行すべてバイト一致でした。比較（開発監査資料・配布対象外）、全PCM一致（開発監査資料・配布対象外）

## 3. HTMLVideoElement、Safari、QuickTime

実macOS Chrome155／Playwright WebKit26.5のpersistent使い捨てprofileを使用。動画は1倍速で終端まで再生し、`requestVideoFrameCallback`、再生イベント、AudioContext出力時計を記録しました。音声はHTMLVideoElementからMediaElementAudioSource→AudioWorkletへ取り出し、FFmpeg PCMとの相関で観測しました。マイク・ユーザー素材・既存プロジェクトは使用していません。

| 経路 | 確認した事実 | 2msの絶対音画同期 |
|---|---|---|
| Chrome HTMLVideoElement＋PCM採取 | 現行／roll補完とも冒頭10ms・中間3点・終端直前を保持、マーカー間隔の誤差0sample | **未保証** |
| WebKit HTMLVideoElement＋PCM採取 | 現行・補完とも中間3点〜終端の間隔誤差0sample。補完による相対位置変化あり。冒頭10ms点は採取できず | **未保証** |
| Safari通常再生 | UI接続がtimeout（−10005）、動画表示を取得できず | 未検証 |
| QuickTime通常再生 | 現行合成MP4を開き、尺00:02・経過00:02まで到達をUIで確認 | 未検証。roll補完版も未試験 |

HTML観測は初回6回、無音グラフを400ms先行起動した6回、標準FFmpeg／旧出力対照4回の計16回で終端到達。温めた計測の粗い「音声−映像時計」はWebKit現行−65ms、roll補完−21ms、標準FFmpeg素材−21msでした。初回も現行−62.33ms／補完−21.33msで、**変更による約41〜44msの差**を観測しています。Chromeは現行+10.57ms／補完+12.68msでした。

これらは実出力音画誤差の合格値ではありません。render quantumは128/48000＝2.667ms、出力遅延とcompositor時計の対応、起動時の停止・callback遅配があり、物理出力を直接収録していません。PCMの一定位置を合わせた後の間隔誤差0も、絶対同期0を意味しません。callback数の不足を出力ファイルのフレーム欠落と混同しません。

**WebKitの冒頭点欠落は、group完備の標準FFmpeg出力でも同じ採取経路で再現しました。** 観測グラフの起動／MediaElementAudioSource／media backendのどこかは未特定です。通常スピーカー再生にも欠落するとは断定せず、補完方式だけで解消したとも扱いません。温めた計測（開発監査資料・配布対象外）、FFmpeg対照（開発監査資料・配布対象外）、旧方式対照（開発監査資料・配布対象外）

## 4. MP4構造とprimingの切り分け

代表Chrome 2秒出力の値です。補完前後で以下の時計値・AAC・映像データは不変です。構造一覧（開発監査資料・配布対象外）、packet/stream（開発監査資料・配布対象外）

| 項目 | 値／意味 |
|---|---|
| movie timescale／elst duration | 57600／115200＝2秒。durationは音声sample単位ではない |
| audio track timescale | 48000 |
| elst media_time | 26112＝校正prefix 24000＋そのencoderで実測したpriming 2112 |
| 先頭AAC PTS/DTS | −26112＝−0.544秒 |
| ffprobe skip_samples／discard_padding | 26112／0。skipはelst等から導出された情報で、別の2112指定を格納している証拠ではない |
| AAC packet | 120個、通常duration1024。sttsは119×1024＋最後256、mdhd duration122112 |
| デコード容量／有効PCM／末尾余剰 | 120×1024＝122880、122880−26112−96000＝768sample余剰 |
| decode buffer長 | Chrome96000、現行WebKit94656、補完WebKit/FFmpeg96768。有効presentationはelstの96000sample |

raw decoderの余剰768sampleを有効な尺やドリフトとは数えません。40msでは有効1920、FFmpeg/補完WebKit buffer2560、Chrome1920。60秒は全decoder2880000。終端直前マーカーは補完版で保持されました。

検証追加は`sgpd` v1、grouping `roll`、default_length 2、entry_count 1、signed roll_distance −1と、`sbgp` v0、全AAC packetをgroup index 1へ割り当てる組です。計54byteを既存moov直後のfreeから使用し、祖先boxサイズだけ更新しました。**全56実験fixtureでmdatの位置・長さ・全バイトを照合**。音声／映像の再エンコード、PCM加工、packetの削除・並替えはありません。−2も動く事実だけで任意の値を正式採用せず、AAC-LCの−1を標準候補とします。[Appleの具体例](https://developer.apple.com/la/documentation/quicktime-file-format/example_representing_encoder_delay_explicitly)

別encoderの反証として、既存FFmpeg AAC素材（priming1024、44.1/48kHz、もともと同じroll両boxあり）からgroupだけを無効化しました。Chrome/FFmpegは位置不変、WebKitは48kHzで−2112、44.1kHzで48k換算−2299sampleへ変化。完備版は両rateとも整数peak 0でした。44.1kHzのresampling／native decode差で波形相関は約0.935〜0.992、同一PCMとは扱いません。**encoder実測delayとApple側の暗黙処理は別です。** 別encoder対照（開発監査資料・配布対象外）

elst不変・両group追加だけで差が消えること、単独groupでは残ること、別encoderでもgroup除去で発生すること、Apple文書が一致するため、ファイル表現不足の因果は高確度です。WebKit内部の実装箇所をinstrumentして二重skipの呼出しを確認したわけではありません。

## 5. 互換方式の比較と次の最小修正案

| 方式 | 判定 |
|---|---|
| 現行elst単独を維持 | Chrome/FFmpeg正常。Apple向け明示表現が不完全で、WebKit差が残るため正式採用を推奨しない |
| elst＋完全なroll groups | **推奨候補**。実測delay／prefix／有効尺を維持、3decoder一致、再エンコード不要。通常実機再生と本体統合は未 |
| elstから2112を引く／固定offsetを加える | 不採用。Chrome/FFmpegをずらし、末尾欠落も発生 |
| elst除去／sgpdだけ／iTunSMPB併記 | 前2者は対照で失敗。iTunSMPBは今回未実装・未試験。別の補助表現を重ねて成功扱いにしない |

次の限定作業では、最終MP4 muxのAAC-LC trackへ完全なroll groupを出力する位置を設けます。校正・PCM・packet時計を変更せず、実packet数でgroupを確定し、seekのdecoder依存も確認します。調査fixtureはmoov隣接freeを消費する専用方式で、**一般のMP4や本番OPFSへ安全に適用できるパッチではありません**。free不足時の拒否、streaming/キャンセル/失敗時の安全性、muxer更新への耐性を別途検証してから統合します。

## 6. 変更、試験、残件と公開判断

追加ファイルは本報告、`docs/webkit-mp4-evidence/`、`scripts/check-webkit-mp4-playback.py/.mjs`、`scripts/check-webkit-html-playback.mjs`、`scripts/check-webkit-html-pcm.py`、`tests/mp4-priming-fixtures.test.py`のみです。調査用7合成MP4を凍結保存しました。**アプリ本体・保存形式・依存ライブラリ・package.jsonは変更していません。**

- metadata fixture単体9件PASS（mdat不変、group構造、既存group二重追加拒否、free不足拒否など）。
- 実験56ファイル、AudioContext112回（elst無効化のWebKit1回は意図したdecode失敗）。roll補完の66比較は全PASS。対照のFAIL・低相関・欠落を結果JSONに残しています。
- `npm test` 全92入口PASS、`npm run build` PASS、`git diff --check` PASS。要約（開発監査資料・配布対象外）
- 開始時676既存ファイルのSHA256一致、削除なし。B1〜B4・Mac等速修正・Phase 1f/1g・text02・Feature Labを保持。scope監査（開発監査資料・配布対象外）
- 本体無変更のため、Mac FFmpeg/HTTP/パッケージ全回帰、再エクスポートの全matrixは再実施していません。既存生成物の独立decodeを今回の結果として扱い、以前の書き出しPASSと区別します。

**2.2.84の公開は引き続きHOLDを推奨します。** 調査成果は採用可能ですが、fixture方式をそのまま正式出力へ採用しません。次に標準groupsの最小mux実装・既存ブラウザ書き出し回帰・Safari/QuickTime/iPhoneの実出力観測を実施し、冒頭／末尾と2ms同期を確認してください。満たせなければ新方式の全面採用を持ち越します。既存Chromeの44ms遅延を戻す変更も、今回行っていません。

残件は、(1) WebKit HTML採取経路の冒頭欠落と時計誤差の切り分け、(2) Safari/QuickTime通常出力のloopback／外部同時収録、(3) Phase 1gのnative AAC短尺品質、(4) WebKit realtime映像品質です。Mac非等速WSOLA、Speed、UI、補正、保留最適化は別課題のままです。

再現手順・測定の制限はevidence README（開発監査資料・配布対象外）を参照してください。全PCM・profile・長尺素材・生ログは `/tmp/pve-mp4-playback/` に保存しています。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
