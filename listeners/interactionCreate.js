const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId, sendLog } = require('../utils/runtime');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isUserContextMenuCommand()) return;

    if (interaction.guild && getLogChannelId(interaction.guildId)) {
      const isContextMenu = interaction.isUserContextMenuCommand();
      const fields = [
        { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
      ];
      if (isContextMenu) {
        const target = interaction.targetUser;
        fields.push({ name: 'Target', value: target ? `<@${target.id}>` : 'Unknown', inline: true });
      } else {
        const options = interaction.options.data.map(option => {
          if (option.type === 6) return `${option.name}: <@${option.value}>`;
          if (option.type === 8) return `${option.name}: <@&${option.value}>`;
          if (option.type === 7) return `${option.name}: <#${option.value}>`;
          return `${option.name}: ${option.value}`;
        }).join('\n') || '*None*';
        fields.push({ name: 'Options', value: options });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ size: 128 }) })
        .setTitle(isContextMenu ? '⚡ Context Menu Used' : '⚡ Slash Command Used')
        .setDescription(isContextMenu ? `\`${interaction.commandName}\`` : `\`/${interaction.commandName}\``)
        .addFields(fields)
        .setTimestamp()
        .setFooter({ text: `User ID: ${interaction.user.id}` });
      sendLog(interaction.guild, embed).catch(() => {});
    }

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Command ${interaction.commandName} failed:`, error);
      const reply = { content: 'There was an error while executing this command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(() => {});
      else await interaction.reply(reply).catch(() => {});
    }
  },
};