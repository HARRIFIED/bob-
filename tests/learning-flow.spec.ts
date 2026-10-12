import { wireArchitecture } from './architecture-helpers';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a Mission', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Engineering requirements' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Production Simulator' }).click();
}
async function run(page: Page) {
  await page.getByRole('button', { name: /Run Simulation|Run Again/ }).click();
  await expect(page.getByRole('button', { name: 'Run Again' })).toBeEnabled({ timeout: 12000 });
}
async function addSolution(page: Page) {
  await page.getByRole('button', { name: 'Add API Server Medium', exact: true }).click({ clickCount: 2, delay: 100 });
  await wireArchitecture(page);
  await page.getByRole('button', { name: 'Add Redis Cache', exact: true }).click();
  await wireArchitecture(page);
}

test('complete incident diagnosis, wrong turn, recovery, debrief and replay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  await expect(page.getByText('$920', { exact: true }).first()).toBeVisible();
  await run(page);
  await expect(page.getByLabel('p95 latency failed: 827ms')).toBeVisible();
  await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  await expect(page.getByText('Database connection timeout · pool exhausted')).toBeVisible();
  await page.getByRole('tab', { name: 'Traces', exact: true }).click();
  await expect(page.getByText('434 ms', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add API Server Medium', exact: true }).click({ clickCount: 2, delay: 100 });
  await wireArchitecture(page);
  await expect(page.getByText('PREVIOUS RUN · RERUN TO UPDATE')).toBeVisible();
  await run(page);
  await expect(page.getByText(/You added more compute, but PostgreSQL is still saturated/)).toBeVisible();
  await page.getByRole('button', { name: 'Add Redis Cache', exact: true }).click();
  await wireArchitecture(page);
  await page.getByRole('tab', { name: 'Cost', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Redis Cache', exact: true })).toBeVisible();
  await run(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mission stable.' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '145 ms', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '$1,340', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Replay Mission' }).click();
  await expect(page.getByRole('button', { name: 'Run Simulation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect API Server 03' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reduced motion runs instantly and over-budget performance cannot complete the mission', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await addSolution(page);
  await page.getByRole('button', { name: 'Add API Server Medium', exact: true }).click({ clickCount: 2, delay: 100 });
  await wireArchitecture(page);
  await run(page);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText(/Performance looks good, but this design is over budget/)).toBeVisible();
  await expect(page.getByLabel('Monthly cost failed: $1,580')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip animation' })).toHaveCount(0);
});

test('keyboard controls add, resize, disconnect, reconnect, and remove components', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  const add = page.getByRole('button', { name: 'Add API Server Medium', exact: true });
  await add.focus(); await page.keyboard.press('Enter');
  await wireArchitecture(page);
  const node = page.getByRole('button', { name: 'Inspect API Server 03', exact: true });
  await node.focus(); await page.keyboard.press('Enter');
  await page.getByLabel('Instance size').selectOption('api-small');
  await page.getByRole('button', { name: 'Disconnect API Server 03 from PostgreSQL' }).click();
  await run(page);
  await page.getByRole('button', { name: 'Back to mission' }).click();
  await expect(page.getByText(/There’s a broken request path/)).toBeVisible();
  await node.focus(); await page.keyboard.press('Enter');
  await page.getByLabel('Connect to', { exact: true }).selectOption('db');
  await page.getByRole('button', { name: 'Add connection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disconnect API Server 03 from PostgreSQL' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove component' }).click();
  await expect(node).toHaveCount(0);
  await page.getByRole('tab', { name: 'Metrics', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Logs', exact: true })).toBeFocused();
});

test('skip animation commits final peak results', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Run Simulation' }).click();
  await page.getByRole('button', { name: 'Skip animation' }).click();
  await expect(page.getByLabel('p95 latency failed: 827ms')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Again' })).toBeEnabled();
});

test('mission runs with network disabled after initial load', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await context.setOffline(true);
  await addSolution(page);
  await run(page);
  await expect(page.getByRole('heading', { name: 'Mission stable.' })).toBeVisible();
});

test('landing, briefing, workspace, and debrief pass accessibility checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const stage of ['entry', 'brief', 'workspace', 'debrief']) {
    if (stage === 'brief') await page.getByRole('button', { name: 'Start a Mission', exact: true }).click();
    if (stage === 'workspace') await page.getByRole('button', { name: 'Open Production Simulator' }).click();
    if (stage === 'debrief') { await addSolution(page); await run(page); }
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await page.screenshot({ path: test.info().outputPath(`${stage}.png`), fullPage: true });
    expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), stage).toEqual([]);
  }
});

test('mobile panels remain usable without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start a Mission', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Start a Mission', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open Production Simulator' }).click();
  await page.getByRole('button', { name: 'Components', exact: true }).click();
  await addSolution(page);
  await page.getByRole('button', { name: 'Architecture', exact: true }).click();
  await run(page);
  await expect(page.getByRole('heading', { name: 'Mission stable.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Inspect your system' }).click();
  await page.getByRole('button', { name: 'Mission', exact: true }).click();
  await expect(page.getByLabel('p95 latency passed: 145ms')).toBeVisible();
});
