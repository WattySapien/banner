# ClipX browser automation

This automation uses Puppeteer with a visible Chrome window. It only accepts localhost URLs. Every action selection and confirmation is handled in the terminal before Chrome opens.

Start ClipX first:

```bash
npm run dev
```

Run the interactive terminal workflow:

```bash
npm run automate
```

Choose one of the two actions shown in the terminal:

- Create an account. The script asks for the account holder's name, email, and password.
- Create transaction history. The script signs in to an existing account and creates the requested number of transfers to its first saved recipient.

For non-interactive local runs, pass all required values and `--yes`:

```bash
npm run automate -- --action=create-account --first-name=Automation --last-name=User --email=automation@clipx.local --password=ClipXLocal123 --yes
```

Create five transaction-history entries for an existing account:

```bash
npm run automate -- --action=create-transaction-history --email=automation@clipx.local --password=ClipXLocal123 --transaction-count=5 --transfer-amount=10 --note="Automation history entry" --yes
```

Supported options:

- `--action=create-account` or `--action=create-transaction-history`
- `--first-name=<name>` and `--last-name=<name>` for account creation
- `--email=<address>`
- `--password=<password>`
- `--transaction-count=<1-50>` for transaction history creation
- `--transfer-amount=<positive amount>` for transaction history creation
- `--note=<transfer note>`
- `--base-url=http://127.0.0.1:3000`
- `--keep-open` to leave Chrome open after the run
- `--yes` to confirm a fully non-interactive run

Set `CHROME_PATH` if Chrome is not installed in a standard Linux location.
