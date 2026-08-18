const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import Protocol Engines
const ModbusTCPClient = require('./modbus-client');
const ModbusTCPSimulator = require('./modbus-simulator');
const IEC104Client = require('./iec104-client');
const IEC104Simulator = require('./iec104-simulator');
const MMSClient = require('./iec61850-mms-client');
const MMSServer = require('./iec61850-mms-server');
const gooseEngine = require('./iec61850-goose');

// Import New Helper Engines
const socketDebugger = require('./socket-debugger');
const networkTool = require('./network-tool');
const OPCUAClientWrapper = require('./opcua-client');

let mainWindow = null;

// Active resources state
const modbusClients = new Map();
let modbusSimulator = null;

const iec104Clients = new Map();
let iec104Simulator = null;

const mmsClients = new Map();
let mmsServer = null;

const opcuaClients = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1450,
    height: 920,
    minWidth: 1200,
    minHeight: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    // Option to open DevTools
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupAll();
  });
}

function cleanupAll() {
  console.log('[System] Cleaning up all connections and ports...');
  
  // 1. Modbus Clients & Sim
  for (const client of modbusClients.values()) {
    try { client.disconnect(); } catch (e) {}
  }
  modbusClients.clear();
  if (modbusSimulator) {
    try { modbusSimulator.stop(); } catch (e) {}
    modbusSimulator = null;
  }

  // 2. IEC104 Clients & Sim
  for (const client of iec104Clients.values()) {
    try { client.disconnect(); } catch (e) {}
  }
  iec104Clients.clear();
  if (iec104Simulator) {
    try { iec104Simulator.stop(); } catch (e) {}
    iec104Simulator = null;
  }

  // 3. MMS & GOOSE
  for (const client of mmsClients.values()) {
    try { client.disconnect(); } catch (e) {}
  }
  mmsClients.clear();
  if (mmsServer) {
    try { mmsServer.stop(); } catch (e) {}
    mmsServer = null;
  }
  try {
    for (const id of gooseEngine.publishers.keys()) {
      gooseEngine.stopPublisher(id);
    }
    for (const id of gooseEngine.subscribers.keys()) {
      gooseEngine.stopSubscriber(id);
    }
  } catch (e) {}

  // 4. Socket Debugger
  try {
    for (const id of socketDebugger.instances.keys()) {
      socketDebugger.stop(id);
    }
  } catch (e) {}

  // 5. OPC UA Clients
  for (const client of opcuaClients.values()) {
    try { client.disconnect(); } catch (e) {}
  }
  opcuaClients.clear();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// ==========================================
// IPC HANDLERS: MODBUS TCP
// ==========================================

ipcMain.handle('modbus:connect', async (event, config) => {
  const { id } = config;
  if (modbusClients.has(id)) {
    modbusClients.get(id).disconnect();
    modbusClients.delete(id);
  }

  const client = new ModbusTCPClient(config);

  client.on('status', (data) => {
    if (mainWindow) mainWindow.webContents.send('modbus:status', data);
  });
  client.on('data', (data) => {
    if (mainWindow) mainWindow.webContents.send('modbus:data', data);
  });
  client.on('traffic', (data) => {
    if (mainWindow) mainWindow.webContents.send('modbus:traffic', data);
  });
  client.on('log', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('modbus:traffic', {
        clientId: client.id,
        dir: 'LOG',
        hex: '',
        type: 'LOG',
        desc: `[${data.level.toUpperCase()}] ${data.message}`,
        timestamp: data.timestamp
      });
    }
  });

  modbusClients.set(id, client);
  client.connect();
  return { success: true, id };
});

ipcMain.handle('modbus:disconnect', async (event, id) => {
  const client = modbusClients.get(id);
  if (client) {
    client.disconnect();
    modbusClients.delete(id);
    return { success: true };
  }
  return { success: false, error: '通道不存在' };
});

ipcMain.handle('modbus:read', async (event, id, params) => {
  const client = modbusClients.get(id);
  if (!client) return { success: false, error: '主站连接不存在' };
  const { fc, startAddress, quantity } = params;
  try {
    const values = await client.readRegisters(fc, startAddress, quantity);
    return { success: true, values };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modbus:write-single', async (event, id, params) => {
  const client = modbusClients.get(id);
  if (!client) return { success: false, error: '主站连接不存在' };
  const { type, address, value } = params;
  try {
    let result;
    if (type === 'coil') {
      result = await client.writeSingleCoil(address, value === 1);
    } else {
      result = await client.writeSingleRegister(address, value);
    }
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modbus:write-multiple', async (event, id, params) => {
  const client = modbusClients.get(id);
  if (!client) return { success: false, error: '主站连接不存在' };
  const { type, address, values } = params;
  try {
    let result;
    if (type === 'coils') {
      result = await client.writeMultipleCoils(address, values);
    } else {
      result = await client.writeMultipleRegisters(address, values);
    }
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Modbus Sim handlers (namespaced!)
ipcMain.handle('modbus:sim:start', async (event, config) => {
  if (!modbusSimulator) {
    modbusSimulator = new ModbusTCPSimulator(config);
    modbusSimulator.on('log', (data) => {
      if (mainWindow) mainWindow.webContents.send('modbus:sim:log', data);
    });
    modbusSimulator.on('status', (isRunning) => {
      if (mainWindow) mainWindow.webContents.send('modbus:sim:status', isRunning);
    });
    modbusSimulator.on('connections', (count) => {
      if (mainWindow) mainWindow.webContents.send('modbus:sim:connections', count);
    });
    modbusSimulator.on('registers-updated', () => {
      sendModbusSimData();
    });
    modbusSimulator.on('register-updated', (data) => {
      sendModbusSimData();
    });
  } else {
    modbusSimulator.stop();
    modbusSimulator.port = config.port || 5020;
    modbusSimulator.unitId = config.unitId !== undefined ? config.unitId : 1;
  }
  try {
    modbusSimulator.start();
    setTimeout(sendModbusSimData, 100);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modbus:sim:stop', async () => {
  if (modbusSimulator) {
    modbusSimulator.stop();
    return { success: true };
  }
  return { success: false, error: '模拟器未运行' };
});

ipcMain.handle('modbus:sim:write-value', async (event, params) => {
  if (!modbusSimulator) return { success: false, error: '模拟器未运行' };
  const { type, address, value } = params;
  try {
    if (type === 'coils') modbusSimulator.coils[address] = value ? 1 : 0;
    else if (type === 'discreteInputs') modbusSimulator.discreteInputs[address] = value ? 1 : 0;
    else if (type === 'inputRegisters') modbusSimulator.inputRegisters[address] = value;
    else if (type === 'holdingRegisters') modbusSimulator.holdingRegisters[address] = value;

    modbusSimulator.log(`[UI修改] 数据变更 -> ${type}[${address}] = ${value}`);
    sendModbusSimData();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function sendModbusSimData() {
  if (!modbusSimulator || !mainWindow) return;
  const snapshot = {
    coils: Array.from(modbusSimulator.coils.slice(0, 100)),
    discreteInputs: Array.from(modbusSimulator.discreteInputs.slice(0, 100)),
    inputRegisters: Array.from(modbusSimulator.inputRegisters.slice(0, 100)),
    holdingRegisters: Array.from(modbusSimulator.holdingRegisters.slice(0, 100))
  };
  mainWindow.webContents.send('modbus:sim:data-snapshot', snapshot);
}


// ==========================================
// IPC HANDLERS: IEC 104
// ==========================================

ipcMain.handle('iec104:connect', async (event, config) => {
  const { id } = config;
  if (iec104Clients.has(id)) {
    iec104Clients.get(id).disconnect();
    iec104Clients.delete(id);
  }
  const client = new IEC104Client(config);

  client.on('status', (data) => {
    if (mainWindow) mainWindow.webContents.send('iec104:status', data);
  });
  client.on('data', (data) => {
    if (mainWindow) mainWindow.webContents.send('iec104:data', data);
  });
  client.on('traffic', (data) => {
    if (mainWindow) mainWindow.webContents.send('iec104:traffic', data);
  });
  client.on('log', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('iec104:traffic', {
        clientId: client.id,
        dir: 'LOG',
        hex: '',
        type: 'LOG',
        desc: `[${data.level.toUpperCase()}] ${data.message}`,
        timestamp: data.timestamp
      });
    }
  });

  iec104Clients.set(id, client);
  client.connect();
  return { success: true, id };
});

ipcMain.handle('iec104:disconnect', async (event, id) => {
  const client = iec104Clients.get(id);
  if (client) {
    client.disconnect();
    iec104Clients.delete(id);
    return { success: true };
  }
  return { success: false, error: '连接通道不存在' };
});

ipcMain.handle('iec104:general-call', async (event, id) => {
  const client = iec104Clients.get(id);
  if (client) {
    try {
      client.sendGeneralCall();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: '连接通道不存在' };
});

ipcMain.handle('iec104:tele-control', async (event, id, params) => {
  const client = iec104Clients.get(id);
  if (client) {
    const { ioa, commandType, value, step, commonAddress } = params;
    try {
      client.sendTeleControl(ioa, commandType, value, step, commonAddress);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: '连接通道不存在' };
});

ipcMain.handle('iec104:tele-adjust', async (event, id, params) => {
  const client = iec104Clients.get(id);
  if (client) {
    const { ioa, adjustType, value, step, commonAddress } = params;
    try {
      client.sendTeleAdjust(ioa, adjustType, value, step, commonAddress);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: '连接通道不存在' };
});

// IEC104 Sim handlers (namespaced!)
ipcMain.handle('iec104:sim:start', async (event, config) => {
  if (!iec104Simulator) {
    iec104Simulator = new IEC104Simulator(config);
    iec104Simulator.on('log', (data) => {
      if (mainWindow) mainWindow.webContents.send('iec104:sim:log', data);
    });
    iec104Simulator.on('status', (isRunning) => {
      if (mainWindow) mainWindow.webContents.send('iec104:sim:status', isRunning);
    });
  } else {
    iec104Simulator.stop();
    iec104Simulator.port = config.port || 2404;
    iec104Simulator.commonAddress = config.commonAddress || 1;
  }
  try {
    iec104Simulator.start();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('iec104:sim:stop', async () => {
  if (iec104Simulator) {
    iec104Simulator.stop();
    return { success: true };
  }
  return { success: false, error: '模拟从站未运行' };
});


// ==========================================
// IPC HANDLERS: IEC 61850
// ==========================================

ipcMain.handle('mms:connect', async (event, config) => {
  const { id } = config;
  if (mmsClients.has(id)) {
    mmsClients.get(id).disconnect();
    mmsClients.delete(id);
  }
  const client = new MMSClient(config);

  client.on('status', (data) => {
    if (mainWindow) mainWindow.webContents.send('mms:status', data);
  });
  client.on('data', (data) => {
    if (mainWindow) mainWindow.webContents.send('mms:data', data);
  });
  client.on('traffic', (data) => {
    if (mainWindow) mainWindow.webContents.send('mms:traffic', data);
  });
  client.on('log', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('mms:traffic', {
        clientId: client.id,
        dir: 'LOG',
        hex: '',
        type: 'LOG',
        desc: `[${data.level.toUpperCase()}] ${data.message}`,
        timestamp: data.timestamp
      });
    }
  });

  mmsClients.set(id, client);
  client.connect();
  return { success: true, id };
});

ipcMain.handle('mms:disconnect', async (event, id) => {
  const client = mmsClients.get(id);
  if (client) {
    client.disconnect();
    mmsClients.delete(id);
    return { success: true };
  }
  return { success: false, error: 'MMS 连接不存在' };
});

ipcMain.handle('mms:read', async (event, id, path) => {
  const client = mmsClients.get(id);
  if (client) {
    try {
      const result = await client.readVariable(path);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'MMS连接不可用' };
});

ipcMain.handle('mms:write', async (event, id, { path, type, value }) => {
  const client = mmsClients.get(id);
  if (client) {
    try {
      const result = await client.writeVariable(path, { type, value });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'MMS连接不可用' };
});

// IEC61850 Sim handlers (namespaced!)
ipcMain.handle('iec61850:sim:start', async (event, config) => {
  if (!mmsServer) {
    mmsServer = new MMSServer(config);
    mmsServer.on('status', (isRunning) => {
      if (mainWindow) mainWindow.webContents.send('iec61850:sim:status', isRunning);
    });
    mmsServer.on('data-change', (data) => {
      if (mainWindow) mainWindow.webContents.send('iec61850:sim:data', data);
    });
    mmsServer.on('log', (data) => {
      if (mainWindow) mainWindow.webContents.send('iec61850:sim:log', data);
    });
    mmsServer.on('traffic', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('mms:traffic', {
          clientId: 'SIMULATOR',
          dir: data.dir,
          hex: data.hex,
          type: data.type,
          desc: `[模拟服务端] ${data.desc}`,
          timestamp: data.timestamp
        });
      }
    });
  } else {
    mmsServer.stop();
    mmsServer.port = config.port || 102;
  }
  try {
    mmsServer.start();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('iec61850:sim:stop', async () => {
  if (mmsServer) {
    mmsServer.stop();
    return { success: true };
  }
  return { success: false, error: 'MMS 模拟服务未开启' };
});

ipcMain.handle('iec61850:sim:update-value', async (event, { path, value }) => {
  if (mmsServer) {
    mmsServer.updateValue(path, value);
    return { success: true };
  }
  return { success: false, error: 'MMS 模拟服务未开启' };
});

// GOOSE handlers
gooseEngine.on('status', (data) => {
  if (mainWindow) mainWindow.webContents.send('goose:pub-status', data);
});
gooseEngine.on('subscriber-data', (data) => {
  if (mainWindow) mainWindow.webContents.send('goose:sub-data', data);
});
gooseEngine.on('log', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('goose:traffic', {
      id: data.id,
      dir: 'LOG',
      hex: '',
      desc: `[系统日志] [${data.level.toUpperCase()}] ${data.message}`,
      timestamp: data.timestamp
    });
  }
});
gooseEngine.on('traffic', (data) => {
  if (mainWindow) mainWindow.webContents.send('goose:traffic', data);
});

ipcMain.handle('goose:pub-start', async (event, config) => {
  try {
    const id = gooseEngine.startPublisher(config);
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('goose:pub-stop', async (event, id) => {
  const success = gooseEngine.stopPublisher(id);
  return { success };
});

ipcMain.handle('goose:pub-trip', async (event, id, values) => {
  const pub = gooseEngine.publishers.get(id);
  if (pub) {
    pub.triggerTrip(values);
    return { success: true };
  }
  return { success: false, error: '发布通道不存在' };
});

ipcMain.handle('goose:sub-start', async (event, config) => {
  try {
    const id = gooseEngine.startSubscriber(config);
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('goose:sub-stop', async (event, id) => {
  const success = gooseEngine.stopSubscriber(id);
  return { success };
});


// ==========================================
// IPC HANDLERS: EXTRA UTILITY TOOLS
// ==========================================

// 1. Socket Debugger Relays
socketDebugger.on('status', (data) => {
  if (mainWindow) mainWindow.webContents.send('socket:status', data);
});
socketDebugger.on('data', (data) => {
  if (mainWindow) mainWindow.webContents.send('socket:data', data);
});
socketDebugger.on('traffic', (data) => {
  if (mainWindow) mainWindow.webContents.send('socket:traffic', data);
});
socketDebugger.on('clients', (data) => {
  if (mainWindow) mainWindow.webContents.send('socket:clients', data);
});

ipcMain.handle('socket:start', async (event, config) => {
  return socketDebugger.start(config);
});

ipcMain.handle('socket:stop', async (event, id) => {
  return socketDebugger.stop(id);
});

ipcMain.handle('socket:send', async (event, id, params) => {
  return socketDebugger.send(id, params);
});

ipcMain.handle('socket:rules-update', async (event, id, rules) => {
  return socketDebugger.updateRules(id, rules);
});

// 2. Network Tool Relays
ipcMain.handle('net:ping', async (event, host) => {
  networkTool.ping(host, mainWindow);
  return { success: true };
});

ipcMain.handle('net:scan', async (event, host, ports) => {
  // Returns open ports once finished, but status is streamed via callbacks
  networkTool.scanPorts(host, ports, mainWindow);
  return { success: true };
});

// ==========================================
// IPC HANDLERS: OPC UA CLIENT
// ==========================================
ipcMain.handle('opcua:connect', async (event, config) => {
  const { id } = config;
  if (opcuaClients.has(id)) {
    try {
      await opcuaClients.get(id).disconnect();
    } catch (e) {}
    opcuaClients.delete(id);
  }

  const client = new OPCUAClientWrapper(config);

  client.on('status', (status) => {
    if (mainWindow) mainWindow.webContents.send('opcua:status', { clientId: id, status });
  });

  client.on('traffic', (data) => {
    if (mainWindow) mainWindow.webContents.send('opcua:traffic', data);
  });

  client.on('log', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('opcua:traffic', {
        clientId: client.id,
        dir: 'LOG',
        hex: '',
        type: 'LOG',
        desc: `[${data.level.toUpperCase()}] ${data.message}`,
        timestamp: data.timestamp
      });
    }
  });

  opcuaClients.set(id, client);
  
  try {
    await client.connect();
    return { success: true, id };
  } catch (err) {
    opcuaClients.delete(id);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('opcua:disconnect', async (event, id) => {
  const client = opcuaClients.get(id);
  if (client) {
    try {
      await client.disconnect();
    } catch (e) {}
    opcuaClients.delete(id);
    return { success: true };
  }
  return { success: false, error: '连接通道不存在' };
});

ipcMain.handle('opcua:browse', async (event, id, nodeId) => {
  const client = opcuaClients.get(id);
  if (client) {
    try {
      const references = await client.browse(nodeId);
      return { success: true, references };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: '客户端未连接' };
});

ipcMain.handle('opcua:read', async (event, id, nodeId) => {
  const client = opcuaClients.get(id);
  if (client) {
    try {
      const data = await client.readNode(nodeId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: '客户端未连接' };
});

ipcMain.handle('opcua:write', async (event, id, params) => {
  const client = opcuaClients.get(id);
  if (client) {
    try {
      const result = await client.writeNode(params.nodeId, params.value, params.dataType);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: '客户端未连接' };
});

ipcMain.handle('opcua:subscribe', async (event, id, nodeId) => {
  const client = opcuaClients.get(id);
  if (client) {
    try {
      await client.subscribeNode(nodeId, (updateData) => {
        if (mainWindow) {
          mainWindow.webContents.send('opcua:data-update', {
            clientId: id,
            ...updateData
          });
        }
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: '客户端未连接' };
});

ipcMain.handle('opcua:unsubscribe', async (event, id, nodeId) => {
  const client = opcuaClients.get(id);
  if (client) {
    try {
      await client.unsubscribeNode(nodeId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: '客户端未连接' };
});

