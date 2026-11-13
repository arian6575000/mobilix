// Documents and photos (CNIC, agreements, phone photos): stored inside the app, shrunk, never in the gallery.
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const dir = () => {
  const d = new Directory(Paths.document, 'docs');
  if (!d.exists) d.create({ intermediates: true });
  return d;
};
export const docUri = (name: string) => new File(dir(), name).uri;
const uniqueName = () => `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}.jpg`;

/** Resize + compress a picked image (1400px wide is enough to read a CNIC) and store it. Returns the stored file name. */
export async function storeImage(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1400 });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  const name = uniqueName();
  new File(out.uri).copy(new File(dir(), name));
  return name;
}

export function deleteDocFiles(names: string[]) {
  for (const n of names) { try { const f = new File(dir(), n); if (f.exists) f.delete(); } catch { /* best effort */ } }
}

/** Take a photo or choose from the gallery. Throws 'cameraPermission' when the camera is refused. */
export async function pickDocument(source: 'camera' | 'gallery'): Promise<string[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('cameraPermission');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    return res.canceled ? [] : res.assets.map((a) => a.uri);
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 6, quality: 1 });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}

/** Delete stored files no document row points to (a form closed before saving leaves them behind). */
export async function cleanOrphanDocs() {
  try {
    const { Repo } = await import('../db/repo');
    const keep = new Set(await Repo.allDocumentFiles());
    for (const item of dir().list()) { if (item instanceof File && !keep.has(item.name)) { try { item.delete(); } catch { /* ignore */ } } }
  } catch { /* best effort */ }
}

// ---- backup of the document photos (stored next to the data so a restore brings the CNIC photos back)
export async function readDocBase64(name: string): Promise<string | null> {
  try { const f = new File(dir(), name); return f.exists ? await f.base64() : null; } catch { return null; }
}
export async function writeDocBase64(name: string, b64: string): Promise<void> {
  if (!/^[\w.-]+$/.test(name)) return; // never write outside the docs folder
  const f = new File(dir(), name);
  if (f.exists) f.delete();
  f.create();
  await f.write(b64, { encoding: 'base64' });
}
