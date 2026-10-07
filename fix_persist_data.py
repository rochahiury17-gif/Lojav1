import re

# 1. Ajustar public/app.js para selecionar endereço existente e manter dados preenchidos
with open("public/app.js", "r", encoding="utf-8") as f:
    app = f.read()

# No select de endereço, se já houver endereço salvo, seleciona o primeiro por padrão
app = app.replace(
    '<option value="new" ${addresses.length?"":"selected"}>Cadastrar um endereço para esta compra</option>${addressOptions}',
    '${addressOptions}<option value="new" ${addresses.length?"":"selected"}>+ Cadastrar novo endereço</option>'
)

# Garantir que o primeiro endereço fique selecionado no HTML
old_map = 'const addressOptions=addresses.map(a=>`<option value="${Number(a.id)}">'
new_map = 'const addressOptions=addresses.map((a,i)=>`<option value="${Number(a.id)}" ${i===0?"selected":""}>'
if old_map in app:
    app = app.replace(old_map, new_map)

with open("public/app.js", "w", encoding="utf-8") as f:
    f.write(app)

# 2. Ajustar server.js para salvar CPF e Telefone no perfil do usuário ao criar pedido
with open("server.js", "r", encoding="utf-8") as f:
    server = f.read()

order_hook = 'let transactionOpen=false;'
update_user_hook = '''// Atualizar CPF e telefone do usuario se informados no pedido
    try {
      const uPhone = req.body.phone ? normalizeWhatsApp(req.body.phone) : null;
      const uCpf = req.body.cpf ? String(req.body.cpf).trim() : null;
      if (uPhone || uCpf) {
        const cur = db.prepare("SELECT phone, cpf FROM users WHERE id=?").get(req.session.userId);
        if (cur) {
          const finalPhone = uPhone || cur.phone;
          const finalCpf = uCpf || cur.cpf;
          db.prepare("UPDATE users SET phone=?, cpf=? WHERE id=?").run(finalPhone, finalCpf, req.session.userId);
        }
      }
    } catch(e) {}
    let transactionOpen=false;'''

if order_hook in server and "Atualizar CPF e telefone" not in server:
    server = server.replace(order_hook, update_user_hook, 1)

with open("server.js", "w", encoding="utf-8") as f:
    f.write(server)

print("Ajustes aplicados com sucesso!")
