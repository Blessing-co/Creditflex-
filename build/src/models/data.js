/* MODEL: reading lists from the database (paging) and saved copies for offline reading. */
async function cfFetchAll(table, select, order, filter) {
  const orders = [].concat(order); let all = [], from = 0;
  for (;;) {
    let q = sb.from(table).select(select);
    if (filter) q = filter(q);
    orders.forEach(o => { q = q.order(o, { ascending: true }); });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < 1000) return all;
    from += 1000;
  }
}
/* Same, but returns { data, error } like a normal query and never throws. */
async function cfLoadAll(table, select, order, filter) {
  const run = async () => { try { return { data: await cfFetchAll(table, select, order, filter), error: null }; } catch (error) { return { data: null, error }; } };
  return filter ? run() : cfRead("all:" + table + ":" + select, run);
}
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
