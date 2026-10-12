import { wireArchitecture } from './architecture-helpers';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function enter(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a Mission', exact: true }).click();
  await page.getByRole('button', { name: 'Open Production Simulator' }).click();
}

async function drag(page: Page, handle: Locator, x: number, y: number) {
  const box = (await handle.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + x, start.y + y, { steps: 12 });
  await page.mouse.up();
}

const width = async (locator: Locator) => Math.round((await locator.boundingBox())!.width);
const height = async (locator: Locator) => Math.round((await locator.boundingBox())!.height);

test('all three panels resize with a pointer, stay bounded, and preserve telemetry', async ({ page }) => {
  await enter(page);
  await wireArchitecture(page);
  await page.getByRole('button', { name: 'Run Simulation' }).click();
  await expect(page.getByLabel('p95 latency failed: 827ms')).toBeVisible();
  const palette = page.getByRole('complementary', { name: 'Component palette' });
  const mission = page.getByRole('complementary', { name: 'Mission and component details' });
  const dock = page.getByRole('region', { name: 'Observability dock' });
  const left = page.getByRole('separator', { name: 'Resize Components panel' });
  const right = page.getByRole('separator', { name: 'Resize Mission panel' });
  const bottom = page.getByRole('separator', { name: 'Resize observability panel' });
  const initial = { left: await width(palette), right: await width(mission), bottom: await height(dock) };

  await drag(page, left, 55, 0);
  await expect.poll(() => width(palette)).toBe(initial.left + 55);
  await drag(page, right, -70, 0);
  await expect.poll(() => width(mission)).toBe(initial.right + 70);
  await drag(page, bottom, 0, 90);
  await expect.poll(() => height(dock)).toBe(initial.bottom - 90);
  await expect(page.getByLabel('p95 latency failed: 827ms')).toBeVisible();
  await expect(page.getByText('CHANGES PENDING', { exact: true })).toHaveCount(0);

  await left.dblclick();
  await expect.poll(() => width(palette)).toBe(initial.left);
  await bottom.focus(); await page.keyboard.press('ArrowUp');
  await expect.poll(() => height(dock)).toBe(initial.bottom - 90 + 16);

  await page.setViewportSize({ width: 950, height: 700 });
  await expect.poll(() => width(page.getByRole('region', { name: 'System architecture' }))).toBeGreaterThanOrEqual(320);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('small-desktop-resized.png'), fullPage: true });
});

test('icon rail and collapsed mission retain accessible controls and reopen the inspector', async ({ page }) => {
  await enter(page);
  const palette = page.getByRole('complementary', { name: 'Component palette' });
  const left = page.getByRole('separator', { name: 'Resize Components panel' });
  await page.getByLabel('Search components').fill('redis');
  await left.focus(); await page.keyboard.press('Home');
  await expect.poll(() => width(palette)).toBe(60);
  await expect(page.getByLabel('Search components')).not.toBeVisible();
  const addMedium = page.getByRole('button', { name: 'Add API Server Medium', exact: true });
  await expect(addMedium).toBeVisible();
  await expect(addMedium).toHaveAttribute('title', /API Server Medium/);
  await addMedium.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Inspect API Server 03' })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse Mission panel' }).click();
  await expect(page.getByRole('heading', { name: 'Mission objectives' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand Mission panel' })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect API Server 03' }).click();
  await expect(page.getByLabel('Instance size')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Component details' })).toBeVisible();
  await left.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Search components')).toBeVisible();
  await expect(page.getByLabel('Search components')).toHaveValue('redis');
  await expect.poll(() => width(palette)).toBe(226);
  const right = page.getByRole('separator', { name: 'Resize Mission panel' });
  await right.focus(); await page.keyboard.press('Enter');
  await expect(right).toHaveAttribute('aria-valuetext', 'Collapsed');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Instance size')).toBeVisible();
});

test('expanded architecture fits a larger graph and restores panel sizes, tabs, and keyboard focus', async ({ page }) => {
  await enter(page);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Add API Server Medium', exact: true }).click();
  await page.getByRole('button', { name: 'Run Simulation' }).click();
  await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse Components to icons' }).click();
  await page.getByRole('button', { name: 'Collapse Mission panel' }).click();
  await page.getByRole('button', { name: 'Collapse observability panel' }).click();
  const dock = page.getByRole('region', { name: 'Observability dock' });
  await expect.poll(() => height(dock)).toBe(44);
  await expect(page.getByRole('tabpanel')).not.toBeVisible();
  const collapsedAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(collapsedAudit.violations.map(v => v.id)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('compact-workspace.png'), fullPage: true });

  await page.getByRole('button', { name: 'Expand architecture', exact: true }).click();
  const canvas = page.getByRole('region', { name: 'System architecture' });
  await expect.poll(() => width(canvas)).toBe(1440);
  await expect(page.getByRole('complementary', { name: 'Component palette' })).not.toBeVisible();
  await expect(dock).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const frame = document.querySelector('.flow-container')!.getBoundingClientRect();
    return [...document.querySelectorAll('.react-flow__node')].every(node => {
      const box = node.getBoundingClientRect();
      return box.left >= frame.left && box.right <= frame.right && box.top >= frame.top && box.bottom <= frame.bottom;
    });
  })).toBe(true);
  const expandedAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(expandedAudit.violations.map(v => v.id)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('expanded-architecture.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Expand architecture', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Expand Components panel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand Mission panel' })).toBeVisible();
  await expect.poll(() => height(dock)).toBe(44);
  await expect(page.getByRole('tab', { name: 'Logs', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  await expect(page.getByText('Database connection timeout · pool exhausted')).toBeVisible();
  await expect.poll(() => height(dock)).toBe(325);

  await page.getByRole('button', { name: 'Expand architecture', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect API Server 06' }).click();
  await expect(page.getByLabel('Instance size')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand architecture', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand Components panel' })).toBeVisible();
});

test('tablet tabs still expose the inspector and allow collapsing telemetry', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await enter(page);
  await expect(page.getByRole('separator')).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect API Server 01' }).click();
  await expect(page.getByLabel('Instance size')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspector', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Collapse observability panel' }).click();
  await expect(page.getByRole('tabpanel')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Cost', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Estimated monthly infrastructure cost' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
