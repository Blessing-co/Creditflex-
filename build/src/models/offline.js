/* MODEL: phone storage (IndexedDB), the offline queue and syncing it when the network returns. */
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
    const r=await Customers.register({p_full_name:row.p_full_name,p_phone:row.p_phone,p_location:row.p_location,p_product_id:row.p_product_id,p_plan_id:row.p_plan_id},row.id);
    if(!r.error){await cfDelete(row.id);continue;}
    const m=String(r.error.message||"");
    if(/failed to fetch|network|load failed|timeout|connection/i.test(m))break;
    await cfPut({...row,status:"needs-attention",last_error:m});
   }catch(x){break;}
   continue;
  }
  if(row.collected_by!==S.me.id)continue;
  try{
   const existing=await Payments.findByOfflineId(row.id);
   if(existing.data){await cfDelete(row.id);continue;}
   const payload={purchase_id:row.purchase_id,amount:row.amount,paid_on:row.paid_on,collected_by:row.collected_by,offline_submission_id:row.id};
   const result=await Payments.insertRaw(payload);
   if(!result.error){await cfDelete(row.id);continue;}
   const msg=String(result.error.message||"");
   if(/duplicate key|unique constraint/i.test(msg)){
    const check=await Payments.findByOfflineId(row.id);
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
async function cfClearCache(){const db=await cfOpenDB();return new Promise((res,rej)=>{const tx=db.transaction("purchase-cache","readwrite");tx.objectStore("purchase-cache").clear();tx.oncomplete=()=>res(true);tx.onerror=()=>rej(tx.error);});}
window.addEventListener("online",()=>setTimeout(()=>syncCreditflexOfflineQueue(),500));
