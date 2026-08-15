import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getDatabase } from "@clipx/database";
import type { User } from "@clipx/contracts/schema";
import type { Account, BankCard, BankingOverview, BankTransaction, Beneficiary, CreateTransfer, UpdateCard } from "@clipx/contracts/banking";
import type { AdminCustomer, AdminCustomerDetails, AdminStats, AdminTransaction, CreateAdminCustomer, UpdateAdminUser } from "@clipx/contracts/admin";
import type { AccountSettings, ChangePassword, UpdatePreferences, UpdateProfile } from "@clipx/contracts/settings";
import type { LocalAuthUser } from "@clipx/contracts/auth";

const scrypt = promisify(nodeScrypt);
const cents = (value: number) => Math.round(value * 100);
const dollars = (value: number | string) => Number(value) / 100;
const iso = (value: string | Date) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

type UserRow = { id:string; email:string; first_name:string; last_name:string; profile_image_url:string|null; is_admin:number; is_active:number; created_at:string|Date; updated_at:string|Date; last_active_at:string|Date };
type AccountRow = { id:string; name:string; type:"checking"|"savings"; masked_number:string; currency:"USD"; balance_cents:number; available_balance_cents:number; interest_rate_bps:number|null };
type TransactionRow = { id:string; account_id:string; description:string; merchant:string; category:BankTransaction["category"]; amount_cents:number; direction:BankTransaction["direction"]; status:BankTransaction["status"]; reference:string; created_at:string|Date };
type CardRow = { id:string; account_id:string; holder_name:string; last_four:string; network:"Visa"; type:BankCard["type"]; status:BankCard["status"]; spending_limit_cents:number; expires:string };
type BeneficiaryRow = { id:string; name:string; bank_name:string; masked_account:string; initials:string };

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
const toAccount = (row: AccountRow): Account => ({ id:row.id, name:row.name, type:row.type, maskedNumber:row.masked_number, currency:row.currency, balance:dollars(row.balance_cents), availableBalance:dollars(row.available_balance_cents), ...(row.interest_rate_bps === null ? {} : { interestRate:row.interest_rate_bps / 100 }) });
const toTransaction = (row: TransactionRow): BankTransaction => ({ id:row.id, accountId:row.account_id, description:row.description, merchant:row.merchant, category:row.category, amount:dollars(row.amount_cents), direction:row.direction, status:row.status, reference:row.reference, createdAt:iso(row.created_at) });
const toCard = (row: CardRow): BankCard => ({ id:row.id, accountId:row.account_id, holderName:row.holder_name, lastFour:row.last_four, network:row.network, type:row.type, status:row.status, spendingLimit:dollars(row.spending_limit_cents), expires:row.expires });

async function createPasswordHash(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64) as Buffer;
  return { salt, hash: derived.toString("hex") };
}

async function passwordMatches(password: string, salt: string, expectedHash: string) {
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface IStorage {
  readonly kind: "postgres"|"sqlite";
  ping(): Promise<void>;
  getUser(id:string): Promise<User|undefined>;
  createLocalUser(email:string,password:string): Promise<LocalAuthUser>;
  authenticateLocalUser(email:string,password:string): Promise<LocalAuthUser|undefined>;
  createSession(userId:string,tokenHash:string,expiresAt:Date): Promise<void>;
  getSessionUser(tokenHash:string): Promise<LocalAuthUser|undefined>;
  deleteSession(tokenHash:string): Promise<void>;
  deleteUserSessions(userId:string): Promise<void>;
  getOverview(userId:string): Promise<BankingOverview>;
  getAccounts(userId:string): Promise<Account[]>;
  getTransactions(userId:string): Promise<BankTransaction[]>;
  getCards(userId:string): Promise<BankCard[]>;
  getBeneficiaries(userId:string): Promise<Beneficiary[]>;
  createTransfer(userId:string,transfer:CreateTransfer): Promise<BankTransaction>;
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
  getAdminTransactions(): Promise<AdminTransaction[]>;
}

export class PostgresStorage implements IStorage {
  readonly kind = "postgres" as const;

  async ping(){
    const sql=getDatabase();
    await sql`SELECT 1`;
  }

  async getUser(id:string) {
    const sql = getDatabase();
    const [row] = await sql<UserRow[]>`SELECT * FROM users WHERE id=${id}`;
    return row ? toUser(row) : undefined;
  }

  async createLocalUser(email:string,password:string) {
    const sql = getDatabase();
    const normalized = email.toLowerCase();
    const [duplicate] = await sql`SELECT 1 FROM users WHERE lower(email)=lower(${normalized})`;
    if (duplicate) throw Object.assign(new Error("An account with this email already exists"), { status:409 });
    const id = randomUUID();
    const localPart = normalized.split("@")[0] || "Account";
    const firstName = localPart.split(/[._-]/).filter(Boolean).map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join(" ") || "Account";
    const credential = await createPasswordHash(password);
    await sql.begin(async (tx) => {
      await tx`INSERT INTO users (id,email,first_name,last_name) VALUES (${id},${normalized},${firstName},'')`;
      await tx`INSERT INTO user_preferences (user_id) VALUES (${id})`;
      await tx`INSERT INTO local_credentials (user_id,password_hash,password_salt) VALUES (${id},${credential.hash},${credential.salt})`;
    });
    return { id, email:normalized, firstName, lastName:"", isAdmin:false };
  }

  async authenticateLocalUser(email:string,password:string) {
    const sql = getDatabase();
    const [row] = await sql<Array<UserRow & { password_hash:string; password_salt:string }>>`
      SELECT u.*,c.password_hash,c.password_salt FROM users u
      JOIN local_credentials c ON c.user_id=u.id
      WHERE lower(u.email)=lower(${email})`;
    if (!row || !row.is_active || !(await passwordMatches(password,row.password_salt,row.password_hash))) return undefined;
    await sql`UPDATE users SET last_active_at=now() WHERE id=${row.id}`;
    return toLocalUser(row);
  }

  async createSession(userId:string,tokenHash:string,expiresAt:Date) {
    const sql = getDatabase();
    await sql.begin(async (tx) => {
      await tx`DELETE FROM sessions WHERE expires_at <= now()`;
      await tx`INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (${tokenHash},${userId},${expiresAt})`;
    });
  }

  async getSessionUser(tokenHash:string) {
    const sql = getDatabase();
    const [row] = await sql<UserRow[]>`
      SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=${tokenHash} AND s.expires_at>now() AND u.is_active=1`;
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

  async getAccounts(userId:string) {
    const sql = getDatabase();
    const rows = await sql<AccountRow[]>`SELECT id,name,type,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps FROM accounts WHERE user_id=${userId} ORDER BY type`;
    return rows.map(toAccount);
  }

  async getTransactions(userId:string) {
    const sql = getDatabase();
    const rows = await sql<TransactionRow[]>`SELECT t.* FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE a.user_id=${userId} ORDER BY t.created_at DESC`;
    return rows.map(toTransaction);
  }

  async getCards(userId:string) {
    const sql = getDatabase();
    const rows = await sql<CardRow[]>`SELECT c.* FROM cards c JOIN accounts a ON a.id=c.account_id WHERE a.user_id=${userId} ORDER BY c.type`;
    return rows.map(toCard);
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
    const [row]=await sql<Array<{email:string;first_name:string;last_name:string;transaction_alerts:number;monthly_summary:number;show_balances:number}>>`SELECT u.email,u.first_name,u.last_name,p.transaction_alerts,p.monthly_summary,p.show_balances FROM users u JOIN user_preferences p ON p.user_id=u.id WHERE u.id=${userId}`;
    if(!row) throw Object.assign(new Error("Account settings not found"),{status:404});
    return {profile:{firstName:row.first_name,lastName:row.last_name,email:row.email},preferences:{transactionAlerts:Boolean(row.transaction_alerts),monthlySummary:Boolean(row.monthly_summary),showBalances:Boolean(row.show_balances)}};
  }

  async updateProfile(userId:string,update:UpdateProfile) {
    const sql=getDatabase();
    const rows=await sql`UPDATE users SET first_name=${update.firstName},last_name=${update.lastName},updated_at=now() WHERE id=${userId} RETURNING id`;
    if(!rows.length) throw Object.assign(new Error("Account not found"),{status:404});
    await sql`UPDATE cards SET holder_name=${`${update.firstName} ${update.lastName}`.toUpperCase()} WHERE account_id IN (SELECT id FROM accounts WHERE user_id=${userId})`;
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
    const [row]=await sql<Array<{total:number;active:number;balance_cents:number;volume_cents:number;pending:number}>>`
      SELECT (SELECT count(*)::int FROM users WHERE is_admin=0) total,
      (SELECT count(*)::int FROM users WHERE is_admin=0 AND is_active=1) active,
      (SELECT coalesce(sum(balance_cents),0)::bigint FROM accounts) balance_cents,
      (SELECT coalesce(sum(amount_cents),0)::bigint FROM transactions WHERE status='completed') volume_cents,
      (SELECT count(*)::int FROM transactions WHERE status='pending') pending`;
    return {totalCustomers:Number(row.total),activeCustomers:Number(row.active),managedBalance:dollars(row.balance_cents),processedVolume:dollars(row.volume_cents),pendingTransactions:Number(row.pending),systemStatus:"operational"};
  }

  async getAdminUsers() {
    const sql=getDatabase();
    const rows=await sql<Array<UserRow & {balance_cents:number}>>`SELECT u.*,coalesce(sum(a.balance_cents),0)::bigint balance_cents FROM users u LEFT JOIN accounts a ON a.user_id=u.id GROUP BY u.id ORDER BY u.last_active_at DESC`;
    return rows.map((row)=>({id:row.id,email:row.email,firstName:row.first_name,lastName:row.last_name,initials:`${row.first_name[0]??""}${row.last_name[0]??""}`||"CX",isAdmin:Boolean(row.is_admin),isActive:Boolean(row.is_active),balance:dollars(row.balance_cents),createdAt:iso(row.created_at),lastActiveAt:iso(row.last_active_at)}));
  }

  async createAdminUser(input:CreateAdminCustomer) {
    const sql=getDatabase();
    const [duplicate]=await sql`SELECT 1 FROM users WHERE lower(email)=lower(${input.email})`;
    if(duplicate) throw Object.assign(new Error("Another account already uses this email"),{status:409});
    const userId=randomUUID();
    const credential=await createPasswordHash(input.password);
    await sql.begin(async(tx)=>{
      await tx`INSERT INTO users (id,email,first_name,last_name,is_admin,is_active) VALUES (${userId},${input.email.toLowerCase()},${input.firstName},${input.lastName},${Number(input.isAdmin)},${Number(input.isActive)})`;
      await tx`INSERT INTO user_preferences (user_id) VALUES (${userId})`;
      await tx`INSERT INTO local_credentials (user_id,password_hash,password_salt) VALUES (${userId},${credential.hash},${credential.salt})`;
      if(input.account){const balance=cents(input.account.openingBalance);await tx`INSERT INTO accounts (id,user_id,name,type,masked_number,balance_cents,available_balance_cents) VALUES (${randomUUID()},${userId},${input.account.name},${input.account.type},${input.account.maskedNumber},${balance},${balance})`;}
    });
    const customer=(await this.getAdminUsers()).find((item)=>item.id===userId);
    if(!customer) throw Object.assign(new Error("Customer could not be created"),{status:500});
    return customer;
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
    await sql`UPDATE users SET email=${email},first_name=${update.firstName??row.first_name},last_name=${update.lastName??row.last_name},is_admin=${Number(update.isAdmin??Boolean(row.is_admin))},is_active=${Number(update.isActive??Boolean(row.is_active))},updated_at=now() WHERE id=${userId}`;
    const customer=(await this.getAdminUsers()).find((item)=>item.id===userId);
    if(!customer) throw Object.assign(new Error("Customer not found"),{status:404});
    return customer;
  }

  async getAdminTransactions() {
    const sql=getDatabase();
    const rows=await sql<Array<TransactionRow & {customer_id:string;customer_name:string}>>`SELECT t.*,u.id customer_id,trim(u.first_name||' '||u.last_name) customer_name FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=a.user_id ORDER BY t.created_at DESC`;
    return rows.map((row)=>({...toTransaction(row),customerId:row.customer_id,customerName:row.customer_name,risk:Number(row.amount_cents)>=cents(2500)||row.status==="failed"?"review" as const:"standard" as const}));
  }
}

export const storage: IStorage = new PostgresStorage();
