const { SlashCommandBuilder } = require('discord.js');
const { connect, disconnect } = require('../../utils/ssh'); 
const { createEmbed } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('docker-start')
    .setDescription('Start a Docker container')
    .addStringOption(option =>
      option.setName('container')
        .setDescription('Name or ID of the container to start')
        .setRequired(true)
        .setAutocomplete(true)), 

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    let ssh;
    try {
        ssh = await connect();
        const result = await ssh.execCommand('docker ps -a --format "{{.Names}}"');
        
        if (result.code !== 0) {
            console.error('Autocomplete failed to fetch container names:', result.stderr || result.stdout);
            await interaction.respond([]); 
            return;
        }

        const choices = result.stdout.trim().split('\n').filter(Boolean); 
        
        const filtered = choices
            .filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase()))
            .slice(0, 25); 

        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    } catch (error) {
        console.error('Error during docker-start autocomplete:', error);
        await interaction.respond([]); 
    } finally {
        if (ssh) {
            await disconnect(ssh); 
        }
    }
  },

  async execute(interaction) {
    const containerName = interaction.options.getString('container');
    let ssh;

    try {
      await interaction.deferReply({ ephemeral: true });
      ssh = await connect();

      const result = await ssh.execCommand(`docker start ${containerName}`);

      if (result.code !== 0) {
        await interaction.editReply({ 
          embeds: [createEmbed('Start Failed', `Failed to start container '${containerName}':\n\`\`\`${result.stderr || result.stdout || 'Unknown error'}\`\`\``, 'error')],
          ephemeral: true
        });
        return;
      }

      const successMessage = result.stdout.trim() === containerName 
                             ? `Successfully started container '${containerName}'.`
                             : `Attempted to start container '${containerName}'. Check status for confirmation.`;

      await interaction.editReply({
        embeds: [createEmbed('Container Started', successMessage, 'success')],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in docker-start execute:', error);
      await interaction.editReply({ 
        embeds: [createEmbed('Command Error', `An error occurred while trying to start container '${containerName}': ${error.message}`, 'error')],
        ephemeral: true
      });
    } finally {
      if (ssh) {
        await disconnect(ssh);
      }
    }
  },
};