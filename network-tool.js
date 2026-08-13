const { exec } = require('child_process');
const net = require('net');
const EventEmitter = require('events');

class NetworkTool extends EventEmitter {
  constructor() {
    super();
  }

  // Ping a host and stream results line by line
  ping(host, mainWindow) {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `ping -n 4 ${host}` : `ping -c 4 ${host}`;
    
    const proc = exec(cmd);
    
    proc.stdout.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('net:ping-log', {
          host,
          text: data.toString(),
          timestamp: Date.now()
        });
      }
    });

    proc.stderr.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('net:ping-log', {
          host,
          text: `[ERROR] ${data.toString()}`,
          timestamp: Date.now()
        });
      }
    });

    proc.on('close', (code) => {
      if (mainWindow) {
        mainWindow.webContents.send('net:ping-done', { host, code });
      }
    });
  }

  // Scan a list of ports on a host
  async scanPorts(host, ports, mainWindow) {
    const total = ports.length;
    let completed = 0;
    const openPorts = [];

    const checkPort = (port) => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800); // 800ms timeout for local or remote site network

        socket.connect(port, host, () => {
          socket.destroy();
          resolve({ port, open: true });
        });

        socket.on('error', () => {
          socket.destroy();
          resolve({ port, open: false });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ port, open: false, reason: 'TIMEOUT' });
        });
      });
    };

    // Run scans with a concurrency limit of 5 to avoid resource exhaustion
    const chunks = [];
    const chunkSize = 5;
    for (let i = 0; i < ports.length; i += chunkSize) {
      chunks.push(ports.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(port => checkPort(port)));
      
      for (const res of results) {
        completed++;
        if (res.open) {
          openPorts.push(res.port);
        }
        
        if (mainWindow) {
          mainWindow.webContents.send('net:scan-progress', {
            host,
            port: res.port,
            open: res.open,
            percent: Math.round((completed / total) * 100),
            completed,
            total
          });
        }
      }
    }

    if (mainWindow) {
      mainWindow.webContents.send('net:scan-done', {
        host,
        openPorts,
        total
      });
    }

    return openPorts;
  }
}

module.exports = new NetworkTool();
