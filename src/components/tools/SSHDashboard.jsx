import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, Terminal, Plus, Folder, File, Trash2, Edit3, RefreshCw, 
  UploadCloud, DownloadCloud, FolderPlus, X, Send, Play, Layers,
  ChevronRight, ChevronDown, Check, AlertCircle, Key, Lock, Eye, EyeOff
} from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default function SSHDashboard() {
  // Hosts management (Termius style)
  const [hosts, setHosts] = useState(() => {
    const saved = localStorage.getItem('debugtoolbox:ssh-hosts');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'sample-1', name: '阿里云测试机', host: '192.168.1.100', port: 22, username: 'root', authType: 'password', password: '', group: '开发环境' },
      { id: 'sample-2', name: '腾讯云公网机', host: '8.8.8.8', port: 22, username: 'ubuntu', authType: 'key', privateKeyPath: '', passphrase: '', group: '生产环境' }
    ];
  });

  const [groups, setGroups] = useState(['开发环境', '生产环境', '测试环境']);
  const [activeGroup, setActiveGroup] = useState('All');
  
  // Host Editor State
  const [showHostEditor, setShowHostEditor] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  
  // Host Form State
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState('22');
  const [formUsername, setFormUsername] = useState('root');
  const [formAuthType, setFormAuthType] = useState('password'); // 'password' | 'key'
  const [formPassword, setFormPassword] = useState('');
  const [formPrivateKeyPath, setFormPrivateKeyPath] = useState('');
  const [formPassphrase, setFormPassphrase] = useState('');
  const [formGroup, setFormGroup] = useState('开发环境');
  const [showPassword, setShowPassword] = useState(false);

  // Tabs Management (Xshell style)
  const [tabs, setTabs] = useState([]); // { id, name, host, username, status, connected }
  const [activeTabId, setActiveTabId] = useState(null);

  // Quick Command Broadcaster State (Xshell style)
  const [broadcastCmd, setBroadcastCmd] = useState('');

  // SFTP Explorer State (WindTerm style)
  const [showSftp, setShowSftp] = useState(true);
  const [sftpPath, setSftpPath] = useState('/');
  const [sftpFiles, setSftpFiles] = useState([]);
  const [sftpLoading, setSftpLoading] = useState(false);
  const [sftpError, setSftpError] = useState(null);
  const [sftpTransfers, setSftpTransfers] = useState([]); // { id, filename, type, progress, status }

  // Terminal instances refs
  const terminalRefs = useRef({}); // sessionId -> terminalInstance
  const fitAddonRefs = useRef({}); // sessionId -> fitAddonInstance
  const containerRefs = useRef({}); // sessionId -> HTMLDivElement
  
  // Quick Connect State
  const [quickConnectInput, setQuickConnectInput] = useState('');

  // Persist hosts
  useEffect(() => {
    localStorage.setItem('debugtoolbox:ssh-hosts', JSON.stringify(hosts));
  }, [hosts]);

  // Global SSH data stream receiver
  useEffect(() => {
    const removeDataListener = window.api.ssh.onData(({ sessionId, data }) => {
      const term = terminalRefs.current[sessionId];
      if (term) {
        term.write(data);
      }
    });

    const removeStatusListener = window.api.ssh.onStatus(({ sessionId, status, host, username }) => {
      setTabs(prev => prev.map(t => {
        if (t.id === sessionId) {
          const isConnected = status === 'connected';
          return { ...t, status: isConnected ? '已连接' : '已断开', connected: isConnected };
        }
        return t;
      }));

      // Trigger SFTP load on connection
      if (status === 'connected' && sessionId === activeTabId) {
        loadSftp(sessionId, '/');
      }
    });

    const removeErrorListener = window.api.ssh.onError(({ sessionId, message }) => {
      const term = terminalRefs.current[sessionId];
      if (term) {
        term.write(`\r\n\x1b[31m[错误] 连接发生异常: ${message}\x1b[0m\r\n`);
      }
      setTabs(prev => prev.map(t => {
        if (t.id === sessionId) {
          return { ...t, status: '错误', connected: false };
        }
        return t;
      }));
    });

    const removeSftpProgressListener = window.api.sftp.onProgress(({ sessionId, type, remotePath, localPath, percent }) => {
      const filename = remotePath.split('/').pop() || localPath.split(/[/\\]/).pop();
      setSftpTransfers(prev => {
        const existingIdx = prev.findIndex(t => t.sessionId === sessionId && t.filename === filename && t.type === type);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            progress: percent,
            status: percent >= 100 ? 'completed' : 'running'
          };
          return updated;
        } else {
          return [...prev, {
            id: Date.now().toString(),
            sessionId,
            filename,
            type,
            progress: percent,
            status: 'running'
          }];
        }
      });

      if (percent >= 100 && sessionId === activeTabId) {
        // Refresh directory list after complete transfer
        setTimeout(() => loadSftp(sessionId, sftpPath), 800);
      }
    });

    return () => {
      removeDataListener();
      removeStatusListener();
      removeErrorListener();
      removeSftpProgressListener();
    };
  }, [activeTabId, sftpPath]);

  // Clean up terminals when dashboard unmounts
  useEffect(() => {
    return () => {
      tabs.forEach(tab => {
        window.api.ssh.disconnect(tab.id);
      });
    };
  }, []);

  // Sync SFTP when active tab changes
  useEffect(() => {
    if (activeTabId) {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.connected) {
        loadSftp(activeTabId, sftpPath || '/');
      } else {
        setSftpFiles([]);
        setSftpError('终端未连接，无法加载 SFTP');
      }
    } else {
      setSftpFiles([]);
      setSftpError('无活跃的终端连接');
    }
  }, [activeTabId, tabs]);

  // Trigger resize on window change or sidebars collapse
  const handleWindowResize = () => {
    if (activeTabId && fitAddonRefs.current[activeTabId]) {
      try {
        fitAddonRefs.current[activeTabId].fit();
        const term = terminalRefs.current[activeTabId];
        if (term) {
          window.api.ssh.resize(activeTabId, term.cols, term.rows);
        }
      } catch (e) {
        console.warn(e);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [activeTabId]);

  // Mount terminal for a new tab
  const initTerminal = (tabId) => {
    setTimeout(() => {
      const container = containerRefs.current[tabId];
      if (!container || terminalRefs.current[tabId]) return;

      const term = new XTerm({
        theme: {
          background: '#090a0f',
          foreground: '#ccd6f6',
          cursor: '#00e5ff',
          cursorAccent: '#090a0f',
          selectionBackground: 'rgba(0, 229, 255, 0.3)',
          black: '#090a0f',
          red: '#ff3860',
          green: '#39ff14',
          yellow: '#ffb300',
          blue: '#0052d4',
          magenta: '#a29bfe',
          cyan: '#00e5ff',
          white: '#ccd6f6'
        },
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        cursorBlink: true,
        scrollback: 10000,
        rows: 24,
        cols: 80
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();

      term.onData(data => {
        window.api.ssh.write(tabId, data);
      });

      terminalRefs.current[tabId] = term;
      fitAddonRefs.current[tabId] = fitAddon;

      // Register initial resize
      window.api.ssh.resize(tabId, term.cols, term.rows);
      term.focus();
    }, 100);
  };

  // Connect to Host
  const connectHost = async (hostObj) => {
    const tabId = `ssh-${Date.now()}`;
    const newTab = {
      id: tabId,
      name: hostObj.name || hostObj.host,
      host: hostObj.host,
      username: hostObj.username,
      status: '连接中...',
      connected: false
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);

    // Give react time to mount container
    setTimeout(async () => {
      initTerminal(tabId);
      
      const res = await window.api.ssh.connect(tabId, {
        host: hostObj.host,
        port: parseInt(hostObj.port) || 22,
        username: hostObj.username,
        authType: hostObj.authType,
        password: hostObj.password,
        privateKeyPath: hostObj.privateKeyPath,
        passphrase: hostObj.passphrase
      });

      if (!res.success) {
        const term = terminalRefs.current[tabId];
        if (term) {
          term.write(`\r\n\x1b[31m[错误] 无法连接到服务器: ${res.error}\x1b[0m\r\n`);
        }
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: '连接失败' } : t));
      }
    }, 150);
  };

  // Quick Connect Submit
  const handleQuickConnect = () => {
    if (!quickConnectInput) return;
    // Format: username@host:port
    let username = 'root';
    let hostPortStr = quickConnectInput;
    
    if (quickConnectInput.includes('@')) {
      const parts = quickConnectInput.split('@');
      username = parts[0];
      hostPortStr = parts[1];
    }
    
    let host = hostPortStr;
    let port = 22;
    if (hostPortStr.includes(':')) {
      const parts = hostPortStr.split(':');
      host = parts[0];
      port = parseInt(parts[1]) || 22;
    }

    // Prompt for password
    const pwd = prompt(`请输入 ${username}@${host}:${port} 的连接密码:`);
    if (pwd === null) return;

    connectHost({
      name: `${username}@${host}`,
      host,
      port,
      username,
      authType: 'password',
      password: pwd
    });
  };

  // Close tab
  const closeTab = (tabId) => {
    window.api.ssh.disconnect(tabId);
    
    // Cleanup refs
    if (terminalRefs.current[tabId]) {
      terminalRefs.current[tabId].dispose();
      delete terminalRefs.current[tabId];
    }
    delete fitAddonRefs.current[tabId];
    delete containerRefs.current[tabId];

    const tabIdx = tabs.findIndex(t => t.id === tabId);
    const updatedTabs = tabs.filter(t => t.id !== tabId);
    setTabs(updatedTabs);

    if (activeTabId === tabId) {
      if (updatedTabs.length > 0) {
        const nextActiveIdx = Math.max(0, tabIdx - 1);
        setActiveTabId(updatedTabs[nextActiveIdx].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  // Command Broadcaster Submit (Xshell style)
  const sendCommand = (broadcast) => {
    if (!broadcastCmd) return;
    
    const cmdStr = broadcastCmd + '\n';
    if (broadcast) {
      // Send to all connected tabs
      tabs.forEach(tab => {
        if (tab.connected) {
          window.api.ssh.write(tab.id, cmdStr);
        }
      });
    } else {
      // Send to active tab
      if (activeTabId) {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.connected) {
          window.api.ssh.write(activeTabId, cmdStr);
        }
      }
    }
    setBroadcastCmd('');
  };

  // SFTP Operations (WindTerm style)
  const loadSftp = async (sessionId, pathStr) => {
    setSftpLoading(true);
    setSftpError(null);
    try {
      const res = await window.api.sftp.list(sessionId, pathStr);
      if (res.success) {
        setSftpFiles(res.list);
        setSftpPath(pathStr);
      } else {
        setSftpError(res.error);
      }
    } catch (e) {
      setSftpError(e.message);
    } finally {
      setSftpLoading(false);
    }
  };

  const handleSftpNavigate = (filename, type) => {
    if (type !== 'd') return;
    let newPath = sftpPath;
    if (filename === '..') {
      const parts = sftpPath.split('/').filter(Boolean);
      parts.pop();
      newPath = '/' + parts.join('/');
    } else {
      newPath = sftpPath.endsWith('/') ? `${sftpPath}${filename}` : `${sftpPath}/${filename}`;
    }
    loadSftp(activeTabId, newPath);
  };

  // Create Remote Folder
  const sftpCreateFolder = async () => {
    if (!activeTabId) return;
    const folderName = prompt('请输入新建文件夹名称:');
    if (!folderName) return;

    const fullPath = sftpPath.endsWith('/') ? `${sftpPath}${folderName}` : `${sftpPath}/${folderName}`;
    const res = await window.api.sftp.mkdir(activeTabId, fullPath);
    if (res.success) {
      loadSftp(activeTabId, sftpPath);
    } else {
      alert(`创建文件夹失败: ${res.error}`);
    }
  };

  // Delete SFTP File/Dir
  const sftpDelete = async (filename, type) => {
    if (!activeTabId) return;
    if (!confirm(`确定要删除 ${filename} 吗？`)) return;

    const fullPath = sftpPath.endsWith('/') ? `${sftpPath}${filename}` : `${sftpPath}/${filename}`;
    let res;
    if (type === 'd') {
      res = await window.api.sftp.rmdir(activeTabId, fullPath);
    } else {
      res = await window.api.sftp.deleteFile(activeTabId, fullPath);
    }

    if (res.success) {
      loadSftp(activeTabId, sftpPath);
    } else {
      alert(`删除失败: ${res.error}`);
    }
  };

  // Upload file
  const sftpUpload = async () => {
    if (!activeTabId) return;
    const localPath = await window.api.dialog.openFile({
      title: '选择要上传的文件',
      properties: ['openFile']
    });
    if (!localPath) return;

    const filename = localPath.split(/[/\\]/).pop();
    const remoteDest = sftpPath.endsWith('/') ? `${sftpPath}${filename}` : `${sftpPath}/${filename}`;
    
    // Add pending transfer state
    setSftpTransfers(prev => [...prev, {
      id: Date.now().toString(),
      sessionId: activeTabId,
      filename,
      type: 'upload',
      progress: 0,
      status: 'pending'
    }]);

    const res = await window.api.sftp.upload(activeTabId, localPath, remoteDest);
    if (!res.success) {
      alert(`文件上传失败: ${res.error}`);
    }
  };

  // Download file
  const sftpDownload = async (filename) => {
    if (!activeTabId) return;
    const localPath = await window.api.dialog.saveFile({
      title: '另存为',
      defaultPath: filename
    });
    if (!localPath) return;

    const remoteSource = sftpPath.endsWith('/') ? `${sftpPath}${filename}` : `${sftpPath}/${filename}`;
    
    // Add pending transfer state
    setSftpTransfers(prev => [...prev, {
      id: Date.now().toString(),
      sessionId: activeTabId,
      filename,
      type: 'download',
      progress: 0,
      status: 'pending'
    }]);

    const res = await window.api.sftp.download(activeTabId, remoteSource, localPath);
    if (!res.success) {
      alert(`文件下载失败: ${res.error}`);
    }
  };

  // Select Private Key Path
  const selectKeyPath = async () => {
    const file = await window.api.dialog.openFile({
      title: '选择私钥文件',
      properties: ['openFile']
    });
    if (file) {
      setFormPrivateKeyPath(file);
    }
  };

  // Host Editor save/add
  const saveHost = (e) => {
    e.preventDefault();
    if (!formHost) return;

    const newHost = {
      id: editingHost ? editingHost.id : `host-${Date.now()}`,
      name: formName || formHost,
      host: formHost,
      port: parseInt(formPort) || 22,
      username: formUsername,
      authType: formAuthType,
      password: formPassword,
      privateKeyPath: formPrivateKeyPath,
      passphrase: formPassphrase,
      group: formGroup
    };

    if (editingHost) {
      setHosts(prev => prev.map(h => h.id === editingHost.id ? newHost : h));
    } else {
      setHosts(prev => [...prev, newHost]);
    }

    closeHostEditor();
  };

  const closeHostEditor = () => {
    setShowHostEditor(false);
    setEditingHost(null);
    setFormName('');
    setFormHost('');
    setFormPort('22');
    setFormUsername('root');
    setFormAuthType('password');
    setFormPassword('');
    setFormPrivateKeyPath('');
    setFormPassphrase('');
  };

  const openEditHost = (hostObj, event) => {
    event.stopPropagation(); // Avoid triggering connection
    setEditingHost(hostObj);
    setFormName(hostObj.name);
    setFormHost(hostObj.host);
    setFormPort(hostObj.port.toString());
    setFormUsername(hostObj.username);
    setFormAuthType(hostObj.authType);
    setFormPassword(hostObj.password || '');
    setFormPrivateKeyPath(hostObj.privateKeyPath || '');
    setFormPassphrase(hostObj.passphrase || '');
    setFormGroup(hostObj.group || '开发环境');
    setShowHostEditor(true);
  };

  const deleteHost = (hostId, event) => {
    event.stopPropagation();
    if (confirm('确定要删除此主机配置吗？')) {
      setHosts(prev => prev.filter(h => h.id !== hostId));
    }
  };

  // Helper: Format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter hosts by group
  const filteredHosts = hosts.filter(h => activeGroup === 'All' || h.group === activeGroup);

  return (
    <div className="ssh-dashboard-container">
      {/* 1. Host Selector Sidebar (Termius style) */}
      <aside className="host-sidebar">
        <div className="sidebar-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={16} color="var(--color-primary)" />
            <span>会话管理器 (Termius)</span>
          </div>
          <button className="icon-btn-primary" onClick={() => setShowHostEditor(true)}>
            <Plus size={14} />
          </button>
        </div>

        {/* Group Filter Tabs */}
        <div className="group-tabs">
          <button 
            className={`group-tab ${activeGroup === 'All' ? 'active' : ''}`}
            onClick={() => setActiveGroup('All')}
          >
            全部 ({hosts.length})
          </button>
          {groups.map(g => (
            <button 
              key={g} 
              className={`group-tab ${activeGroup === g ? 'active' : ''}`}
              onClick={() => setActiveGroup(g)}
            >
              {g} ({hosts.filter(h => h.group === g).length})
            </button>
          ))}
        </div>

        {/* Host List Grid */}
        <div className="host-list-scroll">
          {filteredHosts.length === 0 ? (
            <div className="empty-hosts-placeholder">
              <AlertCircle size={28} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
              <div>暂无主机配置</div>
              <button className="text-btn" onClick={() => setShowHostEditor(true)}>立即新建</button>
            </div>
          ) : (
            filteredHosts.map(hostObj => (
              <div 
                key={hostObj.id} 
                className="host-card"
                onDoubleClick={() => connectHost(hostObj)}
              >
                <div className="host-card-border-indicator" style={{ 
                  background: hostObj.group === '生产环境' ? 'var(--color-danger)' : 
                              hostObj.group === '测试环境' ? 'var(--color-warning)' : 'var(--color-primary)'
                }} />
                <div className="host-card-info" title="双击连接主机">
                  <div className="host-card-title">{hostObj.name}</div>
                  <div className="host-card-sub">{hostObj.username}@{hostObj.host}:{hostObj.port}</div>
                  <span className="host-card-badge">{hostObj.group}</span>
                </div>
                <div className="host-card-actions">
                  <button className="action-btn" onClick={(e) => openEditHost(hostObj, e)}>
                    <Edit3 size={12} />
                  </button>
                  <button className="action-btn text-danger" onClick={(e) => deleteHost(hostObj.id, e)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 2. Main Terminal Panel (Xshell style) */}
      <section className="terminal-workspace">
        {/* Quick Connect Bar */}
        <div className="quick-connect-bar">
          <input 
            type="text" 
            placeholder="快速连接: root@192.168.1.100:22 (输入后回车)" 
            value={quickConnectInput}
            onChange={(e) => setQuickConnectInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickConnect(); }}
            className="quick-connect-input"
          />
          <button className="btn-primary" onClick={handleQuickConnect}>连接</button>
        </div>

        {/* Tab Headers */}
        <div className="tab-headers-bar">
          {tabs.map(tab => (
            <div 
              key={tab.id} 
              className={`terminal-tab-header ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => {
                setActiveTabId(tab.id);
                // Trigger refit on next tick
                setTimeout(handleWindowResize, 50);
              }}
            >
              <Terminal size={12} className="tab-icon" color={tab.connected ? 'var(--color-success)' : 'var(--color-inactive)'} />
              <span className="tab-title" title={tab.host}>{tab.name}</span>
              <button 
                className="tab-close-btn" 
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {tabs.length === 0 && (
            <div className="no-tabs-label">双击左侧会话或使用快速连接开启 SSH 终端</div>
          )}
        </div>

        {/* Terminal Content Containers */}
        <div className="terminal-containers-wrapper">
          {tabs.map(tab => (
            <div 
              key={tab.id}
              ref={el => containerRefs.current[tab.id] = el}
              className="terminal-container"
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            />
          ))}
          {tabs.length === 0 && (
            <div className="terminal-welcome-screen">
              <div className="welcome-glow-logo">
                <Terminal size={48} color="var(--color-primary)" />
              </div>
              <h2>工控现场 SSH 融合终端</h2>
              <p>融合 Xshell 广播 / Termius 主机配置 / WindTerm 边栏文件浏览</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="welcome-btn" onClick={() => setShowHostEditor(true)}>
                  新建主机配置
                </button>
                <button className="welcome-btn secondary" onClick={() => {
                  setQuickConnectInput('root@127.0.0.1');
                }}>
                  快速连接 localhost
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Command Broadcaster (Xshell style) */}
        {tabs.length > 0 && (
          <div className="broadcaster-bar">
            <div className="broadcaster-icon-wrapper" title="广播栏：一次性向所有终端或当前终端键入命令">
              <Send size={14} color="var(--color-primary)" />
            </div>
            <input 
              type="text" 
              placeholder="快捷输入栏 (回车发送到当前，Ctrl+Enter广播到所有)" 
              value={broadcastCmd}
              onChange={(e) => setBroadcastCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.ctrlKey || e.metaKey) {
                    sendCommand(true);
                  } else {
                    sendCommand(false);
                  }
                }
              }}
              className="broadcaster-input"
            />
            <button className="broadcaster-btn" onClick={() => sendCommand(false)}>发送</button>
            <button className="broadcaster-btn broadcast" onClick={() => sendCommand(true)} title="向所有打开并连接着的 SSH 终端广播这条指令">
              <Layers size={12} style={{ marginRight: '4px' }} /> 广播所有 ({tabs.filter(t => t.connected).length})
            </button>
          </div>
        )}
      </section>

      {/* 3. SFTP Explorer Drawer (WindTerm style) */}
      <aside className={`sftp-drawer ${showSftp ? 'open' : 'collapsed'}`}>
        <button className="sftp-toggle-tab" onClick={() => setShowSftp(!showSftp)}>
          <Folder size={14} style={{ marginRight: '6px' }} />
          <span>{showSftp ? '文件管理 (WindTerm)' : 'SFTP'}</span>
        </button>

        {showSftp && (
          <div className="sftp-content-box">
            {/* SFTP Connection status checking */}
            {!activeTabId || !tabs.find(t => t.id === activeTabId)?.connected ? (
              <div className="sftp-offline-message">
                <AlertCircle size={20} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                <span>无活跃的 SSH 连接</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                  连接服务器后，此处将自动挂载远程 SFTP 文件管理器
                </span>
              </div>
            ) : (
              <>
                {/* SFTP Toolbar */}
                <div className="sftp-toolbar">
                  <button className="sftp-tool-btn" onClick={() => handleSftpNavigate('..', 'd')} title="返回上级目录">
                    返回上级
                  </button>
                  <button className="sftp-tool-btn" onClick={() => loadSftp(activeTabId, sftpPath)} title="刷新当前目录">
                    <RefreshCw size={12} className={sftpLoading ? 'spin' : ''} />
                  </button>
                  <button className="sftp-tool-btn" onClick={sftpCreateFolder} title="新建远程文件夹">
                    <FolderPlus size={12} /> 新建
                  </button>
                  <button className="sftp-tool-btn primary" onClick={sftpUpload} title="选择文件上传到当前路径">
                    <UploadCloud size={12} /> 上传
                  </button>
                </div>

                {/* SFTP Path Breadcrumb */}
                <div className="sftp-path-bar" title={sftpPath}>
                  路径: {sftpPath}
                </div>

                {/* SFTP File List */}
                <div className="sftp-file-list-scroll">
                  {sftpLoading ? (
                    <div className="sftp-loading-state">
                      <RefreshCw size={20} className="spin" />
                      <span>正在检索远程目录...</span>
                    </div>
                  ) : sftpError ? (
                    <div className="sftp-error-state">
                      <AlertCircle size={16} color="var(--color-danger)" />
                      <span>{sftpError}</span>
                      <button className="text-btn" onClick={() => loadSftp(activeTabId, sftpPath)}>重试</button>
                    </div>
                  ) : sftpFiles.length === 0 ? (
                    <div className="sftp-empty-state">空目录</div>
                  ) : (
                    <table className="sftp-table">
                      <thead>
                        <tr>
                          <th>名称</th>
                          <th style={{ width: '70px', textAlign: 'right' }}>大小</th>
                          <th style={{ width: '70px', textAlign: 'center' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sftpPath !== '/' && (
                          <tr className="sftp-row" onDoubleClick={() => handleSftpNavigate('..', 'd')}>
                            <td>
                              <span className="file-name-cell">
                                <Folder size={14} color="var(--color-warning)" style={{ marginRight: '6px' }} />
                                ..
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                            <td></td>
                          </tr>
                        )}
                        {sftpFiles.map(file => (
                          <tr 
                            key={file.name} 
                            className="sftp-row"
                            onDoubleClick={() => handleSftpNavigate(file.name, file.type)}
                          >
                            <td>
                              <span className="file-name-cell" title={file.name}>
                                {file.type === 'd' ? (
                                  <Folder size={14} color="var(--color-warning)" style={{ marginRight: '6px', flexShrink: 0 }} />
                                ) : (
                                  <File size={14} color="var(--color-inactive)" style={{ marginRight: '6px', flexShrink: 0 }} />
                                )}
                                <span className="truncate-text">{file.name}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '11px' }}>
                              {file.type === 'd' ? '-' : formatBytes(file.size)}
                            </td>
                            <td>
                              <div className="sftp-row-actions">
                                {file.type !== 'd' && (
                                  <button className="sftp-action-btn" onClick={() => sftpDownload(file.name)} title="另存到本地">
                                    <DownloadCloud size={11} />
                                  </button>
                                )}
                                <button className="sftp-action-btn delete" onClick={() => sftpDelete(file.name, file.type)} title="删除文件">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* SFTP Transfers Status */}
                {sftpTransfers.length > 0 && (
                  <div className="sftp-transfers-panel">
                    <div className="transfers-header">
                      <span>传输队列 ({sftpTransfers.filter(t => t.status === 'running').length})</span>
                      <button className="text-btn" onClick={() => setSftpTransfers([])}>清除已完成</button>
                    </div>
                    <div className="transfers-list">
                      {sftpTransfers.map(t => (
                        <div key={t.id} className="transfer-item">
                          <div className="transfer-info">
                            <span className="transfer-name" title={t.filename}>{t.filename}</span>
                            <span className="transfer-badge" style={{ background: t.type === 'upload' ? '#39ff141a' : '#00e5ff1a', color: t.type === 'upload' ? 'var(--color-success)' : 'var(--color-primary)' }}>
                              {t.type === 'upload' ? '上传' : '下载'}
                            </span>
                          </div>
                          <div className="transfer-progress-track">
                            <div className="transfer-progress-fill" style={{ width: `${t.progress}%`, background: t.status === 'completed' ? 'var(--color-success)' : 'var(--color-primary)' }} />
                          </div>
                          <div className="transfer-percent">{t.progress}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </aside>

      {/* 4. Host Config Dialog / Drawer (Termius Editor style) */}
      {showHostEditor && (
        <div className="modal-backdrop">
          <div className="host-editor-modal glass">
            <div className="modal-header">
              <h3>{editingHost ? '编辑主机配置' : '新建主机配置'}</h3>
              <button className="icon-btn" onClick={closeHostEditor}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveHost} className="host-editor-form">
              <div className="form-group-row">
                <div className="form-field">
                  <label>主机别名</label>
                  <input type="text" placeholder="例如: 树莓派4" value={formName} onChange={e => setFormName(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>分组标签</label>
                  <select value={formGroup} onChange={e => setFormGroup(e.target.value)}>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-field flex-3">
                  <label>主机 IP / 域名 *</label>
                  <input type="text" required placeholder="192.168.1.50" value={formHost} onChange={e => setFormHost(e.target.value)} />
                </div>
                <div className="form-field flex-1">
                  <label>端口 *</label>
                  <input type="number" required placeholder="22" value={formPort} onChange={e => setFormPort(e.target.value)} />
                </div>
              </div>

              <div className="form-field">
                <label>用户名 *</label>
                <input type="text" required placeholder="root" value={formUsername} onChange={e => setFormUsername(e.target.value)} />
              </div>

              <div className="form-field">
                <label>身份校验方式</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input type="radio" checked={formAuthType === 'password'} onChange={() => setFormAuthType('password')} />
                    <span>密码认证</span>
                  </label>
                  <label className="radio-label">
                    <input type="radio" checked={formAuthType === 'key'} onChange={() => setFormAuthType('key')} />
                    <span>SSH 私钥认证</span>
                  </label>
                </div>
              </div>

              {formAuthType === 'password' ? (
                <div className="form-field relative">
                  <label>登录密码</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="连接密码" 
                      value={formPassword} 
                      onChange={e => setFormPassword(e.target.value)} 
                    />
                    <button type="button" className="pwd-toggle" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-field">
                    <label>私钥文件路径</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="点击右侧选择私钥文件或在此输入绝对路径" 
                        value={formPrivateKeyPath} 
                        onChange={e => setFormPrivateKeyPath(e.target.value)} 
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn-secondary" onClick={selectKeyPath}>选择文件</button>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>私钥密码 ( passphrase，如无则留空 )</label>
                    <input 
                      type="password" 
                      placeholder="私钥密码" 
                      value={formPassphrase} 
                      onChange={e => setFormPassphrase(e.target.value)} 
                    />
                  </div>
                </>
              )}

              <div className="modal-footer-btns">
                <button type="button" className="btn-secondary" onClick={closeHostEditor}>取消</button>
                <button type="submit" className="btn-primary">保存配置</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Component Specific CSS overrides & scoped styling */}
      <style>{`
        .ssh-dashboard-container {
          display: flex;
          width: 100%;
          height: 100%;
          background: var(--bg-primary);
          overflow: hidden;
        }

        /* 1. Host Sidebar */
        .host-sidebar {
          width: 280px;
          background: rgba(16, 18, 26, 0.5);
          border-right: 1px solid var(--border-color);
          display: flex;
          flexDirection: column;
          height: 100%;
          flex-shrink: 0;
          overflow: hidden;
        }

        .sidebar-section-header {
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-color);
          font-weight: 700;
          font-size: 13px;
          color: var(--text-main);
        }

        .icon-btn-primary {
          background: var(--color-primary-glow);
          border: 1px solid var(--border-glow);
          border-radius: 4px;
          color: var(--color-primary);
          padding: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .icon-btn-primary:hover {
          background: var(--color-primary);
          color: #000;
          box-shadow: 0 0 8px var(--color-primary-glow);
        }

        .group-tabs {
          display: flex;
          gap: 4px;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.15);
          border-bottom: 1px solid var(--border-color);
          overflow-x: auto;
        }

        .group-tab {
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 4px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          white-space: nowrap;
          font-weight: 500;
          transition: all 0.2s;
        }
        .group-tab.active {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-primary);
          border: 1px solid var(--border-color);
        }

        .host-list-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .empty-hosts-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--text-muted);
          font-size: 12px;
        }
        .text-btn {
          background: none;
          border: none;
          color: var(--color-primary);
          cursor: pointer;
          font-size: 12px;
          margin-top: 6px;
          text-decoration: underline;
        }
        .text-btn:hover {
          color: #fff;
        }

        .host-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
        }
        .host-card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-glow);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          transform: translateY(-1px);
        }
        .host-card-border-indicator {
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          border-radius: 0 4px 4px 0;
        }
        .host-card-info {
          flex: 1;
          margin-left: 6px;
          overflow: hidden;
        }
        .host-card-title {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .host-card-sub {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .host-card-badge {
          display: inline-block;
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          margin-top: 4px;
        }
        .host-card-actions {
          display: flex;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .host-card:hover .host-card-actions {
          opacity: 1;
        }
        .action-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        .action-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }
        .action-btn.text-danger:hover {
          color: var(--color-danger);
          background: rgba(255, 56, 96, 0.1);
        }

        /* 2. Terminal Workspace */
        .terminal-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #090a0f;
          overflow: hidden;
        }

        .quick-connect-bar {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(16, 18, 26, 0.4);
          border-bottom: 1px solid var(--border-color);
        }
        .quick-connect-input {
          flex: 1;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: #fff;
          padding: 6px 12px;
          font-size: 12px;
          font-family: var(--font-mono);
        }
        .quick-connect-input:focus {
          border-color: var(--color-primary);
          outline: none;
        }

        .tab-headers-bar {
          display: flex;
          background: rgba(12, 14, 21, 0.8);
          border-bottom: 1px solid var(--border-color);
          height: 34px;
          overflow-x: auto;
        }
        .terminal-tab-header {
          display: flex;
          align-items: center;
          padding: 0 14px;
          height: 100%;
          border-right: 1px solid var(--border-color);
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          user-select: none;
          max-width: 160px;
          position: relative;
          transition: all 0.2s;
        }
        .terminal-tab-header:hover {
          background: rgba(255, 255, 255, 0.02);
          color: #fff;
        }
        .terminal-tab-header.active {
          background: #090a0f;
          color: #fff;
          font-weight: 600;
          border-top: 2px solid var(--color-primary);
        }
        .tab-icon {
          margin-right: 6px;
          flex-shrink: 0;
        }
        .tab-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-right: 8px;
        }
        .tab-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 30%;
        }
        .tab-close-btn:hover {
          background: rgba(255, 56, 96, 0.15);
          color: var(--color-danger);
        }
        .no-tabs-label {
          padding: 8px 16px;
          color: var(--text-muted);
          font-size: 11px;
          display: flex;
          align-items: center;
        }

        .terminal-containers-wrapper {
          flex: 1;
          position: relative;
          background: #090a0f;
          overflow: hidden;
        }
        .terminal-container {
          width: 100%;
          height: 100%;
          padding: 10px;
          box-sizing: border-box;
        }
        
        .terminal-welcome-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-light);
          text-align: center;
          padding: 24px;
        }
        .welcome-glow-logo {
          background: rgba(0, 229, 255, 0.05);
          border: 1px solid var(--border-glow);
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 0 30px rgba(0, 229, 255, 0.08);
          margin-bottom: 20px;
        }
        .welcome-btn {
          background: var(--color-primary-glow);
          border: 1px solid var(--color-primary);
          color: var(--color-primary);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
        }
        .welcome-btn:hover {
          background: var(--color-primary);
          color: #000;
          box-shadow: 0 0 12px var(--color-primary-glow);
        }
        .welcome-btn.secondary {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-light);
        }
        .welcome-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        /* 3. Command Broadcaster */
        .broadcaster-bar {
          background: rgba(16, 18, 26, 0.85);
          border-top: 1px solid var(--border-color);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .broadcaster-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 229, 255, 0.08);
          border: 1px solid var(--border-glow);
          padding: 6px;
          border-radius: 4px;
        }
        .broadcaster-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: #fff;
          padding: 6px 12px;
          font-size: 12px;
          font-family: var(--font-mono);
        }
        .broadcaster-input:focus {
          border-color: var(--color-primary);
          outline: none;
        }
        .broadcaster-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          color: var(--text-light);
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .broadcaster-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .broadcaster-btn.broadcast {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(99, 102, 241, 0.3);
          color: #a29bfe;
          display: flex;
          align-items: center;
        }
        .broadcaster-btn.broadcast:hover {
          background: #6366f1;
          color: #fff;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
        }

        /* 4. SFTP Explorer Side Drawer */
        .sftp-drawer {
          display: flex;
          position: relative;
          background: rgba(16, 18, 26, 0.65);
          border-left: 1px solid var(--border-color);
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          height: 100%;
          flex-shrink: 0;
        }
        .sftp-drawer.open {
          width: 320px;
        }
        .sftp-drawer.collapsed {
          width: 34px;
        }
        .sftp-toggle-tab {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 34px;
          background: rgba(12, 14, 21, 0.9);
          border: none;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 16px;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }
        .sftp-toggle-tab:hover {
          color: var(--color-primary);
          background: rgba(255, 255, 255, 0.02);
        }
        .sftp-toggle-tab span {
          writing-mode: vertical-lr;
          text-orientation: mixed;
          margin-top: 10px;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: 600;
        }

        .sftp-content-box {
          margin-left: 34px;
          width: calc(100% - 34px);
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sftp-offline-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          padding: 24px;
          font-size: 12px;
        }

        .sftp-toolbar {
          display: flex;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid var(--border-color);
          gap: 6px;
        }
        .sftp-tool-btn {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-light);
          padding: 4px 8px;
          cursor: pointer;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sftp-tool-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .sftp-tool-btn.primary {
          background: var(--color-primary-glow);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        .sftp-tool-btn.primary:hover {
          background: var(--color-primary);
          color: #000;
        }

        .sftp-path-bar {
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid var(--border-color);
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sftp-file-list-scroll {
          flex: 1;
          overflow-y: auto;
          background: rgba(9, 10, 15, 0.4);
        }
        .sftp-loading-state, .sftp-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          color: var(--text-muted);
          font-size: 12px;
          gap: 8px;
        }
        .sftp-empty-state {
          text-align: center;
          padding: 24px;
          color: var(--text-muted);
          font-size: 12px;
        }

        .sftp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
        }
        .sftp-table th {
          text-align: left;
          padding: 6px 8px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid var(--border-color);
          color: var(--text-muted);
          font-weight: 600;
        }
        .sftp-table td {
          padding: 6px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
          color: var(--text-light);
          vertical-align: middle;
        }
        .sftp-row {
          cursor: pointer;
        }
        .sftp-row:hover {
          background: rgba(255, 255, 255, 0.015);
        }
        .file-name-cell {
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .truncate-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sftp-row-actions {
          display: flex;
          gap: 4px;
          justify-content: center;
          opacity: 0;
        }
        .sftp-row:hover .sftp-row-actions {
          opacity: 1;
        }
        .sftp-action-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          border-radius: 3px;
        }
        .sftp-action-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }
        .sftp-action-btn.delete:hover {
          color: var(--color-danger);
          background: rgba(255, 56, 96, 0.1);
        }

        /* SFTP transfers panel */
        .sftp-transfers-panel {
          height: 140px;
          border-top: 1px solid var(--border-color);
          background: rgba(12, 14, 21, 0.95);
          display: flex;
          flex-direction: column;
          font-size: 11px;
        }
        .transfers-header {
          display: flex;
          justify-content: space-between;
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid var(--border-color);
          font-weight: 600;
          color: var(--text-light);
        }
        .transfers-list {
          flex: 1;
          overflow-y: auto;
          padding: 6px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .transfer-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .transfer-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .transfer-name {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
          color: #fff;
        }
        .transfer-badge {
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 3px;
        }
        .transfer-progress-track {
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          overflow: hidden;
        }
        .transfer-progress-fill {
          height: 100%;
          transition: width 0.2s ease;
        }
        .transfer-percent {
          text-align: right;
          color: var(--text-muted);
          font-size: 9px;
        }

        /* 5. Modal / Host Editor */
        .modal-backdrop {
          position: fixed;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .host-editor-modal {
          width: 500px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.1);
        }
        .modal-header h3 {
          margin: 0;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
        }
        .host-editor-form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .form-group-row {
          display: flex;
          gap: 12px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .form-field.flex-3 { flex: 3; }
        .form-field.flex-1 { flex: 1; }
        .form-field label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .form-field input[type="text"],
        .form-field input[type="number"],
        .form-field input[type="password"],
        .form-field select {
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 12.5px;
          color: #fff;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-field input:focus, .form-field select:focus {
          border-color: var(--color-primary);
        }

        .radio-group {
          display: flex;
          gap: 16px;
          padding: 4px 0;
        }
        .radio-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-light);
          cursor: pointer;
        }
        .radio-label input {
          accent-color: var(--color-primary);
        }

        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .password-input-wrapper input {
          width: 100%;
          padding-right: 36px !important;
        }
        .pwd-toggle {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }
        .pwd-toggle:hover {
          color: #fff;
        }

        .modal-footer-btns {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
        }
        .btn-primary {
          background: var(--color-primary);
          color: #000;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary:hover {
          background: #00e5ff;
          box-shadow: 0 0 10px var(--color-primary-glow);
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          color: var(--text-light);
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .spin {
          animation: spin-anim 1s linear infinite;
        }
        @keyframes spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Light Mode Styling Overrides */
        .light-theme .ssh-dashboard-container {
          background: #f1f3f7;
        }
        .light-theme .host-sidebar {
          background: #ffffff;
        }
        .light-theme .host-card {
          background: #fdfdfd;
        }
        .light-theme .host-card-title {
          color: #1a202c;
        }
        .light-theme .sidebar-section-header {
          color: #1a202c;
        }
        .light-theme .terminal-workspace {
          background: #fff;
        }
        .light-theme .terminal-welcome-screen {
          color: #2d3748;
        }
        .light-theme .tab-headers-bar {
          background: #f1f3f7;
        }
        .light-theme .terminal-tab-header.active {
          background: #fff;
          color: #000;
        }
        .light-theme .broadcaster-bar {
          background: #f8f9fc;
        }
        .light-theme .broadcaster-input {
          background: #fff;
          color: #000;
          border-color: rgba(0, 0, 0, 0.1);
        }
        .light-theme .sftp-drawer {
          background: #ffffff;
        }
        .light-theme .sftp-toggle-tab {
          background: #eaecef;
        }
        .light-theme .sftp-toolbar {
          background: #f1f3f7;
        }
        .light-theme .sftp-path-bar {
          background: #fafafc;
          color: #5e6c84;
        }
        .light-theme .sftp-table th {
          background: #f4f6fa;
          color: #5e6c84;
        }
        .light-theme .sftp-table td {
          color: #1a202c;
        }
        .light-theme .sftp-row:hover {
          background: rgba(0, 0, 0, 0.02);
        }
        .light-theme .host-editor-modal {
          background: #fff;
        }
        .light-theme .modal-header h3 {
          color: #000;
        }
        .light-theme .form-field input, .light-theme .form-field select {
          background: #fff;
          color: #000;
          border-color: rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
}
