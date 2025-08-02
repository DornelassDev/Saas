import fs from 'fs-extra';
import path from 'path';

class ProjectDetector {
  async detectProject(projectPath) {
    console.log(`🔍 Detecting project type for: ${projectPath}`);
    
    try {
      const files = await fs.readdir(projectPath);
      const projectInfo = {
        type: 'UNKNOWN',
        config: {},
        dependencies: [],
        envVars: {}
      };

      // Check for package.json (Node.js projects)
      if (files.includes('package.json')) {
        const packageJson = await fs.readJson(path.join(projectPath, 'package.json'));
        
        // Detect React
        if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
            projectInfo.type = 'NEXTJS';
            projectInfo.config = {
              startCommand: 'npm',
              startArgs: ['run', 'dev'],
              buildCommand: 'npm run build',
              port: 3000
            };
          } else {
            projectInfo.type = 'REACT';
            projectInfo.config = {
              startCommand: 'npm',
              startArgs: ['run', 'dev'],
              buildCommand: 'npm run build',
              port: 3000
            };
          }
        } 
        // Detect Express/Node.js
        else if (packageJson.dependencies?.express || packageJson.main) {
          projectInfo.type = 'NODEJS';
          projectInfo.config = {
            startCommand: 'node',
            startArgs: [packageJson.main || 'index.js'],
            port: 3000
          };
          
          // Check for common start scripts
          if (packageJson.scripts?.start) {
            const startScript = packageJson.scripts.start;
            if (startScript.includes('node')) {
              const parts = startScript.split(' ');
              projectInfo.config.startCommand = parts[0];
              projectInfo.config.startArgs = parts.slice(1);
            } else {
              projectInfo.config.startCommand = 'npm';
              projectInfo.config.startArgs = ['start'];
            }
          }
        }
        
        // Extract dependencies
        projectInfo.dependencies = [
          ...Object.keys(packageJson.dependencies || {}),
          ...Object.keys(packageJson.devDependencies || {})
        ];
      }
      
      // Check for Python projects
      else if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
        // Check for Django
        if (files.includes('manage.py')) {
          projectInfo.type = 'DJANGO';
          projectInfo.config = {
            startCommand: 'python',
            startArgs: ['manage.py', 'runserver', '0.0.0.0:8000'],
            port: 8000
          };
        }
        // Check for Flask
        else if (files.some(file => file.includes('app.py') || file.includes('main.py'))) {
          const appFile = files.find(file => file.includes('app.py')) || 
                         files.find(file => file.includes('main.py'));
          
          projectInfo.type = 'FLASK';
          projectInfo.config = {
            startCommand: 'python',
            startArgs: [appFile],
            port: 5000
          };
        }
        // Generic Python
        else {
          projectInfo.type = 'PYTHON';
          projectInfo.config = {
            startCommand: 'python',
            startArgs: ['main.py'],
            port: 8000
          };
        }
        
        // Extract Python dependencies
        if (files.includes('requirements.txt')) {
          const requirements = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf8');
          projectInfo.dependencies = requirements.split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
        }
      }
      
      // Check for environment files
      if (files.includes('.env')) {
        try {
          const envContent = await fs.readFile(path.join(projectPath, '.env'), 'utf8');
          const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
          
          for (const line of envLines) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
              projectInfo.envVars[key.trim()] = valueParts.join('=').trim();
            }
          }
        } catch (error) {
          console.warn('Error reading .env file:', error);
        }
      }
      
      // Check for Docker
      if (files.includes('Dockerfile')) {
        try {
          const dockerfile = await fs.readFile(path.join(projectPath, 'Dockerfile'), 'utf8');
          const exposeMatch = dockerfile.match(/EXPOSE\s+(\d+)/);
          if (exposeMatch) {
            projectInfo.config.port = parseInt(exposeMatch[1]);
          }
        } catch (error) {
          console.warn('Error reading Dockerfile:', error);
        }
      }
      
      // Check for docker-compose
      if (files.includes('docker-compose.yml') || files.includes('docker-compose.yaml')) {
        // TODO: Parse docker-compose for port configuration
      }
      
      console.log(`✅ Detected project type: ${projectInfo.type}`);
      return projectInfo;
      
    } catch (error) {
      console.error('Error detecting project:', error);
      return {
        type: 'UNKNOWN',
        config: {},
        dependencies: [],
        envVars: {}
      };
    }
  }
  
  async validateProject(projectPath, projectInfo) {
    // Validate that required files exist for the detected project type
    switch (projectInfo.type) {
      case 'REACT':
      case 'NEXTJS':
      case 'NODEJS':
        return await fs.pathExists(path.join(projectPath, 'package.json'));
        
      case 'DJANGO':
        return await fs.pathExists(path.join(projectPath, 'manage.py'));
        
      case 'FLASK':
        const flaskFiles = ['app.py', 'main.py', 'server.py'];
        for (const file of flaskFiles) {
          if (await fs.pathExists(path.join(projectPath, file))) {
            return true;
          }
        }
        return false;
        
      case 'PYTHON':
        return await fs.pathExists(path.join(projectPath, 'requirements.txt')) ||
               await fs.pathExists(path.join(projectPath, 'main.py'));
        
      default:
        return false;
    }
  }
}

export default ProjectDetector;