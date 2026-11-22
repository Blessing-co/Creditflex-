
/* Quick unlock (like mobile-money and banking apps): people stay signed in. The app asks for a PIN, or a fingerprint/face
   touch where the phone supports it, only when it was left for a while (or closed for a while). Never while someone is using it.
   Checked on the phone only; five wrong PINs or "Forgot PIN" send the person to the normal password sign-in. */
(function(){
 const uid=()=>S.me&&S.me.id, K=u=>"cf-pin:"+u, SN=u=>"cf-pin-later:"+u, BK=u=>"cf-bio:"+u, AK=u=>"cf-active:"+u;
 const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}}, lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}, lsDel=k=>{try{localStorage.removeItem(k);}catch(e){}};
 const getPin=()=>{try{return JSON.parse(lsGet(K(uid())));}catch(e){return null;}};
 const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
 const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 async function hash(pin,salt){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);return b64(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:100000,hash:"SHA-256"},k,256));}
 const weak=p=>!/^[0-9]{4}$/.test(p)||/^(\d)\1{3}$/.test(p)||["1234","4321","0123","1122","2580","1212"].includes(p);
 let hiddenAt=0,locked=false,bound=false,asked=false,lastMark=0;
 const awayMs=()=>((S.me&&S.me.role==="admin")?5:10)*60000;
 const mark=()=>{if(!S.me||locked)return;const n=Date.now();if(n-lastMark>10000){lastMark=n;lsSet(AK(uid()),String(n));}};
 const wrap=h=>{const d=document.createElement("div");d.id="cf-lock";d.className="fixed inset-0 z-[200] bg-surface flex items-center justify-center p-6";d.innerHTML='<div class="w-full max-w-xs space-y-4 text-center">'+h+'</div>';document.body.appendChild(d);return d;};
 const pinField=(id,label)=>'<label class="'+C.lbl+' block text-left" for="'+id+'">'+label+'</label><input id="'+id+'" type="password" data-noeye="1" inputmode="numeric" autocomplete="off" maxlength="4" class="'+C.inp+' text-center text-headline-md tracking-[0.5em]" placeholder="••••">';
 async function setPin(p){const s=new Uint8Array(16);crypto.getRandomValues(s);const salt=b64(s);lsSet(K(uid()),JSON.stringify({salt,hash:await hash(p,salt),tries:0}));}
 /* fingerprint / face through the phone's own screen-lock sensor (WebAuthn, platform authenticator) */
 const bioSupported=async()=>{try{return !!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());}catch(e){return false;}};
 const bioOn=()=>!!lsGet(BK(uid()));
 async function bioEnroll(){
  const ch=crypto.getRandomValues(new Uint8Array(32));
  const c=await navigator.credentials.create({publicKey:{challenge:ch,rp:{name:"Creditflex"},user:{id:new TextEncoder().encode(String(uid())).slice(0,64),name:S.me.email||S.me.full_name||"agent",displayName:S.me.full_name||"Agent"},pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"discouraged"},timeout:60000}});
  if(!c)throw Error("cancelled");lsSet(BK(uid()),b64(c.rawId));
 }
 async function bioCheck(){
  const id=lsGet(BK(uid()));if(!id)return false;
  try{const r=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:"public-key",id:unb64(id)}],userVerification:"required",timeout:60000}});return !!r;}catch(e){return false;}
 }
 function lock(){
  if(locked||!S.me||!getPin())return;locked=true;
  const bio=bioOn();
  const d=wrap('<div class="w-14 h-14 mx-auto rounded-full bg-primary-container text-on-primary flex items-center justify-center">'+ic("lock","text-[28px]")+'</div><h2 class="text-title-md">Welcome back, '+esc((S.me.full_name||"").split(" ")[0])+'</h2><p class="'+C.mute+'">'+(bio?"Touch the sensor, or enter your PIN.":"Enter your PIN to continue.")+'</p>'+pinField("cf-pin-in","PIN")+'<div id="cf-pin-msg"></div>'+(bio?'<button id="cf-bio-go" type="button" class="'+C.btn+' w-full">Use fingerprint or face</button>':'')+'<button id="cf-pin-forgot" type="button" class="'+C.btn2+' w-full">Forgot PIN? Sign in with password</button>');
  const inp=d.querySelector("#cf-pin-in");if(!bio)inp.focus();
  const unlock=()=>{d.remove();locked=false;mark();};
  const go=async()=>{
   const p=inp.value,rec=getPin();if(!rec)return unlock();
   if(!/^[0-9]{4}$/.test(p))return;
   if(await hash(p,rec.salt)===rec.hash){rec.tries=0;lsSet(K(uid()),JSON.stringify(rec));return unlock();}
   rec.tries=(rec.tries||0)+1;lsSet(K(uid()),JSON.stringify(rec));inp.value="";
   if(rec.tries>=5){lsDel(K(uid()));lsDel(BK(uid()));d.remove();locked=false;return logout("Too many wrong PINs. Sign in with your password.");}
   say("cf-pin-msg","Wrong PIN. "+(5-rec.tries)+" tries left.");
  };
  inp.oninput=()=>{if(inp.value.length===4)go();};inp.onkeydown=e=>{if(e.key==="Enter")go();};
  const tryBio=async()=>{if(await bioCheck())unlock();};
  if(bio){d.querySelector("#cf-bio-go").onclick=tryBio;tryBio();}
  d.querySelector("#cf-pin-forgot").onclick=()=>{lsDel(K(uid()));lsDel(BK(uid()));d.remove();locked=false;logout("Sign in with your password. You can set a new PIN afterwards.");};
 }
 async function ask(){
  const u=uid();if(asked||!u||getPin()||document.getElementById("cf-lock"))return;
  if(!S.me.onboarding_completed_at&&S.me.role!=="admin")return;
  if(Date.now()<Number(lsGet(SN(u))||0))return;
  asked=true;
  const canBio=await bioSupported();
  const d=wrap('<div class="w-14 h-14 mx-auto rounded-full bg-primary-container text-on-primary flex items-center justify-center">'+ic("lock","text-[28px]")+'</div><h2 class="text-title-md">Protect customer records</h2><p class="'+C.mute+'">You stay signed in. A 4-digit PIN'+(canBio?" (or your fingerprint)":"")+' is only asked if you leave the app for a while.</p>'+pinField("cf-pin-a","Choose a 4-digit PIN")+pinField("cf-pin-b","Type it again")+'<div id="cf-pin-msg"></div><button id="cf-pin-save" type="button" class="'+C.btn+' w-full">Save PIN</button><button id="cf-pin-later" type="button" class="'+C.btn2+' w-full">Not now</button>');
  d.querySelector("#cf-pin-save").onclick=async()=>{const a=d.querySelector("#cf-pin-a").value,b=d.querySelector("#cf-pin-b").value;
   if(weak(a))return say("cf-pin-msg","Choose 4 digits that are not easy to guess (not 1234, 0000 or repeated numbers).");
   if(a!==b)return say("cf-pin-msg","The two PINs do not match.");
   await setPin(a);d.remove();mark();
   if(canBio){try{await bioEnroll();}catch(e){/* fingerprint is optional */}}};
  d.querySelector("#cf-pin-later").onclick=()=>{lsSet(SN(u),String(Date.now()+7*864e5));d.remove();};
 }
 const check=()=>{if(!S.me||locked)return;if(getPin()&&hiddenAt&&Date.now()-hiddenAt>awayMs())lock();hiddenAt=0;};
 let started=false;
 window.cfIdleStart=function(){
  if(!bound){bound=true;["pointerdown","keydown","touchstart"].forEach(ev=>document.addEventListener(ev,mark,{passive:true,capture:true}));
   document.addEventListener("visibilitychange",()=>{if(document.hidden){hiddenAt=Date.now();lsSet(AK(uid()),String(hiddenAt));}else check();});}
  if(!started){started=true;/* app just opened: was it closed for a while? */const t=Number(lsGet(AK(uid()))||0);if(t&&Date.now()-t>awayMs()&&getPin())lock();else mark();}
  ask();
 };
 window.cfIdleStop=function(){const d=document.getElementById("cf-lock");if(d)d.remove();locked=false;asked=false;started=false;};
 window.cfPinState=()=>({set:!!getPin(),bio:bioOn()});
 window.cfBioSupported=bioSupported;
 window.cfBioEnable=async function(){await bioEnroll();};
 window.cfBioDisable=function(){lsDel(BK(uid()));};
 window.cfPinChange=async function(){asked=false;lsDel(K(uid()));lsDel(SN(uid()));ask();};
 window.cfPinRemove=function(){lsDel(K(uid()));lsDel(BK(uid()));};
})();
