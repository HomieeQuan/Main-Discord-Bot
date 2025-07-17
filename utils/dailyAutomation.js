// utils/dailyAutomation.js - FIXED daily automation system focused on rank lock expiry
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const RankSystem = require('./rankSystem');
const PromotionChecker = require('./promotionChecker');
const { EmbedBuilder } = require('discord.js');

class DailyAutomation {
    // 🔧 FIXED: Main daily automation runner - focuses on rank lock expiry notifications
    static async runDailyAutomation(client) {
        try {
            console.log('🤖 Starting daily automation system...');
            
            const results = {
                timestamp: new Date(),
                rankLocksExpired: 0,
                lockNotificationsSent: 0,
                currentlyEligible: 0,
                hrNotificationSent: false,
                errors: []
            };

            // 🔧 PRIMARY FOCUS: Process rank lock expirations and send notifications
            const lockResults = await this.processRankLockExpirations(client);
            results.rankLocksExpired = lockResults.expired;
            results.lockNotificationsSent = lockResults.notified;
            results.errors.push(...lockResults.errors);

            // 🔧 SECONDARY: Get count of currently eligible users (for HR dashboard)
            const eligibilityReport = await PromotionChecker.getEligibilityReport();
            if (eligibilityReport) {
                results.currentlyEligible = eligibilityReport.totalEligible;
            }

            // 🔧 FIXED: Send HR daily summary only if there are rank locks expired or users eligible
            if (results.rankLocksExpired > 0 || results.currentlyEligible > 0) {
                const hrResults = await this.sendHRDailySummary(client, {
                    rankLocksExpired: results.rankLocksExpired,
                    currentlyEligible: results.currentlyEligible,
                    eligibilityReport
                });
                results.hrNotificationSent = hrResults.sent;
                if (hrResults.errors) results.errors.push(...hrResults.errors);
            }

            // Step 4: Log automation results
            await this.logAutomationResults(results);

            console.log('✅ Daily automation completed successfully');
            console.log(`   - Rank locks expired: ${results.rankLocksExpired}`);
            console.log(`   - Lock notifications sent: ${results.lockNotificationsSent}`);
            console.log(`   - Currently eligible users: ${results.currentlyEligible}`);
            console.log(`   - HR notified: ${results.hrNotificationSent}`);

            return results;

        } catch (error) {
            console.error('❌ Daily automation failed:', error);
            await this.logAutomationError(error);
            return null;
        }
    }

    // 🔧 FIXED: Process rank lock expirations with enhanced notifications
    static async processRankLockExpirations(client) {
        try {
            console.log('🔓 Processing rank lock expirations...');

            // Get all users with active rank locks
            const users = await SWATUser.find({
                rankLockUntil: { $exists: true, $ne: null }
            });

            let expired = 0;
            let notified = 0;
            const errors = [];
            const expiredUsers = [];

            const guild = client.guilds.cache.first();
            if (!guild) {
                console.error('❌ No guild found for rank lock processing');
                return { expired: 0, notified: 0, errors: ['No guild found'], expiredUsers: [] };
            }

            for (const user of users) {
                try {
                    const lockStatus = RankSystem.checkRankLockExpiry(user);
                    
                    if (lockStatus.expired && lockStatus.needsNotification) {
                        // 🔧 FIXED: Get server nickname instead of Discord username
                        let displayName = user.username; // Fallback to stored username
                        
                        try {
                            const member = await guild.members.fetch(user.discordId);
                            displayName = member.displayName || member.user.username;
                            
                            // Update stored username with current server nickname
                            if (user.username !== displayName) {
                                user.username = displayName;
                                console.log(`📝 Updated stored nickname: ${user.username} → ${displayName}`);
                            }
                        } catch (fetchError) {
                            console.log(`⚠️ Could not fetch member ${user.username} (may have left server)`);
                        }
                        
                        // Mark as notified to prevent spam
                        user.rankLockNotified = true;
                        await user.save();
                        
                        expired++;
                        expiredUsers.push({
                            ...user.toObject(),
                            displayName
                        });

                        // 🔧 FIXED: Send enhanced rank lock expiry notification
                        try {
                            const discordUser = await client.users.fetch(user.discordId);
                            const eligibility = RankSystem.checkPromotionEligibility(user);
                            const pointsCheck = RankSystem.checkPointRequirements(user);
                            
                            let notificationTitle, notificationDescription, notificationFields = [];
                            
                            if (!eligibility.nextRank) {
                                // User is at maximum rank
                                notificationTitle = '🔓 Rank Lock Expired';
                                notificationDescription = `Your rank lock has expired! You are now at the maximum rank: **${RankSystem.formatRank(user)}**`;
                                notificationFields.push({
                                    name: '👑 Maximum Rank Achieved',
                                    value: 'Continue your excellent service as a leader in the SWAT team!',
                                    inline: false
                                });
                            } else if (RankSystem.isExecutiveOrHigher(eligibility.nextRank.level)) {
                                // Next rank is Executive+ (hand-picked)
                                notificationTitle = '🔓 Rank Lock Expired';
                                notificationDescription = `Your rank lock has expired! Your next potential promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}** is hand-picked by leadership.`;
                                notificationFields.push({
                                    name: '👑 Executive Promotion',
                                    value: 'Executive ranks are hand-picked based on leadership qualities and exceptional service.',
                                    inline: false
                                });
                            } else if (pointsCheck.pointsMet) {
                                // User already has enough points - fully eligible!
                                notificationTitle = '🎉 Rank Lock Expired - You\'re Promotion Eligible!';
                                notificationDescription = `Excellent news! Your rank lock has expired and you already have enough rank points for promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}**!`;
                                notificationFields.push(
                                    {
                                        name: '✅ Requirements Status',
                                        value: `Rank Points: ${pointsCheck.rankPoints}/${pointsCheck.pointsRequired} ✅`,
                                        inline: false
                                    },
                                    {
                                        name: '🎯 You\'re Ready!',
                                        value: 'Contact HR immediately for your promotion review - you\'re fully eligible!',
                                        inline: false
                                    }
                                );
                            } else {
                                // User was locked and still needs more points
                                notificationTitle = '🔓 Rank Lock Expired';
                                notificationDescription = `Your rank lock has expired! You can now work toward promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}**`;
                                notificationFields.push(
                                    {
                                        name: '📈 Point Progress',
                                        value: `You currently have ${pointsCheck.rankPoints}/${pointsCheck.pointsRequired} rank points. You need ${pointsCheck.pointsRequired - pointsCheck.rankPoints} more points for promotion.`,
                                        inline: false
                                    },
                                    {
                                        name: '💡 How to Progress',
                                        value: 'Submit events using `/submit-event` to earn rank points toward your promotion!',
                                        inline: false
                                    }
                                );
                            }

                            const notification = new EmbedBuilder()
                                .setColor('#00ff00')
                                .setTitle(notificationTitle)
                                .setDescription(notificationDescription)
                                .addFields(notificationFields)
                                .setFooter({ 
                                    text: 'Keep up the great work! Submit events to continue your SWAT career progression.' 
                                })
                                .setTimestamp();
                            
                            await discordUser.send({ embeds: [notification] });
                            notified++;
                            
                            console.log(`📱 Sent enhanced rank lock expiry notification to ${displayName}`);
                            
                        } catch (dmError) {
                            console.log(`📱 Could not DM ${displayName} (DMs disabled or user not found)`);
                            // Still count as processed, just couldn't notify
                        }
                    }
                } catch (userError) {
                    console.error(`❌ Error processing rank lock for ${user.username}:`, userError);
                    errors.push(`${user.username}: ${userError.message}`);
                }
            }

            return {
                expired,
                notified,
                errors,
                expiredUsers
            };

        } catch (error) {
            console.error('❌ Rank lock processing error:', error);
            return {
                expired: 0,
                notified: 0,
                errors: [error.message],
                expiredUsers: []
            };
        }
    }

    // 🔧 FIXED: Send HR daily summary with server nicknames
    static async sendHRDailySummary(client, automationData) {
        try {
            console.log('📊 Preparing HR daily summary...');

            const guild = client.guilds.cache.first();
            if (!guild) {
                return { sent: false, errors: ['No guild found'] };
            }

            // Get all members with HR roles (Executive Operator and above)
            const hrRoles = [
                'Executive Operator',
                'Senior Executive Operator',
                'Operations Chief', 
                'Deputy Commander',
                'SWAT Commander'
            ];

            const hrMembers = new Set();
            hrRoles.forEach(roleName => {
                const role = guild.roles.cache.find(r => r.name === roleName);
                if (role) {
                    role.members.forEach(member => hrMembers.add(member));
                }
            });

            if (hrMembers.size === 0) {
                return { sent: false, errors: ['No HR members found'] };
            }

            // 🔧 FIXED: Create HR summary embed with server nicknames
            const summaryEmbed = await this.createHRSummaryEmbed(automationData);
            
            let sentCount = 0;
            const errors = [];

            // Send to each HR member
            for (const member of hrMembers) {
                try {
                    await member.send({ embeds: [summaryEmbed] });
                    sentCount++;
                    console.log(`📊 Sent HR summary to ${member.displayName || member.user.username}`);
                } catch (dmError) {
                    console.log(`📊 Could not DM HR summary to ${member.displayName || member.user.username} (DMs disabled)`);
                    errors.push(`Could not DM ${member.displayName || member.user.username}`);
                }
            }

            return {
                sent: sentCount > 0,
                sentCount,
                errors: errors.length > 0 ? errors : null
            };

        } catch (error) {
            console.error('❌ HR summary error:', error);
            return {
                sent: false,
                errors: [error.message]
            };
        }
    }

    // 🔧 FIXED: Create HR daily summary embed with server nicknames
    static async createHRSummaryEmbed(automationData) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 HR Daily Automation Summary')
            .setDescription('Daily summary of rank lock and promotion management')
            .setTimestamp();

        // Rank lock summary
        if (automationData.rankLocksExpired > 0) {
            embed.addFields({
                name: '🔓 Rank Locks Expired',
                value: `${automationData.rankLocksExpired} users had their rank locks expire today`,
                inline: true
            });
        }

        // Current eligibility summary
        if (automationData.currentlyEligible > 0) {
            embed.addFields({
                name: '🎯 Currently Eligible',
                value: `${automationData.currentlyEligible} user${automationData.currentlyEligible > 1 ? 's' : ''} ready for promotion`,
                inline: true
            });
        }

        // If no activity
        if (automationData.rankLocksExpired === 0 && automationData.currentlyEligible === 0) {
            embed.addFields({
                name: '✅ No Action Required',
                value: 'No rank locks expired and no users are currently eligible for promotion.',
                inline: false
            });
        }

        // 🔧 FIXED: Show currently eligible users with server nicknames
        if (automationData.eligibilityReport && automationData.eligibilityReport.eligibleUsers.length > 0) {
            const eligibleList = automationData.eligibilityReport.eligibleUsers
                .slice(0, 5)
                .map(user => `• **${user.username}** → ${user.nextRank}`) // Uses server nickname from database
                .join('\n');
            
            embed.addFields({
                name: '🎯 Eligible Users',
                value: eligibleList + (automationData.eligibilityReport.eligibleUsers.length > 5 ? `\n... and ${automationData.eligibilityReport.eligibleUsers.length - 5} more` : ''),
                inline: false
            });
        }

        // Add quick actions
        embed.addFields({
            name: '🔧 Quick Actions',
            value: '• `/promote-operator list-eligible` - View all eligible users\n• `/promote-operator review user:[name]` - Review specific user\n• `/promote-operator approve user:[name]` - Approve promotion',
            inline: false
        });

        embed.setFooter({ 
            text: 'This is an automated daily summary. Immediate notifications are sent when users become eligible.' 
        });

        return embed;
    }

    // Log automation results for tracking
    static async logAutomationResults(results) {
        try {
            const logEntry = new EventLog({
                userId: 'SYSTEM',
                username: 'Daily Automation',
                eventType: 'daily_automation',
                description: `Daily automation completed - ${results.rankLocksExpired} locks expired, ${results.lockNotificationsSent} notifications sent, ${results.currentlyEligible} currently eligible`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'SYSTEM_AUTOMATION',
                hrAction: {
                    hrUser: 'SYSTEM',
                    hrUsername: 'Automated System',
                    action: 'daily_automation',
                    reason: 'Scheduled daily automation run',
                    automationResults: {
                        rankLocksExpired: results.rankLocksExpired,
                        lockNotificationsSent: results.lockNotificationsSent,
                        currentlyEligible: results.currentlyEligible,
                        hrNotificationSent: results.hrNotificationSent,
                        errorCount: results.errors.length
                    }
                }
            });

            await logEntry.save();
            console.log('📝 Automation results logged successfully');

        } catch (error) {
            console.error('❌ Failed to log automation results:', error);
        }
    }

    // Log automation errors
    static async logAutomationError(error) {
        try {
            const errorLog = new EventLog({
                userId: 'SYSTEM',
                username: 'Daily Automation ERROR',
                eventType: 'automation_error',
                description: `Daily automation failed: ${error.message}`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'SYSTEM_ERROR',
                hrAction: {
                    hrUser: 'SYSTEM',
                    hrUsername: 'Automated System',
                    action: 'automation_error',
                    reason: 'Daily automation encountered an error',
                    error: error.stack
                }
            });

            await errorLog.save();

        } catch (logError) {
            console.error('❌ Failed to log automation error:', logError);
        }
    }

    // 🔧 FIXED: Manual automation trigger (for testing or emergency runs)
    static async runManualAutomation(client, interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const results = await this.runDailyAutomation(client);

            if (!results) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Automation Failed')
                    .setDescription('Daily automation encountered an error. Check logs for details.')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🤖 Manual Automation Complete')
                .setDescription('Daily automation has been run manually')
                .addFields(
                    {
                        name: '🔓 Rank Locks Processed',
                        value: `${results.rankLocksExpired} expired, ${results.lockNotificationsSent} notified`,
                        inline: true
                    },
                    {
                        name: '🎯 Currently Eligible',
                        value: `${results.currentlyEligible} user${results.currentlyEligible !== 1 ? 's' : ''} ready for promotion`,
                        inline: true
                    },
                    {
                        name: '📊 HR Notification',
                        value: results.hrNotificationSent ? 'Sent' : 'Not needed',
                        inline: true
                    }
                )
                .setFooter({ text: `Triggered by ${interaction.user.username}` })
                .setTimestamp();

            if (results.errors.length > 0) {
                embed.addFields({
                    name: '⚠️ Errors',
                    value: results.errors.slice(0, 3).join('\n') + (results.errors.length > 3 ? '\n... and more' : ''),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Manual automation error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Manual Automation Failed')
                .setDescription(`Error: ${error.message}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    // Get automation statistics for HR dashboard
    static async getAutomationStats() {
        try {
            // Get automation logs from last 7 days
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const automationLogs = await EventLog.find({
                eventType: 'daily_automation',
                submittedAt: { $gte: weekAgo }
            }).sort({ submittedAt: -1 });

            const stats = {
                totalRuns: automationLogs.length,
                totalLocksProcessed: 0,
                totalNotificationsSent: 0,
                totalCurrentlyEligible: 0,
                averageEligible: 0,
                lastRun: automationLogs[0]?.submittedAt || null,
                errorCount: 0
            };

            // Calculate totals
            for (const log of automationLogs) {
                if (log.hrAction?.automationResults) {
                    const results = log.hrAction.automationResults;
                    stats.totalLocksProcessed += results.rankLocksExpired || 0;
                    stats.totalNotificationsSent += results.lockNotificationsSent || 0;
                    stats.totalCurrentlyEligible += results.currentlyEligible || 0;
                    if (results.errorCount > 0) stats.errorCount++;
                }
            }

            if (automationLogs.length > 0) {
                stats.averageEligible = Math.round(stats.totalCurrentlyEligible / automationLogs.length);
            }

            return stats;

        } catch (error) {
            console.error('❌ Automation stats error:', error);
            return null;
        }
    }
}

module.exports = DailyAutomation;