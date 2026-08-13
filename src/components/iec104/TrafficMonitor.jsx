import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Trash2, Search, Copy, Terminal, ChevronRight, Eye } from 'lucide-react';

export default function TrafficMonitor({ logs, activeConn }) {
  const [isPaused, setIsPaused] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // ALL, I, S, U, LOG
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  
  const bottomRef = useRef(null);

  const connLogs = logs[activeConn?.id] || [];

  // 过滤日志
  const filteredLogs = connLogs.filter(log => {
    // 1. 类型过滤
    if (filterType !== 'ALL' && log.type !== filterType) {
      return false;
    }
    // 2. 搜索框过滤
    if (searchQuery) {
      const q = searchQuery.toUpperCase();
      const matchHex = (log.hex || '').toUpperCase().includes(q);
      const matchDesc = (log.desc || '').toUpperCase().includes(q);
      return matchHex || matchDesc;
    }
    return true;
  });

  // 自动滚动到底部
  useEffect(() => {
    if (!isPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, isPaused]);

  // 复制 hex 报文
  const copyHex = (hex) => {
    navigator.clipboard.writeText(hex);
    alert('十六进制报文已复制到剪贴板！');
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>
      
      {/* 左侧：报文滚动列表 */}
      <div className="glass-card" style={{ flex: 1.5, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 16px 10px 16px' }}>
        
        {/* 控制条 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className={`filter-btn ${filterType === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterType('ALL')}
            >
              全部
            </button>
            <button 
              className={`filter-btn ${filterType === 'I' ? 'active' : ''}`}
              onClick={() => setFilterType('I')}
            >
              I 帧
            </button>
            <button 
              className={`filter-btn ${filterType === 'S' ? 'active' : ''}`}
              onClick={() => setFilterType('S')}
            >
              S 帧
            </button>
            <button 
              className={`filter-btn ${filterType === 'U' ? 'active' : ''}`}
              onClick={() => setFilterType('U')}
            >
              U 帧
            </button>
            <button 
              className={`filter-btn ${filterType === 'LOG' ? 'active' : ''}`}
              onClick={() => setFilterType('LOG')}
            >
              系统日志
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '160px' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="搜索报文/描述..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '28px', paddingRight: '8px', height: '30px', fontSize: '12px' }}
              />
              <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '9px' }} />
            </div>

            <button 
              className="ctrl-btn" 
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? '恢复滚动' : '暂停滚动'}
            >
              {isPaused ? <Play size={13} color="var(--color-success)" /> : <Pause size={13} />}
            </button>
          </div>
        </div>

        {/* 日志视窗 */}
        <div style={{
          flex: 1,
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          overflowY: 'auto',
          padding: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
              <Terminal size={24} style={{ opacity: 0.2 }} />
              <span>暂无报文，开启连接后在此监听数据流</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredLogs.map((log, index) => {
                const isSelected = selectedLog === log;
                
                // 判断方向颜色
                let dirColor = 'var(--text-muted)';
                let dirBg = 'rgba(255,255,255,0.05)';
                let label = log.dir;
                
                if (log.dir === 'TX') {
                  dirColor = 'var(--color-primary)';
                  dirBg = 'rgba(0, 229, 255, 0.08)';
                  label = '发送';
                } else if (log.dir === 'RX') {
                  dirColor = 'var(--color-success)';
                  dirBg = 'rgba(57, 255, 20, 0.08)';
                  label = '接收';
                } else if (log.dir === 'LOG') {
                  dirColor = 'var(--color-warning)';
                  dirBg = 'rgba(255, 179, 0, 0.05)';
                  label = '系统';
                }

                return (
                  <div 
                    key={index} 
                    onClick={() => {
                      if (log.type !== 'LOG') setSelectedLog(log);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: isSelected ? 'rgba(0, 229, 255, 0.06)' : 'transparent',
                      border: isSelected ? '1px solid var(--color-primary-glow)' : '1px solid transparent',
                      cursor: log.type !== 'LOG' ? 'pointer' : 'default',
                      transition: 'all 0.15s ease'
                    }}
                    className="log-row"
                  >
                    {/* 时间 */}
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap', width: '75px', paddingTop: '2px' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>

                    {/* 方向标签 */}
                    <span style={{
                      color: dirColor,
                      background: dirBg,
                      border: `1px solid ${dirColor}22`,
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                      display: 'inline-block'
                    }}>
                      {label}
                    </span>

                    {/* 解析摘要 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <span style={{ 
                        color: log.dir === 'LOG' ? 'var(--color-warning)' : 'var(--text-main)', 
                        fontWeight: '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {log.desc}
                      </span>
                      {log.hex && (
                        <span style={{ 
                          color: 'var(--text-muted)', 
                          fontSize: '11px', 
                          letterSpacing: '0.3px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {log.hex}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* 右侧：报文树状协议解析视图 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={15} color="var(--color-primary)" />
          协议分析仪 (Wireshark 视窗)
        </h3>

        {!selectedLog ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Terminal size={24} style={{ opacity: 0.2 }} />
            <span>在左侧选中一帧 I/S/U 报文</span>
            <span>查看电力规约树状译码</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* 原始 Hex 及拷贝 */}
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>十六进制数据流:</span>
                <button 
                  className="ctrl-btn" 
                  onClick={() => copyHex(selectedLog.hex)}
                  title="拷贝十六进制"
                  style={{ width: '22px', height: '22px' }}
                >
                  <Copy size={11} />
                </button>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-primary)', wordBreak: 'break-all', letterSpacing: '0.5px' }}>
                {selectedLog.hex}
              </div>
            </div>

            {/* 树状翻译 */}
            <div className="protocol-tree" style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              
              {/* APCI 层 */}
              <div className="tree-node">
                <div className="node-title">
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <strong>链路层控制段 (APCI)</strong>
                </div>
                <div className="node-body">
                  <div className="tree-row">起始字符 (Start Byte): <span>0x68</span></div>
                  <div className="tree-row">APDU 数据段长度: <span>{selectedLog.hex.split(' ').length - 2} 字节</span></div>
                  <div className="tree-row">帧控制类型 (APCI Type): <span>{selectedLog.type} 帧</span></div>
                  {selectedLog.parsed.ns !== undefined && (
                    <div className="tree-row">发送序列号 N(S): <span>{selectedLog.parsed.ns}</span></div>
                  )}
                  {selectedLog.parsed.nr !== undefined && (
                    <div className="tree-row">接收序列号 N(R): <span>{selectedLog.parsed.nr}</span></div>
                  )}
                  {selectedLog.parsed.uType && (
                    <div className="tree-row">U帧控制指令 (U-Command): <span>{selectedLog.parsed.uType}</span></div>
                  )}
                </div>
              </div>

              {/* ASDU 层 */}
              {selectedLog.parsed.asdu && (
                <div className="tree-node">
                  <div className="node-title">
                    <ChevronRight size={14} color="var(--text-muted)" />
                    <strong>应用层协议数据单元 (ASDU)</strong>
                  </div>
                  <div className="node-body">
                    <div className="tree-row">类型标识 (Type ID): <span style={{ color: 'var(--color-primary)' }}>{selectedLog.parsed.asdu.typeId} ({selectedLog.parsed.asdu.typeName})</span></div>
                    <div className="tree-row">可变结构限定词 (VSQ): <span>SQ={selectedLog.parsed.asdu.sq} | 数值点数={selectedLog.parsed.asdu.numObj}</span></div>
                    <div className="tree-row">传送原因 (COT): <span>{selectedLog.parsed.asdu.cot} ({selectedLog.parsed.asdu.cotName})</span></div>
                    <div className="tree-row">从站公共地址 (ASDU Addr): <span>{selectedLog.parsed.asdu.commonAddr}</span></div>
                  </div>
                </div>
              )}

              {/* 数据点层 */}
              {selectedLog.parsed.asdu?.objects && selectedLog.parsed.asdu.objects.length > 0 && (
                <div className="tree-node">
                  <div className="node-title">
                    <ChevronRight size={14} color="var(--text-muted)" />
                    <strong>信息体对象数据层 (Objects)</strong>
                  </div>
                  <div className="node-body" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {selectedLog.parsed.asdu.objects.map((obj, i) => (
                      <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px', marginBottom: '6px' }}>
                        <div className="tree-row">信息体地址 (IOA): <span style={{ color: 'var(--color-success)' }}>{obj.ioa}</span></div>
                        
                        {/* 渲染对象值 */}
                        {selectedLog.parsed.asdu.typeId === 45 || selectedLog.parsed.asdu.typeId === 46 ? (
                          <>
                            <div className="tree-row">控制动作 (Action): <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{obj.value.state === 1 || obj.value.state === 2 ? '合闸 (ON)' : '分闸 (OFF)'}</span></div>
                            <div className="tree-row">控制步骤 (Step): <span style={{ color: 'var(--color-warning)' }}>{obj.value.select ? '选择 (Select)' : '执行 (Execute)'}</span></div>
                          </>
                        ) : selectedLog.parsed.asdu.typeId === 48 || selectedLog.parsed.asdu.typeId === 50 ? (
                          <>
                            <div className="tree-row">设定数值 (Setpoint): <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{obj.value.val}</span></div>
                            <div className="tree-row">控制步骤 (Step): <span style={{ color: 'var(--color-warning)' }}>{obj.value.select ? '选择 (Select)' : '执行 (Execute)'}</span></div>
                          </>
                        ) : (
                          <div className="tree-row">点位数值 (Value): <span style={{ color: '#fff', fontWeight: '600' }}>
                            {obj.value === 1 && selectedLog.parsed.asdu.typeId <= 31 ? '合位 (ON)' : 
                             obj.value === 0 && selectedLog.parsed.asdu.typeId <= 31 ? '分位 (OFF)' : obj.value}
                          </span></div>
                        )}

                        {obj.quality && (
                          <div className="tree-row">品质描述 (Quality): 
                            <span> {obj.quality.iv ? '无效(IV) ' : ''}{obj.quality.nt ? '旧值(NT) ' : ''}{!obj.quality.iv && !obj.quality.nt ? '正常 (Valid)' : ''}</span>
                          </div>
                        )}

                        {obj.time && (
                          <div className="tree-row">时标信息 (Time tag): <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{obj.time}</span></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .filter-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 4px 10px;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .filter-btn:hover {
          color: var(--text-main);
          background: rgba(255,255,255,0.06);
        }
        .filter-btn.active {
          background: var(--color-primary);
          color: #000;
          border-color: var(--color-primary);
          box-shadow: 0 0 8px var(--color-primary-glow);
        }
        .ctrl-btn {
          width: 30px;
          height: 30px;
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .ctrl-btn:hover {
          color: var(--text-main);
          background: rgba(255,255,255,0.1);
        }
        .log-row:hover {
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .tree-node {
          border-left: 1px dashed var(--border-color);
          padding-left: 8px;
          margin-bottom: 6px;
        }
        .node-title {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--text-light);
          font-size: 13px;
          margin-bottom: 4px;
        }
        .node-body {
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .tree-row {
          color: var(--text-muted);
          font-size: 12px;
        }
        .tree-row span {
          color: var(--text-light);
          font-family: var(--font-mono);
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}
