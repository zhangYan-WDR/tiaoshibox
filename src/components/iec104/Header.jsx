import React from 'react';
import { Activity, Server, Radio, Power } from 'lucide-react';

export default function Header({ connections, simRunning, activeConnId, onTabChange, activeTab }) {
  const activeCount = connections.filter(c => c.status === 'CONNECTED').length;
  const activeConn = connections.find(c => c.id === activeConnId);

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 24px',
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(16, 18, 26, 0.8)',
      backdropFilter: 'blur(10px)',
      userSelect: 'none',
      WebkitAppRegion: 'drag' // 允许拖动窗口 (Electron 特性)
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', WebkitAppRegion: 'no-drag' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary), #0066ff)',
          padding: '6px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 0 12px var(--color-primary-glow)'
        }}>
          <Activity size={20} color="#000" />
        </div>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '0.5px', color: '#fff', margin: 0 }}>
            IEC104 Pro
          </h1>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>
            工商业级电力规约分析仪
          </span>
        </div>
      </div>

      {onTabChange && (
        <nav style={{ display: 'flex', gap: '8px', WebkitAppRegion: 'no-drag' }}>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            数据监控舱
          </button>
          <button 
            className={`tab-btn ${activeTab === 'commands' ? 'active' : ''}`}
            onClick={() => onTabChange('commands')}
          >
            命令控制台
          </button>
          <button 
            className={`tab-btn ${activeTab === 'traffic' ? 'active' : ''}`}
            onClick={() => onTabChange('traffic')}
          >
            报文监听台
          </button>
          <button 
            className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => onTabChange('simulator')}
          >
            从站模拟器
          </button>
        </nav>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', WebkitAppRegion: 'no-drag' }}>
        <div className="status-badge">
          <Server size={14} color="var(--text-muted)" />
          <span>客户端连接: </span>
          <strong style={{ color: activeCount > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
            {activeCount}
          </strong>
        </div>

        <div className="status-badge">
          <Radio size={14} color="var(--text-muted)" />
          <span>模拟从站: </span>
          <span className={`status-dot ${simRunning ? 'active' : 'inactive'}`} style={{ marginLeft: '4px' }}></span>
          <strong style={{ color: simRunning ? 'var(--color-success)' : 'var(--text-muted)' }}>
            {simRunning ? '正在监听' : '已关闭'}
          </strong>
        </div>

        {activeConn && (
          <div className="status-badge" style={{ borderColor: 'var(--color-primary-glow)' }}>
            <span className={`status-dot ${activeConn.status === 'CONNECTED' ? 'active' : activeConn.status === 'CONNECTING' ? 'warning' : 'inactive'}`} />
            <span>当前主通道: </span>
            <strong style={{ color: 'var(--color-primary)' }}>
              {activeConn.ip}:{activeConn.port}
            </strong>
          </div>
        )}
      </div>

      <style>{`
        .tab-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          color: var(--text-main);
          background: rgba(255,255,255,0.03);
        }
        .tab-btn.active {
          color: #000;
          background: var(--color-primary);
          box-shadow: 0 0 10px var(--color-primary-glow);
        }
        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-light);
        }
      `}</style>
    </header>
  );
}
