const net = require('net');
const EventEmitter = require('events');

class ModbusTCPSimulator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.port = config.port || 502; // 默认 502 标准端口
    this.unitId = config.unitId !== undefined ? config.unitId : 1;
    this.server = null;
    this.connections = new Set();

    // 初始化 65536 长度的 Modbus 寄存器存储
    this.coils = new Uint8Array(65536);
    this.discreteInputs = new Uint8Array(65536);
    this.inputRegisters = new Uint16Array(65536);
    this.holdingRegisters = new Uint16Array(65536);

    // 设置一些生动的预置数据
    // 1. 线圈 (0xxxx)
    this.coils[0] = 1; // 主阀门状态 (0=关, 1=开)
    this.coils[1] = 0; // 抽风机状态
    this.coils[2] = 0; // 加湿器状态
    this.coils[3] = 1; // 运行指示灯

    // 2. 离散输入 (1xxxx)
    this.discreteInputs[0] = 0; // 急停按钮 (0=未按下, 1=按下)
    this.discreteInputs[1] = 1; // 电源状态正常
    this.discreteInputs[2] = 0; // 烟雾探测告警 (0=无, 1=告警)

    // 3. 输入寄存器 (3xxxx)
    this.inputRegisters[0] = 2205; // 电压 (220.5 V, 放大10倍)
    this.inputRegisters[1] = 452;  // 电流 (45.2 A, 放大10倍)
    this.inputRegisters[2] = 5002; // 电网频率 (50.02 Hz, 放大100倍)
    this.inputRegisters[3] = 258;  // 机箱温度 (25.8 ℃, 放大10倍)
    this.inputRegisters[4] = 624;  // 环境湿度 (62.4 %, 放大10倍)

    // 4. 保持寄存器 (4xxxx)
    this.holdingRegisters[0] = 240;  // 设定温度控制点 (24.0 ℃, 放大10倍)
    this.holdingRegisters[1] = 2420; // 过压保护阀值 (242.0 V, 放大10倍)
    this.holdingRegisters[2] = 1980; // 欠压保护阀值 (198.0 V, 放大10倍)
    this.holdingRegisters[3] = 100;  // 阀门开度设定 (100 %)

    this.spontaneousTimer = null;
  }

  log(message) {
    this.emit('log', { message, timestamp: Date.now() });
  }

  start() {
    if (this.server) return;

    this.server = net.createServer((socket) => {
      const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
      this.log(`新的主站客户端接入: ${clientAddr}`);
      this.connections.add(socket);

      let rxBuf = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        rxBuf = Buffer.concat([rxBuf, chunk]);

        while (rxBuf.length >= 9) {
          const tid = rxBuf.readUInt16BE(0);
          const pid = rxBuf.readUInt16BE(2);
          const length = rxBuf.readUInt16BE(4);

          if (pid !== 0) {
            rxBuf = rxBuf.slice(1);
            continue;
          }

          const totalAduLen = 6 + length;
          if (rxBuf.length < totalAduLen) {
            break; // 报文不全，继续等待
          }

          const adu = rxBuf.slice(0, totalAduLen);
          rxBuf = rxBuf.slice(totalAduLen);

          try {
            this.handleRequest(socket, tid, adu);
          } catch (err) {
            this.log(`处理请求出错: ${err.message}`);
            this.sendException(socket, tid, adu[6], adu[7], 4); // 4 = Slave Device Failure
          }
        }
      });

      socket.on('error', (err) => {
        this.log(`主站连接异常 (${clientAddr}): ${err.message}`);
      });

      socket.on('close', () => {
        this.log(`主站连接断开: ${clientAddr}`);
        this.connections.delete(socket);
        this.emit('connections', this.connections.size);
      });

      this.emit('connections', this.connections.size);
    });

    this.server.on('error', (err) => {
      let errMsg = err.message;
      if (err.code === 'EACCES') {
        errMsg = `权限不足：无法绑定受限端口 ${this.port}。在 macOS/Linux 上，绑定 1024 以下的端口（如默认的 502）需要 root 管理员权限。您可以尝试使用管理员权限启动，或者将监听端口修改为 1024 以上的端口（例如 5020）。`;
      } else if (err.code === 'EADDRINUSE') {
        errMsg = `端口冲突：端口 ${this.port} 已被占用，请关闭冲突的程序或者修改模拟端口。`;
      }
      this.log(`模拟器启动失败: ${errMsg}`);
      this.stop();
    });

    this.server.listen(this.port, () => {
      this.log(`Modbus TCP 模拟从站已启动，监听端口: ${this.port} (Unit ID: ${this.unitId})`);
      this.emit('status', true);
      this.startSpontaneousUpdates();
    });
  }

  stop() {
    if (!this.server) return;

    if (this.spontaneousTimer) {
      clearInterval(this.spontaneousTimer);
      this.spontaneousTimer = null;
    }

    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    this.server.close(() => {
      this.log('模拟器服务已停止。');
      this.server = null;
      this.emit('status', false);
      this.emit('connections', 0);
    });
  }

  startSpontaneousUpdates() {
    // 模拟工业现场数据的小幅度物理波动
    this.spontaneousTimer = setInterval(() => {
      if (this.server) {
        // 电网电压与频率小幅晃动
        const voltageVol = Math.floor((Math.random() - 0.5) * 8);
        this.inputRegisters[0] = Math.max(2150, Math.min(2250, 2205 + voltageVol));

        const freqVol = Math.floor((Math.random() - 0.5) * 6);
        this.inputRegisters[2] = 5002 + freqVol;

        // 温度缓慢抖动
        const tempVol = Math.floor((Math.random() - 0.5) * 4);
        this.inputRegisters[3] = Math.max(220, Math.min(350, this.inputRegisters[3] + tempVol));

        // 告警偶尔模拟触发
        if (Math.random() < 0.05) {
          // 急停或烟雾触发，概率性恢复
          this.discreteInputs[2] = this.discreteInputs[2] === 0 ? 1 : 0;
          this.log(`[模拟器数据变更] 烟雾探测状态更新为: ${this.discreteInputs[2] === 1 ? '烟雾告警！' : '恢复正常'}`);
          this.emit('register-updated', { type: 'discreteInputs', address: 2, value: this.discreteInputs[2] });
        }

        // 通知前端，有数据发生了模拟更新
        this.emit('registers-updated');
      }
    }, 3000);
  }

  handleRequest(socket, tid, adu) {
    const unitId = adu[6];
    const fc = adu[7];
    const pduData = adu.slice(8);

    if (this.unitId !== 0 && unitId !== this.unitId && unitId !== 255) {
      // 若 Unit ID 不匹配且非广播，则直接忽略或返回异常 (典型做法是忽略)
      return;
    }

    if (fc === 1 || fc === 2) {
      // 读线圈 (FC1) 或离散输入 (FC2)
      const startAddr = pduData.readUInt16BE(0);
      const qty = pduData.readUInt16BE(2);

      if (startAddr + qty > 65536) {
        this.sendException(socket, tid, unitId, fc, 2); // Illegal Address
        return;
      }

      const byteCount = Math.ceil(qty / 8);
      const resPdu = Buffer.alloc(2 + byteCount);
      resPdu[0] = fc;
      resPdu[1] = byteCount;

      const dataSource = fc === 1 ? this.coils : this.discreteInputs;
      let tempByte = 0;
      for (let i = 0; i < qty; i++) {
        const val = dataSource[startAddr + i];
        if (val) {
          tempByte |= (1 << (i % 8));
        }
        if ((i % 8 === 7) || (i === qty - 1)) {
          resPdu[2 + Math.floor(i / 8)] = tempByte;
          tempByte = 0;
        }
      }

      this.sendAdu(socket, tid, unitId, resPdu);

    } else if (fc === 3 || fc === 4) {
      // 读保持寄存器 (FC3) 或输入寄存器 (FC4)
      const startAddr = pduData.readUInt16BE(0);
      const qty = pduData.readUInt16BE(2);

      if (startAddr + qty > 65536) {
        this.sendException(socket, tid, unitId, fc, 2);
        return;
      }

      const byteCount = qty * 2;
      const resPdu = Buffer.alloc(2 + byteCount);
      resPdu[0] = fc;
      resPdu[1] = byteCount;

      const dataSource = fc === 3 ? this.holdingRegisters : this.inputRegisters;
      for (let i = 0; i < qty; i++) {
        resPdu.writeUInt16BE(dataSource[startAddr + i], 2 + (i * 2));
      }

      this.sendAdu(socket, tid, unitId, resPdu);

    } else if (fc === 5) {
      // 写单个线圈 (FC5)
      const addr = pduData.readUInt16BE(0);
      const rawVal = pduData.readUInt16BE(2);

      if (addr > 65535) {
        this.sendException(socket, tid, unitId, fc, 2);
        return;
      }
      if (rawVal !== 0x0000 && rawVal !== 0xFF00) {
        this.sendException(socket, tid, unitId, fc, 3); // Illegal Value
        return;
      }

      const val = rawVal === 0xFF00 ? 1 : 0;
      this.coils[addr] = val;
      this.log(`[从站指令] 写单个线圈 (Coil ${addr}) -> ${val === 1 ? 'ON' : 'OFF'}`);
      this.emit('register-updated', { type: 'coils', address: addr, value: val });

      // FC5 响应是请求 PDU 的原样返回
      this.sendAdu(socket, tid, unitId, adu.slice(7));

    } else if (fc === 6) {
      // 写单个寄存器 (FC6)
      const addr = pduData.readUInt16BE(0);
      const val = pduData.readUInt16BE(2);

      if (addr > 65535) {
        this.sendException(socket, tid, unitId, fc, 2);
        return;
      }

      this.holdingRegisters[addr] = val;
      this.log(`[从站指令] 写单个保持寄存器 (HoldingReg ${addr}) -> ${val}`);
      this.emit('register-updated', { type: 'holdingRegisters', address: addr, value: val });

      this.sendAdu(socket, tid, unitId, adu.slice(7));

    } else if (fc === 15) {
      // 写多个线圈 (FC15)
      const startAddr = pduData.readUInt16BE(0);
      const qty = pduData.readUInt16BE(2);
      const byteCount = pduData[4];
      const bitBuffer = pduData.slice(5, 5 + byteCount);

      if (startAddr + qty > 65536) {
        this.sendException(socket, tid, unitId, fc, 2);
        return;
      }

      for (let i = 0; i < qty; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        const val = (bitBuffer[byteIndex] >> bitIndex) & 0x01;
        this.coils[startAddr + i] = val;
        this.emit('register-updated', { type: 'coils', address: startAddr + i, value: val });
      }

      this.log(`[从站指令] 写多个线圈 (Coils ${startAddr} ~ ${startAddr + qty - 1})`);
      
      const resPdu = Buffer.alloc(5);
      resPdu[0] = fc;
      resPdu.writeUInt16BE(startAddr, 1);
      resPdu.writeUInt16BE(qty, 3);

      this.sendAdu(socket, tid, unitId, resPdu);

    } else if (fc === 16) {
      // 写多个保持寄存器 (FC16)
      const startAddr = pduData.readUInt16BE(0);
      const qty = pduData.readUInt16BE(2);
      const byteCount = pduData[4];

      if (startAddr + qty > 65536) {
        this.sendException(socket, tid, unitId, fc, 2);
        return;
      }

      for (let i = 0; i < qty; i++) {
        const val = pduData.readUInt16BE(5 + (i * 2));
        this.holdingRegisters[startAddr + i] = val;
        this.emit('register-updated', { type: 'holdingRegisters', address: startAddr + i, value: val });
      }

      this.log(`[从站指令] 写多个保持寄存器 (HoldingRegs ${startAddr} ~ ${startAddr + qty - 1})`);

      const resPdu = Buffer.alloc(5);
      resPdu[0] = fc;
      resPdu.writeUInt16BE(startAddr, 1);
      resPdu.writeUInt16BE(qty, 3);

      this.sendAdu(socket, tid, unitId, resPdu);

    } else {
      // 不支持的命令类型，回复 Illegal Function (01)
      this.sendException(socket, tid, unitId, fc, 1);
    }
  }

  sendAdu(socket, tid, unitId, pdu) {
    if (!socket.writable) return;

    const adu = Buffer.alloc(7 + pdu.length);
    adu.writeUInt16BE(tid, 0);
    adu.writeUInt16BE(0, 2);
    adu.writeUInt16BE(pdu.length + 1, 4);
    adu[6] = unitId;
    pdu.copy(adu, 7);

    socket.write(adu);
  }

  sendException(socket, tid, unitId, fc, exceptionCode) {
    const pdu = Buffer.alloc(2);
    pdu[0] = fc + 0x80;
    pdu[1] = exceptionCode;
    this.sendAdu(socket, tid, unitId, pdu);
  }
}

module.exports = ModbusTCPSimulator;
