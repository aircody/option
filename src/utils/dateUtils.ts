/**
 * 日期工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为 MM/DD
 */
export function formatShortDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * 获取两个日期之间的天数差
 */
export function getDaysDifference(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 判断是否为月度OPEX（第3个周五）
 */
export function isMonthlyOPEX(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0=周日, 5=周五
  if (dayOfWeek !== 5) return false;
  
  const weekOfMonth = Math.ceil(date.getDate() / 7);
  return weekOfMonth === 3;
}

/**
 * 判断是否为本周五
 */
export function isThisFriday(date: Date, today: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) return false;
  
  const diffDays = getDaysDifference(today, date);
  return diffDays >= 0 && diffDays < 7;
}

/**
 * 判断是否为下周五
 */
export function isNextFriday(date: Date, today: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) return false;
  
  const diffDays = getDaysDifference(today, date);
  return diffDays >= 7 && diffDays < 14;
}

/**
 * 判断是否为今日
 */
export function isToday(date: Date, today: Date): boolean {
  return formatDate(date) === formatDate(today);
}

/**
 * 判断是否为明日
 */
export function isTomorrow(date: Date, today: Date): boolean {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(date) === formatDate(tomorrow);
}

/**
 * 获取未来N天内的所有周五
 */
export function getFridaysInRange(startDate: Date, days: number): Date[] {
  const fridays: Date[] = [];
  const current = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    const checkDate = new Date(current);
    checkDate.setDate(checkDate.getDate() + i);
    
    // 周五是第5天 (0=周日, 5=周五)
    if (checkDate.getDay() === 5) {
      fridays.push(new Date(checkDate));
    }
  }
  
  return fridays;
}

/**
 * 生成未来45天内的期权到期日
 * 美股期权通常是每周五到期，月度期权是每月第3个周五
 */
export function generateExpiryDates(startDate: Date = new Date(), days: number = 45): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    const checkDate = new Date(current);
    checkDate.setDate(checkDate.getDate() + i);
    
    // 期权通常是周五到期
    if (checkDate.getDay() === 5) {
      dates.push(new Date(checkDate));
    }
  }
  
  return dates;
}

/**
 * 获取特殊日期标签
 */
export function getSpecialDateLabel(
  date: Date, 
  today: Date
): { label: string; specialType: string; isSpecial: boolean } {
  // 今日ODTE
  if (isToday(date, today)) {
    return { label: '今日ODTE', specialType: 'today', isSpecial: true };
  }
  
  // 明日
  if (isTomorrow(date, today)) {
    return { label: '明日', specialType: 'tomorrow', isSpecial: true };
  }
  
  // 月度OPEX（第3个周五）
  if (isMonthlyOPEX(date)) {
    return { label: '月度OPEX', specialType: 'opex', isSpecial: true };
  }
  
  // 本周五
  if (isThisFriday(date, today)) {
    return { label: '本周五', specialType: 'thisFriday', isSpecial: true };
  }
  
  // 下周五
  if (isNextFriday(date, today)) {
    return { label: '下周五', specialType: 'nextFriday', isSpecial: true };
  }
  
  // 其他周五（周度期权）
  if (date.getDay() === 5) {
    return { label: formatShortDate(date), specialType: 'weekly', isSpecial: false };
  }
  
  // 其他日期
  return { label: formatShortDate(date), specialType: 'other', isSpecial: false };
}

/**
 * 生成完整的到期日数据
 */
export interface ExpiryDateInfo {
  label: string;
  date: string;
  daysToExpiry: number;
  isSpecial: boolean;
  specialType: 'today' | 'tomorrow' | 'thisFriday' | 'nextFriday' | 'opex' | 'weekly' | 'other';
}

export function generateExpiryDateData(
  _symbol: string,
  startDate: Date = new Date(),
  days: number = 45
): ExpiryDateInfo[] {
  const expiryDates = generateExpiryDates(startDate, days);
  const today = new Date(startDate);
  
  return expiryDates.map(date => {
    const { label, specialType, isSpecial } = getSpecialDateLabel(date, today);
    const daysToExpiry = getDaysDifference(today, date);
    
    return {
      label,
      date: formatDate(date),
      daysToExpiry,
      isSpecial,
      specialType: specialType as ExpiryDateInfo['specialType'],
    };
  });
}
