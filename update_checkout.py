with open("public/app.js", "r") as f:
    content = f.read()

# Substitui a função finalizeCheckout para garantir o redirecionamento e o envio corretos
old_func = """async function finalizeCheckout(event){
  if(event)event.preventDefault();
  if(!store.user){sessionStorage.setItem("voltarAoCheckout","1");closeModal();location.hash="#/login";return}
  const select=document.getElementById("checkoutAddress");
  if(!select){toast("Abra novamente a finalização da compra.","warn");return}
  const body={items:cart,payment_method:"pix"};
  if(select.value==="new"){
    const form=document.getElementById("checkoutForm");
    if(!form.reportValidity())return;
    const fields=document.getElementById("checkoutNewAddress");
    body.address=Object.fromEntries(Array.from(fields.querySelectorAll("input")).map(i=>[i.name,i.value.trim()]));
  }else body.address_id=Number(select.value);"""

# Nova versão robusta que envia para o WhatsApp e avança a tela
new_func = """async function finalizeCheckout(event){
  if(event)event.preventDefault();
  if(!store.user){sessionStorage.setItem("voltarAoCheckout","1");closeModal();location.hash="#/login";return}
  const select=document.getElementById("checkoutAddress");
  if(!select){toast("Abra novamente a finalização da compra.","warn");return}
  const body={items:cart,payment_method:"pix"};
  if(select.value==="new"){
    const form=document.getElementById("checkoutForm");
    if(!form.reportValidity())return;
    const fields=document.getElementById("checkoutNewAddress");
    body.address=Object.fromEntries(Array.from(fields.querySelectorAll("input")).map(i=>[i.name,i.value.trim()]));
  }else body.address_id=Number(select.value);

  try{
    const d=await api("/api/orders",{method:"POST",body:JSON.stringify(body)});
    
    let msg = `🛍️ *NOVO PEDIDO - MACHADO EXPRESS*%0A%0A`;
    msg += `*Pedido:* #${d.id}%0A`;
    msg += `*Valor Total:* ${money(d.total)}%0A%0A`;
    msg += `Itens do pedido:%0A`;
    if (d.items && d.items.length) {
        d.items.forEach(i => {
            msg += `- ${i.name} (Qtd: ${i.quantity}) - ${money(i.price)}%0A`;
        });
    }
    msg += `%0AOlá! Acabei de fazer este pedido no site e gostaria de prosseguir com o pagamento.`;
    
    let meuWhatsApp = "5551981884111"; 
    window.open(`https://wa.me/${meuWhatsApp}?text=${msg}`, '_blank');

    cart=[];saveCart();showPixOrderConfirmation(d);
  }catch(e){toast(e.message,"warn")}"""

if old_func in content:
    content = content.replace(old_func, new_func)
    with open("public/app.js", "w") as f:
        f.write(content)
    print("Atualizado com sucesso!")
else:
    print("Bloco nao encontrado exatamente, mas vamos garantir o final.")
