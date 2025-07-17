// commands/promote-operator.js - FIXED force promotion rank lock bug
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('../utils/permissionChecker');
const RankSystem = require('../utils/rankSystem');
const PromotionChecker = require('../utils/promotionChecker');
const SWATEmbeds = require('../views/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote-operator')
        .setDescription('HR promotion management system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('review')
                .setDescription('Review promotion eligibility for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to review for promotion')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('approve')
                .setDescription('Approve a promotion for an eligible user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to promote')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for promotion')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deny')
                .setDescription('Deny a promotion with reason')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to deny promotion for')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for denial')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list-eligible')
                .setDescription('List all users eligible for promotion'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('force')
                .setDescription('Force promote user to any rank (emergency use)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to force promote')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rank')
                        .setDescription('Target rank name')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Junior Operator', value: 'Junior Operator' },
                            { name: 'Experienced Operator', value: 'Experienced Operator' },
                            { name: 'Senior Operator', value: 'Senior Operator' },
                            { name: 'Specialized Operator', value: 'Specialized Operator' },
                            { name: 'Elite Operator', value: 'Elite Operator' },
                            { name: 'Elite Operator I Class', value: 'Elite Operator I Class' },
                            { name: 'Elite Operator II Class', value: 'Elite Operator II Class' },
                            { name: 'Elite Operator III Class', value: 'Elite Operator III Class' },
                            { name: 'Elite Operator IV Class', value: 'Elite Operator IV Class' },
                            { name: 'Executive Operator', value: 'Executive Operator' },
                            { name: 'Senior Executive Operator', value: 'Senior Executive Operator' },
                            { name: 'Operations Chief', value: 'Operations Chief' },
                            { name: 'Deputy Commander', value: 'Deputy Commander' },
                            { name: 'SWAT Commander', value: 'SWAT Commander' }
                        ))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for force promotion')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bypass-lock')
                .setDescription('Remove rank lock from user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove rank lock from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for bypassing rank lock')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-rank')
                .setDescription('Set initial rank for user (migration tool)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to set rank for')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rank')
                        .setDescription('Rank to set')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Probationary Operator', value: 'Probationary Operator' },
                            { name: 'Junior Operator', value: 'Junior Operator' },
                            { name: 'Experienced Operator', value: 'Experienced Operator' },
                            { name: 'Senior Operator', value: 'Senior Operator' },
                            { name: 'Specialized Operator', value: 'Specialized Operator' },
                            { name: 'Elite Operator', value: 'Elite Operator' },
                            { name: 'Elite Operator I Class', value: 'Elite Operator I Class' },
                            { name: 'Elite Operator II Class', value: 'Elite Operator II Class' },
                            { name: 'Elite Operator III Class', value: 'Elite Operator III Class' },
                            { name: 'Elite Operator IV Class', value: 'Elite Operator IV Class' },
                            { name: 'Executive Operator', value: 'Executive Operator' },
                            { name: 'Senior Executive Operator', value: 'Senior Executive Operator' },
                            { name: 'Operations Chief', value: 'Operations Chief' },
                            { name: 'Deputy Commander', value: 'Deputy Commander' },
                            { name: 'SWAT Commander', value: 'SWAT Commander' }
                        ))
                .addIntegerOption(option =>
                    option.setName('rank-points')
                        .setDescription('Set rank points toward next promotion (optional)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(500)))
        .setDMPermission(false),

    async execute(interaction) {
        // Check HR permission
        if (!PermissionChecker.canManageSystem(interaction.member)) {
            const errorEmbed = SWATEmbeds.createErrorEmbed('🚫 Only HR can use promotion commands!');
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'review':
                await this.reviewPromotion(interaction);
                break;
            case 'approve':
                await this.approvePromotion(interaction);
                break;
            case 'deny':
                await this.denyPromotion(interaction);
                break;
            case 'list-eligible':
                await this.listEligibleUsers(interaction);
                break;
            case 'force':
                await this.forcePromote(interaction);
                break;
            case 'bypass-lock':
                await this.bypassRankLock(interaction);
                break;
            case 'set-rank':
                await this.setUserRank(interaction);
                break;
        }
    },

    async reviewPromotion(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const eligibility = RankSystem.checkPromotionEligibility(user);
            const progress = RankSystem.getRankProgress(user);
            const lockStatus = RankSystem.checkRankLockExpiry(user);
            
            const embed = new EmbedBuilder()
                .setColor(eligibility.eligible ? '#00ff00' : '#ffaa00')
                .setTitle(`🎖️ Promotion Review - ${user.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '🏅 Current Rank', 
                        value: RankSystem.formatRank(user), 
                        inline: true 
                    },
                    { 
                        name: '📊 Performance Stats', 
                        value: `All-Time: ${user.allTimePoints} pts\nWeekly: ${user.weeklyPoints} pts\nTotal Events: ${user.totalEvents}`, 
                        inline: true 
                    }
                );

            // Rank lock status
            if (!lockStatus.expired && lockStatus.daysRemaining) {
                embed.addFields({
                    name: '🔒 Rank Lock Status',
                    value: `Locked for ${lockStatus.daysRemaining} more days`,
                    inline: true
                });
            } else {
                embed.addFields({
                    name: '🔓 Rank Lock Status',
                    value: 'Not locked - available for promotion',
                    inline: true
                });
            }

            // Next rank information
            if (eligibility.nextRank) {
                embed.addFields(
                    { 
                        name: '⬆️ Next Rank', 
                        value: `${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}`, 
                        inline: true 
                    }
                );

                // Promotion requirements
                if (!RankSystem.isExecutiveOrHigher(eligibility.nextRank.level)) {
                    embed.addFields({
                        name: '📈 Rank Progress',
                        value: RankSystem.createRankProgressBar(user),
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: '👑 Executive Rank',
                        value: 'Hand-picked only - no point requirements',
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '👑 Maximum Rank',
                    value: 'User is already at the highest rank',
                    inline: true
                });
            }

            // Eligibility status
            embed.addFields({
                name: '✅ Promotion Status',
                value: eligibility.eligible ? 
                    '**ELIGIBLE** - Ready for promotion!' : 
                    `**NOT ELIGIBLE** - ${eligibility.reason}`,
                inline: false
            });

            // HR Actions
            if (eligibility.eligible) {
                embed.addFields({
                    name: '🔧 HR Actions',
                    value: `\`/promote-operator approve user:${user.username}\`\n\`/promote-operator deny user:${user.username} reason:[reason]\``,
                    inline: false
                });
            } else if (lockStatus.daysRemaining) {
                embed.addFields({
                    name: '🔧 HR Actions',
                    value: `\`/promote-operator bypass-lock user:${user.username} reason:[reason]\` - Remove rank lock`,
                    inline: false
                });
            }

            embed.setFooter({ text: `Reviewed by ${interaction.user.username}` })
                 .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('❌ Review promotion error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to review promotion status.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async approvePromotion(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Standard promotion';
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const eligibility = RankSystem.checkPromotionEligibility(user);
            
            if (!eligibility.eligible) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Promotion Not Approved')
                    .setDescription(`${user.username} is not eligible for promotion.`)
                    .addFields({
                        name: '❌ Reason',
                        value: eligibility.reason,
                        inline: false
                    },
                    {
                        name: '💡 Options',
                        value: `• Use \`review\` to see detailed requirements\n• Use \`force\` to override requirements\n• Use \`bypass-lock\` to remove rank lock`,
                        inline: false
                    });
                
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Process the promotion
            const result = await PromotionChecker.processPromotion(user, interaction.user, 'standard', reason);
            
            if (!result.success) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`Failed to process promotion: ${result.error}`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎉 Promotion Approved!')
                .setDescription(`**${user.username}** has been successfully promoted!`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '📈 Promotion', 
                        value: `${RankSystem.getRankEmoji(result.oldRank.level)} ${result.oldRank.name} → ${RankSystem.getRankEmoji(result.newRank.level)} ${result.newRank.name}`, 
                        inline: false 
                    },
                    { 
                        name: '👤 Approved By', 
                        value: interaction.user.username, 
                        inline: true 
                    },
                    { 
                        name: '📅 Date', 
                        value: new Date().toLocaleDateString(), 
                        inline: true 
                    },
                    { 
                        name: '⭐ Points at Promotion', 
                        value: `Rank: ${result.promotionRecord.rankPointsAtPromotion} | All-Time: ${result.promotionRecord.allTimePointsAtPromotion}`, 
                        inline: true 
                    },
                    { 
                        name: '📝 Reason', 
                        value: reason, 
                        inline: false 
                    }
                );

            // Add rank lock information
            if (result.lockResult.locked) {
                successEmbed.addFields({
                    name: '🔒 Rank Lock Applied',
                    value: `${result.lockResult.lockDays} days until next promotion eligibility`,
                    inline: false
                });
            }

            successEmbed.setFooter({ text: 'Promotion logged in audit trail' })
                        .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });

            // Send notification to user
            try {
                const userNotification = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎉 Congratulations on Your Promotion!')
                    .setDescription(`You have been promoted to **${RankSystem.formatRank(user)}**!`)
                    .addFields(
                        { 
                            name: '🎖️ New Rank', 
                            value: RankSystem.formatRank(user), 
                            inline: true 
                        },
                        { 
                            name: '👤 Approved By', 
                            value: interaction.user.username, 
                            inline: true 
                        }
                    );

                if (result.lockResult.locked) {
                    userNotification.addFields({
                        name: '🔒 Rank Lock',
                        value: `You are rank locked for ${result.lockResult.lockDays} days. Keep earning points toward your next promotion!`,
                        inline: false
                    });
                }

                await targetUser.send({ embeds: [userNotification] });
            } catch (dmError) {
                console.log('📱 Could not DM promotion notification to user (DMs disabled)');
            }

            console.log(`🎖️ PROMOTION APPROVED: ${user.username} promoted to ${result.newRank.name} by ${interaction.user.username}`);

        } catch (error) {
            console.error('❌ Approve promotion error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to approve promotion.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async denyPromotion(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Mark user as not eligible (reset eligibility flag)
            user.promotionEligible = false;
            await user.save();

            // Create audit log
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: user.username,
                eventType: 'promotion_denied',
                description: `PROMOTION DENIED by HR - Reason: ${reason}`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_PROMOTION_DENIAL',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'deny_promotion',
                    reason: reason,
                    currentRank: user.rankName
                }
            });

            await auditLog.save();

            // Create response embed
            const denialEmbed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('❌ Promotion Denied')
                .setDescription(`Promotion denied for **${user.username}**`)
                .addFields(
                    { 
                        name: '👤 User', 
                        value: user.username,
                        inline: true 
                    },
                    { 
                        name: '🎖️ Current Rank', 
                        value: RankSystem.formatRank(user), 
                        inline: true 
                    },
                    { 
                        name: '👤 Denied By', 
                        value: interaction.user.username, 
                        inline: true 
                    },
                    { 
                        name: '📝 Reason', 
                        value: reason, 
                        inline: false 
                    },
                    { 
                        name: 'ℹ️ Note', 
                        value: 'User can be reviewed again when they meet requirements and reapply.', 
                        inline: false 
                    }
                )
                .setFooter({ text: 'Denial logged in audit trail' })
                .setTimestamp();

            await interaction.reply({ embeds: [denialEmbed], ephemeral: true });

            console.log(`❌ PROMOTION DENIED: ${user.username} by ${interaction.user.username} - Reason: ${reason}`);

        } catch (error) {
            console.error('❌ Deny promotion error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to deny promotion.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async listEligibleUsers(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const report = await PromotionChecker.getEligibilityReport();
            
            if (!report || report.totalEligible === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('📋 Promotion Eligible Users')
                    .setDescription('No users are currently eligible for promotion.')
                    .addFields({
                        name: '💡 Tip',
                        value: 'Users become eligible when they meet rank point requirements and are not rank locked.',
                        inline: false
                    });

                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📋 Users Eligible for Promotion')
                .setDescription(`${report.totalEligible} users are ready for promotion`)
                .setTimestamp();

            // Show up to 10 eligible users
            const userList = report.eligibleUsers.slice(0, 10).map(user => {
                const currentRankEmoji = RankSystem.getRankEmoji(RankSystem.getRankByName(user.currentRank).level);
                const nextRankEmoji = RankSystem.getRankEmoji(RankSystem.getRankByName(user.nextRank).level);
                
                return `• **${user.username}**: ${currentRankEmoji} ${user.currentRank} → ${nextRankEmoji} ${user.nextRank}\n  └ Points: ${user.rankPoints} | All-time: ${user.allTimePoints}`;
            }).join('\n\n');

            embed.addFields({
                name: '🎖️ Eligible Users',
                value: userList,
                inline: false
            });

            if (report.totalEligible > 10) {
                embed.addFields({
                    name: '📊 Total',
                    value: `Showing 10 of ${report.totalEligible} eligible users`,
                    inline: false
                });
            }

            // Show breakdown by target rank
            if (Object.keys(report.byRank).length > 0) {
                const rankBreakdown = Object.entries(report.byRank)
                    .map(([rank, count]) => `• ${rank}: ${count} users`)
                    .join('\n');
                
                embed.addFields({
                    name: '📊 By Target Rank',
                    value: rankBreakdown,
                    inline: false
                });
            }

            embed.addFields({
                name: '🔧 HR Actions',
                value: '• `/promote-operator review user:[name]` - Review specific user\n• `/promote-operator approve user:[name]` - Approve promotion\n• `/promote-operator deny user:[name] reason:[reason]` - Deny promotion',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ List eligible users error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve eligible users.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // 🔧 FIXED: Force promotion now properly applies rank locks
    async forcePromote(interaction) {
        const targetUser = interaction.options.getUser('user');
        const targetRankName = interaction.options.getString('rank');
        const reason = interaction.options.getString('reason');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const targetRank = RankSystem.getRankByName(targetRankName);
            const currentRank = RankSystem.getRankByLevel(user.rankLevel);
            
            if (!targetRank) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Invalid rank specified.');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (targetRank.level === user.rankLevel) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('User is already at that rank.');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // 🔧 CRITICAL FIX: Apply rank lock for force promotions
            const oldRank = currentRank;
            user.rankName = targetRank.name;
            user.rankLevel = targetRank.level;
            user.rankPoints = 0; // Reset rank points
            user.promotionEligible = false;
            
            // 🔧 FIXED: Apply proper rank lock instead of setting to null
            const lockResult = RankSystem.applyRankLock(user, targetRank.level);
            console.log(`🔧 Force promotion lock result:`, lockResult);
            
            if (lockResult.locked) {
                user.rankLockUntil = lockResult.lockUntil;
                user.rankLockNotified = false;
                console.log(`🔒 Applied ${lockResult.lockDays} day rank lock until ${lockResult.lockUntil}`);
            } else {
                // Only set to null if the rank truly has no lock (Executive+ ranks)
                user.rankLockUntil = null;
                user.rankLockNotified = false;
                console.log(`🔓 No rank lock applied (Executive+ rank or Probationary)`);
            }

            // Add to promotion history
            user.promotionHistory.push({
                fromRank: {
                    name: oldRank.name,
                    level: oldRank.level
                },
                toRank: {
                    name: targetRank.name,
                    level: targetRank.level
                },
                promotedAt: new Date(),
                promotedBy: {
                    hrUserId: interaction.user.id,
                    hrUsername: interaction.user.username
                },
                promotionType: 'force',
                reason: `FORCE PROMOTION: ${reason}`,
                rankPointsAtPromotion: user.rankPoints,
                allTimePointsAtPromotion: user.allTimePoints,
                // 🔧 FIXED: Include rank lock info in history
                rankLockApplied: lockResult.locked ? {
                    days: lockResult.lockDays,
                    until: lockResult.lockUntil
                } : null
            });

            await user.save();

            // Create audit log
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: user.username,
                eventType: 'force_promotion',
                description: `FORCE PROMOTED: ${oldRank.name} → ${targetRank.name} - ${reason}`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_FORCE_PROMOTION',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'force_promotion',
                    reason: reason,
                    oldRank: oldRank.name,
                    newRank: targetRank.name,
                    // 🔧 FIXED: Log rank lock info
                    rankLockApplied: lockResult.locked ? lockResult.lockDays : 0,
                    rankLockUntil: lockResult.locked ? lockResult.lockUntil : null
                }
            });

            await auditLog.save();

            // Create response embed
            const warningEmbed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('⚠️ Force Promotion Completed')
                .setDescription(`**${user.username}** has been force promoted!`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '🚨 Force Promotion', 
                        value: `${RankSystem.getRankEmoji(oldRank.level)} ${oldRank.name} → ${RankSystem.getRankEmoji(targetRank.level)} ${targetRank.name}`, 
                        inline: false 
                    },
                    { 
                        name: '👤 Force Promoted By', 
                        value: interaction.user.username, 
                        inline: true 
                    },
                    { 
                        name: '📅 Date', 
                        value: new Date().toLocaleDateString(), 
                        inline: true 
                    },
                    { 
                        name: '⭐ Points at Promotion', 
                        value: `All-Time: ${user.allTimePoints}`, 
                        inline: true 
                    },
                    { 
                        name: '📝 Reason', 
                        value: reason, 
                        inline: false 
                    },
                    { 
                        name: '⚠️ Notice', 
                        value: 'This was a force promotion that bypassed normal requirements.', 
                        inline: false 
                    }
                );

            // 🔧 FIXED: Show rank lock status in force promotion response
            if (lockResult.locked) {
                warningEmbed.addFields({
                    name: '🔒 Rank Lock Applied',
                    value: `${lockResult.lockDays} days until next promotion eligibility`,
                    inline: false
                });
            } else {
                warningEmbed.addFields({
                    name: '🔓 Rank Lock Status',
                    value: 'No rank lock (Executive+ rank)',
                    inline: false
                });
            }

            warningEmbed.setFooter({ text: 'Force promotion logged in audit trail' })
                        .setTimestamp();

            await interaction.reply({ embeds: [warningEmbed] });

            console.log(`🚨 FORCE PROMOTION: ${user.username} force promoted from ${oldRank.name} to ${targetRank.name} by ${interaction.user.username} - Lock: ${lockResult.locked ? `${lockResult.lockDays} days` : 'none'}`);

        } catch (error) {
            console.error('❌ Force promotion error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to force promote user.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async bypassRankLock(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const lockStatus = RankSystem.checkRankLockExpiry(user);
            
            if (lockStatus.expired || !user.rankLockUntil) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${user.username} is not currently rank locked.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Remove rank lock
            const daysRemaining = lockStatus.daysRemaining;
            user.rankLockUntil = null;
            user.rankLockNotified = false;
            await user.save();

            // Create audit log
            const auditLog = new EventLog({
                userId: targetUser.id,
                username: user.username,
                eventType: 'rank_lock_bypass',
                description: `RANK LOCK BYPASSED by HR - ${daysRemaining} days remaining - Reason: ${reason}`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_LOCK_BYPASS',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'bypass_rank_lock',
                    reason: reason,
                    daysRemaining: daysRemaining
                }
            });

            await auditLog.save();

            const successEmbed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('🔓 Rank Lock Bypassed')
                .setDescription(`Rank lock removed for **${user.username}**`)
                .addFields(
                    { name: '👤 User', value: user.username, inline: true },
                    { name: '🎖️ Current Rank', value: RankSystem.formatRank(user), inline: true },
                    { name: '⏰ Days Bypassed', value: `${daysRemaining} days`, inline: true },
                    { name: '👤 Bypassed By', value: interaction.user.username, inline: true },
                    { name: '📅 Date', value: new Date().toLocaleDateString(), inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '✅ Status', value: 'User is now available for promotion review.', inline: false }
                )
                .setFooter({ text: 'Lock bypass logged in audit trail' })
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('❌ Bypass rank lock error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to bypass rank lock.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    async setUserRank(interaction) {
        const targetUser = interaction.options.getUser('user');
        const targetRankName = interaction.options.getString('rank');
        const rankPoints = interaction.options.getInteger('rank-points') || 0;
        
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const targetRank = RankSystem.getRankByName(targetRankName);
            const oldRank = RankSystem.getRankByLevel(user.rankLevel);

            user.rankName = targetRank.name;
            user.rankLevel = targetRank.level;
            user.rankPoints = rankPoints;
            user.promotionEligible = false;
            user.rankLockUntil = null;
            user.rankLockNotified = false;

            await user.save();

            const successEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🔧 Rank Set Successfully')
                .setDescription(`Rank updated for **${user.username}**`)
                .addFields(
                    { name: '👤 User', value: user.username, inline: true },
                    { name: '📈 Rank Change', value: `${RankSystem.getRankEmoji(oldRank.level)} ${oldRank.name} → ${RankSystem.getRankEmoji(targetRank.level)} ${targetRank.name}`, inline: false },
                    { name: '📊 Rank Points Set', value: `${rankPoints} points toward next promotion`, inline: true },
                    { name: '👤 Set By', value: interaction.user.username, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('❌ Set user rank error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to set user rank.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};