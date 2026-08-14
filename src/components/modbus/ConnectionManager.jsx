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
    }
  };

  const handleLoadConfig = (cfg) => {
    setName(cfg.name || '');
    setIp(cfg.ip);
    setPort(cfg.port.toString());
    setUnitId(cfg.unitId.toString());
    if (cfg.fc) setFc(cfg.fc);
    if (cfg.startAddr) setStartAddr(cfg.startAddr);
    if (cfg.quantity) setQuantity(cfg.quantity);
    if (cfg.interval) setInterval(cfg.interval);
  };

  const handleDeleteConfig = (e, index) => {
    e.stopPropagation();
    const updated = savedConfigs.filter((_, i) => i !== index);
    localStorage.setItem('modbus_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
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
      setStartAddr(firstPoll.startAddress.toString());
      setQuantity(firstPoll.quantity.toString());
      setInterval(firstPoll.interval.toString());
    }
    setShowAdvanced(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setIp('127.0.0.1');
    setPort('502');
    setUnitId('1');
    setFc('3');
    setStartAddr('0');
    setQuantity('10');
    setInterval('1000');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = editingId || `${ip}:${port}-${Date.now().toString(36).substr(-4)}`;
    
    // 构造默认轮询配置
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

    setEditingId(null); // Clear editing mode
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* 新建/修改连接 */}
      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
          <Network size={16} color="var(--color-primary)" />
          {editingId ? '修改 Modbus TCP 主站通道' : '新建 Modbus TCP 主站通道'}
        </h3>
        
        <div style={{ marginBottom: '8px' }}>
          <label className="label-text">通道名称 (选填)</label>
          <input 
            type="text" 
            className="input-field" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="未填写时默认使用 IP:Port" 
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label className="label-text">从站 IP 地址</label>
            <input 
              type="text" 
              className="input-field" 
              value={ip} 
              onChange={e => setIp(e.target.value)} 
              placeholder="127.0.0.1" 
              required 
            />
          </div>
          <div>
            <label className="label-text">端口号 (Port)</label>
            <input 
              type="number" 
              className="input-field" 
              value={port} 
              onChange={e => setPort(e.target.value)} 
              placeholder="502" 
              required 
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div>
            <label className="label-text">设备 Unit ID</label>
            <input 
              type="number" 
              className="input-field" 
              value={unitId} 
              onChange={e => setUnitId(e.target.value)} 
              placeholder="1" 
              required 
            />
          </div>
          <div>
            <label className="label-text">默认轮询功能码</label>
            <select 
              className="input-field"
              value={fc}
              onChange={e => setFc(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.4)', color: '#fff' }}
            >
              <option value="1">FC 01 - Read Coils (0xxxx)</option>
              <option value="2">FC 02 - Read Discrete Inputs (1xxxx)</option>
              <option value="3">FC 03 - Read Holding Registers (4xxxx)</option>
              <option value="4">FC 04 - Read Input Registers (3xxxx)</option>
            </select>
          </div>
        </div>

        {/* 轮询详细设定 */}
        <div style={{ marginBottom: '12px' }}>
          <button 
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0
            }}
          >
            <Settings size={12} />
            {showAdvanced ? '折叠数据轮询参数' : '展开数据轮询参数'}
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showAdvanced && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1.1fr', 
              gap: '8px', 
              marginTop: '10px',
              padding: '10px',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.02)',
              alignItems: 'end'
            }}>
              <div>
                <label className="label-text">起始地址</label>
                <input type="number" className="input-field" value={startAddr} onChange={e => setStartAddr(e.target.value)} />
              </div>
              <div>
                <label className="label-text">读取长度</label>
                <input type="number" className="input-field" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
              <div>
                <label className="label-text">扫描周期(ms)</label>
                <input type="number" className="input-field" value={interval} onChange={e => setInterval(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, gap: '6px' }}>
            {editingId ? <Edit2 size={14} /> : <Plus size={14} />}
            {editingId ? '保存并重连' : '连接并开始轮询'}
          </button>
          {editingId ? (
            <button 
              type="button" 
              onClick={handleCancelEdit} 
              className="btn btn-secondary"
              style={{ padding: '8px 12px' }}
            >
              取消
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleSaveConfig} 
              className="btn btn-secondary"
              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="保存当前输入为常用配置"
            >
              <Bookmark size={14} />
              保存配置
            </button>
          )}
        </div>
      </form>

      {/* 已保存的配置列表 */}
      {savedConfigs.length > 0 && (
        <div className="glass-card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <Bookmark size={14} color="var(--color-primary)" />
            已保存的常用配置 ({savedConfigs.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {savedConfigs.map((cfg, idx) => (
              <div 
                key={idx} 
                onClick={() => handleLoadConfig(cfg)}
                className="saved-config-item"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '8px 12px', 
                  background: 'rgba(0,0,0,0.15)', 
                  borderRadius: '6px', 
                  border: '1px solid rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-main)' }}>
                    {cfg.name || `${cfg.ip}:${cfg.port}`}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {cfg.name ? `${cfg.ip}:${cfg.port} | ` : ''}Unit ID: {cfg.unitId} | 功能码: FC{cfg.fc} (扫: {cfg.interval}ms)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                  <button 
                    type="button" 
                    onClick={() => {
                      handleLoadConfig(cfg);
                      const id = `${cfg.ip}:${cfg.port}-${Date.now().toString(36).substr(-4)}`;
                      const polls = [
                        {
                          fc: parseInt(cfg.fc || '3'),
                          startAddress: parseInt(cfg.startAddr || '0') || 0,
                          quantity: parseInt(cfg.quantity || '10') || 1,
                          interval: parseInt(cfg.interval || '1000') || 1000
                        }
                      ];
                      onConnect({
                        id,
                        name: cfg.name || `${cfg.ip}:${cfg.port}`,
                        ip: cfg.ip,
                        port: cfg.port,
                        unitId: cfg.unitId,
                        polls,
                        autoReconnect: true
                      });
                    }} 
                    className="reconnect-btn"
                    style={{
                      background: 'rgba(0, 229, 255, 0.1)',
                      border: '1px solid rgba(0, 229, 255, 0.2)',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}
                  >
                    连接
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => handleDeleteConfig(e, idx)} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    className="delete-trash-btn"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 通道实例列表 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-light)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          连接实例列表 ({connections.length})
        </h3>
        
        {connections.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Network size={24} style={{ opacity: 0.3 }} />
            <span>暂无连接，请先在上方创建</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {connections.map((c) => {
              const isActive = c.id === activeConnId;
              let statusText = '已断开';
              let statusClass = 'inactive';
              if (c.status === 'CONNECTED') {
                statusText = '已连接';
                statusClass = 'active';
              } else if (c.status === 'CONNECTING') {
                statusText = '连接中';
                statusClass = 'warning';
              } else if (c.status === 'RECONNECTING') {
                statusText = '重连中';
                statusClass = 'warning';
              }

              return (
                <div 
                  key={c.id}
                  onClick={() => onSelectActive(c.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0,0,0,0.15)',
                    border: isActive ? '1px solid var(--color-primary-glow)' : '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  className="connection-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`status-dot ${statusClass}`} />
                        <strong style={{ fontSize: '13.5px', color: isActive ? 'var(--color-primary)' : 'var(--text-main)' }}>
                          {c.name || `${c.ip}:${c.port}`}
                        </strong>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {c.name ? `${c.ip}:${c.port} | ` : ''}Unit ID: {c.unitId} | 状态: {statusText}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(c)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: 0.8
                        }}
                        title="修改通道配置"
                        className="edit-pencil-btn"
                      >
                        <Edit2 size={13} />
                      </button>

                      {c.status !== 'DISCONNECTED' ? (
                        <button
                          onClick={() => onDisconnect(c.id)}
                          style={{
                            background: 'rgba(255, 56, 96, 0.1)',
                            border: '1px solid rgba(255, 56, 96, 0.2)',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                          className="disconnect-btn"
                          title="仅断开连接，保留通道配置"
                        >
                          断开
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => onConnect(c)}
                            style={{
                              background: 'rgba(0, 229, 255, 0.1)',
                              border: '1px solid rgba(0, 229, 255, 0.2)',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                            className="reconnect-btn"
                          >
                            重连
                          </button>
                          
                          <button
                            onClick={() => onDeleteConnection(c.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            className="delete-trash-btn"
                            title="彻底删除通道配置"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 错误提示原因 */}
                  {c.status === 'DISCONNECTED' && c.error && (
                    <div style={{
                      fontSize: '10.5px',
                      color: 'var(--color-danger)',
                      background: 'rgba(255, 56, 96, 0.08)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      borderLeft: '2px solid var(--color-danger)',
                      marginTop: '2px',
                      wordBreak: 'break-all'
                    }}>
                      原因: {c.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .connection-item:hover, .saved-config-item:hover {
          background: rgba(0, 229, 255, 0.04) !important;
          border-color: rgba(0, 229, 255, 0.2) !important;
        }
        .delete-btn:hover {
          background: rgba(255,56,96,0.15);
        }
      `}</style>
    </div>
  );
}
