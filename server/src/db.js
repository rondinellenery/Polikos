import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
const dir = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = process.env.POLIKOS_DATA_DIR ? path.resolve(process.env.POLIKOS_DATA_DIR) : path.resolve(dir, '../data');
export const uploadDir = process.env.POLIKOS_UPLOAD_DIR ? path.resolve(process.env.POLIKOS_UPLOAD_DIR) : path.resolve(dir, '../uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const file = path.join(dataDir, 'polikos.sqlite');
const SQL = await initSqlJs();
const db = fs.existsSync(file) ? new SQL.Database(new Uint8Array(fs.readFileSync(file))) : new SQL.Database();
db.run('PRAGMA foreign_keys = ON');
let transactionDepth = 0;
export function persist() { fs.writeFileSync(file + '.tmp', Buffer.from(db.export())); fs.renameSync(file + '.tmp', file); }
export function query(sql, params = []) {
  const statement = db.prepare(sql);
  try { statement.bind(params); const rows = []; while (statement.step()) rows.push(statement.getAsObject()); return rows; }
  finally { statement.free(); }
}
export function one(sql, params = []) { return query(sql, params)[0] ?? null; }
export function run(sql, params = []) { db.run(sql, params); if (!transactionDepth) persist(); }
export function transaction(fn) {
  db.run('BEGIN TRANSACTION'); transactionDepth++;
  try { const result = fn(); db.run('COMMIT'); transactionDepth--; persist(); return result; }
  catch (error) { db.run('ROLLBACK'); transactionDepth--; throw error; }
}
const schema = `
CREATE TABLE IF NOT EXISTS condominiums (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, condominium_id TEXT NOT NULL REFERENCES condominiums(id), name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','resident')), block TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, condominium_id TEXT NOT NULL REFERENCES condominiums(id), owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, location TEXT NOT NULL, block TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'Média', status TEXT NOT NULL DEFAULT 'Aberto', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), actor_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', previous_status TEXT, new_status TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), ticket_id TEXT NOT NULL REFERENCES tickets(id), message TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT);
CREATE TABLE IF NOT EXISTS ratings (ticket_id TEXT PRIMARY KEY REFERENCES tickets(id), user_id TEXT NOT NULL REFERENCES users(id), stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), user_id TEXT NOT NULL REFERENCES users(id), filename TEXT NOT NULL, content_type TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, used_at TEXT);
CREATE INDEX IF NOT EXISTS idx_tickets_condo ON tickets(condominium_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_owner ON tickets(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_ticket ON events(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
`;
db.run(schema); persist();
export function seed() {
  if (one('SELECT id FROM condominiums LIMIT 1')) return;
  const now = new Date().toISOString(); const c = 'demo-condo';
  const admin = 'demo-admin'; const resident = 'demo-resident';
  const demo = [
    ['Vazamento no corredor do 2º andar', 'Hidráulica', 'Água escorrendo pela parede ao lado do elevador social há dois dias.', 'Bloco A • 2º andar', 'Alta', 'Em manutenção', 5],
    ['Luz da garagem apagada', 'Iluminação', 'Duas luminárias estão apagadas próximas à vaga 28 da garagem.', 'Garagem • Subsolo 1', 'Média', 'Em análise', 4],
    ['Portão de acesso com ruído', 'Portas/portões', 'Portão principal está fazendo um ruído muito forte ao abrir.', 'Entrada principal', 'Alta', 'Aberto', 2],
    ['Lixeira da área comum', 'Limpeza', 'A lixeira está danificada e precisa ser substituída pela manutenção.', 'Área de convivência', 'Baixa', 'Resolvido', 9],
    ['Torneira com defeito no salão', 'Manutenção', 'Torneira do lavabo do salão de festas não para de pingar.', 'Salão de festas', 'Média', 'Aberto', 1]
  ];
  transaction(() => {
    run('INSERT INTO condominiums VALUES (?,?,?)', [c, process.env.CONDO_NAME || 'Residencial Jardins', process.env.CONDO_INVITE_CODE || 'POLIKOS2026']);
    run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)', [admin,c,'Mariana Costa',process.env.ADMIN_EMAIL?.toLowerCase()||'admin@polikos.local',bcrypt.hashSync(process.env.ADMIN_PASSWORD||'Admin@12345',10),'admin','Administração','',now]);
    run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)', [resident,c,'Lucas Almeida','morador@polikos.local',bcrypt.hashSync('Morador@12345',10),'resident','A','204',now]);
    demo.forEach(([title,category,description,location,priority,status,days], i) => {
      const id = randomUUID(); const createdAt = new Date(Date.now()-days*86400000).toISOString();
      run('INSERT INTO tickets (id,condominium_id,owner_id,title,description,category,location,block,priority,status,created_at,updated_at,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [id,c,resident,title,description,category,location,'A',priority,status,createdAt,now,status==='Resolvido'?now:null]);
      run('INSERT INTO events VALUES (?,?,?,?,?,?,?,?)', [randomUUID(),id,resident,'created','Chamado aberto',null,'Aberto',createdAt]);
      const levels = ['Aberto','Em análise','Em manutenção','Resolvido'];
      for (let n=1; n<=levels.indexOf(status); n++) {
        run('INSERT INTO events VALUES (?,?,?,?,?,?,?,?)', [randomUUID(),id,admin,'status',n===3?'Manutenção concluída e problema solucionado.':'Equipe informada. Ocorrência em acompanhamento.',levels[n-1],levels[n],new Date(Date.now()-(days-n)*86400000).toISOString()]);
      }
    });
  });
}
