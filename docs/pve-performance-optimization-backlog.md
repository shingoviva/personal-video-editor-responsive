# PVE 性能最適化バックログ

この一覧は実装の承認ではありません。今回の変更は診断基盤であり、下記の最適化を実施していません。改善率は未測定なので設定しません。静的監査の候補と、初回合成baselineから観測された結果を分離します。

## 候補と対応する測定点

| 候補 | 比較する指標 | リスク | 必須の回帰確認 |
|---|---|---|---|
| gain/opacityポイントの事前コンパイル | audio.automation / evaluation.opacity の呼数・平均・p95、G/Fのtick、外部CPU duty | gainのhold点・デクリック・fade、編集後の古いcache | audio-start-output、audio-seek-start、audio-boundary、clip-gain-envelope、playback-end、Undo |
| 静止ImageBitmapのtexture再転送削減 | repeatedUploads / upload件数と推定bytes、renderer単位の描画 | mutable Canvasとbitmapの混同、画像差し替えの無効化 | image/preview-frame-ready、media-replacement、resource-lifecycle、project-roundtrip |
| 同一動画フレームの転送・描画削減 | rVFC間隔、repeatedUploads、shaderDraws、drawIntervals | FXや文字だけ動くframeを落とす、seek後の旧画 | preview-system、preview-cadence、preview-drift、preview-preloader、FX・textのanimation |
| 静的テロップのraster再利用 | text.redraw、staticTextRedraws、D/F、DOM clock、外部layout | font・縁取・影・字間・サイズのcache無効化、選択操作面 | text-render、font-library、effect-consistency、zoomTexts ON/OFF、再編集 |
| 可視性・layer評価の前処理 | layers.visibility、opacity評価呼数、C/F、同時layer数 | 下層の短いfadeを見落とす、遷移のoutgoing喪失 | preview-plan、preview-compositing、transition、multitrack、hidden tracks |
| FX DOM値の差分更新 | fx.extract / fx.update、E/FのCPU/外部layout | F/T順・FOCUS座標・マスク・caption順変更 | effect-consistency、region-zoom、face-follow、複数FXと文字の実出力比較 |
| renderer/context統合 | context数、shaderDraws、GPU query、転送量、C/F | alpha、色、手ぶれ回転aspect、CSS→GPUの意味の相違 | preview-compositing、tone-curve、stabilization-preview、全FX/文字/遷移画素比較 |
| 入力proxy／解像度budget改善 | 入力寸法とCanvas寸法、frame待ち、draw p95、初回表示、iPhone tier | 生成時間・容量、出力にproxyを使う誤り、表示品質低下 | preview-source、phone-preview-budget、mobile-hdr、export品質、保存復元 |
| Worker/解析cacheの適正化 | Worker lifecycle、main资源history、hold、削除後再生 | 古いsource stamp、キャンセル漏れ、履歴で参照中の破棄 | material-fx、resource-lifecycle、relink、media-replacement、Undo/Redo |
| 書き出しのsurface再利用 | 本診断はpreview中心。別途export工程時間・ピーク資源の測定が必要 | Canvas寿命、WebCodecs backpressure、audio PCM | streaming-export、mobile-frame-source、export-direct-canvas、HDR・全尺decode |

## 順位の決め方

初回合成baselineだけで、実写・iPhone・高解像度素材に対する普遍的な順位は決めません。詳細な測定結果は `pve-performance-diagnostics-baseline.md` を参照してください。音声、文字、GPU、decode待ちの各工程をinclusive階層で比較し、外部CPU指標とも照合します。推定bytesの減少だけを高速化の証拠にしません。

次回はbaselineで実際に時間を消費した工程を一つだけ選び、最適化前後の同条件3回以上のJSONと、該当する既存試験・実出力を比較します。効果がばらつきと区別できなければ判断保留とします。新backendの導入は現行の測定で解消できない制約を確認してから検討します。

2026-10-22：gainの前処理だけを限定最適化し、F/G各3回でCPU削減と数値一致を確認しました（未公開）。
[最適化01の結果](pve-volume-automation-optimization-01.md)。opacityや継続cacheは未変更です。
