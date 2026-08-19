# Nginx 部署手册 — 企业贷款综合融资成本公示系统（Windows 环境）

---

## 🚀 快速开始（3 分钟部署）

```powershell
# 1. 将项目复制到纯英文路径（避开 Nginx 中文路径 bug）
mkdir C:\web -Force
Copy-Item -Path "f:\综合融资成本明示" -Destination "C:\web\finance-cost" -Recurse

# 2. 下载 Nginx 解压到 C:\nginx 后，编辑 C:\nginx\conf\nginx.conf
#    将 root 设为 C:/web/finance-cost，listen 设为 8080

# 3. 验证并启动
cd C:\nginx
.\nginx.exe -t          # 验证配置
start .\nginx.exe       # 后台启动

# 4. 放行防火墙（管理员 PowerShell）
netsh advfirewall firewall add rule name="Nginx-8080" dir=in action=allow protocol=TCP localport=8080

# 5. 获取局域网 IP 并访问
ipconfig | findstr /i "IPv4"
# → 浏览器打开 http://<你的IP>:8080/index.html
```

遇到问题？请继续阅读下方完整章节。

---

> ⚠️ **重要警告：中文路径兼容性**
>
> Nginx 在 Windows 上对非 ASCII 路径（含中文）存在历史编码问题，可能导致 `403 Forbidden` 或 `404 Not Found`，且错误日志中无法明确定位。
>
> **强烈建议**将项目复制到**纯英文路径**后再部署，例如：
>
> ```powershell
> # PowerShell —— 将项目复制到纯英文路径
> mkdir C:\web -Force
> Copy-Item -Path "f:\综合融资成本明示" -Destination "C:\web\finance-cost" -Recurse
> ```
>
> 如果坚持使用中文路径，请务必在完成第 4 节"启动与验证"后立即执行本机访问测试，若出现 403/404 则切换到纯英文路径方案。

---

## 目录

1. [部署前准备](#1-部署前准备)
2. [下载与安装 Nginx](#2-下载与安装-nginx)
3. [配置 Nginx](#3-配置-nginx)
4. [启动与验证](#4-启动与验证)
5. [配置 Windows 防火墙（关键步骤）](#5-配置-windows-防火墙关键步骤)
6. [局域网访问验证](#6-局域网访问验证)
7. [Nginx 服务管理命令](#7-nginx-服务管理命令)
8. [设置开机自启（可选）](#8-设置开机自启可选)
9. [常见问题排查](#9-常见问题排查)
10. [目录结构总览](#10-目录结构总览)

---

## 1. 部署前准备

### 1.1 确认项目文件就绪

```
f:\综合融资成本明示\
├── index.html              ← 主程序入口
├── lib\
│   ├── html2canvas.min.js  ← PDF 截图库
│   └── jspdf.umd.min.js    ← PDF 生成库
└── 项目文档.md
```

确保 `index.html` 和 `lib/` 目录完整存在。

### 1.2 确认 Windows 版本

支持 Windows 7 / 8 / 10 / 11 / Server 2012+，64 位系统。

### 1.3 确认端口未被占用

默认使用 **8080** 端口，可自定义。先检查端口是否空闲：

```powershell
# PowerShell 查看端口占用
netstat -ano | findstr :8080
```

若无输出则端口空闲；若有输出（显示 LISTENING），需换端口或关闭占用进程。

---

## 2. 下载与安装 Nginx

### 2.1 下载

访问 Nginx 官方下载页（需科学上网）：

```
http://nginx.org/en/download.html
```

选择 **Windows 版本** → 下载稳定版（Stable），例如 `nginx-1.26.2.zip`。

**国内镜像备选**（无需科学上网）：

| 镜像源 | 地址 |
|--------|------|
| 华为云镜像 | https://mirrors.huaweicloud.com/nginx/ |
| 腾讯云镜像 | https://mirrors.cloud.tencent.com/nginx/ |
| 阿里云镜像 | https://mirrors.aliyun.com/nginx/ |

> 提示：在上述镜像站找到对应的 Windows zip 包，如 `nginx-1.26.2.zip`。

### 2.2 解压安装

> ⚠️ **不要解压到含中文或空格的路径**！Nginx 对路径编码敏感。

推荐解压到纯英文路径，例如：

```
C:\nginx\
```

解压后目录结构：

```
C:\nginx\
├── nginx.exe
├── conf\
│   ├── nginx.conf      ← 主配置文件（需修改）
│   └── mime.types
├── html\
├── logs\
└── temp\
```

> 说明：如果安装路径不是 `C:\nginx`，以下所有涉及路径的地方请替换为你实际的安装路径，下文用 `C:\nginx` 作为示例。

---

## 3. 配置 Nginx

### 3.1 备份原始配置（重要）

```powershell
copy C:\nginx\conf\nginx.conf C:\nginx\conf\nginx.conf.bak
```

### 3.2 编辑 nginx.conf

用记事本或 VS Code 打开 `C:\nginx\conf\nginx.conf`，**全部替换**为以下内容：

```nginx
# ============================
# 企业贷款综合融资成本公示系统 — Nginx 配置
# 编码：UTF-8
# ============================

worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # 中文编码支持
    charset utf-8;

    sendfile        on;
    keepalive_timeout  65;

    # gzip 压缩（加速静态资源传输）
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    server {
        listen       8080;          # 监听端口，可自行修改
        server_name  _;              # 匹配所有域名/IP

        # 项目根目录 —— 指向你的项目实际路径
        # 【推荐】使用纯英文路径（已复制项目到 C:\web\finance-cost）
        root   C:/web/finance-cost;
        # 【备选】使用中文原路径（可能遇到编码问题）
        # root   f:/综合融资成本明示;
        index  index.html;

        # 日志
        access_log  logs/finance_access.log;
        error_log   logs/finance_error.log;

        # 根路径 —— 直接返回 index.html
        location / {
            try_files $uri $uri/ /index.html;
        }

        # lib 目录 —— 静态资源不缓存（开发期），正式环境可加缓存
        location /lib/ {
            expires 7d;
            add_header Cache-Control "public, immutable";
        }

        # 禁止访问隐藏文件
        location ~ /\. {
            deny all;
        }

        # MIME 类型兜底（js 文件）
        location ~* \.js$ {
            types { }
            default_type application/javascript;
        }
    }
}
```

### 3.3 路径说明

| 配置项 | 说明 |
|--------|------|
| `listen 8080` | 监听端口，改为 `80` 则可省略端口号直接访问 |
| `root C:/web/finance-cost` | **推荐**纯英文路径，指向复制后的项目目录 |
| `root f:/综合融资成本明示` | 原中文路径，**可能遇到编码问题**（见顶部警告） |
| `charset utf-8` | 确保页面中文内容正常显示 |

> 修改 `root` 后，请执行 `.\nginx.exe -t` 验证，再执行 `.\nginx.exe -s reload` 生效。

### 3.4 验证配置语法

修改完成后，先**不要启动**，先验证配置是否正确：

```powershell
cd C:\nginx
.\nginx.exe -t
```

**预期输出**（表示配置正确）：

```
nginx: the configuration file C:\nginx/conf/nginx.conf syntax is ok
nginx: configuration file C:\nginx/conf/nginx.conf test is successful
```

**常见错误及处理**：

| 报错信息 | 原因 | 解决方法 |
|---------|------|---------|
| `unknown directive` | 配置文件语法错误 | 检查括号、分号、指令拼写 |
| `invalid number of arguments` | 指令参数缺失 | 参考上方正确配置 |
| `CreateFile() failed (2: The system cannot find the file specified)` | root 路径不存在 | 检查 `root` 指向的目录是否正确 |

---

## 4. 启动与验证

### 4.1 启动 Nginx

```powershell
cd C:\nginx
start .\nginx.exe
```

> 注意：使用 `start` 命令让 Nginx 在后台运行，不要直接运行 `.\nginx.exe`（会阻塞当前窗口）。

### 4.2 检查进程是否启动

```powershell
tasklist | findstr nginx
```

**预期输出**（至少看到 2 个进程：master + worker）：

```
nginx.exe       12345 Console    1    4,123 K
nginx.exe       12346 Console    1    4,123 K
```

### 4.3 本机访问验证

打开浏览器，访问：

```
http://localhost:8080/index.html
```

或

```
http://127.0.0.1:8080/index.html
```

**预期结果**：页面正常显示，无乱码，JS 库加载正常（无控制台 404 错误）。

**如果页面打不开**：

```powershell
# 检查端口是否在监听
netstat -ano | findstr :8080

# 检查 Nginx 错误日志
type C:\nginx\logs\finance_error.log
```

---

## 5. 配置 Windows 防火墙（关键步骤）

> 这是**最容易遗漏的一步**！不配置防火墙，局域网其他电脑将无法访问。

### 方法 A：PowerShell 命令（推荐，一键完成）

以**管理员身份**打开 PowerShell，执行：

```powershell
# 允许 TCP 8080 端口入站
netsh advfirewall firewall add rule name="Nginx-8080" dir=in action=allow protocol=TCP localport=8080
```

**预期输出**：

```
确定。
```

### 方法 B：防火墙 GUI（图形界面）

1. 按 `Win + R`，输入 `wf.msc`，回车打开"高级安全 Windows Defender 防火墙"
2. 左侧点击 **入站规则** → 右侧点击 **新建规则**
3. 规则类型选择 **端口** → 下一步
4. 协议选择 **TCP**，特定本地端口输入 `8080` → 下一步
5. 选择 **允许连接** → 下一步
6. 全部勾选（域、专用、公用）→ 下一步
7. 名称填 `Nginx-8080` → 完成

### 验证防火墙规则

```powershell
netsh advfirewall firewall show rule name="Nginx-8080"
```

---

## 6. 局域网访问验证

### 6.1 获取本机局域网 IP

```powershell
ipconfig | findstr /i "IPv4"
```

**预期输出**（找到类似如下行）：

```
   IPv4 地址 . . . . . . . . . . . . : 192.168.1.100
```

记下这个 IP（假设为 `192.168.1.100`）。

### 6.2 局域网其他电脑访问

在同一局域网的另一台电脑上，打开浏览器访问：

```
http://192.168.1.100:8080/index.html
```

**预期结果**：页面正常加载，所有功能（计算、PDF 导出）正常使用。

### 6.3 如果无法访问

按以下顺序排查：

| 序号 | 检查项 | 命令/方法 |
|------|--------|----------|
| 1 | 两台电脑是否在同一网段 | 分别执行 `ipconfig` 对比前三个网段数字 |
| 2 | Nginx 是否在运行 | `tasklist | findstr nginx` |
| 3 | 端口是否监听 | `netstat -ano | findstr :8080` |
| 4 | 防火墙是否放行 | 第 5 节步骤重走一遍 |
| 5 | 本机杀毒软件是否拦截 | 临时关闭杀毒软件测试 |
| 6 | 从另一台电脑 ping 本机 | `ping 192.168.1.100` |

---

## 7. Nginx 服务管理命令

在 `C:\nginx` 目录下执行：

| 操作 | 命令 |
|------|------|
| 启动 | `start .\nginx.exe` |
| 停止 | `.\nginx.exe -s stop` |
| 平滑停止（处理完当前请求再关闭） | `.\nginx.exe -s quit` |
| 重载配置（修改 nginx.conf 后热加载） | `.\nginx.exe -s reload` |
| 验证配置语法 | `.\nginx.exe -t` |

> 小技巧：修改 `nginx.conf` 后，只需执行 `.\nginx.exe -s reload` 即可生效，**无需重启 Nginx**。

---

## 8. 设置开机自启（可选）

Nginx 不会随 Windows 自动启动，以下是两种实现开机自启的方法。

### 方法 A：使用 NSSM（推荐，最稳定）

NSSM 是一个轻量级服务包装器，可将任意程序注册为 Windows 服务。

**步骤**：

1. 下载 NSSM：访问 https://nssm.cc/download ，下载 `nssm-2.24.zip`
2. 解压后，根据系统架构进入 `win64` 或 `win32` 目录
3. 将 `nssm.exe` 复制到 `C:\nginx\` 目录
4. 以管理员身份打开 PowerShell，执行：

```powershell
cd C:\nginx

# 注册服务
.\nssm.exe install Nginx "C:\nginx\nginx.exe"

# 设置工作目录（重要，否则找不到 conf）
.\nssm.exe set Nginx AppDirectory "C:\nginx"

# 设置服务描述（可选）
.\nssm.exe set Nginx Description "Nginx Web Server for 综合融资成本公示系统"

# 设置自动启动
.\nssm.exe set Nginx Start SERVICE_AUTO_START

# 启动服务
.\nssm.exe start Nginx
```

**验证服务状态**：

```powershell
# 查看服务是否在运行
Get-Service Nginx

# 预期输出：Status 为 Running，StartType 为 Automatic
```

**管理命令**：

| 操作 | 命令 |
|------|------|
| 启动服务 | `net start Nginx` |
| 停止服务 | `net stop Nginx` |
| 重启服务 | `net stop Nginx && net start Nginx` |
| 删除服务 | `.\nssm.exe remove Nginx confirm` |

### 方法 B：启动文件夹（最简单，无需额外软件）

1. 按 `Win + R`，输入 `shell:startup`，回车打开启动文件夹
2. 在启动文件夹中新建一个文件 `start_nginx.cmd`，内容：

```batch
@echo off
cd /d C:\nginx
start "" nginx.exe
```

3. 保存后，每次开机将自动启动 Nginx

> 缺点：用户登录后才启动，且不显示为 Windows 服务。

---

## 9. 常见问题排查

### 9.1 Nginx 无法启动

**现象**：执行 `start .\nginx.exe` 后，进程立即消失。

**排查**：

```powershell
# 查看错误日志
type C:\nginx\logs\error.log

# 常见原因1：端口被占用
netstat -ano | findstr :8080
# → 如果有输出，找到 PID 后结束进程：taskkill /PID <PID> /F

# 常见原因2：配置文件语法错误
.\nginx.exe -t
# → 根据报错信息修改 nginx.conf
```

### 9.2 页面显示 403 Forbidden

**原因**：Nginx 无法访问项目目录。

**排查**：

1. 确认 `nginx.conf` 中 `root` 路径正确
2. 检查目录权限：确保运行 Nginx 的用户对项目目录有读取权限
3. 在 `nginx.conf` 的 `server` 块中添加：

```nginx
autoindex off;
try_files $uri $uri/ /index.html;
```

4. **如果 `root` 使用了中文路径**（如 `f:/综合融资成本明示`），极可能是编码问题 → **立即切换到纯英文路径**：

```powershell
# PowerShell —— 复制项目到纯英文路径
mkdir C:\web -Force
Copy-Item -Path "f:\综合融资成本明示" -Destination "C:\web\finance-cost" -Recurse

# 修改 nginx.conf 中的 root 为 C:/web/finance-cost
# 然后重载配置
cd C:\nginx
.\nginx.exe -s reload
```

### 9.2a 页面显示 404 Not Found（配置语法验证通过）

**原因**：同上，Nginx 中文路径编码问题导致找不到文件。

**解决**：同 9.2 第 4 步，切换到纯英文路径即可。

### 9.3 页面显示乱码

**原因**：字符编码未正确设置。

**解决**：确认 `nginx.conf` 的 `http` 块中有 `charset utf-8;`，且 `index.html` 的 `<meta charset="UTF-8">` 存在。

### 9.4 局域网其他电脑无法访问

按第 6.3 节的排查清单逐项检查，90% 的情况是**防火墙未放行端口**。

### 9.5 PDF 导出功能异常

**检查项**：

1. 打开浏览器开发者工具（F12）→ Console 标签
2. 访问 `http://你的IP:8080/lib/html2canvas.min.js` 和 `http://你的IP:8080/lib/jspdf.umd.min.js`，确认能正常下载
3. 如果 404，检查项目目录下 `lib/` 文件夹是否完整

### 9.6 修改配置后未生效

```powershell
# 必须执行 reload 才能加载新配置
cd C:\nginx
.\nginx.exe -t          # 先验证配置正确
.\nginx.exe -s reload   # 再热加载
```

### 9.7 想换端口

1. 修改 `nginx.conf` 中 `listen 8080;` 为新端口（如 `listen 9090;`）
2. 重载配置：`.\nginx.exe -s reload`
3. 更新防火墙规则：

```powershell
# 旧规则可删除
netsh advfirewall firewall delete rule name="Nginx-8080"

# 添加新规则（以 9090 为例）
netsh advfirewall firewall add rule name="Nginx-9090" dir=in action=allow protocol=TCP localport=9090
```

---

## 10. 目录结构总览

部署完成后的完整目录结构：

```
C:\nginx\                              ← Nginx 安装目录（纯英文路径）
├── nginx.exe                          ← 主程序
├── nssm.exe                           ← 服务包装器（可选，用于开机自启）
├── conf\
│   ├── nginx.conf                     ← 主配置文件（已修改为项目配置）
│   ├── nginx.conf.bak                 ← 原始配置备份
│   └── mime.types
├── logs\
│   ├── access.log
│   ├── error.log
│   ├── finance_access.log             ← 项目访问日志
│   └── finance_error.log              ← 项目错误日志
├── temp\
└── html\                              ← 默认欢迎页（可删除）

f:\综合融资成本明示\                    ← 项目目录
├── index.html                         ← 主程序
└── lib\
    ├── html2canvas.min.js
    └── jspdf.umd.min.js
```

---

## 快速操作参考卡

```powershell
# 进入 Nginx 目录
cd C:\nginx

# 启动
start .\nginx.exe

# 停止
.\nginx.exe -s stop

# 重载配置
.\nginx.exe -t && .\nginx.exe -s reload

# 查看进程
tasklist | findstr nginx

# 查看端口
netstat -ano | findstr :8080

# 防火墙放行（管理员 PowerShell）
netsh advfirewall firewall add rule name="Nginx-8080" dir=in action=allow protocol=TCP localport=8080

# 本机 IP
ipconfig | findstr /i "IPv4"
```
