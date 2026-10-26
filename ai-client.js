/* عميل الذكاء الاصطناعي — بيكلّم الـ Proxy بتاعك (مفيش مفتاح API هنا) */
(function(){
  const KEY="soloAiProxyUrl";
  const getUrl=()=>(localStorage.getItem(KEY)||"").trim();
  const setUrl=v=>{v=(v||"").trim();v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY);};
  function summary(st){
    const q=st.quests||[];
    return {
      level:st.level,streak:st.streak,coins:st.coins,
      done:q.filter(x=>x.status==="done").length,
      failed:q.filter(x=>x.status==="failed").length,
      active:q.filter(x=>x.status==="active").slice(0,6).map(x=>x.name),
      failureReasons:(st.failureReasons||[]).slice(0,5).map(x=>x.reason),
      goal:(st.profile&&st.profile.goal)||"",
      masteryAvg:(st.masteryTests||[]).length?Math.round(st.masteryTests.reduce((a,t)=>a+Number(t.score||0),0)/st.masteryTests.length):null
    };
  }
  async function ask(message,shadow,st,history){
    const url=getUrl();
    if(!url)throw new Error("NO_PROXY");
    const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),25000);
    try{
      const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},signal:ctrl.signal,
        body:JSON.stringify({message:String(message).slice(0,500),shadow:{name:shadow.name,rank:shadow.rank,desc:shadow.desc||""},summary:summary(st),history:(history||[]).slice(-6)})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.reply)throw new Error(j.error||("HTTP "+r.status));
      return j.reply;
    }finally{clearTimeout(t);}
  }
  window.SoloAI={ask,getUrl,setUrl};
})();
