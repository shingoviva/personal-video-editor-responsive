// Async decoder completion must never restart an earlier playback loop.
export class PlaybackSession{
 constructor(){this.generation=0}
 begin(){return ++this.generation}
 stop(){this.generation++}
 current(value){return value===this.generation}
}
