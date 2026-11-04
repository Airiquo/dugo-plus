export async function listHospitalResponses() {
  return { rows: [{ id: 'fixture-match', responseStatus: 'Accepted', responseLabel: 'Responded', donationStage: 'Processing', acceptanceVersion: 1, donor: { fullName: 'Fixture Donor', bloodType: 'O+', city: 'Fixture city' } }], nextCursor: null }
}
