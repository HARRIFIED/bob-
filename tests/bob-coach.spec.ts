import { wireArchitecture } from './architecture-helpers';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a Mission', exact: true }).click();
  await page.getByRole('button', { name: 'Open Production Simulator' }).click();
}

test('Bob reacts to runs, stays with the inspector, and points to the evidence', async ({ page }) => {
  await enter(page);
  const bob = page.getByRole('region', { name: 'Bob’s engineering notes' });
  await expect(bob).toHaveAttribute('data-mood', 'curious');
  await bob.getByRole('button', { name: 'Pause Bob’s animations' }).click();
  await expect(bob.locator('.bob-body')).toHaveCSS('animation-name', 'none');
  await bob.getByRole('button', { name: 'High-five Bob' }).click();
  await expect(bob.getByText('High-five! Zero downtime on that one.')).toBeVisible();
  await bob.getByRole('button', { name: 'Give me a hint' }).click();
  await expect(bob.getByText(/Start with the existing system/)).toBeVisible();
  await bob.getByRole('button', { name: 'Run the baseline' }).click();
  await expect(bob).toHaveAttribute('data-mood', 'working');
  await bob.getByRole('button', { name: 'Minimize Bob’s notes' }).click();
  await page.getByRole('button', { name: 'Skip animation' }).click();
  await expect(bob.getByRole('heading', { name: 'We found a bottleneck. That’s progress!' })).toBeVisible();
  await expect(bob.getByText(/Baseline captured/)).toBeVisible();
  await page.getByRole('button', { name: 'Inspect PostgreSQL', exact: true }).click();
  await expect(bob.getByText(/PostgreSQL is at 97% CPU/)).toBeVisible();
  await page.getByRole('button', { name: 'Collapse observability panel' }).click();
  await bob.getByRole('button', { name: 'Find the slow span' }).click();
  await expect(page.getByRole('tab', { name: 'Traces', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Traces', exact: true })).toBeFocused();
  await expect(page.getByText('434 ms', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to mission' }).click();
  const quiz = page.getByRole('region', { name: 'Engineer checkpoint' });
  await quiz.getByRole('button', { name: /Keep adding API servers/ }).click();
  await expect(quiz.getByRole('status')).toContainText('Good hypothesis');
  await quiz.getByRole('button', { name: /Cache repeated balance reads/ }).click();
  await expect(quiz.getByRole('status')).toContainText('You’ve got it!');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(violation => violation.id)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('bob-diagnosis.png'), fullPage: true });
});

test('success, stale edits, consecutive comparisons, and budget checks keep honest feedback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  const bob = page.getByRole('region', { name: 'Bob’s engineering notes' });
  await expect(bob.locator('.bob-body')).toHaveCSS('animation-name', 'none');
  await bob.getByRole('button', { name: 'Run the baseline' }).click();
  await page.getByRole('button', { name: 'Add Redis Cache', exact: true }).click();
  await wireArchitecture(page);
  await expect(bob).toHaveAttribute('data-mood', 'thinking');
  await expect(bob.getByText(/Baseline captured/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Add API Server Medium', exact: true }).click({ clickCount: 2, delay: 100 });
  await wireArchitecture(page);
  await bob.getByRole('button', { name: 'Test this design' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Inspect your system' }).click();
  await expect(bob).toHaveAttribute('data-mood', 'celebrating');
  await expect(bob.getByText(/Latency 682 ms lower; errors 13.8 percentage points lower/)).toBeVisible();
  await page.getByRole('button', { name: 'Run Again', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect your system' }).click();
  await expect(bob.getByText(/Latency unchanged; errors unchanged/)).toBeVisible();
  await page.getByRole('button', { name: 'Add API Server Medium', exact: true }).click({ clickCount: 2, delay: 100 });
  await wireArchitecture(page);
  await bob.getByRole('button', { name: 'Test this design' }).click();
  await expect(bob.getByRole('button', { name: 'Follow the money' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mobile coach and locally served technology icons work offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await page.getByRole('button', { name: 'Components', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add Apache Kafka', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add RabbitMQ Queue', exact: true })).toBeDisabled();
  const icons = page.locator('.palette .technology-icon img');
  await expect(icons).toHaveCount(8);
  await expect.poll(() => icons.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await context.setOffline(true);
  const bob = page.getByRole('region', { name: 'Bob’s engineering notes' });
  await bob.getByRole('button', { name: 'Run the baseline' }).click();
  await bob.getByRole('button', { name: 'Give me a hint' }).click();
  await expect(bob.getByText(/Most requests are repeated balance reads/)).toBeVisible();
  await bob.getByRole('button', { name: 'Find the slow span' }).click();
  await expect(page.getByRole('tab', { name: 'Traces', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('bob-mobile.png'), fullPage: true });
});
