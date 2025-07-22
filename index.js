const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Change this to your domain if needed
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.static('public'));

// In-memory user store (for now)
const users = {};

function updateUserList() {
  io.emit('user list', Object.values(users).map(u => u.username));
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('login', ({ username, role }) => {
    users[socket.id] = { username, role, isPerforming: false };
    socket.broadcast.emit('chat message', { username: 'System', message: `${username} joined the chat.` });
    updateUserList();
  });

  socket.on('chat message', (data) => {
    const user = users[socket.id];
    if (user) {
      console.log('Message:', data);
      io.emit('chat message', { ...data, role: user.role });
    }
  });

  socket.on('whisper', ({ to, message }) => {
    const fromUser = users[socket.id];
    const toSocketId = Object.keys(users).find(id => users[id].username === to);
    if (fromUser && toSocketId) {
      io.to(toSocketId).emit('chat message', { username: `${fromUser.username} (whisper)`, message });
      socket.emit('chat message', { username: `(whisper to ${to})`, message });
    } else {
      socket.emit('chat message', { username: 'System', message: `Could not find user ${to}.` });
    }
  });

  socket.on('tip', ({ to, amount }) => {
    const fromUser = users[socket.id];
    const toSocketId = Object.keys(users).find(id => users[id].username === to && users[id].role === 'model');
    if (fromUser && toSocketId) {
      // In a real application, you would process the payment here.
      console.log(`${fromUser.username} tipped ${to} $${amount}`);
      io.to(toSocketId).emit('chat message', { username: 'System', message: `You received a $${amount} tip from ${fromUser.username}!` });
      socket.emit('chat message', { username: 'System', message: `You tipped ${to} $${amount}.` });
    } else {
      socket.emit('chat message', { username: 'System', message: `Could not find model ${to}.` });
    }
  });

  socket.on('start performance', () => {
    const user = users[socket.id];
    if (user && user.role === 'model') {
      user.isPerforming = true;
      io.emit('chat message', { username: 'System', message: `${user.username} has started a performance!` });
    }
  });

  socket.on('stop performance', () => {
    const user = users[socket.id];
    if (user && user.role === 'model') {
      user.isPerforming = false;
      io.emit('chat message', { username: 'System', message: `${user.username} has ended the performance.` });
    }
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      io.emit('chat message', { username: 'System', message: `${user.username} left.` });
      delete users[socket.id];
      updateUserList();
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
