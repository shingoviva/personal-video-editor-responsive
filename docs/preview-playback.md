# Preview playback invariants

The preview and export are separate systems. These changes do not change export
sampling, audio gain/envelopes, or source files.

## Clock and scheduling

`PreviewPlaybackClock` chooses one running AudioContext clock at playback start,
or a monotonic wall clock when audio is unavailable. Selecting another layer,
decoding a frame, or completing a seek must never redefine the timeline clock.
An interrupted audio device pauses the session; it does not silently switch clocks.

`PreviewPlaybackScheduler` runs audio automation independently of video loading.
Video tasks are serialized within one clip identity. A new identity cancels the
obsolete task and gets priority immediately. Generation checks reject old failures,
completions, and queued callbacks after seek, stop, or replacement.

Continuous muted video follows the clock with bounded phase correction. Explicit
seeks, new clips, freeze frames, extreme rates and large errors still require an
accurate presented frame. Never use every small timing error as a seek request.

## Decoder ownership and composition

`PreviewPreloader` exclusively owns the standby decoder until `claim()` cancels
and drains preparation. It must not prepare a future clip before the current clip
has adopted that decoder. Main loading has priority over future preparation.
Loading promises belong to their individual requests. Never retain a rejected
standby load as a global prerequisite for the valid active decoder.

`seekVideoFrame` has one cancellable request per media element. An old request
must not clear the successor's readiness. Await frame presentation where available,
not only `seeked`. Clear/delete/stop abort pending frame requests.

`compilePreviewPlan` computes clip handoffs and lower-layer visibility windows once
per playback. Prewarm a lower layer shortly before it becomes visible, including
short fades, opacity automation, and upper-layer demotion. Fully covered layers
outside that window release their decoders. Do not retain every layer forever.

A new clip must have its matching frame before committing the composition.
This applies to images too: both bitmap presence and matching source key are
required. Failure of the current still image stops playback; an obsolete image
failure must not stop its replacement. Keep
the last complete composition during preparation, including region-zoom transforms
and the caption plane transform. Do not advance FX geometry before the matching
video frame can commit. Paused editing still applies geometry immediately. Subsequent phase correction of
an already presented lower layer must not stall every layer. Missing/failed media
must resolve to the existing error/black behavior rather than an infinite hold.

`previewCadence` preserves fractional frame phase across display refreshes. Failed
presentation does not consume a drawing slot. Adaptive phone budgeting measures
actual painting, not cheap preparation waits.

## Verification and diagnostics

Default `npm test` includes clock, scheduler, presented-frame cancellation,
preloader ownership, generated visibility plans, cadence, drift, and integrated
playback lifecycle regressions, alongside existing audio and composition tests.

For low-overhead browser reproduction, open `?previewDiagnostics`. The bounded
trace is flushed to `#previewDiagnostics` when paused. Normal use allocates no
trace. Record only timings and local clip identities, never file URLs or content.
Do not time playback by repeatedly taking screenshots: capture overhead can itself
cause stalls. Real Safari/iPhone hardware remains a separate acceptance check.
