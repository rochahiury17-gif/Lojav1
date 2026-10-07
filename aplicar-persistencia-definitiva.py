from pathlib import Path
from datetime import datetime
import shutil
import re
import json

ROOT = Path.cwd()
SERVER = ROOT / "server.js"
BOOTSTRAP = ROOT / "bootstrap.js"
PACKAGE = ROOT / "package.json"

if not SERVER.exists():
    raise SystemExit("ERRO: server.js não encontrado.")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

print("==============================================")
print(" MACHADO EXPRESS — PERSISTÊNCIA DEFINITIVA")
print("==============================================")
print()

# ============================================================
# BACKUPS
# ============================================================

for file in [SERVER, BOOTSTRAP, PACKAGE]:
    if file.exists():
        backup = ROOT / f"{file.name}.backup-final-{stamp}"
        shutil.copy2(file, backup)
        print(f"BACKUP CRIADO: {backup.name}")

print()

# ============================================================
# SERVER.JS
# ============================================================

src = SERVER.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Garantir Pool PostgreSQL
# ------------------------------------------------------------

if "const { Client: PgClient, Pool } = require('pg');" not in src:
    src = src.replace(
        "const { Client: PgClient } = require('pg');",
        """const { Client: PgClient, Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('dpg-')
        ? false
        : { rejectUnauthorized: false }
    })
  : null;""",
        1
    )
    print("OK: Pool PostgreSQL corrigido.")
else:
    print("OK: Pool PostgreSQL já existe.")

# ------------------------------------------------------------
# 2. Remover RESTORE antigo do final do server.js
#
# O restore agora acontece no bootstrap ANTES de abrir SQLite.
# ------------------------------------------------------------

old_startup = re.compile(
    r'\(async \(\) => \{\s*'
    r'await syncPg\(\'restore\'\);\s*'
    r'app\.listen\(PORT, \(\) => \{\s*'
    r'console\.log\(\);\s*'
    r'schedulePgSync\(\);\s*'
    r'\}\);\s*'
    r'\}\)\(\);',
    re.S
)

if old_startup.search(src):
    src = old_startup.sub(
        """app.listen(PORT, () => {
  console.log();
  console.log("[Machado Express] Servidor iniciado na porta " + PORT);
  console.log("[PostgreSQL] Persistência automática ativada.");
  schedulePgSync();
});""",
        src,
        count=1
    )
    print("OK: restore tardio removido do server.js.")
else:
    print("AVISO: bloco antigo de inicialização não foi localizado.")

# ------------------------------------------------------------
# 3. Inserir sincronização automática de TODAS as mutações
# ------------------------------------------------------------

marker = 'app.use(express.static(path.join(__dirname,"public")));'

middleware = r'''
// ============================================================
// PERSISTÊNCIA AUTOMÁTICA
// ============================================================
// Qualquer rota que altere dados dispara um backup do SQLite
// para o PostgreSQL depois que a resposta termina.
// Isso cobre POST, PUT, PATCH e DELETE sem precisar colocar
// schedulePgSync() manualmente em cada rota.

app.use((req, res, next) => {
  const method = String(req.method || "").toUpperCase();

  const mutatingMethods = new Set([
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
  ]);

  if (!mutatingMethods.has(method)) {
    return next();
  }

  res.on("finish", () => {
    // Só sincroniza depois de uma resposta bem-sucedida.
    if (res.statusCode >= 200 && res.statusCode < 400) {
      schedulePgSync();
    }
  });

  next();
});

// ============================================================
// FIM DA PERSISTÊNCIA AUTOMÁTICA
// ============================================================

'''

if "PERSISTÊNCIA AUTOMÁTICA" not in src:
    if marker not in src:
        raise SystemExit(
            "ERRO: não encontrei o local seguro para inserir "
            "a persistência automática."
        )

    src = src.replace(
        marker,
        marker + "\n" + middleware,
        1
    )

    print("OK: sincronização automática adicionada.")
else:
    print("OK: sincronização automática já existe.")

# ------------------------------------------------------------
# 4. Garantir sessão PostgreSQL segura
# ------------------------------------------------------------

session_pattern = re.compile(
    r'app\.use\(session\(\{.*?\}\)\);',
    re.S
)

match = session_pattern.search(src)

if match:
    block = match.group(0)

    if "pgSession" in block:
        block2 = block.replace(
            "store: process.env.DATABASE_URL",
            "store: process.env.DATABASE_URL && pool",
            1
        )

        if block2 != block:
            src = src[:match.start()] + block2 + src[match.end():]
            print("OK: session store protegido contra ausência do pool.")
        else:
            print("OK: sessão PostgreSQL já está configurada.")
else:
    print("AVISO: bloco de sessão não localizado.")

SERVER.write_text(src, encoding="utf-8")

# ============================================================
# 5. Garantir package.json
# ============================================================

if PACKAGE.exists():
    pkg = json.loads(PACKAGE.read_text(encoding="utf-8"))

    deps = pkg.setdefault("dependencies", {})
    deps["connect-pg-simple"] = "^10.0.0"

    scripts = pkg.setdefault("scripts", {})
    scripts["start"] = "node bootstrap.js"

    PACKAGE.write_text(
        json.dumps(pkg, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )

    print("OK: package.json confirmado.")

print()
print("==============================================")
print(" CORREÇÃO CONCLUÍDA")
print("==============================================")
print()
print("Agora:")
print("1. bootstrap.js restaura ANTES do SQLite abrir.")
print("2. server.js NÃO faz mais restore tardio.")
print("3. POST/PUT/PATCH/DELETE acionam backup automático.")
print("4. PostgreSQL guarda o SQLite.")
print("5. SESSION usa PostgreSQL.")
print("6. npm start continua usando bootstrap.js.")
print()
print("AINDA NÃO FAÇA DEPLOY.")
