INTEGRAÇÃO DO GERADOR DE POSTS

- template.png fica em public/templates/template.png
- imagens de produtos e banner podem ser enviadas pelo painel e ficam salvas em public/uploads/
- o site não depende de URL externa para essas imagens
- produtos novos usam o seletor de arquivo "Imagem do produto"
- o banner é configurado em Admin > Configurações > Imagem do banner
- o gerador usa apenas imagens locais do MachadoExpress

TERMUX:
  pkg install python -y
  pip install pillow
  npm start

PAINEL:
  http://127.0.0.1:3000/#/admin

GERAR POSTS:
  Abra "Gerar posts" e clique em "Gerar post".
  As artes ficam em public/posts/.
