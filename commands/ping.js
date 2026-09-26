const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency'),
  async execute(interaction) {
    await interaction.reply('Pinging...');
    const reply = await interaction.fetchReply();
    const latency = reply.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);
    await interaction.editReply(`Pong! 🏓\nBot Latency: **${latency}ms**\nAPI Latency: **${apiLatency}ms**`);
  },
};