module.exports = {
  apps: [{
    name: 'district-api-server',
    script: './standalone-api-server.js',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      API_PORT: 3001
    },
    env_development: {
      NODE_ENV: 'development',
      API_PORT: 3001
    },
    error_file: './logs/api-err.log',
    out_file: './logs/api-out.log',
    log_file: './logs/api-combined.log',
    time: true
  }]
};