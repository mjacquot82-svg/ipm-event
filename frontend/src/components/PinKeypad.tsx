// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// PIN KEYPAD COMPONENT - For secure admin authentication

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';

interface PinKeypadProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin?: string;
  title?: string;
}

const PinKeypad: React.FC<PinKeypadProps> = ({
  visible,
  onClose,
  onSuccess,
  correctPin = '2026',
  title = 'Enter Admin PIN',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setPin('');
      setError(false);
    }
  }, [visible]);

  // Vibrate on key press (short haptic feedback)
  const vibrateOnPress = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(30); // Short 30ms vibration for button press
    }
  };

  const handleKeyPress = (key: string) => {
    vibrateOnPress(); // Vibrate on each key press
    
    if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);
      setError(false);

      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        setTimeout(() => {
          if (newPin === correctPin) {
            // Success vibration pattern
            if (Platform.OS !== 'web') {
              Vibration.vibrate([0, 50, 50, 50]); // Double vibrate for success
            }
            onSuccess();
            setPin('');
          } else {
            // Wrong PIN - shake and vibrate
            setError(true);
            if (Platform.OS !== 'web') {
              Vibration.vibrate(300); // Longer vibration for error
            }
            
            Animated.sequence([
              Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]).start(() => {
              setPin('');
            });
          }
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    vibrateOnPress(); // Vibrate on backspace too
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < 4; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            i < pin.length && styles.dotFilled,
            error && styles.dotError,
          ]}
        />
      );
    }
    return dots;
  };

  const renderKey = (key: string) => (
    <TouchableOpacity
      key={key}
      style={styles.key}
      onPress={() => handleKeyPress(key)}
      activeOpacity={0.7}
    >
      <Text style={styles.keyText}>{key}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
          </View>

          {/* PIN Dots */}
          <Animated.View 
            style={[
              styles.dotsContainer,
              { transform: [{ translateX: shakeAnim }] }
            ]}
          >
            {renderDots()}
          </Animated.View>

          {/* Error Message */}
          {error && (
            <Text style={styles.errorText}>Unauthorized - Invalid PIN</Text>
          )}

          {/* Keypad */}
          <View style={styles.keypad}>
            <View style={styles.keyRow}>
              {renderKey('1')}
              {renderKey('2')}
              {renderKey('3')}
            </View>
            <View style={styles.keyRow}>
              {renderKey('4')}
              {renderKey('5')}
              {renderKey('6')}
            </View>
            <View style={styles.keyRow}>
              {renderKey('7')}
              {renderKey('8')}
              {renderKey('9')}
            </View>
            <View style={styles.keyRow}>
              <View style={styles.keyEmpty} />
              {renderKey('0')}
              <TouchableOpacity
                style={styles.key}
                onPress={handleBackspace}
                activeOpacity={0.7}
              >
                <Feather name="delete" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    zIndex: 10000,
    elevation: 10000,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textMuted,
    marginHorizontal: 8,
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotError: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  keypad: {
    width: '100%',
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  key: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  keyEmpty: {
    width: 70,
    height: 70,
    margin: 6,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default PinKeypad;
