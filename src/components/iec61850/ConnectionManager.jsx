import React, { useState } from 'react';
import { Wifi, Square, Play, Bookmark, Settings, Info, Trash2 } from 'lucide-react';

export default function ConnectionManager({
  activeTab,
  
  // MMS Client params & actions
  mmsClientStatus,
  mmsClientIp,
  setMmsClientIp,
  mmsClientPort,
  setMmsClientPort,
  onMmsConnect,
  onMmsDisconnect,

  // MMS Server Simulator params & actions
  mmsServerActive,
  mmsServerPort,
  setMmsServerPort,
  onStartServer,
  onStopServer,

  // GOOSE Publisher params & actions
  goosePubRunning,
  goosePubConfig,
  setGoosePubConfig,
  onStartGoosePub,
  onStopGoosePub,

  // GOOSE Subscriber params & actions
  gooseSubRunning,
  gooseSubConfig,
  setGooseSubConfig,
  onStartGooseSub,
  onStopGooseSub
}) {
  const [mmsConfigName, setMmsConfigName] = useState('');
  const [selectedConfigIdx, setSelectedConfigIdx] = useState('');
  const [editingConfigIdx, setEditingConfigIdx] = useState(null);

  const [savedConfigs, setSavedConfigs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('iec61850_saved_configs') || '[]');
    } catch (e) {
      return [];
    }
  });

  const handleSaveConfig = () => {
    const newConfig = {
      name: mmsConfigName || `${mmsClientIp}:${mmsClientPort}`,
      ip: mmsClientIp,
      port: mmsClientPort
    };

    if (editingConfigIdx !== null) {
      const updated = [...savedConfigs];
      updated[editingConfigIdx] = newConfig;
      localStorage.setItem('iec61850_saved_configs', JSON.stringify(updated));
      setSavedConfigs(updated);
    } else {
      const exists = savedConfigs.some(c => c.name === newConfig.name && c.ip === newConfig.ip && c.port === newConfig.port);
      if (!exists) {
        const updated = [...savedConfigs, newConfig];
        localStorage.setItem('iec61850_saved_configs', JSON.stringify(updated));
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
      name: mmsConfigName ? `${mmsConfigName}_副本` : `${mmsClientIp}:${mmsClientPort}_副本`,
      ip: mmsClientIp,
      port: mmsClientPort
    };
    const updated = [...savedConfigs, newConfig];
    localStorage.setItem('iec61850_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
    // 自动选中新配置
    const newIdx = updated.length - 1;
    setSelectedConfigIdx(newIdx.toString());
    setEditingConfigIdx(newIdx);
    setMmsConfigName(newConfig.name);
  };

  const handleCancelConfigEdit = () => {
    setEditingConfigIdx(null);
    setSelectedConfigIdx('');
    setMmsConfigName('');
    setMmsClientIp('127.0.0.1');
    setMmsClientPort(10102);
  };

  const handleLoadConfig = (cfg, idx) => {
    setMmsClientIp(cfg.ip);
    setMmsClientPort(cfg.port);
    setMmsConfigName(cfg.name || '');
    setSelectedConfigIdx(idx.toString());
    setEditingConfigIdx(parseInt(idx));
  };

  const handleDeleteConfig = (index) => {
    const updated = savedConfigs.filter((_, i) => i !== index);
    localStorage.setItem('iec61850_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
    setSelectedConfigIdx('');
    if (editingConfigIdx === index) {
      setEditingConfigIdx(null);
    }
  };

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
      {/* MMS Client Tab Connection Config */}
      {activeTab === 'mms-client' && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>服务端IP:</span>
              <input 
                type="text" 
                className="input-field" 
                value={mmsClientIp} 
                onChange={e => setMmsClientIp(e.target.value)} 
                placeholder="127.0.0.1" 
                style={{ width: '105px', padding: '5px 8px', fontSize: '11.5px' }}
                disabled={mmsClientStatus !== 'DISCONNECTED'}
              />
              <span style={{ color: 'var(--text-muted)' }}>:</span>
              <input 
                type="number" 
                className="input-field" 
                value={mmsClientPort} 
                onChange={e => setMmsClientPort(parseInt(e.target.value) || 0)} 
                placeholder="10102" 
                style={{ width: '56px', padding: '5px 6px', fontSize: '11.5px' }}
                disabled={mmsClientStatus !== 'DISCONNECTED'}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>别名:</span>
              <input 
                type="text" 
                className="input-field" 
                value={mmsConfigName} 
                onChange={e => setMmsConfigName(e.target.value)} 
                placeholder="选填别名" 
                style={{ width: '100px', padding: '5px 8px', fontSize: '11.5px' }}
                disabled={mmsClientStatus !== 'DISCONNECTED'}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {mmsClientStatus === 'DISCONNECTED' ? (
                <>
                  <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onMmsConnect}>
                    <Wifi size={13} /> 连接 MMS 主站
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
                </>
              ) : (
                <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onMmsDisconnect}>
                  <Square size={13} /> 断开主站连接
                </button>
              )}
            </div>
          </div>

          {/* 常用配置 Dropdown */}
          {savedConfigs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '12px' }}>
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
                style={{ width: '120px', padding: '4px', fontSize: '11.5px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
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
        </div>
      )}

      {/* MMS Server Tab Connection Config */}
      {activeTab === 'mms-server' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>监听端口:</span>
            <input 
              type="number" 
              className="input-field" 
              value={mmsServerPort} 
              onChange={e => setMmsServerPort(parseInt(e.target.value) || 0)} 
              placeholder="10102" 
              style={{ width: '60px', padding: '5px 6px', fontSize: '11.5px' }}
              disabled={mmsServerActive}
            />
          </div>

          <div>
            {!mmsServerActive ? (
              <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onStartServer}>
                <Play size={13} /> 启动模拟服务端
              </button>
            ) : (
              <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onStopServer}>
                <Square size={13} /> 停止模拟服务端
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <Info size={12} color="var(--color-info)" />
            <span>提示: 系统端口 102 需要 Root 特权，占用时可改用 10102 端口监听</span>
          </div>
        </div>
      )}

      {/* GOOSE Publisher Tab Config */}
      {activeTab === 'goose-pub' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>控制块:</span>
            <input 
              type="text" 
              className="input-field" 
              value={goosePubConfig.gocbRef} 
              onChange={e => setGoosePubConfig({ ...goosePubConfig, gocbRef: e.target.value })} 
              style={{ width: '130px', padding: '5px 8px', fontSize: '11px' }}
              disabled={goosePubRunning}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>发布端ID:</span>
            <input 
              type="text" 
              className="input-field" 
              value={goosePubConfig.goID} 
              onChange={e => setGoosePubConfig({ ...goosePubConfig, goID: e.target.value })} 
              style={{ width: '90px', padding: '5px 8px', fontSize: '11px' }}
              disabled={goosePubRunning}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>APPID:</span>
            <input 
              type="text" 
              className="input-field" 
              value={goosePubConfig.appid} 
              onChange={e => setGoosePubConfig({ ...goosePubConfig, appid: e.target.value })} 
              style={{ width: '50px', padding: '5px 8px', fontSize: '11px' }}
              disabled={goosePubRunning}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>组播IP/Port:</span>
            <input 
              type="text" 
              className="input-field" 
              value={goosePubConfig.multicastIp} 
              onChange={e => setGoosePubConfig({ ...goosePubConfig, multicastIp: e.target.value })} 
              style={{ width: '95px', padding: '5px 8px', fontSize: '11px' }}
              disabled={goosePubRunning}
            />
            <span style={{ color: 'var(--text-muted)' }}>:</span>
            <input 
              type="number" 
              className="input-field" 
              value={goosePubConfig.port} 
              onChange={e => setGoosePubConfig({ ...goosePubConfig, port: parseInt(e.target.value) || 0 })} 
              style={{ width: '50px', padding: '5px 6px', fontSize: '11px' }}
              disabled={goosePubRunning}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>心跳/重传(ms):</span>
            <input 
              type="number" 
              className="input-field" 
              title="心跳间隔 maxTime"
              value={goosePubConfig.maxTime} 
              onChange={e => setGoosePubConfig({ ...goosePubConfig, maxTime: parseInt(e.target.value) || 2000 })} 
              style={{ width: '50px', padding: '5px 6px', fontSize: '11px' }}
              disabled={goosePubRunning}
            />
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <input 
              type="number" 
              className="input-field" 
              title="变位重传最小间隔 minTime"
              value={goosePubConfig.minTime} 
              onChange={e => setGoosePubConfig({ ...goosePubConfig, minTime: parseInt(e.target.value) || 4 })} 
              style={{ width: '40px', padding: '5px 6px', fontSize: '11px' }}
              disabled={goosePubRunning}
            />
          </div>

          <div>
            {!goosePubRunning ? (
              <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onStartGoosePub}>
                <Play size={13} /> 启动 GOOSE 发布
              </button>
            ) : (
              <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onStopGoosePub}>
                <Square size={13} /> 停止 GOOSE 发布
              </button>
            )}
          </div>
        </div>
      )}

      {/* GOOSE Subscriber Tab Config */}
      {activeTab === 'goose-sub' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>多播IP组:</span>
            <input 
              type="text" 
              className="input-field" 
              value={gooseSubConfig.multicastIp} 
              onChange={e => setGooseSubConfig({ ...gooseSubConfig, multicastIp: e.target.value })} 
              style={{ width: '100px', padding: '5px 8px', fontSize: '11.5px' }}
              disabled={gooseSubRunning}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UDP端口:</span>
            <input 
              type="number" 
              className="input-field" 
              value={gooseSubConfig.port} 
              onChange={e => setGooseSubConfig({ ...gooseSubConfig, port: parseInt(e.target.value) || 0 })} 
              style={{ width: '56px', padding: '5px 6px', fontSize: '11.5px' }}
              disabled={gooseSubRunning}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>APPID过滤 (Hex):</span>
            <input 
              type="text" 
              className="input-field" 
              placeholder="留空不过滤"
              value={gooseSubConfig.appidFilter} 
              onChange={e => setGooseSubConfig({ ...gooseSubConfig, appidFilter: e.target.value })} 
              style={{ width: '90px', padding: '5px 8px', fontSize: '11.5px' }}
              disabled={gooseSubRunning}
            />
          </div>

          <div>
            {!gooseSubRunning ? (
              <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onStartGooseSub}>
                <Play size={13} /> 启动订阅监听
              </button>
            ) : (
              <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onStopGooseSub}>
                <Square size={13} /> 停止订阅监听
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
