const net = require('net');
const dgram = require('dgram');
const EventEmitter = require('events');

class SocketDebugger extends EventEmitter {
  constructor() {
    super();
    this.instances = new Map(); // id -> instance metadata
  }

  // Create and start a socket instance
  start(config) {
    const { id, type, ip, port, bindPort, autoReconnect, rules } = config;
    
    // Disconnect if already exists
    if (this.instances.has(id)) {
      this.stop(id);
    }

    const instance = {
      id,
      type,
      config,
      socket: null,
      server: null,
      clients: new Map(), // for tcp_server: clientId -> socket
      status: 'DISCONNECTED',
      rules: rules || []
    };

    this.instances.set(id, instance);

    if (type === 'tcp_client') {
      this.startTcpClient(instance, ip, port, autoReconnect);
    } else if (type === 'tcp_server') {
      this.startTcpServer(instance, ip, port);
    } else if (type === 'udp') {
      this.startUdp(instance, ip, bindPort);
    }

    return { success: true, id };
  }

  // Stop a socket instance
  stop(id) {
    const instance = this.instances.get(id);
    if (!instance) return { success: false, error: '实例不存在' };

    instance.status = 'DISCONNECTED';
    this.emitStatus(id, 'DISCONNECTED');

    if (instance.type === 'tcp_client' && instance.socket) {
      instance.socket.destroy();
      instance.socket = null;
    } else if (instance.type === 'tcp_server') {
      for (const clientSocket of instance.clients.values()) {
        clientSocket.destroy();
      }
      instance.clients.clear();
      if (instance.server) {
        instance.server.close();
        instance.server = null;
      }
    } else if (instance.type === 'udp' && instance.socket) {
      instance.socket.close();
      instance.socket = null;
    }

    this.instances.delete(id);
    return { success: true };
  }

  // Send data from an instance
  send(id, { data, isHex, targetIp, targetPort, targetClientId }) {
    const instance = this.instances.get(id);
    if (!instance) return { success: false, error: '实例未启动或不存在' };

    let payload;
    try {
      if (isHex) {
        // Clean spaces and convert hex to buffer
        const cleanHex = data.replace(/[\s,]/g, '');
        if (cleanHex.length % 2 !== 0) {
          return { success: false, error: 'Hex 字符串长度必须是偶数' };
        }
        payload = Buffer.from(cleanHex, 'hex');
      } else {
        payload = Buffer.from(data, 'utf-8');
      }
    } catch (err) {
      return { success: false, error: `数据格式化错误: ${err.message}` };
    }

    const timestamp = Date.now();
    const hexString = payload.toString('hex').toUpperCase().replace(/(.{2})/g, '$1 ').trim();
    const asciiString = this.toAsciiDisplay(payload);

    if (instance.type === 'tcp_client') {
      if (!instance.socket || instance.status !== 'CONNECTED') {
        return { success: false, error: 'TCP 客户端未连接' };
      }
      instance.socket.write(payload);
      this.emitTraffic(id, 'TX', hexString, asciiString, '数据发送', timestamp);
    } else if (instance.type === 'tcp_server') {
      if (targetClientId) {
        // Send to specific client
        const clientSocket = instance.clients.get(targetClientId);
        if (clientSocket) {
          clientSocket.write(payload);
          this.emitTraffic(id, 'TX', hexString, asciiString, `发往客户端 [${targetClientId}]`, timestamp);
        } else {
          return { success: false, error: '指定的目标客户端不存在或已断开' };
        }
      } else {
        // Broadcast
        if (instance.clients.size === 0) {
          return { success: false, error: '没有已连接的客户端' };
        }
        for (const [cId, clientSocket] of instance.clients.entries()) {
          clientSocket.write(payload);
        }
        this.emitTraffic(id, 'TX', hexString, asciiString, `广播发往 ${instance.clients.size} 个客户端`, timestamp);
      }
    } else if (instance.type === 'udp') {
      if (!instance.socket) return { success: false, error: 'UDP 套接字未绑定' };
      if (!targetIp || !targetPort) {
        return { success: false, error: 'UDP 发送必须指定目标 IP 和端口' };
      }
      instance.socket.send(payload, targetPort, targetIp, (err) => {
        if (err) {
          this.emitTraffic(id, 'ERROR', '', '', `发送到 ${targetIp}:${targetPort} 失败: ${err.message}`, Date.now());
        }
      });
      this.emitTraffic(id, 'TX', hexString, asciiString, `发往 ${targetIp}:${targetPort}`, timestamp);
    }

    return { success: true };
  }

  // Update auto reply rules
  updateRules(id, rules) {
    const instance = this.instances.get(id);
    if (instance) {
      instance.rules = rules || [];
      return { success: true };
    }
    return { success: false, error: '实例不存在' };
  }

  // Start TCP Client
  startTcpClient(instance, ip, port, autoReconnect) {
    instance.status = 'CONNECTING';
    this.emitStatus(instance.id, 'CONNECTING');

    const socket = new net.Socket();
    instance.socket = socket;

    socket.connect(port, ip, () => {
      instance.status = 'CONNECTED';
      this.emitStatus(instance.id, 'CONNECTED');
      this.emitTraffic(instance.id, 'LOG', '', '', `已成功连接到服务器 ${ip}:${port}`, Date.now());
    });

    socket.on('data', (data) => {
      const timestamp = Date.now();
      const hexString = data.toString('hex').toUpperCase().replace(/(.{2})/g, '$1 ').trim();
      const asciiString = this.toAsciiDisplay(data);
      this.emitTraffic(instance.id, 'RX', hexString, asciiString, `收到数据`, timestamp);
      
      this.emit('data', { id: instance.id, data: hexString, ascii: asciiString, timestamp });
      
      // Process auto reply
      this.handleAutoReply(instance, data, null);
    });

    socket.on('close', (hadError) => {
      if (instance.status === 'DISCONNECTED') return; // Manual stop
      
      instance.status = 'DISCONNECTED';
      this.emitStatus(instance.id, 'DISCONNECTED');
      this.emitTraffic(instance.id, 'LOG', '', '', `连接断开 ${hadError ? '(有错误发生)' : ''}`, Date.now());

      if (autoReconnect && this.instances.has(instance.id)) {
        this.emitTraffic(instance.id, 'LOG', '', '', `将在 3 秒后尝试重新连接...`, Date.now());
        setTimeout(() => {
          if (this.instances.has(instance.id) && instance.status === 'DISCONNECTED') {
            this.startTcpClient(instance, ip, port, autoReconnect);
          }
        }, 3000);
      }
    });

    socket.on('error', (err) => {
      this.emitTraffic(instance.id, 'ERROR', '', '', `连接错误: ${err.message}`, Date.now());
    });
  }

  // Start TCP Server
  startTcpServer(instance, ip, port) {
    const server = net.createServer();
    instance.server = server;
    instance.status = 'LISTENING';
    this.emitStatus(instance.id, 'LISTENING');

    server.on('connection', (clientSocket) => {
      const clientId = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`;
      instance.clients.set(clientId, clientSocket);
      
      this.emitTraffic(instance.id, 'LOG', '', '', `客户端连接: ${clientId}`, Date.now());
      this.emitClientsList(instance.id, Array.from(instance.clients.keys()));

      clientSocket.on('data', (data) => {
        const timestamp = Date.now();
        const hexString = data.toString('hex').toUpperCase().replace(/(.{2})/g, '$1 ').trim();
        const asciiString = this.toAsciiDisplay(data);
        this.emitTraffic(instance.id, 'RX', hexString, asciiString, `来自客户端 [${clientId}]`, timestamp);
        
        this.emit('data', { id: instance.id, clientId, data: hexString, ascii: asciiString, timestamp });
        
        // Process auto reply
        this.handleAutoReply(instance, data, clientSocket, clientId);
      });

      clientSocket.on('close', () => {
        instance.clients.delete(clientId);
        this.emitTraffic(instance.id, 'LOG', '', '', `客户端断开: ${clientId}`, Date.now());
        this.emitClientsList(instance.id, Array.from(instance.clients.keys()));
      });

      clientSocket.on('error', (err) => {
        this.emitTraffic(instance.id, 'ERROR', '', '', `客户端 [${clientId}] 错误: ${err.message}`, Date.now());
      });
    });

    server.on('error', (err) => {
      instance.status = 'DISCONNECTED';
      this.emitStatus(instance.id, 'DISCONNECTED');
      this.emitTraffic(instance.id, 'ERROR', '', '', `服务器监听错误: ${err.message}`, Date.now());
    });

    // Listen on port, handle 'any' interface
    server.listen(port, ip === '0.0.0.0' ? undefined : ip, () => {
      this.emitTraffic(instance.id, 'LOG', '', '', `服务器正在监听 ${ip}:${port}`, Date.now());
    });
  }

  // Start UDP
  startUdp(instance, ip, bindPort) {
    const socket = dgram.createSocket('udp4');
    instance.socket = socket;
    
    socket.on('message', (msg, rinfo) => {
      const timestamp = Date.now();
      const hexString = msg.toString('hex').toUpperCase().replace(/(.{2})/g, '$1 ').trim();
      const asciiString = this.toAsciiDisplay(msg);
      this.emitTraffic(instance.id, 'RX', hexString, asciiString, `来自 ${rinfo.address}:${rinfo.port}`, timestamp);
      
      this.emit('data', { id: instance.id, rinfo, data: hexString, ascii: asciiString, timestamp });

      // Handle UDP Auto-Reply
      this.handleUdpAutoReply(instance, msg, rinfo);
    });

    socket.on('error', (err) => {
      this.emitTraffic(instance.id, 'ERROR', '', '', `UDP 套接字错误: ${err.message}`, Date.now());
    });

    socket.on('close', () => {
      this.emitTraffic(instance.id, 'LOG', '', '', `UDP 套接字已关闭`, Date.now());
    });

    if (bindPort) {
      socket.bind(bindPort, ip === '0.0.0.0' ? undefined : ip, () => {
        instance.status = 'BOUND';
        this.emitStatus(instance.id, 'BOUND');
        this.emitTraffic(instance.id, 'LOG', '', '', `UDP 套接字已成功绑定本地端口 ${bindPort}`, Date.now());
      });
    } else {
      instance.status = 'ACTIVE';
      this.emitStatus(instance.id, 'ACTIVE');
      this.emitTraffic(instance.id, 'LOG', '', '', `UDP 套接字已就绪(未绑定固定端口)`, Date.now());
    }
  }

  // Trigger auto replies for TCP
  handleAutoReply(instance, rxData, clientSocket, clientId = null) {
    if (!instance.rules || instance.rules.length === 0) return;

    const rxText = rxData.toString('utf-8');
    const rxHex = rxData.toString('hex').toUpperCase();

    for (const rule of instance.rules) {
      if (!rule.active || !rule.match || !rule.reply) continue;

      let matched = false;
      if (rule.isHex) {
        const cleanMatch = rule.match.replace(/[\s,]/g, '').toUpperCase();
        matched = rxHex.includes(cleanMatch);
      } else {
        if (rule.isRegex) {
          try {
            const regex = new RegExp(rule.match);
            matched = regex.test(rxText);
          } catch (e) {
            // Invalid regex
          }
        } else {
          matched = rxText.includes(rule.match);
        }
      }

      if (matched) {
        // Trigger reply after delay
        setTimeout(() => {
          if (instance.status === 'DISCONNECTED') return;

          let replyBuf;
          try {
            if (rule.replyHex) {
              const cleanReply = rule.reply.replace(/[\s,]/g, '');
              replyBuf = Buffer.from(cleanReply, 'hex');
            } else {
              replyBuf = Buffer.from(rule.reply, 'utf-8');
            }
          } catch (e) {
            this.emitTraffic(instance.id, 'ERROR', '', '', `规则自动回复内容格式错误: ${e.message}`, Date.now());
            return;
          }

          const txHex = replyBuf.toString('hex').toUpperCase().replace(/(.{2})/g, '$1 ').trim();
          const txAscii = this.toAsciiDisplay(replyBuf);

          if (instance.type === 'tcp_client' && instance.socket) {
            instance.socket.write(replyBuf);
            this.emitTraffic(instance.id, 'TX', txHex, txAscii, `[自动回复触发]`, Date.now());
          } else if (instance.type === 'tcp_server') {
            if (clientSocket && !clientSocket.destroyed) {
              clientSocket.write(replyBuf);
              this.emitTraffic(instance.id, 'TX', txHex, txAscii, `[自动回复] 发往客户端 [${clientId}]`, Date.now());
            }
          }
        }, rule.delay || 50);
        break; // Trigger first match only
      }
    }
  }

  // Trigger auto replies for UDP
  handleUdpAutoReply(instance, rxData, rinfo) {
    if (!instance.rules || instance.rules.length === 0 || !instance.socket) return;

    const rxText = rxData.toString('utf-8');
    const rxHex = rxData.toString('hex').toUpperCase();

    for (const rule of instance.rules) {
      if (!rule.active || !rule.match || !rule.reply) continue;

      let matched = false;
      if (rule.isHex) {
        const cleanMatch = rule.match.replace(/[\s,]/g, '').toUpperCase();
        matched = rxHex.includes(cleanMatch);
      } else {
        if (rule.isRegex) {
          try {
            const regex = new RegExp(rule.match);
            matched = regex.test(rxText);
          } catch (e) {
            // Invalid regex
          }
        } else {
          matched = rxText.includes(rule.match);
        }
      }

      if (matched) {
        setTimeout(() => {
          if (!instance.socket) return;

          let replyBuf;
          try {
            if (rule.replyHex) {
              const cleanReply = rule.reply.replace(/[\s,]/g, '');
              replyBuf = Buffer.from(cleanReply, 'hex');
            } else {
              replyBuf = Buffer.from(rule.reply, 'utf-8');
            }
          } catch (e) {
            this.emitTraffic(instance.id, 'ERROR', '', '', `规则回复内容格式错误: ${e.message}`, Date.now());
            return;
          }

          const txHex = replyBuf.toString('hex').toUpperCase().replace(/(.{2})/g, '$1 ').trim();
          const txAscii = this.toAsciiDisplay(replyBuf);

          instance.socket.send(replyBuf, rinfo.port, rinfo.address, (err) => {
            if (err) {
              this.emitTraffic(instance.id, 'ERROR', '', '', `自动回复发送到 ${rinfo.address}:${rinfo.port} 失败`, Date.now());
            }
          });
          this.emitTraffic(instance.id, 'TX', txHex, txAscii, `[自动回复] 发往 ${rinfo.address}:${rinfo.port}`, Date.now());

        }, rule.delay || 50);
        break;
      }
    }
  }

  // Helpers
  toAsciiDisplay(buf) {
    let str = '';
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c >= 32 && c <= 126) {
        str += String.fromCharCode(c);
      } else {
        str += '.';
      }
    }
    return str;
  }

  emitStatus(id, status) {
    this.emit('status', { id, status });
  }

  emitTraffic(id, dir, hex, ascii, desc, timestamp) {
    this.emit('traffic', { id, dir, hex, ascii, desc, timestamp });
  }

  emitClientsList(id, clients) {
    this.emit('clients', { id, clients });
  }
}

module.exports = new SocketDebugger();
