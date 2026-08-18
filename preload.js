const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ==========================================
  // Modbus TCP API
  // ==========================================
  modbus: {
    connect: (config) => ipcRenderer.invoke('modbus:connect', config),
    disconnect: (id) => ipcRenderer.invoke('modbus:disconnect', id),
    readRegisters: (id, params) => ipcRenderer.invoke('modbus:read', id, params),
    writeSingle: (id, params) => ipcRenderer.invoke('modbus:write-single', id, params),
    writeMultiple: (id, params) => ipcRenderer.invoke('modbus:write-multiple', id, params),
    
    startSimulator: (config) => ipcRenderer.invoke('modbus:sim:start', config),
    stopSimulator: () => ipcRenderer.invoke('modbus:sim:stop'),
    writeSimValue: (params) => ipcRenderer.invoke('modbus:sim:write-value', params),

    onConnectionStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('modbus:status', sub);
      return () => ipcRenderer.removeListener('modbus:status', sub);
    },
    onDataUpdate: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('modbus:data', sub);
      return () => ipcRenderer.removeListener('modbus:data', sub);
    },
    onTrafficLog: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('modbus:traffic', sub);
      return () => ipcRenderer.removeListener('modbus:traffic', sub);
    },
    onSimulatorLog: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('modbus:sim:log', sub);
      return () => ipcRenderer.removeListener('modbus:sim:log', sub);
    },
    onSimulatorStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('modbus:sim:status', sub);
      return () => ipcRenderer.removeListener('modbus:sim:status', sub);
    },
    onSimulatorConnections: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('modbus:sim:connections', sub);
      return () => ipcRenderer.removeListener('modbus:sim:connections', sub);
    },
    onSimulatorDataSnapshot: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('modbus:sim:data-snapshot', sub);
      return () => ipcRenderer.removeListener('modbus:sim:data-snapshot', sub);
    }
  },

  // ==========================================
  // IEC 104 API
  // ==========================================
  iec104: {
    connect: (config) => ipcRenderer.invoke('iec104:connect', config),
    disconnect: (id) => ipcRenderer.invoke('iec104:disconnect', id),
    sendGeneralCall: (id) => ipcRenderer.invoke('iec104:general-call', id),
    sendTeleControl: (id, params) => ipcRenderer.invoke('iec104:tele-control', id, params),
    sendTeleAdjust: (id, params) => ipcRenderer.invoke('iec104:tele-adjust', id, params),
    
    startSimulator: (config) => ipcRenderer.invoke('iec104:sim:start', config),
    stopSimulator: () => ipcRenderer.invoke('iec104:sim:stop'),

    onConnectionStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec104:status', sub);
      return () => ipcRenderer.removeListener('iec104:status', sub);
    },
    onDataUpdate: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec104:data', sub);
      return () => ipcRenderer.removeListener('iec104:data', sub);
    },
    onTrafficLog: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec104:traffic', sub);
      return () => ipcRenderer.removeListener('iec104:traffic', sub);
    },
    onSimulatorLog: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec104:sim:log', sub);
      return () => ipcRenderer.removeListener('iec104:sim:log', sub);
    },
    onSimulatorStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec104:sim:status', sub);
      return () => ipcRenderer.removeListener('iec104:sim:status', sub);
    }
  },

  // ==========================================
  // IEC 61850 MMS & GOOSE API
  // ==========================================
  iec61850: {
    mmsConnect: (config) => ipcRenderer.invoke('mms:connect', config),
    mmsDisconnect: (id) => ipcRenderer.invoke('mms:disconnect', id),
    mmsRead: (id, path) => ipcRenderer.invoke('mms:read', id, path),
    mmsWrite: (id, params) => ipcRenderer.invoke('mms:write', id, params),
    
    startSimulator: (config) => ipcRenderer.invoke('iec61850:sim:start', config),
    stopSimulator: () => ipcRenderer.invoke('iec61850:sim:stop'),
    updateSimValue: (path, value) => ipcRenderer.invoke('iec61850:sim:update-value', path, value),

    startGoosePublisher: (config) => ipcRenderer.invoke('goose:pub-start', config),
    stopGoosePublisher: (id) => ipcRenderer.invoke('goose:pub-stop', id),
    triggerGooseTrip: (id, params) => ipcRenderer.invoke('goose:pub-trip', id, params),
    
    startGooseSubscriber: (config) => ipcRenderer.invoke('goose:sub-start', config),
    stopGooseSubscriber: (id) => ipcRenderer.invoke('goose:sub-stop', id),

    onMmsStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('mms:status', sub);
      return () => ipcRenderer.removeListener('mms:status', sub);
    },
    onMmsData: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('mms:data', sub);
      return () => ipcRenderer.removeListener('mms:data', sub);
    },
    onMmsTraffic: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('mms:traffic', sub);
      return () => ipcRenderer.removeListener('mms:traffic', sub);
    },
    onSimStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec61850:sim:status', sub);
      return () => ipcRenderer.removeListener('iec61850:sim:status', sub);
    },
    onSimData: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec61850:sim:data', sub);
      return () => ipcRenderer.removeListener('iec61850:sim:data', sub);
    },
    onSimLog: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('iec61850:sim:log', sub);
      return () => ipcRenderer.removeListener('iec61850:sim:log', sub);
    },
    onGoosePubStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('goose:pub-status', sub);
      return () => ipcRenderer.removeListener('goose:pub-status', sub);
    },
    onGooseSubData: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('goose:sub-data', sub);
      return () => ipcRenderer.removeListener('goose:sub-data', sub);
    },
    onGooseTraffic: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('goose:traffic', sub);
      return () => ipcRenderer.removeListener('goose:traffic', sub);
    }
  },

  // ==========================================
  // Extra Tools (Socket, Ping, Port Scan) API
  // ==========================================
  tools: {
    socketStart: (config) => ipcRenderer.invoke('socket:start', config),
    socketStop: (id) => ipcRenderer.invoke('socket:stop', id),
    socketSend: (id, params) => ipcRenderer.invoke('socket:send', id, params),
    socketUpdateRules: (id, rules) => ipcRenderer.invoke('socket:rules-update', id, rules),
    
    ping: (host) => ipcRenderer.invoke('net:ping', host),
    scanPorts: (host, ports) => ipcRenderer.invoke('net:scan', host, ports),

    onSocketStatus: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('socket:status', sub);
      return () => ipcRenderer.removeListener('socket:status', sub);
    },
    onSocketData: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('socket:data', sub);
      return () => ipcRenderer.removeListener('socket:data', sub);
    },
    onSocketTraffic: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('socket:traffic', sub);
      return () => ipcRenderer.removeListener('socket:traffic', sub);
    },
    onSocketClients: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('socket:clients', sub);
      return () => ipcRenderer.removeListener('socket:clients', sub);
    },

    onPingLog: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('net:ping-log', sub);
      return () => ipcRenderer.removeListener('net:ping-log', sub);
    },
    onPingDone: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('net:ping-done', sub);
      return () => ipcRenderer.removeListener('net:ping-done', sub);
    },
    onScanProgress: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('net:scan-progress', sub);
      return () => ipcRenderer.removeListener('net:scan-progress', sub);
    },
    onScanDone: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('net:scan-done', sub);
      return () => ipcRenderer.removeListener('net:scan-done', sub);
    }
  },

  // ==========================================
  // OPC UA Client API
  // ==========================================
  opcua: {
    connect: (config) => ipcRenderer.invoke('opcua:connect', config),
    disconnect: (id) => ipcRenderer.invoke('opcua:disconnect', id),
    browse: (id, nodeId) => ipcRenderer.invoke('opcua:browse', id, nodeId),
    readNode: (id, nodeId) => ipcRenderer.invoke('opcua:read', id, nodeId),
    writeNode: (id, params) => ipcRenderer.invoke('opcua:write', id, params),
    subscribeNode: (id, nodeId) => ipcRenderer.invoke('opcua:subscribe', id, nodeId),
    unsubscribeNode: (id, nodeId) => ipcRenderer.invoke('opcua:unsubscribe', id, nodeId),
    
    onStatusChange: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('opcua:status', sub);
      return () => ipcRenderer.removeListener('opcua:status', sub);
    },
    onTrafficLog: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('opcua:traffic', sub);
      return () => ipcRenderer.removeListener('opcua:traffic', sub);
    },
    onDataUpdate: (callback) => {
      const sub = (event, data) => callback(data);
      ipcRenderer.on('opcua:data-update', sub);
      return () => ipcRenderer.removeListener('opcua:data-update', sub);
    }
  }
});
