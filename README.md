# 🐳 SSH Docker Discord Bot

[![Node.js](https://img.shields.io/badge/Node.js-18.x-brightgreen.svg)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.x-5865F2.svg)](https://discord.js.org)
[![Docker](https://img.shields.io/badge/Docker-Control-2496ED.svg)](https://www.docker.com)
[![SSH](https://img.shields.io/badge/SSH-Enabled-black.svg)](https://www.ssh.com)

A powerful Discord bot that lets you control Docker containers via SSH like a goddamn DevOps warlock. Perfect for server admins who want to manage their infrastructure directly from Discord.

<p align="center">
  <img src="https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png" alt="Docker Logo" width="200">
</p>

## ✨ Features

- **Secure SSH Authentication** - Password-based SSH access to your VPS
- **Docker Management via Slash Commands** - Modern Discord slash commands for all operations
- **Container Name-Based Control** - Forget IDs, manage containers by name
- **Beautiful Embedded Responses** - Color-coded status indicators with Docker logo
- **Command Autocomplete** - Container name suggestions as you type
- **Command Usage Logging** - Track who's managing your infrastructure
- **Comprehensive System Monitoring** - For both Docker and VPS resources

## 🧰 Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/docker-start <container>` | Start a stopped container | `/docker-start nginx` |
| `/docker-stop <container>` | Stop a running container | `/docker-stop mongodb` |
| `/docker-restart <container>` | Restart a container | `/docker-restart redis` |
| `/docker-logs <container>` | Show the last 50 lines of logs | `/docker-logs postgres` |
| `/docker-status <container>` | Show the current container status | `/docker-status wordpress` |
| `/docker-list` | List all containers with their status | `/docker-list` |
| `/docker-info` | Show Docker system information | `/docker-info` |
| `/ssh-system` | Show VPS system information (CPU/RAM/Disk) | `/ssh-system` |

## 🔧 Setup & Installation

### Prerequisites

- Node.js 16.x or higher
- A VPS with Docker installed
- SSH access to your VPS
- A Discord account with permission to create bots

### Option 1: Standard Setup

1. **Clone this repository**
   ```bash
   git clone https://github.com/nhyyebo/ssh-discord-bot.git
   cd ssh-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a Discord bot**
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and give it a name
   - Go to the "Bot" tab and click "Add Bot"
   - Under "Privileged Gateway Intents", enable:
     - PRESENCE INTENT
     - SERVER MEMBERS INTENT
     - MESSAGE CONTENT INTENT
   - Copy your bot token

4. **Configure environment variables**
   - Create a `.env` file in the project root
   - Add the following variables:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   SSH_HOST=your_vps_host
   SSH_PORT=22
   SSH_USERNAME=your_ssh_username
   SSH_PASSWORD=your_ssh_password
   ```

5. **Run the bot**
   ```bash
   npm start
   ```

### Option 2: Docker Deployment 🐳

This bot can be run in a Docker container for easier deployment and management.

1. **Clone this repository**
   ```bash
   git clone https://github.com/nhyyebo/ssh-discord-bot.git
   cd ssh-discord-bot
   ```

2. **Create a Discord bot and configure environment variables**
   - Follow steps 3-4 from the Standard Setup above

3. **Build and run with Docker**
   ```bash
   # Build the Docker image
   docker build -t ssh-docker-bot .
   
   # Run the container
   docker run -d --name ssh-docker-bot --restart unless-stopped --env-file .env ssh-docker-bot
   ```

   **OR**

4. **Use Docker Compose (recommended)**
   ```bash
   # Start the bot
   docker-compose up -d
   
   # View logs
   docker-compose logs -f
   
   # Stop the bot
   docker-compose down
   ```

## 🐋 Dockerfile

The included Dockerfile uses a multi-stage build process to create a lightweight container:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Start the bot
CMD ["node", "index.js"]
```

## 🚢 Inviting to Your Server

- Go to the "OAuth2" tab in the Discord Developer Portal
- Select "URL Generator"
- Select the following scopes:
  - `bot`
  - `applications.commands`
- Select the following bot permissions:
  - `Send Messages`
  - `Embed Links`
  - `Use Slash Commands`
  - `Add Reactions`
- Copy and open the generated URL to invite the bot to your server

## 🔐 Permissions Explained

### Discord Bot Permissions

| Permission | Reason |
|------------|--------|
| `Send Messages` | Required to send command responses |
| `Embed Links` | Required to send embedded responses with Docker information |
| `Use Slash Commands` | Required to register and use slash commands |
| `Add Reactions` | For potential future interactive command features |

### Required Intents

| Intent | Reason |
|--------|--------|
| `GUILDS` | Required to receive guild/server events |
| `GUILD_MESSAGES` | Required to receive message events |
| `MESSAGE_CONTENT` | Required to access message content for commands |

### SSH Permissions

The SSH user specified in the configuration needs the following permissions on the VPS:

- Execute Docker commands (`docker` group membership)
- Read system information (for `/ssh-system` command)

## 🛡️ Security Considerations

- The bot stores SSH credentials in an `.env` file, which should be kept secure
- Consider using a dedicated SSH user with limited permissions for the bot
- For production use, consider implementing SSH key-based authentication instead of password
- When using Docker, ensure your `.env` file is not included in the image build

## 🚀 Advanced Features

- **Automatic Container Name Completion** - Type the first few letters and bot suggests container names
- **Color-Coded Status Indicators**
  - 🟢 Green: Success/Running
  - 🔴 Red: Error/Stopped/Exited
  - 🟡 Yellow: Warning/Restarting/Paused
  - 🔵 Blue: Information/General state
- **System Resource Monitoring** - Real-time CPU, RAM, disk usage from your VPS

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💻 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page at [https://github.com/nhyyebo/ssh-discord-bot/issues](https://github.com/nhyyebo/ssh-discord-bot/issues).

## 📧 Support

If you need help setting up or using this bot, please open an issue on GitHub at [https://github.com/nhyyebo/ssh-discord-bot/issues](https://github.com/nhyyebo/ssh-discord-bot/issues). 