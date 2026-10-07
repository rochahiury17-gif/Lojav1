
window.exportProductsBackup = async function() {
  try {
    const token = (typeof store !== "undefined" && store.token) ? store.token : localStorage.getItem("token");
    const headers = token ? { "Authorization": "Bearer " + token } : {};
    const res = await fetch("/api/admin/products/export", { headers });
    if (!res.ok) throw new Error("Erro ao baixar backup");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produtos-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("✓ Backup baixado com sucesso!");
  } catch(err) {
    toast("Erro ao exportar: " + err.message, "warn");
  }
};

window.importProductsBackup = async function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!confirm("Deseja restaurar os produtos deste arquivo de backup?")) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const token = (typeof store !== "undefined" && store.token) ? store.token : localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    toast("Restaurando produtos...");
    const res = await fetch("/api/admin/products/import", {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Falha na importacao");
    alert("✓ " + (result.imported || 0) + " produtos restaurados com sucesso!");
    adminProducts();
  } catch(err) {
    alert("Erro ao importar: " + (err.message || "Arquivo invalido"));
  } finally {
    e.target.value = "";
  }
};

window.closeModal = window.closeModal || function(){var m=document.getElementById('modal');if(m){m.classList.add('hidden');m.innerHTML=''}};
window.onerror = function(msg, url, line, col, err) {
  var b = document.createElement('div');
  b.style.cssText = "position:fixed;top:10px;left:10px;right:10px;background:#ef4444;color:#fff;padding:15px;border-radius:10px;z-index:9999999;font-size:14px;font-weight:bold;box-shadow:0 10px 30px rgba(0,0,0,0.8);";
  b.innerHTML = "⚠️ ERRO NO JS: " + msg + "<br><small>Linha: " + line + "</small>";
  document.body.appendChild(b);
  alert("ERRO NO JS: " + msg + " (Linha: " + line + ")");
};

// ==========================================
// MODAL DE PRODUTO FLUTUANTE (FIXO NA TELA)
// ==========================================
window.currentGalleryImages = window.currentGalleryImages || [];
window.currentGalleryIdx = window.currentGalleryIdx || 0;
window.currentQuickProduct = window.currentQuickProduct || null;

window.closeQuickModal = function() {
  const m = document.getElementById('quick-modal');
  if (m) m.remove();
  document.body.style.overflow = '';
};

window.quickView = function(p) {
  currentQuickProduct = p;
  let imgs = [];
  try {
    if (Array.isArray(p.images)) imgs = p.images;
    else if (typeof p.images === 'string') imgs = JSON.parse(p.images);
  } catch(e) {}
  if (!imgs.length && p.image) imgs = [p.image];
  if (!imgs.length) imgs = [''];

  currentGalleryImages = imgs;
  currentGalleryIdx = 0;

  let modal = document.getElementById('quick-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quick-modal';
    document.body.appendChild(modal);
  }

  // Trava rolagem do fundo enquanto modal estiver aberto
  document.body.style.overflow = 'hidden';

  // Estilo fixo cobrindo a tela inteira exatamente onde o usuário estiver
  modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;backdrop-filter:blur(4px);";

  // Fecha se clicar fora do card
  modal.onclick = function(e) {
    if (e.target === modal) window.closeQuickModal();
  };

  function renderGallery() {
    let activeImg = currentGalleryImages[currentGalleryIdx] || '';
    let hasMulti = currentGalleryImages.length > 1;
    let pJson = JSON.stringify(p).replace(/'/g, "&#39;");

    modal.innerHTML = `
      <div style="background:#0d131b;border:1px solid #1f2937;border-radius:18px;max-width:440px;width:100%;max-height:92vh;overflow-y:auto;padding:18px;position:relative;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);box-sizing:border-box;" onclick="event.stopPropagation()">
        
        <!-- BOTAO FECHAR X -->
        <button type="button" onclick="window.closeQuickModal()" style="position:absolute;right:14px;top:14px;background:#1e293b;border:1px solid #334155;color:#fff;width:34px;height:34px;border-radius:50%;font-size:16px;font-weight:bold;cursor:pointer;z-index:20;display:flex;align-items:center;justify-content:center;">✕</button>
        
        <!-- FOTO PRINCIPAL -->
        <div style="position:relative;width:100%;height:310px;background:#060a0f;border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #1e293b;">
          ${activeImg ? `<img src="${activeImg}" style="max-width:100%;max-height:100%;object-fit:contain;">` : '<span style="font-size:55px;color:#334155;">◈</span>'}
          ${hasMulti ? `
            <button type="button" onclick="window.changeGallery(-1)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.75);border:1px solid #22d3ee;color:#22d3ee;width:38px;height:38px;border-radius:50%;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;">‹</button>
            <button type="button" onclick="window.changeGallery(1)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.75);border:1px solid #22d3ee;color:#22d3ee;width:38px;height:38px;border-radius:50%;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;">›</button>
          ` : ''}
        </div>

        <!-- MINIATURAS DAS FOTOS -->
        ${hasMulti ? `
          <div style="display:flex;gap:8px;overflow-x:auto;padding:12px 0 6px 0;scrollbar-width:none;">
            ${currentGalleryImages.map((src, i) => `
              <img src="${src}" onclick="window.setGalleryIdx(${i})" style="width:54px;height:54px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid ${i === currentGalleryIdx ? '#22d3ee' : '#1f2937'};opacity:${i === currentGalleryIdx ? '1' : '0.55'};flex-shrink:0;">
            `).join('')}
          </div>
        ` : ''}

        <!-- DETALHES DO PRODUTO -->
        <div style="margin-top:14px;">
          <small style="color:#22d3ee;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${p.category_name || 'Produto'}</small>
          <h2 style="font-size:18px;margin:6px 0 8px;color:#f8fafc;line-height:1.3;">${p.name || ''}</h2>
          <div style="font-size:24px;font-weight:bold;color:#22d3ee;margin-bottom:12px;">${typeof money === 'function' ? money(p.price) : 'R$ ' + p.price}</div>
          
          <div style="font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:18px;white-space:pre-line;background:#111827;padding:12px;border-radius:10px;border:1px solid #1f2937;">
            ${p.description ? p.description : 'Produto de alta qualidade disponível com envio rápido para todo o Brasil.'}
          </div>

          <!-- BOTOES DE ACAO: ADICIONAR E COMPRAR -->
          <div style="display:grid;grid-template-columns:1fr;gap:10px;">
            <button type="button" onclick='addCart(${pJson}, event); window.closeQuickModal();' style="height:46px;background:#22d3ee;border:none;border-radius:10px;color:#061116;font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 0 20px rgba(34,211,238,0.25);">
              Adicionar ao Carrinho 🛒
            </button>
          </div>
        </div>

      </div>
    `;
  }

  window.changeGallery = function(dir) {
    currentGalleryIdx = (currentGalleryIdx + dir + currentGalleryImages.length) % currentGalleryImages.length;
  };

  window.setGalleryIdx = function(i) {
    currentGalleryIdx = i;
  };

};





// --- REMOVER FOTO NO CADASTRO / EDICAO ---
window.removeProductPhoto = function(index, targetContainerId, inputFieldId) {
  let container = document.getElementById(targetContainerId);
  let hiddenInput = document.getElementById(inputFieldId);
  if (!container || !hiddenInput) return;
  try {
    let list = JSON.parse(hiddenInput.value || '[]');
    list.splice(index, 1);
    hiddenInput.value = JSON.stringify(list);
    renderPhotoThumbnails(list, targetContainerId, inputFieldId);
  } catch(e) {}
};

window.renderPhotoThumbnails = function(list, targetContainerId, inputFieldId) {
  let container = document.getElementById(targetContainerId);
  if (!container) return;
  container.innerHTML = list.map((src, i) => `
    <div style="position:relative;width:64px;height:64px;border-radius:8px;border:1px solid #334155;overflow:hidden;flex-shrink:0;background:#111;">
      <img src="${src}" style="width:100%;height:100%;object-fit:cover;">
      <button type="button" onclick="removeProductPhoto(${i}, '${targetContainerId}', '${inputFieldId}')" style="position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
      ${i === 0 ? '<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(34,211,238,0.85);color:#000;font-size:8px;font-weight:bold;text-align:center;">CAPA</span>' : ''}
    </div>
  `).join('');
};

async function home(){
  const [ps,cats]=await Promise.all([api("/api/products"),api("/api/categories")]);
  const homeSeen=new Set();
  const homeProducts=ps.filter(p=>{
    const name=String(p.name||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const key=name+"|"+Number(p.price||0).toFixed(2);
    if(homeSeen.has(key))return false;
    homeSeen.add(key);
    return true;
  });
  const featured=homeProducts.filter(p=>p.featured).slice(0,10);
  const main=featured.length?featured:homeProducts.slice(0,10);
  const more=homeProducts.filter(p=>!main.some(x=>x.id===p.id)).slice(0,10);

  const trustBar = `
    <section class="container" style="margin: 16px auto 24px; padding: 0 10px;">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">🛡️</span>
          <div><b style="font-size:12px;color:#fff;display:block;">Compra 100% Segura</b><span style="font-size:10px;color:#94a3b8;">Garantia e procedência</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">⚡</span>
          <div><b style="font-size:12px;color:#fff;display:block;">Envio Imediato</b><span style="font-size:10px;color:#94a3b8;">Rastreio em tempo real</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">💳</span>
          <div><b style="font-size:12px;color:#fff;display:block;">Pix com Desconto</b><span style="font-size:10px;color:#94a3b8;">Aprovação instantânea</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">💬</span>
          <div><b style="font-size:12px;color:#fff;display:block;">Suporte Humanizado</b><span style="font-size:10px;color:#94a3b8;">Direto no WhatsApp</span></div>
        </div>
      </div>
    </section>
  `;

  const categoryCards = cats.length ? `
    <section class="container" style="margin-bottom: 24px; padding: 0 10px;">
      <h3 style="font-size:14px;color:#cbd5e1;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Categorias</h3>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;">
        ${cats.map(c => `<a href="#/produtos?cat=${encodeURIComponent(c.slug)}" style="flex:0 0 auto;background:#131c26;border:1px solid #223244;color:#38bdf8;padding:8px 16px;border-radius:24px;font-size:12px;font-weight:700;text-decoration:none;">${esc(c.name)}</a>`).join('')}
      </div>
    </section>
  ` : '';

  const productSection = (items, title) => items.length ? `
    <section class="container" style="margin-bottom:28px; padding: 0 10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="font-size:18px;font-weight:800;margin:0;color:#fff;">${title}</h2>
        <a href="#/produtos" style="color:#22d3ee;font-size:12px;font-weight:bold;text-decoration:none;">Ver todos →</a>
      </div>
      <div class="home-product-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        ${items.map(productCard).join("")}
      </div>
    </section>
  ` : '';

  const emptyNotice = (!homeProducts.length) ? `
    <section class="container" style="text-align:center;padding:36px 16px;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);border-radius:14px;margin:20px 10px 30px;">
      <span style="font-size:36px;display:block;margin-bottom:10px;">📦</span>
      <h3 style="color:#fff;font-size:16px;margin:0 0 6px;">Catálogo em atualização</h3>
      <p style="color:#94a3b8;font-size:12px;margin:0 0 16px;">Novidades exclusivas chegando à MachadoExpress.</p>
      <a href="https://wa.me/5551981884111?text=Ol%C3%A1%2C%20gostaria%20de%20consultar%20produtos%20dispon%C3%ADveis" target="_blank" style="background:#25D366;color:#fff;padding:10px 20px;border-radius:24px;font-weight:bold;font-size:12px;text-decoration:none;display:inline-block;">Consultar no WhatsApp</a>
    </section>
  ` : '';

  $("#app").innerHTML = `
    ${bannerMarkup()}
    ${trustBar}
    ${categoryCards}
    ${productSection(main, "Destaques")}
    ${productSection(more, "Mais Produtos")}
    ${emptyNotice}
  `;
  updateCartUI();
}
let store={settings:{},user:null},cart=JSON.parse(localStorage.getItem("cart")||"[]");
const $=s=>document.querySelector(s), money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const ADMIN_ROLES=["super_admin","admin","gerente","atendente","financeiro"];
const FULL_ADMIN=["super_admin","admin"];
async function api(url,opt={}){let r=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Ocorreu um erro.");return d}
function toast(msg,type="ok"){let x=document.createElement("div");x.className="toast-item "+type;x.innerHTML=`<span>${type==="ok"?"✓":"!"}</span><div>${esc(msg)}</div>`;$("#toast").appendChild(x);setTimeout(()=>x.remove(),3200)}
function removeCart(id){
  cart = cart.filter(x => Number(x.product_id) !== Number(id));
  saveCart();
  renderCart();
  if (typeof renderMiniCart === "function") renderMiniCart();
  toast("Produto removido do carrinho.");
}
window.removeCart = removeCart;
function saveCart(){localStorage.setItem("cart",JSON.stringify(cart));updateCartUI()}
function cartCount(){return cart.reduce((a,x)=>a+Number(x.quantity||0),0)}
function updateCartUI(){let n=cartCount();let el=$("#cartCount");if(el)el.textContent=n;let mini=$("#miniCart");if(mini){renderMiniCart();mini.classList.toggle("has-items",n>0)}}
function closeMenu(){document.body.classList.remove("menu-open")}
function renderMiniCart(){let n=cartCount(),total=cart.reduce((a,x)=>a+x.price*x.quantity,0);let el=$("#miniCart");if(!el)return;el.innerHTML=n?`<div class="sticky-cart-inner"><div class="sticky-cart-icon">🛒<b>${n}</b></div><div class="sticky-cart-copy"><strong>Seu carrinho</strong><span>${n} ${n===1?"item":"itens"} · ${money(total)}</span></div><button class="sticky-cart-view" onclick="openCart()">Abrir carrinho <b>→</b></button></div>`:`<div class="sticky-cart-inner empty-sticky"><div class="sticky-cart-icon">🛒</div><div class="sticky-cart-copy"><strong>Seu carrinho está vazio</strong><span>Adicione produtos para começar</span></div></div>`}
function addCart(p,ev){const stock=Number(p.stock||0);if(stock<=0){toast("Este produto está sem estoque.","warn");return}let x=cart.find(i=>i.product_id===p.id);if(x&&Number(x.quantity)>=stock){toast("Você já adicionou todo o estoque disponível.","warn");return}if(x){x.quantity++;x.stock=stock}else cart.push({product_id:p.id,name:p.name,price:Number(p.price),image:p.image||"",quantity:1,stock});saveCart();updateCartUI();toast(`✓ ${p.name} foi adicionado ao carrinho.`);flyToCart(ev);showMiniCart(p);pulseCart()}
function pulseCart(){let b=document.querySelector(".cart-btn");if(!b)return;b.classList.remove("cart-pop");void b.offsetWidth;b.classList.add("cart-pop")}
function flyToCart(ev){if(!ev?.currentTarget)return;let img=ev.currentTarget.closest(".product-card")?.querySelector(".product-image img");let target=document.querySelector(".cart-btn");if(!img||!target)return;let r=img.getBoundingClientRect(),t=target.getBoundingClientRect(),clone=img.cloneNode();clone.className="fly-product";clone.style.cssText=`left:${r.left}px;top:${r.top}px;width:${Math.min(90,r.width)}px;height:${Math.min(90,r.height)}px`;document.body.appendChild(clone);requestAnimationFrame(()=>{clone.style.left=(t.left+t.width/2-15)+"px";clone.style.top=(t.top+t.height/2-15)+"px";clone.style.width="30px";clone.style.height="30px";clone.style.opacity="0"});setTimeout(()=>clone.remove(),650)}
function showMiniCart(p){const box=$("#miniCart");if(!box)return;box.classList.remove("flash");void box.offsetWidth;box.classList.add("flash");clearTimeout(window.miniTimer);window.miniTimer=setTimeout(()=>box.classList.remove("flash"),900)}
function openCart(){renderCartDrawer();$("#cartDrawer").classList.add("open");$("#cartBackdrop").classList.add("show");document.body.classList.add("drawer-open")}
function closeCart(){if(!$("#cartDrawer"))return;$("#cartDrawer").classList.remove("open");$("#cartBackdrop").classList.remove("show");document.body.classList.remove("drawer-open")}
function renderCartDrawer(){let total=cart.reduce((a,x)=>a+x.price*x.quantity,0);$("#cartDrawer").innerHTML=`<div class="drawer-head v8-drawer-head"><div><small>RESUMO DA COMPRA</small><h2>Seu carrinho</h2><span>${cartCount()} ${cartCount()===1?"produto":"produtos"}</span></div><button onclick="closeCart()">×</button></div><div class="drawer-items">${cart.length?cart.map(x=>`<div class="drawer-item v8-drawer-item"><div class="drawer-img">${x.image?`<img src="${esc(x.image)}">`:"🛍️"}</div><div class="drawer-info"><b>${esc(x.name)}</b><span>${money(x.price)} por unidade</span><div class="qty-row"><button onclick="changeQty(${x.product_id},-1)">−</button><strong>${x.quantity}</strong><button onclick="changeQty(${x.product_id},1)">+</button><button class="remove" onclick="removeCart(${x.product_id})">Remover</button></div></div><strong class="item-total">${money(x.price*x.quantity)}</strong></div>`).join(""):`<div class="cart-empty"><div>🛒</div><h3>Seu carrinho está vazio</h3><p>Adicione produtos e acompanhe tudo por aqui.</p><a class="btn primary" href="#/produtos" onclick="closeCart()">Explorar produtos</a></div>`}</div>${cart.length?`<div class="drawer-bottom v8-drawer-bottom"><div class="summary-line"><span>Subtotal</span><strong>${money(total)}</strong></div><div class="summary-line muted"><span>Frete</span><span>A calcular</span></div><button class="btn primary wide checkout-open" onclick="openCheckoutPanel()">Continuar para pagamento <b>→</b></button><small>Pagamento seguro · Pix disponível</small></div>`:""}`;}
async function openCheckoutPanel(){
  closeCart();
  if(!cart.length){toast("Seu carrinho está vazio.","warn");return}
  if(!store.user){sessionStorage.setItem("voltarAoCheckout","1");closeCart();toast("Entre ou crie sua conta para continuar a compra.","warn");location.hash="#/login";return}
  try{
    const customer=await api("/api/me");
    const addresses=Array.isArray(customer.addresses)?customer.addresses:[];
    const total=cart.reduce((a,x)=>a+x.price*x.quantity,0);
    const freeMin=Number(store.settings?.free_shipping_min||0);
    const shipping=(freeMin&&total>=freeMin)?0:(total>0?10:0);
    const addressOptions=addresses.map((a,i)=>`<option value="${Number(a.id)}" ${i===0?"selected":""}>${esc(a.label||"Endereço")} — ${esc(a.street||"")}, ${esc(a.number||"")}${a.neighborhood?` · ${esc(a.neighborhood)}`:""} · ${esc(a.city||"")}/${esc(a.state||"")}${a.cep?` · CEP ${esc(a.cep)}`:""}</option>`).join("");
    const m=$("#modal");
    m.innerHTML=`<div class="checkout-modal-v8" style="max-height:92vh;overflow:auto"><button class="modal-x" onclick="closeModal()">×</button><div class="checkout-top"><span>FINALIZAÇÃO SEGURA</span><h2>Revisar pedido</h2><p>Confira produtos, endereço e valor total antes de confirmar.</p><div aria-label="Etapas da compra" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:14px"><span style="text-align:center;padding:8px 4px;border-radius:8px;background:rgba(34,211,238,.12);color:#67e8f9;font-size:11px;font-weight:800">1 · Produtos</span><span style="text-align:center;padding:8px 4px;border-radius:8px;background:rgba(34,211,238,.12);color:#67e8f9;font-size:11px;font-weight:800">2 · Entrega</span><span style="text-align:center;padding:8px 4px;border-radius:8px;background:rgba(34,211,238,.12);color:#67e8f9;font-size:11px;font-weight:800">3 · Confirmar</span></div></div><div class="checkout-layout"><div><div class="checkout-list">${cart.map(x=>`<div class="checkout-row"><div>${x.image?`<img src="${esc(x.image)}">`:`<span>◈</span>`}</div><section><b>${esc(x.name)}</b><small>${x.quantity} × ${money(x.price)}</small></section><strong>${money(x.price*x.quantity)}</strong></div>`).join("")}</div><section style="margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:12px"><span style="color:#22d3ee;font-size:11px;font-weight:800">ENTREGA</span><label style="display:block;margin-top:8px">Endereço<select id="checkoutAddress" onchange="checkoutAddressChanged()" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:12px;border-radius:8px;background:#0d131b;color:#fff;border:1px solid rgba(255,255,255,.15)">${addressOptions}<option value="new" ${addresses.length?"":"selected"}>+ Cadastrar novo endereço</option></select></label><div id="checkoutNewAddress" style="display:${addresses.length?"none":"block"};margin-top:10px"><div class="two-fields"><input name="cep" form="checkoutForm" placeholder="CEP" ${addresses.length?"":"required"}><input name="number" form="checkoutForm" placeholder="Número" ${addresses.length?"":"required"}></div><input name="street" form="checkoutForm" placeholder="Rua / Avenida" ${addresses.length?"":"required"}><input name="neighborhood" form="checkoutForm" placeholder="Bairro" ${addresses.length?"":"required"}><div class="two-fields"><input name="city" form="checkoutForm" placeholder="Cidade" ${addresses.length?"":"required"}><input name="state" form="checkoutForm" placeholder="UF" maxlength="2" ${addresses.length?"":"required"}></div><input name="complement" form="checkoutForm" placeholder="Complemento (opcional)"></div></section></div><aside class="checkout-summary"><div><span>Subtotal dos produtos</span><b>${money(total)}</b></div><div><span>Frete</span><b>${shipping?money(shipping):"Grátis"}</b></div><small style="display:block;color:#94a3b8;line-height:1.45">Frete calculado conforme as regras da loja. Confira o total antes de confirmar.</small><div class="checkout-total"><span>Total do pedido</span><b>${money(total+shipping)}</b></div><label class="pay-option"><input type="radio" checked disabled> <span><b>Pix</b><small>Pagamento confirmado manualmente pela loja</small></span></label><form id="checkoutForm" onsubmit="finalizeCheckout(event)"><button class="btn primary wide" type="submit">Confirmar pedido</button></form><small class="checkout-note">A confirmação do pagamento é feita manualmente pela loja. A quantidade em estoque é atualizada quando o pagamento for confirmado.</small></aside></div></div>`;
    m.classList.remove("hidden");
    if(addresses.length)document.getElementById("checkoutAddress").value=String(addresses[0].id);
  }catch(e){toast("Não consegui carregar os endereços. Tente novamente.","warn")}
}
function checkoutAddressChanged(){
  const select=document.getElementById("checkoutAddress"),box=document.getElementById("checkoutNewAddress");
  if(!select||!box)return;
  const isNew=select.value==="new";box.style.display=isNew?"block":"none";
  box.querySelectorAll("input").forEach(input=>{input.required=isNew&&input.name!=="complement";input.disabled=!isNew});
}
async function finalizeCheckout(event){
  if(event)event.preventDefault();
  if(!store.user){sessionStorage.setItem("voltarAoCheckout","1");closeModal();location.hash="#/login";return}
  const select=document.getElementById("checkoutAddress");
  if(!select){toast("Abra novamente a finalização da compra.","warn");return}
  const body={items:cart,payment_method:"pix"};
  if(select.value==="new"){
    const form=document.getElementById("checkoutForm");
    if(!form.reportValidity())return;
    const fields=document.getElementById("checkoutNewAddress");
    body.address=Object.fromEntries(Array.from(fields.querySelectorAll("input")).map(i=>[i.name,i.value.trim()]));
  }else body.address_id=Number(select.value);
  try{
    const d=await api("/api/orders",{method:"POST",body:JSON.stringify(body)});
    cart=[];saveCart();closeModal();
    const pixKey=String(store.settings?.pix_key||"").trim();
    const pixName=String(store.settings?.pix_name||"").trim();
    const pixCity=String(store.settings?.pix_city||"").trim();
    let waNumber=String(store.settings?.store_whatsapp||"").replace(/\D/g,"");
    if(waNumber&&!waNumber.startsWith("55")&&(waNumber.length===10||waNumber.length===11))waNumber="55"+waNumber;
    const waMessage=encodeURIComponent(`Olá! Fiz o pedido #${d.id}, no valor de ${money(d.total)}, e gostaria de confirmar o pagamento via Pix.`);
    const waUrl=waNumber?`https://wa.me/${waNumber}?text=${waMessage}`:"";
    const m=$("#modal");
    m.innerHTML=`<div class="checkout-modal-v8" style="max-height:92vh;overflow:auto"><button class="modal-x" onclick="closeModal()">×</button><div class="checkout-top"><span>PEDIDO CRIADO · PAGAMENTO PENDENTE</span><h2>Pedido #${esc(d.id)}</h2><p>Valor total: <strong>${money(d.total)}</strong></p></div><section style="padding:16px;border:1px solid rgba(34,211,238,.25);border-radius:14px;background:rgba(34,211,238,.05)"><h3 style="margin:0 0 8px;color:#67e8f9">Pague via Pix</h3><p style="margin:0 0 10px;color:#cbd5e1">A confirmação do pagamento é manual. O pedido só será marcado como pago depois da conferência pela loja.</p>${pixKey?`<p style="margin:10px 0 6px;color:#94a3b8">Chave Pix</p><div id="orderPixKey" style="padding:12px;background:#111923;border-radius:8px;overflow-wrap:anywhere;color:#f1f5f9">${esc(pixKey)}</div><button id="copyOrderPix" type="button" class="btn ghost" style="margin-top:10px">Copiar chave Pix</button>`:`<p style="color:#fbbf24">A chave Pix ainda não está cadastrada nas configurações da loja. Entre em contato pelo WhatsApp.</p>`}${pixName?`<p style="margin:10px 0 0;color:#cbd5e1">Recebedor: ${esc(pixName)}</p>`:""}${pixCity?`<p style="margin:4px 0 0;color:#cbd5e1">Cidade: ${esc(pixCity)}</p>`:""}</section>${waUrl?`<a class="btn primary wide" href="${waUrl}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;margin-top:12px">Enviar comprovante pelo WhatsApp</a>`:`<p class="checkout-note">WhatsApp da loja não configurado no painel.</p>`}<button type="button" class="btn ghost wide" style="margin-top:10px" onclick="closeModal();location.hash='#/conta'">Ver meus pedidos</button></div>`;
    m.classList.remove("hidden");
    const copyPixButton=document.getElementById("copyOrderPix");
    if(copyPixButton)copyPixButton.onclick=async()=>{try{await navigator.clipboard.writeText(pixKey);toast("Chave Pix copiada.")}catch(copyError){toast("Não consegui copiar automaticamente. Selecione a chave Pix e copie.","warn")}};
  }catch(e){toast(e.message,"warn")}
}

function installStorefrontPolish(){
  if(document.getElementById("storefront-polish-v1")) return;
  const style=document.createElement("style");
  style.id="storefront-polish-v1";
  style.textContent=`
    .catalog-search{display:flex;align-items:center;gap:8px}
    .catalog-search input{min-width:0;flex:1}
    .catalog-search button{border:0;border-radius:9px;padding:10px 14px;background:var(--primary,#22d3ee);color:#071116;font-weight:800;cursor:pointer}
    .catalog-refine{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:12px 0}
    .catalog-refine>label:first-child{display:flex;align-items:center;gap:8px;color:#cbd5e1;font-size:13px}
    .catalog-refine select{background:#111822;color:#f8fafc;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:9px 30px 9px 10px;max-width:100%}
    .catalog-available{display:flex;gap:7px;align-items:center;color:#cbd5e1;font-size:13px}
    .catalog-available input{accent-color:var(--primary,#22d3ee);width:17px;height:17px}
    .catalog-count{color:#94a3b8;font-size:13px;margin:8px 0 12px}
    .product-card .product-body h3{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:1.35;min-height:2.7em;overflow-wrap:anywhere}
    .product-card .product-body>p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:1.45;min-height:2.9em}
    .product-card .product-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .product-card .product-bottom strong{font-size:clamp(15px,4vw,20px);white-space:nowrap}
    .product-card .add-btn{min-height:40px;touch-action:manipulation}
    @media(max-width:520px){
      .catalog-toolbar{gap:8px}
      .catalog-search{width:100%;box-sizing:border-box}
      .catalog-search button{padding:10px}
      .catalog-refine{align-items:flex-start}
      .product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px!important}
      .product-card{min-width:0}
      .product-card .product-body{padding:10px!important}
      .product-card .product-bottom{align-items:stretch}
      .product-card .add-btn{width:100%;justify-content:center}
      .home-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
  `;
  document.head.appendChild(style);
}

async function load(){
  installStorefrontPolish();
  store=await api("/api/store");
  document.documentElement.style.setProperty("--primary",store.settings.primary_color||"#22d3ee");
  document.title=(store.settings.store_name||"Minha Loja")+" • Tech Store";
  let label=$("#accountLabel"),admin=$("#adminNav"),ma=$("#mobileAdminNav");
  if(store.user){label.textContent=store.user.name?.split(" ")[0]||"Conta"}else label.textContent="Minha conta";
  let isAdmin=!!store.user&&ADMIN_ROLES.includes(store.user.role);
  admin.style.display=isAdmin?"inline":"none";ma.style.display=isAdmin?"block":"none";
  updateCartUI(); renderFooter(); route();
}
function bannerMarkup() {
  return `
    <section class="home-banner-clean" style="max-width:1200px;margin:12px auto 20px auto;padding:0 10px;box-sizing:border-box;">
      <div style="width:100%;border-radius:18px;overflow:hidden;border:1px solid rgba(0,210,255,0.3);box-shadow:0 12px 35px rgba(0,0,0,0.6);line-height:0;background:#060d17;">
        <a href="#/produtos" title="Ver catálogo de produtos" style="display:block;width:100%;cursor:pointer;">
          <img src="/banner2.png?v=${Date.now()}" alt="MachadoExpress Banner" style="width:100%;height:auto;display:block;object-fit:cover;">
        </a>
      </div>
    </section>`;
}
function productCard(p){
  const imgHtml = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : `<span>◈</span>`;
  const tagDestaque = p.featured ? `<label>DESTAQUE</label>` : '';
  const estoque = Number(p.stock ?? 0);
  const semEstoque = estoque <= 0;
  const tagEstoque = semEstoque ? `<label style="position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;padding:5px 8px;border-radius:6px;font-size:9px;font-weight:900;">ESGOTADO</label>` : '';
  const textoEstoque = semEstoque ? 'Esgotado' : `Em estoque: ${estoque} un.`;
  const corEstoque = semEstoque ? '#ef4444' : '#22c55e';
  const pJson = JSON.stringify(p).replace(/'/g, "&#39;");
  return `<article class="product-card">
    <div class="product-image" onclick='quickView(${pJson})' style="cursor:pointer;">
      ${imgHtml}
      ${tagDestaque}${tagEstoque}
    </div>
    <div class="product-body">
      <small>${esc(p.category_name||"Produto")}</small>
      <h3 onclick='quickView(${pJson})' style="cursor:pointer;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;display:-webkit-box!important;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-height:1.25;min-height:2.5em;word-break:break-word;">${esc(p.name)}</h3>
      <p>${esc(p.description||"Produto selecionado para você.")}</p>
      <small style="display:block;margin:0 0 8px;color:${corEstoque};font-size:12px;font-weight:700;">${textoEstoque}</small>
      <div class="product-bottom">
        <strong>${money(p.price)}</strong>
        <button class="add-btn" ${semEstoque?'disabled aria-disabled="true"':''} onclick='addCart(${pJson},event)'>${semEstoque?'Esgotado':'Adicionar <b>+</b>'}</button>
      </div>
    </div>
  </article>`;
}
function emptyProducts(){return `<div class="empty">Nenhum produto cadastrado ainda.</div>`}
function quickView(p){
  let imgs = [];
  if(p.images){
    try {
      imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
    } catch(e) {
      imgs = [];
    }
  }
  if(!imgs.length && p.image) imgs = [p.image];
  const mainImg = imgs.length ? imgs[0] : "";
  
  const thumbs = imgs.map((img, i) => `
    <img src="${esc(img)}" onclick="document.getElementById('quickViewMainImg').src='${esc(img)}';document.querySelectorAll('.thumb-btn').forEach(b=>b.style.borderColor='rgba(255,255,255,0.1)');this.style.borderColor='#22d3ee';" class="thumb-btn" style="width:55px;height:55px;object-fit:contain;background:#0d131b;border-radius:10px;border:2px solid ${i===0?'#22d3ee':'rgba(255,255,255,0.1)'};cursor:pointer;padding:2px;flex-shrink:0;">
  `).join("");

  $("#modal").innerHTML = `
    <div class="form-modal" style="max-width:540px;padding:20px;background:#111822;border:1px solid rgba(255,255,255,0.1);border-radius:18px;">
      <button class="modal-x" onclick="closeModal()">×</button>
      
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="width:100%;aspect-ratio:1/1;max-height:330px;background:#0d131b;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.06);position:relative;">
          ${mainImg ? `<img id="quickViewMainImg" src="${esc(mainImg)}" style="width:100%;height:100%;object-fit:contain;">` : `<span style="font-size:48px;color:#374454;">◈</span>`}
          ${p.featured ? `<label style="position:absolute;top:10px;left:10px;background:#22d3ee;color:#000;font-weight:900;font-size:9px;padding:3px 8px;border-radius:6px;">DESTAQUE</label>` : ""}
        </div>
        
        ${imgs.length > 1 ? `
        <div>
          <small style="color:#8995a7;font-size:10px;display:block;margin-bottom:6px;">Toque na foto para visualizar:</small>
          <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">${thumbs}</div>
        </div>` : ""}

        <div>
          <span style="color:#22d3ee;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${esc(p.category_name||"Produto")}</span>
          <h2 style="font-size:20px;color:#fff;margin:4px 0 8px;font-weight:800;">${esc(p.name)}</h2>
          <div style="display:flex;align-items:baseline;gap:10px;">
            <strong style="font-size:24px;color:#22d3ee;font-weight:900;">${money(p.price)}</strong>
            <span style="color:#8995a7;font-size:11px;">● ${Number(p.stock || 0) > 0 ? "Em estoque (" + p.stock + " un)" : "Esgotado"}</span>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;">
          <b style="font-size:11px;color:#cbd5e1;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.8px;">Informações do Produto:</b>
          <p style="font-size:13px;color:#94a3b8;line-height:1.5;margin:0;white-space:pre-wrap;">${esc(p.description || "Produto com garantia e entrega rápida pela Machado Express.")}</p>
        </div>

        <button class="btn primary wide" onclick=\x27addCart(${JSON.stringify(p).replace(/'/g,"&#39;")},event);closeModal();\x27 style="padding:14px;font-size:14px;font-weight:bold;border-radius:10px;margin-top:4px;">
          Adicionar ao Carrinho 🛍️
        </button>
      </div>
    </div>
  `;
  $("#modal").classList.remove("hidden");
}
async function products(){
  const qs=new URLSearchParams(location.hash.split("?")[1]||"");
  const q=qs.get("q")||"", cat=qs.get("cat")||"", sort=qs.get("sort")||"default", onlyAvailable=qs.get("available")==="1";
  const [allProducts,cats]=await Promise.all([
    api("/api/products?q="+encodeURIComponent(q)+"&category="+encodeURIComponent(cat)),
    api("/api/categories")
  ]);
  let visible=[...allProducts];
  if(onlyAvailable) visible=visible.filter(p=>Number(p.stock)>0);
  if(sort==="price-low") visible.sort((a,b)=>Number(a.price)-Number(b.price));
  else if(sort==="price-high") visible.sort((a,b)=>Number(b.price)-Number(a.price));
  else if(sort==="name") visible.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pt-BR"));
  else if(sort==="newest") visible.sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));

  window.catalogSet=function(key,value){
    const next=new URLSearchParams(location.hash.split("?")[1]||"");
    if(value) next.set(key,value); else next.delete(key);
    location.hash="#/produtos"+(next.toString()?"?"+next.toString():"");
  };

  $("#app").innerHTML=`<section class="page container"><div class="page-title"><span>CATÁLOGO</span><h1>Explore nossos produtos</h1><p>Busque, filtre e encontre o que procura.</p></div>
    <div class="catalog-toolbar">
      <form class="search-box catalog-search" onsubmit="event.preventDefault();window.catalogSet('q',this.elements.q.value.trim())"><span>⌕</span><input name="q" type="search" placeholder="Buscar produtos..." value="${esc(q)}" aria-label="Buscar produtos"><button type="submit" aria-label="Buscar">Buscar</button></form>
      <div class="catalog-refine"><label>Ordenar por<select aria-label="Ordenar produtos" onchange="window.catalogSet('sort',this.value)"><option value="default" ${sort==="default"?"selected":""}>Recomendados</option><option value="newest" ${sort==="newest"?"selected":""}>Mais recentes</option><option value="price-low" ${sort==="price-low"?"selected":""}>Menor preço</option><option value="price-high" ${sort==="price-high"?"selected":""}>Maior preço</option><option value="name" ${sort==="name"?"selected":""}>Nome A–Z</option></select></label><label class="catalog-available"><input type="checkbox" ${onlyAvailable?"checked":""} onchange="window.catalogSet('available',this.checked?'1':'')"> Apenas disponíveis</label></div>
      <div class="cat-scroll"><a class="${!cat?"active":""}" href="#/produtos">Todos</a>${cats.map(c=>`<a class="${cat===c.slug?"active":""}" href="#/produtos?cat=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`).join("")}</div>
    </div>
    <p class="catalog-count">${visible.length} ${visible.length===1?"produto encontrado":"produtos encontrados"}</p>
    <div class="product-grid">${visible.length?visible.map(productCard).join(""):`<div class="empty"><h3>Nenhum produto encontrado</h3><p>Tente outra busca ou remova os filtros.</p><a class="btn ghost" href="#/produtos">Limpar filtros</a></div>`}</div>
  </section>`;
  updateCartUI();
}
function authLayout(title,sub,form,mode){return `<section class="auth-page"><div class="auth-shell"><div class="auth-side"><div class="auth-logo">MINHA<span>LOJA</span> <small>TECH</small></div><div><span class="eyebrow"><i></i> EXPERIÊNCIA PREMIUM</span><h2>Seu próximo<br><strong>upgrade</strong> começa aqui.</h2><p>Tenha uma conta para acompanhar pedidos, salvar endereços e finalizar suas compras com mais rapidez.</p></div><div class="auth-points"><span>✓ Histórico de pedidos</span><span>✓ Checkout mais rápido</span><span>✓ Seus dados protegidos</span></div></div><div class="auth-form"><div class="auth-heading"><span>ACESSO</span><h1>${title}</h1><p>${sub}</p></div>${form}<div class="auth-switch">${mode==="login"?"Ainda não tem conta?":"Já possui uma conta?"} <a href="#/${mode==="login"?"registro":"login"}">${mode==="login"?"Criar conta":"Entrar"}</a></div></div></div></section>`}
function login(){ $("#app").innerHTML=authLayout("Bem-vindo de volta","Entre para continuar sua experiência.",`<form class="auth-fields" onsubmit="doLogin(event)"><label>E-MAIL<input name="email" type="email" autocomplete="email" placeholder="voce@email.com" required></label><label>SENHA<div class="password-wrap"><input id="loginPass" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required><button type="button" onclick="togglePass('loginPass',this)">Mostrar</button></div></label><div class="remember"><label><input type="checkbox"> Lembrar acesso</label><a href="#/registro">Criar conta</a></div><button class="btn primary wide auth-submit">Entrar na minha conta →</button></form>`,"login")}
async function doLogin(e){e.preventDefault();let f=Object.fromEntries(new FormData(e.target));try{await api("/api/auth/login",{method:"POST",body:JSON.stringify(f)});await load();toast("Login realizado com sucesso.");if(sessionStorage.getItem("voltarAoCheckout")==="1"){sessionStorage.removeItem("voltarAoCheckout");location.hash="#/";setTimeout(()=>openCheckoutPanel(),250)}else location.hash="#/conta"}catch(x){toast(x.message,"warn")}}
function register(){ $("#app").innerHTML=authLayout("Criar sua conta","Leva menos de um minuto.",`<form class="auth-fields" onsubmit="doRegister(event)"><div class="two-fields"><label>NOME<input name="name" autocomplete="name" placeholder="Seu nome" required></label><label>TELEFONE<input name="phone" autocomplete="tel" placeholder="(00) 00000-0000"></label></div><label>E-MAIL<input name="email" type="email" autocomplete="email" placeholder="voce@email.com" required></label><label>CPF<input name="cpf" inputmode="numeric" placeholder="000.000.000-00"></label><label>SENHA<div class="password-wrap"><input id="regPass" name="password" type="password" minlength="6" autocomplete="new-password" placeholder="Mínimo de 6 caracteres" required><button type="button" onclick="togglePass('regPass',this)">Mostrar</button></div></label><label class="terms"><input type="checkbox" required> Concordo com os termos e a política de privacidade.</label><button class="btn primary wide auth-submit">Criar minha conta →</button></form>`,"register")}
function togglePass(id,b){let x=$("#"+id);x.type=x.type==="password"?"text":"password";b.textContent=x.type==="password"?"Mostrar":"Ocultar"}
async function doRegister(e){e.preventDefault();let f=Object.fromEntries(new FormData(e.target));try{await api("/api/auth/register",{method:"POST",body:JSON.stringify(f)});await load();toast("Conta criada com sucesso.");if(sessionStorage.getItem("voltarAoCheckout")==="1"){sessionStorage.removeItem("voltarAoCheckout");location.hash="#/";setTimeout(()=>openCheckoutPanel(),250)}else location.hash="#/conta"}catch(x){toast(x.message,"warn")}}
function orderStatusLabel(status){
  const labels={pending:"Pedido recebido",paid:"Pagamento confirmado",processing:"Em preparação",shipped:"Enviado",delivered:"Entregue",cancelled:"Cancelado",refunded:"Reembolsado"};
  return labels[status]||"Em atualização";
}
function paymentStatusLabel(status){
  const labels={pending:"Aguardando pagamento",paid:"Pagamento confirmado",failed:"Pagamento não aprovado",refunded:"Reembolsado",cancelled:"Cancelado"};
  return labels[status]||status||"Não informado";
}
function orderTrackingCard(o){
  const steps=[
    {key:"pending",label:"Pedido recebido"},
    {key:"paid",label:"Pagamento confirmado"},
    {key:"processing",label:"Em preparação"},
    {key:"shipped",label:"Enviado"},
    {key:"delivered",label:"Entregue"}
  ];
  const current=steps.findIndex(x=>x.key===o.status);
  const terminal=o.status==="cancelled"||o.status==="refunded";
  const timeline=terminal?"":`<div style="overflow-x:auto;margin:16px 0 10px;"><div aria-label="Etapas do pedido" style="display:grid;grid-template-columns:repeat(5,minmax(82px,1fr));min-width:440px;gap:0;">${steps.map((step,i)=>{const done=i<=current;return `<div style="text-align:center;position:relative;color:${done?'#22d3ee':'#64748b'};"><div style="height:3px;background:${i===0?(done?'#22d3ee':'#334155'):((i<=current)?'#22d3ee':'#334155')};position:absolute;top:10px;left:${i===0?'50%':'0'};right:${i===steps.length-1?'50%':'0'};"></div><span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${done?'#22d3ee':'#1e293b'};color:${done?'#071116':'#94a3b8'};font-size:12px;font-weight:900;border:2px solid ${done?'#22d3ee':'#475569'};">${done?'✓':i+1}</span><small style="display:block;padding:6px 3px 0;font-size:10px;line-height:1.3;">${step.label}</small></div>`}).join('')}</div></div>`;
  const notice=terminal?`<div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,.12);color:#fecaca;font-size:13px;">${orderStatusLabel(o.status)}${o.status==="refunded"?". Consulte o meio de pagamento para verificar o prazo de devolução.":". Se precisar de ajuda, fale com a loja."}</div>`:"";
  const tracking=o.tracking?`<div style="margin-top:12px;padding:12px;border:1px solid rgba(34,211,238,.24);background:rgba(34,211,238,.06);border-radius:10px;"><small style="display:block;color:#94a3b8;margin-bottom:5px;">CÓDIGO DE RASTREIO</small><code style="color:#67e8f9;font-size:14px;overflow-wrap:anywhere;">${esc(o.tracking)}</code></div>`:"";
  return `<article style="padding:16px;margin:12px 0;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.025);"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;"><div><b style="font-size:16px;color:#f8fafc;">Pedido #${esc(o.id)}</b><small style="display:block;color:#94a3b8;margin-top:4px;">${formatCustomerOrderDate(o.created_at)}</small></div><div style="text-align:right;"><strong style="display:block;color:#22d3ee;">${money(o.total)}</strong><span style="font-size:12px;color:#cbd5e1;">${orderStatusLabel(o.status)}</span></div></div><div style="margin-top:10px;font-size:12px;color:#cbd5e1;">${paymentStatusLabel(o.payment_status)}</div>${timeline}${notice}${tracking}</article>`;
}
function customerOrderMatches(order,filter){
  const status=String(order.status||"").toLowerCase();
  const payment=String(order.payment_status||"").toLowerCase();
  if(filter==="waiting") return payment==="pending" && !["cancelled","refunded"].includes(status);
  if(filter==="progress") return payment!=="pending" && !["delivered","cancelled","refunded"].includes(status);
  if(filter==="delivered") return status==="delivered";
  if(filter==="cancelled") return ["cancelled","refunded"].includes(status);
  return true;
}
function customerOrdersPanelHtml(){
  const orders=Array.isArray(window.__customerOrders)?window.__customerOrders:[];
  const filter=window.__customerOrdersFilter||"waiting";
  const tabs=[
    {id:"waiting",label:"Aguardando pagamento",count:orders.filter(o=>customerOrderMatches(o,"waiting")).length},
    {id:"progress",label:"Em andamento",count:orders.filter(o=>customerOrderMatches(o,"progress")).length},
    {id:"delivered",label:"Entregues",count:orders.filter(o=>customerOrderMatches(o,"delivered")).length},
    {id:"cancelled",label:"Cancelados",count:orders.filter(o=>customerOrderMatches(o,"cancelled")).length}
  ];
  const shown=orders.filter(o=>customerOrderMatches(o,filter));
  const buttons=tabs.map(t=>`<button type="button" onclick="setCustomerOrdersFilter('${t.id}')" aria-pressed="${filter===t.id}" style="white-space:nowrap;padding:9px 12px;border-radius:999px;border:1px solid ${filter===t.id?'#22d3ee':'rgba(255,255,255,.14)'};background:${filter===t.id?'rgba(34,211,238,.14)':'#111822'};color:${filter===t.id?'#67e8f9':'#cbd5e1'};font-weight:700;cursor:pointer">${t.label} <span style="opacity:.75">${t.count}</span></button>`).join("");
  const list=shown.length?shown.map(orderTrackingCard).join(""):`<div class="cart-empty"><h3>${orders.length?"Nenhum pedido nesta situação":"Nenhum pedido ainda"}</h3><p>${orders.length?"Escolha outra aba para ver seus pedidos.":"Quando você fizer uma compra, poderá acompanhar as etapas por aqui."}</p>${orders.length?"":`<a class="btn primary" href="#/produtos">Explorar produtos</a>`}</div>`;
  return `<div id="customer-orders-filter-panel"><div style="display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;margin:0 0 8px">${buttons}</div>${list}</div>`;
}
function renderCustomerOrders(orders){
  window.__customerOrders=Array.isArray(orders)?orders:[];
  if(!["waiting","progress","delivered","cancelled"].includes(window.__customerOrdersFilter))window.__customerOrdersFilter="waiting";
  return customerOrdersPanelHtml();
}
function setCustomerOrdersFilter(filter){
  if(!["waiting","progress","delivered","cancelled"].includes(filter))filter="waiting";
  window.__customerOrdersFilter=filter;
  const el=document.getElementById("customer-orders-filter-panel");
  if(el)el.outerHTML=customerOrdersPanelHtml();
}

function installAccountResponsiveLayout(){
  if(document.getElementById("account-responsive-v1")) return;
  const style=document.createElement("style");
  style.id="account-responsive-v1";
  style.textContent=`
    .account-grid{display:grid;grid-template-columns:minmax(220px,280px) minmax(0,1fr);gap:20px;align-items:start;width:100%;max-width:100%;box-sizing:border-box}
    .account-grid>* ,.account-content,.account-side{min-width:0;max-width:100%;box-sizing:border-box}
    .account-content{width:100%;overflow:hidden}
    .account-stats{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:100%;max-width:100%;box-sizing:border-box}
    .account-stats>*{min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}
    .account-panels{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;width:100%;max-width:100%;box-sizing:border-box}
    .account-panels>*{min-width:0;max-width:100%;box-sizing:border-box}
    .account-content .panel{min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden}
    .account-content form.panel{display:flex;flex-direction:column;align-items:stretch;gap:12px}
    .account-content form.panel>label{display:block;width:100%;min-width:0;box-sizing:border-box}
    .account-content input:not([type=checkbox]),.account-content select,.account-content textarea{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:#0d131b;color:#f8fafc;font:inherit}
    .account-content input::placeholder{color:#94a3b8}
    .account-content input:not([type=checkbox]),.account-content textarea{color:#f8fafc!important;-webkit-text-fill-color:#f8fafc!important;caret-color:#22d3ee!important;background:#0d131b!important}
    .account-content input::placeholder,.account-content textarea::placeholder{color:#94a3b8!important;-webkit-text-fill-color:#94a3b8!important;opacity:1}
    .account-content input:not([type=checkbox]),.account-content textarea{color:#f8fafc!important;-webkit-text-fill-color:#f8fafc!important;caret-color:#22d3ee!important;background:#0d131b!important}
    .account-content input::placeholder,.account-content textarea::placeholder{color:#94a3b8!important;-webkit-text-fill-color:#94a3b8!important;opacity:1}
    .account-content .two-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%;min-width:0;max-width:100%;box-sizing:border-box}
    .account-content .two-fields>*{min-width:0;max-width:100%;box-sizing:border-box}
    .orders-panel{width:100%;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden}
    .orders-panel article{width:100%;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden}
    .orders-panel article>div{min-width:0;max-width:100%;box-sizing:border-box}
    .orders-panel [aria-label="Etapas do pedido"]{width:max-content}
    @media(max-width:760px){
      .account-grid{grid-template-columns:minmax(0,1fr);gap:14px}
      .account-side{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%;padding:14px!important}
      .account-side .profile-chip{display:grid;grid-template-columns:42px minmax(0,1fr);column-gap:10px;align-items:center;flex:1 1 100%;min-width:0;max-width:100%;overflow-wrap:anywhere}
      .account-side .profile-chip>div{grid-row:1 / span 2}
      .account-side>a,.account-side>button{flex:1 1 auto;text-align:center;justify-content:center;padding:10px 12px!important;border-radius:10px;white-space:nowrap}
      .account-content{width:100%;min-width:0}
      .account-stats{gap:8px}
      .account-stats>*{padding:12px!important}
      .account-panels{grid-template-columns:minmax(0,1fr);gap:12px}
      .account-content form.panel{width:100%;padding:16px!important}
      .orders-panel{padding:16px!important}
      .orders-panel article{padding:14px!important}
      .orders-panel article>div[style*="overflow-x:auto"]{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
      .account-side>a,.account-side>button{max-width:100%;box-sizing:border-box}
    }
    @media(max-width:420px){
      .account-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
      .account-stats>*{padding:10px 7px!important}
      .account-stats span{font-size:12px}
      .account-stats b{font-size:20px;overflow-wrap:anywhere}
      .account-content .two-fields{grid-template-columns:minmax(0,1fr)}
      .account-content form.panel{gap:10px}
      .orders-panel article>div:first-child{align-items:flex-start!important}
    }
  `;
  document.head.appendChild(style);
}

function formatCustomerOrderDate(value){
  if(!value)return "Data não informada";
  const raw=String(value).trim();
  let date;
  if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)){
    date=new Date(raw.replace(" ","T")+"Z");
  }else{
    date=new Date(raw);
  }
  if(Number.isNaN(date.getTime()))return raw;
  return new Intl.DateTimeFormat("pt-BR",{
    timeZone:"America/Sao_Paulo",
    day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit"
  }).format(date);
}
function installAccountResponsiveV2(){
  if(document.getElementById("account-responsive-v2"))return;
  const style=document.createElement("style");
  style.id="account-responsive-v2";
  style.textContent=`
    @media(max-width:760px){
      #app .account-grid .account-side{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        align-items:stretch!important;
        gap:8px!important;width:100%!important
      }
      #app .account-grid .account-side .profile-chip{
        grid-column:1/-1!important;
        display:grid!important;
        grid-template-columns:42px minmax(0,1fr)!important;
        align-items:center!important;column-gap:10px!important;
        margin:0 0 6px!important
      }
      #app .account-grid .account-side .profile-chip>div{grid-row:1/span 2!important}
      #app .account-grid .account-side>a,
      #app .account-grid .account-side>button{
        display:flex!important;justify-content:center!important;
        align-items:center!important;width:100%!important;
        min-width:0!important;min-height:42px!important;
        margin:0!important;padding:9px 8px!important;
        text-align:center!important;white-space:normal!important;
        box-sizing:border-box!important
      }
      #app .account-content .panel{margin-left:0!important;margin-right:0!important}
      #app .account-content input:not([type=checkbox]),
      #app .account-content select,
      #app .account-content textarea{
        background:#0d131b!important;color:#f8fafc!important;
        border:1px solid rgba(255,255,255,.18)!important;
        font-size:16px!important
      }
      #app #customer-orders-filter-panel>div:first-child{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        overflow:visible!important;white-space:normal!important;gap:8px!important
      }
      #app #customer-orders-filter-panel>div:first-child button{
        width:100%!important;min-width:0!important;
        white-space:normal!important;line-height:1.25!important;
        text-align:center!important
      }
      #app .orders-panel article>div[style*="overflow-x:auto"]{
        max-width:100%!important;overflow-x:auto!important;
        overflow-y:hidden!important;scrollbar-width:none!important;
        -webkit-overflow-scrolling:touch!important
      }
      #app .orders-panel article>div[style*="overflow-x:auto"]::-webkit-scrollbar{
        display:none!important;height:0!important
      }
      #app .orders-panel{overflow:hidden!important}
    }
  `;
  document.head.appendChild(style);
}

function setAccountSection(section){
  const allowed=["profile","addresses","orders"];
  if(!allowed.includes(section))section="profile";
  window.__accountSection=section;
  allowed.forEach(name=>{
    const panel=document.getElementById("account-section-"+name);
    const button=document.querySelector('[data-account-tab="'+name+'"]');
    if(panel)panel.style.display=name===section?"block":"none";
    if(button){
      const active=name===section;
      button.setAttribute("aria-selected",String(active));
      button.style.background=active?"rgba(34,211,238,.14)":"#111822";
      button.style.color=active?"#67e8f9":"#cbd5e1";
      button.style.borderColor=active?"#22d3ee":"rgba(255,255,255,.14)";
    }
  });
}
async function account(){
  installAccountResponsiveV2();
  installAccountResponsiveLayout();
  if(!store.user){location.hash="#/login";return}
  let d=await api("/api/me");
  const active=["profile","addresses","orders"].includes(window.__accountSection)?window.__accountSection:"profile";
  const addresses=Array.isArray(d.addresses)?d.addresses:[];
  const addressCards=addresses.length?addresses.map(a=>`<article style="padding:14px;margin:0 0 10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:#111822"><b>${esc(a.label||"Endereço salvo")}</b><p style="margin:6px 0 0;color:#cbd5e1">${esc(a.street||"")}${a.number?", "+esc(a.number):""}${a.neighborhood?" · "+esc(a.neighborhood):""}<br>${esc(a.city||"")}${a.state?" / "+esc(a.state):""}${a.cep?" · CEP "+esc(a.cep):""}</p>${a.complement?`<small style="color:#94a3b8">${esc(a.complement)}</small>`:""}</article>`).join(""):"<p class=\"muted\">Você ainda não tem endereços salvos.</p>";
  const tabStyle="padding:11px 10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#111822;color:#cbd5e1;font-weight:700;font-size:14px;cursor:pointer";
  $("#app").innerHTML=`<section class="page container"><div class="page-title"><span>MINHA ÁREA</span><h1>Olá, ${esc(d.user.name.split(" ")[0])}.</h1><p>Escolha uma aba para acessar uma parte da sua conta.</p></div><div class="account-grid" style="grid-template-columns:minmax(0,1fr)"><div class="account-content" style="width:100%;max-width:760px;margin:0 auto"><nav aria-label="Seções da minha área" role="tablist" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 16px"><button type="button" role="tab" data-account-tab="profile" aria-selected="${active==="profile"}" onclick="setAccountSection('profile')" style="${tabStyle}">Perfil</button><button type="button" role="tab" data-account-tab="addresses" aria-selected="${active==="addresses"}" onclick="setAccountSection('addresses')" style="${tabStyle}">Endereços</button><button type="button" role="tab" data-account-tab="orders" aria-selected="${active==="orders"}" onclick="setAccountSection('orders')" style="${tabStyle}">Pedidos (${d.orders.length})</button></nav><section id="account-section-profile" role="tabpanel" style="display:${active==="profile"?"block":"none"}"><form class="panel" onsubmit="saveProfile(event)"><span>DADOS PESSOAIS</span><h3>Suas informações</h3><label>Nome<input name="name" value="${esc(d.user.name)}"></label><label>Telefone<input name="phone" value="${esc(d.user.phone||"")}"></label><label>CPF<input name="cpf" value="${esc(d.user.cpf||"")}"></label><button class="btn primary" type="submit">Salvar alterações</button></form></section><section id="account-section-addresses" role="tabpanel" style="display:${active==="addresses"?"block":"none"}"><div class="panel"><span>ENDEREÇOS SALVOS</span><h3>Meus endereços</h3>${addressCards}</div><form class="panel" onsubmit="saveAddress(event)" style="margin-top:14px"><span>NOVO ENDEREÇO</span><h3>Adicionar endereço</h3><div class="two-fields"><input name="cep" placeholder="CEP"><input name="number" placeholder="Número"></div><input name="street" placeholder="Rua / Avenida"><input name="neighborhood" placeholder="Bairro"><div class="two-fields"><input name="city" placeholder="Cidade"><input name="state" placeholder="UF" maxlength="2"></div><input name="complement" placeholder="Complemento (opcional)"><button class="btn ghost" type="submit">Adicionar endereço</button></form></section><section id="account-section-orders" role="tabpanel" style="display:${active==="orders"?"block":"none"}"><div class="panel orders-panel"><div class="panel-head"><div><span>ACOMPANHAMENTO</span><h3>Seus pedidos</h3></div></div>${renderCustomerOrders(d.orders)}</div></section><button type="button" class="btn ghost" onclick="logout()" style="display:block;margin:16px auto 0">Sair da conta</button></div></div></section>`;
  setAccountSection(active);
}
async function saveProfile(e){e.preventDefault();await api("/api/me/profile",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});await load();toast("Dados atualizados.")}
async function saveAddress(e){e.preventDefault();await api("/api/me/address",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast("Endereço adicionado.");account()}
async function logout(){await api("/api/auth/logout",{method:"POST"});store.user=null;cart=cart;closeCart();toast("Você saiu da conta.");location.hash="#/";load()}
function adminDenied(){toast("Essa área é exclusiva para equipe autorizada.","warn");location.hash=store.user?"#/":"#/login"}
async function requireAdmin(full=false){if(!store.user||!ADMIN_ROLES.includes(store.user.role)){adminDenied();return false}if(full&&!FULL_ADMIN.includes(store.user.role)){toast("Permissão de administrador necessária.","warn");return false}return true}
function adminShell(title,body){$("#app").innerHTML=`<section class="admin-page container"><div class="admin-top"><div><span>CONTROL CENTER</span><h1>${title}</h1></div><a class="btn ghost" href="#/">← Voltar à loja</a></div><div class="admin-layout"><aside class="admin-sidebar"><div class="admin-brand">MINHA<span>LOJA</span><small>ADMIN CONSOLE</small></div><div class="admin-user"><b>${esc(store.user.name)}</b><small>${esc(store.user.role)}</small></div><a href="#/admin">◈ Dashboard</a><a href="#/admin/produtos">▣ Produtos</a><a href="#/admin/pedidos">⌁ Pedidos</a><a href="#/admin/clientes">◎ Clientes</a><a href="#/admin/equipe">◇ Equipe</a><a href="#/admin/posts">▤ Gerar posts</a><a href="#/admin/config">⚙ Configurações</a><button onclick="logout()">↪ Sair</button></aside><div class="admin-main">${body}</div></div></section>`}
async function admin(){if(!await requireAdmin())return;let s=await api("/api/admin/stats");adminShell("Dashboard",`<div class="stats-grid"><div><span>Faturamento pago</span><b>${money(s.revenue)}</b><small>total recebido</small></div><div><span>Pedidos</span><b>${s.orders}</b><small>todos os pedidos</small></div><div><span>Clientes</span><b>${s.customers}</b><small>contas de clientes</small></div><div><span>Produtos</span><b>${s.products}</b><small>catálogo total</small></div></div><div class="admin-welcome"><div><span>PAINEL DE CONTROLE</span><h2>Olá, ${esc(store.user.name.split(" ")[0])}.</h2><p>Tenha uma visão rápida da operação da sua loja.</p></div><div class="pulse">● SISTEMA ONLINE</div></div><div class="admin-shortcuts"><a href="#/admin/produtos"><b>▣</b><span>Produtos<small>Gerenciar catálogo</small></span>→</a><a href="#/admin/pedidos"><b>⌁</b><span>Pedidos<small>Acompanhar vendas</small></span>→</a><a href="#/admin/clientes"><b>◎</b><span>Clientes<small>Base de clientes</small></span>→</a><a href="#/admin/config"><b>⚙</b><span>Configurações<small>Personalizar loja</small></span>→</a></div>`)}

let selectedProds = new Set();

async function adminProducts(){
  if(!await requireAdmin()) return;
  let ps = await api("/api/admin/products");
  if(!Array.isArray(ps)) ps = Array.isArray(ps && ps.products) ? ps.products : [];
  selectedProds.clear();
  const lowStockProducts=ps.filter(p=>p.active!==0&&Number(p.stock)>0&&Number(p.stock)<=3);
  const outOfStockProducts=ps.filter(p=>p.active!==0&&Number(p.stock)<=0);
  
  const itemsHtml = ps.map(p => `
    <div style="background:#111822;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px;margin-bottom:8px;display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="checkbox" class="prod-check" data-id="${p.id}" onchange="toggleSelectProd(${p.id}, this.checked)" ${selectedProds.has(p.id) ? "checked" : ""} style="width:18px;height:18px;cursor:pointer;accent-color:#22d3ee;">
        <img src="${esc(p.image||'')}" style="width:42px;height:42px;object-fit:contain;background:#0d131b;border-radius:8px;border:1px solid rgba(255,255,255,0.08);" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0;">
          <b style="font-size:12px;color:#fff;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</b>
          <div style="display:flex;gap:8px;align-items:center;margin-top:2px;font-size:11px;">
            <span style="color:#22d3ee;font-weight:bold;">${money(p.price)}</span>
            <span style="color:${Number(p.stock)<=0?'#ef4444':Number(p.stock)<=3?'#fbbf24':'#8995a7'};font-weight:${Number(p.stock)<=3?'800':'400'}">• Estoque: ${Number(p.stock)||0}${Number(p.stock)<=0?' · ESGOTADO':Number(p.stock)<=3?' · ESTOQUE BAIXO':''}</span>
            ${p.active === 0 ? '<span style="color:#ef4444;font-size:9px;font-weight:bold;">[PAUSADO]</span>' : ''}
          </div>
        </div>
      </div>
      
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex;gap:4px;">
          <button onclick="moveProd(${p.id}, 'up')" title="Mover para cima" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">⬆️</button>
          <button onclick="moveProd(${p.id}, 'down')" title="Mover para baixo" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">⬇️</button>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick=\x27cloneProduct(${JSON.stringify(p).replace(/'/g,"&#39;")})\x27 style="background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid #a855f7;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:bold;cursor:pointer;">📋 Clonar</button>
          <button onclick=\x27editProduct(${JSON.stringify(p).replace(/'/g,"&#39;")})\x27 style="background:rgba(34,211,238,0.15);color:#22d3ee;border:1px solid #22d3ee;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:bold;cursor:pointer;">✏️ Editar</button>
          <button onclick="delProduct(${p.id})" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid #ef4444;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:bold;cursor:pointer;">🗑️</button>
        </div>
      </div>
    </div>
  `).join("");

  const bodyContent = `
    ${(lowStockProducts.length||outOfStockProducts.length)?`<div role="status" style="padding:12px 14px;margin:0 0 14px;border-radius:12px;border:1px solid ${outOfStockProducts.length?'rgba(239,68,68,.45)':'rgba(251,191,36,.4)'};background:${outOfStockProducts.length?'rgba(239,68,68,.1)':'rgba(251,191,36,.08)'};color:#f8fafc"><b style="color:${outOfStockProducts.length?'#fca5a5':'#fcd34d'}">Atenção ao estoque</b><div style="font-size:13px;margin-top:5px">${lowStockProducts.length?`${lowStockProducts.length} produto(s) com 1 a 3 unidades.`:'Nenhum produto com estoque baixo.'} ${outOfStockProducts.length?`${outOfStockProducts.length} produto(s) esgotado(s).`:''}</div><small style="display:block;color:#cbd5e1;margin-top:4px">Estoque baixo considera até 3 unidades; os valores cadastrados não foram alterados.</small></div>`:''}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;">
      <div>
        <span style="color:#22d3ee;font-size:10px;font-weight:bold;letter-spacing:1px;">CATÁLOGO</span>
        <h2 style="font-size:18px;margin:2px 0 0;color:#fff;">Produtos (${ps.length})</h2>
      </div>
      <button class="btn primary" onclick="newProductModal()" style="padding:8px 12px;font-size:11px;">+ Novo</button>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#cbd5e1;cursor:pointer;margin:0;">
        <input type="checkbox" id="selectAllProds" onchange="toggleSelectAll(this.checked)" style="accent-color:#22d3ee;width:16px;height:16px;">
        Marcar todos
      </label>
      <button id="btnBulkDelete" onclick="deleteSelectedProds()" style="display:none;background:#ef4444;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:bold;cursor:pointer;">
        🗑️ Excluir (<span id="bulkCount">0</span>)
      </button>
    </div>

    
    <div style="background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.25);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div>
        <b style="color:#22d3ee;font-size:12px;display:block;">💾 Cópia de Segurança do Catálogo</b>
        <small style="color:#94a3b8;font-size:11px;">Baixe o backup antes de atualizar ou restaure se reiniciar.</small>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" onclick="exportProductsBackup()" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:6px 12px;font-size:11px;font-weight:bold;cursor:pointer;">📥 Baixar Backup</button>
        <label style="background:#22d3ee;color:#061116;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;margin:0;">
          📤 Restaurar Catálogo
          <input type="file" accept=".json" onchange="importProductsBackup(event)" style="display:none;">
        </label>
      </div>
    </div>

    <div id="adminProductList">
      ${itemsHtml}
    </div>
  `;

  adminShell("Produtos", bodyContent);
}

function toggleSelectProd(id, checked){
  if(checked) selectedProds.add(id);
  else selectedProds.delete(id);
  updateBulkDeleteUI();
}

function toggleSelectAll(checked){
  const boxes = document.querySelectorAll(".prod-check");
  boxes.forEach(b => {
    b.checked = checked;
    const id = Number(b.dataset.id);
    if(checked) selectedProds.add(id);
    else selectedProds.delete(id);
  });
  updateBulkDeleteUI();
}

function updateBulkDeleteUI(){
  const btn = document.getElementById("btnBulkDelete");
  const cnt = document.getElementById("bulkCount");
  if(!btn || !cnt) return;
  cnt.textContent = selectedProds.size;
  btn.style.display = selectedProds.size > 0 ? "block" : "none";
}

async function deleteSelectedProds(){
  if(!selectedProds.size) return;
  if(!confirm(`Tem certeza que deseja excluir ${selectedProds.size} produtos selecionados?`)) return;
  try{
    for(const id of selectedProds){
      await api("/api/admin/products/" + id, {method:"DELETE"});
    }
    toast("✓ Produtos excluídos com sucesso!");
    adminProducts();
  }catch(e){
    toast("Erro ao excluir itens: " + e.message, "warn");
  }
}

async function cloneProduct(p){
  try{
    const cloneData = {
      category_id: p.category_id || null,
      supplier_id: p.supplier_id || null,
      name: p.name + " (Cópia)",
      description: p.description || "",
      image: p.image || "",
      sku: p.sku ? p.sku + "-copy" : "",
      price: p.price,
      cost: p.cost || 0,
      stock: p.stock || 0,
      active: 1,
      featured: 0
    };
    await api("/api/admin/products", {method:"POST", body:JSON.stringify(cloneData)});
    toast("✓ Produto duplicado com sucesso!");
    adminProducts();
  }catch(e){
    toast("Erro ao clonar: " + e.message, "warn");
  }
}

async function moveProd(id, dir){
  try{
    await api("/api/admin/products/" + id + "/move", {method:"POST", body:JSON.stringify({dir})});
    adminProducts();
  }catch(e){
    toast("Erro ao reordenar: " + e.message, "warn");
  }
}

async function delProduct(id){if(!confirm("Excluir este produto?"))return;try{await api("/api/admin/products/"+id,{method:"DELETE"});toast("Produto excluído.");adminProducts()}catch(x){toast(x.message,"warn")}}
async function adminOrders(){
  if(!await requireAdmin()) return;
  const os=await api("/api/admin/orders");
  window.__adminOrdersData=Array.isArray(os)?os:[];
  window.__adminOrderFilter=window.__adminOrderFilter||"pagamento";
  window.__adminOrderQuery=window.__adminOrderQuery||"";
  adminShell("Pedidos",`<div class="admin-orders-wrap">
    <div class="admin-actions" style="margin-bottom:14px"><div><span>GESTÃO DE VENDAS</span><p>Acompanhe, atualize e encontre pedidos com facilidade.</p></div><button class="btn ghost" type="button" onclick="adminOrders()">↻ Atualizar lista</button></div>
    <div id="adminOrderTabs" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 16px"><input id="adminOrderSearch" type="search" value="${esc(window.__adminOrderQuery)}" oninput="adminOrderSetQuery(this.value)" placeholder="Buscar por pedido, cliente ou e-mail" aria-label="Buscar pedidos" style="flex:1;min-width:220px;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#0d131b;color:#fff"><select id="adminOrderSort" onchange="adminOrderRender()" aria-label="Ordenar pedidos" style="padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#0d131b;color:#fff"><option value="recent">Mais recentes</option><option value="old">Mais antigos</option><option value="total-high">Maior valor</option><option value="total-low">Menor valor</option></select></div>
    <div id="adminOrderCards"></div>
  </div>`);
  const sort=document.getElementById("adminOrderSort");
  if(sort&&window.__adminOrderSort)sort.value=window.__adminOrderSort;
  adminOrderRender();
}
function adminOrderStatusLabel(s){return ({pending:"Recebido",paid:"Pagamento confirmado",processing:"Em preparação",shipped:"Enviado",delivered:"Entregue",cancelled:"Cancelado",refunded:"Reembolsado"})[s]||s||"Não informado"}
function adminPaymentStatusLabel(s){return ({pending:"Aguardando pagamento",paid:"Pago",failed:"Não aprovado",refunded:"Reembolsado",cancelled:"Cancelado"})[s]||s||"Não informado"}
function adminOrderDate(s){
  if(!s)return "Data não informada";
  const d=new Date(String(s).includes("T")?s:String(s).replace(" ","T")+"Z");
  return Number.isNaN(d.getTime())?String(s):d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
function adminOrderSetFilter(k){window.__adminOrderFilter=k;adminOrderRender()}
function adminOrderSetQuery(q){window.__adminOrderQuery=q;adminOrderRender()}
function adminOrderRender(){
  const data=window.__adminOrdersData||[];
  const host=document.getElementById("adminOrderCards");
  const tabs=document.getElementById("adminOrderTabs");
  if(!host||!tabs)return;
  const defs=[
    {key:"todos",label:"Todos"},
    {key:"pagamento",label:"Aguardando pagamento"},
    {key:"recebidos",label:"Recebidos"},
    {key:"pagos",label:"Pagos"},
    {key:"preparo",label:"Em preparação"},
    {key:"enviados",label:"Enviados"},
    {key:"entregues",label:"Entregues"},
    {key:"cancelados",label:"Cancelados / reembolsados"}
  ];
  const isTerminal=o=>["cancelled","refunded"].includes(String(o.status||"").toLowerCase())||["cancelled","refunded"].includes(String(o.payment_status||"").toLowerCase());
  const match=(o,k)=>k==="todos"||
    (k==="pagamento"&&o.payment_status==="pending"&&!isTerminal(o))||
    (k==="recebidos"&&o.status==="pending"&&o.payment_status==="paid")||
    (k==="pagos"&&o.payment_status==="paid"&&!isTerminal(o))||
    (k==="preparo"&&o.status==="processing")||
    (k==="enviados"&&o.status==="shipped")||
    (k==="entregues"&&o.status==="delivered")||
    (k==="cancelados"&&isTerminal(o));
  tabs.innerHTML=defs.map(t=>`<button type="button" onclick="adminOrderSetFilter('${t.key}')" style="border:1px solid ${window.__adminOrderFilter===t.key?'#22d3ee':'rgba(255,255,255,.14)'};background:${window.__adminOrderFilter===t.key?'rgba(34,211,238,.14)':'rgba(255,255,255,.04)'};color:${window.__adminOrderFilter===t.key?'#67e8f9':'#e2e8f0'};border-radius:999px;padding:9px 13px;font-weight:700;cursor:pointer">${t.label} <span style="opacity:.75">${data.filter(o=>match(o,t.key)).length}</span></button>`).join("");
  const q=String(window.__adminOrderQuery||"").trim().toLowerCase();
  let shown=data.filter(o=>match(o,window.__adminOrderFilter)&&(!q||[o.id,o.customer_name,o.customer_email].some(v=>String(v||"").toLowerCase().includes(q))));
  const sort=document.getElementById("adminOrderSort");
  const mode=sort?.value||window.__adminOrderSort||"recent";
  window.__adminOrderSort=mode;
  shown.sort((a,b)=>mode==="old"?Number(a.id)-Number(b.id):mode==="total-high"?Number(b.total)-Number(a.total):mode==="total-low"?Number(a.total)-Number(b.total):Number(b.id)-Number(a.id));
  if(!shown.length){
    host.innerHTML=`<div class="panel" style="text-align:center;padding:24px"><h3>Nenhum pedido encontrado</h3><p style="color:#94a3b8">Tente mudar o filtro ou a busca.</p></div>`;
    return;
  }
  const statuses=["pending","paid","processing","shipped","delivered","cancelled","refunded"];
  host.innerHTML=shown.map(o=>`<article style="margin:0 0 12px;padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035);overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:11px">
      <div><b style="font-size:16px">Pedido #${esc(o.id)}</b><small style="display:block;color:#94a3b8;margin-top:4px">${esc(adminOrderDate(o.created_at))}</small></div>
      <strong style="color:#67e8f9;font-size:18px">${money(o.total)}</strong>
    </div>
    <div style="padding:12px 0"><b>${esc(o.customer_name||"Cliente")}</b><small style="display:block;color:#94a3b8;overflow-wrap:anywhere">${esc(o.customer_email||"")}</small>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px">
        <span style="background:rgba(255,255,255,.07);padding:6px 9px;border-radius:7px;font-size:12px">Pagamento: ${esc(adminPaymentStatusLabel(o.payment_status))}</span>
        <span style="background:rgba(255,255,255,.07);padding:6px 9px;border-radius:7px;font-size:12px">Forma: ${esc(o.payment_method==="pix"?"Pix":o.payment_method||"Não informada")}</span>
      </div>
      <div style="margin-top:12px;padding:11px;border-radius:9px;background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.07)">
        <b style="display:block;font-size:13px;margin-bottom:7px">Produtos do pedido</b>
        ${(Array.isArray(o.items)&&o.items.length)?o.items.map(it=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid rgba(255,255,255,.06);font-size:13px"><span style="min-width:0;overflow-wrap:anywhere">${esc(it.name)} <small style="color:#94a3b8">× ${esc(it.quantity)}</small></span><b style="white-space:nowrap">${money(Number(it.price||0)*Number(it.quantity||0))}</b></div>`).join(""):`<small style="color:#94a3b8">Não há itens registrados neste pedido.</small>`}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px">
      <label style="display:block;font-size:15px;font-weight:750;color:#f1f5f9">Status do pedido
        <select aria-label="Status do pedido #${esc(o.id)}" onchange="updateOrder(${Number(o.id)},this.value)" style="display:block;width:100%;min-height:54px;box-sizing:border-box;margin-top:7px;padding:12px;border-radius:10px;background:#111923 !important;color:#f8fafc !important;color-scheme:dark;border:2px solid #22d3ee;font-size:16px;font-weight:700">
          ${statuses.map(x=>`<option value="${x}" ${x===o.status?"selected":""}>${adminOrderStatusLabel(x)}</option>`).join("")}
        </select>
      </label>
      
      <label style="font-size:12px;color:#cbd5e1">Código de rastreio
        <div style="display:flex;gap:7px;margin-top:5px">
          <input id="tracking-${Number(o.id)}" value="${esc(o.tracking||"")}" placeholder="Ainda não informado" aria-label="Código de rastreio do pedido #${esc(o.id)}" style="min-width:0;flex:1;box-sizing:border-box;padding:10px;border-radius:8px;background:#0d131b;color:#fff;border:1px solid rgba(255,255,255,.15)">
          <button type="button" onclick="updateTracking(${Number(o.id)},document.getElementById('tracking-${Number(o.id)}').value)" style="padding:0 12px;border:0;border-radius:8px;background:#22d3ee;color:#061116;font-weight:800;cursor:pointer">Salvar</button>
        </div>
      </label>
    </div>
  </article>`).join("");
}
async function updateOrder(id,status){
  const confirmingPayment=status==="paid";
  if(confirmingPayment&&!confirm("Confirmar pagamento deste pedido? O estoque dos produtos será baixado uma única vez.")){
    adminOrders();return;
  }
  try{
    const body=confirmingPayment?{status,payment_status:"paid"}:{status};
    await api("/api/admin/orders/"+id,{method:"PATCH",body:JSON.stringify(body)});
    toast(confirmingPayment?"Pagamento confirmado e estoque atualizado.":"Status do pedido atualizado.");
    window.__adminOrdersData=await api("/api/admin/orders");
    adminOrderRender();
  }catch(x){toast(x.message,"warn");adminOrders()}
}
async function updateTracking(id,tracking){
  try{
    await api("/api/admin/orders/"+id,{method:"PATCH",body:JSON.stringify({tracking})});
    toast("Código de rastreio salvo.");
    window.__adminOrdersData=await api("/api/admin/orders");
    adminOrderRender();
  }catch(x){toast(x.message,"warn")}
}
async function adminCustomers(){
  if(!await requireAdmin()) return;
  let cs = await api("/api/admin/customers");
  if(!Array.isArray(cs)) cs = [];

  const cardsHtml = cs.map(c => {
    let cleanPhone = String(c.phone || "").replace(/\D/g, "");
    if(cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = "55" + cleanPhone;
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent("Olá " + (c.name || "") + ", tudo bem? Falo da MachadoExpress.")}` : "";
    
    let cadDate = "Data não informada";
    if(c.created_at) {
      try {
        const d = new Date(String(c.created_at).includes("T") ? c.created_at : String(c.created_at).replace(" ","T") + "Z");
        cadDate = Number.isNaN(d.getTime()) ? c.created_at : d.toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit", year:"numeric"});
      } catch(e){}
    }

    return `
      <article style="background:#111822;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;margin-bottom:12px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:10px;">
          <div>
            <b style="font-size:15px;color:#fff;">${esc(c.name)}</b>
            <small style="display:block;color:#94a3b8;font-size:11px;margin-top:2px;">Cliente #${c.id} · Cadastrado em: ${esc(cadDate)}</small>
          </div>
          <div style="text-align:right;">
            <span style="background:rgba(34,211,238,0.12);color:#22d3ee;border:1px solid rgba(34,211,238,0.3);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:bold;">
              ${c.orders_count || 0} ${Number(c.orders_count) === 1 ? 'pedido' : 'pedidos'}
            </span>
            <small style="display:block;color:#cbd5e1;font-size:11px;margin-top:4px;">Total: <b style="color:#22c55e;">${money(c.total_spent || 0)}</b></small>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:12px;">
          <div>
            <span style="color:#8995a7;font-size:10px;text-transform:uppercase;font-weight:bold;">E-mail:</span>
            <div style="color:#fff;overflow-wrap:anywhere;">${esc(c.email || 'Não informado')}</div>
          </div>
          <div>
            <span style="color:#8995a7;font-size:10px;text-transform:uppercase;font-weight:bold;">CPF:</span>
            <div style="color:#fff;">${esc(c.cpf || 'Não informado')}</div>
          </div>
          <div>
            <span style="color:#8995a7;font-size:10px;text-transform:uppercase;font-weight:bold;">WhatsApp / Telefone:</span>
            <div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
              <span style="color:#22d3ee;font-weight:bold;">${esc(c.phone || 'Não informado')}</span>
              ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" style="background:#22c55e;color:#000;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:900;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">💬 WhatsApp</a>` : ''}
            </div>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:9px 12px;font-size:12px;">
          <b style="color:#22d3ee;font-size:10px;text-transform:uppercase;display:block;margin-bottom:3px;">Endereço de Entrega:</b>
          <span style="color:#cbd5e1;">${esc(c.full_address || 'Ainda não cadastrou endereço completo.')}</span>
        </div>
      </article>
    `;
  }).join("");

  const content = `
    <div class="admin-actions" style="margin-bottom:14px;">
      <div>
        <span style="color:#22d3ee;font-size:10px;font-weight:bold;letter-spacing:1px;">GESTÃO DE CLIENTES</span>
        <h2 style="font-size:18px;margin:2px 0 0;color:#fff;">Clientes Cadastrados (${cs.length})</h2>
      </div>
      <button class="btn ghost" type="button" onclick="adminCustomers()" style="font-size:11px;padding:8px 12px;">↻ Atualizar</button>
    </div>

    ${cs.length ? cardsHtml : `
      <div style="text-align:center;padding:36px 16px;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);border-radius:14px;">
        <h3 style="color:#fff;margin:0 0 6px;">Nenhum cliente cadastrado ainda</h3>
        <p style="color:#8995a7;font-size:13px;margin:0;">Quando as pessoas criarem conta ou comprarem na loja, os dados aparecerão aqui com endereço, CPF e WhatsApp.</p>
      </div>
    `}
  `;

  adminShell("Clientes", content);
}
async function adminTeam(){if(!await requireAdmin(true))return;let us=await api("/api/admin/users");adminShell("Equipe",`<div class="admin-actions"><div><span>ACESSO</span><p>${us.length} membros da equipe</p></div><button class="btn primary" onclick="newStaff()">+ Novo funcionário</button></div><div class="notice">Somente <b>super_admin</b> e <b>admin</b> podem gerenciar usuários administrativos.</div><div class="table-wrap"><table><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Status</th></tr>${us.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td><span class="role">${esc(u.role)}</span></td><td>${u.active?"Ativo":"Inativo"}</td></tr>`).join("")}</table></div>`)}
function newStaff(){$("#modal").innerHTML=`<div class="form-modal"><button class="modal-x" onclick="closeModal()">×</button><span>NOVO ACESSO</span><h2>Criar funcionário</h2><form onsubmit="createStaff(event)"><label>Nome<input name="name" required></label><label>E-mail<input name="email" type="email" required></label><label>Senha<input name="password" type="password" minlength="6" required></label><label>Telefone<input name="phone"></label><label>Cargo<select name="role"><option>atendente</option><option>gerente</option><option>admin</option><option>financeiro</option></select><button type="button" onclick="quickNewCategory('modalCatSelect')" style="background:rgba(34,211,238,0.15);color:#22d3ee;border:1px solid #22d3ee;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">+ Criar</button></div></label><button class="btn primary wide">Criar acesso</button></form></div>`;$("#modal").classList.remove("hidden")}
async function createStaff(e){e.preventDefault();try{await api("/api/admin/users",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});closeModal();toast("Funcionário criado.");adminTeam()}catch(x){toast(x.message,"warn")}}
async function adminPosts(){if(!await requireAdmin())return;let ps=await api("/api/admin/posts");adminShell("Gerador de Posts",`<div class="admin-actions"><div><span>POSTS AUTOMÁTICOS</span><p>Use o template.png para criar uma arte pronta de cada produto.</p></div></div><div class="post-generator-grid">${ps.map(p=>`<article class="post-generator-card"><div class="post-preview">${p.image?`<img src="${esc(p.image)}" alt="">`:`<span>◈</span>`}</div><div class="post-generator-info"><span>PRODUTO #${p.id}</span><h3>${esc(p.name)}</h3><b>${money(p.price)}</b><button class="btn primary wide" onclick="window.abrirModalGerarPost(${p.id})">Gerar post →</button></div></article>`).join("")}</div>`)}
async function generatePost(id,btn){let old=btn.innerHTML;btn.disabled=true;btn.innerHTML="Gerando…";try{let d=await api("/api/admin/posts/generate/"+id,{method:"POST"});toast("Post gerado com sucesso!");let a=document.createElement("a");a.href=d.url;a.target="_blank";a.rel="noopener";a.textContent="Abrir arte gerada";a.className="generated-link";btn.parentElement.appendChild(a)}catch(e){toast(e.message,"warn")}finally{btn.disabled=false;btn.innerHTML=old}}
async function adminConfig(){if(!await requireAdmin(true))return;let s=await api("/api/admin/settings");adminShell("Configurações",`<div class="config-grid"><form class="panel config-form" onsubmit="saveSettings(event)"><span>IDENTIDADE</span><h3>Home e marca</h3><label>Nome da loja<input name="store_name" value="${esc(s.store_name)}"></label><label>Descrição<textarea name="store_description">${esc(s.store_description)}</textarea></label><label>Imagem do banner<input name="banner_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="field-hint">Envie a imagem para ela ficar salva no próprio site. ${s.banner_image?"Banner local atual: "+esc(s.banner_image):"Usando o banner padrão."}</small></label><label>Título do banner<input name="banner_title" value="${esc(s.banner_title)}"></label><label>Texto do banner<textarea name="banner_subtitle">${esc(s.banner_subtitle)}</textarea></label><label>Botão do banner<input name="banner_button" value="${esc(s.banner_button)}"></label><button class="btn primary">Salvar alterações</button></form><form class="panel config-form" onsubmit="saveSettings(event)"><span>CONTATO</span><h3>Informações da loja</h3><label>E-mail<input name="store_email" value="${esc(s.store_email)}"></label><label>Telefone<input name="store_phone" value="${esc(s.store_phone)}"></label><label>WhatsApp<input name="store_whatsapp" value="${esc(s.store_whatsapp)}"></label><span>CHECKOUT</span><h3>Pix e frete</h3><label>Chave Pix<input name="pix_key" value="${esc(s.pix_key)}"></label><label>Nome do recebedor<input name="pix_name" value="${esc(s.pix_name)}"></label><label>Cidade<input name="pix_city" value="${esc(s.pix_city)}"></label><label>Frete grátis acima de R$<input name="free_shipping_min" type="number" step=".01" value="${esc(s.free_shipping_min)}"></label><button class="btn primary">Salvar configurações</button></form></div>`)}
async function saveSettings(e){e.preventDefault();try{const fd=new FormData(e.target);const body=Object.fromEntries(fd.entries());const banner=fd.get("banner_file");delete body.banner_file;if(banner&&banner.size>0){body.banner_image=await uploadLocalImage(banner)}else{delete body.banner_image;}await api("/api/admin/settings",{method:"PATCH",body:JSON.stringify(body)});await load();toast("Configurações salvas com sucesso!");location.hash="#/admin/config"}catch(x){console.error(x);toast(x.message||"Erro ao salvar configurações","warn");}}
async function route(){let h=location.hash||"#/";try{if(h==="#/"||h==="#")return await home();if(h.startsWith("#/produtos"))return await products();if(h==="#/login")return await login();if(h==="#/registro")return await register();if(h==="#/conta")return await account();if(h==="#/admin")return await admin();if(h==="#/admin/produtos")return await adminProducts();if(h==="#/admin/pedidos")return await adminOrders();if(h==="#/admin/clientes")return await adminCustomers();if(h==="#/admin/equipe")return await adminTeam();if(h==="#/admin/config")return await adminConfig();if(h==="#/admin/posts")return await adminPosts();return await home()}catch(e){toast(e.message,"warn")}}
window.addEventListener("hashchange",route);load();
function renderFooter() {
  const f = document.querySelector('#footer');
  if (!f) return;

  f.innerHTML = `
    <div style="max-width:1100px;margin:20px auto 35px auto;padding:0 10px;box-sizing:border-box;">
      <!-- Arte final2.png com todos os botões clicáveis mapeados -->
      <div style="position:relative;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(0,210,255,0.35);box-shadow:0 12px 35px rgba(0,0,0,0.7);line-height:0;background:#060a12;">
        <img src="/final2.png?v=${Date.now()}" alt="MachadoExpress Informações e Benefícios" style="width:100%;height:auto;display:block;">
        
        <!-- === TOPO === -->
        <a href="politicas.html#seguranca" title="Compra Segura" style="position:absolute;left:35.3%;top:10.1%;width:9.6%;height:15.1%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="politicas.html#entrega" title="Entrega Rápida" style="position:absolute;left:45.4%;top:10.1%;width:9.6%;height:15.1%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="#/produtos" title="Formas de Pagamento" style="position:absolute;left:56.0%;top:10.1%;width:13.1%;height:15.1%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="https://wa.me/5551981884111?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20na%20MachadoExpress" target="_blank" rel="noopener" title="Suporte Especializado" style="position:absolute;left:70.1%;top:10.1%;width:11.1%;height:15.1%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="politicas.html#seguranca" title="Sua Compra 100% Segura" style="position:absolute;left:82.2%;top:7.6%;width:16.1%;height:20.2%;display:block;cursor:pointer;z-index:10;"></a>

        <!-- === REDES SOCIAIS (ESQUERDA) === -->
        <a href="https://wa.me/5551981884111?text=Ol%C3%A1%20MachadoExpress" target="_blank" rel="noopener" title="WhatsApp" style="position:absolute;left:3.0%;top:70.6%;width:3.6%;height:7.6%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="https://instagram.com" target="_blank" rel="noopener" title="Instagram" style="position:absolute;left:7.5%;top:70.6%;width:3.6%;height:7.6%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="https://tiktok.com" target="_blank" rel="noopener" title="TikTok" style="position:absolute;left:12.1%;top:70.6%;width:3.1%;height:7.6%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="https://youtube.com" target="_blank" rel="noopener" title="YouTube" style="position:absolute;left:16.1%;top:70.6%;width:3.6%;height:7.6%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="https://facebook.com" target="_blank" rel="noopener" title="Facebook" style="position:absolute;left:20.1%;top:70.6%;width:3.6%;height:7.6%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="https://twitter.com" target="_blank" rel="noopener" title="X (Twitter)" style="position:absolute;left:24.4%;top:70.6%;width:3.3%;height:7.6%;display:block;cursor:pointer;z-index:10;"></a>

        <!-- === COLUNA CENTRAL 1 === -->
        <a href="politicas.html#privacidade" title="Política de Privacidade" style="position:absolute;left:29.7%;top:35.9%;width:22.0%;height:13.9%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="politicas.html#seguranca" title="Direitos do Consumidor e Reembolso" style="position:absolute;left:29.7%;top:51.1%;width:22.0%;height:13.9%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="politicas.html#sobre" title="Sobre Nós" style="position:absolute;left:29.7%;top:66.2%;width:22.0%;height:13.9%;display:block;cursor:pointer;z-index:10;"></a>

        <!-- === COLUNA CENTRAL 2 === -->
        <a href="politicas.html#termos" title="Termos de Uso" style="position:absolute;left:52.2%;top:35.9%;width:22.0%;height:13.9%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="https://wa.me/5551981884111?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20o%20atendimento" target="_blank" rel="noopener" title="Fale Conosco" style="position:absolute;left:52.2%;top:51.1%;width:22.0%;height:13.9%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="#/produtos" title="Mapa do Site / Catálogo" style="position:absolute;left:52.2%;top:66.2%;width:22.0%;height:13.9%;display:block;cursor:pointer;z-index:10;"></a>

        <!-- === CARD GRANDE WHATSAPP (DIREITA) === -->
        <a href="https://wa.me/5551981884111?text=Ol%C3%A1%2C%20gostaria%20de%20atendimento%20na%20MachadoExpress" target="_blank" rel="noopener" title="Suporte WhatsApp - Fale Conosco" style="position:absolute;left:75.1%;top:35.9%;width:23.0%;height:44.2%;display:block;cursor:pointer;z-index:10;"></a>

        <!-- === BASE DA ARTE (PAGAMENTOS / SITE SEGURO) === -->
        <a href="#/produtos" title="Formas de Pagamento Aceitas" style="position:absolute;left:3.5%;top:83.2%;width:48.0%;height:8.8%;display:block;cursor:pointer;z-index:10;"></a>
        <a href="politicas.html#seguranca" title="Site Seguro" style="position:absolute;left:62.0%;top:83.2%;width:16.6%;height:8.8%;display:block;cursor:pointer;z-index:10;"></a>
      </div>

      <!-- Barra oficial de titularidade e direitos autorais -->
      <div style="margin-top:14px;padding:12px;background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:12px;text-align:center;font-size:11.5px;color:#94a3b8;line-height:1.5;">
        © 2026 MachadoExpress — Todos os direitos reservados.<br>
        <strong style="color:#38bdf8;">Titular e Responsável Legal: Hiury Machado Da Rocha</strong>
      </div>
    </div>`;
}












async function uploadLocalImage(file){
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("image", file);
    const token = (typeof store !== 'undefined' && store.token) ? store.token : localStorage.getItem("token");
    const headers = token ? { "Authorization": "Bearer " + token } : {};
    const res = await fetch("/api/upload", { method: "POST", headers, body: fd });
    if(res.ok){
      const d = await res.json();
      if(d.url || d.path || d.file) return d.url || d.path || d.file;
    }
  } catch(e) {}
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Erro ao ler foto"));
    reader.readAsDataURL(file);
  });
}

async function quickNewCategory(selectId){
  const name = prompt("Nome da nova categoria (ex: Celulares, Fones):");
  if(!name || !name.trim()) return;
  try{
    const res = await api("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() })
    });
    const newId = res.id || (res.category && res.category.id);
    const sel = document.getElementById(selectId);
    if(sel && newId){
      const opt = document.createElement("option");
      opt.value = newId;
      opt.textContent = name.trim();
      opt.selected = true;
      sel.appendChild(opt);
    }
    toast("✓ Categoria '" + name.trim() + "' criada!");
  }catch(e){
    toast("Erro ao criar categoria: " + e.message, "warn");
  }
}


// Gerenciador de fotos: capa, ordem e remoção no cadastro e na edição.
window.__photoManagerReady = true;
window.__newProductFiles = [];
window.__newPhotoObjectUrls = [];
window.__renderNewProductPhotos = function(){
  const box=document.getElementById('newProductPhotoList');
  if(!box)return;
  window.__newPhotoObjectUrls.forEach(u=>URL.revokeObjectURL(u));
  window.__newPhotoObjectUrls=[];
  box.innerHTML=window.__newProductFiles.map((file,i)=>{
    const src=URL.createObjectURL(file);
    window.__newPhotoObjectUrls.push(src);
    return `<div style="flex:0 0 90px;text-align:center;background:#0d131b;border:1px solid ${i===0?'#22d3ee':'#334155'};border-radius:8px;padding:5px;">
      <img src="${src}" style="width:76px;height:60px;object-fit:cover;border-radius:5px;display:block;margin:auto;">
      ${i===0?'<small style="color:#22d3ee;font-weight:bold;font-size:9px">CAPA</small>':'<button type="button" onclick="window.__newPhotoAction(\'cover\','+i+')" style="font-size:9px">Definir capa</button>'}
      <div style="display:flex;gap:3px;justify-content:center;margin-top:3px">
       <button type="button" onclick="window.__newPhotoAction(\'up\','+i+')" ${i===0?'disabled':''}>‹</button>
       <button type="button" onclick="window.__newPhotoAction(\'down\','+i+')" ${i===window.__newProductFiles.length-1?'disabled':''}>›</button>
       <button type="button" onclick="window.__newPhotoAction(\'delete\','+i+')" style="color:#ef4444">×</button>
      </div></div>`;
  }).join('');
};
window.__syncNewProductFiles=function(){
 const input=document.querySelector('#modal input[name="image_files"]');
 if(!input)return;
 const dt=new DataTransfer();
 window.__newProductFiles.forEach(f=>dt.items.add(f));
 input.files=dt.files;
};
window.__newPhotoAction=function(action,i){
 const a=window.__newProductFiles;
 if(i<0||i>=a.length)return;
 if(action==='delete')a.splice(i,1);
 else if(action==='cover'){const f=a.splice(i,1)[0];a.unshift(f);}
 else {
   const j=action==='up'?i-1:i+1;
   if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];
 }
 window.__syncNewProductFiles();
 window.__renderNewProductPhotos();
};
window.__editProductImages=[];
window.__renderEditProductPhotos=function(){
 const box=document.getElementById('editProductPhotoList');
 if(!box)return;
 const a=window.__editProductImages;
 box.innerHTML=a.length?a.map((src,i)=>`<div style="flex:0 0 90px;position:relative;text-align:center;background:#0d131b;border:1px solid ${i===0?'#22d3ee':'#334155'};border-radius:8px;padding:5px">
  <img src="${esc(src)}" style="width:76px;height:60px;object-fit:contain;border-radius:5px;display:block;margin:auto">
  ${i===0?'<small style="color:#22d3ee;font-weight:bold;font-size:9px">CAPA</small>':'<button type="button" onclick="window.__editPhotoAction(\'cover\','+i+')" style="font-size:9px">Definir capa</button>'}
  <div style="display:flex;gap:3px;justify-content:center;margin-top:3px">
   <button type="button" onclick="window.__editPhotoAction(\'up\','+i+')" ${i===0?'disabled':''}>‹</button>
   <button type="button" onclick="window.__editPhotoAction(\'down\','+i+')" ${i===a.length-1?'disabled':''}>›</button>
   <button type="button" onclick="window.__editPhotoAction(\'delete\','+i+')" style="color:#ef4444">×</button>
  </div></div>`).join(''):'<small style="color:#94a3b8">Nenhuma foto salva. Você pode adicionar abaixo.</small>';
 const hidden=document.querySelector('#modal input[name="existing_images"]');
 const cover=document.querySelector('#modal input[name="image"]');
 if(hidden)hidden.value=JSON.stringify(a);
 if(cover)cover.value=a[0]||'';
 const count=document.getElementById('editPhotosCount');
 if(count)count.textContent='Fotos cadastradas ('+a.length+'):';
};
window.__editPhotoAction=function(action,i){
 const a=window.__editProductImages;
 if(i<0||i>=a.length)return;
 if(action==='delete')a.splice(i,1);
 else if(action==='cover'){const f=a.splice(i,1)[0];a.unshift(f);}
 else {
   const j=action==='up'?i-1:i+1;
   if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];
 }
 window.__renderEditProductPhotos();
};

async function newProductModal(){
  window.__newProductFiles=[];
  let cats = await api("/api/admin/categories");
  $("#modal").innerHTML = `
    <div class="form-modal" style="max-width:540px;">
      <button class="modal-x" onclick="closeModal()">×</button>
      <span style="color:#22d3ee;font-size:11px;font-weight:bold;letter-spacing:1px;">NOVO CADASTRO</span>
      <h2 style="margin:5px 0 15px;">Adicionar Produto</h2>

      <form onsubmit="createProduct(event)">
        <label>Nome do Produto
          <input name="name" placeholder="Ex: Celular LG K52" required style="font-size:14px;font-weight:bold;">
        </label>
        
        <div class="two-fields">
          <label>Preço de Venda (R$)
            <input name="price" type="number" step="0.01" placeholder="0.00" required>
          </label>
          <label>Custo do Item (R$)
            <input name="cost" type="number" step="0.01" placeholder="0.00">
          </label>
        </div>

        <div class="two-fields">
          <label>Estoque Inicial
            <input name="stock" type="number" value="10">
          </label>
          <label>Categoria
            <div style="display:flex;gap:6px;align-items:center;margin-top:2px;">
              <select id="catSelectNew" name="category_id" style="flex:1;">
                <option value="">Sem categoria</option>
                ${cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
              </select>
              <button type="button" onclick="quickNewCategory('catSelectNew')" style="background:rgba(34,211,238,0.18);color:#22d3ee;border:1px solid #22d3ee;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">
                + Criar
              </button>
            </div>
          </label>
        </div>

        <div style="background:rgba(34,211,238,0.06);border:1px dashed #22d3ee;border-radius:10px;padding:12px;margin:10px 0;">
          <label style="color:#22d3ee;font-weight:bold;margin-bottom:4px;display:block;">📸 Fotos do Produto (Pode marcar várias):</label>
          <input id="newProductPhotoInput" name="image_files" type="file" multiple accept="image/*" onchange="window.__newProductFiles=Array.from(this.files||[]);window.__renderNewProductPhotos()" style="background:#0d131b;border:1px solid rgba(255,255,255,0.15);padding:8px;border-radius:8px;width:100%;"><div id="newProductPhotoList" style="display:flex;gap:6px;overflow-x:auto;margin-top:8px"></div>
          <small style="color:#8995a7;font-size:11px;display:block;margin-top:6px;">Use ‹ e › para mudar a ordem, “Definir capa” para escolher a foto principal e × para remover.</small>
        </div>

        <label>Descrição detalhada
          <textarea name="description" rows="3" placeholder="Detalhes, especificações e diferenciais do produto..."></textarea>
        </label>

        <div class="two-fields">
          <label>Status
            <select name="active">
              <option value="1">🟢 Ativo na loja</option>
              <option value="0">🔴 Pausado (Oculto)</option>
            </select>
          </label>
          <label>Destaque
            <select name="featured">
              <option value="0">Não</option>
              <option value="1">⭐ Sim</option>
            </select>
          </label>
        </div>

        <button id="btnSaveProd" class="btn primary wide" style="margin-top:14px;padding:12px;font-size:14px;font-weight:bold;">
          Salvar e Cadastrar Produto
        </button>
      </form>
    </div>
  `;
  $("#modal").classList.remove("hidden");
}

async function createProduct(e){
  e.preventDefault();
  const btn = document.getElementById("btnSaveProd");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando fotos..."; }
  try{
    const fd = new FormData(e.target);
    const files = fd.getAll("image_files");
    const body = Object.fromEntries(fd.entries());
    delete body.image_files;

    let uploadedImages = [];
    for(const f of files){
      if(f && f.size > 0){
        const url = await uploadLocalImage(f);
        if(url) uploadedImages.push(url);
      }
    }
    
    body.images = uploadedImages;
    body.image = uploadedImages.length > 0 ? uploadedImages[0] : "";
    body.featured = body.featured === "1";
    body.active = body.active === "1" ? 1 : 0;

    await api("/api/admin/products", {method:"POST", body:JSON.stringify(body)});
    closeModal();
    toast("✓ Produto cadastrado com sucesso!");
    adminProducts();
  }catch(x){
    toast("Erro ao cadastrar: " + x.message, "warn");
    if(btn){ btn.disabled = false; btn.textContent = "Salvar e Cadastrar Produto"; }
  }
}

async function editProduct(p){
  let cats = await api("/api/admin/categories");
  let imgs = [];
  if(p.images){
    try { imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images; } catch(e){}
  }
  if(!imgs.length && p.image) imgs = [p.image];
  window.__editProductImages = imgs.slice();

  $("#modal").innerHTML = `
    <div class="form-modal" style="max-width:540px;">
      <button class="modal-x" onclick="closeModal()">×</button>
      <span style="color:#22d3ee;font-size:11px;font-weight:bold;letter-spacing:1px;">PAINEL DE EDIÇÃO</span>
      <h2 style="margin:5px 0 15px;">Editar Produto</h2>
      
      <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:10px;margin-bottom:15px;border:1px solid rgba(255,255,255,0.08);">
        <b id="editPhotosCount" style="font-size:11px;display:block;margin-bottom:6px;color:#22d3ee;">Fotos cadastradas (${imgs.length}):</b>
        <div id="editProductPhotoList" style="display:flex;gap:6px;overflow-x:auto"></div>
      </div>

      <form onsubmit="updateProduct(event, ${p.id})">
        <label>Nome do Produto
          <input name="name" value="${esc(p.name)}" required style="font-size:14px;font-weight:bold;">
        </label>
        
        <div class="two-fields">
          <label>Preço de Venda (R$)
            <input name="price" type="number" step="0.01" value="${p.price}" required>
          </label>
          <label>Custo do Item (R$)
            <input name="cost" type="number" step="0.01" value="${p.cost||0}">
          </label>
        </div>

        <div class="two-fields">
          <label>Estoque
            <input name="stock" type="number" value="${p.stock||0}">
          </label>
          <label>Categoria
            <div style="display:flex;gap:6px;align-items:center;margin-top:2px;">
              <select id="catSelectEdit" name="category_id" style="flex:1;">
                <option value="">Sem categoria</option>
                ${cats.map(c=>`<option value="${c.id}" ${c.id===p.category_id?"selected":""}>${esc(c.name)}</option>`).join("")}
              </select>
              <button type="button" onclick="quickNewCategory('catSelectEdit')" style="background:rgba(34,211,238,0.18);color:#22d3ee;border:1px solid #22d3ee;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">
                + Criar
              </button>
            </div>
          </label>
        </div>

        <div style="background:rgba(34,211,238,0.06);border:1px dashed #22d3ee;border-radius:10px;padding:12px;margin:10px 0;">
          <label style="color:#22d3ee;font-weight:bold;margin-bottom:4px;display:block;">📸 Adicionar mais fotos:</label>
          <input name="image_files" type="file" multiple accept="image/*" style="background:#0d131b;border:1px solid rgba(255,255,255,0.15);padding:8px;border-radius:8px;width:100%;">
          <small style="color:#8995a7;font-size:10px;display:block;margin-top:6px;">Selecione novas fotos para acrescentar à galeria.</small>
        </div>

        <input type="hidden" name="existing_images" value="${esc(JSON.stringify(imgs))}">
        <input type="hidden" name="image" value="${esc(p.image||"")}">

        <div class="two-fields">
          <label>Status
            <select name="active">
              <option value="1" ${p.active!==0?"selected":""}>🟢 Ativo na loja</option>
              <option value="0" ${p.active===0?"selected":""}>🔴 Pausado (Oculto)</option>
            </select>
          </label>
          <label>Destaque
            <select name="featured">
              <option value="1" ${p.featured?"selected":""}>⭐ Sim</option>
              <option value="0" ${!p.featured?"selected":""}>Não</option>
            </select>
          </label>
        </div>

        <label>Descrição detalhada
          <textarea name="description" rows="3">${esc(p.description||"")}</textarea>
        </label>

        <button id="btnSaveProd" class="btn primary wide" style="margin-top:12px;padding:12px;font-size:13px;font-weight:bold;">
          Salvar alterações
        </button>
      </form>
    </div>
  `;
  $("#modal").classList.remove("hidden");
  window.__renderEditProductPhotos();
}

async function updateProduct(e, id){
  e.preventDefault();
  const btn = document.getElementById("btnSaveProd");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando alterações..."; }
  try{
    const fd = new FormData(e.target);
    const files = fd.getAll("image_files");
    let existing = [];
    try { existing = JSON.parse(fd.get("existing_images") || "[]"); } catch(x){}
    
    const body = Object.fromEntries(fd.entries());
    delete body.image_files;
    delete body.existing_images;

    let newUploads = [];
    for(const f of files){
      if(f && f.size > 0){
        const url = await uploadLocalImage(f);
        if(url) newUploads.push(url);
      }
    }

    const allImages = [...existing, ...newUploads];
    body.images = allImages;
    body.image = allImages.length > 0 ? allImages[0] : "";
    body.featured = body.featured === "1";
    body.active = body.active === "1" ? 1 : 0;
    
    await api("/api/admin/products/" + id, {method:"PATCH", body:JSON.stringify(body)});
    closeModal();
    toast("✓ Produto atualizado com sucesso!");
    adminProducts();
  }catch(x){
    toast(x.message || "Erro ao atualizar", "warn");
    if(btn){ btn.disabled = false; btn.textContent = "Salvar alterações"; }
  }
}


// OVERRIDE SEGURO QUICKVIEW
window.closeQuickModal = function() {
  const el = document.getElementById('quick-modal-overlay');
  if (el) el.remove();
  document.body.style.overflow = '';
};

window.quickView = function(p) {
  if (!p) return;
  let imgs = [];
  try {
    if (Array.isArray(p.images)) imgs = p.images;
    else if (typeof p.images === 'string') imgs = JSON.parse(p.images);
  } catch(e) {}
  if (!imgs.length && p.image) imgs = [p.image];
  if (!imgs.length) imgs = [''];

  let curIdx = 0;
  let overlay = document.getElementById('quick-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'quick-modal-overlay';
    document.body.appendChild(overlay);
  }
  document.body.style.overflow = 'hidden';

  overlay.onclick = function(e) {
    if (e.target === overlay) window.closeQuickModal();
  };

  function update() {
    let active = imgs[curIdx] || '';
    let hasMulti = imgs.length > 1;
    let pJson = JSON.stringify(p).replace(/'/g, "&#39;");

    overlay.innerHTML = `
      <div class="quick-card-box" onclick="event.stopPropagation()">
        <button type="button" onclick="window.closeQuickModal()" style="position:absolute;right:12px;top:12px;background:#1e293b;border:1px solid #334155;color:#fff;width:32px;height:32px;border-radius:50%;font-size:16px;font-weight:bold;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;">✕</button>
        
        <div style="position:relative;width:100%;height:290px;background:#05080c;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #1f2937;">
          ${active ? `<img src="${active}" style="max-width:100%;max-height:100%;object-fit:contain;">` : '<span style="font-size:50px;color:#334155;">◈</span>'}
          ${hasMulti ? `
            <button type="button" id="btn-prev" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);border:1px solid #22d3ee;color:#22d3ee;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;">‹</button>
            <button type="button" id="btn-next" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);border:1px solid #22d3ee;color:#22d3ee;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;">›</button>
          ` : ''}
        </div>

        ${hasMulti ? `
          <div style="display:flex;gap:8px;overflow-x:auto;padding:10px 0;scrollbar-width:none;">
            ${imgs.map((src, i) => `
              <img class="gal-thumb" data-idx="${i}" src="${src}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid ${i === curIdx ? '#22d3ee' : '#1f2937'};opacity:${i === curIdx ? '1' : '0.5'};flex-shrink:0;">
            `).join('')}
          </div>
        ` : ''}

        <div style="margin-top:12px;">
          <small style="color:#22d3ee;font-size:11px;font-weight:bold;text-transform:uppercase;">${p.category_name || 'Produto'}</small>
          <h2 style="font-size:17px;margin:4px 0 6px;color:#fff;">${p.name || ''}</h2>
          <div style="font-size:22px;font-weight:bold;color:#22d3ee;margin-bottom:10px;">${typeof money === 'function' ? money(p.price) : 'R$ ' + p.price}</div>
          
          <div style="font-size:12px;color:#94a3b8;line-height:1.5;margin-bottom:16px;background:#111827;padding:10px;border-radius:8px;border:1px solid #1f2937;">
            ${p.description || 'Produto de alta qualidade com envio rápido.'}
          </div>

          <button type="button" onclick='addCart(${pJson}, event); window.closeQuickModal();' style="width:100%;height:44px;background:#22d3ee;border:none;border-radius:10px;color:#061116;font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            Adicionar ao Carrinho 🛒
          </button>
        </div>
      </div>
    `;

    if (hasMulti) {
      document.getElementById('btn-prev').onclick = () => { curIdx = (curIdx - 1 + imgs.length) % imgs.length; update(); };
      document.getElementById('btn-next').onclick = () => { curIdx = (curIdx + 1) % imgs.length; update(); };
      overlay.querySelectorAll('.gal-thumb').forEach(t => {
        t.onclick = () => { curIdx = parseInt(t.getAttribute('data-idx')); update(); };
      });
    }
  }

  update();
};


// === QUICKVIEW INJECT ===
(function() {
  window.closeQuick = function() {
    var el = document.getElementById('quick-overlay-modal');
    if (el) el.remove();
    document.body.style.overflow = '';
  };

  window.quickView = function(p) {
    if (!p) return;
    var imgs = [];
    try {
      if (Array.isArray(p.images)) imgs = p.images;
      else if (typeof p.images === 'string') imgs = JSON.parse(p.images);
    } catch(e) {}
    if (!imgs.length && p.image) imgs = [p.image];
    if (!imgs.length) imgs = [''];

    var idx = 0;
    var el = document.getElementById('quick-overlay-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'quick-overlay-modal';
      document.body.appendChild(el);
    }
    document.body.style.overflow = 'hidden';

    el.onclick = function(e) {
      if (e.target === el) window.closeQuick();
    };

    function render() {
      var cur = imgs[idx] || '';
      var hasMulti = imgs.length > 1;
      var priceStr = typeof money === 'function' ? money(p.price) : 'R$ ' + p.price;

      var thumbsHtml = '';
      if (hasMulti) {
        thumbsHtml = '<div style="display:flex;gap:8px;overflow-x:auto;padding:10px 0;scrollbar-width:none;">' +
          imgs.map(function(src, i) {
            var bColor = (i === idx) ? '#22d3ee' : '#1f2937';
            var op = (i === idx) ? '1' : '0.5';
            return '<img src="' + src + '" onclick="window.__setQIdx(' + i + ')" style="width:50px;height:50px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid ' + bColor + ';opacity:' + op + ';flex-shrink:0;">';
          }).join('') + '</div>';
      }

      el.innerHTML = [
        '<div class="quick-card" onclick="event.stopPropagation()">',
          '<button type="button" onclick="window.closeQuick()" style="position:absolute;right:12px;top:12px;background:#1e293b;border:1px solid #334155;color:#fff;width:32px;height:32px;border-radius:50%;font-size:16px;font-weight:bold;cursor:pointer;z-index:20;display:flex;align-items:center;justify-content:center;">✕</button>',
          '<div style="position:relative;width:100%;height:290px;background:#05080c;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #1f2937;">',
            (cur ? '<img src="' + cur + '" style="max-width:100%;max-height:100%;object-fit:contain;">' : '<span style="font-size:50px;color:#334155;">◈</span>'),
            (hasMulti ? '<button type="button" onclick="window.__navQ(-1)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);border:1px solid #22d3ee;color:#22d3ee;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10;">‹</button>' : ''),
            (hasMulti ? '<button type="button" onclick="window.__navQ(1)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);border:1px solid #22d3ee;color:#22d3ee;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10;">›</button>' : ''),
          '</div>',
          thumbsHtml,
          '<div style="margin-top:12px;">',
            '<small style="color:#22d3ee;font-size:11px;font-weight:bold;text-transform:uppercase;">' + (p.category_name || 'Produto') + '</small>',
            '<h2 style="font-size:17px;margin:4px 0 6px;color:#fff;">' + (p.name || '') + '</h2>',
            '<div style="font-size:22px;font-weight:bold;color:#22d3ee;margin-bottom:10px;">' + priceStr + '</div>',
            '<div style="font-size:12px;color:#94a3b8;line-height:1.5;margin-bottom:16px;background:#111827;padding:10px;border-radius:8px;border:1px solid #1f2937;white-space:pre-line;">' + (p.description || 'Produto de alta qualidade com envio rápido.') + '</div>',
            '<button type="button" id="btn-quick-buy" style="width:100%;height:44px;background:#22d3ee;border:none;border-radius:10px;color:#061116;font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 0 15px rgba(34,211,238,0.25);">Adicionar ao Carrinho 🛒</button>',
          '</div>',
        '</div>'
      ].join('');

      var buyBtn = document.getElementById('btn-quick-buy');
      if (buyBtn) {
        buyBtn.onclick = function(e) {
          if (typeof addCart === 'function') addCart(p, e);
          window.closeQuick();
        };
      }
    }

    window.__navQ = function(dir) {
      idx = (idx + dir + imgs.length) % imgs.length;
      render();
    };

    window.__setQIdx = function(newIdx) {
      idx = newIdx;
      render();
    };

    render();
  };
})();


window.removerFundoProduto = async function(id, btn) {
  if (!confirm("Deseja remover o fundo da foto deste produto com IA?")) return;
  const originalText = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Recortando..."; }
  try {
    const res = await fetch(`/api/admin/products/${id}/remove-bg`, { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      alert("✓ Fundo removido com sucesso!");
      if (typeof adminProducts === "function") adminProducts();
      else location.reload();
    } else {
      alert("Aviso: " + (data.error || "Não foi possível remover o fundo."));
    }
  } catch(e) {
    alert("Erro de conexão ao remover fundo: " + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
  }
};


// Modal para Gerar Post com foto da Galeria
window.abrirModalGerarPost = function(prodId, prodName) {
  let modal = document.getElementById("modal-post-picker");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-post-picker";
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#0b1320;border:1px solid #1f2937;border-radius:16px;max-width:380px;width:100%;padding:20px;color:#fff;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="margin:0 0 8px;font-size:18px;color:#22d3ee;">Gerar Post Machado Express</h3>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px;">Escolha a imagem que deseja colocar no pedestal:</p>
        
        <canvas id="preview-post-canvas" width="1024" height="1024" style="display:block;width:min(100%,300px);height:auto;margin:0 auto 16px;border:2px dashed #374151;border-radius:12px;background:#05080c;touch-action:none;"></canvas>
        <div style="text-align:left;margin:0 auto 14px;max-width:300px;color:#cbd5e1;font-size:13px;">
          <label for="post-scale" style="display:flex;justify-content:space-between;margin:8px 0 4px;">Tamanho <span id="post-scale-value">100%</span></label>
          <input id="post-scale" type="range" min="0.5" max="1.8" step="0.05" value="1" oninput="window.atualizarTransformacaoPost()" style="width:100%;">
          <label for="post-rotation" style="display:flex;justify-content:space-between;margin:10px 0 4px;">Girar <span id="post-rotation-value">0°</span></label>
          <input id="post-rotation" type="range" min="-180" max="180" step="5" value="0" oninput="window.atualizarTransformacaoPost()" style="width:100%;">
        </div>

        <input type="file" id="input-foto-galeria" accept="image/*" style="display:none;" onchange="window.carregarPreviewGaleria(event)">
        
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button type="button" onclick="document.getElementById('input-foto-galeria').click()" style="background:#1e293b;border:1px solid #3b82f6;color:#60a5fa;padding:12px;border-radius:10px;font-size:14px;font-weight:bold;cursor:pointer;">
            📁 Escolher foto da Galeria
          </button>
          
          <button type="button" id="btn-confirmar-gerar" disabled onclick="window.executarGerarPost(${prodId})" style="background:#22d3ee;border:none;color:#050b14;padding:12px;border-radius:10px;font-size:14px;font-weight:900;cursor:pointer;">
            ⚡ Gerar Post Agora
          </button>
          
          <button type="button" onclick="document.getElementById('modal-post-picker').innerHTML=''" style="background:transparent;border:none;color:#64748b;font-size:13px;padding:6px;cursor:pointer;">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
  window.customPostImageBase64 = null;
  window.customPostImageElement = null;
  window.customPostTemplate = null;
  window.customPostPosition = null;
  window.iniciarArrastarPreviewPost();
};

window.customPostImageElement = null;
window.customPostTemplate = null;
window.customPostPosition = null;
window.customPostDrag = null;
window.renderizarPreviewPost = function() {
  const canvas = document.getElementById("preview-post-canvas");
  const image = window.customPostImageElement;
  const template = window.customPostTemplate;
  if (!canvas || !image || !template) return;
  const ctx = canvas.getContext("2d");
  const scale = Math.min(1, 360 / image.naturalWidth, 280 / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  if (!window.customPostPosition) window.customPostPosition = {x:(canvas.width-w)/2, y:750-h};
  const p = window.customPostPosition;
  p.x = Math.max(0, Math.min(canvas.width-w, p.x));
  p.y = Math.max(0, Math.min(canvas.height-h, p.y));
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(template,0,0,canvas.width,canvas.height);
  const factor = window.customPostScale || 1;
  const angle = (window.customPostRotation || 0) * Math.PI / 180;
  ctx.save();
  ctx.translate(p.x + w/2, p.y + h/2);
  ctx.rotate(angle);
  ctx.scale(factor, factor);
  ctx.drawImage(image, -w/2, -h/2, w, h);
  ctx.restore();
};
window.atualizarTransformacaoPost = function() {
  const tamanho = document.getElementById("post-scale");
  const giro = document.getElementById("post-rotation");
  if (tamanho) window.customPostScale = Number(tamanho.value);
  if (giro) window.customPostRotation = Number(giro.value);
  const textoTamanho = document.getElementById("post-scale-value");
  const textoGiro = document.getElementById("post-rotation-value");
  if (textoTamanho) textoTamanho.textContent = Math.round((window.customPostScale || 1) * 100) + "%";
  if (textoGiro) textoGiro.textContent = (window.customPostRotation || 0) + "°";
  if (window.renderizarPreviewPost) window.renderizarPreviewPost();
};
window.iniciarArrastarPreviewPost = function() {
  const canvas = document.getElementById("preview-post-canvas");
  if (!canvas || canvas.dataset.dragReady) return;
  canvas.dataset.dragReady = "1";
  canvas.addEventListener("pointerdown", function(e) {
    const image = window.customPostImageElement;
    const p = window.customPostPosition;
    if (!image || !p) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * canvas.width / rect.width;
    const y = (e.clientY - rect.top) * canvas.height / rect.height;
    const base = Math.min(1, 360 / image.naturalWidth, 280 / image.naturalHeight);
    const w = image.naturalWidth * base;
    const h = image.naturalHeight * base;
    const scale = window.customPostScale || 1;
    const angle = (window.customPostRotation || 0) * Math.PI / 180;
    const dx = x - (p.x + w/2);
    const dy = y - (p.y + h/2);
    const localX = (dx * Math.cos(angle) + dy * Math.sin(angle)) / scale + w/2;
    const localY = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale + h/2;
    if (localX >= 0 && localX <= w && localY >= 0 && localY <= h) {
      window.customPostDrag = {x:x, y:y, px:p.x, py:p.y};
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener("pointermove", function(e) {
    const drag = window.customPostDrag;
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * canvas.width / rect.width;
    const y = (e.clientY - rect.top) * canvas.height / rect.height;
    window.customPostPosition.x = drag.px + x - drag.x;
    window.customPostPosition.y = drag.py + y - drag.y;
    window.renderizarPreviewPost();
  });
  const parar = function() { window.customPostDrag = null; };
  canvas.addEventListener("pointerup", parar);
  canvas.addEventListener("pointercancel", parar);
};
window.carregarPreviewGaleria = function(e) {
  const file = e && e.target && e.target.files && e.target.files[0];
  const btn = document.getElementById("btn-confirmar-gerar");
  if (!file || !file.type || !file.type.startsWith("image/")) {
    alert("Escolha uma foto.");
    return;
  }
  if (btn) { btn.disabled = true; btn.innerText = "⏳ Carregando foto…"; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    const foto = ev.target && ev.target.result;
    if (typeof foto !== "string") { alert("Não consegui ler a foto."); return; }
    const img = new Image();
    img.onload = function() {
      window.customPostImageBase64 = foto;
      window.customPostImageElement = img;
      window.customPostPosition = null;
      window.customPostScale = 1;
      window.customPostRotation = 0;
      const escala = document.getElementById("post-scale");
      const giro = document.getElementById("post-rotation");
      if (escala) escala.value = "1";
      if (giro) giro.value = "0";
      window.atualizarTransformacaoPost();
      const template = new Image();
      template.onload = function() {
        window.customPostTemplate = template;
        window.renderizarPreviewPost();
        if (btn) {
          btn.disabled = false;
          btn.innerText = "⚡ Gerar post com a posição escolhida";
        }
      };
      template.onerror = function() {
        alert("Não consegui carregar o template da arte.");
        if (btn) btn.disabled = false;
      };
      template.src = "/templates/template.png";
    };
    img.onerror = function() {
      alert("Não consegui abrir essa foto.");
      if (btn) btn.disabled = false;
    };
    img.src = foto;
  };
  reader.onerror = function() {
    alert("Falha ao carregar a foto.");
    if (btn) btn.disabled = false;
  };
  reader.readAsDataURL(file);
};
window.executarGerarPost = async function(id) {
  const btn = document.getElementById("btn-confirmar-gerar");
  const foto = window.customPostImageBase64;
  if (!foto || !foto.startsWith("data:image/")) {
    alert("Escolha uma foto e aguarde ela carregar antes de gerar.");
    return;
  }
  if (btn) { btn.disabled = true; btn.innerText = "⏳ Gerando com a foto escolhida…"; }
  try {
    const data = await api(`/api/admin/posts/generate/${id}`, {
      method: "POST",
      body: JSON.stringify({custom_image: foto, position_x: window.customPostPosition && window.customPostPosition.x, position_y: window.customPostPosition && window.customPostPosition.y, product_scale: window.customPostScale || 1, product_rotation: window.customPostRotation || 0})
    });
    if (!data.ok || !data.url) throw new Error(data.error || "Não foi possível gerar o post.");
    if (data.used_custom_image !== true) {
      throw new Error("O servidor não confirmou a foto escolhida. Confira o server.js e reinicie a loja.");
    }
    const modal = document.getElementById("modal-post-picker");
    if (modal) modal.innerHTML = "";
    window.open(data.url, "_blank");
  } catch (err) {
    alert("Erro ao gerar post: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "⚡ Gerar post com foto da galeria";
    }
  }
};


let lastAdminOrderCount = null;
function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch(e) {}
}
function checkAdminNewOrders() {
  if (!store.user || !["super_admin","admin","gerente","atendente"].includes(store.user.role)) return;
  fetch("/api/admin/orders").then(r => r.json()).then(orders => {
    if (!Array.isArray(orders)) return;
    if (lastAdminOrderCount !== null && orders.length > lastAdminOrderCount) {
      const newest = orders[0];
      playNewOrderSound();
      showOrderNotification(newest);
    }
    lastAdminOrderCount = orders.length;
  }).catch(() => {});
}
function showOrderNotification(o) {
  const existing = document.getElementById("admin-order-alert-box");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.id = "admin-order-alert-box";
  div.className = "admin-order-alert";
  div.innerHTML = `
    <span style="font-size:24px;">🛍️🔔</span>
    <div>
      <b style="display:block;font-size:13px;text-transform:uppercase;">Novo Pedido #${o.id}!</b>
      <span style="font-size:12px;">Total: <b>${money(o.total)}</b> · ${esc(o.customer_name||"Cliente")}</span>
    </div>
    <button onclick="this.parentElement.remove();location.hash='#/admin/pedidos'" style="background:#fff;color:#065f46;border:none;padding:6px 12px;border-radius:6px;font-weight:bold;font-size:11px;cursor:pointer;margin-left:8px;">VER</button>
  `;
  document.body.appendChild(div);
  setTimeout(() => { if (div.parentElement) div.remove(); }, 12000);
}
if (!window.__orderPollInterval) {
  window.__orderPollInterval = setInterval(checkAdminNewOrders, 8000);
}


window.openCustomerDetails = async function(id) {
  try {
    const clients = await api("/api/admin/customers");
    const c = clients.find(x => Number(x.id) === Number(id));
    if (!c) return;
    const waClean = (c.phone || "").replace(/\D/g, "");
    const waLink = waClean ? `https://wa.me/${waClean.startsWith("55") ? waClean : "55" + waClean}?text=${encodeURIComponent("Olá " + c.name + "! Tudo bem? Falamos da loja.")}` : "";
    const orders = Array.isArray(c.orders) ? c.orders : [];
    
    const m = $("#modal");
    m.innerHTML = `
      <div class="panel" style="max-width:540px;width:92%;margin:20px auto;max-height:90vh;overflow-y:auto;position:relative;border-radius:14px;">
        <button class="modal-x" onclick="closeModal()">×</button>
        <div style="border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;margin-bottom:12px;">
          <span style="color:#38bdf8;font-size:11px;font-weight:bold;text-transform:uppercase;">Ficha do Cliente #${c.id}</span>
          <h2 style="margin:4px 0 0;font-size:20px;color:#fff;">${esc(c.name)}</h2>
          <small style="color:#94a3b8;">Cadastrado em: ${c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "Data não informada"}</small>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;background:rgba(255,255,255,0.04);padding:12px;border-radius:10px;">
          <div>
            <small style="color:#94a3b8;display:block;font-size:10px;text-transform:uppercase;">CPF:</small>
            <b style="color:#fff;font-size:13px;">${esc(c.cpf || "Não informado")}</b>
          </div>
          <div>
            <small style="color:#94a3b8;display:block;font-size:10px;text-transform:uppercase;">WhatsApp / Telefone:</small>
            ${waLink ? `<a href="${waLink}" target="_blank" style="color:#34d399;font-weight:bold;font-size:13px;text-decoration:none;">📱 ${esc(c.phone)} ↗</a>` : `<span style="color:#94a3b8;font-size:13px;">Não informado</span>`}
          </div>
          <div style="grid-column:span 2;">
            <small style="color:#94a3b8;display:block;font-size:10px;text-transform:uppercase;">E-mail:</small>
            <span style="color:#fff;font-size:13px;">${esc(c.email)}</span>
          </div>
          <div style="grid-column:span 2;">
            <small style="color:#94a3b8;display:block;font-size:10px;text-transform:uppercase;">Endereço de Entrega:</small>
            <span style="color:#e2e8f0;font-size:12px;line-height:1.4;">${esc(c.address || "Nenhum endereço cadastrado")}</span>
          </div>
        </div>

        <div>
          <h3 style="font-size:13px;color:#38bdf8;margin-bottom:8px;text-transform:uppercase;">Histórico de Compras (${orders.length})</h3>
          ${orders.length ? orders.map(o => `
            <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:8px;background:rgba(0,0,0,0.2);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <b style="color:#fff;font-size:13px;">Pedido #${o.id}</b>
                <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:rgba(56,189,248,0.15);color:#38bdf8;">${esc(orderStatusLabel(o.status))}</span>
              </div>
              <div style="margin-top:4px;font-size:12px;color:#94a3b8;">
                Total: <b style="color:#34d399;">${money(o.total)}</b> · ${new Date(o.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          `).join("") : `<p style="color:#94a3b8;font-size:12px;">Nenhum pedido realizado.</p>`}
        </div>
      </div>
    `;
    m.classList.remove("hidden");
  } catch(e) {
    toast("Erro ao carregar detalhes", "warn");
  }
};


// ULTRA ATUALIZACAO - CLIENT ENGINE
window.compressImage = function(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

window.playOrderAlertSound = function() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch(e) {}
};

let lastKnownOrdersCount = null;
function startAdminOrderMonitor() {
  setInterval(async () => {
    try {
      const res = await fetch('/api/admin/orders');
      const orders = await res.json();
      if (Array.isArray(orders)) {
        if (lastKnownOrdersCount !== null && orders.length > lastKnownOrdersCount) {
          window.playOrderAlertSound();
          showNewOrderBanner(orders[0] || { id: 'Novo' });
        }
        lastKnownOrdersCount = orders.length;
      }
    } catch(e) {}
  }, 10000);
}

function showNewOrderBanner(order) {
  const existing = document.querySelector('.admin-order-alert');
  if (existing) existing.remove();
  const alert = document.createElement('div');
  alert.className = 'admin-order-alert';
  alert.innerHTML = '🔔 🛍️ <b>NOVO PEDIDO #' + (order.id || '') + '!</b> Toque para ver';
  alert.onclick = () => {
    window.location.hash = '#/admin/pedidos';
    alert.remove();
  };
  document.body.appendChild(alert);
  setTimeout(() => { if (alert.parentNode) alert.remove(); }, 8000);
}

window.copyPixKey = function(keyText) {
  navigator.clipboard.writeText(keyText).then(() => {
    alert('✅ Chave Pix copiada com sucesso!');
  });
};

function setupFloatingWhatsApp() {
  if (document.querySelector('.wa-float-btn')) return;
  const btn = document.createElement('a');
  btn.className = 'wa-float-btn';
  btn.href = 'https://wa.me/5551981884111?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20a%20loja%20MachadoExpress!';
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.title = 'Fale conosco no WhatsApp';
  btn.style.cssText = 'position:fixed!important;bottom:24px!important;right:20px!important;width:60px!important;height:60px!important;background-color:#25D366!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 6px 20px rgba(37,211,102,0.5)!important;z-index:999999!important;text-decoration:none!important;';
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="34" height="34" fill="#ffffff"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;
  document.body.appendChild(btn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupFloatingWhatsApp();
    startAdminOrderMonitor();
  });
} else {
  setupFloatingWhatsApp();
  startAdminOrderMonitor();
}
