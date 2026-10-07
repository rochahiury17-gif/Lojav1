import re

# 1. Ajustar public/app.js (remover categorias da home e acertar banner)
with open("public/app.js", "r", encoding="utf-8") as f:
    app = f.read()

# Remover pílulas de categorias da tela inicial
app = re.sub(r'<section class="container" style="margin:16px auto;">[\s\S]*?\${categoryMarkup}[\s\S]*?</section>', '', app)

# Novo banner moderno e sempre visível
improved_banner = """function bannerMarkup(){
  const img = store.settings?.banner_image || "/banner/lban.png";
  const title = store.settings?.banner_title || "Tecnologia que combina com você.";
  const sub = store.settings?.banner_subtitle || store.settings?.store_description || "Descubra produtos selecionados, ofertas e novidades em um só lugar.";
  const btn = store.settings?.banner_button || "Explorar produtos";
  
  return `
    <section class="home-banner" style="position:relative;width:100%;min-height:360px;background:#060d17;display:flex;align-items:center;overflow:hidden;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
      <div style="position:absolute;inset:0;background-image:url('${img}');background-size:cover;background-position:center;opacity:0.35;"></div>
      <div style="position:absolute;inset:0;background:linear-gradient(90deg, #060d17 0%, rgba(6,13,23,0.85) 50%, rgba(6,13,23,0.4) 100%);"></div>
      <div class="container" style="position:relative;z-index:2;padding:36px 16px;">
        <span style="color:#22d3ee;font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;display:inline-block;padding:4px 10px;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.3);border-radius:20px;margin-bottom:12px;">MACHADOEXPRESS · DESTAQUES</span>
        <h1 style="font-size:clamp(24px, 5vw, 42px);font-weight:900;color:#fff;line-height:1.15;margin:0 0 10px;max-width:600px;">${esc(title)}</h1>
        <p style="font-size:14px;color:#94a3b8;line-height:1.5;margin:0 0 18px;max-width:520px;">${esc(sub)}</p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <a href="#/produtos" class="btn primary" style="padding:10px 18px;font-weight:bold;text-decoration:none;">${esc(btn)} →</a>
        </div>
      </div>
    </section>
  `;
}"""

app = re.sub(r'function bannerMarkup\(\)\{[\s\S]*?return `<style id="home-display-improvements">[\s\S]*?<\/section>`;\s*\}', improved_banner, app)

with open("public/app.js", "w", encoding="utf-8") as f:
    f.write(app)
print("✓ public/app.js atualizado!")

# 2. Ajustar server.js (persistência do Pix/WhatsApp em arquivo e permissão de salvar)
with open("server.js", "r", encoding="utf-8") as f:
    server = f.read()

persistence_code = """
// PERSISTENCIA DE CONFIGURACOES EM ARQUIVO
const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");
function loadSavedSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      const ins = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
      for (const [k, v] of Object.entries(saved)) ins.run(k, String(v));
    }
  } catch(e) {}
}
loadSavedSettings();
"""

if "SETTINGS_FILE" not in server:
    server = server.replace('const defaults = {', persistence_code + '\nconst defaults = {')

new_patch_settings = """app.patch("/api/admin/settings", admin, (req, res) => {
  const update = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [k, v] of Object.entries(req.body || {})) {
      update.run(k, String(v));
    }
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch (_) {}
    return res.status(500).json({ error: e.message });
  }

  try {
    const current = settings();
    fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), "utf8");
  } catch(e) {}

  audit(req.currentUser.id, "settings_updated", "Configurações da loja atualizadas");
  res.json({ ok: true });
});"""

server = re.sub(r'app\.patch\("/api/admin/settings",\s*fullAdmin,[\s\S]*?audit\(req\.currentUser\.id,"settings_updated","Configurações da loja atualizadas"\);res\.json\(\{ok:true\}\);\s*\}\);', new_patch_settings, server)

with open("server.js", "w", encoding="utf-8") as f:
    f.write(server)
print("✓ server.js atualizado!")
