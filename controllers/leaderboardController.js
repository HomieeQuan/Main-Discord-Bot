// controllers/leaderboardController.js
const SWATUser = require('../models/SWATUser');
const SWATEmbeds = require('../views/embedBuilder');
const { EmbedBuilder } = require('discord.js');

class LeaderboardController {
    // Enhanced weekly leaderboard with Phase 1 features
    static async getWeeklyLeaderboard(interaction) {
        try {
            console.log('🔍 Starting enhanced weekly leaderboard...');
            
            // Get all users sorted by weekly points
            const users = await SWATUser.find({})
                .sort({ weeklyPoints: -1 })
                .limit(50);

            if (users.length === 0) {
                const emptyEmbed = SWATEmbeds.createEmptyLeaderboardEmbed('weekly');
                return await interaction.reply({ embeds: [emptyEmbed] });
            }

            // Get enhanced statistics
            const StatisticsController = require('./statisticsController');
            const enhancedStats = await StatisticsController.getEnhancedStatistics();

            // Create enhanced leaderboard embed
            const leaderboardEmbed = await SWATEmbeds.createEnhancedLeaderboardEmbed(
                users, 
                'weekly', 
                enhancedStats
            );

            await interaction.reply({ embeds: [leaderboardEmbed] });

        } catch (error) {
            console.error('❌ Enhanced weekly leaderboard error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve weekly leaderboard. Please try again later.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // Enhanced all-time leaderboard
    static async getAllTimeLeaderboard(interaction) {
        try {
            console.log('🔍 Starting enhanced all-time leaderboard...');
            
            // Get all users sorted by all-time points
            const users = await SWATUser.find({})
                .sort({ allTimePoints: -1 })
                .limit(50);

            if (users.length === 0) {
                const emptyEmbed = SWATEmbeds.createEmptyLeaderboardEmbed('alltime');
                return await interaction.reply({ embeds: [emptyEmbed] });
            }

            // Create enhanced leaderboard embed (no enhanced stats for all-time)
            const leaderboardEmbed = await SWATEmbeds.createEnhancedLeaderboardEmbed(
                users, 
                'alltime'
            );

            await interaction.reply({ embeds: [leaderboardEmbed] });

        } catch (error) {
            console.error('❌ All-time leaderboard error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve all-time leaderboard. Please try again later.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }

    // Enhanced user position with progress bars
    static async getUserPosition(interaction, targetUser) {
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} hasn't submitted any events yet.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Calculate positions
            const weeklyRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints } 
            }) + 1;

            const allTimeRank = await SWATUser.countDocuments({ 
                allTimePoints: { $gt: user.allTimePoints } 
            }) + 1;

            // Get trend information
            const StatisticsController = require('./statisticsController');
            const trend = await StatisticsController.calculateUserTrend(user.discordId);

            // Create progress bar
            const ProgressBarGenerator = require('../utils/progressBar');
            const quotaProgress = ProgressBarGenerator.createQuotaProgressBar(user.weeklyPoints, user.weeklyQuota);

            const embed = new EmbedBuilder()
                .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
                .setTitle(`📊 ${targetUser.username}'s Leaderboard Position`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '🎯 Weekly Quota Progress', 
                        value: quotaProgress, 
                        inline: false 
                    },
                    { 
                        name: '🏆 Weekly Rank', 
                        value: `#${weeklyRank} ${trend.direction} ${trend.rankChange > 0 ? `(${trend.direction === '⬆️' ? '+' : '-'}${trend.rankChange})` : ''}`, 
                        inline: true 
                    },
                    { 
                        name: '🏅 All-Time Rank', 
                        value: `#${allTimeRank} (${user.allTimePoints} points)`, 
                        inline: true 
                    },
                    { 
                        name: '🔥 Points Today', 
                        value: `${user.dailyPointsToday || 0} points`, 
                        inline: true 
                    },
                    { 
                        name: '📈 Weekly Performance', 
                        value: `${user.weeklyPoints} points • ${user.weeklyEvents} events`, 
                        inline: true 
                    },
                    { 
                        name: '🎯 Quota Status', 
                        value: user.quotaCompleted ? '✅ Completed!' : '⏳ In Progress', 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: user.isBooster ? 'Server Booster (2x Points) 💎' : 'Standard Points' 
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ User position error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve user position. Please try again later.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = LeaderboardController;