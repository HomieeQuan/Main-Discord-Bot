// commands/quota-progress.js - UPDATED: Filters out inactive users
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SWATUser = require('../models/SWATUser');
const PermissionChecker = require('../utils/permissionChecker');
const RankSystem = require('../utils/rankSystem');
const QuotaSystem = require('../utils/quotaSystem');
const ProgressBarGenerator = require('../utils/progressBar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quota-progress')
        .setDescription('View weekly quota progress for all operators')
        .addBooleanOption(option =>
            option.setName('show-incomplete')
                .setDescription('Show only users who haven\'t completed quota')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('show-completed')
                .setDescription('Show only users who completed quota')
                .setRequired(false))
        .setDMPermission(false),

    async execute(interaction) {
        try {
            // Add permission check - operators can view
            if (!PermissionChecker.canViewLeaderboard(interaction.member)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚫 Access Denied')
                    .setDescription('You need the **Special Weapons and Tactics** role to view quota progress!')
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            const showIncomplete = interaction.options.getBoolean('show-incomplete');
            const showCompleted = interaction.options.getBoolean('show-completed');

            console.log(`📊 Quota progress requested by ${interaction.user.username}`);

            // UPDATED: Get all ACTIVE users with activity this week
            let users = await SWATUser.find({
                active: { $ne: false }, // Only active users (filters out deleted)
                $or: [
                    { weeklyPoints: { $gt: 0 } },
                    { quotaCompleted: true }
                ]
            }).sort({ quotaCompleted: -1, weeklyPoints: -1 });

            // Apply filters
            if (showIncomplete) {
                users = users.filter(u => !u.quotaCompleted);
            } else if (showCompleted) {
                users = users.filter(u => u.quotaCompleted);
            }

            if (users.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('📊 Weekly Quota Progress')
                    .setDescription('No active operators found with activity this week.')
                    .addFields({
                        name: '💡 Tip',
                        value: 'Use `/submit-event` to start earning points toward your quota!',
                        inline: false
                    })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [emptyEmbed] });
            }

            // Create quota progress embed
            const embed = await this.createQuotaProgressEmbed(users, showIncomplete, showCompleted);

            await interaction.editReply({ embeds: [embed] });

            console.log(`✅ Quota progress shown: ${users.length} active users displayed`);

        } catch (error) {
            console.error('❌ Quota progress error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('Failed to retrieve quota progress. Please try again.')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async createQuotaProgressEmbed(users, showIncomplete, showCompleted) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Weekly Quota Progress')
            .setTimestamp();

        // Calculate statistics
        const totalUsers = users.length;
        const completedCount = users.filter(u => u.quotaCompleted).length;
        const completionRate = Math.round((completedCount / totalUsers) * 100);
        const totalPoints = users.reduce((sum, u) => sum + u.weeklyPoints, 0);
        const avgPoints = totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;

        // Set description based on filter
        let description = `Showing ${totalUsers} active operator${totalUsers !== 1 ? 's' : ''}`;
        if (showIncomplete) {
            description += ' who haven\'t completed quota';
        } else if (showCompleted) {
            description += ' who completed quota';
        } else {
            description += ` • ${completionRate}% completion rate`;
        }
        embed.setDescription(description);

        // Add summary stats
        if (!showIncomplete && !showCompleted) {
            embed.addFields({
                name: '📈 Weekly Summary',
                value: `✅ Completed: ${completedCount}/${totalUsers}\n📊 Total Points: ${totalPoints}\n⭐ Average: ${avgPoints} pts/operator`,
                inline: false
            });
        }

        // Group users into completed and incomplete
        const completed = users.filter(u => u.quotaCompleted);
        const incomplete = users.filter(u => !u.quotaCompleted);

        // Display ALL completed users (with field splitting for Discord limits)
        if ((!showIncomplete && completed.length > 0) || showCompleted) {
            this.addUsersToEmbed(embed, completed, '✅ Quota Completed', true);
        }

        // Display ALL incomplete users (with field splitting for Discord limits)
        if ((!showCompleted && incomplete.length > 0) || showIncomplete) {
            this.addUsersToEmbed(embed, incomplete, '⏳ In Progress', false);
        }

        // Add legend
        embed.addFields({
            name: '📋 Status Legend',
            value: '✅ Completed  •  ⚠️ 75%+  •  ⏳ 50-74%  •  ❌ Below 50%',
            inline: false
        });

        // Add filter tips
        if (!showIncomplete && !showCompleted) {
            embed.setFooter({ 
                text: 'Use show-incomplete:true or show-completed:true to filter results' 
            });
        } else {
            embed.setFooter({ 
                text: `Showing ${showIncomplete ? 'incomplete' : 'completed'} users only • Active roster` 
            });
        }

        return embed;
    },

    // Helper method to add users to embed with field splitting
    addUsersToEmbed(embed, users, titlePrefix, isCompleted) {
        if (users.length === 0) return;

        const allLines = [];
        
        // Generate all user lines
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            // Show emoji for supervisor+ ranks (levels 6-10)
            const rankEmoji = RankSystem.isSupervisorOrHigher(user.rankLevel) ? 
                `${RankSystem.getRankEmoji(user.rankLevel, user.unit || 'SWAT')} ` : '';
            
            if (isCompleted) {
                // Completed users
                const correctQuota = QuotaSystem.getUserQuota(user);
                const bonus = user.weeklyPoints > correctQuota ? 
                    ` (+${user.weeklyPoints - correctQuota})` : '';
                const progressBar = ProgressBarGenerator.createMiniProgressBar(user.weeklyPoints, correctQuota, 10);
                allLines.push(`${rankEmoji}**${user.username}**\n${progressBar} ${user.weeklyPoints}/${correctQuota} pts${bonus}`);
            } else {
                // Incomplete users
                const correctQuota = QuotaSystem.getUserQuota(user);
                const percentage = Math.round((user.weeklyPoints / correctQuota) * 100);
                const remaining = correctQuota - user.weeklyPoints;
                
                // Color coding for status
                let status = '⏳';
                if (percentage >= 75) status = '⚠️';
                else if (percentage < 50) status = '❌';
                
                const progressBar = ProgressBarGenerator.createMiniProgressBar(user.weeklyPoints, correctQuota, 10);
                allLines.push(`${status} ${rankEmoji}**${user.username}**\n${progressBar} ${user.weeklyPoints}/${correctQuota} pts (${percentage}%) - ${remaining} needed`);
            }
        }

        // Split into multiple fields if needed (respecting 1024 char limit)
        const maxLength = 1000; // Safe limit
        let currentField = [];
        let currentLength = 0;
        let fieldIndex = 1;

        for (let i = 0; i < allLines.length; i++) {
            const line = allLines[i];
            const lineLength = line.length + 2; // +2 for \n\n

            // If adding this line would exceed limit, create a field
            if (currentLength + lineLength > maxLength && currentField.length > 0) {
                // Only show title on first field
                const fieldName = fieldIndex === 1 ? 
                    `${titlePrefix} (${users.length})` : 
                    '\u200B'; // Invisible character for continuation fields
                
                embed.addFields({
                    name: fieldName,
                    value: currentField.join('\n\n'),
                    inline: false
                });

                // Reset for next field
                currentField = [line];
                currentLength = lineLength;
                fieldIndex++;
            } else {
                currentField.push(line);
                currentLength += lineLength;
            }
        }

        // Add remaining lines
        if (currentField.length > 0) {
            // Only show title on first field
            const fieldName = fieldIndex === 1 ? 
                `${titlePrefix} (${users.length})` : 
                '\u200B'; // Invisible character for continuation fields
            
            embed.addFields({
                name: fieldName,
                value: currentField.join('\n\n'),
                inline: false
            });
        }
    }
};