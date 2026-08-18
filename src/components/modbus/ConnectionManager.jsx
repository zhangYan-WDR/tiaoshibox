import React, { useState } from 'react';
import { Network, Plus, Trash2, Power, Settings, ChevronDown, ChevronUp, Bookmark, Edit2 } from 'lucide-react';

export default function ConnectionManager({ connections, activeConnId, onConnect, onDisconnect, onDeleteConnection, onSelectActive }) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('127.0.0.1');
  const [port, setPort] = useState('502');
  const [unitId, setUnitId] = useState('1');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 默认一个轮询轮次 (例如：FC3, 地址0, 长度10, 间隔1000ms)
  const [fc, setFc] = useState('3'); // 1=Coils, 2=Discrete Inputs, 3=Holding, 4=Input
  const [startAddr, setStartAddr] = useState('0');
  const [quantity, setQuantity] = useState('10');
  const [interval, setInterval] = useState('1000');

  const [editingId, setEditingId] = useState(null);
  const [selectedConfigIdx, setSelectedConfigIdx] = useState('');
  const [editingConfigIdx, setEditingConfigIdx] = useState(null);

  const [savedConfigs, setSavedConfigs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('modbus_saved_configs') || '[]');
    } catch (e) {
      return [];
    }
  });

  const handleSaveConfig = () => {
    const newConfig = {
      name: name || `${ip}:${port}`,
      ip,
      port: parseInt(port) || 502,
      unitId: parseInt(unitId) !== undefined ? parseInt(unitId) : 1,
      fc,
      startAddr,
      quantity,
      interval
    };
    
    if (editingConfigIdx !== null) {
      const updated = [...savedConfigs];
      updated[editingConfigIdx] = newConfig;
      localStorage.setItem('modbus_saved_configs', JSON.stringify(updated));
      setSavedConfigs(updated);
    } else {
      const exists = savedConfigs.some(c => 
        c.name === newConfig.name &&
        c.ip === newConfig.ip && 
        c.port === newConfig.port && 
        c.unitId === newConfig.unitId &&
        c.fc === newConfig.fc &&
        c.startAddr === newConfig.startAddr &&
        c.quantity === newConfig.quantity &&
        c.interval === newConfig.interval
      );

      if (!exists) {
        const updated = [...savedConfigs, newConfig];
        localStorage.setItem('modbus_saved_configs', JSON.stringify(updated));
        setSavedConfigs(updated);
        // 自动选中新保存的配置
        const newIdx = updated.length - 1;
        setSelectedConfigIdx(newIdx.toString());
        setEditingConfigIdx(newIdx);
      }
    }
  };

  const handleSaveAsNewConfig = () => {
    const newConfig = {
      name: name ? `${name}_副本` : `${ip}:${port}_副本`,
      ip,
      port: parseInt(port) || 502,
      unitId: parseInt(unitId) !== undefined ? parseInt(unitId) : 1,
      fc,
      startAddr,
      quantity,
      interval
    };
    const updated = [...savedConfigs, newConfig];
    localStorage.setItem('modbus_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
    // 自动选中新配置
    const newIdx = updated.length - 1;
    setSelectedConfigIdx(newIdx.toString());
    setEditingConfigIdx(newIdx);
    setName(newConfig.name);
  };

  const handleCancelConfigEdit = () => {
    setEditingConfigIdx(null);
    setSelectedConfigIdx('');
    setName('');
    setIp('127.0.0.1');
    setPort('502');
    setUnitId('1');
    setFc('3');
    setStartAddr('0');
    setQuantity('10');
    setInterval('1000');
  };

  const handleLoadConfig = (cfg, idx) => {
    setName(cfg.name || '');
    setIp(cfg.ip);
    setPort(cfg.port.toString());
    setUnitId(cfg.unitId.toString());
    if (cfg.fc) setFc(cfg.fc);
    if (cfg.startAddr) setStartAddr(cfg.startAddr);
    if (cfg.quantity) setQuantity(cfg.quantity);
    if (cfg.interval) setInterval(cfg.interval);
    setSelectedConfigIdx(idx.toString());
    setEditingConfigIdx(parseInt(idx));
  };

  const handleDeleteConfig = (index) => {
    const updated = savedConfigs.filter((_, i) => i !== index);
    localStorage.setItem('modbus_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
    setSelectedConfigIdx('');
    if (editingConfigIdx === index) {
      setEditingConfigIdx(null);
    }
  };

  const handleStartEdit = (c) => {
    setEditingId(c.id);
    setName(c.name || '');
    setIp(c.ip);
    setPort(c.port.toString());
    setUnitId(c.unitId.toString());
    if (c.polls && c.polls.length > 0) {
      const firstPoll = c.polls[0];
      setFc(firstPoll.fc.toString());
      setStartAddress(firstPoll.startAddress.toString());
      setQuantity(firstPoll.quantity.toString());
      setInterval(firstPoll.interval.toString());
    }
    setShowAdvanced(true);
    setSelectedConfigIdx('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = editingId || `${ip}:${port}-${Date.now().toString(36).substr(-4)}`;
    
    const polls = [
      {
        fc: parseInt(fc),
        startAddress: parseInt(startAddr) || 0,
        quantity: parseInt(quantity) || 1,
        interval: parseInt(interval) || 1000
      }
    ];

    onConnect({
      id,
      name: name || `${ip}:${port}`,
      ip,
      port: parseInt(port) || 502,
      unitId: parseInt(unitId) !== undefined ? parseInt(unitId) : 1,
      polls,
      autoReconnect: true
    });

    setEditingId(null);
  };

  const activeConnection = connections.find(c => c.id === activeConnId);

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '10px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flexShrink: 0,
      width: '100%'
    }}>
      {/* 第一行：主输入表单与连接按键 */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>从站IP:</span>
            <input 
              type="text" 
              className="input-field" 
              value={ip} 
              onChange={e => setIp(e.target.value)} 
              placeholder="127.0.0.1" 
              style={{ width: '105px', padding: '5px 8px', fontSize: '11.5px' }}
              required 
            />
            <span style={{ color: 'var(--text-muted)' }}>:</span>
            <input 
              type="number" 
              className="input-field" 
              value={port} 
              onChange={e => setPort(e.target.value)} 
              placeholder="502" 
              style={{ width: '50px', padding: '5px 6px', fontSize: '11.5px' }}
              required 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unit ID:</span>
            <input 
              type="number" 
              className="input-field" 
              value={unitId} 
              onChange={e => setUnitId(e.target.value)} 
              placeholder="1" 
              style={{ width: '42px', padding: '5px 6px', fontSize: '11.5px' }}
              required 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>功能码:</span>
            <select 
              className="input-field"
              value={fc}
              onChange={e => setFc(e.target.value)}
              style={{ width: '150px', padding: '4px', fontSize: '11.5px', background: 'rgba(0,0,0,0.4)', color: '#fff' }}
            >
              <option value="1">FC 01 - Read Coils (0xxxx)</option>
              <option value="2">FC 02 - Read Discrete Inputs (1xxxx)</option>
              <option value="3">FC 03 - Read Holding Registers (4xxxx)</option>
              <option value="4">FC 04 - Read Input Registers (3xxxx)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>别名:</span>
            <input 
              type="text" 
              className="input-field" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="选填别名" 
              style={{ width: '100px', padding: '5px 8px', fontSize: '11.5px' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '11.5px' }}>
            {editingId ? '保存修改' : '建立连接'}
          </button>

          {editingConfigIdx !== null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button 
                type="button" 
                onClick={handleSaveConfig} 
                className="btn btn-primary" 
                style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px', border: '1px solid var(--color-primary)' }}
              >
                <Edit2 size={12} />
                保存修改
              </button>
              <button 
                type="button" 
                onClick={handleSaveAsNewConfig} 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}
                title="保存为新的独立配置"
              >
                <Bookmark size={12} />
                另存常用
              </button>
              <button 
                type="button" 
                onClick={handleCancelConfigEdit} 
                className="btn btn-secondary" 
                style={{ padding: '4px 6px', fontSize: '11.5px' }}
                title="取消修改并清空表单"
              >
                取消
              </button>
            </div>
          ) : (
            <button 
              type="button" 
              onClick={handleSaveConfig} 
              className="btn btn-secondary" 
              style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Bookmark size={12} />
              保存常用
            </button>
          )}

          {/* 高级轮询参数开关 */}
          <button 
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}
          >
            <Settings size={12} />
            {showAdvanced ? '隐藏轮询参数' : '设定轮询参数'}
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </form>

        {/* 常用配置 Dropdown */}
        {savedConfigs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>常用:</span>
            <select 
              value={selectedConfigIdx}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "") {
                  const cfg = savedConfigs[parseInt(val)];
                  handleLoadConfig(cfg, val);
                } else {
                  setSelectedConfigIdx('');
                }
              }}
              style={{ width: '120px', padding: '4px 6px', fontSize: '11.5px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            >
              <option value="">-- 选择配置 --</option>
              {savedConfigs.map((cfg, idx) => (
                <option key={idx} value={idx}>{cfg.name || `${cfg.ip}:${cfg.port}`}</option>
              ))}
            </select>
            {selectedConfigIdx !== '' && (
              <button
                type="button"
                onClick={() => handleDeleteConfig(parseInt(selectedConfigIdx))}
                style={{
                  background: 'rgba(255, 56, 96, 0.15)',
                  border: '1px solid rgba(255, 56, 96, 0.3)',
                  color: 'var(--color-danger)',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                title="删除此常用配置"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}

        {/* 活动连接 Dropdown 与实时状态显示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>通道:</span>
          <select 
            value={activeConnId || ''}
            onChange={(e) => {
              if (e.target.value) {
                onSelectActive(e.target.value);
              }
            }}
            style={{ width: '135px', padding: '4px 6px', fontSize: '11.5px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
          >
            <option value="">-- 活动通道 ({connections.length}) --</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status === 'CONNECTED' ? '已连接' : c.status === 'CONNECTING' ? '连接中' : '已断开'})
              </option>
            ))}
          </select>

          {/* 实时状态徽标 */}
          {activeConnection && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              background: activeConnection.status === 'CONNECTED' 
                ? 'rgba(0, 184, 148, 0.12)' 
                : activeConnection.status === 'CONNECTING'
                ? 'rgba(255, 170, 0, 0.12)'
                : 'rgba(255, 76, 76, 0.12)',
              border: `1px solid ${
                activeConnection.status === 'CONNECTED'
                  ? 'rgba(0, 184, 148, 0.3)'
                  : activeConnection.status === 'CONNECTING'
                  ? 'rgba(255, 170, 0, 0.3)'
                  : 'rgba(255, 76, 76, 0.3)'
              }`,
              color: activeConnection.status === 'CONNECTED'
                ? 'var(--color-success)'
                : activeConnection.status === 'CONNECTING'
                ? 'var(--color-warning)'
                : 'var(--color-danger)',
              flexShrink: 0
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: activeConnection.status === 'CONNECTED'
                  ? 'var(--color-success)'
                  : activeConnection.status === 'CONNECTING'
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)',
                boxShadow: activeConnection.status === 'CONNECTED' ? '0 0 6px var(--color-success)' : 'none'
              }} />
              {activeConnection.status === 'CONNECTED' ? '已连接' : activeConnection.status === 'CONNECTING' ? '连接中' : '已断开'}
            </div>
          )}

          {activeConnection && (
            <button 
              onClick={() => onDisconnect(activeConnection.id)} 
              style={{ 
                background: 'rgba(255, 56, 96, 0.15)', 
                border: '1px solid rgba(255, 56, 96, 0.3)', 
                color: 'var(--color-danger)', 
                cursor: 'pointer', 
                padding: '3px 8px', 
                borderRadius: '4px', 
                fontSize: '11px',
                flexShrink: 0
              }}
            >
              断开
            </button>
          )}
        </div>
      </div>

      {/* 第二行：高级轮询参数 (展开时显示) */}
      {showAdvanced && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px',
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.02)',
          marginTop: '4px',
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>起始地址:</span>
            <input type="number" className="input-field" value={startAddr} onChange={e => setStartAddr(e.target.value)} style={{ width: '70px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>读取长度:</span>
            <input type="number" className="input-field" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ width: '70px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>扫描间隔(ms):</span>
            <input type="number" className="input-field" value={interval} onChange={e => setInterval(e.target.value)} style={{ width: '80px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
        </div>
      )}
    </div>
  );
}
