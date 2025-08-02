import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from './auth.js';
import { io } from '../index.js';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check admin/master permissions
const requireAdminOrMaster = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MASTER') {
    return res.status(403).json({ error: 'Permission denied' });
  }
  next();
};

// Get all clients (admin/master only)
router.get('/', authenticateToken, requireAdminOrMaster, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        user: true,
        projects: true,
        monitoring: {
          orderBy: { timestamp: 'desc' },
          take: 1
        },
        _count: {
          select: {
            projects: true,
            monitoring: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get client by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        user: true,
        projects: true,
        monitoring: {
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Check permissions
    if (req.user.role === 'CLIENT' && client.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new client
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, domain, projectPath, projectType } = req.body;
    
    // Only admin/master can create clients for other users
    let userId = req.user.id;
    if ((req.user.role === 'ADMIN' || req.user.role === 'MASTER') && req.body.userId) {
      userId = req.body.userId;
    }
    
    const client = await prisma.client.create({
      data: {
        name,
        domain,
        projectPath,
        projectType: projectType || 'UNKNOWN',
        userId
      },
      include: {
        user: true,
        projects: true
      }
    });
    
    // Notify monitoring agent about new client
    io.emit('new_client', {
      clientId: client.id,
      projectPath: client.projectPath,
      projectType: client.projectType
    });
    
    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, status, projectType } = req.body;
    
    const existingClient = await prisma.client.findUnique({
      where: { id }
    });
    
    if (!existingClient) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Check permissions
    if (req.user.role === 'CLIENT' && existingClient.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        domain,
        status,
        projectType
      },
      include: {
        user: true,
        projects: true
      }
    });
    
    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete client
router.delete('/:id', authenticateToken, requireAdminOrMaster, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete related records first
    await prisma.monitoring.deleteMany({
      where: { clientId: id }
    });
    
    await prisma.project.deleteMany({
      where: { clientId: id }
    });
    
    await prisma.payment.deleteMany({
      where: { clientId: id }
    });
    
    await prisma.client.delete({
      where: { id }
    });
    
    // Notify monitoring agent
    io.emit('client_deleted', { clientId: id });
    
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get client projects
router.get('/:id/projects', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await prisma.client.findUnique({
      where: { id }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Check permissions
    if (req.user.role === 'CLIENT' && client.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const projects = await prisma.project.findMany({
      where: { clientId: id },
      include: {
        monitoring: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Control client project (start/stop/restart)
router.post('/:id/control', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, projectId } = req.body;
    
    const client = await prisma.client.findUnique({
      where: { id },
      include: { projects: true }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Check permissions
    if (req.user.role === 'CLIENT' && client.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    // Send command to monitoring agent
    io.emit('agent_command', {
      action,
      clientId: id,
      projectId
    });
    
    res.json({ message: `Command ${action} sent successfully` });
  } catch (error) {
    console.error('Error sending control command:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;