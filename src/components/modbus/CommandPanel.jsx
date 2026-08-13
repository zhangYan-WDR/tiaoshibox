import React, { useState } from 'react';
import { Send, Terminal, Play, Power, Trash2, Cpu } from 'lucide-react';

export default function CommandPanel({ activeConnId, onExecuteRead, onExecuteWriteSingle, onExecuteWriteMultiple }) {
  const [fc, setFc] = useState('3'); // 1, 2, 3, 4, 5, 6, 15, 16
  const [address, setAddress] = useState('0');
  const [quantity, setQuantity] = useState('10');
  const [writeValue, setWriteValue] = useState('0'); // For FC5, FC6
  const [writeArrValue, setWriteArrValue] = useState('0, 0, 0'); // For FC15, FC16

  const [cmdLogs, setCmdLogs] = useState([]);

  const addLog = (direction, msg, success = true) => {
    setCmdLogs(prev => {
      const list = [...prev, { direction, msg, success, timestamp: Date.now() }];
      if (list.length > 100) list.shift();
      return list;
    });
  };

  const handleSendCommand = async () => {
    if (!activeConnId) {
      alert('请先连接并选中一个活动的主站通道');
      return;
    }

    const addrVal = parseInt(address);
    if (isNaN(addrVal) || addrVal < 0 || addrVal > 65535) {
      alert('请输入合法的起始寄存器偏移地址 (0-65535)');
      return;
    }

    const fcNum = parseInt(fc);
    
    // 1. Read commands (FC1, FC2, FC3, FC4)
    if (fcNum >= 1 && fcNum <= 4) {
      const qtyVal = parseInt(quantity);
      if (isNaN(qtyVal) || qtyVal <= 0 || qtyVal > 125) {
        alert('请输入合法的读取寄存器数量 (1-125)');
        return;
      }

      addLog('TX', `发出读取指令 -> FC ${fcNum.toString().padStart(2, '0')}, 地址: ${addrVal}, 数量: ${qtyVal}`);
      
      const res = await onExecuteRead({
        fc: fcNum,
        startAddress: addrVal,
        quantity: qtyVal
      });

      if (res.success) {
        addLog('RX', `读取响应成功 -> 返回数据: [${res.values.join(', ')}]`, true);
      } else {
        addLog('RX', `读取响应失败 -> 错误: ${res.error}`, false);
      }
    } 
    // 2. Single Write commands (FC5, FC6)
    else if (fcNum === 5 || fcNum === 6) {
      const val = parseInt(writeValue);
      if (isNaN(val)) {
        alert('请输入合法的数字写入值');
        return;
      }
      
      addLog('TX', `发出写入指令 -> FC ${fcNum.toString().padStart(2, '0')}, 地址: ${addrVal}, 写入数值: ${val}`);

      const res = await onExecuteWriteSingle({
        type: fcNum === 5 ? 'coil' : 'register',
        address: addrVal,
        value: val
      });

      if (res.success) {
        addLog('RX', `从站确认写入 -> 地址: ${addrVal}, 返回确认值: ${fcNum === 5 ? (val ? 'ON' : 'OFF') : val}`, true);
      } else {
        addLog('RX', `写入指令失败 -> 错误: ${res.error}`, false);
      }
    }
    // 3. Multiple Write commands (FC15, FC16)
    else if (fcNum === 15 || fcNum === 16) {
      const parts = writeArrValue.split(',').map(v => parseInt(v.trim()));
      if (parts.some(isNaN)) {
        alert('请输入逗号分隔的合法整数序列');
        return;
      }

      addLog('TX', `发出连续写入指令 -> FC ${fcNum.toString().padStart(2, '0')}, 起始地址: ${addrVal}, 数据序列: [${parts.join(', ')}]`);

      const res = await onExecuteWriteMultiple({
        type: fcNum === 15 ? 'coils' : 'registers',
        address: addrVal,
        values: parts
      });

      if (res.success) {
        addLog('RX', `连续写入响应成功 -> 起始地址: ${res.result?.address || addrVal}, 写入数量: ${res.result?.quantity || parts.length}`, true);
      } else {
        addLog('RX', `连续写入指令失败 -> 错误: ${res.error}`, false);
      }
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>
      {/* 左半边：配置区 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={15} color="var(--color-primary)" />
          快捷命令编译器
        </h3>

        {/* 选择功能码 */}
        <div>
          <label className="label-text">功能码 (Function Code)</label>
          <select 
            className="input-field" 
            value={fc} 
            onChange={e => setFc(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          >
            <option value="1">FC 01 - Read Coils (读线圈)</option>
            <option value="2">FC 02 - Read Discrete Inputs (读离散输入)</option>
            <option value="3">FC 03 - Read Holding Registers (读保持寄存器)</option>
            <option value="4">FC 04 - Read Input Registers (读输入寄存器)</option>
            <option value="5">FC 05 - Write Single Coil (写单线圈)</option>
            <option value="6">FC 06 - Write Single Register (写单保持寄存器)</option>
            <option value="15">FC 15 - Write Multiple Coils (写多线圈)</option>
            <option value="16">FC 16 - Write Multiple Registers (写多保持寄存器)</option>
          </select>
        </div>

        {/* 寄存器偏移量 */}
        <div>
          <label className="label-text">起始寄存器地址 (Offset 0-65535)</label>
          <input 
            type="number" 
            className="input-field" 
            value={address} 
            onChange={e => setAddress(e.target.value)} 
          />
        </div>

        {/* 数据参数输入区（基于所选 FC 自动切换） */}
        {(fc === '1' || fc === '2' || fc === '3' || fc === '4') && (
          <div>
            <label className="label-text">读取长度 (Quantity 1-125)</label>
            <input 
              type="number" 
              className="input-field" 
              value={quantity} 
              onChange={e => setQuantity(e.target.value)} 
            />
          </div>
        )}

        {fc === '5' && (
          <div>
            <label className="label-text">线圈写入状态</label>
            <select 
              className="input-field" 
              value={writeValue} 
              onChange={e => setWriteValue(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.3)', color: '#fff' }}
            >
              <option value="1">ON (1 / 合闸)</option>
              <option value="0">OFF (0 / 分闸)</option>
            </select>
          </div>
        )}

        {fc === '6' && (
          <div>
            <label className="label-text">单个保持寄存器写入数值 (16-bit 整数)</label>
            <input 
              type="number" 
              className="input-field" 
              value={writeValue} 
              onChange={e => setWriteValue(e.target.value)} 
              placeholder="0 ~ 65535"
            />
          </div>
        )}

        {(fc === '15' || fc === '16') && (
          <div>
            <label className="label-text">批量写入数据串 (逗号分隔，FC15为0或1)</label>
            <input 
              type="text" 
              className="input-field" 
              value={writeArrValue} 
              onChange={e => setWriteArrValue(e.target.value)} 
              placeholder="e.g. 100, 240, 350"
            />
          </div>
        )}

        <button 
          onClick={handleSendCommand}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 'auto', padding: '10px 16px', gap: '8px' }}
        >
          <Send size={14} />
          发送报文指令
        </button>
      </div>

      {/* 右半边：日志控制台 */}
      <div className="glass-card" style={{ flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={15} color="var(--text-muted)" />
            主站命令执行终端
          </h3>
          <button 
            onClick={() => setCmdLogs([])}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <Trash2 size={12} />
            清空终端
          </button>
        </div>

        <div style={{
          flex: 1,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          lineHeight: '1.6',
          overflowY: 'auto'
        }}>
          {cmdLogs.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span>等待指令下发...</span>
            </div>
          ) : (
            <div>
              {cmdLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.01)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span style={{ color: log.direction === 'TX' ? 'var(--color-primary)' : (log.success ? 'var(--color-success)' : 'var(--color-danger)'), marginRight: '6px', fontWeight: 'bold' }}>
                    {log.direction === 'TX' ? '► TX:' : '◄ RX:'}
                  </span>
                  <span style={{ color: log.success ? 'var(--text-light)' : 'var(--color-danger)' }}>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
