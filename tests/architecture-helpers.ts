import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Build routes through the same accessible inspector controls learners use. */
export async function wireArchitecture(page: Page) {
  const mobile = await page.getByRole('button', { name: 'Architecture', exact: true }).isVisible();
  const returnToComponents = mobile && await page.getByRole('button', { name: 'Components', exact: true }).getAttribute('aria-pressed') === 'true';
  if (mobile) await page.getByRole('button', { name: 'Architecture', exact: true }).click();
  await page.getByRole('button', { name: 'Fit architecture to view' }).click();
  const nodes = await page.locator('.react-flow__node').evaluateAll(elements => elements.map(el => ({
    id: el.getAttribute('data-id')!, label: el.querySelector('button')!.getAttribute('aria-label')!,
  })));
  const cache = nodes.find(n => n.id.startsWith('redis-'));
  const apis = nodes.filter(n => n.id.startsWith('api-'));
  async function inspect(id: string) {
    if (mobile) await page.getByRole('button', { name: 'Architecture', exact: true }).click();
    const button = page.getByRole('button', { name: nodes.find(n => n.id === id)!.label, exact: true });
    await button.focus(); await page.keyboard.press('Enter');
    await expect(page.getByLabel('Component label')).toBeVisible();
  }
  async function connect(target: string) {
    const targetLabel = nodes.find(n => n.id === target)!.label.replace('Inspect ', '');
    if (await page.getByRole('button', { name: new RegExp('^Disconnect .* from ' + targetLabel + '$') }).count()) return;
    await page.getByLabel('Connect to', { exact: true }).selectOption(target);
    await page.getByRole('button', { name: 'Add connection', exact: true }).click();
  }
  await inspect('lb');
  for (const api of apis) await connect(api.id);
  for (const api of apis) {
    await inspect(api.id);
    if (cache) {
      const direct = page.getByRole('button', { name: new RegExp('^Disconnect .* from PostgreSQL$') });
      if (await direct.count()) await direct.click();
    }
    await connect(cache?.id ?? 'db');
  }
  if (cache) { await inspect(cache.id); await connect('db'); }
  await page.getByRole('button', { name: 'Back to mission', exact: true }).click();
  if (mobile) await page.getByRole('button', { name: returnToComponents ? 'Components' : 'Architecture', exact: true }).click();
  else await page.getByRole('button', { name: 'Fit architecture to view' }).click();
}
