import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Dashboard.css';

function EmailPage() {
  const location = useLocation();
  
  // Access passed state
  const username = location.state?.username || 'Guest';
  const token = location.state?.token;

  const navigate = useNavigate();

  // State for email composition
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);

  // State for inbox emails
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null); // To hold the currently selected email

  // Function to handle email submission
  const handleSendEmail = async (e) => {
    e.preventDefault();

    // Create a JSON object for the email data
    const emailData = {
      to,
      cc,
      bcc,
      subject,
      text: body,
      attachments: Array.from(attachments).map(file => file.name), // Send file names or handle files differently if needed
    };

    try {
      const response = await fetch('http://localhost:5000/send-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json', // Set content type to JSON
        },
        body: JSON.stringify(emailData), // Convert the email data to JSON string
      });

      if (response.ok) {
        alert('Email sent successfully!');
        // Clear the form fields after sending
        setTo('');
        setCc('');
        setBcc('');
        setSubject('');
        setBody('');
        setAttachments([]);
      } else {
        console.error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  // Function to handle file input change
  const handleFileChange = (e) => {
    setAttachments([...e.target.files]); // Store selected files in state
  };

  // Function to fetch emails from backend
  const fetchEmails = async () => {
    try {
      const response = await fetch('http://localhost:5000/emails', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }

      const data = await response.json();
      setEmails(data.messages); // Assuming data.messages contains detailed email information
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
  };

  // Fetch emails when component mounts
  useEffect(() => {
    fetchEmails();
  }, []);

  // Function to handle email selection
  const handleEmailClick = (email) => {
    setSelectedEmail(email); // Set the selected email to display its details
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

      <div className='email-container'>
        <div className='inbox-container'>
          {/* Inbox content can go here */}
          <h2>Inbox</h2>
          <ul>
            {emails.map(email => (
              <li key={email.id} onClick={() => handleEmailClick(email)}>
                <strong>From:</strong> {getHeader(email.payload.headers, 'From')}<br />
                <strong>Subject:</strong> {email.payload.headers.find(header => header.name === 'Subject')?.value || 'No Subject'}
              </li>
            ))}
          </ul>
        </div>

        <div className='compose-preview-container'>
          {/* Compose Email Form */}
          <div className='compose-container'>
            <h2>Compose Email</h2>
            <form onSubmit={handleSendEmail}>
              <div className='form-group'>
                <label htmlFor='to'>To:</label>
                <input type='email' id='to' value={to} onChange={(e) => setTo(e.target.value)} required />
              </div>

              <div className='form-group'>
                <label htmlFor='cc'>CC:</label>
                <input type='text' id='cc' value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>

              <div className='form-group'>
                <label htmlFor='bcc'>BCC:</label>
                <input type='text' id='bcc' value={bcc} onChange={(e) => setBcc(e.target.value)} />
              </div>

              <div className='form-group'>
                <label htmlFor='subject'>Subject:</label>
                <input type='text' id='subject' value={subject} onChange={(e) => setSubject(e.target.value)} required />
              </div>

              <div className='form-group'>
                <label htmlFor='body'>Body:</label>
                <textarea id='body' value={body} onChange={(e) => setBody(e.target.value)} required />
              </div>

              {/* File Upload for Attachments */}
              <div className='form-group-attachment'>
                <label htmlFor='attachments'>Attachments:</label>
                <input type='file' id='attachments' multiple onChange={handleFileChange} />
                {/* Display selected file names */}
                {attachments.length > 0 && (
                  <ul className="attachment-list">
                    {Array.from(attachments).map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                )}
              </div>

              <button type='submit'>Send Email</button>
            </form>
          </div>

          {/* Preview container */}
          <div className='preview-container'>
            {/* Placeholder for preview content */}
            <h2>Preview</h2>
            {selectedEmail ? (
              <>
                <p><strong>From:</strong> {getHeader(selectedEmail.payload.headers, 'From')}</p>
                <p><strong>Subject:</strong> {getHeader(selectedEmail.payload.headers, 'Subject')}</p>
                <p><strong>Body:</strong> {selectedEmail.snippet}</p>

                {/* Display attachments */}
                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <>
                    <h3>Attachments:</h3>
                    <ul>
                      {selectedEmail.attachments.map((attachment, index) => (
                        <li key={index}>
                          <a 
                            href={`http://localhost:5000/download/${selectedEmail.id}/${attachment.partId}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            {attachment.filename || `Attachment ${index + 1}`}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p>Select an email to see details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to extract specific headers like "From" or "Subject"
function getHeader(headers, name) {
  const header = headers.find(header => header.name === name);
  return header ? header.value : 'Unknown';
}

export default EmailPage;
