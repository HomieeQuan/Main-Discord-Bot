// This class handles all role and permission checking
class PermissionChecker {
    // Check if a member has a specific role
    static hasRole(member, roleName) {
        return member.roles.cache.some(role => role.name === roleName);
    }

    // Check if user is HR
    static isHR(member) {
        return this.hasRole(member, 'HR');
    }

    // Check if user is a SWAT operator
    static isOperator(member) {
        return this.hasRole(member, 'Special Weapons and Tactics');
    }

    // Check if user is a server booster (gets 2x points)
    static isBooster(member) {
        return this.hasRole(member, 'Server Booster');
    }

    // Check if user can submit event logs
    static canSubmitLogs(member) {
        return this.isOperator(member) || this.isHR(member);
    }

    // Check if user can manage the system (HR only)
    static canManageSystem(member) {
        return this.isHR(member);
    }
}

module.exports = PermissionChecker;