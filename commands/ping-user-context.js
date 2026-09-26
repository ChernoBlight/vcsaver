const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { executePingUser } = require('../utils/runtime');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Ping User')
    .setType(ApplicationCommandType.User),
  async execute(interaction) {
    await executePingUser(interaction, interaction.targetUser, 2);
  },
};