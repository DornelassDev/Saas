import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';

// Routes
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import monitoringRoutes from './routes/monitoring.js';
import billingRoutes from './routes/billing.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { clients: true }
    });
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.user.email} connected`);
  
  // Join user to their specific rooms
  socket.join(`user_${socket.user.id}`);
  
  if (socket.user.role === 'ADMIN' || socket.user.role === 'MASTER') {
    socket.join('admin_room');
  }
  
  // Join client-specific rooms
  socket.user.clients.forEach(client => {
    socket.join(`client_${client.id}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.user.email} disconnected`);
  });
  
  // Handle monitoring data from agent
  socket.on('monitoring_data', async (data) => {
    try {
      // Save monitoring data to database
      await prisma.monitoring.create({
        data: {
          clientId: data.clientId,
          projectId: data.projectId,
          cpuUsage: data.metrics.cpu,
          memoryUsage: data.metrics.memory,
          diskUsage: data.metrics.disk,
          responseTime: data.metrics.responseTime,
          uptime: data.metrics.uptime,
          errorCount: data.metrics.errors,
          requestCount: data.metrics.requests,
          status: data.status,
          customMetrics: JSON.stringify(data.customMetrics || {})
        }
      });
      
      // Broadcast to relevant rooms
      io.to(`client_${data.clientId}`).emit('monitoring_update', data);
      io.to('admin_room').emit('global_monitoring_update', data);
      
    } catch (error) {
      console.error('Error handling monitoring data:', error);
    }
  });
  
  // Handle project control commands
  socket.on('project_control', async (data) => {
    const { action, projectId } = data;
    
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { client: true }
      });
      
      if (!project) {
        socket.emit('error', { message: 'Project not found' });
        return;
      }
      
      // Check permissions
      if (socket.user.role === 'CLIENT' && project.client.userId !== socket.user.id) {
        socket.emit('error', { message: 'Permission denied' });
        return;
      }
      
      // Send command to monitoring agent
      io.emit('agent_command', {
        action,
        projectId: project.id,
        clientId: project.clientId
      });
      
      socket.emit('command_sent', { action, projectId });
      
    } catch (error) {
      console.error('Error handling project control:', error);
      socket.emit('error', { message: 'Internal server error' });
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/billing', billingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`SaaS Core server running on port ${PORT}`);
});

export { io, prisma, stripe };