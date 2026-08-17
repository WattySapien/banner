import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("SQLite development storage authenticates users and persists sessions",async()=>{
  process.env.CARD_DATA_ENCRYPTION_KEY=Buffer.alloc(32,7).toString("base64");
  const directory=await mkdtemp(path.join(os.tmpdir(),"clipx-sqlite-test-"));
  const databasePath=path.join(directory,"clipx.db");
  const LegacyDatabase=(await import("better-sqlite3")).default;
  const legacyDatabase=new LegacyDatabase(databasePath);
  legacyDatabase.exec("CREATE TABLE transactions (id TEXT PRIMARY KEY,account_id TEXT NOT NULL,description TEXT NOT NULL,merchant TEXT NOT NULL,category TEXT NOT NULL,amount_cents INTEGER NOT NULL,direction TEXT NOT NULL,status TEXT NOT NULL,reference TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)");
  legacyDatabase.close();
  const {SQLiteStorage}=await import("./storage.sqlite.js");
  try{
    const storage=new SQLiteStorage(databasePath);
    const created=await storage.createLocalUser("local-test@clipx.local","ClipXLocal123","Local","Test");
    const authenticated=await storage.authenticateLocalUser(created.email,"ClipXLocal123");
    assert.equal(authenticated?.id,created.id);
    const supportAdmin=await storage.createLocalUser("support-admin@clipx.local","ClipXLocal123","Support","Admin");
    await assert.rejects(()=>storage.createSupportMessage(created.id,supportAdmin.id,"admin","Unauthorized reply"),/Administrator access required/);
    await storage.updateAdminUser(supportAdmin.id,{isAdmin:true});
    const customerMessage=await storage.createSupportMessage(created.id,created.id,"customer","I need help with my account");
    assert.equal(customerMessage.senderRole,"customer");
    assert.equal(customerMessage.isRead,true);
    assert.equal((await storage.getSupportMessages(created.id,"admin"))[0]?.isRead,false);
    await storage.markSupportMessagesRead(created.id,"admin");
    assert.equal((await storage.getSupportMessages(created.id,"admin"))[0]?.isRead,true);
    const adminReply=await storage.createSupportMessage(created.id,supportAdmin.id,"admin","We are reviewing your account");
    assert.equal(adminReply.senderRole,"admin");
    const customerConversation=await storage.getSupportMessages(created.id,"customer");
    assert.equal(customerConversation.length,2);
    assert.equal(customerConversation[1]?.isRead,false);
    await storage.markSupportMessagesRead(created.id,"customer");
    assert.ok((await storage.getSupportMessages(created.id,"customer")).every((message)=>message.isRead));
    const avatarData=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);
    const userWithAvatar=await storage.updateUserAvatar(created.id,{contentType:"image/png",data:avatarData});
    assert.match(userWithAvatar.profileImageUrl??"",new RegExp(`^/api/avatars/${created.id}\\?v=\\d+$`));
    const storedAvatar=await storage.getUserAvatar(created.id);
    assert.equal(storedAvatar?.contentType,"image/png");
    assert.deepEqual(storedAvatar?.data,avatarData);
    assert.equal((await storage.getAdminUsers()).find((user)=>user.id===created.id)?.profileImageUrl,userWithAvatar.profileImageUrl);
    await assert.rejects(()=>storage.updateUserAvatar(randomUUID(),{contentType:"image/png",data:avatarData}),/Account not found/);
    const account=await storage.createAdminAccount(created.id,{type:"checking",maskedNumber:"1001",openingBalance:250.75});
    assert.equal(account.name,"Local Test");
    assert.equal(account.type,"checking");
    assert.equal(account.balance,250.75);
    assert.equal(account.accountNumber,undefined);
    const updatedAccount=await storage.updateAdminAccount(created.id,account.id,{type:"savings",maskedNumber:"2002"});
    assert.equal(updatedAccount.name,"Local Test");
    assert.equal(updatedAccount.type,"savings");
    assert.equal(updatedAccount.maskedNumber,"2002");
    assert.equal(updatedAccount.balance,250.75);
    const numberedAccount=await storage.assignAdminAccountNumber(created.id,account.id);
    assert.match(numberedAccount.accountNumber??"",/^\d{10}$/);
    assert.equal(numberedAccount.maskedNumber,numberedAccount.accountNumber?.slice(-4));
    assert.equal((await storage.getAccounts(created.id))[0]?.accountNumber,numberedAccount.accountNumber);
    const issuedCard=await storage.createAdminCard(created.id,{accountId:account.id,type:"virtual",status:"active",spendingLimit:2500});
    assert.equal(issuedCard.lastFour.length,4);
    assert.equal(issuedCard.network,"Mastercard");
    assert.equal(issuedCard.hasSecureDetails,true);
    assert.equal(issuedCard.spendingLimit,2500);
    const cardDetails=await storage.getCardDetails(created.id,issuedCard.id);
    assert.match(cardDetails.number,/^5[1-5]\d{14}$/);
    assert.equal(cardDetails.number.slice(-4),issuedCard.lastFour);
    assert.match(cardDetails.securityCode,/^\d{3}$/);
    assert.equal(isLuhnValid(cardDetails.number),true);
    await assert.rejects(()=>storage.getCardDetails(randomUUID(),issuedCard.id),/Card not found/);
    const [cardNotification]=await storage.getNotifications(created.id);
    assert.equal(cardNotification?.type,"card_issued");
    assert.equal(cardNotification?.resourceId,issuedCard.id);
    assert.equal(cardNotification?.isRead,false);
    await storage.markAllNotificationsRead(created.id);
    assert.equal((await storage.getNotifications(created.id))[0]?.isRead,true);
    assert.equal((await storage.markNotificationRead(created.id,cardNotification!.id)).isRead,true);
    await assert.rejects(()=>storage.markNotificationRead(randomUUID(),cardNotification!.id),/Notification not found/);
    await storage.updateProfile(created.id,{firstName:"Renamed",lastName:"Holder"});
    assert.equal((await storage.getAccounts(created.id))[0]?.name,"Renamed Holder");
    assert.equal((await storage.getCards(created.id))[0]?.holderName,"RENAMED HOLDER");
    await storage.updateProfile(created.id,{firstName:"Local",lastName:"Test"});
    const revokedCard=await storage.revokeAdminCard(created.id,issuedCard.id);
    assert.equal(revokedCard.status,"frozen");
    assert.equal((await storage.getCards(created.id))[0]?.status,"frozen");
    await storage.deleteAdminCard(created.id,issuedCard.id);
    assert.equal((await storage.getCards(created.id)).length,0);
    await assert.rejects(()=>storage.deleteAdminCard(created.id,issuedCard.id),/Card not found/);
    const unchangedNumberedAccount=await storage.updateAdminAccount(created.id,account.id,{type:"savings"});
    assert.equal(unchangedNumberedAccount.accountNumber,numberedAccount.accountNumber);
    await assert.rejects(()=>storage.assignAdminAccountNumber(created.id,account.id),/already been assigned/);
    await assert.rejects(()=>storage.updateAdminAccount(created.id,account.id,{maskedNumber:"9999"}),/locked after an account number is assigned/);
    await assert.rejects(()=>storage.updateAdminAccount(randomUUID(),account.id,{type:"checking"}),/Customer account not found/);
    await assert.rejects(()=>storage.assignAdminAccountNumber(randomUUID(),account.id),/Customer account not found/);
    const destination=await storage.createAdminAccount(created.id,{type:"checking",maskedNumber:"3003",openingBalance:10});
    await assert.rejects(()=>storage.createInternalTransfer(created.id,{sourceAccountId:account.id,destinationAccountId:account.id,amount:1,note:"Invalid"}),/different accounts/);
    await assert.rejects(()=>storage.createInternalTransfer(created.id,{sourceAccountId:account.id,destinationAccountId:randomUUID(),amount:1,note:"Invalid"}),/Destination account not found/);
    await assert.rejects(()=>storage.createInternalTransfer(created.id,{sourceAccountId:account.id,destinationAccountId:destination.id,amount:1_000,note:"Too much"}),/Insufficient available balance/);
    const internalTransfer=await storage.createInternalTransfer(created.id,{sourceAccountId:account.id,destinationAccountId:destination.id,amount:25,note:"Move to reserve"});
    assert.equal(internalTransfer.sourceAccountName,"Local Test");
    assert.equal(internalTransfer.destinationAccountName,"Local Test");
    assert.equal(internalTransfer.amount,25);
    const balancesAfterTransfer=new Map((await storage.getAccounts(created.id)).map((item)=>[item.id,item.balance]));
    assert.equal(balancesAfterTransfer.get(account.id),225.75);
    assert.equal(balancesAfterTransfer.get(destination.id),35);
    assert.equal([...balancesAfterTransfer.values()].reduce((sum,balance)=>sum+balance,0),260.75);
    const firstInternalLedger=await storage.getTransactions(created.id);
    assert.equal(firstInternalLedger.length,2);
    assert.deepEqual(new Set(firstInternalLedger.map((transaction)=>transaction.direction)),new Set(["credit","debit"]));
    const internalDebit=firstInternalLedger.find((transaction)=>transaction.direction==="debit");
    assert.ok(internalDebit);
    const internalDetails=await storage.getTransaction(created.id,internalDebit.id);
    assert.equal(internalDetails.accountName,"Local Test");
    assert.equal(internalDetails.accountMaskedNumber,numberedAccount.maskedNumber);
    assert.equal(internalDetails.transferKind,"between_accounts");
    assert.equal("accountId" in internalDetails,false);
    await assert.rejects(()=>storage.getTransaction(randomUUID(),internalDebit.id),/Transaction not found/);
    const adminInternalDetails=await storage.getAdminTransaction(internalDebit.id);
    assert.equal(adminInternalDetails.customerName,"Local Test");
    assert.equal(adminInternalDetails.risk,"standard");
    const peerUser=await storage.createLocalUser("peer.recipient@clipx.local","ClipXLocal123","Peer","Recipient");
    const peerAccount=await storage.createAdminAccount(peerUser.id,{type:"checking",maskedNumber:"4004",openingBalance:5});
    const numberedPeerAccount=await storage.assignAdminAccountNumber(peerUser.id,peerAccount.id);
    const peerAccountNumber=numberedPeerAccount.accountNumber;
    assert.ok(peerAccountNumber);
    await assert.rejects(()=>storage.lookupPeerRecipient(created.id,"0000000000"),/Recipient account not found/);
    await assert.rejects(()=>storage.lookupPeerRecipient(created.id,numberedAccount.accountNumber!),/Between my accounts/);
    const peerRecipient=await storage.lookupPeerRecipient(created.id,peerAccountNumber);
    assert.equal(peerRecipient.recipientName,"Peer Recipient");
    assert.equal(peerRecipient.accountName,"Peer Recipient");
    const peerTransfer=await storage.createPeerTransfer(created.id,{sourceAccountId:account.id,recipientAccountNumber:peerAccountNumber,amount:12,note:"Pay another customer"});
    assert.equal(peerTransfer.recipientName,"Peer Recipient");
    assert.equal(peerTransfer.recipientAccountNumber,peerAccountNumber);
    assert.equal((await storage.getAccounts(peerUser.id))[0]?.balance,17);
    const recipientPeerLedger=(await storage.getTransactions(peerUser.id))[0];
    assert.equal(recipientPeerLedger?.direction,"credit");
    assert.equal((await storage.getTransaction(peerUser.id,recipientPeerLedger!.id)).transferKind,"account_number");
    await assert.rejects(()=>storage.getTransaction(created.id,recipientPeerLedger!.id),/Transaction not found/);
    await assert.rejects(()=>storage.getAdminTransaction(randomUUID()),/Transaction not found/);
    for(let index=0;index<8;index+=1)await storage.createInternalTransfer(created.id,{sourceAccountId:account.id,destinationAccountId:destination.id,amount:1,note:`Additional transfer ${index+2}`});
    const eleventhTransfer=await storage.createInternalTransfer(created.id,{sourceAccountId:account.id,destinationAccountId:destination.id,amount:1,note:"Eleventh transfer"});
    const twelfthTransfer=await storage.createPeerTransfer(created.id,{sourceAccountId:account.id,recipientAccountNumber:peerAccountNumber,amount:1,note:"Twelfth transfer"});
    assert.equal(eleventhTransfer.amount,1);
    assert.equal(twelfthTransfer.amount,1);
    assert.equal((await storage.getTransactions(created.id)).length,22);
    assert.equal((await storage.getAdminStats()).processedVolume,47);
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

function isLuhnValid(value:string){
  let sum=0;
  let double=false;
  for(let index=value.length-1;index>=0;index-=1){
    let digit=Number(value[index]);
    if(double){digit*=2;if(digit>9)digit-=9;}
    sum+=digit;double=!double;
  }
  return sum%10===0;
}

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
