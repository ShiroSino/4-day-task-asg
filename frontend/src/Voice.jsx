import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AgoraRTC from "agora-rtc-sdk-ng";
import axios from 'axios'; // Import axios for making HTTP requests
import "./Dashboard.css";

function VoicePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Access passed state
  const username = location.state?.username || "Guest";
  const token = location.state?.token;

  const APP_ID = "c02d13d135e94fa58f7feab502155bae"; // Your Agora App ID
  const AGORA_Token = null; // Token is optional in testing mode
  const rtcUid = Math.floor(Math.random() * 2032); // Random UID for testing

  const [channelName, setChannelName] = useState(""); // State for channel name
  const [client] = useState(() => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }));
  const [isJoined, setIsJoined] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState({}); // State to track remote users
  const [localUserId, setLocalUserId] = useState(null); // Track your own assigned UID

  // For Twilio Call
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callMessage, setCallMessage] = useState('');

  // Join the channel and publish audio track
  const joinChannel = async () => {
    try {
      // Join the channel with a specific UID (rtcUid)
      const assignedUid = await client.join(APP_ID, channelName, AGORA_Token, rtcUid);
      console.log("Joined channel successfully with UID:", assignedUid);

      // Update local user ID with the Agora-assigned UID
      setLocalUserId(assignedUid);

      // Create microphone audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      setLocalAudioTrack(audioTrack);

      // Publish the audio track to the channel
      await client.publish([audioTrack]);
      console.log("Published local audio track!");

      setIsJoined(true);

      // Add yourself to remote users list (using Agora-assigned UID)
      setRemoteUsers((prev) => ({ ...prev, [assignedUid]: { uid: assignedUid } }));
    } catch (error) {
      console.error("Failed to join channel:", error);
    }
  };

  // Leave the channel and clean up resources
  const leaveChannel = async () => {
    try {
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }

      await client.unpublish(); // Unpublish local audio track
      await client.leave(); // Leave the channel
      console.log("Left the channel successfully!");
      setIsJoined(false);
      setRemoteUsers({}); // Clear remote users on leave
    } catch (error) {
      console.error("Failed to leave channel:", error);
    }
  };

  // Listen for user events
  useEffect(() => {
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      console.log("User published:", user.uid);

      if (mediaType === "audio") {
        setRemoteUsers((prev) => ({ ...prev, [user.uid]: user })); // Add user to remote users list
        if (user.audioTrack) user.audioTrack.play(); // Play remote user's audio track
      }
    });

    client.on("user-left", (user) => {
      console.log("User left:", user.uid);
      setRemoteUsers((prev) => {
        const updatedUsers = { ...prev };
        delete updatedUsers[user.uid]; // Remove user from remote users list
        return updatedUsers;
      });
    });

    return () => {
      client.off("user-published");
      client.off("user-left");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (isJoined) leaveChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to make a Twilio call
  const makeCall = async () => {
    try {
      const response = await axios.post('http://localhost:5000/make-call', { to: phoneNumber });
      setCallMessage(`Call initiated successfully! SID: ${response.data.sid}`);
    } catch (error) {
      console.error(error);
      setCallMessage('Failed to initiate call.');
    }
  };

  return (
    <div className="background">
      <div className="header">
        <button onClick={() => navigate('/dashboard', { state: { username, token } })}>Home</button>
        <button onClick={() => navigate('/chat', { state: { username, token } })}>Chat</button>
        <button onClick={() => navigate('/email', { state: { username, token } })}>Email</button>
        <button onClick={() => navigate('/sms', { state: { username, token } })}>SMS</button>
        <button onClick={() => navigate('/voice', { state: { username, token } })}>Voice</button>
        <button onClick={() => navigate('/', {})}>Logout</button>
      </div>

      <div className="main-voice-container">
        <div className="user-list">
          <h3>Remote Users:</h3>
          <ul>
            {/* Include yourself in the list */}
            {localUserId && <li>Your ID: {localUserId}</li>}
            {Object.keys(remoteUsers).map((uid) =>
              uid !== localUserId ? (
                <li key={uid}>User ID: {uid}</li>
              ) : null
            )}
          </ul>
        </div>

        <div className="voice-and-call">
          <div className="voice-agora">
            <h3>Agora Voice Call:</h3>
            {/* Input for Channel Name */}
            <input 
              type="text" 
              value={channelName} 
              onChange={(e) => setChannelName(e.target.value)} 
              placeholder="Enter Channel Name"
            />
            <div className="voice-controls">
              {!isJoined ? (
                <button className="join-button" onClick={joinChannel}>
                  Join Voice Channel
                </button>
              ) : (
                <button className="leave-button" onClick={leaveChannel}>
                  Leave Voice Channel
                </button>
              )}
            </div>
          </div>

          <div className="call-twilio">
            <h3>Twilio Call:</h3>
            <input 
              type="tel" 
              value={phoneNumber} 
              onChange={(e) => setPhoneNumber(e.target.value)} 
              placeholder="Enter phone number"
              required 
            />
            <div className="twilio-call-button">
                <button onClick={makeCall}>Call</button>
            </div>
            {callMessage && <p>{callMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VoicePage;
