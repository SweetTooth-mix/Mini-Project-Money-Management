module.exports = {
  apps: [
    {
      name: "kira-rapi",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "750M",
      env: { NODE_ENV: "production" },
    },
  ],
};
