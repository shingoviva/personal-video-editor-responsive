# Phase 1g AAC素材デコード・WebKit互換性

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


2026-10-23。**ChromeのAAC素材preroll不足を修正しました。WebKitの実書き出し失敗も段階別に特定・限定修正しましたが、WebKit AudioContextで44ms先行する互換性問題とネイティブAAC品質差が残ります。正式公開はHOLDです。** Phase 1fはChromeの採用候補として維持し、全環境のPASSへ読み替えません。version2.2.83、公開・commit・版更新なし。

## 1. AAC相関不足の原因

原因は一つではありません。音量やdeclickの異なる波形をそのまま比較しません。

**素材デコードの不具合（確認済み）**：従来の`AudioSampleSink.samples(0)`は、素材の負PTSのAAC priming packetを飛ばして開始していました。AAC-LCの先行ブロックをデコードしないため、冒頭やdecoderを開き直すsplit/trim直後の波形が変わります。これはPhase 1f以前からあり、同フェーズの旧/新Encoder入力の一致とも整合します。固定の再生遅延ではありません。

素材は44.1/48kHz、40ms/2秒のAAC。FFmpegとChromeの**native sample rate PCM**を比較し、resampling・gain・再圧縮を除外しました。

| 素材 | 旧native PCM SNR | 先行packetを含めたSNR | 冒頭10/20/30ms等の位置 |
|---|---:|---:|---|
| 44.1kHz・40ms | 3.31dB | 139.86dB | 修正後すべて0sample |
| 44.1kHz・2秒 | 10.79dB | 139.67dB | 同上 |
| 48kHz・40ms | 6.14dB | 139.90dB | 同上 |
| 48kHz・2秒 | 10.57dB | 140.37dB | 同上 |

素材の先頭packetは−1024sample、FFmpegのskip_samples=1024。デコードには含め、負時刻のPCMだけを要求範囲外として除きます。sample番号・タイムラインの時刻をずらしていません。段階比較（開発監査資料・配布対象外）

**編集・圧縮との比較基準**：元AACを独立FFmpegでfloat PCMへデコードし、それを別素材として**同じPVEのgain/envelope、trim、split、declick、resampling、出力bitrate**へ通しました。11条件の実音声Encoder入力差は最大 **2.98×10⁻⁸**。最終PCM同士もlag0、最小相関 **0.999999972**でした。40ms、holdランプ内split、途中配置＋trim、96/128/256kbpsを含みます。同条件oracle（開発監査資料・配布対象外）

従来の「無加工の元AAC PCM→最終AAC」検査は12条件の不足から**96kbpsの1条件**に減りましたが、その検査結果はFAILのまま残しています（1.5秒の相関0.794、lag0）。同じ損失圧縮を適用したoracleとの相関は合格し、decoderや同期の失敗とは区別できます。基準0.8や同期2msを緩めてPASSにしたものではありません。これらは合成符号の検証であり、音楽全般の聴感品質保証ではありません。

## 2. AAC側の修正

- `dist/streaming-audio.js`：`audioDecodeStart()`を追加。AAC-LC (`mp4a.40.2`)だけ、metadataから要求位置のpacketとその**実際の先行packet**を取得し、その時刻からデコードします。固定100ms等のprerollや全ファイル再デコードにはしません。PCM等の開始時刻は維持します。
- `AudioWindowReader.read()`と`dist/mobile-render-worker.js:audioRange()`が同じ関数を使用。返すPCM窓・元sample timestampは維持します。音量評価、Speed、B1〜B4には変更なし。
- `tests/aac-preroll.test.mjs`：両rate、先頭・途中・終端付近の実AAC metadata、PCM時刻の保持を検証。

HE-AAC等は今回の対象とせず、従来経路を維持します。多様な実録音encoderや不連続PTSに対して普遍的な保証をしたものではありません。

## 3. WebKit失敗を分離した結果

macOS Playwright WebKit26.5、実API/実Worker。APIの存在や`isConfigSupported`だけを成功根拠にしません。

| 段階 | 元の再現／追加調査 | 対応・現在の結果 |
|---|---|---|
| 保存領域の取得 | 一時contextの`navigator.storage.getDirectory()`自体がUnknownError。encoder生成前 | 通常の使い捨てpersistent profileでは取得・sync write・read成功。**試験環境制約**として分離 |
| Video/AudioEncoder初期化 | persistent profileで両方成功 | 実configureを確認 |
| 検証PCM encode | 成功 | 独立した最小AAC試験でも再現 |
| 校正用AAC decode | `InternalAudioDecoderCocoa decoding failed` | WebKit出力descriptionがASCではなく**ES_Descriptor全体**だった。構造解析でDecoderSpecificInfoのASC `1190`を取り出すと成功 |
| Video encodeの進行 | quality設定で9frame投入・出力0、有限queueの待機で次frame/flushへ到達せず | WebKitだけrealtime設定で進行。Chrome設定は保持。高遅延encoderとsourceの待機の組合せ |
| 実音声encode→mux | 最初の独立decodeで2秒のPCMが95744sampleとなり256不足 | WebKitのchunk timestampが入力区間ごとにresetするため末尾をpaddingと誤判定。連続入力を確認したうえで**packet durationのsample数の積算**から時計を作成 |
| MP4 mux・Blob/OPFS保存 | 上記修正後8出力で完了 | frame数/start/duration/終端マーカー保持。FFmpeg展開96768sample、96000有効sampleを包含 |
| 独立decode・品質 | **未合格の結果あり** | 次節。構造検証のverifiedを品質PASSとはしない |

ES_Descriptorは `03 … 04 … 05 02 11 90 …`。形式差をタグ・可変長・境界で検証して読み取り、任意のbyte検索やUAによるASC推測は行いません。Chromeの通常ASCはそのまま返します。native codec証拠（開発監査資料・配布対象外）。[WebCodecs AAC仕様](https://w3c.github.io/webcodecs/aac_codec_registration.html)のdescriptionはAudioSpecificConfigです。

修正：`dist/webkit-export-compat.js`の`aacDecoderConfig()/webkitVideoOptions()`、`dist/browser-audio-output.js`のmetadata処理・coded sample clock、workerのCanvasSource options。`tests/aac-decoder-config.test.mjs`と既存AAC sourceテストを追加・拡張しました。AAC delay値は引き続き**各encoder実測**です。WebKitも今回2112sampleでしたが、普遍値とは扱いません。

一時contextで動かないため、全データをメモリへ逃がすfallbackは追加していません。ADTS encodeはこのWebKit backendではunsupportedでしたが、アプリはraw AACを要求しており、ADTSへの切替は解決策として採用しません。

## 4. 公開を妨げる独立decodeの結果

**WebKit AudioContextでskipが重複する互換性問題を確認しました。** 各行で同じ出力ファイルを両decoderへ渡し、48kHz、0.5/1/1.5秒を相互相関で測定しました。さらに旧encode-muxだけを凍結した対照と新経路へ、全sampleが完全一致する編集済みPCMを渡して同じ差を再現しました（同条件対照（開発監査資料・配布対象外））。

| 出力ファイル | FFmpeg／Chrome AudioContext | WebKit AudioContext |
|---|---|---|
| Phase 1f以前の凍結旧経路 | +2112sample（44ms遅延） | 0sample |
| 保存してあるPhase 1fそのもののMP4 | 0sample | **−2112sample（44ms先行）** |
| Phase 1gのChrome／WebKit生成MP4 | 0sample | **−2112sample** |

新出力の先頭packetは−26112sample、edit list/skipは検証24000＋実測2112。FFmpegのdecoded96768sampleに対し、Chrome AudioContextは有効96000sample、WebKit AudioContextは94656sampleです。WebKitで追加の2112sample分が除外され、冒頭10msマーカーも失われます。**Phase 1fの正しいedit listとWebKit decodeAudioDataの追加priming処理が両立しない互換性退行**として扱います。今回のsource preroll修正が初めて作った差ではありません。新出力（開発監査資料・配布対象外）、凍結旧出力（開発監査資料・配布対象外）、Phase 1f出力（開発監査資料・配布対象外）

このdecoderに合わせてedit listを減らすと正常なFFmpeg/Chromeを壊すため、相殺offsetは追加していません。QuickTime/SafariのHTML media再生も同じ挙動と断定せず、**実アプリでは未検証**です。コンテナのpriming表現と各decode経路を、さらに区別して解決する必要があります。

**WebKitのnative AAC品質にも残件があります。** 8条件の整数相関peakは0sample、drift0、末尾不足は解消しましたが、48kHz AAC通常出力の10msマーカーはEncoder入力基準で相関0.786となり、0.8を下回りました。8条件の総合検査はFAILのままです。

生AACをADTS化してFFmpegでデコードし、検証/priming分を除くと、最終MP4のFFmpeg PCMと**全sample完全一致**しました。muxや追加encodeによる画質・音質変化ではなく、AAC encode以前／native codec段階へ局所化できます。生AACとの一致（開発監査資料・配布対象外）

素材デコードだけでもWebKitは40ms/44.1kHzの20ms点で相関約0.683、Chromeは同条件でほぼ1でした。prerollで改善しても完全一致にはなりません。native decoder/encoderの初期状態や圧縮特性のどれが残差を生むかは未確定で、一律の遅延補正では解決しません。低相関peakを根拠に「2ms内の同期を保証」とは記載しません。

## 5. 校正の安全性・追加負荷

実Chromeで校正decode波形をゼロへ差し替える失敗注入を実施しました。相関不足として中止し、OPFSの不完全出力は0件、同じcontextでの通常再試行は成功しました。模擬テストでも不正descriptor、相関不足、不一致delay、キャンセルを拒否します。安全中止（開発監査資料・配布対象外）

同じChromeの合成2秒audio-onlyを旧/新交互5組、最初の1組をwarm-upとして分離した4組の中央値：

| 測定 | 旧 | 校正方式 |
|---|---:|---:|
| wall time | 11.35ms | 24.35ms |
| Chrome process CPU合計 | 16.44ms | 29.00ms |
| 校正区間自体 | — | 13.50ms |

0.5秒は追加でencodeする**PCMの尺**であり、固定500ms待機ではありません。明示的な追加JS scratchは約329000byte（0.314MiB）。native codecの最高RSSは未測定で、総メモリ上限を保証する値ではありません。代表ファイル増分は4413byte。保持は短いPCM・packet窓のみで、全曲のPCMを溜めません。実機iPhone、実写rendererを含むend-to-end負荷は未確認です。測定（開発監査資料・配布対象外）

## 6. 試験結果・差分・次の条件

- 全**92 JS**、build、diff check：PASS。
- Chrome47条件219マーカー：Encoder入力基準でlag0/drift0。既存2ms維持。通常映像flashとの差は最大1.5ms。
- 同条件編集oracle11条件：PASS。従来の無加工source oracleは96kbpsの1条件FAILを保存。
- WebKit通常profileの8実MP4：生成・frame数・duration・終端保持を確認。波形/他decoderとの総合判定は**FAIL**。
- Chrome実8fpsタイムライン出力：PASS。clock精度・sample ownership維持。
- B1〜B4、Mac core/audio_engine、Feature Lab、text最適化02は開始時hashと一致。Mac非等速WSOLAには触れていません。今回Mac全試験・Mac ZIPは再実施していません。

A/Bのruntime＋関連testを別patchに保存しました：AAC preroll（開発監査資料・配布対象外）、WebKit export（開発監査資料・配布対象外）。どちらも正確なPhase 1f開始状態へ適用でき、両順序で現在のruntime/testへ一致することを検証済みです。npmの2本追加と調査QA/docsは共通の検証用差分です。scope監査（開発監査資料・配布対象外）

再現：`check-browser-av-sync.py prepare SERVED_DIR RESULT_DIR --reference`、HTTP配信、既存Node QA、Python verify。比較用は`PVE_REFERENCE_PCM=1`で同じNode QAを実行し、`check-aac-matched-reference.py RESULT_ROOT`で照合します。WebKitは`PVE_BROWSER=webkit PVE_PERSISTENT_PROFILE=使い捨て絶対パス`。native source捕捉は`check-aac-source-decode.mjs`、校正失敗は`check-browser-aac-abort.mjs`。全ログ・profile・合成素材・PCMは `/tmp/pve-aac-webkit/` に保存しました。既存素材・保存プロジェクトには触れていません。

**ChromeのA修正は採用候補、WebKitのB修正は未公開の互換性候補です。正式公開は不可を推奨します。** 次の条件は、(1) WebKit AudioContextの追加skipとedit listを正常な他decoderを壊さず両立させること、(2) WebKitのnative AAC冒頭/短尺品質差を説明・解消または明確に制限すること、(3) WebKit realtime映像設定の高詳細実写での品質比較、(4) Safari/QuickTime/iPhoneの実再生・末尾・負荷検証です。独立課題のMac非等速WSOLAと、正式公開前の全回帰/パッケージ検証も別途必要です。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
