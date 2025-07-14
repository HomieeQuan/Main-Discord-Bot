// commands/booster-admin.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BoosterSync = require('../utils/boosterSync');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('booster-admin')
        .setDescription('Manage server booster synchronization (HR only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync-all')
                .setDescription('Synchronize booster status for all users'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync-user')
                .setDescription('Synchronize booster status for a specific user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to sync booster status for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View booster statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('audit')
                .setDescription('View recent booster status changes'))
        .setDMPermission(false),

    async execute(interaction) {
        // Check HR permission
        if (!PermissionChecker.canManageSystem(interaction.member)) {
            const errorEmbed = SWATEmbeds.createErrorEmbed('Only HR can use booster admin commands!');
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'sync-all':
                await this.syncAllBoosters(interaction);
                break;
            case 'sync-user':
                await this.syncUserBooster(interaction);
                break;
            case 'stats':
                await this.showBoosterStats(interaction);
                break;
            case 'audit':
                await this.showBoosterAudit(interaction);
                break;
        }
    },

    async syncAllBoosters(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const result = await BoosterSync.syncAllBoosterStatuses(interaction.client);
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🔄 Bulk Booster Sync Complete')
                    .addFields(
                        { name: '👥 Users Checked', value: result.totalChecked.toString(), inline: true },
                        { name: '🔄 Updates Made', value: result.updated.toString(), inline: true },
                        { name: '⚠️ Fetch Errors', value: result.errors.toString(), inline: true }
                    )
                    .setTimestamp();

                if (result.changes.length > 0) {
                    const changesText = result.changes
                        .map(change => `• ${change.username}: ${change.change} booster`)
                        .join('\n');
                    
                    embed.addFields({
                        name: '📋 Status Changes',
                        value: changesText,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            } else {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to sync booster statuses');
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        } catch (error) {
            console.error('Sync all boosters error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('An error occurred during bulk sync');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async syncUserBooster(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            const result = await BoosterSync.syncUserBoosterStatus(member);
            
            if (result.changed) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Booster Status Updated')
                    .setDescription(`Updated booster status for ${targetUser.username}`)
                    .addFields(
                        { name: 'Previous Status', value: result.wasBooster ? 'Booster 💎' : 'Regular', inline: true },
                        { name: 'Current Status', value: result.isBooster ? 'Booster 💎' : 'Regular', inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({
                    content: `ℹ️ No booster status change needed for ${targetUser.username}`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Sync user booster error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to sync user booster status');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async showBoosterStats(interaction) {
        try {
            const stats = await BoosterSync.getBoosterStatistics(interaction.client);
            
            if (stats) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6600')
                    .setTitle('💎 Server Booster Statistics')
                    .addFields(
                        { name: '👥 Total Users', value: stats.totalUsers.toString(), inline: true },
                        { name: '💎 Total Boosters', value: stats.totalBoosters.toString(), inline: true },
                        { name: '📊 Booster %', value: `${stats.boosterPercentage}%`, inline: true },
                        { name: '⭐ Booster Points (Weekly)', value: stats.boosterTotalPoints.toString(), inline: true },
                        { name: '📈 Avg Booster Points', value: stats.averageBoosterPoints.toString(), inline: true },
                        { name: '🎯 Booster Advantage', value: '2x Point Multiplier', inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve booster statistics');
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (error) {
            console.error('Booster stats error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('An error occurred retrieving statistics');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async showBoosterAudit(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const EventLog = require('../models/EventLog');
            
            // Get recent booster status changes
            const recentChanges = await EventLog.find({
                eventType: 'booster_status_change'
            })
            .sort({ submittedAt: -1 })
            .limit(10);

            if (recentChanges.length === 0) {
                await interaction.editReply({
                    content: 'ℹ️ No recent booster status changes found'
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📋 Recent Booster Status Changes')
                .setDescription(`Last ${recentChanges.length} booster status changes`)
                .setTimestamp();

            const auditText = recentChanges
                .map(log => {
                    const date = log.submittedAt.toLocaleDateString();
                    const action = log.description.includes('GAINED') ? '🟢 Gained' : '🔴 Lost';
                    return `• **${log.username}** - ${action} booster (${date})`;
                })
                .join('\n');

            embed.addFields({
                name: '🔄 Status Changes',
                value: auditText,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Booster audit error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve booster audit log');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};