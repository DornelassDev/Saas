import fs from 'fs-extra';
import path from 'path';

class MonitoringSDK {
  async injectSDK(project) {
    console.log(`💉 Injecting monitoring SDK for ${project.id} (${project.type})`);
    
    try {
      switch (project.type) {
        case 'NODEJS':
        case 'REACT':
        case 'NEXTJS':
          await this.injectNodeSDK(project);
          break;
          
        case 'PYTHON':
        case 'DJANGO':
        case 'FLASK':
          await this.injectPythonSDK(project);
          break;
          
        default:
          console.warn(`SDK injection not supported for project type: ${project.type}`);
      }
    } catch (error) {
      console.error(`Error injecting SDK for ${project.id}:`, error);
    }
  }
  
  async injectNodeSDK(project) {
    const sdkPath = path.join(project.path, 'monitoring-sdk.js');
    
    const sdkCode = `
// Auto-injected Monitoring SDK
const os = require('os');
const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class MonitoringSDK {
  constructor() {
    this.projectId = process.env.PROJECT_ID;
    this.clientId = process.env.CLIENT_ID;
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      customMetrics: {}
    };
    
    this.init();
  }
  
  init() {
    console.log('🔍 Monitoring SDK initialized for project:', this.projectId);
    
    // Hook into HTTP requests
    this.hookHTTP();
    
    // Start metrics collection
    this.startMetricsCollection();
    
    // Hook into process events
    this.hookProcessEvents();
  }
  
  hookHTTP() {
    // Intercept outgoing HTTP requests
    const originalRequest = http.request;
    const originalHttpsRequest = https.request;
    
    http.request = (...args) => {
      const startTime = performance.now();
      const req = originalRequest.apply(http, args);
      
      req.on('response', (res) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.recordRequest(res.statusCode, responseTime);
      });
      
      req.on('error', (error) => {
        this.recordError(error);
      });
      
      return req;
    };
    
    https.request = (...args) => {
      const startTime = performance.now();
      const req = originalHttpsRequest.apply(https, args);
      
      req.on('response', (res) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.recordRequest(res.statusCode, responseTime);
      });
      
      req.on('error', (error) => {
        this.recordError(error);
      });
      
      return req;
    };
  }
  
  hookProcessEvents() {
    process.on('uncaughtException', (error) => {
      this.recordError(error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.recordError(new Error(\`Unhandled Rejection: \${reason}\`));
    });
  }
  
  recordRequest(statusCode, responseTime) {
    this.metrics.requests++;
    this.metrics.responseTime.push(responseTime);
    
    // Keep only last 100 response times
    if (this.metrics.responseTime.length > 100) {
      this.metrics.responseTime = this.metrics.responseTime.slice(-100);
    }
    
    if (statusCode >= 400) {
      this.metrics.errors++;
    }
  }
  
  recordError(error) {
    this.metrics.errors++;
    console.error('Monitoring SDK captured error:', error.message);
  }
  
  setCustomMetric(key, value) {
    this.metrics.customMetrics[key] = value;
  }
  
  getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0 
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length 
      : 0;
    
    return {
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      avgResponseTime: Math.round(avgResponseTime),
      customMetrics: this.metrics.customMetrics,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: os.loadavg()
    };
  }
  
  startMetricsCollection() {
    // Reset counters periodically
    setInterval(() => {
      this.metrics.requests = 0;
      this.metrics.errors = 0;
      this.metrics.responseTime = [];
    }, 60000); // Reset every minute
  }
}

// Auto-initialize
const monitoringSDK = new MonitoringSDK();

// Export for manual use
module.exports = monitoringSDK;

// Make available globally
global.monitoring = monitoringSDK;
`;
    
    await fs.writeFile(sdkPath, sdkCode);
    
    // Try to auto-require in main file
    await this.autoRequireInNodeProject(project, sdkPath);
  }
  
  async autoRequireInNodeProject(project, sdkPath) {
    try {
      const packageJson = await fs.readJson(path.join(project.path, 'package.json'));
      const mainFile = packageJson.main || 'index.js';
      const mainFilePath = path.join(project.path, mainFile);
      
      if (await fs.pathExists(mainFilePath)) {
        let content = await fs.readFile(mainFilePath, 'utf8');
        
        // Check if already injected
        if (!content.includes('monitoring-sdk.js')) {
          // Add require at the top
          const requireStatement = "require('./monitoring-sdk.js');\n";
          content = requireStatement + content;
          
          await fs.writeFile(mainFilePath, content);
          console.log(`✅ Auto-required monitoring SDK in ${mainFile}`);
        }
      }
    } catch (error) {
      console.warn('Could not auto-require SDK, manual integration needed:', error.message);
    }
  }
  
  async injectPythonSDK(project) {
    const sdkPath = path.join(project.path, 'monitoring_sdk.py');
    
    const sdkCode = `
# Auto-injected Monitoring SDK
import os
import sys
import time
import psutil
import threading
import traceback
from functools import wraps

class MonitoringSDK:
    def __init__(self):
        self.project_id = os.getenv('PROJECT_ID')
        self.client_id = os.getenv('CLIENT_ID')
        self.metrics = {
            'requests': 0,
            'errors': 0,
            'response_times': [],
            'custom_metrics': {}
        }
        
        self.init()
    
    def init(self):
        print(f'🔍 Monitoring SDK initialized for project: {self.project_id}')
        
        # Hook into sys.excepthook for error tracking
        sys.excepthook = self.exception_handler
        
        # Start metrics collection
        self.start_metrics_collection()
    
    def exception_handler(self, exc_type, exc_value, exc_traceback):
        self.record_error(f"{exc_type.__name__}: {exc_value}")
        # Call original exception handler
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
    
    def record_request(self, status_code=200, response_time=0):
        self.metrics['requests'] += 1
        self.metrics['response_times'].append(response_time)
        
        # Keep only last 100 response times
        if len(self.metrics['response_times']) > 100:
            self.metrics['response_times'] = self.metrics['response_times'][-100:]
        
        if status_code >= 400:
            self.metrics['errors'] += 1
    
    def record_error(self, error_msg):
        self.metrics['errors'] += 1
        print(f'Monitoring SDK captured error: {error_msg}')
    
    def set_custom_metric(self, key, value):
        self.metrics['custom_metrics'][key] = value
    
    def get_metrics(self):
        avg_response_time = (
            sum(self.metrics['response_times']) / len(self.metrics['response_times'])
            if self.metrics['response_times'] else 0
        )
        
        process = psutil.Process()
        
        return {
            'requests': self.metrics['requests'],
            'errors': self.metrics['errors'],
            'avg_response_time': round(avg_response_time),
            'custom_metrics': self.metrics['custom_metrics'],
            'memory_percent': process.memory_percent(),
            'cpu_percent': process.cpu_percent(),
            'uptime': time.time() - process.create_time()
        }
    
    def start_metrics_collection(self):
        def reset_metrics():
            while True:
                time.sleep(60)  # Reset every minute
                self.metrics['requests'] = 0
                self.metrics['errors'] = 0
                self.metrics['response_times'] = []
        
        thread = threading.Thread(target=reset_metrics, daemon=True)
        thread.start()
    
    def monitor_function(self, func):
        """Decorator to monitor function calls"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                response_time = (time.time() - start_time) * 1000
                self.record_request(200, response_time)
                return result
            except Exception as e:
                self.record_error(str(e))
                raise
        return wrapper

# Auto-initialize
monitoring_sdk = MonitoringSDK()

# Make available globally
import builtins
builtins.monitoring = monitoring_sdk
`;
    
    await fs.writeFile(sdkPath, sdkCode);
    
    // Try to auto-import in main Python files
    await this.autoImportInPythonProject(project, sdkPath);
  }
  
  async autoImportInPythonProject(project, sdkPath) {
    try {
      const pythonFiles = ['main.py', 'app.py', 'server.py', 'manage.py'];
      
      for (const filename of pythonFiles) {
        const filePath = path.join(project.path, filename);
        
        if (await fs.pathExists(filePath)) {
          let content = await fs.readFile(filePath, 'utf8');
          
          // Check if already injected
          if (!content.includes('monitoring_sdk')) {
            // Add import at the top
            const importStatement = 'import monitoring_sdk\n';
            content = importStatement + content;
            
            await fs.writeFile(filePath, content);
            console.log(`✅ Auto-imported monitoring SDK in ${filename}`);
            break;
          }
        }
      }
    } catch (error) {
      console.warn('Could not auto-import SDK, manual integration needed:', error.message);
    }
  }
}

export default MonitoringSDK;
`;
    
    await fs.writeFile(sdkPath, sdkCode);
  }
}

export default MonitoringSDK;