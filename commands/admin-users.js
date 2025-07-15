// commands/admin-users.js - User Management for departed members
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-users')
        .setDescription('Manage SWAT team members (HR only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Permanently delete a departed team member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to delete from system')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for deletion (e.g., "Left team", "Transferred")')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('Clean up inactive users')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Delete users inactive for X days (default: 30)')
                        .setRequired(false)
                        .setMinValue(7)
                        .setMaxValue(180))
                .addBooleanOption(option =>
                    option.setName('preview')
                        .setDescription('Preview who would be deleted (default: true)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list-inactive')
                .setDescription('List users who haven\'t submitted events recently')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Show users inactive for X days (default: 14)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(90)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View user management statistics'))
        .setDMPermission(false),

    async execute(interaction) {
        // Check HR permission
        if (!PermissionChecker.canManageSystem(interaction.member)) {
            const errorEmbed = SWATEmbeds.createErrorEmbed('🚫 Only HR can use user management commands!');
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'delete':
                await this.deleteUser(interaction);
                break;
            case 'cleanup':
                await this.cleanupInactiveUsers(interaction);
                break;
            case 'list-inactive':
                await this.listInactiveUsers(interaction);
                break;
            case 'stats':
                await this.getUserStats(interaction);
                break;
        }
    },

    async deleteUser(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Get user stats before deletion
            const userStats = {
                username: user.username,
                weeklyPoints: user.weeklyPoints,
                allTimePoints: user.allTimePoints,
                totalEvents: user.totalEvents,
                rank: user.rankName,
                joinedAt: user.createdAt
            };

            // Count their event logs
            const eventCount = await EventLog.countDocuments({ userId: targetUser.id });

            // Create final audit log before deletion
            const finalAuditLog = new EventLog({
                userId: targetUser.id,
                username: user.username,
                eventType: 'user_deletion',
                description: `USER DELETED: ${user.username} - Reason: ${reason}`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_USER_DELETION',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'delete_user',
                    reason: reason,
                    deletedUserStats: userStats,
                    eventLogsDeleted: eventCount
                }
            });

            await finalAuditLog.save();

            // DELETE ALL USER DATA
            await EventLog.deleteMany({ userId: targetUser.id });
            await SWATUser.deleteOne({ discordId: targetUser.id });

            // Create confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🗑️ User Deleted Successfully')
                .setDescription(`**${userStats.username}** has been permanently removed from the system`)
                .addFields(
                    { name: '👤 Deleted User', value: userStats.username, inline: true },
                    { name: '📊 Points Lost', value: `${userStats.allTimePoints} all-time`, inline: true },
                    { name: '🎖️ Rank', value: userStats.rank, inline: true },
                    { name: '📋 Events Deleted', value: `${eventCount} events`, inline: true },
                    { name: '📅 Time in System', value: this.getTimeSince(userStats.joinedAt), inline: true },
                    { name: '👤 Deleted By', value: interaction.user.username, inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '⚠️ Important', value: 'This action cannot be undone. All user data has been permanently removed.', inline: false }
                )
                .setFooter({ text: 'Deletion logged in audit trail' })
                .setTimestamp();

            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

            console.log(`🗑️ USER DELETED: ${userStats.username} (${userStats.allTimePoints} pts, ${eventCount} events) by ${interaction.user.username} - Reason: ${reason}`);

        } catch (error) {
            console.error('❌ Delete user error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to delete user. Please try again.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async cleanupInactiveUsers(interaction) {
        const days = interaction.options.getInteger('days') || 30;
        const preview = interaction.options.getBoolean('preview') !== false; // Default true
        
        try {
            await interaction.deferReply({ ephemeral: true });

            // Find users who haven't submitted events in X days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            // Get users who have no recent events
            const recentEventUserIds = await EventLog.distinct('userId', {
                submittedAt: { $gte: cutoffDate },
                eventType: { $nin: ['user_deletion', 'hr_point_adjustment', 'hr_critical_action'] }
            });

            const inactiveUsers = await SWATUser.find({
                discordId: { $nin: recentEventUserIds },
                createdAt: { $lt: cutoffDate } // Don't delete very new users
            });

            if (inactiveUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ No Cleanup Needed')
                    .setDescription(`No users found inactive for ${days}+ days`)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            if (preview) {
                // Show preview of who would be deleted
                const previewText = inactiveUsers.slice(0, 15).map(user => {
                    const lastActive = this.getTimeSince(user.updatedAt);
                    return `• **${user.username}** (${user.allTimePoints} pts) - Last active ${lastActive} ago`;
                }).join('\n');

                const previewEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ Cleanup Preview')
                    .setDescription(`Found ${inactiveUsers.length} users inactive for ${days}+ days`)
                    .addFields({
                        name: '🗑️ Would Delete',
                        value: previewText + (inactiveUsers.length > 15 ? `\n... and ${inactiveUsers.length - 15} more` : ''),
                        inline: false
                    })
                    .addFields({
                        name: '💡 To Execute',
                        value: `Use \`/admin-users cleanup days:${days} preview:false\` to permanently delete these users`,
                        inline: false
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [previewEmbed] });
            } else {
                // Actually delete the users
                let deletedCount = 0;
                const deletedUsers = [];

                for (const user of inactiveUsers) {
                    try {
                        // Create audit log
                        const auditLog = new EventLog({
                            userId: user.discordId,
                            username: user.username,
                            eventType: 'auto_cleanup',
                            description: `AUTO CLEANUP: User deleted for ${days} days inactivity`,
                            pointsAwarded: 0,
                            boostedPoints: false,
                            screenshotUrl: 'AUTO_CLEANUP',
                            hrAction: {
                                hrUser: interaction.user.id,
                                hrUsername: interaction.user.username,
                                action: 'auto_cleanup',
                                reason: `Inactive for ${days}+ days`,
                                inactiveDays: days
                            }
                        });

                        await auditLog.save();

                        // Delete user data
                        await EventLog.deleteMany({ userId: user.discordId });
                        await SWATUser.deleteOne({ discordId: user.discordId });

                        deletedUsers.push(user.username);
                        deletedCount++;

                    } catch (deleteError) {
                        console.error(`❌ Failed to delete user ${user.username}:`, deleteError);
                    }
                }

                const resultEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🗑️ Cleanup Complete')
                    .setDescription(`Deleted ${deletedCount} inactive users`)
                    .addFields({
                        name: '📊 Results',
                        value: `**Deleted:** ${deletedCount}\n**Criteria:** Inactive for ${days}+ days\n**Executed by:** ${interaction.user.username}`,
                        inline: false
                    })
                    .setTimestamp();

                if (deletedUsers.length > 0) {
                    const deletedList = deletedUsers.slice(0, 10).join(', ');
                    result

Embed.addFields({
                        name: '🗑️ Deleted Users',
                        value: deletedList + (deletedUsers.length > 10 ? ` and ${deletedUsers.length - 10} more` : ''),
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [resultEmbed] });

                console.log(`🗑️ AUTO CLEANUP: Deleted ${deletedCount} inactive users (${days}+ days) by ${interaction.user.username}`);
            }

        } catch (error) {
            console.error('❌ Cleanup error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to perform cleanup');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async listInactiveUsers(interaction) {
        const days = interaction.options.getInteger('days') || 14;
        
        try {
            await interaction.deferReply({ ephemeral: true });

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            // Get users who have no recent events
            const recentEventUserIds = await EventLog.distinct('userId', {
                submittedAt: { $gte: cutoffDate },
                eventType: { $nin: ['user_deletion', 'hr_point_adjustment', 'hr_critical_action'] }
            });

            const inactiveUsers = await SWATUser.find({
                discordId: { $nin: recentEventUserIds }
            }).sort({ updatedAt: 1 }); // Oldest first

            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('📋 Inactive Users Report')
                .setDescription(`Users with no events in the last ${days} days`)
                .setTimestamp();

            if (inactiveUsers.length === 0) {
                embed.setDescription(`✅ All users have been active in the last ${days} days!`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const inactiveList = inactiveUsers.slice(0, 20).map(user => {
                const lastActive = this.getTimeSince(user.updatedAt);
                return `• **${user.username}** - Last active ${lastActive} ago (${user.allTimePoints} pts)`;
            }).join('\n');

            embed.addFields({
                name: `⚠️ Inactive Users (${inactiveUsers.length})`,
                value: inactiveList + (inactiveUsers.length > 20 ? `\n... and ${inactiveUsers.length - 20} more` : ''),
                inline: false
            });

            if (inactiveUsers.length > 0) {
                embed.addFields({
                    name: '🔧 Management Options',
                    value: `• Review for LOA status\n• Use \`/admin-users cleanup days:${days}\` to preview bulk deletion\n• Use \`/admin-users delete user:[name]\` for individual removal`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ List inactive error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve inactive users');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async getUserStats(interaction) {
        try {
            const totalUsers = await SWATUser.countDocuments();
            const totalEvents = await EventLog.countDocuments();
            
            // Activity in last 7 days
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const activeLastWeek = await EventLog.distinct('userId', {
                submittedAt: { $gte: weekAgo },
                eventType: { $nin: ['user_deletion', 'hr_point_adjustment'] }
            });

            // Activity in last 30 days
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            const activeLastMonth = await EventLog.distinct('userId', {
                submittedAt: { $gte: monthAgo },
                eventType: { $nin: ['user_deletion', 'hr_point_adjustment'] }
            });

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 User Management Statistics')
                .addFields(
                    { name: '👥 Total Users', value: totalUsers.toString(), inline: true },
                    { name: '📋 Total Events', value: totalEvents.toString(), inline: true },
                    { name: '🔥 Active (7 days)', value: activeLastWeek.length.toString(), inline: true },
                    { name: '📈 Active (30 days)', value: activeLastMonth.length.toString(), inline: true },
                    { name: '📉 Inactive (30+ days)', value: (totalUsers - activeLastMonth.length).toString(), inline: true },
                    { name: '📊 Activity Rate', value: `${Math.round((activeLastWeek.length / totalUsers) * 100)}%`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('❌ User stats error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve user statistics');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    // Helper method
    getTimeSince(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return '1 day';
        if (diffDays < 7) return `${diffDays} days`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
        return `${Math.floor(diffDays / 30)} months`;
    }
};