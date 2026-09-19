import React, { useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { EducationCallout } from './MapEducation';

// The ref measures the actual Find on Map action, not its vendor card or a proxy area.
export function VendorTutorialTarget({ active, onOpen, onSkip, notice, style, children }: {
  active: boolean; onOpen: () => void; onSkip: () => void; notice?: string;
  style: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const anchor = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const { height } = useWindowDimensions();
  const [inView, setInView] = useState(false);
  useEffect(() => {
    setInView(false);
    if (!active) return;
    const measure = () => anchor.current?.measureInWindow((x, y, width, h) => {
      const visible = width > 0 && h > 0 && y >= 0 && y + h < height - 60;
      setInView(visible);
      if (!visible && Platform.OS === 'web') {
        (anchor.current as unknown as HTMLElement)?.scrollIntoView?.({ block: 'center' });
      }
    });
    measure(); const timer = setInterval(measure, 250);
    return () => clearInterval(timer);
  }, [active, height]);
  return <>
    <TouchableOpacity ref={anchor} testID="vendor-find-on-map" accessibilityRole="button" accessibilityLabel="Find on Map" style={style} onPress={onOpen}>
      {children}
    </TouchableOpacity>
    {active && inView ? <EducationCallout title="Find this vendor"
      body={`${notice ? notice + ' ' : ''}Tap Find on Map to see where this vendor is located.`}
      target={anchor.current} onTargetPress={onOpen} onDismiss={onSkip}
      targetLabel="Open highlighted vendor on map" targetTestID="vendor-education-open-map" /> : null}
  </>;
}

export function VendorTutorialUnavailable({ onSkip }: { onSkip: () => void }) {
  return <EducationCallout title="Vendor locations unavailable"
    body="No mapped vendor locations are available right now. You can replay Vendors Help when locations are available."
    onDismiss={onSkip} onSkip={onSkip} />;
}

// This is Vendor continuation only. It never launches or changes the Maps tour.
export function VendorMapArrival({ token, name, onComplete }: { token?: string; name?: string; onComplete: () => void }) {
  const pathname = usePathname();
  const [completed, setCompleted] = useState<string>();
  if (!token || !name || completed === token || !pathname.endsWith('/map')) return null;
  return <EducationCallout title="Vendor location"
    body={`${name} is highlighted on the map. This is where you can find this vendor.`}
    onDismiss={() => { setCompleted(token); onComplete(); }} />;
}
