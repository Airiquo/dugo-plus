import {useState} from 'react'
import NewRequest from '../../web/src/pages/hospital/NewRequest.jsx'
import Privacy from '../../web/src/pages/donor/Privacy.jsx'
import {HospitalRequestResponses} from '../../web/src/components/HospitalRequestResponses.jsx'
import {Link,useLocation} from 'react-router-dom'
import {useAuth} from '../../web/src/hooks/useAuth.jsx'
import {AppShell} from '../../web/src/layout/AppShell.jsx'
import {HospitalShell} from '../../web/src/layout/HospitalShell.jsx'
const request={id:'fixture-request',hospitalId:'fixture-hospital',bloodType:'O+',component:'whole-blood',quantity:2,status:'urgent'}
export default function FixturePage(){
  const [responses,setResponses]=useState(false)
  const {pathname}=useLocation()
  const {user,role,signOut}=useAuth()
  if(pathname==='/hospital/requests/new') return <NewRequest/>
  if(pathname==='/donor/privacy') return <Privacy/>
  const content = <section style={{padding:40}}><h1>{pathname}</h1><p data-testid="identity">{user?.uid}:{role}</p><input aria-label="Unsaved draft"/><Link to="/login">Login</Link><Link to={role==='admin'?'/admin/accounts':role==='hospital'?'/hospital/profile':'/donor/requests'}>Next page</Link><button onClick={signOut}>Sign out fixture</button><button onClick={()=>setResponses(true)}>Review fixture donation</button>{responses&&<HospitalRequestResponses request={request} onClose={()=>setResponses(false)}/>}</section>
  return role === 'admin' ? <AppShell>{content}</AppShell> : role === 'hospital' ? <HospitalShell facility="Fixture hospital">{content}</HospitalShell> : content
}
