import {createContext, useContext, useEffect, useState} from 'react';
import {api} from '../api';
const Context=createContext(null);
export function AuthProvider({children}) {
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
  useEffect(()=>{let valid=true;api('/auth/me').then(r=>{if(valid)setUser(r.user);}).catch(()=>{}).finally(()=>{if(valid)setLoading(false);});return()=>{valid=false};},[]);
  async function login(credentials){const data=await api('/auth/login',{method:'POST',body:credentials});setUser(data.user);}
  async function register(payload){const data=await api('/auth/register',{method:'POST',body:payload});setUser(data.user);}
  async function logout(){await api('/auth/logout',{method:'POST'});setUser(null);}
  return <Context.Provider value={{user,loading,login,register,logout}}>{children}</Context.Provider>;
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('AuthProvider ausente');return value;}
