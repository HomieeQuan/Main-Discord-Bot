// commands/automation-admin.js - UPDATED with Commander+ restrictions
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DailyAutomation = require('../utils/dailyAutomation');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automation-admin')
        .setDescription('Manage daily automation system (Commander+ only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('trigger')
                .setDescription('Manually trigger daily automation'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check automation scheduler status'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View automation statistics (last 7 days)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('health')
                .setDescription('Perform system health check'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test-notifications')
                .setDescription('Test notification system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('notify-admins')
                .setDescription('Send notification to all admins about automation usage'))
        .setDMPermission(false),

    async execute(interaction) {
        // ===== NEW: COMMANDER+ PERMISSION CHECK =====
        if (!PermissionChecker.canManageAutomation(interaction.member)) {
            const errorMessage = PermissionChecker.getPermissionErrorMessage('commander');
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Access Denied')
                .setDescription(errorMessage)
                .addFields({
                    name: '⚠️ Why This Restriction?',
                    value: 'Automation controls affect rank locks, promotion notifications, and HR workflows. Only Commanders can manage these critical systems.',
                    inline: false
                })
                .setFooter({ text: 'This ensures system stability and proper promotion management' })
                .setTimestamp();
            
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        // Log Commander+ automation usage
        console.log(`🤖 AUTOMATION ADMIN: ${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)}) used /automation-admin ${subcommand}`);

        // Send admin notification about automation usage
        await this.notifyAdminsOfUsage(interaction, subcommand);

        switch (subcommand) {
            case 'trigger':
                await this.triggerAutomation(interaction);
                break;
            case 'status':
                await this.showSchedulerStatus(interaction);
                break;
            case 'stats':
                await this.showAutomationStats(interaction);
                break;
            case 'health':
                await this.performHealthCheck(interaction);
                break;
            case 'test-notifications':
                await this.testNotifications(interaction);
                break;
            case 'notify-admins':
                await this.manualNotifyAdmins(interaction);
                break;
        }
    },

    // ===== NEW: ADMIN NOTIFICATION SYSTEM =====
    async notifyAdminsOfUsage(interaction, subcommand) {
        try {
            // Only notify for critical actions
            const criticalActions = ['trigger', 'emergency-reset', 'test-notifications'];
            if (!criticalActions.includes(subcommand)) return;

            const guild = interaction.guild;
            const commanderRole = guild.roles.cache.find(role => role.name === 'A | SWAT Commander');
            const adminRole = guild.roles.cache.find(role => role.name === '.');

            if (!commanderRole && !adminRole) return;

            const notificationEmbed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('🚨 Automation Command Usage Alert')
                .setDescription(`**${interaction.user.username}** used a critical automation command`)
                .addFields(
                    { name: '🔧 Command', value: `/automation-admin ${subcommand}`, inline: true },
                    { name: '👤 User', value: interaction.user.username, inline: true },
                    { name: '🎭 Role', value: PermissionChecker.getUserHighestRoleName(interaction.member), inline: true },
                    { name: '📅 Time', value: new Date().toLocaleString(), inline: true },
                    { name: '💡 Why This Alert?', value: 'Critical automation commands affect system-wide operations and promotion workflows.', inline: false }
                )
                .setTimestamp();

            // Send to all Commander+ members
            const adminMembers = new Set();
            if (commanderRole) commanderRole.members.forEach(member => adminMembers.add(member));
            if (adminRole) adminRole.members.forEach(member => adminMembers.add(member));

            let notifiedCount = 0;
            for (const member of adminMembers) {
                // Don't notify the user who ran the command
                if (member.id === interaction.user.id) continue;

                try {
                    await member.send({ embeds: [notificationEmbed] });
                    notifiedCount++;
                } catch (error) {
                    console.log(`📱 Could not notify admin ${member.user.username} (DMs disabled)`);
                }
            }

            console.log(`🔔 Notified ${notifiedCount} admins of automation command usage`);

        } catch (error) {
            console.error('❌ Admin notification error:', error);
        }
    },

    async manualNotifyAdmins(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const result = await this.notifyAdminsOfUsage(interaction, 'manual-notification');
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔔 Admin Notification Sent')
                .setDescription('All available admins have been notified of this automation usage.')
                .addFields({
                    name: '📊 Notification Status',
                    value: 'Manual admin notification triggered successfully',
                    inline: false
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Manual admin notification error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to send admin notifications');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // ===== ENHANCED EXISTING METHODS =====

    async triggerAutomation(interaction) {
        try {
            console.log(`🔧 Manual automation triggered by ${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)})`);
            await DailyAutomation.runManualAutomation(interaction.client, interaction);
        } catch (error) {
            console.error('❌ Manual automation trigger error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to trigger daily automation');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async showSchedulerStatus(interaction) {
        try {
            // Get automation scheduler status from the bot client
            const scheduler = interaction.client.automationScheduler;
            const status = scheduler ? scheduler.getStatus() : {
                isRunning: false,
                nextRun: null,
                hasInterval: false
            };

            const embed = new EmbedBuilder()
                .setColor(status.isRunning ? '#00ff00' : '#ff6600')
                .setTitle('🤖 Daily Automation Scheduler Status')
                .setDescription('Current status of the automated daily tasks system')
                .addFields(
                    {
                        name: '🔄 Scheduler Status',
                        value: status.isRunning ? '✅ Running' : '❌ Stopped',
                        inline: true
                    },
                    {
                        name: '⏰ Next Scheduled Run',
                        value: status.nextRun ? status.nextRun.toLocaleString() : 'Not scheduled',
                        inline: true
                    },
                    {
                        name: '📅 Schedule',
                        value: '6:00 AM daily (server time)',
                        inline: true
                    },
                    {
                        name: '🔧 Interval Active',
                        value: status.hasInterval ? '✅ Yes' : '❌ No',
                        inline: true
                    },
                    {
                        name: '🕐 Server Time',
                        value: new Date().toLocaleString(),
                        inline: true
                    },
                    {
                        name: '⚙️ Bot Uptime',
                        value: this.formatUptime(process.uptime()),
                        inline: true
                    },
                    {
                        name: '👤 Checked By',
                        value: `${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)})`,
                        inline: false
                    }
                )
                .setTimestamp();

            // Add warning if automation is not running
            if (!status.isRunning) {
                embed.addFields({
                    name: '⚠️ Warning',
                    value: 'Daily automation is not running! Rank lock notifications and promotion checks will not occur automatically.',
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '✅ Automated Tasks',
                    value: '• Check rank lock expirations\n• Send lock expiry notifications\n• Check promotion eligibility\n• Send HR daily summaries',
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('❌ Scheduler status error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve scheduler status');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async showAutomationStats(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const stats = await DailyAutomation.getAutomationStats();

            if (!stats) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('No automation statistics available. Automation may not have run yet.');
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Daily Automation Statistics')
                .setDescription('Performance metrics for the last 7 days')
                .addFields(
                    {
                        name: '🤖 Total Automation Runs',
                        value: stats.totalRuns.toString(),
                        inline: true
                    },
                    {
                        name: '🔓 Rank Locks Processed',
                        value: stats.totalLocksProcessed.toString(),
                        inline: true
                    },
                    {
                        name: '📱 Notifications Sent',
                        value: stats.totalNotificationsSent.toString(),
                        inline: true
                    },
                    {
                        name: '🎯 Users Made Eligible',
                        value: stats.totalNewlyEligible.toString(),
                        inline: true
                    },
                    {
                        name: '📈 Average Eligible/Day',
                        value: stats.averageEligible.toString(),
                        inline: true
                    },
                    {
                        name: '❌ Runs with Errors',
                        value: stats.errorCount.toString(),
                        inline: true
                    },
                    {
                        name: '👤 Viewed By',
                        value: `${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)})`,
                        inline: false
                    }
                )
                .setTimestamp();

            // Add last run information
            if (stats.lastRun) {
                const timeSinceLastRun = this.getTimeSince(stats.lastRun);
                embed.addFields({
                    name: '⏰ Last Successful Run',
                    value: `${stats.lastRun.toLocaleString()}\n(${timeSinceLastRun} ago)`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '⚠️ Last Run',
                    value: 'No successful runs recorded',
                    inline: false
                });
            }

            // Add health assessment
            let healthStatus = '✅ Excellent';
            if (stats.errorCount > stats.totalRuns * 0.3) healthStatus = '❌ Poor';
            else if (stats.errorCount > 0) healthStatus = '⚠️ Good';

            embed.addFields({
                name: '🏥 System Health',
                value: healthStatus,
                inline: true
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Automation stats error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve automation statistics');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async performHealthCheck(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const HealthMonitor = require('../utils/healthMonitor');
            const health = await HealthMonitor.performHealthCheck();

            let color = '#00ff00'; // Green
            if (health.overall === 'warning') color = '#ffaa00'; // Orange
            if (health.overall === 'critical') color = '#ff0000'; // Red

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`🏥 System Health Check - ${health.overall.toUpperCase()}`)
                .setDescription('Comprehensive system health assessment')
                .addFields({
                    name: '👤 Health Check By',
                    value: `${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)})`,
                    inline: false
                })
                .setTimestamp();

            if (health.checks) {
                // Database health
                if (health.checks.database) {
                    const dbCheck = health.checks.database;
                    embed.addFields({
                        name: '🗄️ Database Health',
                        value: `Status: ${dbCheck.status === 'healthy' ? '✅' : '❌'} ${dbCheck.status}\n${dbCheck.details ? `Response: ${dbCheck.details.responseTime}` : ''}`,
                        inline: true
                    });
                }

                // Data integrity
                if (health.checks.dataIntegrity) {
                    const integrityCheck = health.checks.dataIntegrity;
                    embed.addFields({
                        name: '🔍 Data Integrity',
                        value: `Status: ${integrityCheck.status === 'healthy' ? '✅' : '⚠️'} ${integrityCheck.status}\n${integrityCheck.details ? `Issues: ${integrityCheck.details.issuesFound}` : ''}`,
                        inline: true
                    });
                }

                // Performance
                if (health.checks.performance) {
                    const perfCheck = health.checks.performance;
                    embed.addFields({
                        name: '⚡ Performance',
                        value: `Status: ${perfCheck.status === 'healthy' ? '✅' : '⚠️'} ${perfCheck.status}\n${perfCheck.details ? `Memory: ${perfCheck.details.memoryUsed}` : ''}`,
                        inline: true
                    });
                }

                // Recent activity
                if (health.checks.activity) {
                    const activityCheck = health.checks.activity;
                    embed.addFields({
                        name: '📊 Recent Activity',
                        value: `Status: ${activityCheck.status === 'healthy' ? '✅' : '⚠️'} ${activityCheck.status}\n${activityCheck.details ? `Events today: ${activityCheck.details.eventsToday}` : ''}`,
                        inline: true
                    });
                }
            }

            // Add recommendations based on health
            if (health.overall !== 'healthy') {
                let recommendations = [];
                if (health.overall === 'critical') {
                    recommendations.push('🚨 Immediate attention required');
                    recommendations.push('📞 Contact system administrator');
                }
                if (health.overall === 'warning') {
                    recommendations.push('⚠️ Monitor system closely');
                    recommendations.push('🔧 Consider maintenance');
                }

                if (recommendations.length > 0) {
                    embed.addFields({
                        name: '💡 Recommendations',
                        value: recommendations.join('\n'),
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '✅ System Status',
                    value: 'All systems operating normally',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Health check error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Health check failed - system may be experiencing issues');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async testNotifications(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📱 Notification System Test')
                .setDescription('Testing notification delivery to HR team...')
                .addFields({
                    name: '👤 Test By',
                    value: `${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)})`,
                    inline: false
                })
                .setTimestamp();

            // Try to send test notification to HR members
            const guild = interaction.guild;
            const hrRoles = [
                guild.roles.cache.find(role => role.name === 'Executive Operator'),
                guild.roles.cache.find(role => role.name === 'Senior Executive Operator'),
                guild.roles.cache.find(role => role.name === 'A | Chief of Operations'),
                guild.roles.cache.find(role => role.name === 'A | Deputy Commander'),
                guild.roles.cache.find(role => role.name === 'A | SWAT Commander')
            ].filter(role => role); // Remove null values

            if (hrRoles.length === 0) {
                embed.setColor('#ff0000')
                     .setDescription('❌ No HR roles found in server!')
                     .addFields({
                         name: 'Error',
                         value: 'Cannot test notifications without HR roles configured',
                         inline: false
                     });
                
                return await interaction.editReply({ embeds: [embed] });
            }

            const hrMembers = new Set();
            hrRoles.forEach(role => {
                role.members.forEach(member => hrMembers.add(member));
            });

            if (hrMembers.size === 0) {
                embed.setColor('#ffaa00')
                     .setDescription('⚠️ No members found with HR roles!')
                     .addFields({
                         name: 'Warning',
                         value: 'HR roles exist but no members have these roles',
                         inline: false
                     });
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Send test notification
            const testEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🧪 Notification System Test')
                .setDescription('This is a test notification from the SWAT bot automation system.')
                .addFields({
                    name: '✅ Test Successful',
                    value: 'If you received this message, notifications are working correctly.',
                    inline: false
                })
                .setFooter({ text: `Test initiated by ${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)})` })
                .setTimestamp();

            let successCount = 0;
            let failCount = 0;
            const results = [];

            for (const member of hrMembers) {
                try {
                    await member.send({ embeds: [testEmbed] });
                    successCount++;
                    results.push(`✅ ${member.user.username}`);
                } catch (dmError) {
                    failCount++;
                    results.push(`❌ ${member.user.username} (DMs disabled)`);
                }
            }

            // Update response with results
            embed.setDescription('📱 Notification test completed!')
                 .addFields(
                     {
                         name: '📊 Results',
                         value: `**Successful:** ${successCount}\n**Failed:** ${failCount}\n**Total HR Members:** ${hrMembers.size}`,
                         inline: true
                     },
                     {
                         name: '📋 Delivery Status',
                         value: results.join('\n'),
                         inline: false
                     }
                 );

            if (failCount > 0) {
                embed.addFields({
                    name: '💡 Note',
                    value: 'Failed deliveries are usually due to users having DMs disabled. This is normal and expected.',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Notification test error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Notification test failed');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // Helper functions
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },

    getTimeSince(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHours > 0) return `${diffHours}h ${diffMinutes}m`;
        return `${diffMinutes}m`;
    }
};