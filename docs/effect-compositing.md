# FX consistency

FX have three existing compositor stages: screen colors (flash/black fades),
focus masks, and whole-picture motion. Captions remain above screen color/masks;
only motion effects with `zoomTexts` enabled transform the caption plane.

Within each stage, render F/T1 before F/T2 before F/T3. Creation order is the
stable tie-breaker within one plane. Never sort the project's arrays in place:
Undo, selection, and serialization keep their original identities and order.
`orderedEffects` is shared by preview masks, mobile export, and composed zoom
geometry. The native engine sorts by the same plane before its existing stages.
This preserves existing global-zoom/focus and caption-follow semantics; F/T does
not turn whole-picture motion into a filter on only one underlying video track.

Screen FX durations share the model's 1/60–86400 second range. Analysis remains
limited to 30 seconds; that analysis limit must not truncate a normal fade.
Native single and batched color FX must use the same duration bounds.

Analyzed results store both the source-clip stamp and an FX timing/seed stamp.
Start, duration, target-region or picture-aspect changes invalidate the result. Strength, F/T
plane, return settings, and caption following can reuse the same analysis.
Legacy results acquire the missing timing stamp before edits during render or
checkpoint; existing valid projects are retained. Validation occurs on save as
well as inspector mutation, so timeline move/trim/duplicate cannot bypass it.
Undo snapshots retain the old valid result. No analysis runs during playback.

`effect-consistency.test.mjs` checks the actual timeline gesture, checkpoint/save,
legacy adoption, appearance-only edits, BGM, Undo, and ordering. Native regression
checks all three 40-second color FX, the batched path, reversed insertion order,
expected pixels after 30 seconds, full decoding and identical audio PCM.
