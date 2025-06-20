const express = require('express');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 4444;

// In-memory job storage
const jobs = new Map();
const runningProcesses = new Map(); // Track running child processes

app.use(bodyParser.json());

function validateDbUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // Basic PostgreSQL URL validation (pg,postgres,postgresql)
    return /^(pg|postgres|postgresql):\/\//.test(url);
}

app.post('/api/v1/migrate', async (req, res) => {
    const { sourceUrl, targetUrl, schemas } = req.body;

    // Enhanced validation
    if (!validateDbUrl(sourceUrl)) {
        return res.status(400).json({ error: 'Invalid source connection: please provide valid connection details for your source data' });
    }
    
    if (!validateDbUrl(targetUrl)) {
        return res.status(400).json({ error: 'Invalid destination connection: please provide valid connection details for your destination data' });
    }
    
    if (!Array.isArray(schemas) || schemas.length === 0) {
        return res.status(400).json({ error: 'Invalid data sections: please specify which data sections to transfer' });
    }

    const jobId = uuidv4();
    
    // Initialize job status
    jobs.set(jobId, {
        id: jobId,
        status: 'started',
        progress: 0,
        message: 'Data transfer queued',
        startTime: new Date(),
        sourceUrl: sourceUrl.replace(/\/\/[^@]*@/, '//***:***@'), // Hide credentials in logs
        targetUrl: targetUrl.replace(/\/\/[^@]*@/, '//***:***@'),
        schemas,
        steps: [],
        error: null
    });

    res.json({ 
        message: 'Data transfer started', 
        jobId,
        statusUrl: `/api/v1/migrate/${jobId}/status`
    });

    // Start async migration
    startMigration(sourceUrl, targetUrl, schemas, jobId).catch(error => {
        updateJobStatus(jobId, 'failed', 100, `Data transfer failed: ${error.message}`, error);
    });
});

// New endpoint to check migration progress
app.get('/api/v1/migrate/:jobId/status', (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(job);
});

// New endpoint to list all jobs
app.get('/api/v1/migrate/jobs', (req, res) => {
    const jobList = Array.from(jobs.values()).map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        message: job.message,
        startTime: job.startTime,
        schemas: job.schemas
    }));
    
    res.json(jobList);
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'nc-migrator'
    });
});

function updateJobStatus(jobId, status, progress, message, error = null) {
    const job = jobs.get(jobId);
    if (job) {
        job.status = status;
        job.progress = Math.min(100, Math.max(0, progress));
        job.message = message;
        job.lastUpdate = new Date();
        if (error) {
            job.error = error.message || error;
        }
        if (status === 'completed' || status === 'failed') {
            job.endTime = new Date();
            job.duration = job.endTime - job.startTime;
        }
        
        console.log(`[${jobId}] ${status.toUpperCase()}: ${message} (${job.progress}%)`);
    }
}

function addJobStep(jobId, step) {
    const job = jobs.get(jobId);
    if (job) {
        job.steps.push({
            step,
            timestamp: new Date(),
            message: step
        });
    }
}

async function startMigration(sourceUrl, targetUrl, schemas, jobId) {
    try {
        updateJobStatus(jobId, 'running', 10, 'Preparing your workspace to upgrade...');
        
        const targetDbName = extractDbName(targetUrl);
        if (!targetDbName) {
            throw new Error('Could not identify destination location from connection details');
        }

        addJobStep(jobId, `Setting up target resource`);
        updateJobStatus(jobId, 'running', 20, `Setting up target resource...`);

        // Create database using connection URL (connect to maintenance database first)
        const createDbUrl = buildCreateDbUrl(targetUrl, targetDbName);
        
        const createDbCommand = `createdb --maintenance-db="${createDbUrl}" "${targetDbName}"`;
        await executeCommand(createDbCommand, jobId);
        addJobStep(jobId, 'Target resource set up successfully');

        updateJobStatus(jobId, 'running', 40, 'Preparing data to migrate to your upgraded workspace...');

        // Create temporary dump file
        const dumpFile = path.join('/tmp', `migration_${jobId}.dump`);
        
        // Dump schemas
        const schemaArgs = schemas.map(s => `--schema="${s}"`).join(' ');
        const dumpCommand = `pg_dump ${schemaArgs} --no-owner --no-privileges --format=custom --file="${dumpFile}" "${sourceUrl}"`;
        
        await executeCommand(dumpCommand, jobId);
        
        updateJobStatus(jobId, 'running', 70, 'Starting data migration to your upgraded workspace...');
        addJobStep(jobId, 'Starting data migration to your upgraded workspace...');

        // Restore to target database
        const restoreCommand = `pg_restore --no-owner --no-privileges --verbose --dbname="${targetUrl}" "${dumpFile}"`;
        
        await executeCommand(restoreCommand, jobId);
        
        addJobStep(jobId, 'Data migration to your upgraded workspace completed successfully');

        updateJobStatus(jobId, 'running', 90, 'Cleaning up temporary files...');
        
        // Cleanup
        try {
            await fs.unlink(dumpFile);
            addJobStep(jobId, 'Temporary files cleaned up');
        } catch (cleanupError) {
            console.warn(`[${jobId}] Warning: Could not clean up temporary files: ${cleanupError.message}`);
        }

        updateJobStatus(jobId, 'completed', 100, `Your workspace has been upgraded successfully`);
        addJobStep(jobId, 'Your workspace has been upgraded successfully');

    } catch (error) {
        updateJobStatus(jobId, 'failed', 100, `Your workspace upgrade failed: ${error.message}`, error);
        addJobStep(jobId, `Your workspace upgrade failed: ${error.message}`);
        throw error;
    }
}

function executeCommand(command, jobId) {
    return new Promise((resolve, reject) => {
        console.log(`[${jobId}] Executing: ${command.replace(/postgresql:\/\/[^@]*@/, 'postgresql://***:***@')}`);
        
        const childProcess = exec(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
        
        // Track the process for cleanup
        runningProcesses.set(jobId, childProcess);
        
        let stdout = '';
        let stderr = '';

        childProcess.stdout?.on('data', (data) => {
            stdout += data;
            // You could parse pg_dump/pg_restore output here for more detailed progress
        });

        childProcess.stderr?.on('data', (data) => {
            stderr += data;
            console.log(`[${jobId}] ${data.toString()}`);
        });

        childProcess.on('close', (code) => {
            runningProcesses.delete(jobId);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
            }
        });

        childProcess.on('error', (error) => {
            runningProcesses.delete(jobId);
            reject(new Error(`Command execution failed: ${error.message}`));
        });
    });
}

function extractDbName(dbUrl) {
    // More robust database name extraction
    try {
        const url = new URL(dbUrl);
        const dbName = url.pathname.slice(1).split('/')[0]; // Remove leading slash and get first part
        return dbName || null;
    } catch (error) {
        // Fallback to regex approach
        const match = dbUrl.match(/\/([^/?]+)(\?|$)/);
        return match ? match[1] : null;
    }
}

function buildCreateDbUrl(targetUrl, targetDbName) {
    // Build connection URL for destination setup (connect to system database)
    try {
        const url = new URL(targetUrl);
        // Replace the database name with 'postgres' for createdb command
        // This connects to the maintenance database to create the new database
        url.pathname = '/postgres';
        return url.toString();
    } catch (error) {
        // Fallback: replace database name in URL string
        return targetUrl.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
    }
}

// Cleanup old jobs (run every hour)
const cleanupInterval = setInterval(() => {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [jobId, job] of jobs.entries()) {
        const jobAge = now - job.startTime;
        if (jobAge > maxAge && (job.status === 'completed' || job.status === 'failed')) {
            jobs.delete(jobId);
            console.log(`Cleaned up old job: ${jobId}`);
        }
    }
}, 60 * 60 * 1000); // Run every hour

const server = app.listen(port, () => {
    console.log(`Data transfer service running at http://localhost:${port}`);
    console.log(`API endpoints:`);
    console.log(`  POST /api/v1/migrate - Start data transfer`);
    console.log(`  GET  /api/v1/migrate/:jobId/status - Check progress`);
    console.log(`  GET  /api/v1/migrate/jobs - List all transfers`);
    console.log(`  GET  /api/v1/health - Health check`);
});

// Graceful shutdown handling
let isShuttingDown = false;

function gracefulShutdown(signal) {
    if (isShuttingDown) {
        console.log('Force shutdown, exiting immediately...');
        process.exit(1);
    }
    
    isShuttingDown = true;
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new requests
    server.close(() => {
        console.log('HTTP server closed');
        
        // Clear the cleanup interval
        clearInterval(cleanupInterval);
        console.log('Cleanup interval cleared');
        
        // Kill all running processes
        if (runningProcesses.size > 0) {
            console.log(`Terminating ${runningProcesses.size} running processes...`);
            for (const [jobId, process] of runningProcesses.entries()) {
                console.log(`Killing process for job ${jobId}`);
                process.kill('SIGTERM');
                updateJobStatus(jobId, 'failed', 100, 'Migration cancelled due to service shutdown');
            }
            runningProcesses.clear();
        }
        
        console.log('Graceful shutdown completed');
        process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error('Forceful shutdown after 30 seconds');
        process.exit(1);
    }, 30000);
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});
