require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes, Collection, ActivityType } = require('discord.js');
const { ssh, connectSSH, getContainerNames } = require('./utils/ssh');

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

// Debug: Check if token is loaded correctly
console.log('Token loaded:', process.env.DISCORD_TOKEN ? 'Token exists' : 'Token missing');

// Load commands
client.commands = new Collection();
const commands = [];

// Function to recursively load commands from directories
function loadCommands(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // If it's a directory, recursively load commands from it
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      // If it's a JavaScript file, load it as a command
      try {
        const command = require(fullPath);
        if (command.name) {
          client.commands.set(command.name, command);
          commands.push(command);
          console.log(`Loaded command: ${command.name}`);
        }
      } catch (error) {
        console.error(`Error loading command at ${fullPath}:`, error);
      }
    }
  }
}

// Load all commands from the commands directory
loadCommands(path.join(__dirname, 'commands'));

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

  const commandName = interaction.commandName;
  
  // Log command usage
  console.log(`[${new Date().toISOString()}] ${interaction.user.tag} used /${commandName}`);

  if (!client.commands.has(commandName)) return;

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

    // Execute the command
    await client.commands.get(commandName).execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
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

// Get access to the terminal sessions
let activeTerminalSessions;
try {
  const terminalCommand = client.commands.get('terminal');
  if (terminalCommand) {
    activeTerminalSessions = terminalCommand.getActiveTerminalSessions();
  }
} catch (error) {
  console.error('Failed to access terminal sessions:', error);
  activeTerminalSessions = new Map();
}

// Monitor messages for terminal sessions
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Check if the user has an active terminal session
  if (!activeTerminalSessions) return;
  
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