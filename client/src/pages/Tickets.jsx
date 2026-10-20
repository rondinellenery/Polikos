import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Filter,Plus,Search,X} from 'lucide-react';
import {api,categories,statusList} from '../api';
import {useAuth} from '../context/AuthContext';
import {Alert,Loading,PageHeading,TicketTable} from '../components/Shared';
export default function Tickets(){const {user}=useAuth(),admin=user.role==='admin', [params,setParams]=useSearchParams(),[search,setSearch]=useState(params.get('search')||''),[rows,setRows]=useState(null),[error,setError]=useState('');
const status=params.get('status')||'',category=params.get('category')||'',block=params.get('block')||'';
useEffect(()=>{let active=true;setRows(null);api('/tickets?'+params.toString()).then(data=>{if(active)setRows(data)}).catch(err=>{if(active)setError(err.message)});return()=>{active=false}},[params.toString()]);
function setFilter(key,value){const updated=new URLSearchParams(params);if(value)updated.set(key,value);else updated.delete(key);setParams(updated);}
function find(e){e.preventDefault();setFilter('search',search)}
return <><PageHeading eyebrow="CENTRAL DE SOLICITAÇÕES" title={admin?'Gerenciar chamados':'Meus chamados'} description={admin?'Visualize, encontre e acompanhe as solicitações dos moradores.':'Consulte o andamento das ocorrências que você registrou.'} actions={!admin&&<Link to="/chamados/novo" className="btn btn-primary"><Plus size={18}/> Novo chamado</Link>}/>
<section className="surface-card filter-section"><div className="filters-heading"><div><Filter size={19}/><strong>Filtros e pesquisa</strong></div><button onClick={()=>{setParams({});setSearch('')}} className="clear-filter"><X size={15}/> Limpar filtros</button></div><div className="filters-row"><form className="search-field" onSubmit={find}><Search size={19}/><input aria-label="Pesquisar chamados" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por título, local ou número..."/><button type="submit">Buscar</button></form><select aria-label="Filtrar por status" value={status} onChange={e=>setFilter('status',e.target.value)}><option value="">Todos os status</option>{statusList.map(s=><option key={s}>{s}</option>)}</select><select aria-label="Filtrar por categoria" value={category} onChange={e=>setFilter('category',e.target.value)}><option value="">Todas as categorias</option>{categories.map(c=><option key={c}>{c}</option>)}</select>{admin&&<input className="filter-block" aria-label="Filtrar por bloco" value={block} onChange={e=>setFilter('block',e.target.value)} placeholder="Bloco"/>}</div></section>
<section className="surface-card tickets-section"><div className="card-heading"><div><h2>Solicitações</h2><p>{rows?`${rows.length} ${rows.length===1?'chamado encontrado':'chamados encontrados'}`:'Buscando chamados...'}</p></div></div>{error&&<Alert>{error}</Alert>}{!rows&&!error?<Loading/>:rows&&<TicketTable tickets={rows} showResident={admin}/>}</section>
</>}
