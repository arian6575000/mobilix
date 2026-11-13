import QRCode from 'qrcode';

/** SVG markup of a QR code (no quiet zone: the caller adds padding). */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}
