class PortManager {
  constructor(startPort = 3001, endPort = 3100) {
    this.startPort = startPort;
    this.endPort = endPort;
    this.allocatedPorts = new Map(); // projectId -> port
    this.usedPorts = new Set();
  }
  
  assignPort(projectId) {
    // Check if project already has a port assigned
    if (this.allocatedPorts.has(projectId)) {
      return this.allocatedPorts.get(projectId);
    }
    
    // Find next available port
    for (let port = this.startPort; port <= this.endPort; port++) {
      if (!this.usedPorts.has(port)) {
        this.allocatedPorts.set(projectId, port);
        this.usedPorts.add(port);
        console.log(`📡 Assigned port ${port} to project ${projectId}`);
        return port;
      }
    }
    
    throw new Error(`No available ports in range ${this.startPort}-${this.endPort}`);
  }
  
  releasePort(projectId) {
    const port = this.allocatedPorts.get(projectId);
    if (port) {
      this.allocatedPorts.delete(projectId);
      this.usedPorts.delete(port);
      console.log(`🔓 Released port ${port} from project ${projectId}`);
      return port;
    }
    return null;
  }
  
  getAssignedPort(projectId) {
    return this.allocatedPorts.get(projectId);
  }
  
  getAllocatedPorts() {
    return Array.from(this.allocatedPorts.entries());
  }
  
  isPortAvailable(port) {
    return !this.usedPorts.has(port) && port >= this.startPort && port <= this.endPort;
  }
}

export default PortManager;