import { Platform } from 'react-native';
import type { GarbageType } from '../types/models';
import {
  loadMunicipalityData,
  loadHolidays,
  findAreaById,
  getCollectionsForDate,
} from './calendarEngine';
import { formatDateISO } from '../utils/dateUtils';

const isWeb = Platform.OS === 'web';

// Lazy-load expo-notifications & expo-device only on native
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

if (!isWeb) {
  // Dynamic require to avoid loading on web
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const CHANNEL_ID = 'garbage-collection';

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android' && Notifications) {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'ごみ収集通知',
      description: 'ごみ収集日の前日・当日にお知らせします',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (isWeb || !Notifications || !Device) return false;
  if (!Device.isDevice) {
    // Notifications don't work on simulator/emulator
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllScheduled(): Promise<void> {
  if (isWeb || !Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function buildNotificationBody(types: GarbageType[]): string {
  return types.map((t) => t.name).join('・');
}

function buildNotificationTitle(isEvening: boolean, types: GarbageType[]): string {
  if (isEvening) {
    return `明日のごみ: ${types.map((t) => t.shortName).join('・')}`;
  }
  return `今日のごみ: ${types.map((t) => t.shortName).join('・')}`;
}

export async function scheduleNotifications(
  areaId: string,
  notificationTime: 'evening' | 'morning',
  eveningHour: number,
  morningHour: number,
  daysAhead: number = 30
): Promise<number> {
  if (isWeb) return 0;

  // Cancel existing
  await cancelAllScheduled();

  const municipality = loadMunicipalityData();
  const holidays = loadHolidays();
  const area = findAreaById(municipality, areaId);
  if (!area) return 0;

  let scheduledCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);

    const collections = getCollectionsForDate(
      targetDate,
      area,
      municipality.garbageTypes,
      holidays,
      municipality.specialRules,
      municipality.overrides
    );

    if (collections.length === 0) continue;

    // Determine trigger time
    let triggerDate: Date;
    let isEvening: boolean;

    if (notificationTime === 'evening') {
      // Night before the collection day
      triggerDate = new Date(targetDate);
      triggerDate.setDate(triggerDate.getDate() - 1);
      triggerDate.setHours(eveningHour, 0, 0, 0);
      isEvening = true;
    } else {
      // Morning of the collection day
      triggerDate = new Date(targetDate);
      triggerDate.setHours(morningHour, 0, 0, 0);
      isEvening = false;
    }

    // Skip if trigger time is in the past
    if (triggerDate.getTime() <= Date.now()) continue;

    const title = buildNotificationTitle(isEvening, collections);
    const body = buildNotificationBody(collections);
    const dateStr = formatDateISO(targetDate);

    await Notifications!.scheduleNotificationAsync({
      content: {
        title,
        body: `${dateStr.slice(5).replace('-', '/')} ${body}を出してください`,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: {
        type: Notifications!.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    scheduledCount++;
  }

  return scheduledCount;
}

export async function getScheduledCount(): Promise<number> {
  if (isWeb || !Notifications) return 0;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}
