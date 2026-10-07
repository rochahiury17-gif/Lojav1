#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "======================================"
echo "   LOJA ONLINE V1 - TERMUX"
echo "======================================"
command -v node >/dev/null 2>&1 || { echo "Node.js não encontrado. Rode: pkg install nodejs-lts -y"; exit 1; }
echo "Node: $(node -v)"
npm install
echo ""
echo "Instalação concluída."
echo "Abrindo em http://127.0.0.1:3000"
echo "Usuário inicial: admin@loja.local"
echo "Senha inicial: admin123"
echo ""
npm start
