const net = require('net');
const EventEmitter = require('events');

function formatNetError(err) {
  if (!err) return '';
  const msg = typeof err === 'string' ? err : err.message;
  if (msg.includes('ECONNREFUSED')) {
    return '端口不通 (目标设备拒绝连接，请确认该端口是否有 Modbus 服务在运行，且未被其他主站独占)';
  }
  if (msg.includes('EHOSTUNREACH') || msg.includes('EHOSTDOWN')) {
    return 'IP地址不可达 (物理链路或寻址失败，请确认设备网线已连接、且本地网卡已配置该网段 IP)';
  }
  if (msg.includes('ETIMEDOUT')) {
    return '连接超时 (无法连接到目标设备，请检查 IP 和端口是否正确，或者设备是否在线)';
  }
  if (msg.includes('ENETUNREACH')) {
    return '网络不可达 (本地网卡或路由器无法访问该网段)';
  }
  if (msg.includes('EPERM')) {
    return '操作被拒绝 (系统防火墙拦截，或者没有相应网络套接字绑定权限)';
  }
  return msg;
}

class ModbusTCPClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.id = config.id || Math.random().toString(36).substring(2, 9);
    this.ip = config.ip || '127.0.0.1';
    this.port = config.port || 502;
    this.unitId = config.unitId !== undefined ? config.unitId : 1;
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5; // seconds
    this.timeout = config.timeout || 5000; // ms

    this.socket = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
    this.transactionId = 0;
    this.pendingRequests = new Map(); // transactionId -> { resolve, reject, timer, buffer, fc, startAddress, quantity }
    this.rxBuf = Buffer.alloc(0);
    this.reconnectTimer = null;
    this.lastError = null;
    this.hasConnectedOnce = false;
    this.isManualDisconnect = false;
    
    // Polling definitions: Array of { fc, startAddress, quantity, interval, timer }
    this.polls = config.polls || [];
  }

  log(level, message) {
    this.emit('log', { level, message, timestamp: Date.now() });
  }

  logTraffic(dir, buf, desc) {
    this.emit('traffic', {
      clientId: this.id,
      dir,
      hex: buf.toString('hex').toUpperCase().match(/.{1,2}/g)?.join(' ') || '',
      type: 'MODBUS',
      desc,
      timestamp: Date.now()
    });
  }

  connect() {
    if (this.socket) {
      this.disconnect();
    }

    this.lastError = null;
    this.hasConnectedOnce = false;
    this.setStatus('CONNECTING');
    this.log('info', `正在连接到 Modbus TCP 从站 ${this.ip}:${this.port}...`);

    this.socket = new net.Socket();
    this.socket.setTimeout(this.timeout);

    this.socket.on('connect', () => {
      this.socket.setTimeout(0); // 禁用连接握手超时，交由正常的轮询机制处理
      this.log('info', `TCP 连接建立成功！开始进行 Modbus 应用层握手校验...`);
      this.rxBuf = Buffer.alloc(0);
      
      const fc = this.polls[0]?.fc || 3;
      const addr = this.polls[0]?.startAddress || 0;
      
      this.readRegisters(fc, addr, 1)
        .then(() => {
          this.log('info', `Modbus 应用层握手校验成功！`);
          this.hasConnectedOnce = true;
          this.setStatus('CONNECTED');
          this.startPolling();
        })
        .catch((err) => {
          if (err.message && err.message.includes('Modbus异常')) {
            this.log('info', `Modbus 应用层握手校验成功 (设备返回异常码，但证实其为 Modbus 从站)`);
            this.hasConnectedOnce = true;
            this.setStatus('CONNECTED');
            this.startPolling();
          } else {
            this.log('error', `Modbus 应用层校验失败: ${err.message}`);
            this.lastError = `Modbus 握手校验失败: ${err.message}`;
            this.socket.destroy();
          }
        });
    });

    this.socket.on('data', (chunk) => {
      this.rxBuf = Buffer.concat([this.rxBuf, chunk]);
      this.processRxBuffer();
    });

    this.socket.on('timeout', () => {
      this.lastError = `连接超时 (目标 IP 存在但没有在 ${this.timeout}ms 内做出响应，请检查设备状态)`;
      this.log('warn', this.lastError);
      this.socket.destroy();
    });

    this.socket.on('error', (err) => {
      this.lastError = formatNetError(err);
      this.log('error', `网络套接字错误: ${err.message}`);
    });

    this.socket.on('close', () => {
      this.log('warn', '连接已关闭。');
      this.cleanup();
      
      if (this.isManualDisconnect) {
        this.setStatus('DISCONNECTED', null);
        this.isManualDisconnect = false; // reset
      } else if (this.autoReconnect && this.hasConnectedOnce) {
        this.setStatus('RECONNECTING', this.lastError);
        this.log('info', `${this.reconnectInterval} 秒后尝试重新连接...`);
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval * 1000);
      } else {
        this.autoReconnect = false;
        this.setStatus('DISCONNECTED', this.lastError || '无法连接该地址，已停止重连');
      }
    });

    this.socket.connect(this.port, this.ip);
  }

  disconnect() {
    this.isManualDisconnect = true;
    this.autoReconnect = false;
    this.hasConnectedOnce = false;
    this.cleanup();
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.lastError = null;
    this.setStatus('DISCONNECTED', null);
    this.log('info', '已手动断开连接。');
  }

  cleanup() {
    this.stopPolling();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    
    // Reject all pending requests
    for (const [tid, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  setStatus(status, error = null) {
    this.status = status;
    this.emit('status', { id: this.id, status, ip: this.ip, port: this.port, error });
  }

  getNextTransactionId() {
    this.transactionId = (this.transactionId + 1) & 0xFFFF;
    return this.transactionId;
  }

  // Poll management
  startPolling() {
    this.polls.forEach(poll => {
      if (poll.timer) clearInterval(poll.timer);
      poll.timer = setInterval(() => {
        if (this.status !== 'CONNECTED') return;
        this.readRegisters(poll.fc, poll.startAddress, poll.quantity)
          .then(values => {
            this.emit('data', {
              id: this.id,
              fc: poll.fc,
              startAddress: poll.startAddress,
              quantity: poll.quantity,
              values,
              timestamp: Date.now()
            });
          })
          .catch(err => {
            this.log('error', `读取寄存器失败 (FC=${poll.fc}, Addr=${poll.startAddress}): ${err.message}`);
          });
      }, poll.interval || 1000);
    });
  }

  stopPolling() {
    this.polls.forEach(poll => {
      if (poll.timer) {
        clearInterval(poll.timer);
        poll.timer = null;
      }
    });
  }

  // Modbus read request
  readRegisters(fc, startAddress, quantity) {
    return new Promise((resolve, reject) => {
      if (this.status !== 'CONNECTED' && this.status !== 'CONNECTING') {
        return reject(new Error('Socket not connected'));
      }

      const tid = this.getNextTransactionId();
      const pdu = Buffer.alloc(5);
      pdu[0] = fc;
      pdu.writeUInt16BE(startAddress, 1);
      pdu.writeUInt16BE(quantity, 3);

      const adu = this.buildAdu(tid, pdu);
      
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(tid)) {
          this.pendingRequests.delete(tid);
          reject(new Error(`Transaction ${tid} timeout`));
        }
      }, this.timeout);

      this.pendingRequests.set(tid, {
        resolve,
        reject,
        timer,
        fc,
        startAddress,
        quantity
      });

      this.socket.write(adu);
      
      const fcNames = { 1: 'Read Coils', 2: 'Read Discrete Inputs', 3: 'Read Holding Registers', 4: 'Read Input Registers' };
      this.logTraffic('TX', adu, `TID: ${tid} | Unit: ${this.unitId} | FC: ${fc} (${fcNames[fc] || 'Unknown'}) | Addr: ${startAddress} | Qty: ${quantity}`);
    });
  }

  // Modbus write requests
  writeSingleCoil(address, value) {
    return new Promise((resolve, reject) => {
      if (this.status !== 'CONNECTED') return reject(new Error('Socket not connected'));

      const tid = this.getNextTransactionId();
      const pdu = Buffer.alloc(5);
      pdu[0] = 5; // FC5
      pdu.writeUInt16BE(address, 1);
      pdu.writeUInt16BE(value ? 0xFF00 : 0x0000, 3);

      const adu = this.buildAdu(tid, pdu);
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(tid)) {
          this.pendingRequests.delete(tid);
          reject(new Error(`Transaction ${tid} timeout`));
        }
      }, this.timeout);

      this.pendingRequests.set(tid, {
        resolve,
        reject,
        timer,
        fc: 5,
        startAddress: address,
        quantity: 1
      });

      this.socket.write(adu);
      this.logTraffic('TX', adu, `TID: ${tid} | Unit: ${this.unitId} | FC: 5 (Write Single Coil) | Addr: ${address} | Val: ${value ? 'ON' : 'OFF'}`);
    });
  }

  writeSingleRegister(address, value) {
    return new Promise((resolve, reject) => {
      if (this.status !== 'CONNECTED') return reject(new Error('Socket not connected'));

      const tid = this.getNextTransactionId();
      const pdu = Buffer.alloc(5);
      pdu[0] = 6; // FC6
      pdu.writeUInt16BE(address, 1);
      pdu.writeUInt16BE(value & 0xFFFF, 3);

      const adu = this.buildAdu(tid, pdu);
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(tid)) {
          this.pendingRequests.delete(tid);
          reject(new Error(`Transaction ${tid} timeout`));
        }
      }, this.timeout);

      this.pendingRequests.set(tid, {
        resolve,
        reject,
        timer,
        fc: 6,
        startAddress: address,
        quantity: 1
      });

      this.socket.write(adu);
      this.logTraffic('TX', adu, `TID: ${tid} | Unit: ${this.unitId} | FC: 6 (Write Single Register) | Addr: ${address} | Val: ${value}`);
    });
  }

  writeMultipleCoils(address, values) {
    return new Promise((resolve, reject) => {
      if (this.status !== 'CONNECTED') return reject(new Error('Socket not connected'));

      const tid = this.getNextTransactionId();
      const qty = values.length;
      const byteCount = Math.ceil(qty / 8);
      const pdu = Buffer.alloc(6 + byteCount);
      pdu[0] = 15; // FC15
      pdu.writeUInt16BE(address, 1);
      pdu.writeUInt16BE(qty, 3);
      pdu[5] = byteCount;

      let byteVal = 0;
      for (let i = 0; i < qty; i++) {
        if (values[i]) {
          byteVal |= (1 << (i % 8));
        }
        if ((i % 8 === 7) || (i === qty - 1)) {
          pdu[6 + Math.floor(i / 8)] = byteVal;
          byteVal = 0;
        }
      }

      const adu = this.buildAdu(tid, pdu);
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(tid)) {
          this.pendingRequests.delete(tid);
          reject(new Error(`Transaction ${tid} timeout`));
        }
      }, this.timeout);

      this.pendingRequests.set(tid, {
        resolve,
        reject,
        timer,
        fc: 15,
        startAddress: address,
        quantity: qty
      });

      this.socket.write(adu);
      this.logTraffic('TX', adu, `TID: ${tid} | Unit: ${this.unitId} | FC: 15 (Write Multiple Coils) | Addr: ${address} | Qty: ${qty}`);
    });
  }

  writeMultipleRegisters(address, values) {
    return new Promise((resolve, reject) => {
      if (this.status !== 'CONNECTED') return reject(new Error('Socket not connected'));

      const tid = this.getNextTransactionId();
      const qty = values.length;
      const byteCount = qty * 2;
      const pdu = Buffer.alloc(6 + byteCount);
      pdu[0] = 16; // FC16
      pdu.writeUInt16BE(address, 1);
      pdu.writeUInt16BE(qty, 3);
      pdu[5] = byteCount;

      for (let i = 0; i < qty; i++) {
        pdu.writeUInt16BE(values[i] & 0xFFFF, 6 + (i * 2));
      }

      const adu = this.buildAdu(tid, pdu);
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(tid)) {
          this.pendingRequests.delete(tid);
          reject(new Error(`Transaction ${tid} timeout`));
        }
      }, this.timeout);

      this.pendingRequests.set(tid, {
        resolve,
        reject,
        timer,
        fc: 16,
        startAddress: address,
        quantity: qty
      });

      this.socket.write(adu);
      this.logTraffic('TX', adu, `TID: ${tid} | Unit: ${this.unitId} | FC: 16 (Write Multiple Registers) | Addr: ${address} | Qty: ${qty}`);
    });
  }

  buildAdu(tid, pdu) {
    const adu = Buffer.alloc(7 + pdu.length);
    adu.writeUInt16BE(tid, 0);
    adu.writeUInt16BE(0, 2); // Protocol ID
    adu.writeUInt16BE(pdu.length + 1, 4); // Length (PDU length + Unit ID byte)
    adu[6] = this.unitId;
    pdu.copy(adu, 7);
    return adu;
  }

  processRxBuffer() {
    while (this.rxBuf.length >= 9) { // Minimally: MBAP(7) + FC(1) + Min PDU Data(1)
      const tid = this.rxBuf.readUInt16BE(0);
      const pid = this.rxBuf.readUInt16BE(2);
      const length = this.rxBuf.readUInt16BE(4);
      
      if (pid !== 0) {
        // Not Modbus TCP, skip first byte and retry
        this.rxBuf = this.rxBuf.slice(1);
        continue;
      }

      const totalAduLen = 6 + length;
      if (this.rxBuf.length < totalAduLen) {
        break; // Wait for more data
      }

      const adu = this.rxBuf.slice(0, totalAduLen);
      this.rxBuf = this.rxBuf.slice(totalAduLen);

      try {
        this.handleResponse(tid, adu);
      } catch (err) {
        this.log('error', `解析响应出错: ${err.message}`);
      }
    }
  }

  handleResponse(tid, adu) {
    const unitId = adu[6];
    const fc = adu[7];
    const pduData = adu.slice(8);

    const pending = this.pendingRequests.get(tid);
    if (!pending) {
      this.logTraffic('RX', adu, `TID: ${tid} | Unit: ${unitId} | 孤立/已超时的响应 | FC: ${fc}`);
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(tid);

    // Exception response check
    if (fc >= 0x80) {
      const originalFc = fc - 0x80;
      const exceptionCode = pduData[0];
      const excMsg = this.getExceptionMessage(exceptionCode);
      const errMsg = `Modbus异常 [FC: ${originalFc} -> Exception Code: ${exceptionCode} (${excMsg})]`;
      
      this.logTraffic('RX', adu, `TID: ${tid} | Unit: ${unitId} | FC: ${fc} (Exception) | Code: ${exceptionCode} (${excMsg})`);
      pending.reject(new Error(errMsg));
      return;
    }

    // Success response parsing
    let resultValues = null;
    let desc = `TID: ${tid} | Unit: ${unitId} | FC: ${fc} | Success`;

    if (fc === 1 || fc === 2) {
      // Coils / Discrete Inputs Response: byte count (1B) + bit values
      const byteCount = pduData[0];
      const bitBuffer = pduData.slice(1);
      resultValues = [];
      for (let i = 0; i < pending.quantity; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        const bitVal = (bitBuffer[byteIndex] >> bitIndex) & 0x01;
        resultValues.push(bitVal);
      }
      desc += ` | Bytes: ${byteCount} | Values: [${resultValues.join(', ')}]`;
    } else if (fc === 3 || fc === 4) {
      // Holding / Input Registers Response: byte count (1B) + word values
      const byteCount = pduData[0];
      resultValues = [];
      for (let i = 0; i < pending.quantity; i++) {
        const val = pduData.readUInt16BE(1 + (i * 2));
        resultValues.push(val);
      }
      desc += ` | Bytes: ${byteCount} | Regs: [${resultValues.join(', ')}]`;
    } else if (fc === 5 || fc === 6) {
      // Write Single Coil / Register Echo response
      const echoAddr = pduData.readUInt16BE(0);
      const echoVal = pduData.readUInt16BE(2);
      resultValues = echoVal;
      if (fc === 5) {
        desc += ` | Address: ${echoAddr} | Output Value: ${echoVal === 0xFF00 ? 'ON' : 'OFF'}`;
      } else {
        desc += ` | Address: ${echoAddr} | Value: ${echoVal}`;
      }
    } else if (fc === 15 || fc === 16) {
      // Write Multiple Echo response: address (2B) + quantity (2B)
      const echoAddr = pduData.readUInt16BE(0);
      const echoQty = pduData.readUInt16BE(2);
      resultValues = { address: echoAddr, quantity: echoQty };
      desc += ` | Address: ${echoAddr} | Quantity Written: ${echoQty}`;
    }

    this.logTraffic('RX', adu, desc);
    pending.resolve(resultValues);
  }

  getExceptionMessage(code) {
    const msgs = {
      1: 'Illegal Function',
      2: 'Illegal Data Address',
      3: 'Illegal Data Value',
      4: 'Slave Device Failure',
      5: 'Acknowledge',
      6: 'Slave Device Busy',
      8: 'Memory Parity Error',
      10: 'Gateway Path Unavailable',
      11: 'Gateway Target Device Failed to Respond'
    };
    return msgs[code] || 'Unknown Exception';
  }
}

module.exports = ModbusTCPClient;
