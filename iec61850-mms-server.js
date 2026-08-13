const net = require('net');
const EventEmitter = require('events');

// ASN.1 BER Helper Encoders
function encodeLength(len) {
  if (len < 128) return Buffer.from([len]);
  const bytes = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xFF);
    temp = temp >> 8;
  }
  return Buffer.concat([Buffer.from([0x80 + bytes.length]), Buffer.from(bytes)]);
}

function encodeTLV(tag, valBuf) {
  return Buffer.concat([Buffer.from([tag]), encodeLength(valBuf.length), valBuf]);
}

function encodeInteger(val) {
  let temp = val;
  const bytes = [];
  if (temp === 0) {
    bytes.push(0);
  } else {
    while (temp !== 0 && temp !== -1) {
      bytes.unshift(temp & 0xFF);
      temp = temp >> 8;
    }
    if (val > 0 && (bytes[0] & 0x80) !== 0) {
      bytes.unshift(0);
    }
  }
  return Buffer.from(bytes);
}

// ASN.1 BER Parser
function parseASN1(buf, offset = 0, limit = buf.length) {
  const elements = [];
  let ptr = offset;
  while (ptr < limit) {
    if (ptr + 2 > limit) break;
    const tag = buf[ptr++];
    
    // Parse length
    let len = buf[ptr++];
    if ((len & 0x80) !== 0) {
      const lenBytes = len & 0x7F;
      len = 0;
      for (let i = 0; i < lenBytes; i++) {
        len = (len << 8) | buf[ptr++];
      }
    }
    
    if (ptr + len > limit) break;
    const value = buf.slice(ptr, ptr + len);
    ptr += len;
    
    // Check if constructed
    let children = null;
    if ((tag & 0x20) !== 0) {
      children = parseASN1(value, 0, value.length);
    }
    
    elements.push({ tag, length: len, value, children });
  }
  return elements;
}

function findElement(elements, targetTag) {
  if (!elements) return null;
  for (const el of elements) {
    if (el.tag === targetTag) return el;
    if (el.children) {
      const found = findElement(el.children, targetTag);
      if (found) return found;
    }
  }
  return null;
}

class IEC61850MMSServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.port = config.port || 102;
    this.server = null;
    this.connections = new Set();
    
    // Initialize simulated database (standard IEC 61850 data model paths)
    this.db = new Map([
      ['MYSCL/LLN0$ST$Mod$stVal', { type: 'integer', value: 1 }],          // Mode: On
      ['MYSCL/LLN0$ST$Mod$q', { type: 'bitstring', value: '0000000000000' }],
      ['MYSCL/LLN0$ST$Beh$stVal', { type: 'integer', value: 1 }],          // Behavior: On
      
      // Control Object (Select Before Operate or Direct)
      ['MYSCL/CSWI1$ST$Pos$stVal', { type: 'integer', value: 2 }],         // Position: 2=Close, 1=Open
      ['MYSCL/CSWI1$ST$Pos$q', { type: 'bitstring', value: '0000000000000' }],
      ['MYSCL/CSWI1$ST$Pos$t', { type: 'time', value: Date.now() }],
      ['MYSCL/CSWI1$CO$Pos$Oper$ctlVal', { type: 'boolean', value: false }], // Operate command
      
      // Measurement readings
      ['MYSCL/MMXU1$MX$A$phsA$cVal$mag$f', { type: 'float', value: 220.5 }],  // phsA Current (A)
      ['MYSCL/MMXU1$MX$A$phsB$cVal$mag$f', { type: 'float', value: 221.1 }],  // phsB Current (A)
      ['MYSCL/MMXU1$MX$A$phsC$cVal$mag$f', { type: 'float', value: 219.8 }],  // phsC Current (A)
      
      ['MYSCL/MMXU1$MX$PhV$phsA$cVal$mag$f', { type: 'float', value: 10.0 }], // Voltage (kV)
      ['MYSCL/MMXU1$MX$PhV$phsB$cVal$mag$f', { type: 'float', value: 10.1 }],
      ['MYSCL/MMXU1$MX$PhV$phsC$cVal$mag$f', { type: 'float', value: 9.9 }],
      ['MYSCL/MMXU1$MX$PhV$phsA$q', { type: 'bitstring', value: '0000000000000' }]
    ]);

    this.reportTimer = null;
  }

  log(message) {
    this.emit('log', { level: 'info', message, timestamp: Date.now() });
  }

  start() {
    if (this.server) this.stop();

    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.server.on('error', (err) => {
      this.log(`模拟器服务端错误: ${err.message}`);
      this.emit('status', false);
    });

    this.server.listen(this.port, () => {
      this.log(`MMS 模拟器已成功启动并监听端口 ${this.port}...`);
      this.emit('status', true);
      
      // Start periodic reporting simulation
      this.startPeriodicReports();
    });
  }

  stop() {
    if (this.reportTimer) clearInterval(this.reportTimer);
    
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
    
    this.log('MMS 模拟器已停止。');
    this.emit('status', false);
  }

  updateValue(path, value) {
    const item = this.db.get(path);
    if (item) {
      let typedVal = value;
      if (item.type === 'integer') typedVal = parseInt(value);
      else if (item.type === 'float') typedVal = parseFloat(parseFloat(value).toFixed(2));
      else if (item.type === 'boolean') typedVal = value === true || value === 'true' || value === 1;
      
      item.value = typedVal;
      if (item.type === 'time' || path.endsWith('$stVal')) {
        // Automatically update timestamp if value changes
        const tPath = path.substring(0, path.lastIndexOf('$')) + '$t';
        if (this.db.has(tPath)) {
          this.db.get(tPath).value = Date.now();
        }
      }
      
      this.emit('data-change', { path, type: item.type, value: typedVal });
      this.log(`模拟器数据库值更新: ${path} = ${typedVal}`);
      
      // Instantly trigger unsolicited Information Report to all connected clients
      this.sendUnsolicitedReport(path, item);
    }
  }

  handleConnection(socket) {
    this.connections.add(socket);
    this.log(`主站建立 TCP 连接: ${socket.remoteAddress}:${socket.remotePort}`);

    let rxBuf = Buffer.alloc(0);
    let state = 'WAIT_COTP_CR';

    socket.on('data', (chunk) => {
      rxBuf = Buffer.concat([rxBuf, chunk]);
      
      while (rxBuf.length >= 4) {
        if (rxBuf[0] !== 0x03) {
          const idx = rxBuf.indexOf(0x03);
          if (idx === -1) {
            rxBuf = Buffer.alloc(0);
            break;
          }
          rxBuf = rxBuf.slice(idx);
          if (rxBuf.length < 4) break;
        }

        const totalLen = rxBuf.readUInt16BE(2);
        if (rxBuf.length < totalLen) break;

        const packet = rxBuf.slice(0, totalLen);
        rxBuf = rxBuf.slice(totalLen);

        try {
          this.processClientPacket(socket, packet);
        } catch (e) {
          this.log(`处理主站报文错误: ${e.message}`);
        }
      }
    });

    socket.on('close', () => {
      this.connections.delete(socket);
      this.log(`主站已断开连接: ${socket.remoteAddress}:${socket.remotePort}`);
    });

    socket.on('error', (err) => {
      this.log(`客户端连接错误: ${err.message}`);
    });
  }

  processClientPacket(socket, packet) {
    const cotpType = packet[5];
    
    // Log traffic
    this.emitTraffic('RX', socket, packet, 'CLIENT_MSG');

    if (cotpType === 0xe0) {
      // Client COTP CR -> Send COTP CC
      const cc = Buffer.from([
        0x03, 0x00, 0x00, 0x16, // TPKT
        0x11,                   // COTP len
        0xd0,                   // CC code
        0x00, 0x00,             // Dest ref
        0x00, 0x01,             // Source ref
        0x00,                   // Class 0
        0xc1, 0x02, 0x01, 0x00, // TSAP
        0xc2, 0x02, 0x01, 0x02,
        0xc0, 0x01, 0x0a
      ]);
      socket.write(cc);
      this.emitTraffic('TX', socket, cc, 'COTP CC');
      this.log(`与客户端协商 COTP 连接成功`);
    } else if (cotpType === 0xf0) {
      // Client DT carrying MMS request
      const payload = packet.slice(7);
      const elements = parseASN1(payload);
      if (elements.length === 0) return;

      const pdu = elements[0];
      
      // 1. AARQ tag (constructed 0x60) carrying Initiate Request
      if (findElement(elements, 0x60)) {
        this.log(`收到客户端 ACSE AARQ 握手`);
        this.sendAareResponse(socket);
      }
      // 2. Confirmed Request PDU (tag 0xa0)
      else if (pdu.tag === 0xa0) {
        this.handleConfirmedRequest(socket, pdu.children);
      }
    }
  }

  sendAareResponse(socket) {
    const aareUserDetail = Buffer.concat([
      encodeTLV(0x80, encodeInteger(10)), // Max outstanding calling (10)
      encodeTLV(0x81, encodeInteger(10)), // Max outstanding called (10)
      encodeTLV(0x82, encodeInteger(5)),  // Nesting level (5)
      encodeTLV(0x83, Buffer.from([0x05, 0xf0, 0x00])) // Max segment size (61440)
    ]);

    const initResp = Buffer.concat([
      encodeTLV(0x02, encodeInteger(1)), // Invoke ID
      encodeTLV(0xa0, aareUserDetail) // Initiate-Response tag
    ]);

    // Construct AARE user info Presentation context
    const external = Buffer.concat([
      encodeTLV(0x06, Buffer.from([0x28, 0xca, 0x22, 0x02, 0x03])), // MMS OID: 1.0.9506.2.3
      encodeTLV(0xa0, encodeTLV(0xa9, initResp)) // Confirmed Response
    ]);

    const aare = Buffer.concat([
      encodeTLV(0x61, Buffer.concat([ // AARE
        encodeTLV(0xa1, encodeTLV(0x06, Buffer.from([0x2a, 0x86, 0x48, 0xf6, 0x05, 0x01, 0x01]))), // ACSE Context
        encodeTLV(0xa2, Buffer.from([0x0a, 0x01, 0x00])), // Result: accepted
        encodeTLV(0xbe, encodeTLV(0x28, external)) // User info
      ]))
    ]);

    const presSeq = encodeTLV(0x32, aare); // Presentation Response
    
    // TPKT + COTP DT
    const totalLen = presSeq.length + 7;
    const header = Buffer.alloc(7);
    header.writeUInt8(0x03, 0);
    header.writeUInt8(0x00, 1);
    header.writeUInt16BE(totalLen, 2);
    header.writeUInt8(0x02, 4);
    header.writeUInt8(0xf0, 5);
    header.writeUInt8(0x80, 6);

    const packet = Buffer.concat([header, presSeq]);
    socket.write(packet);
    this.emitTraffic('TX', socket, packet, 'AARE');
    this.log(`已回复 AARE 关联确认，MMS 关联建立成功`);
  }

  handleConfirmedRequest(socket, children) {
    const invokeElement = findElement(children, 0x02);
    if (!invokeElement) return;
    const invokeId = invokeElement.value[0];

    // Find service tag (Read=0xa4, Write=0xa5, GetNameList=0xa1)
    const readReq = findElement(children, 0xa4);
    const writeReq = findElement(children, 0xa5);
    
    if (readReq) {
      this.handleReadRequest(socket, invokeId, readReq.children);
    } else if (writeReq) {
      this.handleWriteRequest(socket, invokeId, writeReq.children);
    }
  }

  // Handle MMS Read-Request
  handleReadRequest(socket, invokeId, children) {
    try {
      // Find Variable Specification (contains domainId and itemId)
      const varSpec = findElement(children, 0xa0);
      const domainSpec = findElement(varSpec ? varSpec.children : children, 0xa1);
      
      if (!domainSpec || !domainSpec.children) {
        this.sendReadError(socket, invokeId, 3); // 3 = DataAccessError: object-non-existent
        return;
      }

      const domainId = domainSpec.children[0].value.toString('ascii');
      const itemId = domainSpec.children[1].value.toString('ascii');
      const path = `${domainId}/${itemId}`;

      this.log(`主站请求读取变量: ${path}`);

      const item = this.db.get(path);
      if (!item) {
        this.log(`读取错误: 变量 ${path} 不存在`);
        this.sendReadError(socket, invokeId, 3);
        return;
      }

      // Encode value
      let encodedVal;
      if (item.type === 'boolean') {
        encodedVal = encodeTLV(0x83, Buffer.from([item.value ? 1 : 0]));
      } else if (item.type === 'integer') {
        encodedVal = encodeTLV(0x85, encodeInteger(item.value));
      } else if (item.type === 'float') {
        const fBuf = Buffer.alloc(4);
        fBuf.writeFloatBE(item.value);
        encodedVal = encodeTLV(0x87, fBuf);
      } else if (item.type === 'bitstring') {
        // Simple bitstring encoding
        const bits = item.value;
        const totalLen = Math.ceil(bits.length / 8);
        const bBuf = Buffer.alloc(1 + totalLen);
        bBuf[0] = (8 - (bits.length % 8)) % 8; // Padding
        let currentByte = 0;
        for (let i = 0; i < bits.length; i++) {
          if (bits[i] === '1') currentByte |= (1 << (7 - (i % 8)));
          if ((i % 8 === 7) || (i === bits.length - 1)) {
            bBuf[1 + Math.floor(i / 8)] = currentByte;
            currentByte = 0;
          }
        }
        encodedVal = encodeTLV(0x84, bBuf);
      } else if (item.type === 'time') {
        // UTC Time
        const tBuf = Buffer.alloc(8);
        const sec = Math.floor(new Date(item.value).getTime() / 1000);
        tBuf.writeUInt32BE(sec, 0);
        tBuf.writeUInt32BE(0, 4);
        encodedVal = encodeTLV(0x91, tBuf);
      } else {
        encodedVal = encodeTLV(0x8a, Buffer.from(String(item.value), 'ascii'));
      }

      // Success choice tag is 0xa1 (Data)
      const accessResult = encodeTLV(0xa1, encodedVal); 
      
      const readResp = encodeTLV(0xa4, encodeTLV(0xa1, encodeTLV(0x30, accessResult))); // Read-Response -> listOfAccessResult
      const confirmedResp = Buffer.concat([
        encodeTLV(0x02, encodeInteger(invokeId)),
        readResp
      ]);
      const outerPdu = encodeTLV(0xa1, confirmedResp); // Confirmed Response PDU

      // Send packet
      const totalLen = outerPdu.length + 7;
      const header = Buffer.alloc(7);
      header.writeUInt8(0x03, 0);
      header.writeUInt8(0x00, 1);
      header.writeUInt16BE(totalLen, 2);
      header.writeUInt8(0x02, 4);
      header.writeUInt8(0xf0, 5);
      header.writeUInt8(0x80, 6);

      const packet = Buffer.concat([header, outerPdu]);
      socket.write(packet);
      this.emitTraffic('TX', socket, packet, 'READ_RESP');
    } catch (err) {
      this.log(`读取错误: ${err.message}`);
      this.sendReadError(socket, invokeId, 9); // temporary-failure
    }
  }

  sendReadError(socket, invokeId, errCode) {
    const accessResult = encodeTLV(0x80, Buffer.from([errCode])); // failure tag 0x80 (DataAccessError)
    const readResp = encodeTLV(0xa4, encodeTLV(0xa1, encodeTLV(0x30, accessResult)));
    const confirmedResp = Buffer.concat([
      encodeTLV(0x02, encodeInteger(invokeId)),
      readResp
    ]);
    const outerPdu = encodeTLV(0xa1, confirmedResp);

    const totalLen = outerPdu.length + 7;
    const header = Buffer.alloc(7);
    header.writeUInt8(0x03, 0);
    header.writeUInt8(0x00, 1);
    header.writeUInt16BE(totalLen, 2);
    header.writeUInt8(0x02, 4);
    header.writeUInt8(0xf0, 5);
    header.writeUInt8(0x80, 6);

    const packet = Buffer.concat([header, outerPdu]);
    socket.write(packet);
    this.emitTraffic('TX', socket, packet, 'READ_RESP_ERR');
  }

  // Handle MMS Write-Request
  handleWriteRequest(socket, invokeId, children) {
    try {
      const varSpec = findElement(children, 0xa0);
      const domainSpec = findElement(varSpec ? varSpec.children : children, 0xa1);
      
      const listOfData = findElement(children, 0xa1) || children[1];
      
      if (!domainSpec || !domainSpec.children || !listOfData || !listOfData.children) {
        this.sendWriteError(socket, invokeId, 3);
        return;
      }

      const domainId = domainSpec.children[0].value.toString('ascii');
      const itemId = domainSpec.children[1].value.toString('ascii');
      const path = `${domainId}/${itemId}`;

      this.log(`主站请求下发写入: ${path}`);

      const item = this.db.get(path);
      if (!item) {
        this.log(`写入错误: 变量 ${path} 不存在`);
        this.sendWriteError(socket, invokeId, 3);
        return;
      }

      // Parse payload value
      const rawValEl = listOfData.children[0].children ? listOfData.children[0].children[0] : listOfData.children[0];
      let decodedVal = null;
      if (rawValEl.tag === 0x83) { // Boolean
        decodedVal = rawValEl.value[0] !== 0;
      } else if (rawValEl.tag === 0x85) { // Unsigned
        let val = 0;
        for (let i = 0; i < rawValEl.value.length; i++) val = (val << 8) | rawValEl.value[i];
        decodedVal = val;
      } else if (rawValEl.tag === 0x87) { // Float
        decodedVal = rawValEl.value.readFloatBE(0);
      } else {
        decodedVal = rawValEl.value.toString('ascii');
      }

      // Write to DB
      this.updateValue(path, decodedVal);

      // Handle Select Before Operate simulation
      // If client writes to CSWI1$CO$Pos$Oper$ctlVal, automatically toggle the state CSWI1$ST$Pos$stVal
      if (path === 'MYSCL/CSWI1$CO$Pos$Oper$ctlVal') {
        const valToSet = decodedVal === true ? 2 : 1; // true -> close (2), false -> open (1)
        setTimeout(() => {
          this.updateValue('MYSCL/CSWI1$ST$Pos$stVal', valToSet);
          this.log(`操作联动: 模拟开关触点自动变位为: ${valToSet === 2 ? '合位 (Close)' : '分位 (Open)'}`);
        }, 800);
      }

      // Success write response (tag 0x80 Null value)
      const accessResult = encodeTLV(0x80, Buffer.alloc(0));
      const writeResp = encodeTLV(0xa5, encodeTLV(0x30, accessResult)); // Write-Response -> sequence of AccessResult
      const confirmedResp = Buffer.concat([
        encodeTLV(0x02, encodeInteger(invokeId)),
        writeResp
      ]);
      const outerPdu = encodeTLV(0xa1, confirmedResp);

      const totalLen = outerPdu.length + 7;
      const header = Buffer.alloc(7);
      header.writeUInt8(0x03, 0);
      header.writeUInt8(0x00, 1);
      header.writeUInt16BE(totalLen, 2);
      header.writeUInt8(0x02, 4);
      header.writeUInt8(0xf0, 5);
      header.writeUInt8(0x80, 6);

      const packet = Buffer.concat([header, outerPdu]);
      socket.write(packet);
      this.emitTraffic('TX', socket, packet, 'WRITE_RESP');
    } catch (err) {
      this.log(`写入错误: ${err.message}`);
      this.sendWriteError(socket, invokeId, 9);
    }
  }

  sendWriteError(socket, invokeId, errCode) {
    const accessResult = encodeTLV(0x81, Buffer.from([errCode])); // failure tag 0x81 (DataAccessError)
    const writeResp = encodeTLV(0xa5, encodeTLV(0x30, accessResult));
    const confirmedResp = Buffer.concat([
      encodeTLV(0x02, encodeInteger(invokeId)),
      writeResp
    ]);
    const outerPdu = encodeTLV(0xa1, confirmedResp);

    const totalLen = outerPdu.length + 7;
    const header = Buffer.alloc(7);
    header.writeUInt8(0x03, 0);
    header.writeUInt8(0x00, 1);
    header.writeUInt16BE(totalLen, 2);
    header.writeUInt8(0x02, 4);
    header.writeUInt8(0xf0, 5);
    header.writeUInt8(0x80, 6);

    const packet = Buffer.concat([header, outerPdu]);
    socket.write(packet);
    this.emitTraffic('TX', socket, packet, 'WRITE_RESP_ERR');
  }

  // Periodic simulated values update (simulation of dynamic currents/voltages)
  startPeriodicReports() {
    this.reportTimer = setInterval(() => {
      // Add slight jitter to current measurements to simulate live field values
      const phsA = this.db.get('MYSCL/MMXU1$MX$A$phsA$cVal$mag$f');
      const phsB = this.db.get('MYSCL/MMXU1$MX$A$phsB$cVal$mag$f');
      const phsC = this.db.get('MYSCL/MMXU1$MX$A$phsC$cVal$mag$f');
      
      if (phsA && phsB && phsC) {
        const deltaA = (Math.random() - 0.5) * 0.4;
        const deltaB = (Math.random() - 0.5) * 0.4;
        const deltaC = (Math.random() - 0.5) * 0.4;

        this.updateValue('MYSCL/MMXU1$MX$A$phsA$cVal$mag$f', phsA.value + deltaA);
        this.updateValue('MYSCL/MMXU1$MX$A$phsB$cVal$mag$f', phsB.value + deltaB);
        this.updateValue('MYSCL/MMXU1$MX$A$phsC$cVal$mag$f', phsC.value + deltaC);
      }
    }, 3000);
  }

  // Send unsolicited report (InformationReport) to all connected clients
  sendUnsolicitedReport(path, item) {
    if (this.connections.size === 0) return;

    try {
      // Construct variable specification list
      const varSpec = encodeTLV(0xa1, Buffer.concat([
        encodeTLV(0x1a, Buffer.from('MYSCL', 'ascii')),
        encodeTLV(0x1a, Buffer.from(path.split('/')[1], 'ascii'))
      ]));

      const listOfVariable = encodeTLV(0xa0, encodeTLV(0x30, encodeTLV(0xa0, varSpec)));

      // Encode value
      let encodedVal;
      if (item.type === 'boolean') {
        encodedVal = encodeTLV(0x83, Buffer.from([item.value ? 1 : 0]));
      } else if (item.type === 'integer') {
        encodedVal = encodeTLV(0x85, encodeInteger(item.value));
      } else if (item.type === 'float') {
        const fBuf = Buffer.alloc(4);
        fBuf.writeFloatBE(item.value);
        encodedVal = encodeTLV(0x87, fBuf);
      } else {
        encodedVal = encodeTLV(0x8a, Buffer.from(String(item.value), 'ascii'));
      }

      const listOfData = encodeTLV(0xa1, encodeTLV(0x30, encodeTLV(0xa1, encodedVal))); // success tag 0xa1

      // InformationReport tag is 0xa3 (Unconfirmed PDU)
      const infoReport = encodeTLV(0xa3, Buffer.concat([
        listOfVariable,
        listOfData
      ]));

      // TPKT + COTP DT
      const totalLen = infoReport.length + 7;
      const header = Buffer.alloc(7);
      header.writeUInt8(0x03, 0);
      header.writeUInt8(0x00, 1);
      header.writeUInt16BE(totalLen, 2);
      header.writeUInt8(0x02, 4);
      header.writeUInt8(0xf0, 5);
      header.writeUInt8(0x80, 6);

      const packet = Buffer.concat([header, infoReport]);

      for (const socket of this.connections) {
        socket.write(packet);
        this.emitTraffic('TX', socket, packet, 'INFO_REPORT');
      }
    } catch (e) {
      this.log(`发送自发上报报文失败: ${e.message}`);
    }
  }

  emitTraffic(dir, socket, rawBuf, type) {
    this.emit('traffic', {
      dir,
      hex: rawBuf.toString('hex').toUpperCase().match(/.{1,2}/g).join(' '),
      type,
      desc: `${dir === 'TX' ? '发送' : '接收'} MMS 报文 (源/宿: ${socket.remoteAddress}:${socket.remotePort})`,
      timestamp: Date.now()
    });
  }
}

module.exports = IEC61850MMSServer;
