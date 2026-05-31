import QRCode from 'qrcode';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  width: 300,
  color: { dark: '#000000', light: '#ffffff' },
};

export async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, QR_OPTIONS);
}

export async function generateQRBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, QR_OPTIONS);
}
