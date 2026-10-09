## 2.2.44 — 音声シーク・時計同期

別版responsiveの共通音声エンジンを更新。同じHEADをGitHub Pagesと既存の公開Sitesへ配信します。

## 2.2.43 — 素材終端の再生再開修正

端末切替版のiPhone／Mac共通音声処理、時計、映像終了処理を更新。同じHEADを別版GitHub Pagesと公開Sitesへ反映します。

## 2.2.42 — 音声停止処理

同じ別版GitHub／Pages／公開Sitesを更新します。元版は変更しません。

## 2.2.41 — 端末切替版の更新

別リポジトリ https://github.com/shingoviva/personal-video-editor-responsive のmainへ反映。同じHEADをGitHub Pages https://shingoviva.com/personal-video-editor-responsive/ と既存の公開Sitesへ配信します。元のMac開発版／GitHub／Siteは保全します。

# GitHub公開準備

このリポジトリは、そのままGitHubへ移せる構成です。元素材、プロジェクトの編集データ、書き出したMP4は含みません。

公開対象の`dist/`は相対URLだけで動く静的Webアプリです。GitHub Pagesにはブラウザ版を配置し、Mac FFmpegエンジンは`dist/personal-video-editor-mac.zip`をGitHub Releasesにも添付してください。ProRes処理、`minterpolate`、`vidstab`はローカルエンジンで実行され、GitHub Pagesへ素材や編集内容を送信しません。

## 推奨構成

- ソースコード: ShingoさんのGitHubリポジトリ
- ブラウザ版: GitHub Pages（`dist/`）
- Mac版: `dist/personal-video-editor-mac.zip`をGitHub Releasesへ添付
- 日常の編集: GitHub Pages上ではiPhone／ブラウザの端末エンジン、Macの高品質処理はZIPを展開して`Launch.command`
- 実写検証素材: `.qa-media/real/IMG_7917.mov`（Git・Pages・Mac版ZIPの対象外）

## 公開手順

1. GitHubで新しい空のリポジトリを作成します。
2. このリポジトリをpushします。
3. Repository Settings → Pages → Sourceで「GitHub Actions」を選びます。
4. Actions → `Publish GitHub Pages` → `Run workflow`を実行します。
5. Mac版を配布する場合はReleaseを作り、Actionsの実行後に生成された`personal-video-editor-mac` artifact内のZIPを添付します。

`Publish GitHub Pages`は手動実行だけにしてあります。リポジトリへpushしただけではアプリを公開しません。公開リポジトリにする場合は、ライセンス方針を決めてからLICENSEを追加してください。

ブラウザ版は `dist/index.html` を入口に、JavaScript・CSS・同梱ライブラリをすべて相対パスで参照する静的Webアプリです。GitHub Pagesではサーバー処理を使わず、素材と編集データを利用端末のブラウザ内に保持します。

通常のpushとPull Requestでは `Validate editor` がJavaScriptテスト、静的ビルド、Python動画処理テスト、Mac ZIP生成を実行します。FFmpegの任意機能がランナーにない場合、その機能はスキップとして記録し、不足機能を処理前に検出できることを確認します。Pages公開はこの検証とは別の手動操作です。

iPhone別版2.2.26は既存の本人限定Sitesへ反映します。元のGitHub・元のSite・Mac開発ディレクトリには上書きしません。

iPhone別版2.2.27は本人限定Sitesのみ更新。表示点検記録はVALIDATION.mdとvalidation/iphone-2.2.27-geometry.json。

iPhone別版2.2.28のプレビュー改善は本人限定Sitesへ反映。書き出し高速化は保留、元のGitHub／Site／Mac開発版は保全します。

iPhone別版2.2.29の表示微調整も本人限定Sitesのみへ反映。元のGitHub／Site／Mac開発版の公開先は変更しません。

2.2.30は端末切替版のMac向けUIへ共通再生・再生ヘッド操作を適用。本人限定の同じSitesに反映し、元のMac開発版／GitHub／公開先は保全します。

2.2.31はMac向けFX／文字の重なり、短いクリップの幅、段内余白、調整スライダー左右端を修正。同じ本人限定Sitesのみへ反映します。

2.2.32は音量ポイント／波形の時間投影、ドラッグの位置保持、狭いMac設定タブのはみ出しを修正。同じ本人限定Sitesへ反映し、元の開発版・公開先は保全します。

2.2.33は選択対象の見出し・専用SVG・範囲別リセットとUndo対象保持を端末切替版へ導入。同じ本人限定Sitesのみ更新し、元のMac開発版・GitHub・公開先には反映しません。

2.2.34はMacタブ選択／フォーカス表示とiPhoneアイコン視認性を修正。競合調査を同梱し、既存の本人限定Sitesのみ更新します。元のMac開発版・GitHub・公開先は維持します。

2.2.35はiPhoneの操作段整列・余白圧縮・配分範囲を調整。同じ本人限定Sitesのみへ反映し、元のMac開発版・GitHub・Siteは保全。

2.2.36はスマホヘッダーを4px圧縮。同じ本人限定Sitesのみへ反映、元のMac版／GitHub／Siteを保全。

2.2.37は端末切替版Mac上部のみ6px圧縮。同じ本人限定Siteへ反映し、元のMac版／GitHub／Siteは維持。

2.2.38はiPhoneの末尾ジャンプと素材読み込み・任意映像段配置・素材一覧への戻りを修正。同じ本人限定Siteのみへ反映し、元のMac版／GitHub／公開Siteは保全。

2.2.39は再生中の編集の目印とMac／iPhoneの個別レイヤー高さを追加。同じ本人限定Siteのみへ反映し、元のMac開発版・GitHub・公開Siteは保全。元GitHubへのpush／Actionsは上書きしない方針により対象外。

2.2.40は編集点の移動・選択・Delete削除・全クリップの吸着・最新ヘルプを反映。本人限定の同じSiteのみ更新。元のMac開発版・GitHub・公開Siteへのpush／Actionsは上書きしない方針により対象外。
