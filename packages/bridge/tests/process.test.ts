import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { runCli, type CliOptions } from '../src/providers/process.js';
import { CodexRpc } from '../src/providers/codexRpc.js';
import { CodexProvider } from '../src/providers/codexProvider.js';
import { lesson } from './fixtures.js';

async function fixture(source: string, test: (options: CliOptions) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'omt-process-fixture-'));
  try {
    if (process.platform === 'win32') {
      await mkdir(join(dir, 'node_modules/@openai/codex/bin'), { recursive: true });
      await writeFile(join(dir, 'codex.cmd'), '@echo off');
      await writeFile(join(dir, 'node_modules/@openai/codex/bin/codex.js'), source);
    } else {
      await writeFile(join(dir, 'codex'), `#!${process.execPath}\n${source}`); await chmod(join(dir, 'codex'), 0o755);
    }
    await test({ env: { PATH: dir }, timeoutMs: 1000 });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

describe('bounded subprocess handling (fake process, no model inference)', () => {
  it('times out and terminates a stalled subprocess', async () => {
    await fixture('setInterval(()=>{},1000)', async options => {
      await expect(runCli('codex', [], { ...options, timeoutMs: 50 })).rejects.toMatchObject({ code: 'timeout' });
    });
  });
  it('cancels a running subprocess', async () => {
    await fixture('setInterval(()=>{},1000)', async options => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50);
      try { await expect(runCli('codex', [], options, controller.signal)).rejects.toMatchObject({ code: 'cancelled' }); }
      finally { clearTimeout(timer); }
    });
  });
  it('bounds output instead of accumulating indefinitely', async () => {
    await fixture('process.stdout.write("x".repeat(1100000))', async options => {
      await expect(runCli('codex', [], options)).rejects.toMatchObject({ code: 'invalid_response' });
    });
  });
  it('cancel reaches the initial login-status subprocess, not only inference', async () => {
    await fixture('setInterval(()=>{},1000)', async options => {
      const provider = new CodexProvider(options);
      const start = Date.now();
      const promise = provider.continueLesson(lesson, new AbortController().signal);
      const timer = setTimeout(() => { void provider.cancel(lesson.requestId); }, 50);
      try {
        await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
        expect(Date.now() - start).toBeLessThan(700);
      } finally { clearTimeout(timer); }
    });
  });
});

describe('app-server JSON-RPC transport unit tests (not provider inference)', () => {
  it('initializes, handles fragmented NDJSON and reads model discovery', async () => {
    await fixture(`const readline=require('node:readline');
      readline.createInterface({input:process.stdin}).on('line',line=>{
        const m=JSON.parse(line);if(!('id' in m))return;
        if(!['initialize','model/list'].includes(m.method))process.exit(3);
        const result=m.method==='initialize'?{userAgent:'fixture'}:{data:[]};
        const s=JSON.stringify({id:m.id,result})+'\\n';
        process.stdout.write(s.slice(0,3));setTimeout(()=>process.stdout.write(s.slice(3)),5);
      });`, async options => {
      const rpc = await CodexRpc.connect(options);
      try { expect(await rpc.call('model/list', {})).toEqual({ data: [] }); }
      finally { rpc.close(); }
    });
  });
  it('classifies protocol errors without exposing raw provider diagnostics', async () => {
    await fixture(`require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
      const m=JSON.parse(line);if('id' in m)console.log(JSON.stringify({id:m.id,error:{code:401,message:'Not authenticated private@example.invalid'}}));
    });`, async options => {
      await expect(CodexRpc.connect(options)).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });
  it('rejects malformed JSON and closes all pending calls', async () => {
    await fixture(`process.stdin.on('data',()=>console.log('{malformed'));`, async options => {
      await expect(CodexRpc.connect(options)).rejects.toMatchObject({ code: 'invalid_response' });
    });
  });
  it('bounds initialize time even when the child never responds', async () => {
    await fixture('process.stdin.resume();setInterval(()=>{},1000)', async options => {
      await expect(CodexRpc.connect({ ...options, timeoutMs: 50 })).rejects.toMatchObject({ code: 'timeout' });
    });
  });
});
