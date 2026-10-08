const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const util = require("util");
const execFileAsync = util.promisify(execFile);

const app = express();

const { Client: PgClient, Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('dpg-')
        ? false
        : { rejectUnauthorized: false }
    })
  : null;

async function syncPg(action) {
  try {
    const client = new PgClient({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('dpg-') ? false : { rejectUnauthorized: false }
    });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS sqlite_backups (
        id INT PRIMARY KEY,
        data BYTEA,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    if (action === 'restore') {
      const res = await client.query('SELECT data FROM sqlite_backups WHERE id = 1');
      if (res.rows.length > 0 && res.rows[0].data && res.rows[0].data.length > 0) {
        fs.writeFileSync(path.join(DATA_DIR, 'loja.sqlite'), res.rows[0].data);
        console.log('[PostgreSQL] Banco restaurado do PostgreSQL com sucesso!');
      }
    } else if (action === 'save') {
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch(e) {}
      const dbFile = path.join(DATA_DIR, 'loja.sqlite');
      if (fs.existsSync(dbFile)) {
        const data = fs.readFileSync(dbFile);
        await client.query('INSERT INTO sqlite_backups (id, data, updated_at) VALUES (1, $1, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = CURRENT_TIMESTAMP;', [data]);
        console.log('[PostgreSQL] Banco salvo com sucesso no PostgreSQL!');
      }
    }
    await client.end();
  } catch(e) {
    console.error('[PostgreSQL] Aviso sincronização:', e.message);
  }
}

let syncTimeout = null;
function schedulePgSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => syncPg('save'), 1500);
}

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, "public", "posts"), { recursive: true });
fs.mkdirSync(path.join(__dirname, "public", "templates"), { recursive: true });
fs.mkdirSync(path.join(__dirname, "public", "uploads"), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "loja.sqlite"));

try {
  db.exec("ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;");
  db.exec("UPDATE products SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL;");
} catch(e) {}
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// Migracao das colunas necessarias

try {
  db.exec("ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;");
  db.exec("UPDATE products SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL;");
} catch(e) {}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer',
 phone TEXT DEFAULT '',
 cpf TEXT DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS addresses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 label TEXT DEFAULT 'Principal',
 cep TEXT, street TEXT, number TEXT, complement TEXT, neighborhood TEXT,
 city TEXT, state TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS categories (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 slug TEXT NOT NULL UNIQUE,
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS suppliers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 contact TEXT DEFAULT '',
 url TEXT DEFAULT '',
 notes TEXT DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 category_id INTEGER,
 supplier_id INTEGER,
 name TEXT NOT NULL,
 slug TEXT NOT NULL UNIQUE,
 description TEXT DEFAULT '',
 image TEXT DEFAULT '',
 sku TEXT DEFAULT '',
 price REAL NOT NULL DEFAULT 0,
 cost REAL NOT NULL DEFAULT 0,
 stock INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1,
 featured INTEGER NOT NULL DEFAULT 0,
 sort_order INTEGER DEFAULT 0,
 images TEXT DEFAULT '[]',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
 FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 payment_method TEXT DEFAULT 'pix',
 payment_status TEXT NOT NULL DEFAULT 'pending',
 subtotal REAL NOT NULL DEFAULT 0,
 shipping REAL NOT NULL DEFAULT 0,
 discount REAL NOT NULL DEFAULT 0,
 total REAL NOT NULL DEFAULT 0,
 tracking TEXT DEFAULT '',
 notes TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL,
 product_id INTEGER,
 name TEXT NOT NULL,
 price REAL NOT NULL,
 quantity INTEGER NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
 FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS coupons (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE,
 type TEXT NOT NULL DEFAULT 'percent',
 value REAL NOT NULL DEFAULT 0,
 min_total REAL NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1,
 expires_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER,
 action TEXT NOT NULL,
 details TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
`);

// Migracoes de seguranca para bancos existentes
try { db.exec("ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;"); } catch(e) {}
try { db.exec("ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]';"); } catch(e) {}
try { db.exec("UPDATE products SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL;"); } catch(e) {}

db.exec(`CREATE TABLE IF NOT EXISTS order_stock_deductions (order_id INTEGER PRIMARY KEY, deducted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS order_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  sender_role TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);


// PERSISTENCIA DE CONFIGURACOES EM ARQUIVO
const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");
function loadSavedSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      const ins = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
      for (const [k, v] of Object.entries(saved)) ins.run(k, String(v));
    }
  } catch(e) {}
}
loadSavedSettings();

const defaults = {
 store_name: "MachadoExpress",
  banner_image: "",
  banner_title: "Tecnologia que combina com você.",
  banner_subtitle: "Descubra produtos selecionados, ofertas e novidades em um só lugar.",
  banner_button: "Explorar produtos",
 store_description: "Sua MachadoExpress completa",
 store_phone: "5551981884111",
 store_whatsapp: "5551981884111",
 store_email: "contato@loja.local",
 store_currency: "BRL",
 pix_key: "60075444003",
 pix_name: "MachadoExpress",
 pix_city: "Brasil",
 pix_discount: "0",
 free_shipping_min: "0",
 low_stock_threshold: "3",
 primary_color: "#7c3aed",
 footer_text: "© MachadoExpress - Todos os direitos reservados."
};
const setDefault = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
for (const [k,v] of Object.entries(defaults)) setDefault.run(k,v);

const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "";
if (process.env.NODE_ENV === "production" &&
    (!adminEmail || !adminPassword || !process.env.SESSION_SECRET)) {
  throw new Error("Configure ADMIN_EMAIL, ADMIN_PASSWORD e SESSION_SECRET no ambiente de produção.");
}
if (adminEmail && adminPassword) {
  const adminExists = db.prepare("SELECT id FROM users WHERE lower(trim(email))=?").get(adminEmail);
  if (!adminExists) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)")
      .run("Administrador", adminEmail, hash, "super_admin");
  }
}

// CONTA PRINCIPAL DO PROPRIETÁRIO — garante acesso administrativo no banco existente.
// Não altera a senha da conta; apenas corrige cargo/status quando a conta já existe.
const ownerEmail = adminEmail;
const owner = db.prepare("SELECT id,role,active FROM users WHERE lower(trim(email))=?").get(ownerEmail);
if (owner) {
  db.prepare("UPDATE users SET role='super_admin', active=1 WHERE id=?").run(owner.id);
}
if (!db.prepare("SELECT id FROM categories LIMIT 1").get()) {
  db.prepare("INSERT INTO categories(name,slug) VALUES(?,?)").run("Destaques","destaques");
  db.prepare("INSERT INTO categories(name,slug) VALUES(?,?)").run("Eletrônicos","eletronicos");
  db.prepare("INSERT INTO categories(name,slug) VALUES(?,?)").run("Casa","casa");
  // Produtos de exemplo desativados
}


// V8 ULTRA PACK — produtos de demonstração. Só cria uma vez e nunca apaga produtos do cliente.
const v8Demo=[
  ["Eletrônicos","Fone Pulse X","fone-pulse-x","Fone sem fio com visual premium, graves fortes e bateria para o dia todo.",189.90,1,"/demo/fone-pulse.svg",1,"V8-FONE-01"],
  ["Eletrônicos","Smartwatch Neo","smartwatch-neo","Tela vibrante, monitoramento diário e notificações no pulso.",249.90,1,"/demo/smartwatch-neo.svg",1,"V8-WATCH-02"],
  ["Eletrônicos","Teclado RGB Nova","teclado-rgb-nova","Teclado mecânico compacto com iluminação RGB e resposta rápida.",219.90,1,"/demo/teclado-rgb.svg",1,"V8-KEY-03"],
  ["Eletrônicos","Mouse Air Pro","mouse-air-pro","Mouse ergonômico, leve e preciso para trabalho e jogos.",119.90,0,"/demo/mouse-air.svg",1,"V8-MOUSE-04"],
  ["Eletrônicos","Power Bank 20K","power-bank-20k","Bateria portátil de alta capacidade para seus dispositivos.",149.90,0,"/demo/powerbank.svg",1,"V8-POWER-05"],
  ["Eletrônicos","Hub USB-C 8 em 1","hub-usbc-8em1","Expanda seu notebook com HDMI, USB, cartão e mais conexões.",159.90,1,"/demo/hub-usbc.svg",1,"V8-HUB-06"],
  ["Eletrônicos","Speaker Beat Mini","speaker-beat-mini","Som potente em um corpo compacto, perfeito para qualquer ambiente.",99.90,0,"/demo/speaker.svg",1,"V8-SOUND-07"],
  ["Eletrônicos","Webcam Vision HD","webcam-vision-hd","Imagem nítida para chamadas, aulas e criação de conteúdo.",139.90,0,"/demo/webcam.svg",1,"V8-CAM-08"],
  ["Eletrônicos","SSD Ultra 1TB","ssd-ultra-1tb","Armazenamento rápido de 1TB para acelerar seu computador.",329.90,1,"/demo/ssd.svg",1,"V8-SSD-09"],
  ["Eletrônicos","Carregador GaN 65W","carregador-gan-65w","Carregador compacto de alta potência para celular, tablet e notebook.",129.90,0,"/demo/carregador.svg",1,"V8-GAN-10"]
];
// v8Demo desativado

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET precisa ser configurada em produção.");
}
app.set("trust proxy", 1);
app.use(session({
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
}));
app.use(express.static(path.join(__dirname,"public")));

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



function setting(key){ return db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? ""; }

function normalizeWhatsApp(num) {
  if (!num) return "";
  let digits = String(num).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}

function settings(){ return Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(x=>[x.key,x.value])); }
function userSafe(u){ if(!u) return null; const {password,...safe}=u; return safe; }
function auth(req,res,next){ if(!req.session.userId) return res.status(401).json({error:"Faça login."}); next(); }
const ADMIN_ROLES = new Set(["super_admin","admin","gerente","atendente","financeiro"]);
const FULL_ADMIN_ROLES = new Set(["super_admin","admin"]);
const MANAGER_ROLES = new Set(["super_admin","admin","gerente"]);
function currentUser(req){
  return req.session.userId ? db.prepare("SELECT * FROM users WHERE id=? AND active=1").get(req.session.userId) : null;
}
function admin(req,res,next){
  if(!req.session.userId) return res.status(401).json({error:"Faça login para acessar o painel."});
  const u=currentUser(req);
  if(!u || !ADMIN_ROLES.has(u.role)) return res.status(403).json({error:"Acesso administrativo negado."});
  req.currentUser=u; next();
}
function fullAdmin(req,res,next){
  admin(req,res,()=> {
    if(!FULL_ADMIN_ROLES.has(req.currentUser.role)) return res.status(403).json({error:"Somente administradores podem realizar esta ação."});
    next();
  });
}
function manager(req,res,next){
  admin(req,res,()=> {
    if(!MANAGER_ROLES.has(req.currentUser.role)) return res.status(403).json({error:"Permissão de gerente necessária."});
    next();
  });
}
function audit(userId, action, details=""){ db.prepare("INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)").run(userId,action,details); }
function makeProductSlug(name, excludeId = null) {
  let base = slugify(name) || "produto";
  let slug = base;
  let counter = 1;
  while (true) {
    const row = excludeId
      ? db.prepare("SELECT id FROM products WHERE slug = ? AND id != ?").get(slug, excludeId)
      : db.prepare("SELECT id FROM products WHERE slug = ?").get(slug);
    if (!row) return slug;
    counter++;
    slug = base + "-" + counter;
  }
}
function slugify(s){ return String(s).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

app.get("/api/auth/session",(req,res)=>res.json({authenticated:!!req.session.userId,user:userSafe(currentUser(req))}));

app.get("/api/store", (req,res)=>res.json({settings:settings(), user:req.session.userId ? userSafe(db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId)) : null}));

app.post("/api/auth/register",(req,res)=>{
  const {name,email,password,phone,cpf}=req.body;
  if(!name || !email || !password || password.length<6) return res.status(400).json({error:"Nome, e-mail e senha (mínimo 6 caracteres) são obrigatórios."});
  try{
    const hash=bcrypt.hashSync(password,10);
    const normPhone = normalizeWhatsApp(phone); const r=db.prepare("INSERT INTO users(name,email,password,phone,cpf,role) VALUES(?,?,?,?,?,?)").run(name,email.toLowerCase(),hash,normPhone,cpf||"","customer");
    req.session.userId=r.lastInsertRowid;
    res.json({user:userSafe(db.prepare("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid))});
  }catch(e){res.status(400).json({error:"E-mail já cadastrado."});}
});
app.post("/api/auth/login",(req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE email=? AND active=1").get(String(req.body.email||"").toLowerCase());
  if(!u || !bcrypt.compareSync(req.body.password||"",u.password)) return res.status(401).json({error:"E-mail ou senha inválidos."});
  req.session.userId=u.id; res.json({user:userSafe(u)});
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/products",(req,res)=>{
  const q=String(req.query.q||"").trim();
  const cat=String(req.query.category||"").trim();
  let sql=`SELECT p.*, c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1`;
  const args=[];
  if(q){sql+=" AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)"; args.push(`%${q}%`,`%${q}%`,`%${q}%`);}
  if(cat){sql+=" AND c.slug=?";args.push(cat);}
  sql+=" ORDER BY p.featured DESC,p.id DESC";
  res.json(db.prepare(sql).all(...args));
});
app.get("/api/categories",(req,res)=>res.json(db.prepare("SELECT * FROM categories WHERE active=1 ORDER BY name").all()));

app.get("/api/me",auth,(req,res)=>{
  const u=userSafe(db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId));
  const addresses=db.prepare("SELECT * FROM addresses WHERE user_id=? ORDER BY id DESC").all(req.session.userId);
  const orders=db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC").all(req.session.userId);
  res.json({user:u,addresses,orders});
});
app.post("/api/me/profile",auth,(req,res)=>{
  const {name,phone,cpf}=req.body;
  db.prepare("UPDATE users SET name=?,phone=?,cpf=? WHERE id=?").run(name,phone||"",cpf||"",req.session.userId);
  res.json({ok:true});
});
app.post("/api/me/address",auth,(req,res)=>{
  const a=req.body;
  db.prepare(`INSERT INTO addresses(user_id,label,cep,street,number,complement,neighborhood,city,state)
              VALUES(?,?,?,?,?,?,?,?,?)`).run(req.session.userId,a.label||"Endereço",a.cep||"",a.street||"",a.number||"",a.complement||"",a.neighborhood||"",a.city||"",a.state||"");
  res.json({ok:true});
});
app.delete("/api/me/address/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM addresses WHERE id=? AND user_id=?").run(req.params.id,req.session.userId);res.json({ok:true});
});

app.post("/api/orders",auth,(req,res)=>{
  const items=Array.isArray(req.body.items)?req.body.items:[];
  if(!items.length) return res.status(400).json({error:"Carrinho vazio."});
  let subtotal=0, normalized=[];
  const get=db.prepare("SELECT * FROM products WHERE id=? AND active=1");
  for(const it of items){
    const p=get.get(it.product_id);
    const qty=Math.max(1,Math.min(999,Number(it.quantity)||1));
    if(!p) return res.status(400).json({error:"Produto não encontrado."});
    if(Number(p.stock)<=0) return res.status(400).json({error:`${p.name} está sem estoque no momento.`});
    if(qty>Number(p.stock)) return res.status(400).json({error:`Estoque insuficiente para ${p.name}. Disponível: ${p.stock}.`});
    subtotal+=p.price*qty;normalized.push({p,qty});
  }
  const freeMin=Number(setting("free_shipping_min")||0);
  const shipping=(freeMin&&subtotal>=freeMin)?0:(subtotal>0?10:0);
  const discount=req.body.discount?Number(req.body.discount):0;
  const total=Math.max(0,subtotal+shipping-discount);
  let address=null;
  if(req.body.address_id){
    address=db.prepare("SELECT * FROM addresses WHERE id=? AND user_id=?").get(Number(req.body.address_id),req.session.userId);
    if(!address)return res.status(400).json({error:"Selecione um endereço cadastrado na sua conta."});
  }else{
    const a=req.body.address||{};
    const required=["cep","number","street","neighborhood","city","state"];
    if(required.some(k=>!String(a[k]||"").trim()))return res.status(400).json({error:"Preencha CEP, rua, número, bairro, cidade e UF para a entrega."});
    address={label:"Endereço de entrega",cep:String(a.cep).trim(),street:String(a.street).trim(),number:String(a.number).trim(),complement:String(a.complement||"").trim(),neighborhood:String(a.neighborhood).trim(),city:String(a.city).trim(),state:String(a.state).trim().toUpperCase()};
  }
  // Atualizar CPF e telefone do usuario se informados no pedido
    try {
      const uPhone = req.body.phone ? normalizeWhatsApp(req.body.phone) : null;
      const uCpf = req.body.cpf ? String(req.body.cpf).trim() : null;
      if (uPhone || uCpf) {
        const cur = db.prepare("SELECT phone, cpf FROM users WHERE id=?").get(req.session.userId);
        if (cur) {
          const finalPhone = uPhone || cur.phone;
          const finalCpf = uCpf || cur.cpf;
          db.prepare("UPDATE users SET phone=?, cpf=? WHERE id=?").run(finalPhone, finalCpf, req.session.userId);
        }
      }
    } catch(e) {}
    let transactionOpen=false;
  try{
    db.exec("BEGIN IMMEDIATE");transactionOpen=true;
    if(!req.body.address_id){
      const a=address;
      const saved=db.prepare(`INSERT INTO addresses(user_id,label,cep,street,number,complement,neighborhood,city,state) VALUES(?,?,?,?,?,?,?,?,?)`)
        .run(req.session.userId,a.label,a.cep,a.street,a.number,a.complement,a.neighborhood,a.city,a.state);
      address={...a,id:saved.lastInsertRowid};
    }
    const info=db.prepare(`INSERT INTO orders(user_id,status,payment_method,payment_status,subtotal,shipping,discount,total,notes) VALUES(?,?,?,?,?,?,?,?,?)`)
      .run(req.session.userId,"pending",req.body.payment_method||"pix","pending",subtotal,shipping,discount,total,JSON.stringify({shipping_address:{id:address.id||null,label:address.label,cep:address.cep,street:address.street,number:address.number,complement:address.complement,neighborhood:address.neighborhood,city:address.city,state:address.state}}));
    const orderId=info.lastInsertRowid;
    const ins=db.prepare("INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(?,?,?,?,?)");
    for(const x of normalized)ins.run(orderId,x.p.id,x.p.name,x.p.price,x.qty);
    audit(req.session.userId,"order_created",`Pedido #${orderId}`);
    db.exec("COMMIT");transactionOpen=false;
    res.json({id:orderId,total,subtotal,shipping,status:"pending"});
  }catch(e){
    if(transactionOpen){try{db.exec("ROLLBACK")}catch(rollbackError){}}
    console.error("Erro ao criar pedido:",e);
    res.status(500).json({error:"Não foi possível concluir o pedido. Tente novamente."});
  }
});

app.get("/api/admin/stats",admin,(req,res)=>{
  const revenue=db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE payment_status='paid'").get().n;
  const orders=db.prepare("SELECT COUNT(*) n FROM orders").get().n;
  const customers=db.prepare("SELECT COUNT(*) n FROM users WHERE role='customer'").get().n;
  const products=db.prepare("SELECT COUNT(*) n FROM products").get().n;
  res.json({revenue,orders,customers,products});
});
app.get("/api/admin/orders",admin,(req,res)=>{
  const orders=db.prepare(`SELECT o.*,u.name customer_name,u.email customer_email,u.phone customer_phone
                           FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`).all();
  const getItems=db.prepare("SELECT name,price,quantity FROM order_items WHERE order_id=? ORDER BY id ASC");
  res.json(orders.map(o=>{
    let orderNotes={};
    try{orderNotes=JSON.parse(o.notes||"{}")}catch(e){}
    return {...o,shipping_address:orderNotes.shipping_address||null,items:getItems.all(o.id)};
  }));
});
app.patch("/api/admin/orders/:id",admin,(req,res)=>{
  const allowedStatus=["pending","paid","processing","shipped","delivered","cancelled","refunded"];
  const allowedPayment=["pending","paid","failed","refunded","cancelled"];
  const {status,payment_status,tracking}=req.body||{};
  if(status && !allowedStatus.includes(status)) return res.status(400).json({error:"Status do pedido inválido."});
  if(payment_status && !allowedPayment.includes(payment_status)) return res.status(400).json({error:"Status do pagamento inválido."});
  const orderId=Number(req.params.id);
  if(!Number.isInteger(orderId)||orderId<1) return res.status(400).json({error:"Número do pedido inválido."});
  let transactionOpen=false;
  try{
    db.exec("BEGIN IMMEDIATE"); transactionOpen=true;
    const order=db.prepare("SELECT id,payment_status FROM orders WHERE id=?").get(orderId);
    if(!order){
      db.exec("ROLLBACK"); transactionOpen=false;
      return res.status(404).json({error:"Pedido não encontrado."});
    }
    const markingPaid=payment_status==="paid"&&order.payment_status!=="paid";
    if(markingPaid){
      const alreadyDeducted=db.prepare("SELECT order_id FROM order_stock_deductions WHERE order_id=?").get(orderId);
      if(!alreadyDeducted){
        const lines=db.prepare("SELECT product_id,SUM(quantity) quantity FROM order_items WHERE order_id=? GROUP BY product_id").all(orderId);
        if(!lines.length){
          db.exec("ROLLBACK"); transactionOpen=false;
          return res.status(400).json({error:"Este pedido não tem produtos registrados; o pagamento não foi alterado."});
        }
        const getProduct=db.prepare("SELECT name,stock FROM products WHERE id=?");
        for(const line of lines){
          if(!line.product_id){
            db.exec("ROLLBACK"); transactionOpen=false;
            return res.status(400).json({error:"Um produto deste pedido não está mais cadastrado; o pagamento não foi alterado."});
          }
          const product=getProduct.get(line.product_id);
          if(!product){
            db.exec("ROLLBACK"); transactionOpen=false;
            return res.status(400).json({error:"Não encontrei um produto do pedido; o pagamento não foi alterado."});
          }
          if(Number(product.stock)<Number(line.quantity)){
            db.exec("ROLLBACK"); transactionOpen=false;
            return res.status(400).json({error:`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}; pedido: ${line.quantity}. O pagamento não foi alterado.`});
          }
        }
        const reduce=db.prepare("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?");
        for(const line of lines){
          const result=reduce.run(Number(line.quantity),line.product_id,Number(line.quantity));
          if(!result.changes) throw new Error("O estoque mudou durante a baixa; tente novamente.");
        }
        db.prepare("INSERT INTO order_stock_deductions(order_id) VALUES(?)").run(orderId);
      }
    }
    db.prepare("UPDATE orders SET status=COALESCE(?,status),payment_status=COALESCE(?,payment_status),tracking=COALESCE(?,tracking) WHERE id=?")
      .run(status||null,payment_status||null,tracking||null,orderId);
    audit(req.currentUser.id,"order_updated",`Pedido #${orderId}`);
    db.exec("COMMIT"); transactionOpen=false;
    res.json({ok:true,stock_deducted:markingPaid});
  }catch(e){
    if(transactionOpen){try{db.exec("ROLLBACK")}catch(rollbackError){}}
    console.error("Erro ao atualizar pedido:",e);
    res.status(500).json({error:e.message||"Não foi possível atualizar o pedido."});
  }
});
app.post("/api/admin/upload-image", manager, (req,res)=>{
  try {
    const {data,name="imagem"}=req.body||{};
    if(!data || typeof data!=="string" || !data.startsWith("data:image/")) return res.status(400).json({error:"Envie uma imagem válida."});
    const m=data.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
    if(!m) return res.status(400).json({error:"Formato de imagem não suportado."});
    const ext=m[1].toLowerCase()==="jpeg"?"jpg":m[1].toLowerCase();
    const safe=String(name).replace(/[^a-z0-9_-]+/gi,"-").slice(0,50)||"imagem";
    const file=`${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}.${ext}`;
    fs.writeFileSync(path.join(__dirname,"public","uploads",file),Buffer.from(m[2],"base64"));
    res.json({ok:true,url:`/uploads/${file}`});
  } catch(e) { res.status(400).json({error:"Não foi possível salvar a imagem."}); }
});


// EXPORTAR E IMPORTAR PRODUTOS (BACKUP E RESTAURACAO)
app.get("/api/admin/products/export", admin, (req, res) => {
  try {
    const prods = db.prepare("SELECT * FROM products ORDER BY id ASC").all();
    res.setHeader("Content-Disposition", "attachment; filename=produtos-backup.json");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(prods, null, 2));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/products/import", admin, (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body && req.body.products ? req.body.products : []);
    if (!list.length) return res.status(400).json({ error: "Nenhum produto encontrado no arquivo." });
    
    let count = 0;
    const catCheck = db.prepare("SELECT id FROM categories WHERE id = ?");
    const supCheck = db.prepare("SELECT id FROM suppliers WHERE id = ?");
    const insertStmt = db.prepare(`
      INSERT INTO products (category_id, supplier_id, name, slug, description, image, images, sku, price, cost, stock, active, featured, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    
    for (const p of list) {
      if (!p.name) continue;
      
      let catId = p.category_id ? Number(p.category_id) : null;
      if (catId && !catCheck.get(catId)) catId = null;
      
      let supId = p.supplier_id ? Number(p.supplier_id) : null;
      if (supId && !supCheck.get(supId)) supId = null;

      let baseSlug = String(p.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produto";
      let slug = baseSlug;
      let suffix = 2;
      while (db.prepare("SELECT id FROM products WHERE slug = ?").get(slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }
      const imgs = typeof p.images === "string" ? p.images : JSON.stringify(p.images || (p.image ? [p.image] : []));
      const mainImg = p.image || (Array.isArray(p.images) && p.images[0]) || "";
      
      insertStmt.run(
        catId,
        supId,
        p.name,
        slug,
        p.description || "",
        mainImg,
        imgs,
        p.sku || "",
        Number(p.price) || 0,
        Number(p.cost) || 0,
        Number(p.stock) || 0,
        p.active === 0 ? 0 : 1,
        p.featured ? 1 : 0,
        Number(p.sort_order) || 0
      );
      count++;
    }
    schedulePgSync(); // hook_import
    res.json({ ok: true, imported: count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/products",admin,(req,res)=>res.json(db.prepare("SELECT * FROM products ORDER BY sort_order ASC, id DESC").all()));
app.post("/api/admin/products",manager,(req,res)=>{
  const p=req.body;
  try{
    const slug=makeProductSlug(p.name);
    let imagesArr = Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []);
    if(p.image && !imagesArr.includes(p.image)) imagesArr.unshift(p.image);
    const mainImage = imagesArr.length > 0 ? imagesArr[0] : (p.image || "");
    const imagesJson = JSON.stringify(imagesArr);
    
    const info=db.prepare(`INSERT INTO products (category_id,supplier_id,name,slug,description,image,images,sku,price,cost,stock,active,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM products))`)
      .run(p.category_id||null,p.supplier_id||null,p.name,slug,p.description||"",mainImage,imagesJson,p.sku||"",Number(p.price)||0,Number(p.cost)||0,Number(p.stock)||0,p.active===0?0:1,p.featured?1:0);
    res.json({ok:true,id:info.lastInsertRowid});
  }catch(e){
    console.error("Erro criar produto:", e);
    res.status(400).json({error:e.message});
  }
});
app.put("/api/admin/products/:id",manager,(req,res)=>{
  req.method="PATCH";
  app._router.handle(req,res);
});
app.patch("/api/admin/products/:id",manager,(req,res)=>{
  const p=req.body;
  try{
    const slug = makeProductSlug(p.name || (`produto-${req.params.id}`), req.params.id);
    let imagesArr = Array.isArray(p.images) ? p.images : [];
    if(p.image && !imagesArr.includes(p.image)) imagesArr.unshift(p.image);
    const mainImage = imagesArr.length > 0 ? imagesArr[0] : (p.image || "");
    const imagesJson = JSON.stringify(imagesArr);

    db.prepare(`UPDATE products SET category_id=?,supplier_id=?,name=?,slug=?,description=?,image=?,images=?,sku=?,price=?,cost=?,stock=?,active=?,featured=? WHERE id=?`)
      .run(p.category_id||null, p.supplier_id||null, p.name, slug, p.description||"", mainImage, imagesJson, p.sku||"", Number(p.price)||0, Number(p.cost)||0, Number(p.stock)||0, (p.active===false||p.active===0||p.active==="0")?0:1, (p.featured===true||p.featured===1||p.featured==="1")?1:0, req.params.id);
    res.json({ok:true});
  }catch(e){
    console.error("Erro update produto:", e);
    res.status(400).json({error: e.message});
  }
});
app.delete("/api/admin/products/:id",manager,(req,res)=>{db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);res.json({ok:true});});


// Exclusao individual de pedido (Admin)
app.delete("/api/admin/orders/:id", admin, (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "Numero do pedido invalido." });
  let tOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE"); tOpen = true;
    const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
    if (!order) { db.exec("ROLLBACK"); tOpen = false; return res.status(404).json({ error: "Pedido nao encontrado." }); }
    try { db.prepare("DELETE FROM order_stock_deductions WHERE order_id = ?").run(orderId); } catch(e) {}
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
    db.exec("COMMIT"); tOpen = false;
    if (typeof schedulePgBackup === "function") schedulePgBackup("admin delete order #" + orderId);
    return res.json({ success: true, message: "Pedido #" + orderId + " excluido com sucesso." });
  } catch(err) {
    if (tOpen) try { db.exec("ROLLBACK"); } catch(e) {}
    console.error("Erro ao excluir pedido:", err);
    return res.status(500).json({ error: "Nao foi possivel excluir o pedido." });
  }
});

// Exclusao em massa de pedidos (Admin)
app.post("/api/admin/orders/bulk-delete", admin, (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
  if (!ids.length) return res.status(400).json({ error: "Nenhum pedido valido selecionado." });
  let tOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE"); tOpen = true;
    const delDed = db.prepare("DELETE FROM order_stock_deductions WHERE order_id = ?");
    const delItems = db.prepare("DELETE FROM order_items WHERE order_id = ?");
    const delOrder = db.prepare("DELETE FROM orders WHERE id = ?");
    let deletedCount = 0;
    for (const id of ids) {
      try { delDed.run(id); } catch(e) {}
      delItems.run(id);
      if (delOrder.run(id).changes > 0) deletedCount++;
    }
    db.exec("COMMIT"); tOpen = false;
    if (typeof schedulePgBackup === "function") schedulePgBackup("admin bulk delete " + deletedCount + " orders");
    return res.json({ success: true, deletedCount, message: deletedCount + " pedido(s) excluido(s) com sucesso." });
  } catch(err) {
    if (tOpen) try { db.exec("ROLLBACK"); } catch(e) {}
    console.error("Erro na exclusao em massa:", err);
    return res.status(500).json({ error: "Nao foi possivel excluir os pedidos selecionados." });
  }
});


// Buscar historico de pedidos de um cliente especifico (Admin)
app.get("/api/admin/customers/:id/orders", admin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: "ID de cliente invalido." });
  try {
    const orders = db.prepare(`SELECT id, status, payment_status, payment_method, total, created_at, tracking FROM orders WHERE user_id = ? ORDER BY id DESC`).all(userId);
    res.json(orders);
  } catch(e) {
    res.status(500).json({ error: "Erro ao buscar pedidos do cliente." });
  }
});

app.get("/api/admin/customers", admin, (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id, u.name, u.email, u.phone, u.cpf, u.active, u.created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = u.id) as total_spent,
        (SELECT street || ', nº ' || number || (CASE WHEN complement IS NOT NULL AND complement != '' THEN ' (' || complement || ')' ELSE '' END) || ' - ' || neighborhood || ', ' || city || '/' || state || ' - CEP: ' || cep 
         FROM addresses WHERE user_id = u.id ORDER BY id DESC LIMIT 1) as full_address
      FROM users u
      WHERE u.role = 'customer'
      ORDER BY u.id DESC
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/admin/users",admin,(req,res)=>res.json(db.prepare(`SELECT id,name,email,phone,role,active,created_at FROM users WHERE role!='customer' ORDER BY id DESC`).all()));
app.post("/api/admin/users",fullAdmin,(req,res)=>{
  const {name,email,password,phone,role}=req.body;
  const allowedRoles=["atendente","gerente","admin","financeiro"];
  if(!name||!email||!password||!role)return res.status(400).json({error:"Preencha os campos."});
  if(!allowedRoles.includes(role)) return res.status(400).json({error:"Cargo inválido."});
  try{
    const r=db.prepare("INSERT INTO users(name,email,password,phone,role) VALUES(?,?,?,?,?)").run(name,email,bcrypt.hashSync(password,10),phone||"",role);
    audit(req.currentUser.id,"staff_created",`Usuário #${r.lastInsertRowid}`);res.json({id:r.lastInsertRowid});
  }catch(e){res.status(400).json({error:"E-mail já existe."});}
});
app.patch("/api/admin/users/:id",fullAdmin,(req,res)=>{
  if(Number(req.params.id)===Number(req.currentUser.id) && !req.body.active)
    return res.status(400).json({error:"Você não pode desativar sua própria conta."});
  const role=["super_admin","admin","gerente","atendente","financeiro"].includes(req.body.role) ? req.body.role : "atendente";
  db.prepare("UPDATE users SET role=?,active=? WHERE id=?").run(role,req.body.active?1:0,req.params.id);
  audit(req.currentUser.id,"staff_updated",`Usuário #${req.params.id}`);
  res.json({ok:true});
});
app.get("/api/admin/categories",admin,(req,res)=>res.json(db.prepare("SELECT * FROM categories ORDER BY name").all()));
app.post("/api/admin/categories",manager,(req,res)=>{
  try{const r=db.prepare("INSERT INTO categories(name,slug) VALUES(?,?)").run(req.body.name,slugify(req.body.slug||req.body.name));res.json({id:r.lastInsertRowid});}
  catch(e){res.status(400).json({error:"Categoria já existe."});}
});
app.get("/api/admin/suppliers",admin,(req,res)=>res.json(db.prepare("SELECT * FROM suppliers ORDER BY id DESC").all()));
app.post("/api/admin/suppliers",manager,(req,res)=>{
  const r=db.prepare("INSERT INTO suppliers(name,contact,url,notes) VALUES(?,?,?,?)").run(req.body.name,req.body.contact||"",req.body.url||"",req.body.notes||"");res.json({id:r.lastInsertRowid});
});
app.get("/api/admin/settings",admin,(req,res)=>res.json(settings()));
app.patch("/api/admin/settings", admin, (req, res) => {
  const update = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [k, v] of Object.entries(req.body || {})) {
      update.run(k, String(v));
    }
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch (_) {}
    return res.status(500).json({ error: e.message });
  }

  try {
    const current = settings();
    fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), "utf8");
  } catch(e) {}

  audit(req.currentUser.id, "settings_updated", "Configurações da loja atualizadas");
    schedulePgSync(); // hook_settings
  res.json({ ok: true });
});
app.get("/api/admin/posts", admin, (req,res)=>{
  const rows=db.prepare(`SELECT p.id,p.name,p.price,p.image,p.created_at,
    (SELECT value FROM settings WHERE key='store_name') store_name
    FROM products p ORDER BY p.id DESC`).all();
  res.json(rows);
});

app.post("/api/admin/posts/remove-bg", manager, async (req,res)=>{
  try {
    const raw = req.body && (req.body.image_data || req.body.image);
    const match = typeof raw === "string" && raw.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return res.status(400).json({error:"A foto precisa ser PNG, JPG ou WebP."});
    const bytes = Buffer.from(match[2].replace(/\s/g,""), "base64");
    if (!bytes.length) return res.status(400).json({error:"A foto selecionada está vazia."});
    if (bytes.length > 40 * 1024 * 1024) return res.status(413).json({error:"A foto ficou muito grande. Escolha uma imagem menor que 40 MB."});
    let apiKey = "";
    try { apiKey = fs.readFileSync(path.join(__dirname, ".removebg-key"), "utf8").trim(); } catch(_) {}
    if (!apiKey) apiKey = String(process.env.REMOVE_BG_API_KEY || "").trim();
    if (!apiKey) return res.status(503).json({error:"Não encontrei a chave remove.bg. Confira o arquivo .removebg-key na pasta da loja."});
    const mime = /^png$/i.test(match[1]) ? "image/png" : (/^webp$/i.test(match[1]) ? "image/webp" : "image/jpeg");
    const ext = mime === "image/png" ? "png" : (mime === "image/webp" ? "webp" : "jpg");
    const form = new FormData();
    form.append("image_file", new Blob([bytes], {type:mime}), "produto." + ext);
    form.append("size", "auto");
    const upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method:"POST", headers:{"X-Api-Key":apiKey}, body:form
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      let detail = "";
      try { const parsed = JSON.parse(text); detail = parsed.errors?.map(x=>x.title || x.detail || x.code).filter(Boolean).join("; ") || parsed.error || ""; } catch(_) {}
      if (upstream.status === 402) return res.status(502).json({error:"A conta remove.bg está sem créditos disponíveis. Confira o saldo/plano da API."});
      if (upstream.status === 403) return res.status(502).json({error:"A API Key foi recusada pelo remove.bg. Confira a chave configurada, sem enviá-la no chat."});
      if (upstream.status === 429) return res.status(502).json({error:"O limite de requisições do remove.bg foi atingido. Aguarde e tente novamente."});
      return res.status(502).json({error:"remove.bg não conseguiu recortar esta foto" + (detail ? ": " + String(detail).slice(0,220) : ".")});
    }
    const output = Buffer.from(await upstream.arrayBuffer());
    if (!output.length) return res.status(502).json({error:"remove.bg retornou uma imagem vazia."});
    const imageData = "data:image/png;base64," + output.toString("base64");
    res.json({ok:true,image_data:imageData,image:imageData});
  } catch(e) {
    console.error("Falha no recorte remove.bg:", e.message);
    res.status(502).json({error:"Falha ao chamar o remove.bg. Confira a conexão com a internet e tente novamente."});
  }
});

app.post("/api/admin/posts/generate/:id", manager, async (req,res)=>{
  try {
    const product=db.prepare("SELECT id,name,price,image FROM products WHERE id=?").get(req.params.id);
    if(!product) return res.status(404).json({error:"Produto não encontrado."});
    const usedCustomImage = typeof req.body?.custom_image === "string" && req.body.custom_image.startsWith("data:image/");
    if (req.body?.custom_image && !usedCustomImage) return res.status(400).json({error:"A foto escolhida chegou em formato inválido."});
    if (usedCustomImage) product.image = req.body.custom_image;
    if (usedCustomImage && Number.isFinite(Number(req.body?.position_x)) && Number.isFinite(Number(req.body?.position_y))) {
      product.position_x = Number(req.body.position_x);
      product.position_y = Number(req.body.position_y);
      product.product_scale = Number(req.body.product_scale);
      product.product_rotation = Number(req.body.product_rotation);
    }
    const py=process.env.PYTHON || "python3";
    const payload=JSON.stringify(product);
    const tmpFile = path.join(__dirname, "tmp", `post_${product.id}_${Date.now()}.json`);
    await fs.promises.writeFile(tmpFile, payload, "utf8");
    let stdout;
    try {
      const resExec = await execFileAsync(py, [path.join(__dirname, "tools", "gerar_post.py"), tmpFile], {timeout: 60000, maxBuffer: 10*1024*1024});
      stdout = resExec.stdout;
    } finally {
      try { await fs.promises.unlink(tmpFile); } catch(_) {}
    }
    const result=JSON.parse(stdout.trim());
    if(!result.ok) throw new Error(result.error||"Não foi possível gerar o post.");
    audit(req.currentUser.id,"generate_post",`Produto #${product.id} — ${product.name}`);
    result.used_custom_image = usedCustomImage;
    res.json({
      ...result,
      used_custom_image: Boolean(req.body && req.body.custom_image)
    });
  } catch(e) {
    res.status(500).json({error:`Falha ao gerar post: ${e.message}`});
  }
});

/* MACHADO_REMOVE_BG_API_V1 */
const https = require("https");
function removeBgApiKey(){
  if(process.env.REMOVEBG_API_KEY) return String(process.env.REMOVEBG_API_KEY).trim();
  try { return fs.readFileSync(path.join(__dirname,".removebg-key"),"utf8").trim(); } catch(e) { return ""; }
}
function removeBgRequest(dataUrl){
  return new Promise((resolve,reject)=>{
    const match=String(dataUrl||"").match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if(!match) return reject(new Error("A imagem precisa estar em PNG, JPG ou WebP."));
    const key=removeBgApiKey();
    if(!key) return reject(new Error("Falta configurar a chave remove.bg no Termux."));
    const bytes=Buffer.from(match[2],"base64");
    if(!bytes.length || bytes.length>15*1024*1024) return reject(new Error("A foto está vazia ou passa de 15 MB. Escolha uma imagem menor."));
    const boundary="----MachadoRemoveBg"+require("crypto").randomBytes(12).toString("hex");
    const mime=match[1].toLowerCase().replace("jpg","jpeg");
    const filePart=Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image_file"; filename="produto.${mime==='jpeg'?'jpg':mime}"\r\nContent-Type: image/${mime}\r\n\r\n`),bytes,Buffer.from("\r\n")
    ]);
    const tail=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\nauto\r\n--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\nproduct\r\n--${boundary}--\r\n`);
    const body=Buffer.concat([filePart,tail]);
    const request=https.request({hostname:"api.remove.bg",path:"/v1.0/removebg",method:"POST",headers:{"X-Api-Key":key,"Content-Type":`multipart/form-data; boundary=${boundary}`,"Content-Length":body.length}},response=>{
      const chunks=[];let total=0;
      response.on("data",chunk=>{total+=chunk.length;if(total>25*1024*1024){request.destroy(new Error("A imagem recortada ficou grande demais."));return;}chunks.push(chunk);});
      response.on("end",()=>{
        const result=Buffer.concat(chunks);
        if(response.statusCode<200||response.statusCode>=300){let detail="O remove.bg recusou a imagem.";try{const j=JSON.parse(result.toString("utf8"));detail=j.errors?.[0]?.title||j.errors?.[0]?.detail||j.error||detail;}catch(e){} return reject(new Error(`${detail} (código ${response.statusCode})`));}
        resolve("data:image/png;base64,"+result.toString("base64"));
      });
    });
    request.setTimeout(90000,()=>request.destroy(new Error("O recorte demorou demais. Tente uma foto menor ou novamente.")));
    request.on("error",reject);request.end(body);
  });
}
app.post("/api/admin/posts/remove-bg",manager,async(req,res)=>{
  try{
    const image=await removeBgRequest(req.body?.image);
    res.json({ok:true,image});
  }catch(e){res.status(400).json({ok:false,error:e.message||"Não foi possível recortar o fundo."});}
});

app.get("/api/admin/logs",admin,(req,res)=>res.json(db.prepare(`SELECT l.*,u.name user_name FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 200`).all()));
// ROTAS DE CHAT E SUPORTE DO PEDIDO (COM PERSISTÊNCIA PG)
app.get("/api/orders/:id/messages", auth, (req, res) => {
  try {
    const u = currentUser(req);
    const orderId = Number(req.params.id);
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    const isAdmin = ADMIN_ROLES.has(u.role);
    if (!isAdmin && order.user_id !== u.id) return res.status(403).json({ error: "Acesso negado." });
    const msgs = db.prepare("SELECT * FROM order_messages WHERE order_id=? ORDER BY id ASC").all(orderId);
    res.json({ order, messages: msgs });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders/:id/messages", auth, (req, res) => {
  try {
    const u = currentUser(req);
    const orderId = Number(req.params.id);
    const msg = (req.body.message || "").trim();
    if (!msg) return res.status(400).json({ error: "Mensagem vazia." });
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    const isAdmin = ADMIN_ROLES.has(u.role);
    if (!isAdmin && order.user_id !== u.id) return res.status(403).json({ error: "Acesso negado." });
    const role = isAdmin ? "admin" : "customer";
    const name = u.name || (isAdmin ? "Suporte" : "Cliente");
    const ins = db.prepare("INSERT INTO order_messages (order_id, sender_role, sender_name, message) VALUES (?, ?, ?, ?)").run(orderId, role, name, msg);
    
    if (typeof schedulePgSync === 'function') {
      schedulePgSync();
    }
    
    res.json({ ok: true, id: ins.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/support/chats", admin, (req, res) => {
  try {
    const list = db.prepare(`
      SELECT o.id, o.customer_name, o.customer_phone, o.total, o.status,
             (SELECT message FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) as last_message,
             (SELECT sender_role FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) as last_sender,
             (SELECT created_at FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) as last_message_at,
             COUNT(m.id) as message_count
      FROM orders o
      JOIN order_messages m ON m.order_id = o.id
      GROUP BY o.id
      ORDER BY last_message_at DESC
    `).all();
    res.json(list);
  } catch(e) {
    res.json([]);
  }
});

app.get("/api/me/support/chats", auth, (req, res) => {
  try {
    const u = currentUser(req);
    const list = db.prepare(`
      SELECT o.id, o.customer_name, o.customer_phone, o.total, o.status,
             (SELECT message FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) as last_message,
             (SELECT sender_role FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) as last_sender,
             (SELECT created_at FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) as last_message_at,
             COUNT(m.id) as message_count
      FROM orders o
      JOIN order_messages m ON m.order_id = o.id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY last_message_at DESC
    `).all(u.id);
    res.json(list);
  } catch(e) {
    res.json([]);
  }
});

app.delete("/api/admin/categories/:id", admin, (req, res) => {
  try {
    const catId = Number(req.params.id);
    const info = db.prepare("DELETE FROM categories WHERE id=?").run(catId);
    if (typeof schedulePgSync === 'function') schedulePgSync();
    res.json({ ok: info.changes > 0 });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

/*
 * Inicialização do servidor
 *
 * O Render fornece process.env.PORT.
 * Localmente usamos 3000.
 */
const SERVER_PORT = Number(process.env.PORT) || 3000;

const server = app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`[SERVER] Machado Express rodando na porta ${SERVER_PORT}`);
});

server.on("error", (error) => {
  console.error("[SERVER] Erro ao iniciar servidor:", error);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("[SERVER] SIGTERM recebido. Encerrando...");

  server.close(() => {
    console.log("[SERVER] Servidor encerrado.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[SERVER] SIGINT recebido. Encerrando...");

  server.close(() => {
    console.log("[SERVER] Servidor encerrado.");
    process.exit(0);
  });
});
