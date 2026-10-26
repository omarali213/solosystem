const FB_VERSIONS=["13.1.0","12.14.0"];
async function loadFirebase(){
  for(const v of FB_VERSIONS){
    try{
      const b=`https://www.gstatic.com/firebasejs/${v}/`;
      const [a,au,d]=await Promise.all([import(b+"firebase-app.js"),import(b+"firebase-auth.js"),import(b+"firebase-database.js")]);
      return {...a,...au,...d};
    }catch(e){console.warn("Firebase "+v+" load failed",e);}
  }
  return null;
}
const FB=await loadFirebase();
if(!FB){
  const msg="تعذر تحميل مكتبات Firebase من الإنترنت. تأكد من الاتصال وأن gstatic.com غير محجوب، ثم أعد تحميل الصفحة.";
  const show=()=>{const el=document.getElementById("authGateStatus");if(el)el.textContent=msg;};
  show();document.addEventListener("DOMContentLoaded",show);
  throw new Error(msg);
}
const { initializeApp, getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, signOut, linkWithPopup, getDatabase, ref, set, get, update, onValue, runTransaction, push } = FB;

const $ = id => document.getElementById(id);
const CONFIG_KEY = "soloLevelingFirebaseConfig";
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgnIDxaS0RuxUxbQyGHWHypHnFModAIGs",
  authDomain: "solosystem-73b2d.firebaseapp.com",
  projectId: "solosystem-73b2d",
  databaseURL: "https://solosystem-73b2d-default-rtdb.firebaseio.com",
  storageBucket: "solosystem-73b2d.firebasestorage.app",
  messagingSenderId: "634918989018",
  appId: "1:634918989018:web:164ada830c3e8b58c089e3",
  measurementId: "G-WZ0HS25YRS"
};
const CAMPAIGNS_KEY = "soloLevelingCampaigns";
const CODES_KEY = "soloLevelingCampaignCodes";
const LOCAL_GUEST_KEY = "soloLevelingLocalGuest";
let app=null, auth=null, db=null, user=null, campaignWatchers=[], campaignCache={};
const durationInfo={day:{label:"يوم",ms:86400000},week:{label:"أسبوع",ms:7*86400000},month:{label:"شهر",ms:30*86400000},year:{label:"سنة",ms:365*86400000}};
const campaignStoreKey=()=>CAMPAIGNS_KEY+":"+(user?.uid||"local");
const campaignIds=()=>{try{return JSON.parse(localStorage.getItem(campaignStoreKey())||"[]")}catch{return[]}};
const setCampaignIds=ids=>localStorage.setItem(campaignStoreKey(),JSON.stringify([...new Set(ids)]));
const savedCodes=()=>{try{return JSON.parse(localStorage.getItem(CODES_KEY)||"{}")}catch{return{}}};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const showStatus=text=>{const el=$("coopStatus");if(el)el.textContent=text;};

function enterApp(current){
  const gate=$("authGate");if(gate)gate.hidden=true;
  const shortcut=$("accountShortcut");if(shortcut)shortcut.textContent=current?(current.isAnonymous?"ضيف سحابي":(current.displayName||"Google")):"ضيف محلي";
  document.querySelector('[data-view="dashboard"]')?.click();
}

function initFirebase(config){
  const merged={...DEFAULT_FIREBASE_CONFIG,...config};
  if(!app)app=initializeApp(merged);
  if(!auth)auth=getAuth(app);
  if(merged.databaseURL&&!db)db=getDatabase(app,merged.databaseURL);
  if(window.__soloFirebaseAuthListening)return;
  window.__soloFirebaseAuthListening=true;
  const setupMessage=db?"Firebase جاهز: تسجيل الدخول والحملات المشتركة مفعّلان.":"تسجيل Google جاهز. أضف databaseURL فقط لتفعيل حملات الانضباط المشتركة.";
  if($("firebaseSetupStatus"))$("firebaseSetupStatus").textContent=setupMessage;
  onAuthStateChanged(auth,async current=>{
    user=current;
    const badge=$("accountState"),out=$("signOutBtn"),guest=$("guestSignInBtn");
    if(badge)badge.textContent=current?(current.isAnonymous?"ضيف سحابي":(current.displayName||current.email||"حساب Google")):"ضيف محلي";
    if(out)out.classList.toggle("hidden",!current);
    if(guest)guest.textContent=current?.isAnonymous?"الضيف متصل":"الدخول كضيف";
    if(current){localStorage.removeItem(LOCAL_GUEST_KEY);enterApp(current);await refreshCampaigns();}
    else if(localStorage.getItem(LOCAL_GUEST_KEY)==="1"){enterApp(null);}
    else if($("authGate"))$("authGate").hidden=false;
  });
}

function setConfigFields(raw){["firebaseConfigInput","firebaseGateConfig"].forEach(id=>{if($(id))$(id).value=raw;});}
function loadConfig(){
  const raw=localStorage.getItem(CONFIG_KEY);
  if(raw){try{const config={...DEFAULT_FIREBASE_CONFIG,...JSON.parse(raw)};const merged=JSON.stringify(config,null,2);setConfigFields(merged);initFirebase(config);}catch(e){if($("firebaseSetupStatus"))$("firebaseSetupStatus").textContent="إعداد Firebase غير صالح: "+e.message;}}
  else{const defaults=JSON.stringify(DEFAULT_FIREBASE_CONFIG,null,2);setConfigFields(defaults);localStorage.setItem(CONFIG_KEY,defaults);try{initFirebase(DEFAULT_FIREBASE_CONFIG);}catch(e){if($("firebaseSetupStatus"))$("firebaseSetupStatus").textContent="تعذر تشغيل Firebase: "+e.message;}}
  if(localStorage.getItem(LOCAL_GUEST_KEY)==="1")enterApp(null);
}
function saveConfig(inputId){
  try{const raw=$(inputId).value.trim(),config={...DEFAULT_FIREBASE_CONFIG,...JSON.parse(raw)};if(!config.apiKey||!config.projectId||!config.appId)throw Error("تأكد من apiKey و projectId و appId.");const saved=JSON.stringify(config,null,2);localStorage.setItem(CONFIG_KEY,saved);setConfigFields(saved);initFirebase(config);if($("firebaseSetupStatus"))$("firebaseSetupStatus").textContent=config.databaseURL?"تم حفظ الإعداد. فعّل Google وAnonymous في Firebase Console وانشر database.rules.json.":"تم حفظ الإعداد. تسجيل Google جاهز؛ أضف databaseURL لاحقًا لتفعيل الحملات المشتركة.";if($("authGateStatus"))$("authGateStatus").textContent="تم حفظ الإعداد. سجّل الدخول بحساب Google للمتابعة.";}
  catch(e){const message="إعداد غير صالح: "+e.message;if($("firebaseSetupStatus"))$("firebaseSetupStatus").textContent=message;if($("authGateStatus"))$("authGateStatus").textContent=message;}
}
function requireOnlineUser(){if(!user){showStatus("سجّل الدخول بحساب Google أو كضيف سحابي لاستخدام الحملات المشتركة.");return false;}if(!db){showStatus("تسجيل الدخول يعمل. لإعداد الحملات المشتركة أضف databaseURL من Firebase Realtime Database في الإعدادات.");return false;}return true;}
function randomCode(){const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return Array.from(bytes,b=>(b%36).toString(36)).join("").toUpperCase();}

async function createCampaign(event){
  event.preventDefault();if(!requireOnlineUser())return;
  const name=$("coopName").value.trim();if(!name)return;
  const custom=($("coopCustomCode")?.value||"").trim().toUpperCase();
  if(custom&&!/^[A-Z0-9]{6,20}$/.test(custom)){showStatus("الكود الخاص لازم يكون من 6 إلى 20 حرفًا إنجليزيًا أو رقمًا فقط.");return;}
  const steps=($("coopSteps")?.value||"").split(/\n/).map(x=>x.trim().slice(0,80)).filter(Boolean).slice(0,12);
  if(!steps.length){showStatus("اكتب خطوة واحدة على الأقل (كل خطوة في سطر) عشان الحملة تخلص.");return;}
  const penalty=($("coopPenalty")?.value||"").trim().slice(0,120)||"جلسة تركيز 25 دقيقة على أصعب مهمة مؤجلة";
  const cv=Number($("coopCustomValue")?.value)||0,cu=$("coopCustomUnit")?.value==="day"?"day":"hour";
  let ms,label,durKey;
  if(cv>0){ms=cv*(cu==="hour"?3600000:86400000);if(ms<3600000||ms>365*86400000){showStatus("المؤقت المخصص لازم يكون من ساعة إلى 365 يوم.");return;}label=cv+(cu==="hour"?" ساعة":" يوم");durKey="custom";}
  else{const d=durationInfo[$("coopDuration").value];if(!d)return;ms=d.ms;label=d.label;durKey=$("coopDuration").value;}
  const stepsObj={};steps.forEach((t,k)=>{stepsObj["s"+(k+1)]=t;});
  try{
    if(custom){const ex=(await get(ref(db,`invites/${custom}`))).val();if(ex&&ex.endsAt>Date.now()&&ex.ownerUid!==user.uid){showStatus("الكود ده مستخدم بالفعل. اختار كود تاني.");return;}}
    const id=push(ref(db,"campaigns")).key,start=Date.now(),end=start+ms,code=custom||randomCode();
    await set(ref(db,`campaigns/${id}/meta`),{name,ownerUid:user.uid,duration:durKey,durationLabel:label,startsAt:start,endsAt:end,status:"active",createdAt:start,steps:stepsObj,penalty});
    await set(ref(db,`campaigns/${id}/members/${user.uid}`),{uid:user.uid,displayName:user.displayName||"الصياد",isAnonymous:!!user.isAnonymous,points:0,checkIns:{},createdAt:start});
    await set(ref(db,`invites/${code}`),{campaignId:id,ownerUid:user.uid,campaignName:name,endsAt:end,createdAt:start});
    await set(ref(db,`userCampaigns/${user.uid}/${id}`),true);
    setCampaignIds([...campaignIds(),id]);const codes=savedCodes();codes[id]=code;localStorage.setItem(CODES_KEY,JSON.stringify(codes));
    ["coopName","coopCustomCode","coopSteps","coopPenalty","coopCustomValue"].forEach(k=>{if($(k))$(k).value="";});
    showStatus("اتنشأت الحملة. ابعت كود الدعوة لصاحبك: "+code);await refreshCampaigns();
  }catch(e){showStatus("تعذر إنشاء الحملة: "+(/PERMISSION_DENIED/i.test(e.message||"")?"تأكد من نشر database.rules.json (النسخة الأحدث) في Realtime Database، أو أن الكود غير مستخدم. ":"")+(e.message||e));}
}

async function joinCampaign(event){
  event.preventDefault();if(!requireOnlineUser())return;
  const code=$("coopInviteCode").value.trim().toUpperCase();if(!/^[A-Z0-9]{6,20}$/.test(code)){showStatus("كود الدعوة لازم يكون من 6 إلى 20 حرفًا إنجليزيًا أو رقمًا.");return;}
  try{
    const inviteSnap=await get(ref(db,`invites/${code}`)),invite=inviteSnap.val();
    if(!invite||invite.endsAt<Date.now()){showStatus("الكود غير صحيح أو انتهت مدة الزنزانة.");return;}
    const memberRef=ref(db,`campaigns/${invite.campaignId}/members/${user.uid}`),memberSnap=await get(memberRef);
    if(memberSnap.exists()){showStatus("أنت منضم لهذه الزنزانة بالفعل.");return;}
    const now=Date.now();await set(memberRef,{uid:user.uid,displayName:user.displayName||"الصياد",isAnonymous:!!user.isAnonymous,points:0,checkIns:{},inviteCode:code,createdAt:now});
    await set(ref(db,`userCampaigns/${user.uid}/${invite.campaignId}`),true);
    setCampaignIds([...campaignIds(),invite.campaignId]);const codes=savedCodes();codes[invite.campaignId]=code;localStorage.setItem(CODES_KEY,JSON.stringify(codes));
    $("coopInviteCode").value="";showStatus("انضممت للزنزانة: "+(invite.campaignName||"حملة الانضباط"));await refreshCampaigns();
  }catch(e){showStatus("تعذر الانضمام. تأكد من نشر database.rules.json: "+(e.message||e));}
}

function campaignFromSnapshot(id,data){
  if(!data?.meta)return null;
  const steps=Object.entries(data.meta.steps||{}).sort((a,b)=>Number(a[0].slice(1))-Number(b[0].slice(1))).map(([sid,text])=>({id:sid,text:String(text)}));
  return{id,...data.meta,steps,progress:data.progress||{},members:Object.values(data.members||{}).filter(Boolean).map(m=>({...m,id:m.uid}))};
}
function campaignOutcome(c){
  if(!c.steps?.length)return null;
  const done=m=>c.steps.every(s=>c.progress?.[m.id]?.steps?.[s.id]);
  if(c.members.some(m=>c.progress?.[m.id]?.failedAt))return{outcome:"fail",reason:"اتسجل فشل في الحملة"};
  if(c.members.length>=2&&c.members.every(done))return{outcome:"success"};
  if(Date.now()>=c.endsAt)return c.members.length<2?{outcome:"void"}:{outcome:"fail",reason:"انتهى الوقت قبل ما الطرفين يخلصوا"};
  return null;
}
function fmtLeft(ms){if(ms<=0)return"انتهى";const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);return d?`${d} يوم ${h} ساعة`:`${h} ساعة ${m} دقيقة`;}
function renderCampaigns(records){
  const el=$("coopCampaignList");if(!el)return;
  if(!records.length){el.innerHTML='<div class="empty">لا توجد حملات بعد. أنشئ زنزانة أو انضم لصديق.</div>';return;}
  const codes=savedCodes(),today=new Date().toLocaleDateString("en-CA");
  const outs={};
  records.forEach(c=>{const mine=c.members.find(m=>m.id===user?.uid),r=mine?campaignOutcome(c):null;outs[c.id]=r;if(r)window.SoloGame?.resolveCampaign({id:c.id,name:c.name,steps:c.steps.length,penalty:c.penalty||"جلسة تركيز 25 دقيقة",...r});});
  el.innerHTML=records.map(c=>{
    const mine=c.members.find(m=>m.id===user?.uid),r=outs[c.id],ended=Date.now()>=c.endsAt||c.status!=="active"||!!r,checked=!!mine?.checkIns?.[today];
    const my=c.progress?.[user?.uid]?.steps||{},n=c.steps.length;
    const tag=r?.outcome==="success"?'<span class="tag green">نجحت ✓</span>':r?.outcome==="fail"?'<span class="tag red">فشلت</span>':r?.outcome==="void"?'<span class="tag">انتهت بدون شريك</span>':`<span class="tag ${ended?"red":"green"}">${ended?"انتهت":"نشطة"}</span>`;
    const stepsHtml=n?`<div class="milestone-list">${c.steps.map(s=>`<label><input type="checkbox" data-coop-step="${esc(s.id)}" data-coop-campaign="${esc(c.id)}" ${my[s.id]?"checked":""} ${ended||!mine?"disabled":""}> ${esc(s.text)}</label>`).join("")}</div><small>⚠ العقوبة لو فشلت الحملة (على الطرفين): ${esc(c.penalty||"")}</small><small>🎁 مكافأة سرية: XP عالي + عنصر نادر مخفي</small>`:"";
    return `<article class="stack-item coop-campaign"><div class="stack-main"><b>${esc(c.name)}</b><small>زنزانة ${esc(c.durationLabel)} · ⏳ ${esc(fmtLeft(c.endsAt-Date.now()))} · ${c.members.length} صيادين${c.members.length<2&&n?" (محتاج شريك عشان الحملة تتحسب)":""}</small><div class="coop-members">${c.members.map(m=>{const pm=c.progress?.[m.id]?.steps||{};const cnt=c.steps.filter(s=>pm[s.id]).length;return `<span class="tag">${esc(m.displayName||"ضيف")} · ${n?cnt+"/"+n+" خطوة":(Number(m.points)||0)+" نقطة"}</span>`;}).join("")}</div>${stepsHtml}</div><div class="button-stack"><button type="button" class="small-btn complete" data-coop-checkin="${esc(c.id)}" ${ended||!mine||checked?"disabled":""}>${checked?"أنجزت اليوم ✓":"سجّل إنجاز اليوم"}</button>${n?`<button type="button" class="small-btn delete" data-coop-fail="${esc(c.id)}" ${ended||!mine?"disabled":""}>سجّل فشل</button>`:""}${codes[c.id]?`<button type="button" class="small-btn" data-coop-copy="${esc(c.id)}">نسخ الدعوة</button>`:""}${tag}</div></article>`;}).join("");
}
async function setStep(cid,sid,on){
  if(!requireOnlineUser())return;
  try{await update(ref(db,`campaigns/${cid}/progress/${user.uid}`),{["steps/"+sid]:on?true:null,updatedAt:Date.now()});}
  catch(e){showStatus("تعذر حفظ الخطوة: "+(/PERMISSION_DENIED/i.test(e.message||"")?"انشر آخر نسخة من database.rules.json أو الوقت انتهى. ":"")+(e.message||e));}
}
async function failCampaign(cid){
  if(!requireOnlineUser())return;
  if(!confirm("تسجيل الفشل هينزّل نفس العقوبة عليك وعلى شريكك فورًا. متأكد؟"))return;
  try{await update(ref(db,`campaigns/${cid}/progress/${user.uid}`),{failedAt:Date.now(),updatedAt:Date.now()});}
  catch(e){showStatus("تعذر تسجيل الفشل: "+(e.message||e));}
}

function clearCampaignWatchers(){campaignWatchers.forEach(stop=>stop());campaignWatchers=[];}
function attachCampaignWatchers(ids){
  clearCampaignWatchers();campaignCache={};
  campaignWatchers=ids.map(id=>onValue(ref(db,`campaigns/${id}`),snap=>{const record=campaignFromSnapshot(id,snap.val());if(record)campaignCache[id]=record;else delete campaignCache[id];renderCampaigns(Object.values(campaignCache));},()=>showStatus("تعذر قراءة الحملة؛ راجع database.rules.json.")));
}
async function refreshCampaigns(){
  if(!db||!user)return;
  try{
    const snap=await get(ref(db,`userCampaigns/${user.uid}`)),ids=[...new Set([...Object.keys(snap.val()||{}),...campaignIds()])];
    setCampaignIds(ids);attachCampaignWatchers(ids);
    if(!ids.length)renderCampaigns([]);
  }catch(e){showStatus("تعذر تحديث الحملات؛ راجع Realtime Database rules. "+(e.message||e));}
}

async function checkIn(id){
  if(!requireOnlineUser())return;
  const memberRef=ref(db,`campaigns/${id}/members/${user.uid}`),today=new Date().toLocaleDateString("en-CA"),now=Date.now();
  const result=await runTransaction(memberRef,current=>{
    if(!current||current.checkIns?.[today]||(current.lastCheckInAt&&now-current.lastCheckInAt<86400000))return;
    current.points=(Number(current.points)||0)+1;current.checkIns=current.checkIns||{};current.checkIns[today]=true;current.lastCheckInAt=now;return current;
  });
  if(!result.committed){showStatus("سجّل إنجاز الحملة مرة واحدة كل 24 ساعة.");return;}
  showStatus("تم تسجيل إنجازك اليوم في الحملة.");
}
async function copyInvite(id){const code=savedCodes()[id];if(!code)return;try{await navigator.clipboard.writeText(code);showStatus("تم نسخ كود الدعوة: "+code);}catch{showStatus("كود الدعوة: "+code);}}
async function googleSignIn(){
  if(!auth){const message="تعذر تهيئة Firebase Auth. تحقق من إعداد Firebase Web Config.";if($("firebaseSetupStatus"))$("firebaseSetupStatus").textContent=message;if($("authGateStatus"))$("authGateStatus").textContent=message;return;}
  try{const provider=new GoogleAuthProvider();if(user?.isAnonymous)await linkWithPopup(user,provider);else await signInWithPopup(auth,provider);}
  catch(e){const H={"auth/unauthorized-domain": "الدومين ده مش مضاف في Firebase: Authentication > Settings > Authorized domains (ضيف localhost أو دومين موقعك).", "auth/operation-not-allowed": "تسجيل Google مش مفعّل: Firebase Console > Authentication > Sign-in method > Google > Enable.", "auth/popup-blocked": "المتصفح منع النافذة المنبثقة. اسمح بالـ Popups للموقع وجرّب تاني.", "auth/popup-closed-by-user": "اتقفلت نافذة Google قبل ما تكمّل الدخول.", "auth/cancelled-popup-request": "اتقفلت نافذة Google قبل ما تكمّل الدخول.", "auth/network-request-failed": "مشكلة اتصال بالإنترنت.", "auth/internal-error": "خطأ داخلي من Firebase؛ غالبًا الصفحة مفتوحة من file:// أو الدومين مش مصرّح."};const hint=H[e.code]||(location.protocol==="file:"?"افتح الموقع عبر localhost أو HTTPS مش file://.":"");const message="تعذر تسجيل الدخول: "+(hint||e.message)+(e.code?" ("+e.code+")":"");console.error(e);if($("firebaseSetupStatus"))$("firebaseSetupStatus").textContent=message;if($("authGateStatus"))$("authGateStatus").textContent=message;}
}
async function cloudGuestSignIn(){if(!auth){const message="احفظ إعداد Firebase أولًا لاستخدام الضيف السحابي.";if($("authGateStatus"))$("authGateStatus").textContent=message;return;}try{if(!user?.isAnonymous)await signInAnonymously(auth);}catch(e){if($("authGateStatus"))$("authGateStatus").textContent="تعذر دخول الضيف: "+e.message;}}

function bindUI(){
  $("firebaseSaveBtn")?.addEventListener("click",()=>saveConfig("firebaseConfigInput"));
  $("firebaseGateSaveBtn")?.addEventListener("click",()=>saveConfig("firebaseGateConfig"));
  ["googleSignInButton","googleGateSignIn"].forEach(id=>$(id)?.addEventListener("click",googleSignIn));
  ["guestSignInBtn","guestGateSignIn"].forEach(id=>$(id)?.addEventListener("click",cloudGuestSignIn));
  $("signOutBtn")?.addEventListener("click",()=>{localStorage.removeItem(LOCAL_GUEST_KEY);signOut(auth);});
  $("coopCreateForm")?.addEventListener("submit",createCampaign);$("coopJoinForm")?.addEventListener("submit",joinCampaign);$("coopRefreshBtn")?.addEventListener("click",refreshCampaigns);
  document.addEventListener("click",e=>{const check=e.target.closest("[data-coop-checkin]");if(check){checkIn(check.dataset.coopCheckin).catch(err=>showStatus(err.message));return;}const copy=e.target.closest("[data-coop-copy]");if(copy)copyInvite(copy.dataset.coopCopy);});
  window.addEventListener("beforeunload",clearCampaignWatchers);
}
document.addEventListener("change",e=>{const cb=e.target.closest?.("[data-coop-step]");if(cb)setStep(cb.dataset.coopCampaign,cb.dataset.coopStep,cb.checked);});
document.addEventListener("click",e=>{const f=e.target.closest?.("[data-coop-fail]");if(f)failCampaign(f.dataset.coopFail);});
setInterval(()=>{if(user&&Object.keys(campaignCache).length)renderCampaigns(Object.values(campaignCache));},20000);
bindUI();loadConfig();
setInterval(()=>{if(user&&$("view-discipline-campaigns")?.classList.contains("active"))refreshCampaigns();},30000);
window.__soloCloudLoaded=true;
