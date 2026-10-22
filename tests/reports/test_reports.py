from copy import copy, deepcopy
from decimal import Decimal
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
import zipfile

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('generator', ROOT / 'scripts/excel/generate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    org = {'name': 'JKKR Ujian', 'address': 'Alamat demonstrasi', 'phone': '000000',
           'email': 'ujian@example.invalid', 'preparedBy': 'Penyedia Ujian',
           'checkedBy': 'Penyemak Ujian', 'approvedBy': 'Pelulus Ujian'}
    entries = []
    def add(amount, kind='INCOME', month=1, group=0, original=None, account='BANK', **extra):
        i = len(entries) + 1
        entries.append(dict(id=str(i), date=f'2026-{month:02}-02', type=kind, originalType=original,
            amountSen=str(amount), description='Butiran ujian', category='Yuran ahli', reference=f'R{i}',
            accountType=account, fundId=f'f{group}', fundCode=f'F{group}', group=group,
            party='Ahli ujian', bankReference='000123', words='seratus ringgit Malaysia sahaja',
            documentId=f'd{i}', **extra))
    add(10000)
    add(-2000, 'EXPENSE')
    add(2000, 'REVERSAL', month=2, original='EXPENSE')
    add(-10000, 'REVERSAL', month=3, original='INCOME')
    add(-5000, 'TRANSFER_OUT', month=2)
    add(5000, 'TRANSFER_IN', month=2, account='CASH')
    add(3000, 'OPENING', month=4, group=3, account='OTHER')
    for i in range(15): add(101 + i, month=5, group=i % 4)
    for i in range(10): add(-51-i, 'EXPENSE', month=5, group=i % 4)
    entries[0]['party'] = '=HYPERLINK("https://example.invalid", "literal")'
    documents = [dict(id='d1', number='R1', type='RESIT', status='VOID', date='2026-01-02',
        amountSen='10000', party=entries[0]['party'], description='Butiran ujian', reference='000123',
        words=entries[0]['words'], entryId='1', snapshot={**org, 'name': 'Organisasi Beku'})]
    return dict(year=2026, organization=org, entries=entries, documents=documents,
        opening=[dict(fundId='f0', fundCode='F0', group=0, accountType='BANK', amountSen='100000')],
        tunjangId='f0', tunjangName='Gabungan JKKR', hasOther=True,
        dues=[dict(year=2026, month=1, amountSen='10000', memberCode='U01', memberName='Ahli',
                   paid=False, fundId='f0', reference='', documentId=None)], generatedAt='2026-10-12')


class ReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='kira-report-test-')
        cls.directory = Path(cls.tmp.name)
        cls.data = fixture()
        cls.export = module.Export(cls.data)
        cls.export.build(cls.directory)
        cls.books = [openpyxl.load_workbook(cls.directory / f, data_only=True) for f in module.FILES]
        cls.formulas = [openpyxl.load_workbook(cls.directory / f) for f in module.FILES]

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_original_styles_merges_and_no_historical_data(self):
        original = openpyxl.load_workbook(ROOT / 'templates/excel/1.xlsx')['resit']
        actual = self.formulas[0]['R0001']
        self.assertEqual(str(actual.merged_cells), str(original.merged_cells))
        for c in ['A2','A6','A24','B14']:
            self.assertEqual(copy(actual[c].font), copy(original[c].font))
            self.assertEqual(copy(actual[c].border), copy(original[c].border))
        self.assertEqual(actual.column_dimensions['A'].width, original.column_dimensions['A'].width)
        self.assertEqual(self.books[0]['R0001']['A2'].value, 'Organisasi Beku')
        self.assertEqual(self.books[0]['R0001']['A1'].value, 'DIBATALKAN')
        for wb in self.formulas:
            for s in wb:
                for row in s:
                    for c in row:
                        if c.value:
                            self.assertNotIn('D:\\', str(c.value))
                            self.assertNotIn('NORMASLIZA', str(c.value))

    def test_all_month_balances_reconcile_to_cashbook_and_annual(self):
        opening = Decimal('1000')
        for m in range(1,13):
            expected = opening + sum((Decimal(e['amountSen'])/100 for e in self.data['entries'] if int(e['date'][5:7]) <= m), Decimal(0))
            cash = self.books[1][module.MONTHS[m-1]]
            monthly = self.books[2][module.MONTHS[m-1]]
            annual = self.books[2]['rumusan']
            self.assertAlmostEqual(cash[f'X{cash.max_row-6}'].value, float(expected))
            self.assertAlmostEqual(monthly[f'L{monthly.max_row-7}'].value, float(expected))
            self.assertAlmostEqual(monthly[f'L{monthly.max_row-6}'].value, float(expected))
            self.assertAlmostEqual(annual.cell(19,m+2).value, float(expected))
        self.assertEqual(self.books[2]['rumusan']['D14'].value, -20)
        self.assertEqual(self.books[2]['rumusan']['E8'].value, -100)
        self.assertEqual(self.books[2]['rumusan']['F20'].value, 30)

    def test_labels_match_the_reference_workbooks(self):
        # The four workbooks are replacements for the treasurer's manual files,
        # so the fixed labels are part of the contract, not incidental text.
        receipt = self.books[0][self.export.doc_sheets['d1']]
        self.assertTrue(receipt['A4'].value.startswith('No. Telefon: '))
        self.assertIn('Email Add: ', receipt['A4'].value)
        annual = self.books[2]['rumusan']
        self.assertEqual(annual['B6'].value, f'BAKI PADA 1.1.{self.data["year"]}')
        self.assertEqual([annual.cell(r,1).value for r in range(8,12)], [1,2,3,4])
        self.assertEqual([annual.cell(r,1).value for r in range(14,18)], [1,2,3,4])
        tunjang = self.books[3]['rumusan tahunan']
        self.assertEqual([tunjang.cell(r,1).value for r in range(8,16)], list(range(1,9)))
        self.assertEqual([tunjang.cell(r,1).value for r in range(18,31)], list(range(1,14)))

    def test_deliberate_differences_from_the_reference_workbooks(self):
        # Three labels differ on purpose. The reference files are not always
        # right, so these assert the choice rather than the original text.
        tunjang = self.books[3]['rumusan tahunan']
        # Reference: 'RUMUSAN KEWANGAN TAHUN 2021' — plain title, no suffix.
        self.assertEqual(tunjang['A2'].value, f'RUMUSAN KEWANGAN TAHUN {self.data["year"]}')
        self.assertNotIn('AKAUN TUNJANG', tunjang['A2'].value)
        # Reference: 'FELDA', but that column listed settlements while ours
        # holds the member name, so it is labelled for what it contains.
        self.assertEqual(self.books[3]['rumusan yuran']['D4'].value, 'AHLI')
        # The monthly books name the opening balance after their own month. The
        # reference May sheet still said '1.4.2026', a leftover from April.
        for m in range(1,13):
            month = self.books[1][module.MONTHS[m-1]]
            self.assertEqual(month['B7'].value, f'Baki pada 1.{m}.{self.data["year"]}')

    def test_dynamic_rows_tunjang_and_empty_months(self):
        self.assertGreater(self.books[1]['Mei'].max_row, 24)
        self.assertGreater(self.books[2]['Mei'].max_row, 30)
        for m in range(1,13):
            expected = Decimal('1000') + sum((Decimal(e['amountSen'])/100 for e in self.data['entries'] if int(e['date'][5:7]) <= m and e['fundId']=='f0'), Decimal(0))
            tunjang = self.books[3][module.MONTHS[m-1]]
            self.assertAlmostEqual(tunjang[f'F{tunjang.max_row-15}'].value, float(expected))
            self.assertAlmostEqual(tunjang[f'F{tunjang.max_row-14}'].value, float(expected))
            self.assertAlmostEqual(self.books[3]['rumusan tahunan'].cell(32,m+2).value, float(expected))

    def test_literal_strings_and_real_relative_workbook_relationships(self):
        self.assertEqual(self.formulas[0]['Data']['C2'].data_type, 's')
        for wb in self.formulas[1:]:
            self.assertGreater(len(wb._external_links),0)
            for link in wb._external_links:
                self.assertIn(link.file_link.Target, module.FILES)
                self.assertGreater(len(link.externalBook.sheetDataSet.sheetData),0)
        self.assertEqual(self.books[0]['R0001']['B11'].value,self.data['entries'][0]['party'])
        self.assertEqual(self.books[3]['rumusan yuran']['E47'].value,0)
        self.assertEqual(self.books[3]['rumusan yuran']['G52'].value,100)

    def test_empty_year(self):
        data = deepcopy(self.data)
        data.update(entries=[],documents=[],opening=[],dues=[])
        other = module.Export(data)
        with tempfile.TemporaryDirectory() as tmp:
            other.build(Path(tmp))
            wb=openpyxl.load_workbook(Path(tmp)/module.FILES[2],data_only=True)
            self.assertEqual(wb['rumusan']['O19'].value,0)
            self.assertEqual(len(wb.sheetnames),13)

    def test_busy_month_uses_valid_length_formulas(self):
        data=deepcopy(self.data)
        sample=data['entries'][0]
        data['entries']=[{**sample,'id':f'large{i}','date':'2026-06-01','documentId':None} for i in range(250)]
        data['documents']=[]
        other=module.Export(data)
        with tempfile.TemporaryDirectory() as tmp:
            other.build(Path(tmp))
            wb=openpyxl.load_workbook(Path(tmp)/module.FILES[3],data_only=True)
            self.assertEqual(wb['rumusan tahunan']['H8'].value,25000)
            self.assertEqual(wb['rumusan tahunan']['H32'].value,26000)
            self.assertIn('_Kiraan',wb.sheetnames)
            for book in other.books:
                for s in book:
                    for row in s:
                        for c in row:
                            if c.data_type=='f':self.assertLess(len(c.value),8192)

    def test_excel_formulas_recalculate_after_source_edit(self):
        # Resolve the emitted external relationships into internal test sheet names,
        # then ask an independent spreadsheet engine to calculate all formulas.
        merged=openpyxl.Workbook();merged.remove(merged.active)
        names={(i,s.title):f'B{i}_{n}' for i,wb in enumerate(self.formulas) for n,s in enumerate(wb)}
        for i,wb in enumerate(self.formulas):
            for s in wb:
                dest=merged.create_sheet(names[(i,s.title)])
                for row in s:
                    for c in row:
                        if c.value is None:continue
                        value=c.value
                        if c.data_type=='f':
                            def sub(match):
                                name=match.group(1).replace("''", "'")
                                target=i
                                if name.startswith('['):
                                    index=int(name[1:name.index(']')])-1
                                    target=module.FILES.index(wb._external_links[index].file_link.Target)
                                    name=name[name.index(']')+1:]
                                return "'"+names[(target,name)]+"'!"
                            value=re.sub(r"'((?:[^']|'')+)'!",sub,value)
                        dest[c.coordinate]=value
                        dest[c.coordinate].data_type=c.data_type
        merged[names[(0,'Data')]]['E2']=150
        source=self.directory/'recalc.xlsx';merged.save(source)
        out=self.directory/'recalculated';out.mkdir(exist_ok=True)
        subprocess.run(['soffice',f'-env:UserInstallation={(out/"profile").as_uri()}',
            '--headless','--convert-to','xlsx','--outdir',str(out),str(source)],check=True,capture_output=True,timeout=90)
        wb=openpyxl.load_workbook(out/'recalc.xlsx',data_only=True)
        errors=[(s.title,c.coordinate,c.value) for s in wb for row in s for c in row if c.data_type=='e']
        self.assertEqual(errors,[])
        self.assertEqual(wb[names[(0,'R0001')]]['B14'].value,150)
        self.assertEqual(wb[names[(1,'Januari')]]['X18'].value,1130)
        self.assertEqual(wb[names[(2,'Januari')]]['L23'].value,1130)
        self.assertEqual(wb[names[(2,'rumusan')]]['C19'].value,1130)
        self.assertEqual(wb[names[(3,'Januari')]]['F17'].value,1130)
        self.assertEqual(wb[names[(3,'rumusan tahunan')]]['C32'].value,1130)

    def test_pdf_from_same_workbook(self):
        pdf=self.export.pdf(self.directory,'document',1,'d1')
        self.assertTrue(pdf.read_bytes().startswith(b'%PDF'))
        self.assertGreater(pdf.stat().st_size,5000)


if __name__=='__main__':unittest.main()
