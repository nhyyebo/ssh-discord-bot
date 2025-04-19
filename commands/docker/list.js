const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
  name: 'docker-list',
  description: 'List all Docker containers',
  async execute(interaction) {
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
}; 