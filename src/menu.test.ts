import { expect, it } from 'vitest';
import { addDays, calendarDay, monday } from './menu';
it('calcula lunes y días al cruzar mes, año y año bisiesto',()=>{
 expect(monday('2027-01-01')).toBe('2026-12-28');
 expect(monday('2026-12-28')).toBe('2026-12-28');
 expect(addDays('2026-12-28',7)).toBe('2027-01-04');
 expect(addDays('2024-02-28',1)).toBe('2024-02-29');
 expect(addDays('2024-02-29',1)).toBe('2024-03-01');
});
it('mantiene días de calendario al pasar cambios de hora',()=>{
 expect(addDays('2026-03-28',1)).toBe('2026-03-29');
 expect(addDays('2026-10-25',-1)).toBe('2026-10-24');
 expect(calendarDay(new Date(2026,10,15,23,59))).toBe('2026-11-15');
});
