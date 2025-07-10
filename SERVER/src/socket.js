// client/src/socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000/chat'); // Namespaced socket

export default socket;

