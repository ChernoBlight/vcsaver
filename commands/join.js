const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { joinChannel } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel and AFK'),
  async execute(interaction) {
    await interaction.deferReply().catch(() => null);
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) return interaction.editReply('You need to be in a voice channel first!');
    if (getVoiceConnection(interaction.guildId)) return interaction.editReply('I am already connected!');

    try {
      await joinChannel(voiceChannel);
      await interaction.editReply(`Joined **${voiceChannel.name}** and going AFK 💤`);
    } catch (error) {
      console.error(error);
      await interaction.editReply('Failed to join the voice channel.');
    }
  },
};