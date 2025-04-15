require('dotenv').config();
// Debug: Check if token is loaded correctly
console.log('Token loaded:', process.env.DISCORD_TOKEN ? 'Token exists (first 5 chars): ' + process.env.DISCORD_TOKEN.substring(0, 5) + '...' : 'Token missing');
const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, ActivityType } = require('discord.js');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');

// Discord bot setup
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// SSH client
const ssh = new NodeSSH();

// Load commands
client.commands = new Collection();
const commands = [];

// Docker commands
const dockerCommands = [
  {
    name: 'docker-start',
    description: 'Start a Docker container',
    options: [
      {
        name: 'container',
        description: 'The name of the container to start',
        type: 3, // STRING
        required: true,
        autocomplete: true
      }
    ]
  },
  {
    name: 'docker-stop',
    description: 'Stop a Docker container',
    options: [
      {
        name: 'container',
        description: 'The name of the container to stop',
        type: 3,
        required: true,
        autocomplete: true
      }
    ]
  },
  {
    name: 'docker-restart',
    description: 'Restart a Docker container',
    options: [
      {
        name: 'container',
        description: 'The name of the container to restart',
        type: 3,
        required: true,
        autocomplete: true
      }
    ]
  },
  {
    name: 'docker-logs',
    description: 'Show the logs of a Docker container (last 50 lines)',
    options: [
      {
        name: 'container',
        description: 'The name of the container to show logs for',
        type: 3,
        required: true,
        autocomplete: true
      }
    ]
  },
  {
    name: 'docker-status',
    description: 'Show the status of a Docker container',
    options: [
      {
        name: 'container',
        description: 'The name of the container to show status for',
        type: 3,
        required: true,
        autocomplete: true
      }
    ]
  },
  {
    name: 'docker-list',
    description: 'List all Docker containers'
  },
  {
    name: 'docker-info',
    description: 'Show Docker system information'
  },
  {
    name: 'ssh-system',
    description: 'Show system information from the VPS (CPU/RAM/Disk usage)'
  }
];

// Register commands
dockerCommands.forEach(command => {
  client.commands.set(command.name, command);
  commands.push(command);
});

// Discord REST API setup
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Connect to SSH when bot starts
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    // Connect to SSH server
    await connectSSH();
    console.log('SSH connection established');
    
    // Set bot presence
    client.user.setActivity('Docker containers', { type: ActivityType.Watching });
    
    // Register slash commands globally
    try {
      console.log('Started refreshing application (/) commands.');
      
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands },
      );
      
      console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error('Failed to register slash commands:', error);
    }
  } catch (error) {
    console.error('Failed to establish SSH connection:', error);
  }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) {
    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      try {
        const containers = await getContainerNames();
        const focusedValue = interaction.options.getFocused();
        const filtered = containers.filter(container => 
          container.toLowerCase().includes(focusedValue.toLowerCase())
        );
        
        await interaction.respond(
          filtered.map(container => ({ name: container, value: container }))
        );
      } catch (error) {
        console.error('Error in autocomplete:', error);
      }
      return;
    }
    return;
  }

  const command = interaction.commandName;
  
  // Log command usage
  console.log(`[${new Date().toISOString()}] ${interaction.user.tag} used /${command}`);

  if (!client.commands.has(command)) return;

  try {
    // Check SSH connection and reconnect if needed
    if (!ssh.isConnected()) {
      await interaction.reply({ content: 'Reconnecting to SSH server...', ephemeral: true });
      try {
        await connectSSH();
      } catch (error) {
        await interaction.editReply({ content: 'Failed to connect to SSH server. Try again later.', ephemeral: true });
        console.error('SSH connection error:', error);
        return;
      }
    }

    switch (command) {
      case 'docker-start':
        await handleDockerStart(interaction);
        break;
      case 'docker-stop':
        await handleDockerStop(interaction);
        break;
      case 'docker-restart':
        await handleDockerRestart(interaction);
        break;
      case 'docker-logs':
        await handleDockerLogs(interaction);
        break;
      case 'docker-status':
        await handleDockerStatus(interaction);
        break;
      case 'docker-list':
        await handleDockerList(interaction);
        break;
      case 'docker-info':
        await handleDockerInfo(interaction);
        break;
      case 'ssh-system':
        await handleSSHSystemInfo(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error executing command ${command}:`, error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'An error occurred while executing this command.' });
      } else {
        await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
      }
    } catch (replyError) {
      console.error('Error handling command error:', replyError);
    }
  }
});

// Connect to SSH
async function connectSSH() {
  return ssh.connect({
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT,
    username: process.env.SSH_USERNAME,
    password: process.env.SSH_PASSWORD
  });
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

// Create embed for container operations
function createEmbed(title, description, status, containerName) {
  let color = 0x5865F2; // Discord blurple
  
  if (status === 'success') {
    color = 0x57F287; // Green
  } else if (status === 'error') {
    color = 0xED4245; // Red
  } else if (status === 'warning') {
    color = 0xFEE75C; // Yellow
  } else if (status === 'info') {
    color = 0x5865F2; // Blurple
  }
  
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setThumbnail('https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png');
    
  if (containerName) {
    embed.setFooter({ text: `Container: ${containerName}` });
  }
  
  return embed;
}

// Handle docker start command
async function handleDockerStart(interaction) {
  const containerName = interaction.options.getString('container');
  await interaction.deferReply();
  
  try {
    const result = await ssh.execCommand(`docker start ${containerName}`);
    
    if (result.code !== 0 || result.stderr) {
      await interaction.editReply({ 
        embeds: [createEmbed('Container Start Failed', `Failed to start container:\n\`\`\`${result.stderr || 'Unknown error'}\`\`\``, 'error', containerName)]
      });
      return;
    }
    
    await interaction.editReply({
      embeds: [createEmbed('Container Started', `Successfully started container`, 'success', containerName)]
    });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error', containerName)]
    });
  }
}

// Handle docker stop command
async function handleDockerStop(interaction) {
  const containerName = interaction.options.getString('container');
  await interaction.deferReply();
  
  try {
    const result = await ssh.execCommand(`docker stop ${containerName}`);
    
    if (result.code !== 0 || result.stderr) {
      await interaction.editReply({ 
        embeds: [createEmbed('Container Stop Failed', `Failed to stop container:\n\`\`\`${result.stderr || 'Unknown error'}\`\`\``, 'error', containerName)]
      });
      return;
    }
    
    await interaction.editReply({
      embeds: [createEmbed('Container Stopped', `Successfully stopped container`, 'success', containerName)]
    });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error', containerName)]
    });
  }
}

// Handle docker restart command
async function handleDockerRestart(interaction) {
  const containerName = interaction.options.getString('container');
  await interaction.deferReply();
  
  try {
    const result = await ssh.execCommand(`docker restart ${containerName}`);
    
    if (result.code !== 0 || result.stderr) {
      await interaction.editReply({ 
        embeds: [createEmbed('Container Restart Failed', `Failed to restart container:\n\`\`\`${result.stderr || 'Unknown error'}\`\`\``, 'error', containerName)]
      });
      return;
    }
    
    await interaction.editReply({
      embeds: [createEmbed('Container Restarted', `Successfully restarted container`, 'success', containerName)]
    });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error', containerName)]
    });
  }
}

// Handle docker logs command
async function handleDockerLogs(interaction) {
  const containerName = interaction.options.getString('container');
  await interaction.deferReply();
  
  try {
    const result = await ssh.execCommand(`docker logs --tail 50 ${containerName}`);
    
    if (result.code !== 0 || result.stderr) {
      await interaction.editReply({ 
        embeds: [createEmbed('Container Logs Failed', `Failed to get logs:\n\`\`\`${result.stderr || 'Unknown error'}\`\`\``, 'error', containerName)]
      });
      return;
    }
    
    // Truncate logs if too long for Discord
    let logs = result.stdout;
    if (logs.length > 4000) {
      logs = logs.substring(logs.length - 4000) + '...(truncated)';
    }
    
    if (!logs.trim()) {
      logs = 'No logs available';
    }
    
    await interaction.editReply({
      embeds: [
        createEmbed('Container Logs', `\`\`\`\n${logs}\n\`\`\``, 'info', containerName)
      ]
    });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error', containerName)]
    });
  }
}

// Handle docker status command
async function handleDockerStatus(interaction) {
  const containerName = interaction.options.getString('container');
  await interaction.deferReply();
  
  try {
    const result = await ssh.execCommand(`docker inspect --format '{{.State.Status}}' ${containerName}`);
    
    if (result.code !== 0 || result.stderr) {
      await interaction.editReply({ 
        embeds: [createEmbed('Container Status Failed', `Failed to get status:\n\`\`\`${result.stderr || 'Unknown error'}\`\`\``, 'error', containerName)]
      });
      return;
    }
    
    const status = result.stdout.trim();
    let statusColor = 'warning';
    
    if (status === 'running') {
      statusColor = 'success';
    } else if (status === 'exited' || status === 'dead') {
      statusColor = 'error';
    }
    
    // Get more container details
    const detailsResult = await ssh.execCommand(`docker inspect --format '{{.Config.Image}} | Created: {{.Created}} | {{.State.Status}} since {{.State.StartedAt}}' ${containerName}`);
    let details = detailsResult.stdout.trim();
    
    if (detailsResult.code !== 0 || detailsResult.stderr) {
      details = status;
    }
    
    await interaction.editReply({
      embeds: [createEmbed('Container Status', `**Status:** ${status}\n**Details:** ${details}`, statusColor, containerName)]
    });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error', containerName)]
    });
  }
}

// Handle docker list command
async function handleDockerList(interaction) {
  await interaction.deferReply();
  
  try {
    const result = await ssh.execCommand('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"');
    
    if (result.code !== 0 || result.stderr) {
      await interaction.editReply({ 
        embeds: [createEmbed('Container List Failed', `Failed to list containers:\n\`\`\`${result.stderr || 'Unknown error'}\`\`\``, 'error')]
      });
      return;
    }
    
    await interaction.editReply({
      embeds: [createEmbed('Container List', `\`\`\`\n${result.stdout}\n\`\`\``, 'info')]
    });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error')]
    });
  }
}

// Handle docker info command
async function handleDockerInfo(interaction) {
  await interaction.deferReply();
  
  try {
    const result = await ssh.execCommand('docker system info | grep -E "Containers:|Images:|Server Version:|Operating System:|Architecture:|CPUs:|Total Memory:"');
    
    if (result.code !== 0 || result.stderr) {
      await interaction.editReply({ 
        embeds: [createEmbed('Docker Info Failed', `Failed to get Docker info:\n\`\`\`${result.stderr || 'Unknown error'}\`\`\``, 'error')]
      });
      return;
    }
    
    await interaction.editReply({
      embeds: [createEmbed('Docker System Info', `\`\`\`\n${result.stdout}\n\`\`\``, 'info')]
    });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error')]
    });
  }
}

// Handle SSH system info command
async function handleSSHSystemInfo(interaction) {
  await interaction.deferReply();
  
  try {
    // Run several commands to collect system information
    const commands = [
      'top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'', // CPU usage
      'free -m | awk \'/Mem/{printf "%.2f%%", $3*100/$2 }\'', // RAM usage
      'df -h | grep "/$" | awk \'{print $5}\'', // Disk usage
      'uptime -p', // System uptime
      'cat /proc/loadavg' // Load average
    ];
    
    const results = await Promise.all(commands.map(cmd => ssh.execCommand(cmd)));
    
    const [cpuResult, ramResult, diskResult, uptimeResult, loadResult] = results;
    
    // Format the results
    const cpuUsage = cpuResult.stdout ? `${parseFloat(cpuResult.stdout).toFixed(2)}%` : 'Error';
    const ramUsage = ramResult.stdout || 'Error';
    const diskUsage = diskResult.stdout || 'Error';
    const uptime = uptimeResult.stdout || 'Error';
    const loadAvg = loadResult.stdout || 'Error';
    
    // Create a status message based on CPU usage
    let status = 'info';
    if (parseFloat(cpuUsage) > 80) {
      status = 'error';
    } else if (parseFloat(cpuUsage) > 50) {
      status = 'warning';
    } else {
      status = 'success';
    }
    
    // Create the embed
    const systemInfoEmbed = createEmbed(
      'VPS System Information',
      `**CPU Usage:** ${cpuUsage}\n**RAM Usage:** ${ramUsage}\n**Disk Usage:** ${diskUsage}\n**System Uptime:** ${uptime}\n**Load Average:** ${loadAvg}`,
      status
    );
    
    await interaction.editReply({ embeds: [systemInfoEmbed] });
  } catch (error) {
    await interaction.editReply({ 
      embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error')]
    });
  }
}

// Handle errors
client.on('error', console.error);
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN); 