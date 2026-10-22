import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function validateSchema(value,schema,root=schema,at='$'){
 if(schema.$ref)return validateSchema(value,root.$defs[schema.$ref.split('/').at(-1)],root,at);
 const types=Array.isArray(schema.type)?schema.type:[schema.type];if(schema.type&&!types.some(t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='integer'?Number.isInteger(value):t==='number'?Number.isFinite(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t))throw Error(at+' invalid type');
 if(schema.enum&&!schema.enum.includes(value))throw Error(at+' invalid enum');if(schema.pattern&&typeof value==='string'&&!new RegExp(schema.pattern).test(value))throw Error(at+' invalid pattern');if(schema.minimum!==undefined&&value<schema.minimum)throw Error(at+' below minimum');
 if(Array.isArray(value)){if(schema.maxItems!==undefined&&value.length>schema.maxItems)throw Error(at+' exceeds cap');if(schema.items)value.forEach((v,i)=>validateSchema(v,schema.items,root,at+'['+i+']'))}
 else if(value!==null&&typeof value==='object'){
 for(const key of schema.required||[])if(!(key in value))throw Error(at+' missing '+key);
 for(const[key,v]of Object.entries(value)){const property=schema.properties?.[key];if(property)validateSchema(v,property,root,at+'.'+key);else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')validateSchema(v,schema.additionalProperties,root,at+'.'+key);else if(schema.additionalProperties===false)throw Error(at+' unknown '+key)}
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const schema=JSON.parse(fs.readFileSync(new URL('../docs/schemas/pve-performance-diagnostics-v1.schema.json',import.meta.url)));let count=0;
 for(const path of process.argv.slice(2)){const d=JSON.parse(fs.readFileSync(path));for(const r of d.runs||[d]){validateSchema(r,schema);count++}}
 console.log('Schema validation PASS:',count,'reports');
}
