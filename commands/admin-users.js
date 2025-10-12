// commands/admin-users.js - UPDATED with soft delete (preserves all-time points)
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
                .setDescription('Remove user from active roster (keeps all-time points)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove from active roster')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for removal (e.g., "Left team", "Transferred")')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('confirm')
                        .setDescription('Confirm deletion')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restore a deleted user to active roster')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to restore')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('Remove inactive users (keeps all-time points)')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Remove users inactive for X days (default: 30)')
                        .setRequired(false)
                        .setMinValue(7)
                        .setMaxValue(180))
                .addBooleanOption(option =>
                    option.setName('preview')
                        .setDescription('Preview who would be removed (default: true)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bulk-delete-left')
                .setDescription('Remove all users who left the server')
                .addBooleanOption(option =>
                    option.setName('dry-run')
                        .setDescription('Preview without removing (default: true)')
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
                .setName('list-deleted')
                .setDescription('List all deleted users'))
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
            case 'restore':
                await this.restoreUser(interaction);
                break;
            case 'cleanup':
                await this.cleanupInactiveUsers(interaction);
                break;
            case 'bulk-delete-left':
                await this.bulkDeleteLeftServer(interaction);
                break;
            case 'list-inactive':
                await this.listInactiveUsers(interaction);
                break;
            case 'list-deleted':
                await this.listDeletedUsers(interaction);
                break;
            case 'stats':
                await this.getUserStats(interaction);
                break;
        }
    },

    // SOFT DELETE: Keeps all-time points, removes from active roster
    async deleteUser(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const confirm = interaction.options.getBoolean('confirm');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (!user.active) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${user.username} has already been deleted.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Get user stats before deletion
            const userStats = {
                username: user.username,
                weeklyPoints: user.weeklyPoints,
                allTimePoints: user.allTimePoints,
                rankPoints: user.rankPoints,
                totalEvents: user.totalEvents,
                rank: user.rankName,
                rankLevel: user.rankLevel
            };

            // Show confirmation if not confirmed
            if (!confirm) {
                const confirmEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ Confirm User Deletion')
                    .setDescription(`**Are you sure you want to delete ${userStats.username} from the active roster?**`)
                    .addFields(
                        {
                            name: '👤 User Info',
                            value: `**Username:** ${userStats.username}\n**Rank:** ${userStats.rank}\n**Events:** ${userStats.totalEvents}`,
                            inline: false
                        },
                        {
                            name: '📊 Points',
                            value: `**Weekly:** ${userStats.weeklyPoints}\n**All-Time:** ${userStats.allTimePoints}\n**Rank Points:** ${userStats.rankPoints}`,
                            inline: false
                        },
                        {
                            name: '✅ What Will Be KEPT',
                            value: `• **All-Time Points** (${userStats.allTimePoints} pts - visible on all-time leaderboard)\n• **Event History** (complete record)\n• **User record** (marked inactive)`,
                            inline: false
                        },
                        {
                            name: '❌ What Will Be RESET',
                            value: '• Weekly points → 0\n• Rank → Probationary\n• Rank points → 0\n• Quota → Reset\n• Removed from active roster',
                            inline: false
                        },
                        {
                            name: '📝 Reason',
                            value: reason,
                            inline: false
                        },
                        {
                            name: '🔒 To Confirm',
                            value: 'Use `/admin-users delete user:@user reason:"..." confirm:true`',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Soft delete - all-time points remain on leaderboard' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
            }

            // SOFT DELETE: Mark as inactive and reset progression
            user.active = false;
            user.deletedAt = new Date();
            user.deletedBy = interaction.user.username;
            user.deletionReason = reason;
            
            // Reset progression but KEEP all-time points and total events
            user.weeklyPoints = 0;
            user.rankPoints = 0;
            user.rankLevel = 1;
            user.rankName = 'Probationary Operator';
            user.quotaCompleted = false;
            user.weeklyQuota = 10;
            user.weeklyEvents = 0;
            user.promotionEligible = false;
            
            // KEEP: allTimePoints, totalEvents, event logs
            
            await user.save();

            // Create audit log
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: user.username,
                eventType: 'user_soft_deleted',
                description: `USER SOFT DELETED: ${user.username} - All-time points preserved: ${userStats.allTimePoints} - Reason: ${reason}`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_SOFT_DELETE',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'soft_delete_user',
                    reason: reason,
                    statsBeforeDeletion: userStats
                }
            });

            await auditLog.save();

            // Success response
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🗑️ User Removed from Active Roster')
                .setDescription(`**${userStats.username}** has been removed from the active roster`)
                .addFields(
                    { name: '👤 Deleted User', value: userStats.username, inline: true },
                    { name: '🎖️ Former Rank', value: userStats.rank, inline: true },
                    { name: '👤 Deleted By', value: interaction.user.username, inline: true },
                    {
                        name: '✅ All-Time Points Preserved',
                        value: `**${userStats.allTimePoints} points** - Still visible on all-time leaderboard`,
                        inline: false
                    },
                    {
                        name: '❌ Reset Stats',
                        value: `Weekly: ${userStats.weeklyPoints} → 0\nRank: ${userStats.rank} → Probationary\nRank Points: ${userStats.rankPoints} → 0`,
                        inline: false
                    },
                    { name: '📝 Reason', value: reason, inline: false },
                    {
                        name: '💡 Restoration',
                        value: 'Use `/admin-users restore user:@user` to reactivate them with their all-time points intact.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Soft delete - user can be restored at any time' })
                .setTimestamp();

            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

            console.log(`🗑️ USER SOFT DELETED: ${userStats.username} by ${interaction.user.username}`);
            console.log(`   ✅ All-time points KEPT: ${userStats.allTimePoints}`);
            console.log(`   ❌ Progression reset, removed from active roster`);
            console.log(`   📝 Reason: ${reason}`);

        } catch (error) {
            console.error('❌ Delete user error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to delete user. Please try again.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    // RESTORE: Bring deleted user back to active roster
    async restoreUser(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (user.active) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${user.username} is already active.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Restore to active status
            const deletedInfo = {
                deletedAt: user.deletedAt,
                deletedBy: user.deletedBy,
                deletionReason: user.deletionReason
            };

            user.active = true;
            user.deletedAt = null;
            user.deletedBy = null;
            user.deletionReason = null;
            
            // Keep all-time points, they start fresh with weekly/rank
            await user.save();

            // Create audit log
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: user.username,
                eventType: 'user_restored',
                description: `USER RESTORED: ${user.username} - All-time points: ${user.allTimePoints}`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_RESTORE',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'restore_user',
                    reason: 'User restored to active roster',
                    previousDeletion: deletedInfo
                }
            });

            await auditLog.save();

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ User Restored to Active Roster')
                .addFields(
                    { name: '👤 Restored User', value: user.username, inline: true },
                    { name: '⭐ All-Time Points', value: user.allTimePoints.toString(), inline: true },
                    { name: '👤 Restored By', value: interaction.user.username, inline: true },
                    {
                        name: '✅ Status',
                        value: `${user.username} is now back on the active roster with **${user.allTimePoints} all-time points** intact!\n\nThey will start fresh with weekly points and quota.`,
                        inline: false
                    },
                    {
                        name: '📝 Previous Deletion',
                        value: `Deleted: ${deletedInfo.deletedAt ? deletedInfo.deletedAt.toLocaleDateString() : 'Unknown'}\nBy: ${deletedInfo.deletedBy || 'Unknown'}\nReason: ${deletedInfo.deletionReason || 'None'}`,
                        inline: false
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

            console.log(`♻️ USER RESTORED: ${user.username} by ${interaction.user.username}`);
            console.log(`   ✅ All-time points: ${user.allTimePoints}`);

        } catch (error) {
            console.error('❌ Restore user error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to restore user.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    // CLEANUP: Soft delete inactive users
    async cleanupInactiveUsers(interaction) {
        const days = interaction.options.getInteger('days') || 30;
        const preview = interaction.options.getBoolean('preview') !== false; // Default true
        
        try {
            await interaction.deferReply({ ephemeral: true });

            console.log(`🧹 Cleanup inactive users (${days} days) - Preview: ${preview} - By: ${interaction.user.username}`);

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            // Get users who have no recent events
            const recentEventUserIds = await EventLog.distinct('userId', {
                submittedAt: { $gte: cutoffDate },
                eventType: { $nin: ['user_deletion', 'user_deleted', 'user_soft_deleted', 'hr_point_adjustment', 'hr_critical_action', 'auto_cleanup'] }
            });

            const inactiveUsers = await SWATUser.find({
                active: { $ne: false }, // Only active users
                discordId: { $nin: recentEventUserIds },
                createdAt: { $lt: cutoffDate }
            }).sort({ allTimePoints: -1 });

            if (inactiveUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ No Cleanup Needed')
                    .setDescription(`No active users found inactive for ${days}+ days`)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            const totalAllTimePoints = inactiveUsers.reduce((sum, user) => sum + (user.allTimePoints || 0), 0);
            const highValueUsers = inactiveUsers.filter(u => u.allTimePoints >= 50);

            if (preview) {
                const previewEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ Inactive Users Cleanup Preview')
                    .setDescription(`Found **${inactiveUsers.length}** users inactive for **${days}+ days**`)
                    .setTimestamp();

                previewEmbed.addFields({
                    name: '📊 Cleanup Summary',
                    value: [
                        `**Users to Remove:** ${inactiveUsers.length}`,
                        `**High-Value Users (50+ pts):** ${highValueUsers.length} ⚠️`,
                        `**Total All-Time Points:** ${totalAllTimePoints}`,
                        `**Inactivity Period:** ${days}+ days`
                    ].join('\n'),
                    inline: false
                });

                if (highValueUsers.length > 0) {
                    const highValueList = highValueUsers.slice(0, 10).map(user => {
                        const lastActive = this.getTimeSince(user.updatedAt);
                        return `⚠️ **${user.username}** - ${user.allTimePoints} pts - ${user.rankName} - Last: ${lastActive} ago`;
                    }).join('\n');

                    previewEmbed.addFields({
                        name: `⚠️ High-Value Inactive (${highValueUsers.length})`,
                        value: highValueList + (highValueUsers.length > 10 ? `\n... and ${highValueUsers.length - 10} more` : ''),
                        inline: false
                    });
                }

                const regularInactive = inactiveUsers.filter(u => u.allTimePoints < 50);
                if (regularInactive.length > 0) {
                    const regularList = regularInactive.slice(0, 10).map(user => {
                        const lastActive = this.getTimeSince(user.updatedAt);
                        return `📉 **${user.username}** - ${user.allTimePoints} pts - Last: ${lastActive} ago`;
                    }).join('\n');

                    previewEmbed.addFields({
                        name: `📉 Standard Inactive (${regularInactive.length})`,
                        value: regularList + (regularInactive.length > 10 ? `\n... and ${regularInactive.length - 10} more` : ''),
                        inline: false
                    });
                }

                previewEmbed.addFields(
                    {
                        name: '✅ Will Be KEPT',
                        value: `• All-time points (${totalAllTimePoints} pts)\n• Event history\n• User records (marked inactive)\n• Visible on all-time leaderboard`,
                        inline: true
                    },
                    {
                        name: '❌ Will Be RESET',
                        value: '• Weekly points\n• Rank progression\n• Quota status\n• Removed from active roster',
                        inline: true
                    },
                    {
                        name: '🔒 To Execute',
                        value: `/admin-users cleanup days:${days} preview:false`,
                        inline: false
                    }
                );

                previewEmbed.setFooter({ text: 'Preview Mode - No users will be affected' });

                await interaction.editReply({ embeds: [previewEmbed] });

            } else {
                // EXECUTE CLEANUP
                console.log(`🗑️ EXECUTING CLEANUP: Soft deleting ${inactiveUsers.length} inactive users...`);

                let deletedCount = 0;
                let errorCount = 0;
                const deletedUsers = [];

                for (const user of inactiveUsers) {
                    try {
                        // Soft delete
                        user.active = false;
                        user.deletedAt = new Date();
                        user.deletedBy = interaction.user.username;
                        user.deletionReason = `Auto-cleanup: Inactive for ${days}+ days`;
                        
                        // Reset progression, keep all-time points
                        const preservedPoints = user.allTimePoints;
                        user.weeklyPoints = 0;
                        user.rankPoints = 0;
                        user.rankLevel = 1;
                        user.rankName = 'Probationary Operator';
                        user.quotaCompleted = false;
                        user.weeklyQuota = 10;
                        user.weeklyEvents = 0;
                        user.promotionEligible = false;

                        await user.save();

                        // Create audit log
                        const auditLog = new EventLog({
                            userId: user.discordId,
                            username: user.username,
                            eventType: 'auto_cleanup',
                            description: `AUTO CLEANUP: User soft deleted for ${days} days inactivity - All-time points preserved: ${preservedPoints}`,
                            pointsAwarded: 0,
                            boostedPoints: false,
                            screenshotUrl: 'AUTO_CLEANUP',
                            hrAction: {
                                hrUser: interaction.user.id,
                                hrUsername: interaction.user.username,
                                action: 'auto_cleanup_soft_delete',
                                reason: `Inactive for ${days}+ days`,
                                inactiveDays: days,
                                allTimePointsPreserved: preservedPoints
                            }
                        });

                        await auditLog.save();

                        deletedUsers.push({
                            username: user.username,
                            allTimePoints: preservedPoints,
                            highValue: preservedPoints >= 50
                        });
                        deletedCount++;

                        console.log(`   ✅ Soft deleted ${user.username} (${preservedPoints} all-time pts preserved)`);

                    } catch (deleteError) {
                        console.error(`   ❌ Failed to delete ${user.username}:`, deleteError);
                        errorCount++;
                    }
                }

                const resultEmbed = new EmbedBuilder()
                    .setColor(errorCount > 0 ? '#ffaa00' : '#00ff00')
                    .setTitle('🗑️ Cleanup Complete!')
                    .setDescription(`Successfully removed **${deletedCount}** inactive users from active roster`)
                    .setTimestamp();

                resultEmbed.addFields({
                    name: '📊 Results',
                    value: [
                        `**Removed from Active:** ${deletedCount}`,
                        `**Errors:** ${errorCount}`,
                        `**Criteria:** Inactive ${days}+ days`,
                        `**Executed By:** ${interaction.user.username}`
                    ].join('\n'),
                    inline: false
                });

                resultEmbed.addFields({
                    name: '✅ All-Time Points Preserved',
                    value: `**${totalAllTimePoints} total points** still visible on all-time leaderboard`,
                    inline: false
                });

                const highValueDeleted = deletedUsers.filter(u => u.highValue);
                if (highValueDeleted.length > 0) {
                    const list = highValueDeleted.slice(0, 10).map(u => 
                        `⚠️ **${u.username}** - ${u.allTimePoints} pts`
                    ).join('\n');

                    resultEmbed.addFields({
                        name: `⚠️ High-Value Users (${highValueDeleted.length})`,
                        value: list + (highValueDeleted.length > 10 ? `\n... and ${highValueDeleted.length - 10} more` : ''),
                        inline: false
                    });
                }

                resultEmbed.setFooter({ text: 'Soft delete - all users can be restored with /admin-users restore' });

                await interaction.editReply({ embeds: [resultEmbed] });

                console.log(`✅ CLEANUP COMPLETE: ${deletedCount} users soft deleted, ${totalAllTimePoints} all-time pts preserved`);
            }

        } catch (error) {
            console.error('❌ Cleanup error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed(`Failed: ${error.message}`);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // BULK DELETE users who left server
    async bulkDeleteLeftServer(interaction) {
        const dryRun = interaction.options.getBoolean('dry-run') !== false;
        
        try {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const allUsers = await SWATUser.find({ active: { $ne: false } }); // Only check active users
            
            const usersLeftServer = [];
            const usersStillInServer = [];
            
            for (const user of allUsers) {
                try {
                    await guild.members.fetch(user.discordId);
                    usersStillInServer.push(user);
                } catch (error) {
                    usersLeftServer.push(user);
                }
            }

            if (usersLeftServer.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ All Users Still in Server')
                    .setDescription('No active users found who have left the server!')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            const totalAllTimePoints = usersLeftServer.reduce((sum, user) => sum + (user.allTimePoints || 0), 0);

            if (dryRun) {
                const previewList = usersLeftServer.slice(0, 20).map(user => 
                    `• **${user.username}** - ${user.allTimePoints} all-time pts (${user.rankName})`
                ).join('\n');

                const embed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('🔍 Dry Run - Preview Only')
                    .setDescription(`Found **${usersLeftServer.length}** users who left the server`)
                    .addFields(
                        {
                            name: '📊 Summary',
                            value: `**Would Remove:** ${usersLeftServer.length}\n**Staying:** ${usersStillInServer.length}\n**All-Time Points:** ${totalAllTimePoints}`,
                            inline: false
                        },
                        {
                            name: '👥 Users Who Left',
                            value: previewList + (usersLeftServer.length > 20 ? `\n... and ${usersLeftServer.length - 20} more` : ''),
                            inline: false
                        },
                        {
                            name: '✅ Will Be Kept',
                            value: '• All-time points\n• Event history\n• Visible on all-time leaderboard',
                            inline: true
                        },
                        {
                            name: '❌ Will Be Reset',
                            value: '• Weekly points\n• Rank progression\n• Active status',
                            inline: true
                        },
                        {
                            name: '💡 To Execute',
                            value: '/admin-users bulk-delete-left dry-run:false',
                            inline: false
                        }
                    )
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            // EXECUTE
            let deletedCount = 0;
            const deletedUsers = [];

            for (const user of usersLeftServer) {
                try {
                    const preservedPoints = user.allTimePoints;
                    
                    user.active = false;
                    user.deletedAt = new Date();
                    user.deletedBy = interaction.user.username;
                    user.deletionReason = 'Left server';
                    
                    user.weeklyPoints = 0;
                    user.rankPoints = 0;
                    user.rankLevel = 1;
                    user.rankName = 'Probationary Operator';
                    user.quotaCompleted = false;
                    user.weeklyQuota = 10;
                    user.weeklyEvents = 0;
                    user.promotionEligible = false;

                    await user.save();

                    const auditLog = new EventLog({
                        userId: user.discordId,
                        username: user.username,
                        eventType: 'bulk_left_server_deletion',
                        description: `BULK DELETE: User left server - All-time points preserved: ${preservedPoints}`,
                        pointsAwarded: 0,
                        boostedPoints: false,
                        screenshotUrl: 'BULK_LEFT_SERVER',
                        hrAction: {
                            hrUser: interaction.user.id,
                            hrUsername: interaction.user.username,
                            action: 'bulk_delete_left_server',
                            reason: 'User no longer in server',
                            allTimePointsPreserved: preservedPoints
                        }
                    });

                    await auditLog.save();

                    deletedUsers.push({
                        username: user.username,
                        allTimePoints: preservedPoints
                    });
                    deletedCount++;

                } catch (error) {
                    console.error(`❌ Failed to delete ${user.username}:`, error);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Bulk Removal Complete')
                .addFields(
                    { name: '✅ Removed', value: deletedCount.toString(), inline: true },
                    { name: '📊 Remaining', value: usersStillInServer.length.toString(), inline: true },
                    { name: '👤 By', value: interaction.user.username, inline: true },
                    {
                        name: '✅ All-Time Points Preserved',
                        value: `**${totalAllTimePoints} points** still visible on all-time leaderboard`,
                        inline: false
                    }
                )
                .setTimestamp();

            if (deletedUsers.length > 0) {
                const list = deletedUsers.slice(0, 15).map(u => 
                    `• ${u.username} (${u.allTimePoints} pts)`
                ).join('\n');
                
                embed.addFields({
                    name: '🗑️ Removed Users',
                    value: list + (deletedUsers.length > 15 ? `\n... and ${deletedUsers.length - 15} more` : ''),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            console.log(`✅ BULK DELETE: ${deletedCount} users soft deleted, ${totalAllTimePoints} all-time pts preserved`);

        } catch (error) {
            console.error('❌ Bulk delete error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed(`Failed: ${error.message}`);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // LIST inactive users
    async listInactiveUsers(interaction) {
        const days = interaction.options.getInteger('days') || 14;
        
        try {
            await interaction.deferReply({ ephemeral: true });

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const recentEventUserIds = await EventLog.distinct('userId', {
                submittedAt: { $gte: cutoffDate },
                eventType: { $nin: ['user_deletion', 'user_deleted', 'user_soft_deleted', 'hr_point_adjustment', 'hr_critical_action', 'auto_cleanup'] }
            });

            const inactiveUsers = await SWATUser.find({
                active: { $ne: false }, // Only active users
                discordId: { $nin: recentEventUserIds }
            }).sort({ allTimePoints: -1 });

            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('📋 Inactive Users Report')
                .setDescription(`Active users with no events in the last **${days} days**`)
                .setTimestamp();

            if (inactiveUsers.length === 0) {
                embed.setColor('#00ff00');
                embed.setDescription(`✅ All active users have been active in the last ${days} days!`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const totalAllTimePoints = inactiveUsers.reduce((sum, user) => sum + (user.allTimePoints || 0), 0);
            const highValueUsers = inactiveUsers.filter(u => u.allTimePoints >= 50);

            const inactiveList = inactiveUsers.slice(0, 20).map(user => {
                const lastActive = this.getTimeSince(user.updatedAt);
                const statusIcon = user.allTimePoints >= 50 ? '⚠️' : '📉';
                return `${statusIcon} **${user.username}** - ${user.allTimePoints} all-time pts - Last active ${lastActive} ago`;
            }).join('\n');

            embed.addFields(
                {
                    name: `⚠️ Inactive Users (${inactiveUsers.length})`,
                    value: inactiveList + (inactiveUsers.length > 20 ? `\n... and ${inactiveUsers.length - 20} more` : ''),
                    inline: false
                },
                {
                    name: '📊 Stats',
                    value: `**Total All-Time Points:** ${totalAllTimePoints}\n**High-Value (50+ pts):** ${highValueUsers.length}`,
                    inline: false
                },
                {
                    name: '🔧 Actions',
                    value: [
                        `• \`/admin-users delete user:@user\` - Remove individual`,
                        `• \`/admin-users cleanup days:${days}\` - Preview bulk removal`,
                        `• \`/admin-users bulk-delete-left\` - Remove users who left`,
                        '',
                        '**Note:** All removals preserve all-time points'
                    ].join('\n'),
                    inline: false
                }
            );

            if (highValueUsers.length > 0) {
                embed.addFields({
                    name: '⚠️ High-Value Warning',
                    value: `${highValueUsers.length} user${highValueUsers.length !== 1 ? 's' : ''} with 50+ all-time points - review before deletion`,
                    inline: false
                });
            }

            embed.setFooter({ text: `Inactive ${days}+ days • All-time points always preserved` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ List inactive error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve inactive users');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // NEW: List deleted users
    async listDeletedUsers(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const deletedUsers = await SWATUser.find({ active: false }).sort({ deletedAt: -1 });

            const embed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('🗑️ Deleted Users')
                .setTimestamp();

            if (deletedUsers.length === 0) {
                embed.setDescription('✅ No deleted users found');
                return await interaction.editReply({ embeds: [embed] });
            }

            const totalAllTimePoints = deletedUsers.reduce((sum, user) => sum + (user.allTimePoints || 0), 0);

            embed.setDescription(`Found **${deletedUsers.length}** deleted users`);

            embed.addFields({
                name: '📊 Summary',
                value: `**Total Deleted:** ${deletedUsers.length}\n**Total All-Time Points:** ${totalAllTimePoints}`,
                inline: false
            });

            const deletedList = deletedUsers.slice(0, 20).map(user => {
                const deletedWhen = user.deletedAt ? this.getTimeSince(user.deletedAt) : 'Unknown';
                return `• **${user.username}** - ${user.allTimePoints} pts - Deleted ${deletedWhen} ago`;
            }).join('\n');

            embed.addFields({
                name: '🗑️ Deleted Users',
                value: deletedList + (deletedUsers.length > 20 ? `\n... and ${deletedUsers.length - 20} more` : ''),
                inline: false
            });

            embed.addFields({
                name: '♻️ Restoration',
                value: 'Use `/admin-users restore user:@user` to reactivate any deleted user',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ List deleted error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve deleted users');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // User stats
    async getUserStats(interaction) {
        try {
            const totalUsers = await SWATUser.countDocuments({ active: { $ne: false } });
            const deletedUsers = await SWATUser.countDocuments({ active: false });
            const totalEvents = await EventLog.countDocuments();
            
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const activeLastWeek = await EventLog.distinct('userId', {
                submittedAt: { $gte: weekAgo },
                eventType: { $nin: ['user_deletion', 'user_deleted', 'user_soft_deleted', 'hr_point_adjustment'] }
            });

            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            const activeLastMonth = await EventLog.distinct('userId', {
                submittedAt: { $gte: monthAgo },
                eventType: { $nin: ['user_deletion', 'user_deleted', 'user_soft_deleted', 'hr_point_adjustment'] }
            });

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 User Management Statistics')
                .addFields(
                    { name: '👥 Active Users', value: totalUsers.toString(), inline: true },
                    { name: '🗑️ Deleted Users', value: deletedUsers.toString(), inline: true },
                    { name: '📋 Total Events', value: totalEvents.toString(), inline: true },
                    { name: '🔥 Active (7 days)', value: activeLastWeek.length.toString(), inline: true },
                    { name: '📈 Active (30 days)', value: activeLastMonth.length.toString(), inline: true },
                    { name: '📊 Activity Rate', value: `${Math.round((activeLastWeek.length / totalUsers) * 100)}%`, inline: true }
                )
                .setFooter({ text: 'Soft delete system - all-time points always preserved' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('❌ User stats error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve user statistics');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    // Helper
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