import React, { useState } from 'react';
import { Table, RefreshCw, Trash2, Edit2, Play, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function MonitorDashboard({
  activeTab,
  
  // MMS Client
  mmsMonitoredVars,
  onRemoveMonitoredVar,
  onPollVar,

  // MMS Server
  mmsServerDb,
  onUpdateSimValue,

  // GOOSE Pub dataset
  goosePubDataset,
  onTogglePubDatasetItem,

  // GOOSE Sub status
  gooseSubscribersData
}) {
  return (
    <div className="pane" style={{ flex: 1, minHeight: '350px' }}>
      <div className="pane-header">
        <h3>
          <Table size={16} color="var(--color-accent)" />
          {activeTab === 'mms-client' && 'MMS 实时变量监控面板 (主站)'}
          {activeTab === 'mms-server' && 'MYSCL 模拟服务端数据库 (从站)'}
          {activeTab === 'goose-pub' && 'GOOSE 数据集配置区 (发布)'}
          {activeTab === 'goose-sub' && 'GOOSE 多播接收看板 (订阅)'}
        </h3>
      </div>
      <div className="pane-body">
        
        {/* MMS Client Variable Monitor */}
        {activeTab === 'mms-client' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
            {mmsMonitoredVars.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
                <Clock size={40} strokeWidth={1.5} />
                <div style={{ fontSize: '13px', textAlign: 'center' }}>
                  未添加监控变量。可在左侧<b>“SCL 模型资源管理器”</b>中选择一个数据属性双击，或手动输入地址添加监控。
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>变量标识路径 (MMS Path)</th>
                      <th>点位描述</th>
                      <th>数据类型</th>
                      <th>当前值</th>
                      <th>更新时间</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mmsMonitoredVars.map((v) => (
                      <tr key={v.path}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>{v.path}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{v.desc || '-'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}><span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{v.type || '未知'}</span></td>
                        <td style={{ color: v.value !== undefined ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                          {v.value !== undefined ? String(v.value) : '无数据 (双击点左侧或点右侧读取)'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{v.time || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => onPollVar(v.path)} title="读取当前值">
                              <RefreshCw size={12} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '4px 8px', background: 'transparent' }} onClick={() => onRemoveMonitoredVar(v.path)} title="移除监控">
                              <Trash2 size={12} color="var(--color-danger)" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MMS Server Simulator DB */}
        {activeTab === 'mms-server' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>数据库对象路径 (SCL Path)</th>
                  <th>对象描述</th>
                  <th>类型</th>
                  <th>当前值</th>
                  <th>仿真模拟调节器 (拖动改变主站读取的值)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(mmsServerDb.entries()).map(([path, item]) => (
                  <tr key={path}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{path}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.desc || '-'}</td>
                    <td><span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{item.type}</span></td>
                    <td style={{ fontWeight: 'bold', color: 'var(--color-info)' }}>{String(item.value)}</td>
                    <td>
                      {item.type === 'float' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="range"
                            min={path.includes('PhV') ? "0" : "0"}
                            max={path.includes('PhV') ? "30" : "500"}
                            step="0.1"
                            value={item.value}
                            onChange={(e) => onUpdateSimValue(path, e.target.value)}
                            style={{ flex: 1, accentColor: 'var(--color-accent)' }}
                          />
                          <input
                            type="number"
                            className="input-field"
                            style={{ width: '70px', padding: '2px 6px' }}
                            value={item.value}
                            onChange={(e) => onUpdateSimValue(path, e.target.value)}
                          />
                        </div>
                      )}
                      {item.type === 'integer' && !path.endsWith('$stVal') && (
                        <input
                          type="number"
                          className="input-field"
                          style={{ width: '100px', padding: '2px 6px' }}
                          value={item.value}
                          onChange={(e) => onUpdateSimValue(path, e.target.value)}
                        />
                      )}
                      {item.type === 'integer' && path.endsWith('$stVal') && (
                        <select
                          className="input-field"
                          style={{ padding: '2px 6px' }}
                          value={item.value}
                          onChange={(e) => onUpdateSimValue(path, e.target.value)}
                        >
                          <option value={1}>1 - 分位 (Open)</option>
                          <option value={2}>2 - 合位 (Close)</option>
                          <option value={0}>0 - 中间状态</option>
                          <option value={3}>3 - 损坏状态</option>
                        </select>
                      )}
                      {item.type === 'boolean' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={item.value}
                            onChange={(e) => onUpdateSimValue(path, e.target.checked)}
                          />
                          <span>切换开关状态</span>
                        </label>
                      )}
                      {item.type === 'bitstring' && (
                        <input
                          type="text"
                          className="input-field"
                          style={{ width: '150px', padding: '2px 6px', fontFamily: 'monospace' }}
                          value={item.value}
                          onChange={(e) => onUpdateSimValue(path, e.target.value)}
                        />
                      )}
                      {item.type === 'time' && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>联动自动变位更新</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GOOSE Publisher Dataset Config */}
        {activeTab === 'goose-pub' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              以下是 GOOSE 数据集内容，您可以随意切换数值。
              数据改变时会触发 GOOSE 快速重传机制 (StNum 递增, SqNum 重置为0，并在 2ms/4ms/8ms... 内连发数次)。
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>数据属性名称</th>
                  <th>数据类型</th>
                  <th>当前值</th>
                  <th>更改数值状态 (将立刻触发重传)</th>
                </tr>
              </thead>
              <tbody>
                {goosePubDataset.map((item) => (
                  <tr key={item.name}>
                    <td style={{ fontWeight: '500' }}>{item.name}</td>
                    <td><span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{item.type}</span></td>
                    <td style={{ fontWeight: 'bold', color: item.type === 'boolean' && item.value ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {String(item.value)}
                    </td>
                    <td>
                      {item.type === 'boolean' && (
                        <button
                          className={`btn ${item.value ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                          onClick={() => onTogglePubDatasetItem(item.name, !item.value)}
                        >
                          {item.value ? '置为 FALSE (解除分闸)' : '置为 TRUE (模拟跳闸)'}
                        </button>
                      )}
                      {item.type === 'integer' && (
                        <select
                          className="input-field"
                          style={{ padding: '2px 6px', fontSize: '12px' }}
                          value={item.value}
                          onChange={(e) => onTogglePubDatasetItem(item.name, parseInt(e.target.value))}
                        >
                          <option value={1}>1 - 分位 (Open)</option>
                          <option value={2}>2 - 合位 (Close)</option>
                        </select>
                      )}
                      {item.type === 'bitstring' && (
                        <input
                          type="text"
                          className="input-field"
                          style={{ width: '130px', padding: '2px 6px', fontFamily: 'monospace' }}
                          value={item.value}
                          onChange={(e) => onTogglePubDatasetItem(item.name, e.target.value)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GOOSE Subscriber Display */}
        {activeTab === 'goose-sub' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {gooseSubscribersData.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', color: 'var(--text-muted)', gap: '12px' }}>
                <Clock size={40} strokeWidth={1.5} />
                <div>正在等待接收网络中的 GOOSE 报文...</div>
              </div>
            ) : (
              gooseSubscribersData.map((g) => (
                <div key={g.gocbRef} style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  
                  {/* GOOSE Block Info Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>控制块: {g.gocbRef}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GoID: {g.goID} | APPID: 0x{g.appid.toString(16)} | 源地址: {g.srcAddress}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                      <div>状态序号 (StNum): <span style={{ color: 'var(--color-info)', fontWeight: 'bold' }}>{g.stNum}</span></div>
                      <div>帧序号 (SqNum): <span style={{ color: 'var(--color-info)', fontWeight: 'bold' }}>{g.sqNum}</span></div>
                      <div>版本 (ConfRev): <span style={{ color: 'var(--text-secondary)' }}>{g.confRev}</span></div>
                    </div>
                  </div>

                  {/* Alarms & Alerts */}
                  {g.alert && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', marginBottom: '10px' }}>
                      <AlertTriangle size={14} />
                      <span>{g.alert}</span>
                    </div>
                  )}

                  {/* Dataset Table */}
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>数据集载荷内容 (AllData):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {g.dataset.map((d, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '4px', display: 'flex', gap: '12px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>[{d.type}]</span>
                          <span style={{
                            fontWeight: 'bold',
                            color: d.type === 'boolean' && d.value ? 'var(--color-danger)' : 'var(--color-success)'
                          }}>
                            {String(d.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
