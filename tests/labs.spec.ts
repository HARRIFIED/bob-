import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { wireArchitecture } from './architecture-helpers';

async function audit(page: Page, stage: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), stage).toEqual([]);
}

test('a lab teaches with its field guide, measures the fix, and saves progress', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'Component Labs' }).click();
  await expect(page.getByRole('heading', { name: 'Learn one building block at a time.' })).toBeVisible();
  await expect(page.getByText('0/10 LABS', { exact: true })).toBeVisible();
  await audit(page, 'landing with labs');

  await page.getByRole('button', { name: 'Redis field guide' }).click();
  const guide = page.getByRole('dialog', { name: 'Redis' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('link', { name: /Redis documentation/ })).toHaveAttribute('href', 'https://redis.io/docs/latest/');
  await expect(guide).toContainText('In this simulator:');
  await audit(page, 'field guide');
  await guide.getByRole('button', { name: 'Start Shield the database' }).click();

  await expect(page.getByRole('heading', { name: 'Keep database CPU under 75%.' })).toBeVisible();
  await page.getByRole('button', { name: 'Run Simulation', exact: true }).click();
  await expect(page.getByLabel(/^Database CPU failed/)).toBeVisible();
  await expect(page.getByText('IN PROGRESS', { exact: true })).toBeVisible();
  await audit(page, 'lab workspace');
  await page.getByRole('button', { name: 'Add Redis Cache', exact: true }).click();
  await wireArchitecture(page);
  await page.getByRole('button', { name: 'Run Again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lab complete.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Next lab: Right-size the cache/ })).toBeVisible();
  await audit(page, 'lab debrief');
  await page.getByRole('button', { name: 'Close lab debrief' }).click();

  await page.getByRole('button', { name: 'Labs', exact: true }).click();
  await expect(page.getByText('1/10 LABS', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Badges' }).getByRole('listitem').filter({ hasText: 'First Fix' })).toContainText('Earned');
  await page.reload();
  await expect(page.getByText('1/10 LABS', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Next up: Scale out the API tier/ }).click();
  await expect(page.getByRole('heading', { name: 'Serve 5,000 req/s on a $1,000 budget.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('field guides open from the palette and inspector and restore focus on close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a Mission', exact: true }).click();
  await page.getByRole('button', { name: 'Open Production Simulator' }).click();
  const learn = page.getByRole('button', { name: 'Learn about Read Replica' });
  await learn.click();
  await expect(page.getByRole('dialog', { name: 'Read Replica' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Read Replica' })).toHaveCount(0);
  await expect(learn).toBeFocused();
  await page.getByRole('button', { name: 'Inspect PostgreSQL', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('complementary', { name: 'Mission and component details' }).getByRole('button', { name: 'Learn about PostgreSQL' }).click();
  await expect(page.getByRole('dialog', { name: 'PostgreSQL' })).toContainText('Hands-on labs');
  await page.getByRole('button', { name: 'Close field guide' }).click();
  await expect(page.getByLabel('Component label')).toBeVisible();
});

test('a missed quick check returns for review on the landing page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const review = page.getByRole('button', { name: 'Review with Bob' });
  await expect(review).toBeDisabled();
  await page.getByRole('button', { name: 'Start a Mission', exact: true }).click();
  await page.getByRole('button', { name: 'Open Production Simulator' }).click();
  await page.getByRole('button', { name: 'Run Simulation', exact: true }).click();
  await page.getByRole('button', { name: /Keep adding API servers/ }).click();
  await page.getByRole('button', { name: 'Missions', exact: true }).click();
  await expect(page.getByText(/Bob kept 1 quick check you missed/)).toBeVisible();
  await review.click();
  const dialog = page.getByRole('dialog', { name: 'Try these again.' });
  await dialog.getByRole('button', { name: /Cache repeated balance reads/ }).click();
  await expect(dialog.getByRole('status')).toContainText('You’ve got it!');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(review).toBeDisabled();
  await expect(page.getByText(/Quick checks you miss in missions and labs/)).toBeFocused();
});
