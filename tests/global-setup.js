// tests/global-setup.js
const { spawn } = require('child_process');

async function globalSetup() {
  console.log('🚀 Starting global test setup...');
  
  // Kill any processes that might be using port 8000
  await killProcessesOnPort(8000);
  
  // Give some time for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ Global setup complete');
}

async function killProcessesOnPort(port) {
  try {
    console.log(`🧹 Cleaning up any processes on port ${port}...`);
    
    return new Promise((resolve) => {
      // Cross-platform port cleanup
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        // Windows: find processes using netstat and kill them
        const netstat = spawn('netstat', ['-ano']);
        let output = '';
        
        netstat.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        netstat.on('close', () => {
          const lines = output.split('\n');
          const portLine = lines.find(line => line.includes(`:${port} `));
          
          if (portLine) {
            const pid = portLine.trim().split(/\s+/).pop();
            if (pid && !isNaN(pid)) {
              try {
                spawn('taskkill', ['/F', '/PID', pid]);
                console.log(`💀 Killed Windows process ${pid} on port ${port}`);
              } catch (e) {
                console.log(`⚠️  Could not kill process ${pid}`);
              }
            }
          }
          resolve();
        });
        
        netstat.on('error', () => resolve());
      } else {
        // Unix/Linux/macOS: use lsof
        const lsof = spawn('lsof', ['-ti', `tcp:${port}`]);
        let pids = '';
        
        lsof.stdout.on('data', (data) => {
          pids += data.toString();
        });
        
        lsof.on('close', () => {
          if (pids.trim()) {
            const pidList = pids.trim().split('\n');
            
            pidList.forEach(pid => {
              try {
                process.kill(parseInt(pid), 'SIGKILL');
                console.log(`💀 Killed process ${pid} on port ${port}`);
              } catch (e) {
                console.log(`⚠️  Could not kill process ${pid}`);
              }
            });
          }
          resolve();
        });
        
        lsof.on('error', () => resolve());
      }
    });
  } catch (error) {
    console.log('⚠️  Error during port cleanup:', error.message);
  }
}

module.exports = globalSetup;