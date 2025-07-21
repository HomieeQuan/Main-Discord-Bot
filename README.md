# 🚔 SWAT Discord Bot

**Professional SWAT Team Management System for Discord**

A comprehensive Discord bot designed specifically for SWAT team operations, featuring advanced rank progression, event tracking, HR management tools, and automated promotion workflows.

[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)](https://github.com) [![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/) [![MongoDB](https://img.shields.io/badge/Database-MongoDB-green)](https://mongodb.com/) [![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue)](https://discord.js.org/)

---

## 📋 Table of Contents

- [Features Overview](#-features-overview)
- [System Architecture](#-system-architecture)
- [Installation Guide](#-installation-guide)
- [Configuration](#-configuration)
- [Command Reference](#-command-reference)
- [Rank System](#-rank-system)
- [HR Management](#-hr-management)
- [Deployment](#-deployment)
- [Monitoring & Maintenance](#-monitoring--maintenance)
- [Troubleshooting](#-troubleshooting)

---

## 🌟 Features Overview

### 🎖️ **Advanced Rank Progression System**
- **15 distinct ranks** from Probationary Operator to SWAT Commander
- **Automatic rank progression** based on point accumulation
- **Intelligent rank locks** with timezone-aware expiry notifications
- **Hand-picked Executive ranks** for leadership positions
- **Comprehensive promotion history** tracking with HR approval workflows

### 📊 **Event Tracking & Point Management**
- **13 different event types** with configurable point values
- **Multi-screenshot support** (1-3 images per event submission)
- **Server booster detection** with automatic 2x point multipliers
- **Tryout bonus system** (+1 point per attendee passed)
- **Rank-based quota system** (10-30 points based on rank level)

### 🛡️ **HR Management Tools**
- **Promotion review system** with approval/denial workflows
- **Point management** (add, remove, set, or remove all points)
- **User auditing** with comprehensive event log analysis
- **Screenshot viewing** for evidence verification
- **Bulk user management** with cleanup tools
- **Weekly reset functionality** with data preservation

### 🤖 **Automation & Intelligence**
- **Daily automation scheduler** for rank lock notifications
- **Automatic promotion eligibility detection**
- **Booster status synchronization** with Discord server roles
- **Health monitoring** with system diagnostics
- **Performance analytics** and trend tracking

### 🔐 **Security & Permissions**
- **Role-based access control** with three permission levels:
  - **Operator Level**: Submit events, view stats, leaderboards
  - **HR+ Level**: Point management, user auditing, promotions
  - **Commander+ Level**: Emergency tools, automation, force promotions
- **Comprehensive audit logging** for all administrative actions
- **Data backup utilities** for user and event data

---

## 🏗️ System Architecture

### **Core Components**

```
├── 🎛️ Discord Bot Client (Discord.js v14)
├── 🗄️ MongoDB Database (Mongoose ODM)
├── ⚡ Express Server (Health checks & monitoring)
├── 🤖 Automation Scheduler (Daily tasks)
└── 🛡️ Permission System (Role-based access)
```

### **Database Schema**

#### **SWATUser Model**
```javascript
{
  discordId: String,           // Unique Discord user ID
  username: String,            // Server nickname
  
  // Point System
  weeklyPoints: Number,        // Current week points
  allTimePoints: Number,       // Career total points
  weeklyQuota: Number,         // Rank-based quota (10-30)
  quotaCompleted: Boolean,     // Weekly quota status
  
  // Rank Progression
  rankName: String,            // Current rank name
  rankLevel: Number,           // Rank level (1-15)
  rankPoints: Number,          // Points toward next rank
  
  // Rank Lock System
  rankLockUntil: Date,         // Lock expiry time
  rankLockNotified: Boolean,   // Notification sent status
  
  // Promotion Tracking
  promotionEligible: Boolean,  // HR dashboard flag
  promotionHistory: Array,     // Complete career history
  
  // Performance Metrics
  totalEvents: Number,         // Career event count
  weeklyEvents: Number,        // Current week events
  dailyPointsToday: Number,    // Today's points
  isBooster: Boolean          // 2x point multiplier
}
```

#### **EventLog Model**
```javascript
{
  userId: String,              // Discord user ID
  username: String,            // Server nickname
  eventType: String,           // Event type identifier
  description: String,         // Event description
  pointsAwarded: Number,       // Points given
  boostedPoints: Boolean,      // 2x multiplier applied
  
  // Multi-Screenshot Support
  screenshotUrls: Array,       // 1-3 screenshot URLs
  screenshotUrl: String,       // Primary (backward compatibility)
  
  // Event Details
  quantity: Number,            // Event repetitions
  attendeesPassed: Number,     // Tryout bonus participants
  submittedAt: Date,          // Submission timestamp
  
  // HR Actions
  hrAction: Object            // Administrative actions
}
```

---

## 🚀 Installation Guide

### **Prerequisites**

- **Node.js 20+** - [Download](https://nodejs.org/)
- **MongoDB Database** - [MongoDB Atlas](https://www.mongodb.com/atlas) (recommended) or local installation
- **Discord Bot Application** - [Discord Developer Portal](https://discord.com/developers/applications)

### **1. Clone & Setup**

```bash
# Clone the repository
git clone <repository-url>
cd swat-discord-bot

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### **2. Discord Bot Configuration**

1. **Create Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and name it "SWAT Bot"
   - Navigate to "Bot" section and create bot
   - Copy the **Bot Token**

2. **Get Discord IDs**:
   - **Client ID**: From "General Information" tab
   - **Guild ID**: Right-click your Discord server → "Copy Server ID"

3. **Bot Permissions**:
   ```
   Required Permissions:
   ✅ Send Messages
   ✅ Read Message History
   ✅ Attach Files
   ✅ Use Slash Commands
   ✅ View Channels
   ✅ Manage Messages (for cleanup)
   ```

### **3. Environment Configuration**

Edit your `.env` file:

```env
# Discord Configuration
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here

# Database Configuration
URI=mongodb+srv://username:password@cluster.mongodb.net/swat-bot

# Server Configuration
PORT=6000
```

### **4. Database Setup**

**Option A: MongoDB Atlas (Recommended)**
```bash
# 1. Create free account at mongodb.com/atlas
# 2. Create new cluster
# 3. Add database user
# 4. Whitelist IP addresses
# 5. Get connection string and add to .env
```

**Option B: Local MongoDB**
```bash
# Install MongoDB locally
# Start MongoDB service
# Use connection string: mongodb://localhost:27017/swat-bot
```

### **5. Deploy Commands**

```bash
# Deploy slash commands to Discord
node deploy-commands.js
```

### **6. Start the Bot**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

---

## ⚙️ Configuration

### **Required Discord Roles**

Create these exact role names in your Discord server:

#### **Operator Level (Basic Access)**
- `Special Weapons and Tactics` - Required for event submission

#### **HR+ Level (Management Access)**
- `Executive Operator` - HR functions, point management
- `Senior Executive Operator` - Advanced HR tools
- `A | Chief of Operations` - Operations management
- `A | Deputy Commander` - Senior management

#### **Commander+ Level (Emergency Access)**
- `A | SWAT Commander` - Full system access
- `.` (Admin role) - Complete administrative control

### **Environment Variables Reference**

| Variable | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Discord bot token | `MTIzNDU2Nzg5...` |
| `CLIENT_ID` | Discord application ID | `1234567890123456789` |
| `GUILD_ID` | Discord server ID | `9876543210987654321` |
| `URI` | MongoDB connection string | `mongodb+srv://...` |
| `PORT` | Express server port | `6000` |

---

## 📜 Command Reference

### **👤 User Commands**

#### `/submit-event`
Submit events for point tracking and rank progression.

**Options:**
- `event-type` - Select from 13 available event types
- `description` - Brief description of the event
- `screenshot1` - Primary screenshot (required)
- `screenshot2` - Additional screenshot (optional)
- `screenshot3` - Additional screenshot (optional)
- `quantity` - Number of times event was performed (1-20)
- `attendees-passed` - For tryouts only: number who passed (0-50)

**Point Values:**
```
30-Minute Patrol: 1pt
Attending Event: 2pts
SWAT Event: 3pts
Hosting SWAT Event: 4pts
Backup Request: 3pts
GHOST Protection [Good]: 4pts
GHOST Protection [Bad]: 2pts
TET Private Tryout: 2pts + attendees
TET Public Tryout: 3pts + attendees
SLRPD Inspection: 2pts
Combat Training: 2pts
SWAT Inspection: 3pts
Gang Deployment: 4pts
```

#### `/my-stats`
View personal performance statistics and rank progression.

**Features:**
- Current rank with emoji display
- Weekly quota progress bar
- Rank progression toward next promotion
- Performance metrics and trends
- Recent event history

#### `/leaderboard`
View server performance rankings.

**Options:**
- `type` - Weekly or All-Time rankings

**Features:**
- Clean, uncluttered design
- Rank emoji display for Elite+ members
- Active user filtering
- Performance statistics

---

### **🛡️ HR Commands**

#### `/manage-points`
Adjust user points for corrections or penalties.

**Options:**
- `user` - Target user for point adjustment
- `action` - Add, remove, set, or remove all points
- `amount` - Point amount (not needed for remove_all)
- `reason` - Required justification for audit trail

**Actions:**
- `add` - Add points to user's totals
- `remove` - Subtract points from user's totals
- `set` - Set weekly points to specific amount
- `remove_all` - Nuclear option (requires "confirm" in reason)

#### `/promote-operator`
Complete promotion management system.

**Subcommands:**
- `review` - Examine promotion eligibility
- `approve` - Approve eligible promotion
- `deny` - Deny promotion with reason
- `list-eligible` - Show all promotion-ready users
- `force` - Emergency promotion to any rank
- `bypass-lock` - Remove rank lock from user
- `set-rank` - Set initial rank (migration tool)

#### `/audit-user`
Comprehensive user analysis for HR reviews.

**Features:**
- Complete event history analysis
- Performance trend evaluation
- Screenshot audit (all images displayed)
- Risk assessment and recommendations
- Available HR actions

#### `/view-logs`
Filtered event log viewing with search capabilities.

**Options:**
- `user` - Filter by specific user
- `event-type` - Filter by event type
- `days` - Lookback period (1-30 days)

#### `/view-screenshots`
Dedicated screenshot audit tool for evidence verification.

**Features:**
- Individual screenshot display
- Event context and metadata
- Chronological organization
- Detailed submission information

#### `/admin-users`
User lifecycle management tools.

**Subcommands:**
- `delete` - Permanently remove departed members
- `cleanup` - Bulk cleanup of inactive users
- `list-inactive` - Identify inactive members
- `stats` - User management statistics

#### `/reset-week`
Weekly statistics reset with data preservation.

**Features:**
- Resets weekly points and events to zero
- Updates rank-based quotas
- Preserves all-time points and rank progression
- Comprehensive backup before reset

---

### **⚔️ Commander Commands**

#### `/admin-tools`
Emergency administrative utilities (Commander+ only).

**Subcommands:**
- `backup-users` - Export complete user database
- `backup-events` - Export event logs with filtering
- `fix-booster` - Correct booster status mismatches
- `fix-quota` - Recalculate all user quotas
- `database-stats` - View system health metrics
- `fix-ranks` - Recalculate rank positions
- `health-check` - Comprehensive system diagnostics
- `emergency-reset` - Nuclear database reset (dangerous)
- `permissions-check` - Debug user permissions

#### `/automation-admin`
Automation system management (Commander+ only).

**Subcommands:**
- `trigger` - Manually run daily automation
- `status` - Check scheduler status
- `stats` - View automation performance
- `health` - System health assessment
- `test-notifications` - Test HR notification system

#### `/booster-admin`
Server booster synchronization management.

**Subcommands:**
- `sync-all` - Bulk booster status synchronization
- `sync-user` - Individual user booster fix
- `stats` - Booster performance analytics
- `audit` - Recent booster status changes

---

## 🎖️ Rank System

### **Complete 15-Rank Progression**

#### **Junior Ranks (Levels 1-5)**
```
1. 📝 Probationary Operator     →  0 pts  | 0 days lock  | 10 pts quota
2. 📝 Junior Operator           → 25 pts  | 1 day lock   | 20 pts quota
3. 📝 Experienced Operator      → 30 pts  | 3 days lock  | 20 pts quota
4. 📝 Senior Operator           → 40 pts  | 3 days lock  | 20 pts quota
5. 📝 Specialized Operator      → 50 pts  | 3 days lock  | 25 pts quota
```

#### **Elite Ranks (Levels 6-10)**
```
6. ⚡ Elite Operator            → 60 pts  | 5 days lock  | 25 pts quota
7. ⚡⚡ Elite Operator I         → 80 pts  | 5 days lock  | 30 pts quota
8. ⚡⚡⚡ Elite Operator II      → 90 pts  | 5 days lock  | 30 pts quota
9. ⚡⚡⚡⚡ Elite Operator III   → 100 pts | 7 days lock  | 30 pts quota
10. ⚡⚡⚡⚡⚡ Elite Operator IV → 120 pts | 7 days lock  | 30 pts quota
```

#### **Executive Ranks (Levels 11-15)**
```
11. ⭐ Executive Operator         → Hand-picked | No lock | No quota
12. ⭐⭐ Senior Executive          → Hand-picked | No lock | No quota
13. 🎖️ Operations Chief          → Hand-picked | No lock | No quota
14. 🎖️⚔️ Deputy Commander        → Hand-picked | No lock | No quota
15. 👑 SWAT Commander            → Hand-picked | No lock | No quota
```

### **Rank System Features**

#### **Automatic Progression (Levels 1-10)**
- **Point Requirements**: Each rank requires specific rank points
- **Rank Locks**: Mandatory waiting periods after promotion
- **Progress Tracking**: Real-time progress bars toward next rank
- **Eligibility Notifications**: Automatic alerts when ready for promotion

#### **Executive Selection (Levels 11-15)**
- **Hand-Picked Only**: Leadership selects based on merit
- **No Point Requirements**: Focus on leadership qualities
- **Immediate Eligibility**: No rank locks for Executive ranks
- **Special Privileges**: Access to advanced management tools

#### **Quota System**
- **Rank-Based Requirements**: Higher ranks have higher quotas
- **Weekly Reset**: Quotas reset every week with progress tracking
- **Executive Exemption**: Executive+ ranks have no quota requirements
- **Performance Analytics**: Track quota completion rates and trends

---

## 🛡️ HR Management

### **Promotion Workflow**

#### **1. Automatic Detection**
```
User earns points → System checks eligibility → Sets promotion flag → Notifies HR
```

#### **2. HR Review Process**
```bash
# Check eligible users
/promote-operator list-eligible

# Review specific user
/promote-operator review user:@username

# Make decision
/promote-operator approve user:@username reason:"Excellent performance"
/promote-operator deny user:@username reason:"Needs improvement in X area"
```

#### **3. Promotion Execution**
- **Rank Update**: Automatic rank level and name change
- **Point Reset**: Rank points reset to 0 for next promotion
- **Rank Lock Application**: Automatic lock based on new rank level
- **History Tracking**: Complete promotion record with HR details
- **Notifications**: User and HR notifications of promotion

### **Point Management System**

#### **Standard Adjustments**
```bash
# Award bonus points
/manage-points user:@username action:add amount:10 reason:"Exceptional leadership during deployment"

# Correct submission error
/manage-points user:@username action:remove amount:5 reason:"Duplicate event submission"

# Set specific value
/manage-points user:@username action:set amount:25 reason:"Weekly quota adjustment"
```

#### **Emergency Procedures**
```bash
# Complete point removal (requires confirmation)
/manage-points user:@username action:remove_all reason:"confirm - User transferred to different unit"
```

### **User Auditing**

#### **Comprehensive Analysis**
```bash
# Full user audit with all evidence
/audit-user user:@username days:7
```

**Audit Features:**
- **Performance Metrics**: Points, events, and trends
- **Screenshot Review**: All submitted evidence displayed
- **Risk Assessment**: Identifies potential issues
- **Trend Analysis**: Performance over time
- **HR Actions**: Available management options

#### **Evidence Verification**
```bash
# View all screenshots for audit
/view-screenshots user:@username days:30
```

### **Weekly Management**

#### **Week-End Procedures**
```bash
# 1. Generate performance reports
/leaderboard type:weekly

# 2. Review promotion-eligible users
/promote-operator list-eligible

# 3. Process promotions
/promote-operator approve user:@username

# 4. Reset weekly statistics
/reset-week confirm:true
```

---

## 🚀 Deployment

### **Oracle Cloud Free Tier Setup**

#### **1. Create VM Instance**
```bash
# Instance Configuration
Shape: VM.Standard.E2.1.Micro (Free tier)
OS: Ubuntu 22.04 LTS
Storage: 47GB Boot Volume
Network: Allow HTTP/HTTPS traffic
```

#### **2. Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /opt/swat-bot
sudo chown $USER:$USER /opt/swat-bot
```

#### **3. Application Deployment**
```bash
# Clone application
cd /opt/swat-bot
git clone <repository-url> .

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env  # Edit configuration

# Deploy Discord commands
node deploy-commands.js

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### **4. Ecosystem Configuration**
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'swat-bot',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 6000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### **SSL/HTTPS Setup (Optional)**

```bash
# Install Certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure reverse proxy (nginx)
sudo apt install nginx
# Configure nginx to proxy to port 6000
```

### **Monitoring Setup**

```bash
# View application logs
pm2 logs swat-bot

# Monitor system resources
pm2 monit

# Check application status
pm2 status
```

---

## 📊 Monitoring & Maintenance

### **System Health Monitoring**

#### **Built-in Health Checks**
```bash
# Comprehensive system diagnostic
/admin-tools health-check

# Database statistics
/admin-tools database-stats

# Automation system status
/automation-admin status
```

#### **Performance Metrics**
- **Database Response Time**: < 1000ms target
- **Memory Usage**: Monitor for < 1GB on free tier
- **Event Processing**: Track submission success rates
- **Automation Success**: Daily task completion monitoring

### **Backup Procedures**

#### **Automated Data Export**
```bash
# Export user database
/admin-tools backup-users

# Export event logs (last 30 days)
/admin-tools backup-events days:30
```

#### **Manual Database Backup**
```bash
# MongoDB dump (if using local instance)
mongodump --uri="mongodb://localhost:27017/swat-bot" --out=/backup/$(date +%Y%m%d)

# MongoDB Atlas backup (automatic with Atlas)
# Configure point-in-time recovery in Atlas dashboard
```

### **Maintenance Tasks**

#### **Daily**
- ✅ Automated rank lock notifications
- ✅ Promotion eligibility checks
- ✅ HR daily summaries
- ✅ Booster status synchronization

#### **Weekly**
- 📊 Performance review
- 🎯 Quota completion analysis
- 🧹 Inactive user cleanup
- 📈 System metrics review

#### **Monthly**
- 💾 Full database backup
- 🔍 Performance optimization
- 📊 Usage analytics review
- 🛡️ Security audit

### **Log Management**

#### **Application Logs**
```bash
# PM2 logs
pm2 logs swat-bot --lines 100

# Error tracking
tail -f /opt/swat-bot/logs/err.log

# Combined logs
tail -f /opt/swat-bot/logs/combined.log
```

#### **Log Rotation**
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/swat-bot

# Logrotate configuration
/opt/swat-bot/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    create 644 ubuntu ubuntu
    postrotate
        pm2 reload swat-bot
    endscript
}
```

---

## 🔧 Troubleshooting

### **Common Issues**

#### **Bot Not Responding**
```bash
# Check bot status
pm2 status

# Check Discord connection
pm2 logs swat-bot | grep "Bot is online"

# Restart bot
pm2 restart swat-bot
```

#### **Database Connection Issues**
```bash
# Check MongoDB connection
node -e "console.log(process.env.URI)" # Verify connection string

# Test database connectivity
/admin-tools health-check

# Check database logs
pm2 logs swat-bot | grep "Database connected"
```

#### **Command Not Working**
```bash
# Redeploy commands
node deploy-commands.js

# Check permissions
/admin-tools permissions-check user:@username

# Verify role configuration
# Ensure exact role names match system requirements
```

#### **Permission Errors**
```bash
# Required Discord roles (exact names):
- "Special Weapons and Tactics" (basic access)
- "Executive Operator" (HR access)
- "A | SWAT Commander" (admin access)
- "." (full admin access)

# Check user permissions
/admin-tools permissions-check user:@username
```

### **Performance Issues**

#### **High Memory Usage**
```bash
# Check memory usage
pm2 monit

# Clear old logs
pm2 flush

# Restart application
pm2 restart swat-bot
```

#### **Slow Database Queries**
```bash
# Check database performance
/admin-tools database-stats

# Review query indexes (manual MongoDB review)
# Consider database optimization
```

### **Data Recovery**

#### **User Data Recovery**
```bash
# Recent backup restoration
# Use exported JSON from /admin-tools backup-users

# Point reconstruction from event logs
# Use /view-logs to audit user history
```

#### **System Recovery**
```bash
# Reset weekly data only
/reset-week confirm:true

# Emergency complete reset (DANGEROUS)
/admin-tools emergency-reset confirmation:CONFIRM_EMERGENCY_RESET
```

### **Support Contacts**

#### **Technical Issues**
- **Database**: MongoDB Atlas support
- **Hosting**: Oracle Cloud support
- **Discord**: Discord Developer support

#### **Application Issues**
- **Bot Logic**: Review application logs
- **Performance**: Monitor system resources
- **Features**: Consult this documentation

---

## 📞 Support & Contributing

### **Documentation**
- **Complete Feature Guide**: This README
- **Command Reference**: Built into Discord slash commands
- **Permission Guide**: Section above
- **Troubleshooting**: Common issues and solutions

### **Performance**
- **Optimized Database**: Indexed queries for fast performance
- **Scalable Architecture**: Designed for growth
- **Resource Efficient**: Runs well on Oracle Cloud Free Tier
- **Automated Operations**: Minimal manual intervention required

### **Security**
- **Role-Based Permissions**: Three-tier access control
- **Audit Logging**: Complete action tracking
- **Data Validation**: Input sanitization and validation
- **Secure Configuration**: Environment variable protection

---

**🎉 Congratulations! Your SWAT Discord Bot is now fully operational and ready to manage your team's performance tracking and promotion workflows.**

For additional support or feature requests, consult the troubleshooting section or review the comprehensive command documentation built into the Discord slash commands.
