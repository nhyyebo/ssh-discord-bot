const { EmbedBuilder } = require('discord.js');

// Create embed for container operations
function createEmbed(title, description, status, containerName) {
  let color = 0x5865F2; // Discord blurple
  
  if (status === 'success') {
    color = 0x57F287; // Green
  } else if (status === 'error') {
    color = 0xED4245; // Red
  } else if (status === 'warning') {
    color = 0xFEE75C; // Yellow
  } else if (status === 'info') {
    color = 0x5865F2; // Blurple
  }
  
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setThumbnail('https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png');
    
  if (containerName) {
    embed.setFooter({ text: `Container: ${containerName}` });
  }
  
  return embed;
}

module.exports = {
  createEmbed
}; 