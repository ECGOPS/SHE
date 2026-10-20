import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { applyDownloadHeaders } from '../http/safe-download';

const NAVY = '#0B3D91';
const GOLD = '#C4A35A';
const INK = '#1C2430';
const MUTED = '#5C6570';
const BRAND = 'ECG SAFETY HEALTH ENVIRONMENT MANAGEMENT';

export interface ReportPhoto {
  fileName: string;
  storageKey: string;
  mimeType: string;
}

export type ReportBlock =
  | { kind: 'pair'; leftLabel: string; left: string; rightLabel: string; right: string }
  | { kind: 'text'; text: string; strong?: boolean }
  | { kind: 'photos'; files: ReportPhoto[]; empty: string };

export interface ReportSection {
  title: string;
  blocks: ReportBlock[];
}

export interface SheReport {
  kind: string;
  reference: string;
  title: string;
  preparedBy: string;
  sections: ReportSection[];
}

export function reportFilename(reference: string): string {
  return `${reference.replace(/[^\w.-]+/g, '_')}-report.pdf`;
}

export function sendPdf(res: Response, file: { buffer: Buffer; filename: string }) {
  applyDownloadHeaders(res, 'attachment', file.filename, 'application/pdf');
  return res.send(file.buffer);
}

export function words(value?: string | null): string {
  if (!value) return '—';
  return value.replaceAll('_', ' ');
}

export function when(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function day(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

export function listed(values?: string[] | null): string {
  const items = (values ?? []).map((item) => item.trim()).filter(Boolean);
  return items.length ? items.join(', ') : '—';
}

export function renderSheReport(report: SheReport): Promise<Buffer> {
  const logo = findLogo();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 96, bottom: 72, left: 48, right: 48 },
      info: {
        Title: `${report.reference} ${report.kind}`,
        Author: 'ECG Safety Health Environment Management',
        Subject: report.title,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(report.title, 48, doc.y, { width: 499 });
    doc.moveDown(0.25);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text(`Prepared ${when(new Date())} by ${report.preparedBy}. This report states the record as held in ECG SHE at the time of export.`, { width: 499 });
    doc.moveDown(0.8);
    doc.fillColor(INK);

    for (const part of report.sections) {
      heading(doc, part.title);
      for (const block of part.blocks) drawBlock(doc, block);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      paintChrome(doc, logo, report.kind, report.reference, i + 1, range.count);
    }
    doc.end();
  });
}

function drawBlock(doc: PDFKit.PDFDocument, block: ReportBlock) {
  if (block.kind === 'pair') {
    pair(doc, block.leftLabel, block.left, block.rightLabel, block.right);
    return;
  }
  if (block.kind === 'text') {
    prose(doc, block.text, block.strong);
    return;
  }
  if (!block.files.length) {
    prose(doc, block.empty);
    return;
  }
  for (const photo of block.files) {
    const filePath = join(process.cwd(), 'data', photo.storageKey);
    ensure(doc, 210);
    prose(doc, photo.fileName, true);
    if (existsSync(filePath) && /image\/(jpeg|jpg|png)/i.test(photo.mimeType)) {
      try {
        doc.image(filePath, 48, doc.y, { fit: [240, 150] });
        doc.y += 158;
        doc.x = 48;
      } catch {
        prose(doc, 'This photograph could not be embedded.');
      }
    } else {
      prose(doc, 'The file is listed on the record. It is not embedded in this report.');
    }
  }
}

function paintChrome(
  doc: PDFKit.PDFDocument,
  logo: string | null,
  kind: string,
  reference: string,
  page: number,
  pages: number,
) {
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const width = doc.page.width;
  const height = doc.page.height;
  if (logo) doc.image(logo, 48, 22, { fit: [42, 42] });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
    .text(BRAND, 98, 28, { width: 360, lineBreak: false });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
    .text(kind, 98, 44, { width: 280, lineBreak: false });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
    .text(reference, width - 210, 30, { width: 162, align: 'right', lineBreak: false });
  doc.moveTo(48, 74).lineTo(width - 48, 74).strokeColor(NAVY).lineWidth(1.4).stroke();
  doc.moveTo(48, 77).lineTo(width - 48, 77).strokeColor(GOLD).lineWidth(0.7).stroke();
  doc.moveTo(48, height - 48).lineTo(width - 48, height - 48).strokeColor(NAVY).lineWidth(0.8).stroke();
  if (logo) doc.image(logo, 48, height - 38, { fit: [20, 20] });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8)
    .text(BRAND, 74, height - 32, { width: 340, lineBreak: false });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
    .text(`Page ${page} of ${pages}`, width - 160, height - 32, { width: 112, align: 'right', lineBreak: false });
  doc.page.margins.bottom = bottom;
  doc.fillColor(INK);
}

function heading(doc: PDFKit.PDFDocument, title: string) {
  ensure(doc, 40);
  const y = doc.y;
  doc.save();
  doc.rect(48, y, 499, 18).fill(NAVY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(title, 56, y + 4, { width: 480, lineBreak: false });
  doc.restore();
  doc.fillColor(INK);
  doc.x = 48;
  doc.y = y + 26;
}

function prose(doc: PDFKit.PDFDocument, value: string, strong = false) {
  ensure(doc, 20);
  doc.fillColor(INK).font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 11 : 10)
    .text(value || '—', 48, doc.y, { width: 499 });
  doc.moveDown(0.3);
}

function pair(doc: PDFKit.PDFDocument, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
  ensure(doc, 36);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED);
  doc.text(leftLabel.toUpperCase(), 48, y, { width: 230, lineBreak: false });
  doc.text(rightLabel.toUpperCase(), 310, y, { width: 230, lineBreak: false });
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  const leftHeight = doc.heightOfString(leftValue || '—', { width: 230 });
  const rightHeight = doc.heightOfString(rightValue || '—', { width: 230 });
  doc.text(leftValue || '—', 48, y + 12, { width: 230 });
  doc.text(rightValue || '—', 310, y + 12, { width: 230 });
  doc.x = 48;
  doc.y = y + 16 + Math.max(leftHeight, rightHeight);
}

function ensure(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function findLogo(): string | null {
  const candidates = [
    join(__dirname, '../../assets/ecg-logo.png'),
    join(__dirname, '../../../src/assets/ecg-logo.png'),
    join(__dirname, '../../../apps/api/src/assets/ecg-logo.png'),
    join(process.cwd(), 'src/assets/ecg-logo.png'),
    join(process.cwd(), 'apps/api/src/assets/ecg-logo.png'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}
