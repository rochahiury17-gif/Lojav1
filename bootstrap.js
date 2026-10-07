const fs = require("fs");
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
