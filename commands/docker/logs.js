const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
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
  ],
  async execute(interaction) {
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
}; 