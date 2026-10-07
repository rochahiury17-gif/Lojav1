with open("public/app.js", "r") as f:
    code = f.read()

# Procura a função openCheckoutPanel e adiciona o closeCart() logo no início dela
old_code = "function openCheckoutPanel(){"
new_code = "function openCheckoutPanel(){ closeCart();"

if old_code in code and "closeCart();" not in code.split("function openCheckoutPanel()")[1][:30]:
    code = code.replace(old_code, new_code, 1)
    with open("public/app.js", "w") as f:
        f.write(code)
    print("Atualizado com sucesso!")
else:
    print("Já está configurado ou aplicado.")
