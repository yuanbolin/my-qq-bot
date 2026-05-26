/** PM2 进程配置：Linux 后台运行见 README */
const path = require('node:path')

module.exports = {
  apps: [
    {
      name: 'my-bot',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: path.join(__dirname, 'logs/pm2-out.log'),
      error_file: path.join(__dirname, 'logs/pm2-error.log'),
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
