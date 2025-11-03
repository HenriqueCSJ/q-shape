/**
 * Web Worker Pool Manager
 *
 * Manages a pool of Web Workers for parallel CShM calculations.
 * Distributes work across workers, aggregates progress, handles errors.
 *
 * Features:
 * - 4 concurrent workers for true parallelization
 * - Smart work distribution (load balancing)
 * - Comprehensive progress tracking per worker and overall
 * - Automatic cleanup and error handling
 * - Cancellation support
 */

class WorkerPool {
    constructor(numWorkers = 4) {
        this.numWorkers = numWorkers;
        this.workers = [];
        this.workerStatus = [];
        this.taskQueue = [];
        this.results = {};
        this.progressCallbacks = [];
        this.completionCallback = null;
        this.cancelled = false;
        this.startTime = null;
    }

    /**
     * Initialize worker pool
     */
    async initialize() {
        this.workers = [];
        this.workerStatus = [];

        for (let i = 0; i < this.numWorkers; i++) {
            try {
                // Fetch worker code from public folder
                const workerPath = process.env.PUBLIC_URL + '/workers/cshm.worker.js';
                const workerCode = await fetch(workerPath).then(r => {
                    if (!r.ok) throw new Error(`Failed to fetch worker: ${r.status}`);
                    return r.text();
                });
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);

                const worker = new Worker(workerUrl);

                worker.onmessage = (e) => this.handleWorkerMessage(i, e);
                worker.onerror = (error) => this.handleWorkerError(i, error);

                this.workers[i] = worker;
                this.workerStatus[i] = {
                    id: i,
                    busy: false,
                    currentShape: null,
                    progress: 0,
                    stage: 'idle',
                    error: null
                };

                console.log(`Worker ${i} initialized`);
            } catch (error) {
                console.error(`Failed to initialize worker ${i}:`, error);
                // Fallback: reduce worker count
                this.numWorkers = i;
                break;
            }
        }

        if (this.workers.length === 0) {
            throw new Error('Failed to initialize any workers');
        }

        this.notifyProgress();
        return this.workers.length;
    }

    /**
     * Handle message from worker
     */
    handleWorkerMessage(workerId, event) {
        const { type, shapeName, ...data } = event.data;

        if (type === 'progress') {
            this.workerStatus[workerId].progress = data.percentage || 0;
            this.workerStatus[workerId].stage = data.stage || 'working';
            this.notifyProgress();
        }

        if (type === 'result') {
            this.workerStatus[workerId].busy = false;
            this.workerStatus[workerId].currentShape = null;
            this.workerStatus[workerId].progress = 100;
            this.workerStatus[workerId].stage = 'complete';

            this.results[shapeName] = {
                name: shapeName,
                shapeMeasure: data.measure,
                alignedCoords: data.alignedCoords,
                rotationMatrix: data.rotationMatrix,
                workerId
            };

            console.log(`Worker ${workerId} completed ${shapeName}: CShM = ${data.measure.toFixed(4)}`);

            this.notifyProgress();
            this.assignNextTask(workerId);
        }

        if (type === 'error') {
            this.workerStatus[workerId].busy = false;
            this.workerStatus[workerId].error = data.error;
            this.workerStatus[workerId].stage = 'error';

            console.error(`Worker ${workerId} error for ${shapeName}:`, data.error);

            this.results[shapeName] = {
                name: shapeName,
                shapeMeasure: Infinity,
                error: data.error
            };

            this.notifyProgress();
            this.assignNextTask(workerId);
        }
    }

    /**
     * Handle worker error
     */
    handleWorkerError(workerId, error) {
        console.error(`Worker ${workerId} crashed:`, error);
        this.workerStatus[workerId].busy = false;
        this.workerStatus[workerId].error = error.message;
        this.workerStatus[workerId].stage = 'crashed';
        this.notifyProgress();
    }

    /**
     * Assign next task to worker
     */
    assignNextTask(workerId) {
        if (this.cancelled) {
            return;
        }

        if (this.taskQueue.length === 0) {
            // Check if all workers are done
            const allDone = this.workerStatus.every(status => !status.busy);
            if (allDone && this.completionCallback) {
                this.complete();
            }
            return;
        }

        const task = this.taskQueue.shift();
        this.workerStatus[workerId].busy = true;
        this.workerStatus[workerId].currentShape = task.shapeName;
        this.workerStatus[workerId].progress = 0;
        this.workerStatus[workerId].stage = 'starting';
        this.workerStatus[workerId].error = null;

        console.log(`Worker ${workerId} starting ${task.shapeName} (${this.taskQueue.length} remaining in queue)`);

        this.workers[workerId].postMessage({
            type: 'calculate',
            actualCoords: task.actualCoords,
            referenceCoords: task.referenceCoords,
            mode: task.mode,
            shapeName: task.shapeName,
            smartAlignments: task.smartAlignments
        });

        this.notifyProgress();
    }

    /**
     * Submit batch of calculations
     */
    async calculateBatch(tasks, onProgress, onComplete) {
        this.taskQueue = [...tasks];
        this.results = {};
        this.progressCallbacks = [onProgress];
        this.completionCallback = onComplete;
        this.cancelled = false;
        this.startTime = Date.now();

        console.log(`Starting batch calculation: ${tasks.length} geometries across ${this.workers.length} workers`);

        // Initialize workers if needed
        if (this.workers.length === 0) {
            await this.initialize();
        }

        // Assign initial tasks to all workers
        for (let i = 0; i < this.workers.length && this.taskQueue.length > 0; i++) {
            this.assignNextTask(i);
        }
    }

    /**
     * Notify progress callbacks
     */
    notifyProgress() {
        const totalResults = Object.keys(this.results).length;
        const totalTasks = totalResults + this.taskQueue.length +
            this.workerStatus.filter(s => s.busy).length;

        const overallProgress = totalTasks > 0 ? (totalResults / totalTasks) : 0;

        const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
        const estimatedTotal = overallProgress > 0 ? elapsed / overallProgress : 0;
        const estimatedRemaining = estimatedTotal - elapsed;

        const progressData = {
            overallProgress,
            completedCount: totalResults,
            totalCount: totalTasks,
            queueLength: this.taskQueue.length,
            workers: this.workerStatus.map(s => ({
                id: s.id,
                busy: s.busy,
                shape: s.currentShape,
                progress: s.progress,
                stage: s.stage,
                error: s.error
            })),
            results: Object.values(this.results).sort((a, b) => a.shapeMeasure - b.shapeMeasure),
            elapsed: Math.round(elapsed),
            estimatedRemaining: Math.round(estimatedRemaining),
            estimatedTotal: Math.round(estimatedTotal)
        };

        for (const callback of this.progressCallbacks) {
            if (callback) {
                callback(progressData);
            }
        }
    }

    /**
     * Complete the batch
     */
    complete() {
        const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;

        console.log(`Batch calculation complete: ${Object.keys(this.results).length} results in ${elapsed.toFixed(1)}s`);

        const sortedResults = Object.values(this.results)
            .sort((a, b) => a.shapeMeasure - b.shapeMeasure);

        if (this.completionCallback) {
            this.completionCallback({
                results: sortedResults,
                elapsed,
                workerCount: this.workers.length
            });
        }
    }

    /**
     * Cancel ongoing calculations
     */
    cancel() {
        console.log('Cancelling worker pool...');
        this.cancelled = true;
        this.taskQueue = [];

        // Mark all workers as cancelled
        this.workerStatus.forEach(status => {
            if (status.busy) {
                status.stage = 'cancelled';
                status.busy = false;
            }
        });

        this.notifyProgress();
    }

    /**
     * Terminate all workers and cleanup
     */
    terminate() {
        console.log('Terminating worker pool...');
        this.cancelled = true;
        this.taskQueue = [];

        for (const worker of this.workers) {
            if (worker) {
                worker.postMessage({ type: 'terminate' });
                worker.terminate();
            }
        }

        this.workers = [];
        this.workerStatus = [];
        this.results = {};
        this.progressCallbacks = [];
        this.completionCallback = null;
    }
}

/**
 * Singleton instance for app-wide usage
 */
let workerPoolInstance = null;

export function getWorkerPool() {
    if (!workerPoolInstance) {
        workerPoolInstance = new WorkerPool(4);
    }
    return workerPoolInstance;
}

export function terminateWorkerPool() {
    if (workerPoolInstance) {
        workerPoolInstance.terminate();
        workerPoolInstance = null;
    }
}

export default WorkerPool;
