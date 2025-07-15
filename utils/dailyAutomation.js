// utils/dailyAutomation.js - Complete daily automation system for SWAT promotion management
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const RankSystem = require('./rankSystem');
const PromotionChecker = require('./promotionChecker');
const { EmbedBuilder } = require('discord.js');

class DailyAutomation {
    // Main daily automation runner - call this once per day
    static async runDailyAutomation(client) {
        try {
            console.log('🤖 Starting daily automation system...');
            
            const results = {
                timestamp: new Date(),
                rankLocksExpired: 0,
                notificationsSent: 0,
                newlyEligible: 0,
                totalEligible: 0,
                hrNotificationSent: false,
                errors: []
            };

            // Step 1: Process rank lock expirations and send notifications
            const lockResults = await this.processRankLockExpirations(client);
            results.rankLocksExpired = lockResults.expired;
            results.notificationsSent = lockResults.notified;
            results.errors.push(...lockResults.errors);

            // Step 2: Check for newly eligible users
            const eligibilityResults = await PromotionChecker.checkAllUsersEligibility();
            if (eligibilityResults) {
                results.newlyEligible = eligibilityResults.newlyEligible;
                results.totalEligible = eligibilityResults.totalEligible;
            }

            // Step 3: Send HR daily summary if there are promotions to handle
            if (results.totalEligible > 0 || results.newlyEligible > 0) {
                const hrResults = await this.sendHRDailySummary(client, eligibilityResults);
                results.hrNotificationSent = hrResults.sent;
                if (hrResults.errors) results.errors.push(...hrResults.errors);
            }

            // Step 4: Log automation results
            await this.logAutomationResults(results);

            console.log('✅ Daily automation completed successfully');
            console.log(`   - Rank locks expired: ${results.rankLocksExpired}`);
            console.log(`   - Notifications sent: ${results.notificationsSent}`);
            console.log(`   - Newly eligible: ${results.newlyEligible}`);
            console.log(`   - Total eligible: ${results.totalEligible}`);
            console.log(`   - HR notified: ${results.hrNotificationSent}`);

            return results;

        } catch (error) {
            console.error('❌ Daily automation failed:', error);
            await this.logAutomationError(error);
            return null;
        }
    }

    // Process rank lock expirations and send one-time notifications
    static async processRankLockExpirations(client) {
        try {
            console.log('🔓 Processing rank lock expirations...');

            const users = await SWATUser.find({
                rankLockUntil: { $exists: true, $ne: null }
            });

            let expired = 0;
            let notified = 0;
            const errors = [];
            const expiredUsers = [];

            for (const user of users) {
                try {
                    const lockStatus = RankSystem.checkRankLockExpiry(user);
                    
                    if (lockStatus.expired && lockStatus.needsNotification) {
                        // Mark as notified to prevent spam
                        user.rankLockNotified = true;
                        await user.save();
                        
                        expired++;
                        expiredUsers.push(user);

                        // Send one-time DM notification
                        try {
                            const discordUser = await client.users.fetch(user.discordId);
                            const notification = PromotionChecker.createLockExpiryNotification(user);
                            
                            if (notification) {
                                const embed = new EmbedBuilder()
                                    .setColor(notification.color)
                                    .setTitle(notification.title)
                                    .setDescription(notification.description);
                                
                                if (notification.fields) {
                                    embed.addFields(notification.fields);
                                }
                                
                                await discordUser.send({ embeds: [embed] });
                                notified++;
                                
                                console.log(`📱 Sent rank lock expiry notification to ${user.username}`);
                            }
                        } catch (dmError) {
                            console.log(`📱 Could not DM ${user.username} (DMs disabled or user not found)`);
                            // Still count as processed, just couldn't notify
                        }
                    }
                } catch (userError) {
                    console.error(`❌ Error processing ${user.username}:`, userError);
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

    // Send daily summary to HR about promotions
    static async sendHRDailySummary(client, eligibilityData) {
        try {
            console.log('📊 Preparing HR daily summary...');

            // Find HR channel or users (you'll need to configure this)
            const guild = client.guilds.cache.first();
            if (!guild) {
                return { sent: false, errors: ['No guild found'] };
            }

            // Get all members with HR role
            const hrRole = guild.roles.cache.find(role => role.name === 'HR');
            if (!hrRole) {
                return { sent: false, errors: ['HR role not found'] };
            }

            const hrMembers = hrRole.members;
            if (hrMembers.size === 0) {
                return { sent: false, errors: ['No HR members found'] };
            }

            // Create HR summary embed
            const summaryEmbed = await this.createHRSummaryEmbed(eligibilityData);
            
            let sentCount = 0;
            const errors = [];

            // Send to each HR member
            for (const [userId, member] of hrMembers) {
                try {
                    await member.send({ embeds: [summaryEmbed] });
                    sentCount++;
                    console.log(`📊 Sent HR summary to ${member.user.username}`);
                } catch (dmError) {
                    console.log(`📊 Could not DM HR summary to ${member.user.username} (DMs disabled)`);
                    errors.push(`Could not DM ${member.user.username}`);
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

    // Create HR daily summary embed
    static async createHRSummaryEmbed(eligibilityData) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 HR Daily Promotion Summary')
            .setDescription('Daily summary of promotion management tasks')
            .setTimestamp();

        if (!eligibilityData || eligibilityData.totalEligible === 0) {
            embed.addFields({
                name: '✅ No Action Required',
                value: 'No users are currently eligible for promotion.',
                inline: false
            });
            return embed;
        }

        // Add summary statistics
        embed.addFields(
            {
                name: '📊 Summary',
                value: `**Total Eligible:** ${eligibilityData.totalEligible}\n**Newly Eligible:** ${eligibilityData.newlyEligible}`,
                inline: true
            },
            {
                name: '🔧 Action Required',
                value: `${eligibilityData.totalEligible} promotion${eligibilityData.totalEligible > 1 ? 's' : ''} awaiting HR review`,
                inline: true
            }
        );

        // Add newly eligible users
        if (eligibilityData.newlyEligible > 0 && eligibilityData.eligibleUsers) {
            const newUsers = eligibilityData.eligibleUsers
                .slice(0, 5)
                .map(user => `• **${user.username}** → ${user.nextRank}`)
                .join('\n');
            
            embed.addFields({
                name: '🎯 Newly Eligible Users',
                value: newUsers + (eligibilityData.newlyEligible > 5 ? `\n... and ${eligibilityData.newlyEligible - 5} more` : ''),
                inline: false
            });
        }

        // Add quick actions
        embed.addFields({
            name: '🔧 Quick Actions',
            value: '• `/promote-operator list-eligible` - View all eligible users\n• `/promote-operator review user:[name]` - Review specific user\n• `/promote-operator approve user:[name]` - Approve promotion',
            inline: false
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
                description: `Daily automation completed - ${results.rankLocksExpired} locks expired, ${results.notificationsSent} notifications sent, ${results.newlyEligible} newly eligible`,
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
                        notificationsSent: results.notificationsSent,
                        newlyEligible: results.newlyEligible,
                        totalEligible: results.totalEligible,
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

    // Manual automation trigger (for testing or emergency runs)
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
                        value: `${results.rankLocksExpired} expired, ${results.notificationsSent} notified`,
                        inline: true
                    },
                    {
                        name: '🎯 Promotion Eligibility',
                        value: `${results.newlyEligible} newly eligible, ${results.totalEligible} total eligible`,
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
                totalNewlyEligible: 0,
                averageEligible: 0,
                lastRun: automationLogs[0]?.submittedAt || null,
                errorCount: 0
            };

            // Calculate totals
            for (const log of automationLogs) {
                if (log.hrAction?.automationResults) {
                    const results = log.hrAction.automationResults;
                    stats.totalLocksProcessed += results.rankLocksExpired || 0;
                    stats.totalNotificationsSent += results.notificationsSent || 0;
                    stats.totalNewlyEligible += results.newlyEligible || 0;
                    if (results.errorCount > 0) stats.errorCount++;
                }
            }

            if (automationLogs.length > 0) {
                stats.averageEligible = Math.round(stats.totalNewlyEligible / automationLogs.length);
            }

            return stats;

        } catch (error) {
            console.error('❌ Automation stats error:', error);
            return null;
        }
    }
}

module.exports = DailyAutomation;