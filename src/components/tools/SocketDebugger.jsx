import React, { useState, useEffect, useRef } from 'react';
import { Network, Play, Square, Send, Trash2, ShieldAlert, Plus, Settings2, FileText, CheckCircle2 } from 'lucide-react';

export default function SocketDebugger() {
  const [type, setType] = useState('tcp_client'); // tcp_client, tcp_server, udp
  const [ip, setIp] = useState('127.0.0.1');
  const [port, setPort] = useState('8080');
  const [bindPort, setBindPort] = useState('8081'); // for UDP binding
  const [autoReconnect, setAutoReconnect] = useState(true);
  
  // Connection states
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('DISCONNECTED');
  const [clients, setClients] = useState([]);
  const [targetClient, setTargetClient] = useState('');
  
  // Send message states
  const [sendData, setSendData] = useState('');
  const [isHexSend, setIsHexSend] = useState(false);
  const [loopSend, setLoopSend] = useState(false);
  const [loopInterval, setLoopInterval] = useState('1000');
  const [udpTargetIp, setUdpTargetIp] = useState('127.0.0.1');
  const [udpTargetPort, setUdpTargetPort] = useState('8080');
  
  // Rules for auto reply
  const [rules, setRules] = useState([
    { id: 1, match: 'hello', reply: 'world', isHex: false, replyHex: false, isRegex: false, delay: 50, active: true }
  ]);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Traffic log
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const logEndRef = useRef(null);
  const loopTimerRef = useRef(null);
  const instanceIdRef = useRef('socket-debugger-main');

  // Sync Rules to Backend when rules change
  useEffect(() => {
    if (isRunning) {
      window.api.tools.socketUpdateRules(instanceIdRef.current, rules);
    }
  }, [rules, isRunning]);

  // Handle IPC subscriptions
  useEffect(() => {
    const unsubStatus = window.api.tools.onSocketStatus((data) => {
      if (data.id === instanceIdRef.current) {
        setStatus(data.status);
        setIsRunning(data.status !== 'DISCONNECTED');
      }
    });

    const unsubClients = window.api.tools.onSocketClients((data) => {
      if (data.id === instanceIdRef.current) {
        setClients(data.clients || []);
        if (data.clients && data.clients.length > 0 && !data.clients.includes(targetClient)) {
          setTargetClient(data.clients[0]);
        }
      }
    });

    const unsubTraffic = window.api.tools.onSocketTraffic((log) => {
      if (log.id === instanceIdRef.current) {
        setLogs(prev => {
          const list = [...prev, log];
          return list.slice(-500); // limit logs
        });
      }
    });

    return () => {
      unsubStatus();
      unsubClients();
      unsubTraffic();
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    };
  }, [targetClient]);

  // Scroll to bottom
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Start connection
  const handleStart = async () => {
    const config = {
      id: instanceIdRef.current,
      type,
      ip,
      port: parseInt(port) || 8080,
      bindPort: type === 'udp' && bindPort ? parseInt(bindPort) : undefined,
      autoReconnect,
      rules
    };

    const res = await window.api.tools.socketStart(config);
    if (!res.success) {
      alert(`启动失败: ${res.error}`);
    } else {
      setLogs([]);
      setLogs([{
        dir: 'LOG',
        hex: '',
        ascii: '',
        desc: `[系统] 正在启动 ${type.toUpperCase()} 模式...`,
        timestamp: Date.now()
      }]);
    }
  };

  // Stop connection
  const handleStop = async () => {
    setLoopSend(false);
    if (loopTimerRef.current) {
      clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    await window.api.tools.socketStop(instanceIdRef.current);
    setIsRunning(false);
    setStatus('DISCONNECTED');
    setClients([]);
  };

  // Send message
  const handleSend = async () => {
    if (!sendData) return;
    const params = {
      data: sendData,
      isHex: isHexSend,
      targetIp: type === 'udp' ? udpTargetIp : undefined,
      targetPort: type === 'udp' ? parseInt(udpTargetPort) || 8080 : undefined,
      targetClientId: type === 'tcp_server' ? targetClient : undefined
    };

    const res = await window.api.tools.socketSend(instanceIdRef.current, params);
    if (!res.success) {
      setLogs(prev => [...prev, {
        dir: 'ERROR',
        hex: '',
        ascii: '',
        desc: `发送失败: ${res.error}`,
        timestamp: Date.now()
      }]);
    }
  };

  // Loop timer handler
  useEffect(() => {
    if (loopSend && isRunning) {
      const intervalMs = parseInt(loopInterval) || 1000;
      loopTimerRef.current = setInterval(() => {
        handleSend();
      }, intervalMs);
    } else {
      if (loopTimerRef.current) {
        clearInterval(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    }
    return () => {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    };
  }, [loopSend, sendData, isHexSend, udpTargetIp, udpTargetPort, targetClient, isRunning, type]);

  // Rules management
  const addRule = () => {
    const newId = rules.length > 0 ? Math.max(...rules.map(r => r.id)) + 1 : 1;
    setRules([...rules, { id: newId, match: '', reply: '', isHex: false, replyHex: false, isRegex: false, delay: 50, active: true }]);
  };

  const updateRule = (id, field, value) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRule = (id) => {
    setRules(rules.filter(r => r.id !== id));
  };

  // Export logs
  const handleExportLogs = () => {
    const text = logs.map(l => {
      const time = new Date(l.timestamp).toLocaleTimeString();
      return `[${time}] [${l.dir}] ${l.desc || ''}\nHex: ${l.hex || ''}\nASCII: ${l.ascii || ''}\n`;
    }).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socket_debug_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px', height: 'calc(100vh - 50px)', padding: '16px', background: 'var(--bg-primary)' }}>
      {/* Control Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        
        {/* Connection Setup Card */}
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#fff', marginBottom: '16px' }}>
            <Network size={16} color="var(--color-primary)" />
            Socket 套接字配置
          </h3>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>工作模式</label>
            <select 
              value={type} 
              onChange={(e) => { setType(e.target.value); handleStop(); }}
              className="input-field"
              disabled={isRunning}
            >
              <option value="tcp_client">TCP 客户端 (Client)</option>
              <option value="tcp_server">TCP 服务端 (Server)</option>
              <option value="udp">UDP 调试端 (Client/Server)</option>
            </select>
          </div>

          {/* Dynamic Configuration Fields */}
          {type !== 'udp' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  {type === 'tcp_client' ? '服务器 IP' : '监听网卡 IP'}
                </label>
                <input 
                  type="text" 
                  value={ip} 
                  onChange={(e) => setIp(e.target.value)} 
                  className="input-field" 
                  disabled={isRunning}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>端口</label>
                <input 
                  type="number" 
                  value={port} 
                  onChange={(e) => setPort(e.target.value)} 
                  className="input-field" 
                  disabled={isRunning}
                />
              </div>
            </div>
          )}

          {type === 'udp' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>本地绑定 IP</label>
                <input 
                  type="text" 
                  value={ip} 
                  onChange={(e) => setIp(e.target.value)} 
                  className="input-field" 
                  disabled={isRunning}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>绑定本地端口</label>
                <input 
                  type="number" 
                  value={bindPort} 
                  placeholder="留空不绑定"
                  onChange={(e) => setBindPort(e.target.value)} 
                  className="input-field" 
                  disabled={isRunning}
                />
              </div>
            </div>
          )}

          {type === 'tcp_client' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input 
                type="checkbox" 
                id="reconnect-chk"
                checked={autoReconnect} 
                onChange={(e) => setAutoReconnect(e.target.checked)} 
                disabled={isRunning}
              />
              <label htmlFor="reconnect-chk" style={{ fontSize: '12px', color: 'var(--text-light)', cursor: 'pointer' }}>断线自动重连</label>
            </div>
          )}

          {/* Action Button */}
          {!isRunning ? (
            <button 
              onClick={handleStart} 
              style={{
                width: '100%',
                padding: '10px',
                background: 'linear-gradient(135deg, var(--color-primary), #00a8ff)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 0 12px var(--color-primary-glow)'
              }}
            >
              <Play size={16} fill="#000" />
              开启调试通道
            </button>
          ) : (
            <button 
              onClick={handleStop} 
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--color-danger)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 0 12px var(--color-danger-glow)'
              }}
            >
              <Square size={16} fill="#fff" />
              关闭调试通道
            </button>
          )}
        </div>

        {/* TCP Server Specific - Clients list */}
        {type === 'tcp_server' && isRunning && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '13px', color: '#fff', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>连接的客户端列表</span>
              <span style={{ color: 'var(--color-success)', fontSize: '11px' }}>{clients.length} 个活动连接</span>
            </h4>
            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
              {clients.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>等待客户端接入...</div>
              ) : (
                clients.map(c => (
                  <div 
                    key={c} 
                    onClick={() => setTargetClient(c)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      color: c === targetClient ? '#000' : 'var(--text-light)',
                      background: c === targetClient ? 'var(--color-primary)' : 'transparent',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {c} {c === targetClient ? ' (目标发送对象)' : ''}
                  </div>
                ))
              )}
            </div>
            {clients.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => setTargetClient('')}
                  className="tab-btn"
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    border: '1px solid var(--border-color)',
                    background: !targetClient ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                    color: !targetClient ? '#000' : 'var(--text-muted)'
                  }}
                >
                  广播所有
                </button>
              </div>
            )}
          </div>
        )}

        {/* Auto Reply Config Card */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings2 size={15} color="var(--color-warning)" />
              自动应答规则
            </h4>
            <button 
              onClick={() => setShowRulesModal(true)} 
              style={{ fontSize: '11px', color: 'var(--color-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              配置规则 ({rules.filter(r => r.active).length} 启)
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            当收到匹配的内容时，系统会自动在设定延时后回发数据，可用于模拟复杂的 PLC 应答机制。
          </p>
        </div>

        {/* Send Data Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ fontSize: '13px', color: '#fff' }}>手动发送命令区</h4>
          
          {type === 'udp' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>目标主机 IP</label>
                <input 
                  type="text" 
                  value={udpTargetIp} 
                  onChange={(e) => setUdpTargetIp(e.target.value)} 
                  className="input-field" 
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>目标端口</label>
                <input 
                  type="number" 
                  value={udpTargetPort} 
                  onChange={(e) => setUdpTargetPort(e.target.value)} 
                  className="input-field" 
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                />
              </div>
            </div>
          )}

          <textarea 
            placeholder={isHexSend ? "请输入十六进制数据，例如: AA BB 11 22 0D 0A" : "请输入发送文本..."}
            value={sendData}
            onChange={(e) => setSendData(e.target.value)}
            style={{
              height: '80px',
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-main)',
              padding: '8px',
              fontFamily: isHexSend ? 'var(--font-mono)' : 'inherit',
              fontSize: '12px',
              resize: 'none'
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-light)' }}>
                <input type="checkbox" checked={isHexSend} onChange={(e) => setIsHexSend(e.target.checked)} />
                Hex 发送
              </label>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-light)' }}>
                <input type="checkbox" checked={loopSend} onChange={(e) => setLoopSend(e.target.checked)} />
                定时发送
              </label>
            </div>
            {loopSend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="number" 
                  value={loopInterval} 
                  onChange={(e) => setLoopInterval(e.target.value)} 
                  style={{ width: '50px', padding: '2px', fontSize: '11px', background: '#000', border: '1px solid var(--border-color)', color: '#fff', textAlign: 'center', borderRadius: '4px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ms</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!isRunning || !sendData}
            style={{
              width: '100%',
              padding: '8px',
              background: isRunning && sendData ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
              color: isRunning && sendData ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: isRunning && sendData ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Send size={14} />
            发送数据
          </button>
        </div>

      </div>

      {/* Traffic Log Dashboard */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0px' }}>
        
        {/* Log Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`status-dot ${status !== 'DISCONNECTED' ? 'active' : 'inactive'}`} />
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
              通信监视面板 
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                ({status === 'LISTENING' ? `正在监听端口 ${port}` : status === 'CONNECTED' ? `已连接到 ${ip}:${port}` : status === 'BOUND' ? `UDP 已绑定端口 ${bindPort}` : '未连接'})
              </span>
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
              自动滚动
            </label>
            <button 
              onClick={() => setLogs([])}
              style={{
                background: 'transparent', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <Trash2 size={12} /> 清空监视
            </button>
            <button 
              onClick={handleExportLogs}
              disabled={logs.length === 0}
              style={{
                background: 'transparent', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: logs.length > 0 ? 'var(--color-primary)' : 'var(--text-muted)', cursor: logs.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <FileText size={12} /> 导出日志
            </button>
          </div>
        </div>

        {/* Log Viewer Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          background: 'rgba(0,0,0,0.3)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px'
        }}>
          {logs.length === 0 ? (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px'
            }}>
              <Network size={36} style={{ opacity: 0.3 }} />
              <div>暂无报文传输，请开启通道并发送数据</div>
            </div>
          ) : (
            logs.map((log, index) => {
              const dateStr = new Date(log.timestamp).toLocaleTimeString();
              const isRx = log.dir === 'RX';
              const isTx = log.dir === 'TX';
              const isError = log.dir === 'ERROR';
              const isLog = log.dir === 'LOG';

              let color = 'var(--text-muted)';
              let bg = 'transparent';
              let dirText = 'SYS';

              if (isRx) {
                color = 'var(--color-success)';
                bg = 'rgba(57, 255, 20, 0.03)';
                dirText = '◀ 收 (RX)';
              } else if (isTx) {
                color = 'var(--color-primary)';
                bg = 'rgba(0, 229, 255, 0.03)';
                dirText = '▶ 发 (TX)';
              } else if (isError) {
                color = 'var(--color-danger)';
                bg = 'rgba(255, 56, 96, 0.05)';
                dirText = '⚠ 错误';
              } else if (isLog) {
                color = 'var(--color-warning)';
                dirText = 'ℹ 日志';
              }

              return (
                <div key={index} style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: bg,
                  border: isError ? '1px dashed rgba(255,56,96,0.3)' : '1px solid transparent',
                  marginBottom: '8px',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '700', color: color }}>{dirText}</span>
                    <span>{dateStr} - {log.desc}</span>
                  </div>
                  
                  {(isRx || isTx) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginTop: '6px' }}>
                      <div style={{ color: color, wordBreak: 'break-all', fontWeight: '500' }}>
                        {log.hex}
                      </div>
                      <div style={{ color: 'var(--text-muted)', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '12px', fontStyle: 'italic', wordBreak: 'break-all' }}>
                        {log.ascii}
                      </div>
                    </div>
                  )}

                  {(isLog || isError) && (
                    <div style={{ color: color }}>
                      {log.desc}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>

      </div>

      {/* Rules Config Modal */}
      {showRulesModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ width: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '24px', border: '1px solid var(--border-glow)' }}>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>自动应答规则编辑器</span>
              <button onClick={addRule} className="tab-btn" style={{ background: 'var(--color-primary)', color: '#000', fontSize: '12px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> 添加规则
              </button>
            </h3>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', pr: '8px' }}>
              {rules.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>无任何规则，请点击右上角添加。</div>
              ) : (
                rules.map((rule, idx) => (
                  <div key={rule.id} style={{
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '25px 1fr 1fr 100px 80px 40px', gap: '8px', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{idx + 1}</span>
                    
                    {/* Match Column */}
                    <div>
                      <input 
                        type="text" 
                        placeholder="匹配的文本或Hex..." 
                        value={rule.match}
                        onChange={(e) => updateRule(rule.id, 'match', e.target.value)}
                        style={{ width: '100%', padding: '6px', fontSize: '12px', background: '#000', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={rule.isHex} onChange={(e) => updateRule(rule.id, 'isHex', e.target.checked)} /> Match Hex
                        </label>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={rule.isRegex} onChange={(e) => updateRule(rule.id, 'isRegex', e.target.checked)} disabled={rule.isHex} /> 正则匹配
                        </label>
                      </div>
                    </div>

                    {/* Reply Column */}
                    <div>
                      <input 
                        type="text" 
                        placeholder="自动回复文本或Hex..." 
                        value={rule.reply}
                        onChange={(e) => updateRule(rule.id, 'reply', e.target.value)}
                        style={{ width: '100%', padding: '6px', fontSize: '12px', background: '#000', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }}
                      />
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rule.replyHex} onChange={(e) => updateRule(rule.id, 'replyHex', e.target.checked)} /> Reply Hex
                      </label>
                    </div>

                    {/* Delay */}
                    <div>
                      <input 
                        type="number" 
                        placeholder="延时" 
                        value={rule.delay}
                        onChange={(e) => updateRule(rule.id, 'delay', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', fontSize: '12px', background: '#000', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', textAlign: 'center' }}
                      />
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>延时 (ms)</div>
                    </div>

                    {/* Active */}
                    <div style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={rule.active} 
                        onChange={(e) => updateRule(rule.id, 'active', e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: '10px', color: rule.active ? 'var(--color-success)' : 'var(--text-muted)', marginTop: '4px' }}>
                        {rule.active ? '启用' : '禁用'}
                      </div>
                    </div>

                    {/* Delete */}
                    <button 
                      onClick={() => removeRule(rule.id)}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', justifyContent: 'center'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                onClick={() => {
                  setShowRulesModal(false);
                }} 
                className="tab-btn" 
                style={{
                  background: 'var(--color-primary)', color: '#000', fontWeight: 'bold', border: 'none', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <CheckCircle2 size={14} /> 保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
