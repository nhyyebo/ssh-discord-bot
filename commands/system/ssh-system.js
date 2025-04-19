const { ssh } = require('../../utils/ssh');
const { createEmbed } = require('../../utils/embed');

module.exports = {
  name: 'ssh-system',
  description: 'Show system information from the VPS (CPU/RAM/Disk usage)',
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      // Run several commands to collect system information
      const commands = [
        'top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'', // CPU usage
        'free -m | awk \'/Mem/{printf "%.2f%%", $3*100/$2 }\'', // RAM usage
        'df -h | grep "/$" | awk \'{print $5}\'', // Disk usage
        'uptime -p', // System uptime
        'cat /proc/loadavg' // Load average
      ];
      
      const results = await Promise.all(commands.map(cmd => ssh.execCommand(cmd)));
      
      const [cpuResult, ramResult, diskResult, uptimeResult, loadResult] = results;
      
      // Format the results
      const cpuUsage = cpuResult.stdout ? `${parseFloat(cpuResult.stdout).toFixed(2)}%` : 'Error';
      const ramUsage = ramResult.stdout || 'Error';
      const diskUsage = diskResult.stdout || 'Error';
      const uptime = uptimeResult.stdout || 'Error';
      const loadAvg = loadResult.stdout || 'Error';
      
      // Create a status message based on CPU usage
      let status = 'info';
      if (parseFloat(cpuUsage) > 80) {
        status = 'error';
      } else if (parseFloat(cpuUsage) > 50) {
        status = 'warning';
      } else {
        status = 'success';
      }
      
      // Create the embed
      const systemInfoEmbed = createEmbed(
        'VPS System Information',
        `**CPU Usage:** ${cpuUsage}\n**RAM Usage:** ${ramUsage}\n**Disk Usage:** ${diskUsage}\n**System Uptime:** ${uptime}\n**Load Average:** ${loadAvg}`,
        status
      );
      
      await interaction.editReply({ embeds: [systemInfoEmbed] });
    } catch (error) {
      await interaction.editReply({ 
        embeds: [createEmbed('Command Error', `An error occurred while executing the command: ${error.message}`, 'error')]
      });
    }
  }
}; 