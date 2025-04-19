const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
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
  ],
  async execute(interaction) {
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
}; 