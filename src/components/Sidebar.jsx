import React from 'react';
import { 
  Cpu, 
  Activity, 
  Server, 
  Radio, 
  Wrench, 
  Binary, 
  Network, 
  Sun, 
  Moon, 
  Globe 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, theme, setTheme }) {
  const menuItems = [
    { id: 'modbus', label: 'Modbus TCP', icon: Cpu, color: 'var(--color-primary)' },
    { id: 'iec104', label: 'IEC 104', icon: Activity, color: 'var(--color-success)' },
    { id: 'iec61850', label: 'IEC 61850 Suite', icon: Server, color: '#f53b57' },
    { id: 'opcua', label: 'OPC UA', icon: Globe, color: '#00cec9' },
    { id: 'socket', label: 'TCP/UDP 调试器', icon: Radio, color: 'var(--color-warning)' },
    { id: 'network', label: '网络诊断靶场', icon: Network, color: '#38ef7d' },
    { id: 'converter', label: '数据计算宝箱', icon: Binary, color: '#a29bfe' }
  ];

  return (
    <header style={{
      height: '56px',
      background: theme === 'light' ? '#ffffff' : 'rgba(12, 14, 21, 0.95)',
      borderBottom: `1px solid ${theme === 'light' ? '#e2e8f0' : 'var(--border-color)'}`,
      boxShadow: theme === 'light' ? '0 1px 3px rgba(0, 0, 0, 0.04)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      paddingLeft: '80px', // 为 macOS 左上角红绿灯留出安全间距
      userSelect: 'none',
      WebkitAppRegion: 'drag', // 支持拖拽窗口
      flexShrink: 0
    }}>
      {/* 左侧：应用标识 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' }}>
        <div style={{
          background: theme === 'light' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'linear-gradient(135deg, var(--color-primary), #0052d4)',
          padding: '6px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: theme === 'light' ? '0 2px 6px rgba(2, 132, 199, 0.25)' : '0 0 10px var(--color-primary-glow)'
        }}>
          <Wrench size={16} color={theme === 'light' ? '#fff' : '#000'} strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{ fontSize: '13px', fontWeight: '800', color: theme === 'light' ? '#0f172a' : '#fff', margin: 0, letterSpacing: '0.5px' }}>
            调试百宝箱
          </h1>
        </div>
      </div>

      {/* 中间：横向功能选择菜单 */}
      <nav style={{ 
        display: 'flex', 
        gap: '6px', 
        WebkitAppRegion: 'no-drag', 
        flex: 1, 
        justifyContent: 'center', 
        margin: '0 16px',
        overflowX: 'auto',
        scrollbarWidth: 'none' // 隐藏滚动条
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
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: isActive 
                  ? (theme === 'light' ? '#f0f9ff' : 'rgba(255, 255, 255, 0.04)') 
                  : 'transparent',
                border: `1px solid ${isActive 
                  ? (theme === 'light' ? '#bae6fd' : 'rgba(0, 229, 255, 0.15)') 
                  : 'transparent'}`,
                color: isActive 
                  ? (theme === 'light' ? '#0284c7' : '#fff') 
                  : 'var(--text-muted)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              className="top-nav-item"
            >
              <Icon size={14} color={isActive ? (theme === 'light' ? '#0284c7' : item.color) : 'var(--text-muted)'} strokeWidth={2.2} />
              <span style={{ fontSize: '12px', fontWeight: isActive ? '700' : '500' }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </nav>

      {/* 右侧：主题切换与版本 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            background: theme === 'light' ? '#f1f5f9' : 'transparent',
            border: theme === 'light' ? '1px solid #e2e8f0' : 'none',
            borderRadius: '6px',
            color: 'var(--text-light)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          className="theme-toggle-btn"
          title={theme === 'dark' ? '切换至浅色模式' : '切换至深色模式'}
        >
          {theme === 'dark' ? (
            <Sun size={15} color="var(--color-warning)" />
          ) : (
            <Moon size={15} color="#0284c7" />
          )}
        </button>
        <span style={{ fontSize: '11px', color: theme === 'light' ? '#94a3b8' : 'rgba(136, 146, 176, 0.4)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
          v1.1.0
        </span>
      </div>

      <style>{`
        .top-nav-item:hover {
          background: ${theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)'};
          color: ${theme === 'light' ? '#0f172a' : '#fff'};
        }
        .top-nav-item:active {
          transform: scale(0.97);
        }
      `}</style>
    </header>
  );
}
