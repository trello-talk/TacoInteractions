module.exports = {
  apps: [
    {
      name: 'Taco Interactions',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 3000,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
