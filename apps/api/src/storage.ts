import { randomBytes, randomInt, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getDatabase, withDatabaseDeadline } from "@clipx/database";
import type { User } from "@clipx/contracts/schema";
import type { Account, AppNotification, BankCard, BankingOverview, BankTransaction, Beneficiary, CardDetails, CreateInternalTransfer, CreatePeerTransfer, CreateTransfer, InternalTransferReceipt, PeerRecipient, PeerTransferReceipt, TransactionDetails, UpdateCard } from "@clipx/contracts/banking";
import type { AdminCustomer, AdminCustomerDetails, AdminStats, AdminTransaction, AdminTransactionDetails, CreateAdminAccount, CreateAdminCard, CreateAdminCustomer, UpdateAdminAccount, UpdateAdminUser } from "@clipx/contracts/admin";
import type { AccountSettings, ChangePassword, UpdatePreferences, UpdateProfile } from "@clipx/contracts/settings";
import type { LocalAuthUser } from "@clipx/contracts/auth";
import type { SupportMessage, SupportSenderRole } from "@clipx/contracts/support";
import { atStage } from "./diagnostics.js";
import { config } from "./config.js";
import { decryptPan,encryptPan,fingerprintPan,generateExpiry,generateMastercardPan,generateSecurityCode,generateVisaPan } from "./card-security.js";

const scrypt = promisify(nodeScrypt);
const cents = (value: number) => Math.round(value * 100);
const dollars = (value: number | string) => Number(value) / 100;
const iso = (value: string | Date) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const accountHolderName = (firstName:string,lastName:string) => `${firstName.trim()} ${lastName.trim()}`.trim();

type UserRow = { id:string; email:string; first_name:string; last_name:string; profile_image_url:string|null; is_admin:number; is_active:number; created_at:string|Date; updated_at:string|Date; last_active_at:string|Date };
type AccountRow = { id:string; name:string; type:"checking"|"savings"; account_number:string|null; masked_number:string; currency:"USD"; balance_cents:number; available_balance_cents:number; interest_rate_bps:number|null };
type TransactionRow = { id:string; account_id:string; internal_transfer_id?:string|null; peer_transfer_id?:string|null; description:string; merchant:string; category:BankTransaction["category"]; amount_cents:number; direction:BankTransaction["direction"]; status:BankTransaction["status"]; reference:string; created_at:string|Date };
type TransactionDetailsRow = TransactionRow & { account_name:string; account_type:Account["type"]; account_masked_number:string };
type InternalTransferRow = { id:string; user_id:string; source_account_id:string; destination_account_id:string; amount_cents:number; note:string; reference:string; status:"completed"; created_at:string|Date };
type PeerTransferRow = { id:string; sender_user_id:string; source_account_id:string; recipient_user_id:string; destination_account_id:string; amount_cents:number; note:string; reference:string; status:"completed"; created_at:string|Date };
type PeerRecipientRow = AccountRow & { user_id:string; first_name:string; last_name:string };
type CardRow = { id:string; account_id:string; holder_name:string; last_four:string; network:BankCard["network"]; type:BankCard["type"]; status:BankCard["status"]; spending_limit_cents:number; expires:string; pan_ciphertext:string|null; pan_iv:string|null; pan_auth_tag:string|null; pan_fingerprint:string|null; created_at:string|Date };
type BeneficiaryRow = { id:string; name:string; bank_name:string; masked_account:string; initials:string };
type NotificationRow={id:string;type:"card_issued"|"support_message";title:string;message:string;resource_id:string|null;is_read:number;created_at:string|Date};
type AvatarRow={content_type:"image/jpeg"|"image/png"|"image/webp";image_data:Buffer;updated_at:string|Date};
type SupportMessageRow={id:string;customer_user_id:string;sender_user_id:string;sender_role:SupportSenderRole;body:string;read_by_customer:number;read_by_admin:number;created_at:string|Date;sender_name:string};
type AdminCardInput=Omit<CreateAdminCard,"network"> & {network?:CreateAdminCard["network"]};

export type AvatarUpload={contentType:AvatarRow["content_type"];data:Buffer};
export type AvatarFile=AvatarUpload&{updatedAt:string};

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  profileImageUrl: row.profile_image_url,
  isAdmin: Boolean(row.is_admin),
  isActive: Boolean(row.is_active),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});
const toLocalUser = (row: Pick<UserRow, "id"|"email"|"first_name"|"last_name"|"is_admin">): LocalAuthUser => ({ id:row.id, email:row.email, firstName:row.first_name, lastName:row.last_name, isAdmin:Boolean(row.is_admin) });
const toAccount = (row: AccountRow): Account => ({ id:row.id, name:row.name, type:row.type, ...(row.account_number ? { accountNumber:row.account_number } : {}), maskedNumber:row.masked_number, currency:row.currency, balance:dollars(row.balance_cents), availableBalance:dollars(row.available_balance_cents), ...(row.interest_rate_bps === null ? {} : { interestRate:row.interest_rate_bps / 100 }) });
const generateAccountNumber = () => randomInt(1_000_000_000, 10_000_000_000).toString();
const errorCode = (error:unknown) => error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
const toTransaction = (row: TransactionRow): BankTransaction => ({ id:row.id, accountId:row.account_id, description:row.description, merchant:row.merchant, category:row.category, amount:dollars(row.amount_cents), direction:row.direction, status:row.status, reference:row.reference, createdAt:iso(row.created_at) });
const toTransactionDetails = (row:TransactionDetailsRow):TransactionDetails => ({ id:row.id, description:row.description, merchant:row.merchant, category:row.category, amount:dollars(row.amount_cents), direction:row.direction, status:row.status, reference:row.reference, createdAt:iso(row.created_at), accountName:row.account_name, accountType:row.account_type, accountMaskedNumber:row.account_masked_number, transferKind:row.peer_transfer_id?"account_number":row.internal_transfer_id?"between_accounts":"standard" });
const toCard = (row: CardRow): BankCard => ({ id:row.id, accountId:row.account_id, holderName:row.holder_name, lastFour:row.last_four, network:row.network, type:row.type, status:row.status, spendingLimit:dollars(row.spending_limit_cents), expires:row.expires, hasSecureDetails:Boolean(row.pan_ciphertext&&row.pan_iv&&row.pan_auth_tag), issuedAt:iso(row.created_at) });
const toNotification=(row:NotificationRow):AppNotification=>({id:row.id,type:row.type,title:row.title,message:row.message,resourceId:row.resource_id,isRead:Boolean(row.is_read),createdAt:iso(row.created_at)});
const toSupportMessage=(row:SupportMessageRow,viewerRole:SupportSenderRole):SupportMessage=>({id:row.id,customerUserId:row.customer_user_id,senderUserId:row.sender_user_id,senderRole:row.sender_role,senderName:row.sender_name,body:row.body,isRead:Boolean(viewerRole==="customer"?row.read_by_customer:row.read_by_admin),createdAt:iso(row.created_at)});
const requireCardDataKey=()=>{if(!config.cardDataEncryptionKey)throw Object.assign(new Error("Card security is not configured"),{status:503});return config.cardDataEncryptionKey;};

async function createPasswordHash(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64) as Buffer;
  return { salt, hash: derived.toString("hex") };
}

async function passwordMatches(password: string, salt: string, expectedHash: string) {
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const atDatabaseStage=<T>(stage:string,operation:()=>Promise<T>)=>atStage(stage,()=>withDatabaseDeadline(operation));

export interface IStorage {
  readonly kind: "postgres"|"sqlite";
  ping(): Promise<void>;
  getUser(id:string): Promise<User|undefined>;
  getUserAvatar(userId:string): Promise<AvatarFile|undefined>;
  updateUserAvatar(userId:string,avatar:AvatarUpload): Promise<User>;
  createLocalUser(email:string,password:string,firstName:string,lastName:string): Promise<LocalAuthUser>;
  authenticateLocalUser(email:string,password:string): Promise<LocalAuthUser|undefined>;
  createSession(userId:string,tokenHash:string,expiresAt:Date): Promise<void>;
  getSessionUser(tokenHash:string): Promise<LocalAuthUser|undefined>;
  deleteSession(tokenHash:string): Promise<void>;
  deleteUserSessions(userId:string): Promise<void>;
  recordSecurityEvent?(eventType:string,userId?:string,resourceId?:string,ipAddress?:string): Promise<void>;
  getOverview(userId:string): Promise<BankingOverview>;
  getAccounts(userId:string): Promise<Account[]>;
  getTransactions(userId:string): Promise<BankTransaction[]>;
  getTransaction(userId:string,transactionId:string): Promise<TransactionDetails>;
  getCards(userId:string): Promise<BankCard[]>;
  getCardDetails(userId:string,cardId:string): Promise<CardDetails>;
  getNotifications(userId:string): Promise<AppNotification[]>;
  markNotificationRead(userId:string,notificationId:string): Promise<AppNotification>;
  markAllNotificationsRead(userId:string): Promise<void>;
  getSupportMessages(customerUserId:string,viewerRole:SupportSenderRole): Promise<SupportMessage[]>;
  createSupportMessage(customerUserId:string,senderUserId:string,senderRole:SupportSenderRole,body:string): Promise<SupportMessage>;
  markSupportMessagesRead(customerUserId:string,viewerRole:SupportSenderRole): Promise<void>;
  getBeneficiaries(userId:string): Promise<Beneficiary[]>;
  createTransfer(userId:string,transfer:CreateTransfer): Promise<BankTransaction>;
  createInternalTransfer(userId:string,transfer:CreateInternalTransfer): Promise<InternalTransferReceipt>;
  lookupPeerRecipient(userId:string,accountNumber:string): Promise<PeerRecipient>;
  createPeerTransfer(userId:string,transfer:CreatePeerTransfer): Promise<PeerTransferReceipt>;
  updateCard(userId:string,cardId:string,update:UpdateCard): Promise<BankCard>;
  getSettings(userId:string): Promise<AccountSettings>;
  updateProfile(userId:string,update:UpdateProfile): Promise<AccountSettings>;
  updatePreferences(userId:string,update:UpdatePreferences): Promise<AccountSettings>;
  changePassword(userId:string,update:ChangePassword): Promise<void>;
  getAdminStats(): Promise<AdminStats>;
  getAdminUsers(): Promise<AdminCustomer[]>;
  createAdminUser(input:CreateAdminCustomer): Promise<AdminCustomer>;
  getAdminUserDetails(userId:string): Promise<AdminCustomerDetails>;
  updateAdminUser(userId:string,update:UpdateAdminUser): Promise<AdminCustomer>;
  createAdminAccount(userId:string,input:CreateAdminAccount): Promise<Account>;
  updateAdminAccount(userId:string,accountId:string,update:UpdateAdminAccount): Promise<Account>;
  assignAdminAccountNumber(userId:string,accountId:string): Promise<Account>;
  createAdminCard(userId:string,input:AdminCardInput): Promise<BankCard>;
  revokeAdminCard(userId:string,cardId:string): Promise<BankCard>;
  deleteAdminCard(userId:string,cardId:string): Promise<void>;
  getAdminTransactions(): Promise<AdminTransaction[]>;
  getAdminTransaction(transactionId:string): Promise<AdminTransactionDetails>;
}

export class PostgresStorage implements IStorage {
  readonly kind = "postgres" as const;

  async ping(){
    await atDatabaseStage("health.database.ping",async()=>{
      const sql=getDatabase();
      await sql`SELECT 1`;
    });
  }

  async getUser(id:string) {
    const sql = getDatabase();
    const [row] = await sql<UserRow[]>`SELECT * FROM users WHERE id=${id}`;
    return row ? toUser(row) : undefined;
  }

  async getUserAvatar(userId:string):Promise<AvatarFile|undefined>{
    const sql=getDatabase();
    const [row]=await sql<AvatarRow[]>`SELECT content_type,image_data,updated_at FROM user_avatars WHERE user_id=${userId}`;
    return row?{contentType:row.content_type,data:Buffer.from(row.image_data),updatedAt:iso(row.updated_at)}:undefined;
  }

  async updateUserAvatar(userId:string,avatar:AvatarUpload):Promise<User>{
    const sql=getDatabase();
    const version=Date.now();
    const user=await atDatabaseStage("avatar.database.save",()=>sql.begin(async(tx)=>{
      const [updated]=await tx<UserRow[]>`UPDATE users SET profile_image_url=${`/api/avatars/${userId}?v=${version}`},updated_at=now() WHERE id=${userId} RETURNING *`;
      if(!updated)throw Object.assign(new Error("Account not found"),{status:404});
      await tx`INSERT INTO user_avatars (user_id,content_type,image_data,byte_size,updated_at) VALUES (${userId},${avatar.contentType},${avatar.data},${avatar.data.byteLength},now()) ON CONFLICT (user_id) DO UPDATE SET content_type=excluded.content_type,image_data=excluded.image_data,byte_size=excluded.byte_size,updated_at=now()`;
      return updated;
    }));
    return toUser(user);
  }

  async createLocalUser(email:string,password:string,firstName:string,lastName:string) {
    const sql = getDatabase();
    const normalized = email.toLowerCase();
    const [duplicate] = await atDatabaseStage("signup.database.check_duplicate",()=>sql`SELECT 1 FROM users WHERE lower(email)=lower(${normalized})`);
    if (duplicate) throw Object.assign(new Error("An account with this email already exists"), { status:409 });
    const id = randomUUID();
    const normalizedFirstName=firstName.trim();
    const normalizedLastName=lastName.trim();
    const credential = await atStage("signup.password.hash",()=>createPasswordHash(password));
    await atDatabaseStage("signup.database.create_user",()=>sql.begin(async (tx) => {
      await tx`INSERT INTO users (id,email,first_name,last_name) VALUES (${id},${normalized},${normalizedFirstName},${normalizedLastName})`;
      await tx`INSERT INTO user_preferences (user_id) VALUES (${id})`;
      await tx`INSERT INTO local_credentials (user_id,password_hash,password_salt) VALUES (${id},${credential.hash},${credential.salt})`;
    }));
    return { id, email:normalized, firstName:normalizedFirstName, lastName:normalizedLastName, isAdmin:false };
  }

  async authenticateLocalUser(email:string,password:string) {
    const sql = getDatabase();
    const [row] = await atDatabaseStage("login.database.find_credentials",()=>sql<Array<UserRow & { password_hash:string; password_salt:string }>>`
      SELECT u.*,c.password_hash,c.password_salt FROM users u
      JOIN local_credentials c ON c.user_id=u.id
      WHERE lower(u.email)=lower(${email})`);
    if (!row || !row.is_active || !(await atStage("login.password.verify",()=>passwordMatches(password,row.password_salt,row.password_hash)))) return undefined;
    await atDatabaseStage("login.database.record_activity",()=>sql`UPDATE users SET last_active_at=now() WHERE id=${row.id}`);
    return toLocalUser(row);
  }

  async createSession(userId:string,tokenHash:string,expiresAt:Date) {
    const sql = getDatabase();
    await atDatabaseStage("auth.session.create",()=>sql.begin(async (tx) => {
      await tx`DELETE FROM sessions WHERE expires_at <= now()`;
      await tx`INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (${tokenHash},${userId},${expiresAt})`;
    }));
  }

  async getSessionUser(tokenHash:string) {
    const sql = getDatabase();
    const [row] = await atDatabaseStage("auth.session.read",()=>sql<UserRow[]>`
      SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=${tokenHash} AND s.expires_at>now() AND u.is_active=1`);
    return row ? toLocalUser(row) : undefined;
  }

  async deleteSession(tokenHash:string) {
    const sql = getDatabase();
    await sql`DELETE FROM sessions WHERE token_hash=${tokenHash}`;
  }

  async deleteUserSessions(userId:string){
    const sql=getDatabase();
    await sql`DELETE FROM sessions WHERE user_id=${userId}`;
  }

  async recordSecurityEvent(eventType:string,userId?:string,resourceId?:string,ipAddress?:string){
    const sql=getDatabase();
    await sql`INSERT INTO security_audit_events (id,user_id,event_type,resource_id,ip_address) VALUES (${randomUUID()},${userId??null},${eventType},${resourceId??null},${ipAddress??null})`;
  }

  async getAccounts(userId:string) {
    const sql = getDatabase();
    const rows = await sql<AccountRow[]>`SELECT id,name,type,account_number,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps FROM accounts WHERE user_id=${userId} ORDER BY type,id`;
    return rows.map(toAccount);
  }

  async getTransactions(userId:string) {
    const sql = getDatabase();
    const rows = await sql<TransactionRow[]>`SELECT t.* FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE a.user_id=${userId} ORDER BY t.created_at DESC`;
    return rows.map(toTransaction);
  }

  async getTransaction(userId:string,transactionId:string) {
    const sql=getDatabase();
    const [row]=await atDatabaseStage("transaction.details.database.read",()=>sql<TransactionDetailsRow[]>`
      SELECT t.*,a.name account_name,a.type account_type,a.masked_number account_masked_number
      FROM transactions t JOIN accounts a ON a.id=t.account_id
      WHERE t.id=${transactionId} AND a.user_id=${userId}`);
    if(!row)throw Object.assign(new Error("Transaction not found"),{status:404});
    return toTransactionDetails(row);
  }

  async getCards(userId:string) {
    const sql = getDatabase();
    const rows = await sql<CardRow[]>`SELECT c.* FROM cards c JOIN accounts a ON a.id=c.account_id WHERE a.user_id=${userId} ORDER BY c.type`;
    return rows.map(toCard);
  }

  async getCardDetails(userId:string,cardId:string):Promise<CardDetails>{
    const sql=getDatabase();
    const [row]=await atDatabaseStage("card.details.database.read",()=>sql<CardRow[]>`
      SELECT c.* FROM cards c JOIN accounts a ON a.id=c.account_id
      WHERE c.id=${cardId} AND a.user_id=${userId}`);
    if(!row)throw Object.assign(new Error("Card not found"),{status:404});
    if(!row.pan_ciphertext||!row.pan_iv||!row.pan_auth_tag)throw Object.assign(new Error("Secure details are unavailable for this legacy card"),{status:409});
    const number=decryptPan({ciphertext:row.pan_ciphertext,iv:row.pan_iv,authTag:row.pan_auth_tag},requireCardDataKey());
    return{cardId:row.id,number,securityCode:generateSecurityCode(),expires:row.expires,revealExpiresAt:new Date(Date.now()+30_000).toISOString()};
  }

  async getNotifications(userId:string){
    const sql=getDatabase();
    const rows=await sql<NotificationRow[]>`SELECT id,type,title,message,resource_id,is_read,created_at FROM notifications WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 20`;
    return rows.map(toNotification);
  }

  async markNotificationRead(userId:string,notificationId:string){
    const sql=getDatabase();
    const [row]=await sql<NotificationRow[]>`UPDATE notifications SET is_read=1 WHERE id=${notificationId} AND user_id=${userId} RETURNING id,type,title,message,resource_id,is_read,created_at`;
    if(!row)throw Object.assign(new Error("Notification not found"),{status:404});
    return toNotification(row);
  }

  async markAllNotificationsRead(userId:string){
    const sql=getDatabase();
    await sql`UPDATE notifications SET is_read=1 WHERE user_id=${userId} AND is_read=0`;
  }

  async getSupportMessages(customerUserId:string,viewerRole:SupportSenderRole){
    const sql=getDatabase();
    const rows=await sql<SupportMessageRow[]>`
      SELECT m.*,trim(u.first_name||' '||u.last_name) sender_name
      FROM support_messages m JOIN users u ON u.id=m.sender_user_id
      WHERE m.customer_user_id=${customerUserId}
      ORDER BY m.created_at,m.id LIMIT 500`;
    return rows.map((row)=>toSupportMessage(row,viewerRole));
  }

  async createSupportMessage(customerUserId:string,senderUserId:string,senderRole:SupportSenderRole,body:string){
    const sql=getDatabase();
    const created=await sql.begin(async(tx)=>{
      const [customer]=await tx<Array<{id:string}>>`SELECT id FROM users WHERE id=${customerUserId}`;
      const [sender]=await tx<Array<{id:string;sender_name:string;is_admin:number}>>`SELECT id,trim(first_name||' '||last_name) sender_name,is_admin FROM users WHERE id=${senderUserId}`;
      if(!customer)throw Object.assign(new Error("Customer not found"),{status:404});
      if(!sender)throw Object.assign(new Error("Message sender not found"),{status:404});
      if(senderRole==="customer"&&senderUserId!==customerUserId)throw Object.assign(new Error("Customers can only message from their own account"),{status:403});
      if(senderRole==="admin"&&!Number(sender.is_admin))throw Object.assign(new Error("Administrator access required"),{status:403});
      const [row]=await tx<SupportMessageRow[]>`
        INSERT INTO support_messages (id,customer_user_id,sender_user_id,sender_role,body,read_by_customer,read_by_admin)
        VALUES (${randomUUID()},${customerUserId},${senderUserId},${senderRole},${body},${Number(senderRole==="customer")},${Number(senderRole==="admin")})
        RETURNING *,${sender.sender_name}::text sender_name`;
      if(senderRole==="customer"){
        const admins=await tx<Array<{id:string}>>`SELECT id FROM users WHERE is_admin=1 AND is_active=1 AND id<>${senderUserId}`;
        for(const admin of admins)await tx`INSERT INTO notifications (id,user_id,type,title,message,resource_id) VALUES (${randomUUID()},${admin.id},'support_message','New support message',${`${sender.sender_name} sent you a new support message.`},${customerUserId})`;
      }else{
        await tx`INSERT INTO notifications (id,user_id,type,title,message,resource_id) VALUES (${randomUUID()},${customerUserId},'support_message','Support replied',${`${sender.sender_name} replied to your support conversation.`},${customerUserId})`;
      }
      return row;
    });
    return toSupportMessage(created,senderRole);
  }

  async markSupportMessagesRead(customerUserId:string,viewerRole:SupportSenderRole){
    const sql=getDatabase();
    if(viewerRole==="customer")await sql`UPDATE support_messages SET read_by_customer=1 WHERE customer_user_id=${customerUserId} AND read_by_customer=0`;
    else await sql`UPDATE support_messages SET read_by_admin=1 WHERE customer_user_id=${customerUserId} AND read_by_admin=0`;
  }

  async getBeneficiaries(userId:string) {
    const sql = getDatabase();
    const rows = await sql<BeneficiaryRow[]>`SELECT id,name,bank_name,masked_account,initials FROM beneficiaries WHERE user_id=${userId} ORDER BY name`;
    return rows.map((row) => ({ id:row.id,name:row.name,bankName:row.bank_name,maskedAccount:row.masked_account,initials:row.initials }));
  }

  async getOverview(userId:string): Promise<BankingOverview> {
    const sql = getDatabase();
    const accounts = await this.getAccounts(userId);
    const flow = await sql<Array<{month:string;income_cents:number;spending_cents:number}>>`SELECT month,income_cents,spending_cents FROM cash_flow WHERE user_id=${userId} ORDER BY sort_order`;
    const latest = flow.at(-1);
    return { totalBalance:accounts.reduce((sum,a)=>sum+a.balance,0), availableBalance:accounts.reduce((sum,a)=>sum+a.availableBalance,0), monthlyIncome:dollars(latest?.income_cents??0), monthlySpending:dollars(latest?.spending_cents??0), accounts, cashFlow:flow.map((row)=>({month:row.month,income:dollars(row.income_cents),spending:dollars(row.spending_cents)})) };
  }

  async createTransfer(userId:string,transfer:CreateTransfer) {
    const sql = getDatabase();
    return sql.begin(async (tx) => {
      const [account] = await tx<Array<AccountRow & {user_id:string}>>`SELECT * FROM accounts WHERE id=${transfer.sourceAccountId} AND user_id=${userId} FOR UPDATE`;
      const [beneficiary] = await tx<BeneficiaryRow[]>`SELECT id,name,bank_name,masked_account,initials FROM beneficiaries WHERE id=${transfer.beneficiaryId} AND user_id=${userId}`;
      if (!account) throw Object.assign(new Error("Source account not found"),{status:404});
      if (!beneficiary) throw Object.assign(new Error("Recipient not found"),{status:404});
      const amountCents = cents(transfer.amount);
      if (Number(account.available_balance_cents)<amountCents) throw Object.assign(new Error("Insufficient available balance"),{status:422});
      await tx`UPDATE accounts SET balance_cents=balance_cents-${amountCents},available_balance_cents=available_balance_cents-${amountCents} WHERE id=${account.id}`;
      const id=randomUUID();
      const reference=`TRF-${randomBytes(5).toString("hex").toUpperCase()}`;
      const [row] = await tx<TransactionRow[]>`INSERT INTO transactions (id,account_id,description,merchant,category,amount_cents,direction,status,reference) VALUES (${id},${account.id},${transfer.note||"Bank transfer"},${beneficiary.name},'transfer',${amountCents},'debit','completed',${reference}) RETURNING *`;
      return toTransaction(row);
    });
  }

  async createInternalTransfer(userId:string,transfer:CreateInternalTransfer): Promise<InternalTransferReceipt> {
    const sql=getDatabase();
    return atDatabaseStage("internal_transfer.database.create",()=>sql.begin(async(tx)=>{
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`app-transfer:${userId}`}))`;
      const accounts=await tx<AccountRow[]>`
        SELECT id,name,type,account_number,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps
        FROM accounts
        WHERE user_id=${userId} AND id IN (${transfer.sourceAccountId},${transfer.destinationAccountId})
        ORDER BY id FOR UPDATE`;
      const source=accounts.find((account)=>account.id===transfer.sourceAccountId);
      const destination=accounts.find((account)=>account.id===transfer.destinationAccountId);
      if(!source)throw Object.assign(new Error("Source account not found"),{status:404});
      if(!destination)throw Object.assign(new Error("Destination account not found"),{status:404});
      const amountCents=cents(transfer.amount);
      if(Number(source.available_balance_cents)<amountCents)throw Object.assign(new Error("Insufficient available balance"),{status:422});

      const id=randomUUID();
      const reference=`INT-${randomBytes(8).toString("hex").toUpperCase()}`;
      await tx`UPDATE accounts SET balance_cents=balance_cents-${amountCents},available_balance_cents=available_balance_cents-${amountCents} WHERE id=${source.id}`;
      await tx`UPDATE accounts SET balance_cents=balance_cents+${amountCents},available_balance_cents=available_balance_cents+${amountCents} WHERE id=${destination.id}`;
      const [created]=await tx<InternalTransferRow[]>`
        INSERT INTO internal_transfers (id,user_id,source_account_id,destination_account_id,amount_cents,note,reference)
        VALUES (${id},${userId},${source.id},${destination.id},${amountCents},${transfer.note},${reference})
        RETURNING *`;
      await tx`
        INSERT INTO transactions (id,account_id,internal_transfer_id,description,merchant,category,amount_cents,direction,status,reference)
        VALUES
          (${randomUUID()},${source.id},${id},${transfer.note},${`To ${destination.name}`},'transfer',${amountCents},'debit','completed',${`${reference}-OUT`}),
          (${randomUUID()},${destination.id},${id},${transfer.note},${`From ${source.name}`},'transfer',${amountCents},'credit','completed',${`${reference}-IN`})`;
      return {id:created.id,sourceAccountId:source.id,sourceAccountName:source.name,destinationAccountId:destination.id,destinationAccountName:destination.name,amount:dollars(created.amount_cents),note:created.note,reference:created.reference,createdAt:iso(created.created_at)};
    }));
  }

  async lookupPeerRecipient(userId:string,accountNumber:string):Promise<PeerRecipient>{
    const sql=getDatabase();
    const [recipient]=await atDatabaseStage("peer_transfer.recipient.lookup",()=>sql<PeerRecipientRow[]>`
      SELECT a.id,a.user_id,a.name,a.type,a.account_number,a.masked_number,a.currency,a.balance_cents,a.available_balance_cents,a.interest_rate_bps,u.first_name,u.last_name
      FROM accounts a JOIN users u ON u.id=a.user_id
      WHERE a.account_number=${accountNumber} AND u.is_active=1`);
    if(!recipient)throw Object.assign(new Error("Recipient account not found"),{status:404});
    if(recipient.user_id===userId)throw Object.assign(new Error("Use Between my accounts to transfer to your own account"),{status:422});
    return{accountNumber,accountName:recipient.name,recipientName:`${recipient.first_name} ${recipient.last_name}`.trim()};
  }

  async createPeerTransfer(userId:string,transfer:CreatePeerTransfer):Promise<PeerTransferReceipt>{
    const sql=getDatabase();
    return atDatabaseStage("peer_transfer.database.create",()=>sql.begin(async(tx)=>{
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`app-transfer:${userId}`}))`;
      const [resolvedRecipient]=await tx<PeerRecipientRow[]>`
        SELECT a.id,a.user_id,a.name,a.type,a.account_number,a.masked_number,a.currency,a.balance_cents,a.available_balance_cents,a.interest_rate_bps,u.first_name,u.last_name
        FROM accounts a JOIN users u ON u.id=a.user_id
        WHERE a.account_number=${transfer.recipientAccountNumber} AND u.is_active=1
        FOR SHARE OF u`;
      if(!resolvedRecipient)throw Object.assign(new Error("Recipient account not found"),{status:404});
      if(resolvedRecipient.user_id===userId)throw Object.assign(new Error("Use Between my accounts to transfer to your own account"),{status:422});

      const lockedAccounts=await tx<Array<AccountRow&{user_id:string}>>`
        SELECT a.id,a.user_id,a.name,a.type,a.account_number,a.masked_number,a.currency,a.balance_cents,a.available_balance_cents,a.interest_rate_bps
        FROM accounts a WHERE a.id IN (${transfer.sourceAccountId},${resolvedRecipient.id})
        ORDER BY a.id FOR UPDATE`;
      const source=lockedAccounts.find((account)=>account.id===transfer.sourceAccountId&&account.user_id===userId);
      const destination=lockedAccounts.find((account)=>account.id===resolvedRecipient.id&&account.user_id===resolvedRecipient.user_id);
      if(!source)throw Object.assign(new Error("Source account not found"),{status:404});
      if(!destination)throw Object.assign(new Error("Recipient account not found"),{status:404});
      const amountCents=cents(transfer.amount);
      if(Number(source.available_balance_cents)<amountCents)throw Object.assign(new Error("Insufficient available balance"),{status:422});

      const id=randomUUID(),reference=`P2P-${randomBytes(8).toString("hex").toUpperCase()}`;
      await tx`UPDATE accounts SET balance_cents=balance_cents-${amountCents},available_balance_cents=available_balance_cents-${amountCents} WHERE id=${source.id}`;
      await tx`UPDATE accounts SET balance_cents=balance_cents+${amountCents},available_balance_cents=available_balance_cents+${amountCents} WHERE id=${destination.id}`;
      const [created]=await tx<PeerTransferRow[]>`
        INSERT INTO peer_transfers (id,sender_user_id,source_account_id,recipient_user_id,destination_account_id,amount_cents,note,reference)
        VALUES (${id},${userId},${source.id},${resolvedRecipient.user_id},${destination.id},${amountCents},${transfer.note},${reference})
        RETURNING *`;
      const recipientName=`${resolvedRecipient.first_name} ${resolvedRecipient.last_name}`.trim();
      await tx`
        INSERT INTO transactions (id,account_id,peer_transfer_id,description,merchant,category,amount_cents,direction,status,reference)
        VALUES
          (${randomUUID()},${source.id},${id},${transfer.note},${recipientName},'transfer',${amountCents},'debit','completed',${`${reference}-OUT`}),
          (${randomUUID()},${destination.id},${id},${transfer.note},${`From ${source.name}`},'transfer',${amountCents},'credit','completed',${`${reference}-IN`})`;
      return{id:created.id,sourceAccountId:source.id,sourceAccountName:source.name,recipientAccountNumber:transfer.recipientAccountNumber,destinationAccountName:destination.name,recipientName,amount:dollars(created.amount_cents),note:created.note,reference:created.reference,createdAt:iso(created.created_at)};
    }));
  }

  async updateCard(userId:string,cardId:string,update:UpdateCard) {
    const sql=getDatabase();
    const [row]=await sql<CardRow[]>`SELECT c.* FROM cards c JOIN accounts a ON a.id=c.account_id WHERE c.id=${cardId} AND a.user_id=${userId}`;
    if(!row) throw Object.assign(new Error("Card not found"),{status:404});
    const status=update.status??row.status;
    const limit=update.spendingLimit===undefined?row.spending_limit_cents:cents(update.spendingLimit);
    const [updated]=await sql<CardRow[]>`UPDATE cards SET status=${status},spending_limit_cents=${limit} WHERE id=${cardId} RETURNING *`;
    return toCard(updated);
  }

  async getSettings(userId:string): Promise<AccountSettings> {
    const sql=getDatabase();
    const [row]=await sql<Array<{email:string;first_name:string;last_name:string;profile_image_url:string|null;transaction_alerts:number;monthly_summary:number;show_balances:number}>>`SELECT u.email,u.first_name,u.last_name,u.profile_image_url,p.transaction_alerts,p.monthly_summary,p.show_balances FROM users u JOIN user_preferences p ON p.user_id=u.id WHERE u.id=${userId}`;
    if(!row) throw Object.assign(new Error("Account settings not found"),{status:404});
    return {profile:{firstName:row.first_name,lastName:row.last_name,email:row.email,profileImageUrl:row.profile_image_url},preferences:{transactionAlerts:Boolean(row.transaction_alerts),monthlySummary:Boolean(row.monthly_summary),showBalances:Boolean(row.show_balances)}};
  }

  async updateProfile(userId:string,update:UpdateProfile) {
    const sql=getDatabase();
    const holderName=accountHolderName(update.firstName,update.lastName);
    await sql.begin(async(tx)=>{
      const rows=await tx`UPDATE users SET first_name=${update.firstName},last_name=${update.lastName},updated_at=now() WHERE id=${userId} RETURNING id`;
      if(!rows.length) throw Object.assign(new Error("Account not found"),{status:404});
      await tx`UPDATE accounts SET name=${holderName} WHERE user_id=${userId}`;
      await tx`UPDATE cards SET holder_name=${holderName.toUpperCase()} WHERE account_id IN (SELECT id FROM accounts WHERE user_id=${userId})`;
    });
    return this.getSettings(userId);
  }

  async updatePreferences(userId:string,update:UpdatePreferences) {
    const sql=getDatabase();
    const current=(await this.getSettings(userId)).preferences;
    await sql`UPDATE user_preferences SET transaction_alerts=${Number(update.transactionAlerts??current.transactionAlerts)},monthly_summary=${Number(update.monthlySummary??current.monthlySummary)},show_balances=${Number(update.showBalances??current.showBalances)} WHERE user_id=${userId}`;
    return this.getSettings(userId);
  }

  async changePassword(userId:string,update:ChangePassword){
    const sql=getDatabase();
    const [row]=await sql<Array<{password_hash:string;password_salt:string}>>`SELECT password_hash,password_salt FROM local_credentials WHERE user_id=${userId}`;
    if(!row||!(await passwordMatches(update.currentPassword,row.password_salt,row.password_hash))) throw Object.assign(new Error("Current password is incorrect"),{status:401});
    const credential=await createPasswordHash(update.newPassword);
    await sql`UPDATE local_credentials SET password_hash=${credential.hash},password_salt=${credential.salt},updated_at=now() WHERE user_id=${userId}`;
  }

  async getAdminStats(): Promise<AdminStats> {
    const sql=getDatabase();
    const [row]=await atDatabaseStage("admin.stats.database.read",()=>sql<Array<{total:number;active:number;balance_cents:number;volume_cents:number;pending:number}>>`
      SELECT (SELECT count(*)::int FROM users WHERE is_admin=0) total,
      (SELECT count(*)::int FROM users WHERE is_admin=0 AND is_active=1) active,
      (SELECT coalesce(sum(balance_cents),0)::bigint FROM accounts) balance_cents,
      ((SELECT coalesce(sum(amount_cents),0)::bigint FROM transactions WHERE status='completed' AND internal_transfer_id IS NULL AND peer_transfer_id IS NULL)
        +(SELECT coalesce(sum(amount_cents),0)::bigint FROM internal_transfers WHERE status='completed')
        +(SELECT coalesce(sum(amount_cents),0)::bigint FROM peer_transfers WHERE status='completed')) volume_cents,
      (SELECT count(*)::int FROM transactions WHERE status='pending') pending`);
    return {totalCustomers:Number(row.total),activeCustomers:Number(row.active),managedBalance:dollars(row.balance_cents),processedVolume:dollars(row.volume_cents),pendingTransactions:Number(row.pending),systemStatus:"operational"};
  }

  async getAdminUsers() {
    const sql=getDatabase();
    const rows=await atDatabaseStage("admin.users.database.read",()=>sql<Array<UserRow & {balance_cents:number}>>`SELECT u.*,coalesce(sum(a.balance_cents),0)::bigint balance_cents FROM users u LEFT JOIN accounts a ON a.user_id=u.id GROUP BY u.id ORDER BY u.last_active_at DESC`);
    return rows.map((row)=>({id:row.id,email:row.email,firstName:row.first_name,lastName:row.last_name,initials:`${row.first_name[0]??""}${row.last_name[0]??""}`||"CX",profileImageUrl:row.profile_image_url,isAdmin:Boolean(row.is_admin),isActive:Boolean(row.is_active),balance:dollars(row.balance_cents),createdAt:iso(row.created_at),lastActiveAt:iso(row.last_active_at)}));
  }

  async createAdminUser(input:CreateAdminCustomer) {
    const sql=getDatabase();
    const [duplicate]=await atDatabaseStage("admin.customer.database.check_duplicate",()=>sql`SELECT 1 FROM users WHERE lower(email)=lower(${input.email})`);
    if(duplicate) throw Object.assign(new Error("Another account already uses this email"),{status:409});
    const userId=randomUUID();
    const credential=await atStage("admin.customer.password.hash",()=>createPasswordHash(input.password));
    const balance=input.account?cents(input.account.openingBalance):0;
    const user=await atDatabaseStage("admin.customer.database.create",()=>sql.begin(async(tx)=>{
      const [created]=await tx<UserRow[]>`INSERT INTO users (id,email,first_name,last_name,is_admin,is_active) VALUES (${userId},${input.email.toLowerCase()},${input.firstName},${input.lastName},${Number(input.isAdmin)},${Number(input.isActive)}) RETURNING *`;
      await tx`INSERT INTO user_preferences (user_id) VALUES (${userId})`;
      await tx`INSERT INTO local_credentials (user_id,password_hash,password_salt) VALUES (${userId},${credential.hash},${credential.salt})`;
      if(input.account)await tx`INSERT INTO accounts (id,user_id,name,type,masked_number,balance_cents,available_balance_cents) VALUES (${randomUUID()},${userId},${accountHolderName(input.firstName,input.lastName)},${input.account.type},${input.account.maskedNumber},${balance},${balance})`;
      return created;
    }));
    return {id:user.id,email:user.email,firstName:user.first_name,lastName:user.last_name,initials:`${user.first_name[0]??""}${user.last_name[0]??""}`||"CX",profileImageUrl:user.profile_image_url,isAdmin:Boolean(user.is_admin),isActive:Boolean(user.is_active),balance:dollars(balance),createdAt:iso(user.created_at),lastActiveAt:iso(user.last_active_at)};
  }

  async getAdminUserDetails(userId:string): Promise<AdminCustomerDetails> {
    const customer=(await this.getAdminUsers()).find((item)=>item.id===userId);
    if(!customer) throw Object.assign(new Error("Customer not found"),{status:404});
    const settings=await this.getSettings(userId);
    const transactions=(await this.getAdminTransactions()).filter((item)=>item.customerId===userId);
    return {customer,accounts:await this.getAccounts(userId),cards:await this.getCards(userId),transactions,preferences:settings.preferences};
  }

  async updateAdminUser(userId:string,update:UpdateAdminUser) {
    const sql=getDatabase();
    const [row]=await sql<Array<{email:string;first_name:string;last_name:string;is_admin:number;is_active:number}>>`SELECT email,first_name,last_name,is_admin,is_active FROM users WHERE id=${userId}`;
    if(!row) throw Object.assign(new Error("Customer not found"),{status:404});
    const email=(update.email??row.email).toLowerCase();
    const [duplicate]=await sql`SELECT 1 FROM users WHERE lower(email)=lower(${email}) AND id<>${userId}`;
    if(duplicate) throw Object.assign(new Error("Another account already uses this email"),{status:409});
    const wasActive=Boolean(row.is_active);
    const isActive=update.isActive??wasActive;
    const firstName=update.firstName??row.first_name;
    const lastName=update.lastName??row.last_name;
    const holderName=accountHolderName(firstName,lastName);
    await atDatabaseStage("admin.customer.database.update",()=>sql.begin(async(tx)=>{
      await tx`UPDATE users SET email=${email},first_name=${firstName},last_name=${lastName},is_admin=${Number(update.isAdmin??Boolean(row.is_admin))},is_active=${Number(isActive)},updated_at=now() WHERE id=${userId}`;
      await tx`UPDATE accounts SET name=${holderName} WHERE user_id=${userId}`;
      await tx`UPDATE cards SET holder_name=${holderName.toUpperCase()} WHERE account_id IN (SELECT id FROM accounts WHERE user_id=${userId})`;
      if(!wasActive||!isActive)await tx`DELETE FROM sessions WHERE user_id=${userId}`;
    }));
    const customer=(await this.getAdminUsers()).find((item)=>item.id===userId);
    if(!customer) throw Object.assign(new Error("Customer not found"),{status:404});
    return customer;
  }

  async createAdminAccount(userId:string,input:CreateAdminAccount) {
    const sql=getDatabase();
    const balance=cents(input.openingBalance);
    const [row]=await atDatabaseStage("admin.account.database.create",()=>sql<AccountRow[]>`
      INSERT INTO accounts (id,user_id,name,type,masked_number,balance_cents,available_balance_cents)
      SELECT ${randomUUID()},id,trim(first_name||' '||last_name),${input.type},${input.maskedNumber},${balance},${balance}
      FROM users WHERE id=${userId}
      RETURNING id,name,type,account_number,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps`);
    if(!row)throw Object.assign(new Error("Customer not found"),{status:404});
    return toAccount(row);
  }

  async updateAdminAccount(userId:string,accountId:string,update:UpdateAdminAccount) {
    const sql=getDatabase();
    const [current]=await atDatabaseStage("admin.account.database.find",()=>sql<AccountRow[]>`
      SELECT a.id,a.name,a.type,a.account_number,a.masked_number,a.currency,a.balance_cents,a.available_balance_cents,a.interest_rate_bps
      FROM accounts a WHERE a.id=${accountId} AND a.user_id=${userId}`);
    if(!current)throw Object.assign(new Error("Customer account not found"),{status:404});
    if(current.account_number&&update.maskedNumber!==undefined&&update.maskedNumber!==current.masked_number)throw Object.assign(new Error("The final four digits are locked after an account number is assigned"),{status:409});
    const [row]=await atDatabaseStage("admin.account.database.update",()=>sql<AccountRow[]>`
      UPDATE accounts SET type=${update.type??current.type},masked_number=${update.maskedNumber??current.masked_number}
      WHERE id=${accountId} AND user_id=${userId}
      RETURNING id,name,type,account_number,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps`);
    if(!row)throw Object.assign(new Error("Customer account not found"),{status:404});
    return toAccount(row);
  }

  async assignAdminAccountNumber(userId:string,accountId:string) {
    const sql=getDatabase();
    for(let attempt=0;attempt<5;attempt+=1){
      try{
        const number=generateAccountNumber();
        const [row]=await atDatabaseStage("admin.account_number.database.assign",()=>sql<AccountRow[]>`
          UPDATE accounts SET account_number=${number},masked_number=${number.slice(-4)}
          WHERE id=${accountId} AND user_id=${userId} AND account_number IS NULL
          RETURNING id,name,type,account_number,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps`);
        if(row)return toAccount(row);
        const [existing]=await atDatabaseStage("admin.account_number.database.find",()=>sql<Array<{account_number:string|null}>>`
          SELECT account_number FROM accounts WHERE id=${accountId} AND user_id=${userId}`);
        if(!existing)throw Object.assign(new Error("Customer account not found"),{status:404});
        throw Object.assign(new Error("An account number has already been assigned and cannot be changed"),{status:409});
      }catch(error){
        if(errorCode(error)==="23505")continue;
        throw error;
      }
    }
    throw Object.assign(new Error("A unique account number could not be allocated. Try again."),{status:503});
  }

  async createAdminCard(userId:string,input:AdminCardInput){
    const sql=getDatabase();
    return atDatabaseStage("admin.card.database.create",()=>sql.begin(async(tx)=>{
      const [owner]=await tx<Array<{account_id:string;holder_name:string}>>`
        SELECT a.id account_id,upper(trim(u.first_name||' '||u.last_name)) holder_name
        FROM accounts a JOIN users u ON u.id=a.user_id
        WHERE a.id=${input.accountId} AND a.user_id=${userId}`;
      if(!owner)throw Object.assign(new Error("Customer account not found"),{status:404});
      const network=input.network??"Mastercard";
      const key=requireCardDataKey(),id=randomUUID(),pan=network==="Visa"?generateVisaPan():generateMastercardPan(),expires=generateExpiry(),encrypted=encryptPan(pan,key);
      const [row]=await tx<CardRow[]>`
        INSERT INTO cards (id,account_id,holder_name,last_four,network,type,status,spending_limit_cents,expires,pan_ciphertext,pan_iv,pan_auth_tag,pan_fingerprint)
        VALUES (${id},${owner.account_id},${owner.holder_name},${pan.slice(-4)},${network},${input.type},${input.status},${cents(input.spendingLimit)},${expires},${encrypted.ciphertext},${encrypted.iv},${encrypted.authTag},${fingerprintPan(pan,key)})
        RETURNING *`;
      await tx`INSERT INTO notifications (id,user_id,type,title,message,resource_id) VALUES (${randomUUID()},${userId},'card_issued','Your new card is ready',${`${input.type[0]?.toUpperCase()}${input.type.slice(1)} ${network} ending in ${pan.slice(-4)} was added to your account.`},${id})`;
      return toCard(row);
    }));
  }

  async revokeAdminCard(userId:string,cardId:string){
    const sql=getDatabase();
    const [row]=await sql<CardRow[]>`UPDATE cards c SET status='frozen' FROM accounts a WHERE c.id=${cardId} AND c.account_id=a.id AND a.user_id=${userId} RETURNING c.*`;
    if(!row)throw Object.assign(new Error("Card not found"),{status:404});
    return toCard(row);
  }

  async deleteAdminCard(userId:string,cardId:string):Promise<void>{
    const sql=getDatabase();
    await sql.begin(async(tx)=>{
      const [card]=await tx<Array<{id:string}>>`SELECT c.id FROM cards c JOIN accounts a ON a.id=c.account_id WHERE c.id=${cardId} AND a.user_id=${userId}`;
      if(!card)throw Object.assign(new Error("Card not found"),{status:404});
      await tx`DELETE FROM notifications WHERE user_id=${userId} AND type='card_issued' AND resource_id=${cardId}`;
      await tx`DELETE FROM cards WHERE id=${cardId}`;
    });
  }

  async getAdminTransactions() {
    const sql=getDatabase();
    const rows=await atDatabaseStage("admin.transactions.database.read",()=>sql<Array<TransactionRow & {customer_id:string;customer_name:string}>>`SELECT t.*,u.id customer_id,trim(u.first_name||' '||u.last_name) customer_name FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=a.user_id ORDER BY t.created_at DESC`);
    return rows.map((row)=>({...toTransaction(row),customerId:row.customer_id,customerName:row.customer_name,risk:Number(row.amount_cents)>=cents(2500)||row.status==="failed"?"review" as const:"standard" as const}));
  }

  async getAdminTransaction(transactionId:string) {
    const sql=getDatabase();
    const [row]=await atDatabaseStage("admin.transaction.details.database.read",()=>sql<Array<TransactionDetailsRow&{customer_name:string}>>`
      SELECT t.*,a.name account_name,a.type account_type,a.masked_number account_masked_number,trim(u.first_name||' '||u.last_name) customer_name
      FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=a.user_id
      WHERE t.id=${transactionId}`);
    if(!row)throw Object.assign(new Error("Transaction not found"),{status:404});
    return {...toTransactionDetails(row),customerName:row.customer_name,risk:Number(row.amount_cents)>=cents(2500)||row.status==="failed"?"review" as const:"standard" as const};
  }
}

export const storage: IStorage = new PostgresStorage();
