import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from './Header';
import ConnectionManager from './ConnectionManager';
import MonitorDashboard from './MonitorDashboard';
import CommandPanel from './CommandPanel';
import TrafficMonitor from './TrafficMonitor';
import SimulatorConfig from './SimulatorConfig';

export default function IEC104Dashboard() {
  // 选项卡系统: 'dashboard' | 'commands' | 'traffic' | 'simulator'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnCollapsed, setIsConnCollapsed] = useState(false);
  
  // 客户端连接管理状态
  const [connections, setConnections] = useState([]);
  const [activeConnId, setActiveConnId] = useState(null);

  // 测点实时数据库: { [connId]: { [ioa]: { ioa, value, quality, time, lastUpdated } } }
  const [yxPoints, setYxPoints] = useState({});
  const [ycPoints, setYcPoints] = useState({});

  // 报文与运行日志: { [connId]: [trafficArray] }
  const [trafficLogs, setTrafficLogs] = useState({});

  // 专属控制审计日志: { [connId]: [controlLogsArray] }
  const [controlLogs, setControlLogs] = useState({});

  // 模拟器状态
  const [simRunning, setSimRunning] = useState(false);
  const [simLogs, setSimLogs] = useState([]);

  // 注册主进程事件监听器
  useEffect(() => {
    // 1. 监听连接状态变化
    const unsubscribeStatus = window.api.iec104.onConnectionStatus((data) => {
      const { id, status, error } = data;
      setConnections(prev => prev.map(conn => 
        conn.id === id ? { ...conn, status, error: error || null } : conn
      ));
    });

    // 2. 监听测量数据更新 (以及解析遥控遥调在规约层的返校/激活结束应答)
    const unsubscribeData = window.api.iec104.onDataUpdate((data) => {
      const { id, typeId, cot, cotName, objects } = data;
      
      // 遥信数据类型判断
      const isYx = typeId === 1 || typeId === 3 || typeId === 30 || typeId === 31;
      // 遥测数据类型判断
      const isYc = typeId === 9 || typeId === 11 || typeId === 13 || typeId === 35 || typeId === 36 || typeId === 38;
      // 遥控/遥调应答类型判断
      const isControlFeedback = typeId === 45 || typeId === 46 || typeId === 48 || typeId === 50;

      const now = Date.now();

      if (isYx) {
        setYxPoints(prev => {
          const clientData = { ...(prev[id] || {}) };
          objects.forEach(obj => {
            clientData[obj.ioa] = {
              ...obj,
              time: obj.time || new Date().toLocaleTimeString(), // 兜底：若报文不带时标，则取主站接收时间
              lastUpdated: now
            };
          });
          return { ...prev, [id]: clientData };
        });
      } else if (isYc) {
        setYcPoints(prev => {
          const clientData = { ...(prev[id] || {}) };
          objects.forEach(obj => {
            clientData[obj.ioa] = {
              ...obj,
              time: obj.time || new Date().toLocaleTimeString(), // 兜底：若报文不带时标，则取主站接收时间
              lastUpdated: now
            };
          });
          return { ...prev, [id]: clientData };
        });
      } else if (isControlFeedback) {
        // 捕获控制通道回执，写入审计终端
        setControlLogs(prev => {
          const clientLogs = [...(prev[id] || [])];
          objects.forEach(obj => {
            let msg = '';
            const isNeg = cotName.includes('否定');
            const valObj = obj.value; // SCO, DCO or QOS structures
            
            if (typeId === 45 || typeId === 46) {
              const actionStr = (typeId === 45 ? valObj.state === 1 : valObj.state === 2) ? '合闸' : '分闸';
              if (isNeg) {
                msg = `从站拒绝遥控操作 (IOA=${obj.ioa}): 否定确认(返校失败)`;
              } else if (cot === 7) {
                msg = `从站确认遥控 [${valObj.select ? '选择' : '执行'}] 应答 (IOA=${obj.ioa}, 动作=${actionStr})`;
              } else if (cot === 10) {
                msg = `从站遥控执行结束激活 (IOA=${obj.ioa}): 状态切换完毕`;
              } else {
                msg = `从站遥控反馈: IOA=${obj.ioa}, 原因=${cotName}`;
              }
            } else { // 48, 50
              if (isNeg) {
                msg = `从站拒绝遥调操作 (IOA=${obj.ioa}): 否定确认(设点失败)`;
              } else if (cot === 7) {
                msg = `从站确认遥调 [${valObj.select ? '选择' : '执行'}] 应答 (IOA=${obj.ioa}, 设点值=${valObj.val})`;
              } else if (cot === 10) {
                msg = `从站遥调设定激活结束 (IOA=${obj.ioa})`;
              } else {
                msg = `从站遥调反馈: IOA=${obj.ioa}, 设点值=${valObj.val}, 原因=${cotName}`;
              }
            }
            
            clientLogs.push({
              timestamp: now,
              direction: 'RX',
              success: !isNeg,
              message: msg
            });
          });
          
          if (clientLogs.length > 200) clientLogs.shift();
          return { ...prev, [id]: clientLogs };
        });
      }
    });

    // 3. 监听网络报文包事件
    const unsubscribeTraffic = window.api.iec104.onTrafficLog((log) => {
      const { clientId } = log;
      setTrafficLogs(prev => {
        const clientLogs = [...(prev[clientId] || [])];
        clientLogs.push(log);
        // 为防内存溢出，仅保留最近 600 条记录
        if (clientLogs.length > 600) {
          clientLogs.shift();
        }
        return { ...prev, [clientId]: clientLogs };
      });
    });

    // 4. 监听从站模拟器日志与状态
    const unsubscribeSimLog = window.api.iec104.onSimulatorLog((msg) => {
      setSimLogs(prev => {
        const list = [...prev, { message: msg, timestamp: Date.now() }];
        if (list.length > 300) list.shift();
        return list;
      });
    });

    const unsubscribeSimStatus = window.api.iec104.onSimulatorStatus((isRunning) => {
      setSimRunning(isRunning);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeData();
      unsubscribeTraffic();
      unsubscribeSimLog();
      unsubscribeSimStatus();
    };
  }, []);

  // 操作处理器
  // ==========================================

  // 创建/开启连接
  const handleConnect = async (config) => {
    setConnections(prev => {
      const existsIndex = prev.findIndex(c => c.id === config.id || (c.ip === config.ip && String(c.port) === String(config.port)));
      if (existsIndex !== -1) {
        const updated = [...prev];
        const oldId = updated[existsIndex].id;
        if (oldId !== config.id) {
          window.api.iec104.disconnect(oldId).catch(() => {});
        }
        updated[existsIndex] = { ...updated[existsIndex], ...config, status: 'CONNECTING', error: null };
        return updated;
      }
      return [...prev, { ...config, status: 'CONNECTING', error: null }];
    });

    setActiveConnId(config.id);
    
    // 初始化该通道对应的数据容器
    setYxPoints(prev => {
      if (prev[config.id]) return prev;
      return { ...prev, [config.id]: {} };
    });
    setYcPoints(prev => {
      if (prev[config.id]) return prev;
      return { ...prev, [config.id]: {} };
    });
    setTrafficLogs(prev => {
      if (prev[config.id]) return prev;
      return { ...prev, [config.id]: [] };
    });
    setControlLogs(prev => {
      if (prev[config.id]) return prev;
      return { ...prev, [config.id]: [] };
    });

    await window.api.iec104.connect(config);
  };

  // 关闭连接
  const handleDisconnect = async (id) => {
    await window.api.iec104.disconnect(id);
  };

  // 删除连接配置
  const handleDeleteConnection = async (id) => {
    await window.api.iec104.disconnect(id);
    setConnections(prev => prev.filter(c => c.id !== id));
    
    if (activeConnId === id) {
      const remaining = connections.filter(c => c.id !== id);
      setActiveConnId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // 一键总召
  const handleGeneralCall = async (id) => {
    if (!id) return;
    const res = await window.api.iec104.sendGeneralCall(id);
    if (!res.success) {
      alert(`总召失败: ${res.error}`);
    }
  };

  // 发送遥控操作 (由命令控制台触发)
  const handleSendYK = async (ioa, commandType, value, step, commonAddress) => {
    if (!activeConnId) return;

    const stepStr = step === 'select' ? '选择' : (step === 'execute' ? '执行' : '直接执行');
    const actionStr = (commandType === 45 ? value === 1 : value === 2) ? '合闸' : '分闸';
    const cmdName = commandType === 45 ? '单字节遥控' : '双字节遥控';

    // 记录发送动作
    setControlLogs(prev => {
      const clientLogs = [...(prev[activeConnId] || [])];
      clientLogs.push({
        timestamp: Date.now(),
        direction: 'TX',
        success: true,
        message: `发送遥控【${stepStr}】指令 -> (IOA=${ioa}, 公共地址=${commonAddress}, 类型=${cmdName}, 目标值=${actionStr})`
      });
      return { ...prev, [activeConnId]: clientLogs };
    });

    const res = await window.api.iec104.sendTeleControl(activeConnId, {
      ioa,
      commandType,
      value,
      step,
      commonAddress
    });

    if (!res.success) {
      setControlLogs(prev => {
        const clientLogs = [...(prev[activeConnId] || [])];
        clientLogs.push({
          timestamp: Date.now(),
          direction: 'RX',
          success: false,
          message: `底层协议下发失败: ${res.error}`
        });
        return { ...prev, [activeConnId]: clientLogs };
      });
    }
  };

  // 发送遥调操作 (由命令控制台触发)
  const handleSendYT = async (ioa, adjustType, value, step, commonAddress) => {
    if (!activeConnId) return;

    const stepStr = step === 'select' ? '选择' : (step === 'execute' ? '执行' : '直接执行');
    const cmdName = adjustType === 48 ? '归一化设点' : '短浮点设点';

    // 记录发送动作
    setControlLogs(prev => {
      const clientLogs = [...(prev[activeConnId] || [])];
      clientLogs.push({
        timestamp: Date.now(),
        direction: 'TX',
        success: true,
        message: `发送遥调【${stepStr}】指令 -> (IOA=${ioa}, 公共地址=${commonAddress}, 类型=${cmdName}, 设点值=${value})`
      });
      return { ...prev, [activeConnId]: clientLogs };
    });

    // 遥调暂时只提供直接执行接口（IEC104中遥调多直接下发），根据 step 做适配
    // 在 iec104-client.js 中，遥调已自动注入 QOS 字节（QOS Bit 7 为选择位，默认0为直接执行）
    // 为了支持遥调的双步选择，我们直接复用协议层设点：
    const res = await window.api.iec104.sendTeleAdjust(activeConnId, {
      ioa,
      adjustType,
      value,
      step,
      commonAddress
    });

    if (!res.success) {
      setControlLogs(prev => {
        const clientLogs = [...(prev[activeConnId] || [])];
        clientLogs.push({
          timestamp: Date.now(),
          direction: 'RX',
          success: false,
          message: `底层协议下发失败: ${res.error}`
        });
        return { ...prev, [activeConnId]: clientLogs };
      });
    }
  };

  const handleClearControlLogs = (id) => {
    if (!id) return;
    setControlLogs(prev => ({ ...prev, [id]: [] }));
  };

  // 开启/关闭本地模拟从站
  const handleStartSimulator = async (config) => {
    const res = await window.api.iec104.startSimulator(config);
    if (!res.success) {
      alert(`模拟器启动失败: ${res.error}`);
    }
  };

  const handleStopSimulator = async () => {
    await window.api.iec104.stopSimulator();
  };

  // 获取当前的活动连接对象
  const activeConn = connections.find(c => c.id === activeConnId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* 顶部标题栏 */}
      <Header 
        connections={connections} 
        simRunning={simRunning} 
        activeConnId={activeConnId} 
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
          { id: 'dashboard', label: '数据监控舱' },
          { id: 'commands', label: '命令控制台' },
          { id: 'traffic', label: '报文监听台' },
          { id: 'simulator', label: '从站模拟器' }
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

      {/* 下方主体展示区 */}
      <main style={{ display: 'flex', flex: 1, minHeight: 0, padding: '16px' }}>
        
        {/* 主工作视区 */}
        <section style={{ flex: 1, minWidth: 0, height: '100%' }}>
          {activeTab === 'dashboard' && (
            <MonitorDashboard 
              activeConn={activeConn}
              yxPoints={yxPoints}
              ycPoints={ycPoints}
              onGeneralCall={handleGeneralCall}
            />
          )}

          {activeTab === 'commands' && (
            <CommandPanel 
              activeConn={activeConn}
              controlLogs={controlLogs}
              onSendYK={handleSendYK}
              onSendYT={handleSendYT}
              onClearLogs={handleClearControlLogs}
            />
          )}

          {activeTab === 'traffic' && (
            <TrafficMonitor 
              logs={trafficLogs}
              activeConn={activeConn}
            />
          )}

          {activeTab === 'simulator' && (
            <SimulatorConfig 
              simRunning={simRunning}
              simLogs={simLogs}
              onStartSim={handleStartSimulator}
              onStopSim={handleStopSimulator}
            />
          )}
        </section>

      </main>
      
    </div>
  );
}
