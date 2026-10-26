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
  const name=$("coopName").value.trim(),duration=durationInfo[$("coopDuration").value];if(!name||!duration)return;
  const custom=($("coopCustomCode")?.value||"").trim().toUpperCase();
  if(custom&&!/^[A-Z0-9]{6,20}$/.test(custom)){showStatus("الكود الخاص لازم يكون من 6 إلى 20 حرفًا إنجليزيًا أو رقمًا فقط.");return;}
  try{
    if(custom){const ex=(await get(ref(db,`invites/${custom}`))).val();if(ex&&ex.endsAt>Date.now()&&ex.ownerUid!==user.uid){showStatus("الكود ده مستخدم بالفعل. اختار كود تاني.");return;}}
    const id=push(ref(db,"campaigns")).key,start=Date.now(),end=start+duration.ms,code=custom||randomCode();
    await set(ref(db,`campaigns/${id}/meta`),{name,ownerUid:user.uid,duration:$("coopDuration").value,durationLabel:duration.label,startsAt:start,endsAt:end,status:"active",createdAt:start});
    await set(ref(db,`campaigns/${id}/members/${user.uid}`),{uid:user.uid,displayName:user.displayName||"الصياد",isAnonymous:!!user.isAnonymous,points:0,checkIns:{},createdAt:start});
    await set(ref(db,`invites/${code}`),{campaignId:id,ownerUid:user.uid,campaignName:name,endsAt:end,createdAt:start});
    await set(ref(db,`userCampaigns/${user.uid}/${id}`),true);
    setCampaignIds([...campaignIds(),id]);const codes=savedCodes();codes[id]=code;localStorage.setItem(CODES_KEY,JSON.stringify(codes));
    $("coopName").value="";if($("coopCustomCode"))$("coopCustomCode").value="";showStatus("اتنشأت الحملة. ابعت كود الدعوة لصاحبك: "+code);await refreshCampaigns();
  }catch(e){showStatus("تعذر إنشاء الحملة: "+(/PERMISSION_DENIED/i.test(e.message||"")?"تأكد من نشر database.rules.json في Realtime Database، أو أن الكود غير مستخدم. ":"")+(e.message||e));}
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

function campaignFromSnapshot(id,data){if(!data?.meta)return null;return{id,...data.meta,members:Object.values(data.members||{}).filter(Boolean).map(m=>({...m,id:m.uid}))};}
function renderCampaigns(records){
  const el=$("coopCampaignList");if(!el)return;
  if(!records.length){el.innerHTML='<div class="empty">لا توجد حملات بعد. أنشئ زنزانة أو انضم لصديق.</div>';return;}
  const codes=savedCodes(),today=new Date().toLocaleDateString("en-CA");
  el.innerHTML=records.map(c=>{const mine=c.members.find(m=>m.id===user?.uid),ended=Date.now()>=c.endsAt||c.status!=="active",checked=!!mine?.checkIns?.[today];return `<article class="stack-item coop-campaign"><div class="stack-main"><b>${esc(c.name)}</b><small>زنزانة ${esc(c.durationLabel)} · ${Math.max(0,Math.ceil((c.endsAt-Date.now())/86400000))} يوم متبقي · ${c.members.length} صيادين</small><div class="coop-members">${c.members.map(m=>`<span class="tag">${esc(m.displayName||"ضيف")} · ${Number(m.points)||0} نقطة</span>`).join("")}</div></div><div class="button-stack"><button type="button" class="small-btn complete" data-coop-checkin="${c.id}" ${ended||!mine||checked?"disabled":""}>${checked?"أنجزت اليوم ✓":"سجّل إنجاز اليوم"}</button>${codes[c.id]?`<button type="button" class="small-btn" data-coop-copy="${c.id}">نسخ الدعوة</button>`:""}<span class="tag ${ended?"red":"green"}">${ended?"انتهت":"نشطة"}</span></div></article>`;}).join("");
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
bindUI();loadConfig();
setInterval(()=>{if(user&&$("view-discipline-campaigns")?.classList.contains("active"))refreshCampaigns();},30000);
window.__soloCloudLoaded=true;
