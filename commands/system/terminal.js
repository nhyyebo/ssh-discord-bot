const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

// Store active terminal sessions
const activeTerminalSessions = new Map();

module.exports = {
  name: 'terminal',
  description: 'Start an interactive terminal session via SSH',
  async execute(interaction) {
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
  },
  // Export the active terminal sessions map for access by the message event listener
  getActiveTerminalSessions: () => activeTerminalSessions
}; 