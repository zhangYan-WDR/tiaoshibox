import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Layers, Binary, ShieldAlert, Cpu, ToggleLeft } from 'lucide-react';

export default function DataConverter() {
  // Tab states: 'bit_fields' (Default!) | 'ieee754' | 'modbus_reg' | 'checksum'
  const [activeSubTab, setActiveSubTab] = useState('bit_fields');

  // ==========================================
  // 5. Bit Field Analyzer States (NEW & PRIMARY!)
  // ==========================================
  const [bitWidth, setBitWidth] = useState(8); // 8, 16, 32, 64
  const [bits, setBits] = useState(Array(64).fill(false)); // 64 bits array
  const [bitDecInput, setBitDecInput] = useState('5'); // Default to 5 (Bit 0 and Bit 2 active)
  const [bitHexInput, setBitHexInput] = useState('05');
  const [bitNamingStart, setBitNamingStart] = useState('1'); // '0' for Bit 0-7, '1' for 第1-8位
  const [bitDirection, setBitDirection] = useState('LSB'); // 'LSB' for right-to-left index, 'MSB' for left-to-right

  // ==========================================
  // 1. IEEE-754 Converter States
  // ==========================================
  const [floatVal, setFloatVal] = useState('100.0');
  const [hexVal, setHexVal] = useState('42C80000');
  const [byteOrder, setByteOrder] = useState('ABCD'); // ABCD, CDAB, BADC, DCBA

  // ==========================================
  // 2. Modbus Register States
  // ==========================================
  const [regHigh, setRegHigh] = useState('17096'); // e.g. 17096 (0x42C8)
  const [regLow, setRegLow] = useState('0');     // e.g. 0
  const [combResultFloat, setCombResultFloat] = useState('100');
  const [combResultInt32, setCombResultInt32] = useState('1120403456');
  const [combResultUint32, setCombResultUint32] = useState('1120403456');
  const [modbusByteOrder, setModbusByteOrder] = useState('ABCD');

  // ==========================================
  // 3. Checksum States
  // ==========================================
  const [checksumInput, setChecksumInput] = useState('01 03 00 00 00 0A');
  const [checksumIsHex, setChecksumIsHex] = useState(true);
  const [crc16Modbus, setCrc16Modbus] = useState('C5 CD');
  const [crc16Ccitt, setCrc16Ccitt] = useState('');
  const [crc32, setCrc32] = useState('');
  const [lrcVal, setLrcVal] = useState('');
  const [bccVal, setBccVal] = useState('');


  // ==========================================
  // Bit Field Helper Logic
  // ==========================================
  
  // Calculate decimal sum from boolean bits array using BigInt to support 64 bits
  const getDecimalValue = (bitsArray, width) => {
    let sum = 0n;
    for (let i = 0; i < width; i++) {
      if (bitsArray[i]) {
        sum += 1n << BigInt(i);
      }
    }
    return sum;
  };

  const handleBitCheckboxChange = (index, checked) => {
    const nextBits = [...bits];
    nextBits[index] = checked;
    setBits(nextBits);
    
    const decVal = getDecimalValue(nextBits, bitWidth);
    setBitDecInput(decVal.toString());
    setBitHexInput(decVal.toString(16).toUpperCase().padStart(bitWidth / 4, '0'));
  };

  const handleBitDecInputChange = (val) => {
    setBitDecInput(val);
    if (val === '') return;
    try {
      let num = BigInt(val);
      if (num < 0n) num = 0n;
      const max = (1n << BigInt(bitWidth)) - 1n;
      if (num > max) num = max;
      
      const nextBits = Array(64).fill(false);
      for (let i = 0; i < bitWidth; i++) {
        nextBits[i] = ((num >> BigInt(i)) & 1n) === 1n;
      }
      setBits(nextBits);
      setBitHexInput(num.toString(16).toUpperCase().padStart(bitWidth / 4, '0'));
    } catch (e) {
      // Invalid format
    }
  };

  const handleBitHexInputChange = (val) => {
    const cleanHex = val.replace(/[^0-9A-Fa-f]/g, '');
    setBitHexInput(cleanHex);
    if (cleanHex) {
      try {
        let num = BigInt('0x' + cleanHex);
        if (num < 0n) num = 0n;
        const max = (1n << BigInt(bitWidth)) - 1n;
        if (num > max) num = max;
        
        const nextBits = Array(64).fill(false);
        for (let i = 0; i < bitWidth; i++) {
          nextBits[i] = ((num >> BigInt(i)) & 1n) === 1n;
        }
        setBits(nextBits);
        setBitDecInput(num.toString(10));
      } catch (e) {
        // Invalid hex
      }
    }
  };

  const handleBitWidthChange = (width) => {
    setBitWidth(width);
    const maxVal = (1n << BigInt(width)) - 1n;
    const currentVal = getDecimalValue(bits, width);
    const cleanVal = currentVal > maxVal ? maxVal : currentVal;
    
    const nextBits = Array(64).fill(false);
    for (let i = 0; i < width; i++) {
      nextBits[i] = ((cleanVal >> BigInt(i)) & 1n) === 1n;
    }
    setBits(nextBits);
    setBitDecInput(cleanVal.toString());
    setBitHexInput(cleanVal.toString(16).toUpperCase().padStart(width / 4, '0'));
  };

  const handleSetAllBits = (value) => {
    const nextBits = Array(64).fill(false);
    for (let i = 0; i < bitWidth; i++) {
      nextBits[i] = value;
    }
    setBits(nextBits);
    const decVal = getDecimalValue(nextBits, bitWidth);
    setBitDecInput(decVal.toString());
    setBitHexInput(decVal.toString(16).toUpperCase().padStart(bitWidth / 4, '0'));
  };

  const handleInvertBits = () => {
    const nextBits = [...bits];
    for (let i = 0; i < bitWidth; i++) {
      nextBits[i] = !nextBits[i];
    }
    setBits(nextBits);
    const decVal = getDecimalValue(nextBits, bitWidth);
    setBitDecInput(decVal.toString());
    setBitHexInput(decVal.toString(16).toUpperCase().padStart(bitWidth / 4, '0'));
  };

  // Sync bits on mount for default value (5)
  useEffect(() => {
    handleBitDecInputChange('5');
  }, []);


  // ==========================================
  // IEEE 754 Helper Functions
  // ==========================================
  const swapBytes = (hex, order) => {
    if (hex.length !== 8) return hex;
    const a = hex.substring(0, 2);
    const b = hex.substring(2, 4);
    const c = hex.substring(4, 6);
    const d = hex.substring(6, 8);
    
    switch (order) {
      case 'ABCD': return a + b + c + d;
      case 'CDAB': return c + d + a + b;
      case 'BADC': return b + a + d + c;
      case 'DCBA': return d + c + b + a;
      default: return hex;
    }
  };

  const convertFloatToHex = (fStr, order) => {
    try {
      const f = parseFloat(fStr);
      if (isNaN(f)) return '';
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setFloat32(0, f, false); // big endian
      const uintVal = view.getUint32(0);
      let rawHex = uintVal.toString(16).toUpperCase().padStart(8, '0');
      return swapBytes(rawHex, order);
    } catch (e) {
      return '';
    }
  };

  const convertHexToFloat = (hStr, order) => {
    try {
      const cleanHex = hStr.replace(/[\s,]/g, '');
      if (cleanHex.length !== 8) return '';
      const swapped = swapBytes(cleanHex, order);
      const intVal = parseInt(swapped, 16);
      if (isNaN(intVal)) return '';
      
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, intVal);
      return view.getFloat32(0).toString();
    } catch (e) {
      return '';
    }
  };

  const handleFloatChange = (val) => {
    setFloatVal(val);
    const h = convertFloatToHex(val, byteOrder);
    if (h) setHexVal(h);
  };

  const handleHexChange = (val) => {
    const clean = val.replace(/[^0-9A-Fa-f]/g, '').substring(0, 8).toUpperCase();
    setHexVal(clean);
    const f = convertHexToFloat(clean, byteOrder);
    if (f) setFloatVal(f);
  };

  useEffect(() => {
    const f = convertHexToFloat(hexVal, byteOrder);
    if (f) setFloatVal(f);
  }, [byteOrder]);


  // ==========================================
  // Modbus Register Combine Logic
  // ==========================================
  const handleModbusRegCombine = () => {
    const r1 = parseInt(regHigh) || 0;
    const r2 = parseInt(regLow) || 0;

    const hex1 = (r1 & 0xFFFF).toString(16).padStart(4, '0');
    const hex2 = (r2 & 0xFFFF).toString(16).padStart(4, '0');
    
    const rawHex = hex1 + hex2;
    const swappedHex = swapBytes(rawHex.toUpperCase(), modbusByteOrder);
    const intVal = parseInt(swappedHex, 16);

    const bufFloat = new ArrayBuffer(4);
    const viewFloat = new DataView(bufFloat);
    viewFloat.setUint32(0, intVal);
    const fVal = viewFloat.getFloat32(0);
    setCombResultFloat(fVal.toFixed(6).replace(/\.?0+$/, ''));

    const bufInt = new ArrayBuffer(4);
    const viewInt = new DataView(bufInt);
    viewInt.setUint32(0, intVal);
    setCombResultInt32(viewInt.getInt32(0).toString());
    setCombResultUint32(intVal.toString());
  };

  useEffect(() => {
    handleModbusRegCombine();
  }, [regHigh, regLow, modbusByteOrder]);


  // ==========================================
  // Checksum Logic
  // ==========================================
  const calculateChecksums = () => {
    let bytes;
    try {
      if (checksumIsHex) {
        const clean = checksumInput.replace(/[\s,]/g, '');
        if (clean.length % 2 !== 0) return;
        bytes = [];
        for (let i = 0; i < clean.length; i += 2) {
          bytes.push(parseInt(clean.substring(i, i + 2), 16));
        }
      } else {
        bytes = Array.from(Buffer.from(checksumInput, 'utf-8'));
      }
    } catch (e) {
      return;
    }

    if (!bytes || bytes.length === 0) return;

    // 1. CRC-16 Modbus
    let crc = 0xFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 1) !== 0) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    const crcModbusHex = ((crc & 0xFF).toString(16).toUpperCase().padStart(2, '0')) + ' ' + 
                         (((crc >> 8) & 0xFF).toString(16).toUpperCase().padStart(2, '0'));
    setCrc16Modbus(crcModbusHex);

    // 2. CRC-16 CCITT
    let crcCcitt = 0xFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crcCcitt ^= (bytes[i] << 8);
      for (let j = 0; j < 8; j++) {
        if ((crcCcitt & 0x8000) !== 0) {
          crcCcitt = (crcCcitt << 1) ^ 0x1021;
        } else {
          crcCcitt <<= 1;
        }
      }
    }
    const ccittVal = (crcCcitt & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    setCrc16Ccitt(ccittVal.substring(0, 2) + ' ' + ccittVal.substring(2, 4));

    // 3. CRC-32 Standard
    const makeTable = () => {
      const table = [];
      let c;
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
          c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
      }
      return table;
    };
    const crc32Table = makeTable();
    let crc32Val = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc32Val = (crc32Val >>> 8) ^ crc32Table[(crc32Val ^ bytes[i]) & 0xFF];
    }
    const c32 = ((crc32Val ^ (-1)) >>> 0).toString(16).toUpperCase().padStart(8, '0');
    setCrc32(`${c32.substring(0,2)} ${c32.substring(2,4)} ${c32.substring(4,6)} ${c32.substring(6,8)}`);

    // 4. LRC (Modbus ASCII)
    let lrcSum = 0;
    for (let i = 0; i < bytes.length; i++) {
      lrcSum += bytes[i];
    }
    const lrcResult = (((-lrcSum) & 0xFF).toString(16).toUpperCase().padStart(2, '0'));
    setLrcVal(lrcResult);

    // 5. BCC
    let bccSum = 0;
    for (let i = 0; i < bytes.length; i++) {
      bccSum ^= bytes[i];
    }
    setBccVal(bccSum.toString(16).toUpperCase().padStart(2, '0'));
  };

  useEffect(() => {
    calculateChecksums();
  }, [checksumInput, checksumIsHex]);


  // Helper to render bits (LSB is at index 0, but layout depends on bitDirection)
  const renderByteBlock = (byteIndex) => {
    const startBit = byteIndex * 8;
    const bitIndices = [];
    
    // Create array of indices for this byte
    for (let i = 0; i < 8; i++) {
      bitIndices.push(startBit + i);
    }
    
    // If LSB is on the right, we reverse indices for display (so index 7 is on left, 0 is on right)
    if (bitDirection === 'LSB') {
      bitIndices.reverse();
    }

    return (
      <div 
        key={byteIndex} 
        className="glass-card" 
        style={{ 
          background: 'rgba(0, 0, 0, 0.15)', 
          border: '1px solid var(--border-color)', 
          padding: '14px', 
          borderRadius: '8px', 
          marginBottom: '10px' 
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary)', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Byte {byteIndex} (位 {startBit} 至 {startBit + 7})</span>
          <span style={{ opacity: 0.5 }}>{bitDirection === 'LSB' ? 'LSB-右侧起' : 'MSB-左侧起'}</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px' }}>
          {bitIndices.map(idx => {
            const isActive = bits[idx];
            const weight = 1n << BigInt(idx);
            
            // Human naming translation
            // Standard Bit 0 means index 0. If Naming is 1-indexed, index 0 is "第 1 位".
            const orderNum = idx + (bitNamingStart === '1' ? 1 : 0);
            const bitNameDisplay = `${bitNamingStart === '1' ? '第 ' : 'Bit '}${orderNum}${bitNamingStart === '1' ? ' 位' : ''}`;

            return (
              <div 
                key={idx} 
                onClick={() => handleBitCheckboxChange(idx, !isActive)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '10px 4px',
                  background: isActive ? 'rgba(57, 255, 20, 0.06)' : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${isActive ? 'rgba(57, 255, 20, 0.3)' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isActive ? 'inset 0 0 10px rgba(57, 255, 20, 0.1)' : 'none'
                }}
              >
                {/* Visual Circle Checkbox */}
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: `2px solid ${isActive ? 'var(--color-success)' : 'var(--text-muted)'}`,
                  background: isActive ? 'var(--color-success)' : 'transparent',
                  boxShadow: isActive ? '0 0 8px var(--color-success-glow)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                  transition: 'all 0.2s'
                }}>
                  {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#000' }} />}
                </div>

                <span style={{ fontSize: '11px', color: isActive ? '#fff' : 'var(--text-light)', fontWeight: 'bold' }}>
                  {bitNameDisplay}
                </span>
                
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  W:{weight.toString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
        <button 
          onClick={() => setActiveSubTab('bit_fields')}
          className={`tab-btn ${activeSubTab === 'bit_fields' ? 'active' : ''}`}
          style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Binary size={14} /> 比特位分析与掩码转换
        </button>
        <button 
          onClick={() => setActiveSubTab('ieee754')}
          className={`tab-btn ${activeSubTab === 'ieee754' ? 'active' : ''}`}
          style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Cpu size={14} /> IEEE-754 浮点数互转
        </button>
        <button 
          onClick={() => setActiveSubTab('modbus_reg')}
          className={`tab-btn ${activeSubTab === 'modbus_reg' ? 'active' : ''}`}
          style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Layers size={14} /> Modbus 双寄存器拼接
        </button>
        <button 
          onClick={() => setActiveSubTab('checksum')}
          className={`tab-btn ${activeSubTab === 'checksum' ? 'active' : ''}`}
          style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Settings size={14} /> Checksum 校验计算器
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

        {/* 5. [NEW] Bit Field Analyzer (比特位分析器) */}
        {activeSubTab === 'bit_fields' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', width: '100%' }}>
            
            {/* Left side: interactive byte block card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="glass-card" style={{ padding: '16px 20px' }}>
                <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '4px', fontWeight: '600' }}>比特位交互控制区</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>直接点击比特位框进行勾选/取消勾选，右侧计算面板会实时输出计算出来的十进制、十六进制和二进制。</span>
                
                {/* Preset helpers */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                  <button onClick={() => handleSetAllBits(true)} className="tab-btn" style={{ fontSize: '11px', padding: '3px 10px' }}>全选 (置 1)</button>
                  <button onClick={() => handleSetAllBits(false)} className="tab-btn" style={{ fontSize: '11px', padding: '3px 10px' }}>清空 (置 0)</button>
                  <button onClick={handleInvertBits} className="tab-btn" style={{ fontSize: '11px', padding: '3px 10px' }}>反转比特</button>
                </div>
              </div>

              {/* Render byte panels dynamically based on bitWidth */}
              {Array.from({ length: bitWidth / 8 }).map((_, idx) => renderByteBlock(idx)).reverse()}
            </div>

            {/* Right side: settings & outputs card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Settings Card */}
              <div className="glass-card">
                <h4 style={{ fontSize: '13px', color: '#fff', marginBottom: '14px' }}>比特参数设置</h4>
                
                {/* Bit Width selector */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>寄存器位宽</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[8, 16, 32, 64].map(w => (
                      <button 
                        key={w}
                        onClick={() => handleBitWidthChange(w)}
                        className={`tab-btn ${bitWidth === w ? 'active' : ''}`}
                        style={{ flex: 1, padding: '6px 0', fontSize: '12px' }}
                      >
                        {w} Bits ({w / 8} Byte)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid of naming settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>排布方向 (二进制书写习惯)</label>
                    <select 
                      value={bitDirection} 
                      onChange={(e) => setBitDirection(e.target.value)} 
                      className="input-field"
                      style={{ fontSize: '12px', padding: '6px' }}
                    >
                      <option value="LSB">Bit 0 在右侧 (LSB起)</option>
                      <option value="MSB">Bit 0 在左侧 (MSB起)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>起始序号命名</label>
                    <select 
                      value={bitNamingStart} 
                      onChange={(e) => setBitNamingStart(e.target.value)} 
                      className="input-field"
                      style={{ fontSize: '12px', padding: '6px' }}
                    >
                      <option value="1">1 起始 (第 1 - {bitWidth} 位)</option>
                      <option value="0">0 起始 (Bit 0 - {bitWidth - 1})</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Conversion Outputs */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '13px', color: '#fff' }}>数制换算与结果</h4>
                
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>十进制数值 (Decimal)</label>
                  <input 
                    type="number" 
                    value={bitDecInput} 
                    onChange={(e) => handleBitDecInputChange(e.target.value)}
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '8px 12px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>十六进制 (Hexadecimal)</label>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>0x</span>
                    <input 
                      type="text" 
                      value={bitHexInput} 
                      onChange={(e) => handleBitHexInputChange(e.target.value)}
                      className="input-field"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '8px 12px 8px 32px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>二进制字节流视图 (Binary String)</label>
                  <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: 'var(--color-success)',
                    wordBreak: 'break-all',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    {Array.from({ length: bitWidth / 8 }).map((_, byteIdx) => {
                      const start = byteIdx * 8;
                      const byteBits = bits.slice(start, start + 8);
                      // Binary representation from MSB to LSB
                      const binaryStr = byteBits.map(b => b ? '1' : '0').reverse().join('');
                      return (
                        <span key={byteIdx} style={{ background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          {binaryStr}
                        </span>
                      );
                    }).reverse()}
                  </div>
                </div>
              </div>

              {/* Quick reference guide */}
              <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(255, 179, 0, 0.02)', border: '1px solid rgba(255,179,0,0.1)' }}>
                <ShieldAlert size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-light)', lineHeight: '1.5' }}>
                  <strong>现场实例说明：</strong><br />
                  如果您想验证 8位比特中<strong>“第 1 和第 3 同时为 1”</strong>对应的值：<br />
                  1. 选择 <b>8 Bits</b> 位宽；<br />
                  2. 检查右侧设置的“起始序号命名”是否为 <b>1 起始</b>；<br />
                  3. 在左侧面板中分别点击勾选 <b>“第 1 位”</b> 和 <b>“第 3 位”</b>；<br />
                  4. 右侧输出即为：十进制 <b>5</b>，二进制为 <code>00000101</code>。
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 1. IEEE-754 Float <-> Hex */}
        {activeSubTab === 'ieee754' && (
          <div className="glass-card" style={{ width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '16px', fontWeight: '600' }}>IEEE-754 32位单精度浮点数转换</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>字节序 (Endianness)</label>
              <select 
                value={byteOrder} 
                onChange={(e) => setByteOrder(e.target.value)}
                className="input-field"
                style={{ fontSize: '13px' }}
              >
                <option value="ABCD">Big-Endian (ABCD) - 大端标准</option>
                <option value="CDAB">Middle-Big Endian (CDAB) - 字节序交换</option>
                <option value="BADC">Middle-Little Endian (BADC) - 双字节交换</option>
                <option value="DCBA">Little-Endian (DCBA) - 小端标准</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>单精度浮点数 (Decimal Float)</label>
                <input 
                  type="text" 
                  value={floatVal} 
                  onChange={(e) => handleFloatChange(e.target.value)}
                  className="input-field"
                  placeholder="如: 100.0"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '10px 12px' }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>十六进制表示 (Hexadecimal 32-bit)</label>
                <input 
                  type="text" 
                  value={hexVal} 
                  onChange={(e) => handleHexChange(e.target.value)}
                  className="input-field"
                  placeholder="如: 42C80000"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '10px 12px' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <strong>提示：</strong> 输入实时响应，任意改动一方即可求得另一方结果。32位浮点数由 1位符号位 (Sign), 8位指数位 (Exponent) 和 23位尾数位 (Mantissa) 构成。
            </div>
          </div>
        )}

        {/* 2. Modbus Register Combine */}
        {activeSubTab === 'modbus_reg' && (
          <div className="glass-card" style={{ width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '16px', fontWeight: '600' }}>Modbus 双 16位寄存器拼接计算</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              在 Modbus 协议中，一个浮点数或32位整数通常占用两个连续的16位寄存器。本工具可以将这两个寄存器的值拼装恢复。
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>字节序 (Byte Order)</label>
              <select 
                value={modbusByteOrder} 
                onChange={(e) => setModbusByteOrder(e.target.value)}
                className="input-field"
                style={{ fontSize: '13px' }}
              >
                <option value="ABCD">ABCD (Big-Endian) - 大端</option>
                <option value="CDAB">CDAB (Word Swapped) - 字交换</option>
                <option value="BADC">BADC (Byte Swapped) - 字节交换</option>
                <option value="DCBA">DCBA (Little-Endian) - 小端</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>高位寄存器 (Dec，如: Register 1)</label>
                <input 
                  type="number" 
                  value={regHigh} 
                  onChange={(e) => setRegHigh(e.target.value)}
                  className="input-field"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '10px 12px' }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>低位寄存器 (Dec，如: Register 2)</label>
                <input 
                  type="number" 
                  value={regLow} 
                  onChange={(e) => setRegLow(e.target.value)}
                  className="input-field"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '10px 12px' }}
                />
              </div>
            </div>

            {/* Combined Results Display */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)' }}>拼接后的 32位数据解析结果:</span>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>32位单精度浮点 (Float32)</span>
                <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{combResultFloat}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>32位有符号整型 (Int32)</span>
                <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{combResultInt32}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>32位无符号整型 (UInt32)</span>
                <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{combResultUint32}</strong>
              </div>
            </div>
          </div>
        )}

        {/* 3. Checksum Generator */}
        {activeSubTab === 'checksum' && (
          <div className="glass-card" style={{ width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '16px', fontWeight: '600' }}>现场校验码计算器</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>输入数据</label>
              <textarea 
                value={checksumInput} 
                onChange={(e) => setChecksumInput(e.target.value)}
                className="input-field"
                placeholder={checksumIsHex ? "请输入十六进制流, 如: 01 03 00 00 00 0A" : "请输入 ASCII 字符串, 如: hello"}
                style={{ height: '80px', fontFamily: 'var(--font-mono)', fontSize: '13px', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={checksumIsHex} onChange={(e) => setChecksumIsHex(e.target.checked)} />
                十六进制串 (空格自动忽略)
              </label>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!checksumIsHex} onChange={(e) => setChecksumIsHex(!e.target.checked)} />
                ASCII 字符串
              </label>
            </div>

            {/* Checksum Results Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CRC-16 Modbus (工控主从校验)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {crc16Modbus || '--'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CRC-16 CCITT (XMODEM 校验)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {crc16Ccitt || '--'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LRC 校验 (Modbus ASCII)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-warning)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {lrcVal || '--'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BCC 校验 (异或校验)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {bccVal || '--'}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CRC-32 校验 (网络以太网标准)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-success)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {crc32 || '--'}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
