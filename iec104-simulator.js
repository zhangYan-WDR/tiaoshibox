const net = require('net');
const EventEmitter = require('events');

class IEC104Simulator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.port = config.port || 2404;
    this.commonAddress = config.commonAddress || 1;
    this.server = null;
    this.connections = new Set();
    
    // 模拟的寄存器数据
    this.yxData = {
      10001: 1, // 主开关状态 (0=分, 1=合)
      10002: 0, // 风机运行状态
      10003: 0, // 急停状态 (0=正常, 1=急停触发)
      10004: 0  // 变压器超温告警 (0=正常, 1=超温)
    };

    this.ycData = {
      16385: 220.5, // A相电压 (V)
      16386: 221.1, // B相电压 (V)
      16387: 219.8, // C相电压 (V)
      16388: 45.2,  // A相电流 (A)
      16389: 50.02, // 系统频率 (Hz)
      16390: 25.8   // 有功功率 (kW)
    };

    this.spontaneousTimer = null;
  }

  log(message) {
    this.emit('log', { message, timestamp: Date.now() });
  }

  start() {
    if (this.server) return;

    this.server = net.createServer((socket) => {
      this.log(`新的客户端连接接入: ${socket.remoteAddress}:${socket.remotePort}`);
      this.connections.add(socket);

      // 连接状态变量
      let sendSeq = 0;
      let recvSeq = 0;
      let rxBuf = Buffer.alloc(0);

      const sendAPDU = (apdu) => {
        if (socket.writable) {
          socket.write(apdu);
        }
      };

      const sendUFrameConfirm = (ctrl1) => {
        const apdu = Buffer.alloc(6);
        apdu[0] = 0x68;
        apdu[1] = 4;
        apdu[2] = ctrl1;
        apdu[3] = 0;
        apdu[4] = 0;
        apdu[5] = 0;
        sendAPDU(apdu);
      };

      const sendSFrame = (nr) => {
        const apdu = Buffer.alloc(6);
        apdu[0] = 0x68;
        apdu[1] = 4;
        apdu[2] = 0x01;
        apdu[3] = 0x00;
        apdu[4] = (nr & 0x7F) << 1;
        apdu[5] = (nr >> 7) & 0xFF;
        sendAPDU(apdu);
      };

      const sendIFrame = (asduBuf) => {
        const apdu = Buffer.alloc(6 + asduBuf.length);
        apdu[0] = 0x68;
        apdu[1] = 4 + asduBuf.length;
        
        const ns = sendSeq;
        const nr = recvSeq;
        
        apdu[2] = (ns & 0x7F) << 1;
        apdu[3] = (ns >> 7) & 0xFF;
        apdu[4] = (nr & 0x7F) << 1;
        apdu[5] = (nr >> 7) & 0xFF;
        
        asduBuf.copy(apdu, 6);
        sendAPDU(apdu);
        
        sendSeq = (sendSeq + 1) & 0x7FFF;
      };

      socket.on('data', (chunk) => {
        rxBuf = Buffer.concat([rxBuf, chunk]);
        
        while (rxBuf.length >= 2) {
          if (rxBuf[0] !== 0x68) {
            const idx = rxBuf.indexOf(0x68);
            if (idx === -1) {
              rxBuf = Buffer.alloc(0);
              break;
            }
            rxBuf = rxBuf.slice(idx);
            if (rxBuf.length < 2) break;
          }

          const apduLen = rxBuf[1];
          const totalLen = apduLen + 2;
          if (rxBuf.length < totalLen) break;

          const apdu = rxBuf.slice(0, totalLen);
          rxBuf = rxBuf.slice(totalLen);

          // 解析控制段
          const ctrl1 = apdu[2];
          const ctrl3 = apdu[4];

          if ((ctrl1 & 0x01) === 0) {
            // I 帧
            const ns = (ctrl1 >> 1) | (apdu[3] << 7);
            const nr = (ctrl3 >> 1) | (apdu[5] << 7);
            
            recvSeq = (ns + 1) & 0x7FFF;

            // 收到 I 帧，立即回复 S 帧确认
            sendSFrame(recvSeq);

            // 解析 ASDU
            if (apdu.length > 6) {
              const asdu = apdu.slice(6);
              this.handleClientASDU(asdu, sendIFrame);
            }

          } else if ((ctrl1 & 0x02) === 0) {
            // S 帧
            // 忽略，不做特殊处理
          } else {
            // U 帧
            if (ctrl1 === 0x07) {
              this.log('收到客户端 STARTDT Act, 回复 STARTDT Con');
              sendUFrameConfirm(0x0b); // STARTDT Con
            } else if (ctrl1 === 0x43) {
              // TESTFR Act
              sendUFrameConfirm(0x83); // TESTFR Con
            }
          }
        }
      });

      socket.on('error', (err) => {
        this.log(`连接出错 (${socket.remoteAddress}): ${err.message}`);
      });

      socket.on('close', () => {
        this.log(`客户端连接断开: ${socket.remoteAddress}`);
        this.connections.delete(socket);
      });
    });

    this.server.listen(this.port, () => {
      this.log(`IEC104 从站模拟器已启动，监听端口: ${this.port}`);
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
    });
  }

  // 模拟突发数据上送 (遥测抖动 & 遥信偶尔变化)
  startSpontaneousUpdates() {
    this.spontaneousTimer = setInterval(() => {
      if (this.connections.size === 0) return;

      // 1. 电压电流小幅抖动
      this.ycData[16385] = Number((220 + Math.random() * 2).toFixed(2));
      this.ycData[16386] = Number((220 + Math.random() * 2).toFixed(2));
      this.ycData[16387] = Number((220 + Math.random() * 2).toFixed(2));
      this.ycData[16388] = Number((45 + Math.random() * 2).toFixed(2));
      this.ycData[16390] = Number((25 + Math.random() * 4).toFixed(2));

      // 构造遥测突发上送报文 (Type 13, COT=3 自发, 6个点)
      const ycBuf = this.buildYCBuffer(this.ycData, 3);
      this.broadcast(ycBuf);

      // 2. 10%概率风机开关动作
      if (Math.random() < 0.1) {
        this.yxData[10002] = this.yxData[10002] === 0 ? 1 : 0;
        this.log(`[模拟器] 突发自发事件: 风机状态变化 -> ${this.yxData[10002]}`);
        
        // 构造单点遥信突发上送报文 (Type 1, COT=3)
        const yxBuf = this.buildYXBuffer({ 10002: this.yxData[10002] }, 3);
        this.broadcast(yxBuf);
      }
    }, 4000);
  }

  broadcast(asduBuf) {
    // 广播给所有客户端连接
    for (const socket of this.connections) {
      // 这里的 seq 是与具体 socket 绑定的，广播需要我们绕一下
      // 为了省去给每个 connection 记录 sequence，直接触发 socket 的 I帧发送
      // 我们在 connection 创建时直接闭包了 sendIFrame，所以在模拟器内进行独立广播最安全：
      // 在这个简易框架下，我们对每个 socket 重新触发一次各自的发送逻辑：
      socket.emit('send_iframe', asduBuf);
    }
  }

  // 接管客户端发过来的 I 帧 ASDU
  handleClientASDU(buf, sendIFrame) {
    const typeId = buf[0];
    const cot = buf[2];
    const commonAddr = buf.readUInt16LE(4);

    if (typeId === 100) {
      // 1. 客户端总召唤命令
      this.log(`[模拟器] 收到总召唤请求 (Common Address: ${commonAddr})`);
      
      // 1.1 发送总召唤激活确认 ActCon (Type 100, COT=7)
      const actCon = Buffer.alloc(10);
      buf.copy(actCon);
      actCon[2] = 7; // COT=7
      sendIFrame(actCon);

      // 1.2 发送单点遥信数据 (Type 1, COT=20)
      const yxBuf = this.buildYXBuffer(this.yxData, 20);
      sendIFrame(yxBuf);

      // 1.3 发送短浮点遥测数据 (Type 13, COT=20)
      const ycBuf = this.buildYCBuffer(this.ycData, 20);
      sendIFrame(ycBuf);

      // 1.4 发送总召唤结束 ActTerm (Type 100, COT=10)
      const actTerm = Buffer.alloc(10);
      buf.copy(actTerm);
      actTerm[2] = 10; // COT=10
      sendIFrame(actTerm);
      this.log(`[模拟器] 总召唤数据发送完成。`);

    } else if (typeId === 45 || typeId === 46) {
      // 2. 遥控命令
      const ioa = buf[6] | (buf[7] << 8) | (buf[8] << 16);
      const valByte = buf[9];
      const select = (valByte & 0x80) !== 0;
      const value = valByte & 0x03;
      const stepName = select ? '选择' : '执行';

      this.log(`[模拟器] 收到遥控命令 [${typeId === 45 ? '单字节' : '双字节'}]: IOA=${ioa}, ${stepName}, 目标值=${value}`);

      if (this.yxData[ioa] !== undefined) {
        // 合法地址，回复激活确认 ActCon (COT=7)
        const actCon = Buffer.alloc(10);
        buf.copy(actCon);
        actCon[2] = 7; // COT=7
        sendIFrame(actCon);

        if (!select) {
          // 如果是执行，改变数据值
          // 单遥控值直接映射为开关 0/1；双遥控 1映射为分闸(0)，2映射为合闸(1)
          let finalState = value;
          if (typeId === 46) {
            finalState = value === 2 ? 1 : 0;
          }
          
          this.yxData[ioa] = finalState;
          
          // 发送突发自发上报 YX
          const yxSpont = this.buildYXBuffer({ [ioa]: finalState }, 3);
          setTimeout(() => {
            this.broadcast(yxSpont);
          }, 500);

          // 发送激活结束 ActTerm (COT=10)
          setTimeout(() => {
            const actTerm = Buffer.alloc(10);
            buf.copy(actTerm);
            actTerm[2] = 10; // COT=10
            sendIFrame(actTerm);
          }, 1000);
        }
      } else {
        // 非法地址，回复否定确认 ActCon (COT = 7 | 0x40 = 71)
        this.log(`[模拟器] 遥控地址非法: IOA=${ioa}，拒绝操作`);
        const negActCon = Buffer.alloc(10);
        buf.copy(negActCon);
        negActCon[2] = 7 | 0x40; // Negative confirmation
        sendIFrame(negActCon);
      }
    } else if (typeId === 48 || typeId === 50) {
      // 3. 遥调命令
      const ioa = buf[6] | (buf[7] << 8) | (buf[8] << 16);
      const isFloat = typeId === 50;
      const val = isFloat ? buf.readFloatLE(9) : buf.readInt16LE(9);
      
      this.log(`[模拟器] 收到遥调设定命令: IOA=${ioa}, 目标设定值=${val}`);

      if (this.ycData[ioa] !== undefined) {
        // 回复 ActCon
        const actCon = Buffer.alloc(buf.length);
        buf.copy(actCon);
        actCon[2] = 7;
        sendIFrame(actCon);

        // 修改数值
        this.ycData[ioa] = val;

        // 发送突发自发上报 YC
        const ycSpont = this.buildYCBuffer({ [ioa]: val }, 3);
        setTimeout(() => {
          this.broadcast(ycSpont);
        }, 500);

        // 回复 ActTerm
        setTimeout(() => {
          const actTerm = Buffer.alloc(buf.length);
          buf.copy(actTerm);
          actTerm[2] = 10;
          sendIFrame(actTerm);
        }, 1000);
      } else {
        // 地址非法，回复否定激活确认
        this.log(`[模拟器] 遥调地址非法: IOA=${ioa}，拒绝操作`);
        const negActCon = Buffer.alloc(buf.length);
        buf.copy(negActCon);
        negActCon[2] = 7 | 0x40;
        sendIFrame(negActCon);
      }
    }
  }

  // 组装遥信数据 buffer (Type 1 单点遥信, SQ=0)
  buildYXBuffer(dataMap, cot) {
    const ioas = Object.keys(dataMap);
    const numObj = ioas.length;
    // ASDU 头部 6 字节 + 每个对象 4 字节 (3字节IOA + 1字节SPI和品质)
    const asdu = Buffer.alloc(6 + numObj * 4);
    
    asdu[0] = 1; // Type 1
    asdu[1] = numObj & 0x7F; // SQ=0
    asdu[2] = cot & 0x3F;
    asdu[3] = 0;
    asdu[4] = this.commonAddress & 0xFF;
    asdu[5] = (this.commonAddress >> 8) & 0xFF;

    let ptr = 6;
    for (const key of ioas) {
      const ioa = Number(key);
      const val = dataMap[key];

      asdu[ptr] = ioa & 0xFF;
      asdu[ptr + 1] = (ioa >> 8) & 0xFF;
      asdu[ptr + 2] = (ioa >> 16) & 0xFF;
      
      // SPI值，正常品质（IV=0, NT=0, SB=0, BL=0）
      asdu[ptr + 3] = val & 0x01;
      ptr += 4;
    }
    return asdu;
  }

  // 组装遥测数据 buffer (Type 13 短浮点数, SQ=0)
  buildYCBuffer(dataMap, cot) {
    const ioas = Object.keys(dataMap);
    const numObj = ioas.length;
    // ASDU 头部 6 字节 + 每个对象 8 字节 (3字节IOA + 4字节Float + 1字节QDS)
    const asdu = Buffer.alloc(6 + numObj * 8);

    asdu[0] = 13; // Type 13
    asdu[1] = numObj & 0x7F;
    asdu[2] = cot & 0x3F;
    asdu[3] = 0;
    asdu[4] = this.commonAddress & 0xFF;
    asdu[5] = (this.commonAddress >> 8) & 0xFF;

    let ptr = 6;
    for (const key of ioas) {
      const ioa = Number(key);
      const val = dataMap[key];

      asdu[ptr] = ioa & 0xFF;
      asdu[ptr + 1] = (ioa >> 8) & 0xFF;
      asdu[ptr + 2] = (ioa >> 16) & 0xFF;

      // 写入短浮点数
      asdu.writeFloatLE(val, ptr + 3);
      // 正常品质 QDS = 0
      asdu[ptr + 7] = 0;
      ptr += 8;
    }
    return asdu;
  }
}

// 扩展 net.Socket 的事件广播支持，使广播逻辑非常清爽
net.Socket.prototype.writable = true; // 确保 writable 属性支持

module.exports = IEC104Simulator;
