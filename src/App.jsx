import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ModbusDashboard from './components/modbus/ModbusDashboard';
import IEC104Dashboard from './components/iec104/IEC104Dashboard';
import IEC61850Dashboard from './components/iec61850/IEC61850Dashboard';
import SocketDebugger from './components/tools/SocketDebugger';
import NetworkTool from './components/tools/NetworkTool';
import DataConverter from './components/tools/DataConverter';

export default function App() {
  const [activeTab, setActiveTab] = useState('modbus');
  const [theme, setTheme] = useState(() => localStorage.getItem('debugtoolbox:app-theme') || 'dark'); // 'dark' | 'light'

  useEffect(() => {
    localStorage.setItem('debugtoolbox:app-theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  const renderContent = () => {
    switch (activeTab) {
      case 'modbus':
        return <ModbusDashboard />;
      case 'iec104':
        return <IEC104Dashboard />;
      case 'iec61850':
        return <IEC61850Dashboard />;
      case 'socket':
        return <SocketDebugger />;
      case 'network':
        return <NetworkTool />;
      case 'converter':
        return <DataConverter />;
      default:
        return <ModbusDashboard />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'transparent'
    }}>
      {/* Sidebar on the left */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} setTheme={setTheme} />

      {/* Main content viewport on the right */}
      <main style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* macOS Title Bar Spacer (for hiddenInset titleBar drag support) */}
        <div style={{
          height: '22px',
          width: '100%',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          WebkitAppRegion: 'drag',
          flexShrink: 0
        }} />

        {/* Dynamic page component wrapper */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative'
        }}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
