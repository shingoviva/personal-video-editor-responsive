import fs from 'node:fs';
import {compareRuns,comparisonMarkdown} from '../dist/performance-report.js?v=2.2.84';
const [before,after,output,...extra]=process.argv.slice(2);
if(!before||!after||extra.length){console.error('Usage: node scripts/compare-performance.mjs before.json after.json [comparison.md]');process.exitCode=2}else{
 try{const read=file=>{const value=JSON.parse(fs.readFileSync(file,'utf8'));const reports=value.runs||[value];for(const r of reports)if(r.schemaVersion?.split('.')[0]!=='1'||!r.measurementConfig||!r.playbackMetrics||!r.cpuMetrics||!r.gpuMetrics)throw Error('Unsupported or invalid diagnostics schema');return value};const text=comparisonMarkdown(compareRuns(read(before),read(after)));if(output)fs.writeFileSync(output,text);else process.stdout.write(text)}catch(error){console.error(error.message);process.exitCode=1}
}
