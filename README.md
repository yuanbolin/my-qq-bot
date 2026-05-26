# my-bot

基于 [qq-official-bot](https://github.com/zhinjs/qq-official-bot) 的 QQ 官方机器人，支持**群聊**与**私聊**消息监听与发送。

## 前置条件

1. 在 [QQ 开放平台](https://q.qq.com/qqbot/) 创建机器人应用
2. 获取 **AppID** 与 **AppSecret**
3. 在机器人设置中开通 **群聊** 与 **私聊** 相关权限
4. 订阅事件 intent：`GROUP_AND_C2C_EVENT`（群聊 @ 消息与 C2C 私聊）

> 群聊中通常需要 **@ 机器人** 才会触发消息事件。

## 快速开始

```bash
# 安装依赖
npm install

# 复制并填写环境变量
copy .env.example .env

# 启动（WebSocket 模式）
npm run dev
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `QQ_APPID` | 机器人 App ID |
| `QQ_SECRET` | 机器人 App Secret |
| `QQ_SANDBOX` | 是否沙箱环境，默认 `true` |
| `LOG_LEVEL` | SDK 日志级别，默认 `info` |
| `APP_LOG_LEVEL` | 应用日志级别，默认与 `LOG_LEVEL` 相同 |
| `LOG_DIR` | 应用日志目录，默认 `./logs`；设为空字符串关闭文件日志 |

## 日志

- 应用日志：`logs/my-bot-YYYY-MM-DD.log`（按天滚动，收消息、匹配 handler、错误等）
- PM2 输出：`logs/pm2-out.log`、`logs/pm2-error.log`
- 开发环境 `npm run dev` 同时输出到控制台

```bash
# 实时查看应用日志（Linux）
tail -f logs/my-bot-$(date +%Y-%m-%d).log

# PM2 日志
npm run pm2:logs
```

## 功能说明

- **群聊监听**：`message.group` 事件，群内 @ 机器人后回复
- **私聊监听**：`message.private` 事件，好友私聊自动回复
- **主动发送**：
  - `bot.sendGroupMessage(group_id, content)`
  - `bot.sendPrivateMessage(user_id, content)`

内置命令：`ping`、`help`、`echo <内容>`

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式运行 |
| `npm run build` | 编译 TypeScript |
| `npm start` | 运行编译产物 |
| `npm run pm2:start` | 编译并用 PM2 后台启动 |
| `npm run pm2:restart` | 重新编译并重启 |
| `npm run pm2:stop` | 停止进程 |
| `npm run pm2:logs` | 查看 PM2 日志 |
| `npm run pm2:status` | 查看运行状态 |

## Linux 后台运行

推荐使用 **PM2**（项目已内置依赖）：

```bash
# 确认有 ecosystem.config.cjs
ls ecosystem.config.cjs

# 编译并启动
npm install
npm run build
mkdir -p logs
npx pm2 start ecosystem.config.cjs

# 查看状态与日志
npx pm2 status
npx pm2 logs my-bot
tail -f logs/my-bot-$(date +%Y-%m-%d).log

# 开机自启
pm2 save
pm2 startup            # 按提示执行生成的命令
```

常用运维命令：

```bash
npm run pm2:restart    # 更新代码后重启
npm run pm2:stop       # 停止
pm2 delete my-bot      # 从 PM2 列表移除

tail -f logs/my-bot-$(date +%Y-%m-%d).log
tail -f logs/pm2-error.log
```

**备选：nohup**

```bash
npm run build
mkdir -p logs
nohup npm start >> logs/nohup.out 2>> logs/nohup.err &
echo $! > logs/my-bot.pid
tail -f logs/nohup.out
kill $(cat logs/my-bot.pid)   # 停止
```

## 服务器部署（配合 nginx）

### 两种连接模式

| 模式 | 是否需要 nginx | 说明 |
|------|----------------|------|
| `websocket`（默认） | 否 | 机器人主动连接 QQ，服务器只需出站网络 |
| `webhook` | **是** | QQ 向你的 HTTPS 地址 POST 事件，需 nginx 反代到本地端口 |

若要通过现有 `nginx.conf` 使用，请使用 **webhook** 模式。

### 1. 上传代码到服务器

```bash
# 示例目录
mkdir -p /data/projects/my-bot
cd /data/projects/my-bot
git clone <你的仓库> .
npm ci
npm run build
cp .env.example .env
# 编辑 .env，填写 QQ_APPID、QQ_SECRET，并设置：
# BOT_MODE=webhook
# WEBHOOK_PORT=3100
# WEBHOOK_PATH=/webhook
# QQ_SANDBOX=false   # 正式环境
```

### 2. 使用 PM2 守护进程

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 按提示设置开机自启
```

### 3. 配置 nginx 反代

在 `server { listen 443 ssl; server_name jtgy.gemstonecn.com; }` 内增加（已写入 `nginx.conf` / 可参考 `nginx.qqbot.conf`）：

```nginx
location = /qqbot/webhook {
    proxy_pass http://127.0.0.1:3100/webhook;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

重载 nginx：

```bash
nginx -t && nginx -s reload
```

### 4. QQ 开放平台配置

1. 进入 [QQ 机器人开发设置](https://q.qq.com/qqbot/#/developer/developer-setting)
2. 将连接方式改为 **Webhook**
3. 回调地址填写：`https://jtgy.gemstonecn.com/qqbot/webhook`
4. 保存后平台会下发验证请求，需保证此时 `my-bot` 与 nginx 均已启动

### 5. 注意事项

- `WEBHOOK_PATH` 必须与 nginx `proxy_pass` 末尾路径一致（默认 `/webhook`）
- 主配置中若拦截含 `python`、`curl` 的 User-Agent，可能影响 QQ 回调，需对 `/qqbot/webhook` 单独放行或调整 `map $http_user_agent`
- 生产环境务必使用 HTTPS（你已有 443 证书）
- 不要将 `.env` 提交到 Git
