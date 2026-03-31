import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message } from '../models/Message.js';

// Map to store userId -> socketId
const userSockets = new Map<string, string>();

export const setupSockets = (io: Server) => {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    
    // Store user socket
    userSockets.set(userId, socket.id);
    
    // Broadcast online status
    socket.broadcast.emit('user_online', { userId });

    socket.on('send_message', async (data: { receiverId: string; encryptedMessage: string; tempId?: string }) => {
      try {
        const { receiverId, encryptedMessage } = data;
        
        if (!receiverId || !encryptedMessage) return;

        // Save message to DB
        const newMessage = new Message({
          senderId: userId,
          receiverId,
          encryptedMessage,
          status: 'sent',
        });
        await newMessage.save();

        // Check if receiver is online
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          // Send to receiver
          io.to(receiverSocketId).emit('receive_message', {
            _id: newMessage._id,
            senderId: userId,
            receiverId,
            encryptedMessage,
            createdAt: newMessage.createdAt,
            status: 'delivered',
          });
          
          // Update status in DB
          newMessage.status = 'delivered';
          await newMessage.save();
        }

        // Acknowledge sender
        socket.emit('message_sent', {
          _id: newMessage._id,
          receiverId,
          status: receiverSocketId ? 'delivered' : 'sent',
          tempId: data.tempId, // For client to match
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      userSockets.delete(userId);
      io.emit('user_offline', { userId });
    });
  });
};
