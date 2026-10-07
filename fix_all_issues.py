import re

# 1. Atualizar public/app.js
with open("public/app.js", "r", encoding="utf-8") as f:
    app = f.read()

# Correção do removeCart
if "function removeCart(" not in app:
    app = app.replace("function saveCart(){", """function removeCart(id){
  cart = cart.filter(x => Number(x.product_id) !== Number(id));
  saveCart();
  renderCart();
  if (typeof renderMiniCart === "function") renderMiniCart();
  toast("Produto removido do carrinho.");
}
window.removeCart = removeCart;
function saveCart(){""", 1)

# Estilos de contraste para login, formulário compacto de produto e notificações
custom_css = """
<style id="custom-fixes-style">
.auth-fields input {
  background: #0f172a !important;
  color: #ffffff !important;
  border: 1.5px solid #38bdf8 !important;
  font-size: 16px !important;
  padding: 12px 14px !important;
  border-radius: 8px !important;
}
.auth-fields input::placeholder {
  color: #94a3b8 !important;
}
.product-modal-compact {
  max-width: 580px !important;
  padding: 16px 18px !important;
}
.product-modal-compact .two-fields,
.product-modal-compact .product-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.product-modal-compact label {
  font-size: 11px !important;
  margin-bottom: 2px !important;
}
.product-modal-compact input,
.product-modal-compact select,
.product-modal-compact textarea {
  padding: 8px 10px !important;
  font-size: 13px !important;
}
.admin-order-alert {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 99999;
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: #ffffff;
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 0 2px rgba(52, 211, 153, 0.5);
  display: flex;
  align-items: center;
  gap: 12px;
  animation: slideInNotification 0.35s ease-out;
}
@keyframes slideInNotification {
  from { transform: translateY(-30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
"""
if "custom-fixes-style" not in app:
    app = custom_css + app

# Notificações em tempo real para Admin
admin_poll = """
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
"""
if "checkAdminNewOrders" not in app:
    app += "\n" + admin_poll

# Painel detalhado do cliente ao clicar
cust_modal_fn = """
window.openCustomerDetails = async function(id) {
  try {
    const clients = await api("/api/admin/customers");
    const c = clients.find(x => Number(x.id) === Number(id));
    if (!c) return;
    const waClean = (c.phone || "").replace(/\\D/g, "");
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
"""
if "openCustomerDetails" not in app:
    app += "\n" + cust_modal_fn

# Vincular clique do card de cliente à abertura da ficha
app = app.replace(
    'class="panel customer-card"',
    'class="panel customer-card" onclick="openCustomerDetails(${c.id})" style="cursor:pointer;"'
)

with open("public/app.js", "w", encoding="utf-8") as f:
    f.write(app)

print("Ajustes aplicados com sucesso!")
