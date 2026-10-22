# PVE performance comparison

Comparable recorded conditions (source identity must be confirmed separately).

- Single runs cannot establish significance. Compare at least three repeats; small changes are inconclusive.

| Metric | Before | After | Change % | Assessment | Reason |
|---|---:|---:|---:|---|---|
| playbackMetrics.drawIntervals.p95 | 45.900000005960464 | 42.400000005960464 | -7.63 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| playbackMetrics.deadlineExceedances.value | 0 | 0 | — | 判断保留 | zero baseline |
| playbackMetrics.holdDuration.value | 0 | 0 | — | 判断保留 | zero baseline |
| playbackMetrics.seekLatency.p95 | 0.09999999403953552 | 0.09999999403953552 | 0.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.duration.p95 | 0.494791 | 0.414875 | -16.15 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.textureUploads.value | 121 | 122 | 0.83 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.repeatedUploads.value | 10 | 12 | 20.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.staticTextRedraws.value | 0 | 0 | — | 判断保留 | zero baseline |
| gpuMetrics.shaderDraws.value | 122 | 122 | 0.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.estimatedUploadBytes.value | 1003622400 | 1011916800 | — | 判断保留 | estimated |
| memoryMetrics.resources.canvases | 9 | 13 | 44.44 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| memoryMetrics.resources.textures | 8 | 8 | 0.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.audio.automation.mean | 0.8099999998509884 | 0.6487179487561568 | -19.91 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.sync.control.mean | 1.3374485590575653 | 1.0373983744198714 | -22.43 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.fx.extract.mean | 0.00162601616324448 | 0.0008264462317316985 | -49.17 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.layers.visibility.mean | 0.01219512183007186 | 0.017073170562100604 | 40.00 | 悪化 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.evaluation.opacity.mean | 0.00081300808162224 | 0.0008196720822912747 | 0.82 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.fx.update.mean | 0.0008264462317316985 | 0 | -100.00 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.text.redraw.mean | 0.0074380167013357494 | 0.003278688329165099 | -55.92 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.evaluation.scaleMotion.mean | 0.0008264462317316985 | 0 | -100.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.paintPreview.mean | 0.3406504063102288 | 0.3082644631547376 | -9.51 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.dom.clock.mean | 0.29105691054487615 | 0.28132780118849265 | -3.34 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.tickPlayback.mean | 1.8485596709781222 | 1.5040650405292588 | -18.64 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.main.longTasks.mean | — | — | — | 判断保留 | not observed |
| cpuMetrics.main.longTaskCount.value | 0 | 0 | — | 判断保留 | zero baseline |
