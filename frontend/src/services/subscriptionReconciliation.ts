import type { ReconciliationResult } from './subscriptionReconciliationCore';
export type { ReconciliationResult, ReconciliationState } from './subscriptionReconciliationCore';
export const reconciliationEnabled=()=>false;
export const hasExistingReconciliationCapability=()=>false;
export const watchReconciliation=(_listener:(result:ReconciliationResult)=>void)=>()=>{};
export const startSubscriptionReconciliation=()=>()=>{};
export const reconcileSubscription=async():Promise<ReconciliationResult>=>({status:'INELIGIBLE'});

export const isProductionPilot=async()=>false;

export async function readNotificationSupportReference(): Promise<string | null> { return null; }
