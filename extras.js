/* Creditflex enhancements: onboarding, analytics, settings, credits and offline queue. */
(function(){
"use strict";
const cfSteps=[
 {title:"The menu",target:"collections",body:"Everything in Creditflex is reached from the Menu button at the top right. It lists every page and also holds Sign out.",task:"Tap the Menu button.",hl:"#menuBtn",watch:["#menuBtn","click"]},
 {title:"Collections",target:"collections",body:"Collections is the money that has come in. Pick a date range to see how much was collected and by whom. Only payments saved online are counted.",task:"Tap Show to load today's collections.",hl:"#go",watch:["#go","click"]},
 {title:"Find a customer",target:"register",pre:()=>{S.cmode="find";},body:"The Customers page is your address book. Open any customer to see their statement: what they bought, what they have paid and what they still owe. You can send it to them on WhatsApp.",task:"Type a name, then tap a customer.",hl:"#sq",watch:["[data-c]","click"]},
 {title:"Record a payment",target:"pay",body:"You will use this page every day. Record the money the moment a customer hands it over, so the balance is always true. Pick the customer, check the item and amount, then save. The app warns you if that customer already paid for the same item today.",task:"Type a customer's name, then tap it. Do not tap Save unless it is a real payment.",hl:"#q",watch:[".pick","click"]},
 {title:"Register a new customer",target:"register",pre:()=>{S.cmode="find";},body:"When someone buys an item on instalments, register them once here: name, phone, place, the product and the payment plan. The app works out how much they pay each time.",task:"Tap New customer to see the form. Only fill it in for a real sale.",hl:'[data-cm="new"]',watch:['[data-cm="new"]',"click"]},
 {title:"Catalogue",target:"catalogue",body:"The Catalogue shows every product and its full price, so you can answer customers when they ask what is available.",task:"Scroll and look around, then tap Next."},
 {title:"Analytics",target:"analytics",body:"Analytics shows totals and trends for the days you choose, for example which days brought in the most money.",task:"Tap 7 days.",hl:'[data-r="6"]',watch:['[data-r="6"]',"click"]},
 {title:"Settings and offline",target:"settings",body:"Choose how the app looks. If you ever have no internet, payments are kept safely on your phone and sent when you are back online. The admin only sees them after they have been sent.",task:"Tap Dark, then tap Light again.",hl:"#cf-theme",watch:["#cf-theme button","click"]},
 {title:"Account",target:"account",body:"Your details and password live here (Menu, Settings, Account). Change your password if you ever think someone else knows it."},
 {title:"Help and credit",target:"credit",body:"Need help? Call or WhatsApp us from this page. You can read How it works from Menu, then Help, at any time to refresh your memory."}
];
/* uuid that also works on older browsers */
function cfUuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();const b=new Uint8Array(16);(window.crypto||{getRandomValues:a=>a.forEach((_,i)=>a[i]=Math.random()*256)}).getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);}
/* read-through cache: fresh data when online (and saved), the saved copy when the network fails */
async function cfRead(key,run){
 const k="read:"+(S.me?S.me.id:"x")+":"+key;
 if(!navigator.onLine){try{const c=await cfCacheGet(k);if(c&&c.data){window.cfStaleAt=c.cached_at;return {data:c.data,error:null,stale:c.cached_at};}}catch(x){}}
 const res=await run();
 if(!res.error){try{await cfCachePut(k,{data:res.data,cached_at:new Date().toISOString()});}catch(x){}return res;}
 try{const c=await cfCacheGet(k);if(c&&c.data){window.cfStaleAt=c.cached_at;return {data:c.data,error:null,stale:c.cached_at};}}catch(x){}
 return res;
}
let cfStep=0,cfActive=cfSteps;
const cfDBName="creditflex-offline-v1",cfStore="pending-payments";
function cfOpenDB(){return new Promise((resolve,reject)=>{if(!("indexedDB" in window))return reject(Error("Offline storage is not supported on this browser."));const req=indexedDB.open(cfDBName,2);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(cfStore))db.createObjectStore(cfStore,{keyPath:"id"});if(!db.objectStoreNames.contains("purchase-cache"))db.createObjectStore("purchase-cache",{keyPath:"id"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function cfAll(){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const q=db.transaction(cfStore,"readonly").objectStore(cfStore).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});}
async function cfPut(row){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const tx=db.transaction(cfStore,"readwrite");tx.objectStore(cfStore).put(row);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function cfDelete(id){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const tx=db.transaction(cfStore,"readwrite");tx.objectStore(cfStore).delete(id);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function cfCachePut(id,value){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const tx=db.transaction("purchase-cache","readwrite");tx.objectStore("purchase-cache").put({id,...value});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function cfCacheGet(id){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const q=db.transaction("purchase-cache","readonly").objectStore("purchase-cache").get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);});}
async function cfCacheLedger(rows){if(!S.me)return;await cfCachePut("ledger:"+S.me.id,{rows,cached_at:new Date().toISOString()});}
async function cfCachedLedger(){return S.me?cfCacheGet("ledger:"+S.me.id):null;}
async function cfCacheRecent(rows){if(!S.me)return;await cfCachePut("recent:"+S.me.id,{rows,cached_at:new Date().toISOString()});}
async function cfCachedRecent(){return S.me?cfCacheGet("recent:"+S.me.id):null;}
function cfIsRecentDuplicate(row,recent){const day=today();return (recent||[]).some(p=>Number(p.customer_id)===Number(row.customer_id)&&Number(p.product_id)===Number(row.product_id)&&new Date(p.created_at).toLocaleDateString("en-CA")===day);}
async function cfHasQueuedDuplicate(row){const rows=await cfAll();return rows.some(p=>p.collected_by===S.me.id&&Number(p.customer_id)===Number(row.customer_id)&&Number(p.product_id)===Number(row.product_id)&&new Date(p.queued_at).toLocaleDateString("en-CA")===today());}
Object.assign(window,{cfRead,cfUuid,cfCacheLedger,cfCachedLedger,cfCacheRecent,cfCachedRecent,cfIsRecentDuplicate,cfHasQueuedDuplicate,cfAll});
window.queueCreditflexRegistration=async function(row){try{await cfPut({id:cfUuid(),kind:"register",owner:S.me.id,...row,queued_at:new Date().toISOString(),status:"pending"});return true;}catch(x){console.error("Offline queue error",x);return false;}};
window.queueCreditflexPayment=async function(row){try{await cfPut({id:cfUuid(),...row,queued_at:new Date().toISOString(),status:"pending"});return true;}catch(e){console.error("Offline queue error",e);return false;}};
async function cfSyncInner(){
 if(!navigator.onLine||!S.me)return;
 let rows;try{rows=await cfAll();}catch(e){return;}
 for(const row of rows){
  if(row.kind==="register"){
   if(row.owner!==S.me.id||row.status==="needs-attention")continue;
   try{
    const r=await sb.rpc("register_customer",{p_full_name:row.p_full_name,p_phone:row.p_phone,p_location:row.p_location,p_product_id:row.p_product_id,p_plan_id:row.p_plan_id,p_submission_id:row.id});
    if(!r.error){await cfDelete(row.id);continue;}
    const m=String(r.error.message||"");
    if(/failed to fetch|network|load failed|timeout|connection/i.test(m))break;
    await cfPut({...row,status:"needs-attention",last_error:m});
   }catch(x){break;}
   continue;
  }
  if(row.collected_by!==S.me.id)continue;
  try{
   const existing=await sb.from("payments").select("id").eq("offline_submission_id",row.id).maybeSingle();
   if(existing.data){await cfDelete(row.id);continue;}
   const payload={purchase_id:row.purchase_id,amount:row.amount,paid_on:row.paid_on,collected_by:row.collected_by,offline_submission_id:row.id};
   const result=await sb.from("payments").insert(payload);
   if(!result.error){await cfDelete(row.id);continue;}
   const msg=String(result.error.message||"");
   if(/duplicate key|unique constraint/i.test(msg)){
    const check=await sb.from("payments").select("id").eq("offline_submission_id",row.id).maybeSingle();
    if(check.data){await cfDelete(row.id);continue;}
   }
   if(/failed to fetch|network|load failed|timeout|connection/i.test(msg))break;
   await cfPut({...row,status:"needs-attention",last_error:msg});
  }catch(e){break;}
 }
 try{localStorage.setItem("creditflex-last-sync",new Date().toISOString());}catch(e){}
 if(typeof window.refreshCreditflexQueueCount==="function")window.refreshCreditflexQueueCount();
}
let cfSyncBusy=false;
window.syncCreditflexOfflineQueue=async function(){if(cfSyncBusy)return;cfSyncBusy=true;try{await cfSyncInner();}finally{cfSyncBusy=false;}};
let cfWatch=null,cfHlTimer=null,cfMin=false;
function cfClearCoach(){const m=document.getElementById("cf-tour");if(m)m.remove();if(cfWatch){document.removeEventListener(cfWatch.ev,cfWatch.fn,true);cfWatch=null;}if(cfHlTimer){clearInterval(cfHlTimer);cfHlTimer=null;}document.querySelectorAll(".cf-hl").forEach(e=>e.classList.remove("cf-hl"));document.body.classList.remove("cf-coaching");}
function cfModal(){cfClearCoach();const m=document.createElement("div");m.id="cf-tour";m.className="cf-coach";m.innerHTML='<section class="cf-coach-card" role="region" aria-label="Guided tour"><div class="cf-coach-top"><span id="cf-tour-count"></span><span><button id="cf-tour-min" type="button" aria-label="Hide or show tips">Hide</button><button id="cf-tour-all" type="button">Skip training</button></span></div><h2 id="cf-tour-title"></h2><div id="cf-coach-more"><p id="cf-tour-body"></p><p id="cf-tour-task"></p></div><div class="cf-tour-track"><div id="cf-tour-progress"></div></div><div class="cf-tour-actions"><button id="cf-tour-back" type="button">Back</button><button id="cf-tour-next" type="button">Next</button></div></section>';document.body.appendChild(m);document.body.classList.add("cf-coaching");return m;}
async function cfFinishTour(){cfClearCoach();try{const {error}=await sb.rpc("complete_agent_onboarding");if(error)console.warn("Could not save onboarding completion",error.message);else if(S.me)S.me.onboarding_completed_at=new Date().toISOString();}catch(e){console.warn(e);}S.tab="collections";renderShell();}
function cfShowStep(){
 const s=cfActive[cfStep];
 if(S.tab!==s.target||s.pre){if(s.pre)s.pre();S.tab=s.target;renderShell();}
 const m=cfModal(),last=cfStep===cfActive.length-1;
 m.querySelector("#cf-tour-count").textContent="STEP "+(cfStep+1)+" OF "+cfActive.length;
 m.querySelector("#cf-tour-title").textContent=s.title;
 m.querySelector("#cf-tour-body").textContent=s.body;
 const task=m.querySelector("#cf-tour-task");task.textContent=s.task?"Try it: "+s.task:"";task.style.display=s.task?"block":"none";
 m.querySelector("#cf-tour-progress").style.width=((cfStep+1)/cfActive.length*100)+"%";
 const next=m.querySelector("#cf-tour-next");next.textContent=last?"Finish":"Next";
 const back=m.querySelector("#cf-tour-back");back.disabled=cfStep===0;
 back.onclick=()=>{if(cfStep>0){cfStep--;cfShowStep();}};
 next.onclick=()=>{if(!last){cfStep++;cfShowStep();}else cfFinishTour();};
 m.querySelector("#cf-tour-all").onclick=cfFinishTour;
 const more=m.querySelector("#cf-coach-more"),minb=m.querySelector("#cf-tour-min");
 const applyMin=()=>{more.style.display=cfMin?"none":"block";minb.textContent=cfMin?"Show":"Hide";};
 minb.onclick=()=>{cfMin=!cfMin;applyMin();};applyMin();
 if(s.watch){const sel=s.watch[0];cfWatch={ev:s.watch[1],fn:e=>{if(e.target&&e.target.closest&&e.target.closest(sel)){task.textContent="Done. Nice work! Tap Next when you are ready.";task.classList.add("done");next.classList.add("ready");}}};document.addEventListener(cfWatch.ev,cfWatch.fn,true);}
 if(s.hl){let scrolled=false;const apply=()=>{const t=document.querySelector(s.hl);if(t&&!t.classList.contains("cf-hl")){document.querySelectorAll(".cf-hl").forEach(e=>e.classList.remove("cf-hl"));t.classList.add("cf-hl");if(!scrolled){scrolled=true;try{t.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}}}};apply();cfHlTimer=setInterval(apply,400);}
}
function cfWelcome(){
 let m=document.getElementById("cf-tour");if(m)m.remove();
 m=document.createElement("div");m.id="cf-tour";m.className="cf-tour-backdrop";
 m.innerHTML='<section class="cf-tour-card" role="dialog" aria-modal="true"><span id="cf-tour-count">WELCOME</span><h2 id="cf-tour-title">Quick tour of Creditflex</h2><p id="cf-tour-body">Tick the parts you want to practise, or skip it all. The tour shows you each page and lets you try it yourself. You can replay it any time in Settings.</p><div class="cf-pick">'+cfSteps.map((s,i)=>'<label><input type="checkbox" data-i="'+i+'" checked> <span>'+esc(s.title)+'</span></label>').join("")+'</div><button id="cf-w-learn" type="button" class="cf-linkbtn">New to this kind of business? Read the basics first</button><div class="cf-tour-actions"><button id="cf-w-skip" type="button">Skip entirely</button><button id="cf-w-go" type="button">Start tour</button></div></section>';
 document.body.appendChild(m);
 m.querySelector("#cf-w-skip").onclick=cfFinishTour;
 m.querySelector("#cf-w-learn").onclick=()=>{m.remove();S.tab="learn";renderShell();};
 m.querySelector("#cf-w-go").onclick=()=>{const picked=[...m.querySelectorAll("input:checked")].map(i=>cfSteps[Number(i.dataset.i)]);if(!picked.length)return cfFinishTour();cfActive=picked;cfStep=0;cfShowStep();};
}
window.startCreditflexTour=function(replay){if(!S.me)return;if(!replay&&(S.me.role!=="agent"||S.me.onboarding_completed_at))return;cfWelcome();};

window.viewCreditflexLearn=function(){
 const v=$("view"),sec=(ic_,t,b)=>'<section class="'+C.card+' space-y-2"><div class="flex items-center gap-2">'+ic(ic_,"text-[22px] text-primary")+'<h2 class="text-title-md">'+t+'</h2></div>'+b+'</section>';
 const li=a=>'<ol class="list-decimal pl-5 space-y-1.5 '+C.mute+'">'+a.map(x=>'<li>'+x+'</li>').join("")+'</ol>';
 const ul=a=>'<ul class="list-disc pl-5 space-y-1.5 '+C.mute+'">'+a.map(x=>'<li>'+x+'</li>').join("")+'</ul>';
 const term=(t,d)=>'<details class="rounded-xl bg-surface-container-low px-3 py-2"><summary class="font-bold cursor-pointer min-h-[32px] flex items-center">'+t+'</summary><p class="'+C.mute+' pt-1 pb-1">'+d+'</p></details>';
 v.innerHTML='<h1 class="'+C.h1+'">How it works</h1>'
 +sec("info","What is this business?","<p class=\""+C.mute+"\">Creditflex sells goods such as blenders and TVs to people who cannot pay the full price at once. Instead of paying everything on day one, the customer takes the item home and pays a small amount again and again, every day or every week, until the full price is paid. This is called selling on credit, or instalment selling.</p><p class=\""+C.mute+"\">You, the agent, are the link between the customer and the company. You register the customer, collect their small payments and record each one in this app. The money is only truly safe when the record is true.</p>")
 +sec("group","Who is who",ul(["<b>Customer</b>: the person who buys an item and pays it off in small amounts.","<b>Agent (you)</b>: registers customers and collects and records their payments.","<b>Admin</b>: the manager who approves agents, sees all the money collected and what is still owed, and fixes mistakes."]))
 +sec("school","A simple example","<p class=\""+C.mute+"\">Ama wants a blender that costs <b>GH₵ 240</b>. She cannot pay that today, so she picks a plan: <b>GH₵ 30 every week for 8 weeks</b>.</p>"+ul(["Week 0: you register Ama. She takes the blender home. She owes GH₵ 240.","Week 1: she pays GH₵ 30. You record it. She now owes GH₵ 210.","Week 3: she has paid GH₵ 90 in total. She owes GH₵ 150.","Week 8: the last GH₵ 30 is paid. She owes nothing and the purchase is complete."]))
 +sec("payments","Your day in the app",li(["Open <b>Customers</b> and register any new buyer once. Choose the product and the plan.","Visit your customers. When one pays, open <b>Record payment</b>, find them, check the item and the amount, and tap Save straight away.","At the end of the day open <b>Collections</b> to see your total. It should match the cash you collected.","Hand over the money to your admin the way you have been told to."]))
 +sec("verified","Golden rules",ul(["Record a payment only after you have received the money, and record it right away.","Check the customer's name and the item before you save. Two customers can have the same name.","Never record the same payment twice. The app warns you if that customer already paid for the item today. Tap Save anyway only if they really paid again.","If you make a mistake, tell your admin. Only the admin can cancel a payment, and every cancellation is written in a log.","No internet? You can still record payments. They wait on your phone and are sent when you are online again. The admin cannot see them until then.","Never share your password, and sign out on a phone that is not yours."]))
 +sec("search","Words you will see",'<div class="space-y-2">'+term("Product and price","What the customer is buying and the full price they must finish paying.")+term("Payment plan","How often and how many times the customer pays, for example daily for 30 days or weekly for 8 weeks.")+term("Instalment","One small payment. The app works it out from the price and the plan.")+term("Purchase","One customer buying one item on one plan. A customer can have several purchases.")+term("Balance","What the customer still owes on a purchase. It goes down with every payment.")+term("Collections","The total money collected in a period, shown per agent and per day.")+term("Statement","A summary for one customer of what they bought, paid and still owe. You can send it on WhatsApp.")+term("Cancelled (voided) payment","A wrong payment the admin has reversed. It no longer counts in totals, but the record stays in the log.")+'</div>')
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Ready to practise?</h2><p class="'+C.mute+'">The guided tour walks you through each page and lets you try it yourself.</p><button id="cf-learn-tour" class="'+C.btn+'" type="button">'+ic("school","text-[22px]")+'<span>Start the guided tour</span></button></section>';
 $("cf-learn-tour").onclick=()=>startCreditflexTour(true);
};
window.viewCreditflexAnalytics=async function(){
 const v=$("view");v.innerHTML='<h1 class="'+C.h1+'">Analytics</h1><section class="'+C.card+' space-y-3"><div class="grid grid-cols-2 gap-3"><div><label class="'+C.lbl+'">From</label><input id="cfa" type="date" class="'+C.inp+'" value="'+today()+'"></div><div><label class="'+C.lbl+'">To</label><input id="cfb" type="date" class="'+C.inp+'" value="'+today()+'"></div></div><div class="flex gap-2 flex-wrap" id="cf-chips"><button type="button" data-r="0" class="'+C.btn2+'">Today</button><button type="button" data-r="6" class="'+C.btn2+'">7 days</button><button type="button" data-r="29" class="'+C.btn2+'">30 days</button><button type="button" data-r="m" class="'+C.btn2+'">This month</button></div><button id="cf-run" class="'+C.btn+'">Refresh analytics</button><div id="cf-analytics-msg"></div></section><div id="cf-analytics-out">'+loading+'</div>';
 async function load(){const out=$("cf-analytics-out");out.innerHTML=loading;const {data,error}=await cfLoadAll("payments","id,amount,paid_on,collected_by",["paid_on","id"],q=>q.gte("paid_on",$("cfa").value).lte("paid_on",$("cfb").value).is("voided_at",null));if(error){out.innerHTML='<div class="bg-error-container rounded-xl p-4">'+esc(cfErr(error))+'</div>';return;}const rows=data||[],total=rows.reduce((n,p)=>n+Number(p.amount||0),0),byDay={};rows.forEach(p=>byDay[p.paid_on]=(byDay[p.paid_on]||0)+Number(p.amount||0));const days=Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0]));const max=Math.max(1,...days.map(x=>x[1]));let names={};try{const ids=[...new Set(rows.map(x=>x.collected_by).filter(Boolean))];if(ids.length){const staff=await sb.from("staff").select("id,full_name").in("id",ids);(staff.data||[]).forEach(s=>names[s.id]=s.full_name);}}catch(e){}const byAgent={};rows.forEach(p=>{const k=p.collected_by||"unknown";byAgent[k]=(byAgent[k]||0)+Number(p.amount||0);});const queued=await cfAll().catch(()=>[]);let owed=0;try{const pr=await sb.rpc("portfolio_summary");owed=(pr.data||[]).reduce((n,x)=>n+Number(x.outstanding||0),0);}catch(e){}const topE=Object.entries(byAgent).sort((a,b)=>b[1]-a[1])[0];const topName=topE?(names[topE[0]]||(topE[0]===S.me.id?S.me.full_name:"Agent")):"-";out.innerHTML='<section class="grid grid-cols-2 gap-3"><article class="'+C.card+'"><div class="'+C.mute+'">Total collected</div><div class="text-2xl font-extrabold mt-1">'+money(total)+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Payments recorded</div><div class="text-2xl font-extrabold mt-1">'+rows.length+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Average payment</div><div class="text-xl font-bold mt-1">'+money(rows.length?total/rows.length:0)+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Waiting on this phone</div><div class="text-2xl font-extrabold mt-1">'+queued.length+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Still owed (all time)</div><div class="text-xl font-bold mt-1">'+money(owed)+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Top agent</div><div class="text-xl font-bold mt-1">'+esc(topName)+'</div></article></section><section class="'+C.card+' space-y-3"><h2 class="text-title-md">Daily collections</h2>'+(days.length?days.map(([d,n])=>'<div><div class="flex justify-between text-sm mb-1"><span>'+esc(d)+'</span><b>'+money(n)+'</b></div><div class="h-2 bg-surface-container-high rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:'+(n/max*100)+'%"></div></div></div>').join(""):'<p class="'+C.mute+'">No payments in this date range.</p>')+'</section><section class="'+C.card+' space-y-2"><h2 class="text-title-md">By agent</h2>'+Object.entries(byAgent).sort((a,b)=>b[1]-a[1]).map(([id,n])=>'<div class="flex justify-between gap-3 border-b border-slate-200 py-2"><span>'+esc(names[id]|| (id===S.me.id?S.me.full_name:"Agent"))+'</span><b>'+money(n)+'</b></div>').join("")+'</section>'; }
 $("cf-chips").querySelectorAll("button").forEach(b=>b.onclick=()=>{const t=new Date(),f=new Date();if(b.dataset.r==="m")f.setDate(1);else f.setDate(t.getDate()-Number(b.dataset.r));$("cfa").value=f.toLocaleDateString("en-CA");$("cfb").value=t.toLocaleDateString("en-CA");load();});
 $("cf-run").onclick=load;load();
};
window.viewCreditflexSettings=async function(){
 const v=$("view"),theme=localStorage.getItem("creditflex-theme")||"light",accent=localStorage.getItem("creditflex-accent")||"green",buzz=localStorage.getItem("creditflex-buzz")!=="off";
 const last=localStorage.getItem("creditflex-last-sync");
 const seg=(id,opts,cur)=>'<div class="cf-seg" id="'+id+'">'+opts.map(o=>'<button type="button" data-v="'+o[0]+'" class="'+(o[0]===cur?"on":"")+'">'+o[1]+'</button>').join("")+'</div>';
 const sw=Object.keys(CF_ACCENTS).map(k=>'<button type="button" class="cf-sw'+(k===accent?" on":"")+'" data-a="'+k+'" aria-label="'+k+' colour" style="background:'+CF_ACCENTS[k][0]+'"></button>').join("");
 v.innerHTML='<h1 class="'+C.h1+'">Settings</h1>'
 +'<section class="'+C.card+' space-y-4"><div class="flex items-center gap-2">'+ic("palette","text-[22px] text-primary")+'<h2 class="text-title-md">Look and feel</h2></div><div><div class="'+C.lbl+'">Theme</div>'+seg("cf-theme",[["auto","Auto"],["light","Light"],["dark","Dark"]],theme)+'</div><div><div class="'+C.lbl+'">Accent colour</div><div class="flex gap-3 flex-wrap" id="cf-accents">'+sw+'</div></div><p id="cf-theme-msg" class="'+C.mute+'">Saved on this phone.</p></section>'
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Preferences</h2><label class="flex items-center justify-between gap-3 min-h-12"><span><b class="block">Vibrate when a payment is saved</b><span class="'+C.mute+'">A short buzz so you know it worked.</span></span><input id="cf-buzz" type="checkbox" class="w-6 h-6 accent-primary" '+(buzz?"checked":"")+'></label></section>'
 +'<section class="'+C.card+' space-y-3"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">'+ic("sync","text-[22px] text-primary")+'<h2 class="text-title-md">Offline payments</h2></div><span class="cf-pill '+(navigator.onLine?"ok":"off")+'">'+(navigator.onLine?"Online":"Offline")+'</span></div><p class="'+C.mute+'">Payments saved without internet wait here until they sync. The admin cannot see them before then.</p><p class="'+C.mute+'">Last sync: '+(last?esc(new Date(last).toLocaleString()):"not yet")+'</p><div id="cf-queue-list">'+loading+'</div><button id="cf-sync" class="'+C.btn+'">'+ic("sync","text-[22px]")+'<span>Sync now</span></button></section>'
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Help and device</h2><button id="cf-learn" type="button" class="'+C.btn2+' w-full">'+ic("info","text-[22px]")+'<span>How Creditflex works (for beginners)</span></button><button id="cf-replay" type="button" class="'+C.btn2+' w-full">'+ic("school","text-[22px]")+'<span>Start the guided tour</span></button><button id="cf-install" type="button" class="'+C.btn2+' w-full">'+ic("grid_view","text-[22px]")+'<span>Add Creditflex to home screen</span></button><p id="cf-install-msg" class="'+C.mute+'"></p><button id="cf-clear" type="button" class="'+C.btn2+' w-full">'+ic("delete","text-[22px]")+'<span>Clear saved customer list</span></button><p class="'+C.mute+'">Clearing does not delete payments waiting to sync.</p><p id="cf-clear-msg" class="'+C.mute+'"></p></section>'
 +'<section class="'+C.card+' space-y-1"><h2 class="text-title-md">About</h2><p class="'+C.mute+'">Creditflex Agents · version 2.1</p><p class="'+C.mute+'">Signed in as '+esc(S.me.full_name)+' ('+esc(S.me.role)+')</p></section>';
 $("cf-theme").querySelectorAll("button").forEach(b=>b.onclick=()=>{cfApplyTheme(b.dataset.v);$("cf-theme").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));$("cf-theme-msg").textContent="Theme saved on this phone.";});
 $("cf-accents").querySelectorAll("button").forEach(b=>b.onclick=()=>{cfApplyAccent(b.dataset.a);$("cf-accents").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));$("cf-theme-msg").textContent="Colour saved on this phone.";});
 $("cf-buzz").onchange=e=>{try{localStorage.setItem("creditflex-buzz",e.target.checked?"on":"off");}catch(x){}if(e.target.checked)cfBuzz();};
 $("cf-sync").onclick=async()=>{const b=$("cf-sync");busy(b,true);await syncCreditflexOfflineQueue();busy(b,false);await cfRenderQueue();};
 $("cf-learn").onclick=()=>{S.tab="learn";renderShell();};
 $("cf-replay").onclick=()=>startCreditflexTour(true);
 $("cf-install").onclick=async()=>{if(cfInstall){cfInstall.prompt();cfInstall=null;}else $("cf-install-msg").textContent="Open your browser menu and choose Add to Home Screen (or Install app).";};
 $("cf-clear").onclick=async()=>{if(!confirm("Clear the saved customer list on this phone? You can reload it when online."))return;try{await cfClearCache();$("cf-clear-msg").textContent="Saved customer list cleared.";}catch(e){$("cf-clear-msg").textContent="Could not clear: "+e.message;}};
 await cfRenderQueue();
};
async function cfRenderQueue(){const el=$("cf-queue-list");if(!el)return;const rows=await cfAll().catch(()=>[]);el.innerHTML=rows.length?rows.map(r=>r.kind==="register"?'<div class="border-b border-slate-200 py-2"><div class="flex justify-between gap-2"><b>'+esc(r.p_full_name)+'</b><b>New customer</b></div><p class="text-sm opacity-70">'+esc(r.product_label||"Purchase")+' · '+esc(r.status)+'</p>'+(r.last_error?'<p class="text-sm text-red-700">'+esc(r.last_error)+'</p>':'')+'</div>':'<div class="border-b border-slate-200 py-2"><div class="flex justify-between gap-2"><b>'+esc(r.customer_name||"Customer")+'</b><b>'+money(r.amount)+'</b></div><p class="text-sm opacity-70">'+esc(r.product_name||"Purchase")+' · '+esc(r.paid_on)+' · '+esc(r.status)+'</p>'+(r.last_error?'<p class="text-sm text-red-700">'+esc(r.last_error)+'</p>':'')+'</div>').join(""):'<p class="'+C.mute+'">Nothing waiting to sync.</p>';}
window.refreshCreditflexQueueCount=cfRenderQueue;
window.viewCreditflexAccount=async function(){
 const v=$("view");v.innerHTML='<h1 class="'+C.h1+'">Account</h1><section class="'+C.card+' space-y-2"><div class="text-title-md">'+esc(S.me.full_name)+'</div><p class="'+C.mute+'">'+esc(S.me.email||"No email on file")+'</p><p class="'+C.mute+'">Role: '+esc(S.me.role)+'</p></section><section class="'+C.card+' space-y-3"><h2 class="text-title-md">Change password</h2><form id="cf-password-form" class="space-y-3"><div><label class="'+C.lbl+'" for="cf-current">Current password</label><input id="cf-current" type="password" autocomplete="current-password" class="'+C.inp+'" required></div><div><label class="'+C.lbl+'" for="cf-new">New password</label><input id="cf-new" type="password" autocomplete="new-password" minlength="8" class="'+C.inp+'" required><p class="'+C.mute+' mt-1">Use at least 8 characters with letters and numbers.</p></div><div><label class="'+C.lbl+'" for="cf-confirm">Confirm new password</label><input id="cf-confirm" type="password" autocomplete="new-password" minlength="8" class="'+C.inp+'" required></div><button id="cf-password-save" class="'+C.btn+'">Update password</button><div id="cf-password-msg"></div></form></section>';
 $("cf-password-form").onsubmit=async e=>{e.preventDefault();const b=$("cf-password-save"),current=$("cf-current").value,next=$("cf-new").value,confirmPass=$("cf-confirm").value;{const pwIssue=cfPwIssue(next);if(pwIssue)return say("cf-password-msg",pwIssue);}if(next!==confirmPass)return say("cf-password-msg","The new passwords do not match.");if(next===current)return say("cf-password-msg","Choose a password different from your current password.");busy(b,true);const auth=await sb.auth.signInWithPassword({email:S.me.email,password:current});if(auth.error){busy(b,false);return say("cf-password-msg","Current password could not be verified.");}const changed=await sb.auth.updateUser({password:next});busy(b,false);if(changed.error)return say("cf-password-msg",changed.error.message);$("cf-current").value="";$("cf-new").value="";$("cf-confirm").value="";say("cf-password-msg","Password updated successfully.",true);};
};
window.viewCreditflexFinancial=async function(){
 const v=$("view");v.innerHTML='<h1 class="'+C.h1+'">Financial review</h1><p class="'+C.mute+'">Admin-only payment review, reversals and audit history.</p><div id="cf-financial-list">'+loading+'</div>';
 const [pay,ledger,staff,audit]=await Promise.all([
  sb.from("payments").select("id,purchase_id,amount,paid_on,collected_by,created_at,voided_at,void_reason").order("created_at",{ascending:false}).limit(150),
  cfLoadAll("purchase_ledger","purchase_id,customer_name,customer_phone,product_name,agent_name","purchase_id"),
  cfLoadAll("staff","id,full_name","id"),
  sb.from("payment_audit_log").select("*").order("event_at",{ascending:false}).limit(150)
 ]);
 if(pay.error){$("cf-financial-list").innerHTML='<div class="bg-error-container rounded-xl p-4">'+esc(cfErr(pay.error))+'</div>';return;}
 const purchases=new Map((ledger.data||[]).map(x=>[String(x.purchase_id),x])),people=new Map((staff.data||[]).map(x=>[x.id,x.full_name]));
 const rows=pay.data||[];
 $("cf-financial-list").innerHTML='<section class="'+C.card+' space-y-3"><div class="flex items-center justify-between gap-2"><h2 class="text-title-md">Recent payments</h2><span class="'+C.mute+'">'+rows.length+' shown</span></div>'+(rows.length?rows.map(p=>{const x=purchases.get(String(p.purchase_id))||{};return '<article class="border-b border-outline-variant/50 py-3 space-y-2"><div class="flex justify-between gap-3"><div class="min-w-0"><b>'+esc(x.customer_name||("Purchase #"+p.purchase_id))+'</b><p class="'+C.mute+'">'+esc(x.product_name||"")+' · '+esc(people.get(p.collected_by)||"Agent")+'</p><p class="'+C.mute+'">'+esc(p.paid_on)+' · '+esc(String(p.created_at||"").replace("T"," ").slice(0,16))+'</p></div><div class="text-right shrink-0"><b>'+money(p.amount)+'</b><p class="text-xs '+(p.voided_at?"text-red-600":"text-emerald-700")+'">'+(p.voided_at?"Reversed":"Recorded")+'</p></div></div>'+(p.voided_at?'<p class="text-sm text-red-700">Reason: '+esc(p.void_reason||"Not provided")+'</p>':'<button type="button" data-void="'+p.id+'" class="'+C.btn2+' w-full">Reverse payment</button>')+'</article>';}).join(""):'<p class="'+C.mute+'">No payments found.</p>')+'</section><section class="'+C.card+' mt-4 space-y-3"><h2 class="text-title-md">Financial audit trail</h2>'+(audit.error?'<p class="text-red-700">'+esc(audit.error.message)+'</p>':(audit.data||[]).length?(audit.data||[]).map(a=>'<article class="border-b border-outline-variant/50 py-2"><div class="flex justify-between gap-2"><b>'+esc(a.event_type)+'</b><span class="'+C.mute+'">Payment #'+esc(a.payment_id)+'</span></div><p class="'+C.mute+'">'+esc(people.get(a.actor_id)||"System")+' · '+esc(String(a.event_at||"").replace("T"," ").slice(0,16))+'</p><details class="mt-2"><summary class="text-sm underline">View recorded details</summary><pre class="text-xs whitespace-pre-wrap break-words mt-2">'+esc(JSON.stringify({old:a.old_payment,new:a.new_payment},null,2))+'</pre></details></article>').join(""):'<p class="'+C.mute+'">No audit entries found.</p>')+'</section>';
 document.querySelectorAll("[data-void]").forEach(btn=>btn.onclick=async()=>{const reason=prompt("Enter the reason for reversing this payment (at least 8 characters):");if(reason===null)return;if(reason.trim().length<8)return alert("The reason must be at least 8 characters.");if(!confirm("Reverse this payment? The action will be recorded in the financial audit trail."))return;btn.disabled=true;const result=await sb.rpc("void_payment",{p_payment_id:Number(btn.dataset.void),p_reason:reason.trim()});if(result.error){btn.disabled=false;return alert(result.error.message);}await viewCreditflexFinancial();});
};

window.viewCreditflexExport = async function () {
  const v = $("view");
  if (S.me.role !== "admin") { S.tab = "collections"; return renderShell(); }
  let last = null; try { last = localStorage.getItem("creditflex-last-export"); } catch (e) {}
  v.innerHTML = `<h1 class="${C.h1}">Export data</h1>
    <section class="${C.card} space-y-3"><p class="${C.mute}">Download your records as CSV files you can open in Excel or keep in Google Drive as a backup. Do this at least once a week.</p>
      <div class="text-label-md ${last ? "text-on-surface-variant" : "text-error"}">${last ? "Last export on this phone: " + esc(new Date(last).toLocaleString()) : "You have not exported anything from this phone yet."}</div>
      <button id="x-all" class="${C.btn}" type="button">${ic("download", "text-[22px]")}<span>Download everything</span></button>
      <div class="grid grid-cols-1 gap-2"><button id="x-pay" class="${C.btn2}" type="button">Payments</button><button id="x-cus" class="${C.btn2}" type="button">Customers</button><button id="x-pur" class="${C.btn2}" type="button">Purchases and balances</button></div>
      <div id="x-msg"></div></section>`;
  const stamp = () => today();
  const staffName = async () => { const m = {}; (await cfFetchAll("staff", "id,full_name", "full_name")).forEach(x => m[x.id] = x.full_name); return m; };
  const jobs = {
    async pay() {
      const [pays, led, names] = await Promise.all([cfFetchAll("payments", "id,purchase_id,amount,paid_on,collected_by,created_at,voided_at,void_reason", "id"), cfFetchAll("purchase_ledger", "purchase_id,customer_name,customer_phone,product_name,total_price", "purchase_id"), staffName()]);
      const L = {}; led.forEach(x => L[x.purchase_id] = x);
      const run = cfRunning(pays, k => (L[k] || {}).total_price);
      cfCsvDownload("creditflex-payments-" + stamp() + ".csv", [["Payment ID", "Date", "Amount (GHS)", "Customer", "Phone", "Product", "Price (GHS)", "Paid so far (GHS)", "Balance after this payment (GHS)", "Collected by", "Recorded at", "Cancelled", "Cancel reason"], ...pays.map(p => { const l = L[p.purchase_id] || {}; return [p.id, p.paid_on, p.amount, l.customer_name, l.customer_phone, l.product_name, l.total_price, (run.get(p.id) || {}).paid ?? "", (run.get(p.id) || {}).balance ?? "", names[p.collected_by] || "", p.created_at, p.voided_at ? "yes" : "no", p.void_reason || ""]; })]);
      return pays.length;
    },
    async cus() {
      const [cs, names] = await Promise.all([cfFetchAll("customers", "id,full_name,phone,location,registered_by,created_at", "id"), staffName()]);
      cfCsvDownload("creditflex-customers-" + stamp() + ".csv", [["ID", "Name", "Phone", "Location", "Registered by", "Created"], ...cs.map(c => [c.id, c.full_name, c.phone, c.location, names[c.registered_by] || "", c.created_at])]);
      return cs.length;
    },
    async pur() {
      const led = await cfFetchAll("purchase_ledger", "*", "purchase_id");
      cfCsvDownload("creditflex-purchases-" + stamp() + ".csv", [["Purchase ID", "Customer", "Phone", "Product", "Plan", "Agent", "Total price", "Installment", "Paid", "Balance", "Payments made", "Start date", "Status"], ...led.map(x => [x.purchase_id, x.customer_name, x.customer_phone, x.product_name, x.plan_name, x.agent_name, x.total_price, x.installment_amount, x.amount_paid, x.balance, x.payments_made, x.start_date, x.status])]);
      return led.length;
    }
  };
  const run = async (names, btn) => {
    busy(btn, true); say("x-msg", "");
    try { const counts = []; for (const n of names) counts.push(await jobs[n]()); try { localStorage.setItem("creditflex-last-export", new Date().toISOString()); } catch (e) {} say("x-msg", "Done. " + counts.join(" + ") + " rows exported.", true); }
    catch (e) { say("x-msg", cfErr(e) || "Export failed."); }
    busy(btn, false);
  };
  $("x-all").onclick = () => run(["pay","cus","pur"], $("x-all"));
  $("x-pay").onclick = () => run(["pay"], $("x-pay"));
  $("x-cus").onclick = () => run(["cus"], $("x-cus"));
  $("x-pur").onclick = () => run(["pur"], $("x-pur"));
};

window.viewCreditflexCredit=function(){const v=$("view");
 v.innerHTML='<h1 class="'+C.h1+'">Credit</h1>'
 +'<section class="'+C.card+' space-y-3"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">'+ic("payments","fill text-[26px]")+'</div><div><div class="text-title-md">Creditflex Agents</div><div class="'+C.mute+'">Instalment collections for field agents</div></div></div></section>'
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Built by</h2><div class="flex items-center gap-3"><span class="w-11 h-11 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-title-md">C</span><div><b class="block">Cronos (Peter)</b><span class="'+C.mute+'">Project owner and developer</span></div></div></section>'
 +'<section class="'+C.card+' space-y-2"><h2 class="text-title-md">Contact and support</h2><a class="'+C.btn2+' w-full" href="tel:+233206709055">'+ic("call","text-[22px]")+'<span>Call 020 670 9055</span></a><a class="'+C.btn2+' w-full" href="https://wa.me/233206709055" target="_blank" rel="noopener"><span>WhatsApp 020 670 9055</span></a><a class="'+C.btn2+' w-full" href="mailto:Blisscoenergy001@gmail.com"><span>Blisscoenergy001@gmail.com</span></a></section>'
 +'<p class="text-xs text-center opacity-60">Creditflex Agents · Ghana</p>';};
const CF_ACCENTS={green:["#0b6b4f","#00513a","#a0f3cf"],blue:["#1d4ed8","#1e40af","#dbeafe"],purple:["#6d28d9","#5b21b6","#ede9fe"],orange:["#c2410c","#9a3412","#ffedd5"],rose:["#be123c","#9f1239","#ffe4e6"]};
function cfApplyTheme(theme){try{localStorage.setItem("creditflex-theme",theme);}catch(e){}const dark=theme==="dark"||(theme==="auto"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.cfTheme=dark?"dark":"light";}
function cfApplyAccent(name){const a=CF_ACCENTS[name]||CF_ACCENTS.green;try{localStorage.setItem("creditflex-accent",name);}catch(e){}const r=document.documentElement;if(name==="green"||!CF_ACCENTS[name])r.removeAttribute("data-cf-accent");else{r.dataset.cfAccent=name;r.style.setProperty("--cf-a",a[0]);r.style.setProperty("--cf-a2",a[1]);r.style.setProperty("--cf-t",a[2]);}const mt=document.querySelector('meta[name="theme-color"]');if(mt)mt.content=a[0];}
let cfInstall=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();cfInstall=e;});
async function cfClearCache(){const db=await cfOpenDB();return new Promise((res,rej)=>{const tx=db.transaction("purchase-cache","readwrite");tx.objectStore("purchase-cache").clear();tx.oncomplete=()=>res(true);tx.onerror=()=>rej(tx.error);});}
const cfThemeCSS=document.createElement("style");cfThemeCSS.textContent='.cf-tour-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:16px}.cf-tour-card{width:100%;max-width:440px;background:#fff;color:#17211c;border-radius:20px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.32);display:flex;flex-direction:column;gap:16px}.cf-tour-card>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:12px}.cf-tour-card #cf-tour-count{font-size:12px;font-weight:800;letter-spacing:.08em;color:#08734f}.cf-tour-card button{min-height:48px;border-radius:12px;padding:0 14px;font-weight:700}.cf-tour-card #cf-tour-all{text-decoration:underline;font-size:13px}.cf-tour-card #cf-tour-title{font-size:22px;line-height:1.25;font-weight:800}.cf-tour-card #cf-tour-body{font-size:15px;line-height:1.65}.cf-tour-track{height:7px;background:#e5ece8;border-radius:99px;overflow:hidden}.cf-tour-track>div{height:100%;width:0;background:#08734f;border-radius:99px}.cf-tour-actions{display:flex;gap:10px}.cf-tour-actions button{flex:1;border:1px solid #cbd5d0;background:#f7faf8;color:#17211c}.cf-tour-actions #cf-tour-next,.cf-tour-actions #cf-w-go{background:#08734f;color:#fff;border-color:#08734f}html[data-cf-theme="dark"] body{background:#101714!important;color:#e4eee8!important}html[data-cf-theme="dark"] .bg-surface,html[data-cf-theme="dark"] .bg-surface-container-lowest,html[data-cf-theme="dark"] .bg-surface-container-low,html[data-cf-theme="dark"] .bg-surface-container-high,html[data-cf-theme="dark"] .bg-surface-container-highest{background-color:#1d2923!important;color:#e4eee8!important}html[data-cf-theme="dark"] .text-on-surface,html[data-cf-theme="dark"] .text-on-surface-variant{color:#e4eee8!important}html[data-cf-theme="dark"] input,html[data-cf-theme="dark"] select{background:#25352d!important;color:#fff!important;border-color:#415348!important}html[data-cf-theme="dark"] header,html[data-cf-theme="dark"] nav{background:rgba(20,30,25,.97)!important}html[data-cf-theme="dark"] .bg-white{background:#1d2923!important;color:#e4eee8!important}html[data-cf-theme="dark"] .text-slate-900{color:#e4eee8!important}html[data-cf-theme="dark"] .cf-tour-card{background:#1d2923;color:#e4eee8}.cf-pick{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cf-pick label{display:flex;gap:8px;align-items:center;padding:10px;border:1px solid #cbd5d0;border-radius:12px;font-size:14px;font-weight:600}.cf-pick input{width:20px;height:20px;accent-color:#08734f}.cf-seg{display:flex;gap:4px;background:#e8eef0;border-radius:12px;padding:4px}.cf-seg button{flex:1;min-height:44px;border-radius:9px;font-weight:700}.cf-seg button.on{background:var(--cf-a,#0b6b4f);color:#fff}.cf-sw{width:44px;height:44px;border-radius:99px;border:3px solid transparent}.cf-sw.on{border-color:#fff;box-shadow:0 0 0 3px var(--cf-a,#0b6b4f)}.cf-pill{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:800}.cf-pill.ok{background:#a0f3cf;color:#00210f}.cf-pill.off{background:#ffdbbb;color:#2b1700}html[data-cf-theme="dark"] .cf-seg{background:#26372e}html[data-cf-theme="dark"] .cf-pick label{border-color:#42564a}html[data-cf-theme="dark"] .cf-sw.on{border-color:#1d2923}html[data-cf-accent] .bg-primary-container{background-color:var(--cf-a)!important}html[data-cf-accent] .text-primary-container,html[data-cf-accent] .text-primary{color:var(--cf-a)!important}html[data-cf-accent] .border-primary-container{border-color:var(--cf-a)!important}html[data-cf-accent] .bg-primary-fixed{background-color:var(--cf-t)!important}html[data-cf-accent] .hover\\:bg-primary:hover{background-color:var(--cf-a2)!important}html[data-cf-accent] .accent-primary{accent-color:var(--cf-a)!important}html[data-cf-accent] .focus\\:ring-primary-container:focus{--tw-ring-color:var(--cf-a)!important}html[data-cf-accent] .cf-tour-actions #cf-tour-next,html[data-cf-accent] .cf-tour-actions #cf-w-go{background:var(--cf-a);border-color:var(--cf-a)}html[data-cf-accent] .cf-tour-track>div{background:var(--cf-a)}html[data-cf-theme="dark"] .cf-tour-actions button{background:#26372e;color:#e4eee8;border-color:#42564a}html[data-cf-theme="dark"] .cf-tour-actions #cf-tour-next{background:#08734f;color:#fff}';document.head.appendChild(cfThemeCSS);cfApplyTheme(localStorage.getItem("creditflex-theme")||"light");cfApplyAccent(localStorage.getItem("creditflex-accent")||"green");

const cfCoachCSS=document.createElement("style");cfCoachCSS.textContent='.cf-coach{position:fixed;left:0;right:0;bottom:0;z-index:1000;padding:10px 12px calc(10px + env(safe-area-inset-bottom));pointer-events:none}.cf-coach-card{pointer-events:auto;max-width:640px;margin:0 auto;background:#fff;color:#17211c;border-radius:20px;box-shadow:0 -4px 28px rgba(0,0,0,.28);padding:12px 14px;border:2px solid var(--cf-a,#08734f)}.cf-coach-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.cf-coach #cf-tour-count{font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--cf-a,#08734f)}.cf-coach-top button{min-height:36px;padding:0 8px;font-size:13px;font-weight:700;text-decoration:underline;background:none;border:0;color:inherit}.cf-coach #cf-tour-title{font-size:18px;font-weight:800;margin:0}.cf-coach #cf-tour-body{font-size:14px;line-height:1.5;margin:4px 0}.cf-coach #cf-tour-task{font-size:14px;font-weight:800;color:var(--cf-a,#08734f);margin:4px 0}.cf-coach #cf-tour-task.done{color:#0a7d3b}.cf-coach .cf-tour-track{height:5px;background:#dfe9e3;border-radius:99px;overflow:hidden;margin:8px 0}.cf-coach .cf-tour-track>div{height:100%;background:var(--cf-a,#08734f);border-radius:99px}.cf-coach .cf-tour-actions{display:flex;gap:10px}.cf-coach .cf-tour-actions button{flex:1;min-height:44px;border-radius:12px;font-weight:800;border:1px solid #c9d6ce;background:#f2f6f3;color:#17211c}.cf-coach .cf-tour-actions button:disabled{opacity:.4}.cf-coach .cf-tour-actions #cf-tour-next{background:var(--cf-a,#08734f);color:#fff;border-color:var(--cf-a,#08734f)}.cf-coach .cf-tour-actions #cf-tour-next.ready{box-shadow:0 0 0 4px rgba(10,125,59,.3)}body.cf-coaching #view{padding-bottom:300px}.cf-hl{outline:4px solid #f5a300!important;outline-offset:3px;border-radius:12px;animation:cfpulse 1.2s ease-in-out infinite;scroll-margin-top:90px;scroll-margin-bottom:300px;position:relative;z-index:5}@keyframes cfpulse{0%,100%{outline-color:#f5a300}50%{outline-color:#ffd77a}}.cf-linkbtn{background:none!important;border:0!important;text-decoration:underline;font-size:14px!important;min-height:44px!important;font-weight:700;color:var(--cf-a,#08734f)!important;text-align:left}html[data-cf-theme="dark"] .cf-coach-card{background:#1d2923;color:#e4eee8}html[data-cf-theme="dark"] .cf-coach .cf-tour-track{background:#33463b}html[data-cf-theme="dark"] .cf-coach .cf-tour-actions button{background:#26372e;color:#e4eee8;border-color:#42564a}html[data-cf-theme="dark"] .cf-coach .cf-tour-actions #cf-tour-next{background:var(--cf-a,#08734f);color:#fff}html[data-cf-theme="dark"] .cf-coach #cf-tour-task.done{color:#6fe3a0}@media (prefers-reduced-motion:reduce){.cf-hl{animation:none}}';document.head.appendChild(cfCoachCSS);
window.addEventListener("online",()=>setTimeout(()=>syncCreditflexOfflineQueue(),500));
window.addEventListener("load",()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(e=>console.warn("Offline app shell unavailable",e));});
})();

/* Auto sign-out after inactivity (shared phones, forgotten screens). Offline queue stays on the phone. */
(function(){
 let last=Date.now(),timer=null,bound=false;
 const limit=()=>((S.me&&S.me.role==="admin")?10:15)*60000;
 const touch=()=>{last=Date.now();};
 const check=()=>{if(!S.me)return;if(Date.now()-last>limit())logout("You were signed out after a period of inactivity. Sign in again to continue.");};
 window.cfIdleStart=function(){
  if(!bound){bound=true;["pointerdown","keydown","touchstart","scroll"].forEach(ev=>document.addEventListener(ev,touch,{passive:true,capture:true}));document.addEventListener("visibilitychange",()=>{if(!document.hidden)check();});}
  if(!timer){last=Date.now();timer=setInterval(check,20000);}
 };
 window.cfIdleStop=function(){if(timer){clearInterval(timer);timer=null;}};
 window.cfIdleLimit=limit;
})();
