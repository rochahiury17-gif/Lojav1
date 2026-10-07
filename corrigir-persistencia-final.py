from pathlib import Path
from datetime import datetime
import shutil
import json
import re

ROOT = Path.cwd()
SERVER = ROOT / "server.js"
PACKAGE = ROOT / "package.json"
BOOTSTRAP = ROOT / "bootstrap.js"

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

backups = []

for original in [SERVER, PACKAGE]:
    if original.exists():
        backup = ROOT / f"{original.name}.backup-persistencia-final-{stamp}"
        shutil.copy2(original, backup)
        backups.append(backup)
        print(f"BACKUP: {backup.name}")

if BOOTSTRAP.exists():
    backup = ROOT / f"bootstrap.js.backup-persistencia-final-{stamp}"
    shutil.copy2(BOOTSTRAP, backup)
    backups.append(backup)
    print(f"BACKUP: {backup.name}")

print()

# ============================================================
# SERVER.JS
# ============================================================

src = SERVER.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Corrigir import do PostgreSQL para ter Pool
# ------------------------------------------------------------

old_pg = "const { Client: PgClient } = require('pg');"

new_pg = """const { Client: PgClient, Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('dpg-')
        ? false
        : { rejectUnauthorized: false }
    })
  : null;"""

if old_pg in src:
    src = src.replace(old_pg, new_pg, 1)
    print("OK: Pool PostgreSQL adicionado.")
elif "const { Client: PgClient, Pool }" in src and "const pool =" in src:
    print("OK: Pool PostgreSQL já existe.")
else:
    raise SystemExit(
        "ERRO: não consegui localizar com segurança o import do pg. "
        "Nenhuma alteração adicional foi salva."
    )

# ------------------------------------------------------------
# 2. Corrigir sessão PostgreSQL
# ------------------------------------------------------------

session_pattern = re.compile(
    r'app\.use\(session\(\{.*?\}\)\);',
    re.S
)

session_match = session_pattern.search(src)

if not session_match:
    raise SystemExit(
        "ERRO: bloco express-session não encontrado. "
        "Nenhuma alteração adicional foi salva."
    )

session_block = session_match.group(0)

if "pgSession" not in session_block:
    new_session = """app.use(session({
  store: process.env.DATABASE_URL && pool
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
}));"""
    src = src[:session_match.start()] + new_session + src[session_match.end():]
    print("OK: sessão PostgreSQL configurada.")
else:
    # Garante que não tente usar pool inexistente
    session_block_fixed = session_block.replace(
        "store: process.env.DATABASE_URL",
        "store: process.env.DATABASE_URL && pool",
        1
    )

    if session_block_fixed != session_block:
        src = (
            src[:session_match.start()]
            + session_block_fixed
            + src[session_match.end():]
        )
        print("OK: proteção do session store corrigida.")
    else:
        print("OK: sessão PostgreSQL já estava configurada.")

SERVER.write_text(src, encoding="utf-8")

# ============================================================
# BOOTSTRAP
# ============================================================

bootstrap = r'''const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, "data");

const DB_FILE = path.join(DATA_DIR, "loja.sqlite");
const WAL_FILE = DB_FILE + "-wal";
const SHM_FILE = DB_FILE + "-shm";

fs.mkdirSync(DATA_DIR, { recursive: true });

async function restoreSQLite() {
  if (!process.env.DATABASE_URL) {
    console.log("[BOOTSTRAP] DATABASE_URL não configurada.");
    console.log("[BOOTSTRAP] Iniciando com o SQLite local.");
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("dpg-")
      ? false
      : { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS sqlite_backups (
        id INT PRIMARY KEY,
        data BYTEA,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const result = await client.query(
      "SELECT data, updated_at FROM sqlite_backups WHERE id = 1"
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].data ||
      result.rows[0].data.length === 0
    ) {
      console.log("[BOOTSTRAP] Nenhum backup SQLite encontrado no PostgreSQL.");
      console.log("[BOOTSTRAP] O banco local atual será mantido.");
      return;
    }

    const data = result.rows[0].data;

    // O SQLite não deve iniciar com WAL/SHM antigos junto
    // de um arquivo restaurado de outra execução.
    try {
      if (fs.existsSync(WAL_FILE)) fs.unlinkSync(WAL_FILE);
    } catch (e) {}

    try {
      if (fs.existsSync(SHM_FILE)) fs.unlinkSync(SHM_FILE);
    } catch (e) {}

    const tempFile = DB_FILE + ".restore.tmp";

    fs.writeFileSync(tempFile, data);
    fs.renameSync(tempFile, DB_FILE);

    console.log(
      "[BOOTSTRAP] SQLite restaurado do PostgreSQL com sucesso."
    );

    console.log(
      "[BOOTSTRAP] Backup atualizado em:",
      result.rows[0].updated_at
    );

    console.log(
      "[BOOTSTRAP] Tamanho restaurado:",
      Math.round(data.length / 1024 / 1024 * 100) / 100,
      "MB"
    );

  } catch (error) {
    console.error(
      "[BOOTSTRAP] ERRO ao restaurar SQLite:",
      error.message
    );

    console.error(
      "[BOOTSTRAP] O servidor continuará usando o SQLite local."
    );

  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}

restoreSQLite()
  .then(() => {
    console.log("[BOOTSTRAP] Iniciando Machado Express...");
    require("./server.js");
  })
  .catch((error) => {
    console.error("[BOOTSTRAP] Erro inesperado:", error);
    process.exit(1);
  });
'''

BOOTSTRAP.write_text(bootstrap, encoding="utf-8")

print("OK: bootstrap.js criado.")

# ============================================================
# PACKAGE.JSON
# ============================================================

if PACKAGE.exists():
    pkg = json.loads(PACKAGE.read_text(encoding="utf-8"))

    deps = pkg.setdefault("dependencies", {})

    if "connect-pg-simple" not in deps:
        deps["connect-pg-simple"] = "^10.0.0"

    scripts = pkg.setdefault("scripts", {})
    scripts["start"] = "node bootstrap.js"

    PACKAGE.write_text(
        json.dumps(pkg, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )

    print("OK: package.json atualizado.")
    print("OK: start agora usa bootstrap.js.")

print()
print("==============================================")
print(" ALTERAÇÃO AUTOMÁTICA CONCLUÍDA")
print("==============================================")
print()
print("Arquivos principais:")
print("  server.js")
print("  bootstrap.js")
print("  package.json")
print()
print("Backups criados:")
for backup in backups:
    print(" ", backup.name)

print()
print("IMPORTANTE:")
print("O bootstrap restaura o SQLite ANTES do server.js abrir o banco.")
print("Isso é necessário porque o Render possui filesystem efêmero.")
print()
print("AINDA NÃO FAÇA DEPLOY.")
print("O próximo passo é instalar a dependência e testar localmente.")
