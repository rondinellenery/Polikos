import {Link} from 'react-router-dom';
import {AlertCircle, Inbox, LoaderCircle, ArrowRight} from 'lucide-react';
import {shortDate,shortId} from '../api';
export function StatusBadge({status}){const css={'Aberto':'open','Em análise':'analysis','Em manutenção':'maintenance','Resolvido':'resolved'};return <span className={`status-badge ${css[status]||''}`}><i/>{status}</span>}
export function PriorityBadge({value}){return <span className={`priority priority-${value==='Alta'?'high':value==='Baixa'?'low':'medium'}`}>{value}</span>}
export function PageHeading({eyebrow,title,description,actions}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="heading-actions">{actions}</div>}</div>}
export function Alert({children}){return <div role="alert" className="alert"><AlertCircle size={18}/>{children}</div>}
export function Success({children}){return <div role="status" className="success-note">{children}</div>}
export function Loading(){return <div className="loading-card"><LoaderCircle className="spin" size={26}/><span>Carregando informações...</span></div>}
export function Empty({title='Nada por aqui',description='Ainda não há informações para exibir.',action}){return <div className="empty"><div className="empty-icon"><Inbox size={28}/></div><h3>{title}</h3><p>{description}</p>{action}</div>}
export function TicketTable({tickets,showResident=false}){
  if(!tickets.length)return <Empty title="Nenhum chamado encontrado" description="Tente outros filtros ou registre uma nova ocorrência."/>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Chamado</th><th>Categoria</th>{showResident&&<th>Morador</th>}<th>Data</th><th>Prioridade</th><th>Status</th><th/></tr></thead><tbody>{tickets.map(t=><tr key={t.id}>
    <td><Link to={`/chamados/${t.id}`} className="table-link"><strong>{t.title}</strong><small>{shortId(t.id)} · {t.location||'Detalhes do chamado'}</small></Link></td>
    <td className="muted">{t.category}</td>{showResident&&<td>{t.resident_name}</td>}
    <td className="muted">{shortDate(t.created_at)}</td><td><PriorityBadge value={t.priority||'Média'}/></td><td><StatusBadge status={t.status}/></td>
    <td><Link className="table-arrow" aria-label={`Abrir ${t.title}`} to={`/chamados/${t.id}`}><ArrowRight size={16}/></Link></td>
  </tr>)}</tbody></table></div>
}
export function StatCard({icon:Icon,label,value,color='blue',description,onClick}){const El=onClick?'button':'div';return <El type={onClick?'button':undefined} onClick={onClick} className={`stat-card stat-${color} ${onClick?'stat-button':''}`}><div className="stat-head"><span>{label}</span><span className="stat-icon"><Icon size={20}/></span></div><strong>{value}</strong><small>{description}</small></El>}
