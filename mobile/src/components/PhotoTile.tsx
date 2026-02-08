// src/components/PhotoTile.tsx

import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - 4) / 3; // 3 columns with 1px gaps

interface Props {
  thumbnailUri: string | null;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export default function PhotoTile({ thumbnailUri, isSelected, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.placeholder} />
      )}
      {isSelected && (
        <View style={styles.selectedOverlay}>
          <View style={styles.checkmark}>
            <View style={styles.checkmarkInner} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    margin: 0.5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e5e5',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 6,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
});
