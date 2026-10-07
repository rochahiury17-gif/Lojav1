from pathlib import Path
import subprocess, shutil, time

p = Path("public/app.js")
if not p.exists():
    raise SystemExit("Não encontrei public/app.js. Nada foi alterado.")

s = p.read_text(encoding="utf-8")
if "window.__photoManagerReady" in s:
    raise SystemExit("O gerenciador parece já instalado. Nada foi alterado.")

helper = r'''// Gerenciador de fotos: capa, ordem e remoção no cadastro e na edição.
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
'''

anchor = 'async function newProductModal(){'
if s.count(anchor) != 1:
    raise SystemExit("Não encontrei o formulário de novo produto. Nada foi alterado.")
s = s.replace(anchor, helper + "\n" + anchor, 1)
s = s.replace(anchor, anchor + "\n  window.__newProductFiles=[];", 1)

old_input = '<input name="image_files" type="file" multiple accept="image/*" style="background:#0d131b;border:1px solid rgba(255,255,255,0.15);padding:8px;border-radius:8px;width:100%;">'
if s.count(old_input) != 2:
    raise SystemExit("Não encontrei os dois campos de fotos esperados. Nada foi alterado.")

new_input = '<input id="newProductPhotoInput" name="image_files" type="file" multiple accept="image/*" onchange="window.__newProductFiles=Array.from(this.files||[]);window.__renderNewProductPhotos()" style="background:#0d131b;border:1px solid rgba(255,255,255,0.15);padding:8px;border-radius:8px;width:100%;"><div id="newProductPhotoList" style="display:flex;gap:6px;overflow-x:auto;margin-top:8px"></div>'
s = s.replace(old_input, new_input, 1)

old_note = '<small style="color:#8995a7;font-size:11px;display:block;margin-top:6px;">Selecione várias fotos no celular. A <b>1ª foto selecionada</b> será a capa na tela inicial!</small>'
new_note = '<small style="color:#8995a7;font-size:11px;display:block;margin-top:6px;">Use ‹ e › para mudar a ordem, “Definir capa” para escolher a foto principal e × para remover.</small>'
if old_note not in s:
    raise SystemExit("Não encontrei a orientação das fotos. Nada foi alterado.")
s = s.replace(old_note, new_note, 1)

needle = '  if(!imgs.length && p.image) imgs = [p.image];\n\n  $("#modal").innerHTML = `'
if s.count(needle) != 1:
    raise SystemExit("Não encontrei o início da edição de produto. Nada foi alterado.")
s = s.replace(needle, '  if(!imgs.length && p.image) imgs = [p.image];\n  window.__editProductImages = imgs.slice();\n\n  $("#modal").innerHTML = `', 1)

start = '      ${imgs.length > 0 ? `\n      <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:10px;margin-bottom:15px;border:1px solid rgba(255,255,255,0.08);">'
i = s.find(start)
if i < 0:
    raise SystemExit("Não encontrei a galeria atual da edição. Nada foi alterado.")

tail = '      </div>` : ""}\n\n      <form onsubmit="updateProduct(event, ${p.id})">'
j = s.find(tail, i)
if j < 0:
    raise SystemExit("Não encontrei o fechamento da galeria. Nada foi alterado.")

replacement = '''      <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:10px;margin-bottom:15px;border:1px solid rgba(255,255,255,0.08);">
        <b id="editPhotosCount" style="font-size:11px;display:block;margin-bottom:6px;color:#22d3ee;">Fotos cadastradas (${imgs.length}):</b>
        <div id="editProductPhotoList" style="display:flex;gap:6px;overflow-x:auto"></div>
      </div>

      <form onsubmit="updateProduct(event, ${p.id})">'''
s = s[:i] + replacement + s[j + len(tail):]

s = s.replace(old_input, '<input name="image_files" type="file" multiple accept="image/*" style="background:#0d131b;border:1px solid rgba(255,255,255,0.15);padding:8px;border-radius:8px;width:100%;">', 1)

needle = '  $("#modal").classList.remove("hidden");\n}\n\nasync function updateProduct(e, id){'
if s.count(needle) != 1:
    raise SystemExit("Não encontrei o final do formulário de edição. Nada foi alterado.")
s = s.replace(needle, '  $("#modal").classList.remove("hidden");\n  window.__renderEditProductPhotos();\n}\n\nasync function updateProduct(e, id){', 1)

old_main = 'body.image = allImages.length > 0 ? allImages[0] : (body.image || "");'
if s.count(old_main) != 1:
    raise SystemExit("Não encontrei a atualização da foto de capa. Nada foi alterado.")
s = s.replace(old_main, 'body.image = allImages.length > 0 ? allImages[0] : "";', 1)

backup = p.with_name("app.js.backup-fotos")
if backup.exists():
    backup = p.with_name("app.js.backup-fotos-" + time.strftime("%Y%m%d-%H%M%S"))

staged = p.with_name("app.js.fotos-temporario.js")
staged.write_text(s, encoding="utf-8")
check = subprocess.run(["node", "--check", str(staged)], capture_output=True, text=True)
if check.returncode:
    staged.unlink(missing_ok=True)
    raise SystemExit("A verificação falhou; o original foi preservado.\n" + check.stderr)

shutil.copy2(p, backup)
staged.replace(p)
print("Alteração aplicada. Backup salvo em:", backup)
