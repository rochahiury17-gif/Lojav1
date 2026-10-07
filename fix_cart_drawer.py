with open("public/app.js", "r") as f:
    content = f.read()

# Substitui ou ajusta a abertura do painel para fechar o carrinho primeiro
target = 'function openCheckoutPanel(){'
replacement = 'function openCheckoutPanel(){ closeCart(); '

if target in content and 'closeCart();' not in content:
    content = content.replace(target, replacement)
    with open("public/app.js", "w") as f:
        f.write(content)
    print("Carrinho configurado para fechar ao avançar!")
else:
    print("Já está ajustado ou a função tem outro nome.")
