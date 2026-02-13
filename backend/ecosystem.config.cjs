module.exports = {
  apps: [
    {
      name: "dhimmobilier-api",
      script: "dist/server.js",
      cwd: "/var/www/dhimmobilier-api",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      node_args: "--max-old-space-size=512",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      env_file: ".env",
      error_file: "/var/log/pm2/dhimmobilier-api-error.log",
      out_file: "/var/log/pm2/dhimmobilier-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
