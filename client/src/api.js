export async function api(endpoint, options = {}) {
  const { method='GET', body, ...rest } = options;
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${endpoint}`, {
    method, credentials:'include', ...rest,
    headers: isForm ? rest.headers : { ...(body!==undefined?{'Content-Type':'application/json'}:{}), ...rest.headers },
    ...(body!==undefined ? { body: isForm? body:JSON.stringify(body)} : {})
  });
  const payload=await response.json().catch(()=>({error:'Resposta inesperada do servidor.'}));
  if(!response.ok) {const error=new Error(payload.error||'Ocorreu um erro.');error.status=response.status;throw error;}
  return payload;
}
export const formatDate=(iso)=>iso?new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)):'—';
export const shortDate=(iso)=>iso?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso)):'—';
export const shortId=(id)=>'#'+String(id||'').slice(0,8).toUpperCase();
export const statusList=['Aberto','Em análise','Em manutenção','Resolvido'];
export const categories=['Iluminação','Hidráulica','Estacionamento','Barulho','Limpeza','Manutenção','Elétrica','Portas/portões','Área externa','Outros'];
export const priorities=['Baixa','Média','Alta'];
export const initials=(name)=>String(name||'?').trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
