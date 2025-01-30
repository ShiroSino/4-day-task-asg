import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import './Dashboard.css'

function Dashboard() {
  const location = useLocation()
  
  // Access passed state
  const username = location.state?.username || 'Guest'
  const token = location.state?.token

  const navigate = useNavigate()

  const HomePage = () => {
    navigate('/dashboard', {
        state: {
            username: username,
            token: token
        }
    })
  }

  const ChatPage = () => {
    navigate('/chat', {
        state: {
            username: username,
            token: token
        }
    })
  }

  return (
    <div className='background'>
        <div className='header'>
            <button onClick={HomePage}>Home</button>
            <button onClick={ChatPage}>Chat</button>
        </div>
        <Outlet />
    </div>
  )
}


export default Dashboard
