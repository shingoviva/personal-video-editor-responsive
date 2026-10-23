# Phase 1f ブラウザAACの開始遅延修正

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


2026-10-23。**Chromeの44ms遅延は原因から修正済みです。ただし、元AACとの波形比較の残件とWebKit未完了があるため、全面的な正式採用は保留します。** 全条件をPASSとは扱いません。version2.2.83、公開・version変更・commitなし。

## 1. 原因と段階比較

macOS Chrome155 / FFmpeg8.0.1 / MediaBunny1.56.0。生成した符号付きPCMマーカーを相互相関で測定しました。代表素材は48kHz AAC、2秒、マーカー0.5/1/1.5秒です。

| 段階 | 修正前：3点の遅延（48kHz sample） | 修正後 |
|---|---:|---:|
| 元AACをFFmpegでデコードしたPCM | 基準0 | 同じ基準 |
| Chromeの素材デコードPCM、ミキサー入力 | 0 / 0 / 0 | 同じPCM経路 |
| gain/mix後＝Encoderへ渡す実音声PCM | 0 / 0 / 0 | 0 / 0 / 0 |
| 生EncodedAudioChunkをADTS化してFFmpegデコード | 2112 / 2112 / 2112 | 26112 / 26112 / 26112（検証用24000＋実測2112） |
| mux後MP4をFFmpegで独立デコード | 2112 / 2112 / 2112 | **0 / 0 / 0** |
| MP4をChrome AudioContext / MediaBunnyで独立デコード | — | 両方 **0 / 0 / 0** |

修正前の生AACと最終MP4のPCMは完全一致し、mux前に遅延が発生しています。生AACを別のChrome AudioDecoderでもデコードすると同じ2112sampleでした。FFmpegだけのskip不良、mix、trim、resamplingによる44msではありません。

AudioEncoderの先頭chunkはtimestamp=0µs、duration=21333µs、AAC-LC、48kHz stereo。decoderConfigはASC `1190`、sampleRate/channels等だけで、観測した出力にはpriming値がありません。従来のAudioSampleSource→MP4はこれをPTS0の有効音声として保存し、エンコーダーの立ち上がり分を除外していませんでした。

[AACのWebCodecs登録仕様](https://w3c.github.io/webcodecs/aac_codec_registration.html)と、[MediaBunnyの同種の報告・制約](https://github.com/Vanilagy/mediabunny/issues/444)も参照しました。2112をOS・エンコーダー全体の普遍値とはしません。

## 2. 修正方式とファイル

- `dist/browser-audio-output.js`：同じAudioEncoderへ0.5秒の使い捨て検証PCMを先行入力。0.1/0.2秒の別々の帯域制限符号を、実際のAAC出力をデコードして検出します。2点の整数lagが一致し、各相関≥0.9のときだけ実測遅延を採用します。入力素材や音楽の内容には依存しません。
- 同じエンコーダーを**途中flushせず**実音声へ継続し、検証PCM＋実測遅延の分だけcompressed packetを負時刻へ配置します。[MediaBunnyの負timestamp対応](https://mediabunny.dev/guide/packets-and-samples)によりMP4 edit listへ記録します。開始のAAC packetはデコード用prerollとして保持し、ユーザーPCMの冒頭を削りません。
- 実音声のPCMは変更せず、AudioDataのtimestampだけ検証区間分を加えます。48kHzサンプル番号で連続性を検証します。終了以降のencoder paddingだけを除外し、最終packetの有効durationをプロジェクト終端へ合わせます。
- 不明なdelay、相関不足、不一致、異常なpacket時刻、タイムアウトは失敗として報告します。44msへのfallbackはありません。キャンセル・encoder/decoder失敗でも解放します。メモリは区間単位で、曲全体を保持しません。
- `dist/mobile-render-worker.js`：音声sourceの接続とflush/closeだけを置換。校正結果を`audioTiming`で返します。mixAudio、音量評価、video source/rendererは変更していません。
- `tests/browser-audio-output.test.mjs`：0/321/1024/2048/2112/4096/7200sampleの実測、非一定delay・相関不足の拒否、PCM保持、負時刻、padding、キャンセル等。
- `package.json`：上記1本をnpm testへ追加。保留中Lab設定を保持。
- QA：`scripts/check-browser-av-sync.{mjs,py}`、`scripts/probe-browser-aac-delay.mjs`。前者の`PVE_AUDIO_BASELINE=1`は旧AudioSampleSourceだけを凍結再現する**調査モード**です。正しい結果を検証するPython verifierは凍結モードを合格oracleとして受け付けません。

## 3. 数値結果と保持範囲

全数値（開発監査資料・配布対象外）、段階別証拠（開発監査資料・配布対象外）、修正前後（開発監査資料・配布対象外）。許容同期誤差は従来どおり2ms、相関の確認条件も緩めていません。

| 条件 | 結果 |
|---|---|
| 44.1/48kHz入力 × AAC/PCM × 24/29.97/30/60fps | 通常16出力、意図したmix PCM→最終PCMのlag0 |
| 途中配置＋trim、2レーン、hold envelope、holdランプ内split、連動原音 | 20出力、同lag0 |
| 40ms短尺、60秒長尺 × 2rate/2入力codec | 8出力、同lag0 |
| 96/128/256kbps AAC | 3出力、同lag0。通常の320kbpsも測定 |
| 全47出力・219マーカー | Encoder入力基準で最大誤差**0sample**、最小相関0.8343、ドリフト0sample |
| 実映像flashとaudio（通常＋bitrate19出力） | 最大1.5ms。動画側のフレーム量子化分を含む |
| 凍結旧経路との比較8出力 | 全マーカー **+2112→0sample**。実音声Encoder入力は全サンプル完全一致 |

44.1kHz入力は既存mixが48kHzへ変換する仕様を維持します。44.1kHz出力へ変更したとの意味ではありません。

代表2秒出力は音声start_time=0、time_base=1/48000、duration=2。先頭packetはPTS/DTS=−26112、FFmpegのskip_samples=26112となり、検証PCMと実測primingが除外されます。Chromeの独立MP4 decodeは96000sample。FFmpegは最後のAACアクセスユニットを展開して96768sampleを返しますが、追加768sampleはコンテナduration外のcodec paddingです。40msは1920有効sample、FFmpeg展開2560sample。マーカー先頭10ms・終端10ms前を保持し、60秒では0.01/0.5/30/59.5/59.99秒のdrift0でした。

AACの非可逆性は残ります。全sampleのbit一致とは主張しません。同一設定の比較11出力では、遅延整列後の左ch SNRは通常/短尺320kbpsで旧28.19–39.94dB→新47.91–56.09dB、96/128/256kbpsで6.50/7.68/12.03→6.61/7.76/12.11dBでした。この合成素材で退行はありませんが、音楽全般の聴感品質を保証する値ではありません。比較値（開発監査資料・配布対象外）

映像60フレームのdecoded hashと全video packet PTS/DTS/durationは代表出力の前後で完全一致。追加映像encodeはありません。変更はブラウザAACのencode/mux境界だけです。

## 4. 合格にしなかった比較・未検証

**元AACの独立FFmpeg decodeをそのまま最終PCMへ照合する厳格比較は47中12条件で相関不足、verifierの全体結果はFAILです。** これを上記Encoder入力基準のPASSで打ち消しません。

- 主な差は48kHz AACの先頭10msマーカー（相関約0.772）、40ms AACの冒頭（44.1kでは相関0.326、整数peak+41sample＝0.854ms）。低相関なので、このpeakから正確な同期を肯定しません。
- 別にhold内splitの0.5秒、96kbpsの1.5秒にも元波形との相関不足があります。意図した境界gain/declickと非可逆圧縮の影響を含み、すべてを素材decoderの不良と断定しません。
- 凍結旧経路と新経路の実音声Encoder入力は8比較すべて完全一致。40ms AACおよび48kHz通常AACの冒頭差は、**今回のpriming修正前からEncoder入力までに存在**します。素材デコードのpreroll等が原因候補ですが、根本原因の確定・修正はこの44ms限定作業へ混在させていません。
- WebKit26.5は実APIでAAC/VideoEncoder利用可を確認しましたが、実書き出しは旧・新ともunknown transient operation errorで失敗。模擬PASSやSafari実機PASSとはしません。
- 実Safari/iPhone/QuickTime・他OS/他Chrome backend、実録音/音楽の聴感、60秒超、VFR/不連続PTSは未検証。初期校正範囲は0–150msで、それ以上や遅延変動は失敗します。
- 追加コストは固定0.5秒のAAC入力と短い校正decode、符号相関、負時刻のcompressed preroll保持。CPUの厳密な同条件A/B測定は未実施です。今回の並行試験の所要時間を性能改善の証拠にはしません。

## 5. 回帰・正式採用判断

全90JS、build、実FFmpegのMac等速44条件（最大1sample）、B4時計32条件（exact PTS、10bit/色、FX/TEXT/transition、clock encode0）、HTTP、Chrome8fps時計試験PASS。Chrome8fpsの最大時刻誤差5.55e−17秒。Mac core/audio_engine、B1〜B3、timeline時間モデル、保留text02/Labは開始時hashと一致しています。差分監査（開発監査資料・配布対象外）

生ログ・生成素材・PCM・traceは `/tmp/pve-browser-sync/`。再現はPython QAのprepare→静的候補をHTTP配信→Node QA→Python QAのverify（詳細は各script冒頭）。`PVE_PLAYWRIGHT_MODULE`にPlaywrightのESM入口を指定します。生成素材のみを使い、既存素材・プロジェクト・元Mac ZIPへは触れていません。Macパッケージは今回未再生成です。

**44ms修正はChromeでの採用候補です。ただし全面的な正式採用・2.2.84公開判定はHOLDを推奨します。** 次は元AACの冒頭PCM差の切り分けとWebKit実経路確認を独立して行います。Mac非等速WSOLAの既知の2ms超過も別件として残っています。再統合検証へ証拠を持ち込むことはできますが、同期全体を解決済みとして公開へ進める状態ではありません。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
