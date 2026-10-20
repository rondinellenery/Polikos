import {useEffect,useState} from 'react';
import {NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom';
import {LayoutDashboard,TicketPlus,ClipboardList,Users,ChartNoAxesCombined,Bell,LogOut,Menu,X,Building2,ChevronDown,ShieldCheck,HelpCircle,Search} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {api,initials} from '../api';
const NavItem=({to,icon:Icon,children,end=false,close})=><NavLink to={to} end={end} onClick={close} className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={19}/><span>{children}</span></NavLink>;
export default function Layout(){
  const {user,logout}=useAuth(),admin=user.role==='admin',navigate=useNavigate(),location=useLocation();
  const [mobileOpen,setMobileOpen]=useState(false),[unread,setUnread]=useState(0),[confirmLogout,setConfirmLogout]=useState(false),[condoName,setCondoName]=useState('Meu condomínio');
  useEffect(()=>{api('/condominium').then(x=>setCondoName(x.name)).catch(()=>{});},[]);
  useEffect(()=>{const refresh=()=>api('/notifications').then(x=>setUnread(x.filter(n=>!n.read_at).length)).catch(()=>{});refresh();window.addEventListener('polikos:notifications',refresh);return()=>window.removeEventListener('polikos:notifications',refresh);},[location.pathname]);
  async function doLogout(){try{await logout();navigate('/login');}catch{setConfirmLogout(false);}}
  return <div className="app-shell">
    {mobileOpen&&<button className="sidebar-overlay" aria-label="Fechar menu" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen?'sidebar-open':''}`}>
      <div className="brand-row"><div className="brand-mark"><Building2 size={23} strokeWidth={2.6}/></div><div><div className="brand-title">POLIKOS<span>.</span></div><div className="brand-caption">Gestão inteligente</div></div><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={21}/></button></div>
      <div className="side-condo"><div className="side-condo-icon"><Building2 size={18}/></div><div className="side-condo-text"><small>CONDOMÍNIO</small><strong title={condoName}>{condoName}</strong></div><ChevronDown size={15}/></div>
      <div className="nav-label">MENU PRINCIPAL</div><nav className="side-nav" aria-label="Menu principal">
        <NavItem to="/" end icon={LayoutDashboard} close={()=>setMobileOpen(false)}>Visão geral</NavItem>
        <NavItem to="/chamados" icon={ClipboardList} close={()=>setMobileOpen(false)}>{admin?'Gerenciar chamados':'Meus chamados'}</NavItem>
        {!admin&&<NavItem to="/chamados/novo" icon={TicketPlus} close={()=>setMobileOpen(false)}>Abrir chamado</NavItem>}
        {admin&&<><NavItem to="/moradores" icon={Users} close={()=>setMobileOpen(false)}>Moradores</NavItem><NavItem to="/relatorios" icon={ChartNoAxesCombined} close={()=>setMobileOpen(false)}>Relatórios</NavItem></>}
        <NavItem to="/notificacoes" icon={Bell} close={()=>setMobileOpen(false)}>Notificações {unread>0&&<span className="nav-count">{unread}</span>}</NavItem>
      </nav>
      <div className="side-bottom"><div className="side-help"><HelpCircle size={19}/><div><strong>Precisa de ajuda?</strong><span>Fale com a administração do seu condomínio.</span></div></div><button className="nav-item logout-item" onClick={()=>setConfirmLogout(true)}><LogOut size={19}/>Encerrar sessão</button></div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" aria-label="Abrir menu" onClick={()=>setMobileOpen(true)}><Menu size={23}/></button><div className="breadcrumb"><span>Polikos</span><span className="separator">/</span><strong>{location.pathname==='/'?'Visão geral':location.pathname.includes('novo')?'Novo chamado':location.pathname.includes('chamados')?'Chamados':location.pathname.includes('moradores')?'Moradores':location.pathname.includes('relatorios')?'Relatórios':'Notificações'}</strong></div></div><div className="topbar-right"><button className="icon-btn search-button" title="Pesquisar chamados" aria-label="Pesquisar chamados" onClick={()=>navigate('/chamados')}><Search size={20}/></button><button className="icon-btn bell-btn" title="Notificações" aria-label="Notificações" onClick={()=>navigate('/notificacoes')}><Bell size={20}/>{unread>0&&<i/>}</button><div className="top-divider"/><div className="user-avatar">{initials(user.name)}</div><div className="top-user"><strong>{user.name}</strong><small>{admin?'Síndico / Admin':'Morador'}</small></div></div></header>
      <main className="content"><Outlet/></main>
      <footer className="footer">© {new Date().getFullYear()} POLIKOS · Gestão inteligente de condomínios <span>Feito com React + Node.js</span></footer>
    </div>
    {confirmLogout&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmLogout(false)}}><section className="modal" role="dialog" aria-modal="true" aria-label="Confirmar saída"><h2>Encerrar sessão?</h2><p>Você precisará entrar novamente para acessar o POLIKOS.</p><div className="modal-actions"><button className="btn btn-outline" onClick={()=>setConfirmLogout(false)}>Cancelar</button><button className="btn btn-primary" onClick={doLogout}>Sim, sair</button></div></section></div>}
  </div>
}
