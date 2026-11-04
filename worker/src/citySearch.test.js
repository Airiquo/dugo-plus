import test from 'node:test'
import assert from 'node:assert/strict'
import { searchCities } from './citySearch.js'

test('city search is bounded to PH and caches normalized suggestions', async () => {
  let calls=0
  const options={now:()=>1_000_000,minimumGapMs:0,endpoint:'https://fixture.test/search',fetcher:async url=>{
    calls++; assert.equal(url.searchParams.get('countrycode'),'PH'); assert.equal(url.searchParams.get('limit'),'8')
    return Response.json({features:[{properties:{countrycode:'PH',osm_key:'place',osm_value:'city',name:'Malolos',state:'Bulacan'}},{properties:{countrycode:'PH',city:'Malolos',state:'Bulacan'}},{properties:{countrycode:'DE',city:'Berlin'}}]})
  }}
  assert.deepEqual((await searchCities({query:'Malolos'},options)).cities,['Malolos, Bulacan'])
  await searchCities({query:'malolos'},options); assert.equal(calls,1)
})
test('invalid searches never reach provider and provider errors keep manual entry available',async()=>{
  await assert.rejects(searchCities({query:'ab'},{fetcher:()=>{throw Error('should not run')}}),/3–120/)
  await assert.rejects(searchCities({query:'Cebu'},{endpoint:'https://fixture.test/fail',minimumGapMs:0,fetcher:async()=>new Response('',{status:503})}),/Enter your city manually/)
})
