// controllers/hrController.js - COMPLETE FILE with point system fixes
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const SWATEmbeds = require('../views/embedBuilder');
const PermissionChecker = require('../utils/permissionChecker');
const QuotaSystem = require('../utils/quotaSystem');
const { EmbedBuilder } = require('discord.js');

class HRController {
    // FIXED: Manage user points - now properly updates rank progression
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
                // Get the target member to access displayName
                const targetMember = await interaction.guild.members.fetch(targetUser.id);
                user = new SWATUser({
                    discordId: targetUser.id,
                    username: targetMember.displayName || targetUser.username
                });
            }

            // Store old values for logging
            const oldWeeklyPoints = user.weeklyPoints;
            const oldAllTimePoints = user.allTimePoints;
            const oldRankPoints = user.rankPoints;
            const oldPromotionEligible = user.promotionEligible;

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
                                value: `• Weekly Points: **${user.weeklyPoints}**\n• All-Time Points: **${user.allTimePoints}**\n• Rank Points: **${user.rankPoints}**\n• Quota Completion Status: **${user.quotaCompleted ? 'Completed' : 'In Progress'}**`, 
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

                // Execute the nuclear option - FIXED: Also reset rank points
                user.weeklyPoints = 0;
                user.allTimePoints = 0;
                user.rankPoints = 0; // FIXED: Also reset rank points
                user.quotaCompleted = false;
                user.promotionEligible = false; // FIXED: Reset promotion eligibility

                await user.save();

                // Create comprehensive audit log for critical action
                const finalAuditLog = new EventLog({
                    userId: targetUser.id,
                    username: user.username,
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
                        newAllTimePoints: 0,
                        oldRankPoints: oldRankPoints, // FIXED: Track rank points
                        newRankPoints: 0
                    }
                });

                await finalAuditLog.save();

                // Create dramatic response embed
                const responseEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚨 ALL POINTS REMOVED')
                    .setDescription(`**ALL POINTS HAVE BEEN REMOVED** from ${user.username}`)
                    .addFields(
                        { name: '👤 Target User', value: user.username, inline: true },
                        { name: '🔧 Action', value: '🚨 REMOVE ALL', inline: true },
                        { name: '💥 Points Removed', value: `${oldWeeklyPoints} weekly\n${oldAllTimePoints} all-time\n${oldRankPoints} rank`, inline: true },
                        { name: '📊 Weekly Points', value: `${oldWeeklyPoints} → **0**`, inline: true },
                        { name: '⭐ All-Time Points', value: `${oldAllTimePoints} → **0**`, inline: true },
                        { name: '🎖️ Rank Points', value: `${oldRankPoints} → **0**`, inline: true },
                        { name: '🎯 Quota Status', value: '✅ → ❌ Reset', inline: true },
                        { name: '🎯 Promotion Status', value: '✅ → ❌ Reset', inline: true },
                        { name: '📝 Reason', value: reason, inline: false },
                        { name: '⚠️ CRITICAL ACTION', value: 'This user has had ALL points removed. This action has been logged for audit purposes and **cannot be undone**.', inline: false }
                    )
                    .setFooter({ text: `Critical action performed by ${interaction.user.username}` })
                    .setTimestamp();

                await interaction.reply({ embeds: [responseEmbed] });

                // Enhanced logging for critical actions
                console.log(`🚨 CRITICAL HR ACTION: ${interaction.user.username} REMOVED ALL POINTS from ${user.username}`);
                console.log(`   - Weekly points removed: ${oldWeeklyPoints}`);
                console.log(`   - All-time points removed: ${oldAllTimePoints}`);
                console.log(`   - Rank points removed: ${oldRankPoints}`);
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

            // FIXED: Update rank points properly for HR adjustments
            const RankSystem = require('../utils/rankSystem');
            if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                // For non-Executive ranks, adjust rank points by the same amount as the adjustment
                if (action === 'add') {
                    user.rankPoints += amount;
                } else if (action === 'remove') {
                    user.rankPoints = Math.max(0, user.rankPoints - amount);
                } else if (action === 'set') {
                    // For set action, calculate the difference and apply to rank points
                    const difference = amount - oldWeeklyPoints;
                    user.rankPoints = Math.max(0, user.rankPoints + difference);
                }
                // Note: remove_all action already handles rank points correctly (sets to 0)
            } else {
                // Executive+ ranks don't track rank points for promotion
                user.rankPoints = 0;
            }

            // FIXED: Update quota status using rank-based quota system
            const currentQuota = QuotaSystem.getUserQuota(user);
            user.weeklyQuota = currentQuota;
            user.quotaCompleted = QuotaSystem.isQuotaCompleted(user);

            // FIXED: Update promotion eligibility after HR point changes
            const eligibilityCheck = RankSystem.checkPromotionEligibility(user);
            user.promotionEligible = eligibilityCheck.eligible;

            // Log promotion eligibility changes
            if (!oldPromotionEligible && eligibilityCheck.eligible) {
                console.log(`🎯 PROMOTION ELIGIBLE: ${user.username} is now eligible for promotion to ${eligibilityCheck.nextRank?.name} (after HR point adjustment)`);
            } else if (oldPromotionEligible && !eligibilityCheck.eligible) {
                console.log(`⚠️ PROMOTION LOST: ${user.username} is no longer eligible (${eligibilityCheck.reason}) (after HR point adjustment)`);
            }

            await user.save();

            // Create audit log entry
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: user.username,
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
                    newAllTimePoints: user.allTimePoints,
                    oldRankPoints: oldRankPoints, // FIXED: Track rank points
                    newRankPoints: user.rankPoints,
                    promotionEligibilityChanged: oldPromotionEligible !== user.promotionEligible
                }
            });

            await auditLog.save();

            // ENHANCED: Create response embed with rank progression info
            const embed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('🛠️ HR Points Management')
                .setDescription(`**${action.charAt(0).toUpperCase() + action.slice(1)}** points for ${user.username}`)
                .addFields(
                    { name: '👤 Target User', value: user.username, inline: true },
                    { name: '🔧 Action', value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                    { name: '💯 Amount', value: amount.toString(), inline: true },
                    { name: '📊 Weekly Points', value: `${oldWeeklyPoints} → ${user.weeklyPoints}`, inline: true },
                    { name: '⭐ All-Time Points', value: `${oldAllTimePoints} → ${user.allTimePoints}`, inline: true },
                    { name: '🎖️ Rank Points', value: `${oldRankPoints} → ${user.rankPoints}`, inline: true },
                    { name: '🎯 Quota Status', value: user.quotaCompleted ? '✅ Completed' : '⏳ In Progress', inline: true },
                    { name: '🎯 Promotion Status', value: user.promotionEligible ? '✅ Eligible' : '❌ Not Eligible', inline: true },
                    { name: '📝 Reason', value: reason, inline: false }
                )
                .setFooter({ text: `Action performed by ${interaction.user.username}` })
                .setTimestamp();

            // Add promotion notification if eligibility changed
            if (!oldPromotionEligible && user.promotionEligible) {
                embed.addFields({
                    name: '🎯 Promotion Update',
                    value: `✅ User is now **ELIGIBLE** for promotion to ${eligibilityCheck.nextRank?.name}!`,
                    inline: false
                });
            } else if (oldPromotionEligible && !user.promotionEligible) {
                embed.addFields({
                    name: '🎯 Promotion Update',
                    value: `❌ User is no longer eligible for promotion (${eligibilityCheck.reason})`,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });

            // Enhanced logging with rank progression tracking
            console.log(`🛠️ HR ACTION: ${interaction.user.username} ${action}ed ${amount} points ${action === 'set' ? 'to' : action === 'add' ? 'to' : 'from'} ${user.username}`);
            console.log(`   - Weekly: ${oldWeeklyPoints} → ${user.weeklyPoints}`);
            console.log(`   - All-time: ${oldAllTimePoints} → ${user.allTimePoints}`);
            console.log(`   - Rank points: ${oldRankPoints} → ${user.rankPoints}`);
            console.log(`   - Promotion eligible: ${oldPromotionEligible} → ${user.promotionEligible}`);
            console.log(`   - Reason: ${reason}`);

        } catch (error) {
            console.error('❌ HR points management error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to manage points. Please try again later.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }

    // UPDATED: Reset weekly statistics with new rank-based quota system
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
                        { 
                            name: '🔄 Reset to Zero', 
                            value: '• Weekly points\n• Weekly events\n• Quota completion status\n• Daily points', 
                            inline: false 
                        },
                        { 
                            name: '🎯 NEW: Update Quotas', 
                            value: '• Recalculate quotas based on current ranks\n• Apply rank-based quota system\n• Update completion status', 
                            inline: false 
                        },
                        { 
                            name: '✅ Keep Unchanged', 
                            value: '• All-time points\n• Total events\n• User profiles\n• Rank progression\n• **Rank points (NOT reset)**', 
                            inline: false 
                        },
                        { 
                            name: '⚠️ Cannot Be Undone', 
                            value: 'This action is **permanent** and cannot be reversed!', 
                            inline: false 
                        },
                        { 
                            name: '🔒 Confirmation Required', 
                            value: 'Use `/reset-week confirm:true` to proceed', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'NEW: Now includes rank-based quota updates! Rank points preserved!' });

                return await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            // Get current stats before reset
            const users = await SWATUser.find({}).sort({ weeklyPoints: -1 });
            const totalUsers = users.length;
            const completedQuota = users.filter(u => u.quotaCompleted).length;
            const topPerformer = users[0];
            const totalWeeklyPoints = users.reduce((sum, u) => sum + u.weeklyPoints, 0);

            // Get quota statistics before reset
            const quotaStats = QuotaSystem.getQuotaStatistics();
            const usersNeedingQuotaUpdate = await QuotaSystem.getUsersNeedingQuotaUpdate();

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
                    { name: '🔧 Quota Updates Needed', value: `${usersNeedingQuotaUpdate.length} users`, inline: true },
                    { name: '🎯 Best Performers', value: users.slice(0, 3).map((u, i) => `${i + 1}. ${u.username} (${u.weeklyPoints} pts)`).join('\n') || 'None', inline: false }
                )
                .setTimestamp();

            // UPDATED: Use new quota system for weekly reset
            console.log('🔄 Applying weekly reset with rank-based quota system...');
            const quotaResetResult = await QuotaSystem.applyWeeklyQuotaReset();

            if (!quotaResetResult.success) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Weekly Reset Failed')
                    .setDescription(`Failed to apply quota reset: ${quotaResetResult.error}`)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Create reset confirmation embed with quota information
            const resetEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔄 Weekly Reset Completed!')
                .setDescription('✅ **Successfully started new quota week with rank-based quotas**')
                .addFields(
                    { name: '📅 Reset Date', value: new Date().toLocaleString(), inline: true },
                    { name: '👥 Users Reset', value: quotaResetResult.usersUpdated.toString(), inline: true },
                    { name: '🎯 Quota System', value: 'Rank-based quotas applied', inline: true },
                    { 
                        name: '📋 What Was Reset', 
                        value: '• Weekly points: 0\n• Weekly events: 0\n• Quota status: In Progress\n• Daily points: 0\n• **NEW**: Quotas updated by rank\n• **PRESERVED**: Rank points & progression', 
                        inline: false 
                    },
                    {
                        name: '🎯 Quota Breakdown',
                        value: [
                            'Probationary (1): 10 pts',
                            'Junior-Senior (2-4): 20 pts', 
                            'Specialized-Elite (5-6): 25 pts',
                            'Elite I-IV (7-10): 30 pts',
                            'Executive+ (11-15): No quota'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: `Reset performed by ${interaction.user.username}` })
                .setTimestamp();

            // Add quota change summary if any users had quota updates
            if (usersNeedingQuotaUpdate.length > 0) {
                const quotaChangeText = usersNeedingQuotaUpdate
                    .slice(0, 5)
                    .map(user => `• ${user.username}: ${user.currentQuota} → ${user.expectedQuota} pts`)
                    .join('\n');
                
                resetEmbed.addFields({
                    name: '🔧 Quota Updates Applied',
                    value: quotaChangeText + (usersNeedingQuotaUpdate.length > 5 ? `\n... and ${usersNeedingQuotaUpdate.length - 5} more` : ''),
                    inline: false
                });
            }

            await interaction.editReply({ 
                content: '✅ **Weekly reset completed successfully with rank-based quotas!**',
                embeds: [summaryEmbed, resetEmbed] 
            });

            // Enhanced logging
            console.log(`🔄 WEEKLY RESET: Performed by ${interaction.user.username}`);
            console.log(`   - Users reset: ${quotaResetResult.usersUpdated}`);
            console.log(`   - Quota updates applied: ${usersNeedingQuotaUpdate.length}`);
            console.log(`   - Quota system: Rank-based quotas now active`);
            console.log(`   - Rank points: PRESERVED (not reset)`);

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