#!/bin/bash
# VPS Security Hardening Script for City Lord
# WARNING: Run this carefully!

NEW_SSH_PORT=2222

echo "====================================="
echo " Starting VPS Security Hardening..."
echo "====================================="

# 1. Update and install packages
apt-get update
apt-get install -y ufw fail2ban

# 2. Configure UFW
echo "Configuring UFW..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow $NEW_SSH_PORT/tcp

# Disable UFW momentarily to avoid lockout during sshd_config change
ufw --force enable

# 3. Configure SSHD
echo "Configuring SSH to use port $NEW_SSH_PORT..."
sed -i "s/^#Port 22/Port $NEW_SSH_PORT/" /etc/ssh/sshd_config
sed -i "s/^Port 22/Port $NEW_SSH_PORT/" /etc/ssh/sshd_config
# Disallow empty passwords
sed -i "s/^#PermitEmptyPasswords no/PermitEmptyPasswords no/" /etc/ssh/sshd_config
sed -i "s/^PermitEmptyPasswords yes/PermitEmptyPasswords no/" /etc/ssh/sshd_config

# Restart SSH service
systemctl restart sshd

# 4. Configure Fail2Ban
echo "Configuring Fail2Ban..."
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = $NEW_SSH_PORT
logpath = %(sshd_log)s
backend = %(sshd_backend)s
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo "====================================="
echo " Security Hardening Complete!"
echo " SSH Port is now $NEW_SSH_PORT. Make sure to update your deploy scripts!"
echo " UFW and Fail2Ban are active."
echo "====================================="
