import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Pause, Play, Copy, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function TrafficMonitor({ activeConnId, logs, onClearLogs }) {
  const [isPaused, setIsPaused] = useState(false);
  const [filterText, setFilterText] = useState('');
  const logEndRef = useRef(null);

  const activeLogs = logs[activeConnId] || [];

  // 自动滚动到底部
  useEffect(() => {
    if (!isPaused && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeLogs, isPaused]);

  const handleCopyHex = (hex) => {
    navigator.clipboard.writeText(hex.replace(/\s+/g, ''));
    alert('已成功复制原始十六进制报文（无空格）！');
  };

  const filteredLogs = activeLogs.filter(log => {
    if (!filterText.trim()) return true;
    const txt = filterText.toLowerCase();
    return (
      log.hex.toLowerCase().includes(txt) ||
      log.desc.toLowerCase().includes(txt) ||
      log.dir.toLowerCase().includes(txt)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', minHeight: 0 }}>
      {/* 头部过滤器和控制器 */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '12px 18px' }}>
        
        {/* 关键字搜索 */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="label-text">报文内容检索</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="搜索十六进制、TID 或 功能描述..." 
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
        </div>

        {/* 控制按钮 */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className={`btn ${isPaused ? 'btn-success' : 'btn-secondary'}`}
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            {isPaused ? '继续监听' : '暂停滚动'}
          </button>
          
          <button 
            onClick={() => onClearLogs(activeConnId)} 
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--color-danger)' }}
          >
            <Trash2 size={12} />
            清除捕获
          </button>
        </div>

      </div>

      {/* 报文监控终端 */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={15} color="var(--color-primary)" />
          Modbus TCP 原生数据流监视器
        </h3>

        <div style={{
          flex: 1,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          lineHeight: '1.8',
          overflowY: 'auto'
        }}>
          {!activeConnId ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span>请选择活动的主站连接</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span>暂无通信报文记录...</span>
            </div>
          ) : (
            <div>
              {filteredLogs.map((log, idx) => {
                const isTx = log.dir === 'TX';
                const isLog = log.dir === 'LOG';
                
                let dirColor = 'var(--color-primary)'; // TX
                let dirName = '► 主站发送 TX';
                let icon = <ArrowUpCircle size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />;
                
                if (log.dir === 'RX') {
                  dirColor = 'var(--color-success)';
                  dirName = '◄ 从站应答 RX';
                  icon = <ArrowDownCircle size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />;
                } else if (isLog) {
                  dirColor = 'var(--text-muted)';
                  dirName = '⚙ 运行日志';
                  icon = null;
                }

                return (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '8px', 
                      borderRadius: '4px',
                      background: isTx ? 'rgba(0, 229, 255, 0.02)' : (isLog ? 'transparent' : 'rgba(57, 255, 20, 0.01)'),
                      borderLeft: `3px solid ${dirColor}`,
                      marginBottom: '8px'
                    }}
                  >
                    {/* 第一行：方向与描述 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '10px' }}>
                      <span style={{ color: dirColor, fontWeight: 'bold' }}>
                        {icon}
                        {dirName}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}.${String(log.timestamp % 1000).padStart(3, '0')}
                      </span>
                    </div>

                    {/* 第二行：物理帧结构 */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ color: 'var(--text-light)', wordBreak: 'break-all', flex: 1, letterSpacing: '0.5px' }}>
                        {log.hex ? log.hex : log.desc}
                      </div>
                      {log.hex && (
                        <button 
                          onClick={() => handleCopyHex(log.hex)}
                          className="copy-btn"
                          title="复制十六进制数据"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>

                    {/* 第三行：应用层解析细节 */}
                    {log.hex && (
                      <div style={{ marginTop: '4px', fontSize: '10.5px', color: 'var(--text-muted)', borderTop: '1px dashed rgba(255,255,255,0.03)', paddingTop: '4px' }}>
                        描述: <span style={{ color: 'var(--text-light)' }}>{log.desc}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .copy-btn:hover {
          color: var(--color-primary) !important;
        }
      `}</style>
    </div>
  );
}
