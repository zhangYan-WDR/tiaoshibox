import React from 'react';
import { Shield, Radio, Activity, Cpu } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, mmsClientStatus, mmsServerActive, goosePubRunning, gooseSubRunning }) {
  const tabs = [
    { id: 'mms-client', name: 'MMS 客户端 (主站)', icon: Cpu },
    { id: 'mms-server', name: 'MMS 模拟服务端', icon: Shield },
    { id: 'goose-pub', name: 'GOOSE 发布端 (仿真)', icon: Radio },
    { id: 'goose-sub', name: 'GOOSE 订阅端', icon: Activity }
  ];

  return (
    <header className="pane-header" style={{ height: '70px', padding: '0 24px', paddingLeft: '80px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10, 15, 30, 0.6)', WebkitAppRegion: 'drag' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', WebkitAppRegion: 'no-drag' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-info) 100%)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}>
          <Cpu size={18} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px', background: 'linear-gradient(to right, #fff, var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            IEC 61850 MMS & GOOSE 调试工具
          </h1>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Powered by Antigravity
          </span>
        </div>
      </div>

      <nav className="tabs" style={{ WebkitAppRegion: 'no-drag' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.name}</span>
              {/* Small status dot in tab */}
              {tab.id === 'mms-client' && mmsClientStatus === 'CONNECTED' && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', marginLeft: '4px' }} />
              )}
              {tab.id === 'mms-server' && mmsServerActive && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', marginLeft: '4px' }} />
              )}
              {tab.id === 'goose-pub' && goosePubRunning && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', marginLeft: '4px' }} />
              )}
              {tab.id === 'goose-sub' && gooseSubRunning && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', marginLeft: '4px' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Global Status indicators */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', WebkitAppRegion: 'no-drag' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>MMS 主站:</span>
          {mmsClientStatus === 'CONNECTED' ? (
            <span className="badge badge-connected">已连接</span>
          ) : mmsClientStatus === 'CONNECTING' || mmsClientStatus === 'HANDSHAKING' ? (
            <span className="badge badge-connecting">握手中</span>
          ) : (
            <span className="badge badge-disconnected">断开</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>MMS 模拟器:</span>
          {mmsServerActive ? (
            <span className="badge badge-connected">运行中</span>
          ) : (
            <span className="badge badge-disconnected">停止</span>
          )}
        </div>
      </div>
    </header>
  );
}
