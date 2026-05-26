/** PM2 进程配置：在服务器上执行 pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'my-bot',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
