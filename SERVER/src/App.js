// === client/src/App.js ===
import React, { useEffect, useState } from 'react';
import socket from './socket';

function App() {
  const [username, setUsername] = useState('');
  const [inputName, setInputName] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [typing, setTyping] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [privateRecipient, setPrivateRecipient] = useState('');
  const [privateMessage, setPrivateMessage] = useState('');
  const [privateMessages, setPrivateMessages] = useState([]);
  const [room, setRoom] = useState('');
  const [roomMessage, setRoomMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const playSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch((err) => console.error('Sound error:', err));
  };

  useEffect(() => {
    socket.on('connect', () => console.log('Connected:', socket.id));

    socket.on('chat message', (data) => {
      const newMsg = { ...data, id: Date.now() };
      setMessages((prev) => [...prev, newMsg]);

      if (!document.hasFocus()) {
        setUnreadCount((prev) => prev + 1);
        playSound();
      }

      if (document.hidden && Notification.permission === 'granted') {
        new Notification(`New message from ${data.username}`, {
          body: data.message.replace(/<[^>]*>?/gm, ''),
          icon: '/chat-icon.png',
        });
      }
    });

    socket.on('typing', (user) => {
      setTyping(user);
      setTimeout(() => setTyping(''), 2000);
    });

    socket.on('online users', (users) => setOnlineUsers(users));

    socket.on('private message', (data) => {
      setPrivateMessages((prev) => [...prev, data]);
      setNotifications((prev) => [...prev, { ...data, type: 'private' }]);
    });

    socket.on('reaction', ({ messageId, reaction }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, reaction } : msg))
      );
    });

    socket.on('notification', (note) => {
      setNotifications((prev) => [...prev, note]);
    });

    socket.on('message history', (msgs) => {
      setMessages((prev) => [...msgs, ...prev]);
    });

    socket.on('reconnect_attempt', () => {
      console.log('Trying to reconnect...');
    });

    socket.on('reconnect', () => {
      console.log('Reconnected!');
      if (username) socket.emit('user joined', username);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    return () => socket.disconnect();
  }, [username]);

  useEffect(() => {
    const resetUnread = () => setUnreadCount(0);
    window.addEventListener('focus', resetUnread);
    return () => window.removeEventListener('focus', resetUnread);
  }, []);

  useEffect(() => {
    document.title =
      unreadCount > 0 ? `(${unreadCount}) New Messages` : 'Real-Time Chat App';
  }, [unreadCount]);

  const handleLogin = () => {
    if (inputName.trim()) {
      setUsername(inputName);
      socket.emit('user joined', inputName);
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit(
        'chat message',
        { username, message, timestamp: new Date() },
        (ack) => console.log('Message status:', ack.status)
      );
      setMessage('');
    }
  };

  const handleTyping = () => {
    socket.emit('typing', username);
  };

  const sendPrivateMessage = () => {
    if (privateRecipient && privateMessage) {
      socket.emit('private message', {
        from: username,
        to: privateRecipient,
        message: privateMessage,
        timestamp: new Date(),
      });
      setPrivateMessage('');
    }
  };

  const joinRoom = () => {
    if (room) {
      socket.emit('join room', room);
    }
  };

  const sendRoomMessage = () => {
    if (room && roomMessage) {
      socket.emit('room message', {
        room,
        message: roomMessage,
        timestamp: new Date(),
        username,
      });
      setRoomMessage('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      socket.emit('chat message', {
        username,
        message: `<img src="${reader.result}" alt="shared" style="max-width:200px;" />`,
        timestamp: new Date(),
      });
    };
    if (file) reader.readAsDataURL(file);
  };

  const loadOlderMessages = () => {
    socket.emit('get messages', offset);
    setOffset(offset + 10);
  };

  const filteredMessages = messages.filter((msg) =>
    msg.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!username) {
    return (
      <div>
        <h2>Enter your username</h2>
        <input value={inputName} onChange={(e) => setInputName(e.target.value)} />
        <button onClick={handleLogin}>Join</button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <h2>Welcome, {username}</h2>
      {typing && <p><em>{typing} is typing...</em></p>}

      <div>
        <h4>Online Users:</h4>
        <ul>{onlineUsers.map((user, idx) => <li key={idx}>{user}</li>)}</ul>
      </div>

      <input
        placeholder="Search messages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button onClick={loadOlderMessages}>Load Older Messages</button>

      <div style={{ border: '1px solid #ccc', padding: 10, height: 300, overflowY: 'scroll', marginTop: 10 }}>
        {filteredMessages.map((msg, idx) => (
          <div key={idx}>
            <strong>{msg.username}</strong>:{' '}
            <span dangerouslySetInnerHTML={{ __html: msg.message }} />{' '}
            <em>({new Date(msg.timestamp).toLocaleTimeString()})</em>
            <button onClick={() => socket.emit('react', { messageId: msg.id, reaction: '❤️' })}>❤️</button>
            {msg.reaction && <span> {msg.reaction}</span>}
          </div>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          handleTyping();
        }}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
      <input type="file" onChange={handleFileChange} />

      <hr />

      <h3>Private Message</h3>
      <input placeholder="Recipient" value={privateRecipient} onChange={(e) => setPrivateRecipient(e.target.value)} />
      <input placeholder="Message" value={privateMessage} onChange={(e) => setPrivateMessage(e.target.value)} />
      <button onClick={sendPrivateMessage}>Send</button>
      <div>
        <h4>Private Messages</h4>
        {privateMessages.map((msg, idx) => (
          <div key={idx}>
            <strong>{msg.from}</strong>: {msg.message}{' '}
            <em>({new Date(msg.timestamp).toLocaleTimeString()})</em>
          </div>
        ))}
      </div>

      <hr />

      <h3>Join Room</h3>
      <input value={room} onChange={(e) => setRoom(e.target.value)} />
      <button onClick={joinRoom}>Join</button>

      <h3>Room Chat</h3>
      <input value={roomMessage} onChange={(e) => setRoomMessage(e.target.value)} />
      <button onClick={sendRoomMessage}>Send</button>

      <h4>Notifications</h4>
      <ul>
        {notifications.map((note, idx) => (
          <li key={idx}>
            {note.type === 'join' && <>👋 {note.from} joined {note.room}</>}
            {note.type === 'leave' && <>👋 {note.from} left {note.room}</>}
            {note.type === 'private' && (
              <>🔔 Private message from <strong>{note.from}</strong> at {new Date(note.timestamp).toLocaleTimeString()}</>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;

