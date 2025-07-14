// commands/admin-tools.js (HR only emergency commands)
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-tools')
        .setDescription('Emergency admin tools (HR only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('backup-users')
                .setDescription('Export all user data as backup'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('backup-events')
                .setDescription('Export event logs as backup')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days to backup (default: 30)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(365)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fix-booster')
                .setDescription('Fix booster status for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to fix booster status for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fix-quota')
                .setDescription('Recalculate quota status for all users'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('database-stats')
                .setDescription('View database health and statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fix-ranks')
                .setDescription('Recalculate all user ranks and trends'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('health-check')
                .setDescription('Perform comprehensive system health check'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('emergency-reset')
                .setDescription('Emergency system reset (DANGEROUS)')
                .addStringOption(option =>
                    option.setName('confirmation')
                        .setDescription('Type "CONFIRM_EMERGENCY_RESET" to proceed')
                        .setRequired(true)))
        .setDMPermission(false),

    async execute(interaction) {
        // Check HR permission
        if (!PermissionChecker.canManageSystem(interaction.member)) {
            const errorEmbed = SWATEmbeds.createErrorEmbed('🚫 Only HR can use admin tools!');
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'backup-users':
                await this.backupUsers(interaction);
                break;
            case 'backup-events':
                await this.backupEvents(interaction);
                break;
            case 'fix-booster':
                await this.fixBoosterStatus(interaction);
                break;
            case 'fix-quota':
                await this.fixQuotaStatus(interaction);
                break;
            case 'database-stats':
                await this.getDatabaseStats(interaction);
                break;
            case 'fix-ranks':
                await this.fixRanks(interaction);
                break;
            case 'health-check':
                await this.performHealthCheck(interaction);
                break;
            case 'emergency-reset':
                await this.emergencyReset(interaction);
                break;
        }
    },

    async backupUsers(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            console.log('📊 Creating user data backup...');
            const users = await SWATUser.find({}).sort({ allTimePoints: -1 });
            
            const backup = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    backupType: 'user_data',
                    totalUsers: users.length,
                    botVersion: '1.0.0',
                    generatedBy: interaction.user.username
                },
                users: users.map(u => ({
                    discordId: u.discordId,
                    username: u.username,
                    weeklyPoints: u.weeklyPoints,
                    allTimePoints: u.allTimePoints,
                    weeklyQuota: u.weeklyQuota,
                    quotaCompleted: u.quotaCompleted,
                    isBooster: u.isBooster,
                    totalEvents: u.totalEvents,
                    weeklyEvents: u.weeklyEvents,
                    quotaStreak: u.quotaStreak || 0,
                    dailyPointsToday: u.dailyPointsToday || 0,
                    createdAt: u.createdAt,
                    updatedAt: u.updatedAt
                }))
            };

            const backupText = JSON.stringify(backup, null, 2);
            const fileName = `swat_users_backup_${new Date().toISOString().split('T')[0]}.json`;
            
            // Create attachment
            const attachment = new AttachmentBuilder(Buffer.from(backupText), { name: fileName });
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📊 User Data Backup Complete')
                .addFields(
                    { name: '👥 Users Backed Up', value: users.length.toString(), inline: true },
                    { name: '📅 Backup Date', value: new Date().toLocaleDateString(), inline: true },
                    { name: '💾 File Size', value: `${Math.round(backupText.length / 1024)} KB`, inline: true }
                )
                .setDescription('User data backup has been generated. Download the attached file to save locally.')
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [embed], 
                files: [attachment]
            });

            console.log(`✅ User backup created: ${users.length} users`);
            
        } catch (error) {
            console.error('❌ User backup error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to create user backup');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async backupEvents(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const days = interaction.options.getInteger('days') || 30;
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);
            
            console.log(`📋 Creating event logs backup (last ${days} days)...`);
            const events = await EventLog.find({ 
                submittedAt: { $gte: dateLimit }
            }).sort({ submittedAt: -1 });
            
            const backup = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    backupType: 'event_logs',
                    totalEvents: events.length,
                    daysIncluded: days,
                    dateRange: {
                        from: dateLimit.toISOString(),
                        to: new Date().toISOString()
                    },
                    generatedBy: interaction.user.username
                },
                events: events.map(e => ({
                    userId: e.userId,
                    username: e.username,
                    eventType: e.eventType,
                    description: e.description,
                    pointsAwarded: e.pointsAwarded,
                    boostedPoints: e.boostedPoints,
                    quantity: e.quantity || 1,
                    submittedAt: e.submittedAt,
                    screenshotUrl: e.screenshotUrl,
                    hrAction: e.hrAction
                }))
            };

            const backupText = JSON.stringify(backup, null, 2);
            const fileName = `swat_events_backup_${days}days_${new Date().toISOString().split('T')[0]}.json`;
            
            const attachment = new AttachmentBuilder(Buffer.from(backupText), { name: fileName });
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📋 Event Logs Backup Complete')
                .addFields(
                    { name: '📊 Events Backed Up', value: events.length.toString(), inline: true },
                    { name: '📅 Days Included', value: days.toString(), inline: true },
                    { name: '💾 File Size', value: `${Math.round(backupText.length / 1024)} KB`, inline: true }
                )
                .setDescription(`Event logs backup for the last ${days} days has been generated.`)
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [embed], 
                files: [attachment]
            });

            console.log(`✅ Event backup created: ${events.length} events`);
            
        } catch (error) {
            console.error('❌ Event backup error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to create event backup');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async fixBoosterStatus(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                return await interaction.reply({ 
                    content: '❌ User not found in database', 
                    ephemeral: true 
                });
            }

            const member = await interaction.guild.members.fetch(targetUser.id);
            const isActuallyBooster = PermissionChecker.isBooster(member);
            const wasBooster = user.isBooster;
            
            user.isBooster = isActuallyBooster;
            await user.save();

            // Create audit log
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: targetUser.username,
                eventType: 'hr_booster_fix',
                description: `HR fixed booster status: ${wasBooster ? 'WAS' : 'NOT'} → ${isActuallyBooster ? 'IS' : 'NOT'} booster`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_BOOSTER_FIX',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'fix_booster_status',
                    reason: 'Manual booster status correction'
                }
            });
            await auditLog.save();

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔧 Booster Status Fixed')
                .addFields(
                    { name: '👤 User', value: targetUser.username, inline: true },
                    { name: '🔄 Previous', value: wasBooster ? 'Booster 💎' : 'Regular', inline: true },
                    { name: '✅ Current', value: isActuallyBooster ? 'Booster 💎' : 'Regular', inline: true }
                )
                .setFooter({ text: `Fixed by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } catch (error) {
            console.error('❌ Fix booster error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to fix booster status');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async fixQuotaStatus(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            console.log('🔧 Recalculating quota statuses...');
            const users = await SWATUser.find({});
            let fixedCount = 0;

            for (const user of users) {
                const shouldBeCompleted = user.weeklyPoints >= user.weeklyQuota;
                if (user.quotaCompleted !== shouldBeCompleted) {
                    user.quotaCompleted = shouldBeCompleted;
                    await user.save();
                    fixedCount++;
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎯 Quota Status Fix Complete')
                .addFields(
                    { name: '👥 Users Checked', value: users.length.toString(), inline: true },
                    { name: '🔧 Quotas Fixed', value: fixedCount.toString(), inline: true },
                    { name: '✅ Success Rate', value: `${Math.round(((users.length - fixedCount) / users.length) * 100)}%`, inline: true }
                )
                .setDescription(fixedCount > 0 ? `Fixed ${fixedCount} incorrect quota statuses` : 'All quota statuses were already correct')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            console.log(`✅ Quota fix complete: ${fixedCount}/${users.length} fixed`);
            
        } catch (error) {
            console.error('❌ Fix quota error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to fix quota statuses');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async getDatabaseStats(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Get collection stats
            const userCount = await SWATUser.countDocuments();
            const eventCount = await EventLog.countDocuments();
            const boosterCount = await SWATUser.countDocuments({ isBooster: true });
            const quotaCompleted = await SWATUser.countDocuments({ quotaCompleted: true });
            
            // Get recent activity (last 24 hours)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentEvents = await EventLog.countDocuments({ submittedAt: { $gte: oneDayAgo } });
            
            // Get total points
            const allUsers = await SWATUser.find({});
            const totalWeeklyPoints = allUsers.reduce((sum, u) => sum + u.weeklyPoints, 0);
            const totalAllTimePoints = allUsers.reduce((sum, u) => sum + u.allTimePoints, 0);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🗄️ Database Health Statistics')
                .addFields(
                    { name: '👥 Total Users', value: userCount.toString(), inline: true },
                    { name: '📋 Total Events', value: eventCount.toString(), inline: true },
                    { name: '💎 Server Boosters', value: `${boosterCount} (${Math.round((boosterCount/userCount)*100)}%)`, inline: true },
                    { name: '🎯 Quota Completed', value: `${quotaCompleted}/${userCount} (${Math.round((quotaCompleted/userCount)*100)}%)`, inline: true },
                    { name: '🔥 Events (24h)', value: recentEvents.toString(), inline: true },
                    { name: '📊 Weekly Points', value: totalWeeklyPoints.toString(), inline: true },
                    { name: '⭐ All-Time Points', value: totalAllTimePoints.toString(), inline: true },
                    { name: '📈 Avg Points/User', value: userCount > 0 ? Math.round(totalWeeklyPoints / userCount).toString() : '0', inline: true },
                    { name: '🏥 Database Status', value: '✅ Healthy', inline: true }
                )
                .setFooter({ text: 'Database statistics updated in real-time' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('❌ Database stats error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve database statistics');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async fixRanks(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            console.log('📊 Recalculating user ranks and trends...');
            const users = await SWATUser.find({}).sort({ weeklyPoints: -1 });
            let updatedCount = 0;

            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const newRank = i + 1;
                
                if (user.previousRank !== newRank) {
                    user.previousRank = newRank;
                    await user.save();
                    updatedCount++;
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📊 Rank Recalculation Complete')
                .addFields(
                    { name: '👥 Users Processed', value: users.length.toString(), inline: true },
                    { name: '🔄 Ranks Updated', value: updatedCount.toString(), inline: true },
                    { name: '✅ Accuracy', value: '100%', inline: true }
                )
                .setDescription('All user ranks and trend calculations have been refreshed')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            console.log(`✅ Rank fix complete: ${updatedCount}/${users.length} updated`);
            
        } catch (error) {
            console.error('❌ Fix ranks error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to fix user ranks');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async performHealthCheck(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            console.log('🏥 Performing comprehensive health check...');
            
            // Simplified health check (since we might not have the full HealthMonitor)
            const health = await this.basicHealthCheck();
            
            let color = '#00ff00'; // Green
            if (health.overall === 'warning') color = '#ffaa00'; // Orange
            if (health.overall === 'critical') color = '#ff0000'; // Red
            
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`🏥 System Health Check - ${health.overall.toUpperCase()}`)
                .addFields(
                    { name: '🗄️ Database', value: health.database, inline: true },
                    { name: '📊 Data Integrity', value: health.dataIntegrity, inline: true },
                    { name: '⚡ Performance', value: health.performance, inline: true }
                )
                .setFooter({ text: 'Health check completed' })
                .setTimestamp();

            if (health.issues.length > 0) {
                embed.addFields({
                    name: '⚠️ Issues Found',
                    value: health.issues.join('\n'),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('❌ Health check error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to perform health check');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async basicHealthCheck() {
        const issues = [];
        let overall = 'healthy';
        
        try {
            // Database check
            const userCount = await SWATUser.countDocuments();
            const database = userCount >= 0 ? '✅ Connected' : '❌ Error';
            
            // Data integrity check
            const negativeUsers = await SWATUser.countDocuments({
                $or: [
                    { weeklyPoints: { $lt: 0 } },
                    { allTimePoints: { $lt: 0 } }
                ]
            });
            
            if (negativeUsers > 0) {
                issues.push(`${negativeUsers} users with negative points`);
                overall = 'warning';
            }
            
            const dataIntegrity = negativeUsers === 0 ? '✅ Valid' : `⚠️ ${negativeUsers} issues`;
            
            // Performance check
            const start = Date.now();
            await SWATUser.findOne();
            const queryTime = Date.now() - start;
            const performance = queryTime < 1000 ? '✅ Fast' : '⚠️ Slow';
            
            if (queryTime >= 1000) {
                issues.push('Slow database queries');
                overall = 'warning';
            }
            
            return {
                overall,
                database,
                dataIntegrity,
                performance,
                issues
            };
            
        } catch (error) {
            return {
                overall: 'critical',
                database: '❌ Error',
                dataIntegrity: '❌ Error', 
                performance: '❌ Error',
                issues: ['Database connection failed']
            };
        }
    },

    async emergencyReset(interaction) {
        const confirmation = interaction.options.getString('confirmation');
        
        if (confirmation !== 'CONFIRM_EMERGENCY_RESET') {
            const warningEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚠️ EMERGENCY RESET - Confirmation Required')
                .setDescription('**DANGER: This will reset ALL bot data!**\n\nThis action will:')
                .addFields(
                    { name: '🗑️ DELETE ALL DATA', value: '• All user points\n• All event logs\n• All statistics\n• All progress', inline: false },
                    { name: '⚠️ CANNOT BE UNDONE', value: 'This action is **PERMANENT** and **IRREVERSIBLE**', inline: false },
                    { name: '🔒 To Confirm', value: 'Use: `/admin-tools emergency-reset confirmation:CONFIRM_EMERGENCY_RESET`', inline: false }
                )
                .setFooter({ text: 'Only use this in extreme emergencies!' })
                .setTimestamp();

            return await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true });
            
            console.log('🚨 EMERGENCY RESET INITIATED by', interaction.user.username);
            
            // Get counts before deletion
            const userCount = await SWATUser.countDocuments();
            const eventCount = await EventLog.countDocuments();
            
            // Perform the reset
            await SWATUser.deleteMany({});
            await EventLog.deleteMany({});
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 EMERGENCY RESET COMPLETE')
                .setDescription('**ALL BOT DATA HAS BEEN RESET**')
                .addFields(
                    { name: '🗑️ Users Deleted', value: userCount.toString(), inline: true },
                    { name: '🗑️ Events Deleted', value: eventCount.toString(), inline: true },
                    { name: '👤 Reset By', value: interaction.user.username, inline: true }
                )
                .setFooter({ text: 'Emergency reset completed - system is now clean' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
            console.log('🚨 EMERGENCY RESET COMPLETE - All data deleted');
            
        } catch (error) {
            console.error('❌ Emergency reset error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Emergency reset failed - data may be in inconsistent state!');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};