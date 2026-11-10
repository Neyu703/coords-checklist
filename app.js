let DATA;
try{DATA=await fetch("data.json").then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})}
catch(e){
  document.getElementById("list").innerHTML='<div class="empty">Daten konnten nicht geladen werden. Seite über http(s) öffnen, nicht als Datei.</div>';
  throw e;
}
const KEY="coords-checked-v1";
let done=new Set();
try{done=new Set(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify([...done]))}catch(e){}};
const $=id=>document.getElementById(id);
const list=$("list");
const esc=t=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;");
const pad=n=>String(n).padStart(3,"0");

async function copy(text){
  try{await navigator.clipboard.writeText(text);return true}catch(e){}
  try{
    const t=document.createElement("textarea");t.value=text;t.style.position="fixed";t.style.opacity="0";
    document.body.appendChild(t);t.select();const ok=document.execCommand("copy");t.remove();return ok;
  }catch(e){return false}
}

const groupOf=name=>{const i=name.indexOf(" - ");return i<0?name:name.slice(0,i)};
const RALLIES=[["lid","Poké-Lid-Rally"],["center","Pokémon-Center-Rally"],["sendai","Sendai Lapras-Rally"],["minato","Tokyo Minato-Rally"],["koto","Tokyo Koto-Rally"],["shinagawa","Tokyo Shinagawa-Rally"],["suita","Suita-Rally (Osaka)"],["nagasaki","Nagasaki-City-Rally"],["apac","PokéXciting! APAC-Rally"]].map(([k,l])=>["rally:"+k,l]);
const RALLY_OF={"Pokémon Center":"center","Lapras Sendai":"sendai","Tokyo Minato":"minato","Tokyo Koto":"koto","Shinagawa":"shinagawa","Suita":"suita","Nagasaki City":"nagasaki","PokéXciting":"apac"};
const rallyOf=name=>RALLY_OF[groupOf(name)]||"lid";
const groups=new Map(RALLIES.map(([k,label])=>[k,{label,ns:[]}]));
const addTo=(key,label,n)=>{if(!groups.has(key))groups.set(key,{label,ns:[]});groups.get(key).ns.push(n)};

DATA.forEach(([n,name,lat,lng])=>{
  const li=document.createElement("li");
  const r=rallyOf(name);
  li.keys=["rally:"+r];
  if(r==="lid")li.keys.push("pref:"+groupOf(name));
  li.keys.forEach(k=>addTo(k,k.slice(5),n));
  li.dataset.n=n;
  li.dataset.s=(pad(n)+" "+name).toLowerCase();
  if(name.startsWith("Pokémon Center"))li.className="pc";
  li.innerHTML='<input type="checkbox" aria-label="abhaken"><div class="tx"><div class="nm"><i>'+pad(n)+'</i>'+esc(name)+'</div><div class="co">'+lat+', '+lng+'</div></div><button>Copy</button><a class="go" target="_blank" rel="noopener">Open</a>';
  const cb=li.querySelector("input"),btn=li.querySelector("button"),go=li.querySelector("a.go");
  go.addEventListener("click",e=>{e.stopPropagation();set(n,true)});
  go.href="pokemongo://?lat="+lat+"&lng="+lng;
  cb.addEventListener("click",e=>{e.stopPropagation();set(n,cb.checked)});
  const doCopy=async e=>{
    e.stopPropagation();
    const ok=await copy(lat+", "+lng);
    if(ok){set(n,true);btn.textContent="✓";btn.classList.add("ok");setTimeout(()=>{btn.textContent="Copy";btn.classList.remove("ok")},900)}
    else{btn.textContent="Fehler";setTimeout(()=>btn.textContent="Copy",900)}
  };
  btn.addEventListener("click",doCopy);
  li.addEventListener("click",doCopy);
  list.appendChild(li);
});

const GK="coords-group-v2";
const opts=new Map();
const ogRally=document.createElement("optgroup"),ogPref=document.createElement("optgroup");
ogRally.label="Stamp Rallies";ogPref.label="Poké Lids nach Präfektur";
groups.forEach((G,k)=>{const o=document.createElement("option");o.value=k;opts.set(k,o);(k.startsWith("rally:")?ogRally:ogPref).appendChild(o)});
$("g").append(ogRally,ogPref);
try{const s=localStorage.getItem(GK);if(s&&groups.has(s))$("g").value=s}catch(e){}
let gArmed=false;
function setMany(ns,v){
  ns.forEach(n=>v?done.add(n):done.delete(n));
  save();render();
}
function set(n,v){
  v?done.add(n):done.delete(n);
  save();render();
}
function render(){
  const q=$("q").value.trim().toLowerCase(),f=$("f").value,g=$("g").value;
  let shown=0;
  list.querySelectorAll("li").forEach(li=>{
    const n=+li.dataset.n,d=done.has(n);
    li.classList.toggle("done",d);
    li.querySelector("input").checked=d;
    const vis=(!g||li.keys.includes(g))&&(!q||li.dataset.s.includes(q))&&(f==="all"||(f==="done")===d);
    li.style.display=vis?"":"none";
    if(vis)shown++;
  });
  const doneIn=ns=>ns.filter(n=>done.has(n)).length;
  groups.forEach((G,k)=>{opts.get(k).textContent=G.label+" ("+doneIn(G.ns)+"/"+G.ns.length+")"});
  const total=g?groups.get(g).ns.length:DATA.length,cnt=g?doneIn(groups.get(g).ns):done.size;
  $("gbar").hidden=!g;
  if(g){
    const left=total-cnt;
    $("gall").textContent=left?"Alle abhaken ("+left+" offen)":gArmed?"Sicher? Nochmal tippen":"Rally zurücksetzen";
  }
  $("count").textContent=cnt+" / "+total;
  $("fill").style.width=(cnt/total*100)+"%";
  let e=document.getElementById("empty");
  if(!shown&&!e){e=document.createElement("div");e.id="empty";e.className="empty";e.textContent="Nix gefunden.";list.after(e)}
  else if(shown&&e)e.remove();
}
$("q").addEventListener("input",render);
$("q").addEventListener("keydown",e=>{if(e.key==="Enter")e.target.blur()});
$("f").addEventListener("change",render);
$("gall").addEventListener("click",()=>{
  const ns=groups.get($("g").value).ns,all=ns.every(n=>done.has(n));
  if(!all)return setMany(ns,true);
  if(!gArmed){gArmed=true;render();setTimeout(()=>{gArmed=false;render()},2500);return}
  gArmed=false;setMany(ns,false);
});
$("g").addEventListener("change",()=>{gArmed=false;try{localStorage.setItem(GK,$("g").value)}catch(e){}render();scrollTo(0,0)});
let armed=false;
$("reset").addEventListener("click",function(){
  if(!armed){armed=true;this.textContent="Sicher? Nochmal tippen";setTimeout(()=>{armed=false;this.textContent="Alles zurücksetzen"},2500);return}
  done.clear();save();render();armed=false;this.textContent="Alles zurücksetzen";
});
render();
