# PVE 2.2.84 公開前残課題評価（Phase 1j）

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


2026-10-24。**通常の等速経路について、再現中のP0は確認していません。Mac等速／Chromeは条件付き公開候補、WebKitも全経路を一律停止する根拠は不足しています。全環境・全条件の納品品質を保証する公開は非推奨です。** 後述の制約明示と最小実機確認を条件に、2.2.84の限定的な安定化公開を推奨します。今回は未公開、version 2.2.83、commit／push／deployなしです。

判断基準は[Product Vision](PVE-PRODUCT-VISION.md)。以前の[統合検証](PVE-2.2.84-RELEASE-READINESS.md)のB4再encode・等速音声・Chrome遅延・Apple primingのブロッカーは、後続修正と今回の再試験で更新します。過去報告を上書きして失敗を隠しません。

## 1. 候補と統合結果（確認済み）

main/HEAD `9b2f10aeb573e237b85fef4a0fb0d533e5ccd28d`。開始時点757ファイルをhash保全し、**本フェーズで既存ファイル・アプリ本体の変更はありません**。調査QA・証拠・本報告だけを追加しました。差分保全（開発監査資料・配布対象外）

使い捨て候補 `/tmp/pve-final-readiness/candidate` でtext最適化02のruntime／test／architectureを公開HEADへ戻し、Lab本体・setup・test・package entry・関連.gitignore変更を除外。元作業は保持しています。候補範囲（開発監査資料・配布対象外）

| 検証 | 最終結果・範囲 |
|---|---|
| 全JavaScript／build | 元作業環境と除外済み候補のnpm test 93入口PASS。候補build PASS。B2/B3/B4の入れ子試験を含む |
| Python／FFmpeg／HTTP | 30本PASS（CI24本、B2/B3/B4・spatial・priming fixture・実写QAを含む）。引数付き3本の初回呼出しミスと正しい再実行を併記 |
| Macパッケージ | ZIP生成、CRC、主要11ファイルの候補とのbyte一致、Lab・実素材除外、textは公開HEAD、Launch属性0755／shell構文、展開先HTTP PASS。GUI起動・実聴は未実施 |
| B1保存／復元 | Chrome実OPFSの失敗・再試行・複数タブ、素材hash、失敗時project／manifest参照保持PASS。20回再コピー＝20世代20MiB、通常上書き20回で追加0。素材1MiBに対し未参照19MiBを保持。自動整理なし |
| B2/B3 | 実Chrome/WebKit編集・Undo/Redo／復元PASS。native B2 264ケース・6,227,896サンプル差0。B3 254〜1026点、最大PCM誤差4.47×10⁻⁸、失敗cleanup PASS |
| B4 | 8fps実操作／保存復元・Chrome出力PASS。native厳密PTS誤差0、表示丸め最大0.3334µs。Mac時計32条件、10bit gradient、追加時計encodeなしPASS |
| 実写transition | 既存QA全体PASS。問題だったpreview dissolve +0.2秒 MAE **3.138**、元の基準9未満を維持。以前の77.517 FAILを解消した経路を再確認 |
| Mac等速音声 | H.264/AAC・ProRes/PCMを含む44条件PASS、最大1sample。非等速は別途FAILを記録 |
| ブラウザ正式MP4 | Chrome47＋WebKit47を新規出力。sgpd/sbgp／elst／packet数PASS。FFmpeg・Chrome・WebKit **282比較／1314マーカー、最大lag／drift 0sample** |
| 取消／異常／再試行 | Chrome9＋単独WebKit9注入PASS。成功誤通知なし、新規残留0、正常再試行PASS |
| HTMLVideoElement | Chrome／WebKit生成2ファイル×両再生エンジン＝4件、終端到達。中間・末尾の間隔保持。WebKitの10ms点は採取できない観測残件あり（Phase1hの標準FFmpeg対照でも同じ）。物理2msや冒頭の実聴保証ではない |

全試験（開発監査資料・配布対象外）、独立デコード（開発監査資料・配布対象外）、保存（開発監査資料・配布対象外）、世代増加（開発監査資料・配布対象外）、Mac ZIP（開発監査資料・配布対象外）。条件付きの音質FAILをこの表の同期PASSで相殺しません。

## 2. WebKit AAC品質の切り分け

**素材デコードと出力エンコードの両方に、別の波形差があります。muxの時刻ずれとは分離できました。**

### 素材デコード：PNSによる非同一波形

合成の声／打撃音、44.1／48kHz、2秒、96／192kbpsのAACでPNS（知覚的雑音置換）有無を対照にしました。PVEのnative WebCodecs素材デコードとFFmpegの比較です。

| 比較 | 全尺SNR |
|---|---:|
| Chrome、PNS有効 | 140.73〜143.87dB |
| WebKit、PNS有効 | **9.61〜28.52dB** |
| WebKit、PNS無効 | **136.47〜138.62dB** |

PNSだけを無効にした対照で差がほぼ消え、PNS有効の帯域別エネルギー差は最大0.117dBでした。中間0.1〜1.99秒にも波形差があり、冒頭だけの欠落ではありません。**PNSを含むAACに対して、異なるnative decoderの波形完全一致を前提にしない**と判断します。聴感上同一という証明ではありません。対照56比較（開発監査資料・配布対象外）

補足：調査用のaudio-only M4A 16件はWebKit AudioContextでDecoding failedでしたが、同じファイルのPVE WebCodecs素材デコードは成功しました。正式PVE MP4の12ファイル×2 AudioContextは成功し、FFmpegとの差はSNR133.88dB以上。このM4A限定のAudioContext失敗を、PVE出力再生不能やPVE素材取込失敗とは扱いません。一般M4A互換性の原因追究は今回拡大していません。

### 出力エンコード：低相関は残るが通常音全体の破綻は未確認

新たに音楽に近い和音、声に近い有声音＋摩擦音、打撃音を生成。AAC／PCM入力×44.1／48kHz×40ms／2秒×96／192kbps、各48出力を両エンジンで比較しました。元AACのPCM、native素材PCM、実際のEncoder入力、独立FFmpeg最終PCMを分離しています。PCM入力24対では、Chrome／WebKitへ渡る実Encoder入力が全sample完全一致しました（入力比較（開発監査資料・配布対象外））。この同一入力から出る差はmix／declickの差ではありません。

| 補助指標（96出力） | Chrome | WebKit |
|---|---:|---:|
| Encoder入力→最終、全尺SNR範囲 | 7.33〜45.44dB | 7.63〜37.89dB |
| 音楽／声／打撃音別の最小全尺相関 | .99987／.90286／.98233 | .99978／.90981／.98352 |
| 冒頭10ms RMS比の範囲 | .909〜1.013 | .929〜1.011 |
| 終端10ms RMS比の範囲 | .914〜1.029 | .927〜1.025 |
| 冒頭・中間・終端の局所lag | すべて0sample | すべて0sample |

有効尺を下回るPCMや丸ごと消えた冒頭／末尾は今回検出していません。両方に圧縮による変化があり、低ビットレートの広帯域摩擦音ではSNRが低下します。これは補助指標であり、音質合格の新基準ではありません。実録音や制作者による聴取評価は未実施です。96出力の数値（開発監査資料・配布対象外）

既存マーカー基準は変更なし：Chrome Encoder入力47件PASS／source基準1件FAIL。WebKit Encoder入力10件／source11件FAIL（冒頭10msの相関約.772〜.799、整数peak 0）。独立decoder同士の一致、PCM入力でも出る差、Phase1iの既存AAC packet一致から、**残るEncoder入力→最終の差はnative AACの圧縮経路にあり、priming muxで生じたずれではありません**。低相関点の位置を高信頼な同期PASSへ読み替えません。Chrome（開発監査資料・配布対象外）、WebKit（開発監査資料・配布対象外）

アプリ側の固定補正・波形加工・黙ったencoder切替は推奨しません。さらにWebKitでは、PCM入力12対すべてで要求96／192kbpsのAAC packetが同一でした（Chromeは全12対で異なる）。**WebKitで設定値を上げれば改善するという回避策は現時点で示せません。** 現行[WebKit上流実装](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/AudioEncoderCocoa.cpp)は設定bitrateをconverterへ渡しますが、今回の実行buildとの完全一致やbackend内部の理由は未確定です。packet比較（開発監査資料・配布対象外）

## 3. Chrome workerの再現性

元と同じ44.1kHz AAC・60秒・96×54合成映像・High・30fpsを使用しました。単独3連続＋freshを2回＝8成功、Chrome2件＋WebKit1件の並行ではChrome2／WebKit1成功。別の初期並行試験のWebKit1成功も含め、記録済み12出力でproject不変・新規OPFS残留なし。今回の47条件matrixのChrome長尺も成功しました。

workerのerror／unhandledrejection、親ErrorEventのmessage／filename／line、encoder configure／flushのqueue・state、storage quota／usage、取得可能なJS heapを記録。成功経路にcodec errorや容量不足はなく、観測quotaは最低約10GiB、usage最大1MiB。Chromeの観測JS heapは約4.1MB以下ですが、**worker／codec／GPUのpeak RSSではありません**。

初期並行ではworker生成前のmodule取得が `ERR_CONNECTION_RESET` で失敗しました。同じ単独条件は通り、QA HTTPの受付queueを5から128へした並行試験は全件成功。**配信環境由来の失敗を実測できましたが、Phase1iのworker.onerror単発と同一原因とは断定できません。元のworker異常は再現せず、解決済みとはしません。** エラー／cancelの区別と再試行は別の18注入で確認しました。

反復1（開発監査資料・配布対象外）、反復2（開発監査資料・配布対象外）、並行（開発監査資料・配布対象外）、Chrome後始末（開発監査資料・配布対象外）、WebKit後始末（開発監査資料・配布対象外）。今回の小解像度60秒を、4K長尺のメモリ耐性試験とは扱いません。

検証上の訂正：最初のWebKit後始末試験は同originの別matrixと並行し、他の正常書き出し16ファイルを残留と誤判定しました。全16名をmatrix成功結果へ対応付け、並行書込み終了後の単独9試験でPASSを確認。元FAILも保存しました。QA分離の証拠（開発監査資料・配布対象外）

## 4. 経路別の公開判断（推奨）

| 経路 | 推奨と条件 | 回避策・失うもの |
|---|---|---|
| A Mac FFmpeg | 等速音声のH.264/AAC・ProRes/PCMは公開候補合格。B4 copy concatと画質維持を再確認 | 元音声を非等速化する案件は下記WSOLA制約。PCMを選んでも非等速ずれは回避できない |
| B Chromeブラウザ | 等速H.264/AACは条件付き公開可。長尺単発異常は監視継続。失敗は再試行し、完成通知／独立再生を確認 | 高精度な最終音声／映像はMac出力を選択可能。ブラウザはProRes等のMac品質出力を代替しない |
| C Safari/WebKitブラウザ | 正式MP4のpriming方式は採用可。書き出し全体はnative AACの差を明示し、実機で試聴した範囲の利用に限定。無条件の納品品質保証は不可 | 重要な原音・極短いSFXは元音と比較し、必要ならMacで仕上げ。iPhoneだけの制作ではMacへの引継ぎが必要になる |

WebKitの全書き出しを一時無効化すると、iPhone利用者は端末だけでMP4を完成・保存する手段を失います。通常の再生不能・重大破綻は再現しておらず、今回はこの制限を推奨しません。機能削除・自動mute・設定変更・警告UIの追加は行っていません。

公開時には最低限「Macで速度変更した原音は同期制約あり／Safari系AACは端末依存の音質差があるため重要音声は比較試聴／長尺失敗時は編集を保持して再試行／未参照素材世代は自動削除しない」を利用者へ明示してください。

## 5. 残るP0／P1／P2

| 優先 | 条件・影響 | 今回の判断／対応 |
|---|---|---|
| P0 | 通常等速経路のデータ消失・再生不能・重大AV破綻 | **現在の再現事象なし**。今後これらを再現した経路は公開停止。未検証をPASSにもP0にも自動分類しない |
| P1 | Mac非等速WSOLA | 0.5／1.25／2倍、44.1／48k、AAC／PCM入力、H.264／ProRes出力24条件すべて2ms基準未達。個々のmarker先行0.333〜44.104ms。音楽を等速別レーンに置き、非等速クリップ原音をmuteする回避策。ただし速度変更した台詞・環境音・打撃音を失うため無断適用しない。PCM出力だけでは解決しない |
| P1 | WebKit native AACの低相関・設定効果 | 冒頭符号、極短音、圧縮条件で波形差。素材PNS差は冒頭外にもある。今回の通常音に重大欠落は未検出だが聴感未承認。重要音声は比較試聴、必要ならMac。次はnative bitrate／モードの限定試験と実録音聴取 |
| P1 | Chrome長尺worker単発異常 | 原因未確定・worker内では未再現。今回bounded反復・並行・後始末は成功。無制限stressはせず、次回は詳細ErrorEvent／通信ログを保存。通常単独でも再現するなら昇格 |
| P1・公開条件 | Safari／iPhone実機の採否 | Playwright WKを実機PASSとしない。下記の短い実機受入で音・保存・書き出しが不良ならCを止める。A/Bまで一律停止しない |
| P2 | B1旧世代のディスク増加 | 新世代で既存データ保護を優先。通常保存では増えない。空き容量を確保し、安全な参照付き整理を次版へ。ユーザー素材を削除して回避しない |
| P2 | 容量／性能／特殊互換性 | 実4GiB超・co64動画、4K長尺peak RSS、実写HDR、物理loopback、WebKit realtime映像品質の追加承認、audio-only M4AのAudioContext挙動。保証範囲を限定し、実害の再現時に再分類 |

非等速再測定FAIL（開発監査資料・配布対象外）。既存の同期2ms・相関.8・実写MAE基準は変更していません。

## 6. 公開へ含めるもの／除外

含める候補：B1保存世代保護、B2 hold境界、B3点数保持、B4有理数編集時間・copy concat時計、Mac等速anull、Phase1f encoder delay実測、Phase1g source AAC preroll／WebKit codec整合、Phase1i正式roll groups＋独立完成検査と対応回帰。今回のQA／報告は開発資料です。

除外：text最適化02、Feature Lab、研究用free書換えを本番処理に使うこと、未知の固定offset、WSOLA新方式、Speed新機能。元差分は全hash保持。候補は未更新2.2.83表記の検証物で、完成した2.2.84配布物ではありません。後の公開許可時にはversion／cache-bustingを揃え、同じ選別差分で公開前チェックを行います。

## 7. 公開前の最小実機確認と最終判断

1. **Mac**：既存projectを別名backup→保存／再読込／素材再リンク。代表30秒（実写transition・色・テロップ・等速音楽／声）をH.264とProResで出し、QuickTimeで冒頭・中間・末尾と音を確認。
2. **Chrome**：同じ代表区間を2回書き出し、途中cancel→正常再試行。完成MP4を独立再生。単独でもworker異常が再発するならBの公開判定を戻す。
3. **Safari／iPhone 16 Pro**：端末上で保存復元→同区間を出力して通常再生。冒頭／終端の短いSFX、声、音楽を同じ音量の原音と比較試聴。重要音が欠落・明瞭に破綻・再生不能ならCは公開しない。

これらは短い制作受入です。物理スピーカー出力まで「2ms以内」を保証すると表明する場合は、別途loopback／外部収録が必要です。UI時計や聴取だけでその数値を承認しません。Phase1iのSafari／QuickTime実アプリ2秒終端再生は既存証拠として維持しますが、今回新たに実機音質承認したとは記載しません。

**結論：P0を理由に全経路を一律HOLDする状態から、経路を限定した条件付き公開判断へ進めます。上記の制約明示と最小実機確認が済めば2.2.84の安定化公開を推奨します。現状のまま「全環境・非等速を含む納品品質保証」として公開することは推奨しません。** 実機確認待ちを無期限の研究課題へ広げず、失敗した経路だけを再評価します。

再現とログ：証拠README（開発監査資料・配布対象外）。全PCM／長尺／使い捨て候補は `/tmp/pve-final-readiness/`。ユーザー素材・既存projectの変更、version更新、commit、push、deployは行っていません。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
