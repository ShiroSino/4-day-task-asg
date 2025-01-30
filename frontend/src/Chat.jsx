import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Client as ConversationsClient } from '@twilio/conversations'
import './Dashboard.css'

function ChatPage() {
    const location = useLocation()
    const navigate = useNavigate()

    // State management for Twilio Conversations
    const [client, setClient] = useState(null)
    const [conversations, setConversations] = useState([])
    const [currentConversation, setCurrentConversation] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [newConversationName, setNewConversationName] = useState('')

    const [newParticipant, setNewParticipant] = useState('')
    const [conversationParticipants, setConversationParticipants] = useState([])

    const [mediaFile, setMediaFile] = useState(null)
    const fileInputRef = useRef(null)

    // Access passed state
    const username = location.state?.username || 'Guest'
    const token = location.state?.token

    // Initialize Twilio Conversations Client
    useEffect(() => {
        const initializeClient = async () => {
            try {
                if (token) {
                    const conversationsClient = await ConversationsClient.create(token)
                    setClient(conversationsClient)

                    // Load user's conversations
                    const userConversations = await conversationsClient.getSubscribedConversations()
                    setConversations(userConversations.items)

                    // Optional: Set up client-level event listeners
                    conversationsClient.on('conversationAdded', (conversation) => {
                        setConversations(prev => [...prev, conversation])
                    })
                }
            } catch (error) {
                console.error('Failed to initialize Twilio Conversations:', error)
            }
        }

        initializeClient()
    }, [token])

    // Create Conversation Method
    const createConversation = async () => {
        if (!client || !newConversationName.trim()) return

        try {
            const conversation = await client.createConversation({
                friendlyName: newConversationName
            })

            // Add current user to conversation
            await conversation.add(username)

            // Update conversations list
            setConversations(prev => [...prev, conversation])
            
            // Reset input
            setNewConversationName('')
        } catch (error) {
            console.error('Conversation creation error:', error)
        }
    }

    // Modify selectConversation to load participants
    const selectConversation = async (conversation) => {
        try {
            setCurrentConversation(conversation)
            
            // Load conversation messages
            const conversationMessages = await conversation.getMessages()
            setMessages(conversationMessages.items)

            // Load conversation participants
            const participants = await conversation.getParticipants()
            setConversationParticipants(participants)

            // Set up message listeners
            conversation.on('messageAdded', (message) => {
                setMessages(prev => {
                    // Prevent duplicate messages
                    const exists = prev.some(msg => 
                        msg.sid === message.sid
                    )
                    return exists ? prev : [...prev, message]
                })
            })
        } catch (error) {
            console.error('Error loading conversation:', error)
        }
    }

    // Method to add participant to current conversation
    const addParticipantToConversation = async () => {
        if (!currentConversation || !newParticipant.trim()) return

        try {
            // Check if participant already exists
            const participants = await currentConversation.getParticipants()
            const existingParticipant = participants.find(
                p => p.identity === newParticipant
            )

            if (existingParticipant) {
                alert('Participant already exists in this conversation')
                return
            }

            // Add new participant
            await currentConversation.add(newParticipant)
            
            // Refresh participants list
            const updatedParticipants = await currentConversation.getParticipants()
            setConversationParticipants(updatedParticipants)

            // Reset input
            setNewParticipant('')
        } catch (error) {
            console.error('Error adding participant:', error)
            alert('Failed to add participant')
        }
    }

    // Send Message with Optional Media
    const sendMessage = async () => {
        if (!currentConversation) return

        try {
            // If media file exists, send with media
            if (mediaFile) {
                const mediaOptions = {
                    contentType: mediaFile.type,
                    filename: mediaFile.name,
                    media: mediaFile
                }

                await currentConversation.prepareMessage()
                    .setBody(newMessage || "Sent a file")
                    .addMedia(mediaOptions)
                    .build()
                    .send()

                // Reset media file
                setMediaFile(null)
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            } 
            // Send text message if no media
            else if (newMessage.trim()) {
                await currentConversation.sendMessage(newMessage)
            }

            // Reset input
            setNewMessage('')
        } catch (error) {
            console.error('Failed to send message:', error)
        }
    }
    

    // Handle File Selection
    const handleFileChange = (e) => {
        const file = e.target.files[0]
        
        // Optional: Add file size and type validation
        const maxSize = 50 * 1024 * 1024 // 50MB
        const allowedTypes = ['*/*']

        if (file) {
            if (file.size > maxSize) {
                alert('File is too large. Maximum size is 50MB')
                return
            }   

            setMediaFile(file)
        }
    }



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
    
            <div className='chat-container'>
                {/* Conversations List */}
                <div className='conversations-list'>
                    <h3>Conversations</h3>
                    {conversations.map(conv => (
                        <div 
                            key={conv.sid} 
                            onClick={() => selectConversation(conv)}
                            className='conversation-item'
                        >
                            {conv.friendlyName || 'Unnamed Conversation'}
                        </div>
                    ))}
    
                    {/* Add Conversation Input */}
                    <div className='add-conversation'>
                        <input 
                            type="text"
                            value={newConversationName}
                            onChange={(e) => setNewConversationName(e.target.value)}
                            placeholder="New Conversation Name"
                        />
                        <button 
                            onClick={createConversation}
                            disabled={!newConversationName.trim()}
                        >
                            Create Conversation
                        </button>
                    </div>
    
                    {/* Add Participant Input */}
                    <div className='add-participant'>
                        <input 
                            type="text"
                            value={newParticipant}
                            onChange={(e) => setNewParticipant(e.target.value)}
                            placeholder="Add Participant"
                        />
                        <button 
                            onClick={addParticipantToConversation}
                            disabled={!newParticipant.trim()}
                        >
                            Add Participant
                        </button>
                    </div>
                </div>
    
                {/* Messages Area */}
                <div className='messages-area'>
                    {currentConversation ? (
                        <>
                            <h2>
                                {currentConversation.friendlyName || 'Current Conversation'}
                            </h2>
                            <div className='messages-list'>
                                {messages.map((msg, index) => (
                                    <div 
                                        key={msg.sid || index} 
                                        className={`message ${msg.author === username ? 'sent' : 'received'}`}
                                    >
                                        <strong>{msg.author}: </strong>
                                        {msg.body}
                                        
                                        {msg.attachedMedia && msg.attachedMedia.length > 0 && (
                                            <div className='attached-files'>
                                                {msg.attachedMedia.map((media, mediaIndex) => (
                                                    <div 
                                                        key={mediaIndex}
                                                        onClick={() => {
                                                            // Create temporary download link
                                                            const link = document.createElement('a')
                                                            link.href = media.url
                                                            link.download = media.filename || `file-${mediaIndex}`
                                                            document.body.appendChild(link)
                                                            link.click()
                                                            document.body.removeChild(link)
                                                        }}
                                                        className='file-download'
                                                    >
                                                        📄 {media.filename || `File ${mediaIndex + 1}`}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                            </div>
                            
                            <div className='message-input'>
                                {/* File Input */}
                                <input 
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                                
                                {/* File Preview */}
                                {mediaFile && (
                                    <div className='file-preview'>
                                        <span>{mediaFile.name}</span>
                                        <button onClick={() => {
                                            setMediaFile(null)
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = ''
                                            }
                                        }}>
                                            ✖
                                        </button>
                                    </div>
                                )}
    
                                <input 
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                />
                                
                                {/* File Selection Button */}
                                <button 
                                    onClick={() => fileInputRef.current.click()}
                                >
                                Attach file
                                </button>
    
                                <button onClick={sendMessage}>Send</button>
                            </div>
                        </>
                    ) : (
                        <p>Select a conversation to start messaging</p>
                    )}
                </div>
            </div>
        </div>
    )
    
}

export default ChatPage
