// src/components/DateSectionHeader.tsx

import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface Props {
  title: string;
}

export default function DateSectionHeader({ title }: Props) {
  return <Text style={styles.header}>{title}</Text>;
}

const styles = StyleSheet.create({
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
});
