# 调试百宝箱 🛠️

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=flat-square)](#)
[![Electron](https://img.shields.io/badge/Electron-v30.5-68a063?logo=electron&style=flat-square)](#)
[![React](https://img.shields.io/badge/React-v18.3-20232a?logo=react&style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-brightgreen?style=flat-square)](#)

**调试百宝箱** 是一款面向电力系统、工业自动化、物联网现场调试工程师量身打造的多协议调试与网络现场工具集。客户端整合了 **Modbus TCP**、**IEC 104**、**IEC 61850 (MMS/GOOSE)**、**TCP/UDP 套接字调试**、**网络诊断**以及**数据转换计算**等多个核心模块，提供优雅的深色极客视觉设计与流畅的微交互，助您在现场调试、协议分析与设备联调中如虎添翼。

---

## ✨ 核心模块与功能亮点

### 🔌 1. Modbus TCP 调试舱 (Modbus TCP Client & Simulator)
* **双向联调能力**：内置高可用的 Modbus 客户端与仿真器（主站/从站），支持实时线圈（Coils）、离散输入（Discrete Inputs）、保持寄存器（Holding Registers）以及输入寄存器（Input Registers）的读写调试。
* **批量模拟与数据可视化**：支持批量寄存器模拟、数据变化波形监控及多格式解析（整型、浮点、双精度、十六进制、二进制）。

### ⚡ 2. IEC 60870-5-104 控制台 (IEC 104 Client & Simulator)
* **电力 104 规约仿真**：完美实现标准 IEC 104 电力规约，支持遥信（Single/Double Point Information）、遥测（Normalized/Scaled/Floating Point Value）以及遥控（Single/Double Command）的全功能主站/子站调试。
* **SOE 报文解析**：支持事件顺序记录（SOE）实时毫秒级捕获，结构化展示带时标的遥信变化报文，为现场分析故障提供精确数据依据。

### 🌐 3. IEC 61850 MMS 节点浏览器与 GOOSE 传输
* **MMS 树状层级浏览**：支持连接远端 MMS 服务端，自动在线检索 IED 设备模型，树状展示逻辑设备（LD）、逻辑节点（LN）、数据（Data）及数据属性（DA）模型。
* **数据实时监视与值控**：支持数据属性值的实时监视、双击快速修改下发控令，支持读取/写入数据集。
* **GOOSE 组播发包/收包**：支持在本地网卡监听与构造发送 GOOSE 组播报文，满足智能变电站快速跳闸、闭锁及状态变位调试需求。

### 📡 4. TCP/UDP 网络套接字调试器 (Socket Debugger)
* **高并发收发引擎**：支持创建 TCP Client、TCP Server 以及 UDP 监听端，实现十六进制与 ASCII 码的双向快速收发。
* **自动循环发送与定时触发**：支持毫秒级精度的自动循环发送及快捷指令预设，极大简化重复发包验证工作。

### 🎯 5. 网络现场诊断靶场 (Network Diagnosis Tool)
* **多网卡流量探测**：集成网络诊断工具，支持在线进行高精度毫秒级 **Ping 延迟测试**。
* **快速端口侦测扫描**：针对目标主机执行全量或指定范围的 TCP 端口扫描，快速诊断远程服务端口开放状态及网络连通性。

### 🔢 6. 工业数据计算百宝箱 (Data Converter & Calculator)
* **浮点与十六进制互转**：支持 IEEE 754 标准下单精度与双精度浮点数与 Hex 十六进制字符串的双向解析。
* **多进制转换与异或校验**：集成二进制、十进制、十六进制、八进制之间的实时极速转换，支持常用 CRC16（Modbus、CCITT 等）及 Lrc、CheckSum 异或校验码的一键计算。

---

## 🛠️ 技术栈架构

* **应用外壳 (Shell)**: [Electron v30.5](https://www.electronjs.org/) —— 支持 macOS 隐藏式标题栏拖拽，管理原生 C++ 底层套接字及多进程通信。
* **构建系统 (Builder)**: [Vite v5.4](https://vitejs.dev/) —— 极致的开发编译效率，轻量化输出包。
* **前端框架 (Frontend)**: [React v18.3](https://react.dev/) —— 响应式数据驱动，管理各种工控数据状态。
* **工业协议核心库**:
  * 自研高性能 Modbus 状态机
  * IEC 104 标准规约底层编解码引擎
  * MMS (Manufacturing Message Specification) 结构解析器
  * GOOSE 原生以太网二层报文收发兼容层
* **图标库**: [Lucide React v0.344](https://lucide.dev/) —— 扁平极客化的矢量图标组件。

---

## 🚀 开发者指南

### 本地开发环境运行

1. **克隆仓库并安装依赖**
   ```bash
   git clone https://github.com/zhangYan-WDR/tiaoshibox.git
   cd tiaoshibox
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```

### 生产打包构建

调试百宝箱支持全平台自动化构建：

```bash
npm run package
```
* **macOS 平台**：编译生成 `dist-package/调试百宝箱-1.0.0-arm64.dmg`。
* **Windows 平台**：编译生成 `dist-package/调试百宝箱 Setup 1.0.0.exe`（安装包）及 `dist-package/调试百宝箱-1.0.0-arm64-win.zip`（便携版）。

---

## 📄 开源许可证

本项目基于 **MIT License** 许可协议开源。
