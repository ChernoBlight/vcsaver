const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCurrentChannelId, getTotalMs, formatDuration } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vctime')
    .setDescription('Check voice channel time for a member')
    .addUserOption(option => option
      .setName('user')
      .setDescription('The member to check (defaults to you)')
      .setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const formatted = formatDuration(getTotalMs(interaction.guildId, target.id));
    const channelId = getCurrentChannelId(interaction.guildId, target.id);
    let statusText = '⚫ Not in VC';
    if (channelId) {
      const channel = interaction.guild.channels.cache.get(channelId);
      statusText = `🟢 In **${channel?.name || 'Unknown channel'}**`;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎙️ Voice Channel Time')
      .setDescription(target.id === interaction.user.id
        ? `You have spent **${formatted}** in voice channels.`
        : `**${target.username}** has spent **${formatted}** in voice channels.`)
      .addFields(
        { name: 'Status', value: statusText, inline: true },
        { name: 'Total', value: formatted, inline: true }
      )
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};