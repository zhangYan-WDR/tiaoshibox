import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Power, 
  Play, 
  Square, 
  Settings, 
  Folder, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft,
  Bookmark, 
  Trash2, 
  Edit2, 
  Plus, 
  Activity, 
  Wifi, 
  Globe,
  Eye,
  EyeOff
} from 'lucide-react';

export default function OPCUADashboard() {
  const [activeConnId, setActiveConnId] = useState(null);
  const [connections, setConnections] = useState([]);
  
  // 连接折叠状态与面板可拖动调整尺寸状态
  const [isConnCollapsed, setIsConnCollapsed] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('opcua:left-panel-width');
      return saved ? Math.max(180, Math.min(600, parseInt(saved, 10))) : 280;
    } catch {
      return 280;
    }
  });
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('opcua:bottom-panel-height');
      return saved ? Math.max(80, Math.min(500, parseInt(saved, 10))) : 200;
    } catch {
      return 200;
    }
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  // 左右分栏拖拽调整宽度
  useEffect(() => {
    if (!isResizingLeft) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(180, Math.min(600, e.clientX));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      localStorage.setItem('opcua:left-panel-width', leftPanelWidth.toString());
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, leftPanelWidth]);

  // 上下分栏拖拽调整高度
  useEffect(() => {
    if (!isResizingBottom) return;

    const handleMouseMove = (e) => {
      const newHeight = Math.max(80, Math.min(500, window.innerHeight - e.clientY));
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingBottom(false);
      localStorage.setItem('opcua:bottom-panel-height', bottomPanelHeight.toString());
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingBottom, bottomPanelHeight]);

  // 表单状态
  const [name, setName] = useState('');
  const [ip, setIp] = useState('127.0.0.1');
  const [port, setPort] = useState('4840');
  const [endpointUrl, setEndpointUrl] = useState('opc.tcp://127.0.0.1:4840');
  const [securityMode, setSecurityMode] = useState('None'); // None | Sign | SignAndEncrypt
  const [securityPolicy, setSecurityPolicy] = useState('None'); // None | Basic256Sha256 | Aes128_Sha256_RsaOaep
  const [authMode, setAuthMode] = useState('anonymous'); // anonymous | username
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingConfigIndex, setEditingConfigIndex] = useState(null); // 修改常用配置索引
  const [selectedConfigIdx, setSelectedConfigIdx] = useState('');
  const [savedConfigs, setSavedConfigs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('opcua_saved_configs') || '[]');
    } catch (e) {
      return [];
    }
  });

  // 节点树及监控列表状态
  const [nodeChildren, setNodeChildren] = useState({}); // nodeId -> references array
  const [expandedNodes, setExpandedNodes] = useState({}); // nodeId -> bool
  const [monitoredNodes, setMonitoredNodes] = useState([]); // array of node objects
  const [subscribedNodes, setSubscribedNodes] = useState(new Set()); // Set of nodeId strings

  // 树选择与鼠标拖拽多选状态
  const [selectedTreeNodeIds, setSelectedTreeNodeIds] = useState(new Set());
  const [lastClickedTreeNodeId, setLastClickedTreeNodeId] = useState(null);
  const [isTreeDragging, setIsTreeDragging] = useState(false);
  const [dragStartNodeId, setDragStartNodeId] = useState(null);

  // 数据监测区 (Table) 多选状态
  const [selectedTableNodeIds, setSelectedTableNodeIds] = useState(new Set());
  const [lastClickedTableIndex, setLastClickedTableIndex] = useState(null);

  // 详细信息模态弹窗状态
  const [detailNode, setDetailNode] = useState(null); // Node object under detailed inspection

  // 写入控制面板状态
  const [writeDataType, setWriteDataType] = useState('Int32');
  const [writeValue, setWriteValue] = useState('');

  // 报文日志状态
  const [trafficLogs, setTrafficLogs] = useState([]);

  // 加载状态
  const [connecting, setConnecting] = useState(false);
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState(false);

  // 同步修改 IP/端口时，自动更新 endpointUrl
  useEffect(() => {
    setEndpointUrl(`opc.tcp://${ip}:${port}`);
  }, [ip, port]);

  // 监听全局鼠标抬起，结束树拖拽选择
  useEffect(() => {
    const handleMouseUp = () => {
      setIsTreeDragging(false);
      setDragStartNodeId(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // 监听全局按键以支持键盘 Delete 键删除监测列表中的多选点位
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 如果焦点在输入框中，不拦截
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
          return;
        }
        if (selectedTableNodeIds.size > 0) {
          e.preventDefault();
          selectedTableNodeIds.forEach(nodeId => {
            handleRemoveMonitoredNode(nodeId);
          });
          setSelectedTableNodeIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTableNodeIds, monitoredNodes]);

  // 订阅连接状态变化
  useEffect(() => {
    const unsub = window.api.opcua.onStatusChange((data) => {
      setConnections(prev => prev.map(c => {
        if (c.id === data.clientId) {
          return { ...c, status: data.status };
        }
        return c;
      }));
      if (data.clientId === activeConnId) {
        if (data.status === 'CONNECTED') {
          setConnecting(false);
          // 连接成功后，默认加载根节点 Tree
          handleBrowseNode(data.clientId, 'ns=0;i=84');
        } else if (data.status === 'DISCONNECTED') {
          setConnecting(false);
        }
      }
    });
    return () => unsub();
  }, [activeConnId]);

  // 订阅报文流量日志
  useEffect(() => {
    const unsub = window.api.opcua.onTrafficLog((log) => {
      if (log.clientId === activeConnId) {
        setTrafficLogs(prev => [log, ...prev].slice(0, 100));
      }
    });
    return () => unsub();
  }, [activeConnId]);

  // 订阅节点实时改变推送，自动同步数据到监控表格与详情弹窗
  useEffect(() => {
    const unsub = window.api.opcua.onDataUpdate((data) => {
      if (data.clientId === activeConnId) {
        // 更新监控列表里的对应节点值
        setMonitoredNodes(prev => prev.map(n => {
          if (n.nodeId === data.nodeId) {
            return {
              ...n,
              value: data.value,
              sourceTimestamp: data.timestamp,
              statusCode: data.statusCode
            };
          }
          return n;
        }));

        // 如果详细信息弹窗打开的正是该节点，也进行实时刷新
        setDetailNode(prev => {
          if (prev && prev.nodeId === data.nodeId) {
            return {
              ...prev,
              value: data.value,
              sourceTimestamp: data.timestamp,
              statusCode: data.statusCode
            };
          }
          return prev;
        });
      }
    });
    return () => unsub();
  }, [activeConnId]);

  // 常用配置保存与修改
  const handleSaveConfig = () => {
    const newConfig = {
      name: name || `${ip}:${port}`,
      ip,
      port: parseInt(port) || 4840,
      endpointUrl,
      securityMode,
      securityPolicy,
      authMode,
      username,
      password
    };

    if (editingConfigIndex !== null) {
      // 修改模式
      const updated = [...savedConfigs];
      updated[editingConfigIndex] = newConfig;
      localStorage.setItem('opcua_saved_configs', JSON.stringify(updated));
      setSavedConfigs(updated);
    } else {
      // 新建保存模式
      const exists = savedConfigs.some(c => 
        c.name === newConfig.name &&
        c.endpointUrl === newConfig.endpointUrl &&
        c.securityMode === newConfig.securityMode &&
        c.securityPolicy === newConfig.securityPolicy &&
        c.authMode === newConfig.authMode
      );

      if (!exists) {
        const updated = [...savedConfigs, newConfig];
        localStorage.setItem('opcua_saved_configs', JSON.stringify(updated));
        setSavedConfigs(updated);
        // 自动选中新保存的配置
        const newIdx = updated.length - 1;
        setSelectedConfigIdx(newIdx.toString());
        setEditingConfigIndex(newIdx);
      }
    }
  };

  const handleSaveAsNewConfig = () => {
    const newConfig = {
      name: name ? `${name}_副本` : `${ip}:${port}_副本`,
      ip,
      port: parseInt(port) || 4840,
      endpointUrl,
      securityMode,
      securityPolicy,
      authMode,
      username,
      password
    };
    const updated = [...savedConfigs, newConfig];
    localStorage.setItem('opcua_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
    // 自动选中新配置
    const newIdx = updated.length - 1;
    setSelectedConfigIdx(newIdx.toString());
    setEditingConfigIndex(newIdx);
    setName(newConfig.name);
  };

  const handleCancelConfigEdit = () => {
    setEditingConfigIndex(null);
    setSelectedConfigIdx('');
    setName('');
    setIp('127.0.0.1');
    setPort('4840');
    setEndpointUrl('opc.tcp://127.0.0.1:4840');
    setSecurityMode('None');
    setSecurityPolicy('None');
    setAuthMode('anonymous');
    setUsername('');
    setPassword('');
  };

  const handleStartEditConfig = (cfg, idx) => {
    setEditingConfigIndex(idx);
    setName(cfg.name || '');
    setIp(cfg.ip || '127.0.0.1');
    setPort((cfg.port || 4840).toString());
    setEndpointUrl(cfg.endpointUrl);
    setSecurityMode(cfg.securityMode || 'None');
    setSecurityPolicy(cfg.securityPolicy || 'None');
    setAuthMode(cfg.authMode || 'anonymous');
    setUsername(cfg.username || '');
    setPassword(cfg.password || '');
    setIsConnCollapsed(false); // 展开表单以便修改
  };

  const handleLoadConfig = (cfg, idx) => {
    setName(cfg.name || '');
    setIp(cfg.ip || '127.0.0.1');
    setPort((cfg.port || 4840).toString());
    setEndpointUrl(cfg.endpointUrl);
    setSecurityMode(cfg.securityMode || 'None');
    setSecurityPolicy(cfg.securityPolicy || 'None');
    setAuthMode(cfg.authMode || 'anonymous');
    setUsername(cfg.username || '');
    setPassword(cfg.password || '');
    setSelectedConfigIdx(idx.toString());
    setEditingConfigIndex(parseInt(idx));
  };

  const handleDeleteConfig = (e, index) => {
    e.stopPropagation();
    const updated = savedConfigs.filter((_, i) => i !== index);
    localStorage.setItem('opcua_saved_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
    setSelectedConfigIdx('');
    if (editingConfigIndex === index) {
      setEditingConfigIndex(null);
    }
  };

  // 修改已有连接
  const handleStartEdit = (c) => {
    setEditingId(c.id);
    setName(c.name || '');
    setIp(c.ip);
    setPort(c.port.toString());
    setEndpointUrl(c.endpointUrl);
    setSecurityMode(c.securityMode);
    setSecurityPolicy(c.securityPolicy);
    setAuthMode(c.authMode);
    setUsername(c.username || '');
    setPassword(c.password || '');
    setIsConnCollapsed(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setIp('127.0.0.1');
    setPort('4840');
    setEndpointUrl('opc.tcp://127.0.0.1:4840');
    setSecurityMode('None');
    setSecurityPolicy('None');
    setAuthMode('anonymous');
    setUsername('');
    setPassword('');
  };

  // 提交新建/编辑连接
  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = editingId || `${ip}:${port}-${Date.now().toString(36).substr(-4)}`;
    const config = {
      id,
      name: name || `${ip}:${port}`,
      ip,
      port: parseInt(port) || 4840,
      endpointUrl,
      securityMode,
      securityPolicy,
      authMode,
      username,
      password
    };

    setConnections(prev => {
      const exists = prev.some(c => c.id === id);
      if (exists) {
        return prev.map(c => c.id === id ? { ...c, ...config, status: 'CONNECTING' } : c);
      }
      return [...prev, { ...config, status: 'CONNECTING' }];
    });

    setActiveConnId(id);
    setConnecting(true);
    setNodeChildren({});
    setExpandedNodes({});
    setMonitoredNodes([]);
    setSubscribedNodes(new Set());
    setSelectedTreeNodeIds(new Set());
    setSelectedTableNodeIds(new Set());
    setDetailNode(null);
    setTrafficLogs([]);

    try {
      const res = await window.api.opcua.connect(config);
      if (!res.success) {
        setConnecting(false);
        alert(`连接 OPC UA 服务器失败: ${res.error}`);
      }
    } catch (err) {
      setConnecting(false);
      alert(`连接发生错误: ${err.message}`);
    }

    setEditingId(null);
  };

  // 断开连接并取消订阅
  const handleDisconnect = async (id) => {
    try {
      await window.api.opcua.disconnect(id);
      setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'DISCONNECTED' } : c));
      if (id === activeConnId) {
        setMonitoredNodes([]);
        setSubscribedNodes(new Set());
        setSelectedTreeNodeIds(new Set());
        setSelectedTableNodeIds(new Set());
        setDetailNode(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 异步浏览子节点
  const handleBrowseNode = async (connId, nodeId) => {
    try {
      const res = await window.api.opcua.browse(connId, nodeId);
      if (res.success) {
        setNodeChildren(prev => ({
          ...prev,
          [nodeId]: res.references
        }));
      } else {
        console.error("浏览节点失败:", res.error);
      }
    } catch (err) {
      console.error("浏览节点发生异常:", err);
    }
  };

  const toggleExpandNode = (nodeId) => {
    const nextState = !expandedNodes[nodeId];
    setExpandedNodes(prev => ({ ...prev, [nodeId]: nextState }));
    
    if (nextState && !nodeChildren[nodeId]) {
      handleBrowseNode(activeConnId, nodeId);
    }
  };

  // 勾选或点击节点，将其加入监控列表并启动实时订阅
  const handleAddMonitoredNode = async (node) => {
    if (monitoredNodes.some(n => n.nodeId === node.nodeId)) return;

    const initialNode = {
      ...node,
      value: '读取中...',
      dataType: '...',
      sourceTimestamp: '...',
      statusCode: 'Good'
    };

    setMonitoredNodes(prev => [...prev, initialNode]);

    try {
      const res = await window.api.opcua.readNode(activeConnId, node.nodeId);
      if (res.success) {
        setMonitoredNodes(prev => prev.map(n => n.nodeId === node.nodeId ? { ...n, ...res.data } : n));
      }
      
      await window.api.opcua.subscribeNode(activeConnId, node.nodeId);
      setSubscribedNodes(prev => {
        const next = new Set(prev);
        next.add(node.nodeId);
        return next;
      });
    } catch (err) {
      console.error("自动订阅节点失败:", err);
    }
  };

  // 移出监控列表并取消对应订阅
  const handleRemoveMonitoredNode = async (nodeId) => {
    setMonitoredNodes(prev => prev.filter(n => n.nodeId !== nodeId));

    try {
      await window.api.opcua.unsubscribeNode(activeConnId, nodeId);
      setSubscribedNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    } catch (err) {
      console.error("取消节点订阅失败:", err);
    }
  };

  // 深度先序遍历生成当前展开的扁平树节点列表（供 Shift 范围选择及拖拽选择使用）
  const getFlatVisibleNodes = () => {
    const list = [];
    const traverse = (node) => {
      list.push(node);
      const isExpanded = expandedNodes[node.nodeId];
      if (isExpanded && nodeChildren[node.nodeId]) {
        nodeChildren[node.nodeId].forEach(child => traverse(child));
      }
    };
    if (nodeChildren['ns=0;i=84']) {
      nodeChildren['ns=0;i=84'].forEach(child => traverse(child));
    }
    return list;
  };

  // 格式化数值展示
  const formatValue = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  // 格式化时间戳展示
  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      if (typeof ts === 'string' && ts.length >= 19) {
        return ts.substring(11, 23);
      }
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      return d.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return String(ts);
    }
  };

  // 切换监测表格中单个复选框选中状态
  const handleToggleTableSelect = (nodeId) => {
    setSelectedTableNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // 清空所有监视节点
  const handleClearMonitoredNodes = () => {
    monitoredNodes.forEach(n => {
      window.api.opcua.unsubscribeNode(activeConnId, n.nodeId).catch(e => console.error(e));
    });
    setMonitoredNodes([]);
    setSubscribedNodes(new Set());
    setSelectedTableNodeIds(new Set());
  };

  // 监测区表格行多选点击处理 (Ctrl/Cmd/Shift)
  const handleTableRowClick = (e, node, idx) => {
    const nodeId = typeof node === 'string' ? node : node?.nodeId;
    if (!nodeId) return;
    let nextSelected = new Set(selectedTableNodeIds);

    if (e.ctrlKey || e.metaKey) {
      if (nextSelected.has(nodeId)) {
        nextSelected.delete(nodeId);
      } else {
        nextSelected.add(nodeId);
      }
    } else if (e.shiftKey && lastClickedTableIndex !== null) {
      const start = Math.min(lastClickedTableIndex, idx);
      const end = Math.max(lastClickedTableIndex, idx);
      for (let i = start; i <= end; i++) {
        if (monitoredNodes[i]) {
          nextSelected.add(monitoredNodes[i].nodeId);
        }
      }
    } else {
      nextSelected = new Set([nodeId]);
    }

    setSelectedTableNodeIds(nextSelected);
    setLastClickedTableIndex(idx);
  };

  // 递归树节点绘制子组件
  // 递归树节点绘制子组件
  const renderTreeNode = (node) => {
    const isExpanded = !!expandedNodes[node.nodeId];
    const children = nodeChildren[node.nodeId] || [];
    const isMonitored = monitoredNodes.some(n => n.nodeId === node.nodeId);
    const isSelectedInTree = selectedTreeNodeIds.has(node.nodeId);
    
    // OPC UA 节点是否可能拥有子节点 (Object 或已知含有子节点的节点)
    const canExpand = node.nodeClass === 'Object' || (nodeChildren[node.nodeId] && nodeChildren[node.nodeId].length > 0);

    return (
      <div key={node.nodeId} style={{ position: 'relative' }}>
        <div 
          onMouseDown={(e) => {
            if (node.nodeClass === 'Variable') {
              setIsTreeDragging(true);
              setDragStartNodeId(node.nodeId);

              let nextSelected = new Set(selectedTreeNodeIds);
              if (e.ctrlKey || e.metaKey) {
                if (nextSelected.has(node.nodeId)) nextSelected.delete(node.nodeId);
                else nextSelected.add(node.nodeId);
              } else if (e.shiftKey && lastClickedTreeNodeId) {
                const flatNodes = getFlatVisibleNodes();
                const lastIdx = flatNodes.findIndex(n => n.nodeId === lastClickedTreeNodeId);
                const currentIdx = flatNodes.findIndex(n => n.nodeId === node.nodeId);
                if (lastIdx !== -1 && currentIdx !== -1) {
                  const start = Math.min(lastIdx, currentIdx);
                  const end = Math.max(lastIdx, currentIdx);
                  for (let i = start; i <= end; i++) {
                    if (flatNodes[i].nodeClass === 'Variable') {
                      nextSelected.add(flatNodes[i].nodeId);
                    }
                  }
                }
              } else {
                nextSelected = new Set([node.nodeId]);
              }

              setSelectedTreeNodeIds(nextSelected);
              setLastClickedTreeNodeId(node.nodeId);
            }
          }}
          onMouseEnter={() => {
            if (isTreeDragging && dragStartNodeId && node.nodeClass === 'Variable') {
              const flatNodes = getFlatVisibleNodes();
              const startIdx = flatNodes.findIndex(n => n.nodeId === dragStartNodeId);
              const currentIdx = flatNodes.findIndex(n => n.nodeId === node.nodeId);
              if (startIdx !== -1 && currentIdx !== -1) {
                const start = Math.min(startIdx, currentIdx);
                const end = Math.max(startIdx, currentIdx);
                setSelectedTreeNodeIds(prev => {
                  const next = new Set(prev);
                  for (let i = start; i <= end; i++) {
                    if (flatNodes[i].nodeClass === 'Variable') {
                      next.add(flatNodes[i].nodeId);
                    }
                  }
                  return next;
                });
              }
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 6px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: isSelectedInTree 
              ? 'var(--color-primary-glow, rgba(2, 132, 199, 0.15))' 
              : (isMonitored ? 'rgba(2, 132, 199, 0.06)' : 'transparent'),
            border: isSelectedInTree 
              ? '1px solid var(--color-primary)' 
              : (isMonitored ? '1px solid var(--border-glow)' : '1px solid transparent'),
            color: isSelectedInTree 
              ? 'var(--color-primary)' 
              : (isMonitored ? 'var(--color-primary)' : 'var(--text-light)'),
            margin: '1px 0',
            transition: 'all 0.15s ease',
            userSelect: 'none'
          }}
          className="node-tree-item"
        >
          {/* 固定 16px 展开/折叠箭头插槽 */}
          <span 
            onClick={(e) => {
              if (canExpand) {
                e.stopPropagation();
                toggleExpandNode(node.nodeId);
              }
            }}
            style={{ 
              width: '16px', 
              minWidth: '16px', 
              height: '16px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0,
              cursor: canExpand ? 'pointer' : 'default', 
              color: 'var(--text-muted)' 
            }}
          >
            {canExpand ? (
              isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            ) : null}
          </span>

          {/* 变量复选框插槽 */}
          {node.nodeClass === 'Variable' && (
            <input 
              type="checkbox"
              checked={isMonitored}
              onChange={(e) => {
                e.stopPropagation();
                if (e.target.checked) {
                  handleAddMonitoredNode(node);
                } else {
                  handleRemoveMonitoredNode(node.nodeId);
                }
              }}
              style={{
                cursor: 'pointer',
                accentColor: 'var(--color-primary)',
                width: '14px',
                minWidth: '14px',
                height: '14px',
                flexShrink: 0,
                margin: 0
              }}
            />
          )}

          {/* 固定 16px 节点类型图标插槽 */}
          <span style={{ 
            width: '16px', 
            minWidth: '16px', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexShrink: 0 
          }}>
            {node.nodeClass === 'Object' ? (
              <Folder size={13} color="#eab308" />
            ) : node.nodeClass === 'Method' ? (
              <Play size={13} color="#10b981" />
            ) : (
              <FileText size={13} color="#0ea5e9" />
            )}
          </span>

          {/* 节点名称 */}
          <span style={{ 
            fontSize: '12px', 
            fontFamily: 'var(--font-sans)', 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            flex: 1 
          }}>
            {node.displayName || node.browseName}
          </span>
        </div>

        {/* 子节点列表与虚线层级连接引导线 */}
        {isExpanded && (
          <div style={{ 
            paddingLeft: '4px', 
            borderLeft: '1px dashed var(--border-color)', 
            marginLeft: '14px' 
          }}>
            {children.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '14px', display: 'block', padding: '3px' }}>
                加载中...
              </span>
            ) : (
              children.map(child => renderTreeNode(child))
            )}
          </div>
        )}
      </div>
    );
  };

  const activeConnection = connections.find(c => c.id === activeConnId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* 顶部横向连接管理区 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: '12px',
        flexShrink: 0
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>服务器:</span>
            <input 
              type="text" 
              className="input-field" 
              value={ip} 
              onChange={e => {
                const val = e.target.value;
                setIp(val);
                setEndpointUrl(`opc.tcp://${val}:${port}`);
              }} 
              placeholder="127.0.0.1" 
              style={{ width: '110px', padding: '5px 8px', fontSize: '11.5px' }}
              required 
            />
            <span style={{ color: 'var(--text-muted)' }}>:</span>
            <input 
              type="number" 
              className="input-field" 
              value={port} 
              onChange={e => {
                const val = e.target.value;
                setPort(val);
                setEndpointUrl(`opc.tcp://${ip}:${val}`);
              }} 
              placeholder="4840" 
              style={{ width: '56px', padding: '5px 6px', fontSize: '11.5px' }}
              required 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>安全:</span>
            <select className="input-field" value={securityMode} onChange={e => setSecurityMode(e.target.value)} style={{ width: '80px', padding: '4px', fontSize: '11.5px', background: 'rgba(0,0,0,0.4)', color: '#fff' }}>
              <option value="None">None</option>
              <option value="Sign">Sign</option>
              <option value="SignAndEncrypt">Sign & Encrypt</option>
            </select>
            <select className="input-field" value={securityPolicy} onChange={e => setSecurityPolicy(e.target.value)} style={{ width: '110px', padding: '4px', fontSize: '11.5px', background: 'rgba(0,0,0,0.4)', color: '#fff' }}>
              <option value="None">None</option>
              <option value="Basic256Sha256">Basic256Sha256</option>
              <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select className="input-field" value={authMode} onChange={e => setAuthMode(e.target.value)} style={{ width: '65px', padding: '4px', fontSize: '11.5px', background: 'rgba(0,0,0,0.4)', color: '#fff' }}>
              <option value="anonymous">匿名</option>
              <option value="username">账户</option>
            </select>
            {authMode === 'username' && (
              <>
                <input type="text" className="input-field" value={username} onChange={e => setUsername(e.target.value)} placeholder="用户" style={{ width: '80px', padding: '4px 6px', fontSize: '11px' }} required />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="input-field" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="密码" 
                    style={{ width: '85px', padding: '4px 22px 4px 6px', fontSize: '11px' }} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: 0,
                      bottom: 0,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>别名:</span>
            <input 
              type="text" 
              className="input-field" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="选填别名" 
              style={{ width: '80px', padding: '5px 8px', fontSize: '11.5px' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '11.5px' }} disabled={connecting}>
            {connecting ? '连接中...' : (editingId ? '保存并重连' : '建立连接')}
          </button>
          
          {editingConfigIndex !== null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button 
                type="button" 
                onClick={handleSaveConfig} 
                className="btn btn-primary" 
                style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px', border: '1px solid var(--color-primary)' }}
              >
                <Edit2 size={12} />
                保存修改
              </button>
              <button 
                type="button" 
                onClick={handleSaveAsNewConfig} 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}
                title="保存为新的独立配置"
              >
                <Bookmark size={12} />
                另存常用
              </button>
              <button 
                type="button" 
                onClick={handleCancelConfigEdit} 
                className="btn btn-secondary" 
                style={{ padding: '4px 6px', fontSize: '11.5px' }}
                title="取消修改并清空表单"
              >
                取消
              </button>
            </div>
          ) : (
            <button 
              type="button" 
              onClick={handleSaveConfig} 
              className="btn btn-secondary" 
              style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Bookmark size={12} />
              保存常用
            </button>
          )}
        </form>

        {/* 常用配置 Dropdown */}
        {savedConfigs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>常用:</span>
            <select 
              value={selectedConfigIdx}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "") {
                  const cfg = savedConfigs[parseInt(val)];
                  handleLoadConfig(cfg, val);
                } else {
                  setSelectedConfigIdx('');
                }
              }}
              style={{ width: '120px', padding: '4px', fontSize: '11.5px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            >
              <option value="">-- 选择常用 --</option>
              {savedConfigs.map((cfg, idx) => (
                <option key={idx} value={idx}>{cfg.name || cfg.endpointUrl || `${cfg.ip}:${cfg.port}`}</option>
              ))}
            </select>
            {selectedConfigIdx !== '' && (
              <button
                type="button"
                onClick={(e) => handleDeleteConfig(e, parseInt(selectedConfigIdx))}
                style={{
                  background: 'rgba(255, 56, 96, 0.15)',
                  border: '1px solid rgba(255, 56, 96, 0.3)',
                  color: 'var(--color-danger)',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                title="删除此常用配置"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}

        {/* 活动连接 Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>通道:</span>
          <select 
            value={activeConnId || ''}
            onChange={(e) => {
              if (e.target.value) {
                const id = e.target.value;
                setActiveConnId(id);
                setNodeChildren({});
                setExpandedNodes({});
                setMonitoredNodes([]);
                const conn = connections.find(c => c.id === id);
                if (conn && conn.status === 'CONNECTED') {
                  handleBrowseNode(id, 'ns=0;i=84');
                }
              }
            }}
            style={{ width: '135px', padding: '4px 6px', fontSize: '11.5px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
          >
            <option value="">-- 活动通道 ({connections.length}) --</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status === 'CONNECTED' ? '已连接' : c.status === 'CONNECTING' ? '连接中' : '已断开'})
              </option>
            ))}
          </select>

          {/* 实时状态徽标 */}
          {activeConnection && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              background: activeConnection.status === 'CONNECTED' 
                ? 'rgba(0, 184, 148, 0.12)' 
                : activeConnection.status === 'CONNECTING'
                ? 'rgba(255, 170, 0, 0.12)'
                : 'rgba(255, 76, 76, 0.12)',
              border: `1px solid ${
                activeConnection.status === 'CONNECTED'
                  ? 'rgba(0, 184, 148, 0.3)'
                  : activeConnection.status === 'CONNECTING'
                  ? 'rgba(255, 170, 0, 0.3)'
                  : 'rgba(255, 76, 76, 0.3)'
              }`,
              color: activeConnection.status === 'CONNECTED'
                ? 'var(--color-success)'
                : activeConnection.status === 'CONNECTING'
                ? 'var(--color-warning)'
                : 'var(--color-danger)',
              flexShrink: 0
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: activeConnection.status === 'CONNECTED'
                  ? 'var(--color-success)'
                  : activeConnection.status === 'CONNECTING'
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)',
                boxShadow: activeConnection.status === 'CONNECTED' ? '0 0 6px var(--color-success)' : 'none'
              }} />
              {activeConnection.status === 'CONNECTED' ? '已连接' : activeConnection.status === 'CONNECTING' ? '连接中' : '已断开'}
            </div>
          )}

          {activeConnection && activeConnection.status !== 'DISCONNECTED' && (
            <button 
              onClick={() => handleDisconnect(activeConnection.id)} 
              style={{ 
                background: 'rgba(255, 56, 96, 0.15)', 
                border: '1px solid rgba(255, 56, 96, 0.3)', 
                color: 'var(--color-danger)', 
                cursor: 'pointer', 
                padding: '3px 8px', 
                borderRadius: '4px', 
                fontSize: '11px',
                flexShrink: 0
              }}
            >
              断开
            </button>
          )}
        </div>
      </div>

      {/* 下部主工作区 (左侧地址空间树 + 右侧点位监测与日志) */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden', 
        position: 'relative' 
      }}>
        {/* 左侧：地址空间树树状目录 (可拖动调节宽度，可折叠) */}
        <div style={{ 
          width: isLeftPanelCollapsed ? '40px' : `${leftPanelWidth}px`,
          minWidth: isLeftPanelCollapsed ? '40px' : `${leftPanelWidth}px`,
          maxWidth: isLeftPanelCollapsed ? '40px' : `${leftPanelWidth}px`,
          borderRight: '1px solid var(--border-color)', 
          background: 'var(--bg-card)', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          overflow: 'hidden',
          position: 'relative',
          transition: isResizingLeft ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {isLeftPanelCollapsed ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px', gap: '16px' }}>
              <button 
                onClick={() => setIsLeftPanelCollapsed(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-light)', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="展开地址树"
              >
                <ChevronRight size={14} />
              </button>
              <span style={{ writingMode: 'vertical-rl', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.6 }}>地址空间</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 16px', overflow: 'hidden', position: 'relative' }}>
              <button 
                onClick={() => setIsLeftPanelCollapsed(true)}
                style={{ 
                  position: 'absolute', 
                  top: '12px', 
                  right: '12px', 
                  zIndex: 10,
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  color: 'var(--text-muted)', 
                  padding: '4px', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="收起面板"
              >
                <ChevronLeft size={12} />
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)' }}>OPC UA 地址空间</span>
                {selectedTreeNodeIds.size > 0 && (
                  <button
                    onClick={async () => {
                      const flatNodes = getFlatVisibleNodes();
                      const nodesToAdd = flatNodes.filter(n => selectedTreeNodeIds.has(n.nodeId));
                      for (const n of nodesToAdd) {
                        await handleAddMonitoredNode(n);
                      }
                      setSelectedTreeNodeIds(new Set());
                    }}
                    className="btn btn-primary"
                    style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={11} />
                    添加 ({selectedTreeNodeIds.size})
                  </button>
                )}
              </div>

              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                overflowX: 'auto',
                background: 'rgba(0,0,0,0.03)', 
                borderRadius: '8px', 
                padding: '8px',
                border: '1px solid var(--border-color)'
              }}>
                {!activeConnId ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                    请先在上方连接服务器
                  </div>
                ) : activeConnection && activeConnection.status !== 'CONNECTED' ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                    通道未连接<br />(状态: {activeConnection.status})
                  </div>
                ) : nodeChildren['ns=0;i=84'] ? (
                  nodeChildren['ns=0;i=84'].map(node => renderTreeNode(node))
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    载入地址目录中...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 左侧侧边栏宽度拖拽调节手柄 */}
        {!isLeftPanelCollapsed && (
          <div 
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingLeft(true);
            }}
            style={{
              width: '6px',
              cursor: 'col-resize',
              position: 'relative',
              zIndex: 30,
              backgroundColor: isResizingLeft ? 'var(--color-primary)' : 'transparent',
              transition: 'background-color 0.2s',
              marginLeft: '-3px',
              marginRight: '-3px',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (!isResizingLeft) e.currentTarget.style.backgroundColor = 'var(--border-glow)';
            }}
            onMouseLeave={(e) => {
              if (!isResizingLeft) e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="按住左右拖动调整地址树宽度"
          />
        )}

        {/* ========================================================
            右侧区域：已选择点位实时表格监测 (横向展开，极致开阔) + 报文日志
            ======================================================== */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          overflow: 'hidden',
          minWidth: 0
        }}>
          
          {/* 上半部分：多点实时表格 (自适应拉伸铺满) */}
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '16px', 
            overflow: 'hidden',
            minHeight: 0
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-light)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="var(--color-primary)" />
                已选择点位实时监视舱 ({monitoredNodes.length})
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  (支持 Ctrl/Cmd/Shift 多选，按 Delete 键删除)
                </span>
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* 删除多选按钮 */}
                {selectedTableNodeIds.size > 0 && (
                  <button 
                    onClick={() => {
                      selectedTableNodeIds.forEach(id => {
                        handleRemoveMonitoredNode(id);
                      });
                      setSelectedTableNodeIds(new Set());
                    }}
                    className="btn" 
                    style={{ 
                      background: 'rgba(255, 56, 96, 0.15)', 
                      color: 'var(--color-danger)', 
                      border: '1px solid rgba(255, 56, 96, 0.3)',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={12} />
                    删除选中 ({selectedTableNodeIds.size})
                  </button>
                )}

                {/* 清空所有已选点位 */}
                {monitoredNodes.length > 0 && (
                  <button 
                    onClick={handleClearMonitoredNodes}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={12} />
                    清空监视舱
                  </button>
                )}
              </div>
            </div>

            {/* 点位监控表格容器 */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              background: 'var(--bg-card)' 
            }}>
              {monitoredNodes.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '8px' }}>
                  <Activity size={24} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '12px' }}>从左侧勾选或多选变量，添加至实时数据监测舱</span>
                </div>
              ) : (
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
                    <tr>
                      <th style={{ width: '30px' }}>
                        <input 
                          type="checkbox" 
                          checked={monitoredNodes.length > 0 && selectedTableNodeIds.size === monitoredNodes.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTableNodeIds(new Set(monitoredNodes.map(n => n.nodeId)));
                            } else {
                              setSelectedTableNodeIds(new Set());
                            }
                          }}
                          style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                        />
                      </th>
                      <th>点位名称</th>
                      <th>Node ID</th>
                      <th>当前数值 (Value)</th>
                      <th>数据类型</th>
                      <th>采集时标</th>
                      <th style={{ textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitoredNodes.map((node, idx) => {
                      const isSelected = selectedTableNodeIds.has(node.nodeId);
                      return (
                        <tr 
                          key={node.nodeId}
                          onClick={(e) => handleTableRowClick(e, node.nodeId, idx)}
                          style={{ 
                            background: isSelected ? 'var(--color-primary-glow, rgba(2, 132, 199, 0.12))' : 'transparent',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTableSelect(node.nodeId)}
                              style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                            />
                          </td>
                          <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                            {node.displayName || node.browseName}
                          </td>
                          <td style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                            {node.nodeId}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-success)' }}>
                            {formatValue(node.value)}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {node.dataType || 'Unknown'}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                            {node.sourceTimestamp ? formatTimestamp(node.sourceTimestamp) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {/* 详情与写入 */}
                              <button 
                                onClick={() => {
                                  setDetailNode(node);
                                  setWriteValue(node.value !== null && node.value !== undefined ? String(node.value) : '');
                                  setWriteDataType(node.dataType || 'Int32');
                                }}
                                className="btn btn-secondary"
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="查看节点详情与写入值"
                              >
                                <Edit2 size={11} />
                                详情
                              </button>
                              {/* 删除 */}
                              <button 
                                onClick={() => handleRemoveMonitoredNode(node.nodeId)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 底部日志区域高度拖拽调节手柄 */}
          <div 
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingBottom(true);
            }}
            style={{
              height: '6px',
              cursor: 'row-resize',
              position: 'relative',
              zIndex: 30,
              backgroundColor: isResizingBottom ? 'var(--color-primary)' : 'transparent',
              transition: 'background-color 0.2s',
              marginTop: '-3px',
              marginBottom: '-3px',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (!isResizingBottom) e.currentTarget.style.backgroundColor = 'var(--border-glow)';
            }}
            onMouseLeave={(e) => {
              if (!isResizingBottom) e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="按住上下拖动调整日志区域高度"
          />

          {/* 下半部分：通信日志 (高度由 bottomPanelHeight 动态控制) */}
          <div style={{ 
            height: `${bottomPanelHeight}px`,
            minHeight: `${bottomPanelHeight}px`,
            maxHeight: `${bottomPanelHeight}px`,
            borderTop: '1px solid var(--border-color)', 
            background: 'var(--bg-card)', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            flexShrink: 0
          }}>
          <div style={{ 
            padding: '8px 16px', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexShrink: 0
          }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Activity size={14} color="var(--color-primary)" />
              OPC UA 协议及报文监视日志
            </h4>
            <button 
              onClick={() => setTrafficLogs([])} 
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              清空日志
            </button>
          </div>

          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '8px 16px', 
            fontFamily: 'var(--font-mono)', 
            fontSize: '11.5px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '4px' 
          }}>
            {trafficLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '30px' }}>暂无通信数据</div>
            ) : (
              trafficLogs.map((log, idx) => {
                const isSend = log.dir === 'send';
                const isLog = log.dir === 'LOG';
                let dirColor = 'var(--color-primary)';
                let dirText = '→';
                if (log.dir === 'receive') {
                  dirColor = 'var(--color-success)';
                  dirText = '←';
                } else if (isLog) {
                  dirColor = '#eccc68';
                  dirText = 'ℹ';
                }

                return (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: '6px 8px', 
                    background: 'rgba(255,255,255,0.01)', 
                    borderRadius: '4px',
                    borderLeft: `2px solid ${dirColor}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: dirColor, fontWeight: '700' }}>
                        {dirText} {isLog ? 'SYSTEM' : log.dir.toUpperCase()} [{log.type}] {log.desc}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.payload && (
                      <pre style={{ 
                        margin: '2px 0 0 0', 
                        padding: '4px 6px', 
                        background: 'rgba(0,0,0,0.25)', 
                        borderRadius: '4px', 
                        color: 'var(--text-muted)',
                        fontSize: '10.5px',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        {log.payload}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. 浮动元素详情弹出窗口 (Backdrop Modal) */}
      {detailNode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{
            width: '460px',
            background: 'rgba(15, 20, 30, 0.95)',
            border: '1px solid var(--color-primary-glow)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
            animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* 模态头 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="var(--color-primary)" />
                点位详细监控与控制舱
              </h3>
              <button 
                onClick={() => setDetailNode(null)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  fontSize: '22px', 
                  cursor: 'pointer', 
                  lineHeight: '1',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            {/* 核心展示值 */}
            <div style={{ 
              background: 'rgba(0, 0, 0, 0.35)', 
              padding: '16px 12px', 
              borderRadius: '8px', 
              textAlign: 'center', 
              border: '1px solid rgba(255,255,255,0.03)' 
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>
                当前实时数值 (Value)
              </span>
              <strong style={{ fontSize: '26px', color: 'var(--color-success)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', textShadow: '0 0 10px rgba(0, 184, 148, 0.25)' }}>
                {detailNode.value !== null ? detailNode.value.toString() : 'NULL'}
              </strong>
            </div>

            {/* 属性表格 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>节点名称:</span>
                <strong style={{ color: '#fff' }}>{detailNode.displayName || detailNode.browseName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Node ID:</span>
                <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', userSelect: 'all' }}>{detailNode.nodeId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>数据类型:</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{detailNode.dataType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>采集时标:</span>
                <span style={{ color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>{detailNode.sourceTimestamp || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>数据质量状态:</span>
                <span style={{ 
                  color: detailNode.statusCode && detailNode.statusCode.includes('Good') ? 'var(--color-success)' : 'var(--color-danger)', 
                  fontWeight: '700'
                }}>
                  {detailNode.statusCode || 'Unknown'}
                </span>
              </div>
            </div>

            {/* 修改写入数据表单 */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (writeValue === '') return;
              setWriting(true);
              try {
                const res = await window.api.opcua.writeNode(activeConnId, {
                  nodeId: detailNode.nodeId,
                  value: writeValue,
                  dataType: writeDataType
                });
                if (res.success) {
                  const readRes = await window.api.opcua.readNode(activeConnId, detailNode.nodeId);
                  if (readRes.success) {
                    setDetailNode(prev => ({ ...prev, ...readRes.data }));
                    setMonitoredNodes(prev => prev.map(m => m.nodeId === detailNode.nodeId ? { ...m, ...readRes.data } : m));
                  }
                  setWriteValue('');
                } else {
                  alert(`写入失败: ${res.error}`);
                }
              } catch (err) {
                alert(`写入异常: ${err.message}`);
              } finally {
                setWriting(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: '700' }}>修改写入数据</span>
              <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '8px' }}>
                <select 
                  className="input-field" 
                  value={writeDataType} 
                  onChange={e => setWriteDataType(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '11.5px', padding: '6px' }}
                >
                  <option value="Boolean">Boolean</option>
                  <option value="Byte">Byte</option>
                  <option value="SByte">SByte</option>
                  <option value="Int16">Int16</option>
                  <option value="UInt16">UInt16</option>
                  <option value="Int32">Int32</option>
                  <option value="UInt32">UInt32</option>
                  <option value="Float">Float</option>
                  <option value="Double">Double</option>
                  <option value="String">String</option>
                </select>
                <input 
                  type="text" 
                  className="input-field" 
                  value={writeValue} 
                  onChange={e => setWriteValue(e.target.value)} 
                  placeholder={writeDataType === 'Boolean' ? 'true / false' : '输入目标写入值'}
                  style={{ fontSize: '12px', padding: '6px' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 0', fontSize: '12px' }} disabled={writing}>
                {writing ? '正在写入数据...' : '发送修改指令'}
              </button>
            </form>

            {/* 底栏动作按钮 */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
              <button 
                type="button" 
                onClick={async () => {
                  setReading(true);
                  try {
                    const res = await window.api.opcua.readNode(activeConnId, detailNode.nodeId);
                    if (res.success) {
                      setDetailNode(prev => ({ ...prev, ...res.data }));
                      setMonitoredNodes(prev => prev.map(m => m.nodeId === detailNode.nodeId ? { ...m, ...res.data } : m));
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setReading(false);
                  }
                }}
                className="btn btn-secondary" 
                style={{ padding: '5px 12px', fontSize: '12px' }}
                disabled={reading}
              >
                {reading ? '正在读取...' : '手动刷新'}
              </button>
              <button 
                type="button" 
                onClick={() => setDetailNode(null)} 
                className="btn btn-secondary" 
                style={{ padding: '5px 12px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                关闭窗口
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
