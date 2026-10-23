// Reapply only to the reviewed 1.56.0 artifact; unknown dependencies fail closed.
import fs from 'node:fs';import {createHash} from 'node:crypto';
const file=new URL('../dist/vendor/mediabunny.mjs?v=2.2.84',import.meta.url),pin=JSON.parse(fs.readFileSync(new URL('./mediabunny-priming-patch.json',import.meta.url))),data=fs.readFileSync(file),hash=createHash('sha256').update(data).digest('hex');
if(hash===pin.after){console.log('Priming hook already matches reviewed artifact');process.exit(0)}
if(hash!==pin.before)throw Error('Unknown Mediabunny artifact: review/port priming hook before updating');
let text=data.toString();if(text.split(pin.old).length!==2)throw Error('Ambiguous sample table hook');
text=text.replace('var ef=Object.create;',"import {appendAacRollGroups as pveAppendAacRollGroups} from '../mp4-aac-roll.js?v=2.2.84';\nvar ef=Object.create;").replace(pin.old,pin.new);
if(createHash('sha256').update(text).digest('hex')!==pin.after)throw Error('Patched artifact hash mismatch');
fs.writeFileSync(file,text);console.log('Reviewed AAC-LC mux hook applied');
