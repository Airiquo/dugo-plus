import test from 'node:test'
import assert from 'node:assert/strict'
import { sortRows, sortDate } from './sortRows.js'
test('numeric values sort numerically in both directions without changing source or tie order', () => {
 const rows=[{id:'a',v:10},{id:'b',v:2},{id:'c',v:2}]
 assert.deepEqual(sortRows(rows,row=>row.v,'asc').map(row=>row.id),['b','c','a'])
 assert.deepEqual(sortRows(rows,row=>row.v,'desc').map(row=>row.id),['a','b','c'])
 assert.deepEqual(rows.map(row=>row.id),['a','b','c'])
})
test('text ordering ignores case and compares numeric portions naturally',()=>{
 const rows=['Hospital 10','hospital 2','Alpha'].map(v=>({v}))
 assert.deepEqual(sortRows(rows,row=>row.v).map(row=>row.v),['Alpha','hospital 2','Hospital 10'])
})
test('missing dates/distances remain last even when descending; zero remains valid',()=>{
 const rows=[{v:null},{v:0},{v:Infinity},{v:3},{v:undefined}]
 assert.deepEqual(sortRows(rows,row=>row.v,'desc').map(row=>row.v),[3,0,null,Infinity,undefined])
 assert.equal(sortDate(0),0)
 assert.equal(sortDate('not a date'),null)
 assert.equal(sortDate({toDate:()=>new Date('2026-01-02')}),new Date('2026-01-02').getTime())
})
test('sorting the filtered collection before slicing gives the correct second page',()=>{
 const rows=Array.from({length:25},(_,v)=>({v:24-v}))
 assert.deepEqual(sortRows(rows,row=>row.v).slice(10,20).map(row=>row.v),[10,11,12,13,14,15,16,17,18,19])
 assert.equal(sortRows(rows,null),rows)
})
