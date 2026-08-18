import React, { useState, useEffect } from 'react';
import Header from './Header';
import SCLExplorer from './SCLExplorer';
import ConnectionManager from './ConnectionManager';
import MonitorDashboard from './MonitorDashboard';
import CommandPanel from './CommandPanel';
import TrafficMonitor from './TrafficMonitor';

export default function IEC61850Dashboard() {
  const [activeTab, setActiveTab] = useState('mms-client');
  const [trafficLogs, setTrafficLogs] = useState([]);

  // ==========================================
  // MMS Client State & Listeners
  // ==========================================
  const [mmsClientStatus, setMmsClientStatus] = useState('DISCONNECTED');
  const [mmsClientIp, setMmsClientIp] = useState('127.0.0.1');
  const [mmsClientPort, setMmsClientPort] = useState(10102); // 10102 default to avoid port 102 root privileges blocker
  const [mmsMonitoredVars, setMmsMonitoredVars] = useState([
    { path: 'MYSCL/LLN0$ST$Mod$stVal', type: 'integer', value: undefined, time: '-', desc: '[Mod.stVal (运行模式状态)]' },
    { path: 'MYSCL/CSWI1$ST$Pos$stVal', type: 'integer', value: undefined, time: '-', desc: '[Pos.stVal (断路器开关位置)]' },
    { path: 'MYSCL/MMXU1$MX$A$phsA$cVal$mag$f', type: 'float', value: undefined, time: '-', desc: '[A.phsA.cVal.mag.f (A相测量电流)]' }
  ]);

  // ==========================================
  // MMS Server State & Listeners
  // ==========================================
  const [mmsServerActive, setMmsServerActive] = useState(false);
  const [mmsServerPort, setMmsServerPort] = useState(10102);
  const [mmsServerDb, setMmsServerDb] = useState(new Map([
    ['MYSCL/LLN0$ST$Mod$stVal', { type: 'integer', value: 1, desc: '[Mod.stVal (运行模式状态)]' }],
    ['MYSCL/LLN0$ST$Mod$q', { type: 'bitstring', value: '0000000000000', desc: '[Mod.q (品质字)]' }],
    ['MYSCL/CSWI1$ST$Pos$stVal', { type: 'integer', value: 2, desc: '[Pos.stVal (断路器开关位置)]' }],
    ['MYSCL/MMXU1$MX$A$phsA$cVal$mag$f', { type: 'float', value: 220.5, desc: '[A.phsA.cVal.mag.f (A相测量电流)]' }],
    ['MYSCL/MMXU1$MX$A$phsB$cVal$mag$f', { type: 'float', value: 221.1, desc: '[A.phsB.cVal.mag.f (B相测量电流)]' }],
    ['MYSCL/MMXU1$MX$A$phsC$cVal$mag$f', { type: 'float', value: 219.8, desc: '[A.phsC.cVal.mag.f (C相测量电流)]' }],
    ['MYSCL/MMXU1$MX$PhV$phsA$cVal$mag$f', { type: 'float', value: 10.0, desc: '[PhV.phsA.cVal.mag.f (A相测量电压)]' }]
  ]));

  // ==========================================
  // GOOSE Publisher State & Listeners
  // ==========================================
  const [goosePubRunning, setGoosePubRunning] = useState(false);
  const [goosePubConfig, setGoosePubConfig] = useState({
    gocbRef: 'MyLD/LLN0$GO$gcb1',
    goID: 'GoosePub1',
    appid: '3000',
    multicastIp: '239.255.0.1',
    port: 3782,
    minTime: 4,
    maxTime: 2000
  });
  const [goosePubDataset, setGoosePubDataset] = useState([
    { name: 'Trip', type: 'boolean', value: false },
    { name: 'Pos_stVal', type: 'integer', value: 2 },
    { name: 'Pos_q', type: 'bitstring', value: '0000000000000' }
  ]);

  // ==========================================
  // GOOSE Subscriber State & Listeners
  // ==========================================
  const [gooseSubRunning, setGooseSubRunning] = useState(false);
  const [gooseSubConfig, setGooseSubConfig] = useState({
    multicastIp: '239.255.0.1',
    port: 3782,
    appidFilter: ''
  });
  const [gooseSubscribersData, setGooseSubscribersData] = useState([]);

  // ==========================================
  // Register IPC Communication Events on Mount
  // ==========================================
  useEffect(() => {
    // 1. MMS Client Event listeners
    const unsubStatus = window.api.iec61850.onMmsStatus((data) => {
      setMmsClientStatus(data.status);
    });

    const unsubData = window.api.iec61850.onMmsData((data) => {
      // Direct variable value updates
      setMmsMonitoredVars((prev) =>
        prev.map((v) =>
          v.path === data.path
            ? { ...v, value: data.value, type: data.type, time: new Date().toLocaleTimeString() }
            : v
        )
      );
    });

    const unsubTraffic = window.api.iec61850.onMmsTraffic((log) => {
      // Accumulate logs, cap at 200 rows
      setTrafficLogs((prev) => [log, ...prev].slice(0, 200));
    });

    // 2. MMS Server Event listeners
    const unsubSimStatus = window.api.iec61850.onSimStatus((isRunning) => {
      setMmsServerActive(isRunning);
    });

    const unsubSimData = window.api.iec61850.onSimData((data) => {
      setMmsServerDb((prev) => {
        const next = new Map(prev);
        if (next.has(data.path)) {
          next.get(data.path).value = data.value;
        }
        return next;
      });
    });

    const unsubSimLog = window.api.iec61850.onSimLog((data) => {
      setTrafficLogs((prev) => [
        {
          dir: 'LOG',
          hex: '',
          type: 'SIM_LOG',
          desc: `[模拟服务端] ${data.message}`,
          timestamp: data.timestamp
        },
        ...prev
      ].slice(0, 200));
    });

    // 3. GOOSE Event listeners
    const unsubGoosePubStatus = window.api.iec61850.onGoosePubStatus((data) => {
      if (data.role === 'publisher') setGoosePubRunning(data.isRunning);
      if (data.role === 'subscriber') setGooseSubRunning(data.isRunning);
    });

    const unsubGooseSubData = window.api.iec61850.onGooseSubData((data) => {
      setGooseSubscribersData((prev) => {
        const idx = prev.findIndex((item) => item.gocbRef === data.gocbRef);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = data;
          return next;
        } else {
          return [...prev, data];
        }
      });
    });

    const unsubGooseTraffic = window.api.iec61850.onGooseTraffic((log) => {
      setTrafficLogs((prev) => [
        {
          dir: log.dir,
          hex: log.hex,
          type: 'GOOSE',
          desc: log.desc,
          timestamp: log.timestamp
        },
        ...prev
      ].slice(0, 200));
    });

    return () => {
      unsubStatus();
      unsubData();
      unsubTraffic();
      unsubSimStatus();
      unsubSimData();
      unsubSimLog();
      unsubGoosePubStatus();
      unsubGooseSubData();
      unsubGooseTraffic();
    };
  }, []);

  // ==========================================
  // Client Command Dispatchers
  // ==========================================
  const handleMmsConnect = () => {
    window.api.iec61850.mmsConnect({
      id: 'CLIENT_MAIN',
      ip: mmsClientIp,
      port: mmsClientPort
    });
  };

  const handleMmsDisconnect = () => {
    window.api.iec61850.mmsDisconnect('CLIENT_MAIN');
  };

  const handleMmsRead = async (path) => {
    const res = await window.api.iec61850.mmsRead('CLIENT_MAIN', path);
    if (!res.success) throw new Error(res.error);
    return res.data;
  };

  const handleMmsWrite = async (path, type, value) => {
    let typedVal = value;
    if (type === 'integer') typedVal = parseInt(value);
    else if (type === 'float') typedVal = parseFloat(value);
    else if (type === 'boolean') typedVal = value === true || value === 'true' || value === 1;

    const res = await window.api.iec61850.mmsWrite('CLIENT_MAIN', { path, type, value: typedVal });
    if (!res.success) throw new Error(res.error);
    return res.data;
  };

  const handlePollVar = async (path) => {
    try {
      const res = await handleMmsRead(path);
      setMmsMonitoredVars((prev) =>
        prev.map((v) =>
          v.path === path
            ? { ...v, value: res.value, type: res.type, time: new Date().toLocaleTimeString() }
            : v
        )
      );
    } catch (e) {
      alert(`读取错误: ${e.message}`);
    }
  };

  const handleAddMonitoredVar = (path, type = 'unknown', value = undefined, desc = '') => {
    setMmsMonitoredVars((prev) => {
      if (prev.some((v) => v.path === path)) return prev;
      return [...prev, { path, type, value, time: '-', desc }];
    });
  };

  const handleRemoveMonitoredVar = (path) => {
    setMmsMonitoredVars((prev) => prev.filter((v) => v.path !== path));
  };

  // ==========================================
  // Server Simulator Control Actions
  // ==========================================
  const handleStartServer = () => {
    window.api.iec61850.startSimulator({ port: mmsServerPort });
  };

  const handleStopServer = () => {
    window.api.iec61850.stopSimulator();
  };

  const handleUpdateSimValue = (path, value) => {
    window.api.iec61850.updateSimValue(path, value);
  };

  // ==========================================
  // GOOSE Operations
  // ==========================================
  const handleStartGoosePub = () => {
    window.api.iec61850.startGoosePublisher({
      id: 'PUB_MAIN',
      ...goosePubConfig,
      dataset: goosePubDataset
    });
  };

  const handleStopGoosePub = () => {
    window.api.iec61850.stopGoosePublisher('PUB_MAIN');
  };

  const handleTogglePubDatasetItem = (name, value) => {
    // Change value local publisher array
    setGoosePubDataset((prev) =>
      prev.map((d) => (d.name === name ? { ...d, value } : d))
    );

    // If publisher running, send trip event
    if (goosePubRunning) {
      window.api.iec61850.triggerGooseTrip('PUB_MAIN', { [name]: value });
    }
  };

  const handleTriggerGooseTrip = (values) => {
    window.api.iec61850.triggerGooseTrip('PUB_MAIN', values);
  };

  const handleStartGooseSub = () => {
    setGooseSubscribersData([]); // Clear previous subscribers view
    window.api.iec61850.startGooseSubscriber({
      id: 'SUB_MAIN',
      ...gooseSubConfig
    });
  };

  const handleStopGooseSub = () => {
    window.api.iec61850.stopGooseSubscriber('SUB_MAIN');
  };

  return (
    <div className="app-container">
      {/* Title Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mmsClientStatus={mmsClientStatus}
        mmsServerActive={mmsServerActive}
        goosePubRunning={goosePubRunning}
        gooseSubRunning={gooseSubRunning}
      />

      {/* 顶部横向连接配置区 */}
      <ConnectionManager
        activeTab={activeTab}
        mmsClientStatus={mmsClientStatus}
        mmsClientIp={mmsClientIp}
        setMmsClientIp={setMmsClientIp}
        mmsClientPort={mmsClientPort}
        setMmsClientPort={setMmsClientPort}
        onMmsConnect={handleMmsConnect}
        onMmsDisconnect={handleMmsDisconnect}
        mmsServerActive={mmsServerActive}
        mmsServerPort={mmsServerPort}
        setMmsServerPort={setMmsServerPort}
        onStartServer={handleStartServer}
        onStopServer={handleStopServer}
        goosePubRunning={goosePubRunning}
        goosePubConfig={goosePubConfig}
        setGoosePubConfig={setGoosePubConfig}
        onStartGoosePub={handleStartGoosePub}
        onStopGoosePub={handleStopGoosePub}
        gooseSubRunning={gooseSubRunning}
        gooseSubConfig={gooseSubConfig}
        setGooseSubConfig={setGooseSubConfig}
        onStartGooseSub={handleStartGooseSub}
        onStopGooseSub={handleStopGooseSub}
      />

      <div className="main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px', gap: '16px' }}>
        
        {/* Left Hand SCL Node tree explorer (shown only in Client and Server tabs) */}
        {(activeTab === 'mms-client' || activeTab === 'mms-server') && (
          <div className="sidebar-left">
            <SCLExplorer
              onSelectPath={(path, bType, desc) => {
                if (activeTab === 'mms-client') {
                  handleAddMonitoredVar(path, bType, undefined, desc);
                }
              }}
            />
          </div>
        )}

        {/* Center Dashboard Workspace */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Main workspace table variables */}
          <MonitorDashboard
            activeTab={activeTab}
            mmsMonitoredVars={mmsMonitoredVars}
            onRemoveMonitoredVar={handleRemoveMonitoredVar}
            onPollVar={handlePollVar}
            mmsServerDb={mmsServerDb}
            onUpdateSimValue={handleUpdateSimValue}
            goosePubDataset={goosePubDataset}
            onTogglePubDatasetItem={handleTogglePubDatasetItem}
            gooseSubscribersData={gooseSubscribersData}
          />
        </div>

        {/* Right Console Command Panel */}
        <div className="sidebar-right" style={{ display: activeTab === 'mms-server' ? 'none' : 'block' }}>
          <CommandPanel
            activeTab={activeTab}
            mmsClientStatus={mmsClientStatus}
            onMmsRead={handleMmsRead}
            onMmsWrite={handleMmsWrite}
            onAddMonitoredVar={handleAddMonitoredVar}
            goosePubRunning={goosePubRunning}
            onTriggerGooseTrip={handleTriggerGooseTrip}
          />
        </div>

      </div>

      {/* Bottom Frame Analyzer */}
      <div style={{ padding: '0 16px 16px 16px' }}>
        <TrafficMonitor
          trafficLogs={trafficLogs}
          onClearLogs={() => setTrafficLogs([])}
          title={
            activeTab.startsWith('goose') 
              ? 'GOOSE 以太网多播报文流监视器 (GOOSE Frame Analyzer)' 
              : 'MMS 报文传输层监视器 (TPKT / COTP / ACSE / MMS Analyzer)'
          }
        />
      </div>
    </div>
  );
}
