// commands/leaderboard.js - UPDATED: Combined SWAT + CMU leaderboards with division indicators
const { SlashCommandBuilder } = require('discord.js');
const LeaderboardController = require('../controllers/leaderboardController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View SWAT performance leaderboards (SWAT + CMU combined)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: '📊 Weekly Rankings', value: 'weekly' },
                    { name: '🏆 All-Time Rankings', value: 'alltime' }
                ))
        .setDMPermission(false),

    async execute(interaction) {
        const type = interaction.options.getString('type') || 'weekly';

        switch (type) {
            case 'weekly':
                await LeaderboardController.getWeeklyLeaderboard(interaction);
                break;
                
            case 'alltime':
                await LeaderboardController.getAllTimeLeaderboard(interaction);
                break;
                
            default:
                await LeaderboardController.getWeeklyLeaderboard(interaction);
                break;
        }
    },
};