// commands/my-stats.js - UPDATED with proper permission checking
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const StatsController = require('../controllers/statsController');
const PermissionChecker = require('../utils/permissionChecker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('my-stats')
        .setDescription('View your SWAT performance statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s stats (HR+ only)')
                .setRequired(false))
        .setDMPermission(false),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        if (targetUser) {
            // ===== VIEWING ANOTHER USER'S STATS (HR+ REQUIRED) =====
            if (!PermissionChecker.canViewOtherStats(interaction.member)) {
                const errorMessage = PermissionChecker.getPermissionErrorMessage('hr');
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚫 Access Denied')
                    .setDescription(errorMessage)
                    .addFields({
                        name: '💡 What You Can Do',
                        value: '• Use `/my-stats` (without user option) to view your own stats\n• Contact HR if you need to view someone else\'s performance',
                        inline: false
                    })
                    .setFooter({ text: 'Only HR+ can view other users\' statistics' })
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
            // HR+ viewing another user's stats
            await StatsController.getUserStats(interaction, targetUser);
            
        } else {
            // ===== VIEWING OWN STATS (OPERATOR REQUIRED) =====
            if (!PermissionChecker.canViewOwnStats(interaction.member)) {
                const errorMessage = PermissionChecker.getPermissionErrorMessage('operator');
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚫 Access Denied')
                    .setDescription(errorMessage)
                    .addFields({
                        name: '🎯 Required Role',
                        value: 'You need the **Special Weapons and Tactics** role to view your SWAT statistics.',
                        inline: false
                    })
                    .setFooter({ text: 'Join the SWAT team to track your performance!' })
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
            // Operator viewing own stats
            await StatsController.getPersonalStats(interaction);
        }
    },
};