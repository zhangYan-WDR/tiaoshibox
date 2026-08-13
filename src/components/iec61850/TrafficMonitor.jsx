import React, { useState } from 'react';
import { Eye, Trash2, Search, Filter } from 'lucide-react';

export default function TrafficMonitor({ trafficLogs, onClearLogs, title }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTx, setFilterTx] = useState(true);
  const [filterRx, setFilterRx] = useState(true);
  const [filterLog, setFilterLog] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  const filteredLogs = trafficLogs.filter(log => {
    // Search term matching
    const matchesSearch = log.desc.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.hex.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Direction filters
    if (log.dir === 'TX' && !filterTx) return false;
    if (log.dir === 'RX' && !filterRx) return false;
    if (log.dir === 'LOG' && !filterLog) return false;

    return matchesSearch;
  });

  // Helper to format hex into 16-byte grid rows
  const formatHexGrid = (hexStr) => {
    if (!hexStr) return '';
    const cleanHex = hexStr.replace(/\s+/g, '');
    const rows = [];
    for (let i = 0; i < cleanHex.length; i += 32) {
      const chunk = cleanHex.substring(i, i + 32);
      const hexParts = chunk.match(/.{1,2}/g) || [];
      const hexLine = hexParts.join(' ');
      
      // ASCII representation
      const asciiLine = hexParts.map(hex => {
        const charCode = parseInt(hex, 16);
        return (charCode >= 32 && charCode <= 126) ? String.fromCharCode(charCode) : '.';
      }).join('');

      // Offset indicator
      const offset = (i / 2).toString(16).padStart(4, '0').toUpperCase();
      rows.push(`${offset}  ${hexLine.padEnd(48, ' ')}  |  ${asciiLine}`);
    }
    return rows.join('\n');
  };

  return (
    <div className="pane" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header controls */}
      <div className="pane-header">
        <h3>
          <Search size={14} color="var(--color-accent)" />
          {title || '通信报文流向监视器 (Traffic Analyzer)'}
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterTx} onChange={(e) => setFilterTx(e.target.checked)} />
              发送 (TX)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterRx} onChange={(e) => setFilterRx(e.target.checked)} />
              接收 (RX)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterLog} onChange={(e) => setFilterLog(e.target.checked)} />
              系统日志
            </label>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="搜索报文/日志内容..."
              className="input-field"
              style={{ width: '180px', padding: '4px 8px 4px 24px', fontSize: '11px', height: '24px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', height: '24px' }} onClick={onClearLogs}>
            <Trash2 size={12} /> 清理面板
          </button>
        </div>
      </div>

      {/* Main Body Split View */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Logs Table */}
        <div style={{ flex: 1, overflowY: 'auto', borderRight: selectedLog ? '1px solid var(--border-color)' : 'none' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
              没有匹配的报文日志流量记录。
            </div>
          ) : (
            filteredLogs.map((log, idx) => (
              <div
                key={idx}
                className={`log-row ${log.dir.toLowerCase()}`}
                onClick={() => setSelectedLog(log)}
                style={{
                  background: selectedLog === log ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  fontWeight: selectedLog === log ? '600' : '400'
                }}
              >
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`log-dir ${log.dir.toLowerCase()}`}>{log.dir}</span>
                <span style={{ width: '120px', color: 'var(--text-secondary)' }}>
                  <span style={{ background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>
                    {log.type}
                  </span>
                </span>
                <span className="log-desc">{log.desc}</span>
              </div>
            ))
          )}
        </div>

        {/* Selected Log Inspector Panel */}
        {selectedLog && (
          <div style={{ width: '450px', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="pane-header" style={{ padding: '8px 12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>报文原始帧解析 (Byte Interpreter)</span>
              <button
                className="btn btn-secondary"
                style={{ padding: '2px 6px', fontSize: '11px', height: '20px' }}
                onClick={() => setSelectedLog(null)}
              >
                关闭解析器
              </button>
            </div>
            
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>摘要说明:</div>
                <div style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', lineHeight: '1.4' }}>
                  {selectedLog.desc}
                </div>
              </div>
              
              {selectedLog.hex && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>报文 Hex-Dump 视图:</div>
                  <pre style={{
                    flex: 1,
                    background: '#040711',
                    padding: '10px',
                    borderRadius: '4px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    color: 'var(--color-success)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    overflowX: 'auto',
                    lineHeight: '1.5'
                  }}>
                    {formatHexGrid(selectedLog.hex)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
