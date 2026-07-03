#!/bin/bash
set -euo pipefail

REPO_NAME="simulador-juros-compostos"
GITHUB_USER="EchoLimbo20"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$PROJECT_DIR"

echo "→ Inicializando repositório..."
rm -rf .git
git init
git branch -M main

git add .gitignore README.md index.html package.json package-lock.json vite.config.js src/
git -c user.name="$GITHUB_USER" -c user.email="$GITHUB_USER@users.noreply.github.com" commit -m "$(cat <<'EOF'
Adiciona simulador de juros compostos com plano, dashboard e sugestões por prazo.

Projeto React/Vite para comparar investimentos de baixo risco no Brasil, com README explicativo.
EOF
)"

REMOTE="https://github.com/$GITHUB_USER/$REPO_NAME.git"

if command -v gh >/dev/null 2>&1; then
  echo "→ Criando repositório no GitHub via gh..."
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push --description "Simulador de juros compostos — compare poupança, CDB, Tesouro Selic e LCI/LCA"
  echo ""
  echo "✓ Publicado em: https://github.com/$GITHUB_USER/$REPO_NAME"
else
  echo "→ gh não encontrado. Configure o remote manualmente:"
  git remote add origin "$REMOTE" 2>/dev/null || git remote set-url origin "$REMOTE"
  echo ""
  echo "1. Crie o repositório em: https://github.com/new?name=$REPO_NAME"
  echo "2. Depois rode: git push -u origin main"
  echo ""
  echo "Remote configurado: $REMOTE"
fi
