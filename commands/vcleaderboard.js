const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { activeSessions, vcData, getCurrentChannelId, getTotalMs, formatDuration } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcleaderboard')
    .setDescription('Show the top members by voice channel time')
    .addIntegerOption(option => option
      .setName('limit')
      .setDescription('How many members to show (default 10, max 25)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25)),
  async execute(interaction) {
    const limit = interaction.options.getInteger('limit') || 10;
    const guildId = interaction.guildId;
    const userMap = vcData.get(guildId) || new Map();
    const entries = [...userMap.keys()].map(userId => ({ userId, totalMs: getTotalMs(guildId, userId) }));
    for (const key of activeSessions.keys()) {
      if (!key.startsWith(`${guildId}:`)) continue;
      const userId = key.split(':')[1];
      if (!entries.some(entry => entry.userId === userId)) {
        entries.push({ userId, totalMs: getTotalMs(guildId, userId) });
      }
    }
    entries.sort((a, b) => b.totalMs - a.totalMs);
    const top = entries.slice(0, limit);
    if (top.length === 0) {
      return interaction.reply({ content: 'No voice channel time recorded yet.', ephemeral: true });
    }

    const lines = await Promise.all(top.map(async (entry, index) => {
      let name = entry.userId;
      try {
        name = (await interaction.guild.members.fetch(entry.userId)).displayName;
      } catch {
        try {
          const user = await interaction.client.users.fetch(entry.userId);
          name = user.displayName || user.username;
        } catch {}
      }
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
      const channelId = getCurrentChannelId(guildId, entry.userId);
      const channel = channelId ? interaction.guild.channels.cache.get(channelId) : null;
      const liveInfo = channel ? ` 🟢 *${channel.name}*` : '';
      return `${medal} **${name}**${liveInfo} — ${formatDuration(entry.totalMs)}`;
    }));
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏆 VC Time Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Top ${top.length} • Green = currently in VC` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};