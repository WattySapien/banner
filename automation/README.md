# ClipX browser automation

This automation uses Puppeteer with a visible Chrome window. It only accepts localhost URLs and caps generated traffic at 500 visits per run.

Start ClipX first:

```bash
npm run dev
```

Create a development account and generate ten local page visits:

```bash
npm run automate -- --mode=create --email=automation@clipx.local --password=ClipXLocal123 --traffic=10
```

Open an existing account, send `$125.50`, and generate five visits:

```bash
npm run automate -- --mode=open --email=automation@clipx.local --password=ClipXLocal123 --transfer-amount=125.50 --traffic=5
```

Supported options:

- `--mode=create` or `--mode=open`
- `--email=<address>`
- `--password=<password>`
- `--transfer-amount=<positive amount>`
- `--note=<transfer note>`
- `--traffic=<0-500 visits>`
- `--base-url=http://127.0.0.1:3000`
- `--keep-open` to leave Chrome open after the run

Set `CHROME_PATH` if Chrome is not installed in a standard Linux location.
