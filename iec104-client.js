const net = require('net');
const EventEmitter = require('events');

function formatNetError(err) {
  if (!err) return '';
  const msg = typeof err === 'string' ? err : err.message;
  if (msg.includes('ECONNREFUSED')) {
    return '端口不通 (目标从站拒绝连接，请确认该端口是否有 IEC104 服务在运行，且未被其他主站独占)';
  }
  if (msg.includes('EHOSTUNREACH') || msg.includes('EHOSTDOWN')) {
    return 'IP地址不可达 (物理链路或寻址失败，请确认设备网线已连接、且本地网卡已配置该网段 IP)';
  }
  if (msg.includes('ETIMEDOUT')) {
    return '连接超时 (无法连接到目标从站，请检查 IP 和端口是否正确，或者设备是否在线)';
  }
  if (msg.includes('ENETUNREACH')) {
    return '网络不可达 (本地网卡或路由器无法访问该网段)';
  }
  if (msg.includes('EPERM')) {
    return '操作被拒绝 (系统防火墙拦截，或者没有相应网络套接字绑定权限)';
  }
  return msg;
}

// 常量定义
const TYPE_NAMES = {
  1: '单点信息 (YX)',
  3: '双点信息 (YX)',
  9: '测量值, 规一化值 (YC)',
  11: '测量值, 标度化值 (YC)',
  13: '测量值, 短浮点数 (YC)',
  30: '带时标单点信息 (YX-Time)',
  31: '带时标双点信息 (YX-Time)',
  35: '带时标测量值, 规一化值 (YC-Time)',
  36: '带时标测量值, 标度化值 (YC-Time)',
  38: '带时标测量值, 短浮点数 (YC-Time)',
  45: '单命令遥控 (YK)',
  46: '双命令遥控 (YK)',
  48: '设点命令, 规一化值 (YT)',
  50: '设点命令, 短浮点数 (YT)',
  100: '总召唤 (GI)',
  101: '计数量召唤'
};

const COT_NAMES = {
  1: '周期/循环',
  2: '背景扫描',
  3: '突发 (自发)',
  4: '初始化',
  5: '请求/被请求',
  6: '激活',
  7: '激活确认',
  8: '停止激活',
  9: '停止激活确认',
  10: '激活结束',
  20: '响应总召唤',
  37: '文件传输'
};

class IEC104Client extends EventEmitter {
  constructor(config = {}) {
    super();
    this.id = config.id || Math.random().toString(36).substring(2, 9);
    this.ip = config.ip || '127.0.0.1';
    this.port = config.port || 2404;
    this.commonAddress = config.commonAddress || 1;
    
    // 超时参数 (单位秒)
    this.t0 = config.t0 || 10; // 连接超时
    this.t1 = config.t1 || 15; // 发送/测试超时
    this.t2 = config.t2 || 10; // 无数据确认超时
    this.t3 = config.t3 || 20; // 链路心跳空闲超时
    
    // 滑动窗口参数
    this.k = config.k || 12; // 最大未确认 I 帧数
    this.w = config.w || 8;  // 最大未确认 S 帧数 (触发发送S帧确认)
    
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5; // 5s

    // 协议状态变量
    this.socket = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
    this.sendSeq = 0; // N(S)
    this.recvSeq = 0; // N(R)
    this.lastAckedByPeer = 0; // 对方已确认的最新发送序号
    this.unackedCount = 0; // 收到 I 帧但未发送 S 帧确认的计数
    
    this.rxBuf = Buffer.alloc(0);
    this.reconnectTimer = null;
    this.activityTimer = null;
    this.lastActivity = Date.now();
    this.awaitingTestConfirm = false;
    this.testFrTimer = null;
    this.hasConnectedOnce = false;
    this.lastError = null;
    this.isManualDisconnect = false;
  }

  log(level, message) {
    this.emit('log', { level, message, timestamp: Date.now() });
  }

  connect() {
    if (this.socket) {
      this.disconnect();
    }

    this.lastError = null;
    this.hasConnectedOnce = false;
    this.setStatus('CONNECTING');
    this.log('info', `正在连接到从站 ${this.ip}:${this.port}...`);

    this.socket = new net.Socket();
    this.socket.setTimeout(this.t0 * 1000);

    this.socket.on('connect', () => {
      this.socket.setTimeout(0); // 禁用连接握手超时，改由应用层心跳机制(t3)维护
      this.log('info', `TCP 连接建立成功！开始进行 IEC104 握手 (发送 STARTDT Act)...`);
      this.sendSeq = 0;
      this.recvSeq = 0;
      this.lastAckedByPeer = 0;
      this.unackedCount = 0;
      this.rxBuf = Buffer.alloc(0);
      
      this.startActivityMonitoring();
      // 发送 STARTDT Activation 启动数据传输
      this.sendUFrame(0x07);
      this.logTraffic('TX', Buffer.from([0x68, 0x04, 0x07, 0x00, 0x00, 0x00]), 'U', 'STARTDT Act');
    });

    this.socket.on('data', (chunk) => {
      this.lastActivity = Date.now();
      this.rxBuf = Buffer.concat([this.rxBuf, chunk]);
      this.parseRxBuffer();
    });

    this.socket.on('timeout', () => {
      this.lastError = `连接超时 (目标 IP 存在但在 ${this.t0}s 内未响应 TCP 握手，请检查从站状态)`;
      this.log('warn', this.lastError);
      this.socket.destroy();
    });

    this.socket.on('error', (err) => {
      this.lastError = formatNetError(err);
      this.log('error', `网络套接字错误: ${err.message}`);
    });

    this.socket.on('close', () => {
      this.log('warn', '连接已断开。');
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
        this.setStatus('DISCONNECTED', this.lastError || '无法连接该从站，已停止重连');
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.activityTimer) clearInterval(this.activityTimer);
    if (this.testFrTimer) clearTimeout(this.testFrTimer);
    this.awaitingTestConfirm = false;
  }

  setStatus(status, error = null) {
    this.status = status;
    this.emit('status', { id: this.id, status, ip: this.ip, port: this.port, error });
  }

  // 活动性与心跳维持 ($t_3$ 超时校验)
  startActivityMonitoring() {
    this.lastActivity = Date.now();
    this.activityTimer = setInterval(() => {
      const now = Date.now();
      if (this.status === 'CONNECTED') {
        // 如果 $t_3$ 时间内没有任何收发，则发送 TestFR
        if (now - this.lastActivity >= this.t3 * 1000) {
          if (!this.awaitingTestConfirm) {
            this.log('info', `链路空闲超时超过 ${this.t3}s，发送心跳测试帧 (TESTFR Act)`);
            this.sendUFrame(0x43); // TESTFR Act
            this.logTraffic('TX', Buffer.from([0x68, 0x04, 0x43, 0x00, 0x00, 0x00]), 'U', 'TESTFR Act');
            this.awaitingTestConfirm = true;
            this.lastActivity = now;

            // 设置 $t_1$ 超时，若在此时间内未收到 TestFR Confirm 则断开连接
            this.testFrTimer = setTimeout(() => {
              if (this.awaitingTestConfirm) {
                this.log('error', `心跳帧超时未收到确认 (${this.t1}s)，断开重连`);
                this.socket.destroy();
              }
            }, this.t1 * 1000);
          }
        }
      }
    }, 1000);
  }

  // 粘包处理与报文分流
  parseRxBuffer() {
    while (this.rxBuf.length >= 2) {
      // 1. 搜寻起始字符 0x68
      if (this.rxBuf[0] !== 0x68) {
        const idx = this.rxBuf.indexOf(0x68);
        if (idx === -1) {
          this.rxBuf = Buffer.alloc(0);
          break;
        }
        this.rxBuf = this.rxBuf.slice(idx);
        if (this.rxBuf.length < 2) break;
      }

      // 2. 读取长度
      const apduLen = this.rxBuf[1];
      const totalLen = apduLen + 2;

      // 3. 判断数据包是否接收完整
      if (this.rxBuf.length < totalLen) {
        break; // 继续等待下一个包
      }

      const apdu = this.rxBuf.slice(0, totalLen);
      this.rxBuf = this.rxBuf.slice(totalLen);

      // 4. 解析 APDU
      try {
        this.processAPDU(apdu);
      } catch (err) {
        this.log('error', `解析报文出错: ${err.message}`);
      }
    }
  }

  processAPDU(apdu) {
    const ctrl1 = apdu[2];
    const ctrl2 = apdu[3];
    const ctrl3 = apdu[4];
    const ctrl4 = apdu[5];

    let type = 'Unknown';
    let desc = '';
    let parsedInfo = {};

    if ((ctrl1 & 0x01) === 0) {
      // I 帧 (信息帧)
      type = 'I';
      const ns = (ctrl1 >> 1) | (ctrl2 << 7);
      const nr = (ctrl3 >> 1) | (ctrl4 << 7);
      
      desc = `I 帧, N(S)=${ns}, N(R)=${nr}`;
      parsedInfo = { type: 'I', ns, nr };

      // 更新接收状态
      this.recvSeq = (ns + 1) & 0x7FFF;
      this.lastAckedByPeer = nr;
      this.unackedCount++;

      // 如果未确认帧数量到达滑动窗口上限，发送 S 帧确认
      if (this.unackedCount >= this.w) {
        this.sendSFrame();
      }

      // 解析 ASDU 载荷
      if (apdu.length > 6) {
        const asduBuf = apdu.slice(6);
        parsedInfo.asdu = this.parseASDU(asduBuf);
        if (parsedInfo.asdu) {
          desc += ` [${parsedInfo.asdu.typeName}, COT=${parsedInfo.asdu.cotName}]`;
        }
      }

    } else if ((ctrl1 & 0x02) === 0) {
      // S 帧 (确认帧)
      type = 'S';
      const nr = (ctrl3 >> 1) | (ctrl4 << 7);
      desc = `S 帧, N(R)=${nr}`;
      parsedInfo = { type: 'S', nr };
      this.lastAckedByPeer = nr;

    } else {
      // U 帧 (链路控制帧)
      type = 'U';
      parsedInfo = { type: 'U' };
      if (ctrl1 === 0x07) {
        desc = 'STARTDT Act';
        parsedInfo.uType = 'STARTDT Act';
        this.sendUFrame(0x0b); // 回复 STARTDT Con
        this.logTraffic('TX', Buffer.from([0x68, 0x04, 0x0b, 0x00, 0x00, 0x00]), 'U', 'STARTDT Con');
      } else if (ctrl1 === 0x0b) {
        desc = 'STARTDT Con';
        parsedInfo.uType = 'STARTDT Con';
        this.log('info', '收到从站的数据传输启动确认 (STARTDT Con)！链接完全激活。');
        this.hasConnectedOnce = true;
        this.setStatus('CONNECTED');
      } else if (ctrl1 === 0x13) {
        desc = 'STOPDT Act';
        parsedInfo.uType = 'STOPDT Act';
        this.sendUFrame(0x23); // STOPDT Con
      } else if (ctrl1 === 0x23) {
        desc = 'STOPDT Con';
        parsedInfo.uType = 'STOPDT Con';
      } else if (ctrl1 === 0x43) {
        desc = 'TESTFR Act';
        parsedInfo.uType = 'TESTFR Act';
        this.sendUFrame(0x83); // TESTFR Con
        this.logTraffic('TX', Buffer.from([0x68, 0x04, 0x83, 0x00, 0x00, 0x00]), 'U', 'TESTFR Con');
      } else if (ctrl1 === 0x83) {
        desc = 'TESTFR Con';
        parsedInfo.uType = 'TESTFR Con';
        this.awaitingTestConfirm = false;
        if (this.testFrTimer) clearTimeout(this.testFrTimer);
      }
    }

    this.logTraffic('RX', apdu, type, desc, parsedInfo);
  }

  // 解析 ASDU
  parseASDU(buf) {
    if (buf.length < 6) return null;
    const typeId = buf[0];
    const vsq = buf[1];
    const sq = (vsq & 0x80) >> 7;
    const numObj = vsq & 0x7F;
    const cot = buf[2] & 0x3F; // 低6位为传送原因
    const isNegConfirm = (buf[2] & 0x40) !== 0; // 是否是否定确认
    const commonAddr = buf.readUInt16LE(4);

    const typeName = TYPE_NAMES[typeId] || `未知ASDU-${typeId}`;
    const cotName = COT_NAMES[cot] || `原因-${cot}`;

    const parsed = {
      typeId,
      typeName,
      sq,
      numObj,
      cot,
      cotName: isNegConfirm ? `${cotName} (否定确认)` : cotName,
      commonAddr,
      objects: []
    };

    let ptr = 6;
    let baseIoa = 0;
    if (sq === 1 && numObj > 0) {
      if (ptr + 3 > buf.length) return parsed;
      baseIoa = buf[ptr] | (buf[ptr+1] << 8) | (buf[ptr+2] << 16);
      ptr += 3;
    }

    for (let i = 0; i < numObj; i++) {
      let ioa = 0;
      if (sq === 0) {
        if (ptr + 3 > buf.length) break;
        ioa = buf[ptr] | (buf[ptr+1] << 8) | (buf[ptr+2] << 16);
        ptr += 3;
      } else {
        ioa = baseIoa + i;
      }

      let objValue = null;
      let objQuality = null;
      let objTime = null;

      switch (typeId) {
        case 1: // 单点遥信
        case 30: { // 带时标单点
          if (ptr + 1 > buf.length) break;
          const val = buf[ptr++];
          objValue = val & 0x01; // 0=分, 1=合
          objQuality = this.parseQuality(val);
          if (typeId === 30) {
            if (ptr + 7 > buf.length) break;
            objTime = this.parseCP56Time2a(buf, ptr);
            ptr += 7;
          }
          break;
        }
        case 3: // 双点遥信
        case 31: { // 带时标双点
          if (ptr + 1 > buf.length) break;
          const val = buf[ptr++];
          objValue = val & 0x03; // 1=分, 2=合, 0或3为非法
          objQuality = this.parseQuality(val);
          if (typeId === 31) {
            if (ptr + 7 > buf.length) break;
            objTime = this.parseCP56Time2a(buf, ptr);
            ptr += 7;
          }
          break;
        }
        case 9: // 归一化遥测
        case 35: { // 带时标归一化
          if (ptr + 2 > buf.length) break;
          objValue = buf.readInt16LE(ptr);
          ptr += 2;
          if (ptr + 1 > buf.length) break;
          objQuality = this.parseQuality(buf[ptr++]);
          if (typeId === 35) {
            if (ptr + 7 > buf.length) break;
            objTime = this.parseCP56Time2a(buf, ptr);
            ptr += 7;
          }
          break;
        }
        case 11: // 标度化遥测
        case 36: { // 带时标标度化
          if (ptr + 2 > buf.length) break;
          objValue = buf.readInt16LE(ptr);
          ptr += 2;
          if (ptr + 1 > buf.length) break;
          objQuality = this.parseQuality(buf[ptr++]);
          if (typeId === 36) {
            if (ptr + 7 > buf.length) break;
            objTime = this.parseCP56Time2a(buf, ptr);
            ptr += 7;
          }
          break;
        }
        case 13: // 短浮点遥测
        case 38: { // 带时标短浮点
          if (ptr + 4 > buf.length) break;
          objValue = Number(buf.readFloatLE(ptr).toFixed(4));
          ptr += 4;
          if (ptr + 1 > buf.length) break;
          objQuality = this.parseQuality(buf[ptr++]);
          if (typeId === 38) {
            if (ptr + 7 > buf.length) break;
            objTime = this.parseCP56Time2a(buf, ptr);
            ptr += 7;
          }
          break;
        }
        case 45: // 遥控返校或激活确认
        case 46: {
          if (ptr + 1 > buf.length) break;
          const cmdByte = buf[ptr++];
          objValue = {
            state: cmdByte & 0x03,
            select: (cmdByte & 0x80) !== 0,
            qu: (cmdByte >> 2) & 0x1F
          };
          break;
        }
        case 48: // 遥调返校 (归一化)
        case 50: { // 遥调返校 (短浮点)
          const dataSize = typeId === 48 ? 2 : 4;
          if (ptr + dataSize + 1 > buf.length) break;
          const val = typeId === 48 ? buf.readInt16LE(ptr) : Number(buf.readFloatLE(ptr).toFixed(4));
          ptr += dataSize;
          const qos = buf[ptr++];
          objValue = {
            val,
            select: (qos & 0x80) !== 0,
            qu: qos & 0x7F
          };
          break;
        }
        default:
          // 其它不支持的对象直接跳过
          break;
      }

      if (objValue !== null || objQuality !== null) {
        parsed.objects.push({
          ioa,
          value: objValue,
          quality: objQuality,
          time: objTime
        });
      }
    }

    // 分发遥信遥测数据给前端监听
    if (parsed.objects.length > 0) {
      this.emit('data', {
        id: this.id,
        typeId,
        typeName,
        cot,
        cotName,
        commonAddr,
        objects: parsed.objects
      });
    }

    return parsed;
  }

  parseQuality(qds) {
    return {
      iv: (qds & 0x80) !== 0, // 无效 (Invalid)
      nt: (qds & 0x40) !== 0, // 非当前值 (Not Topical)
      sb: (qds & 0x20) !== 0, // 被替换 (Substituted)
      bl: (qds & 0x10) !== 0  // 被封锁 (Blocked)
    };
  }

  parseCP56Time2a(buf, offset) {
    try {
      const ms = buf.readUInt16LE(offset);
      const min = buf[offset + 2] & 0x3F;
      const hour = buf[offset + 3] & 0x1F;
      const day = buf[offset + 4] & 0x1F;
      const month = buf[offset + 5] & 0x0F;
      const year = buf[offset + 6] & 0x7F;

      const date = new Date(
        2000 + year,
        month - 1,
        day,
        hour,
        min,
        Math.floor(ms / 1000),
        ms % 1000
      );
      
      // 返回易读的本地时间
      return date.toLocaleString();
    } catch (e) {
      return '时间格式错误';
    }
  }

  // 发送 I 帧数据
  sendIFrame(asduBuf) {
    if (this.status !== 'CONNECTED' || !this.socket) {
      throw new Error('TCP 未连接，无法下发命令');
    }
    
    const apdu = Buffer.alloc(6 + asduBuf.length);
    apdu[0] = 0x68;
    apdu[1] = 4 + asduBuf.length;
    
    const ns = this.sendSeq;
    const nr = this.recvSeq;
    
    apdu[2] = (ns & 0x7F) << 1;
    apdu[3] = (ns >> 7) & 0xFF;
    apdu[4] = (nr & 0x7F) << 1;
    apdu[5] = (nr >> 7) & 0xFF;
    
    asduBuf.copy(apdu, 6);
    
    this.socket.write(apdu);
    
    // 更新发送序号
    this.sendSeq = (this.sendSeq + 1) & 0x7FFF;
    this.lastActivity = Date.now();
    this.unackedCount = 0; // 发送了I帧就顺便带去了接收序号的确认，重置计数

    // 解析发出的 ASDU
    const parsedAsdu = this.parseASDU(asduBuf);
    const desc = `I 帧, N(S)=${ns}, N(R)=${nr} [下发: ${parsedAsdu ? parsedAsdu.typeName : '未知'}]`;
    
    this.logTraffic('TX', apdu, 'I', desc, { type: 'I', ns, nr, asdu: parsedAsdu });
  }

  // 发送 S 帧确认
  sendSFrame() {
    if (this.status !== 'CONNECTED' || !this.socket) return;
    
    const apdu = Buffer.alloc(6);
    apdu[0] = 0x68;
    apdu[1] = 4;
    apdu[2] = 0x01;
    apdu[3] = 0x00;
    
    const nr = this.recvSeq;
    apdu[4] = (nr & 0x7F) << 1;
    apdu[5] = (nr >> 7) & 0xFF;
    
    this.socket.write(apdu);
    this.unackedCount = 0;
    this.lastActivity = Date.now();
    
    this.logTraffic('TX', apdu, 'S', `S 帧, 确认至 N(R)=${nr}`, { type: 'S', nr });
  }

  // 发送 U 帧控制帧
  sendUFrame(ctrl1) {
    if (!this.socket) return;
    
    const apdu = Buffer.alloc(6);
    apdu[0] = 0x68;
    apdu[1] = 4;
    apdu[2] = ctrl1;
    apdu[3] = 0x00;
    apdu[4] = 0x00;
    apdu[5] = 0x00;
    
    this.socket.write(apdu);
    this.lastActivity = Date.now();
  }

  // 记录报文日志并发送给 UI
  logTraffic(dir, rawBuf, type, desc, parsed = {}) {
    this.emit('traffic', {
      clientId: this.id,
      dir,
      hex: rawBuf.toString('hex').toUpperCase().match(/.{1,2}/g).join(' '),
      type,
      desc,
      parsed,
      timestamp: Date.now()
    });
  }

  // 发送总召唤 (Type 100)
  sendGeneralCall() {
    this.log('info', `发送总召唤 (GI) 命令 (CommonAddress=${this.commonAddress})...`);
    
    const asdu = Buffer.alloc(10);
    asdu[0] = 100; // Type 100
    asdu[1] = 1;   // VSQ: SQ=0, count=1
    asdu[2] = 6;   // COT=6 (激活)
    asdu[3] = 0;   // Originator Address
    asdu[4] = this.commonAddress & 0xFF;
    asdu[5] = (this.commonAddress >> 8) & 0xFF;
    asdu[6] = 0;   // IOA = 0
    asdu[7] = 0;
    asdu[8] = 0;
    asdu[9] = 20;  // QOI=20 (总召唤)
    
    this.sendIFrame(asdu);
  }

  // 下发遥控 (Type 45 / 46)
  // commandType: 45 (单遥控), 46 (双遥控)
  // step: 'select' (选择), 'execute' (执行)
  // value: 单遥控 0=分, 1=合；双遥控 1=分, 2=合
  sendTeleControl(ioa, commandType, value, step, commonAddressOverride) {
    const stepName = step === 'select' ? '选择' : '执行';
    const ca = commonAddressOverride !== undefined ? commonAddressOverride : this.commonAddress;
    this.log('info', `下发遥控命令: 地址 ${ioa}, 动作 ${stepName}, 状态值 ${value}, 公共地址 ${ca}`);

    const asdu = Buffer.alloc(10);
    asdu[0] = commandType; 
    asdu[1] = 1; // SQ=0, count=1
    asdu[2] = 6; // COT=6 (激活)
    asdu[3] = 0;
    asdu[4] = ca & 0xFF;
    asdu[5] = (ca >> 8) & 0xFF;
    
    // IOA (3 bytes)
    asdu[6] = ioa & 0xFF;
    asdu[7] = (ioa >> 8) & 0xFF;
    asdu[8] = (ioa >> 16) & 0xFF;

    // 命令控制字 (SCO / DCO)
    // Bit 7: 选择=1，执行=0
    // Bit 0-1: 动作值
    const selectBit = step === 'select' ? 0x80 : 0x00;
    asdu[9] = selectBit | (value & 0x03);

    this.sendIFrame(asdu);
  }

  // 下发遥调 (Type 48 / 50)
  // adjustType: 48 (归一化), 50 (短浮点)
  // value: 数值
  // step: 'select' (选择), 'execute' (执行)
  sendTeleAdjust(ioa, adjustType, value, step, commonAddressOverride) {
    const ca = commonAddressOverride !== undefined ? commonAddressOverride : this.commonAddress;
    const stepName = step === 'select' ? '选择' : (step === 'execute' ? '执行' : '直接执行');
    this.log('info', `下发遥调命令: 地址 ${ioa}, 动作 ${stepName}, 类型 ${adjustType === 48 ? '归一化' : '短浮点'}, 设点值 ${value}, 公共地址 ${ca}`);
    
    const dataSize = adjustType === 48 ? 2 : 4;
    const asdu = Buffer.alloc(9 + dataSize + 1); // 9字节固定头部 + 数据 + QOS
    
    asdu[0] = adjustType;
    asdu[1] = 1; // SQ=0, count=1
    asdu[2] = 6; // COT=6 (激活)
    asdu[3] = 0;
    asdu[4] = ca & 0xFF;
    asdu[5] = (ca >> 8) & 0xFF;
    
    // IOA
    asdu[6] = ioa & 0xFF;
    asdu[7] = (ioa >> 8) & 0xFF;
    asdu[8] = (ioa >> 16) & 0xFF;

    if (adjustType === 48) {
      // 归一化值，有符号 16 位整数
      asdu.writeInt16LE(value, 9);
    } else {
      // 短浮点数，32位浮点
      asdu.writeFloatLE(value, 9);
    }

    // 最后一个字节为 QOS (Qualifier of setpoint command)
    // Bit 7: 选择=1 (0x80)，执行=0 (0x00)
    const selectBit = step === 'select' ? 0x80 : 0x00;
    asdu[9 + dataSize] = selectBit;

    this.sendIFrame(asdu);
  }
}

module.exports = IEC104Client;
