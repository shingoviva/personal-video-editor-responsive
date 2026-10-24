// One bounded record per visible track. Selection is painted separately.
// Never reuse callbacks across project restore/Undo (new item identities).
const records=new WeakMap();
export function refreshOverlayTrack(root,markup,items,geometry){
 const previous=records.get(root),sameItems=!!previous&&previous.items.length===items.length&&items.every((item,i)=>item===previous.items[i]);
 const replaced=!sameItems||previous.markup!==markup||(root.querySelectorAll?.('[data-fx],[data-text-chip]').length??root.childElementCount)!==items.length;
 if(replaced)root.innerHTML=markup;
 const rebind=replaced||previous?.geometry!==geometry;
 records.set(root,{markup,items:items.slice(),geometry});
 return{replaced,rebind};
}
