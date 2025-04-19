const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
  name: 'docker-info',
  description: 'Show Docker system information',
  async execute(interaction) {
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
}; 