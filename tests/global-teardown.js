// tests/global-teardown.js
const { spawn } = require('child_process');

async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');
  
  // Final cleanup of port 8000
  await killProcessesOnPort(8000);
  
  // Give time for cleanup
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('✅ Global teardown complete');
}

async function killProcessesOnPort(port) {
  try {
    console.log(`🧹 Final cleanup of port ${port}...`);
    
    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
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
                console.log(`💀 Final kill of Windows process ${pid}`);
              } catch (e) {
                // Ignore errors in teardown
              }
            }
          }
          resolve();
        });
        
        netstat.on('error', () => resolve());
      } else {
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
                console.log(`💀 Final kill of process ${pid}`);
              } catch (e) {
                // Ignore errors in teardown
              }
            });
          }
          resolve();
        });
        
        lsof.on('error', () => resolve());
      }
    });
  } catch (error) {
    // Ignore errors in teardown
  }
}

module.exports = globalTeardown;