const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
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
  ],
  async execute(interaction) {
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
}; 