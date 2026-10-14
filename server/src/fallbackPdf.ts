/**
 * Generates a valid standard PDF 1.4 buffer without external heavy dependencies.
 * Used to immediately showcase the PDF viewer UI with setup instructions if no native TeX compiler is yet installed.
 */
export function generateStarterPdf(title: string, message: string): Buffer {
  const content = `BT
/F1 20 Tf
50 720 Td
(${escapePdf(title)}) Tj
0 -30 Td
/F1 12 Tf
(${escapePdf('ElseWhere Document Preview')}) Tj
0 -40 Td
(${escapePdf(message)}) Tj
0 -20 Td
(${escapePdf('To enable native LaTeX compilation, install tectonic or TeX Live.')}) Tj
0 -20 Td
(${escapePdf('Tectonic auto-fetches packages and compiles in milliseconds.')}) Tj
ET`;

  const streamLength = Buffer.byteLength(content, 'utf-8');

  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n`;
  const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${content}\nendstream\nendobj\n`;

  const offset1 = Buffer.byteLength(header, 'utf-8');
  const offset2 = offset1 + Buffer.byteLength(obj1, 'utf-8');
  const offset3 = offset2 + Buffer.byteLength(obj2, 'utf-8');
  const offset4 = offset3 + Buffer.byteLength(obj3, 'utf-8');
  const xrefOffset = offset4 + Buffer.byteLength(obj4, 'utf-8');

  const pad = (n: number) => n.toString().padStart(10, '0');

  const xref = `xref\n0 5\n0000000000 65535 f \n${pad(offset1)} 00000 n \n${pad(offset2)} 00000 n \n${pad(offset3)} 00000 n \n${pad(offset4)} 00000 n \n`;
  const trailer = `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const completePdf = header + obj1 + obj2 + obj3 + obj4 + xref + trailer;
  return Buffer.from(completePdf, 'utf-8');
}

function escapePdf(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
