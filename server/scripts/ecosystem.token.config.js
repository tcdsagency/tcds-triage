module.exports = {
  apps: [
    {
      name: "token-service",
      script: "/home/manus_temp/token-service/venv/bin/python3",
      args: "token_service.py",
      cwd: "/home/manus_temp/token-service",
      interpreter: "none",
      env: {
        MMI_EMAIL: "todd.conn@tcdsagency.com",
        MMI_PASSWORD: "h93e4XX9FRX&Bbi&",
        RPR_EMAIL: "toddconnrealtor@gmail.com",
        RPR_PASSWORD: "Brother1!",
        TOKEN_SERVICE_PORT: "8899",
        TOKEN_SERVICE_SECRET: "tcds_token_service_2025",
      },
      error_file: "/home/manus_temp/.pm2/logs/token-service-error.log",
      out_file: "/home/manus_temp/.pm2/logs/token-service-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
