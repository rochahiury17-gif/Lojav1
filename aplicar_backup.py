import re

# 1. Atualizar server.js
with open("server.js", "r", encoding="utf-8") as f:
    server = f.read()

if "/api/admin/products/export" not in server:
    routes = """
// EXPORTAR E IMPORTAR PRODUTOS (BACKUP E RESTAURACAO)
app.get("/api/admin/products/export", admin, (req, res) => {
  try {
    const prods = db.prepare("SELECT * FROM products ORDER BY id ASC").all();
    res.setHeader("Content-Disposition", "attachment; filename=produtos-backup.json");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(prods, null, 2));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/products/import", admin, (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body && req.body.products ? req.body.products : []);
    if (!list.length) return res.status(400).json({ error: "Nenhum produto encontrado no arquivo." });
    let count = 0;
    const insertStmt = db.prepare(`
      INSERT INTO products (category_id, supplier_id, name, slug, description, image, images, sku, price, cost, stock, active, featured, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const p of list) {
      if (!p.name) continue;
      let baseSlug = String(p.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produto";
      let slug = baseSlug;
      let suffix = 2;
      while (db.prepare("SELECT id FROM products WHERE slug = ?").get(slug)) {
        slug = baseSlug + "-" + (suffix++);
      }
      const imgs = typeof p.images === "string" ? p.images : JSON.stringify(p.images || (p.image ? [p.image] : []));
      const mainImg = p.image || (Array.isArray(p.images) && p.images[0]) || "";
      insertStmt.run(
        p.category_id || null,
        p.supplier_id || null,
        p.name,
        slug,
        p.description || "",
        mainImg,
        imgs,
        p.sku || "",
        Number(p.price) || 0,
        Number(p.cost) || 0,
        Number(p.stock) || 0,
        p.active === 0 ? 0 : 1,
        p.featured ? 1 : 0,
        Number(p.sort_order) || 0
      );
      count++;
    }
    res.json({ ok: true, imported: count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
"""
    server = server.replace('app.get("/api/admin/products",admin,', routes + '\napp.get("/api/admin/products",admin,')
    with open("server.js", "w", encoding="utf-8") as f:
        f.write(server)
    print("✓ server.js atualizado")

# 2. Atualizar public/app.js
with open("public/app.js", "r", encoding="utf-8") as f:
    app = f.read()

if "window.exportProductsBackup" not in app:
    helpers = """
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
"""

    bar_html = """
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
"""

    app = helpers + "\n" + app
    app = app.replace('<div id="adminProductList">', bar_html + '\n    <div id="adminProductList">')
    with open("public/app.js", "w", encoding="utf-8") as f:
        f.write(app)
    print("✓ public/app.js atualizado")
