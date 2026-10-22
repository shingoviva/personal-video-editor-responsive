# PVE performance comparison

Comparable recorded conditions (source identity must be confirmed separately).

- Single runs cannot establish significance. Compare at least three repeats; small changes are inconclusive.

| Metric | Before | After | Change % | Assessment | Reason |
|---|---:|---:|---:|---|---|
| playbackMetrics.drawIntervals.p95 | 48 | 45.099999994039536 | -6.04 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| playbackMetrics.deadlineExceedances.value | 2 | 0 | -100.00 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| playbackMetrics.holdDuration.value | 16 | 15.5 | -3.13 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| playbackMetrics.seekLatency.p95 | 106.6000000089407 | 111 | 4.13 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.duration.p95 | 1.345374 | 0.876458 | -34.85 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.textureUploads.value | 388 | 387 | -0.26 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.repeatedUploads.value | 38 | 49 | 28.95 | 悪化 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| gpuMetrics.staticTextRedraws.value | 121 | 120 | -0.83 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.shaderDraws.value | 387 | 385 | -0.52 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| gpuMetrics.estimatedUploadBytes.value | 3201654784 | 3193360384 | — | 判断保留 | estimated |
| memoryMetrics.resources.canvases | 9 | 9 | 0.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| memoryMetrics.resources.textures | 8 | 8 | 0.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.evaluation.opacity.mean | 0.0007692307615891481 | 0.0002525252374735746 | -67.17 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.evaluation.scaleMotion.mean | 0.000261096629087981 | 0 | -100.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.audio.automation.mean | 0.6936708860112789 | 0.5904761902960666 | -14.88 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.sync.control.mean | 1.5693877547979356 | 1.3305785125814193 | -15.22 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.fx.extract.mean | 0.004065040529258852 | 0.00499999982615312 | 23.00 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.layers.visibility.mean | 0.3908333332588275 | 0.34180327907937474 | -12.55 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.fx.update.mean | 0.06916666701436043 | 0.062295080696950195 | -9.93 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.text.redraw.mean | 0.16910569066923808 | 0.17704917930188727 | 4.70 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.paintPreview.mean | 1.007438017193936 | 0.9162601631104461 | -9.05 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.dom.clock.mean | 0.25691056826977227 | 0.2520661153946041 | -1.89 | 判断保留 | fewer than 3 repeats, <=5% change or repeat ranges overlap |
| cpuMetrics.tickPlayback.mean | 2.3995918363332747 | 2.081818181744292 | -13.24 | 改善 | >=3 repeats; >5% median difference; non-overlapping observed ranges (not a significance test) |
| cpuMetrics.main.longTasks.mean | — | — | — | 判断保留 | not observed |
| cpuMetrics.main.longTaskCount.value | 0 | 0 | — | 判断保留 | zero baseline |
