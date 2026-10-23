# Phase 1i — MP4 AAC priming正式mux統合

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


## 実装前の方式選択

MediaBunny 1.56.0のvendored MP4 writerを対象に確認しました。A：公開APIのonMoovは出力後の通知で、構造を拡張するAPIではありません（[公式仕様](https://mediabunny.dev/guide/output-formats)）。C：完成ファイルの移動・再構成はOPFS/大容量/取消の危険と負担が増えるため採用しません。

**Bを採用**：stbl box tree生成点へ明示opt-inの限定hookを追加し、通常のbox writerへsgpd/sbgpを渡します。サイズ・reserve領域・stco/co64・mdat配置は既存muxerが計算し、後処理パッチやfree領域の手修正は行いません。AAC-LCのみを対象とし、最終packet数とアプリの投入成功数を独立照合します。vendor固定hash・再適用スクリプトで更新時の見落としを防止します。

以下の検証結果は作業完了時に確定します。

## 結果（2026-10-24）

**正式mux経路へ実装済みです。** Chrome/WebKitで各47条件、計94ファイルを新規出力し、FFmpeg・Chrome AudioContext・WebKit AudioContextの282比較／1314マーカーで位置ずれ・ドリフトとも0sampleでした。これは同じ最終AACの独立デコード比較です。音質評価や物理音声出力の2ms保証とは分けます。

**このmux修正は2.2.84の採用候補を推奨します。WebKit書き出し全体の正式採用・公開判断は保留です。** 後述の音質FAILと単発workerエラーを、今回の同期PASSで打ち消していません。versionは2.2.83、commit/push/公開なしです。

## 仕様と構造

Appleの[明示priming仕様](https://developer.apple.com/documentation/quicktime-file-format/using_track_structures_to_represent_encode_delay_explictly)と[具体例](https://developer.apple.com/la/documentation/quicktime-file-format/example_representing_encoder_delay_explicitly)に従います。roll distanceはPCMの遅延sample数ではなく、デコード復帰に必要な先行packetの距離です。現行AAC-LCとApple例・FFmpeg生成物に対応する−1を採用し、encoder delayから任意の距離を算出しません。

| box | 出力 |
|---|---|
| sgpd | version 1、grouping_type roll、default_length 2、entry_count 1、signed roll_distance −1 |
| sbgp | version 0、entry_count 1、sample_count＝実AAC packet数、group_description_index 1 |
| elst | 既存値を維持。media_time＝校正prefix＋そのencoderで実測したdelay |

両boxは計54byteです。AAC-LC（codec mp4a.40.2）の明示opt-in時だけ追加します。非AAC・対象外AACへ無条件に付与しません。fragmented MP4／MOVでこの拡張を使う場合は拒否します。本番は非fragmented MP4のreserve＋StreamTargetです。

既存のcanonicalなroll両groupは再利用し、重複、片方だけ、不一致、壊れたgroupを拒否します。他のgrouping typeは維持します。未知の同等表現を推測して書き換える処理はありません。

reserveでは、pending packetを移す前の0件treeでサイズを仮計測します。この段階と完成時を区別し、完成時の0件は拒否します。最終的に(1) mux内部のsample/stts数、(2) source.add成功数、(3) 完成ファイルのstszとsbgpを照合します。完成ファイルのelstも実測値と照合し、成功確定前に検査します。

## 変更ファイルと関数

| ファイル | 変更 |
|---|---|
| dist/mp4-aac-roll.js | appendAacRollGroups、AacPrimingMux、verifyAacPrimingFile。group生成・重複検査・完成ファイルの独立検査 |
| dist/vendor/mediabunny.mjs | stbl生成関数shへ1か所のhookとimportを追加。既存box writerへ渡す |
| dist/browser-audio-output.js | constructor/drainでsource.add成功packet数だけを計数 |
| dist/mobile-render-worker.js | renderでopt-in、確定時のpacket照合、完成Fileの構造検査を追加 |
| package.json | npm testへ新規構造テスト1入口を追加 |
| tests/mp4-priming.test.mjs | group、count、codec制限、破損、重複、elst、可変priming、bounded readを検証 |
| scripts/patch-mediabunny-priming.mjs／mediabunny-priming-patch.json | 既知artifact hashに限定した再適用。未知のvendor更新は拒否 |

追加QAはcheck-mp4-priming-{structure.py,stream.mjs,failures.mjs,cost.mjs,http.py}です。独立差分はintegration.patch（開発監査資料・配布対象外）。既存706ファイル中、変更した既存ファイルは上記のruntime3本とpackage.jsonだけです。逆変換で開始時hashへの一致を確認しました。scope監査（開発監査資料・配布対象外）

B1〜B4、Mac等速同期、AAC preroll、encoder遅延実測、PCM mix／envelope、text最適化02、Feature Labは保持しています。候補配信は既存の保留機能除外済み環境へ今回の4 distファイルだけを転記しました。

## 同期・品質・時計

- 44.1/48kHzのAAC/PCM入力、40ms/2秒/60秒、途中配置trim、split、複数レーン、envelope、連動音声、24/29.97/30/60fpsを含む94出力で構造検査PASS。出力音声は48kHzです。
- 独立デコード（開発監査資料・配布対象外）：282比較／1314マーカー、最大lag 0sample、drift 0sample、最小相関0.9999999999915。2ms基準は変更していません。
- 修正前と比較できる55出力（開発監査資料・配布対象外）でAAC packet全バイト、音声PTS/DTS/duration、映像時計、elstが一致しました。現在の実測delayは2112ですが固定化していません。1024sample primingのFFmpeg生成44.1/48kHzファイルも独立構造検査で受理する単体試験があります。
- 再エンコードなしのstream試験（開発監査資料・配布対象外）：40ms/2秒/60秒×reserve/false/in-memoryの9件で、AVC/AAC packetと時計を維持。EncodedPacketSourceだけを使い、encoderを起動していません。
- 全体の別実行同士では映像bitstream完全一致ではありません。合成映像55組のRGB比較（開発監査資料・配布対象外）はMAE最大0.02648でした。完全一致とは報告しません。mux単独の9試験では映像packetも同一で、追加の映像encode経路はありません。実写/HDRの全体画質比較は今回未実施です。
- 冒頭10ms・中間・終端直前マーカーを独立デコードで確認しました。2秒のFFmpeg/WebKit bufferは96768sample、Chromeは有効96000sampleです。余剰768とelst上の有効尺を区別し、paddingをドリフトとは数えません。

**音質の既知FAILは維持します。** 入力PCM／source基準（開発監査資料・配布対象外）ではChromeのEncoder入力基準47件はPASS、旧source基準は96kbpsの1件FAIL。WebKitはEncoder入力基準10件、source基準11件がFAILで、冒頭10msの相関約0.772〜0.799を含みます。低相関点の整数peakは0でも、信頼できる音質・同期PASSへ変更しません。今回のコンテナ解釈の一致でnative AAC音質改善を主張しません。

## OPFS、streaming、安全性、コスト

サイズ・reserve余白・stco/co64・mdat配置は元のwriterが計算します。stco/co64の選択処理は変更していません。書込み後にmoovやメディアを移動・置換しません。

verifyAacPrimingFileはbox headerと固定長fieldだけを読み、mdatを読み飛ばします。1回のreadは最大28byte。壊れたsize、重複moov/mdat、group不一致、sample数不一致などを検出し、既存の失敗経路へ戻します。hookが失われても旧同期不良方式へフォールバックしません。

Chrome（開発監査資料・配布対象外）／WebKit（開発監査資料・配布対象外）で各9件、計18件：count不一致、hook欠落、write失敗、flush失敗、完成group破損、完成box破損、途中cancel、確定時cancel、uncaught worker errorを注入。すべて成功通知なし、新規残留entry 0、正常再試行PASSでした。

WebKitには作業開始前のmtimeを持つ0byte entryが1件見えたため、削除せず名前・size・mtimeの不変を確認しました。初期QAはこれを新規漏れと誤判定し、差し替えコードのcacheも再試行へ混入していました。検証側だけにcache bustと開始時inventory差分を導入して修正しました。既存entryを消してPASSへ変えていません。検証上の注意（開発監査資料・配布対象外）

コスト測定（開発監査資料・配布対象外）：実Chrome OPFSの2秒Fileで、8回中初回を除く7回の中央値約6.9ms、37read／574byte、最大read 20byteでした。stream単独QAのchunk上限16KiB、本番既存値1MiBは維持しています。group追加は54byte/trackで、全動画をメモリ展開する処理は追加していません。CPU使用時間／peak RSSは未測定です。64bit box走査の論理4GiB超試験はありますが、実4GiB超動画の書き出し・co64実デコードは未検証です。

## 再生経路と残件

正式Chrome生成の同一MP4をSafari 27.0.1とQuickTime実アプリで開き、2秒の終端まで到達しました。UI観測（開発監査資料・配布対象外）。Safariはbyte-range対応配信で確認し、206応答（開発監査資料・配布対象外）を記録しました。SimpleHTTPServerの200応答だけを通常再生の根拠にしません。

Chrome/WebKit HTMLVideoElement→MediaElementAudioSourceの4再生は終端到達し、中間・終端のマーカー間隔を保持しました。ただしWebKitの10ms点を採取できない制約は残ります。これはPhase1hの標準FFmpeg出力でも再現した観測経路の残件です。Chrome生成物（開発監査資料・配布対象外）、WebKit生成物（開発監査資料・配布対象外）

**Safari/QuickTimeのUI再生、HTMLのJS時計、PCMの位置合わせ後の間隔を、物理出力まで含む2ms同期保証へ読み替えません。** iPhone実機、物理loopback、Safari実アプリAudioContextのsample精度は未検証です。

並行QA中、Chromeの最初の44.1kHz AAC長尺でworker.onerrorが1回発生しました。残り27条件の単独再試行は成功し、最終47件は揃いましたが、原因・再現性は未確定です。mux由来か資源競合かを断定せず、失敗ログを保存しています。注入試験でworker異常時の後始末は確認しましたが、実際の単発エラーの解消とは扱いません。

## 回帰結果と採用判断

- npm test：93入口（B1〜B4関連の入れ子試験を含む）PASS。
- npm run build、局所構造／stream試験、独立decoder検査PASS。
- Mac等速音画44条件PASS、最大誤差1sample。B4出力時計32条件・10bit gradient等PASS、時計補正目的の追加encodeなし。native音声（開発監査資料・配布対象外）、native時計（開発監査資料・配布対象外）
- バージョン／依存version／Macエンジン／保存処理／Speed／UI／rendererは変更していません。Macパッケージ実機動作は今回未検証です。

**標準priming muxの限定変更として採用候補にできます。再統合検証へ進めますが、正式公開は推奨しません。** 条件はWebKit native音質の残件、長尺workerエラーの切り分け、実機の冒頭・末尾／同期確認、既存の公開前全回帰です。Mac非等速WSOLAは別課題のままです。

再現方法はevidence README（開発監査資料・配布対象外）。全PCM、校正入力、長尺素材、profile、長いログは `/tmp/pve-priming-integration/` に保存しています。調査用Phase1hのfree書換えfixtureと、本番box-tree実装を区別しています。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
