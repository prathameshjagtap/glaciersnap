// src/components/SkeletonGrid.tsx

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - 4) / 3;

export default function SkeletonGrid() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <View style={styles.container}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Animated.View key={i} style={[styles.tile, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 0.5,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    margin: 0.5,
    backgroundColor: '#e5e5e5',
    borderRadius: 2,
  },
});
