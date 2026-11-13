// Printing and sharing. HTML itself is built in receiptHtml.ts (pure, testable).
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { estimateHeight, isThermal, paperPx, type Paper } from './receiptHtml';

export * from './receiptHtml';

/** A PDF whose page is exactly the paper size (thermal: paper width x content height; A4: normal page). */
async function makePdf(html: string, paper: Paper) {
  if (!isThermal(paper)) return Print.printToFileAsync({ html });
  return Print.printToFileAsync({ html, width: paperPx(paper), height: estimateHeight(html, paper) });
}

/**
 * Opens the system print dialog (pick the printer, or "Save as PDF").
 * Thermal: the PDF is made first at the true roll size, then that PDF is printed, so the page is not shrunk into a corner of an A4 sheet.
 */
export async function printHtml(html: string, paper: Paper) {
  if (!isThermal(paper)) { await Print.printAsync({ html }); return; }
  const { uri } = await makePdf(html, paper);
  await Print.printAsync({ uri });
}

/** Makes a PDF and opens the share sheet (WhatsApp, Drive, ...). */
export async function shareHtmlPdf(html: string, paper: Paper) {
  const { uri } = await makePdf(html, paper);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
