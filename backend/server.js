const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const sgMail = require('@sendgrid/mail')
const multer = require('multer')
require('dotenv').config();

const app = express();

// Google API for GMAIL/EMAIL Function
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const http = require('http')
const { Server } = require('socket.io')
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Adjust this to match your React app's URL
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Configure Multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

// Client for SMS
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// Receiving SMS
const { MessagingResponse } = require('twilio').twiml;
// Store all messages (both sent and received)
let allMessages = [];

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Twilio Access Token Generation
app.post('/token', (req, res) => {
  const { identity } = req.body;
  
  const AccessToken = twilio.jwt.AccessToken;
  const ChatGrant = AccessToken.ChatGrant;

  const chatGrant = new ChatGrant({
    serviceSid: process.env.TWILIO_CHAT_SERVICE_SID
  });

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity: identity }
  );

  token.addGrant(chatGrant);
  res.send({ token: token.toJwt() });
});

// Gmail / GoogleAPI Auth
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

// Set credentials
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN // Store this securely
});

// Function to send email
async function sendEmail(to, subject, text, cc = '', bcc = '', attachments = []) {
  try {
      const accessToken = await oauth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              type: 'OAuth2',
              user: process.env.GMAIL_USER, // Your Gmail address
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
              accessToken: accessToken.token,
          },
      });

      const mailOptions = {
          from: process.env.GMAIL_USER,
          to,
          subject,
          text,
          cc,
          bcc,
          attachments: attachments.map(file => ({
              filename: file.filename,
              path: file.path // Can be a local path or a URL
          })),
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent:', result);
      return result;
  } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
  }
}

// Example endpoint to send an email with attachments
app.post('/send-email', async (req, res) => {
  const { to, subject, text, cc, bcc, attachments } = req.body;
  try {
      const result = await sendEmail(to, subject, text, cc, bcc, attachments);
      res.status(200).json({ message: 'Email sent successfully', result });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});


// Sort only received emails
async function getUserEmail() {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({
    userId: 'me',
  });
  return profile.data.emailAddress;
}

// Function to get email details by ID
async function getEmailDetails(messageId) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full', // Request full format to include attachments
  });

  return res.data;
}

// Function to list emails with details including attachments
async function listEmailsWithDetails() {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Get the user's email address
  const userEmail = await getUserEmail();

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 10,
  });

  const messages = res.data.messages || [];

  const detailedMessages = await Promise.all(
    messages.map(async (message) => {
      const details = await getEmailDetails(message.id);

      // Extract sender's email using getHeader
      const senderEmail = getHeader(details.payload.headers, 'From');

      // Check if the sender is not the user's own email
      if (senderEmail.includes(userEmail)) {
        return null; // Exclude sent messages
      }

      // Extract attachments from the email parts
      const attachments = [];
      if (details.payload?.parts) {
        traverseParts(details.payload.parts, attachments, message.id);
      }

      return {
        id: message.id,
        threadId: message.threadId,
        snippet: details.snippet,
        payload: details.payload,
        attachments, // Attachments with metadata
      };
    })
  );

  // Filter out null values (sent messages)
  return detailedMessages.filter(message => message !== null);
}

// Helper function to traverse parts and extract attachments
function traverseParts(parts, attachments, messageId, parentPartId = '') {
  parts.forEach((part, index) => {
    // Generate a custom part ID based on hierarchy
    const partId = parentPartId ? `${parentPartId}.${index}` : `${index}`;

    if (part.filename && part.body?.attachmentId) {
      // This is an attachment
      attachments.push({
        filename: part.filename || `UnknownAttachment-${attachments.length + 1}`,
        attachmentId: part.body.attachmentId,
        mimeType: part.mimeType || 'application/octet-stream',
        messageId: messageId,
        partId: partId, // Custom part ID
      });
    }

    // Recursively process nested parts
    if (part.parts) {
      traverseParts(part.parts, attachments, messageId, partId);
    }
  });
}


// Example endpoint to fetch emails with details
app.get('/emails', async (req, res) => {
  try {
    const messages = await listEmailsWithDetails();
    res.status(200).json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/download/:messageId/:partId', async (req, res) => {
  try {
    const { messageId, partId } = req.params;

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch the latest email details
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    // Find the attachment part using partId
    const attachmentPart = message.data.payload.parts.find(
      (part) => part.partId === partId
    );

    if (!attachmentPart || !attachmentPart.body.attachmentId) {
      return res.status(404).send('Attachment not found');
    }

    const filename = attachmentPart.filename || 'unknown_attachment';

    // Fetch the actual attachment data
    const attachmentResponse = await gmail.users.messages.attachments.get({
      userId: 'me',
      id: attachmentPart.body.attachmentId,
      messageId,
    });

    // Decode base64-encoded data
    const fileData = Buffer.from(attachmentResponse.data.data, 'base64');

    // Set appropriate headers for file download
    res.setHeader('Content-Type', attachmentPart.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send the file data as response
    res.send(fileData);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).send('Error downloading attachment');
  }
});

// Utility function to extract a specific header value
function getHeader(headers, name) {
  const header = headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : ''; // Return the value if found, otherwise return an empty string
}



// Endpoint to send SMS or MMS
app.post('/send-sms', async (req, res) => {
  const { to, body, mediaUrl } = req.body; // Accept mediaUrl from the client

  try {
    const messageOptions = {
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    };

    // Add mediaUrl if provided
    if (mediaUrl) {
      messageOptions.mediaUrl = Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl];
    }

    const message = await client.messages.create(messageOptions);

    // Save the sent message in local storage
    const sentMessage = { from: 'You', to: to, body: body, mediaUrl };
    allMessages.push(sentMessage);

    // Emit the sent message to all connected clients
    io.emit('new_message', sentMessage); // Emit the new message


    res.status(200).json({ message: 'Message sent successfully', sid: message.sid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// Endpoint to receive SMS
app.post('/sms', (req, res) => {
  const twiml = new MessagingResponse();
  const fromNumber = req.body.From;
  const messageBody = req.body.Body;

  // Store the message
  const receivedMessage = { from: fromNumber, body: messageBody };
  allMessages.push(receivedMessage);

  // Emit the message to connected clients
  io.emit('new_message', receivedMessage);

  // Respond to Twilio
  // twiml.message('Thank you for your message!');
  // res.type('text/xml').send(twiml.toString());
});

// Endpoint to fetch all received messages
app.get('/messages', (req, res) => {
  res.json({ messages: allMessages });
});

// Endpoint to make a call
app.post('/make-call', async (req, res) => {
  const { to } = req.body; // The phone number to call

  try {
    const call = await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml', // URL for TwiML instructions
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
    });

    res.status(200).json({ message: 'Call initiated successfully', sid: call.sid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to initiate call.' });
  }
});

// Endpoint to receive calls
app.post('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Respond with a simple message or menu options
  twiml.say('Hello! Thank you for calling. Please leave a message after the beep.');
  twiml.record({
    maxLength: 30,
    action: '/handle-recording', // Endpoint to handle the recording after it's done
    transcribe: true,
    transcribeCallback: '/transcription', // Optional: endpoint for transcription callback
  });

  res.type('text/xml').send(twiml.toString());
});

// Handle the recording after it's done
app.post('/handle-recording', (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  
  console.log('Recording URL:', recordingUrl);
  
  // You can store this URL in your database or send it somewhere else as needed

  res.sendStatus(200);
});



const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});