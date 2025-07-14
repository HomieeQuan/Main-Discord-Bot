// controllers/statsController.js
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const SWATEmbeds = require('../views/embedBuilder');

class StatsController {
    // Handles when someone checks their personal stats
    static async getPersonalStats(interaction) {
        try {
            // Find user in database
            const user = await SWATUser.findOne({ discordId: interaction.user.id });
            
            // If user doesn't exist, show "no stats" message
            if (!user) {
                const noStatsEmbed = SWATEmbeds.createNoStatsEmbed();
                return await interaction.reply({ embeds: [noStatsEmbed], ephemeral: true });
            }

            // Calculate weekly rank
            const weeklyRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints } 
            }) + 1;

            // Calculate all-time rank  
            const allTimeRank = await SWATUser.countDocuments({ 
                allTimePoints: { $gt: user.allTimePoints } 
            }) + 1;

            // Get recent events (last 5)
            const recentEvents = await EventLog.find({ userId: interaction.user.id })
                .sort({ submittedAt: -1 })  // Most recent first
                .limit(5);

            // Create stats embed
            const statsEmbed = SWATEmbeds.createPersonalStatsEmbed(
                user, 
                interaction.user, 
                weeklyRank, 
                allTimeRank, 
                recentEvents
            );

            await interaction.reply({ embeds: [statsEmbed] });

        } catch (error) {
            console.error('Personal stats error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve your statistics. Please try again later.');
            
            if (interaction.replied) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // Handles when someone checks another user's stats (for HR)
    static async getUserStats(interaction, targetUser) {
        try {
            // Check if user has permission to view other stats (HR only for now)
            const PermissionChecker = require('../utils/permissionChecker');
            if (!PermissionChecker.isHR(interaction.member) && targetUser.id !== interaction.user.id) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('You can only view your own stats unless you have HR role.');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Find target user in database
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} hasn't submitted any events yet.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Calculate ranks
            const weeklyRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints } 
            }) + 1;

            const allTimeRank = await SWATUser.countDocuments({ 
                allTimePoints: { $gt: user.allTimePoints } 
            }) + 1;

            // Get recent events
            const recentEvents = await EventLog.find({ userId: targetUser.id })
                .sort({ submittedAt: -1 })
                .limit(5);

            // Create stats embed
            const statsEmbed = SWATEmbeds.createPersonalStatsEmbed(
                user, 
                targetUser, 
                weeklyRank, 
                allTimeRank, 
                recentEvents
            );

            await interaction.reply({ embeds: [statsEmbed] });

        } catch (error) {
            console.error('User stats error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve user statistics. Please try again later.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = StatsController;