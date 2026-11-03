import test from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, exportValue, tableCsv, tablePrintHtml, collectExportPages } from './tableExport.js'
const columns=[{label:'Name',value:row=>row.name},{label:'Units',value:row=>row.units}]
test('CSV preserves Unicode, quotes, commas and multiline text with a UTF-8 BOM and CRLF records',()=>{
 const csv=tableCsv(columns,[{name:'Dugo+, "José"\nCruz',units:2}])
 assert.equal(csv,'\uFEFF"Name","Units"\r\n"Dugo+, ""José""\nCruz","2"\r\n')
 assert.equal(tableCsv(columns,[]),'\uFEFF"Name","Units"\r\n')
})
test('CSV neutralizes spreadsheet formulas in user text without changing numeric negatives',()=>{
 for(const text of ['=SUM(A1:A2)','+123','-cmd','@SUM(A1)',' \t=HYPERLINK("x")'])assert.ok(csvCell(text).startsWith('"\''))
 assert.equal(csvCell(-3),'"-3"')
 assert.equal(exportValue({toDate:()=>new Date('2026-11-03T00:00:00Z')}),'2026-11-03T00:00:00.000Z')
 assert.equal(exportValue(new Date('invalid')),'')
})
test('PDF print HTML escapes untrusted content and includes every record with repeated print headers',()=>{
 const rows=Array.from({length:137},(_,i)=>({name:i===136?'<script>alert("x")</script>':'Person '+i,units:i}))
 const html=tablePrintHtml('<img onerror=x>','Filtered results',columns,rows,new Date('2026-11-03'))
 assert.equal((html.match(/<tr>/g)||[]).length,138)
 assert.ok(html.includes('&lt;script&gt;'))
 assert.ok(!html.includes('<script>'))
 assert.ok(!html.includes('<img onerror'))
 assert.ok(html.includes('display:table-header-group'))
 assert.ok(html.includes('137 records'))
 assert.ok(tablePrintHtml('Empty','All table data',columns,[]).includes('No records match'))
})
test('complete export traverses every cursor beyond one screen and reports progress',async()=>{
 const calls=[],progress=[]
 const rows=await collectExportPages(async cursor=>{calls.push(cursor);const page=cursor??0;return{events:Array.from({length:25},(_,i)=>({id:page*25+i})),nextCursor:page===4?null:page+1}},{rowsKey:'events',cursorKey:'nextCursor',onProgress:n=>progress.push(n)})
 assert.equal(rows.length,125);assert.equal(rows.at(-1).id,124);assert.deepEqual(calls,[null,1,2,3,4]);assert.deepEqual(progress,[25,50,75,100,125])
})
test('exports fail instead of returning truncated data on a failed, malformed or repeated page',async()=>{
 await assert.rejects(collectExportPages(async cursor=>{if(cursor)throw new Error('Quota exceeded');return{rows:[1],cursor:'next'}}),/Quota exceeded/)
 await assert.rejects(collectExportPages(async()=>({rows:[1],cursor:'same'})),/data changed/)
 await assert.rejects(collectExportPages(async()=>({rows:[],cursor:'next'})),/data changed/)
 await assert.rejects(collectExportPages(async()=>({rows:null})),/invalid/)
 // Firestore snapshots may be new objects with the same document identity.
 await assert.rejects(collectExportPages(async()=>({rows:[1],cursor:{id:'same'}})),/data changed/)
})
