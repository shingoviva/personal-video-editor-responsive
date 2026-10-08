// App-owned vector artwork; independent of emoji fonts.
const paths={
 link:'<path d="m9 15 6-6m-7 9-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0-4 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 eyeOff:'<path d="m3 3 18 18M9.5 5.4A11 11 0 0 1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 4M6 6.5A21 21 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5-1M10 10a3 3 0 0 0 4 4"/>',
 speaker:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 muted:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
 reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
 expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 undo:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
 redo:'<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>'
};
export function uiIcon(name){return `<svg class="pve-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||paths.reset}</svg>`}
