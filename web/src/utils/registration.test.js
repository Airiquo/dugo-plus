import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRegister } from './validate.js'
const valid={name:'Maria Santos',email:'maria@example.test',password:'StrongPass123',confirmPassword:'StrongPass123',gender:'Female',dateOfBirth:'1998-04-12',bloodType:'O+',consent:true}
test('registration validates identity, confirmation and real calendar dates together',()=>{
 assert.deepEqual(validateRegister(valid),{})
 const errors=validateRegister({...valid,confirmPassword:'different',gender:'',bloodType:'',dateOfBirth:'2024-02-31'})
 for(const key of ['confirmPassword','gender','bloodType','dateOfBirth'])assert.ok(errors[key])
 assert.ok(validateRegister({...valid,consent:false}).consent)
})
