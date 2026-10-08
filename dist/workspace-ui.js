export const videoTabs=['cut','motion','adjust','look'];

const metadata={
 import:{workspace:'media',scope:'MEDIA',label:'LIBRARY'},
 cut:{workspace:'video',scope:'VIDEO',label:'BASIC'},
 motion:{workspace:'video',scope:'VIDEO',label:'MOTION'},
 adjust:{workspace:'video',scope:'VIDEO',label:'COLOR'},
 look:{workspace:'video',scope:'VIDEO',label:'LOOKS'},
 text:{workspace:'graphics',scope:'GRAPHICS',label:'TEXT'},
 fx:{workspace:'graphics',scope:'GRAPHICS',label:'FX'},
 sound:{workspace:'audio',scope:'AUDIO',label:'MIX'},
 analyze:{workspace:'assist',scope:'ASSIST',label:'ANALYZE'}
};

export function tabMetadata(tab){return metadata[tab]||metadata.import}
export function tabForSelection(kind,current='import'){
 if(kind==='video')return videoTabs.includes(current)?current:'cut';
 return{audio:'sound',effect:'fx',text:'text',media:'import'}[kind]||current;
}
export function inspectorHeading(tab){const value=tabMetadata(tab);return`${value.scope} · ${value.label}`}
