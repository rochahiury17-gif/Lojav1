from pathlib import Path
import re, subprocess, shutil, time

p = Path("public/app.js")
if not p.exists():
    raise SystemExit("Não encontrei public/app.js. Nada foi alterado.")

s = p.read_text(encoding="utf-8")
changed = False

# Mostra os títulos dos produtos em até duas linhas.
old_title = '<h3 onclick=\'quickView(${pJson})\' style="cursor:pointer;">${esc(p.name)}</h3>'
new_title = '<h3 onclick=\'quickView(${pJson})\' style="cursor:pointer;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;display:-webkit-box!important;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-height:1.25;min-height:2.5em;word-break:break-word;">${esc(p.name)}</h3>'

if "white-space:normal!important;overflow:visible!important" not in s:
    if s.count(old_title) != 1:
        raise SystemExit("Não encontrei o título no formato esperado. Nada foi alterado.")
    s = s.replace(old_title, new_title, 1)
    changed = True

# Oculta produtos repetidos apenas da vitrine, sem apagar os cadastros.
dedupe = '''  // HOME_DEDUPLICATION_V2: esconde duplicados por nome e preço apenas na vitrine.
  const homeSeen=new Set();
  const homeProducts=ps.filter(p=>{
    const name=String(p.name||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const key=name+"|"+Number(p.price||0).toFixed(2);
    if(homeSeen.has(key))return false;
    homeSeen.add(key);
    return true;
  });
  const featured=homeProducts.filter(p=>p.featured).slice(0,10);
  const main=featured.length?featured:homeProducts.slice(0,10);
  const more=homeProducts.filter(p=>!main.some(x=>x.id===p.id)).slice(0,10);'''

if "HOME_DEDUPLICATION_V2" not in s:
    # Se a versão anterior estiver presente, troca por esta corrigida.
    pattern_v1 = re.compile(
        r'  // HOME_DEDUPLICATION_V1:.*?\n'
        r'  const homeSeen=new Set\(\);.*?\n'
        r'  const more=homeProducts\.filter\(p=>!main\.some\(x=>x\.id===p\.id\)\)\.slice\(0,10\);',
        re.S
    )

    if pattern_v1.search(s):
        # A função lambda evita que o Python interprete \u como escape na substituição.
        s, count = pattern_v1.subn(lambda match: dedupe, s, count=1)
        if count != 1:
            raise SystemExit("Não consegui atualizar a regra de repetidos. Nada foi alterado.")
        changed = True
    else:
        old_list = '''  const featured=ps.filter(p=>p.featured).slice(0,10);
  const main=featured.length?featured:ps.slice(0,10);
  const more=ps.filter(p=>!main.some(x=>x.id===p.id)).slice(0,10);'''

        if s.count(old_list) != 1:
            raise SystemExit("A lista inicial não corresponde ao esperado. Nada foi alterado.")
        s = s.replace(old_list, dedupe, 1)
        changed = True

if not changed:
    print("Os dois ajustes já estão instalados. Nenhum arquivo foi alterado.")
    raise SystemExit(0)

backup = p.with_name(
    "app.js.backup-tela-inicial-" + time.strftime("%Y%m%d-%H%M%S")
)
staged = p.with_name("app.js.tela-inicial-temporario.js")
staged.write_text(s, encoding="utf-8")

check = subprocess.run(
    ["node", "--check", str(staged)],
    capture_output=True,
    text=True
)

if check.returncode:
    staged.unlink(missing_ok=True)
    raise SystemExit(
        "A verificação falhou; o app.js original foi preservado.\n" + check.stderr
    )

shutil.copy2(p, backup)
staged.replace(p)
print("Ajustes aplicados. Backup salvo em:", backup)
