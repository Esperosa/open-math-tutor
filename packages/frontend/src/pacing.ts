/** Time limits of the live loop, in one place so the tests and the latency report can name them. */

/** The coach never reacts sooner than this after a change, so the verdict mark is painted first. */
export const COACH_MIN_DELAY_MS = 120;
/** After this long without an answer the tutor says it is still working and offers to cancel. */
export const REQUEST_SLOW_MS = 12_000;
/** A request that has not answered by now is abandoned. */
export const REQUEST_TIMEOUT_MS = 90_000;
