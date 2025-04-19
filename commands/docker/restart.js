const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
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
  ],
  async execute(interaction) {
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
}; 