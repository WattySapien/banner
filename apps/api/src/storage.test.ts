import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("SQLite development storage authenticates users and persists sessions",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"clipx-sqlite-test-"));
  const databasePath=path.join(directory,"clipx.db");
  const {SQLiteStorage}=await import("./storage.sqlite.js");
  try{
    const storage=new SQLiteStorage(databasePath);
    const created=await storage.createLocalUser("local-test@clipx.local","ClipXLocal123");
    const authenticated=await storage.authenticateLocalUser(created.email,"ClipXLocal123");
    assert.equal(authenticated?.id,created.id);
    const account=await storage.createAdminAccount(created.id,{name:"Everyday checking",type:"checking",maskedNumber:"1001",openingBalance:250.75});
    assert.equal(account.type,"checking");
    assert.equal(account.balance,250.75);
    assert.equal(account.accountNumber,undefined);
    const updatedAccount=await storage.updateAdminAccount(created.id,account.id,{name:"Primary savings",type:"savings",maskedNumber:"2002"});
    assert.equal(updatedAccount.name,"Primary savings");
    assert.equal(updatedAccount.type,"savings");
    assert.equal(updatedAccount.maskedNumber,"2002");
    assert.equal(updatedAccount.balance,250.75);
    const numberedAccount=await storage.assignAdminAccountNumber(created.id,account.id);
    assert.match(numberedAccount.accountNumber??"",/^\d{10}$/);
    assert.equal(numberedAccount.maskedNumber,numberedAccount.accountNumber?.slice(-4));
    assert.equal((await storage.getAccounts(created.id))[0]?.accountNumber,numberedAccount.accountNumber);
    const renamedNumberedAccount=await storage.updateAdminAccount(created.id,account.id,{name:"Permanent number savings"});
    assert.equal(renamedNumberedAccount.accountNumber,numberedAccount.accountNumber);
    await assert.rejects(()=>storage.assignAdminAccountNumber(created.id,account.id),/already been assigned/);
    await assert.rejects(()=>storage.updateAdminAccount(created.id,account.id,{maskedNumber:"9999"}),/locked after an account number is assigned/);
    await assert.rejects(()=>storage.updateAdminAccount(randomUUID(),account.id,{type:"checking"}),/Customer account not found/);
    await assert.rejects(()=>storage.assignAdminAccountNumber(randomUUID(),account.id),/Customer account not found/);
    await storage.createSession(created.id,"test-token-hash",new Date(Date.now()+60_000));
    assert.equal((await storage.getSessionUser("test-token-hash"))?.id,created.id);
    await storage.updateAdminUser(created.id,{isActive:false});
    assert.equal(await storage.getSessionUser("test-token-hash"),undefined);
    await storage.createSession(created.id,"legacy-suspended-token",new Date(Date.now()+60_000));
    await storage.updateAdminUser(created.id,{isActive:true});
    assert.equal(await storage.getSessionUser("test-token-hash"),undefined);
    assert.equal(await storage.getSessionUser("legacy-suspended-token"),undefined);
    assert.equal((await storage.authenticateLocalUser(created.email,"ClipXLocal123"))?.id,created.id);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});

test("concurrent transfers cannot overdraw an account",{skip:!process.env.TEST_DATABASE_URL},async()=>{
  process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
  const [{getDatabase,closeDatabase},{PostgresStorage}]=await Promise.all([import("@clipx/database"),import("./storage.js")]);
  const sql=getDatabase();
  const storage=new PostgresStorage();
  const userId=randomUUID();
  const accountId=randomUUID();
  const beneficiaryId=randomUUID();
  await sql.begin(async(tx)=>{
    await tx`INSERT INTO users (id,email,first_name,last_name) VALUES (${userId},${`${userId}@test.clipx.local`},'Transfer','Test')`;
    await tx`INSERT INTO accounts (id,user_id,name,type,masked_number,balance_cents,available_balance_cents) VALUES (${accountId},${userId},'Test checking','checking','0001',10000,10000)`;
    await tx`INSERT INTO beneficiaries (id,user_id,name,bank_name,masked_account,initials) VALUES (${beneficiaryId},${userId},'Recipient','Test Bank','••0002','R')`;
  });
  try{
    const attempts=await Promise.allSettled([
      storage.createTransfer(userId,{sourceAccountId:accountId,beneficiaryId,amount:75,note:"Concurrent A"}),
      storage.createTransfer(userId,{sourceAccountId:accountId,beneficiaryId,amount:75,note:"Concurrent B"}),
    ]);
    assert.equal(attempts.filter((attempt)=>attempt.status==="fulfilled").length,1);
    assert.equal(attempts.filter((attempt)=>attempt.status==="rejected").length,1);
    const [account]=await sql<Array<{balance_cents:number;available_balance_cents:number}>>`SELECT balance_cents,available_balance_cents FROM accounts WHERE id=${accountId}`;
    assert.equal(Number(account.balance_cents),2500);
    assert.equal(Number(account.available_balance_cents),2500);
  }finally{
    await sql`DELETE FROM users WHERE id=${userId}`;
    await closeDatabase();
  }
});
