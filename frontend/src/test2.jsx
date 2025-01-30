import { useLocation } from 'react-router-dom'

function NextPage() {
  const location = useLocation()
  
  // Access passed state
  const username = location.state?.username || 'Guest'
  const token = location.state?.token

  return (
    <div>
      <h1>Welcome, {username}!</h1>
      {token && <p>Token received successfully</p>}
    </div>
  )
}

export default NextPage
