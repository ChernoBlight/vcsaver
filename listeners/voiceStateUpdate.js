const { Events, EmbedBuilder } = require('discord.js');
const runtime = require('../utils/runtime');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const guildId = newState.guild?.id || oldState.guild?.id;
    const userId = newState.id || oldState.id;
    if (!guildId || !userId) return;

    const member = newState.member || oldState.member;
    if (member?.user?.bot) return;
    const guild = newState.guild || oldState.guild;
    const wasInVoice = Boolean(oldState.channelId);
    const isInVoice = Boolean(newState.channelId);

    if (!wasInVoice && isInVoice) runtime.startSession(guildId, userId, newState.channelId);
    else if (wasInVoice && !isInVoice) runtime.endSession(guildId, userId);
    else if (wasInVoice && isInVoice && oldState.channelId !== newState.channelId) {
      runtime.updateSessionChannel(guildId, userId, newState.channelId);
    }

    if (!runtime.getLogChannelId(guildId)) return;
    const displayName = member?.displayName || member?.user?.username || userId;
    const avatar = member?.user?.displayAvatarURL({ size: 128 }) || null;
    let embed;

    if (!wasInVoice && isInVoice) {
      const channel = newState.channel;
      embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: displayName, iconURL: avatar })
        .setTitle('🟢 Joined Voice Channel')
        .setDescription(`**${displayName}** joined **${channel?.name || 'Unknown'}**`)
        .addFields(
          { name: 'User', value: `<@${userId}>`, inline: true },
          { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unknown', inline: true }
        );
    } else if (wasInVoice && !isInVoice) {
      const channel = oldState.channel;
      embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: displayName, iconURL: avatar })
        .setTitle('🔴 Left Voice Channel')
        .setDescription(`**${displayName}** left **${channel?.name || 'Unknown'}**`)
        .addFields(
          { name: 'User', value: `<@${userId}>`, inline: true },
          { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unknown', inline: true }
        );
    } else if (wasInVoice && isInVoice && oldState.channelId !== newState.channelId) {
      const fromChannel = oldState.channel;
      const toChannel = newState.channel;
      embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({ name: displayName, iconURL: avatar })
        .setTitle('🔄 Moved Voice Channel')
        .setDescription(`**${displayName}** moved from **${fromChannel?.name || 'Unknown'}** to **${toChannel?.name || 'Unknown'}**`)
        .addFields(
          { name: 'User', value: `<@${userId}>`, inline: true },
          { name: 'From', value: fromChannel ? `<#${fromChannel.id}>` : 'Unknown', inline: true },
          { name: 'To', value: toChannel ? `<#${toChannel.id}>` : 'Unknown', inline: true }
        );
    }

    if (embed) {
      embed.setTimestamp().setFooter({ text: `User ID: ${userId}` });
      await runtime.sendLog(guild, embed);
    }
  },
};