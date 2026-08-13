import React, { useState } from 'react';
import { Play, Square, Settings, Wifi, Server, Radio, HelpCircle, Bookmark, Trash2 } from 'lucide-react';

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
  const [savedConfigs, setSavedConfigs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('iec61850_saved_configs') || '[]');
    } catch (e) {
      return [];
    }
  });

  const handleSaveConfig = () => {
    const newConfig = {
      ip: mmsClientIp,
      port: mmsClientPort
    };

    const exists = savedConfigs.some(c => c.ip === newConfig.ip && c.port === newConfig.port);
    if (!exists) {
      const updated = [...savedConfigs, newConfig];
      localStorage.setItem('iec61850_saved_configs', JSON.stringify(updated));
      setSavedConfigs(updated);
    }
  };

  const handleLoadConfig = (cfg) => {
    setMmsClientIp(cfg.ip);
    setMmsClientPort(cfg.port);
  };

  const handleDeleteConfig = (e, index) => {
    e.stopPropagation();
    const updated = savedConfigs.filter((_, i) => i !== index);
    localStorage.setItem('iec61850_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
  };

  return (
    <div className="pane" style={{ marginBottom: '16px' }}>
      <div className="pane-header">
        <h3>
          <Settings size={16} color="var(--color-accent)" />
          模块连接配置与控制
        </h3>
      </div>
      <div className="pane-body">
        
        {/* MMS Client Config */}
        {activeTab === 'mms-client' && (
          <div className="form-grid">
            <div className="form-group">
              <label>服务端 IP 地址 (IEC 61850 Server)</label>
              <input
                type="text"
                className="input-field"
                value={mmsClientIp}
                onChange={(e) => setMmsClientIp(e.target.value)}
                disabled={mmsClientStatus !== 'DISCONNECTED'}
              />
            </div>
            <div className="form-group">
              <label>MMS TCP 端口</label>
              <input
                type="number"
                className="input-field"
                value={mmsClientPort}
                onChange={(e) => setMmsClientPort(parseInt(e.target.value))}
                disabled={mmsClientStatus !== 'DISCONNECTED'}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              {mmsClientStatus === 'DISCONNECTED' ? (
                <>
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={onMmsConnect}>
                    <Wifi size={14} /> 连接 MMS 主站
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                    onClick={handleSaveConfig}
                    title="保存此连接配置"
                  >
                    <Bookmark size={14} />
                    保存配置
                  </button>
                </>
              ) : (
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={onMmsDisconnect}>
                  <Square size={14} /> 断开主站连接
                </button>
              )}
            </div>
          </div>
        )}

        {/* MMS Client Saved Configurations */}
        {activeTab === 'mms-client' && savedConfigs.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bookmark size={12} color="var(--color-primary)" />
              已保存的常用配置 ({savedConfigs.length})
            </h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {savedConfigs.map((cfg, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleLoadConfig(cfg)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    background: 'rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  className="saved-config-item"
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>
                    {cfg.ip}:{cfg.port}
                  </span>
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadConfig(cfg);
                      setTimeout(() => {
                        onMmsConnect();
                      }, 50);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      padding: 0
                    }}
                  >
                    连接
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConfig(e, idx);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <style>{`
              .saved-config-item:hover {
                background: rgba(0, 229, 255, 0.04) !important;
                border-color: rgba(0, 229, 255, 0.2) !important;
              }
            `}</style>
          </div>
        )}

        {/* MMS Server Config */}
        {activeTab === 'mms-server' && (
          <div className="form-grid">
            <div className="form-group">
              <label>本地监听 TCP 端口</label>
              <input
                type="number"
                className="input-field"
                value={mmsServerPort}
                onChange={(e) => setMmsServerPort(parseInt(e.target.value))}
                disabled={mmsServerActive}
              />
            </div>
            <div className="form-group">
              <label>说明</label>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HelpCircle size={12} color="var(--color-info)" />
                系统端口 102 可能需要管理员特权，如被占用可改用 10102
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {!mmsServerActive ? (
                <button className="btn btn-success" style={{ width: '100%' }} onClick={onStartServer}>
                  <Play size={14} /> 启动模拟服务端
                </button>
              ) : (
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={onStopServer}>
                  <Square size={14} /> 停止模拟服务端
                </button>
              )}
            </div>
          </div>
        )}

        {/* GOOSE Publisher Config */}
        {activeTab === 'goose-pub' && (
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="form-group">
              <label>GoCBRef (控制块)</label>
              <input
                type="text"
                className="input-field"
                value={goosePubConfig.gocbRef}
                onChange={(e) => setGoosePubConfig({ ...goosePubConfig, gocbRef: e.target.value })}
                disabled={goosePubRunning}
              />
            </div>
            <div className="form-group">
              <label>GoID (发布端ID)</label>
              <input
                type="text"
                className="input-field"
                value={goosePubConfig.goID}
                onChange={(e) => setGoosePubConfig({ ...goosePubConfig, goID: e.target.value })}
                disabled={goosePubRunning}
              />
            </div>
            <div className="form-group">
              <label>APPID (Hex 16位)</label>
              <input
                type="text"
                className="input-field"
                value={goosePubConfig.appid}
                onChange={(e) => setGoosePubConfig({ ...goosePubConfig, appid: e.target.value })}
                disabled={goosePubRunning}
              />
            </div>
            <div className="form-group">
              <label>多播组 IP / 端口</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  className="input-field"
                  style={{ flex: 2 }}
                  value={goosePubConfig.multicastIp}
                  onChange={(e) => setGoosePubConfig({ ...goosePubConfig, multicastIp: e.target.value })}
                  disabled={goosePubRunning}
                />
                <input
                  type="number"
                  className="input-field"
                  style={{ flex: 1 }}
                  value={goosePubConfig.port}
                  onChange={(e) => setGoosePubConfig({ ...goosePubConfig, port: parseInt(e.target.value) })}
                  disabled={goosePubRunning}
                />
              </div>
            </div>
            <div className="form-group">
              <label>心跳保持时间 / 最快重传 (ms)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="number"
                  className="input-field"
                  title="心跳间隔 maxTime"
                  style={{ flex: 1 }}
                  value={goosePubConfig.maxTime}
                  onChange={(e) => setGoosePubConfig({ ...goosePubConfig, maxTime: parseInt(e.target.value) })}
                  disabled={goosePubRunning}
                />
                <input
                  type="number"
                  className="input-field"
                  title="变位重传最小间隔 minTime"
                  style={{ flex: 1 }}
                  value={goosePubConfig.minTime}
                  onChange={(e) => setGoosePubConfig({ ...goosePubConfig, minTime: parseInt(e.target.value) })}
                  disabled={goosePubRunning}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {!goosePubRunning ? (
                <button className="btn btn-success" style={{ width: '100%' }} onClick={onStartGoosePub}>
                  <Radio size={14} /> 启动 GOOSE 发布
                </button>
              ) : (
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={onStopGoosePub}>
                  <Square size={14} /> 停止 GOOSE 发布
                </button>
              )}
            </div>
          </div>
        )}

        {/* GOOSE Subscriber Config */}
        {activeTab === 'goose-sub' && (
          <div className="form-grid">
            <div className="form-group">
              <label>多播监听 IP 组</label>
              <input
                type="text"
                className="input-field"
                value={gooseSubConfig.multicastIp}
                onChange={(e) => setGooseSubConfig({ ...gooseSubConfig, multicastIp: e.target.value })}
                disabled={gooseSubRunning}
              />
            </div>
            <div className="form-group">
              <label>监听 UDP 端口</label>
              <input
                type="number"
                className="input-field"
                value={gooseSubConfig.port}
                onChange={(e) => setGooseSubConfig({ ...gooseSubConfig, port: parseInt(e.target.value) })}
                disabled={gooseSubRunning}
              />
            </div>
            <div className="form-group">
              <label>APPID 过滤 (可选, Hex)</label>
              <input
                type="text"
                className="input-field"
                placeholder="留空不过滤"
                value={gooseSubConfig.appidFilter}
                onChange={(e) => setGooseSubConfig({ ...gooseSubConfig, appidFilter: e.target.value })}
                disabled={gooseSubRunning}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {!gooseSubRunning ? (
                <button className="btn btn-success" style={{ width: '100%' }} onClick={onStartGooseSub}>
                  <Wifi size={14} /> 启动订阅监听
                </button>
              ) : (
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={onStopGooseSub}>
                  <Square size={14} /> 停止订阅监听
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
