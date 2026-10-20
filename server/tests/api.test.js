import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'polikos-test-'));
process.env.POLIKOS_DATA_DIR=path.join(folder,'data');
process.env.POLIKOS_UPLOAD_DIR=path.join(folder,'uploads');
process.env.CONDO_INVITE_CODE='POLIKOS2026';
process.env.ADMIN_EMAIL='admin@polikos.local';
process.env.ADMIN_PASSWORD='Admin@12345';
process.env.NODE_ENV='test';
const {app}=await import('../src/app.js');
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
async function request(route,method='GET',body, cookie){
  const resp=await fetch(base+'/api'+route,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{'cookie':cookie}:{})},body:body?JSON.stringify(body):undefined});
  const data=await resp.json();return {status:resp.status,data,cookie:resp.headers.get('set-cookie')?.split(';')[0]};
}
const login=async(email,password)=>request('/auth/login','POST',{email,password});
test('fluxo completo de login, permissões, chamado, histórico e avaliação',async()=>{
  const anonymous=await request('/tickets');assert.equal(anonymous.status,401);
  const resident=await login('morador@polikos.local','Morador@12345');assert.equal(resident.status,200);assert.ok(resident.cookie);
  const admin=await login('admin@polikos.local','Admin@12345');assert.equal(admin.status,200);
  const denied=await request('/residents','GET',undefined,resident.cookie);assert.equal(denied.status,403);
  const invalid=await request('/tickets','POST',{title:'Oi'},resident.cookie);assert.equal(invalid.status,400);
  const create=await request('/tickets','POST',{title:'Problema na piscina',description:'A bomba da piscina está emitindo barulhos estranhos.',category:'Manutenção',location:'Piscina externa',priority:'Alta'},resident.cookie);
  assert.equal(create.status,201);const id=create.data.id;
  const detail=await request('/tickets/'+id,'GET',undefined,resident.cookie);assert.equal(detail.data.status,'Aberto');assert.equal(detail.data.events.length,1);
  const forbidden=await request(`/tickets/${id}/status`,'PATCH',{status:'Em análise'},resident.cookie);assert.equal(forbidden.status,403);
  const skip=await request(`/tickets/${id}/status`,'PATCH',{status:'Resolvido'},admin.cookie);assert.equal(skip.status,400);
  for(const status of ['Em análise','Em manutenção','Resolvido']){
    const change=await request(`/tickets/${id}/status`,'PATCH',{status,message:'Problema resolvido com equipe técnica.'},admin.cookie);assert.equal(change.status,200);
  }
  const result=await request(`/tickets/${id}`,'GET',undefined,resident.cookie);
  assert.equal(result.data.status,'Resolvido');assert.equal(result.data.events.length,4);
  const evaluation=await request(`/tickets/${id}/rating`,'POST',{stars:5,comment:'Ótimo atendimento!'},resident.cookie);
  assert.equal(evaluation.status,201);
  const duplicate=await request(`/tickets/${id}/rating`,'POST',{stars:5},resident.cookie);assert.equal(duplicate.status,409);
  const notifications=await request('/notifications','GET',undefined,resident.cookie);assert.ok(notifications.data.length>=3);
  const logout=await request('/auth/logout','POST',undefined,resident.cookie);assert.equal(logout.status,200);
},{timeout:30000});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(folder,{recursive:true,force:true});});
