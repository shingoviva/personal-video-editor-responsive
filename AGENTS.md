# PERSONAL VIDEO EDITOR

- 日本語で簡潔に報告し、実機未検証を検証済みと書かない。
- 維持するもの：Photographer-first、元素材の非変更、AIによる自動確定なし、映像3／音声4レイヤー、iPhone H.264/AAC書き出し、Mac FFmpeg、iPhone 16 Pro／M2 Mac優先。機能は安易に削らない。
- `README.md`は現在仕様、`VALIDATION.md`は検証事実、`GITHUB_PUBLISHING.md`は公開手順。毎回全量を読まず、変更に必要な節だけ`rg`で確認する。
- 着手時に`git status`を確認し、既存変更を上書きしない。検索は`rg`を使う。
- 変更に直結する試験を先に実行し、完了前に`npm test`と`npm run build`を通す。公開時はPython動画処理試験とMacパッケージ検証も行う。
- Safari、実写HDR、長時間編集など未実施の実機検証は、制約として明記する。
