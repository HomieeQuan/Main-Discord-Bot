// utils/permissionChecker.js - UPDATED: Only Medical Director has HR permissions, not Board of Medicine
const ROLES = {
    // COMMANDER+ LEVEL (Emergency/Critical Access)
    COMMANDER: 'A | SWAT Commander',
    ADMIN: '.', // Complete mod controls
    
    // MANAGEMENT LEVEL (HR+ Access)
    DEPUTY_COMMANDER: 'A | Deputy Commander',
    OPERATIONS_CHIEF: 'A | Chief of Operations',
    // SWAT HR Roles
    EXECUTIVE_OPERATOR: 'HR | Executive Operator',
    SENIOR_EXECUTIVE_OPERATOR: 'Senior Executive Operator',
    // CMU HR Roles (only Medical Director, NOT Board of Medicine)
    MEDICAL_DIRECTOR: 'HR | Medical Director',
    
    // OPERATOR LEVEL (Basic Access)
    SWAT_OPERATOR: 'Special Weapons and Tactics',
    CMU_OPERATOR: 'Critical Medical Unit'
};

// Role hierarchy levels (higher number = more permissions)
const ROLE_LEVELS = {
    // COMMANDER+ LEVEL
    [ROLES.COMMANDER]: 100,
    [ROLES.ADMIN]: 100,
    
    // MANAGEMENT LEVEL (HR+)
    [ROLES.DEPUTY_COMMANDER]: 50,
    [ROLES.OPERATIONS_CHIEF]: 50,
    // SWAT HR
    [ROLES.EXECUTIVE_OPERATOR]: 50,
    [ROLES.SENIOR_EXECUTIVE_OPERATOR]: 50,
    // CMU HR (only Medical Director)
    [ROLES.MEDICAL_DIRECTOR]: 50,
    
    // OPERATOR LEVEL
    [ROLES.SWAT_OPERATOR]: 10,
    [ROLES.CMU_OPERATOR]: 10
};

class PermissionChecker {
    // ===== CORE PERMISSION FUNCTIONS =====
    
    // Get user's highest role level
    static getUserRoleLevel(member) {
        if (!member || !member.roles) return 0;
        
        let highestLevel = 0;
        member.roles.cache.forEach(role => {
            const level = ROLE_LEVELS[role.name] || 0;
            if (level > highestLevel) {
                highestLevel = level;
            }
        });
        
        return highestLevel;
    }

    // Check if user has a specific role
    static hasRole(member, roleName) {
        if (!member || !member.roles) return false;
        return member.roles.cache.some(role => role.name === roleName);
    }

    // Get user's highest role name (for display purposes)
    static getUserHighestRoleName(member) {
        if (!member || !member.roles) return 'No Role';
        
        let highestLevel = 0;
        let highestRoleName = 'No Role';
        
        member.roles.cache.forEach(role => {
            const level = ROLE_LEVELS[role.name] || 0;
            if (level > highestLevel) {
                highestLevel = level;
                highestRoleName = role.name;
            }
        });
        
        return highestRoleName;
    }

    // ===== PERMISSION LEVEL CHECKS =====

    // Check if user is Commander+ (Emergency/Critical Access)
    static isCommander(member) {
        return this.getUserRoleLevel(member) >= 100;
    }

    // Check if user is HR+ (Management Access)
    static isHRPlus(member) {
        return this.getUserRoleLevel(member) >= 50;
    }

    // Check if user is SWAT Operator
    static isOperator(member) {
        return this.getUserRoleLevel(member) >= 10;
    }

    // ===== BOOSTER DETECTION =====
    
    // Check if user is a server booster (using Discord's native detection)
    static isBooster(member) {
        if (!member || !member.premiumSince) return false;
        return member.premiumSince !== null;
    }

    // ===== SPECIALIZED UNIT DETECTION =====
    
    // Check if user is in Special Operations Group (SOG)
    static isSOG(member) {
        if (!member || !member.roles) return false;
        return member.roles.cache.some(role => role.name === 'Special Operations Group');
    }

    // Check if user is in Training and Evaluation Team (TET)
    static isTET(member) {
        if (!member || !member.roles) return false;
        return member.roles.cache.some(role => role.name === 'Training and Evaluation Team');
    }

    // Get specialized unit for a member (returns 'SOG', 'TET', or null)
    static getSpecializedUnit(member) {
        if (this.isSOG(member)) return 'SOG';
        if (this.isTET(member)) return 'TET';
        return null;
    }

    // ===== COMMAND PERMISSION CHECKS =====

    // BASIC PERMISSIONS (All SWAT members)
    static canSubmitLogs(member) {
        return this.isOperator(member); // Special Weapons and Tactics role required
    }

    static canViewOwnStats(member) {
        return this.isOperator(member); // Special Weapons and Tactics role required
    }

    static canViewLeaderboard(member) {
        return this.isOperator(member); // Special Weapons and Tactics role required
    }

    // HR+ PERMISSIONS (Management Level)
    static canManagePoints(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required
    }

    static canViewLogs(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required
    }

    static canViewScreenshots(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required
    }

    static canResetWeek(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required
    }

    static canManageUsers(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required (delete users, etc.)
    }

    static canManagePromotions(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required (approve/deny promotions)
    }

    static canManageBoosterSync(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required
    }

    static canViewOtherStats(member) {
        return this.isHRPlus(member); // HR | Executive Operator+ required
    }

    // COMMANDER+ PERMISSIONS (Emergency/Critical Level)
    static canUseEmergencyCommands(member) {
        return this.isCommander(member); // A | SWAT Commander or . required
    }

    static canUseBackupCommands(member) {
        return this.isCommander(member); // A | SWAT Commander or . required
    }

    // 🔧 ISSUE #5 FIX: Force promotions now allow HR+ instead of Commander+ only
    static canForcePromotions(member) {
        return this.isHRPlus(member); // 🔧 CHANGED: HR+ can now use force promotions (was Commander+ only)
    }

    static canManageAutomation(member) {
        return this.isCommander(member); // A | SWAT Commander or . required
    }

    // ===== LEGACY COMPATIBILITY =====
    
    // Keep these for backward compatibility with existing code
    static canManageSystem(member) {
        return this.isHRPlus(member); // Maps to HR+ level
    }

    static isHR(member) {
        return this.isHRPlus(member); // Maps to HR+ level
    }

    // ===== ERROR MESSAGE GENERATORS =====

    // Generate appropriate error message based on required permission level
    static getPermissionErrorMessage(requiredLevel) {
        switch (requiredLevel) {
            case 'commander':
                return '🚫 Only the **Commander** or **Admin** can use this command!';
            case 'hr':
                return '🚫 Only **HR** or higher can use this command!';
            case 'operator':
                return '🚫 You need the **Special Weapons and Tactics** role to use this command!';
            default:
                return '🚫 You don\'t have permission to use this command!';
        }
    }

    // ===== DEBUGGING/ADMIN FUNCTIONS =====

    // Get detailed permission info for a user (for debugging)
    static getUserPermissionInfo(member) {
        if (!member || !member.roles) {
            return {
                hasPermissions: false,
                roleLevel: 0,
                highestRole: 'No Role',
                permissions: {
                    isCommander: false,
                    isHRPlus: false,
                    isOperator: false,
                    isBooster: false
                }
            };
        }

        const roleLevel = this.getUserRoleLevel(member);
        const highestRole = this.getUserHighestRoleName(member);
        
        return {
            hasPermissions: roleLevel > 0,
            roleLevel,
            highestRole,
            permissions: {
                isCommander: this.isCommander(member),
                isHRPlus: this.isHRPlus(member),
                isOperator: this.isOperator(member),
                isBooster: this.isBooster(member)
            }
        };
    }

    // List all available roles and their levels (for admin reference)
    static getRoleHierarchy() {
        return {
            'COMMANDER+ LEVEL (Emergency/Critical Access)': {
                roles: [ROLES.COMMANDER, ROLES.ADMIN],
                level: 100,
                access: 'ALL commands including emergency, backup, automation'
            },
            'MANAGEMENT LEVEL (HR+ Access)': {
                roles: [
                    ROLES.DEPUTY_COMMANDER,
                    ROLES.OPERATIONS_CHIEF,
                    ROLES.EXECUTIVE_OPERATOR, // 🔧 Now displays "HR | Executive Operator"
                    ROLES.SENIOR_EXECUTIVE_OPERATOR
                ],
                level: 50,
                access: 'HR functions, point management, user management, promotions, booster sync, force promotions'
            },
            'OPERATOR LEVEL (Basic Access)': {
                roles: [ROLES.SWAT_OPERATOR],
                level: 10,
                access: 'Submit events, view stats, view leaderboard'
            }
        };
    }

    // Validate that all required roles exist in the guild (for setup verification)
    static validateRoles(guild) {
        const requiredRoles = Object.values(ROLES);
        const existingRoles = guild.roles.cache.map(role => role.name);
        const missingRoles = requiredRoles.filter(role => !existingRoles.includes(role));
        
        return {
            valid: missingRoles.length === 0,
            missingRoles,
            existingRoles: requiredRoles.filter(role => existingRoles.includes(role))
        };
    }
}

module.exports = PermissionChecker;