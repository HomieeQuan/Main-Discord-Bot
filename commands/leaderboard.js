// commands/leaderboard.js
const { SlashCommandBuilder } = require('discord.js');
const LeaderboardController = require('../controllers/leaderboardController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View SWAT performance leaderboards')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: 'Weekly Rankings', value: 'weekly' },
                    { name: 'All-Time Rankings', value: 'alltime' },
                    { name: 'My Position', value: 'position' }
                ))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check specific user\'s position (works with "My Position" type)')
                .setRequired(false))
        .setDMPermission(false),

    async execute(interaction) {
        const type = interaction.options.getString('type') || 'weekly';
        const targetUser = interaction.options.getUser('user');

        switch (type) {
            case 'weekly':
                await LeaderboardController.getWeeklyLeaderboard(interaction);
                break;
                
            case 'alltime':
                await LeaderboardController.getAllTimeLeaderboard(interaction);
                break;
                
            case 'position':
                const userToCheck = targetUser || interaction.user;
                await LeaderboardController.getUserPosition(interaction, userToCheck);
                break;
                
            default:
                await LeaderboardController.getWeeklyLeaderboard(interaction);
                break;
        }
    },
};