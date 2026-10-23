# Phase 1a / B1 素材保存の安全性（未公開）

> 開発時点の記録です。2.2.84の最新の採否・制約・公開状態は[リリース報告](PVE-2.2.84-RELEASE-REPORT.md)を参照してください。


2026-10-23、2.2.83の作業ツリー。B1のみ修正。版番号・公開・B2〜B4・UI配置・速度/補正/レンダラーは変更していません。従来の未公開差分は保持しています。

## 問題と採用方式

旧`copyMediaToProject()`は固定名へ再書込し、失敗すると既存/新規を区別せず削除していました。既存の調査スクリプトで削除を再確認し、旧実装に対する回帰ケースでも`B1 existing copy deleted on write failure`を確認しました。

**全コピーを別名の新しい世代へ保存する方式**にしました。ファイル名は`素材ID-UUID-元ファイル名`です。既存コピーは書込も削除もしません。`getFileHandle()`が`NotFoundError`を返した場合だけ新規候補とし、それ以外の失敗は中止します。候補が存在した場合は別UUIDへ再試行し、衝突が続く場合は有限回で失敗します。

`createWritable()`→`write()`→`close()`を完了して初めてパスを返し、呼出元が`projectPath`を更新します。`createWritable()`はcloseまで変更を反映しないAPIですが、その保証だけに既存コピーの保護を委ねず、closeが反映後に失敗する模擬ケースでも旧コピーを保持します。独自の原子的rename/replace APIは使用していません。

既存`projectPath`のフィールド・相対パス構造・読込処理は変えません。旧名の素材は引き続き復元でき、既存データの移行は不要です。新しい世代の名前が増えるため、旧コピーを自動で削除せず、ディスク使用量は増え得ます。不要世代の整理は今回の範囲外です。

## 失敗・並行処理・呼出元

- 取得前から存在するファイルを削除しません。作成handleを受け取れた新規候補だけを後始末の対象にし、現在のentryとの`isSameEntry()`確認後に削除します。
- writer作成・write・close失敗時は、可能ならabortし、新規候補を後始末します。abort自体が失敗しても元のエラーを返し、既存コピーには触れません。
- 作成処理が副作用後に失敗しhandleが返らない場合は、所有権を確定できないため削除しません。削除権限喪失・ロック残存等で後始末できない場合も未参照ファイルが残り得ます。後始末エラーは元エラーの`mediaCopyCleanupError`へ保持します。
- 同一実行環境のコピーを直列化し、失敗後も次の処理を実行できます。Web Locks対応環境では同一originの協調するタブ間も直列化します。Web Locksがない別実行環境でも、UUIDによる別名で通常の同名競合を避けます。
- 読込/再リンクのコピー失敗時、既存`projectPath`があれば`retained`を不用意にfalseへ落としません。
- 専用フォルダ移行は編集データのcloneへコピーし、全コピーと`saveFolderProject()`の成功後に現在のパス・保存先を確定します。フォルダ作成時の保存を抑止し、移行途中で最近のプロジェクトの参照先を切り替えません。既存パス付きの未接続素材がある場合は、安全に参照を移せないため移行を中止します。

## 変更ファイル

- `dist/project-storage.js`：新世代コピー、失敗時cleanup、並行制御、移行時の保存抑止。
- `dist/app.js`：既存retainedの維持、移行の参照/保存先確定を全成功後へ変更。
- `tests/project-storage.test.mjs`：模擬失敗・バイト/参照保護・retry/並行・衝突の回帰試験。
- `scripts/check-project-storage-browser.mjs`：任意実行のChrome実API/呼出元検証。
- 本書・`docs/b1-storage-evidence/`・ROADMAP/UXのB1状態・workspaceの`.codex-context/pve-state.md`を更新。既存AGENTS/package.json等の未公開差分は変更せず保持。

## 検証結果

| 検証 | 結果 |
|---|---|
| 旧B1再現 | 旧コードで既存コピー削除を確認。回帰テストの保護assertも旧実装で失敗 |
| 失敗注入 | 既存/新規 × lookup / create取得 / create副作用後 / writer作成 / 部分write後 / close前 / close反映後 / write+abort失敗 / close+abort失敗＝18ケース成功 |
| 保護・復旧 | 各失敗後の既存バイト列・現在の参照・保存済みmanifest参照を維持、再試行で新しいバイト列を保存 |
| 追加の境界 | NotFound以外の取得エラー、cleanup失敗、別entryへの差替え、UUID衝突、close待機中の未確定参照を確認 |
| 並行処理 | 同じID・別名素材・別handleの8件、失敗後の再保存、Web Locksなしの独立モジュール2件を確認 |
| Chrome実API | 新規プロファイルの使い捨てOPFSで18注入ケース、別タブ間4コピー、実アプリ移行の失敗/再試行を確認。pageerror 0 |
| 局所試験 | `node scripts/test-related.mjs storage`：10/89スクリプト成功 |
| 全回帰 | `npm test`：89スクリプト成功、`npm run build`成功 |
| 変更範囲 | B2〜B4と既存未公開差分のファイルhash不変、`git diff --check`成功 |

失敗注入は、メモリ模擬に加え実ネイティブhandle/streamを薄く包み、実write後・close後にも例外を発生させています。OSの実容量不足を起こした試験ではありません。

証拠：Chrome結果（開発監査資料・配布対象外）、局所ログ（開発監査資料・配布対象外）、全JSログ（開発監査資料・配布対象外）、build（開発監査資料・配布対象外）、修正前の失敗（開発監査資料・配布対象外）、旧調査スクリプト結果（開発監査資料・配布対象外）。

回帰試験は`tests/project-storage.test.mjs`。実API試験は、リポジトリルートでHTTPサーバーを起動し、`PVE_PLAYWRIGHT_MODULE`へPlaywrightの絶対パスを設定して、`node scripts/check-project-storage-browser.mjs http://127.0.0.1:8875/ /tmp/pve-b1-result.json`で実行できます。端末の個人フォルダを選択せず、OPFSの試験用subtreeを最後に削除し、ブラウザcontextも破棄します。

## 保証範囲・未検証

PVEが既存素材コピーを開いて上書き・削除する経路を排除し、コピー途中の失敗では旧参照を使って復元できます。これはプロジェクトの全ファイル・IndexedDB・自動保存をまとめたトランザクションの新設ではありません。移行先に途中まで成功した未参照コピーが残る場合も、元のプロジェクトと素材は保持します。

`getFileHandle(create:true)`に排他的な新規作成オプションはなく、存在確認と作成/削除を一操作にはできません。UUIDとorigin内Web LockでPVE間の衝突を避けますが、同じ新規候補を意図的に操作する別origin・外部アプリとの競合まで原子的には保証できません。`isSameEntry()`も確認後の外部変更を防止しません。外部プロセスとの排他保証が必要なら、OS側で排他作成と所有権検証を行う別方式が必要です。

OSのピッカーで選ぶ外部フォルダ、実ディスク満杯・デバイス切断・電源断、Safari/iPhone実機は未検証です。確認したChrome実APIはOPFSであり、外部ファイルシステム全般の耐障害性を証明するものではありません。

調査した一次資料：[WHATWG File System / createWritable](https://fs.spec.whatwg.org/#api-filesystemfilehandle-createwritable)、[getFileHandle](https://fs.spec.whatwg.org/#api-filesystemdirectoryhandle-getfilehandle)、[isSameEntry](https://fs.spec.whatwg.org/#api-filesystemhandle-issameentry)。closeまでの反映制御と、外部変更・複数ファイル間の保証を区別しました。


> 配布上の注記：本文は開発時点の記録です。最新の採否・既知制約は2.2.84リリースノート／リリース報告を参照してください。生PCM・私的QA素材・大容量ログ・研究専用のMP4書換え処理は配布しません。
