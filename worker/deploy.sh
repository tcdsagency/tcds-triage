#!/bin/bash
# Deploy TCDS Worker to VM
#
# Usage: Run this from the worker/ directory
#   bash deploy.sh
#
# Or run commands manually:
#   1. ssh <username>@75.37.55.209
#   2. mkdir -p ~/services/tcds-worker ~/services/logs
#   3. (from local) scp package.json worker.js ecosystem.config.js <username>@75.37.55.209:~/services/tcds-worker/
#   4. (on VM) cd ~/services/tcds-worker && npm install
#   5. (on VM) pm2 delete tcds-worker 2>/dev/null; pm2 start ecosystem.config.js
#   6. (on VM) pm2 save

# EDIT THIS: Set your VM username
VM_USER="${VM_USER:-todd}"
VM_HOST="$VM_USER@75.37.55.209"
REMOTE_DIR="~/services/tcds-worker"

echo "=== Deploying TCDS Worker to VM ==="
echo "Using: $VM_HOST"

# Create directory on VM
echo "Creating directories..."
ssh $VM_HOST "mkdir -p ~/services/tcds-worker ~/services/logs"

# Copy files
echo "Copying files..."
scp package.json worker.js ecosystem.config.js $VM_HOST:$REMOTE_DIR/

# Install dependencies and start
echo "Installing dependencies..."
ssh $VM_HOST "cd $REMOTE_DIR && npm install"

echo "Starting worker with PM2..."
ssh $VM_HOST "cd $REMOTE_DIR && pm2 delete tcds-worker 2>/dev/null; pm2 start ecosystem.config.js"

echo "Saving PM2 config..."
ssh $VM_HOST "pm2 save"

echo ""
echo "=== Deployment Complete ==="
ssh $VM_HOST "pm2 list"
