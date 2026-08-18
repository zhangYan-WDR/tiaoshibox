const EventEmitter = require('events');
const {
  OPCUAClient,
  AttributeIds,
  DataType,
  MessageSecurityMode,
  SecurityPolicy,
  UserTokenType,
  ClientSubscription,
  ClientMonitoredItem,
  TimestampsToReturn,
  BrowseDirection,
  StatusCodes,
  NodeClass
} = require("node-opcua-client");

const securityModeMap = {
  'None': MessageSecurityMode.None,
  'Sign': MessageSecurityMode.Sign,
  'SignAndEncrypt': MessageSecurityMode.SignAndEncrypt
};

const securityPolicyMap = {
  'None': SecurityPolicy.None,
  'Basic256Sha256': SecurityPolicy.Basic256Sha256,
  'Basic256': SecurityPolicy.Basic256,
  'Aes128_Sha256_RsaOaep': SecurityPolicy.Aes128_Sha256_RsaOaep
};

const standardDataTypeMap = {
  'i=1': 'Boolean',
  'i=2': 'SByte',
  'i=3': 'Byte',
  'i=4': 'Int16',
  'i=5': 'UInt16',
  'i=6': 'Int32',
  'i=7': 'UInt32',
  'i=8': 'Int64',
  'i=9': 'UInt64',
  'i=10': 'Float',
  'i=11': 'Double',
  'i=12': 'String',
  'i=13': 'DateTime',
  'i=14': 'Guid',
  'i=15': 'ByteString',
  'i=16': 'XmlElement',
  'i=17': 'NodeId',
  'i=18': 'ExpandedNodeId',
  'i=19': 'StatusCode',
  'i=20': 'QualifiedName',
  'i=21': 'LocalizedText',
  'i=22': 'Structure',
  'i=23': 'DataValue',
  'i=24': 'BaseDataType',
  'i=25': 'DiagnosticInfo',
  'i=26': 'Number',
  'i=27': 'Integer',
  'i=28': 'UInteger',
  'i=29': 'Enumeration',
  'ns=0;i=1': 'Boolean',
  'ns=0;i=2': 'SByte',
  'ns=0;i=3': 'Byte',
  'ns=0;i=4': 'Int16',
  'ns=0;i=5': 'UInt16',
  'ns=0;i=6': 'Int32',
  'ns=0;i=7': 'UInt32',
  'ns=0;i=8': 'Int64',
  'ns=0;i=9': 'UInt64',
  'ns=0;i=10': 'Float',
  'ns=0;i=11': 'Double',
  'ns=0;i=12': 'String',
  'ns=0;i=13': 'DateTime',
  'ns=0;i=14': 'Guid',
  'ns=0;i=15': 'ByteString',
  'ns=0;i=16': 'XmlElement',
  'ns=0;i=17': 'NodeId',
  'ns=0;i=18': 'ExpandedNodeId',
  'ns=0;i=19': 'StatusCode',
  'ns=0;i=20': 'QualifiedName',
  'ns=0;i=21': 'LocalizedText',
  'ns=0;i=22': 'Structure',
  'ns=0;i=23': 'DataValue',
  'ns=0;i=24': 'BaseDataType',
  'ns=0;i=25': 'DiagnosticInfo',
  'ns=0;i=26': 'Number',
  'ns=0;i=27': 'Integer',
  'ns=0;i=28': 'UInteger',
  'ns=0;i=29': 'Enumeration'
};

function resolveDataType(dataTypeNodeId, variantValue) {
  const dtStr = (dataTypeNodeId || '').toString().trim();

  // 1. 优先查标准 OPC UA 数据类型映射表 (如 ns=0;i=6, i=11 等)
  if (standardDataTypeMap[dtStr]) {
    return standardDataTypeMap[dtStr];
  }

  // 正则匹配纯数值 ID
  const numMatch = dtStr.match(/^(?:ns=0;)?i=(\d+)$/);
  if (numMatch && standardDataTypeMap[`i=${numMatch[1]}`]) {
    return standardDataTypeMap[`i=${numMatch[1]}`];
  }

  // 2. 自定义字符串类型标识符 (形如 ns=1;s=EMS.LcSysStatus_enum)
  const stringMatch = dtStr.match(/;s=([^;]+)$/);
  if (stringMatch) {
    const rawIdentifier = stringMatch[1]; // e.g. "EMS.LcSysStatus_enum"
    const shortName = rawIdentifier.includes('.') ? rawIdentifier.split('.').pop() : rawIdentifier;
    if (rawIdentifier.toLowerCase().includes('enum')) {
      return `Enum (${shortName})`;
    }
    return shortName;
  }

  // 3. 从 Variant 运行时的真实类型推断
  if (variantValue && variantValue.dataType !== undefined) {
    const typeFromVariant = DataType[variantValue.dataType];
    if (typeFromVariant && typeFromVariant !== 'Null' && typeFromVariant !== 'Unknown') {
      return typeFromVariant;
    }
  }

  return dtStr || 'Unknown';
}

class OPCUAClientWrapper extends EventEmitter {
  constructor(config = {}) {
    super();
    this.id = config.id || Math.random().toString(36).substring(2, 9);
    this.name = config.name || `${config.ip}:${config.port}`;
    this.ip = config.ip || '127.0.0.1';
    this.port = config.port || 4840;
    this.endpointUrl = config.endpointUrl || `opc.tcp://${this.ip}:${this.port}`;
    
    // 安全配置
    this.securityMode = config.securityMode || 'None';
    this.securityPolicy = config.securityPolicy || 'None';
    
    // 认证配置
    this.authMode = config.authMode || 'anonymous'; // anonymous, username
    this.username = config.username || '';
    this.password = config.password || '';

    this.client = null;
    this.session = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED
    this.lastError = null;

    // 订阅字典: nodeId -> { subscription, monitoredItem }
    this.subscriptions = new Map();
  }

  log(level, message) {
    this.emit('log', { level, message, timestamp: Date.now() });
  }

  logTraffic(dir, op, desc, payload) {
    this.emit('traffic', {
      clientId: this.id,
      dir, // 'send' | 'receive'
      type: 'OPCUA',
      desc,
      payload: payload ? JSON.stringify(payload) : '',
      timestamp: Date.now()
    });
  }

  setStatus(status) {
    this.status = status;
    this.emit('status', status);
  }

  async connect() {
    try {
      this.setStatus('CONNECTING');
      this.log('info', `正在初始化 OPC UA 客户端...`);
      
      const selectedSecurityMode = securityModeMap[this.securityMode] || MessageSecurityMode.None;
      const selectedSecurityPolicy = securityPolicyMap[this.securityPolicy] || SecurityPolicy.None;

      this.client = OPCUAClient.create({
        securityMode: selectedSecurityMode,
        securityPolicy: selectedSecurityPolicy,
        endpointMustExist: false,
        connectionStrategy: {
          maxRetry: 2,
          initialDelay: 1000,
          maxDelay: 5000
        }
      });

      this.log('info', `正在连接至端点: ${this.endpointUrl}...`);
      await this.client.connect(this.endpointUrl);
      this.log('info', `TCP 连接建立成功！正在创建会话...`);

      // 准备身份凭据
      let userIdentity = { type: UserTokenType.Anonymous };
      if (this.authMode === 'username') {
        userIdentity = {
          type: UserTokenType.UserName,
          userName: this.username,
          password: this.password
        };
      }

      this.session = await this.client.createSession(userIdentity);
      this.log('info', `OPC UA 会话创建成功！会话 ID: ${this.session.sessionId.toString()}`);
      this.setStatus('CONNECTED');
      
      this.client.on("connection_reestablished", () => {
        this.log('info', `OPC UA 物理连接重新建立`);
      });
      this.client.on("backoff", (attempt, delay) => {
        this.log('warn', `OPC UA 连接断开，正在尝试重连... (第 ${attempt} 次尝试)`);
      });
    } catch (err) {
      this.log('error', `OPC UA 连接失败: ${err.message}`);
      this.lastError = err.message;
      this.setStatus('DISCONNECTED');
      this.client = null;
      this.session = null;
      throw err;
    }
  }

  async browse(nodeId) {
    if (!this.session) {
      throw new Error("OPC UA 会话未建立");
    }

    const targetNodeId = nodeId || "ns=0;i=84"; // 默认 RootFolder
    this.logTraffic('send', 'BROWSE', `浏览节点: ${targetNodeId}`, { nodeId: targetNodeId });
    
    // 浏览全部子节点
    const browseResult = await this.session.browse(targetNodeId);
    const references = browseResult.references || [];
    
    this.logTraffic('receive', 'BROWSE', `获取到 ${references.length} 个子节点`, { 
      nodeId: targetNodeId,
      count: references.length 
    });

    return references.map(ref => ({
      nodeId: ref.nodeId.toString(),
      browseName: ref.browseName.toString(),
      displayName: ref.displayName.text,
      nodeClass: NodeClass[ref.nodeClass] || ref.nodeClass.toString(), // e.g. Variable, Object, Method 等
      typeDefinition: ref.typeDefinition ? ref.typeDefinition.toString() : ''
    }));
  }

  async readNode(nodeId) {
    if (!this.session) {
      throw new Error("OPC UA 会话未建立");
    }

    this.logTraffic('send', 'READ', `读取节点属性: ${nodeId}`, { nodeId });

    const nodesToRead = [
      { nodeId, attributeId: AttributeIds.Value },
      { nodeId, attributeId: AttributeIds.DataType },
      { nodeId, attributeId: AttributeIds.BrowseName },
      { nodeId, attributeId: AttributeIds.DisplayName },
      { nodeId, attributeId: AttributeIds.UserAccessLevel }
    ];

    const results = await this.session.read(nodesToRead);
    
    if (results[0].statusCode.value !== StatusCodes.Good.value) {
      throw new Error(`读取节点失败: ${results[0].statusCode.toString()}`);
    }

    const valueData = results[0];
    const dataTypeNodeId = results[1].value ? results[1].value.value.toString() : 'Unknown';
    const browseName = results[2].value ? results[2].value.value.name : '';
    const displayName = results[3].value ? results[3].value.value.text : '';
    const accessLevel = results[4].value ? results[4].value.value : 0;

    // 解析数据类型 (结合 Variant DataType 与 DataType NodeId)
    const dataTypeString = resolveDataType(dataTypeNodeId, valueData.value);

    const payload = {
      nodeId,
      browseName,
      displayName,
      dataType: dataTypeString,
      dataTypeNodeId,
      value: valueData.value ? valueData.value.value : null,
      sourceTimestamp: valueData.sourceTimestamp ? valueData.sourceTimestamp.toISOString() : null,
      statusCode: valueData.statusCode.toString(),
      accessLevel
    };

    this.logTraffic('receive', 'READ', `读取节点完成: ${nodeId}`, payload);
    return payload;
  }

  async writeNode(nodeId, value, targetDataType) {
    if (!this.session) {
      throw new Error("OPC UA 会话未建立");
    }

    this.logTraffic('send', 'WRITE', `向节点 ${nodeId} 写入 [${targetDataType}]: ${value}`, { nodeId, value, targetDataType });

    let dataTypeEnum = DataType.String;
    let convertedValue = value;

    switch (targetDataType) {
      case 'Boolean':
        dataTypeEnum = DataType.Boolean;
        convertedValue = (value === 'true' || value === true || value === '1' || value === 1);
        break;
      case 'Byte':
        dataTypeEnum = DataType.Byte;
        convertedValue = parseInt(value) || 0;
        break;
      case 'SByte':
        dataTypeEnum = DataType.SByte;
        convertedValue = parseInt(value) || 0;
        break;
      case 'Int16':
        dataTypeEnum = DataType.Int16;
        convertedValue = parseInt(value) || 0;
        break;
      case 'UInt16':
        dataTypeEnum = DataType.UInt16;
        convertedValue = parseInt(value) || 0;
        break;
      case 'Int32':
        dataTypeEnum = DataType.Int32;
        convertedValue = parseInt(value) || 0;
        break;
      case 'UInt32':
        dataTypeEnum = DataType.UInt32;
        convertedValue = parseInt(value) || 0;
        break;
      case 'Int64':
        dataTypeEnum = DataType.Int64;
        convertedValue = parseInt(value) || 0;
        break;
      case 'UInt64':
        dataTypeEnum = DataType.UInt64;
        convertedValue = parseInt(value) || 0;
        break;
      case 'Float':
        dataTypeEnum = DataType.Float;
        convertedValue = parseFloat(value) || 0.0;
        break;
      case 'Double':
        dataTypeEnum = DataType.Double;
        convertedValue = parseFloat(value) || 0.0;
        break;
      case 'String':
        dataTypeEnum = DataType.String;
        convertedValue = String(value);
        break;
      default:
        dataTypeEnum = DataType.String;
        convertedValue = String(value);
    }

    const nodeToWrite = {
      nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          dataType: dataTypeEnum,
          value: convertedValue
        }
      }
    };

    const statusCode = await this.session.write(nodeToWrite);

    if (statusCode.value !== StatusCodes.Good.value) {
      throw new Error(`写入失败: ${statusCode.toString()}`);
    }

    this.logTraffic('receive', 'WRITE', `向节点 ${nodeId} 写入完成`, { nodeId, statusCode: statusCode.toString() });
    return { success: true, statusCode: statusCode.toString() };
  }

  async subscribeNode(nodeId, onUpdate) {
    if (!this.session) {
      throw new Error("OPC UA 会话未建立");
    }

    if (this.subscriptions.has(nodeId)) {
      await this.unsubscribeNode(nodeId);
    }

    this.logTraffic('send', 'SUBSCRIBE', `添加节点订阅: ${nodeId}`, { nodeId });

    const clientSubscription = ClientSubscription.create(this.session, {
      requestedPublishingInterval: 1000,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 10,
      publishingEnabled: true,
      priority: 10
    });

    const monitoredItem = ClientMonitoredItem.create(
      clientSubscription,
      { nodeId, attributeId: AttributeIds.Value },
      { samplingInterval: 100, discardOldest: true, queueSize: 10 },
      TimestampsToReturn.Both
    );

    monitoredItem.on("changed", (dataValue) => {
      const value = dataValue.value ? dataValue.value.value : null;
      const timestamp = dataValue.sourceTimestamp ? dataValue.sourceTimestamp.toISOString() : null;
      const statusCode = dataValue.statusCode.toString();
      
      this.logTraffic('receive', 'MONITOR', `订阅节点 ${nodeId} 发生值改变`, {
        nodeId,
        value,
        timestamp,
        statusCode
      });
      
      onUpdate({
        nodeId,
        value,
        timestamp,
        statusCode
      });
    });

    this.subscriptions.set(nodeId, { subscription: clientSubscription, monitoredItem });
    this.log('info', `已成功在服务端开启节点 ${nodeId} 的数据订阅`);
  }

  async unsubscribeNode(nodeId) {
    const sub = this.subscriptions.get(nodeId);
    if (!sub) return;

    this.logTraffic('send', 'UNSUBSCRIBE', `取消节点订阅: ${nodeId}`, { nodeId });
    
    try {
      await sub.monitoredItem.terminate();
      await sub.subscription.terminate();
    } catch (e) {
      // 忽略析构报错
    }

    this.subscriptions.delete(nodeId);
    this.log('info', `已取消节点 ${nodeId} 的订阅`);
  }

  async disconnect() {
    this.log('info', `正在断开 OPC UA 连接并清理资源...`);
    
    for (const nodeId of this.subscriptions.keys()) {
      try {
        await this.unsubscribeNode(nodeId);
      } catch (e) {}
    }
    this.subscriptions.clear();

    if (this.session) {
      try {
        await this.session.close();
      } catch (e) {}
      this.session = null;
    }

    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (e) {}
      this.client = null;
    }

    this.setStatus('DISCONNECTED');
    this.log('info', `OPC UA 连接已彻底断开。`);
  }
}

module.exports = OPCUAClientWrapper;
