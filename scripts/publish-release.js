const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

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
const TAG = 'v1.1.0';

const assets = [
  { name: '调试百宝箱-1.1.0-arm64.dmg', contentType: 'application/octet-stream' },
  { name: '调试百宝箱 Setup 1.1.0.exe', contentType: 'application/octet-stream' },
  { name: '调试百宝箱-1.1.0-win.zip', contentType: 'application/zip' },
  { name: '调试百宝箱-1.1.0-arm64-win.zip', contentType: 'application/zip' }
];

const { execSync, spawnSync } = require('child_process');
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

async function uploadAssetWithRetry(uploadUrl, filePath, fileName, contentType, retries = 5) {
  const cleanUrl = uploadUrl.replace(/\{\?name,label\}/, '') + `?name=${encodeURIComponent(fileName)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Uploading ${fileName} via curl (Attempt ${i + 1}/${retries})...`);
      
      const curlCmd = `curl -s -S --retry 3 --retry-delay 3 ` +
        `-H "Authorization: token ${TOKEN}" ` +
        `-H "Content-Type: ${contentType}" ` +
        `-H "User-Agent: TiaoshiBox-Publisher" ` +
        `--data-binary @"${filePath}" ` +
        `"${cleanUrl}"`;
        
      const output = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 600000 });
      let resp = {};
      try {
        resp = JSON.parse(output);
      } catch (e) {
        throw new Error(`Invalid response JSON: ${output.slice(0, 200)}`);
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
      console.log('Checking for existing release to delete...');
      releaseData = await request({
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases/tags/${TAG}`,
        method: 'GET',
        headers: {
          'Authorization': `token ${TOKEN}`,
          'User-Agent': 'TiaoshiBox-Publisher'
        }
      });
      
      if (releaseData && releaseData.id) {
        console.log(`Release exists (ID: ${releaseData.id}). Deleting it to avoid conflicts...`);
        await request({
          hostname: 'api.github.com',
          path: `/repos/${REPO}/releases/${releaseData.id}`,
          method: 'DELETE',
          headers: {
            'Authorization': `token ${TOKEN}`,
            'User-Agent': 'TiaoshiBox-Publisher'
          }
        });
        console.log('Successfully deleted existing release. Waiting 3 seconds for propagation...');
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) {
      console.log('No existing release found. Creating a fresh one...');
    }

    console.log('Creating fresh GitHub release...');
    releaseData = await request({
      hostname: 'api.github.com',
      path: `/repos/${REPO}/releases`,
      method: 'POST',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'TiaoshiBox-Publisher',
        'Content-Type': 'application/json'
      }
    }, {
      tag_name: TAG,
      target_commitish: 'main',
      name: '调试百宝箱 v1.1.0 正式发布 🚀',
      body: `### 调试百宝箱 v1.1.0 正式发布 🚀

调试百宝箱迎来重磅 v1.1.0 版本升级！本次更新全新上线了工业级 OPC UA 调试舱、全面重构了浅色模式的高质感视觉体验，并引入了双向自由拖拽分栏与通道状态实时指示体系。

---

#### 🌟 核心功能与重大更新

##### 1. 全新 OPC UA 工业级调试舱 (NEW!) 📡
* **端点连接与安全认证**：支持标准 \`opc.tcp://\` 端点接入，全面支持 None / Sign / SignAndEncrypt 安全加密模式及匿名/账号密码认证；
* **地址空间懒加载树**：支持层级化浏览 OPC UA 地址空间，具备亚像素物理级对齐的复选框插槽与高可视度层级连接虚线；
* **实时数据监视舱**：支持 Ctrl / Cmd / Shift 范围多选点位批量添加，毫秒级数据订阅与时标变动跟踪；
* **智能数据类型解析**：内置 OPC UA 标准类型字典与自定义枚举/结构体解析器（如 \`Enum (LcSysStatus_enum)\` 友好识别）；
* **变量数值写入与控制**：支持快速弹出详情面板并向服务端执行变量修改与写入下发。

##### 2. 浅色模式 (Light Mode) 视觉美学全方位重构 🎨
* **现代科技配色**：基于 Apple / Linear 现代设计语言，纯白卡片（#ffffff）搭配高对比度深青板岩黑（#0f172a / Slate 900），彻底解决浅色模式下文字发虚、发白的问题；
* **组件原生无缝适配**：顶部导航栏、四大协议连接栏、点位表格与底部通信日志全面去除了硬编码深色背景，通透优雅。

##### 3. 工作区双向自由拖拽分栏 (Draggable Splitters) 📐
* **左侧侧边栏宽度自由拖拽**：支持在 180px ~ 600px 之间丝滑拖拽调整地址树宽度；
* **底部报文日志高度自由拖拽**：支持在 80px ~ 500px 之间自由调整报文日志视野；
* **状态持久化记忆**：自动将用户的布局尺寸偏好保存至本地。

##### 4. 全协议连接控制与通道管理增强 ⚡
* **通道实时状态徽标**：在 IEC 104、Modbus、OPC UA 通道栏新增带发光指示灯的状态徽标（🟢已连接 / 🟡连接中 / 🔴已断开）；
* **智能通道去重与复用**：修改 ASDU 地址或规约参数时自动复用已有通道，彻底消除了重复幽灵通道；
* **便捷通道维护**：已断开通道提供快捷「重连」与「🗑️ 移除通道」操作。

##### 5. SSH 终端 (RShell) 稳定性优化 💻
* 修复多会话切换时由于 DOM 卸载造成的黑屏断连问题与窗口尺寸震荡截断问题；
* 自动持久化记忆上次选择的主题配色模式。

---

#### 📦 下载与安装指南
* **macOS 平台 (Apple Silicon M系列芯片)**：下载 \`调试百宝箱-1.1.0-arm64.dmg\`，双击打开并拖拽到 Applications 即可使用。
* **Windows 平台**：下载 \`调试百宝箱 Setup 1.1.0.exe\`（一键安装包）或 \`调试百宝箱-1.1.0-win.zip\`（便携解压即用版）。`,
      draft: false,
      prerelease: false
    });
    console.log(`New release created! ID: ${releaseData.id}`);

    const uploadUrl = releaseData.upload_url;

    for (const asset of assets) {
      const filePath = path.join(distDir, asset.name);
      if (fs.existsSync(filePath)) {
        await uploadAssetWithRetry(uploadUrl, filePath, asset.name, asset.contentType);
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
