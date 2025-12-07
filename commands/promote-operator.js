// commands/promote-operator.js - Promotion system for SWAT and CMU units
const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
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
                .setName('list-eligible')
                .setDescription('List all users eligible for promotion'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('force')
                .setDescription('Force promote user to specific rank (uses dropdown menu)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to force promote')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for force promotion')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('unit')
                        .setDescription('Unit (defaults to user\'s current unit - SWAT or CMU)')
                        .setRequired(false)
                        .addChoices(
                            { name: '🛡️ SWAT Unit', value: 'SWAT' },
                            { name: '🏥 CMU Unit', value: 'CMU' }
                        )))
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
        .setDMPermission(false),

    async execute(interaction) {
        // Check HR permission
        if (!PermissionChecker.canManagePromotions(interaction.member)) {
            const errorEmbed = SWATEmbeds.createErrorEmbed('Only HR can use promotion commands!');
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
            case 'list-eligible':
                await this.listEligible(interaction);
                break;
            case 'force':
                await this.forcePromotion(interaction);
                break;
            case 'bypass-lock':
                await this.bypassLock(interaction);
                break;
        }
    },

    // Review promotion eligibility
    async reviewPromotion(interaction) {
        const targetUser = interaction.options.getUser('user');

        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });

            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} is not in the database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Check promotion eligibility
            const eligibility = RankSystem.checkPromotionEligibility(user);
            const unit = user.unit || 'SWAT';
            const divisionEmoji = unit === 'CMU' ? '🏥' : '🛡️';

            const embed = new EmbedBuilder()
                .setColor(eligibility.eligible ? '#00ff00' : '#ffaa00')
                .setTitle(`${divisionEmoji} Promotion Review: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    {
                        name: '👤 Current Rank',
                        value: RankSystem.formatRank(user),
                        inline: true
                    },
                    {
                        name: '🏢 Unit',
                        value: `${divisionEmoji} ${unit}`,
                        inline: true
                    }
                );

            if (eligibility.eligible) {
                // User is eligible!
                embed.addFields(
                    {
                        name: '✅ Status',
                        value: '**ELIGIBLE FOR PROMOTION**',
                        inline: false
                    },
                    {
                        name: '⬆️ Next Rank',
                        value: RankSystem.formatRank({ 
                            rankLevel: eligibility.nextRank.level, 
                            rankName: eligibility.nextRank.name,
                            unit 
                        }),
                        inline: true
                    },
                    {
                        name: '📊 Rank Points',
                        value: `${eligibility.requirements.currentPoints}/${eligibility.requirements.pointsRequired} ✅`,
                        inline: true
                    },
                    {
                        name: '💡 Next Steps',
                        value: 'Use `/promote-operator approve` to promote this user.',
                        inline: false
                    }
                );
            } else if (eligibility.rankLocked) {
                // Rank locked
                embed.addFields(
                    {
                        name: '🔒 Status',
                        value: '**RANK LOCKED**',
                        inline: false
                    },
                    {
                        name: '⏰ Lock Expires',
                        value: `<t:${eligibility.discordTimestamp}:R> (${eligibility.lockExpiryFormatted})`,
                        inline: true
                    },
                    {
                        name: '📅 Days Remaining',
                        value: `${eligibility.daysRemaining} days`,
                        inline: true
                    },
                    {
                        name: '💡 Next Steps',
                        value: 'Use `/promote-operator bypass-lock` to remove lock if needed.',
                        inline: false
                    }
                );
            } else if (eligibility.handPickedOnly) {
                // Hand-picked rank
                embed.addFields(
                    {
                        name: '⭐ Status',
                        value: '**HAND-PICKED RANK REQUIRED**',
                        inline: false
                    },
                    {
                        name: '⬆️ Next Rank',
                        value: eligibility.nextRank.name,
                        inline: true
                    },
                    {
                        name: '💡 Next Steps',
                        value: 'Use `/promote-operator force` to hand-pick user for this rank.',
                        inline: false
                    }
                );
            } else if (eligibility.maxRank) {
                // Max rank
                embed.addFields(
                    {
                        name: '👑 Status',
                        value: '**MAXIMUM RANK ACHIEVED**',
                        inline: false
                    },
                    {
                        name: '🏆 Achievement',
                        value: `${targetUser.username} is at the highest rank in ${unit}!`,
                        inline: false
                    }
                );
            } else {
                // Not enough points
                embed.addFields(
                    {
                        name: '⏳ Status',
                        value: '**NOT YET ELIGIBLE**',
                        inline: false
                    },
                    {
                        name: '⬆️ Next Rank',
                        value: RankSystem.formatRank({ 
                            rankLevel: eligibility.nextRank.level, 
                            rankName: eligibility.nextRank.name,
                            unit 
                        }),
                        inline: true
                    },
                    {
                        name: '📊 Progress',
                        value: RankSystem.createRankProgressBar(user),
                        inline: false
                    },
                    {
                        name: '📈 Points Needed',
                        value: `${eligibility.requirements.pointsRemaining} more rank points required`,
                        inline: true
                    }
                );
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('❌ Review promotion error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to review promotion eligibility.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    // Approve a promotion
    async approvePromotion(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Standard promotion';

        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });

            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} is not in the database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Check eligibility
            const eligibility = RankSystem.checkPromotionEligibility(user);
            
            // Allow promotion if:
            // 1. Fully eligible (not locked, has points)
            // 2. Rank locked BUT has enough points (HR can override lock)
            const hasEnoughPoints = eligibility.requirements && eligibility.requirements.met;
            const canPromote = eligibility.eligible || (eligibility.rankLocked && hasEnoughPoints);

            if (!canPromote) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} is not eligible for promotion.\n\n**Reason:** ${eligibility.reason}`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
            // If user is rank-locked, clear the lock during promotion
            if (eligibility.rankLocked) {
                console.log(`🔓 AUTO-BYPASS: Clearing rank lock for ${user.username} during HR-approved promotion`);
                user.rankLockUntil = null;
                user.rankLockNotified = false;
            }

            await interaction.deferReply({ ephemeral: true });

            // Process the promotion
            const result = await PromotionChecker.processPromotion(user, interaction.user, 'standard', reason);

            if (!result.success) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`Promotion failed: ${result.error}`);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Success!
            const unit = user.unit || 'SWAT';
            const divisionEmoji = unit === 'CMU' ? '🏥' : '🛡️';

            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎉 Promotion Approved!')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    {
                        name: '👤 Operator',
                        value: targetUser.username,
                        inline: true
                    },
                    {
                        name: '🏢 Unit',
                        value: `${divisionEmoji} ${unit}`,
                        inline: true
                    },
                    {
                        name: '⬆️ Promotion',
                        value: `${result.oldRank.name} → **${result.newRank.name}**`,
                        inline: false
                    },
                    {
                        name: '📋 Reason',
                        value: reason,
                        inline: false
                    }
                );

            if (result.lockResult.locked) {
                successEmbed.addFields({
                    name: '🔒 Rank Lock Applied',
                    value: `${result.lockResult.lockDays} days (until <t:${Math.floor(result.lockResult.lockUntil.getTime() / 1000)}:R>)`,
                    inline: false
                });
            }
            
            // Note if previous lock was bypassed
            if (eligibility.rankLocked) {
                successEmbed.addFields({
                    name: '🔓 Previous Lock Bypassed',
                    value: 'User was rank-locked but had sufficient points for promotion',
                    inline: false
                });
            }

            successEmbed.setFooter({ text: `Approved by ${interaction.user.username}` });
            successEmbed.setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('❌ Approve promotion error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to approve promotion.');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    // List all eligible users
    async listEligible(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const report = await PromotionChecker.getEligibilityReport();

            if (report.totalEligible === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('📋 Promotion Eligibility Report')
                    .setDescription('No operators are currently eligible for promotion.')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📋 Promotion Eligibility Report')
                .setDescription(`**${report.totalEligible}** operators eligible for promotion`)
                .setTimestamp();

            // Group by target rank
            for (const [rankName, count] of Object.entries(report.byRank)) {
                const usersForRank = report.eligibleUsers.filter(u => u.nextRank === rankName);
                const userList = usersForRank.map(u => {
                    const divisionEmoji = u.unit === 'CMU' ? '🏥' : '🛡️';
                    const lockIndicator = u.isRankLocked ? ' 🔒' : ' ✅';
                    return `${divisionEmoji} **${u.username}**${lockIndicator} (${u.rankPoints} pts)`;
                }).join('\n');

                embed.addFields({
                    name: `⬆️ Ready for ${rankName} (${count})`,
                    value: userList || 'None',
                    inline: false
                });
            }

            embed.setFooter({ text: 'Use /promote-operator approve to process promotions | 🔒 = Rank Locked, ✅ = Ready Now' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ List eligible error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve eligibility report.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // Force promotion with dropdown menu
    async forcePromotion(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const forceUnit = interaction.options.getString('unit'); // Optional unit override

        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });

            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} is not in the database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Use forced division if provided, otherwise use user's current division
            const unit = forceUnit || user.unit || 'SWAT';
            const ranks = RankSystem.getAllRanks(unit);

            // Create dropdown menu with ranks for their unit
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('rank_select')
                .setPlaceholder(`Select rank for ${unit} unit`)
                .addOptions(
                    ranks.map(rank => ({
                        label: rank.name,
                        value: rank.name,
                        description: `Level ${rank.level} • ${rank.pointsRequired} pts required`
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const divisionEmoji = unit === 'CMU' ? '🏥' : '🛡️';

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${divisionEmoji} Force Promotion: Select Rank`)
                .setDescription(`Select the target rank for **${targetUser.username}**\n${forceUnit ? `⚠️ Changing unit to **${unit}**` : `Current unit: **${unit}**`}`)
                .addFields(
                    {
                        name: '👤 Current Rank',
                        value: RankSystem.formatRank(user),
                        inline: true
                    },
                    {
                        name: '📋 Reason',
                        value: reason,
                        inline: true
                    }
                )
                .setFooter({ text: 'This will bypass all requirements and locks' });

            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
                fetchReply: true
            });

            // Wait for selection
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({ content: 'Only the command user can select a rank.', ephemeral: true });
                }

                const selectedRankName = i.values[0];
                const selectedRank = ranks.find(r => r.name === selectedRankName);

                await i.deferUpdate();

                // Force promote to selected rank
                const oldRank = RankSystem.getRankByLevel(user.rankLevel, user.unit || 'SWAT');
                const oldUnit = user.unit || 'SWAT';

                user.rankLevel = selectedRank.level;
                user.rankName = selectedRank.name;
                user.unit = unit; // Update unit if changed
                user.rankPoints = 0;
                user.promotionEligible = false;

                // Apply rank lock if needed
                const lockResult = RankSystem.applyRankLock(user, selectedRank.level);
                if (lockResult.locked) {
                    user.rankLockUntil = lockResult.lockUntil;
                    user.rankLockNotified = false;
                }

                // Add to promotion history
                user.promotionHistory.push({
                    fromRank: { name: oldRank.name, level: oldRank.level },
                    toRank: { name: selectedRank.name, level: selectedRank.level },
                    promotedAt: new Date(),
                    promotedBy: {
                        hrUserId: interaction.user.id,
                        hrUsername: interaction.user.username
                    },
                    promotionType: 'force',
                    reason: reason,
                    rankPointsAtPromotion: user.rankPoints,
                    allTimePointsAtPromotion: user.allTimePoints,
                    rankLockApplied: lockResult.locked ? {
                        days: lockResult.lockDays,
                        until: lockResult.lockUntil
                    } : undefined
                });

                await user.save();

                // Create audit log
                const auditLog = new EventLog({
                    userId: user.discordId,
                    username: user.username,
                    eventType: 'promotion',
                    description: `FORCE PROMOTED: ${oldRank.name} → ${selectedRank.name}`,
                    pointsAwarded: 0,
                    boostedPoints: false,
                    screenshotUrl: 'HR_FORCE_PROMOTION',
                    hrAction: {
                        hrUser: interaction.user.id,
                        hrUsername: interaction.user.username,
                        action: 'force_promotion',
                        reason: reason
                    }
                });

                await auditLog.save();

                // Success embed
                const successEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('⚡ Force Promotion Complete')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .addFields(
                        {
                            name: '👤 Operator',
                            value: targetUser.username,
                            inline: true
                        },
                        {
                            name: '🏢 Unit',
                            value: oldUnit !== unit ? 
                                `${RankSystem.getUnitEmoji(oldUnit)} ${oldUnit} → ${divisionEmoji} ${unit}` :
                                `${divisionEmoji} ${unit}`,
                            inline: true
                        },
                        {
                            name: '⬆️ Promotion',
                            value: `${oldRank.name} → **${selectedRank.name}**`,
                            inline: false
                        },
                        {
                            name: '📋 Reason',
                            value: reason,
                            inline: false
                        }
                    );

                if (lockResult.locked) {
                    successEmbed.addFields({
                        name: '🔒 Rank Lock Applied',
                        value: `${lockResult.lockDays} days`,
                        inline: true
                    });
                }

                successEmbed.setFooter({ text: `Force promoted by ${interaction.user.username}` });
                successEmbed.setTimestamp();

                await i.editReply({ embeds: [successEmbed], components: [] });

                console.log(`⚡ FORCE PROMOTION: ${targetUser.username} promoted from ${oldRank.name} to ${selectedRank.name} by ${interaction.user.username}`);
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: 'Rank selection timed out.', components: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('❌ Force promotion error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to force promote user.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    // Bypass rank lock
    async bypassLock(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });

            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} is not in the database.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (!user.rankLockUntil) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} does not have a rank lock.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const lockExpiry = new Date(user.rankLockUntil);
            const unit = user.unit || 'SWAT';

            // Remove rank lock
            user.rankLockUntil = null;
            user.rankLockNotified = false;
            await user.save();

            // Create audit log
            const auditLog = new EventLog({
                userId: user.discordId,
                username: user.username,
                eventType: 'rank_lock_bypass',
                description: `Rank lock bypassed by HR`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_LOCK_BYPASS',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'bypass_rank_lock',
                    reason: reason
                }
            });

            await auditLog.save();

            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔓 Rank Lock Removed')
                .addFields(
                    {
                        name: '👤 Operator',
                        value: targetUser.username,
                        inline: true
                    },
                    {
                        name: '🏢 Unit',
                        value: unit === 'CMU' ? '🏥 CMU' : '🛡️ SWAT',
                        inline: true
                    },
                    {
                        name: '⏰ Previous Lock',
                        value: `Until <t:${Math.floor(lockExpiry.getTime() / 1000)}:F>`,
                        inline: false
                    },
                    {
                        name: '📋 Reason',
                        value: reason,
                        inline: false
                    }
                )
                .setFooter({ text: `Lock bypassed by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

            console.log(`🔓 Rank lock bypassed for ${targetUser.username} by ${interaction.user.username}`);

        } catch (error) {
            console.error('❌ Bypass lock error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to bypass rank lock.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};