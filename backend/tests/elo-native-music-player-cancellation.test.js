import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../../relatorio-qualidade-obras/elo-media-player.js',import.meta.url),'utf8');
function player(t) {
 const dom=new JSDOM('<body><div id="elo-real-media-player"><span data-elo-media-title></span><div id="elo-real-media-host"></div></div></body>',{url:'https://www.icaroamaral.com.br/elo.html',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window;w.console.info=()=>{};
 const instances=[];
 w.YT={PlayerState:{PLAYING:1,PAUSED:2,ENDED:0},Player:function(_id,options){
   this.options=options;this.plays=0;this.stops=0;this.destroy=()=>{};this.playVideo=()=>this.plays++;this.stopVideo=()=>this.stops++;instances.push(this);
 }};
 w.eval(source);return {w,instances,api:w.EloMediaPlayer};
}
test('native cancellation before YouTube ready prevents late audio and autoplay',async t=>{
 const h=player(t);let current=true;
 const pending=h.api.play({title:'Faixa',videoId:'abcdef12345',playable:true,embeddable:true},{isCurrent:()=>current});
 await new Promise(r=>setImmediate(r));assert.equal(h.instances.length,1);
 const instance=h.instances[0];assert.equal(instance.options.playerVars.autoplay,0);
 current=false;instance.options.events.onReady({target:instance});
 assert.equal(await pending,false);assert.equal(instance.plays,0);assert.ok(instance.stops>0);
});
test('ordinary text playback retains its existing autoplay path',async t=>{
 const h=player(t);const pending=h.api.play({title:'Faixa',videoId:'abcdef12345',playable:true,embeddable:true});
 await new Promise(r=>setImmediate(r));const instance=h.instances[0];assert.equal(instance.options.playerVars.autoplay,1);
 instance.options.events.onReady({target:instance});instance.options.events.onStateChange({target:instance,data:1});
 assert.equal(await pending,true);assert.equal(h.api.getState(),'PLAYING');
});
