const { SlashCommandBuilder } = require('discord.js');
const { BOT_OWNER_IDS, setAllowedRoles } = require('../utils/runtime');

const data = new SlashCommandBuilder()
  .setName('set-purge-roles')
  .setDescription('Set which roles are allowed to use /purge (bot owners only)');

for (let index = 1; index <= 5; index++) {
  data.addRoleOption(option => option
    .setName(`role${index}`)
    .setDescription(`${index === 1 ? 'First' : index === 2 ? 'Second' : index === 3 ? 'Third' : index === 4 ? 'Fourth' : 'Fifth'} allowed role`)
    .setRequired(false));
}

module.exports = {
  data,
  async execute(interaction) {
    if (!BOT_OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: 'Only the bot owners can use this command.', ephemeral: true });
    }
    const roles = Array.from({ length: 5 }, (_, index) => interaction.options.getRole(`role${index + 1}`)).filter(Boolean);
    setAllowedRoles('purge', interaction.guildId, roles);
    if (roles.length === 0) {
      return interaction.reply({
        content: '✅ Cleared all allowed roles for `/purge`. No one (except bot owners) can use it now.',
        ephemeral: true,
      });
    }
    await interaction.reply({
      content: `✅ Allowed roles for \`/purge\` set to: ${roles.map(role => `<@&${role.id}>`).join(', ')}`,
      ephemeral: true,
    });
  },
};