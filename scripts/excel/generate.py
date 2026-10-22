"""Trusted, sanitized templates -> linked XLSX workbooks and matching PDF pages.

User strings are always literal cells. Only formulas constructed here are executed.
No uploaded workbook, macro, URL or external historical reference is executed.
"""
from __future__ import annotations

import argparse
from copy import copy
from datetime import datetime
from decimal import Decimal
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile
import xml.etree.ElementTree as ET

import openpyxl
from openpyxl.cell.cell import MergedCell
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter as col
from openpyxl.utils.datetime import to_excel
from openpyxl.workbook.external_link.external import (
    ExternalLink, ExternalBook, ExternalSheetNames, ExternalSheetDataSet,
    ExternalSheetData, ExternalRow, ExternalCell,
)
from openpyxl.packaging.relationship import Relationship
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.pagebreak import Break
from openpyxl.workbook.defined_name import DefinedName

ROOT = Path(__file__).resolve().parents[2]
FILES = ['1. Baucer dan Resit.xlsx', '2. Buku Kewangan.xlsx',
         '3. Bulanan dan Rumusan Tahunan.xlsx', '4. Akaun Tunjang.xlsx']
MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
          'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']
IN_CATEGORIES = ['Yuran', 'Tunggakan yuran', 'Hibah bank', 'Elaun Mesyuarat Penuh HQ',
                 'Dividen Pelaburan', 'Sumbangan', 'Lain-lain', 'Pelarasan penerimaan']
OUT_CATEGORIES = ['Elaun Mesyuarat Penuh', 'Elaun Mesyuarat EXCO', 'Gaji+Perkeso Pekerja',
                  'Kwsp pekerja', 'Jamuan Mesyuarat', 'Fotostat Minit', 'Tempat Mesyuarat',
                  'Unifom ahli gabungan', 'Hadiah', 'Alat tulis',
                  'Elaun Mesy GPW dibayar ke akaun Gabungan', 'Bayaran bank', 'Lain-lain']
ZERO = Decimal(0)
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'


def ringgit(sen):
    return Decimal(str(sen)) / 100


def category(entry):
    label = entry['category'].strip()
    aliases = {'Yuran ahli': 'Yuran', 'Gaji': 'Gaji+Perkeso Pekerja',
               'Hibah': 'Hibah bank', 'Lain2': 'Lain-lain'}
    label = aliases.get(label, label)
    kind = entry.get('originalType') or entry['type']
    options = IN_CATEGORIES if kind == 'INCOME' else OUT_CATEGORIES
    if entry.get('dueYear') and entry['dueYear'] < int(entry['date'][:4]):
        label = 'Tunggakan yuran'
    return next((x for x in options if x.casefold() == label.casefold()), 'Lain-lain')


class Export:
    def __init__(self, data):
        self.data = data
        self.year = data['year']
        self.org = data['organization']
        self.books = [openpyxl.load_workbook(ROOT / f'templates/excel/{i}.xlsx') for i in range(1, 5)]
        self.values = {}  # Includes every literal and calculated value, for formula caches.
        self.links = [[], [], [], []]
        self.entries = data['entries']
        self.rows = {}
        self.ledger_rows = {}
        self.metrics = {}
        self.doc_sheets = {}
        self.print_sheets = {}

    def book_id(self, s):
        return self.books.index(s.parent)

    def put(self, s, address, value, formula=None):
        c = s[address]
        if isinstance(value, Decimal) and abs(value * 100) >= 10**14:
            raise ValueError('Jumlah melebihi ketepatan Excel. Kecilkan skop laporan.')
        if formula:
            c.value = '=' + formula
        else:
            c.value = value
            if isinstance(value, str):
                c.data_type = 's'  # Prevent spreadsheet formula injection.
        self.values[(self.book_id(s), s.title, address)] = value
        if isinstance(value, Decimal):
            c.number_format = '#,##0.00;[Red](#,##0.00);"-"'
        return value

    def val(self, s, address):
        return self.values.get((self.book_id(s), s.title, address), s[address].value)

    def ref(self, dest, source, address):
        i, j = self.book_id(dest), self.book_id(source)
        prefix = ''
        if i != j:
            if j not in self.links[i]:
                self.links[i].append(j)
            prefix = f'[{self.links[i].index(j) + 1}]'
        name = (prefix + source.title).replace("'", "''")
        return f"'{name}'!{address}"

    def link(self, dest, address, source, src, negative=False):
        value = self.val(source, src)
        if value is None:
            self.put(dest, address, '')
            return
        self.put(dest, address, -value if negative else value,
                 ('-' if negative else '') + self.ref(dest, source, src))
        if isinstance(value, datetime):
            dest[address].number_format = 'd/m/yyyy'

    def total(self, s, address, refs, signs=None):
        refs = list(refs)
        if not refs:
            return self.put(s, address, ZERO)
        signs = signs or [1] * len(refs)
        return self.expression_sum(s,address,[(('' if sign>0 else '-')+self.ref(s,src,a),
            Decimal(self.val(src,a) or 0)*sign) for (src,a),sign in zip(refs,signs)])

    def expression_sum(self,s,address,parts):
        """Keep formulas below Excel's 8,192-character limit for busy years."""
        if not parts:return self.put(s,address,ZERO)
        if sum(len(expr)+1 for expr,value in parts)>7000:
            wb=s.parent
            helper=wb['_Kiraan'] if '_Kiraan' in wb.sheetnames else wb.create_sheet('_Kiraan')
            helper.sheet_state='hidden'
            chunks=[];chunk=[];size=0
            for part in parts:
                if size+len(part[0])+1>6000 and chunk:
                    chunks.append(chunk);chunk=[];size=0
                chunk.append(part);size+=len(part[0])+1
            if chunk:chunks.append(chunk)
            new=[]
            for chunk in chunks:
                cell=f'A{helper.max_row+1}'
                value=self.expression_sum(helper,cell,chunk)
                new.append((self.ref(s,helper,cell),value))
            return self.expression_sum(s,address,new)
        expr='+'.join(expr for expr,value in parts)
        value=sum((value for expr,value in parts),ZERO)
        return self.put(s,address,value,f'ROUND({expr},2)')

    def summed_range(self, s, address, column, start, end):
        v = sum((Decimal(self.val(s, f'{column}{r}') or 0) for r in range(start, end + 1)), ZERO)
        self.put(s, address, v, f'ROUND(SUM({column}{start}:{column}{end}),2)')

    def copied(self, book, template, title, expand=()):
        """Copy original formatting while inserting body rows and moving all merges."""
        src = self.books[book][template]
        dst = self.books[book].create_sheet(title)
        def row(r):
            return r + sum(count for at, count, sample in expand if r >= at)
        for key, d in src.column_dimensions.items():
            dst.column_dimensions[key] = copy(d)
        for r, d in src.row_dimensions.items():
            dst.row_dimensions[row(r)] = copy(d)
            dst.row_dimensions[row(r)].index = row(r)
        for cells in src:
            for c in cells:
                if isinstance(c, MergedCell):
                    continue
                n = dst.cell(row(c.row), c.column)
                n.value, n._style = c.value, copy(c._style)
        for at, count, sample in expand:
            for r in range(row(at) - count, row(at)):
                dst.row_dimensions[r].height = src.row_dimensions[sample].height
                for c in range(1, src.max_column + 1):
                    dst.cell(r, c)._style = copy(src.cell(sample, c)._style)
        for m in src.merged_cells.ranges:
            dst.merge_cells(start_row=row(m.min_row), end_row=row(m.max_row),
                            start_column=m.min_col, end_column=m.max_col)
        for attr in ['page_margins', 'page_setup', 'print_options', 'sheet_format', 'sheet_properties']:
            setattr(dst, attr, copy(getattr(src, attr)))
        dst.sheet_view.showGridLines = False
        dst.print_area = f'A1:{col(src.max_column)}{row(src.max_row)}'
        return dst, row

    def signatures(self, s, points, org=None):
        org = org or self.org
        for (column, row), key in zip(points, ['preparedBy', 'checkedBy', 'approvedBy']):
            self.put(s, f'{column}{row}', org.get(key, ''))
            self.put(s, f'{column}{row+2}', org.get('name', ''))

    def fit_body(self, s, row, columns):
        height=s.row_dimensions[row].height or 13.5
        for c in columns:
            cell=s[f'{c}{row}']
            cell.alignment=Alignment(wrap_text=True,vertical='top')
            width=s.column_dimensions[c].width or 9
            # Estimate visual wrapping using the actual inherited column widths.
            lines=sum(max(1,math.ceil(len(line)/max(1,width*.85))) for line in str(self.val(s,cell.coordinate) or '').split('\n'))
            height=max(height,lines*(cell.font.sz or 10)*1.35)
        s.row_dimensions[row].height=height

    def table(self, book, title, headers):
        s = self.books[book].create_sheet(title)
        for n, h in enumerate(headers, 1):
            self.put(s, f'{col(n)}1', h)
            s.cell(1, n).font = Font(bold=True, color='FFFFFF')
            s.cell(1, n).fill = PatternFill('solid', fgColor='245E48')
            s.column_dimensions[col(n)].width = 22
        s.freeze_panes = 'A2'
        return s

    def sources(self):
        self.source = s = self.table(0, 'Data', ['Tarikh', 'No dokumen / rujukan', 'Pembayar / penerima', 'Butiran',
            'Amaun bertanda (RM)', 'Jenis akaun', 'Dana', 'Kumpulan dana', 'Jenis catatan', 'Kategori asal',
            'No cek / bank', 'Ahli', 'Tahun yuran', 'Kategori tunjang', 'Ringgit Malaysia', 'ID dana',
            'ID dokumen', 'Penerimaan bersih', 'Perbelanjaan bersih', 'Pelarasan', 'Pindahan'])
        categories=self.books[0].create_sheet('Kategori')
        categories.sheet_state='hidden'
        for c,labels,name in [('A',IN_CATEGORIES,'KategoriMasuk'),('B',OUT_CATEGORIES,'KategoriKeluar')]:
            for r,label in enumerate(labels,1):self.put(categories,f'{c}{r}',label)
            self.books[0].defined_names.add(DefinedName(name,attr_text=f"'Kategori'!${c}$1:${c}${len(labels)}"))
        validations={}
        for name in ['KategoriMasuk','KategoriKeluar']:
            validation=DataValidation(type='list',formula1=name,allow_blank=False)
            validation.showErrorMessage=True;validation.errorStyle='stop'
            validation.error='Pilih kategori daripada senarai.'
            s.add_data_validation(validation);validations[name]=validation
        for incoming in [True,False]:
            validation=DataValidation(type='decimal',operator='between',
                formula1='0.01' if incoming else '-9999999999.99',
                formula2='9999999999.99' if incoming else '-0.01')
            validation.showErrorMessage=True;validation.errorStyle='stop'
            validation.error='Kekalkan tanda amaun asal. Untuk tukar jenis catatan, ubah dalam aplikasi dan jana semula.'
            s.add_data_validation(validation);validations[incoming]=validation
        for r, e in enumerate(self.entries, 2):
            self.rows[e['id']] = r
            amount = ringgit(e['amountSen'])
            vals = [datetime.fromisoformat(e['date'][:10]), e['reference'], e.get('party', ''), e['description'],
                    amount, e['accountType'], e['fundCode'], e['group'], e['type'], e['category'],
                    e.get('bankReference', ''), e.get('memberId', ''), e.get('dueYear', ''), category(e),
                    e.get('words', ''), e['fundId'], e.get('documentId', '')]
            for n, value in enumerate(vals, 1):
                self.put(s, f'{col(n)}{r}', value)
            s[f'A{r}'].number_format = 'd/m/yyyy'
            kind = e.get('originalType') or e['type']
            validations[amount>=0].add(f'E{r}')
            validations['KategoriMasuk' if kind=='INCOME' else 'KategoriKeluar'].add(f'N{r}')
            for c, value, expr in [('R', amount if kind == 'INCOME' else ZERO, f'E{r}' if kind == 'INCOME' else '0'),
                                   ('S', -amount if kind == 'EXPENSE' else ZERO, f'-E{r}' if kind == 'EXPENSE' else '0'),
                                   ('T', amount if kind == 'OPENING' else ZERO, f'E{r}' if kind == 'OPENING' else '0'),
                                   ('U', amount if kind.startswith('TRANSFER') else ZERO, f'E{r}' if kind.startswith('TRANSFER') else '0')]:
                self.put(s, f'{c}{r}', value, expr)
        s.auto_filter.ref = f'A1:U{max(2,s.max_row)}'
        self.opening = o = self.table(0, 'Baki awal', ['Dana', 'Kumpulan dana', 'Jenis akaun', 'Baki sebelum tahun (RM)', 'ID dana'])
        for r, e in enumerate(self.data['opening'], 2):
            for n, v in enumerate([e['fundCode'], e['group'], e['accountType'], ringgit(e['amountSen']), e['fundId']], 1):
                self.put(o, f'{col(n)}{r}', v)
        self.dues_source = d = self.table(0, 'Data yuran', ['Kod ahli', 'Nama ahli', 'Tahun', 'Bulan', 'Yuran dituntut', 'Yuran dijelaskan', 'No cek', 'Tarikh diterima', 'ID dana'])
        for r, e in enumerate(self.data['dues'], 2):
            received = e.get('receivedDate')
            vals = [e['memberCode'], e['memberName'], e['year'], e['month'], ringgit(e['amountSen']),
                    ringgit(e['amountSen']) if e['paid'] else ZERO, e.get('reference',''),
                    datetime.fromisoformat(received[:10]) if received else '', e.get('fundId','')]
            for n, v in enumerate(vals, 1):
                self.put(d, f'{col(n)}{r}', v)
            d[f'H{r}'].number_format = 'd/m/yyyy'
            linked = next((entry for entry in self.entries if entry.get('documentId') == e.get('documentId')
                           and e.get('documentId') and entry['type'] == 'INCOME'), None)
            if e['paid'] and linked:
                self.link(d, f'F{r}', self.source, f'R{self.rows[linked["id"]]}')
        self.info = info = self.table(0, 'Panduan', ['Perkara', 'Keterangan'])
        rows = [
            ('Organisasi', self.org['name']), ('Tahun', self.year),
            ('Edit', 'Ubah amaun, nama, butiran dan rujukan pada Data. Laporan lain menggunakan formula pautan.'),
            ('Struktur', 'Untuk tambah/padam transaksi, tukar bulan, dana atau jenis akaun: ubah di aplikasi dan jana semula.'),
            ('Pautan', 'Ekstrak keempat-empat fail ke folder yang sama. Kekalkan nama fail. Buka semuanya dan kemas kini pautan.'),
            ('Aplikasi', 'Edit Excel tidak mengubah database aplikasi. Pakej ini ialah salinan pada masa dijana.'),
            ('Amaun perkataan', 'Jika amaun diedit dalam Excel, kemas kini ruangan Ringgit Malaysia pada Data juga.'),
            ('Tunjang', self.data['tunjangName']),
            ('Lain2', 'Semua dana yang tidak dipilih sebagai GAB / AC TUMPANG / KEROHANIAN digabungkan di LAIN2.'),
            ('Kategori', 'Kategori tidak sepadan ditempatkan dalam Lain-lain. Kategori tunjang pada Data boleh diubah.'),
            ('Catatan', 'Buku dan laporan bulanan menunjukkan pergerakan termasuk pindahan/pembalikan/pembukaan. Rumusan tahunan mengasingkan pelarasan dan mengecualikan pindahan.'),
            ('Yuran', 'Yuran berdasarkan tuntutan yang telah dijana bagi tahun ini dan status bayaran semasa eksport; bukan andaian 42 ahli x RM1000.'),
            ('Akaun OTHER', 'Akaun OTHER disertakan dalam Bank/lain apabila wujud; tidak digugurkan.'),
            ('Masa dijana', self.data.get('generatedAt','')),
        ]
        for r, pair in enumerate(rows,2):
            self.put(info,f'A{r}',pair[0]);self.put(info,f'B{r}',pair[1])
            info[f'B{r}'].alignment = Alignment(wrap_text=True, vertical='top')
            info.row_dimensions[r].height = 45
        info.column_dimensions['B'].width = 100

    def documents(self):
        for i, d in enumerate(self.data['documents'], 1):
            title = ('B' if d['type'] == 'BAUCER' else 'R') + f'{i:04}'
            s, _ = self.copied(0, 'baucer' if d['type']=='BAUCER' else 'resit', title)
            self.doc_sheets[d['id']] = title
            org = d.get('snapshot') or self.org
            for a,v in {'A2':org['name'], 'A3':org.get('address',''),
                        'A4':f"No. Telefon: {org.get('phone','')}  Email Add: {org.get('email','')}",
                        'B8':d['number'], 'B9':datetime.fromisoformat(d['date'][:10]),
                        'B11':d['party'], 'B14':ringgit(d['amountSen']), 'B15':d['words'],
                        'B18':d['description'], 'B22':d['reference']}.items():
                self.put(s,a,v)
            s['B9'].number_format = 'd/m/yyyy'
            if d.get('entryId') in self.rows:
                r = self.rows[d['entryId']]
                for a,c in [('B8','B'),('B9','A'),('B11','C'),('B15','O'),('B18','D'),('B22','K')]:
                    self.link(s,a,self.source,f'{c}{r}')
                self.put(s,'B14',ringgit(d['amountSen']),f'ABS({self.ref(s,self.source,f"E{r}")})')
            else:
                # Standalone drafts remain editable, never included as posted ledger rows.
                pass
            self.signatures(s, [('A',26),('B',26),('E',26)] if d['type']=='BAUCER' else [('A',26),('B',26)],org)
            for c in ['A','B','E']:
                self.put(s,f'{c}29','')
            if d['status'] != 'PAID':
                labels={'VOID':'DIBATALKAN','DRAFT':'DRAF','REJECTED':'DITOLAK','PENDING':'MENUNGGU KELULUSAN','APPROVED':'BELUM DIBAYAR'}
                self.put(s,'A1',labels.get(d['status'],d['status']))
                s['A1'].font=Font(bold=True,color='B42318',size=12)
            for a in ['B11','B15','B18']:
                s[a].alignment=Alignment(wrap_text=True,vertical='center')
            # Expand only content rows when long text requires it, retaining the cell layout.
            s.row_dimensions[18].height=max(s.row_dimensions[18].height or 16, 14 * (1+len(d['description'])//90))
            s.row_dimensions[15].height=max(s.row_dimensions[15].height or 16, 14 * (1+len(d['words'])//90))
            s.page_setup.fitToHeight=1
        for name in ['baucer','resit']:
            self.books[0].remove(self.books[0][name])
        # Printed documents first; data and guidance remain visible and editable.
        self.books[0]._sheets.sort(key=lambda s: 0 if s.title in self.doc_sheets.values() else 1)

    def opening_refs(self, group=None, account=None, tunjang=False):
        return [(self.opening,f'D{r}') for r,e in enumerate(self.data['opening'],2)
                if (group is None or e['group']==group)
                and (account is None or (e['accountType']=='CASH') == (account=='CASH'))
                and (not tunjang or e['fundId']==self.data['tunjangId'])]

    def cashbooks(self):
        previous=None
        for m in range(1,13):
            entries=[e for e in self.entries if int(e['date'][5:7])==m]
            extra=max(0,len(entries)-9)
            s,row=self.copied(1,'Sheet1',MONTHS[m-1],[(17,extra,16)])
            total,closing=row(17),row(18)
            self.print_sheets[('cash',m)]=s
            self.put(s,'A2',self.org['name']);self.put(s,'A3',f'BULAN : {MONTHS[m-1].upper()} {self.year}')
            self.put(s,'B7',f'Baki pada 1.{m}.{self.year}')
            if self.data.get('hasOther'):
                for a in ['E6','N6','W6']:self.put(s,a,'Bank/lain')
            for j,c in enumerate('IJKL'):
                if previous:self.link(s,f'{c}7',previous[0],f'{c}{previous[1]}')
                else:self.total(s,f'{c}7',self.opening_refs(group=j))
            for c,t in [('V','CASH'),('W','BANK')]:
                if previous:self.link(s,f'{c}7',previous[0],f'{c}{previous[2]}')
                else:self.total(s,f'{c}7',self.opening_refs(account=t))
            self.total(s,'X7',[(s,'V7'),(s,'W7')])
            for r,e in enumerate(entries,8):
                self.ledger_rows[e['id']]=(s,r)
                sr=self.rows[e['id']]
                for c,sc in [('A','A'),('B','C'),('C','D')]:self.link(s,f'{c}{r}',self.source,f'{sc}{sr}')
                s[f'A{r}'].number_format='d'
                if e['type'] not in ['INCOME','EXPENSE']:
                    self.put(s,f'C{r}',f"[{e['type']}] {e['description']}")
                amount=ringgit(e['amountSen']); incoming=amount>=0
                cash=e['accountType']=='CASH'
                c=('D' if cash else 'E') if incoming else ('M' if cash else 'N')
                self.put(s,f'{c}{r}',abs(amount),f'ABS({self.ref(s,self.source,f"E{sr}")})')
                if not e['type'].startswith('TRANSFER'):
                    self.link(s,f'{"F" if incoming else "O"}{r}',s,f'{c}{r}')
                    self.link(s,f'{col((9 if incoming else 18)+e["group"])}{r}',s,f'{c}{r}')
                self.link(s,f'{"G" if incoming else "P"}{r}',self.source,f'B{sr}')
                self.link(s,f'{"H" if incoming else "Q"}{r}',self.source,f'K{sr}')
                for bc,ic,oc in [('V','D','M'),('W','E','N')]:
                    refs=[(s,f'{bc}{r-1}')];signs=[1]
                    for cc,sign in [(ic,1),(oc,-1)]:
                        if self.val(s,f'{cc}{r}') is not None:refs.append((s,f'{cc}{r}'));signs.append(sign)
                    self.total(s,f'{bc}{r}',refs,signs)
                self.total(s,f'X{r}',[(s,f'V{r}'),(s,f'W{r}')])
                # Keep long user text readable without changing the original columns.
                self.fit_body(s,r,['B','C'])
                for c in ['G','H','P','Q']:
                    s[f'{c}{r}'].alignment=Alignment(shrink_to_fit=True,vertical='center')
            for c in 'DEFIJKLMNORSTU':self.summed_range(s,f'{c}{total}',c,8,total-1)
            for c,ic,oc in [('V','D','M'),('W','E','N')]:
                self.total(s,f'{c}{total}',[(s,f'{c}7'),(s,f'{ic}{total}'),(s,f'{oc}{total}')],[1,1,-1])
            self.total(s,f'X{total}',[(s,f'V{total}'),(s,f'W{total}')])
            for ic,oc in zip('IJKL','RSTU'):
                self.total(s,f'{ic}{closing}',[(s,f'{ic}7'),(s,f'{ic}{total}'),(s,f'{oc}{total}')],[1,1,-1])
            self.total(s,f'X{closing}',[(s,f'{c}{closing}') for c in 'IJKL'])
            self.signatures(s,[(c,row(22)) for c in ['B','F','K']])
            s.print_title_rows='1:6'
            previous=(s,closing,total)
        self.books[1].remove(self.books[1]['Sheet1'])
        self.analysis=a=self.table(1,'Analisis',['Bulan','Kumpulan','Baki awal','Masuk bersih','Keluar bersih','Pelarasan','Baki akhir'])
        for m in range(1,13):
            for g in range(5):
                r=2+(m-1)*5+g
                self.metrics[(m,g)]=r
                self.put(a,f'A{r}',m);self.put(a,f'B{r}',g)
                selected=[e for e in self.entries if int(e['date'][5:7])==m and
                          (e['group']==g if g<4 else e['fundId']==self.data['tunjangId'])]
                if m==1:self.total(a,f'C{r}',self.opening_refs(group=g if g<4 else None,tunjang=g==4))
                else:self.link(a,f'C{r}',a,f'G{r-5}')
                for c,sc in [('D','R'),('E','S'),('F','T')]:
                    self.total(a,f'{c}{r}',[(self.source,f'{sc}{self.rows[e["id"]]}') for e in selected])
                self.total(a,f'G{r}',[(a,f'{c}{r}') for c in 'CDEF'],[1,1,-1,1])

    def monthly(self):
        for m in range(1,13):
            es=[e for e in self.entries if int(e['date'][5:7])==m]
            inc=[e for e in es if int(e['amountSen'])>=0];out=[e for e in es if int(e['amountSen'])<0]
            s,row=self.copied(2,'jan',MONTHS[m-1],[(14,max(0,len(inc)-7),13),(22,max(0,len(out)-5),21)])
            self.print_sheets[('monthly',m)]=s
            cash=self.print_sheets[('cash',m)]
            self.put(s,'A1',self.org['name']);self.put(s,'A3',f'{MONTHS[m-1].upper()} {self.year}')
            self.put(s,'A6',f'Baki pada 1.{m}.{self.year}')
            for c,cc in zip('FGHIJKL','IJKLVWX'):self.link(s,f'{c}6',cash,f'{cc}7')
            for items,start,incoming in [(inc,7,True),(out,row(17),False)]:
                for r,e in enumerate(items,start):
                    source,rr=self.ledger_rows[e['id']]
                    mapping=[('A','A'),('B','B'),('C','C'),('D','G' if incoming else 'P'),('E','H' if incoming else 'Q')]
                    mapping+=list(zip('FGHI','IJKL' if incoming else 'RSTU'))
                    mapping+=list(zip('JK','DE' if incoming else 'MN'))
                    for c,cc in mapping:self.link(s,f'{c}{r}',source,f'{cc}{rr}')
                    s[f'A{r}'].number_format='d'
                    self.total(s,f'L{r}',[(s,f'{c}{r}') for c in 'JK'])
                    self.fit_body(s,r,['B','C'])
                    for c in ['D','E']:s[f'{c}{r}'].alignment=Alignment(shrink_to_fit=True,vertical='center')
            for c in 'FGHIJKL':
                self.summed_range(s,f'{c}{row(14)}',c,7,row(14)-1)
                self.total(s,f'{c}{row(15)}',[(s,f'{c}6'),(s,f'{c}{row(14)}')])
                self.summed_range(s,f'{c}{row(22)}',c,row(17),row(22)-1)
                self.total(s,f'{c}{row(23)}',[(s,f'{c}{row(15)}'),(s,f'{c}{row(22)}')],[1,-1])
                # Explicit reconciliation to the linked cashbook, not a historical hardcoded value.
                self.link(s,f'{c}{row(24)}',cash,f'{dict(zip("FGHIJKL","IJKLVWX"))[c]}{cash.max_row-6 if c in "FGHI" else cash.max_row-7}')
            self.put(s,f'B{row(14)}','Jumlah wang masuk')
            if self.data.get('hasOther'):
                self.put(s,'K5','Bank/lain');self.put(s,f'K{row(16)}','Bank/lain')
            self.signatures(s,[(c,row(28)) for c in ['A','D','J']])
            s.print_title_rows='1:3'
            if sum((d.height or 13.5) for d in s.row_dimensions.values())>460:
                s.row_breaks.append(Break(id=row(16)-1))
        self.books[2].remove(self.books[2]['jan'])
        self.annual(2,'rumusan',False)

    def annual(self,book,title,tunjang):
        s=self.books[book][title]
        self.print_sheets[('tunjang-annual' if tunjang else 'annual',0)]=s
        self.put(s,'A1',self.org['name'])
        # The reference summary carries the plain title even in the funds workbook;
        # the workbook itself, its tab name and the printed header say which fund.
        self.put(s,'A2',f'RUMUSAN KEWANGAN TAHUN {self.year}')
        self.put(s,'C4',f'TAHUN {self.year}');self.put(s,'B6',f'BAKI PADA 1.1.{self.year}')
        it,ot,closing,adjust=(16,31,32,33) if tunjang else (12,18,19,20)
        self.put(s,f'B{adjust}','Pelarasan')
        for m in range(1,13):
            c=col(m+2)
            groups=[4] if tunjang else list(range(4))
            refs=[(self.analysis,f'C{self.metrics[(m,g)]}') for g in groups]
            self.total(s,f'{c}6',refs)
            if tunjang:
                selected=[e for e in self.entries if int(e['date'][5:7])==m and e['fundId']==self.data['tunjangId']]
                for cats,start,sc in [(IN_CATEGORIES,8,'R'),(OUT_CATEGORIES,18,'S')]:
                    for offset,label in enumerate(cats):
                        r=start+offset;self.put(s,f'B{r}',label);self.put(s,f'A{r}',offset+1)
                        terms=[]
                        for e in selected:
                            sr=self.rows[e['id']]
                            # SUMIF/IF criteria are cell references: user strings never become formula text.
                            # Qualify the label reference so chunked helper formulas also recalculate.
                            expression=f'IF({self.ref(s,self.source,f"N{sr}")}={self.ref(s,s,f"B{r}")},{self.ref(s,self.source,f"{sc}{sr}")},0)'
                            terms.append((expression,self.val(self.source,f'{sc}{sr}') if category(e)==label else ZERO))
                        self.expression_sum(s,f'{c}{r}',terms)
            else:
                for g in range(4):
                    for r,sc in [(8+g,'D'),(14+g,'E')]:
                        self.link(s,f'{c}{r}',self.analysis,f'{sc}{self.metrics[(m,g)]}')
                # Row number, label and Bil number, numbered 1-4 in each section as in the reference.
                for r,label,n in [(8,'Gabungan JKKR',1),(9,'AC Tumpang',2),(10,'Dana Kerohanian',3),(11,'Lain2',4),
                                  (14,'Gabungan JKKR',1),(15,'AC Tumpang',2),(16,'Dana Kerohanian',3),(17,'Lain2',4)]:
                    self.put(s,f'B{r}',label);self.put(s,f'A{r}',n)
            self.summed_range(s,f'{c}{it}',c,8,it-1)
            self.summed_range(s,f'{c}{ot}',c,18 if tunjang else 14,ot-1)
            self.total(s,f'{c}{adjust}',[(self.analysis,f'F{self.metrics[(m,g)]}') for g in groups])
            self.total(s,f'{c}{closing}',[(s,f'{c}{r}') for r in [6,it,ot,adjust]],[1,1,-1,1])
        numeric=list(range(8,it+1))+list(range(18 if tunjang else 14,ot+1))+[adjust]
        for r in numeric:
            self.total(s,f'O{r}',[(s,f'{c}{r}') for c in 'CDEFGHIJKLMN'])
        self.link(s,'O6',s,'C6')
        self.total(s,f'O{closing}',[(s,f'O{r}') for r in [6,it,ot,adjust]],[1,1,-1,1])
        self.signatures(s,[(c,39 if tunjang else 26) for c in ['C','G','L']])
        s.page_setup.fitToHeight=1

    def tunjang(self):
        for m in range(1,13):
            es=[e for e in self.entries if int(e['date'][5:7])==m and e['fundId']==self.data['tunjangId'] and not e['type'].startswith('TRANSFER')]
            inc=[e for e in es if int(e['amountSen'])>=0];out=[e for e in es if int(e['amountSen'])<0]
            s,row=self.copied(3,'jan2021',MONTHS[m-1],[(11,max(0,len(inc)-4),10),(16,max(0,len(out)-3),15)])
            self.print_sheets[('tunjang',m)]=s
            self.put(s,'A1',self.org['name']);self.put(s,'A2',f'AKAUN TUNJANG {self.data["tunjangName"]}')
            self.put(s,'A3',f'{MONTHS[m-1].upper()} {self.year}');self.put(s,'A6',f'Baki pada 1.{m}.{self.year}')
            self.link(s,'F6',self.analysis,f'C{self.metrics[(m,4)]}')
            for items,start,incoming in [(inc,7,True),(out,row(13),False)]:
                for r,e in enumerate(items,start):
                    src,rr=self.ledger_rows[e['id']]
                    for c,cc in [('A','A'),('B','G' if incoming else 'P'),('C','H' if incoming else 'Q'),('D','B'),('E','C'),('F','F' if incoming else 'O')]:self.link(s,f'{c}{r}',src,f'{cc}{rr}')
                    s[f'A{r}'].number_format='d'
                    self.fit_body(s,r,['D','E'])
                    for c in ['B','C']:s[f'{c}{r}'].alignment=Alignment(shrink_to_fit=True,vertical='center')
            self.summed_range(s,f'F{row(11)}','F',7,row(11)-1)
            self.summed_range(s,f'F{row(16)}','F',row(13),row(16)-1)
            self.total(s,f'F{row(17)}',[(s,f'F{r}') for r in [6,row(11),row(16)]],[1,1,-1])
            self.link(s,f'F{row(18)}',self.analysis,f'G{self.metrics[(m,4)]}')
            self.signatures(s,[('A',row(23)),('F',row(23)),('F',row(30))])
            # Original signatures start in F and overflow into the blank G:I area.
            # Include those original blank columns in the print area to avoid clipping.
            s.print_area=f'A1:I{row(32)}'
            for c in 'GHI':s.column_dimensions[c].width=9.14
            s.print_title_rows='1:3'
            if sum((d.height or 13.5) for d in s.row_dimensions.values())>650:
                s.row_breaks.append(Break(id=row(12)-1))
        self.books[3].remove(self.books[3]['jan2021'])
        self.annual(3,'rumusan tahunan',True)
        dues=self.data['dues']
        # One line per claim/payment so multiple receipts never lose their dates/references.
        template=self.books[3]['rumusan yuran']
        template.title='_yuran'
        s,row=self.copied(3,'_yuran','rumusan yuran',[(47,max(0,len(dues)-42),46)])
        self.print_sheets[('dues',0)]=s
        self.books[3].remove(template)
        self.put(s,'A1',self.org['name']);self.put(s,'A2',f'KUTIPAN YURAN {self.year}')
        # Column D holds the member name (the dues table has no region field), so
        # label it as such: the reference header said FELDA because it listed
        # settlements, which this data model does not record.
        self.put(s,'E4',f'YURAN {self.year}');self.put(s,'D4','AHLI')
        for r,d in enumerate(dues,5):
            sr=r-3
            self.put(s,f'C{r}',r-4)
            for c,sc in [('D','B'),('E','F'),('F','G'),('G','H')]:self.link(s,f'{c}{r}',self.dues_source,f'{sc}{sr}')
            self.put(s,f'H{r}',f"Bulan {d['month']:02} — {'Jelas' if d['paid'] else 'Belum bayar'}")
        self.summed_range(s,f'E{row(47)}','E',5,row(47)-1)
        self.put(s,f'D{row(49)}',f'RUMUSAN BAYARAN YURAN TAHUN {self.year}')
        self.put(s,f'D{row(50)}','Jumlah yuran yang telah dituntut')
        self.total(s,f'G{row(50)}',[(self.dues_source,f'E{r}') for r in range(2,len(dues)+2)])
        self.link(s,f'G{row(51)}',s,f'E{row(47)}')
        self.put(s,f'D{row(52)}',f'Jumlah tunggakan {self.year}')
        self.total(s,f'G{row(52)}',[(s,f'G{row(50)}'),(s,f'G{row(51)}')],[1,-1])
        self.put(s,f'C{row(54)}','CATATAN: Status tuntutan semasa eksport. Edit Excel tidak mengubah rekod aplikasi.')
        self.put(s,f'C{row(56)}','Tunggakan tahun lain: rujuk tahun berkenaan dalam aplikasi.')
        s.print_title_rows='1:4'
        if len(dues)<=42:s.page_setup.fitToHeight=1

    def save(self, directory):
        for i,wb in enumerate(self.books):
            wb.calculation=openpyxl.workbook.properties.CalcProperties(calcMode='auto',fullCalcOnLoad=True)
            for other in self.links[i]:
                source=self.books[other]
                sheets=[]
                for sid,ss in enumerate(source):
                    rows={}
                    for cells in ss:
                        for c in cells:
                            if isinstance(c,MergedCell):continue
                            v=self.val(ss,c.coordinate)
                            if v is None:continue
                            if isinstance(v,datetime):v=to_excel(v)
                            cell=ExternalCell(r=c.coordinate,t='n' if isinstance(v,(int,float,Decimal)) else 'str',v=str(v))
                            rows.setdefault(c.row,[]).append(cell)
                    sheets.append(ExternalSheetData(sheetId=sid,row=[ExternalRow(r=r,cell=cells) for r,cells in sorted(rows.items())]))
                ext=ExternalLink(externalBook=ExternalBook(sheetNames=ExternalSheetNames(sheetName=source.sheetnames),
                    sheetDataSet=ExternalSheetDataSet(sheetData=sheets),id='rId1'))
                ext.file_link=Relationship(Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath',Target=FILES[other],TargetMode='External',Id='rId1')
                wb._external_links.append(ext)
            path=directory/FILES[i]
            wb.save(path)
            self.cache_values(path,i)

    def cache_values(self,path,book):
        with zipfile.ZipFile(path) as z: files={n:z.read(n) for n in z.namelist()}
        for index,s in enumerate(self.books[book],1):
            name=f'xl/worksheets/sheet{index}.xml'
            tree=ET.fromstring(files[name])
            for c in tree.iter(f'{{{NS}}}c'):
                if c.find(f'{{{NS}}}f') is None:continue
                value=self.val(s,c.attrib['r'])
                v=c.find(f'{{{NS}}}v')
                if v is None:v=ET.SubElement(c,f'{{{NS}}}v')
                if isinstance(value,datetime):value=to_excel(value)
                if isinstance(value,(int,float,Decimal)):
                    c.attrib.pop('t',None);v.text=str(value)
                else:c.set('t','str');v.text=str(value or '')
            files[name]=ET.tostring(tree,encoding='utf-8',xml_declaration=True)
        with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
            for n,v in files.items():z.writestr(n,v)

    def build(self,directory):
        self.sources();self.documents();self.cashbooks();self.monthly();self.tunjang();self.save(directory)

    def pdf(self,directory,report,month,document_id=None):
        if report=='document':
            book=0;names=[self.doc_sheets[document_id]]
        else:
            s=self.print_sheets[(report,month if report in ['cash','monthly','tunjang'] else 0)]
            book=self.book_id(s);names=[s.title]
        # Use cached values from the exact generated XLSX: no stale external links
        # or network access when rendering the PDF, no separate HTML approximation.
        wb=openpyxl.load_workbook(directory/FILES[book],data_only=True,keep_links=False)
        for s in list(wb):
            if s.title not in names:wb.remove(s)
        wb.defined_names.clear()
        static=directory/'Cetakan.xlsx';wb.save(static)
        profile=directory/'lo-profile'
        result=subprocess.run(['soffice',f'-env:UserInstallation={profile.as_uri()}','--headless',
            '--convert-to','pdf:calc_pdf_Export','--outdir',str(directory),str(static)],
            capture_output=True,timeout=90)
        pdf=directory/'Cetakan.pdf'
        if result.returncode or not pdf.exists():
            raise RuntimeError('Penjana PDF tidak tersedia. Pasang LibreOffice Calc pada server.')
        return pdf


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('input');parser.add_argument('output');parser.add_argument('--format',choices=['zip','pdf','xlsx'],default='zip')
    parser.add_argument('--report',default='monthly');parser.add_argument('--month',type=int,default=1);parser.add_argument('--document')
    args=parser.parse_args()
    data=json.loads(Path(args.input).read_text())
    with tempfile.TemporaryDirectory(prefix='kira-excel-',dir=Path(args.output).parent) as tmp:
        directory=Path(tmp)
        export=Export(data);export.build(directory)
        if args.format=='pdf':
            result=export.pdf(directory,args.report,args.month,args.document)
            Path(args.output).write_bytes(result.read_bytes())
        elif args.format=='xlsx':
            # A standalone document retains internal Data links, but no other documents.
            wb=openpyxl.load_workbook(directory/FILES[0])
            title=export.doc_sheets[args.document]
            for s in list(wb):
                if s.title!=title:wb.remove(s)
            wb.defined_names.clear()
            # Standalone output uses editable literal values, with status and original layout.
            for row in wb[title]:
                for c in row:
                    if c.data_type=='f':
                        c.value=export.values[(0,title,c.coordinate)]
                        if isinstance(c.value,str):c.data_type='s'
            wb.save(args.output)
        else:
            with zipfile.ZipFile(args.output,'w',zipfile.ZIP_DEFLATED) as z:
                for file in FILES:z.write(directory/file,file)
                z.writestr('BACA DAHULU.txt',
                    'KIRA RAPI — PAKEJ EXCEL BERPAUT\n\nEkstrak semua fail ke folder yang sama. Jangan ubah nama fail.\n'
                    'Buka keempat-empat fail; benarkan kemas kini pautan bagi pakej ini.\n'
                    'Edit amaun/nama/butiran/rujukan di helaian Data dalam fail 1.\n'
                    'Untuk tambah/padam transaksi atau ubah bulan/dana/jenis akaun, ubah dalam aplikasi dan jana semula.\n'
                    'Amaun dalam perkataan perlu dikemas kini pada Data jika angka diubah dalam Excel.\n'
                    'Excel tidak menyegerakkan perubahan kembali ke aplikasi. PDF ialah salinan ketika dijana.\n'
                    'Baca helaian Panduan untuk pecahan dana, pelarasan, kategori tunjang dan yuran.\n')


if __name__=='__main__':
    main()
