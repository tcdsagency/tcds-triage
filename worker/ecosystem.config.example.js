const os = require('os');
const path = require('path');

const homeDir = os.homedir();

module.exports = {
  apps: [
    {
      name: "tcds-worker",
      script: "worker.js",
      cwd: path.join(homeDir, "services/tcds-worker"),
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        WORKER_PORT: "3001",
        WORKER_API_SECRET: "your_worker_api_secret",
        DEFAULT_TENANT_ID: "your_tenant_id",
        DATABASE_URL: "postgresql://user:password@host:5432/database",
        MSSQL_SERVER: "10.10.20.37",
        MSSQL_PORT: "1433",
        MSSQL_DATABASE: "3CX Recording Manager",
        MSSQL_USER: "sa",
        MSSQL_PASSWORD: "your_mssql_password",
        AGENCYZOOM_API_USERNAME: "your_agencyzoom_username",
        AGENCYZOOM_API_PASSWORD: "your_agencyzoom_password",
        TWILIO_PHONE_NUMBER: "+1234567890",
        TOKEN_SERVICE_URL: "http://localhost:8899",
        TOKEN_SERVICE_SECRET: "your_token_service_secret",
      },
      error_file: path.join(homeDir, "services/logs/tcds-worker-error.log"),
      out_file: path.join(homeDir, "services/logs/tcds-worker-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_restarts: 10,
      restart_delay: 5000,
      autorestart: true,
    }
  ]
};
