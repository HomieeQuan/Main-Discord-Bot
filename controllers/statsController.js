// controllers/statsController.js - FIXED to hide HR audit actions from user-visible stats
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const SWATEmbeds = require('../views/embedBuilder');

class StatsController {
    // FIXED: Personal stats now hides HR audit actions from recent events
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
    
            // 🔧 ISSUE #4 FIX: Filter out HR audit actions from user-visible recent events
            const recentEvents = await EventLog.find({ 
                userId: interaction.user.id,
                // 🔧 EXCLUDE HR audit actions and other admin-only events from user view
                eventType: { 
                    $nin: [
                        'hr_audit_action',        // 🔧 PRIMARY FIX: Hide HR audit entries
                        'hr_point_adjustment',    // Hide HR point adjustments
                        'hr_critical_action',     // Hide critical HR actions
                        'user_deletion',          // Hide user deletion logs
                        'auto_cleanup',          // Hide auto cleanup logs
                        'booster_status_change', // Hide booster sync logs
                        'daily_automation',      // Hide automation logs
                        'automation_error'       // Hide automation errors
                    ] 
                }
            })
                .sort({ submittedAt: -1 })  // Most recent first
                .limit(5);
    
            console.log(`📊 Personal stats: Found ${recentEvents.length} user-visible events (HR audit actions filtered out)`);
    
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

    // FIXED: User stats for HR viewing (also hides HR audit actions from display)
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
    
            // 🔧 ISSUE #4 FIX: For HR viewing others, show user events but still filter out HR audit actions
            // HR can use /audit-user to see the full audit trail if needed
            const recentEvents = await EventLog.find({ 
                userId: targetUser.id,
                // 🔧 Even for HR viewing others, filter HR audit actions from the general stats display
                // HR should use dedicated audit commands to see full audit trails
                eventType: { 
                    $nin: [
                        'hr_audit_action',        // 🔧 Hide HR audit entries from general stats view
                        'user_deletion',          // Hide deletion logs from general view
                        'auto_cleanup',          // Hide cleanup logs
                        'daily_automation',      // Hide automation logs
                        'automation_error'       // Hide automation errors
                    ] 
                }
            })
                .sort({ submittedAt: -1 })
                .limit(5);
    
            console.log(`📊 HR stats view: Found ${recentEvents.length} user-visible events for ${user.username} (HR audit actions filtered)`);
    
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