const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const ITEMS_PER_PAGE = 10; // Adjust as needed

/**
 * Sends a paginated embed message with navigation buttons.
 * @param {import('discord.js').CommandInteraction | import('discord.js').MessageComponentInteraction} interaction - The interaction object.
 * @param {string} title - The title for the embed.
 * @param {Array<any>} items - An array of data items to paginate.
 * @param {function(any): string} [formatItem=(item) => String(item)] - Function to format each data item into a string line.
 * @param {boolean} [ephemeral=true] - Whether the reply should be ephemeral.
 */
async function sendPaginatedEmbed(interaction, title, items, formatItem = (item) => String(item), ephemeral = true) {
  const pages = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }

  if (pages.length === 0) {
      const embed = new EmbedBuilder()
          .setColor('#ffcc00') // Yellow for 'not found' or warning
          .setTitle(title)
          .setDescription('No items found.');
      
      try {
          if (interaction.replied || interaction.deferred) {
              await interaction.editReply({ embeds: [embed], components: [], ephemeral: ephemeral });
          } else {
              await interaction.reply({ embeds: [embed], ephemeral: ephemeral });
          }
      } catch (error) {
          console.error('Error sending no items embed:', error);
          // Attempt followUp as a last resort if reply/editReply fails unexpectedly
          try {
              await interaction.followUp({ embeds: [embed], ephemeral: ephemeral });
          } catch (followUpError) {
              console.error('Error sending no items embed via followup:', followUpError);
          }
      }
      return;
  }

  let currentPageIndex = 0;

  const generateEmbed = (pageIndex) => {
    const currentPage = pages[pageIndex];
    let descriptionContent = currentPage.map(formatItem).join('\n') || 'No items on this page.';
    if (descriptionContent.length > 4096) {
        descriptionContent = descriptionContent.substring(0, 4093) + '...';
    }

    return new EmbedBuilder()
      .setColor('#0099ff') // Blue for information
      .setTitle(`${title} (Page ${pageIndex + 1}/${pages.length})`)
      .setDescription(descriptionContent)
      .setFooter({ text: `Showing items ${pageIndex * ITEMS_PER_PAGE + 1} - ${Math.min((pageIndex + 1) * ITEMS_PER_PAGE, items.length)} of ${items.length}` });
  };

  const generateButtons = (pageIndex) => {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`pagination_prev_${interaction.id}`)
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId(`pagination_next_${interaction.id}`)
          .setLabel('Next ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === pages.length - 1)
      );
  };

  const initialEmbed = generateEmbed(currentPageIndex);
  const initialComponents = pages.length > 1 ? [generateButtons(currentPageIndex)] : [];

  let message;
  try {
    // Use editReply if already deferred or replied to (e.g., from initial deferReply)
    if (interaction.deferred || interaction.replied) {
        message = await interaction.editReply({
            embeds: [initialEmbed],
            components: initialComponents,
            fetchReply: true, // Needed to get the message object for collector
            ephemeral: ephemeral 
        });
    } else { // Otherwise, use reply for the first response
        message = await interaction.reply({
            embeds: [initialEmbed],
            components: initialComponents,
            fetchReply: true,
            ephemeral: ephemeral
        });
    }
  } catch (error) {
      console.error('Error sending initial paginated embed:', error);
      // Attempt followup if reply/editReply fails
      try {
          message = await interaction.followUp({ 
              embeds: [initialEmbed], 
              components: initialComponents, 
              fetchReply: true, 
              ephemeral: ephemeral 
          });
      } catch (followUpError) {
          console.error('Error sending initial paginated embed via followup:', followUpError);
          return; // Stop if we can't send the initial message
      }
  }

  if (pages.length <= 1 || !message) return; // No need for collector if only one page or message failed

  // Use unique custom IDs per interaction to prevent conflicts
  const filter = i => 
    (i.customId === `pagination_prev_${interaction.id}` || i.customId === `pagination_next_${interaction.id}`) && 
    i.user.id === interaction.user.id;
    
  const collector = message.createMessageComponentCollector({ filter, time: 120000 }); // 120 seconds timeout

  collector.on('collect', async i => {
    if (!i.isButton()) return;

    if (i.customId === `pagination_prev_${interaction.id}`) {
      currentPageIndex = Math.max(0, currentPageIndex - 1);
    } else if (i.customId === `pagination_next_${interaction.id}`) {
      currentPageIndex = Math.min(pages.length - 1, currentPageIndex + 1);
    }

    const updatedEmbed = generateEmbed(currentPageIndex);
    const updatedButtons = generateButtons(currentPageIndex);

    try {
        // Interaction components should be updated
        await i.update({ embeds: [updatedEmbed], components: [updatedButtons] });
    } catch (updateError) {
        console.error('Error updating pagination embed:', updateError);
        // Handle specific errors like interaction already acknowledged or unknown interaction
        collector.stop('error'); // Stop collector if updates fail
    }
  });

  collector.on('end', (collected, reason) => {
    // Don't try to edit if the message doesn't exist or if collection stopped due to error
    if (reason === 'error' || !message) return;

    // Disable buttons after timeout or manual stop (unless errored out)
    const disabledButtons = generateButtons(currentPageIndex);
    disabledButtons.components.forEach(button => button.setDisabled(true));
    
    // Use edit, not editReply, on the message object
    message.edit({ components: [disabledButtons] }).catch(editError => {
        // Ignore errors if message was deleted or interaction expired
        if (editError.code !== 'UnknownMessage' && editError.code !== 'InteractionExpired') { 
            console.error('Error disabling pagination buttons:', editError);
        }
    });
  });
}

module.exports = { sendPaginatedEmbed, ITEMS_PER_PAGE };
