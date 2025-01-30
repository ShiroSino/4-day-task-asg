import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNavigate, useLocation } from 'react-router-dom';
import './Dashboard.css';

const socket = io('http://localhost:5000'); // Ensure this matches your server's URL

function SMSPage() {
  const location = useLocation();
  
  // Access passed state
  const username = location.state?.username || 'Guest';
  const token = location.state?.token;

  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState(''); // State for media URL
  const [messages, setMessages] = useState([]); // Store both sent and received messages

  const navigate = useNavigate();

  // Fetch all messages (sent and received) when the component mounts
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('http://localhost:5000/messages', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}` // Include token if needed
          },
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages); // Load all messages into state
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();

    // Handle incoming messages via Socket.IO
    socket.on('new_message', (msg) => {
      console.log('New message received:', msg);
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    // Cleanup on component unmount
    return () => {
      socket.off('new_message');
    };
  }, [token]);

  // Send SMS function with media URL support
  const sendSMS = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:5000/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Include token if needed
        },
        body: JSON.stringify({ to, body: message, mediaUrl }), // Include mediaUrl in request
      });

      if (response.ok) {
        alert('SMS sent successfully!');

        // Clear input fields after sending
        setMessage('');
        setTo('');
        setMediaUrl(''); // Clear media URL input after sending

        // No need to manually add the sent message here since it's now persisted in the backend.
      } else {
        alert('Failed to send SMS.');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      alert('Error sending SMS.');
    }
  };

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

      <div className='sms-container'>
        <h2>Send SMS/MMS</h2>
        <form onSubmit={sendSMS}>
          <input 
            type="text" 
            placeholder="Recipient's Phone Number" 
            value={to} 
            onChange={(e) => setTo(e.target.value)} 
            required 
          />
          <textarea 
            placeholder="Type your message here..." 
            value={message} 
            onChange={(e) => setMessage(e.target.value)} 
            required 
          />
          <input 
            type="text" 
            placeholder="Attachment URL (optional)" 
            value={mediaUrl} 
            onChange={(e) => setMediaUrl(e.target.value)} 
          />
          <button type="submit">Send</button>
        </form>

        <h2>Inbox (Sent and Received Messages)</h2>
        <ul>
          {messages.map((msg, index) => (
            <li key={index}>
              <strong>{msg.from}:</strong> {msg.body}
              {msg.mediaUrl && <img src={msg.mediaUrl} alt="Attachment" style={{ maxWidth: '200px' }} />} {/* Display image if available */}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default SMSPage;
