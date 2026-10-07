# Loja Online V1

Base completa e leve para rodar no Termux. Esta V1 usa Node.js + Express + SQLite para facilitar a instalação no celular.

## Recursos

- Loja pública responsiva
- Cadastro e login
- Área do cliente
- Endereços
- Carrinho
- Checkout
- Pedidos e status
- Painel administrativo
- Dashboard
- Produtos e categorias
- Clientes
- Funcionários
- Cargos e permissões
- Fornecedores
- Configurações da loja
- Configuração de Pix
- Cupons
- Logs de auditoria
- Estrutura preparada para evoluir para PostgreSQL e gateways de pagamento

## Instalação no Termux

```bash
pkg update -y
pkg install nodejs-lts -y
cd loja-online-v1
npm install
bash start-termux.sh
```

Abra:

http://127.0.0.1:3000

## Acesso inicial

E-mail: admin@loja.local
Senha: admin123

**Troque a senha imediatamente em produção.**

## Estrutura

- `server.js` backend
- `public/` frontend
- `data/` banco SQLite criado automaticamente
- `start-termux.sh` instalador/inicializador

## Observação

A V1 deixa o Pix configurável no painel, mas não inclui ainda uma cobrança Pix automática via API bancária. A arquitetura já separa pagamentos para essa integração futura.
