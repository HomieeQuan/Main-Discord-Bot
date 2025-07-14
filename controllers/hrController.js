// controllers/hrController.js
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const SWATEmbeds = require('../views/embedBuilder');
const PermissionChecker = require('../utils/permissionChecker');
const { EmbedBuilder } = require('discord.js');

class HRController {
    // Manage user points (add, remove, set, remove_all)
    static async managePoints(interaction, targetUser, action, amount, reason) {
        try {
            // Check HR permission
            if (!PermissionChecker.canManageSystem(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Only HR can use this command!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Get or create target user
            let user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                user = new SWATUser({
                    discordId: targetUser.id,
                    username: targetUser.username
                });
            }

            // Store old values for logging
            const oldWeeklyPoints = user.weeklyPoints;
            const oldAllTimePoints = user.allTimePoints;

            // Handle remove_all action with safety checks
            if (action === 'remove_all') {
                // Safety check: require confirmation keyword
                if (!reason.toLowerCase().includes('confirm')) {
                    const warningEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('⚠️ REMOVE ALL POINTS - Confirmation Required')
                        .setDescription(`**🚨 WARNING: This will remove ALL points from ${targetUser.username}!**`)
                        .addFields(
                            { 
                                name: '💥 This Will Remove', 
                                value: `• Weekly Points: **${user.weeklyPoints}**\n• All-Time Points: **${user.allTimePoints}**\n• Quota Completion Status: **${user.quotaCompleted ? 'Completed' : 'In Progress'}**`, 
                                inline: false 
                            },
                            { 
                                name: '🚨 Cannot Be Undone', 
                                value: 'This action is **permanent** and cannot be reversed!', 
                                inline: false 
                            },
                            { 
                                name: '✅ To Confirm', 
                                value: 'Include the word "**confirm**" in your reason to proceed', 
                                inline: false 
                            },
                            { 
                                name: '📝 Example', 
                                value: '```Reason: "Major violation - confirm removal of all points"```', 
                                inline: false 
                            }
                        )
                        .setFooter({ text: 'This is a destructive action - please be certain!' })
                        .setTimestamp();

                    return await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
                }

                // Additional safety: require minimum reason length
                if (reason.length < 5) {
                    const errorEmbed = SWATEmbeds.createErrorEmbed('⚠️ Please provide a reason for removing all points.');
                    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                // Execute the nuclear option
                user.weeklyPoints = 0;
                user.allTimePoints = 0;
                user.quotaCompleted = false;

                await user.save();

                // Create comprehensive audit log for critical action
                const auditLog = new EventLog({
                    userId: targetUser.id,
                    username: targetUser.username,
                    eventType: 'hr_critical_action',
                    description: `🚨 CRITICAL HR ACTION: ALL POINTS REMOVED - Reason: ${reason}`,
                    pointsAwarded: -oldWeeklyPoints,
                    boostedPoints: false,
                    screenshotUrl: 'HR_CRITICAL_ADJUSTMENT',
                    hrAction: {
                        hrUser: interaction.user.id,
                        hrUsername: interaction.user.username,
                        action: 'remove_all',
                        amount: oldWeeklyPoints,
                        reason: reason,
                        oldWeeklyPoints: oldWeeklyPoints,
                        newWeeklyPoints: 0,
                        oldAllTimePoints: oldAllTimePoints,
                        newAllTimePoints: 0
                    }
                });

                await auditLog.save();

                // Create dramatic response embed
                const responseEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚨 ALL POINTS REMOVED')
                    .setDescription(`**ALL POINTS HAVE BEEN REMOVED** from ${targetUser.username}`)
                    .addFields(
                        { name: '👤 Target User', value: targetUser.username, inline: true },
                        { name: '🔧 Action', value: '🚨 REMOVE ALL', inline: true },
                        { name: '💥 Points Removed', value: `${oldWeeklyPoints} weekly\n${oldAllTimePoints} all-time`, inline: true },
                        { name: '📊 Weekly Points', value: `${oldWeeklyPoints} → **0**`, inline: true },
                        { name: '⭐ All-Time Points', value: `${oldAllTimePoints} → **0**`, inline: true },
                        { name: '🎯 Quota Status', value: '✅ → ❌ Reset', inline: true },
                        { name: '📝 Reason', value: reason, inline: false },
                        { name: '⚠️ CRITICAL ACTION', value: 'This user has had ALL points removed. This action has been logged for audit purposes and **cannot be undone**.', inline: false }
                    )
                    .setFooter({ text: `Critical action performed by ${interaction.user.username}` })
                    .setTimestamp();

                await interaction.reply({ embeds: [responseEmbed] });

                // Enhanced logging for critical actions
                console.log(`🚨 CRITICAL HR ACTION: ${interaction.user.username} REMOVED ALL POINTS from ${targetUser.username}`);
                console.log(`   - Weekly points removed: ${oldWeeklyPoints}`);
                console.log(`   - All-time points removed: ${oldAllTimePoints}`);
                console.log(`   - Reason: ${reason}`);
                console.log(`   - Timestamp: ${new Date().toISOString()}`);

                return; // Exit early for remove_all
            }

            // Handle standard point actions
            switch (action) {
                case 'add':
                    user.weeklyPoints += amount;
                    user.allTimePoints += amount;
                    break;
                case 'remove':
                    user.weeklyPoints = Math.max(0, user.weeklyPoints - amount);
                    user.allTimePoints = Math.max(0, user.allTimePoints - amount);
                    break;
                case 'set':
                    const difference = amount - user.weeklyPoints;
                    user.weeklyPoints = amount;
                    user.allTimePoints = Math.max(0, user.allTimePoints + difference);
                    break;
                default:
                    const errorEmbed = SWATEmbeds.createErrorEmbed('⚠️ Invalid action. Use: add, remove, set, or remove_all');
                    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Update quota status
            user.quotaCompleted = user.weeklyPoints >= user.weeklyQuota;

            await user.save();

            // Create audit log entry
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: targetUser.username,
                eventType: 'hr_point_adjustment',
                description: `HR Action: ${action.toUpperCase()} ${amount} points - Reason: ${reason}`,
                pointsAwarded: action === 'add' ? amount : (action === 'remove' ? -amount : amount - oldWeeklyPoints),
                boostedPoints: false,
                screenshotUrl: 'HR_ADJUSTMENT',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: action,
                    amount: amount,
                    reason: reason,
                    oldWeeklyPoints: oldWeeklyPoints,
                    newWeeklyPoints: user.weeklyPoints,
                    oldAllTimePoints: oldAllTimePoints,
                    newAllTimePoints: user.allTimePoints
                }
            });

            await auditLog.save();

            // Create response embed
            const embed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('🛠️ HR Points Management')
                .setDescription(`**${action.charAt(0).toUpperCase() + action.slice(1)}** points for ${targetUser.username}`)
                .addFields(
                    { name: '👤 Target User', value: targetUser.username, inline: true },
                    { name: '🔧 Action', value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                    { name: '💯 Amount', value: amount.toString(), inline: true },
                    { name: '📊 Weekly Points', value: `${oldWeeklyPoints} → ${user.weeklyPoints}`, inline: true },
                    { name: '⭐ All-Time Points', value: `${oldAllTimePoints} → ${user.allTimePoints}`, inline: true },
                    { name: '🎯 Quota Status', value: user.quotaCompleted ? '✅ Completed' : '⏳ In Progress', inline: true },
                    { name: '📝 Reason', value: reason, inline: false }
                )
                .setFooter({ text: `Action performed by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Log to console for HR audit trail
            console.log(`🛠️ HR ACTION: ${interaction.user.username} ${action}ed ${amount} points ${action === 'set' ? 'to' : action === 'add' ? 'to' : 'from'} ${targetUser.username} - Reason: ${reason}`);

        } catch (error) {
            console.error('❌ HR points management error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to manage points. Please try again later.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }

    // Reset weekly statistics
    static async resetWeek(interaction, confirmReset) {
        try {
            // Check HR permission
            if (!PermissionChecker.canManageSystem(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Only HR can use this command!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (!confirmReset) {
                const warningEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ Weekly Reset Confirmation')
                    .setDescription('**WARNING: This will reset ALL weekly statistics!**\n\nThis action will:')
                    .addFields(
                        { name: '🔄 Reset to Zero', value: '• Weekly points\n• Weekly events\n• Quota completion status\n• Daily points', inline: false },
                        { name: '✅ Keep Unchanged', value: '• All-time points\n• Total events\n• User profiles', inline: false },
                        { name: '⚠️ Cannot Be Undone', value: 'This action is **permanent** and cannot be reversed!', inline: false },
                        { name: '🔒 Confirmation Required', value: 'Use `/reset-week confirm:true` to proceed', inline: false }
                    )
                    .setFooter({ text: 'Only use this at the start of a new quota week!' });

                return await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            // Get current stats before reset
            const users = await SWATUser.find({}).sort({ weeklyPoints: -1 });
            const totalUsers = users.length;
            const completedQuota = users.filter(u => u.quotaCompleted).length;
            const topPerformer = users[0];
            const totalWeeklyPoints = users.reduce((sum, u) => sum + u.weeklyPoints, 0);

            // Create weekly summary
            const summaryEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Weekly Summary (Before Reset)')
                .addFields(
                    { name: '👥 Total Operators', value: totalUsers.toString(), inline: true },
                    { name: '✅ Quota Completed', value: `${completedQuota}/${totalUsers} (${Math.floor((completedQuota/totalUsers)*100)}%)`, inline: true },
                    { name: '📊 Total Points Earned', value: totalWeeklyPoints.toString(), inline: true },
                    { name: '🏆 Top Performer', value: topPerformer ? `${topPerformer.username} (${topPerformer.weeklyPoints} pts)` : 'None', inline: true },
                    { name: '📈 Average Points', value: totalUsers > 0 ? (totalWeeklyPoints / totalUsers).toFixed(1) : '0', inline: true },
                    { name: '🎯 Best Performers', value: users.slice(0, 3).map((u, i) => `${i + 1}. ${u.username} (${u.weeklyPoints} pts)`).join('\n') || 'None', inline: false }
                )
                .setTimestamp();

            // Reset weekly statistics
            const resetResult = await SWATUser.updateMany(
                {},
                {
                    $set: {
                        weeklyPoints: 0,
                        weeklyEvents: 0,
                        quotaCompleted: false,
                        dailyPointsToday: 0,
                        lastDailyReset: new Date(),
                        previousWeeklyPoints: 0 // Reset for fresh trend tracking
                    }
                }
            );

            // Create reset confirmation embed
            const resetEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔄 Weekly Reset Completed!')
                .setDescription('✅ **Successfully started new quota week**')
                .addFields(
                    { name: '📅 Reset Date', value: new Date().toLocaleString(), inline: true },
                    { name: '👥 Users Reset', value: resetResult.modifiedCount.toString(), inline: true },
                    { name: '🎯 New Quota Period', value: 'Week has been reset to 0/10 points for all operators', inline: false },
                    { name: '📋 What Was Reset', value: '• Weekly points: 0\n• Weekly events: 0\n• Quota status: In Progress\n• Daily points: 0', inline: false }
                )
                .setFooter({ text: `Reset performed by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.editReply({ 
                content: '✅ **Weekly reset completed successfully!**',
                embeds: [summaryEmbed, resetEmbed] 
            });

            // Log to console for audit trail
            console.log(`🔄 WEEKLY RESET: Performed by ${interaction.user.username} - ${resetResult.modifiedCount} users reset`);

        } catch (error) {
            console.error('❌ Weekly reset error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to reset weekly stats. Please try again.');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // View event logs with filtering
   // Update to your existing hrController.js - replace the viewLogs method

    // View event logs with filtering and screenshot support
    static async viewLogs(interaction, targetUser = null, eventType = null, days = 7) {
        try {
            // Check HR permission
            if (!PermissionChecker.canManageSystem(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Only HR can use this command!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            // Build query filters
            const query = {};
            
            // Date filter (last X days)
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);
            query.submittedAt = { $gte: dateLimit };

            // User filter
            if (targetUser) {
                query.userId = targetUser.id;
            }

            // Event type filter
            if (eventType) {
                query.eventType = eventType;
            }

            // Get filtered logs
            const logs = await EventLog.find(query)
                .sort({ submittedAt: -1 })
                .limit(20); // Limit to 20 most recent

            if (logs.length === 0) {
                const noLogsEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('📋 No Event Logs Found')
                    .setDescription('No event logs match your search criteria.')
                    .addFields(
                        { name: '🔍 Search Criteria', value: `User: ${targetUser?.username || 'All'}\nEvent Type: ${eventType || 'All'}\nLast ${days} days`, inline: false }
                    );

                return await interaction.editReply({ embeds: [noLogsEmbed] });
            }

            // Create logs embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📋 Event Logs')
                .setDescription(`Showing ${logs.length} most recent logs`)
                .setTimestamp();

            // Add filters info
            let filterText = `**Filters:** Last ${days} days`;
            if (targetUser) filterText += ` • User: ${targetUser.username}`;
            if (eventType) filterText += ` • Type: ${eventType}`;
            
            embed.addFields({ name: '🔍 Search Criteria', value: filterText, inline: false });

            // Group logs by user for better readability
            const logsByUser = {};
            logs.forEach(log => {
                if (!logsByUser[log.username]) {
                    logsByUser[log.username] = [];
                }
                logsByUser[log.username].push(log);
            });

            // Add log entries (limit to prevent embed overflow)
            let fieldCount = 0;
            for (const [username, userLogs] of Object.entries(logsByUser)) {
                if (fieldCount >= 8) break; // Discord embed field limit

                const logText = userLogs.slice(0, 3).map(log => {
                    const date = log.submittedAt.toLocaleDateString();
                    const PointCalculator = require('../utils/pointCalculator');
                    const eventName = PointCalculator.getEventName(log.eventType);
                    
                    // Add screenshot indicator
                    const hasScreenshot = log.screenshotUrl && 
                                        log.screenshotUrl !== 'HR_ADJUSTMENT' && 
                                        log.screenshotUrl !== 'HR_CRITICAL_ADJUSTMENT' &&
                                        log.screenshotUrl !== 'AUTO_BOOSTER_SYNC';
                    const screenshotIcon = hasScreenshot ? '📸' : '📝';
                    
                    return `${screenshotIcon} ${eventName} (${log.pointsAwarded}pts) - ${date}`;
                }).join('\n');

                embed.addFields({
                    name: `👤 ${username} (${userLogs.length} events)`,
                    value: logText + (userLogs.length > 3 ? `\n... and ${userLogs.length - 3} more` : ''),
                    inline: true
                });

                fieldCount++;
            }

            // Add summary statistics
            const totalPoints = logs.reduce((sum, log) => sum + log.pointsAwarded, 0);
            const uniqueUsers = new Set(logs.map(log => log.userId)).size;
            const eventsWithScreenshots = logs.filter(log => 
                log.screenshotUrl && 
                log.screenshotUrl !== 'HR_ADJUSTMENT' && 
                log.screenshotUrl !== 'HR_CRITICAL_ADJUSTMENT' &&
                log.screenshotUrl !== 'AUTO_BOOSTER_SYNC'
            ).length;
            
            embed.addFields({
                name: '📊 Summary',
                value: `**Total Events:** ${logs.length}\n**Unique Users:** ${uniqueUsers}\n**Total Points:** ${totalPoints}\n**Events with Screenshots:** ${eventsWithScreenshots}`,
                inline: false
            });

            // Add screenshot viewing tip
            if (targetUser && eventsWithScreenshots > 0) {
                embed.addFields({
                    name: '💡 View Screenshots',
                    value: `Use \`/view-screenshots user:${targetUser.username}\` to see submitted screenshots`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ View logs error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve event logs. Please try again later.');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
}

module.exports = HRController;