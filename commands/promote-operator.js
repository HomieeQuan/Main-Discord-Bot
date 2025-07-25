// commands/promote-operator.js - FIXED force promotion permissions to allow HR+ instead of Commander+ only
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
                .setDescription('🔧 FIXED: Force promote user (HR+ can now use this)')
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
        // Check HR permission for all promotion commands
        if (!PermissionChecker.canManageSystem(interaction.member)) {
            const errorEmbed = SWATEmbeds.createErrorEmbed('🚫 Only HR can use promotion commands!');
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        // 🔧 ISSUE #5 FIX: Force promotion now has separate permission check
        if (subcommand === 'force') {
            // Check specific force promotion permission (now allows HR+)
            if (!PermissionChecker.canForcePromotions(interaction.member)) {
                const errorMessage = PermissionChecker.getPermissionErrorMessage('hr');
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚫 Force Promotion Access Denied')
                    .setDescription(errorMessage)
                    .addFields({
                        name: '🎯 Required Permission Level',
                        value: '**HR | Executive Operator** or higher role required for force promotions',
                        inline: false
                    })
                    .addFields({
                        name: '✅ What Changed',
                        value: 'Force promotions are now available to all HR+ roles (previously Commander+ only)',
                        inline: false
                    })
                    .setFooter({ text: 'This change allows HR team flexibility in promotion management' })
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }

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
                    value: `\`/promote-operator bypass-lock user:${user.username} reason:[reason]\` - Remove rank lock\n\`/promote-operator force user:${user.username} rank:[rank] reason:[reason]\` - Force promote (HR+)`,
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
                        value: `• Use \`review\` to see detailed requirements\n• Use \`force\` to override requirements (HR+)\n• Use \`bypass-lock\` to remove rank lock`,
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
    
            console.log('🔍 DEBUG: Starting listEligibleUsers function');
            
            const report = await PromotionChecker.getEligibilityReport();
            
            console.log('📊 DEBUG: Eligibility report:', {
                reportExists: !!report,
                totalEligible: report?.totalEligible || 0,
                usersArrayLength: report?.eligibleUsers?.length || 0
            });
            
            if (!report || report.totalEligible === 0) {
                console.log('⚠️ DEBUG: No eligible users found');
                
                const embed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('📋 Promotion Eligible Users')
                    .setDescription('No users are currently eligible for promotion.')
                    .addFields({
                        name: '💡 Tip',
                        value: 'Users become eligible when they meet rank point requirements and are not rank locked.',
                        inline: false
                    })
                    .addFields({
                        name: '🔧 Debug Info',
                        value: `Report exists: ${!!report}\nTotal eligible: ${report?.totalEligible || 0}`,
                        inline: false
                    });
    
                return await interaction.editReply({ embeds: [embed] });
            }
    
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📋 Users Eligible for Promotion')
                .setDescription(`${report.totalEligible} users are ready for promotion`)
                .setTimestamp();
    
            // Enhanced user list generation with comprehensive error handling
            if (report.eligibleUsers && report.eligibleUsers.length > 0) {
                console.log('✅ DEBUG: Processing eligible users:', report.eligibleUsers.map(u => u.username));
                
                // Show up to 10 eligible users with robust error handling
                const userListArray = [];
                
                for (let i = 0; i < Math.min(10, report.eligibleUsers.length); i++) {
                    const user = report.eligibleUsers[i];
                    
                    try {
                        // Validate user object
                        if (!user || !user.username) {
                            console.error(`❌ DEBUG: Invalid user object at index ${i}:`, user);
                            userListArray.push(`• **[Invalid User ${i}]**: Missing user data`);
                            continue;
                        }
                        
                        // Validate rank data
                        if (!user.currentRank || !user.nextRank) {
                            console.error(`❌ DEBUG: Missing rank data for ${user.username}:`, {
                                currentRank: user.currentRank,
                                nextRank: user.nextRank
                            });
                            userListArray.push(`• **${user.username}**: Missing rank data - contact admin`);
                            continue;
                        }
                        
                        // Try to get rank objects
                        const currentRank = RankSystem.getRankByName(user.currentRank);
                        const nextRank = RankSystem.getRankByName(user.nextRank);
                        
                        if (!currentRank || !nextRank) {
                            console.error(`❌ DEBUG: Invalid rank names for ${user.username}:`, {
                                currentRankName: user.currentRank,
                                nextRankName: user.nextRank,
                                currentRankFound: !!currentRank,
                                nextRankFound: !!nextRank
                            });
                            
                            // Show basic info without emojis
                            userListArray.push(`• **${user.username}**: ${user.currentRank} → ${user.nextRank}\n  └ Points: ${user.rankPoints || 0} | All-time: ${user.allTimePoints || 0}`);
                            continue;
                        }
                        
                        // Get emojis safely
                        const currentRankEmoji = RankSystem.getRankEmoji(currentRank.level) || '';
                        const nextRankEmoji = RankSystem.getRankEmoji(nextRank.level) || '';
                        
                        // Create user line with full formatting
                        const userLine = `• **${user.username}**: ${currentRankEmoji} ${user.currentRank} → ${nextRankEmoji} ${user.nextRank}\n  └ Points: ${user.rankPoints || 0} | All-time: ${user.allTimePoints || 0}`;
                        userListArray.push(userLine);
                        
                        console.log(`✅ DEBUG: Successfully processed ${user.username}`);
                        
                    } catch (userError) {
                        console.error(`❌ DEBUG: Error processing user ${user?.username || 'unknown'}:`, userError);
                        userListArray.push(`• **${user?.username || 'Unknown User'}**: Error processing data - ${userError.message}`);
                    }
                }
                
                // Join all user lines
                const userListText = userListArray.join('\n\n');
                
                if (userListText) {
                    embed.addFields({
                        name: '🎖️ Eligible Users',
                        value: userListText,
                        inline: false
                    });
                    console.log('✅ DEBUG: User list added to embed successfully');
                } else {
                    console.error('❌ DEBUG: Generated user list is empty');
                    embed.addFields({
                        name: '❌ Display Error',
                        value: 'Found eligible users but failed to format them properly. Check logs.',
                        inline: false
                    });
                }
                
            } else {
                // Fallback: Manual database check if report shows users but array is empty
                console.log('⚠️ DEBUG: Report shows eligible users but array is empty, performing manual check...');
                
                try {
                    const manualCheck = await SWATUser.find({ promotionEligible: true }).limit(10);
                    console.log(`🔍 DEBUG: Manual check found ${manualCheck.length} users with promotionEligible: true`);
                    
                    if (manualCheck.length > 0) {
                        const manualList = manualCheck.map((user, index) => {
                            try {
                                const formattedRank = RankSystem.formatRank(user);
                                return `• **${user.username}**: ${formattedRank} (${user.rankPoints || 0} pts)`;
                            } catch (formatError) {
                                console.error(`❌ DEBUG: Error formatting user ${user.username}:`, formatError);
                                return `• **${user.username}**: Rank formatting error (${user.rankPoints || 0} pts)`;
                            }
                        }).join('\n');
                        
                        embed.addFields({
                            name: '🎖️ Eligible Users (Manual Check)',
                            value: manualList,
                            inline: false
                        });
                        
                        embed.addFields({
                            name: '⚠️ Note',
                            value: 'Using fallback method - there may be an issue with the eligibility report system.',
                            inline: false
                        });
                    } else {
                        embed.addFields({
                            name: '❌ No Users Found',
                            value: 'Both automatic and manual checks found no eligible users. This may indicate a database issue.',
                            inline: false
                        });
                    }
                } catch (manualError) {
                    console.error('❌ DEBUG: Manual check failed:', manualError);
                    embed.addFields({
                        name: '❌ System Error',
                        value: 'Failed to retrieve eligible users. Please contact an administrator.',
                        inline: false
                    });
                }
            }
    
            // Show total count if more than 10
            if (report.totalEligible > 10) {
                embed.addFields({
                    name: '📊 Total',
                    value: `Showing up to 10 of ${report.totalEligible} eligible users`,
                    inline: false
                });
            }
    
            // Show breakdown by target rank if available
            if (report.byRank && Object.keys(report.byRank).length > 0) {
                const rankBreakdown = Object.entries(report.byRank)
                    .map(([rank, count]) => `• ${rank}: ${count} user${count > 1 ? 's' : ''}`)
                    .join('\n');
                
                embed.addFields({
                    name: '📊 By Target Rank',
                    value: rankBreakdown,
                    inline: false
                });
            }
    
            // 🔧 UPDATED HR action commands to reflect new force promotion permissions
            embed.addFields({
                name: '🔧 HR Actions',
                value: '• `/promote-operator review user:[name]` - Review specific user\n• `/promote-operator approve user:[name]` - Approve promotion\n• `/promote-operator deny user:[name] reason:[reason]` - Deny promotion\n• `/promote-operator force user:[name] rank:[rank] reason:[reason]` - Force promote (HR+)',
                inline: false
            });
    
            await interaction.editReply({ embeds: [embed] });
            console.log('✅ DEBUG: listEligibleUsers completed successfully');
    
        } catch (error) {
            console.error('❌ DEBUG: List eligible users error:', error);
            
            // Create detailed error embed for debugging
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error: Failed to retrieve eligible users')
                .setDescription('An error occurred while fetching promotion-eligible users.')
                .addFields(
                    {
                        name: '🐛 Error Details',
                        value: `\`\`\`${error.message}\`\`\``,
                        inline: false
                    },
                    {
                        name: '🔧 Troubleshooting',
                        value: '• Check bot logs for detailed error information\n• Verify database connection\n• Try again in a few moments\n• Contact administrator if issue persists',
                        inline: false
                    }
                )
                .setTimestamp();
                
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // 🔧 ISSUE #5 MAIN FIX: Force promotion now available to HR+ and properly applies rank locks
    async forcePromote(interaction) {
        const targetUser = interaction.options.getUser('user');
        const targetRankName = interaction.options.getString('rank');
        const reason = interaction.options.getString('reason');
        
        try {
            // Double-check force promotion permission (redundant but safe)
            if (!PermissionChecker.canForcePromotions(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('🚫 You do not have permission to use force promotions!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

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

            // Apply force promotion with proper rank lock
            const oldRank = currentRank;
            user.rankName = targetRank.name;
            user.rankLevel = targetRank.level;
            user.rankPoints = 0; // Reset rank points
            user.promotionEligible = false;
            
            // Apply proper rank lock instead of setting to null
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
                reason: `FORCE PROMOTION (HR+): ${reason}`, // 🔧 Updated reason to reflect HR+ access
                rankPointsAtPromotion: user.rankPoints,
                allTimePointsAtPromotion: user.allTimePoints,
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
                description: `FORCE PROMOTED (HR+): ${oldRank.name} → ${targetRank.name} - ${reason}`, // 🔧 Updated description
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_FORCE_PROMOTION',
                hrAction: {
                    hrUser: interaction.user.id,
                    hrUsername: interaction.user.username,
                    action: 'force_promotion_hr_plus', // 🔧 Updated action type
                    reason: reason,
                    oldRank: oldRank.name,
                    newRank: targetRank.name,
                    rankLockApplied: lockResult.locked ? lockResult.lockDays : 0,
                    rankLockUntil: lockResult.locked ? lockResult.lockUntil : null,
                    performedBy: 'HR_PLUS' // 🔧 Track that this was done by HR+ not Commander+
                }
            });

            await auditLog.save();

            // Create response embed
            const successEmbed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('⚡ Force Promotion Completed (HR+)') // 🔧 Updated title
                .setDescription(`**${user.username}** has been force promoted by HR!`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '🚀 Force Promotion', 
                        value: `${RankSystem.getRankEmoji(oldRank.level)} ${oldRank.name} → ${RankSystem.getRankEmoji(targetRank.level)} ${targetRank.name}`, 
                        inline: false 
                    },
                    { 
                        name: '👤 Force Promoted By', 
                        value: `${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)})`, // 🔧 Show role
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
                        name: '✅ Permission Level', 
                        value: '**HR+** force promotion (updated from Commander+ only)', // 🔧 Highlight the change
                        inline: false 
                    }
                );

            // Show rank lock status in force promotion response
            if (lockResult.locked) {
                successEmbed.addFields({
                    name: '🔒 Rank Lock Applied',
                    value: `${lockResult.lockDays} days until next promotion eligibility`,
                    inline: false
                });
            } else {
                successEmbed.addFields({
                    name: '🔓 Rank Lock Status',
                    value: 'No rank lock (Executive+ rank)',
                    inline: false
                });
            }

            successEmbed.setFooter({ text: 'Force promotion logged in audit trail' })
                        .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });

            console.log(`🚀 HR+ FORCE PROMOTION: ${user.username} force promoted from ${oldRank.name} to ${targetRank.name} by ${interaction.user.username} (${PermissionChecker.getUserHighestRoleName(interaction.member)}) - Lock: ${lockResult.locked ? `${lockResult.lockDays} days` : 'none'}`);

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