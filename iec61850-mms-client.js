const net = require('net');
const EventEmitter = require('events');

// Helper to format net errors
function formatNetError(err) {
  if (!err) return '';
  const msg = typeof err === 'string' ? err : err.message;
  if (msg.includes('ECONNREFUSED')) {
    return '端口不通 (目标从站拒绝连接，请确认该端口是否有 MMS 服务在运行，且未被其他主站独占)';
  }
  if (msg.includes('EHOSTUNREACH')) {
    return 'IP地址不可达 (物理链路或寻址失败)';
  }
  if (msg.includes('ETIMEDOUT')) {
    return '连接超时 (无法连接到目标设备)';
  }
  return msg;
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
    
    // Check if constructed tag
    let children = null;
    if ((tag & 0x20) !== 0) {
      children = parseASN1(value, 0, value.length);
    }
    
    elements.push({ tag, length: len, value, children });
  }
  return elements;
}

// Helper to find a tag in ASN.1 tree
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

// ASN.1 BER Encoders
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

class IEC61850MMSClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.id = config.id || Math.random().toString(36).substring(2, 9);
    this.ip = config.ip || '127.0.0.1';
    this.port = config.port || 102;
    this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED, HANDSHAKING
    
    this.socket = null;
    this.rxBuf = Buffer.alloc(0);
    this.invokeId = 1;
    this.pendingRequests = new Map(); // invokeId -> { resolve, reject, cmd }
  }

  log(level, message) {
    this.emit('log', { level, message, timestamp: Date.now() });
  }

  connect() {
    if (this.socket) this.disconnect();
    
    this.status = 'CONNECTING';
    this.emitStatus();
    this.log('info', `正在连接到 MMS 服务端 ${this.ip}:${this.port}...`);

    this.socket = new net.Socket();
    this.socket.setTimeout(5000);

    this.socket.on('connect', () => {
      this.status = 'HANDSHAKING';
      this.emitStatus();
      this.log('info', `TCP 连接已建立，正在进行 COTP/ACSE 握手...`);
      this.sendCotpConnectRequest();
    });

    this.socket.on('data', (chunk) => {
      this.rxBuf = Buffer.concat([this.rxBuf, chunk]);
      this.parseRxBuffer();
    });

    this.socket.on('error', (err) => {
      const errMsg = formatNetError(err);
      this.log('error', `网络错误: ${errMsg}`);
      this.status = 'DISCONNECTED';
      this.emitStatus(errMsg);
    });

    this.socket.on('close', () => {
      this.log('warn', '连接已关闭。');
      this.status = 'DISCONNECTED';
      this.emitStatus();
      this.cleanupPendingRequests();
    });

    this.socket.connect(this.port, this.ip);
  }

  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.status = 'DISCONNECTED';
    this.emitStatus();
    this.cleanupPendingRequests();
  }

  emitStatus(error = null) {
    this.emit('status', { id: this.id, status: this.status, ip: this.ip, port: this.port, error });
  }

  cleanupPendingRequests() {
    for (const [id, req] of this.pendingRequests.entries()) {
      req.reject(new Error('连接断开'));
    }
    this.pendingRequests.clear();
  }

  // 1. Send COTP Connection Request
  sendCotpConnectRequest() {
    const cotpCr = Buffer.from([
      0x03, 0x00, 0x00, 0x16, // TPKT
      0x11,                   // COTP length
      0xe0,                   // Connection Request
      0x00, 0x00,             // Dest reference
      0x00, 0x01,             // Source reference
      0x00,                   // Class 0
      0xc1, 0x02, 0x01, 0x00, // Calling TSAP (01 00)
      0xc2, 0x02, 0x01, 0x02, // Called TSAP (01 02)
      0xc0, 0x01, 0x0a        // TPDU Size
    ]);
    this.socket.write(cotpCr);
    this.logTraffic('TX', cotpCr, 'COTP CR', '发送 COTP 连接请求');
  }

  // 2. Send ACSE Association Request & MMS Initiate Request
  sendAcseAssociateRequest() {
    const mmsInitReq = Buffer.concat([
      encodeTLV(0x80, encodeInteger(10)), // proposedMaxOutstandingCalling (10)
      encodeTLV(0x81, encodeInteger(10)), // proposedMaxOutstandingCalled (10)
      encodeTLV(0x82, encodeInteger(5)),  // proposedDataStructureNestingLevel (5)
      encodeTLV(0x83, Buffer.from([0x05, 0xf0, 0x00])) // max PDU size (61440)
    ]);

    const confirmedReq = Buffer.concat([
      encodeTLV(0x02, encodeInteger(this.invokeId++)), // Invoke ID
      encodeTLV(0xa0, mmsInitReq) // Initiate Request tag
    ]);

    // Construct ACSE User Information and presentation context
    const external = Buffer.concat([
      encodeTLV(0x06, Buffer.from([0x28, 0xca, 0x22, 0x02, 0x03])), // MMS OID: 1.0.9506.2.3
      encodeTLV(0xa0, encodeTLV(0xa8, confirmedReq)) // Confirmed Request
    ]);

    const aarq = Buffer.concat([
      encodeTLV(0x60, Buffer.concat([ // AARQ
        encodeTLV(0xa1, encodeTLV(0x06, Buffer.from([0x2a, 0x86, 0x48, 0xf6, 0x05, 0x01, 0x01]))), // ACSE Context
        encodeTLV(0xbe, encodeTLV(0x28, external)) // User information -> External -> MMS payload
      ]))
    ]);

    const presSeq = encodeTLV(0x31, aarq); // Presentation Sequence
    
    // TPKT + COTP DT
    const totalLen = presSeq.length + 7;
    const header = Buffer.alloc(7);
    header.writeUInt8(0x03, 0); // Version
    header.writeUInt8(0x00, 1); // Reserved
    header.writeUInt16BE(totalLen, 2); // Length
    header.writeUInt8(0x02, 4); // COTP DT length
    header.writeUInt8(0xf0, 5); // DT code
    header.writeUInt8(0x80, 6); // TPDU EOT

    const packet = Buffer.concat([header, presSeq]);
    this.socket.write(packet);
    this.logTraffic('TX', packet, 'AARQ', '发送 ACSE AARQ 关联请求 + MMS 初始化');
  }

  // Parse TPKT framing
  parseRxBuffer() {
    while (this.rxBuf.length >= 4) {
      if (this.rxBuf[0] !== 0x03) {
        // Find next TPKT start
        const idx = this.rxBuf.indexOf(0x03);
        if (idx === -1) {
          this.rxBuf = Buffer.alloc(0);
          break;
        }
        this.rxBuf = this.rxBuf.slice(idx);
        if (this.rxBuf.length < 4) break;
      }
      
      const totalLen = this.rxBuf.readUInt16BE(2);
      if (this.rxBuf.length < totalLen) {
        break; // Wait for full packet
      }
      
      const packet = this.rxBuf.slice(0, totalLen);
      this.rxBuf = this.rxBuf.slice(totalLen);
      
      try {
        this.processPacket(packet);
      } catch (err) {
        this.log('error', `处理响应报文失败: ${err.message}`);
      }
    }
  }

  processPacket(packet) {
    const cotpType = packet[5];
    
    if (this.status === 'HANDSHAKING') {
      if (cotpType === 0xd0) {
        // COTP CC (Connection Confirm)
        this.logTraffic('RX', packet, 'COTP CC', '收到 COTP 连接确认，开始发送 AARQ');
        this.sendAcseAssociateRequest();
      } else if (cotpType === 0xf0) {
        // COTP DT (Data) carrying AARE
        this.logTraffic('RX', packet, 'AARE', '收到 AARE 关联响应');
        
        // Parse ACSE AARE
        const payload = packet.slice(7);
        const elements = parseASN1(payload);
        
        // Find initiate response (tag a9)
        const initResp = findElement(elements, 0xa9);
        if (initResp) {
          this.status = 'CONNECTED';
          this.emitStatus();
          this.log('info', 'MMS 协议握手成功！连接已就绪。');
        } else {
          this.log('error', 'MMS 握手失败: AARE 中未找到 Initiate Response');
          this.disconnect();
        }
      }
    } else if (this.status === 'CONNECTED') {
      if (cotpType === 0xf0) {
        // Received data
        const payload = packet.slice(7);
        this.processMmsPdu(payload);
      }
    }
  }

  processMmsPdu(payload) {
    const elements = parseASN1(payload);
    if (elements.length === 0) return;
    
    const pdu = elements[0];
    
    // Unconfirmed PDU (Information Report) (tag 0xa3)
    if (pdu.tag === 0xa3) {
      this.logTraffic('RX', payload, 'INFO_REPORT', '收到自发上报报文 (InformationReport)');
      this.handleInformationReport(pdu.children);
      return;
    }
    
    // Confirmed Response PDU (tag 0xa1)
    if (pdu.tag === 0xa1) {
      const invokeElement = findElement(pdu.children, 0x02);
      if (!invokeElement) return;
      const invokeId = invokeElement.value[0];
      
      const req = this.pendingRequests.get(invokeId);
      if (!req) return;
      
      this.pendingRequests.delete(invokeId);
      this.logTraffic('RX', payload, 'CONFIRMED_RESP', `收到对请求 InvokeID:${invokeId} 的响应`);
      req.resolve(pdu.children);
    }
  }

  // Handle periodic unsolicited reports
  handleInformationReport(children) {
    // Information report contains a list of variables and their values
    try {
      const variableAccessSpec = children[0]; // listOfVariable or similar
      const listOfAccessResult = children[1];
      
      if (!listOfAccessResult || !listOfAccessResult.children) return;
      
      // Parse values
      const parsedResults = [];
      listOfAccessResult.children.forEach(res => {
        // res is AccessResult (success tag 0xa1)
        if (res.tag === 0xa1 && res.children) {
          const valEl = res.children[0];
          parsedResults.push(this.decodeMmsValue(valEl));
        }
      });

      this.emit('data', {
        id: this.id,
        type: 'report',
        results: parsedResults,
        timestamp: Date.now()
      });
    } catch (e) {
      this.log('error', `解析上报数据错误: ${e.message}`);
    }
  }

  // Decode MMS Data tag to JS value
  decodeMmsValue(el) {
    switch (el.tag) {
      case 0x83: // Boolean
        return { type: 'boolean', value: el.value[0] !== 0 };
      case 0x84: { // BitString
        const padding = el.value[0];
        let bits = '';
        for (let i = 1; i < el.value.length; i++) {
          const byte = el.value[i];
          const bitCount = (i === el.value.length - 1) ? (8 - padding) : 8;
          for (let b = 0; b < bitCount; b++) {
            bits += ((byte >> (7 - b)) & 0x01) ? '1' : '0';
          }
        }
        return { type: 'bitstring', value: bits };
      }
      case 0x85: // Integer
      case 0x86: { // Unsigned
        let val = 0;
        for (let i = 0; i < el.value.length; i++) {
          val = (val << 8) | el.value[i];
        }
        return { type: 'integer', value: val };
      }
      case 0x87: // Float
        if (el.value.length >= 4) {
          return { type: 'float', value: el.value.readFloatBE(0) };
        }
        return { type: 'float', value: 0 };
      case 0x89: // OctetString
        return { type: 'octet-string', value: el.value.toString('hex') };
      case 0x8a: // VisibleString
        return { type: 'string', value: el.value.toString('ascii') };
      case 0x91: // UtcTime
        if (el.value.length >= 4) {
          const sec = el.value.readUInt32BE(0);
          return { type: 'time', value: new Date(sec * 1000).toLocaleString() };
        }
        return { type: 'time', value: 'Unknown' };
      default:
        return { type: 'unknown', value: el.value.toString('hex') };
    }
  }

  // 3. Send Read Request for variable path
  readVariable(path) {
    if (this.status !== 'CONNECTED') {
      return Promise.reject(new Error('未连接 MMS 服务端'));
    }

    // Split path like: MyLD/LLN0$ST$Mod$stVal
    const slashIdx = path.indexOf('/');
    if (slashIdx === -1) {
      return Promise.reject(new Error('非法变量路径格式，应为 Device/LogicalNode$FC$DataObject$DataAttribute'));
    }
    
    const domainId = path.substring(0, slashIdx);
    const itemId = path.substring(slashIdx + 1);

    const invoke = this.invokeId++;
    
    const varSpec = Buffer.concat([
      encodeTLV(0xa1, Buffer.concat([ // domain-specific
        encodeTLV(0x1a, Buffer.from(domainId, 'ascii')), // domainId
        encodeTLV(0x1a, Buffer.from(itemId, 'ascii'))   // itemId
      ]))
    ]);

    const readReq = Buffer.concat([
      encodeTLV(0x80, Buffer.from([0x00])), // specificationWithResult = false
      encodeTLV(0xa1, encodeTLV(0x30, encodeTLV(0xa0, varSpec))) // listOfVariable -> VariableSpecification
    ]);

    const confirmedReq = Buffer.concat([
      encodeTLV(0x02, encodeInteger(invoke)), // Invoke ID
      encodeTLV(0xa4, readReq) // Read-Request tag
    ]);

    // Send packet
    const totalLen = confirmedReq.length + 7;
    const header = Buffer.alloc(7);
    header.writeUInt8(0x03, 0);
    header.writeUInt8(0x00, 1);
    header.writeUInt16BE(totalLen, 2);
    header.writeUInt8(0x02, 4);
    header.writeUInt8(0xf0, 5);
    header.writeUInt8(0x80, 6);

    const packet = Buffer.concat([header, confirmedReq]);
    this.socket.write(packet);
    this.logTraffic('TX', packet, 'READ_REQ', `发送读取请求 (InvokeID:${invoke}): ${path}`);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(invoke, {
        resolve: (respChildren) => {
          try {
            // Find read response details
            const readResp = findElement(respChildren, 0xa4);
            if (!readResp) {
              reject(new Error('返回数据未包含读响应域'));
              return;
            }
            // Parse listOfAccessResult
            const accessRes = findElement(readResp.children, 0xa1) || readResp.children[0];
            if (!accessRes || !accessRes.children) {
              reject(new Error('解析读结果失败'));
              return;
            }
            
            // AccessResult choice: success is tag 0xa1
            const successData = findElement(accessRes.children, 0xa1);
            if (successData && successData.children) {
              const decoded = this.decodeMmsValue(successData.children[0]);
              resolve(decoded);
              this.emit('data', { id: this.id, path, ...decoded });
            } else {
              // Might be a failure code (tag 0x80)
              const failCode = findElement(accessRes.children, 0x80);
              const errCode = failCode ? failCode.value[0] : '未知错误';
              reject(new Error(`服务端返回读取错误码: ${errCode}`));
            }
          } catch (e) {
            reject(e);
          }
        },
        reject,
        cmd: 'READ'
      });
    });
  }

  // 4. Send Write Request
  writeVariable(path, valObj) {
    // valObj should be { type: 'boolean'|'integer'|'float', value: val }
    if (this.status !== 'CONNECTED') {
      return Promise.reject(new Error('未连接 MMS 服务端'));
    }

    const slashIdx = path.indexOf('/');
    if (slashIdx === -1) {
      return Promise.reject(new Error('非法路径格式'));
    }
    
    const domainId = path.substring(0, slashIdx);
    const itemId = path.substring(slashIdx + 1);

    const invoke = this.invokeId++;
    
    // Variable Specification
    const varSpec = Buffer.concat([
      encodeTLV(0xa1, Buffer.concat([
        encodeTLV(0x1a, Buffer.from(domainId, 'ascii')),
        encodeTLV(0x1a, Buffer.from(itemId, 'ascii'))
      ]))
    ]);

    // Encode data value
    let encodedData;
    if (valObj.type === 'boolean') {
      encodedData = encodeTLV(0x83, Buffer.from([valObj.value ? 1 : 0]));
    } else if (valObj.type === 'integer') {
      encodedData = encodeTLV(0x85, encodeInteger(parseInt(valObj.value)));
    } else if (valObj.type === 'float') {
      const fBuf = Buffer.alloc(4);
      fBuf.writeFloatBE(parseFloat(valObj.value));
      encodedData = encodeTLV(0x87, fBuf);
    } else {
      encodedData = encodeTLV(0x8a, Buffer.from(String(valObj.value), 'ascii'));
    }

    const writeReq = Buffer.concat([
      encodeTLV(0xa0, encodeTLV(0x30, encodeTLV(0xa0, varSpec))), // listOfVariable
      encodeTLV(0xa1, encodeTLV(0x30, encodedData)) // listOfData
    ]);

    const confirmedReq = Buffer.concat([
      encodeTLV(0x02, encodeInteger(invoke)),
      encodeTLV(0xa5, writeReq) // Write-Request tag
    ]);

    const totalLen = confirmedReq.length + 7;
    const header = Buffer.alloc(7);
    header.writeUInt8(0x03, 0);
    header.writeUInt8(0x00, 1);
    header.writeUInt16BE(totalLen, 2);
    header.writeUInt8(0x02, 4);
    header.writeUInt8(0xf0, 5);
    header.writeUInt8(0x80, 6);

    const packet = Buffer.concat([header, confirmedReq]);
    this.socket.write(packet);
    this.logTraffic('TX', packet, 'WRITE_REQ', `发送下发命令 (InvokeID:${invoke}): ${path} = ${valObj.value}`);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(invoke, {
        resolve: (respChildren) => {
          try {
            const writeResp = findElement(respChildren, 0xa5);
            if (!writeResp) {
              reject(new Error('返回数据未包含写响应域'));
              return;
            }
            // In write response, it contains a sequence of Choice (success [0] Null, or failure [1] DataAccessError)
            // Success is 0x80 0x00 (Null value tag 0x80)
            const successTag = findElement(writeResp.children, 0x80);
            if (successTag) {
              resolve({ success: true });
              this.log('info', `变量 ${path} 写入成功！`);
            } else {
              const failTag = findElement(writeResp.children, 0x81);
              const errCode = failTag ? failTag.value[0] : '未知';
              reject(new Error(`下发执行失败，错误码: ${errCode}`));
            }
          } catch (e) {
            reject(e);
          }
        },
        reject,
        cmd: 'WRITE'
      });
    });
  }

  logTraffic(dir, rawBuf, type, desc) {
    this.emit('traffic', {
      clientId: this.id,
      dir,
      hex: rawBuf.toString('hex').toUpperCase().match(/.{1,2}/g).join(' '),
      type,
      desc,
      timestamp: Date.now()
    });
  }
}

module.exports = IEC61850MMSClient;
