const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
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
  ],
  async execute(interaction) {
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
}; 