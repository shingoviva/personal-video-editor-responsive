# Phase 2b — 次版候補の準備（検証完了・未公開）

基準は公開2.2.84 `901ac235dbb6d272a086e4e0d1f163176bdcf862`。Phase 2aの未commit差分を丸ごと保全し、独立clone `development/phase2b` に引き継ぎました。アプリ版番号は2.2.84のままです。以下は次版**2.2.85を提案するソース候補**で、version更新・commit・push・tag・deployは行いません。

## 1. 採用範囲と性能設計

Phase 2aのFX合計400/非flash100、Ctrl/Altによる群複製、新ID・共通delta・所属track保持・deep clone・連動音声・1Undo/Redo・取消を維持します。今回の追加は次の2件です。

- **同じoverlayのDOM/操作結合を再利用**：`overlay-track-view.js`がtrackごとに最後のmarkup、item参照、geometryを1組だけ保持します。選択表示は別更新。変更されたtrack、Undo/読込の新item参照、item DOMの欠落は更新します。resize/fps変更は操作結合を更新します。古いitemを操作するcacheは採用しません。
- **FX100超の旧版保護**：project形式2で保存します。旧2.2.84の厳密なversion検査により、切り捨てる前に読み込み拒否となります。新loaderとMac API/engineは形式1/2を受け入れます。UI/autosave、フォルダmanifest、browser snapshot、Mac保存で形式2に揃えます。

計算/メモリ/I/Oの増分：各trackのitem同一性とDOM個数をO(n)で検査し、既存のmarkup生成自体は残します。WeakMapは表示3track分だけで、履歴やglobalな無限cacheはありません。markup文字列と参照配列が追加メモリとなります。安定時のDOM解析・イベント再結合を省き、保存回数・素材コピー・音声/映像encodeは増やしません。形式識別の変更はeffects.lengthの検査と整数1個だけです。

初回試作はlane resizeの補助要素まで数えてcacheが毎回missになりました。実clip数だけを検査するよう修正し、補助要素の局所回帰を追加しました。この試作の結果を最終改善率には使いません。

## 2. 同条件性能比較

単位ms、再描画は10回の中央値。Phase 2a→今回候補：

|経路|100 FX|200 FX|400 FX|400 FX最大（今回）|
|---|---:|---:|---:|---:|
|Chrome|7.90→4.20|13.45→5.45|30.65→8.90|11.1|
|WebKit|15→9|22→11.5|38→17|19|

公開2.2.84の同条件中央値はChrome100/200/400で7.70/13.05/32.10ms、WebKit14/21/37msでした。Phase2a開始状態は公開版と近く、今回の省略効果を確認できます。

400 FXのWebKitは従来overlay再結合13.3ms・HTML更新3.1msが、内容不変時には各0となりました。音声timeline描画等は残ります。17msは60Hzの1frame予算を少し超えるため、全端末で快適とは保証しません。

選択中央値はChrome400で1.65→1.70ms、WebKit400は3→3ms。WebKit100のみ1→1.5ms（絶対差0.5ms、時計分解能・少数標本の影響があるため改善とは扱わない）。スクロール最大はChrome400で39.9→43.6ms、WebKit400で25→22msです。

100個の実ドラッグ自動操作1回では、Chromeドラッグ556→539ms、確定28.67→29.08ms、Undo102→96.6ms、Redo88.8→89.8ms。WebKitは143→132ms、確定50.47→46.22ms、Undo85.8→89.4ms、Redo67.6→66.6ms。IPCや待機を含み、連続操作全体の性能保証には使いません。

Chrome heapスナップショット400 FXは9.76→10.42MB（約0.66MB増）。peak/native/GPUメモリではなく、GC差も含みます。保存呼出し自体は0〜0.1msですが、350ms debounceと永続化完了時間を含まないため保存速度として報告しません。保存・復元の実結果は別途確認しました。

初回表示36試行では、WebKitの空に近いfixtureが公開版632ms→Phase2a795ms→候補950msの中央値、Chrome候補400に最大2360msがありました。0 FXでも素材参照1件を含みます。これは再描画改善とは別の未確定な初回表示差です。処理順を逆にしたWebKit各3回の追加試験では公開658/最大781ms、Phase2a607/694ms、候補632/682msとなり、候補だけの200ms増を再現しませんでした。ResourceTimingの最終応答も423〜587msと変動しています。初回結果だけから実装起因とは断定できません。原因不明の差を解消済みとは扱いません。

同一Mac、Chrome/macOS WebKit、1600×1100、同じ640×360合成静止画・30秒timeline・V/A/T併用・ズーム3。variantはCPUを競合させず順番に測定しました。公開版の200/400はloaderなら100へ切り捨てられるため、描画の比較だけ同じデータをQAから渡しています。公開版がその数を通常保存できるという意味ではありません。

profileはQA wrapperのみで、通常アプリにobserver・測定履歴は追加していません。rAFは物理表示時刻ではなく、初回表示は別途少数反復、複製確定/Undo/Redoは自動操作往復を含むため実handler CPU時間とは区別します。10〜15%を超える差は下記の絶対時間・処理箇所・標本数と合わせて判断します。

## 3. 30秒の代表project

実素材ではなく、固定seedの音楽風PCM＋符号付きmarker、動く`testsrc2`の1280×720/30fps・30秒です。主映像5カット＋上位映像1、カラー、music laneのhold音量、TEXT3、フラッシュ100＋黒fade1。実Ctrlドラッグでフラッシュを200へ増やし、Undo/Redo、再生/seek、素材2件保持、project再読込、通常のTEXT画像化を含むbrowser/Mac出力を実行します。

前後とも全経路で30秒・900frame。独立FFmpegデコードの最大PTS誤差0.334µs、6出力×6マーカー=36点すべて整数位置差0sample（2ms基準内）。補助的な分数sample探索でも最大0.25sampleです。Chrome/WebKit/Macそれぞれの前後PCMと全900枚のデコード映像は完全一致しました。AAC roll group・packet対応・実測primingに基づくelstも確認しました。

|通常経路の出力総時間|Phase2a|今回|
|---|---:|---:|
|Chrome browser|2.334秒|2.265秒|
|WebKit browser|12.184秒|12.133秒|
|Mac H.264/AAC|94.102秒|93.099秒|

Macは約3.1倍の実時間で、既存の出力待ち改善を達成したとは言えません。素材取込はChrome280→290ms（metadata224→229ms）、WebKit104→104ms。WebKitはmetadata wrapperで個別時間を取得できず、内訳は未測定です。30秒合成project1条件の基準値であり、全素材・全尺への一般化はしません。

初期の直接worker試験と、巨大なNumber配列で動画を渡してNodeのheap不足になったQA試作は、通常経路の正式証拠に混ぜません。最終試験は実filePicker/File入力とBlobのダウンロードを使い、動画全体をNumber配列にして渡しません。Macの初回はdrawtext無しで停止したため、実PVEと同じ`withTextRasters`を適用し、文字を除外せず再試験して成功しました。

## 4. 保存・復元・互換性

旧形式1は継続して読み込みます。FX100超は保存時に形式2へ上げます。新しい属性構造や素材移行は追加しません。形式2はFXを減らしても保護を残します。旧2.2.84へ戻す際は**更新前の別名project backup**を使ってください。新projectをversionだけ1へ書き換えると旧loaderのsliceが復活するため、手作業の書換えは推奨しません。

元の素材・projectの削除、既存データを対象にした破壊試験は行いません。B1の素材コピー、writer/abort/世代管理には手を加えません。`project-storage.js`の変更はsnapshot cloneの形式識別だけです。

実公開2.2.84のloaderを使い、形式2/201 FXは拒否され、現在開いているprojectが無変更であることをChrome/WebKitのUIから確認しました。同一fixtureを調査用に形式1へ戻すと100へ切り捨てられ、旧版リスクを再現できました。形式2では101/200/400を保持し、browser/folder/Macの保存と再読込を確認しました。

## 5. 回帰・候補判定

全34検証コマンド成功：全JavaScript96 entrypoint、build、既存Python/FFmpeg/HTTP28 suite＋Phase2a FX native suite、旧版互換UI、30秒独立デコード。B1失敗注入、B2微小hold、B3多数点、B4有理fps、等速同期、preroll/roll groupを含みます。私的素材を要するreal-transitions専用QAは実行せず、標準transition suiteと今回の代表projectを使用しました。

Phase2aのChrome/WebKit実操作を再利用し、Ctrl/Altの2/10/50/100/200群、mixed V/A/T/FX、連動音声、新ID・独立編集・共通delta・track、反復複製、1Undo/Redo、Esc取消、上限全体拒否、100/200/400保存、非flash100上限を検証しました。元素材の物理コピーは増えません。通常移動/単一操作の局所回帰も成功しています。

実iPhone/Safari、物理ループバック、4GB超の実movie、長尺4K/全HDRは未確認です。Mac WebKitの結果を実iPhone PASSへ置換しません。既存のWebKit native AAC品質差、Mac非等速WSOLA、素材コピー旧世代残存も未修正です。素材解析/出力低速化は上記の限定基準値を残すだけで、原因解消とはしません。Quick/Master Export、Speed/renderer全面刷新は含みません。

## 6. 次版候補・公開手順案

- **番号**：直近の2.2.82→83→84のpatch運用から2.2.85を提案。ユーザー結果確認後にのみpackage/lock/UI/engine/cache識別子をまとめて更新し、version/build/asset検査と必要回帰を実施します。
- **採用**：Phase 2a全体＋上記DOM再利用・最小形式保護・回帰・短いヘルプ/資料。変更一覧とhashは`PVE-NEXT-RELEASE-CANDIDATE.json`。
- **除外**：text最適化02、Feature Lab、Speed/WSOLA代替、研究用MP4修復、私的素材、生成30秒素材/PCM、ブラウザprofile、大容量logs。元作業ツリーは保持します。
- **リリースノート**：[案](PVE-NEXT-RELEASE-NOTES.md)。400が全端末の快適性保証ではないこと、形式2とbackup、既知の音声制限を記載します。
- **Mac ZIP**：未version更新の検証専用stagingを作り、CRC、収録source hash、Launch0755、必要docs、不要物除外、標準展開後HTTP/関連JSを確認します。検証staging ZIPは405entries、約12.74MBでCRC・全payload一致・Launch0755・標準ditto展開後の関連JS/HTTPが成功しました。QA生成動画/profile/logは含みません。正式公開用ZIPは版更新後に作り直し、古い2.2.84表示のまま配布しません。
- **Pages**：remote mainが基準から進んでいないか確認→承認済みの選別差分だけcommit→通常push→Validate成功→同SHAの既存`pages.yml` workflow_dispatch→実公開URL/module/cache/配布ZIPを確認。今回は実行しません。別Sitesの変更や新配布方式は混ぜません。
- **rollback**：project/素材/新形式ファイルを別名退避→承認されたrelease commitのrevert→検証→同じPages workflow。force pushや素材削除は行いません。旧アプリは形式2を開けないため、新projectとは別に保持した更新前backupで編集を再開します。

## 7. 変更・保全・残課題

変更一覧は候補manifest参照。主要実装はapp/model/project-storage/overlay-track-view、Phase2aのtimeline-duplicate/gesture/paste/style、Macのcore/serverの形式受入です。その他はテスト・既存QA再利用・日本語資料・packager収録資料です。音声/映像エンジン、mux、時間基準は変更していません。

元Phase2aの442ファイル、旧作業ツリーの846ファイルとHEAD/index hashは開始時と一致。公開cloneはclean、remote mainも901ac235のままです。text02/Feature Labを統合せず保持しています。

生ログ・計測JSON・生成素材はリポジトリ外の `../pve-phase2b-evidence/` に保存し、配布へ含めません。

今後の小課題は、初回/確定時の変更DOM、Inspectorの多数要素表示、iPhone実素材での応答、import/decode/解析と書出し段階の計測です。UI全体の再設計・仮想化エンジンへの刷新は今回行いません。

**最終推奨**：Phase2aの機能と今回の限定改善を次版候補へ採用することを推奨します。再現する重大なデータ/音画回帰はありません。初回起動の遅い側のばらつきはP1の性能確認事項、実iPhoneは未検証として明示し、ユーザーの短い実素材受入確認後に2.2.85の正式準備へ進む判断が妥当です。公開・版番号更新はユーザー確認後です。

> 互換保護は旧版の新規読み込みを拒否するものです。すでに開いている旧版タブ/旧Macアプリの自動保存を止めることはできません。更新前に旧タブで保存・退避して閉じ、同じprojectを旧版と新版で同時に編集しないでください。
