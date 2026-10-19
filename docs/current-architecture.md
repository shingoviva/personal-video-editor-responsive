# Current implementation — reference before changing PVE

This document and the linked modules describe the current implementation. Old
release notes, benchmark scripts and exported bundles are historical evidence,
not source implementations to copy back into the application.

- Playback clock, decoding, preloading and cancellation: [preview-playback.md](preview-playback.md).
  Preserve the single session clock and cancellation ownership. Never restore
  the old decoder-driven timeline clock or periodic seek-based drift correction.
- FX stage/layer ordering and analysis invalidation: [effect-compositing.md](effect-compositing.md).
  Preserve source/effect stamps and invalidate analysis after source or geometry edits.
- Browser stabilization: `dist/mobile-stabilize.js` owns path estimation for both
  preview and export. The workers own decoding/cancellation, not separate copies
  of the estimation algorithm. A path is indexed by source time, before speed
  remapping. Empty decoding must fail rather than silently reporting success.
- Stabilization choices: `dist/stabilization-presets.js` is authoritative. New
  edits offer OFF/WEAK/MEDIUM/STRONG. Six named historical settings are
  **COMPATIBILITY ONLY**: keep their exact saved values and rendering behavior,
  but do not expose them as new effects. They are not horizon detection,
  segmentation, gimbal simulation or rolling-shutter correction.
- Stabilization rendering rotates in physical source pixels. A normalized UV
  rotation without the source aspect ratio is incorrect for non-square footage.
  Browser WebGL preview and Canvas export must agree.
- `engine/core.py` retains native saved-project compatibility. Native vidstab
  and the browser low-resolution estimator are different algorithms; do not
  promise identical stabilization results between engines.
- `dist/feature-lab.html`, `dist/lab/` and their local scripts are experimental,
  excluded from the normal application and release. Do not copy their prototype
  implementations into production without separate integration and validation.

For changes here, run the focused regression tests and the normal test/build
commands. A passing synthetic test does not establish real-camera image quality.
Record actual footage, durations, resolutions and untested devices in VALIDATION.
