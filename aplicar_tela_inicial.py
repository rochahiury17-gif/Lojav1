from pathlib import Path
import subprocess, shutil, time

p = Path("public/app.js")
if not p.exists():
    raise SystemExit("Não encontrei public/app.js. Nada foi alterado.")

s = p.read_text(encoding="utf-8")
if "HOME_DISPLAY_IMPROVEMENTS_V1" in s and "HOME_DEDUPLICATION_V1" in s:
    raise SystemExit("As melhorias da tela inicial já parecem instaladas. Nada foi alterado.")
if "HOME_DISPLAY_IMPROVEMENTS_V1" in s or "HOME_DEDUPLICATION_V1" in s:
    raise SystemExit("Encontrei parte das melhorias instalada. Para evitar duplicar alterações, nada foi alterado.")

banner_old = '  return `<section class="home-banner"><img class="home-banner-image" src="${img}" alt="MachadoExpress" loading="eager"><div class="home-banner-shade"></div><div class="container home-banner-content"><div class="home-banner-copy"><span class="eyebrow"><i></i> MACHADOEXPRESS · NOVIDADES · OFERTAS</span><h1>${esc(title)}</h1><p>${esc(sub)}</p><div class="hero-actions"><a class="btn primary" href="#/produtos">${esc(store.settings?.banner_button||"Explorar produtos")} <b>→</b></a><a class="btn ghost" href="#/produtos">Ver novidades</a></div><div class="hero-trust"><span>✓ Produtos selecionados</span><span>✓ Compra segura</span><span>✓ Suporte</span></div></div></div></section>`;'
if s.count(banner_old) != 1:
    raise SystemExit("O banner atual não corresponde ao esperado. Nada foi alterado.")

banner_new = '''  return `<style id="home-display-improvements">
    /* HOME_DISPLAY_IMPROVEMENTS_V1: banner mais legível e nomes completos */
    .home-banner{position:relative;min-height:clamp(440px,68vh,680px);display:flex;align-items:center;overflow:hidden}
    .home-banner-image{object-fit:cover}
    .home-banner-shade{background:linear-gradient(90deg,rgba(3,7,12,.88) 0%,rgba(3,7,12,.58) 58%,rgba(3,7,12,.2) 100%),linear-gradient(0deg,rgba(3,7,12,.42),transparent 58%)!important}
    .home-banner-copy{max-width:760px;text-shadow:0 2px 16px rgba(0,0,0,.45)}
    .home-banner-copy h1{max-width:12ch;line-height:1.04;text-wrap:balance}
    .home-banner-copy p{max-width:54ch}
    .product-body h3{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:1.25;min-height:2.5em}
    .product-body{display:flex;flex-direction:column}
    .product-bottom{margin-top:auto}
    @media(max-width:600px){
      .home-banner{min-height:560px;min-height:68svh}
      .home-banner-content{padding-top:40px;padding-bottom:38px}
      .home-banner-copy h1{font-size:clamp(2.2rem,10vw,3.8rem)}
      .home-banner-copy p{font-size:1rem}
    }
  </style><section class="home-banner"><img class="home-banner-image" src="${img}" alt="MachadoExpress" loading="eager"><div class="home-banner-shade"></div><div class="container home-banner-content"><div class="home-banner-copy"><span class="eyebrow"><i></i> MACHADOEXPRESS · NOVIDADES · OFERTAS</span><h1>${esc(title)}</h1><p>${esc(sub)}</p><div class="hero-actions"><a class="btn primary" href="#/produtos">${esc(store.settings?.banner_button||"Explorar produtos")} <b>→</b></a><a class="btn ghost" href="#/produtos">Ver novidades</a></div><div class="hero-trust"><span>✓ Produtos selecionados</span><span>✓ Compra segura</span><span>✓ Suporte</span></div></div></div></section>`;'''
s = s.replace(banner_old, banner_new, 1)

home_old = '''  const [ps,cats]=await Promise.all([api("/api/products"),api("/api/categories")]);
  const featured=ps.filter(p=>p.featured).slice(0,10);
  const main=featured.length?featured:ps.slice(0,10);
  const more=ps.filter(p=>!main.some(x=>x.id===p.id)).slice(0,10);'''
if s.count(home_old) != 1:
    raise SystemExit("A lista de produtos da tela inicial não corresponde ao esperado. Nada foi alterado.")

home_new = '''  const [ps,cats]=await Promise.all([api("/api/products"),api("/api/categories")]);
  // HOME_DEDUPLICATION_V1: oculta repetidos na vitrine sem apagar produtos do cadastro.
  const homeSeen=new Set();
  const homeProducts=ps.filter(p=>{
    const name=String(p.name||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const category=String(p.category_id||p.category_name||"").toLowerCase();
    const key=name+"|"+Number(p.price||0).toFixed(2)+"|"+category;
    if(homeSeen.has(key))return false;
    homeSeen.add(key);
    return true;
  });
  const featured=homeProducts.filter(p=>p.featured).slice(0,10);
  const main=featured.length?featured:homeProducts.slice(0,10);
  const more=homeProducts.filter(p=>!main.some(x=>x.id===p.id)).slice(0,10);'''
s = s.replace(home_old, home_new, 1)

backup = p.with_name("app.js.backup-tela-inicial-" + time.strftime("%Y%m%d-%H%M%S"))
staged = p.with_name("app.js.tela-inicial-temporario.js")
staged.write_text(s, encoding="utf-8")

check = subprocess.run(["node", "--check", str(staged)], capture_output=True, text=True)
if check.returncode:
    staged.unlink(missing_ok=True)
    raise SystemExit("A verificação de sintaxe falhou; o app.js original foi preservado.\n" + check.stderr)

shutil.copy2(p, backup)
staged.replace(p)
print("Melhorias aplicadas. Backup salvo em:", backup)
