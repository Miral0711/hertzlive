import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { hydrate } from './src/platform/polyfill';

// The shared store reads localStorage when first imported, so load it only after hydration.
export default function App() {
  const [Root, setRoot] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    hydrate().then(() => {
      const Mobile = require('./src/MobileApp').default;
      setRoot(() => Mobile);
    });
  }, []);
  if (!Root) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <Root />;
}
