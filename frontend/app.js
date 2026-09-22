const API="/api";
const token=()=>localStorage.getItem("velora_token");
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0));

async function api(path,options={}){
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  if(token()) headers.Authorization=`Bearer ${token()}`;
  const r=await fetch(API+path,{...options,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"Request failed");
  return data;
}

const login=document.querySelector("#loginForm");
if(login) login.addEventListener("submit",async e=>{
  e.preventDefault(); const msg=document.querySelector("#msg");
  try{
    const f=new FormData(login);
    const d=await api("/auth/login",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});
    localStorage.setItem("velora_token",d.token);
    location.href="/dashboard.html";
  }catch(err){msg.textContent=err.message}
});

const register=document.querySelector("#registerForm");
if(register) register.addEventListener("submit",async e=>{
  e.preventDefault(); const msg=document.querySelector("#msg");
  try{
    const f=new FormData(register); const data=Object.fromEntries(f);
    const d=await api("/auth/register",{method:"POST",body:JSON.stringify(data)});
    localStorage.setItem("velora_token",d.token);
    location.href="/dashboard.html";
  }catch(err){msg.textContent=err.message}
});

async function loadDashboard(){
  if(!document.querySelector(".dashboard")) return;
  if(!token()) return location.href="/login.html";
  try{
    const me=await api("/wallet/me");
    document.querySelector("#available").textContent=money(me.wallet?.available_balance);
    document.querySelector("#pending").textContent=money(me.wallet?.pending_balance);
    const sales=await api("/analytics/summary");
    document.querySelector("#sales").textContent=money(sales.gross_sales);
    const products=await api("/products/mine");
    document.querySelector("#products").innerHTML=products.map(p=>
      `<div class="product-row"><span>${escapeHtml(p.name)}</span><b>${money(p.price)}</b></div>`).join("");
  }catch(err){console.error(err)}
}

const productForm=document.querySelector("#productForm");
if(productForm) productForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const f=new FormData(productForm), d=Object.fromEntries(f);
  d.price=Number(d.price); d.stock=Number(d.stock);
  try{await api("/products",{method:"POST",body:JSON.stringify(d)});productForm.reset();loadDashboard()}
  catch(err){alert(err.message)}
});

document.querySelector("#logout")?.addEventListener("click",()=>{
  localStorage.removeItem("velora_token");location.href="/";
});

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function loadStore(){
  const el=document.querySelector("#store"); if(!el)return;
  const username=new URLSearchParams(location.search).get("u")||location.pathname.split("/").pop();
  if(!username||username==="store.html"){el.innerHTML="<div class='card'>Toko tidak ditemukan.</div>";return}
  try{
    const d=await api("/stores/"+encodeURIComponent(username));
    el.innerHTML=`<div class="card"><span class="eyebrow">STORE</span><h1>${escapeHtml(d.store.name)}</h1><p>${escapeHtml(d.store.bio)}</p>${d.products.map(p=>`<div class="product-row"><span>${escapeHtml(p.name)}</span><b>${money(p.price)}</b></div>`).join("")}</div>`;
  }catch(err){el.innerHTML=`<div class="card">${escapeHtml(err.message)}</div>`}
}
loadDashboard();loadStore();

const paymentStatus=document.querySelector("#paymentStatus");
if(paymentStatus){
  const order=new URLSearchParams(location.search).get("order");
  if(order&&token()) api("/payments/create/"+encodeURIComponent(order),{method:"POST"})
    .then(d=>paymentStatus.textContent=`Transaksi ${d.payment_id} dibuat. Mode sandbox.`)
    .catch(e=>paymentStatus.textContent=e.message);
}
