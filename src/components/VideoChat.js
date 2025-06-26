import React, { useRef, useEffect, useState } from 'react';

const SIGNAL_SERVER_URL = 'ws://localhost:5000'; // Change to your server URL when deploying
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function VideoChat() {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef();
  const ws = useRef();
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    ws.current = new window.WebSocket(SIGNAL_SERVER_URL);
    let localStream;

    ws.current.onopen = () => {
      setStatus('Connected to signaling server. Waiting for peer...');
      console.log('WebSocket connection opened');
    };

    ws.current.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      console.log('WebSocket message received:', data);
      if (data.type === 'waiting') {
        setStatus('Waiting for another user to join...');
      } else if (data.type === 'match') {
        setStatus('Peer found! Starting video chat...');
        console.log('Peer matched, starting as caller');
        start(true);
      } else if (data.type === 'offer') {
        setStatus('Received offer. Connecting...');
        console.log('Received offer:', data.offer);
        await start(false);
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        ws.current.send(JSON.stringify({ type: 'answer', answer }));
        console.log('Sent answer:', answer);
      } else if (data.type === 'answer') {
        console.log('Received answer:', data.answer);
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.type === 'candidate') {
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('Added ICE candidate:', data.candidate);
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      } else if (data.type === 'leave') {
        setStatus('Peer disconnected. Refresh to start again.');
        if (remoteVideo.current) remoteVideo.current.srcObject = null;
        if (pc.current) pc.current.close();
        console.log('Peer disconnected');
      }
    };

    async function start(isCaller) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideo.current) localVideo.current.srcObject = localStream;
        console.log('Got local media stream');
        pc.current = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        localStream.getTracks().forEach(track => pc.current.addTrack(track, localStream));
        pc.current.ontrack = (event) => {
          if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
          console.log('Received remote stream');
        };
        pc.current.onicecandidate = (event) => {
          if (event.candidate) {
            ws.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            console.log('Sent ICE candidate:', event.candidate);
          }
        };
        pc.current.onconnectionstatechange = () => {
          console.log('PeerConnection state:', pc.current.connectionState);
        };
        if (isCaller) {
          const offer = await pc.current.createOffer();
          await pc.current.setLocalDescription(offer);
          ws.current.send(JSON.stringify({ type: 'offer', offer }));
          console.log('Sent offer:', offer);
        }
      } catch (err) {
        console.error('Error in start():', err);
      }
    }

    ws.current.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      if (ws.current) ws.current.close();
      if (pc.current) pc.current.close();
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      console.log('Cleanup on component unmount');
    };
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      <h2>Omegle-like Video Chat</h2>
      <p>{status}</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
        <div>
          <video ref={localVideo} autoPlay playsInline muted style={{ width: 300, background: '#222' }} />
          <div>Me</div>
        </div>
        <div>
          <video ref={remoteVideo} autoPlay playsInline style={{ width: 300, background: '#222' }} />
          <div>Stranger</div>
        </div>
      </div>
    </div>
  );
} 