// controllers/statsController.js - FIXED rank lock display and removed medal emoji
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const SWATEmbeds = require('../views/embedBuilder');

class StatsController {
    // FIXED: Personal stats now shows rank lock properly
    static async getPersonalStats(interaction) {
        try {
            // Find user in database
            let user = await SWATUser.findOne({ discordId: interaction.user.id });
            
            // If user doesn't exist, show "no stats" message
            if (!user) {
                const noStatsEmbed = SWATEmbeds.createNoStatsEmbed();
                return await interaction.reply({ embeds: [noStatsEmbed], ephemeral: true });
            }
    
            // 🔧 CRITICAL FIX: Ensure user has all required fields before displaying stats
            let needsSave = false;
            if (user.rankPoints === undefined || user.rankPoints === null) {
                user.rankPoints = 0;
                needsSave = true;
                console.log(`🔧 FIXED: Initialized rank points for ${user.username} during stats view`);
            }
            if (user.weeklyPoints === undefined || user.weeklyPoints === null) {
                user.weeklyPoints = 0;
                needsSave = true;
            }
            if (user.allTimePoints === undefined || user.allTimePoints === null) {
                user.allTimePoints = 0;
                needsSave = true;
            }
            if (user.totalEvents === undefined || user.totalEvents === null) {
                user.totalEvents = 0;
                needsSave = true;
            }
            if (user.weeklyEvents === undefined || user.weeklyEvents === null) {
                user.weeklyEvents = 0;
                needsSave = true;
            }
    
            // Save if any fields were missing
            if (needsSave) {
                await user.save();
                console.log(`✅ Fixed missing fields for user ${user.username}`);
            }
    
            // Calculate weekly rank
            const weeklyRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints || 0 } 
            }) + 1;
    
            // Calculate all-time rank  
            const allTimeRank = await SWATUser.countDocuments({ 
                allTimePoints: { $gt: user.allTimePoints || 0 } 
            }) + 1;
    
            // Get recent events (last 5)
            const recentEvents = await EventLog.find({ userId: interaction.user.id })
                .sort({ submittedAt: -1 })  // Most recent first
                .limit(5);
    
            // Create stats embed with rank lock support
            const statsEmbed = SWATEmbeds.createPersonalStatsEmbed(
                user, 
                interaction.user, 
                weeklyRank, 
                allTimeRank, 
                recentEvents,
                true  // isPersonalStats flag
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

    // FIXED: User stats for HR viewing (also shows rank lock consistently)
    static async getUserStats(interaction, targetUser) {
        try {
            // Check if user has permission to view other stats (HR only for now)
            const PermissionChecker = require('../utils/permissionChecker');
            if (!PermissionChecker.isHR(interaction.member) && targetUser.id !== interaction.user.id) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('You can only view your own stats unless you have HR role.');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
    
            // Find target user in database
            let user = await SWATUser.findOne({ discordId: targetUser.id });
            
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} hasn't submitted any events yet.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
    
            // 🔧 CRITICAL FIX: Ensure target user has all required fields
            let needsSave = false;
            if (user.rankPoints === undefined || user.rankPoints === null) {
                user.rankPoints = 0;
                needsSave = true;
                console.log(`🔧 FIXED: Initialized rank points for ${user.username} during HR stats view`);
            }
            if (user.weeklyPoints === undefined || user.weeklyPoints === null) {
                user.weeklyPoints = 0;
                needsSave = true;
            }
            if (user.allTimePoints === undefined || user.allTimePoints === null) {
                user.allTimePoints = 0;
                needsSave = true;
            }
    
            // Save if any fields were missing
            if (needsSave) {
                await user.save();
                console.log(`✅ Fixed missing fields for user ${user.username} (HR view)`);
            }
    
            // Calculate ranks
            const weeklyRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints || 0 } 
            }) + 1;
    
            const allTimeRank = await SWATUser.countDocuments({ 
                allTimePoints: { $gt: user.allTimePoints || 0 } 
            }) + 1;
    
            // Get recent events
            const recentEvents = await EventLog.find({ userId: targetUser.id })
                .sort({ submittedAt: -1 })
                .limit(5);
    
            // Create stats embed with rank lock support
            const statsEmbed = SWATEmbeds.createPersonalStatsEmbed(
                user, 
                targetUser, 
                weeklyRank, 
                allTimeRank, 
                recentEvents,
                false  // isPersonalStats flag (false for HR viewing others)
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