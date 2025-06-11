import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import log from 'electron-log';
import axios from 'axios';
import { app } from 'electron';
import * as net from 'net';
import { isDevelopment } from './utils/env';

const __dirname = path.dirname(__filename);

interface BackendStatus {
  running: boolean;
  port: number;
  pid?: number;
  startTime?: Date;
  restartCount: number;
  lastError?: string;
}

export class BackendManager {
  private process: ChildProcess | null = null;
  private port: number = 8000;
  private status: BackendStatus;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private maxRestartAttempts = 3;
  private restartDelay = 3000; // 3 seconds

  constructor() {
    this.status = {
      running: false,
      port: this.port,
      restartCount: 0
    };
  }

  async start(): Promise<void> {
    if (this.process && this.status.running) {
      log.info('Backend already running');
      return;
    }

    try {
      // Find available port
      this.port = await this.findAvailablePort(this.port);
      
      // Get backend path
      const backendPath = this.getBackendPath();
      const pythonExecutable = await this.findPythonExecutable();
      
      log.info(`Starting backend on port ${this.port}`);
      
      // Spawn backend process
      this.process = spawn(pythonExecutable, [
        '-m', 'uvicorn',
        'app.main:app',
        '--host', '0.0.0.0',
        '--port', this.port.toString(),
        '--reload', isDevelopment() ? 'true' : 'false'
      ], {
        cwd: backendPath,
        env: {
          ...process.env,
          PYTHONPATH: backendPath,
          SCANALYZER_ENV: isDevelopment() ? 'development' : 'production',
          SCANALYZER_PORT: this.port.toString()
        }
      });

      // Handle process events
      this.setupProcessHandlers();

      // Wait for backend to be ready
      await this.waitForBackend();

      // Update status
      this.status = {
        running: true,
        port: this.port,
        pid: this.process.pid,
        startTime: new Date(),
        restartCount: this.status.restartCount
      };

      // Start health checks
      this.startHealthChecks();

      log.info(`Backend started successfully on port ${this.port}`);
    } catch (error) {
      log.error('Failed to start backend:', error);
      this.status.lastError = error.message;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.process || !this.status.running) {
      return;
    }

    this.isShuttingDown = true;
    
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    log.info('Stopping backend...');

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.process) {
          log.warn('Backend did not stop gracefully, forcing kill');
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      if (this.process) {
        this.process.once('exit', () => {
          clearTimeout(killTimeout);
          this.process = null;
          this.status.running = false;
          log.info('Backend stopped');
          resolve();
        });

        // Send termination signal
        this.process.kill('SIGTERM');
      } else {
        clearTimeout(killTimeout);
        resolve();
      }
    });
  }

  async restart(): Promise<void> {
    log.info('Restarting backend...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
    await this.start();
  }

  getStatus(): BackendStatus {
    return { ...this.status };
  }

  async checkHealth(): Promise<{ status: string; uptime?: number }> {
    if (!this.status.running) {
      return { status: 'stopped' };
    }

    try {
      const response = await axios.get(`http://localhost:${this.port}/health`, {
        timeout: 5000
      });

      const uptime = this.status.startTime 
        ? Math.floor((Date.now() - this.status.startTime.getTime()) / 1000)
        : 0;

      return {
        status: response.data.status || 'healthy',
        uptime
      };
    } catch (error) {
      log.error('Health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  async simulateCrash(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGKILL');
    }
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data) => {
      log.info(`Backend: ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data) => {
      log.error(`Backend Error: ${data.toString().trim()}`);
    });

    this.process.on('error', (error) => {
      log.error('Backend process error:', error);
      this.status.lastError = error.message;
    });

    this.process.on('exit', (code, signal) => {
      log.info(`Backend exited with code ${code} and signal ${signal}`);
      this.status.running = false;
      this.process = null;

      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Auto-restart if not shutting down and within restart limit
      if (!this.isShuttingDown && this.status.restartCount < this.maxRestartAttempts) {
        log.info(`Auto-restarting backend (attempt ${this.status.restartCount + 1}/${this.maxRestartAttempts})`);
        this.status.restartCount++;
        
        setTimeout(() => {
          this.start().catch(error => {
            log.error('Auto-restart failed:', error);
          });
        }, this.restartDelay);
      }
    });
  }

  private startHealthChecks(): void {
    // Clear existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.checkHealth();
      
      if (health.status === 'unhealthy' && !this.isShuttingDown) {
        log.warn('Backend health check failed, considering restart');
        // You could implement auto-restart on unhealthy here
      }
    }, 30000);
  }

  private async waitForBackend(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await axios.get(`http://localhost:${this.port}/health`, {
          timeout: 1000
        });
        return; // Backend is ready
      } catch (error) {
        // Backend not ready yet
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    throw new Error('Backend failed to start within timeout');
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const isPortAvailable = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', () => {
          resolve(false);
        });
        
        server.once('listening', () => {
          server.close();
          resolve(true);
        });
        
        server.listen(port, '127.0.0.1');
      });
    };

    let port = startPort;
    const maxPort = startPort + 100;
    
    while (port < maxPort) {
      if (await isPortAvailable(port)) {
        return port;
      }
      port++;
    }
    
    throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
  }

  private getBackendPath(): string {
    if (isDevelopment()) {
      // Development: Use source backend directory
      return path.join(__dirname, '..', '..', '..', 'backend');
    } else {
      // Production: Use bundled backend
      return path.join(process.resourcesPath, 'backend');
    }
  }

  private async findPythonExecutable(): Promise<string> {
    const possiblePaths = [
      'python3',
      'python',
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      'C:\\Python\\python.exe',
      'C:\\Python39\\python.exe',
      'C:\\Python310\\python.exe',
      'C:\\Python311\\python.exe'
    ];

    if (isDevelopment()) {
      // In development, also check virtual environment
      const venvPath = path.join(this.getBackendPath(), 'venv', 'bin', 'python');
      const venvPathWin = path.join(this.getBackendPath(), 'venv', 'Scripts', 'python.exe');
      possiblePaths.unshift(process.platform === 'win32' ? venvPathWin : venvPath);
    }

    // Test each path
    for (const pythonPath of possiblePaths) {
      try {
        const { execSync } = require('child_process');
        execSync(`${pythonPath} --version`, { stdio: 'ignore' });
        return pythonPath;
      } catch {
        // Try next path
      }
    }

    throw new Error('Python executable not found. Please ensure Python 3.8+ is installed.');
  }
}