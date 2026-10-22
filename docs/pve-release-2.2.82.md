# PVE 2.2.82

再生操作と素材ライブラリの改善です。Mac再生ボタン32pxとring余白、再生中seekの自動resume、全体loop（Shift-click Play/Shift-Space）、各素材のV1–V3/A1–A4指定、右クリック/Shift-F10の素材メニューを追加。履歴にはShift単独の再生停止があり、全体loopの旧実装は確認できなかったため、既存操作を残して追加しています。

seekは最新世代のみresumeし、停止・読み込み・reset・新しいplayが古い処理を無効化。停止中のseekは停止を維持し、末尾/範囲外seekで冒頭へ飛ばないよう保護。clock/gate/seek所有権は既存設計を利用し、音量・書き出し・保存schemaは変更しません。

素材メニューは配置、プレビュー/詳細、名前変更、再リンク、未使用素材の整理です。使用中素材の削除は無効。素材の元ファイルは変更しません。

新しい競合回帰試験を通常npm testへ追加。実ブラウザー検証用scripts/check-preview-controls.mjsは合成動画/音声/静止画で配置・右クリック・rename・継続seek・loop・bare Shift・ring範囲を確認します。通常画面に診断機能は出しません。

実機iPhone/Safari、スピーカー聴音は未検証。公開前/公開後の最終結果・commit・Actions/deploymentは作業証拠と最終報告に記録します。Feature Labは公開対象外。問題時は.projectを退避し、当リリースをgit revertして検証後再公開。Sitesは直前公開version74（2.2.81）へ戻せます。
