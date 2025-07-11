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

// Helper function to sanitize URLs for client responses
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/\/\/[^@]*@/, '//***:***@');
}

// Helper function to log errors with full details while returning sanitized client messages
function logAndSanitizeError(error, sourceUrl = null, targetUrl = null) {
    // Log full error details to server
    console.error('Migration error details:', {
        message: error.message,
        stack: error.stack,
        sourceUrl: sourceUrl,
        targetUrl: targetUrl,
        code: error.code,
        stdout: error.stdout,
        stderr: error.stderr
    });
    
    // Return sanitized error message for client
    let clientMessage = error.message;
    if (sourceUrl) {
        clientMessage = clientMessage.replace(new RegExp(sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizeUrl(sourceUrl));
    }
    if (targetUrl) {
        clientMessage = clientMessage.replace(new RegExp(targetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizeUrl(targetUrl));
    }
    
    return clientMessage;
}

function validateDbUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // Basic PostgreSQL URL validation (pg,postgres,postgresql)
    return /^(pg|postgres|postgresql):\/\//.test(url);
}

app.post('/api/v1/migrate', async (req, res) => {
    const { sourceUrl, targetUrl, schemas, skipCreateDb } = req.body;

    // Enhanced validation
    if (!validateDbUrl(sourceUrl)) {
        console.log('Invalid source URL provided:', sanitizeUrl(sourceUrl));
        return res.status(400).json({ error: 'Invalid source connection: please provide valid connection details for your source data' });
    }
    
    if (!validateDbUrl(targetUrl)) {
        console.log('Invalid target URL provided:', sanitizeUrl(targetUrl));
        return res.status(400).json({ error: 'Invalid destination connection: please provide valid connection details for your destination data' });
    }
    
    if (!Array.isArray(schemas)) {
        return res.status(400).json({ error: 'Invalid data sections: please specify which data sections to transfer' });
    }

    const jobId = uuidv4();
    
    // Initialize job status with additional tracking information
    jobs.set(jobId, {
        id: jobId,
        status: 'started',
        progress: 0,
        message: 'Data transfer queued',
        startTime: new Date(),
        sourceUrl: sanitizeUrl(sourceUrl), // Store sanitized version
        targetUrl: sanitizeUrl(targetUrl), // Store sanitized version
        schemas,
        steps: [],
        error: null,
        // Store additional info for cleanup
        targetDbName: null,
        databaseCreated: false,
        skipCreateDb: skipCreateDb
    });

    res.json({ 
        message: 'Data transfer started', 
        jobId,
        statusUrl: `/api/v1/migrate/${jobId}/status`
    });

    // Start async migration
    startMigration(sourceUrl, targetUrl, schemas, jobId, skipCreateDb).catch(error => {
        const sanitizedMessage = logAndSanitizeError(error, sourceUrl, targetUrl);
        updateJobStatus(jobId, 'failed', 100, `Data transfer failed: ${sanitizedMessage}`, sanitizedMessage);
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
        job.message = message; // Message should already be sanitized when passed to this function
        job.lastUpdate = new Date();
        if (error) {
            // Store sanitized error message for client consumption
            job.error = typeof error === 'string' ? error : (error.message || error);
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

async function startMigration(sourceUrl, targetUrl, schemas, jobId, skipCreateDb) {
    // remove -pooler suffix from any neon url if it exists
    sourceUrl = sourceUrl.replace(/-pooler(\.[^.]+\.neon\.tech)/, '$1');
    targetUrl = targetUrl.replace(/-pooler(\.[^.]+\.neon\.tech)/, '$1');

    let databaseCreated = false;
    let targetDbName = null;
    let createDbUrl = null;

    try {
        updateJobStatus(jobId, 'running', 10, 'Preparing your workspace to upgrade...');
        
        targetDbName = extractDbName(targetUrl);
        if (!targetDbName) {
            console.error(`[${jobId}] Could not extract database name from target URL:`, sanitizeUrl(targetUrl));
            throw new Error('Could not identify destination location from connection details');
        }

        // Fix: Validate database name to prevent injection attacks
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetDbName)) {
            console.error(`[${jobId}] Invalid database name format:`, targetDbName);
            throw new Error('Invalid database name format');
        }

        // Update job tracking information
        const job = jobs.get(jobId);
        if (job) {
            job.targetDbName = targetDbName;
        }

        addJobStep(jobId, `Setting up target resource`);
        updateJobStatus(jobId, 'running', 20, `Setting up target resource...`);

        if (!skipCreateDb) {
          // Create database using connection URL (connect to maintenance database first)
          createDbUrl = buildCreateDbUrl(targetUrl, targetDbName);
          
          const createDbCommand = `createdb --maintenance-db="${createDbUrl}" "${targetDbName}"`;
          await executeCommand(createDbCommand, jobId, sourceUrl, targetUrl);

          databaseCreated = true; // Mark that we successfully created the database
        
          // Update job tracking
          if (job) {
              job.databaseCreated = true;
          }
        }
        
        addJobStep(jobId, 'Target resource set up successfully');

        if (schemas.length > 0) {
          updateJobStatus(jobId, 'running', 40, 'Starting direct data migration to your upgraded workspace...');
          addJobStep(jobId, 'Starting direct data migration to your upgraded workspace...');

          // Use piped approach for faster migration (no intermediate file)
          const schemaArgs = schemas.map(s => `--schema="${s}"`).join(' ');
          const pipedMigrationCommand = `pg_dump ${schemaArgs} --no-owner --no-privileges --format=plain "${sourceUrl}" | psql "${targetUrl}"`;
          
          await executeCommand(pipedMigrationCommand, jobId, sourceUrl, targetUrl);
          
          addJobStep(jobId, 'Data migration to your upgraded workspace completed successfully');
        }

        updateJobStatus(jobId, 'running', 90, 'Finalizing migration...');

        updateJobStatus(jobId, 'completed', 100, `Your workspace has been upgraded successfully`);
        addJobStep(jobId, 'Your workspace has been upgraded successfully');

    } catch (error) {
        // Log full error details to server
        console.error(`[${jobId}] Migration failed:`, {
            message: error.message,
            stack: error.stack,
            sourceUrl: sourceUrl,
            targetUrl: targetUrl
        });
        
        const sanitizedMessage = logAndSanitizeError(error, sourceUrl, targetUrl);
        
        // Update job status to indicate cleanup is starting
        updateJobStatus(jobId, 'failing', 95, 'Migration failed, cleaning up resources...', sanitizedMessage);
        addJobStep(jobId, 'Migration failed, starting cleanup...');

        // Cleanup operations
        const cleanupPromises = [];

        // Cleanup target database if we created it
        if (databaseCreated && targetDbName && createDbUrl && !skipCreateDb) {
            cleanupPromises.push(
                cleanupTargetDatabase(targetDbName, createDbUrl, jobId, sourceUrl, targetUrl)
            );
        }

        // Wait for all cleanup operations to complete
        try {
            await Promise.allSettled(cleanupPromises);
            addJobStep(jobId, 'Cleanup completed');
        } catch (cleanupError) {
            console.error(`[${jobId}] Error during cleanup:`, cleanupError);
            addJobStep(jobId, 'Cleanup completed with warnings');
        }

        updateJobStatus(jobId, 'failed', 100, `Your workspace upgrade failed: ${sanitizedMessage}`, sanitizedMessage);
        addJobStep(jobId, `Your workspace upgrade failed: ${sanitizedMessage}`);
        throw error;
    }
}

// New function to handle target database cleanup
async function cleanupTargetDatabase(targetDbName, createDbUrl, jobId, sourceUrl = null, targetUrl = null) {
    try {
        console.log(`[${jobId}] Attempting to cleanup target database: ${targetDbName}`);
        addJobStep(jobId, `Cleaning up target database: ${targetDbName}`);
        
        // Fix: Validate database name to prevent injection attacks
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetDbName)) {
            throw new Error('Invalid database name format for cleanup');
        }
        
        // First, terminate any active connections to the target database
        // Fix: Use proper parameter escaping instead of string interpolation
        const terminateConnectionsCommand = `psql "${createDbUrl}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();" -v ON_ERROR_STOP=1 --set=AUTOCOMMIT=on --single-transaction --variable=dbname='${targetDbName}'`.replace('$1', "'" + targetDbName.replace(/'/g, "''") + "'");
        
        try {
            await executeCommand(terminateConnectionsCommand, jobId, sourceUrl, targetUrl);
            console.log(`[${jobId}] Terminated active connections to database: ${targetDbName}`);
        } catch (terminateError) {
            // This is not critical - the database might not have active connections
            console.warn(`[${jobId}] Warning: Could not terminate connections to database ${targetDbName}: ${terminateError.message}`);
        }

        // Drop the target database - dropdb handles escaping internally
        const dropDbCommand = `dropdb --maintenance-db="${createDbUrl}" "${targetDbName}"`;
        await executeCommand(dropDbCommand, jobId, sourceUrl, targetUrl);
        
        console.log(`[${jobId}] Successfully cleaned up target database: ${targetDbName}`);
        addJobStep(jobId, `Successfully cleaned up target database: ${targetDbName}`);
        
    } catch (cleanupError) {
        // Log the cleanup error but don't throw it - we don't want cleanup failures to mask the original error
        console.error(`[${jobId}] Failed to cleanup target database ${targetDbName}:`, {
            message: cleanupError.message,
            stack: cleanupError.stack
        });
        
        const sanitizedCleanupMessage = logAndSanitizeError(cleanupError, sourceUrl, targetUrl);
        addJobStep(jobId, `Warning: Failed to cleanup target database - manual cleanup may be required: ${sanitizedCleanupMessage}`);
        
        // Update job with cleanup warning (but don't change the main failure status)
        const job = jobs.get(jobId);
        if (job) {
            if (!job.warnings) job.warnings = [];
            job.warnings.push(`Database cleanup failed: ${sanitizedCleanupMessage}`);
        }
    }
}

function executeCommand(command, jobId, sourceUrl = null, targetUrl = null) {
    return new Promise((resolve, reject) => {
        // Log sanitized command to console
        let sanitizedCommand = command;
        if (sourceUrl) {
            sanitizedCommand = sanitizedCommand.replace(new RegExp(sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizeUrl(sourceUrl));
        }
        if (targetUrl) {
            sanitizedCommand = sanitizedCommand.replace(new RegExp(targetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizeUrl(targetUrl));
        }
        
        console.log(`[${jobId}] Executing: ${sanitizedCommand}`);
        
        // Fix: Add timeout support for database operations
        const timeout = 5 * 60 * 1000; // 5 minutes timeout
        const childProcess = exec(command, { 
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            timeout: timeout
        });
        
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
            // Sanitize stderr output before logging
            let sanitizedData = data.toString();
            if (sourceUrl) {
                sanitizedData = sanitizedData.replace(new RegExp(sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizeUrl(sourceUrl));
            }
            if (targetUrl) {
                sanitizedData = sanitizedData.replace(new RegExp(targetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizeUrl(targetUrl));
            }
            console.log(`[${jobId}] ${sanitizedData}`);
        });

        childProcess.on('close', (code) => {
            runningProcesses.delete(jobId);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                // Create error with full details for server logging, but sanitize the message
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                
                // Log full error details to server
                console.error(`[${jobId}] Command execution failed:`, {
                    command: command, // Full command for server logs
                    code: code,
                    stdout: stdout,
                    stderr: stderr
                });
                
                reject(error);
            }
        });

        childProcess.on('error', (error) => {
            runningProcesses.delete(jobId);
            console.error(`[${jobId}] Command execution error:`, {
                command: command, // Full command for server logs
                error: error.message,
                stack: error.stack
            });
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
    console.log(`  POST   /api/v1/migrate - Start data transfer`);
    console.log(`  GET    /api/v1/migrate/:jobId/status - Check progress`);
    console.log(`  GET    /api/v1/migrate/jobs - List all transfers`);
    console.log(`  GET    /api/v1/health - Health check`);
    console.log(`VERSION: 0.1.0`);
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
                updateJobStatus(jobId, 'failed', 100, 'Migration cancelled due to service shutdown', 'Migration cancelled due to service shutdown');
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
