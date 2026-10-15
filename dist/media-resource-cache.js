// Only browser-owned references are pruned. Native media IDs and source files
// are deliberately outside this cache. Undo/redo snapshots retain their media.
export function createMediaResourceCache({files,urls,thumbs,placements,revoke=url=>URL.revokeObjectURL(url)}){
 const snapshots=new Map();
 const ids=p=>new Set((p?.media||[]).map(m=>m.id));
 return{
  clear(){snapshots.clear()},
  remember(snapshot,project,history,future){snapshots.set(snapshot,ids(project));if(history&&future){const keep=new Set([...history,...future,snapshot]);for(const key of snapshots.keys())if(!keep.has(key))snapshots.delete(key)}},
  prune(project,history=[],future=[]){
   const retainedSnapshots=new Set([...history,...future]);
   for(const snapshot of snapshots.keys())if(!retainedSnapshots.has(snapshot))snapshots.delete(snapshot);
   const keep=ids(project),stores=[files,urls,thumbs,placements].filter(Boolean);
   const candidates=new Set(stores.flatMap(store=>[...store.keys()].filter(id=>!keep.has(id))));
   if(!candidates.size)return [];
   for(const snapshot of retainedSnapshots){
    let media=snapshots.get(snapshot);
    if(!media){try{media=ids(JSON.parse(snapshot));snapshots.set(snapshot,media)}catch{return []}} // Fail closed if history cannot be inspected.
    for(const id of media)keep.add(id);
   }
   const liveUrls=new Set([...urls].filter(([id])=>keep.has(id)).map(([,url])=>url)),revoked=new Set(),removed=[];
   for(const id of candidates){
    if(keep.has(id))continue;
    const url=urls.get(id);
    for(const store of stores)store.delete(id);
    if(typeof url==='string'&&url.startsWith('blob:')&&!liveUrls.has(url)&&!revoked.has(url)){revoke(url);revoked.add(url)}
    removed.push(id);
   }
   return removed;
  }
 };
}
