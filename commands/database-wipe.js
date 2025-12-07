// commands/database-wipe.js - NUCLEAR OPTION: Complete database reset
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('../utils/permissionChecker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('database-wipe')
        .setDescription('🚨 NUCLEAR OPTION: Delete ALL users and event logs (CANNOT BE UNDONE)')
        .addStringOption(option =>
            option.setName('confirmation')
                .setDescription('Type "DELETE EVERYTHING" to confirm (case-sensitive)')
                .setRequired(true))
        .setDMPermission(false),

    async execute(interaction) {
        // ===== PERMISSION CHECK: Commander+ ONLY =====
        if (!PermissionChecker.isCommander(interaction.member)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Access Denied')
                .setDescription('**Only the SWAT Commander or Admin can use this command!**')
                .addFields({
                    name: '⚠️ Critical Command',
                    value: 'This command permanently deletes ALL data from the database.',
                    inline: false
                })
                .setFooter({ text: 'Restricted to Commander+ only' })
                .setTimestamp();
            
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const confirmation = interaction.options.getString('confirmation');

        // ===== CONFIRMATION CHECK =====
        if (confirmation !== 'DELETE EVERYTHING') {
            const warningEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Confirmation Required')
                .setDescription('You must type **DELETE EVERYTHING** (case-sensitive) to confirm this action.')
                .addFields(
                    {
                        name: '🚨 What This Does',
                        value: '• Deletes ALL users from database\n• Deletes ALL event logs\n• Deletes ALL promotion history\n• **CANNOT BE UNDONE**',
                        inline: false
                    },
                    {
                        name: '❌ What You Typed',
                        value: `\`${confirmation}\``,
                        inline: false
                    },
                    {
                        name: '✅ What You Need to Type',
                        value: '`DELETE EVERYTHING`',
                        inline: false
                    }
                )
                .setFooter({ text: 'Type it exactly as shown above' })
                .setTimestamp();

            return await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
        }

        // ===== DEFER REPLY (this will take time) =====
        await interaction.deferReply({ ephemeral: true });

        try {
            console.log(`🚨 DATABASE WIPE INITIATED BY: ${interaction.user.username} (${interaction.user.id})`);
            console.log(`🚨 CONFIRMATION RECEIVED: "${confirmation}"`);

            // ===== GET COUNTS BEFORE DELETION =====
            const userCount = await SWATUser.countDocuments();
            const eventLogCount = await EventLog.countDocuments();
            const swatCount = await SWATUser.countDocuments({ unit: 'SWAT' });
            const cmuCount = await SWATUser.countDocuments({ unit: 'CMU' });

            console.log(`📊 Pre-wipe statistics:`);
            console.log(`   - Total users: ${userCount}`);
            console.log(`   - SWAT users: ${swatCount}`);
            console.log(`   - CMU users: ${cmuCount}`);
            console.log(`   - Total event logs: ${eventLogCount}`);

            // ===== STEP 1: DELETE ALL EVENT LOGS =====
            console.log('🗑️ Step 1: Deleting all event logs...');
            const eventDeletionResult = await EventLog.deleteMany({});
            console.log(`✅ Deleted ${eventDeletionResult.deletedCount} event logs`);

            // ===== STEP 2: DELETE ALL USERS =====
            console.log('🗑️ Step 2: Deleting all users...');
            const userDeletionResult = await SWATUser.deleteMany({});
            console.log(`✅ Deleted ${userDeletionResult.deletedCount} users`);

            // ===== VERIFY DELETION =====
            const remainingUsers = await SWATUser.countDocuments();
            const remainingLogs = await EventLog.countDocuments();

            if (remainingUsers > 0 || remainingLogs > 0) {
                throw new Error(`Deletion incomplete: ${remainingUsers} users and ${remainingLogs} logs remain`);
            }

            // ===== SUCCESS RESPONSE =====
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('☢️ Database Wipe Complete')
                .setDescription('**All data has been permanently deleted from the database.**')
                .addFields(
                    {
                        name: '🗑️ Users Deleted',
                        value: `**${userCount}** total users\n• SWAT: ${swatCount}\n• CMU: ${cmuCount}`,
                        inline: true
                    },
                    {
                        name: '📋 Event Logs Deleted',
                        value: `**${eventLogCount}** event logs`,
                        inline: true
                    },
                    {
                        name: '✅ Verification',
                        value: `Remaining users: ${remainingUsers}\nRemaining logs: ${remainingLogs}`,
                        inline: false
                    },
                    {
                        name: '👤 Executed By',
                        value: interaction.user.username,
                        inline: true
                    },
                    {
                        name: '⏰ Timestamp',
                        value: new Date().toLocaleString('en-US', { 
                            timeZone: 'America/New_York',
                            dateStyle: 'full',
                            timeStyle: 'long'
                        }),
                        inline: false
                    }
                )
                .setFooter({ text: '⚠️ This action cannot be undone' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            console.log(`☢️ DATABASE WIPE COMPLETED SUCCESSFULLY`);
            console.log(`   - Executed by: ${interaction.user.username}`);
            console.log(`   - Users deleted: ${userCount}`);
            console.log(`   - Event logs deleted: ${eventLogCount}`);
            console.log(`   - Verification: ${remainingUsers} users, ${remainingLogs} logs remaining`);

        } catch (error) {
            console.error('❌ DATABASE WIPE ERROR:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Database Wipe Failed')
                .setDescription('An error occurred during the database wipe operation.')
                .addFields(
                    {
                        name: 'Error Details',
                        value: `\`\`\`${error.message}\`\`\``,
                        inline: false
                    },
                    {
                        name: '⚠️ Warning',
                        value: 'Database may be in an inconsistent state. Contact system administrator immediately.',
                        inline: false
                    },
                    {
                        name: '🔧 Troubleshooting',
                        value: '• Check database connection\n• Verify permissions\n• Check server logs\n• Attempt manual cleanup if needed',
                        inline: false
                    }
                )
                .setFooter({ text: 'Contact administrator for assistance' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};