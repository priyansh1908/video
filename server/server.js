const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 5000 });

let waiting = null;

wss.on('connection', function connection(ws) {
  console.log('New user connected');
  if (waiting) {
    // Pair the two users
    ws.other = waiting;
    waiting.other = ws;
    waiting.send(JSON.stringify({ type: 'match' }));
    ws.send(JSON.stringify({ type: 'match' }));
    console.log('Two users paired');
    waiting = null;
  } else {
    waiting = ws;
    ws.send(JSON.stringify({ type: 'waiting' }));
    console.log('User is waiting for a peer');
  }

  ws.on('message', function incoming(message) {
    console.log('Received message:', message.toString());
    // Relay signaling messages to the other peer
    if (ws.other && ws.other.readyState === WebSocket.OPEN) {
      ws.other.send(message);
      console.log('Relayed message to peer');
    } else {
      console.log('No peer to relay message to');
    }
  });

  ws.on('close', function () {
    console.log('User disconnected');
    if (ws.other) {
      ws.other.send(JSON.stringify({ type: 'leave' }));
      ws.other.other = null;
      console.log('Notified peer of disconnect');
    }
    if (waiting === ws) {
      waiting = null;
      console.log('Waiting user disconnected');
    }
  });

  ws.on('error', function (err) {
    console.error('WebSocket error:', err);
  });
});

console.log('WebSocket signaling server running on ws://localhost:5000'); 