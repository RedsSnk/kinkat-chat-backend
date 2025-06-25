const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const cookie = require('cookie');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true, credentials: true }));
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const db = mysql.createPool({
  host: 'localhost',
  user: 'kinkatro_flarumuser',
  password: 'AmxxPass55',
  database: 'kinkatro_flarumdatab'
});

// Simple health endpoint
app.get('/', (req, res) => res.send('Chat backend is running'));

// Chat handling
io.use(async (socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    if (!cookies.flarum_session) return next(new Error('Not logged in'));

    const [rows] = await db.query(
      'SELECT user_id FROM sessions WHERE id = ?',
      [cookies.flarum_session]
    );
    if (!rows.length) return next(new Error('Session invalid'));

    const [users] = await db.query(
      'SELECT id, username FROM users WHERE id = ? AND is_activated=1',
      [rows[0].user_id]
    );
    if (!users.length) return next(new Error('User not found'));

    socket.user = { id: users[0].id, username: users[0].username };
    next();
  } catch (e) {
    next(new Error('Auth error'));
  }
});

io.on('connection', (socket) => {
  io.emit('chat message', { username: 'System', message: `${socket.user.username} joined the chat.` });

  socket.on('chat message', ({ message }) => {
    io.emit('chat message', { username: socket.user.username, message });
  });

  socket.on('disconnect', () => {
    io.emit('chat message', { username: 'System', message: `${socket.user.username} left.` });
  });
});

server.listen(process.env.PORT || 3000, () => console.log('Server started'));
