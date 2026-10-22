# Output matching the original Excel templates

Open **Excel reports** (`/dashboard/laporan-excel`). Choose the year, the fund for each of the three original columns and the funds account fund. The **Gabungan JKKR** fund becomes the default funds-account choice. Extra funds are merged into **Lain2** so the four original fund splits are preserved.

The **Generate 4 linked Excel files (.zip)** button produces:

| File | Contents and links |
| --- | --- |
| `1. Baucer dan Resit.xlsx` | Receipts/vouchers with a posting in the chosen year, an editable `Data` ledger sheet, opening balances, dues data and a guide |
| `2. Buku Kewangan.xlsx` | January–December, running balances, bank/cash and fund splits; formulas read file 1 |
| `3. Bulanan dan Rumusan Tahunan.xlsx` | Monthly reports according to the books and a 12-month summary; formulas read file 2 |
| `4. Akaun Tunjang.xlsx` | Monthly report for the chosen funds account, an annual summary by original category and a dues summary; formulas read sources in files 1 and 2 |

The workbooks preserve merged cells, column widths, fonts, colours, borders, labels, ordering and signature areas from the four supplied templates. Legacy `.xls` files were converted to `.xlsx`. Transaction rows are appended when the original space runs out; table headers repeat on following pages. Long text fields may grow taller. Print areas are set so signature blocks are not cut off.

The originally empty February sheet is completed using the January format. Year, organisation name, signatories and figures come from the application. The old links to a Windows drive and the 2021/2025/2026 files are not used. The templates in the repository have been cleaned of transactions, signatory names, cheque numbers, addresses, workbook metadata and original link caches; uploaded files containing historical data are not stored in the repository and are not imported into the database.

## Mapping to the treasurer's four workbooks

The four generated files replace the manual workbooks one for one:

| Manual workbook | Generated file | What the system fills in |
| --- | --- | --- |
| `5_...0500.xlsx` — `baucer`, `resit` | `1. Baucer dan Resit.xlsx` | One sheet per document: letterhead, number, date, payee, amount, amount in words, purpose and reference are filled from the record; the two- or three-column signature block comes from the organisation profile |
| `5_...0499.xlsx` — `Sheet1` (one month per file) | `2. Buku Kewangan.xlsx` | All twelve months as separate sheets with the same 24 columns, the four fund splits, the running cash/bank balance and the monthly totals |
| `5_...0501.xlsx` — `jan`, `feb` (empty), `rumusan` | `3. Bulanan dan Rumusan Tahunan.xlsx` | Income and expenses by fund for each month, `Jumlah` and `Baki Bulanan`, `seperti di bkkt`, and the twelve-month summary with every month linked |
| `5_...0502.xlsx` — `jan2021`, `rumusan tahunan`, `rumusan yuran` | `4. Akaun Tunjang.xlsx` | The funds-account ledger per month, the annual summary against the original income and expense categories, and the dues collection list |

Labels, column order, merged cells, fonts and borders come from `templates/excel/*.xlsx`, which are the same four layouts with the historical data removed.

What the collector no longer does by hand:

- **Cross-file links.** The manual workbooks depend on `[1]1`, `[1]2` … `[1]12` — one file per month. When a file is renamed or moved the formulas break: the four reference workbooks contained **328 cells showing `#REF!`**, most of them in the annual summaries. The generated package keeps the same link structure but rebuilds every workbook together, so the links resolve and values are cached for readers that do not recalculate.
- **Opening balances.** Each month's opening balance is carried from the previous month's closing balance instead of being retyped.
- **Amounts in words.** `RINGGIT MALAYSIA` is generated from the amount, so the two can never disagree.
- **Row numbers and totals.** `Bil`, `JUMLAH`, `JUMLAH SEMASA` and `BAKI BULANAN` are recalculated; adding rows extends the tables and the totals follow.
- **The empty February sheet.** Months with no data are still produced with the January layout, so the twelve-month summary has a column for every month.

## Deliberate differences from the manual workbooks

Layout, headings, columns, totals and signature blocks match the treasurer's four files. Three labels deliberately do not, because the manual files are wrong or describe data this system does not hold. They are asserted by `test_deliberate_differences_from_the_reference_workbooks` so the choice is visible rather than accidental.

| Generated output | Manual workbook | Why |
| --- | --- | --- |
| `Baki pada 1.5.2026` on the May sheet | `Baki pada 1.4.2026` | The May sheet still carried April's opening date, presumably a copied-and-not-updated cell: its own `BULAN : MEI 2026` heading contradicts it. The generated label follows the sheet's month, so all twelve months are right. |
| `Bank/lain` when an `OTHER` account exists | `Bank` | The `OTHER` accounts are folded into that column; naming it `Bank` would hide money that is not in a bank account. With no `OTHER` accounts the heading stays `Bank`, as in the reference. |
| `AHLI` above the dues column | `FELDA` | The reference column listed settlements (`Bkt. Goh`, `Sg. Panching Timur`). This data model records a member per claim, not a settlement, so the column holds `Nama ahli` and is labelled accordingly. Adding a region field would be a schema change. |
| Figures calculated by the workbook | 328 cells showing `#REF!` | The manual files link to external monthly workbooks; once a file moves the links break. The generated package is built in one pass and caches every value. Not a difference in intent, only in whether the numbers resolve. |

## Editing and the relationship between files

1. Extract all files into the same folder. Keep the file names so the relative links stay valid.
2. Open all four files in Excel and allow link updates for this package. Data is recalculated through formulas.
3. Edit signed amounts, names, details and references on the **Data** sheet in file 1. A positive amount increases the balance; a negative amount decreases it.
4. Funds-account category names on Data can be matched to the labels in the funds-account summary. Original categories without a match are placed in **Lain-lain** during generation.
5. If you change figures in Excel, update the **Ringgit Malaysia** words column too. Amount-in-words is regenerated automatically when a document is changed in the application and exported again.
6. To add or remove entries, or change the month, account type, entry type and fund: change them in the application and regenerate. Report row structure is fixed at export time; this is not a replacement for the application's transaction editor.

Editing Excel does not synchronise the application database. The package is an editable snapshot. Formulas keep cached values so the original figures can be seen without opening the source files; different Excel readers may need a link update or recalculation. Each annual package carries its own opening balances rather than a direct link to a previously downloaded package.

## Print and PDF

Choose a month and report type, then click **PDF, original format**. The generator reads the same Excel workbook values and uses **LibreOffice Calc** to print to A4 PDF. There is no separate HTML layout. A PDF is the values at generation time; Excel changes after download do not alter earlier PDFs. Print an edited workbook with Excel, or change the application record and generate a new PDF.

The receipts/vouchers page offers **Excel, original format** and **PDF, original format** for individual documents. The individual Excel file uses editable fill-in cells with no dependencies on other files. Drafts, unpaid documents and voided documents carry status markers. Approved documents use the organisation profile frozen at approval.

## Calculations

- A single `RepeatableRead` database transaction supplies data to all four workbooks.
- Documents without a posting are excluded from the books.
- The books and monthly reports show real balance movements, including entries marked `OPENING`, `TRANSFER_IN`, `TRANSFER_OUT` and `REVERSAL`. Transfers only shift the bank/cash columns and are never counted as fund collection.
- The annual summary shows net receipts and expenses. A reversal becomes a negative value within its original type in the reversal month. Transfers are excluded; opening movements across the year appear on the **Adjustment** row that uses the blank space after the monthly balances. The closing balance includes those adjustments.
- `OTHER` accounts are included with bank; the heading becomes **Bank/lain** where needed, because the column then holds money that is not in a bank account.
- The dues summary reads the selected year's claims and the payment status at export time. It does not assume the member count or the RM1,000 rate from the original example. Each claim gets a row so duplicate payments with different dates or references are not lost. This is not a status report for a historical date before a void.
- Money is computed with `Decimal` during export, originating from integer sen. Formulas use `ROUND(..., 2)`. Values beyond Excel's numeric precision are rejected.

## Server setup

Python 3.10+, `venv` support and LibreOffice Calc are required. Debian/Ubuntu example:

```bash
sudo apt-get install python3-venv libreoffice-calc fonts-liberation
npm run setup:reports
```

`setup:local` also runs `setup:reports`. Python dependencies are pinned in `scripts/excel/requirements.txt` and installed into an uncommitted `.venv`. For a custom Python location, set `EXCEL_PYTHON` to an executable that has `openpyxl`. Never copy a virtualenv between machines; run setup again instead.

Run the application from the repository root. The `templates/excel` and `scripts/excel` directories are required on the server; the Next tracing configuration includes them. LibreOffice must be on the PM2 user's PATH. Use a single application instance as in the existing PM2 configuration. The two concurrent generations limit is enforced per process; for multiple instances, add a concurrency limit at the infrastructure level.

Export requests require an active session and responses use `Cache-Control: private, no-store`. No macros or formulas from original uploads are executed. Record text is inserted as literal values, including text beginning with `=`. Temporary files live in a private directory and are removed after generation. Worker errors never expose records or local paths to the user.

Package limits: 5,000 ledger entries, 500 documents and 5,000 dues claims for one year. Generation timeout is 110 seconds; requirements beyond that need an archive export through a background process. For nginx, use `proxy_read_timeout 120s` on the generation endpoint if the default timeout is shorter.

## Checks

```bash
npm run test:reports
npm run build
npm run test:e2e
```

The report tests check balances for 12 months, reversals, transfers, extra funds, opening balances, dynamic rows, empty data, formula injection, workbook caches and links, original styling and PDF. The recalculation test rewrites the generated workbook links into sheets inside a test workbook, changes a source amount, then asks LibreOffice to recalculate the formulas independently. Recalculation in desktop Microsoft Excel is not automated in this Linux environment.
