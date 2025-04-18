require('dotenv').config();

// Debug: Check if token is loaded correctly
console.log('Token loaded:', process.env.DISCORD_TOKEN ? 'Token exists' : 'Token missing');

const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, ActivityType } = require('discord.js');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');

// Discord bot setup
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION']
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
  },
  {
    name: 'terminal',
    description: 'Start an interactive terminal session via SSH'
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
      case 'terminal':
        await handleTerminal(interaction);
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

// Store active terminal sessions
const activeTerminalSessions = new Map();

// Handle terminal sessions
async function handleTerminal(interaction) {
  // Check if user already has an active session
  if (activeTerminalSessions.has(interaction.user.id)) {
    await interaction.reply({ 
      content: 'You already have an active terminal session. Type **STOP** in the channel to end it first.',
      ephemeral: true 
    });
    return;
  }
  
  await interaction.reply({ 
    embeds: [
      createEmbed(
        '🖥️ Terminal Session Started', 
        'You can now type commands directly in this channel. They will be executed via SSH.\n\n' +
        '• Type **STOP** to end the session\n' +
        '• The session will automatically timeout after 5 minutes of inactivity\n' +
        '• For security, certain commands may be restricted\n\n' +
        'Current working directory: `/`', 
        'info'
      )
    ]
  });
  
  // Create a message collector to listen for commands from this user in this channel
  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 300000 }); // 5 minute timeout
  
  // Store session data
  const sessionData = {
    userId: interaction.user.id,
    channelId: interaction.channelId,
    collector: collector,
    lastActivity: Date.now(),
    currentDir: '/',
    timeout: null
  };
  
  // Set timeout for inactivity
  sessionData.timeout = setTimeout(() => {
    if (collector.ended) return;
    collector.stop('timeout');
    interaction.followUp({
      content: `Terminal session ended due to inactivity.`,
      ephemeral: true
    });
  }, 300000);
  
  // Store the session
  activeTerminalSessions.set(interaction.user.id, sessionData);
  
  // Handle incoming commands
  collector.on('collect', async message => {
    // Reset timeout on activity
    clearTimeout(sessionData.timeout);
    sessionData.lastActivity = Date.now();
    
    // Set new timeout
    sessionData.timeout = setTimeout(() => {
      if (collector.ended) return;
      collector.stop('timeout');
      interaction.followUp({
        content: `Terminal session ended due to inactivity.`,
        ephemeral: true
      });
    }, 300000);
    
    // Check for stop command
    if (message.content.trim() === 'STOP') {
      collector.stop('user');
      message.reply('Terminal session ended.');
      return;
    }
    
    // Send typing indicator
    await message.channel.sendTyping();
    
    // Execute the command
    try {
      // Add basic command restrictions for security
      const commandText = message.content.trim();
      
      // Block dangerous commands or command patterns
      const dangerousPatterns = [
        /rm\s+(-rf?|--recursive)\s+\//i,
        /mkfs/i,
        /dd\s+if=/i,
        />\s+\/etc\//i,
        /chmod\s+777/i
      ];
      
      // Check for dangerous commands
      for (const pattern of dangerousPatterns) {
        if (pattern.test(commandText)) {
          message.reply({
            embeds: [createEmbed('⚠️ Command Blocked', 'This command is restricted for security reasons.', 'error')]
          });
          return;
        }
      }
      
      // Execute the command
      const result = await ssh.execCommand(commandText, { cwd: sessionData.currentDir });
      
      // Check if this is a cd command to update the current directory
      if (commandText.startsWith('cd ') && result.code === 0) {
        // Get the new current directory
        const pwdResult = await ssh.execCommand('pwd');
        if (pwdResult.code === 0) {
          sessionData.currentDir = pwdResult.stdout.trim();
        }
      }
      
      // Format the output
      let output = '';
      if (result.stdout) {
        output += result.stdout;
      }
      
      if (result.stderr) {
        output += `\n${result.stderr}`;
      }
      
      // Truncate if too long
      if (output.length > 3900) {
        output = output.substring(0, 3900) + '\n... (output truncated)';
      }
      
      // If output is empty
      if (!output.trim()) {
        output = '(Command executed successfully with no output)';
      }
      
      // Send the result with the current directory in the title
      await message.reply({
        embeds: [
          createEmbed(
            `Terminal [${sessionData.currentDir}]`, 
            '```\n' + output + '\n```',
            result.code === 0 ? 'info' : 'error'
          )
        ]
      });
      
    } catch (error) {
      await message.reply({
        embeds: [createEmbed('Command Error', `Failed to execute command: ${error.message}`, 'error')]
      });
    }
  });
  
  // Handle end of session
  collector.on('end', (collected, reason) => {
    clearTimeout(sessionData.timeout);
    activeTerminalSessions.delete(interaction.user.id);
    
    if (reason !== 'user' && reason !== 'timeout') {
      interaction.followUp({
        content: `Terminal session ended. Reason: ${reason}`,
        ephemeral: true
      });
    }
  });
}

// Also add a message event listener to monitor STOP commands outside of interaction
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Check if the user has an active terminal session
  const sessionData = activeTerminalSessions.get(message.author.id);
  if (!sessionData) return;
  
  // Check if this is the same channel
  if (message.channelId !== sessionData.channelId) return;
  
  // Check for stop command outside of collector
  if (message.content.trim() === 'STOP') {
    sessionData.collector.stop('user');
    message.reply('Terminal session ended.');
  }
});

// Handle errors
client.on('error', console.error);
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord with the token from .env
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('Login error:', error);
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
}); 