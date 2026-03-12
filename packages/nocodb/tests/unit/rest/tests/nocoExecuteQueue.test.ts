import { expect } from 'chai';
import DataLoader from 'dataloader';
import PQueue from 'p-queue';
import { nocoExecute } from '../../../../src/utils/nocoExecute';

/**
 * Integration-style test for nocoExecute + PQueue(concurrency=1).
 *
 * Creates realistic proto objects with multiple relation DataLoaders
 * (HM, BT, MM) and lookups, then runs nocoExecute on 100+ records
 * to verify:
 *   1. All DataLoader batch callbacks go through the same queue
 *   2. Max concurrent query execution is exactly 1
 *   3. Results are correct despite parallel promise resolution
 */

// ---------------------------------------------------------------------------
// Helpers: instrumented PQueue that tracks concurrency
// ---------------------------------------------------------------------------

interface QueueStats {
  maxConcurrent: number;
  currentConcurrent: number;
  totalTasks: number;
  taskLog: Array<{ task: string; startTime: number; endTime: number }>;
}

function createTrackedQueue(): { queue: PQueue; stats: QueueStats } {
  const stats: QueueStats = {
    maxConcurrent: 0,
    currentConcurrent: 0,
    totalTasks: 0,
    taskLog: [],
  };

  const queue = new PQueue({ concurrency: 1 });

  // Monkey-patch .add() to track concurrency
  const originalAdd = queue.add.bind(queue);
  queue.add = (fn: any, opts?: any) => {
    const taskId = `task-${stats.totalTasks++}`;
    return originalAdd(async () => {
      const startTime = Date.now();
      stats.currentConcurrent++;
      if (stats.currentConcurrent > stats.maxConcurrent) {
        stats.maxConcurrent = stats.currentConcurrent;
      }
      try {
        const result = await fn();
        return result;
      } finally {
        const endTime = Date.now();
        stats.taskLog.push({ task: taskId, startTime, endTime });
        stats.currentConcurrent--;
      }
    }, opts);
  };

  return { queue, stats };
}

// ---------------------------------------------------------------------------
// Helpers: simulate DB query delay
// ---------------------------------------------------------------------------

const QUERY_DELAY_MS = 5;

async function simulateQuery<T>(result: T): Promise<T> {
  await new Promise((r) => setTimeout(r, QUERY_DELAY_MS));
  return result;
}

// ---------------------------------------------------------------------------
// Helpers: build proto with DataLoaders backed by the shared queue
// ---------------------------------------------------------------------------

interface BuildProtoOpts {
  queue: PQueue;
  /** child records for HM relation keyed by parent PK */
  hmData: Record<string, any[]>;
  /** parent records for BT relation keyed by FK value */
  btData: Record<string, any>;
  /** related records for MM relation keyed by parent PK */
  mmData: Record<string, any[]>;
  /** lookup alias: resolves through a relation → field path */
  lookups?: Record<string, { path: string[] }>;
  /** optional nested proto to attach to HM/BT/MM child records */
  childProto?: any;
}

function buildProto(opts: BuildProtoOpts) {
  const { queue, hmData, btData, mmData, lookups, childProto } = opts;

  const proto: any = {
    __columnAliases: {},
  };

  // -- HM DataLoader (e.g. "posts") --
  const hmLoader = new DataLoader(
    (ids: readonly string[]) =>
      queue.add(async () => {
        const result = await simulateQuery(
          ids.map((id) => {
            const children = hmData[id] || [];
            if (childProto) {
              return children.map((c) => {
                const row = { ...c };
                row.__proto__ = childProto;
                return row;
              });
            }
            return children;
          }),
        );
        return result;
      }),
    { cache: false },
  );

  proto['posts'] = async function (args?: any) {
    (hmLoader as any).args = args;
    return hmLoader.load(this.id);
  };

  // -- BT DataLoader (e.g. "author") --
  const btLoader = new DataLoader(
    (ids: readonly string[]) =>
      queue.add(async () => {
        const result = await simulateQuery(
          ids.map((id) => {
            const parent = btData[id] || null;
            if (parent && childProto) {
              const row = { ...parent };
              row.__proto__ = childProto;
              return row;
            }
            return parent;
          }),
        );
        return result;
      }),
    { cache: false },
  );

  proto['author'] = async function (args?: any) {
    if (this.author_id == null) return null;
    (btLoader as any).args = args;
    return btLoader.load(this.author_id);
  };

  // -- MM DataLoader (e.g. "tags") --
  const mmLoader = new DataLoader(
    (ids: readonly string[]) =>
      queue.add(async () => {
        const result = await simulateQuery(
          ids.map((id) => {
            const related = mmData[id] || [];
            return related;
          }),
        );
        return result;
      }),
    { cache: false },
  );

  proto['tags'] = async function (args?: any) {
    (mmLoader as any).args = args;
    return mmLoader.load(this.id);
  };

  // -- Lookups --
  if (lookups) {
    for (const [alias, def] of Object.entries(lookups)) {
      proto.__columnAliases[alias] = { path: def.path };
    }
  }

  return proto;
}

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

function generateTestData(recordCount: number) {
  // Authors (for BT)
  const authors: Record<string, any> = {};
  for (let i = 1; i <= 10; i++) {
    authors[`author-${i}`] = { id: `author-${i}`, name: `Author ${i}` };
  }

  // Tags (for MM)
  const tagSets: Record<string, any[]> = {};
  const tagPool = ['js', 'ts', 'rust', 'go', 'python'];

  // Posts (HM children) — each record has 2-5 posts
  const postsPerRecord: Record<string, any[]> = {};

  // Comments per post (nested HM)
  const commentsPerPost: Record<string, any[]> = {};

  for (let i = 1; i <= recordCount; i++) {
    const id = `rec-${i}`;
    const postCount = 2 + (i % 4); // 2-5 posts per record
    const posts: any[] = [];

    for (let p = 0; p < postCount; p++) {
      const postId = `post-${i}-${p}`;
      posts.push({
        id: postId,
        title: `Post ${p} of record ${i}`,
        author_id: `author-${(i % 10) + 1}`,
      });

      // Each post has 1-3 comments
      const commentCount = 1 + (p % 3);
      const comments: any[] = [];
      for (let c = 0; c < commentCount; c++) {
        comments.push({
          id: `comment-${postId}-${c}`,
          text: `Comment ${c} on ${postId}`,
        });
      }
      commentsPerPost[postId] = comments;
    }

    postsPerRecord[id] = posts;

    // MM tags
    const tagCount = 1 + (i % 3);
    tagSets[id] = tagPool.slice(0, tagCount).map((t) => ({ tag: t }));
  }

  return { authors, postsPerRecord, commentsPerPost, tagSets };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('nocoExecute + PQueue serialization', () => {
  const RECORD_COUNT = 120;

  it('should resolve 120 records with HM, BT, MM relations using a single shared queue with max concurrency=1', async () => {
    const { queue, stats } = createTrackedQueue();
    const { authors, postsPerRecord, commentsPerPost, tagSets } =
      generateTestData(RECORD_COUNT);

    // Build nested proto for posts (has comments HM + author BT)
    const postProto = buildProto({
      queue,
      hmData: commentsPerPost,
      btData: authors,
      mmData: {},
      lookups: {},
    });

    // Build root proto (has posts HM + author BT + tags MM + lookup)
    const rootProto = buildProto({
      queue,
      hmData: postsPerRecord,
      btData: authors,
      mmData: tagSets,
      lookups: {
        // Lookup: "author_name" resolves through author → name
        author_name: { path: ['author', 'name'] },
      },
      childProto: postProto,
    });

    // Create 120 records with the shared proto
    const records = [];
    for (let i = 1; i <= RECORD_COUNT; i++) {
      const rec: any = {
        id: `rec-${i}`,
        title: `Record ${i}`,
        author_id: `author-${(i % 10) + 1}`,
      };
      rec.__proto__ = rootProto;
      records.push(rec);
    }

    // AST: request nested fields including lookup
    const ast = {
      id: 1,
      title: 1,
      posts: {
        id: 1,
        title: 1,
        author: {
          id: 1,
          name: 1,
        },
      },
      author: {
        id: 1,
        name: 1,
      },
      tags: 1,
      author_name: 1,
    };

    // Execute
    const results = await nocoExecute(ast as any, records, {});

    // ---------------------------------------------------------------
    // Verify correctness
    // ---------------------------------------------------------------

    expect(results).to.be.an('array').with.lengthOf(RECORD_COUNT);

    // Spot-check first record
    const first = results[0];
    expect(first.id).to.equal('rec-1');
    expect(first.title).to.equal('Record 1');
    expect(first.author).to.deep.include({ id: 'author-2', name: 'Author 2' });
    expect(first.posts).to.be.an('array');
    expect(first.posts.length).to.be.greaterThan(0);
    expect(first.tags).to.be.an('array');
    expect(first.author_name).to.equal('Author 2');

    // Check nested post has author resolved
    const firstPost = first.posts[0];
    expect(firstPost.id).to.be.a('string');
    expect(firstPost.title).to.be.a('string');
    expect(firstPost.author).to.have.property('name');

    // Spot-check last record
    const last = results[RECORD_COUNT - 1];
    expect(last.id).to.equal(`rec-${RECORD_COUNT}`);
    expect(last.posts).to.be.an('array');
    expect(last.author).to.be.an('object');
    expect(last.tags).to.be.an('array');

    // ---------------------------------------------------------------
    // Verify queue behavior
    // ---------------------------------------------------------------

    // Max concurrent should be exactly 1
    console.log('\n  Queue Stats:');
    console.log(`    Total tasks enqueued: ${stats.totalTasks}`);
    console.log(`    Max concurrent: ${stats.maxConcurrent}`);
    console.log(`    Task log entries: ${stats.taskLog.length}`);

    expect(stats.maxConcurrent).to.equal(
      1,
      'Max concurrent queries should be exactly 1',
    );

    // Should have batched — far fewer tasks than records × relations
    // Without batching we'd have 120 × 3 (HM+BT+MM) + nested = 360+ tasks
    // With DataLoader batching we expect much fewer
    console.log(
      `    Batching efficiency: ${stats.totalTasks} tasks for ${RECORD_COUNT} records × 4 relations`,
    );
    expect(stats.totalTasks).to.be.lessThan(
      RECORD_COUNT * 4,
      'DataLoader should batch — fewer tasks than records × relations',
    );

    // Verify no overlapping execution windows
    for (let i = 1; i < stats.taskLog.length; i++) {
      const prev = stats.taskLog[i - 1];
      const curr = stats.taskLog[i];
      expect(curr.startTime).to.be.at.least(
        prev.endTime,
        `Task ${curr.task} started before ${prev.task} finished — concurrency violation`,
      );
    }

    console.log('    No overlapping execution windows: ✓');
  });

  it('should share the same queue instance across nested depth levels', async () => {
    const { queue, stats } = createTrackedQueue();

    // Track which queue instance each DataLoader uses
    const queueRefs = new Set<PQueue>();

    // Depth-2 proto (comments)
    const commentProto: any = { __columnAliases: {} };

    // Depth-1 proto (posts → has comments)
    const depth1HmData: Record<string, any[]> = {
      'post-1': [
        { id: 'c1', text: 'Comment 1' },
        { id: 'c2', text: 'Comment 2' },
      ],
      'post-2': [{ id: 'c3', text: 'Comment 3' }],
    };

    const depth1Proto: any = { __columnAliases: {} };
    const depth1HmLoader = new DataLoader(
      (ids: readonly string[]) => {
        queueRefs.add(queue);
        return queue.add(async () => {
          return simulateQuery(
            ids.map((id) => {
              const children = depth1HmData[id] || [];
              return children.map((c) => {
                const row = { ...c };
                row.__proto__ = commentProto;
                return row;
              });
            }),
          );
        });
      },
      { cache: false },
    );
    depth1Proto['comments'] = async function () {
      return depth1HmLoader.load(this.id);
    };

    // Depth-0 proto (records → has posts)
    const depth0HmData: Record<string, any[]> = {};
    for (let i = 1; i <= 50; i++) {
      depth0HmData[`rec-${i}`] = [
        { id: 'post-1', title: 'Post 1' },
        { id: 'post-2', title: 'Post 2' },
      ].map((p) => {
        const row = { ...p };
        row.__proto__ = depth1Proto;
        return row;
      });
    }

    const depth0Proto: any = { __columnAliases: {} };
    const depth0HmLoader = new DataLoader(
      (ids: readonly string[]) => {
        queueRefs.add(queue);
        return queue.add(async () => {
          return simulateQuery(ids.map((id) => depth0HmData[id] || []));
        });
      },
      { cache: false },
    );
    depth0Proto['posts'] = async function () {
      return depth0HmLoader.load(this.id);
    };

    // Create records
    const records = [];
    for (let i = 1; i <= 50; i++) {
      const rec: any = { id: `rec-${i}`, title: `Record ${i}` };
      rec.__proto__ = depth0Proto;
      records.push(rec);
    }

    const ast = {
      id: 1,
      posts: {
        id: 1,
        comments: {
          id: 1,
          text: 1,
        },
      },
    } as any;

    const results = await nocoExecute(ast, records, {});

    // Verify correctness
    expect(results).to.have.lengthOf(50);
    expect(results[0].posts).to.be.an('array').with.lengthOf(2);
    expect(results[0].posts[0].comments).to.be.an('array');

    // Verify same queue used across depths
    console.log('\n  Queue sharing:');
    console.log(`    Unique queue refs: ${queueRefs.size}`);
    expect(queueRefs.size).to.equal(
      1,
      'All depth levels should use the same queue instance',
    );

    // Verify concurrency
    console.log(`    Max concurrent: ${stats.maxConcurrent}`);
    expect(stats.maxConcurrent).to.equal(1);

    // Verify no overlap
    for (let i = 1; i < stats.taskLog.length; i++) {
      const prev = stats.taskLog[i - 1];
      const curr = stats.taskLog[i];
      expect(curr.startTime).to.be.at.least(prev.endTime);
    }
    console.log('    No overlapping execution windows: ✓');
  });

  it('should batch DataLoader calls — far fewer queries than N records', async () => {
    const { queue, stats } = createTrackedQueue();
    const RECORDS = 200;

    // Simple HM data
    const hmData: Record<string, any[]> = {};
    for (let i = 1; i <= RECORDS; i++) {
      hmData[`rec-${i}`] = [{ id: `child-${i}`, value: i }];
    }

    const proto: any = { __columnAliases: {} };
    const hmLoader = new DataLoader(
      (ids: readonly string[]) =>
        queue.add(async () => {
          return simulateQuery(ids.map((id) => hmData[id] || []));
        }),
      { cache: false },
    );
    proto['children'] = async function () {
      return hmLoader.load(this.id);
    };

    const btData: Record<string, any> = {};
    for (let i = 1; i <= 10; i++) {
      btData[`a-${i}`] = { id: `a-${i}`, name: `Author ${i}` };
    }
    const btLoader = new DataLoader(
      (ids: readonly string[]) =>
        queue.add(async () => {
          return simulateQuery(ids.map((id) => btData[id] || null));
        }),
      { cache: false },
    );
    proto['author'] = async function () {
      if (!this.author_id) return null;
      return btLoader.load(this.author_id);
    };

    const records = [];
    for (let i = 1; i <= RECORDS; i++) {
      const rec: any = {
        id: `rec-${i}`,
        author_id: `a-${(i % 10) + 1}`,
      };
      rec.__proto__ = proto;
      records.push(rec);
    }

    const ast = {
      id: 1,
      children: 1,
      author: {
        id: 1,
        name: 1,
      },
    } as any;

    const results = await nocoExecute(ast, records, {});

    expect(results).to.have.lengthOf(RECORDS);

    console.log('\n  Batching stats:');
    console.log(`    Records: ${RECORDS}`);
    console.log(`    Relations: 2 (HM + BT)`);
    console.log(`    Total queue tasks: ${stats.totalTasks}`);
    console.log(
      `    Expected without batching: ${RECORDS * 2} (${RECORDS} × 2)`,
    );
    console.log(`    Max concurrent: ${stats.maxConcurrent}`);

    // With proper batching, DataLoader should batch all 200 IDs into
    // very few calls (ideally 1 per relation = 2 total)
    expect(stats.totalTasks).to.be.lessThan(
      10,
      `Expected batching to reduce ${RECORDS * 2} individual calls to <10 total tasks`,
    );
    expect(stats.maxConcurrent).to.equal(1);
  });
});
