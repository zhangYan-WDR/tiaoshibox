import React, { useState, useEffect, useRef } from 'react';
import { Server, Play, Square, Terminal, Sliders, Edit2 } from 'lucide-react';

export default function SimulatorConfig({ 
  simRunning, 
  simLogs, 
  simSnapshot, 
  simConnections,
  onStartSim, 
  onStopSim,
  onUpdateRegisterValue
}) {
  const [port, setPort] = useState('502');
  const [unitId, setUnitId] = useState('1');
  const logEndRef = useRef(null);

  const [activeRegTab, setActiveRegTab] = useState('holding'); // coils, discrete, input, holding
  const [editingAddr, setEditingAddr] = useState(null);
  const [editVal, setEditVal] = useState('');

  // 自动滚动到底部
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
        port: parseInt(port) || 5020,
        unitId: parseInt(unitId) !== undefined ? parseInt(unitId) : 1
      });
    }
  };

  const getActiveArray = () => {
    if (!simSnapshot) return [];
    switch (activeRegTab) {
      case 'coils': return simSnapshot.coils || [];
      case 'discrete': return simSnapshot.discreteInputs || [];
      case 'input': return simSnapshot.inputRegisters || [];
      case 'holding':
      default:
        return simSnapshot.holdingRegisters || [];
    }
  };

  const getRegTypeName = () => {
    switch (activeRegTab) {
      case 'coils': return '线圈 (0xxxx)';
      case 'discrete': return '离散输入 (1xxxx)';
      case 'input': return '输入寄存器 (3xxxx)';
      case 'holding':
      default:
        return '保持寄存器 (4xxxx)';
    }
  };

  const handleStartEdit = (index, val) => {
    setEditingAddr(index);
    setEditVal(val.toString());
  };

  const handleSaveEdit = async (index) => {
    const isBit = activeRegTab === 'coils' || activeRegTab === 'discrete';
    const parsedVal = isBit ? (parseInt(editVal) === 1 ? 1 : 0) : parseInt(editVal);
    
    if (isNaN(parsedVal)) {
      alert('请输入合法的数值');
      return;
    }

    const typeMap = {
      coils: 'coils',
      discrete: 'discreteInputs',
      input: 'inputRegisters',
      holding: 'holdingRegisters'
    };

    const res = await onUpdateRegisterValue({
      type: typeMap[activeRegTab],
      address: index,
      value: parsedVal
    });

    if (res && res.success) {
      setEditingAddr(null);
    } else {
      alert('保存修改失败！');
    }
  };

  const activeRegData = getActiveArray();

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>
      
      {/* 左侧：配置及测点模拟控制 */}
      <div className="glass-card" style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={15} color="var(--color-success)" />
          内置从站模拟中心 (Modbus TCP Server)
        </h3>

        {/* 端口与从站 ID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="label-text">监听端口</label>
            <input 
              type="number" 
              className="input-field" 
              value={port}
              onChange={e => setPort(e.target.value)}
              disabled={simRunning}
            />
          </div>
          <div>
            <label className="label-text">从站号 (Unit ID)</label>
            <input 
              type="number" 
              className="input-field" 
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
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

        {/* 模拟器数据点控制区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          
          {/* 子标签选择寄存器类型 */}
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            {['holding', 'input', 'coils', 'discrete'].map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveRegTab(tab);
                  setEditingAddr(null);
                }}
                style={{
                  background: activeRegTab === tab ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                  border: 'none',
                  color: activeRegTab === tab ? 'var(--color-primary)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {tab === 'coils' && 'Coils'}
                {tab === 'discrete' && 'Discrete'}
                {tab === 'input' && 'Input Regs'}
                {tab === 'holding' && 'Holding Regs'}
              </button>
            ))}
          </div>
          
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            background: 'rgba(0,0,0,0.15)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '6px',
            padding: '8px 12px'
          }}>
            {!simRunning ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                请先启动从站模拟器以查看/编辑寄存器
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '80px 1.5fr 1fr', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
                  <span>偏移地址</span>
                  <span>模拟数据值</span>
                  <span style={{ textAlign: 'right' }}>操作</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  {activeRegData.map((val, idx) => {
                    const isEditing = editingAddr === idx;
                    const isBit = activeRegTab === 'coils' || activeRegTab === 'discrete';

                    return (
                      <div key={idx} className="sim-reg-row" style={{ display: 'grid', gridTemplateColumns: '80px 1.5fr 1fr', alignItems: 'center', height: '28px' }}>
                        <span className="mono-val text-primary">{idx}</span>
                        {isEditing ? (
                          isBit ? (
                            <select 
                              className="input-field" 
                              value={editVal} 
                              onChange={e => setEditVal(e.target.value)}
                              style={{ width: '80px', padding: '2px 4px', fontSize: '11px', background: '#000', color: '#fff' }}
                            >
                              <option value="1">ON (1)</option>
                              <option value="0">OFF (0)</option>
                            </select>
                          ) : (
                            <input 
                              type="number" 
                              className="input-field" 
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              style={{ width: '100px', padding: '2px 4px', fontSize: '11px' }}
                            />
                          )
                        ) : (
                          <span className="mono-val text-light">
                            {isBit ? (val === 1 ? 'ON (1)' : 'OFF (0)') : val}
                          </span>
                        )}

                        <div style={{ textAlign: 'right' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button onClick={() => setEditingAddr(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}>取消</button>
                              <button onClick={() => handleSaveEdit(idx)} style={{ background: 'var(--color-primary)', border: 'none', color: '#000', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>保存</button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleStartEdit(idx, val)} 
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              className="edit-icon-btn"
                              title="手动修改寄存器数值"
                            >
                              <Edit2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 右侧：模拟器日志监视区 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={15} color="var(--text-muted)" />
          从站日志总控 (Server Monitor)
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
              <span>从站服务未启动</span>
              <span style={{ fontSize: '10px' }}>启动从站模拟器后，收到的主站查询/控制请求会在此滚动展示</span>
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
        .edit-icon-btn:hover {
          color: var(--color-primary) !important;
        }
      `}</style>
    </div>
  );
}
