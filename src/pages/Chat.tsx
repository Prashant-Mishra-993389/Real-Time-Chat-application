import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { getPrivateKey } from '../utils/db';
import { Search, Send, LogOut, User as UserIcon, Shield, MessageSquare, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  _id: string;
  username: string;
  publicKey: string;
}

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  encryptedMessage: string;
  decryptedMessage?: string;
  createdAt: string;
  status: string;
  tempId?: string;
}

export const Chat: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { socket, onlineUsers } = useSocket();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadKey = async () => {
      if (user) {
        const key = await getPrivateKey(user.id);
        setPrivateKey(key || null);
        setLoading(false);
      }
    };
    loadKey();
  }, [user]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/users/recent', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRecentUsers(data);
        }
      } catch (error) {
        console.error('Failed to fetch recent users', error);
      }
    };
    if (token) fetchRecent();
  }, [token]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?username=${searchQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (error) {
        console.error('Search error', error);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, token]);

  useEffect(() => {
    if (!selectedUser || !token || !privateKey) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${selectedUser._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: Message[] = await res.json();
          
          const decryptedMessages = await Promise.all(
            data.map(async (msg) => {
              if (msg.senderId === user?.id) {
                return { ...msg, decryptedMessage: '[Sent Message - E2EE]' };
              } else {
                const decrypted = await decryptMessage(msg.encryptedMessage, privateKey);
                return { ...msg, decryptedMessage: decrypted };
              }
            })
          );
          setMessages(decryptedMessages);
          scrollToBottom();
        }
      } catch (error) {
        console.error('Fetch messages error', error);
      }
    };

    fetchMessages();
  }, [selectedUser, token, privateKey, user?.id]);

  useEffect(() => {
    if (!socket || !privateKey) return;

    const handleReceiveMessage = async (msg: Message) => {
      if (selectedUser && (msg.senderId === selectedUser._id || msg.receiverId === selectedUser._id)) {
        let decrypted = '[Sent Message - E2EE]';
        if (msg.receiverId === user?.id) {
          decrypted = await decryptMessage(msg.encryptedMessage, privateKey);
        }
        
        setMessages((prev) => [...prev, { ...msg, decryptedMessage: decrypted }]);
        scrollToBottom();
      }
    };

    const handleMessageSent = (data: any) => {
      setMessages((prev) => 
        prev.map(msg => msg.tempId === data.tempId ? { ...msg, _id: data._id, status: data.status } : msg)
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent', handleMessageSent);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent', handleMessageSent);
    };
  }, [socket, selectedUser, privateKey, user?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !socket) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      const encrypted = await encryptMessage(messageText, selectedUser.publicKey);
      const tempId = Date.now().toString();

      const optimisticMsg: Message = {
        _id: tempId,
        senderId: user!.id,
        receiverId: selectedUser._id,
        encryptedMessage: encrypted,
        decryptedMessage: messageText,
        createdAt: new Date().toISOString(),
        status: 'sending',
        tempId,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();

      socket.emit('send_message', {
        receiverId: selectedUser._id,
        encryptedMessage: encrypted,
        tempId,
      });
    } catch (error) {
      console.error('Encryption/Send failed', error);
      alert('Failed to encrypt and send message');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!privateKey) {
    return (
      <div className="flex h-screen flex-col items-center justify-center relative overflow-hidden">
        <div className="atmospheric-bg"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 rounded-3xl shadow-2xl max-w-md w-full text-center z-10 mx-4"
        >
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-display text-white mb-4">Private Key Missing</h2>
          <p className="text-zinc-400 mb-8">
            Your end-to-end encryption private key was not found on this device. You cannot read encrypted messages.
          </p>
          <button 
            onClick={logout}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl hover:bg-indigo-500 transition-colors font-medium"
          >
            Logout and create a new account
          </button>
        </motion.div>
      </div>
    );
  }

  const displayUsers = searchQuery ? searchResults : recentUsers;

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-white/10 flex flex-col bg-[#0f0f0f] z-20">
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <div className="font-display font-bold text-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400">
              <UserIcon size={20} />
            </div>
            <span className="truncate max-w-[140px]">{user?.username}</span>
          </div>
          <button 
            onClick={logout} 
            className="p-2.5 hover:bg-white/5 rounded-xl transition-colors text-zinc-400 hover:text-white" 
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
        
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all placeholder:text-zinc-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-4 top-3 text-zinc-500" size={18} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {displayUsers.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 flex flex-col items-center gap-3">
              <Search size={32} className="opacity-20" />
              <p className="text-sm">{searchQuery ? 'No users found' : 'Search for users to start chatting'}</p>
            </div>
          ) : (
            <div className="px-2 space-y-1">
              {displayUsers.map((u) => (
                <motion.div
                  whileHover={{ scale: 0.98 }}
                  whileTap={{ scale: 0.95 }}
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-colors ${
                    selectedUser?._id === u._id 
                      ? 'bg-indigo-600/20 border border-indigo-500/30' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-lg ${
                      selectedUser?._id === u._id ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    {onlineUsers.has(u._id) && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0f0f0f]"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedUser?._id === u._id ? 'text-indigo-300' : 'text-zinc-200'}`}>
                      {u.username}
                    </p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {onlineUsers.has(u._id) ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="atmospheric-bg opacity-50"></div>
        
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 glass-panel border-b-0 border-white/5 flex items-center gap-4 z-10">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 font-display font-bold text-lg border border-indigo-500/30">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-white">{selectedUser.username}</h2>
                <div className="flex items-center gap-1.5 text-xs text-indigo-400/80 mt-0.5">
                  <Shield size={12} />
                  <span>End-to-End Encrypted</span>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar z-10">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      key={msg._id || idx} 
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-5 py-3 shadow-lg relative group ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' 
                            : 'glass-panel text-zinc-100 rounded-2xl rounded-bl-sm'
                        }`}
                      >
                        <p className="break-words leading-relaxed text-[15px]">{msg.decryptedMessage}</p>
                        <div className={`text-[10px] mt-2 flex items-center justify-end gap-1 ${isMe ? 'text-indigo-200' : 'text-zinc-500'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMe && (
                            <span>
                              {msg.status === 'sending' ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-3 h-3 border border-indigo-200 border-t-transparent rounded-full" />
                              ) : msg.status === 'sent' ? (
                                <Check size={14} />
                              ) : (
                                <CheckCheck size={14} />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 z-10">
              <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type an encrypted message..."
                  className="flex-1 px-6 py-4 glass-panel rounded-full focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-500 text-white"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-14 h-14 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                >
                  <Send size={20} className="ml-1" />
                </motion.button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-zinc-500 z-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10"
            >
              <MessageSquare size={48} className="text-zinc-600" />
            </motion.div>
            <h2 className="text-2xl font-display font-medium text-zinc-300 mb-2">Your Secure Space</h2>
            <p className="text-sm text-zinc-500 max-w-sm text-center">
              Select a user from the sidebar to start an end-to-end encrypted conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
