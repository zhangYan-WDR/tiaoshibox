import React, { useState } from 'react';
import { Network, Plus, Trash2, Power, Settings, ChevronDown, ChevronUp, Bookmark, Edit2 } from 'lucide-react';

export default function ConnectionManager({ connections, activeConnId, onConnect, onDisconnect, onDeleteConnection, onSelectActive }) {
  const [name, setName] = useState('');
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
  const [selectedConfigIdx, setSelectedConfigIdx] = useState('');
  const [editingConfigIdx, setEditingConfigIdx] = useState(null);

  const [savedConfigs, setSavedConfigs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('iec104_saved_configs') || '[]');
    } catch (e) {
      return [];
    }
  });

  const handleSaveConfig = () => {
    const newConfig = {
      name: name || `${ip}:${port}`,
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

    if (editingConfigIdx !== null) {
      const updated = [...savedConfigs];
      updated[editingConfigIdx] = newConfig;
      localStorage.setItem('iec104_saved_configs', JSON.stringify(updated));
      setSavedConfigs(updated);
    } else {
      const exists = savedConfigs.some(c => 
        c.name === newConfig.name &&
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
      port: parseInt(port) || 2404,
      commonAddress: parseInt(commonAddress) || 1,
      t0: parseInt(t0) || 10,
      t1: parseInt(t1) || 15,
      t2: parseInt(t2) || 10,
      t3: parseInt(t3) || 20,
      k: parseInt(k) || 12,
      w: parseInt(w) || 8
    };
    const updated = [...savedConfigs, newConfig];
    localStorage.setItem('iec104_saved_configs', JSON.stringify(updated));
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
    setPort('2404');
    setCommonAddress('1');
    setT0('10');
    setT1('15');
    setT2('10');
    setT3('20');
    setK('12');
    setW('8');
  };

  const handleLoadConfig = (cfg, idx) => {
    setName(cfg.name || '');
    setIp(cfg.ip);
    setPort(cfg.port.toString());
    setCommonAddress(cfg.commonAddress.toString());
    if (cfg.t0) setT0(cfg.t0.toString());
    if (cfg.t1) setT1(cfg.t1.toString());
    if (cfg.t2) setT2(cfg.t2.toString());
    if (cfg.t3) setT3(cfg.t3.toString());
    if (cfg.k) setK(cfg.k.toString());
    if (cfg.w) setW(cfg.w.toString());
    setSelectedConfigIdx(idx.toString());
    setEditingConfigIdx(parseInt(idx));
  };

  const handleDeleteConfig = (index) => {
    const updated = savedConfigs.filter((_, i) => i !== index);
    localStorage.setItem('iec104_saved_configs', JSON.stringify(updated));
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
    setCommonAddress(c.commonAddress.toString());
    if (c.t0) setT0(c.t0.toString());
    if (c.t1) setT1(c.t1.toString());
    if (c.t2) setT2(c.t2.toString());
    if (c.t3) setT3(c.t3.toString());
    if (c.k) setK(c.k.toString());
    if (c.w) setW(c.w.toString());
    setShowAdvanced(true);
    setSelectedConfigIdx('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 智能复用已有通道，避免修改参数后产生重复连接通道
    let targetId = editingId;
    if (!targetId && activeConnection && activeConnection.ip === ip && String(activeConnection.port) === String(port)) {
      targetId = activeConnection.id;
    }
    if (!targetId) {
      const existingSameEndpoint = connections.find(c => c.ip === ip && String(c.port) === String(port));
      if (existingSameEndpoint) {
        targetId = existingSameEndpoint.id;
      }
    }
    const id = targetId || `${ip}:${port}`;
    
    onConnect({
      id,
      name: name || `${ip}:${port}`,
      ip,
      port: parseInt(port) || 2404,
      commonAddress: parseInt(commonAddress) || 1,
      t0: parseInt(t0) || 10,
      t1: parseInt(t1) || 15,
      t2: parseInt(t2) || 10,
      t3: parseInt(t3) || 20,
      k: parseInt(k) || 12,
      w: parseInt(w) || 8
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
      {/* 第一行：主要连接表单与控件 */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>服务器:</span>
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
              placeholder="2404" 
              style={{ width: '56px', padding: '5px 6px', fontSize: '11.5px' }}
              required 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ASDU地址:</span>
            <input 
              type="number" 
              className="input-field" 
              value={commonAddress} 
              onChange={e => setCommonAddress(e.target.value)} 
              placeholder="1" 
              style={{ width: '45px', padding: '5px 6px', fontSize: '11.5px' }}
              required 
            />
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
            {showAdvanced ? '隐藏规约参数' : '设定规约参数'}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {activeConnection.status === 'CONNECTED' ? (
                <button 
                  type="button"
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
                  title="断开当前连接"
                >
                  断开
                </button>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => onConnect(activeConnection)} 
                    className="btn btn-primary"
                    style={{ 
                      padding: '3px 8px', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      flexShrink: 0
                    }}
                    title="重新连接当前通道"
                  >
                    重连
                  </button>
                  <button 
                    type="button"
                    onClick={() => onDeleteConnection && onDeleteConnection(activeConnection.id)} 
                    style={{ 
                      background: 'rgba(255, 56, 96, 0.12)', 
                      border: '1px solid rgba(255, 56, 96, 0.25)', 
                      color: 'var(--color-danger)', 
                      cursor: 'pointer', 
                      padding: '3px 6px', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}
                    title="移除此通道"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 第二行：高级规约参数 (展开时显示) */}
      {showAdvanced && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: '16px',
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.02)',
          marginTop: '4px',
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>t0:</span>
            <input type="number" className="input-field" value={t0} onChange={e => setT0(e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>t1:</span>
            <input type="number" className="input-field" value={t1} onChange={e => setT1(e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>t2:</span>
            <input type="number" className="input-field" value={t2} onChange={e => setT2(e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>t3:</span>
            <input type="number" className="input-field" value={t3} onChange={e => setT3(e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>k:</span>
            <input type="number" className="input-field" value={k} onChange={e => setK(e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>w:</span>
            <input type="number" className="input-field" value={w} onChange={e => setW(e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px' }} />
          </div>
        </div>
      )}
    </div>
  );
}
