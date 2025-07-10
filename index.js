// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

let onlineUsers = new Set();
let userSockets = {}; // username -> socket.id
let messageHistory = [];

app.use(cors());

app.get('/', (req, res) => {
  res.send('Server is running');
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user joined', (username) => {
    socket.username = username;
    userSockets[username] = socket.id;
    onlineUsers.add(username);

    io.emit('online users', Array.from(onlineUsers));
    io.emit('chat message', {
      username: 'System',
      message: `${username} has joined the chat`,
      timestamp: new Date()
    });
  });

  socket.on('chat message', (data, callback) => {
    messageHistory.push(data);
    io.emit('chat message', data);

    if (callback) {
      callback({ status: 'delivered', timestamp: new Date() });
    }

    io.emit('notification', {
      type: 'message',
      from: data.username,
      timestamp: new Date()
    });
  });

  socket.on('get messages', (offset = 0) => {
    const pageSize = 10;
    const messages = messageHistory.slice(-offset - pageSize, -offset || undefined);
    socket.emit('message history', messages);
  });

  socket.on('private message', ({ from, to, message, timestamp }) => {
    const targetSocketId = userSockets[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', { from, message, timestamp });
      io.to(targetSocketId).emit('notification', {
        type: 'private',
        from,
        timestamp
      });
    }
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('typing', username);
  });

  socket.on('join room', (room) => {
    socket.join(room);
    socket.currentRoom = room;

    socket.to(room).emit('notification', {
      type: 'join',
      from: socket.username,
      room,
      timestamp: new Date()
    });

    socket.to(room).emit('chat message', {
      username: 'System',
      message: `${socket.username} joined ${room}`,
      timestamp: new Date()
    });
  });

  socket.on('room message', ({ room, message, timestamp, username }) => {
    io.to(room).emit('chat message', { username, message, timestamp });
  });

  socket.on('react', ({ messageId, reaction }) => {
    io.emit('reaction', { messageId, reaction });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      delete userSockets[socket.username];

      io.emit('online users', Array.from(onlineUsers));
      io.emit('chat message', {
        username: 'System',
        message: `${socket.username} has left the chat`,
        timestamp: new Date()
      });

      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('notification', {
          type: 'leave',
          from: socket.username,
          room: socket.currentRoom,
          timestamp: new Date()
        });
      }
    }

    console.log('User disconnected:', socket.id);
  });
});

// Optional: Dedicated namespace for future modularity
// const chatNamespace = io.of('/chat');
// chatNamespace.on('connection', (socket) => {
//   console.log('User connected to /chat');
// });

server.listen(5000, () => {
  console.log('✅ Server is running on http://localhost:5000');
});

