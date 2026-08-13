import React, { useState } from 'react';
import { Network, Plus, Trash2, Power, Settings, ChevronDown, ChevronUp, Bookmark, Edit2 } from 'lucide-react';

export default function ConnectionManager({ connections, activeConnId, onConnect, onDisconnect, onDeleteConnection, onSelectActive }) {
  const [ip, setIp] = useState('127.0.0.1');
  const [port, setPort] = useState('2404');
  const [commonAddress, setCommonAddress] = useState('1');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 高级配置参数
  const [t0, setT0] = useState('10');
  const [t1, setT1] = useState('15');
  const [t2, setT2] = useState('10');
  const [t3, setT3] = useState('20');
  const [k, setK] = useState('12');
  const [w, setW] = useState('8');

  const [editingId, setEditingId] = useState(null);

  const [savedConfigs, setSavedConfigs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('iec104_saved_configs') || '[]');
    } catch (e) {
      return [];
    }
  });

  const handleSaveConfig = () => {
    const newConfig = {
      ip,
      port: parseInt(port) || 2404,
      commonAddress: parseInt(commonAddress) || 1,
      t0: parseInt(t0) || 10,
      t1: parseInt(t1) || 15,
      t2: parseInt(t2) || 10,
      t3: parseInt(t3) || 20,
      k: parseInt(k) || 12,
      w: parseInt(w) || 8
    };

    const exists = savedConfigs.some(c => 
      c.ip === newConfig.ip && 
      c.port === newConfig.port && 
      c.commonAddress === newConfig.commonAddress &&
      c.t0 === newConfig.t0 &&
      c.t1 === newConfig.t1 &&
      c.t2 === newConfig.t2 &&
      c.t3 === newConfig.t3 &&
      c.k === newConfig.k &&
      c.w === newConfig.w
    );

    if (!exists) {
      const updated = [...savedConfigs, newConfig];
      localStorage.setItem('iec104_saved_configs', JSON.stringify(updated));
      setSavedConfigs(updated);
    }
  };

  const handleLoadConfig = (cfg) => {
    setIp(cfg.ip);
    setPort(cfg.port.toString());
    setCommonAddress(cfg.commonAddress.toString());
    if (cfg.t0) setT0(cfg.t0.toString());
    if (cfg.t1) setT1(cfg.t1.toString());
    if (cfg.t2) setT2(cfg.t2.toString());
    if (cfg.t3) setT3(cfg.t3.toString());
    if (cfg.k) setK(cfg.k.toString());
    if (cfg.w) setW(cfg.w.toString());
  };

  const handleDeleteConfig = (e, index) => {
    e.stopPropagation();
    const updated = savedConfigs.filter((_, i) => i !== index);
    localStorage.setItem('iec104_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
  };

  const handleStartEdit = (c) => {
    setEditingId(c.id);
    setIp(c.ip);
    setPort(c.port.toString());
    setCommonAddress(c.commonAddress.toString());
    if (c.t0) setT0(c.t0.toString());
    if (c.t1) setT1(c.t1.toString());
    if (c.t2) setT2(c.t2.toString());
    if (c.t3) setT3(c.t3.toString());
    if (c.k) setK(c.k.toString());
    if (c.w) setW(c.w.toString());
    setShowAdvanced(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIp('127.0.0.1');
    setPort('2404');
    setCommonAddress('1');
    setT0('10');
    setT1('15');
    setT2('10');
    setT3('20');
    setK('12');
    setW('8');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = editingId || `${ip}:${port}-${Date.now().toString(36).substr(-4)}`;
    onConnect({
      id,
      ip,
      port: parseInt(port) || 2404,
      commonAddress: parseInt(commonAddress) || 1,
      t0: parseInt(t0) || 10,
      t1: parseInt(t1) || 15,
      t2: parseInt(t2) || 10,
      t3: parseInt(t3) || 20,
      k: parseInt(k) || 12,
      w: parseInt(w) || 8,
      autoReconnect: true
    });
    setEditingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* 连接表单 */}
      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
          <Network size={16} color="var(--color-primary)" />
          {editingId ? '修改 IEC104 主站通道' : '新建 IEC104 主站通道'}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
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
              placeholder="2404" 
              required 
            />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label className="label-text">ASDU 公共地址 (Common Addr)</label>
          <input 
            type="number" 
            className="input-field" 
            value={commonAddress} 
            onChange={e => setCommonAddress(e.target.value)} 
            placeholder="1" 
            required 
          />
        </div>

        {/* 高级配置展开 */}
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
            {showAdvanced ? '折叠高级通信参数' : '展开高级通信参数'}
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showAdvanced && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '8px', 
              marginTop: '10px',
              padding: '10px',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.02)'
            }}>
              <div>
                <label className="label-text">t0 连接超时(s)</label>
                <input type="number" className="input-field" value={t0} onChange={e => setT0(e.target.value)} />
              </div>
              <div>
                <label className="label-text">t1 确认超时(s)</label>
                <input type="number" className="input-field" value={t1} onChange={e => setT1(e.target.value)} />
              </div>
              <div>
                <label className="label-text">t2 无数据确认(s)</label>
                <input type="number" className="input-field" value={t2} onChange={e => setT2(e.target.value)} />
              </div>
              <div>
                <label className="label-text">t3 空闲心跳(s)</label>
                <input type="number" className="input-field" value={t3} onChange={e => setT3(e.target.value)} />
              </div>
              <div>
                <label className="label-text">k 窗口上限(帧)</label>
                <input type="number" className="input-field" value={k} onChange={e => setK(e.target.value)} />
              </div>
              <div>
                <label className="label-text">w 确认S帧限额(帧)</label>
                <input type="number" className="input-field" value={w} onChange={e => setW(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, gap: '6px' }}>
            {editingId ? <Edit2 size={14} /> : <Plus size={14} />}
            {editingId ? '保存并重连' : '建立通道'}
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
                    {cfg.ip}:{cfg.port}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Common Addr: {cfg.commonAddress} | t0/t1: {cfg.t0}/{cfg.t1}s
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                  <button 
                    type="button" 
                    onClick={() => {
                      handleLoadConfig(cfg);
                      const id = `${cfg.ip}:${cfg.port}-${Date.now().toString(36).substr(-4)}`;
                      onConnect({
                        id,
                        ip: cfg.ip,
                        port: cfg.port,
                        commonAddress: cfg.commonAddress,
                        t0: cfg.t0,
                        t1: cfg.t1,
                        t2: cfg.t2,
                        t3: cfg.t3,
                        k: cfg.k,
                        w: cfg.w,
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

      {/* 连接列表 */}
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
                          {c.ip}:{c.port}
                        </strong>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        公共地址: {c.commonAddress} | 状态: {statusText}
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
