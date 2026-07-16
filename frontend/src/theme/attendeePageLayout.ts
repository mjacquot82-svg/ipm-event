import { StyleSheet, useWindowDimensions } from 'react-native';

export const ATTENDEE_HORIZONTAL_MARGIN = 20;
export const ATTENDEE_DESKTOP_BREAKPOINT = 768;
export const ATTENDEE_DESKTOP_WIDTH_RATIO = 0.92;
export const ATTENDEE_CARD_RADIUS = 16;

// Home is the attendee layout reference. Keep enough trailing space for content
// to scroll above the shared bottom navigation.
export const attendeePageContent = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 88,
  },
}).container;

export function useAttendeeLayout() {
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktop = viewportWidth >= ATTENDEE_DESKTOP_BREAKPOINT;
  const contentWidth = isDesktop
    ? viewportWidth * ATTENDEE_DESKTOP_WIDTH_RATIO
    : Math.max(viewportWidth - ATTENDEE_HORIZONTAL_MARGIN * 2, 0);
  const gutteredFrameWidth = Math.min(
    contentWidth + ATTENDEE_HORIZONTAL_MARGIN * 2,
    viewportWidth,
  );

  return {
    contentWidth,
    frameStyle: isDesktop
      ? ({ width: gutteredFrameWidth, alignSelf: 'center' } as const)
      : undefined,
    sectionStyle: {
      width: contentWidth,
      alignSelf: 'center' as const,
      paddingHorizontal: 0,
    },
  };
}
