# PVE 2.2.85 — 公開前リリース報告

## 1. 候補の識別と停止点

- 公開基準main：`901ac235dbb6d272a086e4e0d1f163176bdcf862`（2.2.84）。開始時remoteの同SHAを確認。
- 独立clone：`.codex-context/releases/pve-2.2.85`、branch `release/pve-2.2.85`。
- 最終release commitは `git rev-parse release/pve-2.2.85` で特定します。SHAをcommit自身へ埋める自己参照を避け、確定SHA入りの本報告とreceiptをリポジトリ外の `../pve-2.2.85-audit/` に保存します。
- **公開前停止**：remote push・Pages・公開ZIP差し替え・tagは未実施。最終承認が必要です。

## 2. 採用・除外

Phase2b manifestの40ファイルとruntime hashを照合して取り込みました。FX合計400／非flash100の統一容量検査、Ctrl/Alt群複製、共通delta/track/空白、独立ID・設定・linked audio、素材共有、1Undo/Redo、Esc取消、overlay DOM/結合再利用、形式2保護を採用します。大規模な改修や新機能はありません。

text最適化02、Feature Lab、未採用Speed/WSOLA、研究用MP4補修、QA生成動画/PCM/profile/大容量ログ、私的素材は除外。公開84から変更しないtext-render本体と音声/mux/時間処理を保ちます。MediaBunny vendorはcache query1箇所だけの変更です。公開対象の全変更ファイルとruntime hashは `PVE-2.2.85-FILES.json` に記録します。

## 3. version/cache

package/lock、UI、Mac build、診断のappVersion、JS/Worker/動的import・CSS queryを2.2.85へ統一。既存build検査で205参照・依存pin・Lab除外を確認。版更新直後は旧世代固定のUI検査とvendor hash pinが失敗したため、変更がqueryだけであることをbyte比較してテストの版表記とpinを更新しました。判定基準を緩めず、既知artifact以外の拒否・再適用・冪等性の試験も成功しました。過去資料と旧2.2.84の互換警告は維持します。

## 4. 最終検証

全JavaScript96 entrypoint、`npm run build`が成功。さらに38検証コマンド（局所2、実UI、性能、30秒browser/Mac、独立decode、旧版互換、B3 fixture、Python/FFmpeg/HTTP29 suite）すべてexit0です。B1保存失敗/再試行、B2hold境界、B3多数点、B4有理fps/出力時計、Mac等速44条件（最大1sample）、H.264/AAC・ProRes/PCM/10bit、標準transition、MP4 priming、失敗/取消を含みます。私的実写素材専用QAは再利用せず、標準transitionと30秒合成projectを検証しました。

実ページのUI資産は2.2.85、Chrome/WebKit各89moduleすべてHTTP200・query85・pageerror0。Workerを含む205依存参照もbuildで一致確認しました。

実Chrome/macOS WebKitでは2〜200群Ctrl/Alt、混在V/A/T/FX・linked audio、ghost中無変更、Esc、複製確定/反復、通常移動・単一操作、Undo/Redo、100/200/400保存再読込・超過全体拒否を確認しました。旧形式1読込と、実公開84の形式2拒否・開いているproject無変更も確認しました。

実iPhoneの最終操作確認はユーザーが行います。WebKitの結果をiPhone実機PASSとは扱いません。

## 5. 性能と出力

400 FXの再描画中央値はPhase2b Chrome8.90ms→RC9.35ms（最大10.7ms）、WebKit17→18ms（最大20ms）。同一fixture/viewport、各10回、差は約5〜6%で大きな悪化は見られません。公開版からの改善を維持しています。全操作・全端末の速度保証ではありません。

Phase2bと同じ30秒/720pの合成project（flash200+fade、TEXT3、映像6、music/hold）を実File入力から保存・復元し、Chrome2.307秒、WebKit12.456秒、Mac94.290秒で出力。MacはPhase2b93.099秒との単一比較で約1.3%増、深い性能改善は行っていません。

全出力900frame/30秒、PTS最大誤差0.334µs、6出力×6マーカー=36点の整数位置差0sample。2ms基準を維持。AAC packet/group/elstと実測priming、冒頭・終端markerを検査。前後PCMはChrome/WebKit/Macすべて完全一致し、Chrome/Macの全デコード映像も一致しました。

WebKit映像は非bit-exactでした。900frameのSSIM平均0.99431/最小0.98327。同じRCの再出力でも平均0.99457/最小0.98327で、同程度の差が生じました。render/encoder/muxコードは版query以外不変、projectの配置・設定も同じです。版更新による明確な退行を示す証拠はありませんが、native encoder/実行時のどこで変動するかは未確定です。この補助指標に新しい合否閾値を設けず、完全一致PASSに置き換えません。実iPhoneの実素材映像/重要音声はユーザー受入項目に残します。

素材解析待ち、Mac出力の既存コスト、初回起動のばらつきは継続課題です。今回は深い最適化を行いません。ROADMAPに「機能成立→実制作で使える状態→機能群完成後の本格最適化」を記録し、無駄を増やさない設計と重大な性能回帰検出は全段階で継続します。

## 6. project互換性と配布

形式1の読込を維持。FX100超はBrowser/folder/Macで形式2へ保存し、旧84の読込拒否で切り捨てを防ぎます。形式2を100以下に減らしても保護を残します。更新前の別名backupを必ず残し、旧タブ/Macアプリを閉じてから更新してください。開きっぱなしの旧版自動保存をこの形式識別だけで止めることはできません。

`dist/personal-video-editor-mac.zip` を2.2.85として生成。408entries、約12.75MB。CRC、全payloadと候補sourceの一致、Launch0755、package/lock/build、85ノート/報告/一覧、許可済みの既存小fixture5本のみを確認。標準`ditto`展開後のoverlay JS・HTTP保存/出力/download試験も成功しました。QA生成movie/PCM/profile/logは収録しません。最終ZIPのSHA256は外部receiptに記録し、自己hashをZIP内へ埋めません。

完成したユーザー向け説明は `PVE-2.2.85-RELEASE-NOTES.md`。配布内の以前のNEXT文書はPhase2b時点の履歴で、現行の正本はこの報告・85ノート・85一覧です。

## 7. 保全・既知制限・判断

元Phase2b採用40ファイル、Phase2a442ファイル、旧作業ツリー846ファイル・HEAD/index hashが開始時と一致。公開済みcloneも変更せず、保留差分を保持します。

継続する制限：Mac非等速原音WSOLA同期、WebKit native AAC品質差、素材コピーの旧世代残存。物理音画ループバック、実iPhone/Safari、4GB超の実ファイル、長尺4K/全HDRは未検証。これらを新規PASSに変更しません。通常の制作を妨げる新規の重大なデータ/映像/音声回帰が出た場合は公開停止します。

**推奨：2.2.85として公開準備完了です。** 新規の重大なデータ/音声/時計回帰は再現していません。WebKit映像の再出力ばらつきは上記のまま記録し、完全一致の保証はしません。ユーザーによる実iPhoneの最小受入（backup後の読込、FX pattern複製/取消、保存再読込、短い実素材出力・音画確認）と最終承認を待ちます。現時点では未公開です。

## 8. 承認後の公開とrollback

承認後、remote mainを再取得して基準と祖先関係を確認。候補の通常fast-forward push→Validate成功→同SHAの既存Pages workflow_dispatch→実公開UI/module/cache/ZIPのSHAと展開を確認します。進んだmainへ無条件push・force pushはしません。既存の別Sites更新やtag追加は行いません。

rollbackはproject/素材/新形式を別名退避し、承認したrelease revertを通常pushして同じ検証/Pages手順を実施します。旧84は形式2を開けないため、更新前backupで再開します。保存データ削除やversionフィールドの手編集は行いません。
