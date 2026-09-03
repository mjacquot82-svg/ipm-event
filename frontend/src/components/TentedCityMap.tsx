import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TextInput, TouchableOpacity, Keyboard,
  LayoutChangeEvent, Platform, useWindowDimensions, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue, withDecay, withRepeat, withTiming,
} from 'react-native-reanimated';
import colors from '../theme/colors';
import { tentedCityVendors } from '../data/tentedCityVendors';
import { tentedCityVenues } from '../config/tentedCityVenues';
import type { Rect, TentedCityPlace } from '../config/tentedCityTypes';
import { findTentedCityPlace, placeRect, placeTitle, searchTentedCity } from '../config/tentedCitySearch';
import { tentedCityLayerLayout, tentedCityPaintViewport } from '../config/tentedCityLayout';
import { TENTED_CITY_VERIFY_PARENTS, focusRectForFootprint } from '../config/tentedCityGeometry';
import { footprintForVendor } from '../config/tentedCityVendorMatch';
import { getScheduleData, ScheduleEvent } from '../services/spreadsheetDataService';
import {
  clampTranslation, DOUBLE_TAP_SCALE, flyToRect, pinchAroundMovingFocal, rubberBandTranslation, translationBounds, zoomAroundFocal,
} from '../config/tentedCityCamera';

const MAP_SOURCE = require('../../assets/images/tented-city-map.png');
const TAB_BAR_HEIGHT = 60;
const INFO_CARD_GAP = 8;
const INFO_CARD_BOTTOM = TAB_BAR_HEIGHT + INFO_CARD_GAP;
const SELECTED_RESERVED_BOTTOM = TAB_BAR_HEIGHT + 108;
const WEB_TOUCH_LOCK = { touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none' } as object;
