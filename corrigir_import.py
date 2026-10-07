import re

with open("server.js", "r", encoding="utf-8") as f:
    server = f.read()

new_import_route = """app.post("/api/admin/products/import", admin, (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body && req.body.products ? req.body.products : []);
    if (!list.length) return res.status(400).json({ error: "Nenhum produto encontrado no arquivo." });
    
    let count = 0;
    const catCheck = db.prepare("SELECT id FROM categories WHERE id = ?");
    const supCheck = db.prepare("SELECT id FROM suppliers WHERE id = ?");
    const insertStmt = db.prepare(`
      INSERT INTO products (category_id, supplier_id, name, slug, description, image, images, sku, price, cost, stock, active, featured, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    
    for (const p of list) {
      if (!p.name) continue;
      
      let catId = p.category_id ? Number(p.category_id) : null;
      if (catId && !catCheck.get(catId)) catId = null;
      
      let supId = p.supplier_id ? Number(p.supplier_id) : null;
      if (supId && !supCheck.get(supId)) supId = null;

      let baseSlug = String(p.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produto";
      let slug = baseSlug;
      let suffix = 2;
      while (db.prepare("SELECT id FROM products WHERE slug = ?").get(slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }
      const imgs = typeof p.images === "string" ? p.images : JSON.stringify(p.images || (p.image ? [p.image] : []));
      const mainImg = p.image || (Array.isArray(p.images) && p.images[0]) || "";
      
      insertStmt.run(
        catId,
        supId,
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
});"""

old_pattern = r'app\.post\("/api/admin/products/import",[\s\S]*?res\.json\(\{ ok: true, imported: count \}\);\s*\} catch\(e\) \{ res\.status\(500\)\.json\(\{ error: e\.message \}\); \}\s*\}\);'
server = re.sub(old_pattern, new_import_route, server)

with open("server.js", "w", encoding="utf-8") as f:
    f.write(server)
print("✓ Rota de importação corrigida com sucesso!")
