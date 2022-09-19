import{PublicKey as Te}from"@solana/web3.js";import b,{isBN as we}from"bn.js";import{bits as S,BitStructure as w,blob as m,Blob as _,cstr as B,f32 as U,f32be as k,f64 as I,f64be as C,greedy as D,Layout as l,ns64 as E,ns64be as N,nu64 as A,nu64be as V,offset as v,s16 as K,s16be as q,s24 as R,s24be as F,s32 as G,s32be as O,s40 as j,s40be as z,s48 as M,s48be as H,s8 as J,seq as Q,struct as X,Structure as g,u16 as Y,u16be as Z,u24 as $,u24be as W,u32 as ee,u32be as te,u40 as ne,u40be as re,u48 as oe,u48be as se,u8 as ue,UInt as L,union as ae,Union as ie,unionLayoutDiscriminator as ye,utf8 as ce}from"@solana/buffer-layout";var P=l,d=g;var x=L;var f=m;var s=class extends P{constructor(e,r,n){super(e,n);this.blob=f(e),this.signed=r}decode(e,r=0){let n=new b(this.blob.decode(e,r),10,"le");return this.signed?n.fromTwos(this.span*8).clone():n}encode(e,r,n=0){return typeof e=="number"&&(e=new b(e)),this.signed&&(e=e.toTwos(this.span*8)),this.blob.encode(e.toArrayLike(Buffer,"le",this.span),r,n)}};function a(t){return new x(1,t)}function i(t){return new s(8,!1,t)}var u=class extends d{decode(o,e){return super.decode(o,e)}};function y(t,o,e){return new u(t,o,e)}var Ie=y([a("instruction"),i("amountIn"),i("amountOut")]),Ce=y([a("instruction")]);export{Ie as routeSwapInLayout,Ce as routeSwapOutLayout};
//# sourceMappingURL=layout.mjs.map