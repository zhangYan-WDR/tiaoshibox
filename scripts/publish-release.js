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
const TAG = 'v1.0.0';

const assets = [
  { name: '调试百宝箱-1.0.0-arm64.dmg', contentType: 'application/octet-stream' },
  { name: '调试百宝箱 Setup 1.0.0.exe', contentType: 'application/octet-stream' },
  { name: '调试百宝箱-1.0.0-arm64-win.zip', contentType: 'application/zip' }
];

const distDir = path.join(__dirname, '../dist-package');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || '{}'));
        } else {
          reject(new Error(`Status: ${res.statusCode}, Body: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function uploadAssetWithRetry(uploadUrl, filePath, fileName, contentType, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Uploading ${fileName} (Attempt ${i + 1}/${retries})...`);
      const fileStats = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      
      const cleanUrl = uploadUrl.replace(/\{\?name,label\}/, '') + `?name=${encodeURIComponent(fileName)}`;
      const urlObj = new URL(cleanUrl);

      await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Authorization': `token ${TOKEN}`,
            'User-Agent': 'TiaoshiBox-Publisher',
            'Content-Type': contentType,
            'Content-Length': fileStats.size
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 201) {
              console.log(`Successfully uploaded ${fileName}!`);
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`Status ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', reject);
        fileStream.pipe(req);
      });
      return; // Succeeded!
    } catch (err) {
      console.error(`Attempt ${i + 1} failed for ${fileName}:`, err.message);
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
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
      name: TAG,
      body: `### 调试百宝箱 v1.0.0 正式发布 🚀\n\n#### 🌟 核心特色与功能亮点\n* **Modbus TCP 调试舱**：支持主从站双向仿真，多寄存器读写监视与波形图分析。\n* **IEC 104 控制台**：符合标准电力规约，支持遥信、遥测、遥控及精准 SOE 毫秒级时标报文解析。\n* **IEC 61850 MMS 节点浏览与 GOOSE 传输**：IED 模型树状节点浏览、值监控写入，支持 GOOSE 组播发包/收包调试。\n* **套接字网络收发端**：定时循环发送，支持 ASCII/Hex 双十六进制数据双向收发。\n* **网络现场诊断**：内置高精度 Ping 以及 TCP 全局端口快速扫描探测。\n* **浮点与十六进制转换**：内置 IEEE 754 浮点转换与 CRC16/CheckSum 异或校验算法。\n\n#### 📦 编译产物下载\n* **macOS 平台 (Apple Silicon)**：\`调试百宝箱-1.0.0-arm64.dmg\`\n* **Windows 平台**：\`调试百宝箱 Setup 1.0.0.exe\` (安装包), \`调试百宝箱-1.0.0-arm64-win.zip\` (免安装便携版)`,
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
