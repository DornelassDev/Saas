import express from 'express';
import { io as ioClient } from 'socket.io-client';
import chokidar from 'chokidar';
import si from 'systeminformation';
import fs from 'fs-extra';
import path from 'path';
import { spawn, exec } from 'child_process';
import dotenv from 'dotenv';
import ProjectDetector from './ProjectDetector.js';
import MonitoringSDK from './MonitoringSDK.js';
import PortManager from './PortManager.js';

dotenv.config();

class MonitoringAgent {
  constructor() {
    this.app = express();
    this.socket = null;
    this.projects = new Map();
    this.portManager = new PortManager(3001, 3020);
    this.projectDetector = new ProjectDetector();
    this.monitoringSDK = new MonitoringSDK();
    this.clientsPath = process.env.CLIENTS_PATH || '/app/clients';
    this.saasCore = process.env.SAAS_CORE_URL || 'http://localhost:3000';
    
    this.init();
  }

  async init() {
    console.log('🚀 Starting Monitoring Agent...');
    
    // Setup express middleware
    this.app.use(express.json());
    
    // Connect to SaaS Core
    await this.connectToSaasCore();
    
    // Setup file watcher
    this.setupFileWatcher();
    
    // Scan existing projects
    await this.scanExistingProjects();
    
    // Start monitoring loop
    this.startMonitoringLoop();
    
    // Start HTTP server
    const port = process.env.AGENT_PORT || 3100;
    this.app.listen(port, () => {
      console.log(`📊 Monitoring Agent running on port ${port}`);
    });
  }

  async connectToSaasCore() {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to SaaS Core at ${this.saasCore}...`);
      
      this.socket = ioClient(this.saasCore, {
        auth: {
          token: process.env.AGENT_TOKEN || 'monitoring-agent-token'
        }
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to SaaS Core');
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from SaaS Core');
      });

      this.socket.on('agent_command', async (data) => {
        await this.handleCommand(data);
      });

      this.socket.on('new_client', async (data) => {
        console.log('👤 New client detected:', data.clientId);
        await this.scanProject(data.projectPath, data.clientId);
      });

      this.socket.on('client_deleted', (data) => {
        console.log('🗑️ Client deleted:', data.clientId);
        this.stopProject(data.clientId);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setTimeout(() => this.connectToSaasCore(), 5000);
      });
    });
  }

  setupFileWatcher() {
    console.log(`👀 Watching clients directory: ${this.clientsPath}`);
    
    const watcher = chokidar.watch(this.clientsPath, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: false
    });

    watcher.on('addDir', async (dirPath) => {
      const relativePath = path.relative(this.clientsPath, dirPath);
      const depth = relativePath.split(path.sep).length;
      
      // Only process immediate subdirectories of clients folder
      if (depth === 1 && relativePath !== '') {
        console.log(`📁 New project directory detected: ${relativePath}`);
        await this.scanProject(dirPath);
      }
    });

    watcher.on('unlinkDir', (dirPath) => {
      const relativePath = path.relative(this.clientsPath, dirPath);
      const depth = relativePath.split(path.sep).length;
      
      if (depth === 1) {
        console.log(`🗑️ Project directory removed: ${relativePath}`);
        this.stopProject(relativePath);
      }
    });

    watcher.on('change', async (filePath) => {
      // Handle configuration file changes
      if (filePath.includes('package.json') || filePath.includes('requirements.txt')) {
        const projectDir = this.findProjectDirectory(filePath);
        if (projectDir) {
          console.log(`🔄 Configuration changed in ${projectDir}, rescanning...`);
          await this.scanProject(path.join(this.clientsPath, projectDir));
        }
      }
    });
  }

  findProjectDirectory(filePath) {
    const relativePath = path.relative(this.clientsPath, filePath);
    const parts = relativePath.split(path.sep);
    return parts.length > 0 ? parts[0] : null;
  }

  async scanExistingProjects() {
    console.log('🔍 Scanning existing projects...');
    
    try {
      const entries = await fs.readdir(this.clientsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(this.clientsPath, entry.name);
          await this.scanProject(projectPath, entry.name);
        }
      }
    } catch (error) {
      console.error('Error scanning existing projects:', error);
    }
  }

  async scanProject(projectPath, clientId = null) {
    try {
      const projectName = clientId || path.basename(projectPath);
      console.log(`🔎 Scanning project: ${projectName}`);
      
      // Detect project type and configuration
      const projectInfo = await this.projectDetector.detectProject(projectPath);
      
      if (!projectInfo.type || projectInfo.type === 'UNKNOWN') {
        console.log(`⚠️ Unknown project type for ${projectName}, skipping...`);
        return;
      }
      
      // Assign port
      const port = this.portManager.assignPort(projectName);
      
      // Create project configuration
      const project = {
        id: projectName,
        clientId: clientId || projectName,
        name: projectName,
        path: projectPath,
        type: projectInfo.type,
        port: port,
        pid: null,
        status: 'STOPPED',
        config: projectInfo.config,
        dependencies: projectInfo.dependencies,
        envVars: projectInfo.envVars || {},
        lastStarted: null,
        lastStopped: null,
        restartCount: 0,
        healthCheckUrl: `http://localhost:${port}`
      };
      
      this.projects.set(projectName, project);
      
      console.log(`✅ Project configured: ${projectName} (${projectInfo.type}) on port ${port}`);
      
      // Inject monitoring SDK
      await this.monitoringSDK.injectSDK(project);
      
      // Auto-start project if configured
      if (process.env.AUTO_START_PROJECTS === 'true') {
        await this.startProject(projectName);
      }
      
      // Notify SaaS Core
      if (this.socket) {
        this.socket.emit('project_discovered', {
          projectId: project.id,
          clientId: project.clientId,
          type: project.type,
          port: project.port,
          status: project.status
        });
      }
      
    } catch (error) {
      console.error(`Error scanning project ${projectPath}:`, error);
    }
  }

  async startProject(projectId) {
    const project = this.projects.get(projectId);
    if (!project) {
      console.error(`Project ${projectId} not found`);
      return false;
    }

    if (project.status === 'RUNNING') {
      console.log(`Project ${projectId} is already running`);
      return true;
    }

    try {
      console.log(`🚀 Starting project: ${projectId}`);
      
      // Install dependencies if needed
      await this.installDependencies(project);
      
      // Set environment variables
      const env = {
        ...process.env,
        ...project.envVars,
        PORT: project.port.toString(),
        MONITORING_ENABLED: 'true',
        PROJECT_ID: project.id,
        CLIENT_ID: project.clientId
      };
      
      // Start the project
      const child = spawn(project.config.startCommand, project.config.startArgs || [], {
        cwd: project.path,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
      
      project.pid = child.pid;
      project.status = 'STARTING';
      project.lastStarted = new Date();
      project.process = child;
      
      // Handle process output
      child.stdout.on('data', (data) => {
        console.log(`[${projectId}] ${data}`);
      });
      
      child.stderr.on('data', (data) => {
        console.error(`[${projectId}] ERROR: ${data}`);
      });
      
      child.on('close', (code) => {
        console.log(`[${projectId}] Process exited with code ${code}`);
        project.status = 'STOPPED';
        project.pid = null;
        project.lastStopped = new Date();
        
        // Auto-restart on crash if enabled
        if (code !== 0 && process.env.AUTO_RESTART === 'true') {
          project.restartCount++;
          if (project.restartCount < 5) {
            console.log(`🔄 Auto-restarting ${projectId} (attempt ${project.restartCount})`);
            setTimeout(() => this.startProject(projectId), 5000);
          }
        }
      });
      
      child.on('error', (error) => {
        console.error(`[${projectId}] Start error:`, error);
        project.status = 'ERROR';
        project.pid = null;
      });
      
      // Wait for service to be ready
      await this.waitForHealthCheck(project);
      
      project.status = 'RUNNING';
      console.log(`✅ Project ${projectId} started successfully on port ${project.port}`);
      
      return true;
      
    } catch (error) {
      console.error(`Error starting project ${projectId}:`, error);
      project.status = 'ERROR';
      return false;
    }
  }

  async stopProject(projectId) {
    const project = this.projects.get(projectId);
    if (!project) {
      console.error(`Project ${projectId} not found`);
      return false;
    }

    if (project.status === 'STOPPED') {
      console.log(`Project ${projectId} is already stopped`);
      return true;
    }

    try {
      console.log(`🛑 Stopping project: ${projectId}`);
      
      if (project.process) {
        project.process.kill('SIGTERM');
        
        // Force kill after 10 seconds
        setTimeout(() => {
          if (project.process && !project.process.killed) {
            project.process.kill('SIGKILL');
          }
        }, 10000);
      }
      
      project.status = 'STOPPED';
      project.pid = null;
      project.lastStopped = new Date();
      
      // Release port
      this.portManager.releasePort(projectId);
      
      console.log(`✅ Project ${projectId} stopped successfully`);
      return true;
      
    } catch (error) {
      console.error(`Error stopping project ${projectId}:`, error);
      project.status = 'ERROR';
      return false;
    }
  }

  async restartProject(projectId) {
    console.log(`🔄 Restarting project: ${projectId}`);
    await this.stopProject(projectId);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    return await this.startProject(projectId);
  }

  async installDependencies(project) {
    console.log(`📦 Installing dependencies for ${project.id}...`);
    
    try {
      if (project.type === 'NODEJS' || project.type === 'REACT' || project.type === 'NEXTJS') {
        if (await fs.pathExists(path.join(project.path, 'package.json'))) {
          await this.execCommand('npm install', project.path);
        }
      } else if (project.type === 'PYTHON' || project.type === 'DJANGO' || project.type === 'FLASK') {
        if (await fs.pathExists(path.join(project.path, 'requirements.txt'))) {
          await this.execCommand('pip install -r requirements.txt', project.path);
        }
      }
    } catch (error) {
      console.error(`Error installing dependencies for ${project.id}:`, error);
    }
  }

  async waitForHealthCheck(project, timeout = 30000) {
    console.log(`🏥 Waiting for health check: ${project.healthCheckUrl}`);
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(project.healthCheckUrl);
        if (response.ok) {
          console.log(`✅ Health check passed for ${project.id}`);
          return true;
        }
      } catch (error) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.warn(`⚠️ Health check timeout for ${project.id}`);
    return false;
  }

  async execCommand(command, cwd) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async handleCommand(data) {
    const { action, projectId, clientId } = data;
    
    console.log(`📋 Received command: ${action} for project ${projectId || clientId}`);
    
    let result = false;
    
    switch (action) {
      case 'start':
        result = await this.startProject(projectId || clientId);
        break;
      case 'stop':
        result = await this.stopProject(projectId || clientId);
        break;
      case 'restart':
        result = await this.restartProject(projectId || clientId);
        break;
      default:
        console.error(`Unknown command: ${action}`);
    }
    
    // Send response back to SaaS Core
    if (this.socket) {
      this.socket.emit('command_result', {
        action,
        projectId: projectId || clientId,
        success: result,
        timestamp: new Date()
      });
    }
  }

  async collectSystemMetrics() {
    try {
      const [cpu, mem, disk, network] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats()
      ]);
      
      return {
        cpu: cpu.currentLoad,
        memory: (mem.used / mem.total) * 100,
        disk: disk[0] ? (disk[0].used / disk[0].size) * 100 : 0,
        network: network[0] ? {
          rx: network[0].rx_sec,
          tx: network[0].tx_sec
        } : { rx: 0, tx: 0 }
      };
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      return {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: { rx: 0, tx: 0 }
      };
    }
  }

  async collectProjectMetrics() {
    const projectMetrics = [];
    
    for (const [projectId, project] of this.projects) {
      try {
        let metrics = {
          projectId: project.id,
          clientId: project.clientId,
          status: project.status,
          port: project.port,
          uptime: project.lastStarted ? Date.now() - project.lastStarted.getTime() : 0,
          restartCount: project.restartCount,
          pid: project.pid
        };
        
        // Collect process-specific metrics if running
        if (project.pid && project.status === 'RUNNING') {
          try {
            const processMetrics = await si.processLoad(project.pid);
            metrics.cpuUsage = processMetrics.cpu;
            metrics.memoryUsage = processMetrics.memory;
            
            // Check health endpoint
            const healthResponse = await fetch(project.healthCheckUrl, { 
              timeout: 5000 
            }).catch(() => null);
            
            metrics.responseTime = healthResponse ? 
              healthResponse.headers.get('x-response-time') || 0 : null;
            metrics.httpStatus = healthResponse?.status || null;
            
          } catch (processError) {
            // Process might not exist anymore
            metrics.cpuUsage = 0;
            metrics.memoryUsage = 0;
          }
        }
        
        projectMetrics.push(metrics);
        
      } catch (error) {
        console.error(`Error collecting metrics for ${projectId}:`, error);
      }
    }
    
    return projectMetrics;
  }

  startMonitoringLoop() {
    console.log('📊 Starting monitoring loop...');
    
    setInterval(async () => {
      try {
        // Collect system metrics
        const systemMetrics = await this.collectSystemMetrics();
        
        // Collect project metrics
        const projectMetrics = await this.collectProjectMetrics();
        
        // Send to SaaS Core
        if (this.socket && this.socket.connected) {
          // Send system metrics
          this.socket.emit('monitoring_data', {
            type: 'system',
            timestamp: new Date(),
            metrics: systemMetrics,
            agentId: 'monitoring-agent'
          });
          
          // Send project metrics
          for (const metrics of projectMetrics) {
            this.socket.emit('monitoring_data', {
              type: 'project',
              timestamp: new Date(),
              projectId: metrics.projectId,
              clientId: metrics.clientId,
              metrics: {
                cpu: metrics.cpuUsage,
                memory: metrics.memoryUsage,
                uptime: metrics.uptime,
                responseTime: metrics.responseTime,
                requests: 0, // Will be populated by SDK
                errors: 0    // Will be populated by SDK
              },
              status: metrics.status,
              customMetrics: {
                port: metrics.port,
                pid: metrics.pid,
                restartCount: metrics.restartCount,
                httpStatus: metrics.httpStatus
              }
            });
          }
        }
        
      } catch (error) {
        console.error('Error in monitoring loop:', error);
      }
    }, parseInt(process.env.MONITORING_INTERVAL) || 10000); // Default 10 seconds
  }
}

// Start the monitoring agent
new MonitoringAgent();