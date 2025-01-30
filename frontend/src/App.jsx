import { useState } from 'react'
import './App.css'

import axios from 'axios'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import Dashboard from './Dashboard'
import ChatPage from './Chat'
import EmailPage from './Email'
import SMSPage from './SMS'
import VoicePage from './Voice'

function App() {
  const [identity, setIdentity] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!identity.trim()) {
      alert('Please enter a name')
      return
    }

    try {
      const response = await axios.post('http://localhost:5000/token', {
        identity: identity
      })
      console.log(identity)
      console.log(response.data.token)
      navigate('/dashboard', {
        state: {
          username: identity,
          token: response.data.token || response.data
        }
      })
    } catch (error) {
      console.error('Error making POST request:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='card'>
        <input className='input' type='text' placeholder='Enter your name' value={identity} onChange={(e) => setIdentity(e.target.value)}/>
        <button className='button-submit' type='submit'>Submit</button>
      </div>
    </form>
  )
}

function Root() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/email" element={<EmailPage />}/>
        <Route path="/sms" element={<SMSPage />}/>
        <Route path="/voice" element={<VoicePage />}/>
      </Routes>
    </Router>
  )
}

export default Root