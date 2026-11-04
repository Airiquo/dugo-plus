export * from '../../web/src/services/inventory.js'
export async function screenDonorMatch(...input) { window.fixture.writes.push({ kind: 'screen', input }) }
export async function confirmDonation(input) { window.fixture.writes.push({ kind: 'donation', input }) }
