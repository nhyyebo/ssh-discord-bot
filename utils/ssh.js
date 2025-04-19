const { NodeSSH } = require('node-ssh');
const fs = require('fs');

// SSH client
const ssh = new NodeSSH();

// Connect to SSH
async function connectSSH() {
  const sshConfig = {
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT || 22,
    username: process.env.SSH_USERNAME
  };
  
  // Support both password and key-based authentication
  if (process.env.SSH_PRIVATE_KEY_PATH) {
    // Use private key authentication if a key path is provided
    console.log('Using SSH key authentication');
    sshConfig.privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
    
    // Add passphrase if provided
    if (process.env.SSH_KEY_PASSPHRASE) {
      sshConfig.passphrase = process.env.SSH_KEY_PASSPHRASE;
    }
  } else if (process.env.SSH_PRIVATE_KEY) {
    // Use private key directly from env if provided
    console.log('Using SSH key from environment');
    sshConfig.privateKey = process.env.SSH_PRIVATE_KEY;
    
    // Add passphrase if provided
    if (process.env.SSH_KEY_PASSPHRASE) {
      sshConfig.passphrase = process.env.SSH_KEY_PASSPHRASE;
    }
  } else {
    // Fall back to password authentication
    console.log('Using SSH password authentication');
    sshConfig.password = process.env.SSH_PASSWORD;
  }
  
  return ssh.connect(sshConfig);
}

// Get container names for autocomplete
async function getContainerNames() {
  try {
    const result = await ssh.execCommand('docker ps -a --format "{{.Names}}"');
    if (result.code !== 0 || result.stderr) {
      console.error('Error getting container names:', result.stderr);
      return [];
    }
    return result.stdout.split('\n').filter(name => name.trim() !== '');
  } catch (error) {
    console.error('Error executing container names command:', error);
    return [];
  }
}

module.exports = {
  ssh,
  connectSSH,
  getContainerNames
}; 