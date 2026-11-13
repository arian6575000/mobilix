import { Linking } from 'react-native';
import { waNumber } from './format';

/** Opens WhatsApp with a ready message (works without the number being saved in contacts). */
export async function openWhatsApp(phone: string, text: string, cc = '92') {
  const n = waNumber(phone, cc);
  const url = `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  await Linking.openURL(url);
}
