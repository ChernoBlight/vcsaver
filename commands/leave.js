const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { afkData } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel'),
  async execute(interaction) {
    const connection = getVoiceConnection(interaction.guildId);
    if (!connection) {
      return interaction.reply({ content: 'I am not in a voice channel!', ephemeral: true });
    }
    afkData.delete(interaction.guildId);
    connection.destroy();
    await interaction.reply('Left the voice channel.');
  },
};