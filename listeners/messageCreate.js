const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId, sendLog } = require('../utils/runtime');

const PREFIX_COMMAND_REGEX = /^[!./?$%~>]+\S+/;

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || !getLogChannelId(message.guild.id)) return;

    if (message.interaction && message.interaction.user?.id !== message.client.user?.id &&
      message.author?.id !== message.client.user?.id) {
      const runner = message.interaction.user;
      const botAuthor = message.author;
      const embed = new EmbedBuilder()
        .setColor(0xEB459E)
        .setAuthor({
          name: runner?.tag || runner?.username || 'Unknown user',
          iconURL: runner?.displayAvatarURL?.({ size: 128 }) || null,
        })
        .setTitle('🤖 Slash Command Used (Other Bot)')
        .setDescription(`\`/${message.interaction.commandName || message.interaction.name || 'unknown'}\``)
        .addFields(
          { name: 'User', value: runner ? `<@${runner.id}>` : 'Unknown', inline: true },
          { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
          { name: 'Bot', value: botAuthor ? `${botAuthor.tag} (<@${botAuthor.id}>)` : 'Unknown' }
        )
        .setTimestamp()
        .setFooter({ text: `User ID: ${runner?.id || 'unknown'} • Bot ID: ${botAuthor?.id || 'unknown'}` });
      await sendLog(message.guild, embed).catch(() => {});
    }

    if (message.author.id === message.client.user.id) return;
    const isOtherBot = message.author.bot;
    const looksLikeCommand = PREFIX_COMMAND_REGEX.test(message.content.trim());
    if (!isOtherBot && !looksLikeCommand) return;

    const content = message.content
      ? (message.content.length > 1000 ? `${message.content.slice(0, 997)}...` : message.content)
      : '*No text content*';
    const embed = new EmbedBuilder()
      .setColor(isOtherBot ? 0xEB459E : 0x5865F2)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ size: 128 }) })
      .setTitle(isOtherBot ? '🤖 Bot Message / Command' : '💬 Prefix-style Command')
      .setDescription(content)
      .addFields(
        { name: 'User', value: `<@${message.author.id}>`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
        ...(isOtherBot ? [{ name: 'Bot', value: 'Yes', inline: true }] : [])
      )
      .setTimestamp()
      .setFooter({ text: `User ID: ${message.author.id} • Msg ID: ${message.id}` });
    if (message.attachments.size) {
      embed.addFields({
        name: 'Attachments',
        value: [...message.attachments.values()].map(file => `[${file.name}](${file.url})`).join('\n').slice(0, 1024),
      });
    }
    await sendLog(message.guild, embed).catch(() => {});
  },
};