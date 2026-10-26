import type { MermaidAppearance } from "@cocurdex/shared";
import type { RenderedDiagram } from "./mermaid-cache";
import {
  type MermaidMessage,
  type MermaidRequest,
  mermaidRenderScript,
} from "./mermaid-document";

export type DiagramJob = { source: string; appearance: MermaidAppearance };

export type RenderedOutput = {
  svg: string;
  width: number;
  height: number;
  png: string | null;
};

type RendererOptions = {
  known(job: DiagramJob): boolean;
  cached(job: DiagramJob): Promise<RenderedDiagram | null>;
  save(job: DiagramJob, output: RenderedOutput): Promise<RenderedDiagram>;
  rendered(job: DiagramJob, diagram: RenderedDiagram): void;
  failed(job: DiagramJob): void;
  startDelayMs?: number;
  timeoutMs?: number;
};

const START_DELAY_MS = 400;
const RENDER_TIMEOUT_MS = 20_000;

const keyOf = ({ source, appearance }: DiagramJob) =>
  `${appearance}\n${source}`;

export function createMermaidRenderer({
  known,
  cached,
  save,
  rendered,
  failed,
  startDelayMs = START_DELAY_MS,
  timeoutMs = RENDER_TIMEOUT_MS,
}: RendererOptions) {
  const pending = new Set<string>();
  const queue: DiagramJob[] = [];
  const listeners = new Set<() => void>();
  let current: { request: MermaidRequest; job: DiagramJob } | null = null;
  let send: ((script: string) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let starting = false;
  let nextId = 0;

  function settle(job: DiagramJob) {
    pending.delete(keyOf(job));
  }

  function fail(job: DiagramJob) {
    settle(job);
    failed(job);
  }

  function start() {
    if (active || starting) return;
    starting = true;
    setTimeout(() => {
      active = true;
      for (const listener of [...listeners]) listener();
    }, startDelayMs);
  }

  function finishCurrent() {
    if (timer) clearTimeout(timer);
    timer = null;
    const finished = current;
    current = null;
    pump();
    return finished;
  }

  function pump() {
    if (current || !send) return;
    const job = queue.shift();
    if (!job) return;
    nextId += 1;
    const request = { id: String(nextId), ...job };
    current = { request, job };
    timer = setTimeout(() => {
      const timedOut = finishCurrent();
      if (timedOut) fail(timedOut.job);
    }, timeoutMs);
    send(mermaidRenderScript(request));
  }

  function enqueue(job: DiagramJob) {
    queue.push(job);
    start();
    pump();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isActive() {
      return active;
    },
    request(job: DiagramJob) {
      const key = keyOf(job);
      if (pending.has(key) || known(job)) return;
      pending.add(key);
      void cached(job)
        .catch(() => null)
        .then((hit) => {
          if (!hit) return enqueue(job);
          settle(job);
          rendered(job, hit);
        });
    },
    attach(sender: (script: string) => void) {
      send = sender;
      pump();
    },
    detach() {
      send = null;
      if (timer) clearTimeout(timer);
      timer = null;
      if (current) queue.unshift(current.job);
      current = null;
    },
    receive(message: MermaidMessage) {
      if (message.type === "ready") return;
      if (current?.request.id !== message.id) return;
      const { job } = current;
      finishCurrent();
      if (message.type === "error") return fail(job);
      const { svg, width, height, png } = message;
      void save(job, { svg, width, height, png })
        .then((diagram) => {
          settle(job);
          rendered(job, diagram);
        })
        .catch(() => fail(job));
    },
  };
}
