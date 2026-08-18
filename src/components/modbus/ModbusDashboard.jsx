import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from './Header';
import ConnectionManager from './ConnectionManager';
import MonitorDashboard from './MonitorDashboard';
import CommandPanel from './CommandPanel';
import TrafficMonitor from './TrafficMonitor';
import SimulatorConfig from './SimulatorConfig';

export default function ModbusDashboard() {
  // 选项卡系统: 'dashboard' | 'commands' | 'traffic' | 'simulator'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnCollapsed, setIsConnCollapsed] = useState(false);
  
  // 主站客户端通道管理
  const [connections, setConnections] = useState([]);
  const [activeConnId, setActiveConnId] = useState(null);

  // 寄存器状态池: { [connId]: { coils: {}, discreteInputs: {}, inputRegisters: {}, holdingRegisters: {} } }
  const [dataPoints, setDataPoints] = useState({});

  // 报文及通信数据监视池: { [connId]: [logs] }
  const [trafficLogs, setTrafficLogs] = useState({});

  // 本地从站模拟器状态
  const [simRunning, setSimRunning] = useState(false);
  const [simLogs, setSimLogs] = useState([]);
  const [simConnections, setSimConnections] = useState(0);
  const [simSnapshot, setSimSnapshot] = useState(null);

  // 监听主进程发上来的事件
  useEffect(() => {
    // 1. 通道连接状态变化
    const unsubscribeStatus = window.api.modbus.onConnectionStatus((data) => {
      const { id, status, error } = data;
      setConnections(prev => prev.map(conn => 
        conn.id === id ? { ...conn, status, error: error || null } : conn
      ));
    });

    // 2. 轮询数据更新
    const unsubscribeData = window.api.modbus.onDataUpdate((data) => {
      const { id, fc, startAddress, quantity, values } = data;
      
      const typeMap = {
        1: 'coils',
        2: 'discreteInputs',
        3: 'holdingRegisters',
        4: 'inputRegisters'
      };
      
      const regType = typeMap[fc];
      if (!regType) return;

      setDataPoints(prev => {
        const clientPool = prev[id] ? { ...prev[id] } : { coils: {}, discreteInputs: {}, inputRegisters: {}, holdingRegisters: {} };
        const updatedRegType = { ...clientPool[regType] };

        for (let i = 0; i < quantity; i++) {
          updatedRegType[startAddress + i] = values[i];
        }

        clientPool[regType] = updatedRegType;
        return { ...prev, [id]: clientPool };
      });
    });

    // 3. 通信原始数据日志更新
    const unsubscribeTraffic = window.api.modbus.onTrafficLog((log) => {
      const { clientId } = log;
      setTrafficLogs(prev => {
        const clientLogs = prev[clientId] ? [...prev[clientId]] : [];
        clientLogs.push(log);
        if (clientLogs.length > 500) {
          clientLogs.shift();
        }
        return { ...prev, [clientId]: clientLogs };
      });
    });

    // 4. 模拟器运行状态及日志
    const unsubscribeSimStatus = window.api.modbus.onSimulatorStatus((status) => {
      setSimRunning(status);
    });

    const unsubscribeSimLog = window.api.modbus.onSimulatorLog((data) => {
      setSimLogs(prev => {
        const list = [...prev, data];
        if (list.length > 200) list.shift();
        return list;
      });
    });

    const unsubscribeSimConns = window.api.modbus.onSimulatorConnections((count) => {
      setSimConnections(count);
    });

    const unsubscribeSimSnapshot = window.api.modbus.onSimulatorDataSnapshot((snapshot) => {
      setSimSnapshot(snapshot);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeData();
      unsubscribeTraffic();
      unsubscribeSimStatus();
      unsubscribeSimLog();
      unsubscribeSimConns();
      unsubscribeSimSnapshot();
    };
  }, []);

  // 操作处理器
  // ==========================================

  // 1. 发起主站连接
  const handleConnect = async (config) => {
    setConnections(prev => {
      const exists = prev.some(c => c.id === config.id);
      if (exists) {
        return prev.map(c => c.id === config.id ? { ...c, status: 'CONNECTING', error: null } : c);
      }
      return [...prev, { ...config, status: 'CONNECTING', error: null }];
    });

    if (!activeConnId) {
      setActiveConnId(config.id);
    }
    
    // 初始化数据结构
    setDataPoints(prev => {
      if (prev[config.id]) return prev;
      return {
        ...prev,
        [config.id]: { coils: {}, discreteInputs: {}, inputRegisters: {}, holdingRegisters: {} }
      };
    });
    setTrafficLogs(prev => {
      if (prev[config.id]) return prev;
      return {
        ...prev,
        [config.id]: []
      };
    });

    await window.api.modbus.connect(config);
  };

  // 2. 断开主站连接
  const handleDisconnect = async (id) => {
    await window.api.modbus.disconnect(id);
  };

  // 2.1 删除主站连接配置
  const handleDeleteConnection = async (id) => {
    await window.api.modbus.disconnect(id);
    setConnections(prev => prev.filter(c => c.id !== id));
    if (activeConnId === id) {
      const remaining = connections.filter(c => c.id !== id);
      setActiveConnId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // 3. 数据网格内修改 & 发送单个写入 (FC5, FC6)
  const handleWriteSingle = async (type, address, value) => {
    if (!activeConnId) return;
    return await window.api.modbus.writeSingle(activeConnId, { type, address, value });
  };

  // 4. 命令编译器直接读取 (FC1-4)
  const handleExecuteRead = async (params) => {
    if (!activeConnId) return { success: false, error: '未选中通道' };
    return await window.api.modbus.readRegisters(activeConnId, params);
  };

  // 5. 命令编译器发送单个写入
  const handleExecuteWriteSingle = async (params) => {
    if (!activeConnId) return { success: false, error: '未选中通道' };
    return await window.api.modbus.writeSingle(activeConnId, params);
  };

  // 6. 命令编译器批量写入 (FC15, FC16)
  const handleExecuteWriteMultiple = async (params) => {
    if (!activeConnId) return { success: false, error: '未选中通道' };
    return await window.api.modbus.writeMultiple(activeConnId, params);
  };

  // 7. 清空原始日志
  const handleClearLogs = (id) => {
    if (!id) return;
    setTrafficLogs(prev => ({ ...prev, [id]: [] }));
  };

  // 8. 启动模拟器
  const handleStartSimulator = async (config) => {
    const res = await window.api.modbus.startSimulator(config);
    if (!res.success) {
      alert(`模拟器启动失败: ${res.error}`);
    }
  };

  // 9. 停止模拟器
  const handleStopSimulator = async () => {
    await window.api.modbus.stopSimulator();
  };

  // 10. 直接从 UI 修改本地模拟器数值
  const handleUpdateSimulatorRegister = async (params) => {
    return await window.api.modbus.writeSimValue(params);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* 顶部标题栏 */}
      <Header 
        connections={connections} 
        simRunning={simRunning} 
        activeConnId={activeConnId} 
        simConnections={simConnections}
      />
 
      {/* 顶部横向连接配置区 */}
      {activeTab !== 'simulator' && (
        <ConnectionManager 
          connections={connections}
          activeConnId={activeConnId}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onDeleteConnection={handleDeleteConnection}
          onSelectActive={setActiveConnId}
        />
      )}

      {/* 子页面视图切换 Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '10px 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        {[
          { id: 'dashboard', label: '数值监控盘' },
          { id: 'commands', label: '主站命令台' },
          { id: 'traffic', label: '通信监视器' },
          { id: 'simulator', label: '从站模拟中心' }
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id)} 
            style={{
              background: activeTab === t.id ? 'var(--color-primary)' : 'transparent',
              border: 'none',
              color: activeTab === t.id ? '#000' : 'var(--text-muted)',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              borderRadius: '6px',
              boxShadow: activeTab === t.id ? '0 0 8px var(--color-primary-glow)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 下侧主工作区 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px' }}>
        
        {/* 标签工作板 */}
        <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
          {activeTab === 'dashboard' && (
            <MonitorDashboard 
              activeConnId={activeConnId}
              dataPoints={dataPoints}
              onWriteSingle={handleWriteSingle}
            />
          )}

          {activeTab === 'commands' && (
            <CommandPanel 
              activeConnId={activeConnId}
              onExecuteRead={handleExecuteRead}
              onExecuteWriteSingle={handleExecuteWriteSingle}
              onExecuteWriteMultiple={handleExecuteWriteMultiple}
            />
          )}

          {activeTab === 'traffic' && (
            <TrafficMonitor 
              activeConnId={activeConnId}
              logs={trafficLogs}
              onClearLogs={handleClearLogs}
            />
          )}

          {activeTab === 'simulator' && (
            <SimulatorConfig 
              simRunning={simRunning}
              simLogs={simLogs}
              simSnapshot={simSnapshot}
              simConnections={simConnections}
              onStartSim={handleStartSimulator}
              onStopSim={handleStopSimulator}
              onUpdateRegisterValue={handleUpdateSimulatorRegister}
            />
          )}
        </div>

      </div>

    </div>
  );
}
