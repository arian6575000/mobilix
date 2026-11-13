import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { qrSvg } from '../lib/qr';

export function Qr({ value, size = 160 }: { value: string; size?: number }) {
  const [xml, setXml] = useState('');
  useEffect(() => { let on = true; qrSvg(value).then((x) => on && setXml(x)).catch(() => {}); return () => { on = false; }; }, [value]);
  return <View style={{ width: size, height: size, backgroundColor: '#fff', padding: 8, borderRadius: 12 }}>{xml ? <SvgXml xml={xml} width="100%" height="100%" /> : null}</View>;
}
