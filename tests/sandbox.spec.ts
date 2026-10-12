import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

async function enter(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sandbox Mode' }).click();
  await expect(page.getByRole('heading', { name: 'Experiment settings' })).toBeVisible();
}
test('sandbox workload, fault controls, saving, imports and preview limits are honest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  await page.getByLabel('Peak traffic (req/s)').fill('2000');
  await page.getByRole('button', { name: 'Run Simulation', exact: true }).click();
  await expect(page.getByText('RUN COMPLETE', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Starting template').selectOption('transfers');
  await page.getByRole('button', { name: 'Use template' }).click();
  await page.getByLabel('Lose two responses after commit').uncheck();
  await page.getByRole('button', { name: 'Run Simulation', exact: true }).click();
  await expect(page.locator('.ledger-verdict')).toContainText('0 duplicate debits');
  await expect(page.locator('.ledger-verdict')).toContainText('3/3 transfers confirmed');
  await page.getByLabel('Project name').fill('Outbox ideas');
  await page.getByRole('button', { name: 'Add Change Data Capture', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run Again', exact: true })).toBeEnabled();
  await expect(page.locator('.sandbox-controls')).toContainText('Change Data Capture is design-only');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved in this browser.', { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloadEvent;
  const path = test.info().outputPath('project.json');
  await download.saveAs(path);
  await page.reload();
  await page.getByRole('button', { name: 'Sandbox Mode' }).click();
  await page.getByRole('button', { name: 'Load saved', exact: true }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Outbox ideas');
  await expect(page.getByRole('button', { name: 'Inspect Change Data Capture' })).toHaveCount(1);
  await page.getByLabel('Import JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('.sandbox-controls [role="status"]')).toContainText('Invalid sandbox file');
  await expect(page.getByLabel('Project name')).toHaveValue('Outbox ideas');
  await page.getByLabel('Import JSON').setInputFiles(path);
  await expect(page.locator('.sandbox-controls [role="status"]')).toContainText('Sandbox imported');
  await expect(page.getByText('NO DATA YET', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit architecture to view' }).click();
  await page.screenshot({ path: test.info().outputPath('sandbox-desktop.png'), fullPage: true });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  expect(errors).toEqual([]);
});

test('dragging preserves edges, viewport and measurements; add/drop never wire automatically', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Run Simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Fit architecture to view' }).click();
  const node = page.locator('.react-flow__node[data-id="api-1"]');
  const viewport = page.locator('.react-flow__viewport');
  await expect(node).toBeVisible();
  const before = await viewport.getAttribute('style');
  const original = await node.getAttribute('style');
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 55, box.y + 55, { steps: 10 });
  await expect(page.locator('.react-flow__edge')).toHaveCount(5);
  await page.mouse.up();
  await expect(node).not.toHaveAttribute('style', original!);
  await expect(viewport).toHaveAttribute('style', before!);
  await expect(page.getByText('CHANGES PENDING', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo diagram edit' }).click();
  await expect(node).toHaveAttribute('style', original!);
  await page.getByRole('button', { name: 'Add API Server Medium', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(5);
  await expect(page.getByText('CHANGES PENDING', { exact: true })).toBeVisible();
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer(); data.setData('application/bob-component', 'redis'); return data;
  });
  const frame = (await page.locator('.flow-container').boundingBox())!;
  await page.locator('.flow-container').dispatchEvent('drop', { dataTransfer: transfer, clientX: frame.x + 100, clientY: frame.y + 100 });
  await expect(page.locator('.react-flow__node[data-id="redis-1"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(5);
  await page.getByRole('button', { name: 'Undo diagram edit' }).click();
  await expect(page.locator('.react-flow__node[data-id="redis-1"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo diagram edit' }).click();
  await expect(page.locator('.react-flow__node[data-id="redis-1"]')).toHaveCount(1);
});

test('component settings and injected faults change the measured experiment', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Add Redis Cache', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Redis Cache', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Cache memory').selectOption('1');
  await expect(page.locator('.topbar-budget strong')).toContainText('$980');
  await page.getByRole('button', { name: 'Back to experiment', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect API Server 01', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('radio', { name: 'Take offline' }).check();
  await expect(page.locator('.react-flow__node[data-id="api-1"] .node-fault')).toHaveText('OFF');
  await page.getByRole('button', { name: 'Run Simulation', exact: true }).click();
  await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  await expect(page.getByText('Injected fault · API Server 01 is offline')).toBeVisible();
  await page.getByRole('radio', { name: 'No fault' }).check();
  await expect(page.locator('.react-flow__node[data-id="api-1"] .node-fault')).toHaveCount(0);
  await expect(page.getByText('CHANGES PENDING', { exact: true })).toBeVisible();
});

test('presets, live mode, challenges, share links, and design notes make the sandbox a playground', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await enter(page);
  await page.getByLabel('Workload preset').selectOption('feed');
  await expect(page.getByLabel('Peak traffic (req/s)')).toHaveValue('30000');
  await page.getByLabel('Live mode: re-measure after every change').check();
  await expect(page.getByText('RUN 01 · COMPLETE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Redis Cache', exact: true }).click();
  await expect(page.getByText('RUN 02 · COMPLETE', { exact: true })).toBeVisible();
  await expect(page.getByText('CHANGES PENDING', { exact: true })).toHaveCount(0);

  await page.getByLabel('Design challenge').selectOption('cost-cutter');
  await expect(page.locator('.sandbox-controls')).toContainText('Serve 12,000 balance requests per second');
  await expect(page.getByLabel('Peak traffic (req/s)')).toBeDisabled();
  await expect(page.getByRole('heading', { name: /Payday on a shoestring/ })).toBeVisible();

  const notes = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Design notes', exact: true }).click();
  expect((await notes).suggestedFilename()).toBe('untitled-experiment.md');

  await page.getByRole('button', { name: 'Share link', exact: true }).click();
  const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(link).toContain('#share=');
  const shared = await context.newPage();
  await shared.goto(link);
  await expect(shared.getByRole('heading', { name: 'Experiment settings' })).toBeVisible();
  await expect(shared.getByRole('button', { name: 'Inspect Redis Cache', exact: true })).toHaveCount(1);
  await expect(shared.getByLabel('Design challenge')).toHaveValue('cost-cutter');
  await expect.poll(() => shared.evaluate(() => window.location.hash)).toBe('');
});

test('empty board, new catalog and mobile settings remain usable offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sandbox Mode' }).click();
  await page.getByRole('button', { name: 'Experiment', exact: true }).click();
  await page.getByLabel('Starting template').selectOption('blank');
  await page.getByRole('button', { name: 'Use template' }).click();
  await page.getByRole('button', { name: 'Components', exact: true }).click();
  await expect.poll(() => page.locator('.palette img').evaluateAll(images => images.every(i => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await context.setOffline(true);
  for (const name of ['MySQL', 'MongoDB', 'Kubernetes', 'Change Data Capture', 'Background Worker']) {
    await page.getByRole('button', { name: 'Add ' + name, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Architecture', exact: true }).click();
  await page.getByRole('button', { name: 'Fit architecture to view' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run Simulation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run Again', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('sandbox-mobile.png'), fullPage: true });
});
