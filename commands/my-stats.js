const { SlashCommandBuilder } = require('discord.js');
const StatsController = require('../controllers/statsController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('my-stats')
        .setDescription('View your SWAT performance statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s stats (HR only)')
                .setRequired(false))
        .setDMPermission(false),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        if (targetUser) {
            // Viewing another user's stats
            await StatsController.getUserStats(interaction, targetUser);
        } else {
            // Viewing own stats
            await StatsController.getPersonalStats(interaction);
        }
    },
};