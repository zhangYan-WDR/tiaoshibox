import React, { useState, useEffect, useRef } from 'react';
import { Network, Play, RefreshCw, Activity, Terminal, ShieldAlert, Check, X } from 'lucide-react';

export default function NetworkTool() {
  const [host, setHost] = useState('127.0.0.1');
  
  // Ping States
  const [pinging, setPinging] = useState(false);
  const [pingLogs, setPingLogs] = useState([]);
  
  // Scan States
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ percent: 0, completed: 0, total: 0, currentPort: 0 });
  const [scanResults, setScanResults] = useState([]); // Array of { port, open }
  
  // Port Selection
  const [presetType, setPresetType] = useState('industrial'); // industrial, standard, custom
  const [customPorts, setCustomPorts] = useState('502, 2404, 102, 104, 61850');

  const pingEndRef = useRef(null);

  // Preset ports definition
  const PRESET_PORTS = {
    industrial: [102, 502, 104, 2404, 4840, 61850], // MMS, Modbus, IEC104, OPC UA, GOOSE
    standard: [21, 22, 23, 25, 80, 110, 143, 443, 1433, 3306, 3389, 8080]
  };

  useEffect(() => {
    // 1. Ping Log Listener
    const unsubPingLog = window.api.tools.onPingLog((data) => {
      if (data.host === host) {
        setPingLogs(prev => [...prev, data.text]);
      }
    });

    const unsubPingDone = window.api.tools.onPingDone((data) => {
      if (data.host === host) {
        setPinging(false);
        setPingLogs(prev => [...prev, `\n[系统] Ping 测试完成。退出码: ${data.code}`]);
      }
    });

    // 2. Scan Progress Listener
    const unsubScanProgress = window.api.tools.onScanProgress((data) => {
      if (data.host === host) {
        setScanProgress({
          percent: data.percent,
          completed: data.completed,
          total: data.total,
          currentPort: data.port
        });
        
        // Add to result list
        setScanResults(prev => {
          // Prevent duplicates
          const filtered = prev.filter(r => r.port !== data.port);
          return [...filtered, { port: data.port, open: data.open }].sort((a, b) => a.port - b.port);
        });
      }
    });

    const unsubScanDone = window.api.tools.onScanDone((data) => {
      if (data.host === host) {
        setScanning(false);
      }
    });

    return () => {
      unsubPingLog();
      unsubPingDone();
      unsubScanProgress();
      unsubScanDone();
    };
  }, [host]);

  // Scroll ping console
  useEffect(() => {
    if (pingEndRef.current) {
      pingEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pingLogs]);

  // Trigger Ping
  const handlePing = async () => {
    if (!host) return;
    setPinging(true);
    setPingLogs([`正在 Ping 主机 ${host}... (发送 4 个包)`]);
    await window.api.tools.ping(host);
  };

  // Resolve ports to scan
  const getPortsToScan = () => {
    if (presetType === 'industrial') return PRESET_PORTS.industrial;
    if (presetType === 'standard') return PRESET_PORTS.standard;
    
    // Parse custom list
    return customPorts
      .split(',')
      .map(p => parseInt(p.trim()))
      .filter(p => !isNaN(p) && p >= 1 && p <= 65535);
  };

  // Trigger Port Scan
  const handleScan = async () => {
    if (!host) return;
    const ports = getPortsToScan();
    if (ports.length === 0) {
      alert('请指定有效的自定义端口列表 (逗号分隔)');
      return;
    }

    setScanning(true);
    setScanResults([]);
    setScanProgress({ percent: 0, completed: 0, total: ports.length, currentPort: 0 });
    
    await window.api.tools.scanPorts(host, ports);
  };

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '16px', height: 'calc(100vh - 50px)', padding: '16px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* Top Input Bar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={20} color="var(--color-primary)" />
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>网络诊断靶场</span>
        </div>
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>目标主机 IP / 域名:</span>
          <input 
            type="text" 
            placeholder="例如: 127.0.0.1 或 192.168.1.100" 
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="input-field"
            style={{ maxWidth: '280px', padding: '6px 12px', fontSize: '13px' }}
            disabled={pinging || scanning}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handlePing}
            disabled={pinging || scanning || !host}
            className="tab-btn"
            style={{
              background: pinging ? 'rgba(255,255,255,0.03)' : 'var(--color-primary)',
              color: pinging ? 'var(--text-muted)' : '#000',
              fontWeight: '700',
              fontSize: '12px',
              padding: '6px 16px',
              cursor: (pinging || scanning) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {pinging ? <RefreshCw size={14} className="spin" /> : <Activity size={14} />}
            {pinging ? 'Ping 测试中...' : '启动 Ping 连通测试'}
          </button>
          
          <button 
            onClick={handleScan}
            disabled={pinging || scanning || !host}
            className="tab-btn"
            style={{
              background: scanning ? 'rgba(255,255,255,0.03)' : 'var(--color-warning)',
              color: scanning ? 'var(--text-muted)' : '#000',
              fontWeight: '700',
              fontSize: '12px',
              padding: '6px 16px',
              cursor: (pinging || scanning) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {scanning ? <RefreshCw size={14} className="spin" /> : <Play size={14} fill="#000" />}
            {scanning ? '端口扫描中...' : '启动端口扫描'}
          </button>
        </div>
      </div>

      {/* Grid: Left Console Log, Right Port scanning dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', overflow: 'hidden' }}>
        
        {/* Left Side: Ping Output */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
            <Terminal size={15} color="var(--color-primary)" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Ping 终端日志输出</span>
          </div>
          
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: '#04060a',
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-success)',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6'
          }}>
            {pingLogs.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyText: 'center', color: 'var(--text-muted)', justifyContent: 'center' }}>
                等待启动 Ping 测试，命令行返回信息将实时刷新在这里
              </div>
            ) : (
              pingLogs.map((log, i) => <div key={i}>{log}</div>)
            )}
            <div ref={pingEndRef} />
          </div>
        </div>

        {/* Right Side: Port Scanner */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Play size={14} fill="var(--color-warning)" color="var(--color-warning)" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>端口扫描管理器</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setPresetType('industrial')} 
                className="tab-btn" 
                style={{
                  fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border-color)',
                  background: presetType === 'industrial' ? 'var(--color-warning)' : 'rgba(255,255,255,0.02)',
                  color: presetType === 'industrial' ? '#000' : 'var(--text-muted)'
                }}
                disabled={scanning}
              >
                工控常用端口
              </button>
              <button 
                onClick={() => setPresetType('standard')} 
                className="tab-btn" 
                style={{
                  fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border-color)',
                  background: presetType === 'standard' ? 'var(--color-warning)' : 'rgba(255,255,255,0.02)',
                  color: presetType === 'standard' ? '#000' : 'var(--text-muted)'
                }}
                disabled={scanning}
              >
                基础网络端口
              </button>
              <button 
                onClick={() => setPresetType('custom')} 
                className="tab-btn" 
                style={{
                  fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border-color)',
                  background: presetType === 'custom' ? 'var(--color-warning)' : 'rgba(255,255,255,0.02)',
                  color: presetType === 'custom' ? '#000' : 'var(--text-muted)'
                }}
                disabled={scanning}
              >
                自定义...
              </button>
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
            
            {/* Custom Input */}
            {presetType === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>自定义扫描端口 (以英文逗号隔开)</label>
                <input 
                  type="text" 
                  value={customPorts} 
                  onChange={(e) => setCustomPorts(e.target.value)}
                  className="input-field"
                  placeholder="如: 80, 443, 502, 102, 2404"
                  disabled={scanning}
                  style={{ fontSize: '12px', padding: '6px' }}
                />
              </div>
            )}

            {/* Target Ports Info */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', background: 'rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '100%', marginBottom: '4px' }}>待扫描端口靶点:</span>
              {getPortsToScan().map(p => (
                <span key={p} style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-light)', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                  {p}
                </span>
              ))}
            </div>

            {/* Progress Area */}
            {(scanning || scanProgress.completed > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,229,255,0.02)', border: '1px solid var(--border-glow)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600' }}>
                  <span style={{ color: 'var(--color-primary)' }}>
                    {scanning ? `正在对端口 ${scanProgress.currentPort} 发送握手报文...` : '扫描诊断结束'}
                  </span>
                  <span>{scanProgress.percent}% ({scanProgress.completed}/{scanProgress.total})</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${scanProgress.percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-warning))', transition: 'width 0.1s ease' }} />
                </div>
              </div>
            )}

            {/* Scan Results grid */}
            <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>扫描诊断结果清单</span>
              
              {scanResults.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  暂无诊断数据，请在上方输入 IP 并开启端口扫描
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', overflowY: 'auto', maxHeight: '280px' }}>
                  {scanResults.map(res => (
                    <div 
                      key={res.port}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: res.open ? 'rgba(57, 255, 20, 0.05)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${res.open ? 'rgba(57, 255, 20, 0.2)' : 'var(--border-color)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontWeight: '500', color: '#fff' }}>Port {res.port}</span>
                      {res.open ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px' }}>
                          <Check size={10} strokeWidth={3} /> 通畅
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px' }}>
                          <X size={10} strokeWidth={3} /> 关闭
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
