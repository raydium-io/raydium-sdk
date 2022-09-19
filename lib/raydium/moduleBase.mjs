import{get as b,set as R}from"lodash";import v from"dayjs";import k from"dayjs/plugin/utc";v.extend(k);var p=class{constructor(t){this.logLevel=t.logLevel!==void 0?t.logLevel:0,this.name=t.name}set level(t){this.logLevel=t}get time(){return v().utc().format("YYYY/MM/DD HH:mm:ss UTC")}get moduleName(){return this.name}isLogLevel(t){return t<=this.logLevel}error(...t){return this.isLogLevel(0)?(console.error(this.time,this.name,"sdk logger error",...t),this):this}logWithError(...t){let n=t.map(r=>typeof r=="object"?JSON.stringify(r):r).join(", ");throw new Error(n)}warning(...t){return this.isLogLevel(1)?(console.warn(this.time,this.name,"sdk logger warning",...t),this):this}info(...t){return this.isLogLevel(2)?(console.info(this.time,this.name,"sdk logger info",...t),this):this}debug(...t){return this.isLogLevel(3)?(console.debug(this.time,this.name,"sdk logger debug",...t),this):this}},x={},S={};function h(e){let t=b(x,e);if(!t){let n=b(S,e);t=new p({name:e,logLevel:n}),R(x,e,t)}return t}import{PACKET_DATA_SIZE as W,PublicKey as $,sendAndConfirmTransaction as I,Transaction as B}from"@solana/web3.js";var Y=h("Raydium_txTool"),d=class{constructor(t){this.instructions=[];this.endInstructions=[];this.signers=[];this.connection=t.connection,this.feePayer=t.feePayer,this.signAllTransactions=t.signAllTransactions,this.owner=t.owner}get AllTxData(){return{instructions:this.instructions,endInstructions:this.endInstructions,signers:this.signers}}get allInstructions(){return[...this.instructions,...this.endInstructions]}addInstruction({instructions:t=[],endInstructions:n=[],signers:r=[]}){return this.instructions.push(...t),this.endInstructions.push(...n),this.signers.push(...r),this}build(t){let n=new B;return this.allInstructions.length&&n.add(...this.allInstructions),n.feePayer=this.feePayer,{transaction:n,signers:this.signers,execute:async()=>{var o;let r=await A(this.connection);if(n.recentBlockhash=r,(o=this.owner)!=null&&o.isKeyPair)return I(this.connection,n,this.signers);if(this.signAllTransactions){this.signers.length&&n.partialSign(...this.signers);let a=await this.signAllTransactions([n]);return await this.connection.sendRawTransaction(a[0].serialize(),{skipPreflight:!0})}throw new Error("please connect wallet first")},extInfo:t||{}}}buildMultiTx(t){let{extraPreBuildData:n=[],extInfo:r}=t,{transaction:o}=this.build(r),a=n.filter(i=>i.transaction.instructions.length>0),f=[...a.map(i=>i.transaction),o],c=[...a.map(i=>i.signers),this.signers];return{transactions:f,signers:c,execute:async()=>{var T;let i=await A(this.connection);if((T=this.owner)!=null&&T.isKeyPair)return await Promise.all(f.map(async(l,g)=>(l.recentBlockhash=i,await I(this.connection,l,c[g]))));if(this.signAllTransactions){let l=f.map((s,u)=>(s.recentBlockhash=i,c[u].length&&s.partialSign(...c[u]),s)),g=await this.signAllTransactions(l),w=[];for(let s=0;s<g.length;s+=1){let u=await this.connection.sendRawTransaction(g[s].serialize(),{skipPreflight:!0});w.push(u)}return w}throw new Error("please connect wallet first")},extInfo:r||{}}}};async function A(e){var t,n;try{return((n=await((t=e.getLatestBlockhash)==null?void 0:t.call(e)))==null?void 0:n.blockhash)||(await e.getRecentBlockhash()).blockhash}catch{return(await e.getRecentBlockhash()).blockhash}}var m=(...e)=>e.map(t=>{try{return typeof t=="object"?JSON.stringify(t):t}catch{return t}}).join(", "),y=class{constructor({scope:t,moduleName:n}){this.disabled=!1;this.scope=t,this.logger=h(n)}createTxBuilder(t){return this.scope.checkOwner(),new d({connection:this.scope.connection,feePayer:t||this.scope.ownerPubKey,owner:this.scope.owner,signAllTransactions:this.scope.signAllTransactions})}logDebug(...t){this.logger.debug(m(t))}logInfo(...t){this.logger.info(m(t))}logAndCreateError(...t){let n=m(t);throw new Error(n)}checkDisabled(){(this.disabled||!this.scope)&&this.logAndCreateError("module not working")}};export{y as default};
//# sourceMappingURL=moduleBase.mjs.map