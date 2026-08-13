import React, { useState } from 'react';
import { Play, Pause, Edit, HelpCircle, Search, Sliders } from 'lucide-react';

export default function MonitorDashboard({ activeConnId, dataPoints, onWriteSingle }) {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'coils' | 'discrete' | 'input' | 'holding'
  const [searchAddr, setSearchAddr] = useState('');
  const [dataFormat, setDataFormat] = useState('uint16'); // 'uint16' | 'int16' | 'hex' | 'bin' | 'float32'
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeTarget, setWriteTarget] = useState(null); // { type, address, value }
  const [newValue, setNewValue] = useState('');

  // 整理数据点
  const connData = dataPoints[activeConnId] || {
    coils: {},
    discreteInputs: {},
    inputRegisters: {},
    holdingRegisters: {}
  };

  const getFormatValue = (val, type, addr) => {
    if (val === undefined || val === null) return '-';
    
    // 线圈和离散直接返回 ON / OFF
    if (type === 'coils' || type === 'discreteInputs') {
      return val === 1 ? 'ON (1)' : 'OFF (0)';
    }

    // 寄存器解析
    const u16 = val & 0xFFFF;
    switch (dataFormat) {
      case 'int16':
        return u16 >= 0x8000 ? u16 - 0x10000 : u16;
      case 'hex':
        return `0x${u16.toString(16).toUpperCase().padStart(4, '0')}`;
      case 'bin':
        return u16.toString(2).padStart(16, '0').match(/.{1,4}/g).join(' ');
      case 'float32': {
        // 如果是 Float32，需要与下一个相邻的寄存器组合
        const nextVal = connData[type][addr + 1];
        if (nextVal === undefined) return `[需要相邻值] ${u16}`;
        
        // 默认 Big Endian ABCD (reg1 << 16 | reg2)
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(u16, 0);
        buf.writeUInt16BE(nextVal & 0xFFFF, 2);
        const floatVal = buf.readFloatBE(0);
        return floatVal.toFixed(4);
      }
      case 'uint16':
      default:
        return u16;
    }
  };

  // 生成所有数据列表供表格展示
  const list = [];
  
  // Coils (0xxxx)
  if (filterType === 'all' || filterType === 'coils') {
    Object.keys(connData.coils).forEach(addr => {
      list.push({
        type: 'coils',
        typeName: '线圈 (Coils 0xxxx)',
        address: parseInt(addr),
        raw: connData.coils[addr],
        display: getFormatValue(connData.coils[addr], 'coils', parseInt(addr)),
        writable: true
      });
    });
  }

  // Discrete Inputs (1xxxx)
  if (filterType === 'all' || filterType === 'discrete') {
    Object.keys(connData.discreteInputs).forEach(addr => {
      list.push({
        type: 'discreteInputs',
        typeName: '离散输入 (Discrete Inputs 1xxxx)',
        address: parseInt(addr),
        raw: connData.discreteInputs[addr],
        display: getFormatValue(connData.discreteInputs[addr], 'discreteInputs', parseInt(addr)),
        writable: false
      });
    });
  }

  // Input Registers (3xxxx)
  if (filterType === 'all' || filterType === 'input') {
    Object.keys(connData.inputRegisters).forEach(addr => {
      list.push({
        type: 'inputRegisters',
        typeName: '输入寄存器 (Input Regs 3xxxx)',
        address: parseInt(addr),
        raw: connData.inputRegisters[addr],
        display: getFormatValue(connData.inputRegisters[addr], 'inputRegisters', parseInt(addr)),
        writable: false
      });
    });
  }

  // Holding Registers (4xxxx)
  if (filterType === 'all' || filterType === 'holding') {
    Object.keys(connData.holdingRegisters).forEach(addr => {
      list.push({
        type: 'holdingRegisters',
        typeName: '保持寄存器 (Holding Regs 4xxxx)',
        address: parseInt(addr),
        raw: connData.holdingRegisters[addr],
        display: getFormatValue(connData.holdingRegisters[addr], 'holdingRegisters', parseInt(addr)),
        writable: true
      });
    });
  }

  // 排序与搜索过滤
  const filteredList = list
    .filter(item => {
      if (searchAddr.trim() === '') return true;
      return item.address.toString().includes(searchAddr.trim());
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.address - b.address;
    });

  // 打开修改弹窗
  const handleOpenWrite = (item) => {
    if (!item.writable) return;
    setWriteTarget(item);
    setNewValue(item.type === 'coils' ? (item.raw ? '1' : '0') : item.raw.toString());
    setShowWriteModal(true);
  };

  const handleExecuteWrite = async () => {
    if (!writeTarget) return;
    const isCoil = writeTarget.type === 'coils';
    const val = isCoil ? parseInt(newValue) === 1 : parseInt(newValue);
    
    if (isNaN(parseInt(newValue))) {
      alert('请输入合法的数值');
      return;
    }

    const res = await onWriteSingle(writeTarget.type === 'coils' ? 'coil' : 'register', writeTarget.address, val ? 1 : 0);
    if (res && res.success) {
      setShowWriteModal(false);
    } else {
      alert(`下发写入失败: ${res?.error || '未知错误'}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', minHeight: 0 }}>
      {/* 头部控制栏 */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', padding: '12px 18px' }}>
        
        {/* 数据类型过滤 */}
        <div>
          <label className="label-text">寄存器类型</label>
          <select 
            className="input-field" 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            style={{ width: '160px', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          >
            <option value="all">全部类型</option>
            <option value="coils">0xxxx 线圈</option>
            <option value="discrete">1xxxx 离散输入</option>
            <option value="holding">4xxxx 保持寄存器</option>
            <option value="input">3xxxx 输入寄存器</option>
          </select>
        </div>

        {/* 格式解析设定 */}
        <div>
          <label className="label-text">数据格式解析</label>
          <select 
            className="input-field" 
            value={dataFormat} 
            onChange={e => setDataFormat(e.target.value)}
            style={{ width: '180px', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          >
            <option value="uint16">Unsigned 16-bit (无符号整型)</option>
            <option value="int16">Signed 16-bit (有符号整型)</option>
            <option value="hex">Hexadecimal (十六进制)</option>
            <option value="bin">Binary (二进制串)</option>
            <option value="float32">Float 32-bit (浮点数，组合相邻)</option>
          </select>
        </div>

        {/* 地址搜索 */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label className="label-text">搜索地址</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="输入寄存器偏移量..." 
              value={searchAddr}
              onChange={e => setSearchAddr(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
          </div>
        </div>

      </div>

      {/* 数据明细表格 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0, overflow: 'hidden' }}>
        {!activeConnId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
            <Sliders size={28} style={{ opacity: 0.3 }} />
            <span>请在左侧侧边栏中选择一个活动的主站连接通道</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
            <span>暂无轮询数据。请检查该通道是否成功连接、配置了数据点</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <th style={{ padding: '12px 16px' }}>物理类型</th>
                  <th style={{ padding: '12px 16px' }}>寄存器地址</th>
                  <th style={{ padding: '12px 16px' }}>原始值 (Hex)</th>
                  <th style={{ padding: '12px 16px' }}>解析数值</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item, index) => (
                  <tr 
                    key={`${item.type}-${item.address}`}
                    className="reg-table-row"
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}
                  >
                    <td style={{ padding: '10px 16px', color: 'var(--text-light)' }}>{item.typeName}</td>
                    <td style={{ padding: '10px 16px' }} className="mono-val text-primary">{item.address}</td>
                    <td style={{ padding: '10px 16px' }} className="mono-val text-muted">
                      {item.type.includes('coil') || item.type.includes('discrete') 
                        ? (item.raw ? '0x01' : '0x00')
                        : `0x${(item.raw & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`
                      }
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }} className="mono-val">{item.display}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      {item.writable ? (
                        <button 
                          onClick={() => handleOpenWrite(item)}
                          className="action-btn"
                          title="修改数值"
                          style={{
                            background: 'rgba(0, 229, 255, 0.1)',
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            color: 'var(--color-primary)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          下发指令
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>只读点</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 修改数值模态弹窗 */}
      {showWriteModal && writeTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card" style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--color-primary-glow)' }}>
            <h3 style={{ fontSize: '14px', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              下发修改指令 (FC {writeTarget.type === 'coils' ? '05' : '06'})
            </h3>
            <div>
              <span className="label-text">寄存器详情</span>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-light)', lineHeight: '1.8' }}>
                类型: {writeTarget.typeName}<br/>
                目标地址 (Address Offset): <span className="text-primary mono-val">{writeTarget.address}</span><br/>
                当前寄存器值: <span className="text-success mono-val">{writeTarget.display}</span>
              </div>
            </div>
            <div>
              <span className="label-text">设置新值</span>
              {writeTarget.type === 'coils' ? (
                <select 
                  className="input-field" 
                  value={newValue} 
                  onChange={e => setNewValue(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.4)', color: '#fff' }}
                >
                  <option value="1">ON (合闸 / 逻辑1)</option>
                  <option value="0">OFF (分闸 / 逻辑0)</option>
                </select>
              ) : (
                <input 
                  type="number" 
                  className="input-field" 
                  value={newValue} 
                  onChange={e => setNewValue(e.target.value)}
                  placeholder="请输入寄存器整数值 (0 ~ 65535)"
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowWriteModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleExecuteWrite}>确认下发</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .reg-table-row:hover {
          background: rgba(255,255,255,0.015);
        }
        .action-btn:hover {
          background: var(--color-primary) !important;
          color: #000 !important;
          box-shadow: 0 0 10px var(--color-primary-glow);
        }
      `}</style>
    </div>
  );
}
