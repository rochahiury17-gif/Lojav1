from pathlib import Path
import re, shutil

app = Path("public/app.js")
server = Path("server.js")
if not app.exists() or not server.exists():
    raise SystemExit("Execute na pasta ~/loja-online-v1.")

shutil.copy2(app, "public/app.js.foto.bak")
shutil.copy2(server, "server.js.foto.bak")

s = app.read_text()
s, n = re.subn(
    r'<button type="button" id="btn-confirmar-gerar"(?! disabled)',
    '<button type="button" id="btn-confirmar-gerar" disabled',
    s, count=1
)

novo = r'''window.carregarPreviewGaleria = function(e) {
  const file = e?.target?.files?.[0];
  const btn = document.getElementById("btn-confirmar-gerar");
  const box = document.getElementById("preview-post-box");
  window.customPostImageBase64 = null;
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/")) {
    alert("Escolha um arquivo de imagem.");
    return;
  }
  if (btn) { btn.disabled = true; btn.innerText = "⏳ Carregando foto…"; }
  const reader = new FileReader();
  reader.onload = function(evt) {
    const foto = evt.target?.result;
    if (typeof foto !== "string" || !foto.startsWith("data:image/")) {
      alert("Não consegui ler a foto. Tente escolher outra.");
      return;
    }
    window.customPostImageBase64 = foto;
    if (box) box.innerHTML = `<img src="${foto}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    if (btn) { btn.disabled = false; btn.innerText = "⚡ Gerar post com foto da galeria"; }
  };
  reader.onerror = function() {
    alert("Falha ao carregar a foto. Tente novamente.");
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
      body: JSON.stringify({custom_image: foto})
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
};'''

padrao = r'window\.carregarPreviewGaleria = function\(e\) \{.*?\n\};\s*\n\s*window\.executarGerarPost = async function\(id\) \{.*?\n\};'
s, n2 = re.subn(padrao, novo, s, count=1, flags=re.S)
if n2 != 1:
    raise SystemExit("Não encontrei as funções do seletor. Os backups foram preservados; nada foi aplicado.")
app.write_text(s)

t = server.read_text()
inicio = t.find('app.post("/api/admin/posts/generate/:id"')
fim = t.find('app.get("/api/admin/logs"', inicio)
if inicio < 0 or fim < 0:
    raise SystemExit("Não encontrei a rota no server.js. O backup foi preservado.")

rota = t[inicio:fim]
troca = '''    const product=db.prepare("SELECT id,name,price,image FROM products WHERE id=?").get(req.params.id);
    if(!product) return res.status(404).json({error:"Produto não encontrado."});
    const usedCustomImage = typeof req.body?.custom_image === "string" && req.body.custom_image.startsWith("data:image/");
    if (req.body?.custom_image && !usedCustomImage) return res.status(400).json({error:"A foto escolhida chegou em formato inválido."});
    if (usedCustomImage) product.image = req.body.custom_image;
    const py=process.env.PYTHON || "python3";'''
rota, n3 = re.subn(
    r'    const product=db\.prepare\("SELECT id,name,price,image FROM products WHERE id=\?"\)\.get\(req\.params\.id\);.*?    const py=process\.env\.PYTHON \|\| "python3";',
    lambda _: troca, rota, count=1, flags=re.S
)
if n3 != 1:
    raise SystemExit("Não consegui atualizar a rota; use os backups para restaurar os arquivos.")
if "result.used_custom_image = usedCustomImage;" not in rota:
    rota, n4 = re.subn(
        r'    res\.json\(result\);',
        '    result.used_custom_image = usedCustomImage;\n    res.json(result);',
        rota, count=1
    )
    if n4 != 1:
        raise SystemExit("Não consegui incluir a confirmação da imagem.")
t = t[:inicio] + rota + t[fim:]
server.write_text(t)
print("Correção aplicada. Backups criados ao lado dos arquivos originais.")
