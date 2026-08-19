const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Retrieve token dynamically from environment or git credential helper to avoid leaks
let TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  try {
    const creds = execSync('echo "url=https://github.com/zhangYan-WDR/tiaoshibox.git" | git credential fill', { encoding: 'utf8' });
    const match = creds.match(/password=(.*)/);
    if (match) {
      TOKEN = match[1].trim();
    }
  } catch (e) {
    console.warn('Could not auto-retrieve token from git credentials helper.');
  }
}

if (!TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable or cached git credential is required.');
  process.exit(1);
}

const REPO = 'zhangYan-WDR/tiaoshibox';
const TAG = 'v1.1.1';

const assets = [
  { name: '调试百宝箱-1.1.1-arm64.dmg', contentType: 'application/octet-stream' },
  { name: '调试百宝箱 Setup 1.1.1.exe', contentType: 'application/octet-stream' },
  { name: '调试百宝箱-1.1.1-win.zip', contentType: 'application/zip' },
  { name: '调试百宝箱-1.1.1-arm64-win.zip', contentType: 'application/zip' }
];

const distDir = path.join(__dirname, '../dist-package');

function request(options, body) {
  const method = options.method || 'GET';
  const url = `https://${options.hostname}${options.path}`;
  const args = [
    '-s', '-S',
    '-X', method,
    '-H', `Authorization: token ${TOKEN}`,
    '-H', 'User-Agent: TiaoshiBox-Publisher',
  ];
  if (body) {
    args.push('-H', 'Content-Type: application/json');
    args.push('--data', '@-');
  }
  args.push(url);

  const input = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
  const result = spawnSync('curl', args, { input, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`curl exited with code ${result.status}: ${result.stderr}`);
  }

  const output = result.stdout.trim();
  if (!output) return {};
  try {
    return JSON.parse(output);
  } catch (e) {
    return { raw: output };
  }
}

async function uploadAssetWithRetry(releaseId, uploadUrl, filePath, fileName, contentType, retries = 5) {
  const uploadEndpoint = uploadUrl.replace(/\{\?name,label\}/, '');
  const targetUrl = `${uploadEndpoint}?name=${encodeURIComponent(fileName)}`;
  const fileSize = fs.statSync(filePath).size;

  for (let i = 0; i < retries; i++) {
    try {
      // Check if asset already exists on this release
      const existingAssets = await request({
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases/${releaseId}/assets`,
        method: 'GET'
      });

      if (Array.isArray(existingAssets)) {
        const match = existingAssets.find(a => a.name === fileName || a.name.includes(fileName.replace('调试百宝箱', '')));
        if (match) {
          if (match.state === 'uploaded' && match.size === fileSize && match.name === fileName) {
            console.log(`Asset ${fileName} is already fully uploaded (${match.size} bytes). Skipping!`);
            return match;
          } else {
            console.log(`Asset ${match.name} exists with state '${match.state}' / size ${match.size} (expected ${fileSize}). Deleting existing asset ID ${match.id}...`);
            await request({
              hostname: 'api.github.com',
              path: `/repos/${REPO}/releases/assets/${match.id}`,
              method: 'DELETE'
            });
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      console.log(`Uploading ${fileName} (${(fileSize / (1024 * 1024)).toFixed(1)} MB) via curl --http1.1 (Attempt ${i + 1}/${retries})...`);
      
      const curlArgs = [
        '--http1.1',
        '-X', 'POST',
        '-s', '-S',
        '--retry', '3',
        '--retry-delay', '3',
        '-H', `Authorization: token ${TOKEN}`,
        '-H', `Content-Type: ${contentType}`,
        '-H', 'User-Agent: TiaoshiBox-Publisher',
        '--data-binary', `@${filePath}`,
        targetUrl
      ];
        
      const result = spawnSync('curl', curlArgs, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 900000 });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`curl exited with code ${result.status}: ${result.stderr}`);

      let resp = {};
      try {
        resp = JSON.parse(result.stdout.trim());
      } catch (e) {
        throw new Error(`Invalid response JSON: ${result.stdout.slice(0, 200)}`);
      }
      
      if (resp.id || resp.state === 'uploaded') {
        console.log(`Successfully uploaded ${fileName}! (Asset ID: ${resp.id})`);
        return resp;
      } else {
        throw new Error(`Upload response error: ${JSON.stringify(resp)}`);
      }
    } catch (err) {
      console.error(`Attempt ${i + 1} failed for ${fileName}:`, err.message);
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function run() {
  try {
    let releaseData = null;
    
    // Check if release already exists
    try {
      console.log('Checking for existing release...');
      const existing = await request({
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases/tags/${TAG}`,
        method: 'GET'
      });
      
      if (existing && existing.id) {
        console.log(`Found existing release (ID: ${existing.id}). Reusing it!`);
        releaseData = existing;
      }
    } catch (e) {
      console.log('No existing release found. Will create a fresh one.');
    }

    if (!releaseData) {
      console.log('Creating fresh GitHub release...');
      releaseData = await request({
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases`,
        method: 'POST'
      }, {
      tag_name: TAG,
      target_commitish: '1.1.1',
      name: '调试百宝箱 v1.1.1 正式发布 🚀',
      body: `### 调试百宝箱 v1.1.1 正式发布 🚀

调试百宝箱发布 v1.1.1 版本升级！本次更新全新上线了工业级 **OPC UA 远程方法调用 (RPC / Method Invocation) 控制台**，全面支持工业现场脱扣告警读取/下发等各类复杂方法交互，并优化了全协议连接体验与操作流程！

---

#### 🌟 核心功能与重大更新

##### 1. OPC UA 远程方法调用控制台 (RPC / Method Invocation) ⚡
* **全对象方法寻址**：支持指定任意 **所属对象节点 (ObjectId)** 与 **目标方法节点 (MethodId)** 发起远程 RPC 方法调用；
* **多类型参数灵活配置**：支持添加 0 ~ N 个输入参数，支持选择 \`String (含 JSON)\`、\`Int32\`、\`UInt32\`、\`Int16\`、\`UInt16\`、\`Float\`、\`Double\`、\`Boolean\`、\`Byte\` 等全标准 OPC UA 数据类型；
* **无参调用一键直达**：对于读取型方法（如 \`trip_alarm_get\`），无需配置任何参数，一键秒级发起调用；
* **JSON 智能解析与格式化**：参数输入支持一键格式化校验 JSON 语法；服务端返回的 JSON 数据自动以 Pretty 格式树状代码高亮展示，并提供一键复制返回值功能；
* **树节点智能联动**：地址空间树自动识别 \`Method\` 类型节点，节点右侧提供快捷 \`[⚡调用]\` 按钮，点击自动带入方法节点；
* **极简原生交互**：采用打字即消失的清爽占位符提示（Placeholder），告别冗余预设与界面负担。

##### 2. 全协议连接控制与界面交互细节优化 🎨
* **连接状态实时感知**：IEC 104、Modbus、OPC UA 通道栏全量配备高亮动态呼吸徽标（🟢已连接 / 🟡连接中 / 🔴已断开）；
* **通道去重与智能复用**：修改规约参数/ASDU 时就地重用通道，消除同名重复通道；
* **浅色模式与拖拽分栏**：全面适配高对比度现代浅色主题，左侧地址树与底部报文日志支持双向自由拖拽调节并持久化记忆。

---

#### 📦 下载与安装指南
* **macOS 平台 (Apple Silicon M系列芯片)**：下载 \`调试百宝箱-1.1.1-arm64.dmg\`，双击打开并拖拽到 Applications 即可使用。
* **Windows 平台**：下载 \`调试百宝箱 Setup 1.1.1.exe\`（一键安装包）或 \`调试百宝箱-1.1.1-win.zip\`（便携解压即用版）。`,
      draft: false,
      prerelease: false
    });
    console.log(`New release created! ID: ${releaseData.id}`);
    }

    const uploadUrl = releaseData.upload_url;

    for (const asset of assets) {
      const filePath = path.join(distDir, asset.name);
      if (fs.existsSync(filePath)) {
        await uploadAssetWithRetry(releaseData.id, uploadUrl, filePath, asset.name, asset.contentType);
      } else {
        console.warn(`Warning: Asset file not found: ${filePath}`);
      }
    }

    console.log('All release operations completed successfully!');
  } catch (err) {
    console.error('Publish failed:', err);
    process.exit(1);
  }
}

run();
