import {
  buildConfirmedTruckSetForStatus,
  deriveConfirmationCoverage,
  parseStatusFromDispatchStatusKey,
} from './confirmationStateHelpers';
import { getEffectiveView } from '@/components/session/workspaceUtils';

export const CLICK_TO_READ_NOTIFICATION_CATEGORIES = new Set(['dispatch_update_info', 'driver_dispatch_seen']);
export const NON_CONFIRMATION_NOTIFICATION_CATEGORIES = CLICK_TO_READ_NOTIFICATION_CATEGORIES;

function parseStatusFromDedupKey(notification) {
  return parseStatusFromDispatchStatusKey(notification?.dispatch_status_key);
}

export function isNotificationMarkedReadOnClick(notification) {
  return CLICK_TO_READ_NOTIFICATION_CATEGORIES.has(notification?.notification_category);
}

export function getNotificationEffectiveReadFlag({
  session,
  notification,
  dispatch = null,
  confirmations = [],
  ownerAllowedTrucks = [],
}) {
  if (getEffectiveView(session) !== 'CompanyOwner') {
    return Boolean(notification?.read_flag);
  }

  return getOwnerNotificationActionStatus({
    notification,
    dispatch,
    confirmations,
    ownerAllowedTrucks,
  }).effectiveReadFlag;
}

export function getOwnerNotificationRequiredTrucks({ notification, dispatch = null, ownerAllowedTrucks = [] }) {
  const fallbackRequired = Array.isArray(notification?.required_trucks)
    ? notification.required_trucks.filter(Boolean)
    : [];

  if (!dispatch) return fallbackRequired;

  const dispatchTrucks = Array.isArray(dispatch?.trucks_assigned)
    ? dispatch.trucks_assigned.filter(Boolean)
    : [];

  if (!ownerAllowedTrucks?.length) return fallbackRequired.length ? fallbackRequired : dispatchTrucks;

  const allowedSet = new Set(ownerAllowedTrucks);
  const scopedDispatchTrucks = dispatchTrucks.filter((truck) => allowedSet.has(truck));

  // Fallback to persisted required_trucks when live dispatch scope data is temporarily missing
  // so unread/action-needed state does not silently auto-resolve for owner dispatch notifications.
  if (!scopedDispatchTrucks.length && fallbackRequired.length) return fallbackRequired;

  return scopedDispatchTrucks;
}

export function getOwnerNotificationActionStatus({
  notification,
  dispatch = null,
  confirmations = [],
  ownerAllowedTrucks = [],
}) {
  const isOwnerNotification = notification?.recipient_type === 'AccessCode';
  const isConfirmationNotification = !NON_CONFIRMATION_NOTIFICATION_CATEGORIES.has(notification?.notification_category);
  const dispatchId = notification?.related_dispatch_id;
  const status = parseStatusFromDedupKey(notification);

  if (!isOwnerNotification || !isConfirmationNotification || !dispatchId || !status) {
    return {
      isOwnerConfirmationNotification: false,
      status,
      requiredTrucks: [],
      confirmedTrucks: [],
      pendingTrucks: [],
      total: 0,
      done: 0,
      needsAction: !notification?.read_flag,
      effectiveReadFlag: Boolean(notification?.read_flag),
    };
  }

  const requiredTrucks = getOwnerNotificationRequiredTrucks({ notification, dispatch, ownerAllowedTrucks });
  const confirmationSet = buildConfirmedTruckSetForStatus({
    confirmations,
    dispatchId,
    status,
  });
  const { confirmedTrucks, pendingTrucks, done, total, allConfirmed } = deriveConfirmationCoverage(requiredTrucks, confirmationSet);
  const hasActionableTruckScope = requiredTrucks.length > 0;
  const needsAction = hasActionableTruckScope ? !allConfirmed : !notification?.read_flag;

  return {
    isOwnerConfirmationNotification: true,
    status,
    requiredTrucks,
    confirmedTrucks,
    pendingTrucks,
    total,
    done,
    needsAction,
    effectiveReadFlag: Boolean(notification?.read_flag) || !needsAction,
  };
}
