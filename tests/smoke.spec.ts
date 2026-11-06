import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`telas principais renderizam sem erros em ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    for (const [path, heading] of [
      ['/', 'Painel gerencial'],
      ['/orcamentos', 'Orçamentos'],
      ['/orcamentos/novo', 'Novo orçamento'],
      ['/clientes', 'Clientes e obras'],
      ['/funil', 'Funil comercial'],
      ['/configuracoes', 'Configurações'],
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }
    expect(errors).toEqual([])
  })
}

test('calculadora de volume soma elementos', async ({ page }) => {
  await page.goto('/orcamentos/novo')
  await page.getByLabel('Compr. (m)').first().fill('12')
  await page.getByLabel('Largura (m)').first().fill('8')
  await page.getByLabel('Espessura (cm)').first().fill('12')
  await expect(page.getByText('11,520 m³').first()).toBeVisible()
})
