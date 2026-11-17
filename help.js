/* Solo Leveling System — دليل الاستخدام الاسترشادي (قابل للفتح في أي وقت) */
(function(){
"use strict";
var SEEN_KEY="soloHelpTourSeen";
var STEPS=[
 {t:"أهلاً أيها الصياد 👋",v:null,b:"النظام ده بيحوّل انضباطك في الحياة الحقيقية للعبة RPG. كل مهمة حقيقية بتنجزها بتديك XP وعملات، وبتعلّي مستواك ورتبتك من E لحد S+.<br><b>مفيش XP من غير إنجاز فعلي.</b>"},
 {t:"لوحة النظام",v:"dashboard",b:"هنا بتشوف رتبتك ومستواك وشريط الـ XP، ومركز الأوامر اليومي اللي بيلخّص يومك ويقترح عليك خطوة مناسبة."},
 {t:"أول مهمة",v:"quests",b:"اضغط <b>＋ مهمة جديدة</b> وابدأ بحاجة صغيرة جدًا (XP حوالي ٢٠). نفّذها في الواقع وبعدين اضغط «إكمال».<br>أقصى حد للمهام <b>الإجبارية</b> ٣ في اليوم، ولو موعدها عدّى بتتسجل فشل."},
 {t:"العقوبات",v:"penalties",b:"لو فشلت في مهمة، بتسجّل السبب ويتخصم حتى ٥ عملات وتظهر عقوبة. <b>العقوبة المستحقة بتوقف المكافآت</b> لحد ما تنفذها. الهدف إنك ترجع للمسار مش إنك تتجلد."},
 {t:"الزنزانات",v:"dungeons",b:"كل ١٠ مهمات مكتملة بتظهر زنزانة. الزعيم فيها <b>عادة سيئة</b> بتختارها إنت. اجتاز التحدي وبعدها جرّب ARISE لتحويله لظل في جيشك."},
 {t:"المتجر والمعدات",v:"shop",b:"المتجر بيتفتح عند <b>رتبة A</b>. اشتري معدات وأغراض بالعملات اللي جمعتها (دروع، إكسير، خنجر الظل…)."},
 {t:"نقاط الصياد",v:"attributes",b:"كل مستوى جديد بيديك <b>٣ نقاط</b> توزعها على مساراتك. تقدر تعيد التوزيع مقابل ٥٠ DC."},
 {t:"مساعد الذكاء الاصطناعي",v:"assistant",b:"تحليل لأدائك واقتراح مهام. من «إعدادات الذكاء الاصطناعي» تقدر تربطه بـ Gemini أو API متوافق مع OpenAI. من غير إعداد بيشتغل بردود محلية."},
 {t:"احفظ تقدمك",v:"settings",b:"التقدم محفوظ في المتصفح. <b>صدّر نسخة احتياطية أسبوعيًا</b> من هنا، لأن مسح بيانات المتصفح ممكن يضيّعه."},
 {t:"جاهز!",v:null,b:"تقدر ترجع للدليل ده في أي وقت من الزر <b>؟</b> الثابت على الشاشة، وفيه رابط للدليل الكامل.<br><b>YOUR REAL LIFE IS THE MAIN QUEST.</b>"}
];
var idx=0,dlg=null;
function css(){
 var s=document.createElement("style");
 s.textContent=
 "#soloHelpFab{position:fixed;left:16px;bottom:16px;z-index:9998;width:46px;height:46px;border-radius:50%;border:1px solid #3a4390;background:#141a36;color:#22d3ee;font:700 20px system-ui;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45)}"+
 "#soloHelpFab:hover{background:#1d2650}"+
 "#soloHelp{border:1px solid #3a4390;border-radius:16px;background:#0e1226;color:#e8ebff;max-width:460px;width:calc(100% - 32px);padding:0;direction:rtl;font-family:inherit}"+
 "#soloHelp::backdrop{background:rgba(3,5,15,.7)}"+
 "#soloHelp .sh-in{padding:20px 22px}"+
 "#soloHelp small{color:#9aa3d1;letter-spacing:2px;font-family:monospace}"+
 "#soloHelp h3{margin:6px 0 8px;font-size:20px;color:#22d3ee}"+
 "#soloHelp p{line-height:1.9;margin:0 0 14px}"+
 "#soloHelp .sh-bar{height:4px;background:#252d57;border-radius:9px;margin:10px 0 14px;overflow:hidden}"+
 "#soloHelp .sh-bar i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#22d3ee);transition:width .25s}"+
 "#soloHelp .sh-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between}"+
 "#soloHelp button,#soloHelp a.sh-btn{font:inherit;padding:8px 14px;border-radius:10px;border:1px solid #3a4390;background:#141a36;color:#e8ebff;cursor:pointer;text-decoration:none;font-size:14px}"+
 "#soloHelp button.pri{background:#7c5cff;border-color:#7c5cff}"+
 "#soloHelp button:disabled{opacity:.4;cursor:default}";
 document.head.appendChild(s);
}
function build(){
 css();
 var fab=document.createElement("button");
 fab.id="soloHelpFab";fab.type="button";fab.title="دليل الاستخدام";fab.setAttribute("aria-label","فتح دليل الاستخدام");fab.textContent="؟";
 fab.addEventListener("click",function(){open(0);});
 document.body.appendChild(fab);
 dlg=document.createElement("dialog");dlg.id="soloHelp";
 dlg.innerHTML='<div class="sh-in"><small id="shStep"></small><h3 id="shTitle"></h3><div class="sh-bar"><i id="shBar"></i></div><p id="shBody"></p>'+
 '<div class="sh-row"><span><button type="button" id="shPrev">السابق</button> <button type="button" class="pri" id="shNext">التالي</button></span>'+
 '<span><button type="button" id="shGo">افتح الصفحة ↗</button> <a class="sh-btn" href="guide.html" target="_blank" rel="noopener">الدليل الكامل</a> <button type="button" id="shClose">إغلاق</button></span></div></div>';
 document.body.appendChild(dlg);
 dlg.querySelector("#shPrev").onclick=function(){show(idx-1);};
 dlg.querySelector("#shNext").onclick=function(){if(idx>=STEPS.length-1)close();else show(idx+1);};
 dlg.querySelector("#shClose").onclick=close;
 dlg.querySelector("#shGo").onclick=function(){var v=STEPS[idx].v;if(!v)return;var b=document.querySelector('.nav-item[data-view="'+v+'"]');if(b){close();b.click();}};
 dlg.addEventListener("close",mark);
}
function mark(){try{localStorage.setItem(SEEN_KEY,"1");}catch(e){}}
function show(i){
 idx=Math.max(0,Math.min(STEPS.length-1,i));var s=STEPS[idx];
 dlg.querySelector("#shStep").textContent="GUIDE "+(idx+1)+" / "+STEPS.length;
 dlg.querySelector("#shTitle").textContent=s.t;
 dlg.querySelector("#shBody").innerHTML=s.b;
 dlg.querySelector("#shBar").style.width=((idx+1)/STEPS.length*100)+"%";
 dlg.querySelector("#shPrev").disabled=idx===0;
 dlg.querySelector("#shNext").textContent=idx===STEPS.length-1?"تمام":"التالي";
 dlg.querySelector("#shGo").style.display=s.v?"":"none";
}
function open(i){if(!dlg)return;show(i||0);if(!dlg.open)dlg.showModal();}
function close(){if(dlg&&dlg.open)dlg.close();}
function init(){
 build();window.SoloHelp={open:open};
 var seen=false;try{seen=localStorage.getItem(SEEN_KEY)==="1";}catch(e){}
 if(!seen)setTimeout(function(){var gate=document.getElementById("authGate");
  if(gate&&!gate.classList.contains("hidden")&&gate.offsetParent!==null){var t=setInterval(function(){if(!gate.offsetParent){clearInterval(t);open(0);}},800);}else open(0);},900);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
