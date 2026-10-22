// Explicit seeks create a new playback epoch. Only the newest seek may resume.
export function createPreviewSeek({isPlaying,stop,position,prepare,ready,start,pending=()=>{},error=()=>{}}){
 let generation=0,resuming=false;
 return {
  get resuming(){return resuming},
  cancel(){generation++;resuming=false},
  async seek(value,{resume=isPlaying()||resuming}={}){
   const id=++generation;
   stop();resuming=resume;position(value);pending(resume);
   try{await prepare();if(id!==generation)return false;ready();resuming=false;if(resume)await start();return true}
   catch(reason){if(id===generation){resuming=false;error(reason)}return false}
  }
 };
}
