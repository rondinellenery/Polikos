import {Navigate, Route, Routes} from 'react-router-dom';
import {useAuth} from './context/AuthContext';
import Layout from './components/Layout';
import {Login,Register,ForgotPassword,ResetPassword} from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import NewTicket from './pages/NewTicket';
import TicketDetail from './pages/TicketDetail';
import Residents from './pages/Residents';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import {LoaderCircle} from 'lucide-react';
function Private({children,role}){const {user,loading}=useAuth();if(loading)return <div className="page-loader"><LoaderCircle className="spin" size={32}/><span>Carregando POLIKOS...</span></div>;if(!user)return <Navigate to="/login" replace/>;if(role&&user.role!==role)return <Navigate to="/" replace/>;return children;}
function Guest({children}){const {user,loading}=useAuth();if(loading)return <div className="page-loader"><LoaderCircle className="spin"/></div>;return user?<Navigate to="/" replace/>:children;}
export default function App(){return <Routes>
  <Route path="/login" element={<Guest><Login/></Guest>}/>
  <Route path="/cadastro" element={<Guest><Register/></Guest>}/>
  <Route path="/esqueci-senha" element={<Guest><ForgotPassword/></Guest>}/>
  <Route path="/redefinir-senha" element={<Guest><ResetPassword/></Guest>}/>
  <Route element={<Private><Layout/></Private>}>
    <Route index element={<Dashboard/>}/>
    <Route path="chamados" element={<Tickets/>}/>
    <Route path="chamados/novo" element={<Private role="resident"><NewTicket/></Private>}/>
    <Route path="chamados/:id" element={<TicketDetail/>}/>
    <Route path="moradores" element={<Private role="admin"><Residents/></Private>}/>
    <Route path="relatorios" element={<Private role="admin"><Reports/></Private>}/>
    <Route path="notificacoes" element={<Notifications/>}/>
  </Route>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes>}
