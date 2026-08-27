import type { ApiFailureKind } from './apiFailureClassification';

export type HomeRefreshState = 'pending' | 'succeeded' | 'connectivity-failed' | 'other-failed';

export function refreshStateAfterFailure(failureKind: ApiFailureKind): HomeRefreshState {
  return failureKind === 'connectivity' ? 'connectivity-failed' : 'other-failed';
}

export function shouldShowHomeConnectivityBanner({
  dataSource,
  hasCachedContent,
  refreshState,
  knownOffline,
}: {
  dataSource: 'network' | 'cache';
  hasCachedContent: boolean;
  refreshState: HomeRefreshState;
  knownOffline: boolean;
}) {
  return dataSource === 'cache'
    && hasCachedContent
    && (knownOffline || refreshState === 'connectivity-failed');
}
