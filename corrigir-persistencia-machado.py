from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path.cwd()
SERVER = ROOT / "server.js"
PACKAGE = ROOT / "package.json"

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

if not SERVER.exists():
    raise SystemExit("ERRO: server.js não encontrado.")

# ============================================================
# BACKUPS
# ============================================================

server_backup = ROOT / f"server.js.backup-persistencia-{stamp}"
package_backup = ROOT / f"package.json.backup-persistencia-{stamp}"

shutil.copy2(SERVER, server_backup)

if PACKAGE.exists():
    shutil.copy2(PACKAGE, package_backup)

print("==============================================")
print(" MACHADO EXPRESS — CORREÇÃO DE PERSISTÊNCIA")
print("==============================================")
print()
print(f"BACKUP server.js: {server_backup.name}")

if PACKAGE.exists():
    print(f"BACKUP package.json: {package_backup.name}")

# ============================================================
# LER SERVER
# ============================================================

src = SERVER.read_text(encoding="utf-8")

# ============================================================
# GARANTIR connect-pg-simple
# ============================================================

pkg = None
if PACKAGE.exists():
    import json
    pkg = json.loads(PACKAGE.read_text(encoding="utf-8"))

    deps = pkg.setdefault("dependencies", {})

    if "connect-pg-simple" not in deps:
        deps["connect-pg-simple"] = "^10.0.0"
        PACKAGE.write_text(
            json.dumps(pkg, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8"
        )
        print("OK: connect-pg-simple adicionado ao package.json")
    else:
        print("OK: connect-pg-simple já estava instalado.")

# ============================================================
# IMPORTAR connect-pg-simple
# ============================================================

if 'require("connect-pg-simple")' not in src:
    marker = 'const session = require("express-session");'

    if marker in src:
        src = src.replace(
            marker,
            marker + '\nconst pgSession = require("connect-pg-simple")(session);',
            1
        )
        print("OK: import do connect-pg-simple adicionado.")
    else:
        print("AVISO: não encontrei o import do express-session.")
        print("Nenhuma alteração de sessão foi feita.")

# ============================================================
# TROCAR MEMORYSTORE POR POSTGRES SESSION STORE
# ============================================================

old = '''app.use(session({
  secret: process.env.SESSION_SECRET || "dev-only-local-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie:{httpOnly:true, sameSite:"lax", secure: process.env.NODE_ENV === "production", maxAge:1000*60*60*24*7}
}));'''

new = '''app.use(session({
  store: process.env.DATABASE_URL
    ? new pgSession({
        pool: pool,
        tableName: "user_sessions",
        createTableIfMissing: true
      })
    : undefined,
  secret: process.env.SESSION_SECRET || "dev-only-local-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));'''

if old in src:
    src = src.replace(old, new, 1)
    print("OK: MemoryStore substituído por PostgreSQL.")
else:
    # Tenta localizar automaticamente o bloco de session
    pattern = re.compile(
        r'app\.use\(session\(\{\s*'
        r'secret:\s*process\.env\.SESSION_SECRET.*?'
        r'cookie:\s*\{.*?\}\s*'
        r'\}\)\);',
        re.S
    )

    match = pattern.search(src)

    if match:
        replacement = '''app.use(session({
  store: process.env.DATABASE_URL
    ? new pgSession({
        pool: pool,
        tableName: "user_sessions",
        createTableIfMissing: true
      })
    : undefined,
  secret: process.env.SESSION_SECRET || "dev-only-local-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));'''
        src = src[:match.start()] + replacement + src[match.end():]
        print("OK: configuração de sessão localizada e corrigida.")
    else:
        print("AVISO: não consegui localizar o bloco session automaticamente.")

# ============================================================
# SALVAR
# ============================================================

SERVER.write_text(src, encoding="utf-8")

print()
print("==============================================")
print(" ALTERAÇÃO CONCLUÍDA")
print("==============================================")
print()
print("IMPORTANTE:")
print("1. O backup foi criado ANTES da alteração.")
print("2. O SQLite continua sendo o banco principal do código.")
print("3. As sessões passarão a usar PostgreSQL no Render.")
print("4. O próximo passo é testar a persistência do SQLite.")
print()
print("BACKUPS:")
print(server_backup)
if PACKAGE.exists():
    print(package_backup)
