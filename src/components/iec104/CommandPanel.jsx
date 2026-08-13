import React, { useState, useEffect } from 'react';
import { Send, Shield, Zap, Terminal, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function CommandPanel({ 
  activeConn, 
  controlLogs, 
  onSendYK, 
  onSendYT, 
  onClearLogs 
}) {
  const [cmdCategory, setCmdCategory] = useState('YK'); // YK=遥控, YT=遥调
  const [ioa, setIoa] = useState('10001');
  const [commonAddress, setCommonAddress] = useState('1');
  
  // YK 状态
  const [ykType, setYkType] = useState('45'); // 45=单, 46=双
  const [ykVal, setYkVal] = useState('1'); // 单:0=分,1=合; 双:1=分,2=合
  
  // YT 状态
  const [ytType, setYtType] = useState('50'); // 48=归一化, 50=短浮点
  const [ytVal, setYtVal] = useState('220.0');

  // 获取当前通道的控制日志
  const connLogs = controlLogs[activeConn?.id] || [];

  // 当连接切换时，自动同步该通道创建时填写的公共地址
  useEffect(() => {
    if (activeConn) {
      setCommonAddress(activeConn.commonAddress?.toString() || '1');
    }
  }, [activeConn]);

  // 当类别更改时，初始化默认 IOA
  useEffect(() => {
    if (cmdCategory === 'YK') {
      setIoa('10001');
    } else {
      setIoa('16385');
    }
  }, [cmdCategory]);

  const handleYkClick = async (step) => {
    if (!activeConn || activeConn.status !== 'CONNECTED') {
      alert('通道未连接，无法发送命令');
      return;
    }
    const ioaNum = parseInt(ioa);
    const typeNum = parseInt(ykType);
    const valNum = parseInt(ykVal);
    const caNum = parseInt(commonAddress) || 1;
    
    if (isNaN(ioaNum)) return;
    await onSendYK(ioaNum, typeNum, valNum, step, caNum);
  };

  const handleYtClick = async (step) => {
    if (!activeConn || activeConn.status !== 'CONNECTED') {
      alert('通道未连接，无法发送命令');
      return;
    }
    const ioaNum = parseInt(ioa);
    const typeNum = parseInt(ytType);
    const valNum = parseFloat(ytVal);
    const caNum = parseInt(commonAddress) || 1;
    
    if (isNaN(ioaNum) || isNaN(valNum)) return;
    await onSendYT(ioaNum, typeNum, valNum, step, caNum);
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>
      
      {/* 左侧：命令配置舱 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={16} color="var(--color-primary)" />
          控制命令下发配置 (Command Console)
        </h3>

        {/* 遥控 / 遥调 切换 */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setCmdCategory('YK')}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              background: cmdCategory === 'YK' ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
              color: cmdCategory === 'YK' ? 'var(--color-primary)' : 'var(--text-muted)',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            遥控命令 (YK)
          </button>
          <button
            onClick={() => setCmdCategory('YT')}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              background: cmdCategory === 'YT' ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
              color: cmdCategory === 'YT' ? 'var(--color-primary)' : 'var(--text-muted)',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            遥调命令 (YT)
          </button>
        </div>

        {/* 配置表单 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label className="label-text">信息对象地址 (IOA)</label>
              <input
                type="number"
                className="input-field"
                value={ioa}
                onChange={e => setIoa(e.target.value)}
                placeholder={cmdCategory === 'YK' ? '10001' : '16385'}
              />
            </div>
            <div>
              <label className="label-text">公共地址 (ASDU Addr)</label>
              <input
                type="number"
                className="input-field"
                value={commonAddress}
                onChange={e => setCommonAddress(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-8px' }}>
            {cmdCategory === 'YK' ? '遥控地址通常位于 10001 - 15000' : '遥调地址通常位于 16385 以上'}
          </div>

          {cmdCategory === 'YK' ? (
            // ================= 遥控表单 =================
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label-text">命令规约类型</label>
                  <select
                    className="input-field"
                    value={ykType}
                    onChange={e => {
                      setYkType(e.target.value);
                      setYkVal(e.target.value === '45' ? '1' : '2'); // 重置默认动作为合
                    }}
                  >
                    <option value="45">单命令遥控 (Type 45)</option>
                    <option value="46">双命令遥控 (Type 46)</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">下发状态值</label>
                  <select
                    className="input-field"
                    value={ykVal}
                    onChange={e => setYkVal(e.target.value)}
                  >
                    {ykType === '45' ? (
                      <>
                        <option value="0">分闸 (0 / OFF)</option>
                        <option value="1">合闸 (1 / ON)</option>
                      </>
                    ) : (
                      <>
                        <option value="1">分闸 (1 / OFF)</option>
                        <option value="2">合闸 (2 / ON)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* 三步控制操作区 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => handleYkClick('select')}
                    className="btn btn-secondary"
                    style={{ borderColor: 'var(--color-warning-glow)', color: 'var(--color-warning)', fontWeight: '600' }}
                    disabled={!activeConn || activeConn.status !== 'CONNECTED'}
                  >
                    1. 发送选择 (Select)
                  </button>
                  <button
                    onClick={() => handleYkClick('execute')}
                    className="btn btn-success"
                    style={{ fontWeight: '600' }}
                    disabled={!activeConn || activeConn.status !== 'CONNECTED'}
                  >
                    2. 发送执行 (Execute)
                  </button>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                  <button
                    onClick={() => handleYkClick('direct')}
                    className="btn btn-danger"
                    style={{ width: '100%', gap: '6px', fontWeight: '600' }}
                    disabled={!activeConn || activeConn.status !== 'CONNECTED'}
                  >
                    <Zap size={14} />
                    直接下发执行 (Direct Execute)
                  </button>
                </div>
              </div>
            </>
          ) : (
            // ================= 遥调表单 =================
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label-text">命令规约类型</label>
                  <select
                    className="input-field"
                    value={ytType}
                    onChange={e => setYtType(e.target.value)}
                  >
                    <option value="48">归一化设点 (Type 48)</option>
                    <option value="50">短浮点设点 (Type 50)</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">设点数值</label>
                  <input
                    type="text"
                    className="input-field"
                    value={ytVal}
                    onChange={e => setYtVal(e.target.value)}
                    placeholder="220.0"
                  />
                </div>
              </div>

              {/* 三步控制操作区 (遥调也可以支持选择执行，视站端设备而定) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => handleYtClick('select')}
                    className="btn btn-secondary"
                    style={{ borderColor: 'var(--color-warning-glow)', color: 'var(--color-warning)', fontWeight: '600' }}
                    disabled={!activeConn || activeConn.status !== 'CONNECTED'}
                  >
                    1. 发送选择 (Select)
                  </button>
                  <button
                    onClick={() => handleYtClick('execute')}
                    className="btn btn-success"
                    style={{ fontWeight: '600' }}
                    disabled={!activeConn || activeConn.status !== 'CONNECTED'}
                  >
                    2. 发送执行 (Execute)
                  </button>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                  <button
                    onClick={() => handleYtClick('direct')}
                    className="btn btn-primary"
                    style={{ width: '100%', gap: '6px', fontWeight: '600' }}
                    disabled={!activeConn || activeConn.status !== 'CONNECTED'}
                  >
                    <Zap size={14} color="#000" />
                    直接下发执行 (Direct Execute)
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 安全警告与说明 */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px',
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}>
            <AlertTriangle size={15} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>操作安全提示:</strong>
              <p style={{ marginTop: '4px', lineHeight: '1.4' }}>
                工商业设备通常启用“选择-执行”双步流程。先发送【选择】命令，在收到从站正确“激活确认”返校后，方可在有效期（如 15 秒）内下发【执行】。直接下发常用于简易网关。
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* 右侧：命令控制日志终端 */}
      <div className="glass-card" style={{ flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={15} color="var(--text-muted)" />
            控制操作与确立确认审计 (Control Audit Log)
          </h3>
          <button 
            className="clear-btn" 
            onClick={() => onClearLogs(activeConn?.id)}
            title="清空当前通道的控制日志"
            disabled={connLogs.length === 0}
          >
            <Trash2 size={13} />
            清空日志
          </button>
        </div>

        <div style={{
          flex: 1,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          lineHeight: '1.6',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {connLogs.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
              <span>暂无审计日志</span>
              <span style={{ fontSize: '10px' }}>下发选择、执行命令后，其返校确认与激活结束等事件会在此滚动记录</span>
            </div>
          ) : (
            connLogs.map((log, idx) => {
              let tagColor = 'var(--text-muted)';
              let tagText = '系统';
              if (log.direction === 'TX') {
                tagColor = 'var(--color-primary)';
                tagText = '下发';
              } else if (log.direction === 'RX') {
                tagColor = log.success ? 'var(--color-success)' : 'var(--color-danger)';
                tagText = log.success ? '返校' : '拒签';
              }

              return (
                <div key={idx} style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.02)', 
                  paddingBottom: '4px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  
                  <span style={{
                    color: tagColor,
                    background: `${tagColor}11`,
                    border: `1px solid ${tagColor}22`,
                    fontSize: '9.5px',
                    fontWeight: '600',
                    padding: '0px 4px',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap'
                  }}>
                    {tagText}
                  </span>

                  <span style={{ 
                    color: log.direction === 'TX' ? 'var(--text-light)' : (log.success ? '#fff' : 'var(--color-danger)'),
                    wordBreak: 'break-all'
                  }}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .clear-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 3px 8px;
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          transition: all 0.2s ease;
        }
        .clear-btn:hover:not(:disabled) {
          color: var(--color-danger);
          background: rgba(255, 56, 96, 0.05);
          border-color: rgba(255, 56, 96, 0.2);
        }
        .clear-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
