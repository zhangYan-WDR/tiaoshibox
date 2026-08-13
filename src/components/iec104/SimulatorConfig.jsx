import React, { useState, useEffect, useRef } from 'react';
import { Server, Play, Square, Terminal, Sliders, ToggleLeft, ToggleRight } from 'lucide-react';

export default function SimulatorConfig({ 
  simRunning, 
  simLogs, 
  onStartSim, 
  onStopSim 
}) {
  const [port, setPort] = useState('2404');
  const [commonAddress, setCommonAddress] = useState('1');
  const logEndRef = useRef(null);

  // 自动滚动到模拟器日志底部
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simLogs]);

  const handleToggleSimulator = () => {
    if (simRunning) {
      onStopSim();
    } else {
      onStartSim({
        port: parseInt(port) || 2404,
        commonAddress: parseInt(commonAddress) || 1
      });
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>
      
      {/* 左侧：配置及测点模拟控制 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={15} color="var(--color-success)" />
          内置从站配置中心 (IEC104 Server)
        </h3>

        {/* 端口与公共地址 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="label-text">模拟监听端口</label>
            <input 
              type="number" 
              className="input-field" 
              value={port}
              onChange={e => setPort(e.target.value)}
              disabled={simRunning}
            />
          </div>
          <div>
            <label className="label-text">ASDU 公共地址</label>
            <input 
              type="number" 
              className="input-field" 
              value={commonAddress}
              onChange={e => setCommonAddress(e.target.value)}
              disabled={simRunning}
            />
          </div>
        </div>

        {/* 启动与停止按钮 */}
        <button 
          onClick={handleToggleSimulator}
          className={`btn ${simRunning ? 'btn-danger' : 'btn-success'}`}
          style={{ width: '100%', padding: '10px 16px', gap: '8px', fontWeight: '600' }}
        >
          {simRunning ? (
            <>
              <Square size={14} />
              停止模拟从站服务
            </>
          ) : (
            <>
              <Play size={14} />
              启动从站模拟器
            </>
          )}
        </button>

        {/* 模拟器数据点看板（静态展示，帮助用户理解） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={12} color="var(--color-primary)" />
            预置模拟寄存器列表
          </h4>
          
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            background: 'rgba(0,0,0,0.15)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '6px',
            padding: '8px 12px'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '80px 1fr 1fr', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
              <span>地址 (IOA)</span>
              <span>描述</span>
              <span>数据类型 / 初始值</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {/* 遥信 */}
              <div className="sim-reg-row">
                <span className="mono-val text-primary">10001</span>
                <span>主开关状态 (YX)</span>
                <span className="text-success">Type 30 / 合闸(1)</span>
              </div>
              <div className="sim-reg-row">
                <span className="mono-val text-primary">10002</span>
                <span>一号风机运行 (YX)</span>
                <span className="text-muted">Type 30 / 分闸(0)</span>
              </div>
              <div className="sim-reg-row">
                <span className="mono-val text-primary">10003</span>
                <span>主控室急停 (YX)</span>
                <span className="text-muted">Type 30 / 正常(0)</span>
              </div>
              <div className="sim-reg-row">
                <span className="mono-val text-primary">10004</span>
                <span>变压器超温 (YX)</span>
                <span className="text-muted">Type 30 / 正常(0)</span>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />

              {/* 遥测 */}
              <div className="sim-reg-row">
                <span className="mono-val text-primary">16385</span>
                <span>A相电压 (YC)</span>
                <span className="text-light">Type 38 / 220.5 V</span>
              </div>
              <div className="sim-reg-row">
                <span className="mono-val text-primary">16386</span>
                <span>B相电压 (YC)</span>
                <span className="text-light">Type 38 / 221.1 V</span>
              </div>
              <div className="sim-reg-row">
                <span className="mono-val text-primary">16388</span>
                <span>A相电流 (YC)</span>
                <span className="text-light">Type 38 / 45.2 A</span>
              </div>
              <div className="sim-reg-row">
                <span className="mono-val text-primary">16389</span>
                <span>系统频率 (YC)</span>
                <span className="text-light">Type 38 / 50.02 Hz</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 右侧：模拟器调试日志 */}
      <div className="glass-card" style={{ flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={15} color="var(--text-muted)" />
          模拟器运行日志 (Server Monitor)
        </h3>

        <div style={{
          flex: 1,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          lineHeight: '1.6',
          overflowY: 'auto'
        }}>
          {simLogs.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
              <span>服务未启动</span>
              <span style={{ fontSize: '10px' }}>启动从站模拟器后，通信事件与遥控请求会在此滚动</span>
            </div>
          ) : (
            <div>
              {simLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.01)', paddingBottom: '2px' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color: log.message.includes('ERROR') || log.message.includes('错误') ? 'var(--color-danger)' : 'var(--text-light)' }}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .sim-reg-row {
          display: grid;
          grid-template-columns: 80px 1.2fr 1fr;
          align-items: center;
        }
        .text-primary {
          color: var(--color-primary);
        }
        .text-success {
          color: var(--color-success);
        }
        .text-light {
          color: var(--text-light);
        }
        .text-muted {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
