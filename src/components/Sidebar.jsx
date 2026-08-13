import React from 'react';
import { Cpu, Layers, Activity, Server, Radio, Wrench, Binary, Network, Sun, Moon } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, theme, setTheme }) {
  const menuItems = [
    { id: 'modbus', label: 'Modbus TCP', desc: '主从站联调分析舱', icon: Cpu, color: 'var(--color-primary)' },
    { id: 'iec104', label: 'IEC 104', desc: '电力遥信遥测控制台', icon: Activity, color: 'var(--color-success)' },
    { id: 'iec61850', label: 'IEC 61850 Suite', desc: 'MMS节点浏览与GOOSE', icon: Server, color: '#f53b57' },
    { id: 'socket', label: 'TCP/UDP 调试器', desc: '套接字网口收发端', icon: Radio, color: 'var(--color-warning)' },
    { id: 'network', label: '网络诊断靶场', desc: 'Ping 与端口侦测诊断', icon: Network, color: '#38ef7d' },
    { id: 'converter', label: '数据计算宝箱', desc: '浮点、进制与校验码', icon: Binary, color: '#a29bfe' }
  ];

  return (
    <aside style={{
      width: '260px',
      background: 'rgba(12, 14, 21, 0.9)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none',
      WebkitAppRegion: 'drag'
    }}>
      {/* Sidebar Header Title */}
      <div style={{
        padding: '36px 20px 20px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        WebkitAppRegion: 'no-drag'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary), #0052d4)',
          padding: '8px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 0 15px var(--color-primary-glow)'
        }}>
          <Wrench size={22} color="#000" strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.8px', color: '#fff', margin: 0 }}>
            调试百宝箱
          </h1>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginTop: '2px' }}>
            工控与网络现场联调舱
          </span>
        </div>
      </div>

      {/* Sidebar Menu Items */}
      <nav style={{
        flex: 1,
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflowY: 'auto',
        WebkitAppRegion: 'no-drag'
      }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isActive ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(0, 229, 255, 0.15)' : 'transparent'}`,
                boxShadow: isActive ? 'inset 0 0 8px rgba(0, 229, 255, 0.03)' : 'none',
                position: 'relative',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              className="sidebar-item"
            >
              {/* Left indicator glow */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '12px',
                  bottom: '12px',
                  width: '3px',
                  background: item.color,
                  borderRadius: '0 4px 4px 0',
                  boxShadow: `0 0 10px ${item.color}`
                }} />
              )}

              <div style={{
                color: isActive ? item.color : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s'
              }}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              </div>

              <div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#fff' : 'var(--text-light)',
                  transition: 'color 0.2s'
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: isActive ? 'var(--text-muted)' : 'rgba(136, 146, 176, 0.6)',
                  marginTop: '2px',
                  fontWeight: '500'
                }}>
                  {item.desc}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Theme Switcher */}
      <div style={{
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderTop: '1px solid var(--border-color)',
        WebkitAppRegion: 'no-drag'
      }}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-light)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          className="theme-toggle-btn"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} color="var(--color-warning)" />
              切换至 浅色模式
            </>
          ) : (
            <>
              <Moon size={14} color="var(--color-primary)" />
              切换至 深色模式
            </>
          )}
        </button>
      </div>

      {/* Sidebar Footer info */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '10px',
        color: 'rgba(136, 146, 176, 0.4)',
        textAlign: 'center',
        fontWeight: '600'
      }}>
        Antigravity Studio v1.0.0
      </div>

      <style>{`
        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.015);
          border-color: rgba(255, 255, 255, 0.02);
        }
        .sidebar-item:active {
          transform: scale(0.98);
        }
      `}</style>
    </aside>
  );
}
