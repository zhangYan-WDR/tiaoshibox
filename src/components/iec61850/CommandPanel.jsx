import React, { useState, useEffect } from 'react';
import { Terminal, Send, ShieldAlert, CheckSquare, RefreshCw, Zap } from 'lucide-react';

export default function CommandPanel({
  activeTab,
  mmsClientStatus,
  onMmsRead,
  onMmsWrite,
  onAddMonitoredVar,
  
  // GOOSE Trip Action
  goosePubRunning,
  onTriggerGooseTrip
}) {
  // MMS Command state
  const [manualPath, setManualPath] = useState('MYSCL/MMXU1$MX$A$phsA$cVal$mag$f');
  const [writeVal, setWriteVal] = useState('220.0');
  const [writeType, setWriteType] = useState('float');
  const [mmsCmdResult, setMmsCmdResult] = useState('');

  // Select-Before-Operate states
  const [sboSelected, setSboSelected] = useState(false);
  const [sboTarget, setSboTarget] = useState('MYSCL/CSWI1$CO$Pos$Oper$ctlVal');
  const [sboAction, setSboAction] = useState(true); // true = Close, false = Open
  const [sboLog, setSboLog] = useState([]);

  // GOOSE Trip visualizer
  const [retransmitFrames, setRetransmitFrames] = useState([]);
  const [tripState, setTripState] = useState(false);

  const addSboLog = (msg) => {
    setSboLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleManualRead = async () => {
    if (!manualPath) return;
    setMmsCmdResult('正在读取...');
    try {
      const res = await onMmsRead(manualPath);
      setMmsCmdResult(`读取成功: ${res.value} (${res.type})`);
      onAddMonitoredVar(manualPath, res.type, res.value);
    } catch (err) {
      setMmsCmdResult(`读取失败: ${err.message}`);
    }
  };

  const handleManualWrite = async () => {
    if (!manualPath) return;
    setMmsCmdResult('正在下发...');
    try {
      await onMmsWrite(manualPath, writeType, writeVal);
      setMmsCmdResult(`写入成功!`);
    } catch (err) {
      setMmsCmdResult(`写入失败: ${err.message}`);
    }
  };

  const handleSboSelect = () => {
    addSboLog(`[第一阶段] 正在向 ${sboTarget} 发送【选择 (Select)】指令...`);
    // Simulated Select phase delay
    setTimeout(() => {
      setSboSelected(true);
      addSboLog(`选择成功! 状态字锁锁定，目标地址处于预备合闸就绪状态。`);
    }, 600);
  };

  const handleSboOperate = async () => {
    addSboLog(`[第二阶段] 正在下发【执行 (Operate)】指令: ${sboAction ? '合闸 (Close)' : '分闸 (Open)'}`);
    try {
      await onMmsWrite(sboTarget, 'boolean', sboAction);
      addSboLog(`执行成功! 开关已变位。`);
      setSboSelected(false);
    } catch (err) {
      addSboLog(`执行失败: ${err.message}`);
    }
  };

  const triggerGooseTripEvent = () => {
    if (!goosePubRunning) return;
    const newState = !tripState;
    setTripState(newState);
    onTriggerGooseTrip({ Trip: newState });

    // Generate visual waves for GOOSE retransmissions (pulse intervals)
    const newFrames = [];
    let cumulativeDelay = 0;
    // Simulate retransmission interval visualizers (2ms, 4ms, 8ms, 16ms, 32ms...)
    const intervals = [2, 4, 8, 16, 32, 64, 128];
    intervals.forEach((ms, idx) => {
      cumulativeDelay += ms;
      newFrames.push({
        id: idx,
        interval: ms,
        delay: cumulativeDelay,
        sent: false
      });
    });
    setRetransmitFrames(newFrames);
  };

  // Animate the GOOSE waves appearing
  useEffect(() => {
    if (retransmitFrames.length === 0) return;
    const timers = retransmitFrames.map(frame => {
      return setTimeout(() => {
        setRetransmitFrames(prev => prev.map(f => f.id === frame.id ? { ...f, sent: true } : f));
      }, frame.delay * 2); // Slowed down slightly for human visibility
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [retransmitFrames]);

  return (
    <div className="pane" style={{ width: '400px', height: '100%' }}>
      <div className="pane-header">
        <h3>
          <Terminal size={16} color="var(--color-accent)" />
          控制与操作命令台
        </h3>
      </div>
      <div className="pane-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* MMS Client Controls */}
        {activeTab === 'mms-client' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            
            {/* Quick Read/Write console */}
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>快捷读取/写入控制</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="变量标识路径"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                />
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="input-field"
                    style={{ flex: 1 }}
                    placeholder="写入数值"
                    value={writeVal}
                    onChange={(e) => setWriteVal(e.target.value)}
                  />
                  <select
                    className="input-field"
                    value={writeType}
                    onChange={(e) => setWriteType(e.target.value)}
                  >
                    <option value="float">Float</option>
                    <option value="integer">Integer</option>
                    <option value="boolean">Boolean</option>
                    <option value="string">String</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleManualRead} disabled={mmsClientStatus !== 'CONNECTED'}>
                    <Send size={12} /> 读取变量
                  </button>
                  <button className="btn" style={{ flex: 1 }} onClick={handleManualWrite} disabled={mmsClientStatus !== 'CONNECTED'}>
                    <Zap size={12} /> 写入变量
                  </button>
                </div>

                {mmsCmdResult && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {mmsCmdResult}
                  </div>
                )}
              </div>
            </div>

            {/* Select Before Operate (SBO) Simulator */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckSquare size={14} color="var(--color-info)" />
                双阶段控制操作 (Select-Before-Operate)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                
                <div className="form-group">
                  <label>操作对象</label>
                  <select className="input-field" value={sboTarget} onChange={(e) => setSboTarget(e.target.value)}>
                    <option value="MYSCL/CSWI1$CO$Pos$Oper$ctlVal">MYSCL/CSWI1 (断路器开关位置)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>期望动作</label>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" checked={sboAction === true} onChange={() => setSboAction(true)} />
                      合闸 (Close)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" checked={sboAction === false} onChange={() => setSboAction(false)} />
                      分闸 (Open)
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, border: sboSelected ? '1px solid var(--color-success)' : '1px solid var(--border-color)' }}
                    onClick={handleSboSelect}
                    disabled={mmsClientStatus !== 'CONNECTED'}
                  >
                    1. 选择 (Select)
                  </button>
                  <button
                    className="btn btn-success"
                    style={{ flex: 1 }}
                    onClick={handleSboOperate}
                    disabled={!sboSelected || mmsClientStatus !== 'CONNECTED'}
                  >
                    2. 执行 (Operate)
                  </button>
                </div>

                {/* SBO Log Console */}
                <div style={{ flex: 1, background: '#070a12', borderRadius: '4px', padding: '8px', fontSize: '11px', fontFamily: 'monospace', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-secondary)' }}>
                  {sboLog.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>等待操作流程启动...</span>
                  ) : (
                    sboLog.map((log, i) => <div key={i} style={{ marginBottom: '4px' }}>{log}</div>)
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* MMS Server Info */}
        {activeTab === 'mms-server' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>模拟器使用指南</div>
              <p style={{ marginBottom: '8px', lineHeight: '1.4' }}>
                本模拟器实现了一个符合 IEC 61850 标准的 MMS 服务端，默认数据库包含开关位置、三相电流电压等节点。
              </p>
              <p style={{ lineHeight: '1.4' }}>
                当主站建立 MMS 连接并写入 <b>Pos$ctlVal</b> 动作时，模拟器会触发变位逻辑，自动更改 <b>Pos$stVal</b> 数值，并在 800ms 后向所有连接的主站发送<b>主动上报报文 (InformationReport)</b>，完美模拟真实电力开关的双向链路交互！
              </p>
            </div>
          </div>
        )}

        {/* GOOSE Publisher Controls */}
        {activeTab === 'goose-pub' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                模拟继电器保护装置跳闸指令触发出口，观察多播序列的发布节奏。
              </div>

              {/* Big Trip Button */}
              <button
                className={`goose-active-pulse ${tripState ? 'btn-danger' : 'btn'}`}
                style={{
                  height: '100px',
                  borderRadius: '50px',
                  fontSize: '18px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: tripState ? '0 0 24px var(--color-danger)' : '0 0 16px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.3s ease'
                }}
                onClick={triggerGooseTripEvent}
                disabled={!goosePubRunning}
              >
                <ShieldAlert size={32} />
                {tripState ? 'RESET TRIP (复位解锁)' : 'TRIGGER TRIP (保护跳闸)'}
              </button>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {!goosePubRunning ? '⚠️ 请先启动 GOOSE 发布端' : '已准备就绪，点击上方按钮触发变位'}
              </div>
            </div>

            {/* GOOSE fast retransmit visualization */}
            {retransmitFrames.length > 0 && (
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>GOOSE 快速连发波形图 (变位重传频率)</div>
                <div style={{ display: 'flex', alignItems: 'center', height: '50px', gap: '4px', background: '#0b0f19', padding: '0 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {retransmitFrames.map((frame) => (
                    <div
                      key={frame.id}
                      style={{
                        height: '30px',
                        width: '8px',
                        borderRadius: '2px',
                        background: frame.sent ? 'var(--color-danger)' : 'var(--text-muted)',
                        opacity: frame.sent ? 1 : 0.2,
                        transition: 'all 0.1s ease',
                        boxShadow: frame.sent ? '0 0 8px var(--color-danger)' : 'none'
                      }}
                      title={`Frame #${frame.id} sent at ${frame.interval}ms`}
                    />
                  ))}
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
                    心跳衰减 (t = 2ms → 4ms → 8ms → 16ms...)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GOOSE Subscriber Info */}
        {activeTab === 'goose-sub' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>GOOSE 订阅诊断说明</div>
              <p style={{ marginBottom: '8px', lineHeight: '1.4' }}>
                GOOSE 协议不使用 TCP 二次握手，因此订阅端需要持续监听多播信道。
              </p>
              <p style={{ lineHeight: '1.4' }}>
                诊断引擎会自动对接收包的 <b>stNum (状态号)</b> 与 <b>sqNum (序列号)</b> 进行追踪。若发生跳号将警报检测到丢包，若在生存周期 <b>TimeAllowedToLive</b> 内未收到任何续期报文将触发失联预警！
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
