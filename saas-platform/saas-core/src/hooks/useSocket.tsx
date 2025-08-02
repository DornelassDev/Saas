import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  monitoringData: any[];
  sendCommand: (command: string, data: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [monitoringData, setMonitoringData] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
      
      const newSocket = io(socketUrl, {
        auth: {
          token
        }
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      newSocket.on('monitoring_update', (data) => {
        setMonitoringData(prev => [data, ...prev.slice(0, 99)]);
      });

      newSocket.on('global_monitoring_update', (data) => {
        if (user.role === 'ADMIN' || user.role === 'MASTER') {
          setMonitoringData(prev => [data, ...prev.slice(0, 99)]);
        }
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  const sendCommand = (command: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(command, data);
    }
  };

  const value = {
    socket,
    isConnected,
    monitoringData,
    sendCommand
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};