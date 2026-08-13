import React, { useState, useEffect } from 'react';
import { Play, FileSpreadsheet, Search, RefreshCw, Send, ShieldAlert } from 'lucide-react';

export default function MonitorDashboard({ 
  activeConn, 
  yxPoints, 
  ycPoints, 
  onGeneralCall, 
  onOpenYK, 
  onOpenYT 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // 用于强制触发 React 定时刷新组件中关于 "刚刚更新" 的秒数判断
  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // 整理数据列表
  const clientYx = yxPoints[activeConn?.id] || {};
  const clientYc = ycPoints[activeConn?.id] || {};

  const yxList = Object.values(clientYx).sort((a, b) => a.ioa - b.ioa);
  const ycList = Object.values(clientYc).sort((a, b) => a.ioa - b.ioa);

  // 搜索过滤
  const filteredYx = yxList.filter(item => 
    item.ioa.toString().includes(searchQuery) || 
    (item.desc || '').includes(searchQuery)
  );

  const filteredYc = ycList.filter(item => 
    item.ioa.toString().includes(searchQuery) || 
    (item.desc || '').includes(searchQuery)
  );

  // 导出 CSV
  const exportToCSV = () => {
    if (!activeConn) return;
    
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += '测点类型,信息对象地址(IOA),当前值,品质状态,更新时间,描述\n';
    
    yxList.forEach(item => {
      const q = item.quality ? `IV:${item.quality.iv ? 1 : 0} NT:${item.quality.nt ? 1 : 0}` : '正常';
      const valStr = item.value === 1 ? '合 (ON)' : '分 (OFF)';
      csvContent += `遥信(YX),${item.ioa},${valStr},${q},"${item.time || ''}","${item.desc || ''}"\n`;
    });

    ycList.forEach(item => {
      const q = item.quality ? `IV:${item.quality.iv ? 1 : 0} NT:${item.quality.nt ? 1 : 0}` : '正常';
      csvContent += `遥测(YC),${item.ioa},${item.value},${q},"${item.time || ''}","${item.desc || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `IEC104_Data_${activeConn.ip}_${activeConn.port}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      
      {/* 顶部控制栏 */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="搜寻地址 (IOA) 或描述..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '11px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={exportToCSV}
            disabled={!activeConn || (yxList.length === 0 && ycList.length === 0)}
            title="导出当前监测点数据为CSV表格"
          >
            <FileSpreadsheet size={15} />
            导出数据
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={() => onGeneralCall(activeConn?.id)}
            disabled={!activeConn || activeConn.status !== 'CONNECTED'}
            style={{ fontWeight: '600' }}
          >
            <RefreshCw size={14} />
            一键总召
          </button>
        </div>
      </div>

      {/* 左右分栏监视区域：左遥测 (YC)，右遥信 (YX) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', flex: 1, minHeight: 0 }}>
        
        {/* 左：遥测点 (YC) */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 0 0 0' }}>
          <div style={{ padding: '0 16px 12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '14px', background: 'var(--color-primary)', borderRadius: '2px' }} />
              遥测监视区 (Tele-measurement)
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
              点位数: {filteredYc.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>地址 (IOA)</th>
                  <th>当前测量值</th>
                  <th>品质</th>
                  <th>时标 (从站)</th>
                </tr>
              </thead>
              <tbody>
                {filteredYc.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      {!activeConn ? '请先建立/选择通道' : '暂无总召数据，请点击上方一键总召'}
                    </td>
                  </tr>
                ) : (
                  filteredYc.map(item => {
                    const isJustUpdated = (timeTick - item.lastUpdated) < 1000;
                    const highlightClass = isJustUpdated ? 'flash-highlight' : '';
                    return (
                      <tr key={item.ioa} className={highlightClass}>
                        <td className="mono-val" style={{ color: 'var(--color-primary)' }}>{item.ioa}</td>
                        <td className="mono-val" style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                          {item.value}
                        </td>
                        <td>
                          {item.quality?.iv ? (
                            <span title="数据无效 (Invalid)" style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center' }}>
                              <ShieldAlert size={14} />
                            </span>
                          ) : '正常'}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {item.time || '即时数据'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右：遥信点 (YX) */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 0 0 0' }}>
          <div style={{ padding: '0 16px 12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '14px', background: 'var(--color-success)', borderRadius: '2px' }} />
              遥信监视区 (Tele-signaling)
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
              点位数: {filteredYx.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>地址 (IOA)</th>
                  <th>遥信状态</th>
                  <th>品质</th>
                </tr>
              </thead>
              <tbody>
                {filteredYx.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      {!activeConn ? '请先建立/选择通道' : '暂无总召数据，请点击上方一键总召'}
                    </td>
                  </tr>
                ) : (
                  filteredYx.map(item => {
                    // 判断是否是 1000ms 内刚刚更新的，触发闪烁背景
                    const isJustUpdated = (timeTick - item.lastUpdated) < 1000;
                    const highlightClass = isJustUpdated 
                      ? (item.value === 1 ? 'flash-highlight-success' : 'flash-highlight-danger') 
                      : '';
                    
                    return (
                      <tr key={item.ioa} className={highlightClass}>
                        <td className="mono-val" style={{ color: 'var(--color-primary)' }}>{item.ioa}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: item.value === 1 ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 56, 96, 0.1)',
                            border: item.value === 1 ? '1px solid rgba(57, 255, 20, 0.2)' : '1px solid rgba(255, 56, 96, 0.2)',
                            color: item.value === 1 ? 'var(--color-success)' : 'var(--color-danger)',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            <span className={`status-dot ${item.value === 1 ? 'active' : 'danger'}`} style={{ animation: 'none', width: '6px', height: '6px' }} />
                            {item.value === 1 ? '合位 (ON)' : '分位 (OFF)'}
                          </span>
                        </td>
                        <td>
                          {item.quality?.iv ? (
                            <span title="数据无效 (Invalid)" style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center' }}>
                              <ShieldAlert size={14} />
                            </span>
                          ) : '正常'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <style>{`
        .action-btn {
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .action-btn.YK {
          color: var(--color-warning);
          background: rgba(255, 179, 0, 0.05);
          border-color: rgba(255, 179, 0, 0.15);
        }
        .action-btn.YK:hover:not(:disabled) {
          background: var(--color-warning);
          color: #000;
          box-shadow: 0 0 8px var(--color-warning-glow);
        }
        .action-btn.YT {
          color: var(--color-primary);
          background: rgba(0, 229, 255, 0.05);
          border-color: rgba(0, 229, 255, 0.15);
        }
        .action-btn.YT:hover:not(:disabled) {
          background: var(--color-primary);
          color: #000;
          box-shadow: 0 0 8px var(--color-primary-glow);
        }
        .action-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
