"""Create the downloadable local app without dependencies or private media."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
output = root / 'dist/personal-video-editor-mac.zip'
entries = ['docs/PVE-2.2.85-RELEASE-NOTES.md', 'docs/PVE-2.2.85-RELEASE-REPORT.md', 'docs/PVE-2.2.85-FILES.json', 'docs/PVE-PHASE-2A-TIMELINE-WORKFLOW.md', 'docs/PVE-PHASE-2B-RELEASE-READINESS.md', 'docs/PVE-NEXT-RELEASE-NOTES.md', 'docs/PVE-NEXT-RELEASE-CANDIDATE.json', 'dist', 'engine', 'tests', 'validation', 'scripts', 'docs/schemas', 'docs/PVE-2.2.84-RELEASE-NOTES.md', 'docs/PVE-2.2.84-RELEASE-REPORT.md', 'docs/PVE-2.2.84-SELECTION.json', 'docs/PVE-2.2.84-CACHE-MANIFEST.json', 'docs/PVE-2.2.84-VALIDATION.json', 'docs/PVE-2.2.84-FILES.json', 'README.md', 'VALIDATION.md', 'Launch.command', 'package.json', 'package-lock.json', 'vite.config.mjs']
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for entry in entries:
        base = root / entry
        files = sorted(base.rglob('*')) if base.is_dir() else [base]
        for path in files:
            if not path.is_file() or path == output or '__pycache__' in path.parts or '.vite' in path.parts or (path.suffix in ('.pyc', '.log', '.f32', '.mp4', '.mov') and path.name != 'device-test.mp4' and not (path.relative_to(root).as_posix().startswith('tests/fixtures/mp4/') and path.name in {'formal-chrome-two.mp4','chrome-two.mp4','ffmpeg-44100.mp4','ffmpeg-48000.mp4'})):
                continue
            archive.write(path, 'Personal-Video-Editor/' + path.relative_to(root).as_posix())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'Personal-Video-Editor/docs/schemas/pve-performance-diagnostics-v1.schema.json' in archive.namelist()
    assert 'Personal-Video-Editor/dist/timeline-gestures.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/timeline-zoom.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/timeline-context.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/overlay-timeline.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/image-media.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/assets.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/media-state.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/mobile-render-worker.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/device-test.mp4' in archive.namelist()
    assert 'Personal-Video-Editor/engine/color_engine.py' in archive.namelist()
    assert 'Personal-Video-Editor/dist/creative.js' in archive.namelist()
    assert 'Personal-Video-Editor/engine/audio_engine.py' in archive.namelist()
    assert 'Personal-Video-Editor/engine/export_pipeline.py' in archive.namelist()
    assert 'Personal-Video-Editor/dist/audio-preview.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/attributes.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/text-render.js' in archive.namelist()
    assert 'Personal-Video-Editor/tests/text-render.test.mjs' in archive.namelist()
    assert 'Personal-Video-Editor/dist/linked-audio.js' in archive.namelist()
    assert 'Personal-Video-Editor/tests/prores.test.py' in archive.namelist()
    assert 'Personal-Video-Editor/tests/overlay-timeline.test.mjs' in archive.namelist()
    assert 'Personal-Video-Editor/dist/caption-presets.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/preview-performance.js' in archive.namelist()
    assert 'Personal-Video-Editor/tests/youtube.test.py' in archive.namelist()
    assert f"'build':'{version}'".encode() in archive.read('Personal-Video-Editor/engine/core.py')
print(f'Mac bundle verified: {output.stat().st_size:,} bytes')
