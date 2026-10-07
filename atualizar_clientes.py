import re

# 1. Atualizar server.js
with open("server.js", "r", encoding="utf-8") as f:
    server = f.read()

normalization_helper = """
function normalizeWhatsApp(num) {
  if (!num) return "";
  let digits = String(num).replace(/\\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}
"""

new_customers_route = """
app.get("/api/admin/customers", admin, (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id, u.name, u.email, u.phone, u.cpf, u.active, u.created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = u.id) as total_spent,
        (SELECT street || ', nº ' || number || (CASE WHEN complement IS NOT NULL AND complement != '' THEN ' (' || complement || ')' ELSE '' END) || ' - ' || neighborhood || ', ' || city || '/' || state || ' - CEP: ' || cep 
         FROM addresses WHERE user_id = u.id ORDER BY id DESC LIMIT 1) as full_address
      FROM users u
      WHERE u.role = 'customer'
      ORDER BY u.id DESC
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
"""

old_register = 'const r=db.prepare("INSERT INTO users(name,email,password,phone,cpf,role) VALUES(?,?,?,?,?,?)").run(name,email.toLowerCase(),hash,phone||"",cpf||"","customer");'
new_register = 'const normPhone = normalizeWhatsApp(phone); const r=db.prepare("INSERT INTO users(name,email,password,phone,cpf,role) VALUES(?,?,?,?,?,?)").run(name,email.toLowerCase(),hash,normPhone,cpf||"","customer");'

if "normalizeWhatsApp" not in server:
    server = server.replace('function settings(){', normalization_helper + '\nfunction settings(){')
    server = re.sub(r'app\.get\("/api/admin/customers",admin,[\s\S]*?\)\.all\(\)\)\);', lambda m: new_customers_route.strip(), server)
    server = server.replace(old_register, new_register)
    with open("server.js", "w", encoding="utf-8") as f:
        f.write(server)
    print("✓ server.js atualizado")

# 2. Atualizar public/app.js
with open("public/app.js", "r", encoding="utf-8") as f:
    app = f.read()

new_admin_customers = """
async function adminCustomers(){
  if(!await requireAdmin()) return;
  let cs = await api("/api/admin/customers");
  if(!Array.isArray(cs)) cs = [];

  const cardsHtml = cs.map(c => {
    let cleanPhone = String(c.phone || "").replace(/\\D/g, "");
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
"""

old_admin_customers_pattern = r'async function adminCustomers\(\)\{[\s\S]*?adminShell\("Clientes",`[\s\S]*?`\)\}'
app = re.sub(old_admin_customers_pattern, lambda m: new_admin_customers.strip(), app)

with open("public/app.js", "w", encoding="utf-8") as f:
    f.write(app)
print("✓ public/app.js atualizado")
