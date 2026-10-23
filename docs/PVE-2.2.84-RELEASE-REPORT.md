# PVE 2.2.84 リリース報告

状態：**隔離候補の必須検証完了／公開承認待ち**。push・tag・Pages更新・Mac配布物公開は未実施です。公開後の成功を先取りしていません。

## 対象と保全

公開remote `https://github.com/shingoviva/personal-video-editor-responsive.git` のmainを確認。基準SHA `9b2f10aeb573e237b85fef4a0fb0d533e5ccd28d`。独立クローンの `release/pve-2.2.84` へ明示的に選別しました。元作業ツリーはreset／clean／差分破棄をせず保護しています。

B1〜B4、Mac等速同期、AAC encoder delay実測、素材preroll、WebKit codec互換性、MP4 roll group正式muxを採用。text02／Feature Lab／未採用実験／新Speed／WSOLA代替／研究用free領域書換え処理／私的素材／生成PCM／大容量ログは除外します。選別ファイル・元hashは[selection manifest](PVE-2.2.84-SELECTION.json)。同じapp.jsの14 hunkをB1/B3/B4として確認し、packageは公開mainから4回帰入口だけを追加しました。

版番号更新前のPhase1j runtimeと、版番号・cache queryを除いて106ソースが一致しています。依存ライブラリMediaBunnyは1.56.0を維持。研究用のMP4修復処理は本番にも検証ソースにも含めず、読み取り専用parserと正式出力だけを比較します。小さなCI用合成MP4 golden4本はtests/fixtures/mp4へ明示保存します。

## バージョン・配信

package／lock／UI／Python health build／cache queryを2.2.84へ統一。ローカルJS・Workerの全依存参照へ同じqueryを付与し、84の新規／再読込セッションで古い裸URLの依存混在を防ぎます。開いたままの旧版タブは保存・退避後に再読込してください。[cache manifest](PVE-2.2.84-CACHE-MANIFEST.json)。Service Workerの追加はありません。buildで現行識別子と200参照、Lab除外、vendor pin・再適用・未知版での停止を検査します。

Pagesは既存の手動 `Publish GitHub Pages` workflow。公開URLは `https://shingoviva.com/personal-video-editor-responsive/`。workflowがdistと生成Mac ZIPを配信します。既存GitHub Releasesは確認時0件で、新しいRelease方式やSites公開を無断追加しません。Mac ZIPは既存名 `dist/personal-video-editor-mac.zip` を維持し、内部表示を2.2.84へ更新します。

## 検証結果

[検証集計](PVE-2.2.84-VALIDATION.json)。すべて実際の2.2.84隔離候補で新規実行しました。

| 検証 | 結果 |
|---|---|
| 全JS／build | 93入口PASS。static／現行version／200 JS・Worker参照／vendor pin再適用もPASS |
| Python／FFmpeg／HTTP | 29本PASS。旧30本のうち研究用free領域fixture試験だけ除外し、正式group・破損・重複等はJS／独立出力検査で維持 |
| B1〜B4実操作 | Chrome/WebKitの保存復元・Undo/Redo・hold・多点・8fps・export・OPFS失敗・再試行PASS |
| Mac等速／B4時計 | 等速44条件最大1sample、時計32条件／10bit／画素・frame順／追加時計encodeなしPASS |
| 実写transition | 全既存24比較PASS。preview dissolve +0.2秒MAE 3.138（基準<9維持） |
| 正式ブラウザMP4 | Chrome47＋WebKit47。構造・elst・packet数PASS、282比較／1314markerでlag/drift0sample |
| 異常／cancel／再試行 | Chrome9＋WebKit9 PASS、成功誤通知・新規残留なし |
| 配信cache | Chrome/WebKit UIで各86 moduleがHTTP200／v2.2.84、pageerrorなし。Worker依存は静的200参照と実94出力で確認 |

既存品質診断はChrome source1件、WebKit Encoder入力10件／source11件のFAILをそのまま保存。元の相関／2ms基準は変更せず、Phase1jとの比較で新しい不合格や悪化なしを確認しました。これを音質全条件PASSへ読み替えません。Mac非等速も既知制約のままです。初回の版番号固定assert、QA出力フォルダ未作成は候補の検証・環境設定中に解消し、最終必須suiteは全件成功しました。

Mac ZIPを最終資料へ合わせて再生成し、CRC・全収録ファイルの候補とのbyte一致・Launch0755／shell・不要物除外・正式golden fixture・標準展開後のpriming単体／HTTPを確認しました。配布監査で見つかった過去の小ログ2本はZIPから除外。最終ZIPのSHA256・収録数は外部監査ファイルと停止点報告へ記録します。

ユーザーから、Macの保存／復元／代表出力、Chromeの出力／cancel／retry、iPhone/Safariの保存／出力／再生は受入済みと申告されています。これはユーザー実機結果であり、今回のagent自動試験や物理2ms測定とは区別します。新候補の機能差は安定化修正の選別と現行version／cache識別子に限定します。

## 制約とproject互換性

[ユーザー向けリリースノート](PVE-2.2.84-RELEASE-NOTES.md)を参照。Mac非等速WSOLA、WebKit native AAC品質差／bitrate設定効果、過去の単発長尺worker、素材再コピー世代の残存は未解決として保持します。既知P1/P2を解決済みとはせず、条件を明示します。旧版ではhold境界や256点超の情報を保持できないため、更新前projectと素材を別名backupしてください。

## 公開前停止点・公開後検査

候補commitは全検証・監査後にローカルで作成し、SHAを最終報告と監査ファイルへ記録します。その時点でユーザーへ承認を求めます。承認前はremote main／Pages／tag／Mac公開物を変更しません。

承認後もmainが基準SHAのままか再確認し、fast-forward pushだけを実行。Validate完了後、同じSHAでPages workflow_dispatch。実公開のindex／style／app／Worker／vendor／helperの版番号・依存URL・読み込みを検査し、専用ブラウザcontextで起動／保存復元／代表出力を確認します。配布ZIPはdownload→CRC／内部version／ソースhash／Launch／不要ファイルを確認します。GitHub生成ZIPは時刻metadataが異なる可能性があるため、外側のbyte同一性だけでソース同一を判定しません。失敗を成功扱いしません。

## rollback

既存project・素材・新世代ファイルを先に別名退避します。承認を得た復旧操作として、公開mainへrelease commitのrevertを積み、必要な検証後に既存Pages workflowで戻します。force push・データ削除・新形式projectの旧版上書きは禁止。緊急に旧buildを再配信する場合も、既存workflow／保存済み2.2.83配布物の承認された手順を使い、mainとの差を報告します。アプリを旧版へ戻すことと、projectのデータ互換性は別です。
