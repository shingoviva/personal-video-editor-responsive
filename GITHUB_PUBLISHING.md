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
