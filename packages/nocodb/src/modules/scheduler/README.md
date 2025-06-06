# NocoDB Scheduler Architecture

The Scheduler is a distributed job scheduling system built on NestJS that handles recurring tasks across the platform. It provides a flexible architecture for scheduling and executing different types of jobs with support for cron expressions, time zones.

## Architecture Overview

The scheduler follows a modular architecture with the following key components:

### Core Components

1. **SchedulerService** (`scheduler.service.ts:18`) - Main orchestrator that manages job execution
2. **BaseEntityScheduler** (`base-entity-scheduler.ts:11`) - Abstract base class for entity-specific schedulers
3. **EntityScheduler Interface** (`../interface/Scheduler.ts:17`) - Contract for implementing custom schedulers
4. **ScheduledJobConfig** (`../interface/Scheduler.ts:3`) - Job configuration structure

### Module Structure

```
src/modules/scheduler/
├── scheduler.module.ts           # Main scheduler module
├── scheduler.service.ts          # Core scheduling service
├── base-entity-scheduler.ts      # Base class for entity schedulers
└── cron/                         # Directory for cron-specific schedulers
    └── [entity]-scheduler.ts     # Example cron scheduler implementation
```

## Key Features

### 1. Distributed Locking
- Uses Redis-based locking to ensure only one instance creates jobs
- Lock TTL: 70 seconds with 30-second renewal intervals
- Fallback to standalone mode when Redis is unavailable

### 2. Job Processing
- Polls for due jobs every 1 Minute (`scheduler.service.ts:165`)
- Processes jobs in configurable batches (default: 100 jobs)
- Supports both cron expressions and interval-based scheduling

### 3. Timezone Support
- Full timezone support for job scheduling
- Defaults to UTC when no timezone is specified

### 4. Entity-Based Scheduling
- Pluggable entity scheduler architecture
- Each entity type (e.g., webhooks) can have its own scheduler
- Schedulers are automatically registered with the main service

## How to Use

### 1. Creating a Custom Entity Scheduler

To create a new entity scheduler, extend the `BaseEntityScheduler` class:

```typescript
import { Injectable } from '@nestjs/common';
import { BaseEntityScheduler } from '~/modules/scheduler/base-entity-scheduler';
import type { ScheduledJobConfig } from '~/interface/Scheduler';
import type dayjs from '~/utils/dayjs';

@Injectable()
export class MyEntityScheduler extends BaseEntityScheduler {
  getEntityType(): string {
    return 'my-entity';
  }

  async findDueJobs(
    currentTime: dayjs.Dayjs,
    endTime: dayjs.Dayjs,
    limit = 100,
    offset = 0,
  ): Promise<ScheduledJobConfig[]> {
    // Implementation to find due jobs from your data source
    // Return array of ScheduledJobConfig
  }

  async updateExecutionTime(jobs: ScheduledJobConfig[]): Promise<void> {
    // Implementation to update last_execution_at and next_execution_at
    // in your data source
  }
}
```

### 2. Registering Your Scheduler

Register your scheduler in the appropriate module:

```typescript
@Module({
  imports: [ScheduleModule.forRoot(), forwardRef(() => NocoModule), JobsModule],
  providers: [SchedulerService, MyEntityScheduler],
  exports: [SchedulerService],
})
export class SchedulerModule {
  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly myEntityScheduler: MyEntityScheduler,
  ) {
    this.schedulerService.registerEntityScheduler(this.myEntityScheduler);
  }
}
```

### 3. Job Configuration

Jobs are configured using the `ScheduledJobConfig` interface:

```typescript
interface ScheduledJobConfig {
  id: string;                   // Unique job identifier
  entityId: string;             // ID of the entity being scheduled
  entityType: string;           // Type of entity (matches scheduler type)
  jobType: JobTypes;              // Type of job to execute (from JobTypes)
  jobData: any;                 // Data to pass to the job
  nextExecutionTime: Dayjs;     // When the job should next run
  lastExecutionTime?: Dayjs;    // When the job last ran
  cronExpression?: string;      // Cron expression for scheduling
  intervalMinutes?: number;     // Alternative to cron: interval in minutes
  timezone?: string;            // Timezone for scheduling (defaults to UTC)
  active?: boolean;             // Whether the job is active
}
```

### 4. Cron Expression Support

The scheduler supports standard cron expressions:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

Examples:
- `0 9 * * 1-5` - Every weekday at 9:00 AM
- `*/15 * * * *` - Every 15 minutes
- `0 0 1 * *` - First day of every month at midnight

## Example: Webhook Scheduler

The webhook scheduler (`ee/modules/scheduler/cron/webhook-scheduler.ts:10`) demonstrates a complete implementation:

1. **Finding Due Jobs**: Queries the hooks table for active cron webhooks
2. **Job Configuration**: Maps database records to `ScheduledJobConfig`
3. **Execution Updates**: Updates last and next execution times in the database
4. **Error Handling**: Comprehensive error handling and logging

## Configuration

### SchedulerOptions

Configure the scheduler behavior using `SchedulerOptions`:

```typescript
class SchedulerOptions {
  pollingIntervalMs: number = 60000;  // How often to check for due jobs (1 minute)
  batchSize: number = 100;            // Number of jobs to process per batch
}
```

## Best Practices

1. **Entity Scheduler Implementation**:
   - Use appropriate indexes on timestamp columns for performance
   - Implement proper timezone handling

2. **Job Data**:
   - TODO: Implement Service Accounts for job execution
   - Include necessary context for job execution
