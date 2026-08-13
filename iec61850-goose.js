const dgram = require('dgram');
const EventEmitter = require('events');

// Helper to encode ASN.1 Length
function encodeASN1Length(len) {
  if (len < 128) {
    return Buffer.from([len]);
  }
  const bytes = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xFF);
    temp = temp >> 8;
  }
  return Buffer.concat([
    Buffer.from([0x80 + bytes.length]),
    Buffer.from(bytes)
  ]);
}

// Helper to encode ASN.1 Tag-Length-Value
function encodeTLV(tag, valBuffer) {
  const lenBuf = encodeASN1Length(valBuffer.length);
  return Buffer.concat([Buffer.from([tag]), lenBuf, valBuffer]);
}

// Helper to encode Integer
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
    // Handle sign bit in two's complement
    if (val > 0 && (bytes[0] & 0x80) !== 0) {
      bytes.unshift(0);
    } else if (val < 0 && (bytes[0] & 0x80) === 0) {
      bytes.unshift(0xFF);
    }
  }
  return Buffer.from(bytes);
}

// Helper to encode Float
function encodeFloat(val) {
  const buf = Buffer.alloc(8);
  buf.writeDoubleBE(val);
  return Buffer.concat([Buffer.from([0x08]), buf]); // 0x08 exponent/width byte
}

// Helper to encode BitString
function encodeBitString(bits) {
  // bits is a string like "01001"
  const paddingBits = (8 - (bits.length % 8)) % 8;
  const totalLen = Math.ceil(bits.length / 8);
  const buf = Buffer.alloc(1 + totalLen);
  buf[0] = paddingBits; // Unused bits in last octet
  let val = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      val |= (1 << (7 - (i % 8)));
    }
    if ((i % 8 === 7) || (i === bits.length - 1)) {
      buf[1 + Math.floor(i / 8)] = val;
      val = 0;
    }
  }
  return buf;
}

// Parse ASN.1 BER Length
function parseASN1Length(buf, offset) {
  let ptr = offset;
  if (ptr >= buf.length) return { length: 0, bytesRead: 0 };
  const first = buf[ptr++];
  if ((first & 0x80) === 0) {
    return { length: first, bytesRead: 1 };
  }
  const lenBytes = first & 0x7F;
  if (ptr + lenBytes > buf.length) return { length: 0, bytesRead: 1 };
  let len = 0;
  for (let i = 0; i < lenBytes; i++) {
    len = (len << 8) | buf[ptr++];
  }
  return { length: len, bytesRead: 1 + lenBytes };
}

// Parse ASN.1 BER Elements
function parseASN1Elements(buf, offset = 0, limit = buf.length) {
  const elements = [];
  let ptr = offset;
  while (ptr < limit) {
    if (ptr + 2 > limit) break;
    const tag = buf[ptr++];
    const lenInfo = parseASN1Length(buf, ptr);
    ptr += lenInfo.bytesRead;
    const length = lenInfo.length;
    if (ptr + length > limit) break;
    const value = buf.slice(ptr, ptr + length);
    ptr += length;
    elements.push({ tag, value });
  }
  return elements;
}

// Decode GOOSE Dataset Values
function decodeGooseData(elements) {
  return elements.map(el => {
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
      case 0x86: { // Unsigned Integer
        let val = 0;
        for (let i = 0; i < el.value.length; i++) {
          val = (val << 8) | el.value[i];
        }
        // Handle negative signed integers
        if (el.tag === 0x85 && el.value.length > 0 && (el.value[0] & 0x80) !== 0) {
          val = val - (1 << (el.value.length * 8));
        }
        return { type: 'integer', value: val };
      }
      case 0x87: { // Float
        if (el.value.length >= 9) {
          // Skip first byte (exponent width)
          return { type: 'float', value: el.value.readDoubleBE(1) };
        }
        return { type: 'float', value: 0 };
      }
      case 0x8A: // VisibleString
        return { type: 'string', value: el.value.toString('ascii') };
      case 0x91: { // UtcTime (8 bytes)
        if (el.value.length >= 4) {
          const sec = el.value.readUInt32BE(0);
          const date = new Date(sec * 1000);
          return { type: 'time', value: date.toLocaleString() };
        }
        return { type: 'time', value: 'Unknown' };
      }
      default:
        return { type: 'unknown', value: el.value.toString('hex') };
    }
  });
}

// Main GOOSE Engine
class GOOSEEngine extends EventEmitter {
  constructor() {
    super();
    this.publishers = new Map();
    this.subscribers = new Map();
    this.localBus = new EventEmitter(); // Local loopback bridge
  }

  // 1. Create and Start GOOSE Publisher
  startPublisher(config) {
    const id = config.id || Math.random().toString(36).substring(2, 9);
    
    if (this.publishers.has(id)) {
      this.stopPublisher(id);
    }

    const pub = {
      id,
      gocbRef: config.gocbRef || 'MyLD/LLN0$GO$gcb1',
      datSet: config.datSet || 'MyLD/LLN0$Dataset1',
      goID: config.goID || 'GoosePub1',
      appid: parseInt(config.appid || '3000', 16),
      multicastIp: config.multicastIp || '239.255.0.1',
      port: config.port || 3782, // Standard UDP multicast port
      confRev: config.confRev || 1,
      minTime: config.minTime || 4, // ms
      maxTime: config.maxTime || 2000, // ms
      stNum: 1,
      sqNum: 0,
      test: config.test === true,
      ndsCom: false,
      dataset: config.dataset || [
        { name: 'Trip', type: 'boolean', value: false },
        { name: 'Pos_stVal', type: 'integer', value: 2 }, // 1=open, 2=close
        { name: 'Pos_q', type: 'bitstring', value: '0000000000000' }
      ],
      socket: null,
      timer: null,
      currentInterval: config.maxTime || 2000,
      fastRetransmitCount: 0
    };

    // Initialize UDP socket
    pub.socket = dgram.createSocket('udp4');
    
    const publishFrame = () => {
      try {
        const apdu = this.encodeAPDU(pub);
        const header = Buffer.alloc(8);
        header.writeUInt16BE(pub.appid, 0); // APPID
        header.writeUInt16BE(apdu.length + 8, 2); // Length
        header.writeUInt16BE(0, 4); // Reserved 1
        header.writeUInt16BE(0, 6); // Reserved 2
        
        const packet = Buffer.concat([header, apdu]);

        // Multicast over UDP
        pub.socket.send(packet, pub.port, pub.multicastIp, (err) => {
          if (err) {
            this.emitLog(id, 'error', `发送 GOOSE 报文失败: ${err.message}`);
          }
        });

        // Trigger local loopback for the subscriber inside the same process
        this.localBus.emit('goose:packet', {
          appid: pub.appid,
          multicastIp: pub.multicastIp,
          port: pub.port,
          apdu
        });

        this.emitTraffic(id, 'TX', pub.multicastIp, pub.appid, packet, pub);

        // Increment sqNum
        pub.sqNum++;
        
        // Schedule next transmission
        scheduleNext();
      } catch (err) {
        this.emitLog(id, 'error', `打包 GOOSE 帧出错: ${err.message}`);
      }
    };

    const scheduleNext = () => {
      if (pub.timer) clearTimeout(pub.timer);
      
      // Fast retransmission timing logic
      if (pub.fastRetransmitCount > 0) {
        // Double the interval until reaching maxTime
        pub.currentInterval = Math.min(pub.currentInterval * 2, pub.maxTime);
        pub.fastRetransmitCount--;
        if (pub.currentInterval >= pub.maxTime) {
          pub.fastRetransmitCount = 0;
        }
      } else {
        pub.currentInterval = pub.maxTime;
      }

      pub.timer = setTimeout(publishFrame, pub.currentInterval);
    };

    pub.triggerTrip = (newValues) => {
      // Update values in dataset
      let changed = false;
      pub.dataset.forEach(item => {
        if (newValues[item.name] !== undefined && newValues[item.name] !== item.value) {
          item.value = newValues[item.name];
          changed = true;
        }
      });

      if (changed) {
        pub.stNum++;
        pub.sqNum = 0;
        pub.currentInterval = pub.minTime;
        // Start rapid retransmissions (typically 5 times)
        pub.fastRetransmitCount = 5;
        this.emitLog(id, 'info', `数据发生变更，触发 GOOSE 快速重传! stNum=${pub.stNum}`);
        
        // Publish instantly
        if (pub.timer) clearTimeout(pub.timer);
        publishFrame();
      }
    };

    this.publishers.set(id, pub);
    
    // Start publishing loop
    publishFrame();
    this.emitLog(id, 'info', `GOOSE 发布端已启动，多播地址: ${pub.multicastIp}:${pub.port}, APPID: 0x${pub.appid.toString(16)}`);
    this.emitStatus(id, 'publisher', true);

    return id;
  }

  // Stop GOOSE Publisher
  stopPublisher(id) {
    const pub = this.publishers.get(id);
    if (pub) {
      if (pub.timer) clearTimeout(pub.timer);
      if (pub.socket) {
        pub.socket.close();
      }
      this.publishers.delete(id);
      this.emitLog(id, 'info', 'GOOSE 发布端已停止。');
      this.emitStatus(id, 'publisher', false);
      return true;
    }
    return false;
  }

  // 2. Start GOOSE Subscriber
  startSubscriber(config) {
    const id = config.id || Math.random().toString(36).substring(2, 9);

    if (this.subscribers.has(id)) {
      this.stopSubscriber(id);
    }

    const sub = {
      id,
      multicastIp: config.multicastIp || '239.255.0.1',
      port: config.port || 3782,
      appidFilter: config.appidFilter ? parseInt(config.appidFilter, 16) : null,
      socket: null,
      lastPackets: new Map() // Keep track of latest packet per gocbRef for diagnostic alarms
    };

    sub.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    
    sub.socket.on('message', (msg, rinfo) => {
      this.processIncomingPacket(id, msg, rinfo.address, sub);
    });

    sub.socket.on('error', (err) => {
      this.emitLog(id, 'error', `订阅端套接字错误: ${err.message}`);
    });

    // Listen on local loopback bridge for internal communication testing
    const localHandler = (data) => {
      // Check filters
      if (sub.appidFilter && data.appid !== sub.appidFilter) return;
      if (data.multicastIp !== sub.multicastIp || data.port !== sub.port) return;
      
      const packet = Buffer.alloc(8 + data.apdu.length);
      packet.writeUInt16BE(data.appid, 0);
      packet.writeUInt16BE(data.apdu.length + 8, 2);
      packet.copy(data.apdu, 8);
      
      this.processIncomingPacket(id, packet, '127.0.0.1', sub);
    };

    this.localBus.on('goose:packet', localHandler);
    sub.localHandler = localHandler;

    sub.socket.bind(sub.port, () => {
      try {
        sub.socket.addMembership(sub.multicastIp);
        this.emitLog(id, 'info', `GOOSE 订阅端已启动，绑定本地端口 ${sub.port}，加入多播组 ${sub.multicastIp}`);
      } catch (err) {
        this.emitLog(id, 'warn', `无法绑定/加入真实网络多播组 (可能是权限或回环接口限制): ${err.message}，切换到软件回环监听`);
      }
    });

    this.subscribers.set(id, sub);
    this.emitStatus(id, 'subscriber', true);
    return id;
  }

  // Stop GOOSE Subscriber
  stopSubscriber(id) {
    const sub = this.subscribers.get(id);
    if (sub) {
      if (sub.socket) {
        try {
          sub.socket.close();
        } catch (e) {}
      }
      if (sub.localHandler) {
        this.localBus.removeListener('goose:packet', sub.localHandler);
      }
      this.subscribers.delete(id);
      this.emitLog(id, 'info', 'GOOSE 订阅端已停止。');
      this.emitStatus(id, 'subscriber', false);
      return true;
    }
    return false;
  }

  // Process and Decode GOOSE Packet
  processIncomingPacket(subId, packet, srcAddress, sub) {
    if (packet.length < 8) return;
    
    const appid = packet.readUInt16BE(0);
    const length = packet.readUInt16BE(2);
    
    if (sub.appidFilter && sub.appidFilter !== appid) {
      return; // Filtered out
    }

    const apdu = packet.slice(8, length);
    
    try {
      const decoded = this.decodeAPDU(apdu);
      if (!decoded) return;

      decoded.appid = appid;
      decoded.srcAddress = srcAddress;

      // Diagnostic check: packet drops, TTL alerts
      const key = decoded.gocbRef;
      const last = sub.lastPackets.get(key);
      let alert = null;
      if (last) {
        if (decoded.stNum === last.stNum) {
          // Same state, sequence should increment
          if (decoded.sqNum > last.sqNum + 1) {
            alert = `检测到丢包! 序号跳变 (${last.sqNum} -> ${decoded.sqNum})`;
            this.emitLog(subId, 'warn', `[${decoded.goID}] ${alert}`);
          }
        } else if (decoded.stNum > last.stNum) {
          // State changed
          if (decoded.sqNum !== 0) {
            alert = `警告: 状态发生改变 (${last.stNum} -> ${decoded.stNum}) 但 sqNum 不为 0 (当前为 ${decoded.sqNum})`;
            this.emitLog(subId, 'warn', `[${decoded.goID}] ${alert}`);
          }
        }
      }
      sub.lastPackets.set(key, decoded);

      this.emitTraffic(subId, 'RX', srcAddress, appid, packet, decoded);
      
      // Send decoded data to UI
      this.emit('subscriber-data', {
        subId,
        appid,
        srcAddress,
        gocbRef: decoded.gocbRef,
        datSet: decoded.datSet,
        goID: decoded.goID,
        stNum: decoded.stNum,
        sqNum: decoded.sqNum,
        confRev: decoded.confRev,
        dataset: decoded.dataset,
        timestamp: decoded.timestamp,
        alert
      });
    } catch (e) {
      // Silently ignore decode errors for non-GOOSE UDP packets on the same port
    }
  }

  // Encode GOOSE APDU into ASN.1 BER
  encodeAPDU(pub) {
    const list = [];
    
    // gocbRef [0]
    list.push(encodeTLV(0x80, Buffer.from(pub.gocbRef, 'ascii')));
    
    // timeAllowedToLive [1] (2 * interval)
    list.push(encodeTLV(0x81, encodeInteger(pub.currentInterval * 2)));
    
    // datSet [2]
    list.push(encodeTLV(0x82, Buffer.from(pub.datSet, 'ascii')));
    
    // goID [3]
    list.push(encodeTLV(0x83, Buffer.from(pub.goID, 'ascii')));
    
    // t [4] (UtcTime, 8 bytes)
    const tBuf = Buffer.alloc(8);
    const sec = Math.floor(Date.now() / 1000);
    tBuf.writeUInt32BE(sec, 0);
    tBuf.writeUInt32BE(0, 4); // Fraction of second / Quality
    list.push(encodeTLV(0x84, tBuf));
    
    // stNum [5]
    list.push(encodeTLV(0x85, encodeInteger(pub.stNum)));
    
    // sqNum [6]
    list.push(encodeTLV(0x86, encodeInteger(pub.sqNum)));
    
    // test [7]
    list.push(encodeTLV(0x87, Buffer.from([pub.test ? 1 : 0])));
    
    // confRev [8]
    list.push(encodeTLV(0x88, encodeInteger(pub.confRev)));
    
    // ndsCom [9]
    list.push(encodeTLV(0x89, Buffer.from([pub.ndsCom ? 1 : 0])));
    
    // numDatSetEntries [10]
    list.push(encodeTLV(0x8A, encodeInteger(pub.dataset.length)));
    
    // allData [11] -> tag 0xAB (Sequence)
    const dataList = pub.dataset.map(item => {
      if (item.type === 'boolean') {
        return encodeTLV(0x83, Buffer.from([item.value ? 1 : 0]));
      } else if (item.type === 'bitstring') {
        return encodeTLV(0x84, encodeBitString(item.value));
      } else if (item.type === 'integer') {
        return encodeTLV(0x85, encodeInteger(item.value));
      } else if (item.type === 'float') {
        return encodeTLV(0x87, encodeFloat(item.value));
      } else {
        return encodeTLV(0x8A, Buffer.from(String(item.value), 'ascii'));
      }
    });
    
    list.push(encodeTLV(0xAB, Buffer.concat(dataList)));

    // Outer tag 0x61 (GOOSE APDU)
    return encodeTLV(0x61, Buffer.concat(list));
  }

  // Decode GOOSE APDU from ASN.1 BER
  decodeAPDU(buf) {
    if (buf[0] !== 0x61) return null;
    const lenInfo = parseASN1Length(buf, 1);
    const apduPayload = buf.slice(1 + lenInfo.bytesRead, 1 + lenInfo.bytesRead + lenInfo.length);
    
    const elements = parseASN1Elements(apduPayload);
    const info = {};

    elements.forEach(el => {
      switch (el.tag) {
        case 0x80:
          info.gocbRef = el.value.toString('ascii');
          break;
        case 0x81:
          info.timeAllowedToLive = parseASN1Elements(el.value)[0]?.value?.readUInt16BE(0) || 0;
          break;
        case 0x82:
          info.datSet = el.value.toString('ascii');
          break;
        case 0x83:
          info.goID = el.value.toString('ascii');
          break;
        case 0x84: {
          const sec = el.value.readUInt32BE(0);
          info.timestamp = new Date(sec * 1000).toLocaleString();
          break;
        }
        case 0x85: {
          let val = 0;
          for (let i = 0; i < el.value.length; i++) val = (val << 8) | el.value[i];
          info.stNum = val;
          break;
        }
        case 0x86: {
          let val = 0;
          for (let i = 0; i < el.value.length; i++) val = (val << 8) | el.value[i];
          info.sqNum = val;
          break;
        }
        case 0x87:
          info.test = el.value[0] !== 0;
          break;
        case 0x88: {
          let val = 0;
          for (let i = 0; i < el.value.length; i++) val = (val << 8) | el.value[i];
          info.confRev = val;
          break;
        }
        case 0x89:
          info.ndsCom = el.value[0] !== 0;
          break;
        case 0x8A:
          info.numDatSetEntries = el.value[0];
          break;
        case 0xAB: { // Dataset values
          const rawData = parseASN1Elements(el.value);
          info.dataset = decodeGooseData(rawData);
          break;
        }
      }
    });

    return info;
  }

  // Communication event logs
  emitLog(id, level, message) {
    this.emit('log', { id, level, message, timestamp: Date.now() });
  }

  emitStatus(id, role, isRunning) {
    this.emit('status', { id, role, isRunning });
  }

  emitTraffic(id, dir, address, appid, rawBuf, parsed = {}) {
    this.emit('traffic', {
      id,
      dir,
      hex: rawBuf.toString('hex').toUpperCase().match(/.{1,2}/g).join(' '),
      desc: `${dir === 'TX' ? '发送' : '接收'} GOOSE (APPID: 0x${appid.toString(16)}, GoID: ${parsed.goID || ''}, stNum: ${parsed.stNum || 0}, sqNum: ${parsed.sqNum || 0})`,
      timestamp: Date.now()
    });
  }
}

module.exports = new GOOSEEngine();
