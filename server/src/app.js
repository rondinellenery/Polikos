import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { one, query, run, transaction, seed, uploadDir } from './db.js';
import { auth, adminOnly, loginCookie, logoutCookie } from './auth.js';
import { STATUSES, CATEGORIES, PRIORITIES, validEmail, validPassword, clean, nextStatus, ticketValidation } from './validation.js';

seed();
const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(express.json({limit:'200kb'}));
app.use(cookieParser());
const limiter = rateLimit({ windowMs: 15*60*1000, limit: 20, standardHeaders:'draft-7', legacyHeaders:false, message:{error:'Muitas tentativas. Aguarde 15 minutos.'} });
// Recusa escrita originada de outros sites: proteção adicional aos cookies SameSite.
app.use('/api', (req,res,next) => {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const origin=req.get('origin');
  const allowed=[process.env.APP_URL, `http://${req.get('host')}`, `https://${req.get('host')}`];
  if(process.env.NODE_ENV!=='production') allowed.push('http://localhost:5173','http://127.0.0.1:5173');
  if(origin && !allowed.includes(origin)) return res.status(403).json({error:'Origem não autorizada.'});
  next();
});
const respond=(res, data, code=200)=>res.status(code).json(data);
const fail=(res, message, code=400)=>respond(res,{error:message},code);
const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const dateNow=()=>new Date().toISOString();
const publicUser=(u)=>({id:u.id, name:u.name, email:u.email, role:u.role, block:u.block, unit:u.unit, condominiumId:u.condominium_id ?? u.condominiumId });
const sha=(token)=>createHash('sha256').update(token).digest('hex');
function ticketForUser(id, user) {
  return one(`SELECT t.*, u.name AS resident_name, u.block AS resident_block, u.unit AS resident_unit
    FROM tickets t JOIN users u ON u.id=t.owner_id
    WHERE t.id=? AND t.condominium_id=? ${user.role==='resident'?'AND t.owner_id=?':''}`,
    user.role==='resident'?[id,user.condominiumId,user.id]:[id,user.condominiumId]);
}
function notify(userId, ticketId, message) { run('INSERT INTO notifications (id,user_id,ticket_id,message,created_at) VALUES (?,?,?,?,?)',[randomUUID(),userId,ticketId,message,dateNow()]); }
function recordEvent(ticketId, actorId, kind, message, before=null, after=null){
  run('INSERT INTO events (id,ticket_id,actor_id,kind,message,previous_status,new_status,created_at) VALUES (?,?,?,?,?,?,?,?)', [randomUUID(),ticketId,actorId,kind,message,before,after,dateNow()]);
}
app.get('/api/health', (_req,res)=>respond(res,{ok:true,app:'POLIKOS'}));
app.get('/api/meta', (_req,res)=>respond(res,{statuses:STATUSES,categories:CATEGORIES,priorities:PRIORITIES,condominium:one('SELECT id,name FROM condominiums LIMIT 1')}));

app.post('/api/auth/login', limiter, (req,res)=>{
  const email=clean(req.body?.email,254).toLowerCase();
  const u=one('SELECT * FROM users WHERE email=?',[email]);
  if(!u || typeof req.body?.password!=='string' || !bcrypt.compareSync(req.body.password,u.password_hash)) return fail(res,'E-mail ou senha inválidos.',401);
  loginCookie(res,u);return respond(res,{user:publicUser(u)});
});
app.post('/api/auth/register',limiter,(req,res)=>{
  const name=clean(req.body?.name,100), email=clean(req.body?.email,254).toLowerCase(), password=req.body?.password;
  const block=clean(req.body?.block,40), unit=clean(req.body?.unit,40), inviteCode=clean(req.body?.inviteCode,100);
  if(name.length<3 || !validEmail(email) || !validPassword(password) || !block || !unit) return fail(res,'Confira nome, e-mail, bloco, unidade e senha (8 caracteres, maiúscula, minúscula e número).');
  const condo=one('SELECT * FROM condominiums WHERE invite_code=?',[inviteCode]);
  if(!condo) return fail(res,'Código do condomínio inválido.');
  if(one('SELECT id FROM users WHERE email=?',[email])) return fail(res,'Este e-mail já está cadastrado.',409);
  const id=randomUUID();
  run('INSERT INTO users (id,condominium_id,name,email,password_hash,role,block,unit,created_at) VALUES (?,?,?,?,?,?,?,?,?)', [id,condo.id,name,email,bcrypt.hashSync(password,10),'resident',block,unit,dateNow()]);
  const user={id,condominiumId:condo.id,name,email,role:'resident',block,unit}; loginCookie(res,user);
  return respond(res,{user},201);
});
app.post('/api/auth/logout',(_req,res)=>{logoutCookie(res);return respond(res,{ok:true});});
app.get('/api/auth/me',auth,(req,res)=>respond(res,{user:req.user}));
app.post('/api/auth/forgot-password',limiter,asyncHandler(async(req,res)=>{
  const email=clean(req.body?.email,254).toLowerCase(); if(!validEmail(email)) return fail(res,'Digite um e-mail válido.');
  const response={message:'Se o endereço estiver cadastrado, enviaremos instruções de recuperação.'};
  const user=one('SELECT * FROM users WHERE email=?',[email]);
  if(user){
    const token=randomBytes(32).toString('hex');
    const until=new Date(Date.now()+20*60*1000).toISOString();
    transaction(()=>{run('DELETE FROM password_resets WHERE user_id=?',[user.id]);run('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)',[sha(token),user.id,until]);});
    const base=process.env.APP_URL||'http://localhost:5173'; const resetUrl=`${base.replace(/\/$/,'')}/redefinir-senha?token=${token}`;
    if(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
      await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'Polikos — Redefinição de senha',text:`Para redefinir sua senha, acesse em até 20 minutos:\n${resetUrl}\nSe não solicitou, ignore.`});
    } else if(process.env.NODE_ENV!=='production') response.devResetUrl=resetUrl; // somente demonstração local
  }
  return respond(res,response);
}));
app.post('/api/auth/reset-password',limiter,(req,res)=>{
  const token=clean(req.body?.token,130), password=req.body?.password;
  if(!/^[0-9a-f]{64}$/.test(token) || !validPassword(password)) return fail(res,'Link inválido ou senha fora do padrão de segurança.');
  const reset=one('SELECT * FROM password_resets WHERE token_hash=?',[sha(token)]);
  if(!reset || reset.used_at || reset.expires_at<dateNow()) return fail(res,'Link inválido ou expirado. Solicite outro.',400);
  transaction(()=>{run('UPDATE users SET password_hash=? WHERE id=?',[bcrypt.hashSync(password,10),reset.user_id]);run('UPDATE password_resets SET used_at=? WHERE token_hash=?',[dateNow(),reset.token_hash]);});
  return respond(res,{message:'Senha alterada com sucesso. Entre novamente.'});
});

app.get('/api/condominium',auth,(req,res)=>respond(res,one('SELECT id,name FROM condominiums WHERE id=?',[req.user.condominiumId])));
app.get('/api/dashboard',auth,(req,res)=>{
  const where=req.user.role==='admin'?'condominium_id=?':'condominium_id=? AND owner_id=?';
  const params=req.user.role==='admin'?[req.user.condominiumId]:[req.user.condominiumId,req.user.id];
  const counts=Object.fromEntries(STATUSES.map(s=>[s,0]));
  query(`SELECT status,COUNT(*) AS total FROM tickets WHERE ${where} GROUP BY status`,params).forEach(r=>counts[r.status]=r.total);
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const recent=query(`SELECT id,title,category,priority,status,created_at FROM tickets WHERE ${where} ORDER BY created_at DESC LIMIT 6`,params);
  const byCategory=query(`SELECT category,COUNT(*) AS total FROM tickets WHERE ${where} GROUP BY category ORDER BY total DESC`,params);
  const unread=one('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND read_at IS NULL',[req.user.id]).n;
  return respond(res,{counts,total,recent,byCategory,unread});
});
app.get('/api/tickets',auth,(req,res)=>{
  let sql=`SELECT t.id,t.title,t.category,t.location,t.block,t.priority,t.status,t.created_at,t.updated_at,u.name AS resident_name
    FROM tickets t JOIN users u ON t.owner_id=u.id WHERE t.condominium_id=?`;
  const params=[req.user.condominiumId];
  if(req.user.role==='resident'){sql+=' AND t.owner_id=?';params.push(req.user.id);}
  if(STATUSES.includes(req.query.status)){sql+=' AND t.status=?';params.push(req.query.status);}
  if(CATEGORIES.includes(req.query.category)){sql+=' AND t.category=?';params.push(req.query.category);}
  if(req.query.block){sql+=' AND t.block LIKE ?';params.push(`%${clean(req.query.block,30)}%`);}
  if(req.query.search){const find=`%${clean(req.query.search,100)}%`;sql+=' AND (t.title LIKE ? OR t.id LIKE ? OR t.location LIKE ?)';params.push(find,find,find);}
  sql+=' ORDER BY t.created_at DESC LIMIT 300'; return respond(res,query(sql,params));
});
app.post('/api/tickets',auth,(req,res)=>{
  if(req.user.role!=='resident') return fail(res,'Somente moradores podem abrir chamados.',403);
  const v=ticketValidation(req.body||{}); if(v.error) return fail(res,v.error);
  const {title,description,category,location,block,priority}=v.value;
  const id=randomUUID(), now=dateNow();
  transaction(()=>{
    run('INSERT INTO tickets (id,condominium_id,owner_id,title,description,category,location,block,priority,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[id,req.user.condominiumId,req.user.id,title,description,category,location,block||req.user.block,priority,'Aberto',now,now]);
    recordEvent(id,req.user.id,'created','Chamado aberto',null,'Aberto');
  }); return respond(res,{id,message:'Chamado criado com sucesso!'},201);
});
app.get('/api/tickets/:id',auth,(req,res)=>{
  const ticket=ticketForUser(req.params.id,req.user); if(!ticket) return fail(res,'Chamado não encontrado.',404);
  const events=query('SELECT e.*,u.name AS actor_name,u.role AS actor_role FROM events e JOIN users u ON u.id=e.actor_id WHERE e.ticket_id=? ORDER BY e.created_at ASC,e.rowid ASC',[ticket.id]);
  const attachments=query('SELECT id,content_type,created_at FROM attachments WHERE ticket_id=? ORDER BY created_at DESC',[ticket.id]);
  const rating=one('SELECT stars,comment,created_at FROM ratings WHERE ticket_id=?',[ticket.id]);
  return respond(res,{...ticket,events,attachments,rating});
});
app.post('/api/tickets/:id/comments',auth,(req,res)=>{
  const ticket=ticketForUser(req.params.id,req.user); if(!ticket) return fail(res,'Chamado não encontrado.',404);
  if(ticket.status==='Resolvido') return fail(res,'Este chamado foi encerrado. O histórico é somente leitura.');
  const message=clean(req.body?.message,1500); if(message.length<2) return fail(res,'Escreva uma mensagem com ao menos 2 caracteres.');
  transaction(()=>{recordEvent(ticket.id,req.user.id,'comment',message);run('UPDATE tickets SET updated_at=? WHERE id=?',[dateNow(),ticket.id]);if(req.user.role==='admin')notify(ticket.owner_id,ticket.id,`A administração respondeu: ${ticket.title}`);});
  return respond(res,{message:'Mensagem registrada.'},201);
});
app.patch('/api/tickets/:id/status',auth,adminOnly,(req,res)=>{
  const ticket=ticketForUser(req.params.id,req.user); if(!ticket) return fail(res,'Chamado não encontrado.',404);
  const desired=clean(req.body?.status,30), message=clean(req.body?.message,1500);
  if(desired!==nextStatus(ticket.status)) return fail(res,'Siga a próxima etapa do fluxo. Chamados resolvidos não podem ser alterados.');
  if(desired==='Resolvido' && message.length<5) return fail(res,'Informe um resumo da solução (pelo menos 5 caracteres).');
  transaction(()=>{
    const now=dateNow(); run('UPDATE tickets SET status=?,updated_at=?,resolved_at=? WHERE id=?',[desired,now,desired==='Resolvido'?now:null,ticket.id]);
    recordEvent(ticket.id,req.user.id,'status',message||`Status atualizado para ${desired}`,ticket.status,desired);
    notify(ticket.owner_id,ticket.id,`Seu chamado “${ticket.title}” está: ${desired}`);
  });return respond(res,{message:'Status atualizado.',status:desired});
});
app.post('/api/tickets/:id/rating',auth,(req,res)=>{
  const ticket=ticketForUser(req.params.id,req.user); if(!ticket) return fail(res,'Chamado não encontrado.',404);
  if(req.user.role!=='resident' || ticket.owner_id!==req.user.id) return fail(res,'Somente o morador responsável pode avaliar.',403);
  if(ticket.status!=='Resolvido') return fail(res,'Avalie somente após a resolução.');
  const stars=Number(req.body?.stars),comment=clean(req.body?.comment,1000);
  if(!Number.isInteger(stars)||stars<1||stars>5) return fail(res,'Selecione de 1 a 5 estrelas.');
  if(one('SELECT ticket_id FROM ratings WHERE ticket_id=?',[ticket.id])) return fail(res,'Este chamado já foi avaliado.',409);
  run('INSERT INTO ratings VALUES (?,?,?,?,?)',[ticket.id,req.user.id,stars,comment,dateNow()]);return respond(res,{message:'Obrigado pela avaliação!'},201);
});
const upload=multer({ storage:multer.diskStorage({ destination:uploadDir, filename: (_r,_f,cb)=>cb(null,randomUUID()) }), limits:{fileSize:3*1024*1024,files:1},fileFilter:(_req,file,cb)=>{if(['image/png','image/jpeg','image/webp'].includes(file.mimetype))cb(null,true);else cb(new Error('Somente imagens PNG, JPG ou WebP.'));} });
function isActuallyImage(filename,type){const b=fs.readFileSync(filename);if(type==='image/png')return b.length>=8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(type==='image/jpeg')return b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;if(type==='image/webp')return b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';return false;}
app.post('/api/tickets/:id/attachments',auth,(req,res,next)=>{
  const ticket=ticketForUser(req.params.id,req.user);if(!ticket)return fail(res,'Chamado não encontrado.',404);
  if(ticket.status==='Resolvido')return fail(res,'Chamado já encerrado.');
  upload.single('image')(req,res,err=>{
    if(err)return next(err); if(!req.file)return fail(res,'Selecione uma imagem.');
    if(!isActuallyImage(req.file.path,req.file.mimetype)){fs.unlinkSync(req.file.path);return fail(res,'O arquivo não é uma imagem válida.');}
    const id=randomUUID(); transaction(()=>{run('INSERT INTO attachments VALUES (?,?,?,?,?,?)',[id,ticket.id,req.user.id,req.file.filename,req.file.mimetype,dateNow()]);recordEvent(ticket.id,req.user.id,'attachment','Imagem adicionada ao chamado');});
    return respond(res,{id,message:'Imagem anexada.'},201);
  });
});
app.get('/api/attachments/:id',auth,(req,res)=>{
  const attachment=one('SELECT * FROM attachments WHERE id=?',[req.params.id]);
  if(!attachment||!ticketForUser(attachment.ticket_id,req.user))return fail(res,'Imagem não encontrada.',404);
  const filePath=path.join(uploadDir,attachment.filename);if(!fs.existsSync(filePath))return fail(res,'Arquivo indisponível.',404);
  res.set('Content-Type',attachment.content_type);res.set('Cache-Control','private, no-store');res.sendFile(filePath);
});
app.get('/api/notifications',auth,(req,res)=>respond(res,query('SELECT id,ticket_id,message,created_at,read_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[req.user.id])));
app.patch('/api/notifications/read-all',auth,(req,res)=>{run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL',[dateNow(),req.user.id]);return respond(res,{ok:true});});
app.patch('/api/notifications/:id/read',auth,(req,res)=>{run('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?',[dateNow(),req.params.id,req.user.id]);return respond(res,{ok:true});});
app.get('/api/residents',auth,adminOnly,(req,res)=>respond(res,query(`SELECT u.id,u.name,u.email,u.block,u.unit,u.created_at,COUNT(t.id) AS tickets
 FROM users u LEFT JOIN tickets t ON t.owner_id=u.id WHERE u.condominium_id=? AND u.role='resident'
 GROUP BY u.id ORDER BY u.name ASC`,[req.user.condominiumId])));
app.get('/api/reports',auth,adminOnly,(req,res)=>{
  const c=req.user.condominiumId;
  const monthly=query("SELECT substr(created_at,1,7) AS month,COUNT(*) AS total FROM tickets WHERE condominium_id=? GROUP BY substr(created_at,1,7) ORDER BY month DESC LIMIT 6",[c]).reverse();
  const categories=query('SELECT category,COUNT(*) AS total FROM tickets WHERE condominium_id=? GROUP BY category ORDER BY total DESC',[c]);
  const priorities=query('SELECT priority,COUNT(*) AS total FROM tickets WHERE condominium_id=? GROUP BY priority ORDER BY total DESC',[c]);
  const ratings=one('SELECT ROUND(AVG(r.stars),1) AS average,COUNT(*) AS total FROM ratings r JOIN tickets t ON t.id=r.ticket_id WHERE t.condominium_id=?',[c]);
  return respond(res,{monthly,categories,priorities,ratings});
});
app.use('/api',(req,res)=>fail(res,'Rota de API não encontrada.',404));
const frontendDist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../client/dist');
if(fs.existsSync(path.join(frontendDist,'index.html'))){app.use(express.static(frontendDist));app.get('*',(req,res)=>res.sendFile(path.join(frontendDist,'index.html')));}
app.use((err,req,res,_next)=>{
  if(err instanceof multer.MulterError) return fail(res,err.code==='LIMIT_FILE_SIZE'?'Arquivo maior que 3 MB.':'Erro no envio da imagem.');
  if(err?.message==='Somente imagens PNG, JPG ou WebP.') return fail(res,err.message);
  console.error('[POLIKOS]',err);
  return fail(res,'Não foi possível completar a operação. Tente novamente.',500);
});
export {app};
