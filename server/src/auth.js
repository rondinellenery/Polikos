import jwt from 'jsonwebtoken';
import { one } from './db.js';
const cookieName = 'polikos_session';
function secret() { return process.env.JWT_SECRET || 'dev-apenas-nao-utilizar-em-producao-chave-demo-local'; }
export const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.COOKIE_SECURE === 'true', maxAge: 7 * 24 * 60 * 60 * 1000 };
export function loginCookie(res, user) { const token = jwt.sign({ sub: user.id }, secret(), { expiresIn: '7d', issuer:'polikos' }); res.cookie(cookieName, token, cookieOptions); }
export function logoutCookie(res) { res.clearCookie(cookieName, { path: '/', sameSite: 'lax', secure: cookieOptions.secure, httpOnly: true }); }
export function auth(req, res, next) {
  const token = req.cookies?.[cookieName]; if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });
  try { const payload = jwt.verify(token, secret(), { issuer:'polikos' });
    const user = one('SELECT id, condominium_id AS condominiumId, name, email, role, block, unit FROM users WHERE id=?', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' }); req.user = user; next(); }
  catch { return res.status(401).json({ error:'Sessão expirada. Entre novamente.' }); }
}
export function adminOnly(req,res,next) { if(req.user.role!=='admin') return res.status(403).json({error:'Acesso reservado à administração.'}); next(); }
