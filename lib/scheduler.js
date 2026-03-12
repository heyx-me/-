import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../user_data');
const SCHEDULES_DIR = path.join(DATA_DIR, 'schedules');
const PREFERENCES_DIR = path.join(DATA_DIR, 'preferences');

class SchedulerService {
    constructor() {
        this.registeredTasks = new Map(); // agentName -> [tasks]
        this.activeJobs = new Map(); // jobId (conversationId:agentName:taskId) -> cron.ScheduledTask
        this.initDirs();
    }

    async initDirs() {
        try {
            await fs.mkdir(SCHEDULES_DIR, { recursive: true });
            await fs.mkdir(PREFERENCES_DIR, { recursive: true });
        } catch (e) {
            console.error('[Scheduler] Failed to create directories:', e);
        }
    }

    /**
     * Register declarative tasks for an agent.
     * @param {string} agentName - Name of the agent (e.g., 'rafi')
     * @param {Array} tasks - Array of task definitions { taskId, defaultSchedule, enabledByDefault, execute }
     * @param {Object} agentContext - Optional context (like the agent instance) to pass to execute
     */
    registerAgentTasks(agentName, tasks, agentContext = null) {
        this.registeredTasks.set(agentName, { tasks, agentContext });
        console.log(`[Scheduler] Registered ${tasks.length} tasks for agent: ${agentName}`);
    }

    /**
     * Start a specific task for a conversation.
     */
    async startTaskForUser(conversationId, agentName, taskId) {
        const agentData = this.registeredTasks.get(agentName);
        if (!agentData) return;

        const { tasks: agentTasks, agentContext } = agentData;
        const taskDef = agentTasks.find(t => t.taskId === taskId);
        if (!taskDef) return;

        // Load user schedule override
        const userSchedule = await this.getUserSchedule(conversationId, agentName, taskId);
        const scheduleExpression = userSchedule?.schedule || taskDef.defaultSchedule;
        const isEnabled = userSchedule?.enabled !== undefined ? userSchedule.enabled : taskDef.enabledByDefault;

        const jobId = `${conversationId}:${agentName}:${taskId}`;

        // Stop existing job if any
        if (this.activeJobs.has(jobId)) {
            this.activeJobs.get(jobId).stop();
            this.activeJobs.delete(jobId);
        }

        if (isEnabled && scheduleExpression) {
            try {
                const job = cron.schedule(scheduleExpression, async () => {
                    console.log(`[Scheduler] Executing scheduled task ${jobId} at ${new Date().toISOString()}`);
                    try {
                        await taskDef.execute(conversationId, this, agentContext);
                    } catch (e) {
                        console.error(`[Scheduler] Task ${jobId} failed:`, e);
                    }
                });
                this.activeJobs.set(jobId, job);
                console.log(`[Scheduler] Started job ${jobId} with schedule: ${scheduleExpression}`);
            } catch (e) {
                console.error(`[Scheduler] Invalid cron expression for ${jobId}: ${scheduleExpression}`, e);
            }
        }
    }

    /**
     * Stop a specific task for a conversation.
     */
    stopTaskForUser(conversationId, agentName, taskId) {
        const jobId = `${conversationId}:${agentName}:${taskId}`;
        if (this.activeJobs.has(jobId)) {
            this.activeJobs.get(jobId).stop();
            this.activeJobs.delete(jobId);
            console.log(`[Scheduler] Stopped job ${jobId}`);
        }
    }

    /**
     * Stop all tasks for a specific user across all agents.
     */
    stopAllTasksForUser(conversationId) {
        for (const jobId of this.activeJobs.keys()) {
            if (jobId.startsWith(`${conversationId}:`)) {
                this.activeJobs.get(jobId).stop();
                this.activeJobs.delete(jobId);
                console.log(`[Scheduler] Stopped job ${jobId}`);
            }
        }
    }

    /**
     * Clear all schedules and preferences for a user.
     */
    async clearUserData(conversationId) {
        try {
            await fs.unlink(path.join(SCHEDULES_DIR, `${conversationId}.json`)).catch(() => {});
            await fs.unlink(path.join(PREFERENCES_DIR, `${conversationId}.json`)).catch(() => {});
            console.log(`[Scheduler] Cleared data for ${conversationId}`);
        } catch (e) {
            console.error(`[Scheduler] Error clearing data for ${conversationId}:`, e);
        }
    }

    // --- Data Access ---

    async getUserSchedule(conversationId, agentName, taskId) {
        try {
            const filePath = path.join(SCHEDULES_DIR, `${conversationId}.json`);
            const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            return data[agentName]?.[taskId];
        } catch (e) {
            return null; // File doesn't exist or task not found
        }
    }

    async updateUserSchedule(conversationId, agentName, taskId, schedule, enabled) {
        const filePath = path.join(SCHEDULES_DIR, `${conversationId}.json`);
        let data = {};
        try {
            data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        } catch (e) {} // Ignore if file doesn't exist

        if (!data[agentName]) data[agentName] = {};
        
        const existing = data[agentName][taskId] || {};
        data[agentName][taskId] = {
            schedule: schedule !== undefined ? schedule : existing.schedule,
            enabled: enabled !== undefined ? enabled : existing.enabled
        };

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        
        // Restart the job with the new schedule
        await this.startTaskForUser(conversationId, agentName, taskId);
        return data[agentName][taskId];
    }

    async getPreferences(conversationId) {
        try {
            const filePath = path.join(PREFERENCES_DIR, `${conversationId}.json`);
            return JSON.parse(await fs.readFile(filePath, 'utf-8'));
        } catch (e) {
            return {};
        }
    }

    async updatePreference(conversationId, key, value) {
        const filePath = path.join(PREFERENCES_DIR, `${conversationId}.json`);
        let data = {};
        try {
            data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        } catch (e) {}

        if (value === null || value === undefined) {
            delete data[key];
        } else {
            data[key] = value;
        }

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return data;
    }

    /**
     * Called on startup or when a user logs in to start all their applicable tasks.
     */
    async bootstrapUser(conversationId, agentName) {
        const agentData = this.registeredTasks.get(agentName);
        if (!agentData) return;
        const { tasks: agentTasks } = agentData;
        for (const task of agentTasks) {
            await this.startTaskForUser(conversationId, agentName, task.taskId);
        }
    }
}

// Export a singleton instance
export const scheduler = new SchedulerService();