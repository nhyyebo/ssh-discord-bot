const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { connect, disconnect } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');
const { sendPaginatedEmbed } = require('../../utils/pagination');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('docker-list')
    .setDescription('List Docker containers or images')
    .addStringOption(option =>
        option.setName('type')
            .setDescription('Specify whether to list containers or images')
            .setRequired(true)
            .addChoices(
                { name: 'Containers', value: 'containers' },
                { name: 'Images', value: 'images' }
            )),
  async execute(interaction) {
    const listType = interaction.options.getString('type');
    let ssh;

    try {
      await interaction.deferReply({ ephemeral: true });

      ssh = await connect();

      let command;
      let title;
      let formatItem;

      if (listType === 'containers') {
        command = 'docker ps -a --format "{{.Names}} --- {{.Image}} --- {{.Status}}"';
        title = 'Docker Containers';
        formatItem = (item) => {
            const [name, image, status] = item.split(' --- ');
            return `**${name}**\n*Image:* ${image}\n*Status:* ${status}`;
        };
      } else { 
        command = 'docker images --format "{{.Repository}}:{{.Tag}} --- {{.ID}} --- {{.Size}}"';
        title = 'Docker Images';
        formatItem = (item) => {
            const [repoTag, id, size] = item.split(' --- ');
            return `**${repoTag}**\n*ID:* ${id}\n*Size:* ${size}`;
        };
      }

      const result = await ssh.execCommand(command);

      if (result.code !== 0) {
        const errorEmbed = createEmbed(
          `Failed to list Docker ${listType}`, 
          `Error executing command:\n\`\`\`${result.stderr || result.stdout || 'Unknown error'}\`\`\``, 
          'error'
        );
        await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      const items = result.stdout.trim().split('\n').filter(line => line.trim() !== '');

      await sendPaginatedEmbed(interaction, title, items, formatItem);

    } catch (error) {
      console.error(`Error in docker-list (${listType}):`, error);
      const errorEmbed = createEmbed(
        `Docker List Error (${listType})`, 
        `An unexpected error occurred: ${error.message}`,
        'error'
      );
      if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    } finally {
      if (ssh) {
        await disconnect(ssh);
      }
    }
  },
};