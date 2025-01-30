import { useNavigate, useLocation } from 'react-router-dom'
import './Dashboard.css'

function Dashboard() {
  const location = useLocation()
  
  // Access passed state
  const username = location.state?.username || 'Guest'
  const token = location.state?.token

  const navigate = useNavigate()


  return (
    <div className='background'>
        <div className='header'>
        <button onClick={() => navigate('/dashboard', { state: { username, token } })}>Home</button>
          <button onClick={() => navigate('/chat', { state: { username, token } })}>Chat</button>
          <button onClick={() => navigate('/email', { state: { username, token } })}>Email</button>
          <button onClick={() => navigate('/sms', { state: { username, token } })}>SMS</button>
          <button onClick={() => navigate('/voice', { state: { username, token } })}>Voice</button>
          <button onClick={() => navigate('/', {})}>Logout</button>
        </div>
        <h2>Welcome, { username }!</h2>
    </div>
  )
}


export default Dashboard
